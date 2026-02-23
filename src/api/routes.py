"""FastAPI-бэкенд GoszakupAI."""
import logging
import json
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, Request, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.model.analyzer import GoszakupAnalyzer
from src.utils.config import API_KEY, CORS_ALLOWED_ORIGINS, RAW_DIR, set_goszakup_token
from src.api.middleware import RateLimitMiddleware, UnifiedErrorHandler

logger = logging.getLogger(__name__)

analyzer: Optional[GoszakupAnalyzer] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Инициализация анализатора при старте приложения."""
    global analyzer
    logger.info("[API] Starting GoszakupAI...")
    analyzer = GoszakupAnalyzer(use_transformers=False)
    analyzer.initialize()
    logger.info("[API] Analyzer ready")
    yield
    logger.info("[API] Shutting down")


app = FastAPI(
    title="GoszakupAI",
    description="AI-система анализа рисков в государственных закупках РК",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_api_key(x_api_key: str = Header(default="")):
    """Проверка API-ключа для защищенных эндпоинтов."""
    if not API_KEY:
        raise HTTPException(503, detail="API key not configured")
    if x_api_key != API_KEY:
        raise HTTPException(401, detail="Invalid API key")

# Лимиты запросов
endpoint_limits = {
    "/api/lots": (50, 60),  # 50 req/min
    "/api/analyze": (20, 60),  # 20 req/min
    "/api/network": (30, 60),  # 30 req/min
}

app.add_middleware(
    RateLimitMiddleware,
    max_requests=100,
    window_seconds=60,
    endpoint_limits=endpoint_limits,
    whitelist_paths=["/api/health", "/docs", "/openapi.json", "/redoc"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Единый обработчик непойманных исключений."""
    return UnifiedErrorHandler.handle_api_exception(exc, request)


class AnalyzeTextRequest(BaseModel):
    text: str
    budget: float = 0
    participants_count: int = 0
    deadline_days: int = 0
    category_code: str = ""


class HealthResponse(BaseModel):
    status: str
    total_lots: int
    analyzer_ready: bool


class TokenRequest(BaseModel):
    token: str
    persist: bool = True


@app.get("/api/health", response_model=HealthResponse)
async def health():
    """Проверка доступности сервиса."""
    return HealthResponse(
        status="ok",
        total_lots=len(analyzer._lots) if analyzer else 0,
        analyzer_ready=analyzer is not None and analyzer._initialized,
    )


@app.get("/api/mock/schema", dependencies=[Depends(require_api_key)])
async def get_schema_mock():
    """Возвращает сгенерированный JSON мок-схемы."""
    mock_path = RAW_DIR / "goszakup_schema_mock.json"
    if not mock_path.exists():
        raise HTTPException(404, detail="goszakup_schema_mock.json not found")

    try:
        content = mock_path.read_text(encoding="utf-8")
        return json.loads(content)
    except Exception as exc:
        logger.exception(f"[API] Failed to read schema mock: {exc}")
        raise HTTPException(500, detail="Failed to load schema mock")


@app.post("/api/settings/token", dependencies=[Depends(require_api_key)])
async def update_token(request: TokenRequest):
    """Обновляет токен goszakup и переинициализирует анализатор."""
    token = request.token.strip()
    if not token:
        raise HTTPException(400, detail="Token cannot be empty")

    try:
        set_goszakup_token(token, persist=request.persist)

        global analyzer
        analyzer = GoszakupAnalyzer(use_transformers=False)
        analyzer.initialize()

        return {
            "status": "ok",
            "message": "Token updated and analyzer reloaded",
        }
    except Exception as exc:
        logger.exception(f"[API] Failed to update token: {exc}")
        raise HTTPException(500, detail="Failed to update token")


@app.get("/api/lots", dependencies=[Depends(require_api_key)])
async def list_lots(
    page: int = Query(0, ge=0),
    size: int = Query(20, ge=1, le=100),
    risk_level: Optional[str] = Query(None, description="Filter by risk level: LOW, MEDIUM, HIGH, CRITICAL"),
    search: Optional[str] = Query(None, description="Search in lot name/description"),
    sort_by: str = Query("risk_score", description="Sort field: risk_score, budget, deadline_days"),
    sort_desc: bool = Query(True),
):
    """Список лотов с фильтрами и оценкой риска."""
    try:
        if not analyzer:
            raise HTTPException(
                503,
                detail={
                    "error": "Analyzer not ready",
                    "message": "System initialization in progress"
                }
            )

        logger.debug(f"[API] Fetching lots: page={page}, size={size}, risk_level={risk_level}, search={search}")

        results = analyzer.analyze_all()

        if risk_level:
            valid_levels = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
            if risk_level.upper() not in valid_levels:
                raise HTTPException(
                    400,
                    detail=f"Invalid risk_level. Must be one of {valid_levels}"
                )
            results = [r for r in results if r.final_level == risk_level.upper()]

        if search:
            if len(search.strip()) < 2:
                raise HTTPException(400, detail="Search term must be at least 2 characters")
            search_lower = search.lower()
            results = [
                r for r in results
                if search_lower in r.lot_data.get("name_ru", "").lower()
                or search_lower in r.lot_data.get("desc_ru", "").lower()
            ]

        try:
            if sort_by == "risk_score":
                results.sort(key=lambda r: r.final_score, reverse=sort_desc)
            elif sort_by == "budget":
                results.sort(key=lambda r: r.lot_data.get("budget", 0), reverse=sort_desc)
            elif sort_by == "deadline_days":
                results.sort(key=lambda r: r.lot_data.get("deadline_days", 0), reverse=sort_desc)
            else:
                raise HTTPException(400, detail=f"Invalid sort_by: {sort_by}")
        except Exception as e:
            logger.error(f"[API] Sorting error: {e}")
            raise HTTPException(400, detail=f"Sorting error: {str(e)}")

        total = len(results)

        start = page * size
        end = start + size
        page_results = results[start:end]

        if page > 0 and not page_results:
            raise HTTPException(
                404,
                detail=f"Page {page} does not exist. Total pages: {(total + size - 1) // size}"
            )

        logger.info(f"[API] Returning {len(page_results)} of {total} lots")

        return {
            "total": total,
            "page": page,
            "size": size,
            "pages": (total + size - 1) // size,
            "items": [
                {
                    "lot_id": r.lot_id,
                    "name_ru": r.lot_data.get("name_ru", ""),
                    "category_name": r.lot_data.get("category_name", ""),
                    "budget": r.lot_data.get("budget", 0),
                    "participants_count": r.lot_data.get("participants_count", 0),
                    "deadline_days": r.lot_data.get("deadline_days", 0),
                    "city": r.lot_data.get("city", ""),
                    "risk_score": round(r.final_score, 1),
                    "risk_level": r.final_level,
                    "rules_count": len(r.rule_analysis.rules_triggered) if r.rule_analysis else 0,
                }
                for r in page_results
            ],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[API] Unexpected error in list_lots: {e}")
        raise HTTPException(
            500,
            detail="Internal error while fetching lots. Please try again later."
        )

@app.get("/api/lots/{lot_id}/analysis", dependencies=[Depends(require_api_key)])
async def analyze_lot(lot_id: str):
    """Подробный анализ выбранного лота."""
    try:
        if not analyzer:
            raise HTTPException(503, detail="Analyzer not ready")

        logger.debug(f"[API] Analyzing lot: {lot_id}")
        
        result = analyzer.analyze_lot(lot_id)
        if not result.lot_data:
            logger.warning(f"[API] Lot {lot_id} not found")
            raise HTTPException(404, detail=f"Lot {lot_id} not found")

        logger.info(f"[API] Analysis complete for lot {lot_id}: risk_score={result.final_score}")
        return result.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[API] Error analyzing lot {lot_id}: {e}")
        raise HTTPException(500, detail="Internal error while analyzing lot")


@app.post("/api/analyze", dependencies=[Depends(require_api_key)])
async def analyze_text(request: AnalyzeTextRequest):
    """Анализ произвольного текста ТЗ."""
    try:
        if not analyzer:
            raise HTTPException(503, detail="Analyzer not ready")

        if not request.text.strip():
            raise HTTPException(400, detail="Text cannot be empty")

        if len(request.text) > 10000:
            raise HTTPException(400, detail="Text too long (max 10000 characters)")

        logger.debug(f"[API] Analyzing text: {len(request.text)} chars")

        metadata = {
            "budget": max(0, request.budget),
            "participants_count": max(0, request.participants_count),
            "deadline_days": max(0, request.deadline_days),
            "category_code": request.category_code or "",
        }

        result = analyzer.analyze_text(request.text, metadata=metadata)
        logger.info(f"[API] Text analysis complete: risk_score={result.final_score}")
        return result.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[API] Error analyzing text: {e}")
        raise HTTPException(500, detail="Internal error while analyzing text")


@app.get("/api/stats/dashboard", dependencies=[Depends(require_api_key)])
async def dashboard_stats():
    """Get aggregated dashboard statistics."""
    if not analyzer:
        raise HTTPException(503, "Analyzer not ready")

    return analyzer.get_dashboard_stats()


@app.get("/api/stats/categories", dependencies=[Depends(require_api_key)])
async def category_stats():
    """Get risk breakdown by KTRU categories."""
    if not analyzer:
        raise HTTPException(503, "Analyzer not ready")

    stats = analyzer.get_dashboard_stats()
    return stats.get("by_category", {})


@app.get("/api/network/{bin_id}", dependencies=[Depends(require_api_key)])
async def network_analysis(bin_id: str):
    """Get network analysis for a BIN."""
    if not analyzer:
        raise HTTPException(503, "Analyzer not ready")

    result = analyzer.network.analyze_bin(bin_id)
    return result.to_dict()


@app.get("/api/network", dependencies=[Depends(require_api_key)])
async def network_graph():
    """Get full network graph data for visualization."""
    if not analyzer:
        raise HTTPException(503, "Analyzer not ready")

    return analyzer.network.get_graph_data()
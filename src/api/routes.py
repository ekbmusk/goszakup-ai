"""
GoszakupAI — FastAPI Backend
REST API for the analysis platform.
"""
import logging
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.model.analyzer import GoszakupAnalyzer
from src.utils.config import CORS_ALLOWED_ORIGINS

logger = logging.getLogger(__name__)

analyzer: Optional[GoszakupAnalyzer] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
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
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


@app.get("/api/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        total_lots=len(analyzer._lots) if analyzer else 0,
        analyzer_ready=analyzer is not None and analyzer._initialized,
    )


@app.get("/api/lots")
async def list_lots(
    page: int = Query(0, ge=0),
    size: int = Query(20, ge=1, le=100),
    risk_level: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("risk_score"),
    sort_desc: bool = Query(True),
):
    if not analyzer:
        raise HTTPException(503, "Analyzer not ready")

    results = analyzer.analyze_all()

    if risk_level:
        results = [r for r in results if r.final_level == risk_level.upper()]

    if search:
        search_lower = search.lower()
        results = [
            r for r in results
            if search_lower in r.lot_data.get("name_ru", "").lower()
            or search_lower in r.lot_data.get("desc_ru", "").lower()
        ]

    if sort_by == "risk_score":
        results.sort(key=lambda r: r.final_score, reverse=sort_desc)
    elif sort_by == "budget":
        results.sort(key=lambda r: r.lot_data.get("budget", 0), reverse=sort_desc)
    elif sort_by == "deadline_days":
        results.sort(key=lambda r: r.lot_data.get("deadline_days", 0), reverse=sort_desc)

    total = len(results)
    start = page * size
    page_results = results[start:start + size]

    return {
        "total": total,
        "page": page,
        "size": size,
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


@app.get("/api/lots/{lot_id}/analysis")
async def analyze_lot(lot_id: str):
    if not analyzer:
        raise HTTPException(503, "Analyzer not ready")

    result = analyzer.analyze_lot(lot_id)
    if not result.lot_data:
        raise HTTPException(404, f"Lot {lot_id} not found")

    return result.to_dict()


@app.post("/api/analyze")
async def analyze_text(request: AnalyzeTextRequest):
    if not analyzer:
        raise HTTPException(503, "Analyzer not ready")

    if not request.text.strip():
        raise HTTPException(400, "Text cannot be empty")

    metadata = {
        "budget": request.budget,
        "participants_count": request.participants_count,
        "deadline_days": request.deadline_days,
        "category_code": request.category_code,
    }

    result = analyzer.analyze_text(request.text, metadata=metadata)
    return result.to_dict()


@app.get("/api/stats/dashboard")
async def dashboard_stats():
    if not analyzer:
        raise HTTPException(503, "Analyzer not ready")
    return analyzer.get_dashboard_stats()


@app.get("/api/network/{bin_id}")
async def network_analysis(bin_id: str):
    if not analyzer:
        raise HTTPException(503, "Analyzer not ready")
    result = analyzer.network.analyze_bin(bin_id)
    return result.to_dict()

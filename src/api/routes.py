"""
GoszakupAI — FastAPI Backend
REST API for the analysis platform.
"""
import logging
import csv
import io
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from src.model.analyzer import GoszakupAnalyzer
from src.utils.config import CORS_ALLOWED_ORIGINS, LABELS_CSV

logger = logging.getLogger(__name__)

analyzer: Optional[GoszakupAnalyzer] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global analyzer
    logger.info("[API] Starting GoszakupAI...")
    analyzer = GoszakupAnalyzer(use_transformers=False)
    analyzer.initialize()
    analyzer.start_background_analysis(batch_size=50, sleep_seconds=0.05)
    logger.info("[API] Analyzer ready")
    yield
    if analyzer:
        analyzer.save_analysis_cache()
    logger.info("[API] Shutting down")


app = FastAPI(
    title="GoszakupAI",
    description="AI-система анализа рисков в государственных закупках РК",
    version="0.1.0",
    lifespan=lifespan,
)

# Ensure localhost is always in the allowed origins for development
allowed_origins = list(set(CORS_ALLOWED_ORIGINS + [
    "http://localhost:3000",
    "http://localhost:8006",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8006",
]))

logger.info(f"[API] CORS Allowed Origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


class AnalyzeTextRequest(BaseModel):
    text: str
    budget: float = 0
    participants_count: int = 0
    deadline_days: int = 0
    category_code: str = ""


class FeedbackRequest(BaseModel):
    lot_id: str
    label: int
    comment: str | None = None


class HealthResponse(BaseModel):
    status: str
    total_lots: int
    analyzer_ready: bool


@app.get("/health")
async def health_simple():
    """Simple health check for Docker healthcheck"""
    return {"status": "ok"}


@app.get("/api/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        total_lots=len(analyzer._lots) if analyzer else 0,
        analyzer_ready=analyzer is not None and analyzer._initialized,
    )


def get_effective_unit_price(lot_data: dict) -> float:
    """Calculate effective unit price from lot data with fallback logic."""
    unit_price = lot_data.get("unit_price", 0) or 0
    budget = lot_data.get("budget", 0) or 0
    quantity = lot_data.get("quantity", 0) or 0
    
    # Use unit_price if available and > 0
    if unit_price > 0:
        return unit_price
    # Calculate from budget and quantity
    elif budget > 0 and quantity > 0:
        return budget / quantity
    # Fallback to budget
    elif budget > 0:
        return budget
    return 0


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

    analyzer.analyze_incremental(max_new=50)
    results = analyzer.get_cached_results()

    if risk_level:
        results = [r for r in results if r.final_level == risk_level.upper()]

    if search:
        search_lower = search.lower().strip()
        search_normalized = search_lower.replace("история", "").strip()
        results = [
            r for r in results
            if search_lower in r.lot_data.get("name_ru", "").lower()
            or search_lower in r.lot_data.get("desc_ru", "").lower()
            or search_lower in str(r.lot_id).lower()
            or (search_normalized and search_normalized in str(r.lot_id).lower())
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
                "category_code": r.lot_data.get("category_code", ""),
                "category_name": r.lot_data.get("category_name", ""),
                "budget": r.lot_data.get("budget", 0),
                "unit_price": r.lot_data.get("unit_price", 0),  # Add unit_price to response
                "quantity": r.lot_data.get("quantity", 0),  # Add quantity to response
                "participants_count": r.lot_data.get("participants_count", 0),
                "deadline_days": r.lot_data.get("deadline_days", 0),
                "city": r.lot_data.get("city", ""),
                "risk_score": round(r.final_score, 1),
                "risk_level": r.final_level,
                "rules_count": len(r.rule_analysis.rules_triggered) if r.rule_analysis else 0,
                "category_median": (
                    analyzer.feature_engineer._get_median_budget(r.lot_data.get("category_code", ""))
                    if r.lot_data.get("category_code") else None
                ),
                "price_deviation_pct": (
                    round(
                        (get_effective_unit_price(r.lot_data) - analyzer.feature_engineer._get_median_budget(r.lot_data.get("category_code", ""))) 
                        / analyzer.feature_engineer._get_median_budget(r.lot_data.get("category_code", "")) * 100, 1
                    )
                    if r.lot_data.get("category_code") 
                    and analyzer.feature_engineer._get_median_budget(r.lot_data.get("category_code", "")) > 0
                    and get_effective_unit_price(r.lot_data) > 0
                    else None
                ),
                "is_synthetic": r.lot_data.get("is_synthetic", False),
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


@app.post("/api/feedback")
async def submit_feedback(request: FeedbackRequest):
    if not analyzer:
        raise HTTPException(503, "Analyzer not ready")

    if request.label not in (0, 1):
        raise HTTPException(400, "label must be 0 or 1")

    labels_path = Path(LABELS_CSV)
    labels_path.parent.mkdir(parents=True, exist_ok=True)

    is_new = not labels_path.exists()
    with open(labels_path, "a", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        if is_new:
            writer.writerow(["lot_id", "label", "comment", "created_at"])
        writer.writerow([
            request.lot_id,
            request.label,
            request.comment or "",
            datetime.now(timezone.utc).isoformat(),
        ])

    return {"status": "ok"}


@app.get("/api/stats/dashboard")
async def dashboard_stats():
    if not analyzer:
        raise HTTPException(503, "Analyzer not ready")
    analyzer.analyze_incremental(max_new=50)
    stats = analyzer.get_dashboard_stats()
    
    # Add synthetic vs real data statistics
    results = analyzer.get_cached_results()
    synthetic_count = sum(1 for r in results if r.lot_data.get("is_synthetic", False))
    real_count = len(results) - synthetic_count
    
    # Risk distribution by type
    synthetic_risk_dist = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    real_risk_dist = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    
    for r in results:
        if r.lot_data.get("is_synthetic", False):
            synthetic_risk_dist[r.final_level] += 1
        else:
            real_risk_dist[r.final_level] += 1
    
    stats["data_type_stats"] = {
        "total_synthetic": synthetic_count,
        "total_real": real_count,
        "synthetic_risk_dist": synthetic_risk_dist,
        "real_risk_dist": real_risk_dist,
    }
    
    return stats


@app.get("/api/export/csv")
async def export_csv(
    risk_level: Optional[str] = Query(None, regex="^(LOW|MEDIUM|HIGH|CRITICAL)$"),
    exclude_synthetic: bool = Query(False),
    category_code: Optional[str] = None,
    min_budget: Optional[float] = None,
    max_budget: Optional[float] = None,
):
    """Экспорт данных лотов в CSV формате с фильтрами."""
    if not analyzer:
        raise HTTPException(503, "Analyzer not ready")
    
    analyzer.analyze_incremental(max_new=50)
    results = analyzer.get_cached_results()
    
    # Apply filters
    filtered_results = []
    for r in results:
        # Filter by risk level
        if risk_level and r.final_level != risk_level:
            continue
        
        # Filter synthetic data
        if exclude_synthetic and r.lot_data.get("is_synthetic", False):
            continue
        
        # Filter by category
        if category_code and r.lot_data.get("category_code") != category_code:
            continue
        
        # Filter by budget range
        budget = r.lot_data.get("budget", 0)
        if min_budget is not None and budget < min_budget:
            continue
        if max_budget is not None and budget > max_budget:
            continue
        
        filtered_results.append(r)
    
    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        "Lot ID",
        "Name (RU)",
        "Category Code",
        "Category Name",
        "City",
        "Budget (KZT)",
        "Participants Count",
        "Deadline Days",
        "Risk Score",
        "Risk Level",
        "Price Deviation %",
        "Customer BIN",
        "Customer Name",
        "Is Synthetic",
    ])
    
    # Data rows
    for r in filtered_results:
        lot = r.lot_data
        writer.writerow([
            r.lot_id,
            lot.get("name_ru", ""),
            lot.get("category_code", ""),
            lot.get("category_name", ""),
            lot.get("city", ""),
            lot.get("budget", 0),
            lot.get("participants_count", 0),
            lot.get("deadline_days", 0),
            round(r.final_score, 2),
            r.final_level,
            round(lot.get("price_deviation_pct", 0), 2) if lot.get("price_deviation_pct") is not None else "",
            lot.get("customer_bin", ""),
            lot.get("customer_name", ""),
            "Yes" if lot.get("is_synthetic", False) else "No",
        ])
    
    # Prepare file response
    output.seek(0)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"goszakup_lots_export_{timestamp}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Type": "text/csv; charset=utf-8",
        }
    )


@app.get("/api/network/{bin_id}")
async def network_analysis(bin_id: str):
    if not analyzer:
        raise HTTPException(503, "Analyzer not ready")
    result = analyzer.network.analyze_bin(bin_id)
    return result.to_dict()


@app.get("/api/stats/category-pricing")
async def category_pricing_stats(
    sort_by: str = Query("count", regex="^(count|median|high_risk)$"),
    min_count: int = Query(1, ge=1),
):
    """Возвращает статистику цен по всем категориям."""
    if not analyzer:
        raise HTTPException(503, "Analyzer not ready")
    
    analyzer.analyze_incremental(max_new=50)
    results = analyzer.get_cached_results()
    
    # Collect data per category
    category_data = {}
    for r in results:
        cat_code = r.lot_data.get("category_code", "")
        cat_name = r.lot_data.get("category_name", "Другое")
        if not cat_code:
            continue
        
        if cat_code not in category_data:
            category_data[cat_code] = {
                "category_code": cat_code,
                "category_name": cat_name,
                "count": 0,
                "high_risk_count": 0,
            }
        
        category_data[cat_code]["count"] += 1
        if r.final_level in ("HIGH", "CRITICAL"):
            category_data[cat_code]["high_risk_count"] += 1
    
    # Add price statistics
    categories_list = []
    for cat_code, data in category_data.items():
        if data["count"] < min_count:
            continue
        
        price_stats = analyzer.feature_engineer.get_category_price_stats(cat_code)
        if price_stats:
            data.update({
                "median": price_stats["median"],
                "min": price_stats["min"],
                "max": price_stats["max"],
                "avg": price_stats["mean"],
                "std_dev": price_stats["std_dev"],
            })
        else:
            data.update({
                "median": 0,
                "min": 0,
                "max": 0,
                "avg": 0,
                "std_dev": 0,
            })
        
        data["high_risk_pct"] = round(
            (data["high_risk_count"] / data["count"] * 100) if data["count"] > 0 else 0, 1
        )
        categories_list.append(data)
    
    # Sort
    if sort_by == "count":
        categories_list.sort(key=lambda x: x["count"], reverse=True)
    elif sort_by == "median":
        categories_list.sort(key=lambda x: x["median"], reverse=True)
    elif sort_by == "high_risk":
        categories_list.sort(key=lambda x: x["high_risk_pct"], reverse=True)
    
    return {"categories": categories_list, "total": len(categories_list)}


@app.get("/api/categories/{category_code}/pricing")
async def category_pricing_detail(category_code: str):
    """Возвращает детальную статистику цен для конкретной категории."""
    if not analyzer:
        raise HTTPException(503, "Analyzer not ready")
    
    price_stats = analyzer.feature_engineer.get_category_price_stats(category_code)
    if not price_stats:
        raise HTTPException(404, f"Category {category_code} not found or has no data")
    
    # Find sample lots in this category
    results = analyzer.get_cached_results()
    category_lots = [
        r for r in results 
        if r.lot_data.get("category_code") == category_code
    ]
    
    if not category_lots:
        raise HTTPException(404, f"No lots found for category {category_code}")
    
    category_name = category_lots[0].lot_data.get("category_name", "")
    
    # Get sample lots with deviation
    median = price_stats["median"]
    sample_lots = []
    for r in sorted(category_lots, key=lambda x: x.final_score, reverse=True)[:10]:
        budget = r.lot_data.get("budget", 0)
        deviation_pct = (
            round((budget - median) / median * 100, 1)
            if median > 0 else 0
        )
        sample_lots.append({
            "lot_id": r.lot_id,
            "name_ru": r.lot_data.get("name_ru", ""),
            "budget": budget,
            "deviation_pct": deviation_pct,
            "risk_score": round(r.final_score, 1),
            "risk_level": r.final_level,
        })
    
    return {
        "category_code": category_code,
        "category_name": category_name,
        "stats": {
            "count": price_stats["count"],
            "median": price_stats["median"],
            "min": price_stats["min"],
            "max": price_stats["max"],
            "avg": price_stats["mean"],
            "std_dev": price_stats["std_dev"],
            "percentile_25": price_stats["percentile_25"],
            "percentile_75": price_stats["percentile_75"],
        },
        "sample_lots": sample_lots,
    }


# === CUSTOMERS & CATEGORIES ===

@app.get("/api/customers")
async def list_customers(
    page: int = Query(0, ge=0),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    sort_by: str = Query("lot_count"),
    sort_desc: bool = Query(True),
):
    """Get list of customers with their statistics."""
    if not analyzer:
        raise HTTPException(503, "Analyzer not ready")
    
    results = analyzer.get_cached_results()
    
    # Aggregate by customer
    customers_data = {}
    for r in results:
        customer_bin = r.lot_data.get("customer_bin", "")
        customer_name = r.lot_data.get("customer_name", "")
        
        if not customer_bin:
            continue
            
        if customer_bin not in customers_data:
            customers_data[customer_bin] = {
                "customer_bin": customer_bin,
                "customer_name": customer_name,
                "lot_count": 0,
                "total_budget": 0,
                "avg_risk_score": 0,
                "risk_distribution": {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0},
                "categories": set(),
                "risk_scores": [],
            }
        
        cust = customers_data[customer_bin]
        cust["lot_count"] += 1
        cust["total_budget"] += r.lot_data.get("budget", 0)
        cust["risk_scores"].append(r.final_score)
        cust["risk_distribution"][r.final_level] = cust["risk_distribution"].get(r.final_level, 0) + 1
        cust["categories"].add(r.lot_data.get("category_code", ""))
    
    # Calculate averages and prepare data
    customers_list = []
    for bin_val, data in customers_data.items():
        avg_score = sum(data["risk_scores"]) / len(data["risk_scores"]) if data["risk_scores"] else 0
        customers_list.append({
            "customer_bin": data["customer_bin"],
            "customer_name": data["customer_name"],
            "lot_count": data["lot_count"],
            "total_budget": data["total_budget"],
            "avg_risk_score": round(avg_score, 1),
            "category_count": len(data["categories"]),
            "risk_distribution": data["risk_distribution"],
            "high_critical_count": data["risk_distribution"]["HIGH"] + data["risk_distribution"]["CRITICAL"],
        })
    
    # Filter by search
    if search:
        search_lower = search.lower()
        customers_list = [
            c for c in customers_list
            if search_lower in c["customer_name"].lower() or search_lower in c["customer_bin"].lower()
        ]
    
    # Sort
    if sort_by == "lot_count":
        customers_list.sort(key=lambda c: c["lot_count"], reverse=sort_desc)
    elif sort_by == "total_budget":
        customers_list.sort(key=lambda c: c["total_budget"], reverse=sort_desc)
    elif sort_by == "avg_risk_score":
        customers_list.sort(key=lambda c: c["avg_risk_score"], reverse=sort_desc)
    
    total = len(customers_list)
    start = page * size
    page_results = customers_list[start:start + size]
    
    return {
        "total": total,
        "page": page,
        "size": size,
        "items": page_results,
    }


@app.get("/api/customers/{customer_bin}")
async def get_customer(customer_bin: str):
    """Get detailed information about a specific customer."""
    if not analyzer:
        raise HTTPException(503, "Analyzer not ready")
    
    results = analyzer.get_cached_results()
    customer_lots = [r for r in results if r.lot_data.get("customer_bin") == customer_bin]
    
    if not customer_lots:
        raise HTTPException(404, f"Customer {customer_bin} not found")
    
    customer_name = customer_lots[0].lot_data.get("customer_name", "")
    
    # Aggregate statistics
    categories = {}
    risk_scores = []
    for r in customer_lots:
        cat_code = r.lot_data.get("category_code", "")
        risk_scores.append(r.final_score)
        if cat_code not in categories:
            categories[cat_code] = {
                "category_name": r.lot_data.get("category_name", ""),
                "lot_count": 0,
                "budget": 0,
                "risk_scores": [],
            }
        categories[cat_code]["lot_count"] += 1
        categories[cat_code]["budget"] += r.lot_data.get("budget", 0)
        categories[cat_code]["risk_scores"].append(r.final_score)
    
    total_budget = sum(r.lot_data.get("budget", 0) for r in customer_lots)
    avg_risk = sum(risk_scores) / len(risk_scores) if risk_scores else 0
    
    # Recent lots
    recent_lots = sorted(customer_lots, key=lambda r: r.lot_data.get("publish_date", ""), reverse=True)[:10]
    
    return {
        "customer_bin": customer_bin,
        "customer_name": customer_name,
        "total_lots": len(customer_lots),
        "total_budget": total_budget,
        "avg_risk_score": round(avg_risk, 1),
        "categories": [
            {
                "category_code": code,
                "category_name": data["category_name"],
                "lot_count": data["lot_count"],
                "budget": data["budget"],
                "avg_risk_score": round(sum(data["risk_scores"]) / len(data["risk_scores"]), 1) if data["risk_scores"] else 0,
            }
            for code, data in categories.items()
        ],
        "recent_lots": [
            {
                "lot_id": r.lot_id,
                "name_ru": r.lot_data.get("name_ru", ""),
                "category_code": r.lot_data.get("category_code", ""),
                "category_name": r.lot_data.get("category_name", ""),
                "budget": r.lot_data.get("budget", 0),
                "risk_score": round(r.final_score, 1),
                "risk_level": r.final_level,
                "publish_date": r.lot_data.get("publish_date", ""),
            }
            for r in recent_lots
        ],
    }


@app.get("/api/categories-list")
async def list_categories(
    page: int = Query(0, ge=0),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    sort_by: str = Query("lot_count"),
    sort_desc: bool = Query(True),
):
    """Get list of all categories with statistics."""
    if not analyzer:
        raise HTTPException(503, "Analyzer not ready")
    
    results = analyzer.get_cached_results()
    
    # Aggregate by category
    categories_data = {}
    for r in results:
        cat_code = r.lot_data.get("category_code", "")
        cat_name = r.lot_data.get("category_name", "")
        
        if not cat_code:
            continue
        
        if cat_code not in categories_data:
            categories_data[cat_code] = {
                "category_code": cat_code,
                "category_name": cat_name,
                "lot_count": 0,
                "total_budget": 0,
                "avg_risk_score": 0,
                "risk_distribution": {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0},
                "risk_scores": [],
            }
        
        cat = categories_data[cat_code]
        cat["lot_count"] += 1
        cat["total_budget"] += r.lot_data.get("budget", 0)
        cat["risk_scores"].append(r.final_score)
        cat["risk_distribution"][r.final_level] = cat["risk_distribution"].get(r.final_level, 0) + 1
    
    # Calculate averages
    categories_list = []
    for code, data in categories_data.items():
        avg_score = sum(data["risk_scores"]) / len(data["risk_scores"]) if data["risk_scores"] else 0
        categories_list.append({
            "category_code": data["category_code"],
            "category_name": data["category_name"],
            "lot_count": data["lot_count"],
            "total_budget": data["total_budget"],
            "avg_risk_score": round(avg_score, 1),
            "risk_distribution": data["risk_distribution"],
            "high_critical_count": data["risk_distribution"]["HIGH"] + data["risk_distribution"]["CRITICAL"],
        })
    
    # Filter by search
    if search:
        search_lower = search.lower()
        categories_list = [
            c for c in categories_list
            if search_lower in c["category_name"].lower() or search_lower in c["category_code"].lower()
        ]
    
    # Sort
    if sort_by == "lot_count":
        categories_list.sort(key=lambda c: c["lot_count"], reverse=sort_desc)
    elif sort_by == "total_budget":
        categories_list.sort(key=lambda c: c["total_budget"], reverse=sort_desc)
    elif sort_by == "avg_risk_score":
        categories_list.sort(key=lambda c: c["avg_risk_score"], reverse=sort_desc)
    
    total = len(categories_list)
    start = page * size
    page_results = categories_list[start:start + size]
    
    return {
        "total": total,
        "page": page,
        "size": size,
        "items": page_results,
    }


@app.get("/api/categories/{category_code}")
async def get_category_detail(category_code: str):
    """Get detailed information about a specific category."""
    if not analyzer:
        raise HTTPException(503, "Analyzer not ready")
    
    results = analyzer.get_cached_results()
    category_lots = [r for r in results if r.lot_data.get("category_code") == category_code]
    
    if not category_lots:
        raise HTTPException(404, f"Category {category_code} not found")
    
    category_name = category_lots[0].lot_data.get("category_name", "")
    
    # Get price statistics
    price_stats = analyzer.feature_engineer.get_category_price_stats(category_code)
    if not price_stats:
        price_stats = {"count": 0, "median": 0, "min": 0, "max": 0, "mean": 0, "std_dev": 0}
    
    # Risk distribution
    risk_dist = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    risk_scores = []
    customers = {}
    for r in category_lots:
        risk_dist[r.final_level] = risk_dist.get(r.final_level, 0) + 1
        risk_scores.append(r.final_score)
        cust_bin = r.lot_data.get("customer_bin", "")
        if cust_bin:
            if cust_bin not in customers:
                customers[cust_bin] = {"count": 0, "name": r.lot_data.get("customer_name", "")}
            customers[cust_bin]["count"] += 1
    
    avg_risk = sum(risk_scores) / len(risk_scores) if risk_scores else 0
    
    # Top customers in this category
    top_customers = sorted(
        [{"customer_bin": bin_val, "customer_name": data["name"], "lot_count": data["count"]} 
         for bin_val, data in customers.items()],
        key=lambda x: x["lot_count"],
        reverse=True
    )[:5]
    
    # Sample high-risk lots
    high_risk_lots = sorted(
        [r for r in category_lots if r.final_level in ["HIGH", "CRITICAL"]],
        key=lambda r: r.final_score,
        reverse=True
    )[:5]
    
    return {
        "category_code": category_code,
        "category_name": category_name,
        "total_lots": len(category_lots),
        "total_budget": sum(r.lot_data.get("budget", 0) for r in category_lots),
        "avg_risk_score": round(avg_risk, 1),
        "risk_distribution": risk_dist,
        "price_stats": {
            "count": price_stats["count"],
            "median": price_stats["median"],
            "min": price_stats["min"],
            "max": price_stats["max"],
            "avg": price_stats["mean"],
            "std_dev": price_stats["std_dev"],
        },
        "top_customers": top_customers,
        "sample_high_risk_lots": [
            {
                "lot_id": r.lot_id,
                "name_ru": r.lot_data.get("name_ru", ""),
                "budget": r.lot_data.get("budget", 0),
                "risk_score": round(r.final_score, 1),
                "risk_level": r.final_level,
            }
            for r in high_risk_lots
        ],
    }

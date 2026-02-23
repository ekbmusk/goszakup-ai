# GraphQL Pagination, Filtering, Error Handling & Rate Limiting - Complete Guide

## Overview

This implementation adds production-ready GraphQL support to the Goszakup AI system with:

1. **GraphQL Pagination** - Cursor-based pagination with automatic page aggregation
2. **Advanced Filtering** - Filter by budget, date, customer, status, etc.
3. **Error Handling** - Comprehensive error classification and retry logic
4. **Rate Limiting** - Per-IP and per-endpoint rate limiting with sliding windows
5. **Logging** - Detailed logging at every step for debugging and monitoring

---

## Architecture Overview

### 1. GraphQL Handler (`src/ingestion/goszakup_graphql.py`)

The `GoszakupGraphQL` class provides:

#### Features:
- **Cursor-based pagination** - Navigate large datasets efficiently
- **Offset-based pagination** - Alternative pagination method
- **Automatic retry** - Exponential backoff for transient failures
- **Rate limit tracking** - Monitor and respect API rate limits
- **Error classification** - Distinguish between different error types

#### Error Types:
```
ErrorType.RATE_LIMIT        → 429 errors; includes retry_after
ErrorType.AUTH_ERROR        → 401; authentication failed
ErrorType.NOT_FOUND         → 404; resource doesn't exist
ErrorType.VALIDATION_ERROR  → 400; invalid request
ErrorType.SERVER_ERROR      → 500+; temporary server issues
ErrorType.NETWORK_ERROR     → Connection/timeout issues
ErrorType.TIMEOUT           → Request timeout
ErrorType.UNKNOWN           → Unknown error
```

#### Core Methods:

```python
# Pagination
result = client.get_lots(
    first=20,                              # Page size (1-100)
    after="cursor_from_previous_page",     # Cursor for next page
    filters={"budget_min": 1000000},       # Filters (optional)
    fetch_all=True                         # Auto-fetch all pages
)

# Access page info
page_info = result.get("pageInfo", {})
print(f"Has next: {page_info['hasNextPage']}")
print(f"Cursor: {page_info['endCursor']}")
print(f"Total: {page_info['totalCount']}")

# Access data
edges = result.get("edges", [])
for edge in edges:
    lot = edge.get("node", {})
    print(f"Lot: {lot['nameRu']} - {lot['amount']} ₸")
```

#### Filtering:

```python
# Filter examples
filters = {
    # For lots
    "budget_min": 1000000,
    "budget_max": 10000000,
    "customer_bin": "123456789012",
    "status": "active",
    "publish_date_from": "2024-01-01T00:00:00Z",
    "publish_date_to": "2024-12-31T23:59:59Z",
    
    # For contracts
    "lot_id": "LOT123",
    "supplier_bin": "987654321098",
    "date_from": "2024-01-01",
    "date_to": "2024-12-31",
    
    # For subjects (organizations)
    "bin": "123456789012",
}

result = client.get_lots(first=20, filters=filters)
```

#### Error Handling Example:

```python
from src.ingestion.goszakup_graphql import GoszakupGraphQL, APIError, ErrorType

client = GoszakupGraphQL(url="http://api.goszakup.gov.kz/graphql", token="your_token")

try:
    result = client.get_lots(first=50)
except APIError as e:
    if e.error_type == ErrorType.RATE_LIMIT:
        print(f"Rate limited. Retry after {e.retry_after}s")
    elif e.error_type == ErrorType.AUTH_ERROR:
        print(f"Authentication failed: {e.message}")
    elif e.error_type == ErrorType.SERVER_ERROR and e.is_retryable:
        print(f"Server error (will retry): {e.message}")
    else:
        print(f"Error: {e}")
```

#### Rate Limit Info:

```python
stats = client.get_stats()
print(f"Requests made: {stats['requests_made']}")
print(f"Rate limit: {stats['requests_per_minute']} req/min")
print(f"Remaining: {stats['requests_per_minute'] - (stats['requests_made'] % 60)}")
```

---

### 2. Rate Limiting Middleware (`src/api/middleware.py`)

#### RateLimiter Class:

Implements in-memory per-IP rate limiting with sliding window algorithm:

```python
from src.api.middleware import RateLimiter

limiter = RateLimiter(
    max_requests=100,           # 100 requests
    window_seconds=60,          # per minute
    endpoint_limits={
        "/api/lots": (50, 60),  # 50 req/min for /api/lots
        "/api/analyze": (20, 60),  # 20 req/min for /api/analyze
    }
)

# Check limit for a client
limit_info = limiter.check_limit("192.168.1.1", "/api/lots")
if limit_info["allowed"]:
    print(f"OK, {limit_info['remaining']} requests remaining")
else:
    print(f"Rate limited, retry after {limit_info['retry_after']}s")
```

#### RateLimitMiddleware Integration:

Already integrated in `src/api/routes.py`:

```python
# Configured limits:
endpoint_limits = {
    "/api/lots": (50, 60),           # 50 req/min
    "/api/analyze": (20, 60),        # 20 req/min
    "/api/network": (30, 60),        # 30 req/min
}

app.add_middleware(
    RateLimitMiddleware,
    max_requests=100,
    window_seconds=60,
    endpoint_limits=endpoint_limits,
    whitelist_paths=["/api/health", "/docs"],
)
```

#### Response Headers:

The middleware adds standard rate limit headers to all responses:

```
X-RateLimit-Limit: 100              # Max requests per window
X-RateLimit-Remaining: 47           # Requests remaining in window
X-RateLimit-Reset: 1708450821       # Unix timestamp when limit resets
Retry-After: 30                      # (Only if 429) Seconds to wait
```

#### Example Response (Rate Limited):

```json
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1708450821
Retry-After: 30

{
  "error": "Too Many Requests",
  "limit": 100,
  "retry_after": 30,
  "reset_timestamp": 1708450821
}
```

---

### 3. Enhanced Error Handling in Routes

Updated endpoints with comprehensive error handling:

#### Before:
```python
@app.get("/api/lots")
async def list_lots(page: int = 0, size: int = 20):
    if not analyzer:
        raise HTTPException(503, "Analyzer not ready")
    # ... minimal error handling
    return results
```

#### After:
```python
@app.get("/api/lots")
async def list_lots(page: int = 0, size: int = 20):
    try:
        if not analyzer:
            raise HTTPException(503, detail="Analyzer not ready")
        
        # Input validation
        if size < 1 or size > 100:
            raise HTTPException(400, detail="Size must be 1-100")
        
        # Processing with logging
        logger.debug(f"Fetching page {page}, size {size}")
        results = analyzer.analyze_all()
        
        # Error handling with context
        if not results:
            raise HTTPException(404, detail="No results found")
        
        # Success logging
        logger.info(f"Returned {len(results)} items")
        return {"items": results, "page": page, "total": len(results)}
    
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        logger.exception(f"Unexpected error: {e}")
        raise HTTPException(500, detail="Internal server error")
```

#### Error Response Format:

```json
{
  "error": {
    "type": "validation_error",
    "message": "Invalid risk_level",
    "status_code": 400,
    "timestamp": 1708446000.123,
    "details": {
      "is_retryable": false,
      "valid_options": ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    }
  }
}
```

---

### 4. Logging Strategy

Comprehensive logging at multiple levels:

#### DEBUG:
```python
logger.debug(f"[GraphQL] Attempt 1/3: Variables: {variables}")
logger.debug(f"[API] Fetching lots: page=0, size=20")
```

#### INFO:
```python
logger.info(f"[GraphQL] Fetched 20 lots (total available: 1000, has_next_page: true)")
logger.info(f"[API] Returning 20 of 1000 lots")
logger.info(f"[RateLimit] Minute limit active, waiting 45s")
```

#### WARNING:
```python
logger.warning(f"[GraphQL] Timeout on attempt 1: request took >30s")
logger.warning(f"[RateLimit] IP 192.168.1.1 exceeded limit on /api/lots")
logger.warning(f"[GoszakupClient] No token provided. Using mock data.")
```

#### ERROR:
```python
logger.error(f"[GraphQL] (429) Rate limit exceeded")
logger.error(f"[GraphQL] Query errors: [{'message': 'Invalid query syntax'}]")
logger.exception(f"[API] Unexpected error in list_lots: ValueError")
```

#### Log Output Example:

```
2026-02-19 14:30:15.123 [INFO] graphql - [GraphQL] Fetching lots (page size: 20, after: None)
2026-02-19 14:30:15.234 [DEBUG] graphql - [GraphQL] Attempt 1/3: Variables: {"first": 20, "after": null}
2026-02-19 14:30:15.456 [INFO] graphql - [GraphQL] Success on attempt 1
2026-02-19 14:30:15.457 [INFO] graphql - [GraphQL] Fetched 20 lots (total available: 5000, has_next_page: true)
2026-02-19 14:30:16.123 [INFO] routes - [API] Returning 20 of 5000 lots
2026-02-19 14:30:16.124 [INFO] routes - [RateLimit] Remaining: 79 requests this minute
```

---

## Usage Examples

### Example 1: Fetch All Lots with Pagination

```python
from src.ingestion.goszakup_graphql import GoszakupGraphQL

with GoszakupGraphQL(
    url="http://api.goszakup.gov.kz/graphql",
    token="your_token"
) as client:
    # Option 1: Auto-fetch all pages
    result = client.get_lots(first=50, fetch_all=True)
    all_lots = [edge["node"] for edge in result["edges"]]
    print(f"Total lots fetched: {len(all_lots)}")
    
    # Option 2: Manual pagination
    all_lots = []
    cursor = None
    while True:
        result = client.get_lots(first=50, after=cursor)
        all_lots.extend([e["node"] for e in result["edges"]])
        
        if not result["pageInfo"]["hasNextPage"]:
            break
        cursor = result["pageInfo"]["endCursor"]
```

### Example 2: Find High-Budget Tenders from Specific Customer

```python
with GoszakupGraphQL(
    url="http://api.goszakup.gov.kz/graphql",
    token="your_token"
) as client:
    filters = {
        "budget_min": 50000000,  # 50M ₸+
        "customer_bin": "123456789012",
        "status": "active",
    }
    
    result = client.get_lots(first=100, filters=filters)
    
    for edge in result["edges"]:
        lot = edge["node"]
        print(f"{lot['nameRu']} - {lot['amount']:,.0f} ₸")
```

### Example 3: Handle Rate Limiting Gracefully

```python
import time
from src.ingestion.goszakup_graphql import GoszakupGraphQL, APIError, ErrorType

def fetch_with_retry(client, **kwargs):
    """Fetch with automatic retry on rate limit."""
    max_attempts = 5
    for attempt in range(max_attempts):
        try:
            return client.get_lots(**kwargs)
        except APIError as e:
            if e.error_type == ErrorType.RATE_LIMIT:
                wait_time = e.retry_after or (2 ** attempt)
                print(f"Rate limited, waiting {wait_time}s...")
                time.sleep(wait_time)
            else:
                raise

with GoszakupGraphQL(...) as client:
    result = fetch_with_retry(client, first=50, fetch_all=True)
```

### Example 4: REST API with Rate Limiting

```bash
# Test endpoint with rate limit headers
curl -v http://127.0.0.1:8006/api/lots?page=0&size=20

# Response headers:
# X-RateLimit-Limit: 50
# X-RateLimit-Remaining: 49
# X-RateLimit-Reset: 1708450821

# When rate limited (HTTP 429):
curl http://127.0.0.1:8006/api/lots?page=0&size=20
# Response:
# {
#   "error": "Too Many Requests",
#   "limit": 50,
#   "retry_after": 30,
#   "reset_timestamp": 1708450821
# }
```

---

## Testing

Run the demo script:

```bash
cd /Users/beka/Projects/claude/goszakup-ai

# Activate virtual environment
source .venv311/bin/activate

# Start API server (in another terminal)
python3 main.py

# Run demo
python3 demo_graphql.py
```

The demo runs 6 tests:
1. **Basic Pagination** - Cursor-based fetch with next page
2. **Filtering** - Budget, date, customer, status filters
3. **Error Handling** - Invalid filters, clamping, error responses
4. **Batch Fetching** - Auto-fetch all pages
5. **Contracts & Subjects** - Query other entity types
6. **Statistics** - Performance metrics and rate limit tracking

---

## Files Created/Modified

### New Files:
1. **`src/ingestion/goszakup_graphql.py`** (550+ lines)
   - `GoszakupGraphQL` class with pagination, filtering, error handling
   - `RateLimitInfo`, `GraphQLPaginator`, `APIError`, `ErrorType`
   - Comprehensive logging throughout

2. **`src/api/middleware.py`** (400+ lines)
   - `RateLimiter` - Per-IP sliding window rate limiting
   - `RateLimitMiddleware` - FastAPI middleware integration
   - `UnifiedErrorHandler` - Centralized error formatting

3. **`demo_graphql.py`** (400+ lines)
   - 6 comprehensive demo scenarios
   - Logging to both console and file
   - Examples of all major features

### Modified Files:
1. **`src/api/routes.py`**
   - Added middleware imports and integration
   - Enhanced error handling in all endpoints
   - Better logging and validation
   - Updated input validation

---

## Configuration

### Rate Limiting Defaults:

```python
# Global limit: 100 req/min per IP
max_requests = 100
window_seconds = 60

# Specific endpoint limits:
endpoint_limits = {
    "/api/lots": (50, 60),        # Stricter limit for data-heavy endpoint
    "/api/analyze": (20, 60),     # Lower limit for compute-heavy endpoint
    "/api/network": (30, 60),     # Medium limit for graph operations
}

# Whitelisted paths (no rate limiting):
whitelist_paths = [
    "/api/health",
    "/docs",
    "/openapi.json",
    "/redoc",
]
```

### Customize Limits:

```python
# In src/api/routes.py, modify:
endpoint_limits = {
    "/api/lots": (100, 60),       # Increase to 100 req/min
    "/api/analyze": (50, 60),     # Increase to 50 req/min
}

# Or in middleware configuration
app.add_middleware(
    RateLimitMiddleware,
    max_requests=200,             # 200 req/min global
    window_seconds=30,            # 30-second window
    endpoint_limits=endpoint_limits,
)
```

---

## Monitoring & Debugging

### Check Rate Limit Status:

```python
client = GoszakupGraphQL(...)
stats = client.get_stats()

print(f"Total requests: {stats['requests_made']}")
print(f"Rate limit: {stats['requests_per_minute']} req/min")
print(f"Has next page: {stats['has_next_page']}")
print(f"Current cursor: {stats['current_cursor']}")
```

### Enable Debug Logging:

```python
import logging

# Enable all debug logs
logging.basicConfig(level=logging.DEBUG)

# Or specific module
logging.getLogger("src.ingestion.goszakup_graphql").setLevel(logging.DEBUG)
```

### Monitor Logs:

```bash
# Real-time log monitoring
tail -f graphql_demo.log

# Count errors
grep ERROR graphql_demo.log | wc -l

# Find rate limit issues
grep "rate_limit" graphql_demo.log

# Performance analysis
grep "✓" graphql_demo.log | tail -20
```

---

## Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| Max page size | 100 | Clamped automatically |
| Rate limit | 100 req/min/IP | Configurable per endpoint |
| Retry attempts | 3 (default) | Exponential backoff |
| Request timeout | 30s | Configurable per client |
| Pagination mode | Cursor-based | Efficient for large datasets |
| Error classification | 8 types | Detailed error handling |
| Auto-fetch all | Yes | Aggregates multiple pages |

---

## Next Steps

1. **Real API Integration**: Provide `GOSZAKUP_TOKEN` to test against actual API
2. **Database Persistence**: Store fetched lots in Postgres + pgvector
3. **Advanced Filtering**: Add more complex filter combinations
4. **Caching**: Implement Redis caching for frequently accessed queries
5. **Monitoring**: Add Prometheus metrics for production monitoring
6. **API Client Library**: Publish as pip package for reusability

---

## References

- [Goszakup API Documentation](https://tenders.kz/en/help)
- [GraphQL Cursor Connections](https://relay.dev/graphql-cursor-connections/)  
- [HTTP Rate Limiting Standards](https://tools.ietf.org/html/draft-polli-ratelimit-headers)
- [FastAPI Middleware Documentation](https://fastapi.tiangolo.com/tutorial/middleware/)


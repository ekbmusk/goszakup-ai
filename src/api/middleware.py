"""Middleware для лимитов запросов FastAPI."""
import time
import logging
from collections import defaultdict
from typing import Callable, Optional, Any
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)


class RateLimitExceeded(Exception):
    """Ошибка превышения лимита запросов."""
    def __init__(self, retry_after: int, limit_type: str):
        self.retry_after = retry_after
        self.limit_type = limit_type
        super().__init__(f"Rate limit exceeded ({limit_type})")


class RateLimiter:
    """Лимитер в памяти со скользящим окном."""
    
    def __init__(
        self,
        max_requests: int = 100,
        window_seconds: int = 60,
        endpoint_limits: Optional[dict] = None,
    ):
        """Инициализация лимитера."""
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.endpoint_limits = endpoint_limits or {}
        
        self.requests: dict[str, list[tuple[float, str]]] = defaultdict(list)
        
        logger.info(
            f"[RateLimiter] Initialized with {max_requests} req/{window_seconds}s "
            f"(endpoint limits: {len(self.endpoint_limits)})"
        )
    
    def _cleanup_old_requests(self, ip: str, now: float):
        """Удаляет запросы вне текущего окна."""
        cutoff = now - self.window_seconds
        self.requests[ip] = [
            (ts, endpoint) for ts, endpoint in self.requests[ip]
            if ts > cutoff
        ]
    
    def _get_endpoint_limit(self, endpoint: str) -> tuple[int, int]:
        """Возвращает лимит для эндпоинта или значение по умолчанию."""
        if endpoint in self.endpoint_limits:
            return self.endpoint_limits[endpoint]
        return self.max_requests, self.window_seconds
    
    def check_limit(self, ip: str, endpoint: str = "global") -> dict:
        """Проверяет, разрешен ли запрос."""
        now = time.time()
        self._cleanup_old_requests(ip, now)
        
        max_requests, window = self._get_endpoint_limit(endpoint)
        current_count = len(self.requests[ip])
        remaining = max(0, max_requests - current_count)
        reset_timestamp = now + window
        
        if current_count >= max_requests:
            oldest_request_time = min(ts for ts, _ in self.requests[ip])
            retry_after = int(oldest_request_time + window - now) + 1
            
            logger.warning(
                f"[RateLimit] IP {ip} exceeded limit on {endpoint} "
                f"({current_count}/{max_requests}, retry_after: {retry_after}s)"
            )
            
            return {
                "allowed": False,
                "limit": max_requests,
                "remaining": 0,
                "reset_timestamp": reset_timestamp,
                "retry_after": retry_after,
                "limit_type": f"{endpoint}_limit",
            }
        
        self.requests[ip].append((now, endpoint))
        
        return {
            "allowed": True,
            "limit": max_requests,
            "remaining": remaining - 1,
            "reset_timestamp": reset_timestamp,
            "retry_after": None,
        }


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware для ограничения частоты запросов."""
    
    def __init__(
        self,
        app,
        max_requests: int = 100,
        window_seconds: int = 60,
        endpoint_limits: Optional[dict] = None,
        whitelist_paths: Optional[list] = None,
    ):
        super().__init__(app)
        self.limiter = RateLimiter(max_requests, window_seconds, endpoint_limits)
        self.whitelist_paths = whitelist_paths or ["/api/health", "/docs", "/openapi.json"]
        
        logger.info(
            f"[RateLimitMiddleware] Initialized (whitelist: {self.whitelist_paths})"
        )
    
    def _get_client_ip(self, request: Request) -> str:
        """Определяет IP клиента по заголовкам или сокету."""
        if "x-forwarded-for" in request.headers:
            return request.headers["x-forwarded-for"].split(",")[0].strip()

        if "x-real-ip" in request.headers:
            return request.headers["x-real-ip"]

        return request.client.host if request.client else "unknown"
    
    def _is_whitelisted(self, path: str) -> bool:
        """Проверяет, находится ли путь в белом списке."""
        return any(path.startswith(prefix) for prefix in self.whitelist_paths)
    
    async def dispatch(self, request: Request, call_next: Callable) -> Any:
        """Пропускает запрос через лимитер."""
        path = request.url.path

        if self._is_whitelisted(path):
            response = await call_next(request)
            return response

        client_ip = self._get_client_ip(request)
        endpoint = request.url.path

        limit_info = self.limiter.check_limit(client_ip, endpoint)

        if not limit_info["allowed"]:
            return JSONResponse(
                {
                    "error": "Too Many Requests",
                    "limit": limit_info["limit"],
                    "retry_after": limit_info["retry_after"],
                    "reset_timestamp": limit_info["reset_timestamp"],
                },
                status_code=429,
                headers={
                    "X-RateLimit-Limit": str(limit_info["limit"]),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(limit_info["reset_timestamp"])),
                    "Retry-After": str(limit_info["retry_after"]),
                },
            )
        
        response = await call_next(request)

        response.headers["X-RateLimit-Limit"] = str(limit_info["limit"])
        response.headers["X-RateLimit-Remaining"] = str(limit_info["remaining"])
        response.headers["X-RateLimit-Reset"] = str(int(limit_info["reset_timestamp"]))
        
        return response


class UnifiedErrorHandler:
    """Единый формат ошибок API."""
    
    @staticmethod
    def format_error(
        error_type: str,
        message: str,
        status_code: int = 500,
        details: Optional[dict] = None,
        retry_after: Optional[int] = None,
    ) -> dict:
        """Формирует тело ответа об ошибке."""
        error_response = {
            "error": {
                "type": error_type,
                "message": message,
                "status_code": status_code,
                "timestamp": time.time(),
            }
        }
        
        if details:
            error_response["error"]["details"] = details
        
        if retry_after:
            error_response["error"]["retry_after"] = retry_after
        
        return error_response
    
    @staticmethod
    def log_error(
        error_type: str,
        message: str,
        status_code: int,
        request_path: str = "",
        client_ip: str = "",
    ):
        """Логирует ошибку с контекстом."""
        logger.error(
            f"[API Error] {error_type} ({status_code}): {message} "
            f"[path: {request_path}, ip: {client_ip}]"
        )
    
    @staticmethod
    def handle_api_exception(exc: Exception, request: Request = None) -> JSONResponse:
        """Преобразует исключение в ответ API."""
        from src.ingestion.goszakup_graphql import APIError, ErrorType
        
        client_ip = "unknown"
        if request:
            client_ip = (
                request.headers.get("x-forwarded-for", "").split(",")[0]
                or request.client.host
            )
        
        if isinstance(exc, APIError):
            status_code = exc.status_code or 500
            details = {
                "is_retryable": exc.is_retryable,
            }
            if exc.details:
                details.update(exc.details)
            
            UnifiedErrorHandler.log_error(
                exc.error_type.value,
                exc.message,
                status_code,
                request.url.path if request else "",
                client_ip,
            )
            
            return JSONResponse(
                UnifiedErrorHandler.format_error(
                    exc.error_type.value,
                    exc.message,
                    status_code,
                    details,
                    exc.retry_after,
                ),
                status_code=status_code,
                headers={"Retry-After": str(exc.retry_after)} if exc.retry_after else {},
            )
        else:
            UnifiedErrorHandler.log_error(
                "internal_error",
                str(exc),
                500,
                request.url.path if request else "",
                client_ip,
            )
            
            return JSONResponse(
                UnifiedErrorHandler.format_error(
                    "internal_error",
                    "An internal error occurred",
                    500,
                    {"original_error": str(exc)},
                ),
                status_code=500,
            )

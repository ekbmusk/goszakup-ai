"""GraphQL-клиент для goszakup.

Возможности: пагинация, фильтры, обработка ошибок, логирование, лимиты.
"""
import logging
import time
import json
from typing import Any, Optional
from dataclasses import dataclass
from enum import Enum

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False

logger = logging.getLogger(__name__)


class ErrorType(Enum):
    """Классификация ошибок API."""
    RATE_LIMIT = "rate_limit"
    AUTH_ERROR = "auth_error"
    NOT_FOUND = "not_found"
    VALIDATION_ERROR = "validation_error"
    SERVER_ERROR = "server_error"
    NETWORK_ERROR = "network_error"
    TIMEOUT = "timeout"
    UNKNOWN = "unknown"


@dataclass
class RateLimitInfo:
    """Состояние лимитов запросов."""
    requests_made: int = 0
    requests_per_minute: int = 60
    requests_per_hour: int = 5000
    last_request_time: float = 0
    last_minute_count: int = 0
    last_minute_start: float = 0
    retry_after: Optional[int] = None


@dataclass
class APIError:
    """Структурированная ошибка API."""
    error_type: ErrorType
    status_code: Optional[int] = None
    message: str = ""
    details: Optional[dict] = None
    retry_after: Optional[int] = None
    is_retryable: bool = False
    
    def __str__(self):
        return f"[{self.error_type.value}] ({self.status_code}) {self.message}"


class GraphQLPaginator:
    """Пагинатор на курсорах для GraphQL."""
    
    def __init__(self, page_size: int = 20):
        self.page_size = max(1, min(page_size, 100))
        self.current_cursor: Optional[str] = None
        self.has_next_page = False
        
    def reset(self):
        """Сбрасывает состояние пагинации."""
        self.current_cursor = None
        self.has_next_page = False
        
    def set_cursor(self, cursor: Optional[str]):
        """Запоминает курсор следующей страницы."""
        self.current_cursor = cursor
        
    def set_has_next(self, has_next: bool):
        """Указывает наличие следующей страницы."""
        self.has_next_page = has_next


class GoszakupGraphQL:
    """GraphQL-клиент goszakup с пагинацией и обработкой ошибок."""
    
    QUERY_LOTS_PAGINATED = """
    query GetLots($first: Int!, $after: String, $filter: LotFilterInput) {
        Lots(first: $first, after: $after, filter: $filter) {
            pageInfo {
                endCursor
                hasNextPage
                totalCount
            }
            edges {
                node {
                    id
                    nameRu
                    descriptionRu
                    amount
                    count
                    customerBin
                    status
                    publishDate
                    TrdBuy {
                        id
                        publishDate
                        endDate
                        refTradeMethodsId
                    }
                    TrdApp {
                        count
                        ids
                    }
                    PlnPoint {
                        pointNorm
                        pointDate
                    }
                }
            }
        }
    }
    """
    
    QUERY_CONTRACTS_PAGINATED = """
    query GetContracts($first: Int!, $after: String, $filter: ContractFilterInput) {
        Contracts(first: $first, after: $after, filter: $filter) {
            pageInfo {
                endCursor
                hasNextPage
                totalCount
            }
            edges {
                node {
                    id
                    contractNumber
                    contractDate
                    contractSum
                    lotId
                    supplierId
                }
            }
        }
    }
    """
    
    QUERY_SUBJECTS = """
    query GetSubjects($first: Int!, $after: String, $filter: SubjectFilterInput) {
        Subjects(first: $first, after: $after, filter: $filter) {
            pageInfo {
                endCursor
                hasNextPage
                totalCount
            }
            edges {
                node {
                    id
                    nameRu
                    bin
                    iin
                    registrationDate
                    status
                }
            }
        }
    }
    """
    
    def __init__(self, url: str, token: Optional[str] = None, timeout: float = 30.0):
        """Инициализирует GraphQL-клиент."""
        self.url = url
        self.token = token
        self.timeout = timeout
        self.rate_limit = RateLimitInfo()
        self.paginator = GraphQLPaginator()
        
        if HAS_HTTPX:
            headers = {"Content-Type": "application/json"}
            if token:
                headers["Authorization"] = f"Bearer {token}"
            self.client = httpx.Client(
                headers=headers,
                timeout=timeout,
            )
        else:
            self.client = None
            logger.warning("[GraphQL] httpx not installed; queries will fail")
    
    def _classify_error(self, status_code: int, response_data: dict) -> APIError:
        """Классифицирует ошибку по коду ответа и телу."""
        if status_code == 429:
            retry_after = int(response_data.get("retry-after", 60))
            return APIError(
                error_type=ErrorType.RATE_LIMIT,
                status_code=status_code,
                message="Rate limit exceeded",
                retry_after=retry_after,
                is_retryable=True,
            )
        elif status_code == 401:
            return APIError(
                error_type=ErrorType.AUTH_ERROR,
                status_code=status_code,
                message="Authentication failed (invalid token)",
                is_retryable=False,
            )
        elif status_code == 404:
            return APIError(
                error_type=ErrorType.NOT_FOUND,
                status_code=status_code,
                message="Resource not found",
                is_retryable=False,
            )
        elif 400 <= status_code < 500:
            return APIError(
                error_type=ErrorType.VALIDATION_ERROR,
                status_code=status_code,
                message=f"Client error: {response_data.get('message', 'unknown')}",
                is_retryable=False,
            )
        elif status_code >= 500:
            return APIError(
                error_type=ErrorType.SERVER_ERROR,
                status_code=status_code,
                message="Server error (temporary)",
                is_retryable=True,
            )
        else:
            return APIError(
                error_type=ErrorType.UNKNOWN,
                status_code=status_code,
                message="Unknown error",
            )
    
    def _check_rate_limit(self) -> Optional[int]:
        """Проверяет лимиты. Возвращает секунды ожидания или None."""
        now = time.time()
        
        
        if now - self.rate_limit.last_minute_start >= 60:
            self.rate_limit.last_minute_count = 0
            self.rate_limit.last_minute_start = now
        
        if self.rate_limit.last_minute_count >= self.rate_limit.requests_per_minute:
            wait_seconds = max(1, int(60 - (now - self.rate_limit.last_minute_start)))
            logger.warning(
                f"[RateLimit] Minute limit exceeded ({self.rate_limit.requests_per_minute} req/min). "
                f"Waiting {wait_seconds}s"
            )
            return wait_seconds
        
        return None
    
    def _update_rate_limit(self, response_headers: dict | None = None):
        """Update rate limit info from response headers."""
        now = time.time()
        self.rate_limit.requests_made += 1
        self.rate_limit.last_minute_count += 1
        self.rate_limit.last_request_time = now
        
        if response_headers:
            # Разбор стандартных заголовков лимитов
            if "x-ratelimit-limit" in response_headers:
                self.rate_limit.requests_per_minute = int(
                    response_headers.get("x-ratelimit-limit", 60)
                )
            if "x-ratelimit-remaining" in response_headers:
                remaining = int(response_headers.get("x-ratelimit-remaining", 0))
                logger.debug(f"[RateLimit] {remaining} requests remaining this minute")
            if "retry-after" in response_headers:
                self.rate_limit.retry_after = int(response_headers.get("retry-after"))
    
    def _execute_with_retry(
        self,
        query: str,
        variables: dict,
        max_retries: int = 3,
    ) -> dict:
        """Execute GraphQL query with exponential backoff retry logic.
        
        Args:
            query: GraphQL query string
            variables: Query variables dict
            max_retries: Maximum number of retry attempts
            
        Returns:
            Response data dict or raises APIError
        """
        if not self.client:
            raise APIError(
                error_type=ErrorType.NETWORK_ERROR,
                message="HTTP client not available (httpx not installed)"
            )
        
        for attempt in range(max_retries):
            try:
                # Проверка лимита перед запросом
                wait_seconds = self._check_rate_limit()
                if wait_seconds:
                    logger.info(f"[GraphQL] Rate limit active, waiting {wait_seconds}s")
                    time.sleep(wait_seconds)
                
                logger.debug(
                    f"[GraphQL] Attempt {attempt + 1}/{max_retries}: "
                    f"Variables: {json.dumps(variables, default=str)}"
                )
                
                # Выполнение запроса
                response = self.client.post(
                    self.url,
                    json={"query": query, "variables": variables},
                )
                
                # Обновление лимитов по ответу
                self._update_rate_limit(dict(response.headers))
                
                # Проверка HTTP ошибок
                if response.status_code != 200:
                    try:
                        response_data = response.json()
                    except:
                        response_data = {"message": response.text}
                    
                    api_error = self._classify_error(response.status_code, response_data)
                    logger.error(f"[GraphQL] {api_error}")
                    
                    # Повторяемые ошибки
                    if api_error.is_retryable and attempt < max_retries - 1:
                        wait_time = (2 ** attempt) + (attempt > 0)
                        if api_error.retry_after:
                            wait_time = api_error.retry_after
                        logger.info(f"[GraphQL] Retrying in {wait_time}s...")
                        time.sleep(wait_time)
                        continue
                    
                    raise api_error
                
                # Разбор ответа
                data = response.json()
                
                # Проверка ошибок GraphQL
                if "errors" in data and data["errors"]:
                    errors_text = json.dumps(data["errors"], indent=2)
                    logger.error(f"[GraphQL] Query errors:\n{errors_text}")
                    raise APIError(
                        error_type=ErrorType.VALIDATION_ERROR,
                        message="GraphQL returned errors",
                        details={"graphql_errors": data["errors"]},
                    )
                
                logger.debug(f"[GraphQL] Success on attempt {attempt + 1}")
                return data
                
            except (TimeoutError, httpx.TimeoutException) as e:
                logger.warning(f"[GraphQL] Timeout on attempt {attempt + 1}: {e}")
                if attempt < max_retries - 1:
                    wait_time = (2 ** attempt)
                    logger.info(f"[GraphQL] Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                raise APIError(
                    error_type=ErrorType.TIMEOUT,
                    message="Request timeout",
                    is_retryable=True,
                )
            except APIError:
                raise
            except Exception as e:
                logger.error(f"[GraphQL] Unexpected error on attempt {attempt + 1}: {e}")
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    logger.info(f"[GraphQL] Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                raise APIError(
                    error_type=ErrorType.NETWORK_ERROR,
                    message=str(e),
                    is_retryable=True,
                )
    
    def get_lots(
        self,
        first: int = 20,
        after: Optional[str] = None,
        filters: Optional[dict] = None,
        fetch_all: bool = False,
    ) -> dict:
        """Get lots with cursor-based pagination.
        
        Args:
            first: Page size (1-100)
            after: Cursor for next page
            filters: Filter dict (budget_min, budget_max, customer_bin, status, etc.)
            fetch_all: If True, fetch all pages and aggregate
            
        Returns:
            Response dict with pageInfo and edges
        """
        first = max(1, min(first, 100))
        
        filter_input = {}
        if filters:
            # Приведение фильтров к camelCase
            if "budget_min" in filters:
                filter_input["amountMin"] = filters["budget_min"]
            if "budget_max" in filters:
                filter_input["amountMax"] = filters["budget_max"]
            if "customer_bin" in filters:
                filter_input["customerBin"] = filters["customer_bin"]
            if "status" in filters:
                filter_input["status"] = filters["status"]
            if "publish_date_from" in filters:
                filter_input["publishDateFrom"] = filters["publish_date_from"]
            if "publish_date_to" in filters:
                filter_input["publishDateTo"] = filters["publish_date_to"]
        
        variables = {
            "first": first,
            "after": after,
            "filter": filter_input if filter_input else None,
        }
        
        logger.info(f"[GraphQL] Fetching lots (page size: {first}, after: {after})")
        response = self._execute_with_retry(self.QUERY_LOTS_PAGINATED, variables)
        
        data = response.get("data", {})
        lots_data = data.get("Lots", {})
        
        # Обновление состояния пагинации
        page_info = lots_data.get("pageInfo", {})
        self.paginator.set_cursor(page_info.get("endCursor"))
        self.paginator.set_has_next(page_info.get("hasNextPage", False))
        
        total_count = page_info.get("totalCount", 0)
        edges_count = len(lots_data.get("edges", []))
        
        logger.info(
            f"[GraphQL] Fetched {edges_count} lots (total available: {total_count}, "
            f"has_next_page: {page_info.get('hasNextPage')})"
        )
        
        if fetch_all and page_info.get("hasNextPage"):
            logger.info("[GraphQL] Fetching all remaining pages...")
            all_edges = lots_data.get("edges", [])
            cursor = page_info.get("endCursor")
            
            while cursor and page_info.get("hasNextPage"):
                response = self.get_lots(first=first, after=cursor, filters=filters)
                all_edges.extend(response.get("edges", []))
                page_info = response.get("pageInfo", {})
                cursor = page_info.get("endCursor")
            
            logger.info(f"[GraphQL] Aggregated total: {len(all_edges)} lots")
            return {
                "pageInfo": {
                    "totalCount": total_count,
                    "endCursor": None,
                    "hasNextPage": False,
                },
                "edges": all_edges,
            }
        
        return response.get("data", {}).get("Lots", {})
    
    def get_contracts(
        self,
        first: int = 20,
        after: Optional[str] = None,
        filters: Optional[dict] = None,
    ) -> dict:
        """Get contracts with pagination and filters."""
        first = max(1, min(first, 100))
        
        filter_input = {}
        if filters:
            if "lot_id" in filters:
                filter_input["lotId"] = filters["lot_id"]
            if "supplier_bin" in filters:
                filter_input["supplierBin"] = filters["supplier_bin"]
            if "date_from" in filters:
                filter_input["dateFrom"] = filters["date_from"]
            if "date_to" in filters:
                filter_input["dateTo"] = filters["date_to"]
        
        variables = {
            "first": first,
            "after": after,
            "filter": filter_input if filter_input else None,
        }
        
        logger.info(f"[GraphQL] Fetching contracts (page size: {first})")
        response = self._execute_with_retry(self.QUERY_CONTRACTS_PAGINATED, variables)
        
        return response.get("data", {}).get("Contracts", {})
    
    def get_subjects(
        self,
        first: int = 20,
        after: Optional[str] = None,
        filters: Optional[dict] = None,
    ) -> dict:
        """Get subjects (organizations) with pagination."""
        first = max(1, min(first, 100))
        
        filter_input = {}
        if filters:
            if "bin" in filters:
                filter_input["bin"] = filters["bin"]
            if "status" in filters:
                filter_input["status"] = filters["status"]
        
        variables = {
            "first": first,
            "after": after,
            "filter": filter_input if filter_input else None,
        }
        
        logger.info(f"[GraphQL] Fetching subjects (page size: {first})")
        response = self._execute_with_retry(self.QUERY_SUBJECTS, variables)
        
        return response.get("data", {}).get("Subjects", {})
    
    def close(self):
        """Close HTTP client."""
        if self.client:
            self.client.close()
    
    def __enter__(self):
        return self
    
    def __exit__(self, *args):
        self.close()
    
    def get_stats(self) -> dict:
        """Get rate limit and performance stats."""
        return {
            "requests_made": self.rate_limit.requests_made,
            "requests_per_minute": self.rate_limit.requests_per_minute,
            "requests_per_hour": self.rate_limit.requests_per_hour,
            "last_request_time": self.rate_limit.last_request_time,
            "has_next_page": self.paginator.has_next_page,
            "current_cursor": self.paginator.current_cursor,
        }

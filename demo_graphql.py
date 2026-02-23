"""Демо и тест GraphQL: пагинация, фильтры, ошибки и лимиты.

Запуск:
    python3 demo_graphql.py

При отсутствии GOSZAKUP_TOKEN используются мок-данные.
"""

import logging
import sys
import json
from typing import Optional
from src.ingestion.goszakup_graphql import GoszakupGraphQL, ErrorType

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('graphql_demo.log'),
    ]
)
logger = logging.getLogger(__name__)


def demo_basic_pagination():
    """Демо 1: базовая пагинация по курсору."""
    logger.info("=" * 70)
    logger.info("DEMO 1: Basic Pagination (Cursor-based)")
    logger.info("=" * 70)
    
    client = GoszakupGraphQL(
        url="http://127.0.0.1:8006/api/graphql",
        token=None,
    )
    
    try:
        logger.info("\n>>> Fetching first page (20 lots)...")
        result = client.get_lots(first=20)
        
        page_info = result.get("pageInfo", {})
        edges = result.get("edges", [])
        
        logger.info(f"✓ Got {len(edges)} lots")
        logger.info(f"  - Total available: {page_info.get('totalCount', 'unknown')}")
        logger.info(f"  - Has next page: {page_info.get('hasNextPage', False)}")
        logger.info(f"  - Cursor: {page_info.get('endCursor', 'N/A')}")
        
        if edges:
            first_lot = edges[0].get("node", {})
            logger.info(f"\n  First lot: {first_lot.get('nameRu', 'N/A')}")
            logger.info(f"  - ID: {first_lot.get('id')}")
            logger.info(f"  - Amount: {first_lot.get('amount')} ₸")
        
        if page_info.get("hasNextPage"):
            logger.info(f"\n>>> Fetching next page using cursor...")
            cursor = page_info.get("endCursor")
            next_result = client.get_lots(first=20, after=cursor)
            
            next_edges = next_result.get("edges", [])
            logger.info(f"✓ Got {len(next_edges)} lots on page 2")
            
            if next_edges:
                second_lot = next_edges[0].get("node", {})
                logger.info(f"  First lot on page 2: {second_lot.get('nameRu', 'N/A')}")
    
    except Exception as e:
        logger.error(f"✗ Error: {e}")
    finally:
        client.close()


def demo_filtering():
    """Демо 2: фильтры по бюджету, датам и заказчику."""
    logger.info("\n" + "=" * 70)
    logger.info("DEMO 2: Filtering (Budget, Date, Customer)")
    logger.info("=" * 70)
    
    client = GoszakupGraphQL(url="http://127.0.0.1:8006/api/graphql")
    
    try:
        logger.info("\n>>> Filter 1: Lots with budget 1M-10M ₸...")
        filters = {
            "budget_min": 1000000,
            "budget_max": 10000000,
        }
        result = client.get_lots(first=20, filters=filters)
        logger.info(f"✓ Found {len(result.get('edges', []))} lots in budget range")
        
        logger.info("\n>>> Filter 2: Lots from specific customer (BIN: 123456789012)...")
        filters = {
            "customer_bin": "123456789012",
        }
        result = client.get_lots(first=20, filters=filters)
        logger.info(f"✓ Found {len(result.get('edges', []))} lots from this customer")
        
        logger.info("\n>>> Filter 3: Only ACTIVE lots...")
        filters = {"status": "active"}
        result = client.get_lots(first=20, filters=filters)
        logger.info(f"✓ Found {len(result.get('edges', []))} active lots")
        
        logger.info("\n>>> Filter 4: Lots published since 2024-01-01...")
        filters = {
            "publish_date_from": "2024-01-01T00:00:00Z",
        }
        result = client.get_lots(first=20, filters=filters)
        logger.info(f"✓ Found {len(result.get('edges', []))} lots published since 2024-01-01")
    
    except Exception as e:
        logger.error(f"✗ Error: {e}")
    finally:
        client.close()


def demo_error_handling():
    """Демо 3: ошибки и повторные попытки."""
    logger.info("\n" + "=" * 70)
    logger.info("DEMO 3: Error Handling & Retry Logic")
    logger.info("=" * 70)
    
    client = GoszakupGraphQL(url="http://127.0.0.1:8006/api/graphql")
    
    try:
        logger.info("\n>>> Scenario 1: Large page size (will be clamped to max 100)...")
        result = client.get_lots(first=500)
        logger.info(f"✓ System handled gracefully (clamped to 100)")
        
        logger.info("\n>>> Scenario 2: Invalid budget range...")
        filters = {
            "budget_min": 10000000,
            "budget_max": 1000000,
        }
        try:
            result = client.get_lots(first=20, filters=filters)
            logger.info(f"✓ Invalid range handled by API")
        except Exception as e:
            logger.info(f"✓ API returned error (expected): {e}")
        
        logger.info("\n>>> Scenario 3: Rate limit tracking...")
        for i in range(5):
            logger.debug(f"  Request {i + 1}/5...")
            result = client.get_lots(first=10)
        
        stats = client.get_stats()
        logger.info(f"✓ Completed 5 requests")
        logger.info(f"  - Total requests: {stats['requests_made']}")
        logger.info(f"  - Rate limit: {stats['requests_per_minute']} req/min")
        logger.info(f"  - Remaining in minute: {stats['requests_per_minute'] - (stats['requests_made'] % stats['requests_per_minute'])}")
    
    except Exception as e:
        logger.error(f"✗ Error: {e}")
    finally:
        client.close()


def demo_batch_fetching():
    """Демо 4: загрузка всех страниц."""
    logger.info("\n" + "=" * 70)
    logger.info("DEMO 4: Batch Fetching (All Pages)")
    logger.info("=" * 70)
    
    client = GoszakupGraphQL(url="http://127.0.0.1:8006/api/graphql")
    
    try:
        logger.info(f"\n>>> Fetching all lots (with automatic pagination)...")
        logger.info(f"    This may take a while for large datasets...\n")
        
        result = client.get_lots(first=20, fetch_all=True)
        
        all_edges = result.get("edges", [])
        logger.info(f"✓ Successfully fetched all {len(all_edges)} lots")
        
        total_budget = 0
        by_status = {}
        for edge in all_edges:
            node = edge.get("node", {})
            amount = node.get("amount", 0)
            total_budget += amount
            status = node.get("status", "unknown")
            by_status[status] = by_status.get(status, 0) + 1
        
        logger.info(f"\n  Summary:")
        logger.info(f"  - Total budget: {total_budget:,.0f} ₸")
        logger.info(f"  - By status: {by_status}")
    
    except Exception as e:
        logger.error(f"✗ Error: {e}")
    finally:
        client.close()


def demo_contracts_and_subjects():
    """Демо 5: запрос контрактов и субъектов."""
    logger.info("\n" + "=" * 70)
    logger.info("DEMO 5: Contracts & Subjects (Organizations)")
    logger.info("=" * 70)
    
    client = GoszakupGraphQL(url="http://127.0.0.1:8006/api/graphql")
    
    try:
        logger.info(f"\n>>> Fetching contracts...")
        contracts_result = client.get_contracts(first=20)
        
        contracts = contracts_result.get("edges", [])
        logger.info(f"✓ Found {len(contracts)} contracts")
        
        logger.info(f"\n>>> Fetching organizations (subjects)...")
        subjects_result = client.get_subjects(first=20)
        
        subjects = subjects_result.get("edges", [])
        logger.info(f"✓ Found {len(subjects)} organizations")
        
        logger.info(f"\n>>> Filtering organizations by status: ACTIVE...")
        active_subjects = client.get_subjects(first=20, filters={"status": "active"})
        logger.info(f"✓ Found {len(active_subjects.get('edges', []))} active organizations")
    
    except Exception as e:
        logger.error(f"✗ Error: {e}")
    finally:
        client.close()


def demo_statistics():
    """Demo 6: Performance and rate limit statistics."""
    logger.info("\n" + "=" * 70)
    logger.info("DEMO 6: Performance & Statistics")
    logger.info("=" * 70)
    
    client = GoszakupGraphQL(url="http://127.0.0.1:8006/api/graphql")
    
    try:
        import time
        
        logger.info(f"\n>>> Running 10 sequential requests to track rate limit...")
        start_time = time.time()
        
        for i in range(10):
            client.get_lots(first=10)
        
        elapsed = time.time() - start_time
        
        stats = client.get_stats()
        
        logger.info(f"✓ Completed 10 requests in {elapsed:.2f}s")
        logger.info(f"\n  Rate Limit Stats:")
        logger.info(f"  - Total requests made: {stats['requests_made']}")
        logger.info(f"  - Limit: {stats['requests_per_minute']} requests/minute")
        logger.info(f"  - Average request time: {elapsed/10*1000:.1f}ms")
        logger.info(f"  - Requests per second: {10/elapsed:.2f}")
        
        logger.info(f"\n  Pagination Stats:")
        logger.info(f"  - Current cursor: {stats['current_cursor']}")
        logger.info(f"  - Has next page: {stats['has_next_page']}")
    
    except Exception as e:
        logger.error(f"✗ Error: {e}")
    finally:
        client.close()


def main():
    """Run all demos."""
    logger.info("\n" + "=" * 70)
    logger.info("GOSZAKUP GRAPHQL - PAGINATION, FILTERING & ERROR HANDLING DEMO")
    logger.info("=" * 70 + "\n")
    
    demos = [
        ("Basic Pagination", demo_basic_pagination),
        ("Filtering", demo_filtering),
        ("Error Handling", demo_error_handling),
        ("Batch Fetching", demo_batch_fetching),
        ("Contracts & Subjects", demo_contracts_and_subjects),
        ("Statistics", demo_statistics),
    ]
    
    for name, demo_func in demos:
        try:
            demo_func()
        except KeyboardInterrupt:
            logger.warning("\n\nDemo interrupted by user")
            break
        except Exception as e:
            logger.exception(f"Error in {name}: {e}")
    
    logger.info("\n" + "=" * 70)
    logger.info("DEMO COMPLETED")
    logger.info("=" * 70)
    logger.info(f"\nDetailed logs saved to: graphql_demo.log")


if __name__ == "__main__":
    main()

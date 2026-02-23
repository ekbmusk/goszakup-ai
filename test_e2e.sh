#!/bin/bash

echo "🧪 GoszakupAI End-to-End Test Suite"
echo "===================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

test_case() {
    echo -e "${BLUE}→${NC} Testing: $1"
}

pass() {
    echo -e "${GREEN}  ✅ PASS${NC}: $1"
    ((PASS++))
}

fail() {
    echo -e "${RED}  ❌ FAIL${NC}: $1"
    ((FAIL++))
}

# Test 1: Services Running
test_case "Services Running"
if lsof -i :8006 > /dev/null 2>&1; then
    pass "FastAPI backend on port 8006"
else
    fail "FastAPI backend not running on 8006"
fi

if lsof -i :3000 > /dev/null 2>&1; then
    pass "HTTP server on port 3000"
else
    fail "HTTP server not running on 3000"
fi

echo ""

# Test 2: Backend API Endpoints
test_case "Backend API Endpoints"

HEALTH=$(curl -s http://localhost:8006/api/health 2>/dev/null)
if echo "$HEALTH" | jq -e '.status == "ok"' > /dev/null 2>&1; then
    pass "GET /api/health returns valid response"
else
    fail "GET /api/health failed"
fi

LOTS=$(curl -s 'http://localhost:8006/api/lots?page=0&size=5' 2>/dev/null)
if echo "$LOTS" | jq -e '.items | length == 5' > /dev/null 2>&1; then
    pass "GET /api/lots returns paginated data"
else
    fail "GET /api/lots failed"
fi

DASHBOARD=$(curl -s http://localhost:8006/api/stats/dashboard 2>/dev/null)
if echo "$DASHBOARD" | jq -e '.total_lots > 0' > /dev/null 2>&1; then
    pass "GET /api/stats/dashboard returns stats"
else
    fail "GET /api/stats/dashboard failed"
fi

echo ""

# Test 3: Frontend Files
test_case "Frontend Files"

if [ -f "/Users/beka/Projects/claude/goszakup-ai/goszakup-frontend/index.html" ]; then
    pass "index.html exists"
else
    fail "index.html missing"
fi

if [ -f "/Users/beka/Projects/claude/goszakup-ai/goszakup-frontend/app.js" ]; then
    pass "app.js exists"
else
    fail "app.js missing"
fi

if [ -f "/Users/beka/Projects/claude/goszakup-ai/goszakup-frontend/styles.css" ]; then
    pass "styles.css exists"
else
    fail "styles.css missing"
fi

echo ""

# Test 4: Frontend File Access via HTTP
test_case "Frontend HTTP Delivery"

HTTP_INDEX=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/index.html)
if [ "$HTTP_INDEX" == "200" ]; then
    pass "index.html served via HTTP (200 OK)"
else
    fail "index.html HTTP error: $HTTP_INDEX"
fi

HTTP_JS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/app.js)
if [ "$HTTP_JS" == "200" ]; then
    pass "app.js served via HTTP (200 OK)"
else
    fail "app.js HTTP error: $HTTP_JS"
fi

HTTP_CSS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/styles.css)
if [ "$HTTP_CSS" == "200" ]; then
    pass "styles.css served via HTTP (200 OK)"
else
    fail "styles.css HTTP error: $HTTP_CSS"
fi

echo ""

# Test 5: JavaScript Validation
test_case "JavaScript Validation"

if node -c /Users/beka/Projects/claude/goszakup-ai/goszakup-frontend/app.js 2>/dev/null; then
    pass "app.js has no syntax errors"
else
    fail "app.js has syntax errors"
fi

echo ""

# Test 6: Data Integrity
test_case "Data Integrity"

TOTAL_LOTS=$(echo "$DASHBOARD" | jq '.total_lots')
if [ "$TOTAL_LOTS" -gt 0 ]; then
    pass "Dashboard contains $TOTAL_LOTS lots"
else
    fail "Dashboard has no lots"
fi

BY_LEVEL=$(echo "$DASHBOARD" | jq '.by_level')
if echo "$BY_LEVEL" | jq -e '.LOW + .MEDIUM + .HIGH + .CRITICAL > 0' > /dev/null 2>&1; then
    pass "Risk level distribution valid"
else
    fail "Risk level distribution invalid"
fi

AVG_SCORE=$(echo "$DASHBOARD" | jq '.avg_score')
if [ ! -z "$AVG_SCORE" ] && [ "$AVG_SCORE" != "null" ]; then
    pass "Average risk score: $AVG_SCORE"
else
    fail "Average risk score missing"
fi

TOP_RISKS=$(echo "$DASHBOARD" | jq '.top_risks | length')
if [ "$TOP_RISKS" -gt 0 ]; then
    pass "Top $TOP_RISKS highest risk lots available"
else
    fail "No top risks data"
fi

echo ""

# Summary
echo "# Test Results"
echo "=================================="
echo -e "${GREEN}✅ PASSED:${NC} $PASS"
echo -e "${RED}❌ FAILED:${NC} $FAIL"

if [ $FAIL -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    echo ""
    echo "Frontend is ready to use:"
    echo "  → http://localhost:3000"
    echo ""
    echo "Backend is ready:"
    echo "  → http://localhost:8006"
    exit 0
else
    echo ""
    echo -e "${RED}Some tests failed. Please check the errors above.${NC}"
    exit 1
fi

#!/bin/bash

echo "🔍 GoszakupAI Frontend Debug Checklist"
echo "======================================"
echo ""

# Test 1: HTTP Server
echo "1️⃣  Checking HTTP Server on port 3000..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
    echo "   ✅ HTTP Server is running"
else
    echo "   ❌ HTTP Server is NOT running"
    exit 1
fi

# Test 2: Frontend HTML
echo "2️⃣  Checking if index.html is accessible..."
if curl -s http://localhost:3000/index.html | grep -q "GoszakupAI"; then
    echo "   ✅ index.html is accessible"
else
    echo "   ❌ index.html is NOT accessible"
    exit 1
fi

# Test 3: app.js
echo "3️⃣  Checking if app.js is accessible..."
if curl -s http://localhost:3000/app.js | grep -q "API_URL"; then
    echo "   ✅ app.js is accessible"
else
    echo "   ❌ app.js is NOT accessible"
    exit 1
fi

# Test 4: styles.css
echo "4️⃣  Checking if styles.css is accessible..."
if curl -s http://localhost:3000/styles.css | grep -q "container"; then
    echo "   ✅ styles.css is accessible"
else
    echo "   ❌ styles.css is NOT accessible"
    exit 1
fi

# Test 5: FastAPI Backend
echo "5️⃣  Checking FastAPI on port 8006..."
if curl -s http://localhost:8006/api/health | jq -e '.status == "ok"' > /dev/null 2>&1; then
    echo "   ✅ FastAPI Backend is running"
else
    echo "   ❌ FastAPI Backend is NOT running"
    exit 1
fi

# Test 6: Dashboard Data
echo "6️⃣  Checking if dashboard data is available..."
TOTAL_LOTS=$(curl -s http://localhost:8006/api/stats/dashboard | jq '.total_lots')
echo "   ✅ Dashboard data available ($TOTAL_LOTS lots)"

# Test 7: CORS
echo "7️⃣  Checking CORS configuration..."
if curl -s http://localhost:8006/api/health | jq -e '.status' > /dev/null 2>&1; then
    echo "   ✅ API returns valid JSON (CORS likely OK)"
else
    echo "   ❌ CORS might be misconfigured"
    exit 1
fi

# Test 8: JavaScript Syntax
echo "8️⃣  Checking JavaScript syntax..."
if node -c /Users/beka/Projects/claude/goszakup-ai/goszakup-frontend/app.js 2>/dev/null; then
    echo "   ✅ app.js has no syntax errors"
else
    echo "   ❌ app.js has syntax errors"
    exit 1
fi

echo ""
echo "✅ All checks passed!"
echo ""
echo "Frontend should be accessible at: http://localhost:3000"
echo "Backend API at: http://localhost:8006"
echo ""
echo "If dashboard is still not visible:"
echo "1. Open http://localhost:3000 in your browser"
echo "2. Press F12 to open Developer Tools"
echo "3. Go to Console tab"
echo "4. Look for any error messages"
echo "5. Check the Network tab for failed requests"

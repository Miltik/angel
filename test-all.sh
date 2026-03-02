#!/bin/bash
# ANGEL Remote Ecosystem - Automated Testing Script
# Validates all components

set -e  # Exit on error

BACKEND_URL="http://localhost:3000"
DASHBOARD_URL="http://localhost:5173"
BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════╗"
echo "║   ANGEL Remote Ecosystem - Automated Test Suite   ║"
echo "╚════════════════════════════════════════════════════╝"
echo -e "${NC}"

TESTS_PASSED=0
TESTS_FAILED=0

# Test function
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local expected_pattern=$4
    
    echo -n "Testing $name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s "$BACKEND_URL$endpoint")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -X POST "$BACKEND_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d '{"commandType":"pause"}')
    fi
    
    if echo "$response" | grep -q "$expected_pattern"; then
        echo -e "${GREEN}PASS${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        echo "  Response: $response"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo -e "${YELLOW}=== Phase 1: Backend Connectivity ===${NC}"

# Check if backend is running
echo -n "Checking backend connectivity... "
if curl -s "$BACKEND_URL/health" > /dev/null 2>&1; then
    echo -e "${GREEN}ONLINE${NC}"
else
    echo -e "${RED}OFFLINE${NC}"
    echo "Error: Backend not running. Start with: cd server && npm start"
    exit 1
fi

echo -e "${YELLOW}=== Phase 2: API Endpoints ===${NC}"

test_endpoint "Health Check" "GET" "/health" "ok"
test_endpoint "Get Status" "GET" "/api/status" "success"
test_endpoint "Get Commands" "GET" "/api/commands" "commands"
test_endpoint "Queue Command" "POST" "/api/commands" "success"
test_endpoint "Get History" "GET" "/api/history" "success"
test_endpoint "Get Stats" "GET" "/api/stats" "success"

echo -e "${YELLOW}=== Phase 3: Telemetry Data ===${NC}"

echo -n "Sending test telemetry... "
telemetry_response=$(curl -s -X POST "$BACKEND_URL/api/telemetry" \
    -H "Content-Type: application/json" \
    -d '{
        "runId":"test-run",
        "timestamp":'$(date +%s000)',
        "modules":{"hacking":{"executions":10,"failures":0,"status":"running"}},
        "stats":{"uptime":1000,"moneyRate":100000,"xpRate":50},
        "memory":{"used":64,"total":256},
        "money":"1000000000",
        "hackLevel":100
    }')

if echo "$telemetry_response" | grep -q "success"; then
    echo -e "${GREEN}PASS${NC}"
    ((TESTS_PASSED++))
    
    # Verify it was stored
    echo -n "Verifying telemetry stored in database... "
    history_response=$(curl -s "$BACKEND_URL/api/history?limit=1")
    if echo "$history_response" | grep -q "hacking"; then
        echo -e "${GREEN}PASS${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}FAIL${NC}"
        ((TESTS_FAILED++))
    fi
else
    echo -e "${RED}FAIL${NC}"
    echo "  Response: $telemetry_response"
    ((TESTS_FAILED++))
fi

echo -e "${YELLOW}=== Phase 4: Command Queue ===${NC}"

echo -n "Queueing test commands... "
cmd_response=$(curl -s -X POST "$BACKEND_URL/api/commands" \
    -H "Content-Type: application/json" \
    -d '{"commandType":"pause"}')

if echo "$cmd_response" | grep -q "success"; then
    echo -e "${GREEN}PASS${NC}"
    ((TESTS_PASSED++))
    
    cmd_id=$(echo "$cmd_response" | grep -o '"commandId":[0-9]*' | grep -o '[0-9]*')
    
    echo -n "Retrieving pending commands... "
    pending=$(curl -s "$BACKEND_URL/api/commands")
    if echo "$pending" | grep -q "pause"; then
        echo -e "${GREEN}PASS${NC}"
        ((TESTS_PASSED++))
        
        echo -n "Updating command status... "
        update=$(curl -s -X PATCH "$BACKEND_URL/api/commands/$cmd_id" \
            -H "Content-Type: application/json" \
            -d '{"status":"executed","result":{"status":"ok"}}')
        
        if echo "$update" | grep -q "success"; then
            echo -e "${GREEN}PASS${NC}"
            ((TESTS_PASSED++))
        else
            echo -e "${RED}FAIL${NC}"
            ((TESTS_FAILED++))
        fi
    else
        echo -e "${RED}FAIL${NC}"
        ((TESTS_FAILED++))
    fi
else
    echo -e "${RED}FAIL${NC}"
    echo "  Response: $cmd_response"
    ((TESTS_FAILED++))
fi

echo -e "${YELLOW}=== Phase 5: Dashboard Connectivity ===${NC}"

echo -n "Checking dashboard... "
if curl -s "$DASHBOARD_URL" | grep -q "ANGEL"; then
    echo -e "${GREEN}ONLINE${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}OFFLINE${NC}"
    echo "Warning: Dashboard not running. Start with: cd web && npm run dev"
    ((TESTS_FAILED++))
fi

echo -e "${YELLOW}=== Phase 6: Database ===${NC}"

if [ -f "server/data/data.db" ]; then
    echo -e "Database file exists... ${GREEN}PASS${NC}"
    ((TESTS_PASSED++))
    
    size=$(du -h server/data/data.db | cut -f1)
    echo -e "Database size: ${GREEN}$size${NC}"
else
    echo -e "Database file... ${RED}NOT FOUND${NC}"
    ((TESTS_FAILED++))
fi

echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║              TEST RESULTS SUMMARY                  ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
    echo ""
    echo "Your ANGEL ecosystem is ready for deployment!"
    exit 0
else
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
    echo ""
    echo "Please check the errors above and troubleshoot."
    exit 1
fi

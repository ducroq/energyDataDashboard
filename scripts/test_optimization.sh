#!/bin/bash
#
# Test script for build optimization
# Tests caching behavior and performance
#

set -e  # Exit on error

echo "=================================="
echo "Build Optimization Test Suite"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test 1: Clean state
echo "📝 Test 1: Clean State (No Cache)"
echo "----------------------------------"
rm -rf static/data/*.json
echo "Removed cached data"

start_time=$(date +%s)
python decrypt_data_cached.py
end_time=$(date +%s)
duration=$((end_time - start_time))

if [ -f "static/data/energy_price_forecast.json" ]; then
    echo -e "${GREEN}✓ Data file created${NC}"
    echo "⏱️  Time: ${duration}s"
else
    echo -e "${RED}✗ Data file not created${NC}"
    exit 1
fi

if [ -f "static/data/energy_data_metadata.json" ]; then
    echo -e "${GREEN}✓ Metadata file created${NC}"
else
    echo -e "${RED}✗ Metadata file not created${NC}"
    exit 1
fi

echo ""

# Test 2: Cache hit
echo "📝 Test 2: Cache Hit (Fresh Data)"
echo "----------------------------------"
echo "Running decrypt again immediately..."

start_time=$(date +%s)
python decrypt_data_cached.py 2>&1 | grep -q "Using cached data"
exit_code=$?
end_time=$(date +%s)
duration=$((end_time - start_time))

if [ $exit_code -eq 0 ]; then
    echo -e "${GREEN}✓ Cache hit detected${NC}"
    echo "⏱️  Time: ${duration}s (should be < 3s)"

    if [ $duration -lt 3 ]; then
        echo -e "${GREEN}✓ Performance excellent${NC}"
    else
        echo -e "${YELLOW}⚠️  Slower than expected${NC}"
    fi
else
    echo -e "${RED}✗ Cache not used${NC}"
    exit 1
fi

echo ""

# Test 3: Force refresh
echo "📝 Test 3: Force Refresh"
echo "----------------------------------"

start_time=$(date +%s)
python decrypt_data_cached.py --force 2>&1 | grep -q "Force refresh"
exit_code=$?
end_time=$(date +%s)
duration=$((end_time - start_time))

if [ $exit_code -eq 0 ]; then
    echo -e "${GREEN}✓ Force refresh works${NC}"
    echo "⏱️  Time: ${duration}s"
else
    echo -e "${RED}✗ Force flag not working${NC}"
    exit 1
fi

echo ""

# Test 4: Metadata validation
echo "📝 Test 4: Metadata Validation"
echo "----------------------------------"

if python3 -c "import json; json.load(open('static/data/energy_data_metadata.json'))" 2>/dev/null; then
    echo -e "${GREEN}✓ Metadata is valid JSON${NC}"

    # Show metadata contents
    echo ""
    echo "Metadata contents:"
    python3 -c "
import json
with open('static/data/energy_data_metadata.json') as f:
    meta = json.load(f)
    for key, value in meta.items():
        if key == 'data_hash':
            print(f'  {key}: {value[:16]}...')
        else:
            print(f'  {key}: {value}')
    "
else
    echo -e "${RED}✗ Invalid metadata JSON${NC}"
    exit 1
fi

echo ""

# Test 5: Data structure validation
echo "📝 Test 5: Data Structure Validation"
echo "----------------------------------"

python3 << 'EOF'
import json
import sys

try:
    with open('static/data/energy_price_forecast.json') as f:
        data = json.load(f)

    # Check expected structure
    expected_sources = ['entsoe', 'energy_zero', 'epex', 'elspot']

    if isinstance(data, dict):
        print(f"✓ Data is dictionary")
        print(f"  Keys: {', '.join(data.keys())}")

        data_points = 0
        for source in expected_sources:
            if source in data:
                if 'data' in data[source]:
                    count = len(data[source]['data'])
                    data_points += count
                    print(f"  {source}: {count} data points")

        if data_points > 0:
            print(f"\n✓ Total data points: {data_points}")
            sys.exit(0)
        else:
            print(f"\n✗ No data points found")
            sys.exit(1)
    else:
        print(f"✗ Unexpected data type: {type(data)}")
        sys.exit(1)

except Exception as e:
    print(f"✗ Error validating data: {e}")
    sys.exit(1)
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Data structure valid${NC}"
else
    echo -e "${RED}✗ Invalid data structure${NC}"
    exit 1
fi

echo ""

# Summary
echo "=================================="
echo "Test Summary"
echo "=================================="
echo -e "${GREEN}✓ All tests passed!${NC}"
echo ""
echo "Optimization is working correctly:"
echo "  - Cache mechanism functional"
echo "  - Force refresh works"
echo "  - Metadata properly created"
echo "  - Data structure valid"
echo ""
echo "Next steps:"
echo "  1. Install npm dependencies: npm install"
echo "  2. Replace netlify.toml: cp netlify.toml.optimized netlify.toml"
echo "  3. Commit and deploy to test in Netlify"
echo "=================================="

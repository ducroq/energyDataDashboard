@echo off
REM Test script for build optimization (Windows version)
REM Tests caching behavior and performance

echo ==================================
echo Build Optimization Test Suite
echo ==================================
echo.

REM Test 1: Clean state
echo Test 1: Clean State (No Cache)
echo ----------------------------------
if exist static\data\*.json del /q static\data\*.json
echo Removed cached data

set START_TIME=%time%
python decrypt_data_cached.py
set END_TIME=%time%

if exist static\data\energy_price_forecast.json (
    echo [32m✓ Data file created[0m
) else (
    echo [31m✗ Data file not created[0m
    exit /b 1
)

if exist static\data\energy_data_metadata.json (
    echo [32m✓ Metadata file created[0m
) else (
    echo [31m✗ Metadata file not created[0m
    exit /b 1
)

echo.

REM Test 2: Cache hit
echo Test 2: Cache Hit (Fresh Data)
echo ----------------------------------
echo Running decrypt again immediately...

python decrypt_data_cached.py 2>&1 | findstr /C:"Using cached data" >nul
if %ERRORLEVEL% EQU 0 (
    echo [32m✓ Cache hit detected[0m
    echo Performance: Fast (cached)
) else (
    echo [31m✗ Cache not used[0m
    exit /b 1
)

echo.

REM Test 3: Force refresh
echo Test 3: Force Refresh
echo ----------------------------------

python decrypt_data_cached.py --force 2>&1 | findstr /C:"Force refresh" >nul
if %ERRORLEVEL% EQU 0 (
    echo [32m✓ Force refresh works[0m
) else (
    echo [31m✗ Force flag not working[0m
    exit /b 1
)

echo.

REM Test 4: Metadata validation
echo Test 4: Metadata Validation
echo ----------------------------------

python -c "import json; json.load(open('static/data/energy_data_metadata.json'))" 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [32m✓ Metadata is valid JSON[0m
    echo.
    echo Metadata contents:
    python -c "import json; meta = json.load(open('static/data/energy_data_metadata.json')); [print(f'  {k}: {v[:16] if k == \"data_hash\" else v}...') if k == 'data_hash' else print(f'  {k}: {v}') for k, v in meta.items()]"
) else (
    echo [31m✗ Invalid metadata JSON[0m
    exit /b 1
)

echo.

REM Test 5: Data structure validation
echo Test 5: Data Structure Validation
echo ----------------------------------

python -c "import json, sys; data = json.load(open('static/data/energy_price_forecast.json')); print(f'✓ Data keys: {list(data.keys())}'); total = sum(len(data[k]['data']) for k in ['entsoe', 'energy_zero', 'epex', 'elspot'] if k in data and 'data' in data[k]); print(f'✓ Total data points: {total}'); sys.exit(0 if total > 0 else 1)"

if %ERRORLEVEL% EQU 0 (
    echo [32m✓ Data structure valid[0m
) else (
    echo [31m✗ Invalid data structure[0m
    exit /b 1
)

echo.

REM Summary
echo ==================================
echo Test Summary
echo ==================================
echo [32m✓ All tests passed![0m
echo.
echo Optimization is working correctly:
echo   - Cache mechanism functional
echo   - Force refresh works
echo   - Metadata properly created
echo   - Data structure valid
echo.
echo Next steps:
echo   1. Install npm dependencies: npm install
echo   2. Replace netlify.toml: copy netlify.toml.optimized netlify.toml
echo   3. Commit and deploy to test in Netlify
echo ==================================

pause

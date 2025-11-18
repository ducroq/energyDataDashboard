# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Energy Price Dashboard - A Hugo-based web application that visualizes real-time and forecasted energy prices in the Netherlands. The dashboard fetches encrypted energy data from the Energy Data Hub project, decrypts it during the build process, and displays interactive charts using Plotly.js.

## Build and Development Commands

### Local Development
```bash
# Install Python dependencies
pip install cryptography

# Set environment variables (required for data decryption)
# Windows PowerShell:
$env:ENCRYPTION_KEY_B64 = "your_base64_encryption_key"
$env:HMAC_KEY_B64 = "your_base64_hmac_key"

# Fetch and decrypt energy data
python decrypt_data.py

# Run Hugo development server
hugo server -D

# Access at http://localhost:1313
```

### Building for Production
```bash
# Build static site with minification
hugo --minify

# Output directory: public/
```

## Architecture

### Data Flow
1. **Data Collection** (external): Energy Data Hub collects prices from ENTSO-E, Energy Zero, EPEX, and Elspot APIs, encrypts data with AES-CBC + HMAC-SHA256
2. **Build Process**: Netlify build triggers `decrypt_data.py` which fetches encrypted JSON from GitHub Pages
3. **Decryption**: `SecureDataHandler` verifies HMAC signature and decrypts data using environment variable keys
4. **Static Generation**: Hugo builds site with decrypted JSON placed in `static/data/energy_price_forecast.json`
5. **Client-Side Rendering**: JavaScript (`chart.js`) fetches both decrypted forecast data and live Energy Zero API data to render Plotly charts

### Key Components

**Backend (Python)**
- `decrypt_data.py`: Main entry point for build-time data decryption. Fetches from `https://ducroq.github.io/energydatahub/energy_price_forecast.json`
- `utils/secure_data_handler.py`: Implements AES-CBC-256 encryption/decryption with HMAC-SHA256 authentication
- `utils/timezone_helpers.py`, `utils/data_types.py`, `utils/helpers.py`: Utility modules for data processing

**Frontend (Hugo + Vanilla JavaScript)**
- `layouts/index.html`: Main dashboard template with chart container and info cards
- `static/js/chart.js`: `EnergyDashboard` class that:
  - Loads decrypted forecast data from `/data/energy_price_forecast.json`
  - Fetches live Energy Zero data directly from `https://api.energyzero.nl/v1/energyprices` API
  - Handles timezone conversions (Energy Zero returns UTC, converts to +2 hours for NL time)
  - Renders multi-source price data with Plotly.js
  - Implements time range selection (24h, 48h, 7d, custom historical ranges)
  - Auto-refreshes Energy Zero data every 10 minutes
- `static/css/style.css`: Glassmorphism design with dark theme

**Configuration**
- `hugo.toml`: Site configuration, base URL, CORS headers for `/data/**`
- `netlify.toml`: Build command orchestrates `pip install`, `decrypt_data.py`, and `hugo --minify`

### Data Sources Architecture

The dashboard combines two types of data:
1. **Forecast Data** (decrypted at build time): Historical aggregated forecasts from multiple sources
2. **Live Data** (fetched client-side): Real-time prices from Energy Zero API for current/recent hours

Both are normalized to EUR/MWh and plotted together. Energy Zero data includes a +2 hour timezone shift to align with Netherlands local time (see `chart.js:185-186`).

## Important Patterns

### Security Model
- Encryption keys MUST be stored as environment variables (`ENCRYPTION_KEY_B64`, `HMAC_KEY_B64`)
- Keys are base64-encoded 32-byte (256-bit) values
- Data integrity verified via HMAC before decryption (see `secure_data_handler.py:44-47`)
- No sensitive keys should ever be committed to the repository

### Timezone Handling
Energy Zero API returns UTC timestamps. The code applies a +2 hour offset for Netherlands timezone:
```javascript
// chart.js:185-186
const utcTimestamp = new Date(pricePoint.readingDate);
const localTimestamp = new Date(utcTimestamp.getTime() + (2 * 60 * 60 * 1000));
```

When modifying timezone logic, verify both historical and live data display correctly.

### Data Normalization
Different sources use different units (EUR/kWh vs EUR/MWh). The code normalizes everything to EUR/MWh:
```javascript
// chart.js:563-566
if (units.includes('kwh') || units.includes('eur/kwh')) {
    multiplier = 1000;
}
```

### Chart Rendering
The `EnergyDashboard` class manages chart state with these key methods:
- `loadEnergyData()`: Fetches decrypted forecast JSON
- `loadEnergyZeroData()`: Calls Energy Zero API for current day
- `loadEnergyZeroHistoricalData()`: Fetches multiple days for custom date ranges
- `processEnergyDataForChart()`: Converts raw data to Plotly traces
- `updateChart()`: Renders chart with Plotly.newPlot

### Automated Data Updates & Caching

**Deployment Pipeline:**
1. energyDataHub collects fresh data daily at 16:00 UTC
2. Encrypts and publishes to `https://ducroq.github.io/energydatahub/`
3. Triggers Netlify rebuild via webhook (`NETLIFY_BUILD_HOOK` secret)
4. Netlify runs `python decrypt_data_cached.py --force` (see `netlify.toml:7`)
5. Dashboard deployed with latest data

**CRITICAL: The `--force` Flag**
The `decrypt_data_cached.py` script has intelligent caching to speed up builds:
- **Age-based caching**: Skips decryption if data < 24 hours old
- **Hash-based caching**: Skips decryption if encrypted data hash unchanged

The `--force` flag bypasses BOTH checks to ensure webhook-triggered builds always decrypt fresh data from energyDataHub, even if Netlify's build cache contains recent files.

**Without `--force`:** Automated updates would reuse stale cached data
**With `--force`:** Every webhook trigger guarantees fresh decryption

See `docs/decisions/003-netlify-cache-force-refresh-fix.md` for details.

## Common Development Tasks

### Adding a New Data Source
1. Update `decrypt_data.py` if source needs decryption, or modify `chart.js` if fetched client-side
2. Add source metadata to `dataSources` array in `chart.js:546-551`
3. Ensure units are normalized to EUR/MWh (multiply by 1000 if EUR/kWh)
4. Add appropriate color and styling for the trace

### Modifying Time Ranges
Time range logic is in `chart.js:375-433` (`applySimpleRange()` method). Ranges are defined by start/end period dropdowns:
- 'yesterday', '2days', 'week' for historical data
- 'now', 'tomorrow', '2days', 'week' for future data

Custom ranges trigger `loadEnergyZeroHistoricalData()` which fetches day-by-day from Energy Zero API.

### Updating Chart Styling
- Plotly layout configuration: `chart.js:693-721`
- CSS styling: `static/css/style.css`
- Chart colors are defined per data source in `processEnergyDataForChart()`

### Debugging Build Process
Netlify build logs show:
1. Python dependency installation
2. Data fetch and decryption output from `decrypt_data.py`
3. Hugo build output

Check `decrypt_data.py:63-72` for logged metadata about decrypted data structure.

## Deployment

### Netlify Configuration
- Build command defined in `netlify.toml`
- Hugo version: 0.124.0
- Python version: 3.11
- Environment variables must be set in Netlify dashboard: Site settings → Environment variables

### Automatic Updates
To trigger dashboard rebuild when new energy data is published:
1. Create build hook in Netlify: Site settings → Build & deploy → Build hooks
2. Add webhook URL to Energy Data Hub repository's GitHub Actions workflow
3. Dashboard will auto-rebuild and decrypt latest data

## File Structure Notes

- `static/` → Copied as-is to `public/` during build (CSS, JS, decrypted data)
- `layouts/` → Hugo templates for HTML structure
- `content/` → Markdown content (minimal in this project)
- `public/` → Build output directory (not committed to git)
- `utils/` → Python utility modules for data handling

## Known Quirks

1. **Timezone offset hardcoded**: The +2 hour offset assumes Netherlands summer time. Consider implementing dynamic timezone detection if supporting multiple regions.
2. **Data noise**: Forecast data has 5% random noise added for educational purposes (see `chart.js:579-582`)
3. **Energy Zero API reliability**: The code tries yesterday and today if current day fails (see `chart.js:44-93`)
4. **Build-time data staleness**: Decrypted forecast data is only refreshed during builds. Live data refreshes every 10 minutes client-side.

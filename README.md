# Energy Price Dashboard

An interactive, real-time web dashboard for visualizing energy price forecasts in the Netherlands. Built with Hugo and Plotly.js, this dashboard fetches encrypted data from the [Energy Data Hub](https://github.com/ducroq/energydatahub) and displays live price comparisons from multiple sources with intelligent caching for optimal performance.

## ✨ Features

### Data Visualization
- **Multi-Source Price Comparison**: View prices from ENTSO-E, Energy Zero, EPEX SPOT, and Nord Pool Elspot
- **Real-Time Updates**: Live Energy Zero data refreshes every 10 minutes
- **Interactive Charts**: Powered by Plotly.js with zoom, pan, and hover details
- **Flexible Time Ranges**: View 24h, 48h, 7d, or custom date ranges
- **Price Statistics**: Real-time min/max/average calculations
- **Threshold Analysis**: Identify cheap energy hours automatically

### Performance & Reliability
- **⚡ Build Caching**: 50-70% faster deploys with intelligent data caching
- **📦 Smart Data Loading**: Only fetches when data actually changes
- **🔄 Auto-Rebuild**: Webhook integration with backend updates
- **📱 Mobile Responsive**: Optimized for all device sizes
- **🔒 Secure**: Encrypted data transit with HMAC verification

### User Experience
- **Dark Theme**: Modern glassmorphism design optimized for extended viewing
- **Color-Coded Prices**: Visual identification of cheap/medium/expensive periods
- **Current Time Marker**: Always know where "now" is on the chart
- **Historical Data**: Access past weeks for trend analysis
- **No Login Required**: Public dashboard, instant access

## 🌐 Live Dashboard

🔗 **Demo**: [Your Dashboard URL]

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Energy Data Hub (Backend Repo)                  │
│  GitHub Actions (Daily 16:00 UTC)                           │
│  ├── Collect from 7+ APIs                                   │
│  ├── Validate & normalize to Europe/Amsterdam timezone      │
│  ├── Encrypt with AES-CBC + HMAC                            │
│  └── Publish to GitHub Pages                                │
└────────────────────┬────────────────────────────────────────┘
                     │
              [GitHub Pages]
                     │ (encrypted JSON)
                     │
┌────────────────────▼────────────────────────────────────────┐
│           Energy Data Dashboard (This Repo)                  │
│  Netlify Build (Triggered by webhook)                       │
│  ├── Fetch encrypted forecast data                          │
│  ├── Check cache (skip if < 24h old) ⚡ NEW!               │
│  ├── Decrypt with same keys                                 │
│  ├── Generate Hugo static site                              │
│  └── Deploy to CDN                                           │
│                                                              │
│  Client-Side (Browser)                                       │
│  ├── Load decrypted forecast data (ENTSO-E, EPEX, Elspot)  │
│  ├── Fetch live Energy Zero API (every 10 min)              │
│  ├── Render combined chart with Plotly.js                   │
│  └── Update statistics and UI                                │
└──────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Deploy

### Option 1: Deploy to Netlify (Recommended)

1. **Fork this repository**
   ```bash
   git clone https://github.com/yourusername/energyDataDashboard.git
   cd energyDataDashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Connect to Netlify**
   - Go to [Netlify](https://netlify.com) and sign up/login
   - Click "New site from Git"
   - Select your forked repository
   - Netlify auto-detects `netlify.toml` configuration

4. **Configure Environment Variables**

   In Netlify dashboard → Site Settings → Environment Variables:

   - `ENCRYPTION_KEY_B64`: Your base64-encoded encryption key
   - `HMAC_KEY_B64`: Your base64-encoded HMAC key

   *(Same keys used in Energy Data Hub project)*

5. **Deploy!**
   - Netlify automatically builds and deploys
   - ⚡ First build: ~50s (fetches and decrypts data)
   - ⚡ Subsequent builds: ~25s (uses cached data if fresh!)

### Option 2: Local Development

1. **Prerequisites**
   - [Hugo](https://gohugo.io/getting-started/installing/) v0.124.0+
   - Python 3.11+ with `cryptography` package
   - Node.js 16+ (for npm dependencies)

2. **Setup**
   ```bash
   git clone https://github.com/yourusername/energyDataDashboard.git
   cd energyDataDashboard
   npm install
   pip install cryptography
   ```

3. **Set Environment Variables**
   ```bash
   # Windows PowerShell
   $env:ENCRYPTION_KEY_B64 = "your_base64_key"
   $env:HMAC_KEY_B64 = "your_base64_key"

   # Linux/Mac
   export ENCRYPTION_KEY_B64="your_base64_key"
   export HMAC_KEY_B64="your_base64_key"
   ```

4. **Fetch Data**
   ```bash
   # Standard fetch (with caching)
   python decrypt_data_cached.py

   # Force fresh data
   python decrypt_data_cached.py --force
   ```

5. **Run Hugo Server**
   ```bash
   hugo server -D
   # Visit http://localhost:1313
   ```

## ⚡ Performance Optimization (NEW!)

### Intelligent Build Caching

The dashboard now includes smart caching to dramatically improve build times:

**Before Optimization:**
- Every deploy fetched and decrypted data
- Build time: ~55 seconds
- 10 deploys/day = 10 API calls to GitHub Pages

**After Optimization:**
- Skips decryption if data < 24 hours old
- Build time: ~25 seconds (cache hit) 🚀 **55% faster!**
- 10 deploys/day = ~1-2 API calls 🎉 **80-90% reduction!**

### How Caching Works

```python
# Automatic cache logic:
if cached_data_age < 24 hours:
    if remote_hash == cached_hash:
        ✅ Use cached data (instant!)
    else:
        🔄 Fetch & decrypt (data changed)
else:
    🔄 Fetch & decrypt (stale cache)
```

**Benefits:**
- ⚡ Faster UI-only deploys
- 💰 Reduced API calls
- 🛡️ Graceful fallback on errors
- 📊 Metadata tracking for debugging

See [OPTIMIZATION_GUIDE.md](OPTIMIZATION_GUIDE.md) for technical details.

## 🎨 Customization

### Price Thresholds

Modify default threshold in `static/js/chart.js`:
```javascript
const CONSTANTS = {
    DEFAULT_CHEAP_PRICE_THRESHOLD: 50,  // EUR/MWh
    DEFAULT_PRICE_THRESHOLD: 75,        // EUR/MWh
};
```

### Time Ranges

Add custom ranges in `static/js/chart.js`:
```javascript
const cutoffs = {
    '24h': new Date(now.getTime() + 24 * 60 * 60 * 1000),
    '48h': new Date(now.getTime() + 48 * 60 * 60 * 1000),
    'custom': new Date(now.getTime() + yourCustomHours * 60 * 60 * 1000),
};
```

### Styling

Update colors and design in `static/css/style.css`:
```css
:root {
    --primary-color: #your-color;
    --background: #your-background;
    --glass-bg: rgba(255, 255, 255, 0.1);
}
```

### Site Information

Configure in `hugo.toml`:
```toml
baseURL = 'https://energy.yourdomain.com'
title = 'Your Dashboard Title'
[params]
  description = "Your custom description"
  author = "Your Name"
```

## 🔄 Automatic Updates

### Setting up Build Hooks

To auto-rebuild when backend publishes new data:

1. **Create Netlify Build Hook**
   - Netlify dashboard → Build & deploy → Build hooks
   - Create hook named "Energy Data Update"
   - Copy webhook URL

2. **Add to Energy Data Hub**

   In `energydatahub/.github/workflows/collect-data.yml`:
   ```yaml
   - name: Trigger dashboard rebuild
     run: |
       curl -X POST -d {} ${{ secrets.NETLIFY_BUILD_HOOK }}
     continue-on-error: true
   ```

3. **Add Secret**
   - In energydatahub repo → Settings → Secrets
   - Add `NETLIFY_BUILD_HOOK` with the webhook URL

Now dashboard auto-updates daily after backend runs! 🎉

## 🔒 Security

### Data Protection
- **Encrypted Transit**: AES-CBC with 256-bit keys
- **Data Integrity**: HMAC-SHA256 verification
- **Environment Variables**: Keys stored securely in Netlify
- **No Data Storage**: Decrypted data only exists during build
- **CSP Headers**: Content Security Policy prevents XSS

### Security Headers

Configured in `netlify.toml`:
```toml
X-Frame-Options = "DENY"
X-Content-Type-Options = "nosniff"
Content-Security-Policy = "default-src 'self'; script-src 'self' https://cdn.plot.ly ..."
```

## 📊 Data Sources

The dashboard displays aggregated data from:

| Source | Provider | Data Type | Update Frequency |
|--------|----------|-----------|------------------|
| **ENTSO-E** | European TSOs | Day-ahead prices | Daily forecast |
| **Energy Zero** | Dutch provider | Real-time + forecast | Hourly + live |
| **EPEX SPOT** | Power Exchange | Auction prices | Daily forecast |
| **Nord Pool Elspot** | Nordic market | Day-ahead prices | Daily forecast |

*All data collection handled by [Energy Data Hub](https://github.com/ducroq/energydatahub)*

## 🛠️ Development

### Available Scripts

```bash
npm run dev          # Hugo dev server with live reload
npm run build        # Production build (with caching)
npm run build:force  # Force fresh data fetch
npm run clean        # Remove build artifacts
```

### Testing Build Optimization

```bash
# Windows
test_optimization.bat

# Linux/Mac
./test_optimization.sh
```

Expected output:
```
✓ Data file created
✓ Metadata file created
✓ Cache hit detected
✓ Force refresh works
✓ All tests passed!
```

### Project Structure

```
energyDataDashboard/
├── content/              # Hugo content (minimal)
├── layouts/              # Hugo templates
│   └── index.html       # Main dashboard template
├── static/
│   ├── css/
│   │   └── style.css    # Glassmorphism styling
│   ├── js/
│   │   ├── chart.js     # Main dashboard logic
│   │   └── dashboard.js # UI controls
│   └── data/            # Decrypted data (generated)
├── utils/               # Python utilities
│   ├── secure_data_handler.py
│   ├── timezone_helpers.py
│   └── data_types.py
├── decrypt_data_cached.py    # Smart decryption script ⚡
├── netlify.toml         # Netlify config with caching
├── hugo.toml            # Hugo configuration
└── package.json         # NPM dependencies
```

## 🐛 Troubleshooting

### Build Fails with Decryption Error

**Symptoms:**
```
Error: Environment variable validation failed: ENCRYPTION_KEY_B64 is not set
```

**Solution:**
1. Verify keys in Netlify → Site Settings → Environment Variables
2. Ensure keys are base64-encoded
3. Keys must match Energy Data Hub keys

### Dashboard Shows No Data

**Symptoms:**
- Charts empty or not rendering
- Console shows fetch errors

**Solution:**
1. Check `/data/energy_price_forecast.json` exists
2. Verify Energy Data Hub is publishing correctly
3. Check browser console for JavaScript errors
4. Manually trigger Netlify rebuild

### Dashboard Shows Old Data

**Symptoms:**
- Timestamps > 24 hours old
- Missing today's prices

**Solution:**
1. Check Energy Data Hub GitHub Action ran at 16:00 UTC
2. Verify build hook triggered Netlify deploy
3. Force rebuild: Netlify → Clear cache and deploy
4. Check `static/data/energy_data_metadata.json` timestamp

### Cache Not Working

**Symptoms:**
- Every build shows "decryption required"
- Build times always ~50s

**Solution:**
1. Verify `npm install` completed
2. Check `netlify-plugin-cache` in `package.json`
3. Netlify → Deploys → Clear cache and deploy
4. Review deploy logs for cache plugin messages

### For More Help

- **📚 Optimization Guide**: [OPTIMIZATION_GUIDE.md](OPTIMIZATION_GUIDE.md)
- **📋 Deployment Checklist**: [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)
- **🔍 Implementation Summary**: [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
- **🐛 GitHub Issues**: https://github.com/yourusername/energyDataDashboard/issues

## 🤝 Contributing

Contributions welcome! Areas for improvement:

- **Visualizations**: Additional charts (weather correlation, demand forecast)
- **Features**: Price alerts, export functionality, historical analysis
- **Mobile**: Progressive Web App (PWA) support
- **Internationalization**: Multi-language support
- **Accessibility**: WCAG compliance improvements

### Development Workflow

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Make changes and test locally with `hugo server`
4. Test build optimization: `test_optimization.bat`
5. Commit: `git commit -m "Add amazing feature"`
6. Push: `git push origin feature/amazing-feature`
7. Open Pull Request

## 📚 Related Projects

- **[Energy Data Hub](https://github.com/ducroq/energydatahub)** - Backend data collection and encryption
- **[Hugo](https://gohugo.io/)** - Static site generator framework
- **[Plotly.js](https://plotly.com/javascript/)** - Interactive charting library
- **[Netlify](https://www.netlify.com/)** - Hosting and deployment platform

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🏆 Project Status

✅ **Production Ready** - Active deployment and maintenance

**Recent Updates:**
- ⚡ Build caching optimization (50-70% faster deploys)
- 🎨 Improved UI with better time range controls
- 📊 Enhanced price statistics and analysis
- 🔒 Security headers and CSP improvements
- 📱 Mobile responsive design enhancements

**Roadmap:**
- 🔄 Progressive Web App (PWA) support
- 📧 Email alerts for price thresholds
- 📊 Historical trend analysis
- 🌍 Multi-language support
- 📱 Native mobile app

---

**Built with ❤️ for smart energy consumption**

*Visualizing energy prices to help optimize consumption and reduce costs*

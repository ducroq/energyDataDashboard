# Energy Price Dashboard

An interactive web dashboard for visualizing real-time energy price forecasts in the Netherlands. This Hugo-based dashboard automatically fetches, decrypts, and displays energy price data from the [Energy Data Hub](https://github.com/ducroq/energydatahub) project, providing users with an intuitive interface to monitor electricity prices and optimize energy consumption.

## Features

- **Real-time Energy Price Visualization**: Interactive charts showing current and forecasted energy prices
- **Price Threshold Highlighting**: Color-coded visualization to identify cheap (green), medium (yellow), and expensive (red) energy periods
- **Time Range Controls**: View data for different periods (24h, 48h, 7d, or all forecast data)
- **Price Statistics**: Real-time calculation of minimum, maximum, and average prices
<!-- - **Cheap Hours Counter**: Automatically identifies and counts hours below your price threshold -->
- **Mobile Responsive Design**: Optimized for both desktop and mobile viewing
- **Automatic Data Updates**: Dashboard rebuilds automatically when new energy data is published
- **Secure Data Handling**: Fetches and decrypts encrypted data from the Energy Data Hub

## Live Dashboard

The dashboard automatically displays data from:
- [Energy Price Forecast](https://ducroq.github.io/energydatahub/energy_price_forecast.json) (encrypted)

## Architecture

This project consists of two main components:

1. **Data Collection** ([Energy Data Hub](https://github.com/ducroq/energydatahub)): Collects and publishes encrypted energy data
2. **Data Visualization** (this project): Fetches, decrypts, and visualizes the data in an interactive web interface

### Technology Stack

- **Frontend**: Hugo static site generator
- **Charts**: Plotly.js for interactive visualizations
- **Styling**: Custom CSS with glassmorphism design
- **Deployment**: Netlify with automatic deployments
- **Security**: AES-CBC encryption with HMAC-SHA256 verification
- **Build Process**: Python-based decryption during Netlify build

## Quick Deploy

### Option 1: Deploy to Netlify (Recommended)

1. **Fork or Clone this repository**
   ```bash
   git clone https://github.com/yourusername/energy-dashboard.git
   cd energy-dashboard
   ```

2. **Connect to Netlify**
   - Go to [Netlify](https://netlify.com) and sign up/login
   - Click "New site from Git"
   - Connect your GitHub account and select this repository
   - Netlify will automatically detect the `netlify.toml` configuration

3. **Configure Environment Variables**
   In your Netlify dashboard, go to Site settings → Environment variables and add:
   - `ENCRYPTION_KEY_B64`: Your base64-encoded encryption key
   - `HMAC_KEY_B64`: Your base64-encoded HMAC key
   
   *(These are the same keys used in your Energy Data Hub project)*

4. **Set Custom Domain** (optional)
   - In Netlify dashboard: Site settings → Domain management
   - Add your custom domain (e.g., `energy.yourdomain.com`)

5. **Trigger Build**
   - Netlify will automatically build and deploy your dashboard
   - The build process will fetch and decrypt the latest energy data

### Option 2: Manual Local Development

1. **Prerequisites**
   - [Hugo](https://gohugo.io/getting-started/installing/) (v0.124.0 or later)
   - Python 3.11+ with `cryptography` package
   - Access to encryption keys from Energy Data Hub

2. **Clone and Setup**
   ```bash
   git clone https://github.com/yourusername/energy-dashboard.git
   cd energy-dashboard
   pip install cryptography
   ```

3. **Set Environment Variables**
   ```bash
   export ENCRYPTION_KEY_B64="your_base64_encryption_key"
   export HMAC_KEY_B64="your_base64_hmac_key"
   ```

   or on Windows Power Shell
   ```bash
   $env:ENCRYPTION_KEY_B64 = "your_base64_encryption_key"
   $env:HMAC_KEY_B64 = "your_base64_hmac_key"
   ```

4. **Fetch and Decrypt Data**
   ```bash
   python decrypt_data.py
   ```

5. **Run Hugo Development Server**
   ```bash
   hugo server -D
   ```

6. **View Dashboard**
   Open http://localhost:1313 in your browser

## Automatic Updates

### Setting up Build Hooks

To automatically rebuild the dashboard when new energy data is published:

1. **Get Netlify Build Hook URL**
   - In your Netlify dashboard: Site settings → Build & deploy → Build hooks
   - Create a new build hook named "Energy Data Update"
   - Copy the webhook URL

2. **Add to Energy Data Hub Workflow**
   In your Energy Data Hub repository, add this step to `.github/workflows/collect-and-publish.yml`:
   ```yaml
   - name: Trigger dashboard rebuild
     run: |
       curl -X POST -d {} https://api.netlify.com/build_hooks/YOUR_BUILD_HOOK_ID
     continue-on-error: true
   ```

3. **Add Build Hook Secret**
   In your Energy Data Hub repository settings, add:
   - `NETLIFY_BUILD_HOOK`: The complete webhook URL from step 1

Now your dashboard will automatically update whenever new energy data is collected!

## Configuration

### Customizing the Dashboard

**Price Thresholds**: Modify the default price threshold in `static/js/chart.js`:
```javascript
this.priceThreshold = 50; // Change default threshold (EUR/MWh)
```

**Time Ranges**: Add or modify time ranges in the JavaScript:
```javascript
const cutoffs = {
    '24h': new Date(now.getTime() + 24 * 60 * 60 * 1000),
    '48h': new Date(now.getTime() + 48 * 60 * 60 * 1000),
    // Add custom ranges here
};
```

**Styling**: Customize colors and design in `static/css/style.css`

**Site Information**: Update site details in `hugo.toml`:
```toml
baseURL = 'https://energy.yourdomain.com'
title = 'Your Energy Dashboard Title'
[params]
  description = "Your dashboard description"
  author = "Your Name"
```

## Security

- **Encrypted Data Transit**: All energy data is encrypted using AES-CBC with 256-bit keys
- **Data Integrity**: HMAC-SHA256 signatures ensure data hasn't been tampered with
- **Environment Variables**: Encryption keys are stored as secure environment variables
- **No Data Storage**: Dashboard doesn't store sensitive data, only processes it during build

## Data Sources

The dashboard displays data collected from:
- ENTSO-E (European Network of Transmission System Operators)
- Energy Zero (Dutch energy price provider)
- EPEX SPOT (European Power Exchange)
- Nord Pool Elspot (Nordic power exchange)

*Data collection is handled by the [Energy Data Hub](https://github.com/ducroq/energydatahub) project*

## Troubleshooting

### Common Issues

**Build fails with decryption error**:
- Verify `ENCRYPTION_KEY_B64` and `HMAC_KEY_B64` are correctly set in Netlify
- Ensure keys match those used in Energy Data Hub
- Check that keys are base64-encoded

**No data displayed on dashboard**:
- Check browser console for JavaScript errors
- Verify data file exists at `/data/energy_price_forecast.json`
- Ensure Energy Data Hub is publishing data correctly

**Dashboard not updating**:
- Verify build hook is configured correctly
- Check Netlify deploy logs for errors
- Manually trigger a rebuild to test

### Debug Build Process

To see detailed build logs:
1. Go to Netlify dashboard → Deploys
2. Click on the latest deploy
3. View the deploy log for detailed information

## Contributing

Contributions are welcome! Areas for improvement:

- Additional data visualizations (weather integration, demand forecasting)
- Mobile app version
- Historical data analysis features
- Energy optimization recommendations
- Multi-language support

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test locally
4. Submit a pull request

## Related Projects

- [Energy Data Hub](https://github.com/ducroq/energydatahub) - Data collection and encryption backend
- [Hugo](https://gohugo.io/) - Static site generator
- [Plotly.js](https://plotly.com/javascript/) - Interactive charting library

## License

This project is licensed under the MIT License - see the LICENSE file for details.

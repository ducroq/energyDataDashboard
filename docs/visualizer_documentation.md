# Energy Data Visualizer

## Overview

The Energy Data Visualizer is a web-based dashboard that provides real-time visualization of energy price forecasts for the Netherlands. It serves as the presentation layer for the Energy Data Hub project, transforming encrypted energy market data into interactive, educational visualizations.

## Project Architecture

### System Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│  Energy Data    │    │   GitHub Pages   │    │  Energy Data        │
│  Hub (Collector)│───▶│   (Encrypted     │───▶│  Visualizer         │
│                 │    │    Storage)      │    │  (Dashboard)        │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
     Data Collection         Secure Storage           Visualization
```

### Data Flow

1. **Collection**: Energy Data Hub collects price data from multiple sources
2. **Encryption**: Data is encrypted using AES-CBC + HMAC-SHA256
3. **Storage**: Encrypted data published to GitHub Pages endpoints
4. **Visualization**: Dashboard fetches, decrypts, and visualizes data
5. **User Experience**: Interactive charts with educational noise for compliance

## Technical Stack

### Frontend Technologies
- **Static Site Generator**: Hugo (v0.124.0+)
- **Visualization Library**: Plotly.js (v2.26.0)
- **Styling**: Custom CSS with dark theme
- **Deployment Platform**: Netlify

### Backend/Processing
- **Decryption**: Python 3.11+ with cryptography library
- **Data Processing**: JavaScript ES6+ for client-side data manipulation
- **Build Process**: Automated via Netlify with environment variables

### Security & Compliance
- **Encryption**: AES-CBC with 256-bit keys
- **Data Integrity**: HMAC-SHA256 signatures
- **Legal Compliance**: 5% noise added for educational purposes
- **Environment Variables**: Secure key storage via Netlify

## Repository Structure

```
energy-dashboard/
├── netlify.toml                 # Netlify build configuration
├── hugo.toml                    # Hugo site configuration
├── decrypt_data.py              # Data decryption script
├── utils/
│   ├── secure_data_handler.py   # Encryption/decryption utilities
│   └── helpers.py               # Configuration helpers
├── layouts/
│   ├── _default/
│   │   └── baseof.html         # Base HTML template
│   └── index.html              # Main dashboard layout
├── static/
│   ├── css/
│   │   └── style.css           # Dark theme styling
│   ├── js/
│   │   └── chart.js            # Interactive visualization logic
│   └── data/                   # Decrypted data storage (build-time)
├── content/
│   └── _index.md               # Site content
└── README.md                   # Project documentation
```

## Data Sources Integration

### Supported Energy Markets
1. **ENTSO-E** (European TSO platform)
   - Units: EUR/MWh
   - Coverage: Netherlands day-ahead prices
   - Update Frequency: Daily

2. **EnergyZero** (Dutch energy provider)
   - Units: EUR/kWh (converted to EUR/MWh)
   - Coverage: Consumer energy prices
   - Update Frequency: Daily

3. **EPEX SPOT** (European power exchange)
   - Units: EUR/MWh
   - Coverage: Spot market prices
   - Update Frequency: Daily

4. **Nord Pool Elspot** (Nordic power market)
   - Units: EUR/MWh
   - Coverage: Day-ahead electricity prices
   - Update Frequency: Daily

### Data Processing Pipeline

```python
# 1. Fetch encrypted data from GitHub Pages
encrypted_data = fetch_from_github_pages()

# 2. Decrypt using secure handler
decrypted_data = handler.decrypt_and_verify(encrypted_data)

# 3. Normalize units and timestamps
normalized_data = process_energy_data(decrypted_data)

# 4. Add educational noise for compliance
noisy_data = add_noise(normalized_data, noise_percent=0.05)

# 5. Render interactive visualization
render_charts(noisy_data)
```

## Features & Functionality

### Interactive Visualization
- **Multi-source comparison**: All four energy markets on single chart
- **Time series analysis**: Hourly price forecasts up to 48 hours
- **Price threshold highlighting**: Visual indicators for cheap/expensive periods
- **Responsive design**: Mobile and desktop optimized
- **Dark theme**: Professional appearance with high contrast

### Educational Features
- **Price statistics**: Min, max, average calculations
- **Cheap hours counter**: Hours below user-defined threshold
- **Market correlation**: Visual comparison of different energy sources
- **Trend analysis**: Pattern recognition for energy optimization

### User Controls
- **Price threshold slider**: Customizable cheap/expensive price levels
- **Interactive zoom/pan**: Detailed examination of specific time periods
- **Hover details**: Precise price information on mouse hover
- **Legend management**: Show/hide individual data sources

## Deployment & Configuration

### Environment Variables (Netlify)
```bash
ENCRYPTION_KEY_B64=<base64-encoded-256-bit-key>
HMAC_KEY_B64=<base64-encoded-256-bit-key>
```

### Build Process
```toml
[build]
  command = """
    pip install cryptography &&
    mkdir -p data &&
    python decrypt_data.py &&
    hugo --minify
  """
  publish = "public"
```

### Automatic Updates
```yaml
# Data Hub triggers dashboard rebuild via webhook
- name: Trigger dashboard rebuild
  run: |
    curl -X POST -d {} ${{ secrets.NETLIFY_BUILD_HOOK }}
```

## Data Security & Compliance

### Encryption Implementation
- **Algorithm**: AES-CBC with 256-bit keys
- **Integrity**: HMAC-SHA256 signatures
- **Key Management**: Environment variables, base64 encoded
- **Transport**: HTTPS for all data transfers

### Legal Compliance Features
- **Data Modification**: 5% random noise added to all price values
- **Educational Purpose**: Clear disclaimers about data modification
- **No Exact Republication**: Protects original data source licenses
- **Trend Preservation**: Noise maintains market pattern visibility

### Privacy Considerations
- **No User Tracking**: No analytics or user data collection
- **Static Deployment**: No server-side processing or data storage
- **Client-side Processing**: All computations in user's browser

## Performance Optimization

### Build Optimization
- **Hugo Minification**: Compressed HTML, CSS, and JavaScript
- **Static Assets**: Pre-built charts for fast loading
- **CDN Delivery**: Netlify global content distribution
- **Efficient Caching**: Smart cache headers for data files

### Runtime Performance
- **Lightweight Libraries**: Minimal JavaScript dependencies
- **Efficient Data Processing**: Optimized algorithms for large datasets
- **Responsive Rendering**: Smooth interaction even with multiple data sources
- **Progressive Enhancement**: Graceful fallbacks for older browsers

## API Integration

### Data Source Endpoints
```javascript
// GitHub Pages encrypted data endpoints
const ENDPOINTS = {
  energy_prices: 'https://ducroq.github.io/energydatahub/energy_price_forecast.json',
  weather: 'https://ducroq.github.io/energydatahub/weather_forecast.json',
  solar: 'https://ducroq.github.io/energydatahub/sun_forecast.json',
  air_quality: 'https://ducroq.github.io/energydatahub/air_quality.json'
};
```

### Data Format
```json
{
  "version": "2.0",
  "entsoe": {
    "metadata": {
      "data_type": "energy_price",
      "source": "ENTSO-E Transparency Platform API v1.3",
      "country_code": "NL",
      "units": "EUR/MWh",
      "start_time": "2025-06-29T16:16:07.628000+00:00",
      "end_time": "2025-06-30T16:16:07.628000+00:00"
    },
    "data": {
      "2025-06-29T19:00:00+02:00": 102.14,
      "2025-06-29T20:00:00+02:00": 111.98
    }
  }
}
```

## Development Workflow

### Local Development Setup
```bash
# 1. Clone repository
git clone https://github.com/username/energy-dashboard.git
cd energy-dashboard

# 2. Set environment variables
export ENCRYPTION_KEY_B64="your_base64_key"
export HMAC_KEY_B64="your_base64_hmac_key"

# 3. Install dependencies
pip install cryptography

# 4. Decrypt data
python decrypt_data.py

# 5. Start Hugo development server
hugo server -D
```

### Code Organization
- **Separation of Concerns**: Clear division between data, presentation, and logic
- **Modular Architecture**: Independent components for easy maintenance
- **Configuration Management**: Environment-based settings
- **Error Handling**: Graceful degradation for missing or invalid data

### Testing Strategy
- **Data Validation**: Verify decryption and data integrity
- **Cross-browser Testing**: Ensure compatibility across browsers
- **Responsive Testing**: Mobile and desktop layout verification
- **Performance Testing**: Chart rendering with large datasets

## Monitoring & Analytics

### Build Monitoring
- **Netlify Deploy Status**: Automatic build success/failure notifications
- **GitHub Actions Integration**: Workflow status tracking
- **Error Logging**: Build-time error capture and reporting

### Usage Insights
- **Netlify Analytics**: Basic traffic and performance metrics
- **Build Minutes Tracking**: Resource usage monitoring
- **Performance Metrics**: Page load time optimization

## Troubleshooting Guide

### Common Issues

#### Data Not Loading
```javascript
// Check browser console for errors
console.log('Energy data:', this.energyData);

// Verify decryption keys
echo $ENCRYPTION_KEY_B64 | base64 -d | wc -c  # Should be 32 bytes
```

#### Build Failures
```bash
# Check Python dependencies
pip list | grep cryptography

# Verify data file exists
ls -la static/data/energy_price_forecast.json

# Test decryption locally
python decrypt_data.py
```

#### Chart Rendering Issues
```javascript
// Debug trace creation
console.log('Traces count:', traces.length);
console.log('Data points per trace:', traces.map(t => t.x.length));
```

### Error Handling
- **Graceful Degradation**: Dashboard functions with partial data
- **User Feedback**: Clear error messages for data loading issues
- **Fallback Mechanisms**: Cached data when fresh data unavailable

## Future Enhancements

### Planned Features
- **Historical Data Analysis**: Long-term trend visualization
- **Price Prediction Models**: Machine learning integration
- **Multi-country Support**: European energy market expansion
- **Real-time Updates**: WebSocket integration for live data
- **Mobile App**: React Native companion application

### Technical Improvements
- **Progressive Web App**: Offline capability and app-like experience
- **Advanced Analytics**: Statistical analysis and correlation metrics
- **Data Export**: CSV/JSON download functionality
- **Customizable Dashboards**: User-configurable chart layouts

### Integration Opportunities
- **Smart Home Systems**: API for home automation
- **Energy Trading Platforms**: Integration with trading algorithms
- **Academic Research**: Data provision for energy studies
- **Policy Analysis**: Government and regulatory insights

## Contributing Guidelines

### Development Standards
- **Code Quality**: ESLint configuration for JavaScript
- **Documentation**: Comprehensive inline comments
- **Testing**: Unit tests for critical functions
- **Security**: Regular dependency updates and security audits

### Contribution Process
1. **Fork Repository**: Create personal fork for development
2. **Feature Branch**: Develop features in isolated branches
3. **Pull Request**: Submit changes with detailed descriptions
4. **Code Review**: Collaborative review process
5. **Testing**: Ensure all tests pass before merge

## License & Usage

### Open Source License
- **License Type**: MIT License
- **Commercial Use**: Permitted with attribution
- **Modification**: Allowed with license retention
- **Distribution**: Free redistribution permitted

### Data Usage Terms
- **Educational Purpose**: Dashboard intended for learning and research
- **No Trading Advice**: Data modified and not suitable for financial decisions
- **Attribution Required**: Credit to original data sources
- **Compliance**: Respects energy market data licensing terms

## Support & Contact

### Documentation Resources
- **README**: Basic setup and usage instructions
- **API Documentation**: Detailed technical specifications
- **Troubleshooting Guide**: Common issues and solutions
- **Community Wiki**: User-contributed documentation

### Getting Help
- **GitHub Issues**: Bug reports and feature requests
- **Discussions**: Community support and Q&A
- **Email Support**: Direct contact for urgent issues
- **Documentation Updates**: Continuous improvement process


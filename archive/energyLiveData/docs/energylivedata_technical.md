# energyLiveData - Technical Implementation Guide

## System Architecture

### Component Overview
```
┌─────────────────────────────────────────────────────────────┐
│                    energyLiveData System                    │
├─────────────────────────────────────────────────────────────┤
│  Data Collection Layer                                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐│
│  │ Energy APIs │ │ Weather APIs│ │ Environmental APIs      ││
│  │ • ENTSO-E   │ │ • OpenWeath │ │ • Luchtmeetnet         ││
│  │ • TenneT    │ │ • MeteoSrvr │ │ • Air Quality          ││
│  │ • EnergyZero│ │ • Solar     │ │ • Grid Monitoring      ││
│  └─────────────┘ └─────────────┘ └─────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  Processing Layer                                           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ • Data Validation & Quality Control                     ││
│  │ • Multi-source Integration & Correlation               ││
│  │ • Market Analysis (Price Gaps, Transmission)           ││
│  │ • Rolling Window Management                             ││
│  │ • Forecast Comparison Engine                            ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  Storage Layer                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ • Encrypted JSON Storage (GitHub Pages)                ││
│  │ • Rolling 24-48h Data Windows                           ││
│  │ • Market Analysis Results                               ││
│  │ • Quality Metrics & Monitoring Data                     ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Data Sources & API Integration

### Energy Market APIs

#### ENTSO-E Transparency Platform
```python
# Actual energy market data
ENTSOE_ENDPOINTS = {
    'actual_load': {
        'documentType': 'A65',
        'processType': 'A16',
        'area': '10YNL----------L'
    },
    'actual_generation': {
        'documentType': 'A75',
        'processType': 'A16', 
        'area': '10YNL----------L'
    },
    'actual_prices': {
        'documentType': 'A44',
        'area': '10YNL----------L'
    }
}
```

#### TenneT TSO Data
```python
# Grid balancing and imbalance data
TENNET_ENDPOINTS = {
    'imbalance_prices': 'https://www.tennet.org/english/operational_management/export_data.aspx',
    'system_imbalance': 'https://www.tennet.org/english/operational_management/export_data.aspx',
    'cross_border_flows': 'https://www.tennet.org/english/operational_management/export_data.aspx'
}
```

#### Energy Zero Consumer API
```python
# Energy Zero pricing integration
from energyzero import EnergyZero

class EnergyZeroCollector:
    def __init__(self):
        self.energyzero = EnergyZero()
        
    async def collect_consumer_data(self):
        """Collect current and forecast pricing data from Energy Zero"""
        today = datetime.now().date()
        tomorrow = today + timedelta(days=1)
        
        try:
            # Get current energy prices
            current_gas_price = await self.energyzero.gas_prices(today, today)
            current_energy_prices = await self.energyzero.energy_prices(today, today)
            
            # Get tomorrow's prices if available
            tomorrow_energy_prices = None
            try:
                tomorrow_energy_prices = await self.energyzero.energy_prices(tomorrow, tomorrow)
            except Exception:
                # Tomorrow's prices might not be available yet
                pass
                
            return {
                'current_energy_prices': current_energy_prices,
                'current_gas_prices': current_gas_price,
                'tomorrow_energy_prices': tomorrow_energy_prices,
                'collection_timestamp': datetime.now(timezone.utc)
            }
        except Exception as e:
            logger.error(f"Energy Zero collection failed: {e}")
            return None
            
    def extract_current_pricing(self, energy_zero_data):
        """Extract current hour pricing from Energy Zero data"""
        if not energy_zero_data or not energy_zero_data.get('current_energy_prices'):
            return None
            
        current_hour = datetime.now().replace(minute=0, second=0, microsecond=0)
        
        # Find current hour price in Energy Zero data
        for price_point in energy_zero_data['current_energy_prices']:
            if price_point.datetime.replace(tzinfo=None) == current_hour:
                return {
                    'consumer_price_total': price_point.price_incl_tax * 1000,  # Convert €/kWh to €/MWh
                    'consumer_price_energy': price_point.price_excl_tax * 1000,  # Convert €/kWh to €/MWh
                    'timestamp': price_point.datetime,
                    'source': 'energyzero'
                }
        
        return None
```

### Environmental APIs

#### Weather Data Sources
```python
WEATHER_APIS = {
    'openweather': {
        'current': 'https://api.openweathermap.org/data/2.5/weather',
        'forecast': 'https://api.openweathermap.org/data/2.5/forecast'
    },
    'meteoserver': {
        'current': 'https://data.meteoserver.nl/api/actueel.php',
        'forecast': 'https://data.meteoserver.nl/api/uurverwachting.php'
    }
}
```

#### Air Quality Integration
```python
AIR_QUALITY_CONFIG = {
    'luchtmeetnet': {
        'stations': 'https://api.luchtmeetnet.nl/open_api/stations',
        'measurements': 'https://api.luchtmeetnet.nl/open_api/measurements'
    }
}
```

## Data Models & Structures

### Core Data Model
```python
@dataclass
class LiveEnergySnapshot:
    timestamp: datetime
    
    # Wholesale Market Data
    wholesale_price: float          # EUR/MWh (ENTSO-E)
    actual_load: float              # MW
    renewable_share: float          # %
    imbalance_price: float          # EUR/MWh (TenneT)
    system_imbalance: float         # MW
    cross_border_flow: float        # MW
    
    # Consumer Market Data (Energy Zero)
    consumer_price_total: float     # EUR/MWh (including all taxes)
    consumer_price_energy: float    # EUR/MWh (energy component only)
    gas_price: float               # EUR/m³ (Energy Zero gas pricing)
    
    # Derived Consumer Metrics
    network_costs: float            # EUR/MWh (estimated from price difference)
    taxes_and_fees: float          # EUR/MWh (estimated from price difference)
    
    # Weather Data
    temperature: float              # °C
    wind_speed: float              # m/s
    wind_direction: float          # degrees
    solar_irradiance: float        # W/m²
    cloud_cover: float             # %
    precipitation: float           # mm/h
    
    # Air Quality Data
    aqi: float                     # Air Quality Index
    pm25: float                    # μg/m³
    pm10: float                    # μg/m³
    no2: float                     # μg/m³
    o3: float                      # μg/m³
    
    # Calculated Metrics
    price_gap: float               # Consumer - Wholesale
    price_gap_percentage: float    # (Consumer/Wholesale - 1) * 100
    tax_burden_percentage: float   # Taxes/Total * 100
    
    # Quality Indicators
    data_quality: Dict[str, float] # Quality score per source
    source_availability: Dict[str, bool]
    collection_timestamp: datetime
    
    def validate_data(self) -> bool:
        """Validate data integrity and ranges"""
        
    def calculate_derived_metrics(self):
        """Calculate price gaps and correlations from Energy Zero data"""
        if self.consumer_price_total and self.consumer_price_energy:
            # Calculate derived costs from Energy Zero pricing structure
            self.taxes_and_fees = self.consumer_price_total - self.consumer_price_energy
            self.network_costs = self.taxes_and_fees * 0.6  # Estimated network portion
            self.taxes_and_fees = self.taxes_and_fees * 0.4  # Estimated tax portion
            
        if self.wholesale_price and self.consumer_price_total:
            self.price_gap = self.consumer_price_total - self.wholesale_price
            self.price_gap_percentage = (self.consumer_price_total / self.wholesale_price - 1) * 100
            
        if self.consumer_price_total and self.taxes_and_fees:
            self.tax_burden_percentage = (self.taxes_and_fees / self.consumer_price_total) * 100
        
    def to_dict(self) -> dict:
        """Convert to JSON-serializable format"""
```

### Market Analysis Models
```python
@dataclass
class MarketAnalysis:
    analysis_timestamp: datetime
    analysis_period_hours: int
    
    # Price Transmission Analysis
    price_transmission_speed: float    # Hours for wholesale→consumer
    transmission_efficiency: float     # % of wholesale change reflected
    price_volatility_wholesale: float  # Standard deviation
    price_volatility_consumer: float   # Standard deviation
    
    # Energy Zero Market Structure Analysis
    average_price_gap: float           # Mean wholesale→consumer gap
    tax_burden_trend: float           # Change in tax percentage
    network_cost_trend: float        # Change in network costs
    gas_price_correlation: float      # Gas vs electricity price correlation
    
    # Forecast Validation
    wholesale_forecast_mape: float    # Mean Absolute Percentage Error
    consumer_forecast_mape: float     # MAPE for consumer prices
    weather_forecast_mape: float      # Weather prediction accuracy
    
    # Correlation Analysis
    weather_price_correlation: float  # Weather→price correlation
    load_price_correlation: float     # Load→price correlation
    renewable_price_correlation: float # Renewable→price correlation
```

## Collection Architecture

### GitHub Actions Workflow
```yaml
name: energyLiveData Collection

on:
  schedule:
    - cron: '*/15 * * * *'  # Every 15 minutes
    - cron: '0 */6 * * *'   # Every 6 hours (cleanup)
  workflow_dispatch:

jobs:
  collect-live-data:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    
    steps:
    - name: Checkout repository
      uses: actions/checkout@v4
      
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
        
    - name: Install dependencies
      run: |
        pip install -r requirements.txt
        pip install python-energyzero
        
    - name: Collect multi-source data
      env:
        ENTSOE_API_KEY: ${{ secrets.ENTSOE_API_KEY }}
        TENNET_API_KEY: ${{ secrets.TENNET_API_KEY }}
        OPENWEATHER_API_KEY: ${{ secrets.OPENWEATHER_API_KEY }}
        METEO_API_KEY: ${{ secrets.METEO_API_KEY }}
        ENCRYPTION_KEY_B64: ${{ secrets.ENCRYPTION_KEY_B64 }}
        HMAC_KEY_B64: ${{ secrets.HMAC_KEY_B64 }}
      run: python src/live_data_collector.py
      
    - name: Run market analysis
      run: python src/market_analyzer.py
      
    - name: Update rolling windows
      run: python src/data_manager.py --cleanup
      
    - name: Commit and push results
      run: |
        git config --global user.email "energylivedata@github.com"
        git config --global user.name "energyLiveData Bot"
        git add data/live/
        git diff --staged --quiet || git commit -m "Update live data $(date -u +%Y%m%d-%H%M%S)"
        git push
        
    - name: Trigger dashboard rebuild
      run: |
        curl -X POST -d {} ${{ secrets.DASHBOARD_BUILD_HOOK }}
      continue-on-error: true
      
    - name: Health check notification
      if: failure()
      run: |
        echo "Collection failed at $(date)" >> monitoring/collection_failures.log
```

### Data Collection Implementation
```python
# src/live_data_collector.py
import asyncio
import aiohttp
from typing import Dict, List, Optional
from dataclasses import asdict
from energyzero import EnergyZero

class LiveDataCollector:
    def __init__(self):
        self.collectors = {
            'energy_wholesale': ENTSOECollector(),
            'energy_consumer': EnergyZeroCollector(),
            'grid': TennetCollector(),
            'weather': WeatherCollector(),
            'air_quality': AirQualityCollector()
        }
        self.encryption_handler = SecureDataHandler()
        
    async def collect_all_sources(self) -> LiveEnergySnapshot:
        """Collect data from all sources concurrently"""
        tasks = {
            name: collector.collect_data() 
            for name, collector in self.collectors.items()
        }
        
        results = await asyncio.gather(
            *tasks.values(), 
            return_exceptions=True
        )
        
        # Combine results into unified snapshot
        snapshot_data = self.combine_results(
            dict(zip(tasks.keys(), results))
        )
        
        snapshot = LiveEnergySnapshot(**snapshot_data)
        snapshot.calculate_derived_metrics()
        
        return snapshot
        
    def combine_results(self, results: Dict) -> Dict:
        """Combine multi-source results into unified format"""
        combined = {
            'timestamp': datetime.now(timezone.utc),
            'collection_timestamp': datetime.now(timezone.utc)
        }
        
        # Process each data source
        for source, data in results.items():
            if isinstance(data, Exception):
                logger.error(f"Collection failed for {source}: {data}")
                continue
                
            combined.update(self.extract_fields(source, data))
            
        return combined
        
    def extract_fields(self, source: str, data: Dict) -> Dict:
        """Extract relevant fields from each data source"""
        extracted = {}
        
        if source == 'energy_consumer' and data:
            # Energy Zero specific extraction
            current_pricing = self.collectors['energy_consumer'].extract_current_pricing(data)
            if current_pricing:
                extracted.update(current_pricing)
                
            # Add gas pricing if available
            if data.get('current_gas_prices'):
                # Get current hour gas price
                current_hour = datetime.now().replace(minute=0, second=0, microsecond=0)
                for gas_price in data['current_gas_prices']:
                    if gas_price.datetime.replace(tzinfo=None) == current_hour:
                        extracted['gas_price'] = gas_price.price
                        break
                        
        elif source == 'energy_wholesale' and data:
            # ENTSO-E data extraction
            extracted.update({
                'wholesale_price': data.get('price'),
                'actual_load': data.get('load'),
                'renewable_share': data.get('renewable_percentage')
            })
            
        # ... other source extractions
        
        return extracted
        
    async def store_snapshot(self, snapshot: LiveEnergySnapshot):
        """Store encrypted snapshot and update rolling windows"""
        # Encrypt snapshot
        encrypted_data = self.encryption_handler.encrypt_and_sign(
            asdict(snapshot)
        )
        
        # Store current snapshot
        await self.store_file(
            'data/live/current_snapshot.json',
            encrypted_data
        )
        
        # Update rolling window
        await self.update_rolling_window(snapshot)
        
        # Update market analysis
        await self.update_market_analysis(snapshot)
```

## Energy Zero Integration Details

### API Connection Management
```python
class EnergyZeroCollector:
    def __init__(self):
        self.energyzero = EnergyZero()
        self.session = None
        
    async def ensure_session(self):
        """Ensure aiohttp session is available"""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession()
            
    async def collect_data(self):
        """Main collection method with error handling"""
        try:
            await self.ensure_session()
            
            # Collect current data
            consumer_data = await self.collect_consumer_data()
            
            # Collect forecast data if available
            forecast_data = await self.collect_forecast_data()
            
            return {
                'consumer_pricing': consumer_data,
                'forecast_pricing': forecast_data,
                'collection_success': True,
                'collection_timestamp': datetime.now(timezone.utc)
            }
            
        except Exception as e:
            logger.error(f"Energy Zero collection failed: {e}")
            return {
                'consumer_pricing': None,
                'forecast_pricing': None,
                'collection_success': False,
                'error': str(e),
                'collection_timestamp': datetime.now(timezone.utc)
            }
    
    async def collect_forecast_data(self):
        """Collect tomorrow's pricing if available"""
        tomorrow = datetime.now().date() + timedelta(days=1)
        
        try:
            tomorrow_prices = await self.energyzero.energy_prices(tomorrow, tomorrow)
            return {
                'tomorrow_energy_prices': tomorrow_prices,
                'forecast_available': True
            }
        except Exception as e:
            logger.info(f"Tomorrow's prices not yet available: {e}")
            return {
                'tomorrow_energy_prices': None,
                'forecast_available': False
            }
    
    async def close(self):
        """Clean up session"""
        if self.session and not self.session.closed:
            await self.session.close()
```

### Price Validation & Quality Control
```python
class EnergyZeroPriceValidator:
    def __init__(self):
        self.reasonable_ranges = {
            'consumer_price_total': (0, 2000),    # EUR/MWh
            'consumer_price_energy': (0, 1500),   # EUR/MWh  
            'gas_price': (0, 5),                  # EUR/m³
        }
        
    def validate_energy_zero_data(self, pricing_data) -> Dict[str, bool]:
        """Validate Energy Zero pricing data"""
        validations = {}
        
        if pricing_data and pricing_data.get('consumer_price_total'):
            price_total = pricing_data['consumer_price_total']
            price_energy = pricing_data.get('consumer_price_energy', 0)
            
            # Range validation
            validations['price_total_range'] = self.validate_range(
                'consumer_price_total', price_total
            )
            validations['price_energy_range'] = self.validate_range(
                'consumer_price_energy', price_energy
            )
            
            # Logical validation
            validations['price_logic'] = price_total >= price_energy
            
            # Reasonableness check (taxes/fees should be 20-80% of total)
            if price_total > 0 and price_energy > 0:
                tax_percentage = ((price_total - price_energy) / price_total) * 100
                validations['tax_percentage_reasonable'] = 20 <= tax_percentage <= 80
            else:
                validations['tax_percentage_reasonable'] = False
                
        return validations
        
    def validate_range(self, field: str, value: float) -> bool:
        """Validate value is within reasonable range"""
        if field in self.reasonable_ranges:
            min_val, max_val = self.reasonable_ranges[field]
            return min_val <= value <= max_val
        return True
```

## Performance Optimization

### Concurrent Collection with Energy Zero
```python
async def collect_with_timeout(self, collector, timeout_seconds: int = 30):
    """Collect data with timeout protection - optimized for Energy Zero"""
    try:
        return await asyncio.wait_for(
            collector.collect_data(), 
            timeout=timeout_seconds
        )
    except asyncio.TimeoutError:
        logger.warning(f"Collection timeout for {collector.__class__.__name__}")
        return None
    except Exception as e:
        logger.error(f"Collection error for {collector.__class__.__name__}: {e}")
        return None
    finally:
        # Ensure Energy Zero session cleanup
        if hasattr(collector, 'close'):
            await collector.close()
```

### Caching Strategy for Energy Zero
```python
class EnergyZeroCache:
    def __init__(self):
        self.cache = {}
        self.cache_duration = timedelta(minutes=10)  # Energy Zero updates hourly
        
    async def get_cached_or_fetch(self, date_key: str, fetch_func):
        """Get cached Energy Zero data or fetch if expired"""
        if date_key in self.cache:
            cached_data, timestamp = self.cache[date_key]
            if datetime.now() - timestamp < self.cache_duration:
                return cached_data
                
        # Fetch new data
        fresh_data = await fetch_func()
        self.cache[date_key] = (fresh_data, datetime.now())
        return fresh_data
        
    def clear_old_cache(self):
        """Remove expired cache entries"""
        now = datetime.now()
        expired_keys = [
            key for key, (_, timestamp) in self.cache.items()
            if now - timestamp > self.cache_duration
        ]
        for key in expired_keys:
            del self.cache[key]
```

## Dependencies Update

### requirements.txt
```txt
# Core dependencies
asyncio==3.4.3
aiohttp==3.8.5
python-dateutil==2.8.2
pytz==2023.3
pydantic==2.4.2

# Energy APIs
python-energyzero==0.7.1
entsoe-py==0.5.10

# Weather APIs  
pyowm==3.3.0
requests==2.31.0

# Data processing
pandas==2.1.1
numpy==1.24.3

# Encryption
cryptography==41.0.4

# Logging and monitoring
structlog==23.1.0
```

### Installation Notes
```bash
# Install Energy Zero library
pip install python-energyzero

# Note: Energy Zero requires no authentication
# This simplifies the setup compared to Frank Energie
```

---

*This updated technical implementation guide provides comprehensive instructions for building energyLiveData with Energy Zero integration, maintaining the same powerful market analysis capabilities while simplifying the consumer data collection process.*
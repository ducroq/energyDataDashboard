# EnergyZero vs Frank Energie API Comparison
## Live Energy Data for the Netherlands

This document compares the APIs of two major Dutch energy providers for retrieving live energy price data: EnergyZero and Frank Energie.

---

## 📊 Quick Comparison

| Feature | EnergyZero | Frank Energie |
|---------|------------|---------------|
| **API Type** | REST | GraphQL |
| **Authentication** | ❌ None required | ⚠️ Required for advanced features |
| **Price Updates** | Every 10 minutes | Real-time |
| **Home Assistant** | ✅ Official integration | ⚠️ Community integration |
| **Documentation** | ✅ Excellent | ⚠️ Limited |
| **Market Coverage** | Multiple providers | Direct wholesale |
| **Smart Features** | Basic automation | Advanced trading |

---

## 🔌 EnergyZero API

### Overview
EnergyZero provides a simple, public API that serves multiple energy providers including ANWB Energie and Energie van Ons. It's designed for transparency and ease of use.

### 🎯 Strengths

#### **No Authentication Required**
- Completely public API at `https://api.energyzero.nl/v1/energyprices`
- No API keys, tokens, or registration needed
- Instant access for developers

#### **Excellent Integration Support**
- Native Home Assistant integration since 2023.2
- Used by 1,409+ active installations
- Well-maintained Python library: [`python-energyzero`](https://github.com/klaasnicolaas/python-energyzero)

#### **Reliable Data Updates**
- Updates every 10 minutes automatically
- New prices published daily around 14:00 UTC for next day
- Consistent availability and uptime

#### **Comprehensive Data**
- Hourly electricity prices
- Daily gas prices  
- Price statistics (min, max, average)
- Percentage comparisons
- Time-based price analysis

### 🔧 Technical Details

#### **API Endpoints**
```http
GET https://api.energyzero.nl/v1/energyprices
```

#### **Parameters**
- `fromDate` - Start date (ISO 8601)
- `tillDate` - End date (ISO 8601) 
- `interval` - Data interval (4=day, 5=month, 6=year, 9=week)
- `usageType` - Usage type (1=electricity, 2=gas)
- `inclBtw` - Include VAT (true/false)

#### **Python Usage Example**
```python
import asyncio
from datetime import date
from energyzero import EnergyZero, VatOption

async def main():
    async with EnergyZero(vat=VatOption.INCLUDE) as client:
        start_date = date(2024, 12, 7)
        end_date = date(2024, 12, 7)
        
        energy = await client.energy_prices(start_date, end_date)
        gas = await client.gas_prices(start_date, end_date)
        
        print(f"Current electricity price: €{energy.current_hour_price}/kWh")
        print(f"Average daily price: €{energy.average_price}/kWh")

asyncio.run(main())
```

### ⚠️ Limitations

- **Basic Price Data Only**: Prices include VAT but exclude energy tax and purchase costs
- **No Personal Data**: Cannot access individual consumption or billing information
- **Limited Smart Features**: Basic automation capabilities only

---

## ⚡ Frank Energie API

### Overview
Frank Energie offers a more sophisticated API focused on dynamic pricing and smart energy management. It provides direct access to wholesale market prices and advanced energy trading features.

### 🎯 Strengths

#### **Real-Time Market Access**
- Direct wholesale market pricing
- Real-time price updates
- Imbalance market integration

#### **Advanced Smart Features**
- EV charging optimization
- Home battery management
- Solar panel optimization
- Virtual Power Plant (VPP) participation

#### **Comprehensive Pricing**
- Market prices and markup information
- Dynamic tariff calculations
- Price forecasting capabilities

#### **Smart Energy Management**
- Automated energy trading
- Grid balancing services
- AI-powered optimization algorithms

### 🔧 Technical Details

#### **API Endpoint**
```http
POST https://graphcdn.frankenergie.nl
```

#### **GraphQL Query Example**
```graphql
query MarketPrices {
  marketPricesElectricity(startDate: "2024-12-01", endDate: "2024-12-30") {
    till
    from
    marketPrice
    priceIncludingMarkup
  }
  marketPricesGas(startDate: "2024-12-01", endDate: "2024-12-30") {
    from
    till
    marketPrice
    priceIncludingMarkup
  }
}
```

#### **Python Usage Example**
```python
import requests

query = """
query MarketPrices {
  marketPricesElectricity(startDate: "2024-12-01", endDate: "2024-12-30") {
    till
    from
    marketPrice
    priceIncludingMarkup
  }
}
"""

response = requests.post(
    'https://graphcdn.frankenergie.nl',
    json={'query': query}
)

data = response.json()
prices = data['data']['marketPricesElectricity']
```

### ⚠️ Limitations

#### **Authentication Complexity**
- No authentication for basic market prices
- Customer account required for advanced features
- Less straightforward setup process

#### **Documentation Gaps**
- Limited public API documentation
- Smaller community support
- Fewer integration examples

#### **Learning Curve**
- GraphQL complexity vs simple REST
- More complex data structures
- Requires understanding of energy trading concepts

---

## 🏆 Use Case Recommendations

### Choose **EnergyZero** for:

#### **Simple Price Monitoring**
- Basic energy price tracking
- Home automation triggers
- Cost optimization alerts
- Historical price analysis

#### **Home Assistant Integration**
- Plug-and-play setup
- Reliable sensor data
- Dashboard visualizations
- Energy cost calculations

#### **Development Simplicity**
- Quick prototyping
- Educational projects
- No authentication barriers
- Well-documented libraries

#### **Multi-Provider Support**
- ANWB Energie customers
- Energie van Ons users
- Generic price monitoring
- Provider-agnostic solutions

### Choose **Frank Energie** for:

#### **Advanced Energy Management**
- Smart EV charging optimization
- Home battery trading
- Solar panel management
- Grid balancing participation

#### **Real-Time Trading**
- Wholesale market access
- Imbalance market participation
- Dynamic pricing strategies
- Professional energy management

#### **Frank Energie Customers**
- Personal consumption data
- Billing information access
- Account management features
- Integrated smart services

#### **Energy Innovation Projects**
- VPP development
- Grid optimization research
- Energy trading algorithms
- Smart grid applications

---

## 📈 Performance Comparison

### **Data Freshness**
- **EnergyZero**: 10-minute intervals, predictable updates
- **Frank Energie**: Real-time updates, market-driven timing

### **Reliability**
- **EnergyZero**: High uptime, stable service, proven track record
- **Frank Energie**: Good reliability, more complex infrastructure

### **Community Support**
- **EnergyZero**: Large community, active development, extensive documentation
- **Frank Energie**: Smaller community, less documentation, specialized use cases

### **Integration Ecosystem**
- **EnergyZero**: Home Assistant, Node-RED, Domoticz, Homey
- **Frank Energie**: Custom integrations, specialized platforms

---

## 🔗 Resources & Libraries

### EnergyZero
- **Python Library**: [python-energyzero](https://github.com/klaasnicolaas/python-energyzero) by Klaas Nicolaas
- **Home Assistant**: Official integration (built-in)
- **Node-RED**: [Energy Zero Flow](https://flows.nodered.org/flow/9960a5c608fba8bc01c091ad04d805c9)
- **API Documentation**: Available in Home Assistant docs

### Frank Energie
- **Python Library**: [python-frank-energie](https://github.com/HiDiHo01/python-frank-energie) by HiDiHo01
- **Home Assistant**: [Custom Component](https://github.com/bajansen/home-assistant-frank_energie)
- **GraphQL Endpoint**: `https://graphcdn.frankenergie.nl`
- **API Examples**: Limited community documentation

---

## 💡 Final Recommendation

### **For Most Users: Choose EnergyZero**

EnergyZero's API is the clear winner for general-purpose energy price monitoring due to:

- **Zero barriers to entry** - no authentication required
- **Excellent documentation** and community support
- **Proven reliability** with thousands of active users
- **Simple integration** with popular home automation platforms

### **For Advanced Users: Consider Frank Energie**

Frank Energie becomes attractive when you need:

- **Real-time market data** for trading applications
- **Advanced smart energy features** for optimization
- **Direct wholesale access** for professional use
- **Integrated energy management** within their ecosystem

The choice ultimately depends on your specific requirements, technical expertise, and whether you prioritize simplicity (EnergyZero) or advanced features (Frank Energie).
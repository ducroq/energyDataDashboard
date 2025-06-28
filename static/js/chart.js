class EnergyDashboard {
    constructor() {
        this.energyData = null;
        this.currentTimeRange = '24h';
        this.priceThreshold = 50;
        this.init();
    }

    async init() {
        await this.loadEnergyData();
        this.setupEventListeners();
        this.updateChart();
        this.updateInfo();
    }

    async loadEnergyData() {
        try {
            const response = await fetch('/data/energy_price_forecast.json');
            this.energyData = await response.json();
            console.log('Loaded energy data:', this.energyData);
        } catch (error) {
            console.error('Error loading energy data:', error);
            this.energyData = [];
        }
    }

    setupEventListeners() {
        document.getElementById('timeRange').addEventListener('change', (e) => {
            this.currentTimeRange = e.target.value;
            this.updateChart();
        });

        document.getElementById('priceThreshold').addEventListener('input', (e) => {
            this.priceThreshold = parseFloat(e.target.value) || 50;
            this.updateChart();
            this.updateInfo();
        });
    }

    processEnergyDataForChart(timeRange) {
        if (!this.energyData) {
            return [];
        }

        const traces = [];
        const now = new Date();
        const cutoffTime = this.getTimeRangeCutoff(timeRange, now);

        // Process each data source
        const dataSources = [
            { key: 'entsoe', name: 'ENTSO-E', color: '#60a5fa' },
            { key: 'energy_zero', name: 'EnergyZero', color: '#34d399' },
            { key: 'epex', name: 'EPEX', color: '#f59e0b' },
            { key: 'elspot', name: 'Nord Pool', color: '#ef4444' }
        ];

        dataSources.forEach(source => {
            if (this.energyData[source.key] && this.energyData[source.key].data) {
                const sourceData = this.energyData[source.key].data;
                const dataPoints = Object.entries(sourceData).map(([datetime, price]) => ({
                    datetime: datetime,
                    price: price
                }));

                // Filter by time range
                const filteredData = dataPoints.filter(item => {
                    const itemDate = new Date(item.datetime);
                    return itemDate >= cutoffTime;
                });

                if (filteredData.length > 0) {
                    const xValues = filteredData.map(item => item.datetime);
                    const yValues = filteredData.map(item => item.price);

                    traces.push({
                        x: xValues,
                        y: yValues,
                        type: 'scatter',
                        mode: 'lines+markers',
                        name: source.name,
                        line: { 
                            width: 3,
                            color: source.color
                        },
                        marker: { 
                            size: 5,
                            color: source.color
                        },
                        hovertemplate: `<b>${source.name}</b><br>%{x}<br>Price: €%{y:.2f}/MWh<extra></extra>`
                    });
                }
            }
        });

        return traces;
    }    
    getTimeRangeCutoff(timeRange, now) {
        const cutoffs = {
            '24h': new Date(now.getTime() + 24 * 60 * 60 * 1000),
            '48h': new Date(now.getTime() + 48 * 60 * 60 * 1000),
            '7d': new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            'all': new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
        };
        return now; // Start from now, show future data
    }

    updateChart() {
        const traces = this.processEnergyDataForChart(this.currentTimeRange);
        
        // Add threshold line if we have data
        if (traces.length > 0 && traces[0].x.length > 0) {
            traces.push({
                x: traces[0].x,
                y: new Array(traces[0].x.length).fill(this.priceThreshold),
                type: 'scatter',
                mode: 'lines',
                name: 'Threshold',
                line: { 
                    width: 2, 
                    color: '#6b7280', 
                    dash: 'dash' 
                },
                hoverinfo: 'skip'
            });
        }
        
        const layout = {
            title: {
                text: 'Energy Price Forecast - All Providers',
                font: { color: 'white', size: 18 }
            },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0.3)',
            font: { color: 'white' },
            xaxis: {
                title: 'Time',
                gridcolor: 'rgba(255,255,255,0.1)',
                color: 'white',
                tickcolor: 'white'
            },
            yaxis: {
                title: 'Price (EUR/MWh)',
                gridcolor: 'rgba(255,255,255,0.1)',
                color: 'white',
                tickcolor: 'white'
            },
            margin: { l: 60, r: 30, t: 60, b: 60 },
            showlegend: true,
            legend: {
                font: { color: 'white' },
                bgcolor: 'rgba(0,0,0,0.3)',
                bordercolor: 'rgba(255,255,255,0.2)',
                borderwidth: 1
            }
        };

        const config = {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            displaylogo: false
        };

        Plotly.newPlot('energyChart', traces, layout, config);
    }

    updateInfo() {
        if (!this.energyData) return;

        // Collect all data points from all sources
        let allDataPoints = [];
        const dataSources = ['entsoe', 'energy_zero', 'epex', 'elspot'];
        
        dataSources.forEach(sourceKey => {
            if (this.energyData[sourceKey] && this.energyData[sourceKey].data) {
                const sourceData = this.energyData[sourceKey].data;
                Object.entries(sourceData).forEach(([datetime, price]) => {
                    allDataPoints.push({ datetime, price, source: sourceKey });
                });
            }
        });

        if (allDataPoints.length === 0) return;

        // Sort by datetime to get current price
        allDataPoints.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

        // Update last update time
        const lastUpdate = this.energyData.entsoe?.metadata?.start_time || new Date().toISOString();
        document.getElementById('lastUpdate').textContent = 
            `Last updated: ${new Date(lastUpdate).toLocaleString()}`;
        
        // Current price (first data point)
        const currentPrice = allDataPoints[0].price;
        const priceClass = currentPrice < this.priceThreshold ? 'price-low' : 
                        currentPrice < this.priceThreshold * 1.5 ? 'price-medium' : 'price-high';
        
        document.getElementById('currentPrice').innerHTML = 
            `<span class="price-current ${priceClass}">€${currentPrice.toFixed(2)}</span><br>per MWh`;
        
        // Price statistics from all sources
        const prices = allDataPoints.map(item => item.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        
        document.getElementById('priceStats').innerHTML = 
            `Min: €${min.toFixed(2)}<br>Max: €${max.toFixed(2)}<br>Average: €${avg.toFixed(2)}`;
        
        // Cheap hours (below threshold)
        const cheapHours = allDataPoints.filter(item => item.price < this.priceThreshold);
        
        document.getElementById('cheapHours').innerHTML = 
            `${cheapHours.length} data points below €${this.priceThreshold}<br>` +
            `(${((cheapHours.length / allDataPoints.length) * 100).toFixed(1)}% of all data)`;
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    new EnergyDashboard();
});
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
        if (!this.energyData || !Array.isArray(this.energyData)) {
            return { x: [], y: [], colors: [] };
        }

        const now = new Date();
        const cutoffTime = this.getTimeRangeCutoff(timeRange, now);
        
        const filteredData = this.energyData.filter(item => {
            const itemDate = new Date(item.datetime || item.timestamp || item.time);
            return itemDate >= cutoffTime;
        });

        const xValues = filteredData.map(item => 
            item.datetime || item.timestamp || item.time
        );
        
        const yValues = filteredData.map(item => 
            item.price || item.value || item.energy_price || 0
        );

        // Color points based on price threshold
        const colors = yValues.map(price => 
            price < this.priceThreshold ? '#4ade80' : 
            price < this.priceThreshold * 1.5 ? '#f59e0b' : '#ef4444'
        );

        return { x: xValues, y: yValues, colors: colors };
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
        const chartData = this.processEnergyDataForChart(this.currentTimeRange);
        
        const trace = {
            x: chartData.x,
            y: chartData.y,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Energy Price',
            line: { 
                width: 3,
                color: '#60a5fa'
            },
            marker: { 
                size: 6,
                color: chartData.colors,
                line: { width: 1, color: 'white' }
            },
            hovertemplate: '<b>%{x}</b><br>Price: €%{y:.2f}/MWh<extra></extra>'
        };

        // Add threshold line
        const thresholdTrace = {
            x: chartData.x,
            y: new Array(chartData.x.length).fill(this.priceThreshold),
            type: 'scatter',
            mode: 'lines',
            name: 'Threshold',
            line: { 
                width: 2, 
                color: '#64748b', 
                dash: 'dash' 
            },
            hoverinfo: 'skip'
        };
        
        const layout = {
            title: {
                text: 'Energy Price Forecast',
                font: { color: 'white', size: 18 }
            },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(255,255,255,0.1)',
            font: { color: 'white' },
            xaxis: {
                title: 'Time',
                gridcolor: 'rgba(255,255,255,0.2)',
                color: 'white'
            },
            yaxis: {
                title: 'Price (EUR/MWh)',
                gridcolor: 'rgba(255,255,255,0.2)',
                color: 'white'
            },
            margin: { l: 60, r: 30, t: 60, b: 60 },
            showlegend: true,
            legend: {
                font: { color: 'white' },
                bgcolor: 'rgba(255,255,255,0.1)'
            }
        };

        const config = {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            displaylogo: false
        };

        Plotly.newPlot('energyChart', [trace, thresholdTrace], layout, config);
    }

    updateInfo() {
        if (!this.energyData || !Array.isArray(this.energyData)) return;

        // Update last update time
        document.getElementById('lastUpdate').textContent = 
            `Last updated: ${new Date().toLocaleString()}`;
        
        // Current price (first data point)
        if (this.energyData.length > 0) {
            const currentPrice = this.energyData[0].price || this.energyData[0].value || 0;
            const priceClass = currentPrice < this.priceThreshold ? 'price-low' : 
                              currentPrice < this.priceThreshold * 1.5 ? 'price-medium' : 'price-high';
            
            document.getElementById('currentPrice').innerHTML = 
                `<span class="price-current ${priceClass}">€${currentPrice.toFixed(2)}</span><br>per MWh`;
        }
        
        // Price statistics
        const prices = this.energyData.map(item => item.price || item.value || 0);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        
        document.getElementById('priceStats').innerHTML = 
            `Min: €${min.toFixed(2)}<br>Max: €${max.toFixed(2)}<br>Average: €${avg.toFixed(2)}`;
        
        // Cheap hours (below threshold)
        const cheapHours = this.energyData.filter(item => 
            (item.price || item.value || 0) < this.priceThreshold
        );
        
        document.getElementById('cheapHours').innerHTML = 
            `${cheapHours.length} hours below €${this.priceThreshold}<br>` +
            `(${((cheapHours.length / this.energyData.length) * 100).toFixed(1)}% of forecast)`;
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    new EnergyDashboard();
});
class EnergyDashboard {
    constructor() {
        this.energyData = null;
        this.energyZeroData = null;
        this.currentTimeRange = 'all';
        this.priceThreshold = 0;
        this.liveDataEnabled = true;
        this.refreshInterval = null;
        
        // Date/time selection properties
        this.startDateTime = null;
        this.endDateTime = null;
        this.customTimeRange = false;
        this.maxHistoricalDays = 30;
        
        this.init();
    }

    async init() {
        await Promise.all([
            this.loadEnergyData(),
            this.loadEnergyZeroData()
        ]);
        this.setupEventListeners();
        this.setupDateTimeControls();
        this.setupLiveDataRefresh();
        this.updateChart();
        this.updateInfo();
        this.updateLiveDataInfo();
    }

    async loadEnergyData() {
        try {
            const timestamp = new Date().getTime();
            const response = await fetch(`/data/energy_price_forecast.json?t=${timestamp}`);
            this.energyData = await response.json();
            console.log('Loaded fresh energy data:', this.energyData);
        } catch (error) {
            console.error('Error loading energy data:', error);
            this.energyData = [];
        }
    }

    async loadEnergyZeroData() {
        try {
            // Use local date in YYYY-MM-DD format (no timezone conversion)
            const today = new Date();
            const localDate = today.getFullYear() + '-' + 
                            String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                            String(today.getDate()).padStart(2, '0');
            
            const url = `https://api.energyzero.nl/v1/energyprices?fromDate=${localDate}&tillDate=${localDate}&interval=4&usageType=1&inclBtw=true`;
            
            console.log('Fetching Energy Zero data from:', url);
            
            const response = await fetch(url);
            if (!response.ok) {
                // Try yesterday if today fails (data might not be available yet)
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayDate = yesterday.getFullYear() + '-' + 
                                   String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + 
                                   String(yesterday.getDate()).padStart(2, '0');
                
                console.log('Trying yesterday:', yesterdayDate);
                const fallbackUrl = `https://api.energyzero.nl/v1/energyprices?fromDate=${yesterdayDate}&tillDate=${yesterdayDate}&interval=4&usageType=1&inclBtw=true`;
                const fallbackResponse = await fetch(fallbackUrl);
                
                if (!fallbackResponse.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await fallbackResponse.json();
                this.energyZeroData = this.processEnergyZeroData(data);
            } else {
                const data = await response.json();
                this.energyZeroData = this.processEnergyZeroData(data);
            }
            
            console.log('✅ Loaded Energy Zero data:', this.energyZeroData);
            
        } catch (error) {
            console.error('❌ Error loading Energy Zero data:', error);
            this.energyZeroData = null;
        }
    }

    async loadEnergyZeroHistoricalData() {
        try {
            // Format dates properly for Energy Zero API
            const startDate = this.startDateTime.getFullYear() + '-' + 
                            String(this.startDateTime.getMonth() + 1).padStart(2, '0') + '-' + 
                            String(this.startDateTime.getDate()).padStart(2, '0');
            const endDate = this.endDateTime.getFullYear() + '-' + 
                          String(this.endDateTime.getMonth() + 1).padStart(2, '0') + '-' + 
                          String(this.endDateTime.getDate()).padStart(2, '0');
            
            console.log(`Loading Energy Zero historical data from ${startDate} to ${endDate}`);
            
            const daysDiff = Math.ceil((this.endDateTime - this.startDateTime) / (24 * 60 * 60 * 1000));
            
            if (daysDiff <= 1) {
                const url = `https://api.energyzero.nl/v1/energyprices?fromDate=${startDate}&tillDate=${endDate}&interval=4&usageType=1&inclBtw=true`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                this.energyZeroData = this.processEnergyZeroHistoricalData(data);
            } else {
                const allPrices = [];
                const currentDate = new Date(this.startDateTime);
                
                while (currentDate <= this.endDateTime) {
                    const dateStr = currentDate.getFullYear() + '-' + 
                                  String(currentDate.getMonth() + 1).padStart(2, '0') + '-' + 
                                  String(currentDate.getDate()).padStart(2, '0');
                    const url = `https://api.energyzero.nl/v1/energyprices?fromDate=${dateStr}&tillDate=${dateStr}&interval=4&usageType=1&inclBtw=true`;
                    
                    try {
                        const response = await fetch(url);
                        if (response.ok) {
                            const dayData = await response.json();
                            if (dayData.Prices) {
                                allPrices.push(...dayData.Prices);
                            }
                        }
                    } catch (error) {
                        console.warn(`Failed to load data for ${dateStr}:`, error);
                    }
                    
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                
                this.energyZeroData = this.processEnergyZeroHistoricalData({ Prices: allPrices });
            }
            
            console.log('✅ Loaded Energy Zero historical data:', this.energyZeroData);
            
        } catch (error) {
            console.error('❌ Error loading Energy Zero historical data:', error);
            this.energyZeroData = null;
        }
    }

    processEnergyZeroData(rawData) {
        if (!rawData || !rawData.Prices) {
            return null;
        }

        const currentTime = new Date();
        const currentHour = new Date(currentTime.getFullYear(), currentTime.getMonth(), 
                                   currentTime.getDate(), currentTime.getHours());

        const processedData = {
            current_price: null,
            today_prices: [],
            statistics: {},
            last_updated: new Date().toISOString()
        };

        rawData.Prices.forEach(pricePoint => {
            const timestamp = new Date(pricePoint.readingDate);
            const priceEurMwh = pricePoint.price * 1000;
            
            const hourData = {
                timestamp: timestamp.toISOString(),
                hour: timestamp.getHours(),
                price_eur_kwh: pricePoint.price,
                price_eur_mwh: priceEurMwh,
                reading_date: pricePoint.readingDate
            };

            processedData.today_prices.push(hourData);

            if (timestamp.getTime() === currentHour.getTime()) {
                processedData.current_price = hourData;
            }
        });

        if (processedData.today_prices.length > 0) {
            const prices = processedData.today_prices.map(p => p.price_eur_mwh);
            processedData.statistics = {
                min: Math.min(...prices),
                max: Math.max(...prices),
                avg: prices.reduce((a, b) => a + b, 0) / prices.length,
                count: prices.length
            };
        }

        return processedData;
    }

    processEnergyZeroHistoricalData(rawData) {
        if (!rawData || !rawData.Prices) {
            return null;
        }

        const processedData = {
            current_price: null,
            today_prices: [],
            statistics: {},
            last_updated: new Date().toISOString(),
            time_range: {
                start: this.startDateTime?.toISOString(),
                end: this.endDateTime?.toISOString()
            }
        };

        rawData.Prices.forEach(pricePoint => {
            const timestamp = new Date(pricePoint.readingDate);
            
            if (this.startDateTime && this.endDateTime) {
                if (timestamp < this.startDateTime || timestamp > this.endDateTime) {
                    return;
                }
            }
            
            const priceEurMwh = pricePoint.price * 1000;
            
            const hourData = {
                timestamp: timestamp.toISOString(),
                hour: timestamp.getHours(),
                date: timestamp.toISOString().split('T')[0],
                price_eur_kwh: pricePoint.price,
                price_eur_mwh: priceEurMwh,
                reading_date: pricePoint.readingDate
            };

            processedData.today_prices.push(hourData);
        });

        if (processedData.today_prices.length > 0) {
            const prices = processedData.today_prices.map(p => p.price_eur_mwh);
            processedData.statistics = {
                min: Math.min(...prices),
                max: Math.max(...prices),
                avg: prices.reduce((a, b) => a + b, 0) / prices.length,
                count: prices.length
            };
            
            if (!this.customTimeRange) {
                const currentHour = new Date();
                currentHour.setMinutes(0, 0, 0);
                
                processedData.current_price = processedData.today_prices.find(p => 
                    new Date(p.timestamp).getTime() === currentHour.getTime()
                );
            }
        }

        return processedData;
    }

    setupLiveDataRefresh() {
        this.refreshInterval = setInterval(async () => {
            console.log('🔄 Refreshing Energy Zero data...');
            await this.loadEnergyZeroData();
            this.updateLiveDataInfo();
            this.updateChart();
        }, 10 * 60 * 1000);
    }

    setupDateTimeControls() {
        const header = document.querySelector('.dashboard-header');
        if (header && !document.getElementById('datetime-controls')) {
            const controlsContainer = document.createElement('div');
            controlsContainer.id = 'datetime-controls';
            controlsContainer.className = 'datetime-controls';
            
            const now = new Date();
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            
            controlsContainer.innerHTML = `
                <div class="time-range-section">
                    <h4>📅 Time Range Selection</h4>
                    
                    <div class="quick-select-buttons">
                        <button class="quick-btn active" data-range="now">Now + Forecast</button>
                        <button class="quick-btn" data-range="24h">Last 24h</button>
                        <button class="quick-btn" data-range="48h">Last 48h</button>
                        <button class="quick-btn" data-range="7d">Last 7 days</button>
                        <button class="quick-btn" data-range="custom">Custom Range</button>
                    </div>
                    
                    <div class="custom-range-inputs" id="custom-range-inputs" style="display: none;">
                        <div class="datetime-input-group">
                            <label for="start-datetime">Start Date & Time:</label>
                            <input type="datetime-local" id="start-datetime" 
                                   value="${this.formatDateTimeLocal(yesterday)}"
                                   max="${this.formatDateTimeLocal(now)}">
                        </div>
                        
                        <div class="datetime-input-group">
                            <label for="end-datetime">End Date & Time:</label>
                            <input type="datetime-local" id="end-datetime" 
                                   value="${this.formatDateTimeLocal(now)}"
                                   max="${this.formatDateTimeLocal(now)}">
                        </div>
                        
                        <div class="datetime-actions">
                            <button id="apply-custom-range" class="apply-btn">Apply Range</button>
                            <button id="reset-to-now" class="reset-btn">Reset to Now</button>
                        </div>
                    </div>
                    
                    <div class="range-info" id="range-info">
                        Showing: Current time + forecasts
                    </div>
                </div>
            `;
            
            const existingControls = document.querySelector('.live-data-controls');
            if (existingControls) {
                existingControls.parentNode.insertBefore(controlsContainer, existingControls.nextSibling);
            } else {
                header.appendChild(controlsContainer);
            }
            
            this.setupDateTimeEventListeners();
        }
    }

    setupDateTimeEventListeners() {
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.quick-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                const range = e.target.dataset.range;
                this.handleQuickTimeRange(range);
            });
        });

        document.getElementById('apply-custom-range')?.addEventListener('click', () => {
            this.applyCustomRange();
        });

        document.getElementById('reset-to-now')?.addEventListener('click', () => {
            this.resetToNow();
        });

        document.getElementById('start-datetime')?.addEventListener('change', (e) => {
            const startTime = new Date(e.target.value);
            const endInput = document.getElementById('end-datetime');
            const currentEnd = new Date(endInput.value);
            
            if (currentEnd <= startTime) {
                const newEnd = new Date(startTime.getTime() + 24 * 60 * 60 * 1000);
                const maxTime = new Date();
                endInput.value = this.formatDateTimeLocal(newEnd > maxTime ? maxTime : newEnd);
            }
        });
    }

    handleQuickTimeRange(range) {
        const now = new Date();
        
        switch (range) {
            case 'now':
                this.startDateTime = null;
                this.endDateTime = null;
                this.customTimeRange = false;
                document.getElementById('custom-range-inputs').style.display = 'none';
                this.updateRangeInfo('Current time + forecasts');
                break;
                
            case '24h':
                this.startDateTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                this.endDateTime = now;
                this.customTimeRange = true;
                document.getElementById('custom-range-inputs').style.display = 'none';
                this.updateRangeInfo(`Last 24 hours (${this.formatDateTime(this.startDateTime)} to ${this.formatDateTime(this.endDateTime)})`);
                break;
                
            case '48h':
                this.startDateTime = new Date(now.getTime() - 48 * 60 * 60 * 1000);
                this.endDateTime = now;
                this.customTimeRange = true;
                document.getElementById('custom-range-inputs').style.display = 'none';
                this.updateRangeInfo(`Last 48 hours (${this.formatDateTime(this.startDateTime)} to ${this.formatDateTime(this.endDateTime)})`);
                break;
                
            case '7d':
                this.startDateTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                this.endDateTime = now;
                this.customTimeRange = true;
                document.getElementById('custom-range-inputs').style.display = 'none';
                this.updateRangeInfo(`Last 7 days (${this.formatDateTime(this.startDateTime)} to ${this.formatDateTime(this.endDateTime)})`);
                break;
                
            case 'custom':
                this.customTimeRange = true;
                document.getElementById('custom-range-inputs').style.display = 'block';
                break;
        }
        
        if (range !== 'custom') {
            this.refreshDataAndChart();
        }
    }

    applyCustomRange() {
        const startInput = document.getElementById('start-datetime');
        const endInput = document.getElementById('end-datetime');
        
        const startTime = new Date(startInput.value);
        const endTime = new Date(endInput.value);
        
        if (startTime >= endTime) {
            alert('Start time must be before end time');
            return;
        }
        
        const maxHistoricalTime = new Date(Date.now() - this.maxHistoricalDays * 24 * 60 * 60 * 1000);
        if (startTime < maxHistoricalTime) {
            alert(`Historical data is limited to ${this.maxHistoricalDays} days. Please select a more recent start time.`);
            return;
        }
        
        this.startDateTime = startTime;
        this.endDateTime = endTime;
        this.customTimeRange = true;
        
        this.updateRangeInfo(`Custom range: ${this.formatDateTime(startTime)} to ${this.formatDateTime(endTime)}`);
        this.refreshDataAndChart();
    }

    resetToNow() {
        document.querySelectorAll('.quick-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.quick-btn[data-range="now"]').classList.add('active');
        
        this.startDateTime = null;
        this.endDateTime = null;
        this.customTimeRange = false;
        
        document.getElementById('custom-range-inputs').style.display = 'none';
        this.updateRangeInfo('Current time + forecasts');
        this.refreshDataAndChart();
    }

    async refreshDataAndChart() {
        this.showLoadingIndicator();
        
        try {
            if (this.customTimeRange && this.startDateTime && this.endDateTime) {
                await this.loadEnergyZeroHistoricalData();
            } else {
                await this.loadEnergyZeroData();
            }
            
            this.updateChart();
            this.updateInfo();
            this.updateLiveDataInfo();
        } catch (error) {
            console.error('Error refreshing data:', error);
        } finally {
            this.hideLoadingIndicator();
        }
    }

    setupEventListeners() {
        const header = document.querySelector('.dashboard-header');
        if (header && !document.getElementById('live-data-toggle')) {
            const toggleContainer = document.createElement('div');
            toggleContainer.className = 'live-data-controls';
            toggleContainer.innerHTML = `
                <label class="toggle-label">
                    <input type="checkbox" id="live-data-toggle" ${this.liveDataEnabled ? 'checked' : ''}>
                    <span class="toggle-text">🔴 Live Energy Zero Data</span>
                </label>
                <button id="refresh-live-data" class="refresh-btn">🔄 Refresh</button>
            `;
            header.appendChild(toggleContainer);

            document.getElementById('live-data-toggle').addEventListener('change', (e) => {
                this.liveDataEnabled = e.target.checked;
                if (this.liveDataEnabled) {
                    this.loadEnergyZeroData();
                    this.setupLiveDataRefresh();
                } else {
                    if (this.refreshInterval) {
                        clearInterval(this.refreshInterval);
                        this.refreshInterval = null;
                    }
                }
                this.updateChart();
                this.updateLiveDataInfo();
            });

            document.getElementById('refresh-live-data').addEventListener('click', async () => {
                const btn = document.getElementById('refresh-live-data');
                btn.textContent = '⏳ Refreshing...';
                btn.disabled = true;
                
                await this.loadEnergyZeroData();
                this.updateChart();
                this.updateLiveDataInfo();
                
                btn.textContent = '🔄 Refresh';
                btn.disabled = false;
            });
        }
    }

    processEnergyDataForChart(timeRange) {
        if (!this.energyData) {
            return [];
        }

        const traces = [];
        const now = new Date();
        const cutoffTime = this.getTimeRangeCutoff(timeRange, now);

        const dataSources = [
            { key: 'entsoe', name: 'ENTSO-E', color: '#60a5fa' },
            { key: 'energy_zero', name: 'EnergyZero', color: '#34d399' },
            { key: 'epex', name: 'EPEX', color: '#f59e0b' },
            { key: 'elspot', name: 'Elspot', color: '#ef4444' }
        ];

        let allTimestamps = [];

        dataSources.forEach(source => {
            if (this.energyData[source.key] && this.energyData[source.key].data) {
                const sourceData = this.energyData[source.key].data;
                const metadata = this.energyData[source.key].metadata;
                
                let multiplier = 1;
                if (metadata && metadata.units) {
                    const units = metadata.units.toLowerCase();
                    if (units.includes('kwh') || units.includes('eur/kwh')) {
                        multiplier = 1000;
                    }
                }
                
                const dataPoints = Object.entries(sourceData).map(([datetime, price]) => {
                    let normalizedDatetime = datetime;
                    
                    if (datetime.includes('+00:18')) {
                        const baseTime = datetime.replace('+00:18', 'Z');
                        const utcDate = new Date(baseTime);
                        const cestDate = new Date(utcDate.getTime() + (2 * 60 * 60 * 1000));
                        normalizedDatetime = cestDate.toISOString().replace('Z', '+02:00');
                    }

                    let noisyPrice = price * multiplier;
                    if (noisyPrice !== 0) {
                        const noisePercent = (Math.random() - 0.5) * 0.1;
                        noisyPrice = noisyPrice * (1 + noisePercent);
                    }                    
                    
                    return {
                        datetime: normalizedDatetime,
                        price: noisyPrice
                    };
                });

                const filteredData = dataPoints.filter(item => {
                    const itemDate = new Date(item.datetime);
                    return itemDate >= cutoffTime;
                });

                if (filteredData.length > 0) {
                    filteredData.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
                    
                    const xValues = filteredData.map(item => item.datetime);
                    const yValues = filteredData.map(item => item.price);

                    allTimestamps.push(...xValues);

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

        // Add Energy Zero data if available
        if (this.energyZeroData && this.energyZeroData.today_prices) {
            let filteredPrices = this.energyZeroData.today_prices;
            
            if (this.customTimeRange && this.startDateTime && this.endDateTime) {
                filteredPrices = this.energyZeroData.today_prices.filter(item => {
                    const itemDate = new Date(item.timestamp);
                    return itemDate >= this.startDateTime && itemDate <= this.endDateTime;
                });
            } else if (!this.customTimeRange) {
                filteredPrices = this.energyZeroData.today_prices.filter(item => {
                    const itemDate = new Date(item.timestamp);
                    return itemDate >= cutoffTime;
                });
            }

            if (filteredPrices.length > 0) {
                filteredPrices.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                const xValues = filteredPrices.map(item => item.timestamp);
                const yValues = filteredPrices.map(item => item.price_eur_mwh);

                traces.push({
                    x: xValues,
                    y: yValues,
                    type: 'scatter',
                    mode: 'lines+markers',
                    name: this.customTimeRange ? 'Energy Zero (Historical)' : 'Energy Zero (Live)',
                    line: { 
                        width: 4,
                        color: '#10b981',
                        dash: 'solid'
                    },
                    marker: { 
                        size: 6,
                        color: '#10b981',
                        symbol: this.customTimeRange ? 'circle' : 'diamond',
                        line: { color: '#ffffff', width: 1 }
                    },
                    hovertemplate: `<b>Energy Zero ${this.customTimeRange ? '(Historical)' : '(Live)'}</b><br>%{x}<br>Price: €%{y:.2f}/MWh<extra></extra>`
                });

                allTimestamps.push(...xValues);
            }
        }

        this.allTimestamps = [...new Set(allTimestamps)].sort();

        return traces;
    }

    getTimeRangeCutoff(timeRange, now) {
        if (this.customTimeRange && this.startDateTime) {
            return this.startDateTime;
        }
        
        const cutoffs = {
            '24h': new Date(now.getTime() + 24 * 60 * 60 * 1000),
            '48h': new Date(now.getTime() + 48 * 60 * 60 * 1000),
            '7d': new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            'all': new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
        };
        return now;
    }

    updateChart() {
        const traces = this.processEnergyDataForChart(this.currentTimeRange);
        
        // Remove the useless threshold line - don't add it anymore
        
        const layout = {
            title: {
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
            },
            shapes: this.getCurrentTimeLineShape()
        };

        const config = {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            displaylogo: false
        };

        Plotly.newPlot('energyChart', traces, layout, config);
    }

    getCurrentTimeLineShape() {
        const now = new Date();
        const currentTimeISO = now.toISOString();
        
        // Check if current time should be visible
        let showCurrentTimeLine = false;
        
        if (!this.customTimeRange) {
            showCurrentTimeLine = true;
        } else if (this.startDateTime && this.endDateTime) {
            showCurrentTimeLine = (now >= this.startDateTime && now <= this.endDateTime);
        }
        
        if (!showCurrentTimeLine) {
            return [];
        }
        
        return [{
            type: 'line',
            x0: currentTimeISO,
            y0: 0,
            x1: currentTimeISO,
            y1: 1,
            yref: 'paper',
            line: {
                color: '#ff3333',
                width: 4,
                dash: 'solid'
            },
            layer: 'above'
        }];
    }

    updateInfo() {
        if (!this.energyData) return;

        let allDataPoints = [];
        const dataSources = ['entsoe', 'energy_zero', 'epex', 'elspot'];
        
        dataSources.forEach(sourceKey => {
            if (this.energyData[sourceKey] && this.energyData[sourceKey].data) {
                const sourceData = this.energyData[sourceKey].data;
                const metadata = this.energyData[sourceKey].metadata;
                
                let multiplier = 1;
                if (metadata && metadata.units) {
                    const units = metadata.units.toLowerCase();
                    if (units.includes('kwh') || units.includes('eur/kwh')) {
                        multiplier = 1000;
                    }
                }
                
                Object.entries(sourceData).forEach(([datetime, price]) => {
                    let normalizedDatetime = datetime;
                    if (datetime.includes('+00:18')) {
                        normalizedDatetime = datetime.replace('+00:18', '+02:00');
                    }
                    
                    allDataPoints.push({ 
                        datetime: normalizedDatetime, 
                        price: price * multiplier, 
                        source: sourceKey 
                    });
                });
            }
        });

        if (allDataPoints.length === 0) return;

        allDataPoints.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

        const lastUpdate = this.energyData.entsoe?.metadata?.start_time || new Date().toISOString();
        document.getElementById('lastUpdate').textContent = 
            `Last updated: ${new Date(lastUpdate).toLocaleString()}`;
        
        // Update cheap hours with a reasonable threshold
        const reasonableThreshold = 50; // Default 50 EUR/MWh threshold
        const cheapHours = allDataPoints.filter(item => item.price > 0 && item.price < reasonableThreshold);
        
        document.getElementById('cheapHours').innerHTML = 
            `${cheapHours.length} hours below €${reasonableThreshold}<br>` +
            `(${((cheapHours.length / allDataPoints.length) * 100).toFixed(1)}% of all data)`;
    }

    updateLiveDataInfo() {
        this.createLiveDataPanel();
    }

    createLiveDataPanel() {
        let livePanel = document.getElementById('live-data-panel');
        
        if (!livePanel) {
            livePanel = document.createElement('div');
            livePanel.id = 'live-data-panel';
            livePanel.className = 'info-card live-data-card';
            
            const dataInfo = document.querySelector('.data-info');
            if (dataInfo) {
                dataInfo.insertBefore(livePanel, dataInfo.firstChild);
            }
        }

        if (this.energyZeroData) {
            const current = this.energyZeroData.current_price;
            const stats = this.energyZeroData.statistics;
            const lastUpdated = new Date(this.energyZeroData.last_updated);

            livePanel.innerHTML = `
                <h3>🔴 Live Energy Zero Prices</h3>
                <div class="live-current-price">
                    ${current ? 
                        `<div class="price-current">${current.price_eur_mwh.toFixed(2)}</div>
                         <div class="price-unit">EUR/MWh</div>
                         <div class="price-time">Current hour (${current.hour}:00)</div>` :
                        `<div class="price-unavailable">Current hour price not available</div>`
                    }
                </div>
                <div class="live-stats">
                    <div class="stat-row">
                        <span>Today's Range:</span>
                        <span>€${stats.min?.toFixed(2)} - €${stats.max?.toFixed(2)}</span>
                    </div>
                    <div class="stat-row">
                        <span>Today's Average:</span>
                        <span>€${stats.avg?.toFixed(2)}</span>
                    </div>
                    <div class="stat-row">
                        <span>Data Points:</span>
                        <span>${stats.count || 0} hours</span>
                    </div>
                </div>
                <div class="live-update-time">
                    Updated: ${lastUpdated.toLocaleTimeString()}
                </div>
            `;

            // Add time range info if in custom mode
            if (this.customTimeRange && this.energyZeroData) {
                const timeRangeInfo = document.createElement('div');
                timeRangeInfo.className = 'time-range-display';
                timeRangeInfo.innerHTML = `
                    <div class="time-range-title">📅 Viewing Period:</div>
                    <div class="time-range-dates">
                        ${this.formatDateTime(this.startDateTime)} <br>
                        to ${this.formatDateTime(this.endDateTime)}
                    </div>
                    <div class="time-range-duration">
                        (${this.energyZeroData.statistics.count} data points)
                    </div>
                `;
                
                const liveStats = livePanel.querySelector('.live-stats');
                if (liveStats) {
                    livePanel.insertBefore(timeRangeInfo, liveStats);
                }
            }
        } else {
            livePanel.innerHTML = `
                <h3>🔴 Live Energy Zero Prices</h3>
                <div class="live-error">
                    <div>❌ Unable to load live data</div>
                    <div class="error-details">Check console for details</div>
                </div>
            `;
        }
    }

    compareEnergyZeroWithForecasts() {
        if (!this.energyZeroData?.current_price || !this.energyData) {
            return null;
        }

        const livePrice = this.energyZeroData.current_price.price_eur_mwh;
        const currentTime = new Date(this.energyZeroData.current_price.timestamp);
        
        let closestForecast = null;
        let minTimeDiff = Infinity;

        ['entsoe', 'energy_zero', 'epex', 'elspot'].forEach(source => {
            if (this.energyData[source]?.data) {
                Object.entries(this.energyData[source].data).forEach(([timestamp, price]) => {
                    const forecastTime = new Date(timestamp);
                    const timeDiff = Math.abs(forecastTime.getTime() - currentTime.getTime());
                    
                    if (timeDiff < minTimeDiff) {
                        minTimeDiff = timeDiff;
                        closestForecast = { price, source, timestamp };
                    }
                });
            }
        });

        if (closestForecast) {
            const diff = livePrice - closestForecast.price;
            const diffPercent = ((diff / closestForecast.price) * 100);
            const arrow = diff > 0 ? '📈' : diff < 0 ? '📉' : '➡️';
            
            return `
                Live: €${livePrice.toFixed(2)}<br>
                Forecast: €${closestForecast.price.toFixed(2)} (${closestForecast.source})<br>
                Difference: ${arrow} €${Math.abs(diff).toFixed(2)} (${Math.abs(diffPercent).toFixed(1)}%)
            `;
        }

        return 'No comparable forecast data found';
    }

    formatDateTimeLocal(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    formatDateTime(date) {
        return date.toLocaleString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    updateRangeInfo(text) {
        const infoElement = document.getElementById('range-info');
        if (infoElement) {
            infoElement.textContent = text;
        }
    }

    showLoadingIndicator() {
        const chartContainer = document.getElementById('energyChart');
        if (chartContainer) {
            chartContainer.style.opacity = '0.5';
            chartContainer.style.pointerEvents = 'none';
        }
        
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'loading-indicator';
        loadingDiv.className = 'loading-indicator';
        loadingDiv.innerHTML = '⏳ Loading data...';
        document.querySelector('.chart-container').appendChild(loadingDiv);
    }

    hideLoadingIndicator() {
        const chartContainer = document.getElementById('energyChart');
        if (chartContainer) {
            chartContainer.style.opacity = '1';
            chartContainer.style.pointerEvents = 'auto';
        }
        
        const loadingDiv = document.getElementById('loading-indicator');
        if (loadingDiv) {
            loadingDiv.remove();
        }
    }

    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.energyDashboard = new EnergyDashboard();
});

window.addEventListener('beforeunload', () => {
    if (window.energyDashboard) {
        window.energyDashboard.destroy();
    }
});
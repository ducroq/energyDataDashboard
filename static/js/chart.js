// Constants
const CONSTANTS = {
    // Unit conversions
    EUR_KWH_TO_MWH_MULTIPLIER: 1000,

    // Refresh intervals
    LIVE_DATA_REFRESH_INTERVAL_MS: 10 * 60 * 1000, // 10 minutes

    // Data noise for educational purposes
    NOISE_PERCENTAGE: 0.1, // ±10%

    // Default settings
    DEFAULT_PRICE_THRESHOLD: 0,
    MAX_HISTORICAL_DAYS: 30,
    DEFAULT_CHEAP_PRICE_THRESHOLD: 50, // EUR/MWh

    // Time periods in milliseconds
    ONE_HOUR_MS: 60 * 60 * 1000,
    ONE_DAY_MS: CONSTANTS.ONE_DAY_MS
};

// Data source configuration
const DATA_SOURCES = {
    // Historical data sources from energy_price_forecast.json
    forecast: [
        {
            key: 'entsoe',
            name: 'ENTSO-E',
            color: '#60a5fa',
            description: 'European Network of Transmission System Operators for Electricity'
        },
        {
            key: 'energy_zero',
            name: 'EnergyZero',
            color: '#10b981',
            description: 'Dutch energy provider day-ahead prices'
        },
        {
            key: 'epex',
            name: 'EPEX',
            color: '#f59e0b',
            description: 'European Power Exchange'
        },
        {
            key: 'elspot',
            name: 'Elspot',
            color: '#ef4444',
            description: 'Nord Pool day-ahead market'
        }
    ],

    // Live Energy Zero data configuration
    energyZero: {
        name: {
            live: 'Energy Zero (Live)',
            historical: 'Energy Zero (Historical)'
        },
        color: '#0e4531ff',  // Dark green
        colorAlt: '#10b981',  // Alternative lighter green (commented out in original)
        line: {
            width: 4,
            dash: 'solid'
        },
        marker: {
            size: 6,
            symbol: {
                live: 'diamond',
                historical: 'circle'
            },
            outline: {
                color: '#ffffff',
                width: 1
            }
        }
    }
};

/**
 * Classify and format errors with user-friendly messages
 *
 * @param {Error} error - The error to classify
 * @param {string} context - Context where error occurred (e.g., 'loading data')
 * @returns {Object} Error classification with user message
 */
function classifyError(error, context = 'operation') {
    const errorInfo = {
        type: 'unknown',
        userMessage: '',
        technicalMessage: error.message || 'Unknown error',
        shouldRetry: false,
        severity: 'error'
    };

    // Network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorInfo.type = 'network';
        errorInfo.userMessage = `Network connection failed while ${context}. Please check your internet connection.`;
        errorInfo.shouldRetry = true;
        errorInfo.severity = 'warning';
    }
    // HTTP errors
    else if (error.message && error.message.includes('HTTP')) {
        const statusMatch = error.message.match(/HTTP (\d+)/);
        const status = statusMatch ? parseInt(statusMatch[1]) : 0;

        errorInfo.type = 'http';
        if (status === 404) {
            errorInfo.userMessage = `Data not found while ${context}. The requested resource may not exist.`;
            errorInfo.shouldRetry = false;
        } else if (status === 429) {
            errorInfo.userMessage = `Too many requests while ${context}. Please wait a moment and try again.`;
            errorInfo.shouldRetry = true;
            errorInfo.severity = 'warning';
        } else if (status >= 500) {
            errorInfo.userMessage = `Server error while ${context}. The service may be temporarily unavailable.`;
            errorInfo.shouldRetry = true;
        } else {
            errorInfo.userMessage = `Request failed while ${context} (HTTP ${status}).`;
            errorInfo.shouldRetry = false;
        }
    }
    // JSON parsing errors
    else if (error instanceof SyntaxError || error.message.includes('JSON')) {
        errorInfo.type = 'parsing';
        errorInfo.userMessage = `Data format error while ${context}. The server returned invalid data.`;
        errorInfo.shouldRetry = false;
    }
    // Timeout errors
    else if (error.name === 'AbortError' || error.message.includes('timeout')) {
        errorInfo.type = 'timeout';
        errorInfo.userMessage = `Request timed out while ${context}. The server took too long to respond.`;
        errorInfo.shouldRetry = true;
        errorInfo.severity = 'warning';
    }
    // Generic errors
    else {
        errorInfo.userMessage = `An error occurred while ${context}. Please try again later.`;
        errorInfo.shouldRetry = true;
        errorInfo.severity = 'warning';
    }

    return errorInfo;
}

/**
 * Display user-friendly error notification
 *
 * @param {Object} errorInfo - Error classification from classifyError()
 */
function showErrorNotification(errorInfo) {
    const existingNotification = document.getElementById('error-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.id = 'error-notification';
    notification.className = `error-notification ${errorInfo.severity}`;
    notification.innerHTML = `
        <div class="error-icon">${errorInfo.severity === 'error' ? '❌' : '⚠️'}</div>
        <div class="error-content">
            <div class="error-message">${errorInfo.userMessage}</div>
            <div class="error-technical">Technical: ${errorInfo.technicalMessage}</div>
        </div>
        <button class="error-close" onclick="this.parentElement.remove()">×</button>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 10000);
}

/**
 * Debounce utility - delays function execution until after specified wait time
 * has elapsed since the last invocation. Prevents excessive function calls.
 *
 * @param {Function} func - The function to debounce
 * @param {number} wait - The delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Converts a UTC date to Europe/Amsterdam timezone accounting for DST.
 * Handles both CET (UTC+1, winter) and CEST (UTC+2, summer) automatically.
 *
 * @param {Date} utcDate - The UTC date to convert
 * @returns {Date} Date with Amsterdam timezone offset applied
 */
function convertUTCToAmsterdam(utcDate) {
    // Use Intl.DateTimeFormat to get the date components in Amsterdam timezone
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Amsterdam',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).formatToParts(utcDate);

    const get = type => parts.find(p => p.type === type).value;

    // Build a UTC timestamp from the Amsterdam time components
    // (this represents what the time would be if those components were in UTC)
    const amsterdamAsUTC = new Date(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`);

    // The difference between this and the actual UTC time is the timezone offset
    const offsetMs = amsterdamAsUTC.getTime() - utcDate.getTime();

    // Apply the offset to get the local time
    return new Date(utcDate.getTime() + offsetMs);
}

class EnergyDashboard {
    constructor() {
        this.energyData = null;
        this.energyZeroData = null;
        this.currentTimeRange = 'all';
        this.priceThreshold = CONSTANTS.DEFAULT_PRICE_THRESHOLD;
        this.liveDataEnabled = true;
        this.refreshInterval = null;
        this.chartInitialized = false; // Track if chart has been rendered

        // Date/time selection properties
        this.startDateTime = null;
        this.endDateTime = null;
        this.customTimeRange = false;
        this.maxHistoricalDays = CONSTANTS.MAX_HISTORICAL_DAYS;

        // API response cache (URL -> {data, timestamp})
        this.apiCache = new Map();
        this.cacheExpiryMs = 5 * 60 * 1000; // 5 minutes cache TTL

        // Debounced refresh function (500ms delay)
        // Prevents excessive API calls when users rapidly change settings
        this.debouncedRefresh = debounce(
            () => this.refreshDataAndChart(),
            500  // 500ms delay
        );

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

    /**
     * Cached fetch wrapper for Energy Zero API calls.
     * Returns cached response if available and not expired (5 min TTL).
     *
     * @param {string} url - The API URL to fetch
     * @returns {Promise<Response>} The fetch response (cached or fresh)
     */
    async cachedFetch(url) {
        const now = Date.now();
        const cached = this.apiCache.get(url);

        // Return cached response if valid and not expired
        if (cached && (now - cached.timestamp) < this.cacheExpiryMs) {
            console.log(`📦 Cache HIT for: ${url.substring(0, 80)}...`);
            // Return a mock Response object with the cached data
            return {
                ok: true,
                json: async () => cached.data,
                status: 200,
                statusText: 'OK (cached)'
            };
        }

        // Cache miss or expired - fetch fresh data
        console.log(`🌐 Cache MISS for: ${url.substring(0, 80)}...`);
        const response = await fetch(url);

        // Cache successful responses
        if (response.ok) {
            const data = await response.json();
            this.apiCache.set(url, {
                data: data,
                timestamp: now
            });

            // Return a mock Response with the data
            return {
                ok: true,
                json: async () => data,
                status: response.status,
                statusText: response.statusText
            };
        }

        return response;
    }

    async loadEnergyData() {
        try {
            const timestamp = new Date().getTime();
            const response = await fetch(`/data/energy_price_forecast.json?t=${timestamp}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            this.energyData = await response.json();
            console.log('Loaded fresh energy data:', this.energyData);
        } catch (error) {
            console.error('Error loading energy data:', error);
            const errorInfo = classifyError(error, 'loading energy price forecast');
            showErrorNotification(errorInfo);
            this.energyData = [];
        }
    }

    async loadEnergyZeroData() {
        try {
            // Energy Zero API expects ISO datetime format with timezone
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            const dates = [yesterday, today];
            
            for (const date of dates) {
                // Create proper ISO datetime strings like the examples show
                const startOfDay = new Date(date);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(date);
                endOfDay.setHours(23, 59, 59, 999);
                
                const fromDate = startOfDay.toISOString();
                const tillDate = endOfDay.toISOString();
                
                const url = `https://api.energyzero.nl/v1/energyprices?fromDate=${fromDate}&tillDate=${tillDate}&interval=4&usageType=1&inclBtw=true`;
                
                console.log(`Trying Energy Zero data for: ${date.toDateString()}`);
                console.log(`URL: ${url}`);

                try {
                    const response = await this.cachedFetch(url);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.Prices && data.Prices.length > 0) {
                            this.energyZeroData = this.processEnergyZeroData(data);
                            console.log(`✅ Loaded Energy Zero data for ${date.toDateString()}:`, this.energyZeroData);
                            return; // Success, exit
                        }
                    } else {
                        console.warn(`HTTP ${response.status} for ${date.toDateString()}: ${response.statusText}`);
                    }
                } catch (error) {
                    console.warn(`Failed for ${date.toDateString()}:`, error);
                }
            }
            
            // If we reach here, all attempts failed
            console.error('❌ All Energy Zero attempts failed');
            const error = new Error('Unable to load Energy Zero data for today or yesterday');
            const errorInfo = classifyError(error, 'loading live Energy Zero prices');
            errorInfo.userMessage = 'Live Energy Zero data is currently unavailable. Historical forecasts are still shown.';
            errorInfo.severity = 'warning';
            showErrorNotification(errorInfo);
            this.energyZeroData = null;

        } catch (error) {
            console.error('❌ Error loading Energy Zero data:', error);
            const errorInfo = classifyError(error, 'loading live Energy Zero prices');
            showErrorNotification(errorInfo);
            this.energyZeroData = null;
        }
    }

    async loadEnergyZeroHistoricalData() {
        try {
            // Format dates properly for Energy Zero API - needs ISO format with timezone
            console.log(`Loading Energy Zero historical data from ${this.startDateTime.toDateString()} to ${this.endDateTime.toDateString()}`);
            
            const daysDiff = Math.ceil((this.endDateTime - this.startDateTime) / CONSTANTS.ONE_DAY_MS);
            
            if (daysDiff <= 1) {
                // Single day request
                const startOfDay = new Date(this.startDateTime);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(this.endDateTime);
                endOfDay.setHours(23, 59, 59, 999);
                
                const fromDate = startOfDay.toISOString();
                const tillDate = endOfDay.toISOString();
                
                const url = `https://api.energyzero.nl/v1/energyprices?fromDate=${fromDate}&tillDate=${tillDate}&interval=4&usageType=1&inclBtw=true`;
                console.log(`Single day URL: ${url}`);

                const response = await this.cachedFetch(url);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                this.energyZeroData = this.processEnergyZeroData(data, { isHistorical: true });
            } else {
                // Multiple day requests - fetch in parallel for better performance
                const fetchPromises = [];
                const currentDate = new Date(this.startDateTime);

                while (currentDate <= this.endDateTime) {
                    const startOfDay = new Date(currentDate);
                    startOfDay.setHours(0, 0, 0, 0);
                    const endOfDay = new Date(currentDate);
                    endOfDay.setHours(23, 59, 59, 999);

                    const fromDate = startOfDay.toISOString();
                    const tillDate = endOfDay.toISOString();
                    const dateString = currentDate.toDateString();

                    const url = `https://api.energyzero.nl/v1/energyprices?fromDate=${fromDate}&tillDate=${tillDate}&interval=4&usageType=1&inclBtw=true`;

                    // Create fetch promise for this day
                    fetchPromises.push(
                        this.cachedFetch(url)
                            .then(response => {
                                if (response.ok) {
                                    return response.json();
                                } else {
                                    console.warn(`Failed for ${dateString}: HTTP ${response.status}`);
                                    return null;
                                }
                            })
                            .catch(error => {
                                console.warn(`Failed to load data for ${dateString}:`, error);
                                return null;
                            })
                    );

                    currentDate.setDate(currentDate.getDate() + 1);
                }

                // Fetch all days in parallel
                const results = await Promise.all(fetchPromises);

                // Combine all prices
                const allPrices = [];
                results.forEach(dayData => {
                    if (dayData && dayData.Prices) {
                        allPrices.push(...dayData.Prices);
                    }
                });

                this.energyZeroData = this.processEnergyZeroData({ Prices: allPrices }, { isHistorical: true });
            }
            
            console.log('✅ Loaded Energy Zero historical data:', this.energyZeroData);
            
        } catch (error) {
            console.error('❌ Error loading Energy Zero historical data:', error);
            this.energyZeroData = null;
        }
    }

    processEnergyZeroData(rawData, options = {}) {
        if (!rawData || !rawData.Prices) {
            return null;
        }

        const {
            isHistorical = false,
            startDateTime = this.startDateTime,
            endDateTime = this.endDateTime,
            detectCurrentPrice = !this.customTimeRange
        } = options;

        const currentTime = new Date();
        const currentHour = new Date(currentTime.getFullYear(), currentTime.getMonth(),
                                   currentTime.getDate(), currentTime.getHours());

        const processedData = {
            current_price: null,
            today_prices: [],
            statistics: {},
            last_updated: new Date().toISOString()
        };

        // Add time_range if historical
        if (isHistorical && startDateTime && endDateTime) {
            processedData.time_range = {
                start: startDateTime.toISOString(),
                end: endDateTime.toISOString()
            };
        }

        rawData.Prices.forEach(pricePoint => {
            const utcTimestamp = new Date(pricePoint.readingDate);
            const localTimestamp = convertUTCToAmsterdam(utcTimestamp);

            // Filter by time range if specified
            if (startDateTime && endDateTime) {
                if (localTimestamp < startDateTime || localTimestamp > endDateTime) {
                    return; // Skip this price point
                }
            }

            const priceEurMwh = pricePoint.price * CONSTANTS.EUR_KWH_TO_MWH_MULTIPLIER;

            const hourData = {
                timestamp: localTimestamp.toISOString(),
                hour: localTimestamp.getHours(),
                price_eur_kwh: pricePoint.price,
                price_eur_mwh: priceEurMwh,
                reading_date: pricePoint.readingDate
            };

            // Add optional fields for historical data
            if (isHistorical) {
                hourData.date = localTimestamp.toISOString().split('T')[0];
                hourData.utc_timestamp = utcTimestamp.toISOString();
            }

            processedData.today_prices.push(hourData);

            // Detect current price if enabled
            if (detectCurrentPrice && localTimestamp.getTime() === currentHour.getTime()) {
                processedData.current_price = hourData;
            }
        });

        // Calculate statistics
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

    setupLiveDataRefresh() {
        this.refreshInterval = setInterval(async () => {
            console.log('🔄 Refreshing Energy Zero data...');
            await this.loadEnergyZeroData();
            this.updateLiveDataInfo();
            this.updateChart();
        }, CONSTANTS.LIVE_DATA_REFRESH_INTERVAL_MS);
    }

    setupDateTimeControls() {
        const header = document.querySelector('.dashboard-header');
        if (header && !document.getElementById('datetime-controls')) {
            const controlsContainer = document.createElement('div');
            controlsContainer.id = 'datetime-controls';
            controlsContainer.className = 'datetime-controls';
            
            const now = new Date();
            const yesterday = new Date(now.getTime() - CONSTANTS.ONE_DAY_MS);
            const tomorrow = new Date(now.getTime() + CONSTANTS.ONE_DAY_MS);
            
            controlsContainer.innerHTML = `
                <div class="time-range-section">
                    <h4>📅 Time Range Selection</h4>
                    
                    <div class="simple-range-controls">
                        <div class="range-row">
                            <div class="range-input-group">
                                <label for="start-period">Start Period:</label>
                                <select id="start-period">
                                    <option value="yesterday">Yesterday</option>
                                    <option value="2days">Last 2 days</option>
                                    <option value="week">Last week</option>
                                    <option value="now" selected>Now</option>
                                </select>
                            </div>
                            
                            <div class="range-input-group">
                                <label for="end-period">End Period:</label>
                                <select id="end-period">
                                    <option value="now">Now</option>
                                    <option value="tomorrow" selected>Tomorrow</option>
                                    <option value="2days">Next 2 days</option>
                                    <option value="week">Next week</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="range-actions">
                            <button id="apply-range" class="apply-btn">Apply Range</button>
                            <button id="reset-range" class="reset-btn">Reset to Default</button>
                        </div>
                    </div>
                    
                    <div class="range-info" id="range-info">
                        Showing: Now to Tomorrow
                    </div>
                </div>
            `;
            
            const existingControls = document.querySelector('.live-data-controls');
            if (existingControls) {
                existingControls.parentNode.insertBefore(controlsContainer, existingControls.nextSibling);
            } else {
                header.appendChild(controlsContainer);
            }
            
            this.setupSimpleRangeEventListeners();
        }
    }

    setupSimpleRangeEventListeners() {
        document.getElementById('apply-range')?.addEventListener('click', () => {
            this.applySimpleRange();
        });

        document.getElementById('reset-range')?.addEventListener('click', () => {
            this.resetToDefault();
        });

        // Auto-update info when selections change
        document.getElementById('start-period')?.addEventListener('change', () => {
            this.updateRangePreview();
        });

        document.getElementById('end-period')?.addEventListener('change', () => {
            this.updateRangePreview();
        });
    }

    applySimpleRange() {
        const startPeriod = document.getElementById('start-period').value;
        const endPeriod = document.getElementById('end-period').value;
        
        const now = new Date();
        let startTime, endTime;
        
        // Calculate start time
        switch (startPeriod) {
            case 'yesterday':
                startTime = new Date(now.getTime() - CONSTANTS.ONE_DAY_MS);
                startTime.setHours(0, 0, 0, 0);
                break;
            case '2days':
                startTime = new Date(now.getTime() - 2 * CONSTANTS.ONE_DAY_MS);
                startTime.setHours(0, 0, 0, 0);
                break;
            case 'week':
                startTime = new Date(now.getTime() - 7 * CONSTANTS.ONE_DAY_MS);
                startTime.setHours(0, 0, 0, 0);
                break;
            case 'now':
            default:
                startTime = now;
                break;
        }
        
        // Calculate end time
        switch (endPeriod) {
            case 'now':
                endTime = now;
                break;
            case 'tomorrow':
                endTime = new Date(now.getTime() + CONSTANTS.ONE_DAY_MS);
                endTime.setHours(23, 59, 59, 999);
                break;
            case '2days':
                endTime = new Date(now.getTime() + 2 * CONSTANTS.ONE_DAY_MS);
                endTime.setHours(23, 59, 59, 999);
                break;
            case 'week':
                endTime = new Date(now.getTime() + 7 * CONSTANTS.ONE_DAY_MS);
                endTime.setHours(23, 59, 59, 999);
                break;
        }
        
        // Validation
        if (startTime >= endTime) {
            alert('Start time must be before end time');
            return;
        }
        
        this.startDateTime = startTime;
        this.endDateTime = endTime;
        this.customTimeRange = (startPeriod !== 'now' || endPeriod !== 'tomorrow');
        
        const description = this.getRangeDescription(startPeriod, endPeriod);
        this.updateRangeInfo(description);
        this.debouncedRefresh();  // Use debounced version to prevent rapid-fire API calls
    }

    resetToDefault() {
        document.getElementById('start-period').value = 'now';
        document.getElementById('end-period').value = 'tomorrow';

        this.startDateTime = null;
        this.endDateTime = null;
        this.customTimeRange = false;

        this.updateRangeInfo('Now to Tomorrow (Default)');
        this.debouncedRefresh();  // Use debounced version to prevent rapid-fire API calls
    }

    updateRangePreview() {
        const startPeriod = document.getElementById('start-period').value;
        const endPeriod = document.getElementById('end-period').value;
        const description = this.getRangeDescription(startPeriod, endPeriod);
        this.updateRangeInfo(`Preview: ${description}`);
    }

    getRangeDescription(startPeriod, endPeriod) {
        const startLabels = {
            'yesterday': 'Yesterday',
            '2days': 'Last 2 days',
            'week': 'Last week',
            'now': 'Now'
        };
        
        const endLabels = {
            'now': 'Now',
            'tomorrow': 'Tomorrow',
            '2days': 'Next 2 days',
            'week': 'Next week'
        };
        
        return `${startLabels[startPeriod]} to ${endLabels[endPeriod]}`;
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
            const errorInfo = classifyError(error, 'refreshing dashboard data');
            showErrorNotification(errorInfo);
            // Chart will still update with whatever data is available
            this.updateChart();
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

        // Use centralized data source configuration
        const dataSources = DATA_SOURCES.forecast;

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
                        const amsterdamDate = convertUTCToAmsterdam(utcDate);

                        // Calculate the actual timezone offset for this date (CET=+01:00 or CEST=+02:00)
                        const offsetMs = amsterdamDate.getTime() - utcDate.getTime();
                        const offsetHours = offsetMs / (60 * 60 * 1000);
                        const offsetString = `+${String(offsetHours).padStart(2, '0')}:00`;

                        normalizedDatetime = amsterdamDate.toISOString().replace('Z', offsetString);
                    }

                    let noisyPrice = price * multiplier;
                    if (noisyPrice !== 0) {
                        const noisePercent = (Math.random() - 0.5) * CONSTANTS.NOISE_PERCENTAGE;
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
            console.log('📊 Processing Energy Zero data:', {
                totalPrices: this.energyZeroData.today_prices.length,
                cutoffTime: cutoffTime.toISOString(),
                customTimeRange: this.customTimeRange,
                currentTimeRange: this.currentTimeRange
            });

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

            console.log('📊 After filtering:', {
                filteredCount: filteredPrices.length,
                firstTimestamp: filteredPrices[0]?.timestamp,
                lastTimestamp: filteredPrices[filteredPrices.length - 1]?.timestamp
            });

            if (filteredPrices.length > 0) {
                filteredPrices.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                const xValues = filteredPrices.map(item => item.timestamp);
                const yValues = filteredPrices.map(item => item.price_eur_mwh);

                const config = DATA_SOURCES.energyZero;
                const displayName = this.customTimeRange ? config.name.historical : config.name.live;
                const markerSymbol = this.customTimeRange ? config.marker.symbol.historical : config.marker.symbol.live;

                traces.push({
                    x: xValues,
                    y: yValues,
                    type: 'scatter',
                    mode: 'lines+markers',
                    name: displayName,
                    line: {
                        width: config.line.width,
                        color: config.color,
                        dash: config.line.dash
                    },
                    marker: {
                        size: config.marker.size,
                        color: config.color,
                        symbol: markerSymbol,
                        line: {
                            color: config.marker.outline.color,
                            width: config.marker.outline.width
                        }
                    },
                    hovertemplate: `<b>${displayName}</b><br>%{x}<br>Price: €%{y:.2f}/MWh<extra></extra>`
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

        // For 'all' timeRange, go back far enough to capture yesterday's Energy Zero data
        const cutoffs = {
            '24h': new Date(now.getTime() - CONSTANTS.ONE_DAY_MS),
            '48h': new Date(now.getTime() - 2 * CONSTANTS.ONE_DAY_MS),
            '7d': new Date(now.getTime() - 7 * CONSTANTS.ONE_DAY_MS),
            'all': new Date(now.getTime() - 7 * CONSTANTS.ONE_DAY_MS)  // Show last 7 days
        };

        // Return the appropriate cutoff, default to 'all' if timeRange not recognized
        return cutoffs[timeRange] || cutoffs['all'];
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

        // Use Plotly.react() for efficient updates after initial render
        if (this.chartInitialized) {
            Plotly.react('energyChart', traces, layout, config);
        } else {
            Plotly.newPlot('energyChart', traces, layout, config);
            this.chartInitialized = true;
        }
    }

    getCurrentTimeLineShape() {
        const now = new Date();
        const currentTimeISO = now.toISOString();
        
        // Simple white line like the horizontal axis
        return [{
            type: 'line',
            x0: currentTimeISO,
            y0: 0,
            x1: currentTimeISO,
            y1: 1,
            yref: 'paper',
            line: {
                color: 'white',
                width: 1,
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
        const cheapHours = allDataPoints.filter(item => item.price > 0 && item.price < CONSTANTS.DEFAULT_CHEAP_PRICE_THRESHOLD);

        document.getElementById('cheapHours').innerHTML =
            `${cheapHours.length} hours below €${CONSTANTS.DEFAULT_CHEAP_PRICE_THRESHOLD}<br>` +
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
        this.chartInitialized = false;
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
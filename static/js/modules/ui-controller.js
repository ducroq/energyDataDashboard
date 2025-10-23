/**
 * UI controller for dashboard interface elements
 * @module ui-controller
 */

import { CONSTANTS, DATA_SOURCES } from './constants.js';
import { formatDateTime } from './timezone-utils.js';

/**
 * UI Controller class for managing dashboard interface
 */
export class UIController {
    constructor(dashboard) {
        this.dashboard = dashboard;
    }

    /**
     * Set up date/time range controls
     */
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

    /**
     * Set up event listeners for range controls
     */
    setupSimpleRangeEventListeners() {
        document.getElementById('apply-range')?.addEventListener('click', () => {
            this.dashboard.applySimpleRange();
        });

        document.getElementById('reset-range')?.addEventListener('click', () => {
            this.dashboard.resetToDefault();
        });

        // Auto-update info when selections change
        document.getElementById('start-period')?.addEventListener('change', () => {
            this.dashboard.updateRangePreview();
        });

        document.getElementById('end-period')?.addEventListener('change', () => {
            this.dashboard.updateRangePreview();
        });
    }

    /**
     * Set up live data toggle and refresh controls
     */
    setupLiveDataControls() {
        const header = document.querySelector('.dashboard-header');
        if (header && !document.getElementById('live-data-toggle')) {
            const toggleContainer = document.createElement('div');
            toggleContainer.className = 'live-data-controls';
            toggleContainer.innerHTML = `
                <label class="toggle-label">
                    <input type="checkbox" id="live-data-toggle" ${this.dashboard.liveDataEnabled ? 'checked' : ''}>
                    <span class="toggle-text">🔴 Live Energy Zero Data</span>
                </label>
                <button id="refresh-live-data" class="refresh-btn">🔄 Refresh</button>
            `;
            header.appendChild(toggleContainer);

            document.getElementById('live-data-toggle').addEventListener('change', (e) => {
                this.dashboard.handleLiveDataToggle(e.target.checked);
            });

            document.getElementById('refresh-live-data').addEventListener('click', async () => {
                await this.dashboard.handleRefreshClick();
            });
        }
    }

    /**
     * Update info cards with energy data statistics
     * @param {Object} energyData - Energy forecast data
     */
    updateInfo(energyData) {
        if (!energyData) return;

        let allDataPoints = [];
        const dataSources = ['entsoe', 'energy_zero', 'epex', 'elspot'];

        dataSources.forEach(sourceKey => {
            if (energyData[sourceKey] && energyData[sourceKey].data) {
                const sourceData = energyData[sourceKey].data;
                const metadata = energyData[sourceKey].metadata;

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

        const lastUpdate = energyData.entsoe?.metadata?.start_time || new Date().toISOString();
        document.getElementById('lastUpdate').textContent =
            `Last updated: ${new Date(lastUpdate).toLocaleString()}`;

        // Update cheap hours with a reasonable threshold
        const cheapHours = allDataPoints.filter(item => item.price > 0 && item.price < CONSTANTS.DEFAULT_CHEAP_PRICE_THRESHOLD);

        document.getElementById('cheapHours').innerHTML =
            `${cheapHours.length} hours below €${CONSTANTS.DEFAULT_CHEAP_PRICE_THRESHOLD}<br>` +
            `(${((cheapHours.length / allDataPoints.length) * 100).toFixed(1)}% of all data)`;
    }

    /**
     * Create or update the live data panel
     * @param {Object} energyZeroData - Processed Energy Zero data
     * @param {boolean} customTimeRange - Whether using custom time range
     * @param {Date} startDateTime - Start of custom range
     * @param {Date} endDateTime - End of custom range
     */
    updateLiveDataPanel(energyZeroData, customTimeRange, startDateTime, endDateTime) {
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

        if (energyZeroData) {
            const current = energyZeroData.current_price;
            const stats = energyZeroData.statistics;
            const lastUpdated = new Date(energyZeroData.last_updated);

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
            if (customTimeRange && energyZeroData) {
                const timeRangeInfo = document.createElement('div');
                timeRangeInfo.className = 'time-range-display';
                timeRangeInfo.innerHTML = `
                    <div class="time-range-title">📅 Viewing Period:</div>
                    <div class="time-range-dates">
                        ${formatDateTime(startDateTime)} <br>
                        to ${formatDateTime(endDateTime)}
                    </div>
                    <div class="time-range-duration">
                        (${energyZeroData.statistics.count} data points)
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

    /**
     * Update the range info display
     * @param {string} text - Text to display
     */
    updateRangeInfo(text) {
        const infoElement = document.getElementById('range-info');
        if (infoElement) {
            infoElement.textContent = text;
        }
    }

    /**
     * Show loading indicator
     */
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

    /**
     * Hide loading indicator
     */
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
}

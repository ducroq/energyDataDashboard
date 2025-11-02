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

            controlsContainer.innerHTML = `
                <div class="time-range-section">
                    <h4>📅 Time Range Selection</h4>

                    <div class="simple-range-controls">
                        <div class="range-row">
                            <div class="range-input-group">
                                <label for="end-period">Show until:</label>
                                <select id="end-period">
                                    <option value="tomorrow" selected>Tomorrow</option>
                                    <option value="week">Next week</option>
                                </select>
                            </div>
                        </div>

                        <div class="range-actions">
                            <button id="apply-range" class="apply-btn">Apply Range</button>
                        </div>
                    </div>

                    <div class="range-info" id="range-info">
                        Showing: Today 00:00 to Tomorrow
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

        // Auto-update info when selection changes
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

        const lastUpdate = energyData.entsoe?.metadata?.start_time || new Date().toISOString();
        document.getElementById('lastUpdate').textContent =
            `Last updated: ${new Date(lastUpdate).toLocaleString()}`;
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

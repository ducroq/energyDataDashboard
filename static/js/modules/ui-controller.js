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
        // Time range selector is now integrated with live data controls
        // Auto-apply on change
        document.getElementById('end-period')?.addEventListener('change', () => {
            this.dashboard.applySimpleRange();
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
                <select id="end-period">
                    <option value="tomorrow" selected>Tomorrow</option>
                    <option value="week">Next week</option>
                </select>
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

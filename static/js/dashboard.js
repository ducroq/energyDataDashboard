/**
 * Main Energy Dashboard application
 * @module dashboard
 */

import { CONSTANTS } from './modules/constants.js';
import { debounce } from './modules/utils.js';
import { classifyError, showErrorNotification } from './modules/error-handler.js';
import { ApiClient } from './modules/api-client.js';
import { processEnergyDataForChart } from './modules/data-processor.js';
import { renderChart } from './modules/chart-renderer.js';
import { UIController } from './modules/ui-controller.js';

/**
 * Main Energy Dashboard class
 */
class EnergyDashboard {
    constructor() {
        this.energyData = null;
        this.energyZeroData = null;
        this.currentTimeRange = 'all';
        this.priceThreshold = CONSTANTS.DEFAULT_PRICE_THRESHOLD;
        this.liveDataEnabled = true;
        this.refreshInterval = null;
        this.chartInitialized = false;

        // Date/time selection properties
        this.startDateTime = null;
        this.endDateTime = null;
        this.customTimeRange = false;
        this.maxHistoricalDays = CONSTANTS.MAX_HISTORICAL_DAYS;

        // Initialize API client and UI controller
        this.apiClient = new ApiClient();
        this.uiController = new UIController(this);

        // Debounced refresh function (500ms delay)
        this.debouncedRefresh = debounce(
            () => this.refreshDataAndChart(),
            500
        );

        this.init();
    }

    /**
     * Initialize the dashboard
     */
    async init() {
        await Promise.all([
            this.loadEnergyData(),
            this.loadEnergyZeroData()
        ]);
        this.uiController.setupLiveDataControls();
        this.uiController.setupDateTimeControls();
        this.setupLiveDataRefresh();
        this.updateChart();
        this.updateInfo();
        this.updateLiveDataInfo();
    }

    /**
     * Load energy forecast data
     */
    async loadEnergyData() {
        this.energyData = await this.apiClient.loadEnergyData();
    }

    /**
     * Load current Energy Zero data
     */
    async loadEnergyZeroData() {
        this.energyZeroData = await this.apiClient.loadEnergyZeroData();
    }

    /**
     * Load historical Energy Zero data for date range
     */
    async loadEnergyZeroHistoricalData() {
        this.energyZeroData = await this.apiClient.loadEnergyZeroHistoricalData(
            this.startDateTime,
            this.endDateTime
        );
    }

    /**
     * Set up automatic live data refresh
     */
    setupLiveDataRefresh() {
        this.refreshInterval = setInterval(async () => {
            console.log('🔄 Refreshing Energy Zero data...');
            await this.loadEnergyZeroData();
            this.updateLiveDataInfo();
            this.updateChart();
        }, CONSTANTS.LIVE_DATA_REFRESH_INTERVAL_MS);
    }

    /**
     * Handle live data toggle change
     * @param {boolean} enabled - Whether live data is enabled
     */
    handleLiveDataToggle(enabled) {
        this.liveDataEnabled = enabled;
        if (enabled) {
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
    }

    /**
     * Handle manual refresh button click
     */
    async handleRefreshClick() {
        const btn = document.getElementById('refresh-live-data');
        btn.textContent = '⏳ Refreshing...';
        btn.disabled = true;

        await this.loadEnergyZeroData();
        this.updateChart();
        this.updateLiveDataInfo();

        btn.textContent = '🔄 Refresh';
        btn.disabled = false;
    }

    /**
     * Apply simple range selection
     */
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
        this.uiController.updateRangeInfo(description);
        this.debouncedRefresh();
    }

    /**
     * Reset to default time range
     */
    resetToDefault() {
        document.getElementById('start-period').value = 'now';
        document.getElementById('end-period').value = 'tomorrow';

        this.startDateTime = null;
        this.endDateTime = null;
        this.customTimeRange = false;

        this.uiController.updateRangeInfo('Now to Tomorrow (Default)');
        this.debouncedRefresh();
    }

    /**
     * Update range preview
     */
    updateRangePreview() {
        const startPeriod = document.getElementById('start-period').value;
        const endPeriod = document.getElementById('end-period').value;
        const description = this.getRangeDescription(startPeriod, endPeriod);
        this.uiController.updateRangeInfo(`Preview: ${description}`);
    }

    /**
     * Get human-readable range description
     * @param {string} startPeriod - Start period value
     * @param {string} endPeriod - End period value
     * @returns {string} Description
     */
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

    /**
     * Refresh data and update chart
     */
    async refreshDataAndChart() {
        // Cancel any pending requests from previous refresh
        this.apiClient.cancelAllRequests();

        this.uiController.showLoadingIndicator();

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
            // Don't show error for aborted requests
            if (error.name === 'AbortError') {
                console.log('Refresh cancelled by user action');
                return;
            }

            console.error('Error refreshing data:', error);
            const errorInfo = classifyError(error, 'refreshing dashboard data');
            showErrorNotification(errorInfo);
            this.updateChart();
        } finally {
            this.uiController.hideLoadingIndicator();
        }
    }

    /**
     * Get time range cutoff for filtering data
     * @returns {Date} Cutoff date
     */
    getTimeRangeCutoff() {
        if (this.customTimeRange && this.startDateTime) {
            return this.startDateTime;
        }

        const now = new Date();
        const cutoffs = {
            '24h': new Date(now.getTime() + CONSTANTS.ONE_DAY_MS),
            '48h': new Date(now.getTime() + 48 * 60 * 60 * 1000),
            '7d': new Date(now.getTime() + 7 * CONSTANTS.ONE_DAY_MS),
            'all': new Date(now.getTime() + 365 * CONSTANTS.ONE_DAY_MS)
        };
        return now;
    }

    /**
     * Update the chart with current data
     */
    updateChart() {
        const cutoffTime = this.getTimeRangeCutoff();
        const result = processEnergyDataForChart(
            this.energyData,
            this.energyZeroData,
            cutoffTime,
            this.customTimeRange,
            this.startDateTime,
            this.endDateTime
        );

        this.allTimestamps = result.allTimestamps;
        this.chartInitialized = renderChart('energyChart', result.traces, this.chartInitialized);
    }

    /**
     * Update info cards
     */
    updateInfo() {
        this.uiController.updateInfo(this.energyData);
    }

    /**
     * Update live data info panel
     */
    updateLiveDataInfo() {
        this.uiController.updateLiveDataPanel(
            this.energyZeroData,
            this.customTimeRange,
            this.startDateTime,
            this.endDateTime
        );
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        this.chartInitialized = false;
    }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.energyDashboard = new EnergyDashboard();
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (window.energyDashboard) {
        window.energyDashboard.destroy();
    }
});

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
import { initWebVitals } from './modules/web-vitals.js';

/**
 * Main Energy Dashboard class
 */
class EnergyDashboard {
    constructor() {
        this.energyData = null;
        this.energyZeroData = null;
        this.currentTimeRange = 'all';
        this.priceThreshold = CONSTANTS.DEFAULT_PRICE_THRESHOLD;
        this.refreshInterval = null;
        this.chartInitialized = false;

        // Date/time selection properties - default to today 00:00 to tomorrow
        const now = new Date();
        this.startDateTime = new Date(now);
        this.startDateTime.setHours(0, 0, 0, 0);
        this.endDateTime = new Date(now.getTime() + CONSTANTS.ONE_DAY_MS);
        this.endDateTime.setHours(23, 59, 59, 999);
        this.customTimeRange = true;
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
            this.loadEnergyZeroHistoricalData()
        ]);

        this.uiController.setupLiveDataControls();
        this.uiController.setupDateTimeControls();
        this.setupLiveDataRefresh();
        this.updateChart();
        this.updateInfo();
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
            this.updateChart();
        }, CONSTANTS.LIVE_DATA_REFRESH_INTERVAL_MS);
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

        btn.textContent = '🔄 Refresh';
        btn.disabled = false;
    }

    /**
     * Apply simple range selection
     */
    applySimpleRange() {
        const endPeriod = document.getElementById('end-period').value;

        const now = new Date();
        let startTime, endTime;

        // Always start at 00:00 today
        startTime = new Date(now);
        startTime.setHours(0, 0, 0, 0);

        // Calculate end time
        switch (endPeriod) {
            case 'tomorrow':
                endTime = new Date(now.getTime() + CONSTANTS.ONE_DAY_MS);
                endTime.setHours(23, 59, 59, 999);
                break;
            case 'week':
                endTime = new Date(now.getTime() + 7 * CONSTANTS.ONE_DAY_MS);
                endTime.setHours(23, 59, 59, 999);
                break;
            default:
                endTime = new Date(now.getTime() + CONSTANTS.ONE_DAY_MS);
                endTime.setHours(23, 59, 59, 999);
                break;
        }

        this.startDateTime = startTime;
        this.endDateTime = endTime;
        this.customTimeRange = true;

        this.debouncedRefresh();
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
        // For 'all' timeRange, go back far enough to capture yesterday's Energy Zero data
        const cutoffs = {
            '24h': new Date(now.getTime() - CONSTANTS.ONE_DAY_MS),
            '48h': new Date(now.getTime() - 2 * CONSTANTS.ONE_DAY_MS),
            '7d': new Date(now.getTime() - 7 * CONSTANTS.ONE_DAY_MS),
            'all': new Date(now.getTime() - 7 * CONSTANTS.ONE_DAY_MS)  // Show last 7 days
        };

        // Return the appropriate cutoff, default to 'all' if timeRange not recognized
        return cutoffs[this.currentTimeRange] || cutoffs['all'];
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
        this.chartInitialized = renderChart(
            'energyChart',
            result.traces,
            this.chartInitialized,
            this.startDateTime,
            this.endDateTime
        );
    }

    /**
     * Update info cards
     */
    updateInfo() {
        this.uiController.updateInfo(this.energyData);
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
    // Initialize Web Vitals monitoring
    initWebVitals();

    window.energyDashboard = new EnergyDashboard();
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (window.energyDashboard) {
        window.energyDashboard.destroy();
    }
});

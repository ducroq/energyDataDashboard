/**
 * API client for fetching energy data
 * @module api-client
 */

import { CONSTANTS } from './constants.js';
import { classifyError, showErrorNotification } from './error-handler.js';
import { processEnergyZeroData } from './data-processor.js';

/**
 * API Client class for managing energy data requests
 */
export class ApiClient {
    constructor() {
        // API response cache (URL -> {data, timestamp})
        this.apiCache = new Map();
        this.cacheExpiryMs = 5 * 60 * 1000; // 5 minutes cache TTL
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

    /**
     * Load energy forecast data from local JSON
     * @returns {Promise<Object>} Energy forecast data
     */
    async loadEnergyData() {
        try {
            const timestamp = new Date().getTime();
            const response = await fetch(`/data/energy_price_forecast.json?t=${timestamp}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Loaded fresh energy data:', data);
            return data;
        } catch (error) {
            console.error('Error loading energy data:', error);
            const errorInfo = classifyError(error, 'loading energy price forecast');
            showErrorNotification(errorInfo);
            return [];
        }
    }

    /**
     * Load current Energy Zero data
     * @returns {Promise<Object>} Processed Energy Zero data
     */
    async loadEnergyZeroData() {
        try {
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            const dates = [yesterday, today];

            for (const date of dates) {
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
                            const processedData = processEnergyZeroData(data);
                            console.log(`✅ Loaded Energy Zero data for ${date.toDateString()}:`, processedData);
                            return processedData;
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
            return null;

        } catch (error) {
            console.error('❌ Error loading Energy Zero data:', error);
            const errorInfo = classifyError(error, 'loading live Energy Zero prices');
            showErrorNotification(errorInfo);
            return null;
        }
    }

    /**
     * Load historical Energy Zero data for a date range
     * @param {Date} startDateTime - Start date
     * @param {Date} endDateTime - End date
     * @returns {Promise<Object>} Processed historical data
     */
    async loadEnergyZeroHistoricalData(startDateTime, endDateTime) {
        try {
            console.log(`Loading Energy Zero historical data from ${startDateTime.toDateString()} to ${endDateTime.toDateString()}`);

            const daysDiff = Math.ceil((endDateTime - startDateTime) / CONSTANTS.ONE_DAY_MS);

            if (daysDiff <= 1) {
                // Single day request
                const startOfDay = new Date(startDateTime);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(endDateTime);
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
                return processEnergyZeroData(data, {
                    isHistorical: true,
                    startDateTime,
                    endDateTime
                });
            } else {
                // Multiple day requests - fetch in parallel for better performance
                const fetchPromises = [];
                const currentDate = new Date(startDateTime);

                while (currentDate <= endDateTime) {
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

                const processedData = processEnergyZeroData({ Prices: allPrices }, {
                    isHistorical: true,
                    startDateTime,
                    endDateTime
                });

                console.log('✅ Loaded Energy Zero historical data:', processedData);
                return processedData;
            }

        } catch (error) {
            console.error('❌ Error loading Energy Zero historical data:', error);
            return null;
        }
    }
}

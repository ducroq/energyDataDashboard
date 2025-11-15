/**
 * Timezone conversion utilities
 * @module timezone-utils
 */

// Memoization cache for timezone conversions
const conversionCache = new Map();
const MAX_CACHE_SIZE = 500;

// Pre-create the formatter to avoid repeated instantiation
const amsterdamFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
});

/**
 * Converts a UTC date to Europe/Amsterdam timezone accounting for DST.
 * Handles both CET (UTC+1, winter) and CEST (UTC+2, summer) automatically.
 * Uses memoization for performance when called repeatedly with same inputs.
 *
 * @param {Date} utcDate - The UTC date to convert
 * @returns {Date} Date with Amsterdam timezone offset applied
 */
export function convertUTCToAmsterdam(utcDate) {
    const timestamp = utcDate.getTime();

    // Check cache first
    if (conversionCache.has(timestamp)) {
        return new Date(conversionCache.get(timestamp));
    }

    // Use pre-created formatter
    const parts = amsterdamFormatter.formatToParts(utcDate);
    const get = type => parts.find(p => p.type === type).value;

    // Build a UTC timestamp from the Amsterdam time components
    const amsterdamAsUTC = new Date(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`);

    // The difference between this and the actual UTC time is the timezone offset
    const offsetMs = amsterdamAsUTC.getTime() - utcDate.getTime();

    // Apply the offset to get the local time
    const result = new Date(timestamp + offsetMs);

    // Cache the result (evict oldest if cache is full)
    if (conversionCache.size >= MAX_CACHE_SIZE) {
        const firstKey = conversionCache.keys().next().value;
        conversionCache.delete(firstKey);
    }
    conversionCache.set(timestamp, result.getTime());

    return result;
}

/**
 * Format Amsterdam local time as ISO string with proper timezone offset.
 * Determines the correct offset (+01:00 for CET or +02:00 for CEST) based on the date.
 *
 * @param {Date} localDate - Date object representing Amsterdam local time
 * @returns {string} ISO string with Amsterdam timezone offset (e.g., "2025-11-07T01:00:00+01:00")
 */
export function formatAmsterdamISOString(localDate) {
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    const hours = String(localDate.getHours()).padStart(2, '0');
    const minutes = String(localDate.getMinutes()).padStart(2, '0');
    const seconds = String(localDate.getSeconds()).padStart(2, '0');

    // Determine timezone offset by checking what Amsterdam time would be for this local date
    // Convert back to see what the offset actually is
    const testDate = new Date(Date.UTC(year, localDate.getMonth(), localDate.getDate(), localDate.getHours(), localDate.getMinutes(), localDate.getSeconds()));
    const amsterdamParts = amsterdamFormatter.formatToParts(testDate);
    const getAmsterdam = type => amsterdamParts.find(p => p.type === type).value;

    // Calculate if DST is in effect by comparing UTC components with Amsterdam components
    const utcHour = testDate.getUTCHours();
    const amsterdamHour = parseInt(getAmsterdam('hour'));
    let offset = amsterdamHour - utcHour;

    // Handle day boundary wraparound
    if (offset < -12) offset += 24;
    if (offset > 12) offset -= 24;

    const offsetString = offset === 2 ? '+02:00' : '+01:00';

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offsetString}`;
}

/**
 * Format a date for datetime-local input
 * @param {Date} date - Date to format
 * @returns {string} Formatted datetime string
 */
export function formatDateTimeLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Format a date for display
 * @param {Date} date - Date to format
 * @returns {string} Formatted datetime string
 */
export function formatDateTime(date) {
    return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Timezone conversion utilities
 * @module timezone-utils
 */

/**
 * Converts a UTC date to Europe/Amsterdam timezone accounting for DST.
 * Handles both CET (UTC+1, winter) and CEST (UTC+2, summer) automatically.
 *
 * @param {Date} utcDate - The UTC date to convert
 * @returns {Date} Date with Amsterdam timezone offset applied
 */
export function convertUTCToAmsterdam(utcDate) {
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

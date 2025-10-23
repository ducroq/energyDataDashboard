/**
 * General utility functions
 * @module utils
 */

/**
 * Debounce utility - delays function execution until after specified wait time
 * has elapsed since the last invocation. Prevents excessive function calls.
 *
 * @param {Function} func - The function to debounce
 * @param {number} wait - The delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
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

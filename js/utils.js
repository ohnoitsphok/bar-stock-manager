/**
 * Utility Helpers - Optimized with Formatter & Date Parsing Caches
 */
const _currencyFormatters = new Map();
const _yearMonthCache = new Map();
const _monthLabelCache = new Map();
const _textEncoder = new TextEncoder();
const _textDecoder = new TextDecoder();

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

function getCurrencyFormatter(decimals) {
    let fmt = _currencyFormatters.get(decimals);
    if (!fmt) {
        fmt = new Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
        _currencyFormatters.set(decimals, fmt);
    }
    return fmt;
}

window.BarUtils = {
    /**
     * Format numbers into locale currency strings using cached Intl.NumberFormat
     */
    formatCurrency(val, decimals = 0) {
        const num = Number(val);
        if (isNaN(num) || val === null || val === undefined) return '0';
        return getCurrencyFormatter(decimals).format(num);
    },

    /**
     * Safe UTF-8 to Base64 encoder using shared TextEncoder
     */
    utf8ToBase64(str) {
        const bytes = _textEncoder.encode(str);
        const chunkSize = 0x8000;
        const chunks = [];
        for (let i = 0; i < bytes.length; i += chunkSize) {
            chunks.push(String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize)));
        }
        return btoa(chunks.join(''));
    },

    /**
     * Safe Base64 to UTF-8 decoder using shared TextDecoder
     */
    base64ToUtf8(b64) {
        const cleanB64 = (b64 || '').replace(/\s+/g, '');
        const binary = atob(cleanB64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return _textDecoder.decode(bytes);
    },

    /**
     * Debounce helper
     */
    debounce(fn, waitMs) {
        let timeout;
        const debounced = function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), waitMs);
        };
        debounced.cancel = () => clearTimeout(timeout);
        return debounced;
    },

    /**
     * Parse date string or Date into YYYY-MM format with memoization for strings
     */
    parseYearMonth(dateInput) {
        if (!dateInput) return '';
        const isStr = typeof dateInput === 'string';
        if (isStr && _yearMonthCache.has(dateInput)) {
            return _yearMonthCache.get(dateInput);
        }

        let result = '';
        if (dateInput instanceof Date) {
            if (!isNaN(dateInput.getTime())) {
                result = `${dateInput.getFullYear()}-${String(dateInput.getMonth() + 1).padStart(2, '0')}`;
            }
            return result;
        }

        const str = String(dateInput);
        // Fast path: YYYY-MM or MM/DD/YYYY regex before Date constructor
        const ym = str.match(/^(\d{4})-(\d{1,2})/);
        if (ym) {
            result = `${ym[1]}-${ym[2].padStart(2, '0')}`;
        } else {
            const mdy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (mdy) {
                result = `${mdy[3]}-${mdy[1].padStart(2, '0')}`;
            } else {
                const d = new Date(str);
                if (!isNaN(d.getTime())) {
                    result = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                }
            }
        }

        if (isStr) {
            _yearMonthCache.set(dateInput, result);
        }
        return result;
    },

    /**
     * Formats 'YYYY-MM' into human-readable label (e.g. 'October 2026') with memoization
     */
    formatMonthLabel(yearMonthStr) {
        if (!yearMonthStr || !yearMonthStr.includes('-')) return yearMonthStr || 'Current Month';
        if (_monthLabelCache.has(yearMonthStr)) {
            return _monthLabelCache.get(yearMonthStr);
        }
        const [year, month] = yearMonthStr.split('-');
        const monthNum = parseInt(month, 10);
        const label = (monthNum >= 1 && monthNum <= 12)
            ? `${MONTH_NAMES[monthNum - 1]} ${year}`
            : yearMonthStr;
        _monthLabelCache.set(yearMonthStr, label);
        return label;
    },

    /**
     * Trigger file download in browser
     */
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }
};

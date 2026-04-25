//@ts-check

const path = require("path");

const { getGeneralCurrencySign } = require(path.join(__dirname, "system"));
let currency = "₱";

(async ()=> {
    currency = await getGeneralCurrencySign();
})
/**
 * Format date strings or Date objects to human-readable patterns.
 *
 * @param {string|Date|null|undefined} dateInput
 * @param {string|Object} formatOrOptions
 * @returns {string}
 */
function formatDate(dateInput, formatOrOptions = "yyyy-MM-dd HH:mm") {
  if (!dateInput) return "";
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return "";

  if (typeof formatOrOptions === "string") {
    return tokenFormat(date, formatOrOptions);
  }

  try {
    return new Intl.DateTimeFormat("en-PH", formatOrOptions).format(date);
  } catch {
    return date.toISOString();
  }
}

/**
 * @param {Date} d
 * @param {string} fmt
 */
function tokenFormat(d, fmt) {
  const rep = {
    yyyy: String(d.getFullYear()),
    MM: String(d.getMonth() + 1).padStart(2, "0"),
    dd: String(d.getDate()).padStart(2, "0"),
    HH: String(d.getHours()).padStart(2, "0"),
    mm: String(d.getMinutes()).padStart(2, "0"),
    ss: String(d.getSeconds()).padStart(2, "0"),
  };
  // @ts-ignore
  return fmt.replace(/yyyy|MM|dd|HH|mm|ss/g, (/** @type {string | number} */ m) => rep[m]);
}

/**
 * Format a number or string as currency (supports multiple currencies).
 *
 * @param {number|string|null|undefined} amount
 * @param {string} [currency]
 * @param {string} [locale='en-PH']
 * @returns {string}
 */
function formatCurrency(amount, currency, locale = "en-PH") {
  if (amount == null) {
    const defaultCurrency = currency;
    // @ts-ignore
    return getCurrencySymbol(defaultCurrency) + "0.00";
  }

  const numeric =
    typeof amount === "string"
      ? parseFloat(String(amount).replace(/[^\d.]/g, ""))
      : Number(amount);

  if (!isFinite(numeric)) {
    const defaultCurrency = currency;
    // @ts-ignore
    return getCurrencySymbol(defaultCurrency) + "0.00";
  }

  const currencyToUse = currency;

  try {
    return numeric.toLocaleString(locale, {
      style: "currency",
      currency: currencyToUse,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    // @ts-ignore
    const symbol = getCurrencySymbol(currencyToUse);
    return `${symbol}${numeric.toFixed(2)}`;
  }
}

/**
 * @param {string | number} currency
 */
function getCurrencySymbol(currency) {
  const symbolMap = {
    PHP: "₱",
    USD: "$",
    EUR: "€",
    JPY: "¥",
    GBP: "£",
    AUD: "A$",
    CAD: "C$",
    CHF: "CHF",
    CNY: "¥",
    HKD: "HK$",
    SGD: "S$",
    KRW: "₩",
    INR: "₹",
    BRL: "R$",
    RUB: "₽",
    TRY: "₺",
  };
  // @ts-ignore
  return symbolMap[currency] || currency;
}

/**
 * Format a number in compact notation (e.g., 1.5K, 2.3M).
 *
 * @param {number|null|undefined} value
 * @returns {string}
 */
function formatCompactNumber(value) {
  if (typeof value !== "number") return "0";
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Format a Date object to YYYY-MM-DD for API requests.
 *
 * @param {Date|null|undefined} date
 * @returns {string}
 */
function formatDateForAPI(date) {
  if (!(date instanceof Date)) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Format date/time for display using Intl.DateTimeFormat.
 *
 * @param {string|Date|null|undefined} input
 * @param {boolean} [includeTime=true]
 * @returns {string}
 */
function formatDateTime(input, includeTime = true) {
  if (!input) return "N/A";
  const date = input instanceof Date ? input : new Date(input);
  if (isNaN(date.getTime())) return "Invalid Date";

  const opts = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };
  if (includeTime) {
    Object.assign(opts, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  try {
    // @ts-ignore
    return new Intl.DateTimeFormat("en-PH", opts).format(date);
  } catch {
    return "Format Error";
  }
}

/**
 * Format a date/string as a relative time (e.g., "5 minutes ago").
 *
 * @param {Date|string|null|undefined} input
 * @param {Object} [options]
 * @returns {string}
 */
function formatRelativeTime(input, options = {}) {
  if (!input) return "N/A";
  const date = input instanceof Date ? input : new Date(input);
  if (isNaN(date.getTime())) return "Invalid Date";

  // @ts-ignore
  const { locale = "en-PH", style = "long", numeric = "auto" } = options;
  const now = new Date();
  const diffSec = Math.round((now.getTime() - date.getTime()) / 1000);
  const absSec = Math.abs(diffSec);

  const MIN = 60;
  const HOUR = MIN * 60;
  const DAY = HOUR * 24;
  const WEEK = DAY * 7;
  const MONTH = DAY * 30;
  const YEAR = DAY * 365;

  let unit;
  let value;

  if (absSec < MIN) {
    unit = "second";
    value = diffSec;
  } else if (absSec < HOUR) {
    unit = "minute";
    value = Math.round(diffSec / MIN);
  } else if (absSec < DAY) {
    unit = "hour";
    value = Math.round(diffSec / HOUR);
  } else if (absSec < WEEK) {
    unit = "day";
    value = Math.round(diffSec / DAY);
  } else if (absSec < MONTH) {
    unit = "week";
    value = Math.round(diffSec / WEEK);
  } else if (absSec < YEAR) {
    unit = "month";
    value = Math.round(diffSec / MONTH);
  } else {
    unit = "year";
    value = Math.round(diffSec / YEAR);
  }

  if (
    typeof Intl !== "undefined" &&
    typeof Intl.RelativeTimeFormat === "function"
  ) {
    try {
      const rtf = new Intl.RelativeTimeFormat(locale, { style, numeric });
      // @ts-ignore
      return rtf.format(value, unit);
    } catch {
      // fall through to manual fallback
    }
  }

  const labels = {
    second: ["second", "seconds"],
    minute: ["minute", "minutes"],
    hour: ["hour", "hours"],
    day: ["day", "days"],
    week: ["week", "weeks"],
    month: ["month", "months"],
    year: ["year", "years"],
  };
  // @ts-ignore
  const [singular, plural] = labels[unit];
  const label = Math.abs(value) === 1 ? singular : plural;
  const suffix = value > 0 ? "ago" : "from now";
  return `${Math.abs(value)} ${label} ${suffix}`;
}

/**
 * Utility function to get current currency from cache
 * @returns {string}
 */
function getCurrentCurrency() {
  // @ts-ignore
  return systemCache.getCurrency();
}

/**
 * Utility function to get current currency symbol from cache
 * @returns {string}
 */
function getCurrentCurrencySymbol() {
  // @ts-ignore
  const currency = systemCache.getCurrency();
  return getCurrencySymbol(currency);
}

module.exports = {
  formatDate,
  formatCurrency,
  formatCompactNumber,
  formatDateForAPI,
  formatDateTime,
  formatRelativeTime,
  getCurrentCurrency,
  getCurrentCurrencySymbol,
  // internal helpers exported for testing if needed
  _tokenFormat: tokenFormat,
  _getCurrencySymbol: getCurrencySymbol,
};

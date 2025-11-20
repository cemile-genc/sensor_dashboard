// toMillis: ts (number|string|DateString) -> ms
export const toMillis = (ts) => {
    if (ts == null) return null;
    if (typeof ts === "number") return ts < 1e12 ? ts * 1000 : ts; // s->ms
    const d = new Date(ts);
    return Number.isFinite(d.getTime()) ? d.getTime() : null;
};

// now - hours => ms
export const rangeFromHours = (h) => {
    const end = Date.now();
    const start = h > 0 ? end - h * 3600 * 1000 : end - 24 * 3600 * 1000;
    return { start, end };
};

// Firebase timestamp key predicate
export const inRange = (ms, start, end) => ms != null && ms >= start && ms <= end;

// Simple formatter
export const fmt = (ms) => new Date(ms).toLocaleString();

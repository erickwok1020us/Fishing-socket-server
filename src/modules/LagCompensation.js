const MAX_LAG_MS = 200;

function validateTimestamp(clientTimestamp) {
    if (typeof clientTimestamp !== 'number') {
        return { valid: true, latency: 0 };
    }

    const serverTime = Date.now();
    const latency = serverTime - clientTimestamp;

    if (latency > MAX_LAG_MS) {
        return {
            valid: false,
            reason: 'LAG_EXCEEDED',
            latency,
            maxAllowed: MAX_LAG_MS
        };
    }

    if (latency < -50) {
        return {
            valid: false,
            reason: 'CLOCK_AHEAD',
            latency,
            maxAllowed: MAX_LAG_MS
        };
    }

    return { valid: true, latency };
}

module.exports = { validateTimestamp, MAX_LAG_MS };

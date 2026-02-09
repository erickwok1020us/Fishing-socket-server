const SIGMA_THRESHOLD = 3.0;
const MIN_SHOTS_FOR_DETECTION = 50;

const ESCALATION_LEVELS = {
    NONE: 0,
    WARNING: 1,
    COOLDOWN: 2,
    DISCONNECT: 3
};

const WARNING_FLAG_COUNT = 1;
const COOLDOWN_FLAG_COUNT = 3;
const DISCONNECT_FLAG_COUNT = 5;
const COOLDOWN_DURATION_MS = 10000;

class PlayerStats {
    constructor() {
        this.shotsByWeapon = new Map();
        this.hitsByWeapon = new Map();
        this.flags = [];
    }

    recordShot(weapon) {
        const current = this.shotsByWeapon.get(weapon) || 0;
        this.shotsByWeapon.set(weapon, current + 1);
    }

    recordHit(weapon) {
        const current = this.hitsByWeapon.get(weapon) || 0;
        this.hitsByWeapon.set(weapon, current + 1);
    }

    getHitRate(weapon) {
        const shots = this.shotsByWeapon.get(weapon) || 0;
        const hits = this.hitsByWeapon.get(weapon) || 0;
        if (shots === 0) return 0;
        return hits / shots;
    }

    getTotalShots() {
        let total = 0;
        for (const count of this.shotsByWeapon.values()) {
            total += count;
        }
        return total;
    }

    getTotalFlags() {
        return this.flags.length;
    }

    getEscalationLevel() {
        const flagCount = this.flags.length;
        if (flagCount >= DISCONNECT_FLAG_COUNT) return ESCALATION_LEVELS.DISCONNECT;
        if (flagCount >= COOLDOWN_FLAG_COUNT) return ESCALATION_LEVELS.COOLDOWN;
        if (flagCount >= WARNING_FLAG_COUNT) return ESCALATION_LEVELS.WARNING;
        return ESCALATION_LEVELS.NONE;
    }
}

class AnomalyDetector {
    constructor() {
        this.players = new Map();
        this.expectedHitRates = {
            '1x': 0.35,
            '3x': 0.30,
            '5x': 0.25,
            '8x': 0.20
        };
        this.expectedStdDevs = {
            '1x': 0.08,
            '3x': 0.07,
            '5x': 0.06,
            '8x': 0.05
        };
    }

    getPlayerStats(socketId) {
        if (!this.players.has(socketId)) {
            this.players.set(socketId, new PlayerStats());
        }
        return this.players.get(socketId);
    }

    recordShot(socketId, weapon) {
        this.getPlayerStats(socketId).recordShot(weapon);
    }

    recordHit(socketId, weapon) {
        this.getPlayerStats(socketId).recordHit(weapon);
    }

    checkAnomaly(socketId) {
        const stats = this.players.get(socketId);
        if (!stats) return null;

        if (stats.getTotalShots() < MIN_SHOTS_FOR_DETECTION) return null;

        const anomalies = [];

        for (const [weapon, expectedRate] of Object.entries(this.expectedHitRates)) {
            const shots = stats.shotsByWeapon.get(weapon) || 0;
            if (shots < MIN_SHOTS_FOR_DETECTION) continue;

            const observedRate = stats.getHitRate(weapon);
            const stdDev = this.expectedStdDevs[weapon];
            const zScore = (observedRate - expectedRate) / stdDev;

            if (zScore > SIGMA_THRESHOLD) {
                const flag = {
                    weapon,
                    observedRate: Math.round(observedRate * 1000) / 1000,
                    expectedRate,
                    zScore: Math.round(zScore * 100) / 100,
                    shots,
                    timestamp: Date.now()
                };
                stats.flags.push(flag);
                anomalies.push(flag);
            }
        }

        return anomalies.length > 0 ? anomalies : null;
    }

    destroyPlayer(socketId) {
        this.players.delete(socketId);
    }

    getEscalationLevel(socketId) {
        const stats = this.players.get(socketId);
        if (!stats) return ESCALATION_LEVELS.NONE;
        return stats.getEscalationLevel();
    }

    isInCooldown(socketId) {
        const stats = this.players.get(socketId);
        if (!stats || !stats.cooldownUntil) return false;
        if (Date.now() < stats.cooldownUntil) return true;
        stats.cooldownUntil = null;
        return false;
    }

    applyCooldown(socketId) {
        const stats = this.players.get(socketId);
        if (stats) {
            stats.cooldownUntil = Date.now() + COOLDOWN_DURATION_MS;
        }
    }

    getStats() {
        return {
            trackedPlayers: this.players.size,
            sigmaThreshold: SIGMA_THRESHOLD,
            minShotsRequired: MIN_SHOTS_FOR_DETECTION
        };
    }
}

const anomalyDetector = new AnomalyDetector();

module.exports = { AnomalyDetector, anomalyDetector, SIGMA_THRESHOLD, MIN_SHOTS_FOR_DETECTION, ESCALATION_LEVELS, COOLDOWN_DURATION_MS };

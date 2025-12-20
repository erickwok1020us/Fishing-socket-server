/**
 * Rate Limiter Module
 * 
 * Implements Token Bucket rate limiting as specified in PDF Security Section.
 * Provides per-session and per-IP rate limiting for all packet types.
 * 
 * Features:
 * - Token bucket algorithm with configurable capacity and refill rate
 * - Per-session limits for game actions (shoot, movement, room operations)
 * - Per-IP limits for handshake and connection spam prevention
 * - Automatic cleanup of stale buckets
 */

/**
 * Rate limit configuration per packet type
 * capacity: Maximum burst size
 * refillPerSec: Tokens restored per second
 */
const RATE_LIMITS = {
    // Shooting - allow burst of 20, sustain 10/sec
    shoot: { capacity: 20, refillPerSec: 10 },
    
    // Movement/cannon updates - allow burst of 30, sustain 20/sec
    movement: { capacity: 30, refillPerSec: 20 },
    
    // Room operations (create, join, leave, ready, start) - burst 5, sustain 1/sec
    roomAction: { capacity: 5, refillPerSec: 1 },
    
    // Weapon switch - burst 10, sustain 5/sec
    weaponSwitch: { capacity: 10, refillPerSec: 5 },
    
    // Time sync pings - burst 10, sustain 2/sec
    timeSync: { capacity: 10, refillPerSec: 2 },
    
    // State requests - burst 3, sustain 0.5/sec
    stateRequest: { capacity: 3, refillPerSec: 0.5 },
    
    // Handshake per IP - burst 3, sustain 0.1/sec (6 per minute)
    handshake: { capacity: 3, refillPerSec: 0.1 },
    
    // Global per-IP packet rate - burst 100, sustain 60/sec
    globalPerIP: { capacity: 100, refillPerSec: 60 }
};

/**
 * Connection limits
 */
const CONNECTION_LIMITS = {
    // Maximum concurrent connections per IP
    maxConnectionsPerIP: 5,
    
    // Maximum room operations per IP per 5 minutes
    maxRoomOpsPerIPWindow: 30,
    roomOpsWindowMs: 5 * 60 * 1000,
    
    // Cleanup interval for stale buckets
    cleanupIntervalMs: 60 * 1000,
    
    // Bucket expiry time (no activity)
    bucketExpiryMs: 10 * 60 * 1000
};

/**
 * Token Bucket implementation
 */
class TokenBucket {
    constructor(capacity, refillPerSec) {
        this.capacity = capacity;
        this.tokens = capacity;
        this.refillPerSec = refillPerSec;
        this.lastRefill = Date.now();
        this.lastActivity = Date.now();
    }
    
    /**
     * Try to consume tokens from the bucket
     * @param {number} count - Number of tokens to consume (default 1)
     * @returns {boolean} - True if tokens were consumed, false if rate limited
     */
    tryConsume(count = 1) {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        
        // Refill tokens based on elapsed time
        if (elapsed > 0) {
            this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSec);
            this.lastRefill = now;
        }
        
        this.lastActivity = now;
        
        // Check if we have enough tokens
        if (this.tokens >= count) {
            this.tokens -= count;
            return true;
        }
        
        return false;
    }
    
    /**
     * Get remaining tokens
     * @returns {number}
     */
    getRemaining() {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        return Math.min(this.capacity, this.tokens + elapsed * this.refillPerSec);
    }
    
    /**
     * Check if bucket is expired (no recent activity)
     * @param {number} expiryMs - Expiry time in milliseconds
     * @returns {boolean}
     */
    isExpired(expiryMs) {
        return Date.now() - this.lastActivity > expiryMs;
    }
}

/**
 * Session rate limits container
 */
class SessionLimits {
    constructor() {
        this.shoot = new TokenBucket(RATE_LIMITS.shoot.capacity, RATE_LIMITS.shoot.refillPerSec);
        this.movement = new TokenBucket(RATE_LIMITS.movement.capacity, RATE_LIMITS.movement.refillPerSec);
        this.roomAction = new TokenBucket(RATE_LIMITS.roomAction.capacity, RATE_LIMITS.roomAction.refillPerSec);
        this.weaponSwitch = new TokenBucket(RATE_LIMITS.weaponSwitch.capacity, RATE_LIMITS.weaponSwitch.refillPerSec);
        this.timeSync = new TokenBucket(RATE_LIMITS.timeSync.capacity, RATE_LIMITS.timeSync.refillPerSec);
        this.stateRequest = new TokenBucket(RATE_LIMITS.stateRequest.capacity, RATE_LIMITS.stateRequest.refillPerSec);
        this.createdAt = Date.now();
        this.lastActivity = Date.now();
        this.violations = 0;
    }
    
    /**
     * Update last activity timestamp
     */
    touch() {
        this.lastActivity = Date.now();
    }
    
    /**
     * Record a rate limit violation
     */
    recordViolation() {
        this.violations++;
        return this.violations;
    }
    
    /**
     * Check if session should be banned (too many violations)
     * @param {number} threshold - Maximum violations before ban
     * @returns {boolean}
     */
    shouldBan(threshold = 50) {
        return this.violations >= threshold;
    }
}

/**
 * IP rate limits container
 */
class IPLimits {
    constructor() {
        this.handshake = new TokenBucket(RATE_LIMITS.handshake.capacity, RATE_LIMITS.handshake.refillPerSec);
        this.global = new TokenBucket(RATE_LIMITS.globalPerIP.capacity, RATE_LIMITS.globalPerIP.refillPerSec);
        this.connectionCount = 0;
        this.roomOpsTimestamps = [];
        this.createdAt = Date.now();
        this.lastActivity = Date.now();
        this.violations = 0;
    }
    
    /**
     * Check if IP can create a new connection
     * @returns {boolean}
     */
    canConnect() {
        return this.connectionCount < CONNECTION_LIMITS.maxConnectionsPerIP;
    }
    
    /**
     * Register a new connection from this IP
     */
    addConnection() {
        this.connectionCount++;
        this.lastActivity = Date.now();
    }
    
    /**
     * Remove a connection from this IP
     */
    removeConnection() {
        this.connectionCount = Math.max(0, this.connectionCount - 1);
        this.lastActivity = Date.now();
    }
    
    /**
     * Check if IP can perform a room operation (sliding window)
     * @returns {boolean}
     */
    canPerformRoomOp() {
        const now = Date.now();
        const windowStart = now - CONNECTION_LIMITS.roomOpsWindowMs;
        
        // Clean old timestamps
        this.roomOpsTimestamps = this.roomOpsTimestamps.filter(ts => ts > windowStart);
        
        return this.roomOpsTimestamps.length < CONNECTION_LIMITS.maxRoomOpsPerIPWindow;
    }
    
    /**
     * Record a room operation
     */
    recordRoomOp() {
        this.roomOpsTimestamps.push(Date.now());
        this.lastActivity = Date.now();
    }
    
    /**
     * Record a rate limit violation
     */
    recordViolation() {
        this.violations++;
        return this.violations;
    }
}

/**
 * Rate Limiter Manager
 * Centralized rate limiting for both Socket.IO and Binary WebSocket
 */
class RateLimiter {
    constructor(options = {}) {
        this.sessionBuckets = new Map(); // sessionId -> SessionLimits
        this.ipBuckets = new Map(); // ip -> IPLimits
        this.enabled = options.enabled !== false;
        this.logViolations = options.logViolations !== false;
        
        // Start cleanup interval
        this.cleanupInterval = setInterval(
            () => this.cleanup(),
            CONNECTION_LIMITS.cleanupIntervalMs
        );
        
        console.log(`[RATE-LIMITER] Initialized (enabled: ${this.enabled})`);
    }
    
    /**
     * Get or create session limits
     * @param {string} sessionId
     * @returns {SessionLimits}
     */
    getSessionLimits(sessionId) {
        if (!this.sessionBuckets.has(sessionId)) {
            this.sessionBuckets.set(sessionId, new SessionLimits());
        }
        const limits = this.sessionBuckets.get(sessionId);
        limits.touch();
        return limits;
    }
    
    /**
     * Get or create IP limits
     * @param {string} ip
     * @returns {IPLimits}
     */
    getIPLimits(ip) {
        if (!this.ipBuckets.has(ip)) {
            this.ipBuckets.set(ip, new IPLimits());
        }
        const limits = this.ipBuckets.get(ip);
        limits.lastActivity = Date.now();
        return limits;
    }
    
    /**
     * Check if a shoot action is allowed
     * @param {string} sessionId
     * @param {string} ip
     * @returns {{allowed: boolean, reason?: string}}
     */
    checkShoot(sessionId, ip = null) {
        if (!this.enabled) return { allowed: true };
        
        const session = this.getSessionLimits(sessionId);
        
        // Check IP global limit first
        if (ip) {
            const ipLimits = this.getIPLimits(ip);
            if (!ipLimits.global.tryConsume()) {
                this.logViolation('shoot', sessionId, ip, 'IP global limit');
                ipLimits.recordViolation();
                return { allowed: false, reason: 'ip_rate_limit' };
            }
        }
        
        // Check session shoot limit
        if (!session.shoot.tryConsume()) {
            this.logViolation('shoot', sessionId, ip, 'session shoot limit');
            session.recordViolation();
            return { allowed: false, reason: 'shoot_rate_limit' };
        }
        
        return { allowed: true };
    }
    
    /**
     * Check if a movement/cannon update is allowed
     * @param {string} sessionId
     * @param {string} ip
     * @returns {{allowed: boolean, reason?: string}}
     */
    checkMovement(sessionId, ip = null) {
        if (!this.enabled) return { allowed: true };
        
        const session = this.getSessionLimits(sessionId);
        
        if (ip) {
            const ipLimits = this.getIPLimits(ip);
            if (!ipLimits.global.tryConsume()) {
                return { allowed: false, reason: 'ip_rate_limit' };
            }
        }
        
        if (!session.movement.tryConsume()) {
            return { allowed: false, reason: 'movement_rate_limit' };
        }
        
        return { allowed: true };
    }
    
    /**
     * Check if a room action is allowed
     * @param {string} sessionId
     * @param {string} ip
     * @returns {{allowed: boolean, reason?: string}}
     */
    checkRoomAction(sessionId, ip = null) {
        if (!this.enabled) return { allowed: true };
        
        const session = this.getSessionLimits(sessionId);
        
        // Check IP room operation window
        if (ip) {
            const ipLimits = this.getIPLimits(ip);
            if (!ipLimits.canPerformRoomOp()) {
                this.logViolation('roomAction', sessionId, ip, 'IP room ops window');
                ipLimits.recordViolation();
                return { allowed: false, reason: 'ip_room_limit' };
            }
            ipLimits.recordRoomOp();
            
            if (!ipLimits.global.tryConsume()) {
                return { allowed: false, reason: 'ip_rate_limit' };
            }
        }
        
        if (!session.roomAction.tryConsume()) {
            this.logViolation('roomAction', sessionId, ip, 'session room limit');
            session.recordViolation();
            return { allowed: false, reason: 'room_rate_limit' };
        }
        
        return { allowed: true };
    }
    
    /**
     * Check if a weapon switch is allowed
     * @param {string} sessionId
     * @param {string} ip
     * @returns {{allowed: boolean, reason?: string}}
     */
    checkWeaponSwitch(sessionId, ip = null) {
        if (!this.enabled) return { allowed: true };
        
        const session = this.getSessionLimits(sessionId);
        
        if (!session.weaponSwitch.tryConsume()) {
            return { allowed: false, reason: 'weapon_rate_limit' };
        }
        
        return { allowed: true };
    }
    
    /**
     * Check if a time sync ping is allowed
     * @param {string} sessionId
     * @returns {{allowed: boolean, reason?: string}}
     */
    checkTimeSync(sessionId) {
        if (!this.enabled) return { allowed: true };
        
        const session = this.getSessionLimits(sessionId);
        
        if (!session.timeSync.tryConsume()) {
            return { allowed: false, reason: 'timesync_rate_limit' };
        }
        
        return { allowed: true };
    }
    
    /**
     * Check if a state request is allowed
     * @param {string} sessionId
     * @returns {{allowed: boolean, reason?: string}}
     */
    checkStateRequest(sessionId) {
        if (!this.enabled) return { allowed: true };
        
        const session = this.getSessionLimits(sessionId);
        
        if (!session.stateRequest.tryConsume()) {
            return { allowed: false, reason: 'state_rate_limit' };
        }
        
        return { allowed: true };
    }
    
    /**
     * Check if a handshake/connection is allowed for an IP
     * @param {string} ip
     * @returns {{allowed: boolean, reason?: string}}
     */
    checkHandshake(ip) {
        if (!this.enabled) return { allowed: true };
        
        const ipLimits = this.getIPLimits(ip);
        
        // Check connection count
        if (!ipLimits.canConnect()) {
            this.logViolation('handshake', null, ip, 'max connections');
            ipLimits.recordViolation();
            return { allowed: false, reason: 'max_connections' };
        }
        
        // Check handshake rate
        if (!ipLimits.handshake.tryConsume()) {
            this.logViolation('handshake', null, ip, 'handshake rate');
            ipLimits.recordViolation();
            return { allowed: false, reason: 'handshake_rate_limit' };
        }
        
        return { allowed: true };
    }
    
    /**
     * Register a new connection
     * @param {string} sessionId
     * @param {string} ip
     */
    registerConnection(sessionId, ip) {
        this.getSessionLimits(sessionId);
        if (ip) {
            this.getIPLimits(ip).addConnection();
        }
    }
    
    /**
     * Unregister a connection
     * @param {string} sessionId
     * @param {string} ip
     */
    unregisterConnection(sessionId, ip) {
        this.sessionBuckets.delete(sessionId);
        if (ip) {
            const ipLimits = this.ipBuckets.get(ip);
            if (ipLimits) {
                ipLimits.removeConnection();
            }
        }
    }
    
    /**
     * Check if a session should be banned
     * @param {string} sessionId
     * @returns {boolean}
     */
    shouldBanSession(sessionId) {
        const session = this.sessionBuckets.get(sessionId);
        return session ? session.shouldBan() : false;
    }
    
    /**
     * Get session violation count
     * @param {string} sessionId
     * @returns {number}
     */
    getViolationCount(sessionId) {
        const session = this.sessionBuckets.get(sessionId);
        return session ? session.violations : 0;
    }
    
    /**
     * Log a rate limit violation
     * @param {string} action
     * @param {string} sessionId
     * @param {string} ip
     * @param {string} reason
     */
    logViolation(action, sessionId, ip, reason) {
        if (this.logViolations) {
            console.warn(`[RATE-LIMITER] Violation: action=${action}, session=${sessionId}, ip=${ip}, reason=${reason}`);
        }
    }
    
    /**
     * Cleanup expired buckets
     */
    cleanup() {
        const now = Date.now();
        let sessionsCleaned = 0;
        let ipsCleaned = 0;
        
        // Cleanup session buckets
        for (const [sessionId, limits] of this.sessionBuckets) {
            if (now - limits.lastActivity > CONNECTION_LIMITS.bucketExpiryMs) {
                this.sessionBuckets.delete(sessionId);
                sessionsCleaned++;
            }
        }
        
        // Cleanup IP buckets (only if no active connections)
        for (const [ip, limits] of this.ipBuckets) {
            if (limits.connectionCount === 0 && now - limits.lastActivity > CONNECTION_LIMITS.bucketExpiryMs) {
                this.ipBuckets.delete(ip);
                ipsCleaned++;
            }
        }
        
        if (sessionsCleaned > 0 || ipsCleaned > 0) {
            console.log(`[RATE-LIMITER] Cleanup: ${sessionsCleaned} sessions, ${ipsCleaned} IPs removed`);
        }
    }
    
    /**
     * Get statistics
     * @returns {object}
     */
    getStats() {
        return {
            enabled: this.enabled,
            activeSessions: this.sessionBuckets.size,
            activeIPs: this.ipBuckets.size,
            config: RATE_LIMITS,
            connectionLimits: CONNECTION_LIMITS
        };
    }
    
    /**
     * Shutdown the rate limiter
     */
    shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.sessionBuckets.clear();
        this.ipBuckets.clear();
        console.log('[RATE-LIMITER] Shutdown complete');
    }
}

// Singleton instance
const rateLimiter = new RateLimiter({ enabled: true });

module.exports = {
    RateLimiter,
    TokenBucket,
    SessionLimits,
    IPLimits,
    RATE_LIMITS,
    CONNECTION_LIMITS,
    rateLimiter
};

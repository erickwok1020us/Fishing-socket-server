/**
 * Session Manager - Secure Session Handling
 * 
 * Manages player sessions with:
 * - Unique session IDs
 * - Encryption keys per session
 * - HMAC keys per session
 * - Nonce tracking for replay protection
 * 
 * Security Requirements:
 * - Each session has unique encryption and HMAC keys
 * - Nonces must be monotonically increasing
 * - Sessions expire after inactivity
 * - All keys are derived using HKDF
 */

const crypto = require('crypto');
const { generateKey: generateAESKey } = require('../security/AES_GCM');
const { generateKey: generateHMACKey } = require('../security/HMAC');

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const NONCE_WINDOW_SIZE = 1000; // Allow some out-of-order packets

/**
 * Derive session keys using HKDF
 * @param {Buffer} masterSecret - Master secret from handshake
 * @param {string} sessionId - Session identifier
 * @returns {{encryptionKey: Buffer, hmacKey: Buffer}} Derived keys
 */
function deriveSessionKeys(masterSecret, sessionId) {
    const info = Buffer.from(`fish3d-session-${sessionId}`, 'utf8');
    const salt = crypto.randomBytes(32);
    
    // Use HKDF to derive keys
    const keyMaterial = crypto.hkdfSync('sha256', masterSecret, salt, info, 64);
    
    return {
        encryptionKey: keyMaterial.slice(0, 32),
        hmacKey: keyMaterial.slice(32, 64),
        salt
    };
}

/**
 * Session data structure
 */
class Session {
    constructor(sessionId, playerId, socketId) {
        this.sessionId = sessionId;
        this.playerId = playerId;
        this.socketId = socketId;
        
        // Generate session keys
        const masterSecret = crypto.randomBytes(32);
        const { encryptionKey, hmacKey, salt } = deriveSessionKeys(masterSecret, sessionId);
        
        this.encryptionKey = encryptionKey;
        this.hmacKey = hmacKey;
        this.salt = salt;
        
        // Nonce tracking
        this.lastClientNonce = BigInt(0);
        this.serverNonce = BigInt(0);
        this.recentNonces = new Set();
        
        // Timing
        this.createdAt = Date.now();
        this.lastActivityAt = Date.now();
        
        // Statistics
        this.packetsReceived = 0;
        this.packetsSent = 0;
        this.invalidPackets = 0;
        this.replayAttempts = 0;
    }
    
    /**
     * Get next server nonce
     * @returns {BigInt} Next nonce value
     */
    getNextServerNonce() {
        this.serverNonce++;
        return this.serverNonce;
    }
    
    /**
     * Validate client nonce (replay protection)
     * @param {BigInt} nonce - Client nonce
     * @returns {boolean} True if nonce is valid (not replayed)
     */
    validateClientNonce(nonce) {
        // Nonce must be greater than last seen (monotonically increasing)
        if (nonce <= this.lastClientNonce) {
            // Check if it's in the recent window (allow some out-of-order)
            if (this.recentNonces.has(nonce.toString())) {
                this.replayAttempts++;
                return false;
            }
        }
        
        // Update tracking
        this.lastClientNonce = nonce > this.lastClientNonce ? nonce : this.lastClientNonce;
        this.recentNonces.add(nonce.toString());
        
        // Prune old nonces from window
        if (this.recentNonces.size > NONCE_WINDOW_SIZE) {
            const oldestAllowed = this.lastClientNonce - BigInt(NONCE_WINDOW_SIZE);
            for (const n of this.recentNonces) {
                if (BigInt(n) < oldestAllowed) {
                    this.recentNonces.delete(n);
                }
            }
        }
        
        return true;
    }
    
    /**
     * Update last activity time
     */
    touch() {
        this.lastActivityAt = Date.now();
    }
    
    /**
     * Check if session has expired
     * @returns {boolean} True if expired
     */
    isExpired() {
        return Date.now() - this.lastActivityAt > SESSION_TIMEOUT_MS;
    }
    
    /**
     * Get session statistics
     * @returns {Object} Session stats
     */
    getStats() {
        return {
            sessionId: this.sessionId,
            playerId: this.playerId,
            packetsReceived: this.packetsReceived,
            packetsSent: this.packetsSent,
            invalidPackets: this.invalidPackets,
            replayAttempts: this.replayAttempts,
            sessionAge: Date.now() - this.createdAt,
            lastActivity: Date.now() - this.lastActivityAt
        };
    }
}

/**
 * Session Manager
 */
class SessionManager {
    constructor() {
        this.sessions = new Map(); // sessionId -> Session
        this.socketToSession = new Map(); // socketId -> sessionId
        this.playerToSession = new Map(); // playerId -> sessionId
        
        // Start cleanup interval
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }
    
    /**
     * Create a new session
     * @param {string} playerId - Player identifier
     * @param {string} socketId - Socket identifier
     * @returns {Session} New session
     */
    createSession(playerId, socketId) {
        const sessionId = crypto.randomUUID();
        const session = new Session(sessionId, playerId, socketId);
        
        this.sessions.set(sessionId, session);
        this.socketToSession.set(socketId, sessionId);
        this.playerToSession.set(playerId, sessionId);
        
        console.log(`[SESSION] Created session ${sessionId} for player ${playerId}`);
        
        return session;
    }
    
    /**
     * Get session by session ID
     * @param {string} sessionId - Session identifier
     * @returns {Session|null} Session or null
     */
    getSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session && !session.isExpired()) {
            return session;
        }
        return null;
    }
    
    /**
     * Get session by socket ID
     * @param {string} socketId - Socket identifier
     * @returns {Session|null} Session or null
     */
    getSessionBySocket(socketId) {
        const sessionId = this.socketToSession.get(socketId);
        if (sessionId) {
            return this.getSession(sessionId);
        }
        return null;
    }
    
    /**
     * Get session by player ID
     * @param {string} playerId - Player identifier
     * @returns {Session|null} Session or null
     */
    getSessionByPlayer(playerId) {
        const sessionId = this.playerToSession.get(playerId);
        if (sessionId) {
            return this.getSession(sessionId);
        }
        return null;
    }
    
    /**
     * Destroy a session
     * @param {string} sessionId - Session identifier
     */
    destroySession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            this.socketToSession.delete(session.socketId);
            this.playerToSession.delete(session.playerId);
            this.sessions.delete(sessionId);
            console.log(`[SESSION] Destroyed session ${sessionId}`);
        }
    }
    
    /**
     * Destroy session by socket ID
     * @param {string} socketId - Socket identifier
     */
    destroySessionBySocket(socketId) {
        const sessionId = this.socketToSession.get(socketId);
        if (sessionId) {
            this.destroySession(sessionId);
        }
    }
    
    /**
     * Clean up expired sessions
     */
    cleanup() {
        let cleaned = 0;
        for (const [sessionId, session] of this.sessions) {
            if (session.isExpired()) {
                this.destroySession(sessionId);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            console.log(`[SESSION] Cleaned up ${cleaned} expired sessions`);
        }
    }
    
    /**
     * Get all active sessions count
     * @returns {number} Active session count
     */
    getActiveSessionCount() {
        return this.sessions.size;
    }
    
    /**
     * Get all session statistics
     * @returns {Array} Array of session stats
     */
    getAllStats() {
        const stats = [];
        for (const session of this.sessions.values()) {
            stats.push(session.getStats());
        }
        return stats;
    }
    
    /**
     * Shutdown session manager
     */
    shutdown() {
        clearInterval(this.cleanupInterval);
        this.sessions.clear();
        this.socketToSession.clear();
        this.playerToSession.clear();
        console.log('[SESSION] Session manager shutdown');
    }
}

// Singleton instance
const sessionManager = new SessionManager();

module.exports = {
    Session,
    SessionManager,
    sessionManager,
    deriveSessionKeys,
    SESSION_TIMEOUT_MS,
    NONCE_WINDOW_SIZE
};

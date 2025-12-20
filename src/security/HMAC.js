/**
 * HMAC-SHA256 Message Authentication Module
 * 
 * Provides message integrity verification for game packets.
 * Used to ensure packets haven't been tampered with in transit.
 * 
 * Security Requirements:
 * - 256-bit key derived from session handshake
 * - HMAC computed over entire packet (including nonce)
 * - Verification must be constant-time to prevent timing attacks
 */

const crypto = require('crypto');

const ALGORITHM = 'sha256';
const KEY_LENGTH = 32; // 256 bits
const HMAC_LENGTH = 32; // SHA-256 produces 256-bit (32 byte) output

/**
 * Generate a new HMAC key
 * @returns {Buffer} 256-bit key
 */
function generateKey() {
    return crypto.randomBytes(KEY_LENGTH);
}

/**
 * Compute HMAC-SHA256 of data
 * 
 * @param {Buffer|string} data - Data to authenticate
 * @param {Buffer} key - 256-bit HMAC key
 * @returns {Buffer} 256-bit HMAC
 */
function computeHMAC(data, key) {
    if (typeof data === 'string') {
        data = Buffer.from(data, 'utf8');
    }
    
    if (key.length !== KEY_LENGTH) {
        throw new Error(`Invalid key length: expected ${KEY_LENGTH}, got ${key.length}`);
    }
    
    const hmac = crypto.createHmac(ALGORITHM, key);
    hmac.update(data);
    return hmac.digest();
}

/**
 * Verify HMAC-SHA256 of data (constant-time comparison)
 * 
 * @param {Buffer|string} data - Data to verify
 * @param {Buffer} key - 256-bit HMAC key
 * @param {Buffer} expectedHMAC - Expected HMAC value
 * @returns {boolean} True if HMAC is valid
 */
function verifyHMAC(data, key, expectedHMAC) {
    if (expectedHMAC.length !== HMAC_LENGTH) {
        return false;
    }
    
    const computedHMAC = computeHMAC(data, key);
    
    // Use constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(computedHMAC, expectedHMAC);
}

/**
 * Sign data by appending HMAC
 * Format: [data][HMAC (32 bytes)]
 * 
 * @param {Buffer|string} data - Data to sign
 * @param {Buffer} key - 256-bit HMAC key
 * @returns {Buffer} Data with appended HMAC
 */
function sign(data, key) {
    if (typeof data === 'string') {
        data = Buffer.from(data, 'utf8');
    }
    
    const hmac = computeHMAC(data, key);
    return Buffer.concat([data, hmac]);
}

/**
 * Verify and extract data from signed buffer
 * 
 * @param {Buffer} signedData - Data with appended HMAC
 * @param {Buffer} key - 256-bit HMAC key
 * @returns {{valid: boolean, data: Buffer|null}} Verification result and extracted data
 */
function verifyAndExtract(signedData, key) {
    if (signedData.length < HMAC_LENGTH) {
        return { valid: false, data: null };
    }
    
    const data = signedData.slice(0, -HMAC_LENGTH);
    const hmac = signedData.slice(-HMAC_LENGTH);
    
    const valid = verifyHMAC(data, key, hmac);
    
    return {
        valid,
        data: valid ? data : null
    };
}

/**
 * Create a signed JSON message
 * 
 * @param {Object} data - JSON-serializable data
 * @param {Buffer} key - 256-bit HMAC key
 * @returns {Buffer} Signed data
 */
function signJSON(data, key) {
    const json = JSON.stringify(data);
    return sign(json, key);
}

/**
 * Verify and parse signed JSON message
 * 
 * @param {Buffer} signedData - Signed data
 * @param {Buffer} key - 256-bit HMAC key
 * @returns {{valid: boolean, data: Object|null}} Verification result and parsed data
 */
function verifyAndParseJSON(signedData, key) {
    const result = verifyAndExtract(signedData, key);
    
    if (!result.valid) {
        return { valid: false, data: null };
    }
    
    try {
        const data = JSON.parse(result.data.toString('utf8'));
        return { valid: true, data };
    } catch (err) {
        return { valid: false, data: null };
    }
}

/**
 * Compute HMAC for packet with nonce (for replay protection)
 * The nonce is included in the HMAC computation
 * 
 * @param {Buffer} packetData - Packet data
 * @param {Buffer} nonce - Packet nonce (8 bytes typically)
 * @param {Buffer} key - 256-bit HMAC key
 * @returns {Buffer} HMAC including nonce
 */
function computePacketHMAC(packetData, nonce, key) {
    const combined = Buffer.concat([nonce, packetData]);
    return computeHMAC(combined, key);
}

/**
 * Verify packet HMAC with nonce
 * 
 * @param {Buffer} packetData - Packet data
 * @param {Buffer} nonce - Packet nonce
 * @param {Buffer} key - 256-bit HMAC key
 * @param {Buffer} expectedHMAC - Expected HMAC
 * @returns {boolean} True if valid
 */
function verifyPacketHMAC(packetData, nonce, key, expectedHMAC) {
    const combined = Buffer.concat([nonce, packetData]);
    return verifyHMAC(combined, key, expectedHMAC);
}

module.exports = {
    ALGORITHM,
    KEY_LENGTH,
    HMAC_LENGTH,
    generateKey,
    computeHMAC,
    verifyHMAC,
    sign,
    verifyAndExtract,
    signJSON,
    verifyAndParseJSON,
    computePacketHMAC,
    verifyPacketHMAC
};

/**
 * AES-256-GCM Encryption Module
 * 
 * Provides symmetric encryption for game packets.
 * Uses AES-256-GCM for authenticated encryption.
 * 
 * Security Requirements:
 * - 256-bit key derived from session handshake
 * - 96-bit (12 byte) nonce, never reused
 * - 128-bit authentication tag
 * - Nonce is prepended to ciphertext
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const NONCE_LENGTH = 12; // 96 bits (recommended for GCM)
const TAG_LENGTH = 16; // 128 bits

/**
 * Generate a new AES-256 key
 * @returns {Buffer} 256-bit key
 */
function generateKey() {
    return crypto.randomBytes(KEY_LENGTH);
}

/**
 * Generate a unique nonce
 * @returns {Buffer} 96-bit nonce
 */
function generateNonce() {
    return crypto.randomBytes(NONCE_LENGTH);
}

/**
 * Encrypt data using AES-256-GCM
 * 
 * @param {Buffer|string} plaintext - Data to encrypt
 * @param {Buffer} key - 256-bit encryption key
 * @param {Buffer} [additionalData] - Additional authenticated data (AAD)
 * @returns {{ciphertext: Buffer, nonce: Buffer, tag: Buffer}} Encrypted data with nonce and auth tag
 */
function encrypt(plaintext, key, additionalData = null) {
    if (typeof plaintext === 'string') {
        plaintext = Buffer.from(plaintext, 'utf8');
    }
    
    if (key.length !== KEY_LENGTH) {
        throw new Error(`Invalid key length: expected ${KEY_LENGTH}, got ${key.length}`);
    }
    
    const nonce = generateNonce();
    const cipher = crypto.createCipheriv(ALGORITHM, key, nonce, {
        authTagLength: TAG_LENGTH
    });
    
    if (additionalData) {
        cipher.setAAD(additionalData);
    }
    
    const ciphertext = Buffer.concat([
        cipher.update(plaintext),
        cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();
    
    return {
        ciphertext,
        nonce,
        tag
    };
}

/**
 * Decrypt data using AES-256-GCM
 * 
 * @param {Buffer} ciphertext - Encrypted data
 * @param {Buffer} key - 256-bit encryption key
 * @param {Buffer} nonce - 96-bit nonce used for encryption
 * @param {Buffer} tag - 128-bit authentication tag
 * @param {Buffer} [additionalData] - Additional authenticated data (AAD)
 * @returns {Buffer} Decrypted plaintext
 * @throws {Error} If authentication fails
 */
function decrypt(ciphertext, key, nonce, tag, additionalData = null) {
    if (key.length !== KEY_LENGTH) {
        throw new Error(`Invalid key length: expected ${KEY_LENGTH}, got ${key.length}`);
    }
    
    if (nonce.length !== NONCE_LENGTH) {
        throw new Error(`Invalid nonce length: expected ${NONCE_LENGTH}, got ${nonce.length}`);
    }
    
    if (tag.length !== TAG_LENGTH) {
        throw new Error(`Invalid tag length: expected ${TAG_LENGTH}, got ${tag.length}`);
    }
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, nonce, {
        authTagLength: TAG_LENGTH
    });
    
    decipher.setAuthTag(tag);
    
    if (additionalData) {
        decipher.setAAD(additionalData);
    }
    
    try {
        const plaintext = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final()
        ]);
        return plaintext;
    } catch (err) {
        throw new Error('Authentication failed: ciphertext has been tampered with');
    }
}

/**
 * Encrypt and pack data into a single buffer
 * Format: [nonce (12 bytes)][tag (16 bytes)][ciphertext (variable)]
 * 
 * @param {Buffer|string} plaintext - Data to encrypt
 * @param {Buffer} key - 256-bit encryption key
 * @param {Buffer} [additionalData] - Additional authenticated data
 * @returns {Buffer} Packed encrypted data
 */
function encryptPacked(plaintext, key, additionalData = null) {
    const { ciphertext, nonce, tag } = encrypt(plaintext, key, additionalData);
    return Buffer.concat([nonce, tag, ciphertext]);
}

/**
 * Unpack and decrypt data from a single buffer
 * 
 * @param {Buffer} packed - Packed encrypted data
 * @param {Buffer} key - 256-bit encryption key
 * @param {Buffer} [additionalData] - Additional authenticated data
 * @returns {Buffer} Decrypted plaintext
 */
function decryptPacked(packed, key, additionalData = null) {
    if (packed.length < NONCE_LENGTH + TAG_LENGTH) {
        throw new Error('Packed data too short');
    }
    
    const nonce = packed.slice(0, NONCE_LENGTH);
    const tag = packed.slice(NONCE_LENGTH, NONCE_LENGTH + TAG_LENGTH);
    const ciphertext = packed.slice(NONCE_LENGTH + TAG_LENGTH);
    
    return decrypt(ciphertext, key, nonce, tag, additionalData);
}

/**
 * Encrypt JSON data
 * 
 * @param {Object} data - JSON-serializable data
 * @param {Buffer} key - 256-bit encryption key
 * @returns {Buffer} Packed encrypted data
 */
function encryptJSON(data, key) {
    const json = JSON.stringify(data);
    return encryptPacked(json, key);
}

/**
 * Decrypt JSON data
 * 
 * @param {Buffer} packed - Packed encrypted data
 * @param {Buffer} key - 256-bit encryption key
 * @returns {Object} Decrypted JSON data
 */
function decryptJSON(packed, key) {
    const plaintext = decryptPacked(packed, key);
    return JSON.parse(plaintext.toString('utf8'));
}

module.exports = {
    ALGORITHM,
    KEY_LENGTH,
    NONCE_LENGTH,
    TAG_LENGTH,
    generateKey,
    generateNonce,
    encrypt,
    decrypt,
    encryptPacked,
    decryptPacked,
    encryptJSON,
    decryptJSON
};

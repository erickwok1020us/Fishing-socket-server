/**
 * HKDF (HMAC-based Key Derivation Function) Implementation
 * 
 * Implements RFC 5869 HKDF with SHA-256 for deriving session keys from ECDH shared secrets.
 * Used for certification-compliant key derivation in the binary WebSocket protocol.
 * 
 * Key Derivation Flow:
 * 1. Client generates ephemeral ECDH keypair (P-256)
 * 2. Server generates ephemeral ECDH keypair (P-256)
 * 3. Both compute shared secret via ECDH
 * 4. Run HKDF-SHA256 to derive session keys:
 *    - IKM = sharedSecret
 *    - salt = random 32 bytes
 *    - info = transcriptHash || "fishshoot-v2 session keys"
 *    - output = 64 bytes (first 32 = AES key, next 32 = HMAC key)
 */

const crypto = require('crypto');

const HASH_ALGORITHM = 'sha256';
const HASH_LENGTH = 32;
const CURVE_NAME = 'prime256v1';
const INFO_PREFIX = 'fishshoot-v2 session keys';

function hkdfExtract(salt, ikm) {
    if (!salt || salt.length === 0) {
        salt = Buffer.alloc(HASH_LENGTH, 0);
    }
    const hmac = crypto.createHmac(HASH_ALGORITHM, salt);
    hmac.update(ikm);
    return hmac.digest();
}

function hkdfExpand(prk, info, length) {
    const hashLen = HASH_LENGTH;
    const n = Math.ceil(length / hashLen);
    
    if (n > 255) {
        throw new Error('HKDF: Cannot expand to more than 255 * HashLen bytes');
    }
    
    let okm = Buffer.alloc(0);
    let t = Buffer.alloc(0);
    
    for (let i = 1; i <= n; i++) {
        const hmac = crypto.createHmac(HASH_ALGORITHM, prk);
        hmac.update(Buffer.concat([t, info, Buffer.from([i])]));
        t = hmac.digest();
        okm = Buffer.concat([okm, t]);
    }
    
    return okm.slice(0, length);
}

function hkdf(ikm, salt, info, length) {
    const prk = hkdfExtract(salt, ikm);
    return hkdfExpand(prk, info, length);
}

function generateECDHKeyPair() {
    const ecdh = crypto.createECDH(CURVE_NAME);
    ecdh.generateKeys();
    return {
        publicKey: ecdh.getPublicKey(),
        privateKey: ecdh.getPrivateKey(),
        ecdh: ecdh
    };
}

function computeSharedSecret(privateKey, otherPublicKey) {
    const ecdh = crypto.createECDH(CURVE_NAME);
    ecdh.setPrivateKey(privateKey);
    return ecdh.computeSecret(otherPublicKey);
}

function computeTranscriptHash(clientPublicKey, serverPublicKey, clientNonce, serverNonce, protocolVersion) {
    const hash = crypto.createHash(HASH_ALGORITHM);
    hash.update(clientPublicKey);
    hash.update(serverPublicKey);
    hash.update(clientNonce);
    hash.update(serverNonce);
    hash.update(Buffer.from([protocolVersion]));
    return hash.digest();
}

function deriveSessionKeys(sharedSecret, salt, transcriptHash) {
    const info = Buffer.concat([
        transcriptHash,
        Buffer.from(INFO_PREFIX, 'utf8')
    ]);
    
    const keyMaterial = hkdf(sharedSecret, salt, info, 64);
    
    return {
        encryptionKey: keyMaterial.slice(0, 32),
        hmacKey: keyMaterial.slice(32, 64)
    };
}

function performServerHandshake(clientPublicKey, clientNonce, protocolVersion) {
    const serverKeyPair = generateECDHKeyPair();
    const serverNonce = crypto.randomBytes(32);
    const salt = crypto.randomBytes(32);
    
    const sharedSecret = computeSharedSecret(serverKeyPair.privateKey, clientPublicKey);
    
    const transcriptHash = computeTranscriptHash(
        clientPublicKey,
        serverKeyPair.publicKey,
        clientNonce,
        serverNonce,
        protocolVersion
    );
    
    const sessionKeys = deriveSessionKeys(sharedSecret, salt, transcriptHash);
    
    return {
        serverPublicKey: serverKeyPair.publicKey,
        serverNonce: serverNonce,
        salt: salt,
        encryptionKey: sessionKeys.encryptionKey,
        hmacKey: sessionKeys.hmacKey,
        transcriptHash: transcriptHash
    };
}

function performClientKeyDerivation(clientPrivateKey, clientPublicKey, clientNonce, serverPublicKey, serverNonce, salt, protocolVersion) {
    const sharedSecret = computeSharedSecret(clientPrivateKey, serverPublicKey);
    
    const transcriptHash = computeTranscriptHash(
        clientPublicKey,
        serverPublicKey,
        clientNonce,
        serverNonce,
        protocolVersion
    );
    
    const sessionKeys = deriveSessionKeys(sharedSecret, salt, transcriptHash);
    
    return {
        encryptionKey: sessionKeys.encryptionKey,
        hmacKey: sessionKeys.hmacKey,
        transcriptHash: transcriptHash
    };
}

function verifyKeyDerivation(clientKeys, serverKeys) {
    return crypto.timingSafeEqual(clientKeys.encryptionKey, serverKeys.encryptionKey) &&
           crypto.timingSafeEqual(clientKeys.hmacKey, serverKeys.hmacKey);
}

module.exports = {
    HASH_ALGORITHM,
    HASH_LENGTH,
    CURVE_NAME,
    INFO_PREFIX,
    hkdfExtract,
    hkdfExpand,
    hkdf,
    generateECDHKeyPair,
    computeSharedSecret,
    computeTranscriptHash,
    deriveSessionKeys,
    performServerHandshake,
    performClientKeyDerivation,
    verifyKeyDerivation
};

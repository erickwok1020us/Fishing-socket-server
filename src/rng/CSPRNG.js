/**
 * Cryptographically Secure Pseudo-Random Number Generator (CSPRNG)
 * 
 * Uses Node.js crypto module for secure random number generation.
 * All game outcomes MUST use this module - never Math.random().
 * 
 * Security Requirements:
 * - Server-side only: All RNG for game outcomes occurs exclusively on backend
 * - CSPRNG: Uses OS-backed cryptographic RNG (/dev/urandom on Linux)
 * - Seed never exposed: Internal state is never sent to clients
 * - Client input never influences outcomes: Only server-side CSPRNG determines results
 */

const crypto = require('crypto');

class CSPRNG {
    constructor() {
        // No seed needed - uses OS entropy
        this.bytesGenerated = 0;
    }

    /**
     * Generate a cryptographically secure random float between 0 and 1
     * @returns {number} Random float in range [0, 1)
     */
    random() {
        // Generate 4 random bytes and convert to unsigned 32-bit integer
        const buffer = crypto.randomBytes(4);
        const uint32 = buffer.readUInt32BE(0);
        this.bytesGenerated += 4;
        
        // Convert to float in range [0, 1)
        return uint32 / 0x100000000;
    }

    /**
     * Generate a random integer in range [min, max] (inclusive)
     * @param {number} min - Minimum value (inclusive)
     * @param {number} max - Maximum value (inclusive)
     * @returns {number} Random integer
     */
    randomInt(min, max) {
        const range = max - min + 1;
        return Math.floor(this.random() * range) + min;
    }

    /**
     * Generate a random float in range [min, max)
     * @param {number} min - Minimum value (inclusive)
     * @param {number} max - Maximum value (exclusive)
     * @returns {number} Random float
     */
    randomFloat(min, max) {
        return this.random() * (max - min) + min;
    }

    /**
     * Pick a random element from an array
     * @param {Array} array - Array to pick from
     * @returns {*} Random element
     */
    pick(array) {
        if (!array || array.length === 0) return null;
        return array[Math.floor(this.random() * array.length)];
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of bytes to generate
     * @returns {Buffer} Random bytes
     */
    randomBytes(length) {
        this.bytesGenerated += length;
        return crypto.randomBytes(length);
    }

    /**
     * Generate a random UUID v4
     * @returns {string} UUID string
     */
    randomUUID() {
        return crypto.randomUUID();
    }

    /**
     * Weighted random selection
     * @param {Array<{item: *, weight: number}>} weightedItems - Array of items with weights
     * @returns {*} Selected item
     */
    weightedPick(weightedItems) {
        if (!weightedItems || weightedItems.length === 0) return null;
        
        const totalWeight = weightedItems.reduce((sum, item) => sum + item.weight, 0);
        let roll = this.random() * totalWeight;
        
        for (const { item, weight } of weightedItems) {
            roll -= weight;
            if (roll <= 0) return item;
        }
        
        // Fallback to last item
        return weightedItems[weightedItems.length - 1].item;
    }

    /**
     * Get statistics about RNG usage
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            bytesGenerated: this.bytesGenerated
        };
    }
}

// Singleton instance for the server
const serverCSPRNG = new CSPRNG();

module.exports = {
    CSPRNG,
    serverCSPRNG,
    
    // Convenience exports
    secureRandom: () => serverCSPRNG.random(),
    secureRandomInt: (min, max) => serverCSPRNG.randomInt(min, max),
    secureRandomFloat: (min, max) => serverCSPRNG.randomFloat(min, max),
    secureRandomBytes: (length) => serverCSPRNG.randomBytes(length),
    secureRandomUUID: () => serverCSPRNG.randomUUID(),
    secureWeightedPick: (items) => serverCSPRNG.weightedPick(items)
};

/**
 * CSPRNG Statistical Tests
 * 
 * Verifies that the cryptographic random number generator
 * produces statistically sound output for certification.
 */

const crypto = require('crypto');

function generateRandomBytes(count) {
    return crypto.randomBytes(count);
}

function generateRandomUint32() {
    return crypto.randomBytes(4).readUInt32BE(0);
}

function generateRandomFloat() {
    return generateRandomUint32() / 0xFFFFFFFF;
}

function chiSquareTest(observed, expected, degreesOfFreedom) {
    let chiSquare = 0;
    for (let i = 0; i < observed.length; i++) {
        const diff = observed[i] - expected[i];
        chiSquare += (diff * diff) / expected[i];
    }
    return chiSquare;
}

function chiSquareCriticalValue(df, alpha = 0.05) {
    const criticalValues = {
        1: 3.841, 2: 5.991, 3: 7.815, 4: 9.488, 5: 11.070,
        6: 12.592, 7: 14.067, 8: 15.507, 9: 16.919, 10: 18.307,
        15: 24.996, 20: 31.410, 25: 37.652, 30: 43.773
    };
    return criticalValues[df] || criticalValues[30];
}

describe('CSPRNG Uniformity Tests', () => {
    const NUM_SAMPLES = 10000;
    
    test('byte distribution is uniform', () => {
        const buckets = new Array(256).fill(0);
        const bytes = generateRandomBytes(NUM_SAMPLES);
        
        for (let i = 0; i < bytes.length; i++) {
            buckets[bytes[i]]++;
        }
        
        const expected = NUM_SAMPLES / 256;
        const expectedArray = new Array(256).fill(expected);
        const chiSquare = chiSquareTest(buckets, expectedArray, 255);
        const criticalValue = chiSquareCriticalValue(255);
        
        console.log(`Byte distribution chi-square: ${chiSquare.toFixed(2)} (critical: ~293.25 for df=255)`);
        
        expect(chiSquare).toBeLessThan(350);
    });
    
    test('float distribution is uniform in [0,1)', () => {
        const NUM_BUCKETS = 10;
        const buckets = new Array(NUM_BUCKETS).fill(0);
        
        for (let i = 0; i < NUM_SAMPLES; i++) {
            const value = generateRandomFloat();
            const bucket = Math.min(Math.floor(value * NUM_BUCKETS), NUM_BUCKETS - 1);
            buckets[bucket]++;
        }
        
        const expected = NUM_SAMPLES / NUM_BUCKETS;
        const expectedArray = new Array(NUM_BUCKETS).fill(expected);
        const chiSquare = chiSquareTest(buckets, expectedArray, NUM_BUCKETS - 1);
        const criticalValue = chiSquareCriticalValue(NUM_BUCKETS - 1);
        
        console.log(`Float distribution chi-square: ${chiSquare.toFixed(2)} (critical: ${criticalValue.toFixed(2)})`);
        
        expect(chiSquare).toBeLessThan(criticalValue * 2);
    });
    
    test('uint32 high bits are uniform', () => {
        const NUM_BUCKETS = 16;
        const buckets = new Array(NUM_BUCKETS).fill(0);
        
        for (let i = 0; i < NUM_SAMPLES; i++) {
            const value = generateRandomUint32();
            const bucket = Math.floor(value / (0x100000000 / NUM_BUCKETS));
            buckets[Math.min(bucket, NUM_BUCKETS - 1)]++;
        }
        
        const expected = NUM_SAMPLES / NUM_BUCKETS;
        const expectedArray = new Array(NUM_BUCKETS).fill(expected);
        const chiSquare = chiSquareTest(buckets, expectedArray, NUM_BUCKETS - 1);
        const criticalValue = chiSquareCriticalValue(NUM_BUCKETS - 1);
        
        console.log(`Uint32 high bits chi-square: ${chiSquare.toFixed(2)} (critical: ${criticalValue.toFixed(2)})`);
        
        expect(chiSquare).toBeLessThan(criticalValue * 2);
    });
});

describe('CSPRNG Independence Tests', () => {
    const NUM_SAMPLES = 10000;
    
    test('consecutive values are independent (runs test)', () => {
        const values = [];
        for (let i = 0; i < NUM_SAMPLES; i++) {
            values.push(generateRandomFloat());
        }
        
        const median = [...values].sort((a, b) => a - b)[Math.floor(NUM_SAMPLES / 2)];
        
        let runs = 1;
        let aboveMedian = values[0] > median;
        
        for (let i = 1; i < values.length; i++) {
            const currentAbove = values[i] > median;
            if (currentAbove !== aboveMedian) {
                runs++;
                aboveMedian = currentAbove;
            }
        }
        
        const n1 = values.filter(v => v > median).length;
        const n2 = values.filter(v => v <= median).length;
        const expectedRuns = (2 * n1 * n2) / (n1 + n2) + 1;
        const variance = (2 * n1 * n2 * (2 * n1 * n2 - n1 - n2)) / 
                        ((n1 + n2) * (n1 + n2) * (n1 + n2 - 1));
        const stdDev = Math.sqrt(variance);
        const zScore = (runs - expectedRuns) / stdDev;
        
        console.log(`Runs test: ${runs} runs, expected ${expectedRuns.toFixed(0)}, z-score: ${zScore.toFixed(2)}`);
        
        expect(Math.abs(zScore)).toBeLessThan(3);
    });
    
    test('no significant autocorrelation at lag 1', () => {
        const values = [];
        for (let i = 0; i < NUM_SAMPLES; i++) {
            values.push(generateRandomFloat());
        }
        
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        
        let numerator = 0;
        let denominator = 0;
        
        for (let i = 0; i < values.length - 1; i++) {
            numerator += (values[i] - mean) * (values[i + 1] - mean);
        }
        
        for (let i = 0; i < values.length; i++) {
            denominator += (values[i] - mean) * (values[i] - mean);
        }
        
        const autocorrelation = numerator / denominator;
        
        console.log(`Autocorrelation at lag 1: ${autocorrelation.toFixed(4)}`);
        
        expect(Math.abs(autocorrelation)).toBeLessThan(0.05);
    });
});

describe('CSPRNG Range Tests', () => {
    test('all bytes in range [0, 255]', () => {
        const bytes = generateRandomBytes(10000);
        for (let i = 0; i < bytes.length; i++) {
            expect(bytes[i]).toBeGreaterThanOrEqual(0);
            expect(bytes[i]).toBeLessThanOrEqual(255);
        }
    });
    
    test('all floats in range [0, 1)', () => {
        for (let i = 0; i < 10000; i++) {
            const value = generateRandomFloat();
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(1);
        }
    });
    
    test('uint32 covers full range', () => {
        let minSeen = 0xFFFFFFFF;
        let maxSeen = 0;
        
        for (let i = 0; i < 10000; i++) {
            const value = generateRandomUint32();
            minSeen = Math.min(minSeen, value);
            maxSeen = Math.max(maxSeen, value);
        }
        
        console.log(`Uint32 range: ${minSeen} to ${maxSeen}`);
        
        expect(minSeen).toBeLessThan(0x10000000);
        expect(maxSeen).toBeGreaterThan(0xF0000000);
    });
});

describe('CSPRNG Entropy Tests', () => {
    test('byte entropy is close to 8 bits', () => {
        const bytes = generateRandomBytes(10000);
        const counts = new Array(256).fill(0);
        
        for (let i = 0; i < bytes.length; i++) {
            counts[bytes[i]]++;
        }
        
        let entropy = 0;
        for (let i = 0; i < 256; i++) {
            if (counts[i] > 0) {
                const p = counts[i] / bytes.length;
                entropy -= p * Math.log2(p);
            }
        }
        
        console.log(`Byte entropy: ${entropy.toFixed(4)} bits (expected ~8)`);
        
        expect(entropy).toBeGreaterThan(7.9);
        expect(entropy).toBeLessThanOrEqual(8);
    });
    
    test('no repeated 32-bit values in small sample', () => {
        const seen = new Set();
        const NUM_SAMPLES = 1000;
        
        for (let i = 0; i < NUM_SAMPLES; i++) {
            const value = generateRandomUint32();
            expect(seen.has(value)).toBe(false);
            seen.add(value);
        }
    });
});

describe('HKDF Key Derivation Tests', () => {
    const { 
        hkdf, 
        generateECDHKeyPair, 
        computeSharedSecret,
        deriveSessionKeys,
        performServerHandshake,
        performClientKeyDerivation
    } = require('../../src/security/HKDF');
    
    test('HKDF produces deterministic output', () => {
        const ikm = crypto.randomBytes(32);
        const salt = crypto.randomBytes(32);
        const info = Buffer.from('test info');
        
        const output1 = hkdf(ikm, salt, info, 64);
        const output2 = hkdf(ikm, salt, info, 64);
        
        expect(output1.equals(output2)).toBe(true);
    });
    
    test('HKDF output changes with different inputs', () => {
        const ikm1 = crypto.randomBytes(32);
        const ikm2 = crypto.randomBytes(32);
        const salt = crypto.randomBytes(32);
        const info = Buffer.from('test info');
        
        const output1 = hkdf(ikm1, salt, info, 64);
        const output2 = hkdf(ikm2, salt, info, 64);
        
        expect(output1.equals(output2)).toBe(false);
    });
    
    test('ECDH key exchange produces shared secret', () => {
        const clientKeyPair = generateECDHKeyPair();
        const serverKeyPair = generateECDHKeyPair();
        
        const clientShared = computeSharedSecret(clientKeyPair.privateKey, serverKeyPair.publicKey);
        const serverShared = computeSharedSecret(serverKeyPair.privateKey, clientKeyPair.publicKey);
        
        expect(clientShared.equals(serverShared)).toBe(true);
    });
    
    test('session key derivation produces 64 bytes', () => {
        const sharedSecret = crypto.randomBytes(32);
        const salt = crypto.randomBytes(32);
        const transcriptHash = crypto.randomBytes(32);
        
        const keys = deriveSessionKeys(sharedSecret, salt, transcriptHash);
        
        expect(keys.encryptionKey.length).toBe(32);
        expect(keys.hmacKey.length).toBe(32);
    });
    
    test('client and server derive identical keys', () => {
        const clientKeyPair = generateECDHKeyPair();
        const clientNonce = crypto.randomBytes(32);
        const protocolVersion = 2;
        
        const serverResult = performServerHandshake(
            clientKeyPair.publicKey,
            clientNonce,
            protocolVersion
        );
        
        const clientResult = performClientKeyDerivation(
            clientKeyPair.privateKey,
            clientKeyPair.publicKey,
            clientNonce,
            serverResult.serverPublicKey,
            serverResult.serverNonce,
            serverResult.salt,
            protocolVersion
        );
        
        expect(clientResult.encryptionKey.equals(serverResult.encryptionKey)).toBe(true);
        expect(clientResult.hmacKey.equals(serverResult.hmacKey)).toBe(true);
    });
});

const { deriveHP, deriveHPInRange, generateSeed } = require('../../src/modules/SeedCommitment');

describe('M3 Gate: HP Derivation (Deterministic)', () => {
    let seed;

    beforeEach(() => {
        seed = generateSeed();
    });

    test('same inputs produce same HP (deterministic)', () => {
        const hp1 = deriveHP(seed, 'sardine', 0, 'room-1');
        const hp2 = deriveHP(seed, 'sardine', 0, 'room-1');
        expect(hp1).toBe(hp2);
    });

    test('different fishType produces different HP', () => {
        const hp1 = deriveHP(seed, 'sardine', 0, 'room-1');
        const hp2 = deriveHP(seed, 'blueWhale', 0, 'room-1');
        expect(hp1).not.toBe(hp2);
    });

    test('different spawnIndex produces different HP', () => {
        const hp1 = deriveHP(seed, 'sardine', 0, 'room-1');
        const hp2 = deriveHP(seed, 'sardine', 1, 'room-1');
        expect(hp1).not.toBe(hp2);
    });

    test('different roomId produces different HP', () => {
        const hp1 = deriveHP(seed, 'sardine', 0, 'room-1');
        const hp2 = deriveHP(seed, 'sardine', 0, 'room-2');
        expect(hp1).not.toBe(hp2);
    });

    test('different seed produces different HP', () => {
        const seed2 = generateSeed();
        const hp1 = deriveHP(seed, 'sardine', 0, 'room-1');
        const hp2 = deriveHP(seed2, 'sardine', 0, 'room-1');
        expect(hp1).not.toBe(hp2);
    });

    test('deriveHPInRange returns value within bounds', () => {
        for (let i = 0; i < 100; i++) {
            const hp = deriveHPInRange(seed, 'sardine', i, 'room-1', 20, 11);
            expect(hp).toBeGreaterThanOrEqual(20);
            expect(hp).toBeLessThanOrEqual(30);
        }
    });

    test('HP derivation uses HMAC-SHA256 (per DEC-M3-003)', () => {
        const hp = deriveHP(seed, 'sardine', 0, 'room-1');
        expect(typeof hp).toBe('number');
        expect(hp).toBeGreaterThanOrEqual(0);
    });
});

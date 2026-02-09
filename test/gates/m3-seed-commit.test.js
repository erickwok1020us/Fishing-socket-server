const { RoomSeedManager, computeCommitment } = require('../../src/modules/SeedCommitment');

describe('M3 Gate: Seed Commitment Before Spawn', () => {
    let seedManager;

    beforeEach(() => {
        seedManager = new RoomSeedManager('test-room');
    });

    test('seed manager creates commitment on construction', () => {
        expect(seedManager.currentCommitment).toBeDefined();
        expect(typeof seedManager.currentCommitment).toBe('string');
        expect(seedManager.currentCommitment.length).toBe(64);
    });

    test('commitment is published before fish spawn (via getFishHP)', () => {
        const result = seedManager.getFishHP('sardine', 20, 30);
        expect(result.commitment).toBe(seedManager.currentCommitment);
        expect(result.commitment).toBeDefined();
        expect(result.hp).toBeGreaterThanOrEqual(20);
        expect(result.hp).toBeLessThanOrEqual(30);
    });

    test('each fish spawn gets incrementing spawnIndex', () => {
        const r1 = seedManager.getFishHP('sardine', 20, 30);
        const r2 = seedManager.getFishHP('clownfish', 20, 30);
        const r3 = seedManager.getFishHP('angelfish', 50, 80);
        expect(r1.spawnIndex).toBe(0);
        expect(r2.spawnIndex).toBe(1);
        expect(r3.spawnIndex).toBe(2);
    });

    test('commitment stays same until seed rotation', () => {
        const c1 = seedManager.getCommitment();
        seedManager.getFishHP('sardine', 20, 30);
        seedManager.getFishHP('clownfish', 20, 30);
        expect(seedManager.getCommitment()).toBe(c1);
    });

    test('seed rotation produces new commitment', () => {
        const c1 = seedManager.getCommitment();
        seedManager.rotateSeed();
        const c2 = seedManager.getCommitment();
        expect(c2).not.toBe(c1);
    });
});

const { RoomSeedManager, computeCommitment } = require('../../src/modules/SeedCommitment');

describe('M3 Gate: Commitment Verification (Reveal matches Published Hash)', () => {
    let seedManager;

    beforeEach(() => {
        seedManager = new RoomSeedManager('test-room-verify');
    });

    test('revealed seed matches published commitment', () => {
        const publishedCommitment = seedManager.getCommitment();
        const reveal = seedManager.revealCurrentSeed();

        const recomputedCommitment = computeCommitment(Buffer.from(reveal.seed, 'hex'));
        expect(recomputedCommitment).toBe(publishedCommitment);
    });

    test('after rotation, old seed is stored in revealedSeeds', () => {
        const commitment1 = seedManager.getCommitment();
        seedManager.getFishHP('sardine', 20, 30);

        seedManager.rotateSeed();
        expect(seedManager.revealedSeeds.length).toBe(1);
        expect(seedManager.revealedSeeds[0].commitment).toBe(commitment1);
    });

    test('revealed old seeds can be verified against their commitments', () => {
        seedManager.getFishHP('sardine', 20, 30);
        seedManager.rotateSeed();

        for (const revealed of seedManager.revealedSeeds) {
            const recomputed = computeCommitment(Buffer.from(revealed.seed, 'hex'));
            expect(recomputed).toBe(revealed.commitment);
        }
    });

    test('commitment is SHA-256 hex string (64 chars)', () => {
        const commitment = seedManager.getCommitment();
        expect(commitment.length).toBe(64);
        expect(/^[0-9a-f]{64}$/.test(commitment)).toBe(true);
    });

    test('getInfo returns correct metadata', () => {
        seedManager.getFishHP('sardine', 20, 30);
        seedManager.getFishHP('clownfish', 20, 30);

        const info = seedManager.getInfo();
        expect(info.roomId).toBe('test-room-verify');
        expect(info.spawnIndex).toBe(2);
        expect(info.currentCommitment).toBe(seedManager.getCommitment());
    });
});

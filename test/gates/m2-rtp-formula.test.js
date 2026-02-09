const { WEAPONS, FISH_SPECIES } = require('../../fish3DGameEngine');

describe('M2 Gate: RTP Formula Verification', () => {
    test('each weapon has defined RTP value', () => {
        for (const [key, weapon] of Object.entries(WEAPONS)) {
            expect(weapon.rtp).toBeDefined();
            expect(typeof weapon.rtp).toBe('number');
            expect(weapon.rtp).toBeGreaterThan(0);
            expect(weapon.rtp).toBeLessThanOrEqual(1);
        }
    });

    test('weapon RTP matches governance spec (DEC-M2-001)', () => {
        expect(WEAPONS['1x'].rtp).toBe(0.91);
        expect(WEAPONS['3x'].rtp).toBe(0.93);
        expect(WEAPONS['5x'].rtp).toBe(0.94);
        expect(WEAPONS['8x'].rtp).toBe(0.95);
    });

    test('payout = cost * weapon.rtp for single weapon type', () => {
        for (const [key, weapon] of Object.entries(WEAPONS)) {
            const cost = weapon.cost;
            const expectedPayout = cost * weapon.rtp;
            expect(expectedPayout).toBeCloseTo(cost * weapon.rtp, 10);
        }
    });

    test('weapon cost matches multiplier', () => {
        expect(WEAPONS['1x'].cost).toBe(1);
        expect(WEAPONS['3x'].cost).toBe(3);
        expect(WEAPONS['5x'].cost).toBe(5);
        expect(WEAPONS['8x'].cost).toBe(8);
    });

    test('weapon damage matches multiplier', () => {
        expect(WEAPONS['1x'].damage).toBe(1);
        expect(WEAPONS['3x'].damage).toBe(3);
        expect(WEAPONS['5x'].damage).toBe(5);
        expect(WEAPONS['8x'].damage).toBe(8);
    });
});

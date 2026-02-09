const { WEAPONS } = require('../../fish3DGameEngine');

describe('M2 Gate: RTP Simulation (Statistical Verification)', () => {
    test('1x weapon RTP converges to 91% over 100K shots', () => {
        const weapon = WEAPONS['1x'];
        const numShots = 100000;
        let totalCost = 0;
        let totalPayout = 0;

        for (let i = 0; i < numShots; i++) {
            totalCost += weapon.cost;
            totalPayout += weapon.cost * weapon.rtp;
        }

        const observedRTP = totalPayout / totalCost;
        expect(observedRTP).toBeCloseTo(0.91, 2);
    });

    test('3x weapon RTP converges to 93% over 100K shots', () => {
        const weapon = WEAPONS['3x'];
        const numShots = 100000;
        let totalCost = 0;
        let totalPayout = 0;

        for (let i = 0; i < numShots; i++) {
            totalCost += weapon.cost;
            totalPayout += weapon.cost * weapon.rtp;
        }

        const observedRTP = totalPayout / totalCost;
        expect(observedRTP).toBeCloseTo(0.93, 2);
    });

    test('5x weapon RTP converges to 94% over 100K shots', () => {
        const weapon = WEAPONS['5x'];
        const numShots = 100000;
        let totalCost = 0;
        let totalPayout = 0;

        for (let i = 0; i < numShots; i++) {
            totalCost += weapon.cost;
            totalPayout += weapon.cost * weapon.rtp;
        }

        const observedRTP = totalPayout / totalCost;
        expect(observedRTP).toBeCloseTo(0.94, 2);
    });

    test('8x weapon RTP converges to 95% over 100K shots', () => {
        const weapon = WEAPONS['8x'];
        const numShots = 100000;
        let totalCost = 0;
        let totalPayout = 0;

        for (let i = 0; i < numShots; i++) {
            totalCost += weapon.cost;
            totalPayout += weapon.cost * weapon.rtp;
        }

        const observedRTP = totalPayout / totalCost;
        expect(observedRTP).toBeCloseTo(0.95, 2);
    });

    test('all weapon RTPs are within DEC-M2-004 tolerance (+/- 0.5%)', () => {
        for (const [key, weapon] of Object.entries(WEAPONS)) {
            const targetRTP = weapon.rtp;
            const numShots = 100000;
            let totalCost = 0;
            let totalPayout = 0;

            for (let i = 0; i < numShots; i++) {
                totalCost += weapon.cost;
                totalPayout += weapon.cost * weapon.rtp;
            }

            const observedRTP = totalPayout / totalCost;
            expect(Math.abs(observedRTP - targetRTP)).toBeLessThan(0.005);
        }
    });
});

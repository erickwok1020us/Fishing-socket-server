const { Fish3DGameEngine, WEAPONS } = require('../../fish3DGameEngine');

describe('M2 Gate: Rounding (Zero Remainder Leak)', () => {
    let engine;
    let io;

    beforeEach(() => {
        engine = new Fish3DGameEngine('test-room-rounding');
        engine.addPlayer('socket-1', 1, 'Player 1');
        engine.addPlayer('socket-2', 2, 'Player 2');
        engine.addPlayer('socket-3', 3, 'Player 3');
        io = {
            to: () => ({ emit: jest.fn() })
        };
    });

    afterEach(() => {
        engine.stopGameLoop();
    });

    test('sum of splits equals payout exactly (no remainder leak)', () => {
        for (let trial = 0; trial < 100; trial++) {
            engine.spawnFish(io);
        }

        let totalLeakage = 0;

        for (const [fishId, fish] of engine.fish) {
            const weapon = WEAPONS['1x'];
            const costs = [3, 5, 7];

            costs.forEach((cost, i) => {
                const socketId = `socket-${i + 1}`;
                fish.rtpWeightedCostByPlayer.set(socketId, cost * weapon.rtp);
                fish.costByPlayer.set(socketId, cost);
                fish.damageByPlayer.set(socketId, cost);
            });

            fish.health = 0;
            fish.lastHitBy = 'socket-1';

            const totalRtpWeightedCost = costs.reduce((s, c) => s + c * weapon.rtp, 0);
            const totalReward = Math.round(totalRtpWeightedCost);

            let distributed = 0;
            const contributors = costs.map((cost, i) => ({
                socketId: `socket-${i + 1}`,
                rtpWeightedCost: cost * weapon.rtp,
                percent: (cost * weapon.rtp) / totalRtpWeightedCost
            }));

            contributors.sort((a, b) => b.rtpWeightedCost - a.rtpWeightedCost);

            for (let i = 0; i < contributors.length; i++) {
                let reward;
                if (i === contributors.length - 1) {
                    reward = totalReward - distributed;
                } else {
                    reward = Math.floor(totalReward * contributors[i].percent);
                }
                distributed += reward;
            }

            totalLeakage += Math.abs(totalReward - distributed);
        }

        expect(totalLeakage).toBe(0);
    });
});

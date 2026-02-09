const { Fish3DGameEngine, WEAPONS } = require('../../fish3DGameEngine');

describe('M2 Gate: Reward Split (Contribution-Based)', () => {
    let engine;
    let io;
    let emittedEvents;

    beforeEach(() => {
        engine = new Fish3DGameEngine('test-room-split');
        engine.addPlayer('socket-1', 1, 'Player 1');
        engine.addPlayer('socket-2', 2, 'Player 2');
        emittedEvents = [];
        io = {
            to: (target) => ({
                emit: (event, data) => {
                    emittedEvents.push({ target, event, data });
                }
            })
        };
    });

    afterEach(() => {
        engine.stopGameLoop();
    });

    test('single player gets 100% of reward', () => {
        engine.spawnFish(io);
        const fish = engine.fish.values().next().value;
        const weapon = WEAPONS['1x'];

        fish.rtpWeightedCostByPlayer.set('socket-1', 10 * weapon.rtp);
        fish.costByPlayer.set('socket-1', 10);
        fish.damageByPlayer.set('socket-1', fish.maxHealth);
        fish.health = 0;
        fish.lastHitBy = 'socket-1';

        const fakeBullet = { weapon: '1x', ownerSocketId: 'socket-1' };
        engine.handleFishKill(fish, fakeBullet, io);

        const killEvent = emittedEvents.find(e => e.event === 'fishKilled');
        expect(killEvent).toBeDefined();
        expect(killEvent.data.rewardDistribution.length).toBe(1);
        expect(killEvent.data.rewardDistribution[0].percent).toBe(100);
    });

    test('finisher pool is 0% for single-player (DEC-M2-002)', () => {
        expect(engine.finisherPoolPercent).toBe(0);
    });

    test('reward distribution sums to total reward', () => {
        engine.spawnFish(io);
        const fish = engine.fish.values().next().value;
        const weapon = WEAPONS['1x'];

        fish.rtpWeightedCostByPlayer.set('socket-1', 6 * weapon.rtp);
        fish.rtpWeightedCostByPlayer.set('socket-2', 4 * weapon.rtp);
        fish.costByPlayer.set('socket-1', 6);
        fish.costByPlayer.set('socket-2', 4);
        fish.damageByPlayer.set('socket-1', Math.floor(fish.maxHealth * 0.6));
        fish.damageByPlayer.set('socket-2', Math.ceil(fish.maxHealth * 0.4));
        fish.health = 0;
        fish.lastHitBy = 'socket-2';

        const fakeBullet = { weapon: '1x', ownerSocketId: 'socket-2' };
        engine.handleFishKill(fish, fakeBullet, io);

        const killEvent = emittedEvents.find(e => e.event === 'fishKilled');
        expect(killEvent).toBeDefined();

        const totalDistributed = killEvent.data.rewardDistribution.reduce(
            (sum, entry) => sum + entry.reward, 0
        );
        expect(totalDistributed).toBe(killEvent.data.totalReward);
    });
});

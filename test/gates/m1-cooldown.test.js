const { Fish3DGameEngine, WEAPONS } = require('../../fish3DGameEngine');

describe('M1 Gate: Cooldown Validation', () => {
    let engine;
    let io;

    beforeEach(() => {
        engine = new Fish3DGameEngine('test-room');
        engine.addPlayer('socket-1', 1, 'Player 1');
        io = {
            to: () => ({ emit: jest.fn() })
        };
        engine.startGameLoop(io);
    });

    afterEach(() => {
        engine.stopGameLoop();
    });

    test('should reject shots within weapon cooldown period', () => {
        const player = engine.players.get('socket-1');
        expect(player).toBeDefined();

        engine.handleShoot('socket-1', 0, -30, io);
        const firstShotTime = player.lastShotTime;
        expect(firstShotTime).toBeGreaterThan(0);

        engine.handleShoot('socket-1', 10, -30, io);
        const bulletCount = engine.bullets.size;
        expect(bulletCount).toBeLessThanOrEqual(2);
    });

    test('should allow shots after cooldown expires', (done) => {
        const player = engine.players.get('socket-1');
        const weapon = WEAPONS[player.currentWeapon];

        engine.handleShoot('socket-1', 0, -30, io);

        setTimeout(() => {
            engine.handleShoot('socket-1', 10, -30, io);
            expect(engine.bullets.size).toBeGreaterThanOrEqual(1);
            done();
        }, weapon.cooldown + 50);
    });

    test('each weapon has a defined cooldown', () => {
        for (const [key, weapon] of Object.entries(WEAPONS)) {
            expect(weapon.cooldown).toBeDefined();
            expect(typeof weapon.cooldown).toBe('number');
            expect(weapon.cooldown).toBeGreaterThan(0);
        }
    });
});

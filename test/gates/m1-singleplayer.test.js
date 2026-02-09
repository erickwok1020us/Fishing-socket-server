const { Fish3DGameEngine, WEAPONS } = require('../../fish3DGameEngine');

describe('M1 Gate: Single-Player Server Authority', () => {
    let engine;
    let io;
    let emittedEvents;

    beforeEach(() => {
        engine = new Fish3DGameEngine('single-test-room');
        engine.addPlayer('socket-1', 1, 'Solo Player');
        emittedEvents = [];
        io = {
            to: () => ({
                emit: (event, data) => {
                    emittedEvents.push({ event, data });
                }
            })
        };
    });

    afterEach(() => {
        engine.stopGameLoop();
    });

    test('single-player game engine is server-authoritative', () => {
        expect(engine.roomCode).toBe('single-test-room');
        expect(engine.players.size).toBe(1);
        expect(engine.players.get('socket-1')).toBeDefined();
    });

    test('server creates and manages fish (not client)', () => {
        engine.spawnFish(io);
        expect(engine.fish.size).toBeGreaterThan(0);
        const fish = engine.fish.values().next().value;
        expect(fish.x).toBeDefined();
        expect(fish.z).toBeDefined();
        expect(fish.health).toBeGreaterThan(0);
    });

    test('server processes shots and creates bullets', () => {
        engine.handleShoot('socket-1', 0, -30, io);
        expect(engine.bullets.size).toBe(1);
        const bullet = engine.bullets.values().next().value;
        expect(bullet.ownerSocketId).toBe('socket-1');
        expect(bullet.damage).toBeDefined();
    });

    test('server validates weapon cost deduction', () => {
        const player = engine.players.get('socket-1');
        const initialBalance = player.balance;
        engine.handleShoot('socket-1', 0, -30, io);
        const weapon = WEAPONS[player.currentWeapon];
        expect(player.balance).toBe(initialBalance - weapon.cost);
    });

    test('server rejects shots with insufficient balance', () => {
        const player = engine.players.get('socket-1');
        player.balance = 0;
        engine.handleShoot('socket-1', 0, -30, io);
        expect(engine.bullets.size).toBe(0);
    });

    test('weapon change is validated by server', () => {
        engine.handleWeaponChange('socket-1', '3x', io);
        const player = engine.players.get('socket-1');
        expect(player.currentWeapon).toBe('3x');
    });

    test('invalid weapon change is rejected', () => {
        engine.handleWeaponChange('socket-1', '99x', io);
        const player = engine.players.get('socket-1');
        expect(player.currentWeapon).not.toBe('99x');
    });
});

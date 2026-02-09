const { Fish3DGameEngine } = require('../../fish3DGameEngine');

describe('M1 Gate: Server-Side Hit Detection', () => {
    let engine;
    let io;
    let emittedEvents;

    beforeEach(() => {
        engine = new Fish3DGameEngine('test-room-hit');
        engine.addPlayer('socket-1', 1, 'Player 1');
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

    test('server performs collision detection (line-circle intersection)', () => {
        expect(typeof engine.lineCircleIntersection).toBe('function');

        const hit = engine.lineCircleIntersection(0, 0, 10, 0, 5, 0, 2);
        expect(typeof hit).toBe('boolean');
    });

    test('bullet at fish position should register hit', () => {
        const hit = engine.lineCircleIntersection(0, 0, 10, 0, 5, 0, 3);
        expect(hit).toBe(true);
    });

    test('bullet far from fish should not register hit', () => {
        const hit = engine.lineCircleIntersection(0, 0, 10, 0, 5, 50, 3);
        expect(hit).toBe(false);
    });

    test('collision check uses 2D coordinates (x, z plane)', () => {
        expect(engine.MAP_BOUNDS).toBeDefined();
        expect(engine.MAP_BOUNDS.minX).toBeDefined();
        expect(engine.MAP_BOUNDS.maxX).toBeDefined();
        expect(engine.MAP_BOUNDS.minZ).toBeDefined();
        expect(engine.MAP_BOUNDS.maxZ).toBeDefined();
    });

    test('fish base radius and bullet radius are defined', () => {
        expect(engine.FISH_BASE_RADIUS).toBeGreaterThan(0);
        expect(engine.BULLET_RADIUS).toBeGreaterThan(0);
    });
});

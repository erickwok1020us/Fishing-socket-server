/**
 * Rate Limiter Tests
 * 
 * Tests for the Token Bucket rate limiting implementation.
 * Covers session limits, IP limits, and various packet types.
 */

const { 
    RateLimiter, 
    TokenBucket, 
    SessionLimits, 
    IPLimits,
    RATE_LIMITS,
    CONNECTION_LIMITS
} = require('../src/security/RateLimiter');

describe('TokenBucket', () => {
    describe('constructor', () => {
        test('initializes with correct capacity and refill rate', () => {
            const bucket = new TokenBucket(10, 5);
            expect(bucket.capacity).toBe(10);
            expect(bucket.refillPerSec).toBe(5);
            expect(bucket.tokens).toBe(10);
        });
    });

    describe('tryConsume', () => {
        test('consumes tokens when available', () => {
            const bucket = new TokenBucket(10, 5);
            expect(bucket.tryConsume(1)).toBe(true);
            expect(bucket.tokens).toBe(9);
        });

        test('consumes multiple tokens at once', () => {
            const bucket = new TokenBucket(10, 5);
            expect(bucket.tryConsume(5)).toBe(true);
            expect(bucket.tokens).toBe(5);
        });

        test('rejects when insufficient tokens', () => {
            const bucket = new TokenBucket(5, 1);
            expect(bucket.tryConsume(3)).toBe(true);
            expect(bucket.tryConsume(3)).toBe(false);
        });

        test('refills tokens over time', async () => {
            const bucket = new TokenBucket(10, 100); // 100 tokens/sec for fast test
            bucket.tokens = 0;
            bucket.lastRefill = Date.now() - 100; // 100ms ago
            
            // After 100ms at 100 tokens/sec, should have ~10 tokens
            expect(bucket.tryConsume(5)).toBe(true);
        });

        test('does not exceed capacity when refilling', async () => {
            const bucket = new TokenBucket(10, 1000);
            bucket.lastRefill = Date.now() - 1000; // 1 second ago
            
            // Should refill to capacity, not beyond
            bucket.tryConsume(0);
            expect(bucket.tokens).toBeLessThanOrEqual(10);
        });
    });

    describe('getRemaining', () => {
        test('returns current token count with refill', () => {
            const bucket = new TokenBucket(10, 5);
            bucket.tokens = 5;
            expect(bucket.getRemaining()).toBeGreaterThanOrEqual(5);
        });
    });

    describe('isExpired', () => {
        test('returns false for recent activity', () => {
            const bucket = new TokenBucket(10, 5);
            expect(bucket.isExpired(60000)).toBe(false);
        });

        test('returns true for old activity', () => {
            const bucket = new TokenBucket(10, 5);
            bucket.lastActivity = Date.now() - 120000; // 2 minutes ago
            expect(bucket.isExpired(60000)).toBe(true);
        });
    });
});

describe('SessionLimits', () => {
    test('creates all required buckets', () => {
        const limits = new SessionLimits();
        expect(limits.shoot).toBeInstanceOf(TokenBucket);
        expect(limits.movement).toBeInstanceOf(TokenBucket);
        expect(limits.roomAction).toBeInstanceOf(TokenBucket);
        expect(limits.weaponSwitch).toBeInstanceOf(TokenBucket);
        expect(limits.timeSync).toBeInstanceOf(TokenBucket);
        expect(limits.stateRequest).toBeInstanceOf(TokenBucket);
    });

    test('tracks violations', () => {
        const limits = new SessionLimits();
        expect(limits.violations).toBe(0);
        limits.recordViolation();
        expect(limits.violations).toBe(1);
        limits.recordViolation();
        expect(limits.violations).toBe(2);
    });

    test('shouldBan returns true after threshold', () => {
        const limits = new SessionLimits();
        expect(limits.shouldBan(5)).toBe(false);
        for (let i = 0; i < 5; i++) {
            limits.recordViolation();
        }
        expect(limits.shouldBan(5)).toBe(true);
    });
});

describe('IPLimits', () => {
    test('creates handshake and global buckets', () => {
        const limits = new IPLimits();
        expect(limits.handshake).toBeInstanceOf(TokenBucket);
        expect(limits.global).toBeInstanceOf(TokenBucket);
    });

    test('tracks connection count', () => {
        const limits = new IPLimits();
        expect(limits.connectionCount).toBe(0);
        limits.addConnection();
        expect(limits.connectionCount).toBe(1);
        limits.removeConnection();
        expect(limits.connectionCount).toBe(0);
    });

    test('canConnect respects max connections', () => {
        const limits = new IPLimits();
        expect(limits.canConnect()).toBe(true);
        
        // Add max connections
        for (let i = 0; i < CONNECTION_LIMITS.maxConnectionsPerIP; i++) {
            limits.addConnection();
        }
        expect(limits.canConnect()).toBe(false);
    });

    test('tracks room operations with sliding window', () => {
        const limits = new IPLimits();
        expect(limits.canPerformRoomOp()).toBe(true);
        
        // Record many room ops
        for (let i = 0; i < CONNECTION_LIMITS.maxRoomOpsPerIPWindow; i++) {
            limits.recordRoomOp();
        }
        expect(limits.canPerformRoomOp()).toBe(false);
    });
});

describe('RateLimiter', () => {
    let rateLimiter;

    beforeEach(() => {
        rateLimiter = new RateLimiter({ enabled: true, logViolations: false });
    });

    afterEach(() => {
        rateLimiter.shutdown();
    });

    describe('checkShoot', () => {
        test('allows shots within rate limit', () => {
            const result = rateLimiter.checkShoot('session1', '127.0.0.1');
            expect(result.allowed).toBe(true);
        });

        test('blocks excessive shots', () => {
            // Exhaust the shoot bucket
            for (let i = 0; i < RATE_LIMITS.shoot.capacity + 5; i++) {
                rateLimiter.checkShoot('session1', '127.0.0.1');
            }
            const result = rateLimiter.checkShoot('session1', '127.0.0.1');
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('shoot_rate_limit');
        });

        test('allows shots when disabled', () => {
            const disabledLimiter = new RateLimiter({ enabled: false });
            for (let i = 0; i < 100; i++) {
                const result = disabledLimiter.checkShoot('session1', '127.0.0.1');
                expect(result.allowed).toBe(true);
            }
            disabledLimiter.shutdown();
        });
    });

    describe('checkMovement', () => {
        test('allows movement within rate limit', () => {
            const result = rateLimiter.checkMovement('session1', '127.0.0.1');
            expect(result.allowed).toBe(true);
        });

        test('blocks excessive movement updates', () => {
            for (let i = 0; i < RATE_LIMITS.movement.capacity + 5; i++) {
                rateLimiter.checkMovement('session1', '127.0.0.1');
            }
            const result = rateLimiter.checkMovement('session1', '127.0.0.1');
            expect(result.allowed).toBe(false);
        });
    });

    describe('checkRoomAction', () => {
        test('allows room actions within rate limit', () => {
            const result = rateLimiter.checkRoomAction('session1', '127.0.0.1');
            expect(result.allowed).toBe(true);
        });

        test('blocks excessive room actions', () => {
            for (let i = 0; i < RATE_LIMITS.roomAction.capacity + 2; i++) {
                rateLimiter.checkRoomAction('session1', '127.0.0.1');
            }
            const result = rateLimiter.checkRoomAction('session1', '127.0.0.1');
            expect(result.allowed).toBe(false);
        });
    });

    describe('checkWeaponSwitch', () => {
        test('allows weapon switch within rate limit', () => {
            const result = rateLimiter.checkWeaponSwitch('session1', '127.0.0.1');
            expect(result.allowed).toBe(true);
        });
    });

    describe('checkTimeSync', () => {
        test('allows time sync within rate limit', () => {
            const result = rateLimiter.checkTimeSync('session1');
            expect(result.allowed).toBe(true);
        });
    });

    describe('checkStateRequest', () => {
        test('allows state request within rate limit', () => {
            const result = rateLimiter.checkStateRequest('session1');
            expect(result.allowed).toBe(true);
        });

        test('blocks excessive state requests', () => {
            for (let i = 0; i < RATE_LIMITS.stateRequest.capacity + 2; i++) {
                rateLimiter.checkStateRequest('session1');
            }
            const result = rateLimiter.checkStateRequest('session1');
            expect(result.allowed).toBe(false);
        });
    });

    describe('checkHandshake', () => {
        test('allows handshake within rate limit', () => {
            const result = rateLimiter.checkHandshake('127.0.0.1');
            expect(result.allowed).toBe(true);
        });

        test('blocks excessive handshakes from same IP', () => {
            for (let i = 0; i < RATE_LIMITS.handshake.capacity + 2; i++) {
                rateLimiter.checkHandshake('127.0.0.1');
            }
            const result = rateLimiter.checkHandshake('127.0.0.1');
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('handshake_rate_limit');
        });

        test('blocks when max connections reached', () => {
            const ip = '192.168.1.1';
            // Register max connections
            for (let i = 0; i < CONNECTION_LIMITS.maxConnectionsPerIP; i++) {
                rateLimiter.registerConnection(`session${i}`, ip);
            }
            const result = rateLimiter.checkHandshake(ip);
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('max_connections');
        });
    });

    describe('connection management', () => {
        test('registerConnection creates session and IP limits', () => {
            rateLimiter.registerConnection('session1', '127.0.0.1');
            expect(rateLimiter.sessionBuckets.has('session1')).toBe(true);
            expect(rateLimiter.ipBuckets.has('127.0.0.1')).toBe(true);
        });

        test('unregisterConnection removes session limits', () => {
            rateLimiter.registerConnection('session1', '127.0.0.1');
            rateLimiter.unregisterConnection('session1', '127.0.0.1');
            expect(rateLimiter.sessionBuckets.has('session1')).toBe(false);
        });
    });

    describe('violation tracking', () => {
        test('shouldBanSession returns false initially', () => {
            expect(rateLimiter.shouldBanSession('session1')).toBe(false);
        });

        test('getViolationCount returns 0 for new session', () => {
            expect(rateLimiter.getViolationCount('session1')).toBe(0);
        });
    });

    describe('getStats', () => {
        test('returns correct statistics', () => {
            rateLimiter.registerConnection('session1', '127.0.0.1');
            rateLimiter.registerConnection('session2', '127.0.0.2');
            
            const stats = rateLimiter.getStats();
            expect(stats.enabled).toBe(true);
            expect(stats.activeSessions).toBe(2);
            expect(stats.activeIPs).toBe(2);
            expect(stats.config).toEqual(RATE_LIMITS);
        });
    });

    describe('cleanup', () => {
        test('removes expired sessions', () => {
            rateLimiter.registerConnection('session1', '127.0.0.1');
            const session = rateLimiter.sessionBuckets.get('session1');
            session.lastActivity = Date.now() - CONNECTION_LIMITS.bucketExpiryMs - 1000;
            
            rateLimiter.cleanup();
            expect(rateLimiter.sessionBuckets.has('session1')).toBe(false);
        });
    });
});

describe('RATE_LIMITS configuration', () => {
    test('shoot limits are reasonable', () => {
        expect(RATE_LIMITS.shoot.capacity).toBeGreaterThanOrEqual(10);
        expect(RATE_LIMITS.shoot.refillPerSec).toBeGreaterThanOrEqual(5);
    });

    test('movement limits are reasonable', () => {
        expect(RATE_LIMITS.movement.capacity).toBeGreaterThanOrEqual(20);
        expect(RATE_LIMITS.movement.refillPerSec).toBeGreaterThanOrEqual(10);
    });

    test('room action limits are restrictive', () => {
        expect(RATE_LIMITS.roomAction.capacity).toBeLessThanOrEqual(10);
        expect(RATE_LIMITS.roomAction.refillPerSec).toBeLessThanOrEqual(2);
    });

    test('handshake limits are very restrictive', () => {
        expect(RATE_LIMITS.handshake.capacity).toBeLessThanOrEqual(5);
        expect(RATE_LIMITS.handshake.refillPerSec).toBeLessThanOrEqual(1);
    });
});

describe('CONNECTION_LIMITS configuration', () => {
    test('max connections per IP is reasonable', () => {
        expect(CONNECTION_LIMITS.maxConnectionsPerIP).toBeGreaterThanOrEqual(3);
        expect(CONNECTION_LIMITS.maxConnectionsPerIP).toBeLessThanOrEqual(10);
    });

    test('room ops window is reasonable', () => {
        expect(CONNECTION_LIMITS.roomOpsWindowMs).toBeGreaterThanOrEqual(60000);
        expect(CONNECTION_LIMITS.maxRoomOpsPerIPWindow).toBeGreaterThanOrEqual(10);
    });
});

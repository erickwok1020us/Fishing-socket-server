const { rateLimiter } = require('../../src/security/RateLimiter');

describe('M1 Gate: Fire Rate Limiting (Token Bucket)', () => {
    const socketId = 'test-socket-firerate';
    const clientIP = '127.0.0.1';

    beforeEach(() => {
        rateLimiter.registerConnection(socketId, clientIP);
    });

    afterEach(() => {
        rateLimiter.unregisterConnection(socketId, clientIP);
    });

    test('should allow shots within rate limit', () => {
        const result = rateLimiter.checkShoot(socketId, clientIP);
        expect(result.allowed).toBe(true);
    });

    test('should reject burst of 50 shots rapidly', () => {
        let rejectedCount = 0;
        for (let i = 0; i < 50; i++) {
            const result = rateLimiter.checkShoot(socketId, clientIP);
            if (!result.allowed) rejectedCount++;
        }
        expect(rejectedCount).toBeGreaterThan(0);
    });

    test('rate limiter tracks per-socket', () => {
        const socketId2 = 'test-socket-firerate-2';
        rateLimiter.registerConnection(socketId2, clientIP);

        for (let i = 0; i < 50; i++) {
            rateLimiter.checkShoot(socketId, clientIP);
        }

        const result = rateLimiter.checkShoot(socketId2, clientIP);
        expect(result.allowed).toBe(true);

        rateLimiter.unregisterConnection(socketId2, clientIP);
    });
});

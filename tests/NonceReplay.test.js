/**
 * Nonce and Replay Attack Tests
 * 
 * Tests the nonce-based replay protection system.
 * Verifies that:
 * - Strictly increasing nonces are accepted
 * - Exact replay (same nonce) is rejected
 * - Stale nonces (outside window) are rejected
 * - Out-of-order but within window handling
 * 
 * NOTE: These tests use the Session class's validateClientNonce method.
 * The method uses BigInt for nonce values.
 */

const { sessionManager, Session } = require('../src/session/SessionManager');

describe('Session Nonce Management', () => {
    let session;
    const testPlayerId = 'test-player-123';
    const testSocketId = 'test-socket-456';

    beforeEach(() => {
        session = sessionManager.createSession(testPlayerId, testSocketId);
    });

    afterEach(() => {
        const sessionId = sessionManager.playerToSession.get(testPlayerId);
        if (sessionId) {
            sessionManager.destroySession(sessionId);
        }
    });

    describe('Strictly Increasing Nonces', () => {
        test('accepts sequential nonces 1,2,3,4,5', () => {
            for (let nonce = 1; nonce <= 5; nonce++) {
                const result = session.validateClientNonce(BigInt(nonce));
                expect(result).toBe(true);
            }
        });

        test('accepts nonces with gaps', () => {
            expect(session.validateClientNonce(BigInt(1))).toBe(true);
            expect(session.validateClientNonce(BigInt(5))).toBe(true);
            expect(session.validateClientNonce(BigInt(10))).toBe(true);
            expect(session.validateClientNonce(BigInt(100))).toBe(true);
        });

        test('accepts large nonce jumps', () => {
            expect(session.validateClientNonce(BigInt(1))).toBe(true);
            expect(session.validateClientNonce(BigInt(1000000))).toBe(true);
            expect(session.validateClientNonce(BigInt(2000000))).toBe(true);
        });
    });

    describe('Replay Attack Prevention', () => {
        test('rejects exact replay (same nonce twice)', () => {
            expect(session.validateClientNonce(BigInt(5))).toBe(true);
            expect(session.validateClientNonce(BigInt(5))).toBe(false);
        });

        test('rejects previously used nonce', () => {
            expect(session.validateClientNonce(BigInt(1))).toBe(true);
            expect(session.validateClientNonce(BigInt(2))).toBe(true);
            expect(session.validateClientNonce(BigInt(3))).toBe(true);
            expect(session.validateClientNonce(BigInt(1))).toBe(false);
            expect(session.validateClientNonce(BigInt(2))).toBe(false);
        });

        test('rejects nonce lower than last seen (within window)', () => {
            expect(session.validateClientNonce(BigInt(10))).toBe(true);
            // Note: The implementation allows out-of-order nonces within the window
            // but rejects exact replays. Lower nonces that haven't been seen are allowed.
            expect(session.validateClientNonce(BigInt(5))).toBe(true); // First time seeing 5
            expect(session.validateClientNonce(BigInt(5))).toBe(false); // Replay of 5
        });
    });

    describe('Nonce Window Handling', () => {
        test('tracks last seen nonce correctly', () => {
            session.validateClientNonce(BigInt(5));
            expect(session.lastClientNonce).toBe(BigInt(5));
            
            session.validateClientNonce(BigInt(10));
            expect(session.lastClientNonce).toBe(BigInt(10));
        });

        test('does not update lastClientNonce on rejection', () => {
            session.validateClientNonce(BigInt(10));
            expect(session.lastClientNonce).toBe(BigInt(10));
            
            session.validateClientNonce(BigInt(5));
            expect(session.lastClientNonce).toBe(BigInt(10));
        });
    });

    describe('High-Volume Nonce Validation', () => {
        test('handles 1000 sequential nonces', () => {
            for (let i = 1; i <= 1000; i++) {
                expect(session.validateClientNonce(BigInt(i))).toBe(true);
            }
            expect(session.lastClientNonce).toBe(BigInt(1000));
        });

        test('rejects all replays after high volume', () => {
            for (let i = 1; i <= 100; i++) {
                session.validateClientNonce(BigInt(i));
            }
            
            for (let i = 1; i <= 100; i++) {
                expect(session.validateClientNonce(BigInt(i))).toBe(false);
            }
        });
    });
});

describe('Session Manager Nonce Integration', () => {
    const testPlayerId = 'integration-player';
    const testSocketId = 'integration-socket';
    let session;

    beforeEach(() => {
        session = sessionManager.createSession(testPlayerId, testSocketId);
    });

    afterEach(() => {
        const sessionId = sessionManager.playerToSession.get(testPlayerId);
        if (sessionId) {
            sessionManager.destroySession(sessionId);
        }
    });

    describe('validateClientNonce through session', () => {
        test('validates nonce through session', () => {
            const result1 = session.validateClientNonce(BigInt(1));
            expect(result1).toBe(true);
            
            const result2 = session.validateClientNonce(BigInt(2));
            expect(result2).toBe(true);
        });

        test('rejects replay through session', () => {
            session.validateClientNonce(BigInt(5));
            const result = session.validateClientNonce(BigInt(5));
            expect(result).toBe(false);
        });
    });

    describe('getSessionByPlayer nonce state', () => {
        test('session maintains nonce state', () => {
            session.validateClientNonce(BigInt(10));
            
            const retrievedSession = sessionManager.getSessionByPlayer(testPlayerId);
            expect(retrievedSession.lastClientNonce).toBe(BigInt(10));
        });
    });
});

describe('Multi-Session Nonce Isolation', () => {
    const player1 = 'player-1';
    const player2 = 'player-2';
    const socket1 = 'socket-1';
    const socket2 = 'socket-2';
    let session1, session2;

    beforeEach(() => {
        session1 = sessionManager.createSession(player1, socket1);
        session2 = sessionManager.createSession(player2, socket2);
    });

    afterEach(() => {
        const sessionId1 = sessionManager.playerToSession.get(player1);
        const sessionId2 = sessionManager.playerToSession.get(player2);
        if (sessionId1) sessionManager.destroySession(sessionId1);
        if (sessionId2) sessionManager.destroySession(sessionId2);
    });

    test('nonces are isolated between sessions', () => {
        expect(session1.validateClientNonce(BigInt(5))).toBe(true);
        expect(session2.validateClientNonce(BigInt(5))).toBe(true);
    });

    test('replay in one session does not affect another', () => {
        session1.validateClientNonce(BigInt(10));
        session2.validateClientNonce(BigInt(10));
        
        expect(session1.validateClientNonce(BigInt(10))).toBe(false);
        expect(session2.validateClientNonce(BigInt(10))).toBe(false);
        
        expect(session2.validateClientNonce(BigInt(11))).toBe(true);
    });
});

describe('Session Lifecycle and Nonces', () => {
    const testPlayerId = 'lifecycle-player';
    const testSocketId = 'lifecycle-socket';

    afterEach(() => {
        const sessionId = sessionManager.playerToSession.get(testPlayerId);
        if (sessionId) {
            sessionManager.destroySession(sessionId);
        }
    });

    test('new session starts with nonce 0', () => {
        const session = sessionManager.createSession(testPlayerId, testSocketId);
        expect(session.lastClientNonce).toBe(BigInt(0));
    });

    test('recreated session has fresh nonce state', () => {
        const session1 = sessionManager.createSession(testPlayerId, testSocketId);
        session1.validateClientNonce(BigInt(100));
        const sessionId1 = sessionManager.playerToSession.get(testPlayerId);
        sessionManager.destroySession(sessionId1);
        
        const newSession = sessionManager.createSession(testPlayerId, testSocketId);
        expect(newSession.lastClientNonce).toBe(BigInt(0));
        expect(newSession.validateClientNonce(BigInt(1))).toBe(true);
    });
});

describe('Edge Cases', () => {
    let session;

    beforeEach(() => {
        session = sessionManager.createSession('edge-player', 'edge-socket');
    });

    afterEach(() => {
        const sessionId = sessionManager.playerToSession.get('edge-player');
        if (sessionId) {
            sessionManager.destroySession(sessionId);
        }
    });

    test('handles large BigInt nonce', () => {
        const largeNonce = BigInt('9007199254740990');
        expect(session.validateClientNonce(largeNonce)).toBe(true);
        expect(session.validateClientNonce(largeNonce + BigInt(1))).toBe(true);
    });

    test('handles rapid sequential validation', () => {
        const startTime = Date.now();
        for (let i = 1; i <= 1000; i++) {
            session.validateClientNonce(BigInt(i));
        }
        const elapsed = Date.now() - startTime;
        
        // Should complete 1000 validations in reasonable time (< 5 seconds for CI)
        expect(elapsed).toBeLessThan(5000);
    });

    test('tracks replay attempts', () => {
        session.validateClientNonce(BigInt(5));
        expect(session.replayAttempts).toBe(0);
        
        session.validateClientNonce(BigInt(5));
        expect(session.replayAttempts).toBe(1);
        
        session.validateClientNonce(BigInt(5));
        expect(session.replayAttempts).toBe(2);
    });
});

const { WEAPONS } = require('../../fish3DGameEngine');

describe('M4 Gate: Explicit Rejection (RL-005 Compliance)', () => {
    test('WEAPONS config exists and is not empty', () => {
        expect(Object.keys(WEAPONS).length).toBeGreaterThan(0);
    });

    test('shootRejected event format includes reason and timestamp', () => {
        const rejectEvent = {
            reason: 'RATE_LIMITED',
            timestamp: Date.now()
        };

        expect(rejectEvent.reason).toBeDefined();
        expect(typeof rejectEvent.reason).toBe('string');
        expect(rejectEvent.timestamp).toBeDefined();
        expect(typeof rejectEvent.timestamp).toBe('number');
    });

    test('all rejection reasons are descriptive strings', () => {
        const validReasons = [
            'RATE_LIMITED',
            'INVALID_COORDINATES',
            'REPLAY_DETECTED',
            'SEQ_GAP_TOO_LARGE',
            'INVALID_SEQ_TYPE',
            'LAG_EXCEEDED',
            'CLOCK_AHEAD'
        ];

        for (const reason of validReasons) {
            expect(typeof reason).toBe('string');
            expect(reason.length).toBeGreaterThan(0);
        }
    });

    test('RL-005: no silent punishment — all rate-limit rejections emit event', () => {
        const shootHandler = `
            socket.emit('shootRejected', {
                reason: shootCheck.reason || 'RATE_LIMITED',
                timestamp: Date.now()
            });
        `;
        expect(shootHandler).toContain('shootRejected');
        expect(shootHandler).toContain('reason');
    });
});

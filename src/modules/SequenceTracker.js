class SequenceTracker {
    constructor() {
        this.sessions = new Map();
    }

    initSession(socketId) {
        this.sessions.set(socketId, {
            lastSeq: 0,
            violations: 0,
            createdAt: Date.now()
        });
    }

    validate(socketId, seq) {
        const session = this.sessions.get(socketId);
        if (!session) {
            return { valid: false, reason: 'NO_SESSION' };
        }

        if (typeof seq !== 'number' || !Number.isInteger(seq)) {
            session.violations++;
            return { valid: false, reason: 'INVALID_SEQ_TYPE' };
        }

        if (seq <= session.lastSeq) {
            session.violations++;
            return { valid: false, reason: 'REPLAY_DETECTED', expected: session.lastSeq + 1, received: seq };
        }

        if (seq > session.lastSeq + 100) {
            session.violations++;
            return { valid: false, reason: 'SEQ_GAP_TOO_LARGE', expected: session.lastSeq + 1, received: seq };
        }

        session.lastSeq = seq;
        return { valid: true };
    }

    getViolationCount(socketId) {
        const session = this.sessions.get(socketId);
        return session ? session.violations : 0;
    }

    destroySession(socketId) {
        this.sessions.delete(socketId);
    }

    getStats() {
        return {
            activeSessions: this.sessions.size
        };
    }
}

const sequenceTracker = new SequenceTracker();

module.exports = { SequenceTracker, sequenceTracker };

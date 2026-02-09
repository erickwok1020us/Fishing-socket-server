const crypto = require('crypto');
const { ReceiptChain, createFishDeathReceipt } = require('../../src/modules/AuditReceipt');

describe('M5 Gate: Client Verifier (Hash Recomputation)', () => {
    test('client can recompute receipt hash from data', () => {
        const chain = new ReceiptChain('test-room-verifier');

        const mockFish = {
            fishId: 'fish-v1',
            typeName: 'sardine',
            maxHealth: 25,
            damageByPlayer: new Map([['socket-1', 25]]),
            costByPlayer: new Map([['socket-1', 10]]),
            seedCommitment: 'abc123'
        };
        const dist = [{ playerId: 1, socketId: 'socket-1', cost: 10, percent: 100, reward: 9 }];

        const receiptData = createFishDeathReceipt(mockFish, dist, 9, 'rules-hash', 1, 'abc123');
        const storedReceipt = chain.addReceipt(receiptData);

        const toHash = { ...storedReceipt };
        delete toHash.hash;
        const recomputed = crypto.createHash('sha256')
            .update(JSON.stringify(toHash))
            .digest('hex');

        expect(recomputed).toBe(storedReceipt.hash);
    });

    test('verifier detects modified payout', () => {
        const chain = new ReceiptChain('test-room-verifier-2');
        chain.addReceipt({ type: 'FISH_DEATH', fish_id: 'fish-1', payout_total: 10 });
        chain.addReceipt({ type: 'FISH_DEATH', fish_id: 'fish-2', payout_total: 20 });

        const receipts = chain.getReceipts();
        receipts[0].payout_total = 99999;

        const result = chain.verifyChain();
        expect(result.valid).toBe(false);
    });

    test('verifier detects modified fish_id', () => {
        const chain = new ReceiptChain('test-room-verifier-3');
        chain.addReceipt({ type: 'FISH_DEATH', fish_id: 'fish-1' });
        chain.addReceipt({ type: 'FISH_DEATH', fish_id: 'fish-2' });

        const receipts = chain.getReceipts();
        receipts[0].fish_id = 'HACKED';

        const result = chain.verifyChain();
        expect(result.valid).toBe(false);
    });

    test('full chain verification with real receipts', () => {
        const chain = new ReceiptChain('test-room-full');
        for (let i = 0; i < 5; i++) {
            const mockFish = {
                fishId: `fish-${i}`,
                typeName: 'sardine',
                maxHealth: 25,
                damageByPlayer: new Map([['socket-1', 25]]),
                costByPlayer: new Map([['socket-1', 10]]),
                seedCommitment: `commit-${i}`
            };
            const dist = [{ playerId: 1, socketId: 'socket-1', cost: 10, percent: 100, reward: 9 }];
            const receiptData = createFishDeathReceipt(mockFish, dist, 9, 'rules-hash', 1, `commit-${i}`);
            chain.addReceipt(receiptData);
        }

        const result = chain.verifyChain();
        expect(result.valid).toBe(true);
        expect(result.length).toBe(5);
    });
});

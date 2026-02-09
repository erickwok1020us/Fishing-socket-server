const { ReceiptChain, createFishDeathReceipt } = require('../../src/modules/AuditReceipt');

describe('M5 Gate: Receipt Schema Validation', () => {
    const mockFish = {
        fishId: 'fish-001',
        typeName: 'sardine',
        maxHealth: 25,
        damageByPlayer: new Map([['socket-1', 25]]),
        costByPlayer: new Map([['socket-1', 10]]),
        seedCommitment: 'abc123def456'
    };

    const mockDistribution = [
        { playerId: 1, socketId: 'socket-1', cost: 10, percent: 100, reward: 9 }
    ];

    test('receipt contains all required fields', () => {
        const receiptData = createFishDeathReceipt(
            mockFish, mockDistribution, 9, 'rules-hash-1', 1, 'commitment-1'
        );

        expect(receiptData.type).toBe('FISH_DEATH');
        expect(receiptData.fish_id).toBe('fish-001');
        expect(receiptData.fish_type).toBe('sardine');
        expect(receiptData.total_damage).toBe(25);
        expect(receiptData.payout_total).toBe(9);
        expect(receiptData.rules_hash).toBe('rules-hash-1');
        expect(receiptData.rules_version).toBe(1);
        expect(receiptData.proof_reference).toBe('commitment-1');

        const chain = new ReceiptChain('test-schema-room');
        const stored = chain.addReceipt(receiptData);
        expect(stored.timestamp).toBeDefined();
        expect(typeof stored.timestamp).toBe('number');
    });

    test('receipt includes player damage breakdown', () => {
        const receipt = createFishDeathReceipt(
            mockFish, mockDistribution, 9, 'rules-hash-1', 1, 'commitment-1'
        );

        expect(receipt.player_damage).toBeDefined();
        expect(Array.isArray(receipt.player_damage)).toBe(true);
        expect(receipt.player_damage.length).toBe(1);
        expect(receipt.player_damage[0].socketId).toBe('socket-1');
        expect(receipt.player_damage[0].damage).toBe(25);
    });

    test('receipt includes payout split', () => {
        const receipt = createFishDeathReceipt(
            mockFish, mockDistribution, 9, 'rules-hash-1', 1, 'commitment-1'
        );

        expect(receipt.payout_split).toBeDefined();
        expect(Array.isArray(receipt.payout_split)).toBe(true);
        expect(receipt.payout_split.length).toBe(1);
        expect(receipt.payout_split[0].reward).toBe(9);
    });

    test('receipt timestamp is numeric epoch (ms)', () => {
        const chain = new ReceiptChain('test-schema-ts');
        const receiptData = createFishDeathReceipt(
            mockFish, mockDistribution, 9, 'rules-hash-1', 1, 'commitment-1'
        );
        const stored = chain.addReceipt(receiptData);

        expect(typeof stored.timestamp).toBe('number');
        expect(stored.timestamp).toBeGreaterThan(0);
        expect(new Date(stored.timestamp).getFullYear()).toBeGreaterThanOrEqual(2024);
    });
});

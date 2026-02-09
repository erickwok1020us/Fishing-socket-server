const { ReceiptChain } = require('../../src/modules/AuditReceipt');

describe('M5 Gate: Hash Chain Integrity', () => {
    let chain;

    beforeEach(() => {
        chain = new ReceiptChain('test-room-chain');
    });

    test('first receipt links to GENESIS', () => {
        const receipt = chain.addReceipt({ type: 'FISH_DEATH', fish_id: 'fish-1' });
        expect(receipt.prevHash).toBe('GENESIS');
        expect(receipt.index).toBe(0);
    });

    test('second receipt links to first receipt hash', () => {
        const r1 = chain.addReceipt({ type: 'FISH_DEATH', fish_id: 'fish-1' });
        const r2 = chain.addReceipt({ type: 'FISH_DEATH', fish_id: 'fish-2' });
        expect(r2.prevHash).toBe(r1.hash);
        expect(r2.index).toBe(1);
    });

    test('receipt hash is SHA-256 hex (64 chars)', () => {
        const receipt = chain.addReceipt({ type: 'FISH_DEATH', fish_id: 'fish-1' });
        expect(receipt.hash).toBeDefined();
        expect(receipt.hash.length).toBe(64);
        expect(/^[0-9a-f]{64}$/.test(receipt.hash)).toBe(true);
    });

    test('chain of 10 receipts verifies successfully', () => {
        for (let i = 0; i < 10; i++) {
            chain.addReceipt({ type: 'FISH_DEATH', fish_id: `fish-${i}` });
        }

        const result = chain.verifyChain();
        expect(result.valid).toBe(true);
        expect(result.length).toBe(10);
    });

    test('empty chain verifies as valid', () => {
        const result = chain.verifyChain();
        expect(result.valid).toBe(true);
        expect(result.length).toBe(0);
    });

    test('tampered receipt breaks chain verification', () => {
        chain.addReceipt({ type: 'FISH_DEATH', fish_id: 'fish-1' });
        chain.addReceipt({ type: 'FISH_DEATH', fish_id: 'fish-2' });
        chain.addReceipt({ type: 'FISH_DEATH', fish_id: 'fish-3' });

        const receipts = chain.getReceipts();
        receipts[1].payout_total = 999999;

        const result = chain.verifyChain();
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
    });

    test('getReceipts returns all receipts in order', () => {
        chain.addReceipt({ type: 'FISH_DEATH', fish_id: 'fish-1' });
        chain.addReceipt({ type: 'FISH_DEATH', fish_id: 'fish-2' });

        const receipts = chain.getReceipts();
        expect(receipts.length).toBe(2);
        expect(receipts[0].index).toBe(0);
        expect(receipts[1].index).toBe(1);
    });
});

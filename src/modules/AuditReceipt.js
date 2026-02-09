const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const RECEIPTS_DIR = path.join(process.env.DATA_DIR || path.join(__dirname, '../../data'), 'receipts');

function hashReceipt(receiptJson) {
    return crypto.createHash('sha256').update(receiptJson).digest('hex');
}

class ReceiptChain {
    constructor(roomId) {
        this.roomId = roomId;
        this.receipts = [];
        this.prevHash = 'GENESIS';
        this.filePath = path.join(RECEIPTS_DIR, `${roomId}.jsonl`);

        try {
            if (!fs.existsSync(RECEIPTS_DIR)) {
                fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
            }
        } catch (e) {
            console.warn('[AUDIT] Cannot create receipts directory:', e.message);
        }
    }

    addReceipt(receiptData) {
        const receipt = {
            ...receiptData,
            prevHash: this.prevHash,
            index: this.receipts.length,
            timestamp: Date.now()
        };

        const receiptJson = JSON.stringify(receipt);
        const receiptHash = hashReceipt(receiptJson);
        receipt.hash = receiptHash;

        this.receipts.push(receipt);
        this.prevHash = receiptHash;

        try {
            fs.appendFileSync(this.filePath, JSON.stringify(receipt) + '\n');
        } catch (e) {
            console.warn('[AUDIT] Cannot write receipt:', e.message);
        }

        return receipt;
    }

    verifyChain() {
        let expectedPrevHash = 'GENESIS';
        for (let i = 0; i < this.receipts.length; i++) {
            const receipt = this.receipts[i];
            if (receipt.prevHash !== expectedPrevHash) {
                return { valid: false, error: `Chain broken at index ${i}`, index: i };
            }
            const { hash, ...rest } = receipt;
            const computedHash = hashReceipt(JSON.stringify(rest));
            if (computedHash !== hash) {
                return { valid: false, error: `Hash mismatch at index ${i}`, index: i };
            }
            expectedPrevHash = hash;
        }
        return { valid: true, length: this.receipts.length };
    }

    getReceipts() {
        return this.receipts;
    }

    getLength() {
        return this.receipts.length;
    }
}

function createFishDeathReceipt(fish, rewardDistribution, totalReward, rulesHash, rulesVersion, proofReference) {
    const playerDamage = [];
    const payoutSplit = [];

    for (const entry of rewardDistribution) {
        playerDamage.push({
            playerId: entry.playerId,
            socketId: entry.socketId,
            damage: fish.damageByPlayer.get(entry.socketId) || 0,
            cost: entry.cost
        });
        payoutSplit.push({
            playerId: entry.playerId,
            reward: entry.reward,
            percent: entry.percent
        });
    }

    return {
        type: 'FISH_DEATH',
        fish_id: fish.fishId,
        fish_type: fish.typeName,
        total_damage: fish.maxHealth,
        player_damage: playerDamage,
        payout_total: totalReward,
        payout_split: payoutSplit,
        finisher_bonus: 0,
        rules_hash: rulesHash,
        rules_version: rulesVersion,
        proof_reference: proofReference
    };
}

module.exports = { ReceiptChain, createFishDeathReceipt, hashReceipt };

const crypto = require('crypto');

function generateSeed() {
    return crypto.randomBytes(32);
}

function computeCommitment(seed) {
    return crypto.createHash('sha256').update(seed).digest('hex');
}

function deriveHP(seed, fishType, spawnIndex, roomId) {
    const message = `${fishType}|${spawnIndex}|${roomId}`;
    const hmac = crypto.createHmac('sha256', seed).update(message).digest();
    return hmac.readUInt32BE(0);
}

function deriveHPInRange(seed, fishType, spawnIndex, roomId, baseHP, hpRange) {
    const raw1 = deriveHP(seed, fishType, spawnIndex, roomId);
    const message2 = `${fishType}|${spawnIndex}|${roomId}|2`;
    const hmac2 = crypto.createHmac('sha256', seed).update(message2).digest();
    const raw2 = hmac2.readUInt32BE(0);

    const combined = (raw1 % hpRange) + (raw2 % hpRange);
    const centered = Math.floor(combined / 2);
    return baseHP + centered;
}

class RoomSeedManager {
    constructor(roomId) {
        this.roomId = roomId;
        this.currentSeed = null;
        this.currentCommitment = null;
        this.spawnIndex = 0;
        this.revealedSeeds = [];
        this.rotateSeed();
    }

    rotateSeed() {
        if (this.currentSeed) {
            this.revealedSeeds.push({
                seed: this.currentSeed.toString('hex'),
                commitment: this.currentCommitment,
                spawnRange: [0, this.spawnIndex - 1]
            });
        }
        this.currentSeed = generateSeed();
        this.currentCommitment = computeCommitment(this.currentSeed);
        this.spawnIndex = 0;
        return this.currentCommitment;
    }

    getFishHP(fishType, hpMin, hpMax) {
        const index = this.spawnIndex++;
        const hpRange = hpMax - hpMin + 1;
        const hp = deriveHPInRange(
            this.currentSeed, fishType, index, this.roomId, hpMin, hpRange
        );
        return {
            hp: Math.max(hpMin, Math.min(hpMax, hp)),
            spawnIndex: index,
            commitment: this.currentCommitment
        };
    }

    revealCurrentSeed() {
        return {
            seed: this.currentSeed.toString('hex'),
            commitment: this.currentCommitment,
            roomId: this.roomId
        };
    }

    getCommitment() {
        return this.currentCommitment;
    }

    getInfo() {
        return {
            roomId: this.roomId,
            currentCommitment: this.currentCommitment,
            spawnIndex: this.spawnIndex,
            revealedSeedCount: this.revealedSeeds.length
        };
    }
}

module.exports = {
    generateSeed,
    computeCommitment,
    deriveHP,
    deriveHPInRange,
    RoomSeedManager
};

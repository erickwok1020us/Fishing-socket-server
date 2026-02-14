const { secureRandom, secureRandomUUID } = require('../rng/CSPRNG');

const MONEY_SCALE = 1000;
const RTP_SCALE = 10000;
const WEIGHT_SCALE = 1000000;
const PROGRESS_SCALE = 1000000;
const P_SCALE = 1000000;
const K = 1.2;

const RTP_TIER_FP = {
    1: 9000,
    2: 9100,
    3: 9200,
    4: 9300,
    5: 9400,
    6: 9500
};

const N1_VALUES = {
    1: 6,
    2: 10,
    3: 16,
    4: 30,
    5: 45,
    6: 120
};

function computeRewardFp(tier) {
    const n1 = N1_VALUES[tier];
    const rtpTierFp = RTP_TIER_FP[tier];
    return Math.floor(n1 * MONEY_SCALE * rtpTierFp / (RTP_SCALE * K));
}

const TIER_CONFIG = {};
for (let t = 1; t <= 6; t++) {
    TIER_CONFIG[t] = {
        rtpTierFp: RTP_TIER_FP[t],
        n1Fp: N1_VALUES[t] * MONEY_SCALE,
        rewardFp: computeRewardFp(t)
    };
}

const AOE_MAX_TARGETS = 8;
const LASER_MAX_TARGETS = 6;
const EPSILON_FP = 1;

class RTPPhase1 {
    constructor() {
        this.states = new Map();
    }

    _stateKey(playerId, fishId) {
        return `${playerId}:${fishId}`;
    }

    _getOrCreateState(playerId, fishId) {
        const key = this._stateKey(playerId, fishId);
        let state = this.states.get(key);
        if (!state) {
            state = {
                sumCostFp: 0,
                budgetRemainingFp: 0,
                pityReached: false,
                killed: false
            };
            this.states.set(key, state);
        }
        return state;
    }

    getState(playerId, fishId) {
        return this.states.get(this._stateKey(playerId, fishId)) || null;
    }

    clearFishStates(fishId) {
        const suffix = `:${fishId}`;
        for (const key of this.states.keys()) {
            if (key.endsWith(suffix)) {
                this.states.delete(key);
            }
        }
    }

    clearPlayerStates(playerId) {
        const prefix = `${playerId}:`;
        for (const key of this.states.keys()) {
            if (key.startsWith(prefix)) {
                this.states.delete(key);
            }
        }
    }

    handleSingleTargetHit(playerId, fishId, weaponCostFp, tier) {
        const config = TIER_CONFIG[tier];
        if (!config) return { kill: false, error: 'invalid_tier' };

        const state = this._getOrCreateState(playerId, fishId);
        if (state.killed) return { kill: false, reason: 'already_killed' };

        const budgetTotalFp = Math.floor(weaponCostFp * config.rtpTierFp / RTP_SCALE);

        state.budgetRemainingFp += budgetTotalFp;
        state.sumCostFp += weaponCostFp;

        if (state.budgetRemainingFp < config.rewardFp) {
            if (state.sumCostFp >= config.n1Fp) {
                state.pityReached = true;
            }
            return { kill: false, reason: 'budget_gate', state: this._snapshotState(state) };
        }

        if (state.pityReached || (state.sumCostFp >= config.n1Fp && state.budgetRemainingFp >= config.rewardFp)) {
            return this._executeKill(state, config, playerId, fishId, 'hard_pity');
        }

        const pBaseFp = Math.min(P_SCALE, Math.floor(budgetTotalFp * P_SCALE / config.rewardFp));
        const progressFp = Math.floor(state.sumCostFp * PROGRESS_SCALE / config.n1Fp);
        const aFp = Math.floor(pBaseFp / 2);
        const pFp = Math.min(P_SCALE, pBaseFp + Math.floor(aFp * progressFp / PROGRESS_SCALE));

        const rand = Math.floor(secureRandom() * P_SCALE);

        if (rand < pFp) {
            return this._executeKill(state, config, playerId, fishId, 'probability');
        }

        return {
            kill: false,
            reason: 'roll_failed',
            pFp,
            state: this._snapshotState(state)
        };
    }

    handleMultiTargetHit(playerId, hitList, weaponCostFp, weaponType) {
        if (!hitList || hitList.length === 0) return [];

        const maxTargets = weaponType === 'laser' ? LASER_MAX_TARGETS : AOE_MAX_TARGETS;
        const trimmedList = hitList.slice(0, maxTargets);

        const n = trimmedList.length;
        const rawWeights = new Array(n);
        let rawSum = 0;

        for (let i = 0; i < n; i++) {
            if (weaponType === 'laser') {
                rawWeights[i] = Math.floor(WEIGHT_SCALE / (i + 1));
            } else {
                const dist = Math.max(trimmedList[i].distance, 1);
                rawWeights[i] = Math.floor(WEIGHT_SCALE / dist);
            }
            rawSum += rawWeights[i];
        }

        if (rawSum === 0) rawSum = 1;

        const weightsFp = new Array(n);
        let weightSum = 0;
        for (let i = 0; i < n - 1; i++) {
            weightsFp[i] = Math.floor(rawWeights[i] * WEIGHT_SCALE / rawSum);
            weightSum += weightsFp[i];
        }
        weightsFp[n - 1] = WEIGHT_SCALE - weightSum;

        let rtpWeightedFp = 0;
        for (let i = 0; i < n; i++) {
            const tierConfig = TIER_CONFIG[trimmedList[i].tier];
            if (!tierConfig) continue;
            rtpWeightedFp += Math.floor(weightsFp[i] * tierConfig.rtpTierFp / WEIGHT_SCALE);
        }

        const budgetTotalFp = Math.floor(weaponCostFp * rtpWeightedFp / RTP_SCALE);

        const budgetAllocFp = new Array(n);
        let budgetAllocSum = 0;
        for (let i = 0; i < n - 1; i++) {
            budgetAllocFp[i] = Math.floor(budgetTotalFp * weightsFp[i] / WEIGHT_SCALE);
            budgetAllocSum += budgetAllocFp[i];
        }
        budgetAllocFp[n - 1] = budgetTotalFp - budgetAllocSum;

        const results = [];

        for (let i = 0; i < n; i++) {
            const entry = trimmedList[i];
            const config = TIER_CONFIG[entry.tier];
            if (!config) {
                results.push({ fishId: entry.fishId, kill: false, reason: 'invalid_tier' });
                continue;
            }

            const state = this._getOrCreateState(playerId, entry.fishId);
            if (state.killed) {
                results.push({ fishId: entry.fishId, kill: false, reason: 'already_killed' });
                continue;
            }

            const costIFp = Math.floor(weaponCostFp * weightsFp[i] / WEIGHT_SCALE);
            state.sumCostFp += costIFp;
            state.budgetRemainingFp += budgetAllocFp[i];

            if (state.budgetRemainingFp < config.rewardFp) {
                if (state.sumCostFp >= config.n1Fp) {
                    state.pityReached = true;
                }
                results.push({ fishId: entry.fishId, kill: false, reason: 'budget_gate' });
                continue;
            }

            if (state.pityReached || (state.sumCostFp >= config.n1Fp && state.budgetRemainingFp >= config.rewardFp)) {
                results.push(this._executeKill(state, config, playerId, entry.fishId, 'hard_pity'));
                continue;
            }

            const pBaseIFp = Math.min(P_SCALE, Math.floor(budgetAllocFp[i] * P_SCALE / config.rewardFp));
            const progressIFp = Math.floor(state.sumCostFp * PROGRESS_SCALE / config.n1Fp);
            const aIFp = Math.floor(pBaseIFp / 2);
            const pIFp = Math.min(P_SCALE, pBaseIFp + Math.floor(aIFp * progressIFp / PROGRESS_SCALE));

            const randI = Math.floor(secureRandom() * P_SCALE);

            if (randI < pIFp) {
                results.push(this._executeKill(state, config, playerId, entry.fishId, 'probability'));
            } else {
                results.push({ fishId: entry.fishId, kill: false, reason: 'roll_failed', pFp: pIFp });
            }
        }

        return results;
    }

    _executeKill(state, config, playerId, fishId, reason) {
        state.budgetRemainingFp -= config.rewardFp;
        state.killed = true;
        const killEventId = secureRandomUUID();
        return {
            fishId,
            kill: true,
            reason,
            killEventId,
            rewardFp: config.rewardFp,
            reward: config.rewardFp / MONEY_SCALE,
            state: this._snapshotState(state)
        };
    }

    _snapshotState(state) {
        return {
            sumCostFp: state.sumCostFp,
            budgetRemainingFp: state.budgetRemainingFp,
            pityReached: state.pityReached,
            killed: state.killed
        };
    }
}

module.exports = {
    RTPPhase1,
    MONEY_SCALE,
    RTP_SCALE,
    WEIGHT_SCALE,
    PROGRESS_SCALE,
    P_SCALE,
    K,
    RTP_TIER_FP,
    N1_VALUES,
    TIER_CONFIG,
    AOE_MAX_TARGETS,
    LASER_MAX_TARGETS
};

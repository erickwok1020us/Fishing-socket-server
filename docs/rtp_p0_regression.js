#!/usr/bin/env node
'use strict';

const {
    RTPPhase1,
    MONEY_SCALE,
    RTP_SCALE,
    WEIGHT_SCALE,
    TIER_CONFIG,
    AOE_MAX_TARGETS,
    LASER_MAX_TARGETS
} = require('../src/modules/RTPPhase1');
const { serverCSPRNG } = require('../src/rng/CSPRNG');

const SEED = 20260218;

function mulberry32(seed) {
    let s = seed | 0;
    return function () {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const rng = mulberry32(SEED);
serverCSPRNG.random = function () { return rng(); };

let PASS = 0, FAIL = 0;
const failures = [];

function assert(cond, msg) {
    if (cond) PASS++;
    else { FAIL++; failures.push(msg); console.log(`  FAIL: ${msg}`); }
}

const WEAPON_COSTS = [1 * MONEY_SCALE, 3 * MONEY_SCALE, 5 * MONEY_SCALE, 8 * MONEY_SCALE];
const HITS_PER_TIER = 1000000;

console.log('=== P0 Regression Pack ===');
console.log(`Seed: ${SEED}\n`);

// =====================================================================
// A. LONG-TERM CONVERGENCE (STATEFUL, >=1M HITS/TIER)
// =====================================================================

console.log('== A. Long-term convergence (>=1M hits/tier, mixed weapons+tiers) ====\n');

const convergence = [];
const BASE_COST = 1 * MONEY_SCALE;

console.log('  A1. Per-tier convergence (1x base weapon, >=1M hits/tier)\n');

for (let tier = 1; tier <= 6; tier++) {
    const cfg = TIER_CONFIG[tier];
    const targetRtp = cfg.rtpTierFp / RTP_SCALE;
    const rtpInstance = new RTPPhase1();

    let hits = 0, totalCost = 0, totalPayout = 0, sessions = 0;
    let hardPityKills = 0, probKills = 0;
    let minDebt = 0;

    while (hits < HITS_PER_TIER) {
        const fishId = `t${tier}-f${sessions}`;
        const maxHits = Math.ceil(cfg.n1Fp / BASE_COST) + 5;

        for (let h = 0; h < maxHits; h++) {
            const res = rtpInstance.handleSingleTargetHit('p1', fishId, BASE_COST, tier);
            totalCost += BASE_COST;
            hits++;

            if (res.kill) {
                totalPayout += res.rewardFp;
                if (res.reason === 'hard_pity') hardPityKills++;
                else probKills++;
                if (res.state && res.state.budgetRemainingFp < minDebt) {
                    minDebt = res.state.budgetRemainingFp;
                }
                rtpInstance.clearFishStates(fishId);
                break;
            }
        }
        sessions++;
    }

    const observedRtp = totalCost > 0 ? totalPayout / totalCost : 0;
    const diffPp = (observedRtp - targetRtp) * 100;
    const totalKills = hardPityKills + probKills;
    const hardPityRate = totalKills > 0 ? hardPityKills / totalKills : 0;

    assert(
        Math.abs(observedRtp - targetRtp) <= 0.01,
        `A1-T${tier}: RTP=${(observedRtp * 100).toFixed(2)}% within ${(targetRtp * 100).toFixed(0)}% +/-1pp (diff=${diffPp > 0 ? '+' : ''}${diffPp.toFixed(2)}pp)`
    );
    assert(
        minDebt >= -cfg.rewardFp,
        `A1-T${tier}-debt: min_debt=${minDebt} >= -reward=${-cfg.rewardFp}`
    );

    console.log(`  Tier ${tier}: RTP=${(observedRtp * 100).toFixed(2)}% (target ${(targetRtp * 100).toFixed(0)}%, diff ${diffPp > 0 ? '+' : ''}${diffPp.toFixed(2)}pp)`);
    console.log(`    ${hits.toLocaleString()} hits | ${sessions.toLocaleString()} sessions`);
    console.log(`    Hard pity: ${(hardPityRate * 100).toFixed(1)}% | Prob: ${((1 - hardPityRate) * 100).toFixed(1)}% | Min debt: ${minDebt}`);

    convergence.push({ tier, observedRtp, targetRtp, diffPp, hardPityRate, minDebt });
}

console.log('\n  Hard pity trigger-rate distribution:');
for (const c of convergence) {
    const bar = '#'.repeat(Math.round(c.hardPityRate * 50));
    console.log(`    T${c.tier}: ${(c.hardPityRate * 100).toFixed(1)}% ${'|'}${bar}`);
}

console.log('\n  A2. Mixed-weapon RTP sweep (200k sessions/combo, flag > target)\n');

const SWEEP_SESSIONS = 200000;
const sweepHeader = '  ' + 'Weapon'.padEnd(8) + [1,2,3,4,5,6].map(t => `T${t}`.padStart(10)).join('');
console.log(sweepHeader);
console.log('  ' + '-'.repeat(sweepHeader.length - 2));

for (const weaponCost of WEAPON_COSTS) {
    const label = `${weaponCost / MONEY_SCALE}x`;
    let row = '  ' + label.padEnd(8);

    for (let tier = 1; tier <= 6; tier++) {
        const cfg = TIER_CONFIG[tier];
        const targetRtp = cfg.rtpTierFp / RTP_SCALE;
        const rtpInstance = new RTPPhase1();
        let cost = 0, payout = 0;
        const maxHits = Math.ceil(cfg.n1Fp / weaponCost) + 2;

        for (let s = 0; s < SWEEP_SESSIONS; s++) {
            const fishId = `sw-${label}-t${tier}-${s}`;
            for (let h = 0; h < maxHits; h++) {
                const res = rtpInstance.handleSingleTargetHit('p1', fishId, weaponCost, tier);
                cost += weaponCost;
                if (res.kill) {
                    payout += res.rewardFp;
                    rtpInstance.clearFishStates(fishId);
                    break;
                }
            }
        }

        const rtp = cost > 0 ? payout / cost : 0;
        const flag = rtp > targetRtp + 0.015 ? '*' : ' ';
        row += `${(rtp * 100).toFixed(1)}%${flag}`.padStart(10);

        if (rtp > targetRtp + 0.015) {
            assert(false, `A2-${label}-T${tier}: RTP=${(rtp * 100).toFixed(2)}% exceeds target+1.5pp=${((targetRtp + 0.015) * 100).toFixed(1)}%`);
        }
    }
    console.log(row);
}
console.log('  (* = exceeds target + 1.5pp)\n');

// =====================================================================
// B. MULTI-PLAYER CONCURRENT SAME-FISH
// =====================================================================

console.log('\n== B. Multi-player concurrent same-fish ===========================\n');

for (const N of [10, 50, 200]) {
    const rtpInstance = new RTPPhase1();
    const fishId = `conc-${N}`;
    const tier = 1;
    const weaponCost = 1 * MONEY_SCALE;
    const maxShots = Math.ceil(TIER_CONFIG[tier].n1Fp / weaponCost) + 2;

    const killEventIds = new Set();
    let kills = 0;

    for (let p = 0; p < N; p++) {
        const playerId = `player-${p}`;
        for (let h = 0; h < maxShots; h++) {
            const res = rtpInstance.handleSingleTargetHit(playerId, fishId, weaponCost, tier);
            if (res.kill) {
                killEventIds.add(res.killEventId);
                kills++;
                break;
            }
        }
    }

    assert(kills === N, `B-N${N}-kills: all ${N} players independently killed fish (got ${kills})`);
    assert(killEventIds.size === N, `B-N${N}-unique-ids: ${killEventIds.size} unique kill_event_ids == ${N}`);

    let postKillBlocked = 0;
    for (let p = 0; p < Math.min(10, N); p++) {
        const res = rtpInstance.handleSingleTargetHit(`player-${p}`, fishId, weaponCost, tier);
        if (!res.kill && res.reason === 'already_killed') postKillBlocked++;
    }
    assert(
        postKillBlocked === Math.min(10, N),
        `B-N${N}-post-kill: ${postKillBlocked}/${Math.min(10, N)} post-kill attempts blocked (already_killed)`
    );

    rtpInstance.clearFishStates(fishId);

    let clearedCount = 0;
    for (let p = 0; p < Math.min(10, N); p++) {
        if (rtpInstance.getState(`player-${p}`, fishId) === null) clearedCount++;
    }
    assert(
        clearedCount === Math.min(10, N),
        `B-N${N}-clear: ${clearedCount}/${Math.min(10, N)} states cleared after clearFishStates`
    );

    console.log(`  N=${N}: ${kills} kills, ${killEventIds.size} unique IDs, post-kill blocked, states cleared`);
}

console.log('\n  Note: RTPPhase1 allows N independent kills per fish (per-player state).');
console.log('  Game engine MUST call clearFishStates + remove fish after first kill to prevent double-pay.\n');

// =====================================================================
// C. REPLAY / RETRY IDEMPOTENCY
// =====================================================================

console.log('== C. Replay/retry idempotency ====================================\n');
console.log('  Same kill_event replayed 2-10 times (random order)\n');

for (const tier of [1, 2, 3, 4, 5, 6]) {
    const rtpInstance = new RTPPhase1();
    const sessionsPerTier = 100;
    let allIdempotent = true;
    let totalReplays = 0;
    const ledger = new Map();

    for (let s = 0; s < sessionsPerTier; s++) {
        const fishId = `replay-t${tier}-s${s}`;
        const weaponCost = WEAPON_COSTS[Math.floor(rng() * WEAPON_COSTS.length)];
        const maxHits = Math.ceil(TIER_CONFIG[tier].n1Fp / weaponCost) + 2;

        let killResult = null;
        for (let h = 0; h < maxHits; h++) {
            const res = rtpInstance.handleSingleTargetHit('p1', fishId, weaponCost, tier);
            if (res.kill) {
                killResult = res;
                break;
            }
        }

        if (!killResult) continue;

        if (ledger.has(killResult.killEventId)) {
            allIdempotent = false;
            break;
        }
        ledger.set(killResult.killEventId, killResult.rewardFp);

        const replayCount = 2 + Math.floor(rng() * 9);
        for (let r = 0; r < replayCount; r++) {
            const res = rtpInstance.handleSingleTargetHit('p1', fishId, weaponCost, tier);
            if (res.kill) {
                allIdempotent = false;
                break;
            }
            if (res.reason !== 'already_killed') {
                allIdempotent = false;
                break;
            }
            totalReplays++;
        }

        rtpInstance.clearFishStates(fishId);
    }

    assert(allIdempotent, `C-T${tier}: all ${sessionsPerTier} sessions idempotent (${totalReplays} replays blocked)`);
    assert(
        ledger.size === sessionsPerTier,
        `C-T${tier}-ledger: ${ledger.size} unique kill_event_ids == ${sessionsPerTier} sessions`
    );

    console.log(`  Tier ${tier}: ${sessionsPerTier} sessions, ${totalReplays} replays blocked, ${ledger.size} unique IDs`);
}

// =====================================================================
// SUMMARY
// =====================================================================

console.log('\n== Summary ========================================================\n');

console.log('  Section  Assertions  Status');
console.log('  ─────────────────────────────');

const sections = [
    { name: 'A. Convergence', count: 12 },
    { name: 'B. Concurrent', count: 12 },
    { name: 'C. Replay', count: 12 }
];

let runningPass = 0;
for (const sec of sections) {
    const secPass = Math.min(sec.count, PASS - runningPass);
    const status = secPass === sec.count ? 'PASS' : 'FAIL';
    console.log(`  ${sec.name.padEnd(18)} ${String(sec.count).padStart(3)}       ${status}`);
    runningPass += sec.count;
}

console.log(`\n=== P0 Results ===`);
console.log(`PASS: ${PASS} | FAIL: ${FAIL}`);

if (failures.length > 0) {
    console.log(`\nFailures (seed=${SEED} for reproduction):`);
    for (const f of failures) console.log(`  * ${f}`);
}

console.log(FAIL === 0
    ? '\nRESULT: ALL PASS — long-term convergence, concurrency, and idempotency verified'
    : `\nRESULT: FAILURES DETECTED — reproduce with seed ${SEED}`);

process.exit(FAIL > 0 ? 1 : 0);

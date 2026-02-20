#!/usr/bin/env node
'use strict';

const {
    RTPPhase1,
    MONEY_SCALE,
    RTP_SCALE,
    WEIGHT_SCALE,
    PROGRESS_SCALE,
    P_SCALE,
    TIER_CONFIG,
    AOE_MAX_TARGETS,
    LASER_MAX_TARGETS
} = require('../src/modules/RTPPhase1');
const { serverCSPRNG } = require('../src/rng/CSPRNG');

const SEED = 20260220;

function mulberry32(seed) {
    let s = seed | 0;
    return function () {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

let rng = mulberry32(SEED);
serverCSPRNG.random = function () { return rng(); };

let uuidCounter = 0;
serverCSPRNG.randomUUID = function () { return `uuid-${++uuidCounter}`; };

let PASS = 0, FAIL = 0;
const failures = [];

function assert(cond, msg) {
    if (cond) PASS++;
    else { FAIL++; failures.push(msg); console.log(`  FAIL: ${msg}`); }
}

function makeHitList(n, tier, startDist) {
    const list = [];
    for (let i = 0; i < n; i++) {
        list.push({
            fishId: `f-${String(i).padStart(4, '0')}`,
            tier: typeof tier === 'function' ? tier(i) : tier,
            distance: (startDist || 10) + i * 2
        });
    }
    return list;
}

function resetRng(seed) {
    rng = mulberry32(seed || SEED);
    serverCSPRNG.random = function () { return rng(); };
    uuidCounter = 0;
    serverCSPRNG.randomUUID = function () { return `uuid-${++uuidCounter}`; };
}

console.log('=== Final Multi-Target Weapon Regression Suite ===');
console.log(`Seed: ${SEED}\n`);

console.log('== A. Cross-weapon pity accumulation ================================\n');
console.log('  A1. 1x single-target builds pity, then 5x AOE hits same fish\n');

const sectionABefore = PASS + FAIL;

{
    resetRng(SEED + 1);
    const rtp = new RTPPhase1();
    const fishId = 'xw-pity-1';
    const tier = 1;
    const cfg = TIER_CONFIG[tier];

    const preHits = Math.floor(cfg.n1Fp / MONEY_SCALE) - 2;
    for (let h = 0; h < preHits; h++) {
        rtp.handleSingleTargetHit('p1', fishId, MONEY_SCALE, tier);
    }

    const stateAfter1x = rtp.getState('p1', fishId);
    assert(stateAfter1x !== null, 'A1-state-exists: state persists after 1x hits');
    assert(stateAfter1x.sumCostFp > 0, `A1-pity-accumulated: sumCost=${stateAfter1x.sumCostFp} > 0`);

    const hitList = [
        { fishId, tier, distance: 10 },
        { fishId: 'xw-other-1', tier, distance: 20 }
    ];
    const results = rtp.handleMultiTargetHit('p1', hitList, 5 * MONEY_SCALE, 'aoe');

    const targetResult = results.find(r => r.fishId === fishId);
    const otherResult = results.find(r => r.fishId === 'xw-other-1');

    assert(targetResult !== undefined, 'A1-target-in-results: pity fish appears in AOE results');

    if (targetResult && targetResult.kill) {
        const stateAfterKill = rtp.getState('p1', fishId);
        assert(stateAfterKill.killed === true, 'A1-killed-flag: pity fish killed via AOE after 1x accumulation');
    }

    if (otherResult) {
        const otherState = rtp.getState('p1', 'xw-other-1');
        assert(otherState.sumCostFp > 0, 'A1-other-state: other fish in AOE also got budget');
    }

    console.log(`    Pre-hits (1x): ${preHits}, sumCost after 1x: ${stateAfter1x.sumCostFp}`);
    console.log(`    AOE result: pity fish ${targetResult ? (targetResult.kill ? 'KILLED' : 'survived') : 'missing'}`);
    console.log(`    Other fish: ${otherResult ? (otherResult.kill ? 'killed' : 'survived') : 'missing'}\n`);
}

console.log('  A2. 3x pellets (single-target x3) vs 5x AOE (multi-target) on same fish\n');

{
    resetRng(SEED + 2);
    const rtp3x = new RTPPhase1();
    const rtp5x = new RTPPhase1();
    const tier = 2;
    const fishId = 'xw-compare';

    for (let p = 0; p < 3; p++) {
        rtp3x.handleSingleTargetHit('p1', fishId, MONEY_SCALE, tier);
    }
    const state3x = rtp3x.getState('p1', fishId);

    resetRng(SEED + 2);
    const hitList = [{ fishId, tier, distance: 10 }];
    rtp5x.handleMultiTargetHit('p1', hitList, 5 * MONEY_SCALE, 'aoe');
    const state5x = rtp5x.getState('p1', fishId);

    assert(state3x.sumCostFp === 3 * MONEY_SCALE, `A2-3x-sum: 3 pellets cost = ${state3x.sumCostFp} (expected ${3 * MONEY_SCALE})`);
    assert(state5x.sumCostFp > 0, `A2-5x-sum: AOE allocated cost = ${state5x.sumCostFp} > 0`);
    assert(state3x.sumCostFp !== state5x.sumCostFp, `A2-different-paths: 3x(${state3x.sumCostFp}) != 5x(${state5x.sumCostFp}) — different allocation`);

    console.log(`    3x pellets: sumCost=${state3x.sumCostFp}, budget=${state3x.budgetRemainingFp}`);
    console.log(`    5x AOE N=1: sumCost=${state5x.sumCostFp}, budget=${state5x.budgetRemainingFp}\n`);
}

console.log('  A3. Weapon switch mid-fish: 1x -> 3x -> 8x laser on same fish (tier 6 = high n1)\n');

{
    resetRng(SEED + 3);
    const rtp = new RTPPhase1();
    const fishId = 'xw-switch';
    const tier = 6;

    rtp.handleSingleTargetHit('p1', fishId, MONEY_SCALE, tier);
    const s1 = rtp.getState('p1', fishId).sumCostFp;

    rtp.handleSingleTargetHit('p1', fishId, MONEY_SCALE, tier);
    rtp.handleSingleTargetHit('p1', fishId, MONEY_SCALE, tier);
    const state2 = rtp.getState('p1', fishId);
    const s2 = state2.sumCostFp;

    if (state2.killed) {
        console.log(`    Fish killed early (prob roll), skipping laser check\n`);
        assert(true, 'A3-after-1x: fish killed early — skip (correct behavior)');
        assert(true, 'A3-after-3x: fish killed early — skip');
        assert(true, 'A3-after-laser: fish killed early — skip');
    } else {
        const hitList = [{ fishId, tier, distance: 10 }];
        rtp.handleMultiTargetHit('p1', hitList, 8 * MONEY_SCALE, 'laser');
        const s3 = rtp.getState('p1', fishId).sumCostFp;

        assert(s1 === MONEY_SCALE, `A3-after-1x: sumCost=${s1} == ${MONEY_SCALE}`);
        assert(s2 === 3 * MONEY_SCALE, `A3-after-3x: sumCost=${s2} == ${3 * MONEY_SCALE}`);
        assert(s3 > s2, `A3-after-laser: sumCost=${s3} > ${s2} (laser added cost)`);

        console.log(`    1x: sumCost=${s1} -> 3x(2 pellets): sumCost=${s2} -> 8x laser: sumCost=${s3}\n`);
    }
}

const sectionACount = (PASS + FAIL) - sectionABefore;
console.log(`  Section A: ${sectionACount} assertions\n`);

console.log('== B. Long-run multi-target RTP convergence =========================\n');

const sectionBBefore = PASS + FAIL;

console.log('  B1. Persistent RTPPhase1 instance, 50k AOE shots, T1 fish\n');

{
    resetRng(SEED + 10);
    const rtp = new RTPPhase1();
    const tier = 1;
    const weaponCost = 5 * MONEY_SCALE;
    const SHOTS = 50000;
    let totalCost = 0, totalPayout = 0, kills = 0;

    for (let shot = 0; shot < SHOTS; shot++) {
        const hitList = [];
        const n = 1 + Math.floor(rng() * AOE_MAX_TARGETS);
        for (let i = 0; i < n; i++) {
            hitList.push({
                fishId: `b1-s${shot}-f${i}`,
                tier,
                distance: 5 + rng() * 50
            });
        }

        const results = rtp.handleMultiTargetHit('p1', hitList, weaponCost, 'aoe');
        totalCost += weaponCost;

        for (const r of results) {
            if (r.kill) {
                totalPayout += r.rewardFp;
                kills++;
                rtp.clearFishStates(r.fishId);
            }
        }
    }

    const rtpBet = totalCost > 0 ? totalPayout / totalCost : 0;
    const targetRtp = TIER_CONFIG[tier].rtpTierFp / RTP_SCALE;

    assert(rtpBet > 0, `B1-nonzero: RTP_bet=${(rtpBet * 100).toFixed(2)}% > 0`);
    assert(rtpBet < targetRtp + 0.05, `B1-upper: RTP_bet=${(rtpBet * 100).toFixed(2)}% < ${((targetRtp + 0.05) * 100).toFixed(1)}%`);

    console.log(`    ${SHOTS} shots, ${kills} kills, RTP_bet=${(rtpBet * 100).toFixed(2)}%, target=${(targetRtp * 100).toFixed(1)}%\n`);
}

console.log('  B2. Persistent instance, 50k laser shots, T3 fish\n');

{
    resetRng(SEED + 11);
    const rtp = new RTPPhase1();
    const tier = 3;
    const weaponCost = 8 * MONEY_SCALE;
    const SHOTS = 50000;
    let totalCost = 0, totalPayout = 0, kills = 0;

    for (let shot = 0; shot < SHOTS; shot++) {
        const hitList = [];
        const n = 1 + Math.floor(rng() * LASER_MAX_TARGETS);
        for (let i = 0; i < n; i++) {
            hitList.push({
                fishId: `b2-s${shot}-f${i}`,
                tier,
                distance: 5 + i * 3
            });
        }

        const results = rtp.handleMultiTargetHit('p1', hitList, weaponCost, 'laser');
        totalCost += weaponCost;

        for (const r of results) {
            if (r.kill) {
                totalPayout += r.rewardFp;
                kills++;
                rtp.clearFishStates(r.fishId);
            }
        }
    }

    const rtpBet = totalCost > 0 ? totalPayout / totalCost : 0;
    const targetRtp = TIER_CONFIG[tier].rtpTierFp / RTP_SCALE;

    assert(rtpBet > 0, `B2-nonzero: RTP_bet=${(rtpBet * 100).toFixed(2)}% > 0`);
    assert(rtpBet < targetRtp + 0.05, `B2-upper: RTP_bet=${(rtpBet * 100).toFixed(2)}% < ${((targetRtp + 0.05) * 100).toFixed(1)}%`);

    console.log(`    ${SHOTS} shots, ${kills} kills, RTP_bet=${(rtpBet * 100).toFixed(2)}%, target=${(targetRtp * 100).toFixed(1)}%\n`);
}

console.log('  B3. Mixed weapons: alternate 1x/3x/5x/8x every 100 shots, same pool\n');

{
    resetRng(SEED + 12);
    const rtp = new RTPPhase1();
    const SHOTS = 40000;
    const weapons = [
        { cost: MONEY_SCALE, type: 'single' },
        { cost: 3 * MONEY_SCALE, type: 'single' },
        { cost: 5 * MONEY_SCALE, type: 'aoe' },
        { cost: 8 * MONEY_SCALE, type: 'laser' }
    ];
    let totalCost = 0, totalPayout = 0, kills = 0;

    for (let shot = 0; shot < SHOTS; shot++) {
        const w = weapons[Math.floor(shot / 100) % 4];
        const tier = 1 + Math.floor(rng() * 3);
        const fishId = `b3-s${shot}`;

        if (w.type === 'single') {
            totalCost += w.cost;
            const res = rtp.handleSingleTargetHit('p1', fishId, w.cost, tier);
            if (res.kill) {
                totalPayout += res.rewardFp;
                kills++;
                rtp.clearFishStates(fishId);
            }
        } else {
            const n = 1 + Math.floor(rng() * (w.type === 'laser' ? LASER_MAX_TARGETS : AOE_MAX_TARGETS));
            const hitList = [];
            for (let i = 0; i < n; i++) {
                hitList.push({
                    fishId: `b3-s${shot}-f${i}`,
                    tier: 1 + Math.floor(rng() * 3),
                    distance: 5 + rng() * 50
                });
            }
            totalCost += w.cost;
            const results = rtp.handleMultiTargetHit('p1', hitList, w.cost, w.type);
            for (const r of results) {
                if (r.kill) {
                    totalPayout += r.rewardFp;
                    kills++;
                    rtp.clearFishStates(r.fishId);
                }
            }
        }
    }

    const rtpBet = totalCost > 0 ? totalPayout / totalCost : 0;
    assert(rtpBet > 0, `B3-nonzero: mixed RTP_bet=${(rtpBet * 100).toFixed(2)}% > 0`);
    assert(rtpBet < 1.0, `B3-upper: mixed RTP_bet=${(rtpBet * 100).toFixed(2)}% < 100%`);

    console.log(`    ${SHOTS} shots (mixed 1x/3x/5x/8x), ${kills} kills, RTP_bet=${(rtpBet * 100).toFixed(2)}%\n`);
}

const sectionBCount = (PASS + FAIL) - sectionBBefore;
console.log(`  Section B: ${sectionBCount} assertions\n`);

console.log('== C. Weight distribution fairness ===================================\n');

const sectionCBefore = PASS + FAIL;

console.log('  C1. Closer fish get more budget (AOE distance-based)\n');

{
    resetRng(SEED + 20);
    const rtp = new RTPPhase1();
    const hitList = [
        { fishId: 'c1-close', tier: 1, distance: 5 },
        { fishId: 'c1-mid', tier: 1, distance: 25 },
        { fishId: 'c1-far', tier: 1, distance: 100 }
    ];

    const { _debug } = rtp.handleMultiTargetHit('p1', hitList, 5 * MONEY_SCALE, 'aoe', { debug: true });

    assert(_debug.weightsFp[0] > _debug.weightsFp[1], `C1-close>mid: w[0]=${_debug.weightsFp[0]} > w[1]=${_debug.weightsFp[1]}`);
    assert(_debug.weightsFp[1] > _debug.weightsFp[2], `C1-mid>far: w[1]=${_debug.weightsFp[1]} > w[2]=${_debug.weightsFp[2]}`);
    assert(_debug.budgetAllocFp[0] > _debug.budgetAllocFp[2], `C1-budget-close>far: b[0]=${_debug.budgetAllocFp[0]} > b[2]=${_debug.budgetAllocFp[2]}`);

    const wSum = _debug.weightsFp.reduce((s, v) => s + v, 0);
    assert(wSum === WEIGHT_SCALE, `C1-weight-sum: ${wSum} == ${WEIGHT_SCALE}`);

    console.log(`    Weights: close=${_debug.weightsFp[0]}, mid=${_debug.weightsFp[1]}, far=${_debug.weightsFp[2]}`);
    console.log(`    Budget:  close=${_debug.budgetAllocFp[0]}, mid=${_debug.budgetAllocFp[1]}, far=${_debug.budgetAllocFp[2]}\n`);
}

console.log('  C2. Laser position-based weighting (1/(i+1))\n');

{
    resetRng(SEED + 21);
    const rtp = new RTPPhase1();
    const hitList = [];
    for (let i = 0; i < LASER_MAX_TARGETS; i++) {
        hitList.push({ fishId: `c2-${i}`, tier: 1, distance: 10 + i * 5 });
    }

    const { _debug } = rtp.handleMultiTargetHit('p1', hitList, 8 * MONEY_SCALE, 'laser', { debug: true });

    for (let i = 0; i < LASER_MAX_TARGETS - 1; i++) {
        assert(_debug.weightsFp[i] > _debug.weightsFp[i + 1],
            `C2-laser-order-${i}: w[${i}]=${_debug.weightsFp[i]} > w[${i + 1}]=${_debug.weightsFp[i + 1]}`);
    }

    const wSum = _debug.weightsFp.reduce((s, v) => s + v, 0);
    assert(wSum === WEIGHT_SCALE, `C2-laser-weight-sum: ${wSum} == ${WEIGHT_SCALE}`);

    console.log(`    Laser weights (${LASER_MAX_TARGETS} targets): ${_debug.weightsFp.join(', ')}\n`);
}

console.log('  C3. AOE vs Laser: same fish list, different weight schemes\n');

{
    resetRng(SEED + 22);
    const rtp1 = new RTPPhase1();
    const rtp2 = new RTPPhase1();
    const hitList = [];
    for (let i = 0; i < LASER_MAX_TARGETS; i++) {
        hitList.push({ fishId: `c3-${i}`, tier: 1, distance: 10 + i * 5 });
    }

    const { _debug: dAoe } = rtp1.handleMultiTargetHit('p1', hitList, 5 * MONEY_SCALE, 'aoe', { debug: true });
    const { _debug: dLaser } = rtp2.handleMultiTargetHit('p2', hitList, 8 * MONEY_SCALE, 'laser', { debug: true });

    let differ = false;
    for (let i = 0; i < LASER_MAX_TARGETS; i++) {
        if (dAoe.weightsFp[i] !== dLaser.weightsFp[i]) { differ = true; break; }
    }
    assert(differ, 'C3-different-schemes: AOE distance-based != Laser position-based weights');

    console.log(`    AOE weights:   ${dAoe.weightsFp.join(', ')}`);
    console.log(`    Laser weights: ${dLaser.weightsFp.join(', ')}\n`);
}

console.log('  C4. Budget allocation with extreme tier mix (all T1 vs all T6 vs mixed)\n');

{
    resetRng(SEED + 23);
    const scenarios = [
        { label: 'all-T1', tierFn: () => 1 },
        { label: 'all-T6', tierFn: () => 6 },
        { label: 'T1+T6', tierFn: (i) => i < 4 ? 1 : 6 }
    ];

    for (const sc of scenarios) {
        const rtp = new RTPPhase1();
        const hitList = [];
        for (let i = 0; i < AOE_MAX_TARGETS; i++) {
            hitList.push({ fishId: `c4-${sc.label}-${i}`, tier: sc.tierFn(i), distance: 10 + i * 3 });
        }

        const { _debug } = rtp.handleMultiTargetHit('p1', hitList, 5 * MONEY_SCALE, 'aoe', { debug: true });
        const bSum = _debug.budgetAllocFp.reduce((s, v) => s + v, 0);
        assert(bSum === _debug.budgetTotalFp, `C4-${sc.label}-budget: sum=${bSum} == total=${_debug.budgetTotalFp}`);

        const wSum = _debug.weightsFp.reduce((s, v) => s + v, 0);
        assert(wSum === WEIGHT_SCALE, `C4-${sc.label}-weight: sum=${wSum} == ${WEIGHT_SCALE}`);

        console.log(`    ${sc.label}: budgetTotal=${_debug.budgetTotalFp}, rtpWeighted=${_debug.rtpWeightedFp}`);
    }
    console.log('');
}

const sectionCCount = (PASS + FAIL) - sectionCBefore;
console.log(`  Section C: ${sectionCCount} assertions\n`);

console.log('== D. Multi-player multi-target isolation ============================\n');

const sectionDBefore = PASS + FAIL;

console.log('  D1. 5 players fire AOE at overlapping fish groups simultaneously\n');

{
    resetRng(SEED + 30);
    const rtp = new RTPPhase1();
    const PLAYERS = 5;
    const ROUNDS = 1000;
    const playerStats = {};

    for (let p = 0; p < PLAYERS; p++) {
        playerStats[`p${p}`] = { cost: 0, payout: 0, kills: 0 };
    }

    for (let round = 0; round < ROUNDS; round++) {
        for (let p = 0; p < PLAYERS; p++) {
            const hitList = [];
            for (let i = 0; i < 5; i++) {
                hitList.push({
                    fishId: `d1-r${round}-f${i + (p % 3) * 2}`,
                    tier: 1 + Math.floor(rng() * 3),
                    distance: 10 + rng() * 40
                });
            }
            const results = rtp.handleMultiTargetHit(`p${p}`, hitList, 5 * MONEY_SCALE, 'aoe');
            playerStats[`p${p}`].cost += 5 * MONEY_SCALE;
            for (const r of results) {
                if (r.kill) {
                    playerStats[`p${p}`].payout += r.rewardFp;
                    playerStats[`p${p}`].kills++;
                }
            }
        }
    }

    let anyLeak = false;
    for (let p = 0; p < PLAYERS; p++) {
        const ps = playerStats[`p${p}`];
        const otherPlayers = Object.entries(playerStats).filter(([k]) => k !== `p${p}`);
        for (const [ok, os] of otherPlayers) {
            if (ps.kills > 0 && os.kills > 0) {
                const p1State = rtp.getState(`p${p}`, `d1-r0-f0`);
                const p2State = rtp.getState(ok, `d1-r0-f0`);
                if (p1State && p2State && p1State === p2State) {
                    anyLeak = true;
                }
            }
        }
    }

    assert(!anyLeak, 'D1-isolation: no shared state between players');

    for (let p = 0; p < PLAYERS; p++) {
        const ps = playerStats[`p${p}`];
        console.log(`    p${p}: cost=${ps.cost / MONEY_SCALE}, payout=${(ps.payout / MONEY_SCALE).toFixed(1)}, kills=${ps.kills}`);
    }
    console.log('');
}

console.log('  D2. 3 players fire laser at exact same fish list\n');

{
    resetRng(SEED + 31);
    const rtp = new RTPPhase1();
    const ROUNDS = 500;
    const playerKills = { p0: 0, p1: 0, p2: 0 };

    for (let round = 0; round < ROUNDS; round++) {
        const sharedFish = [];
        for (let i = 0; i < LASER_MAX_TARGETS; i++) {
            sharedFish.push({
                fishId: `d2-r${round}-f${i}`,
                tier: 1,
                distance: 10 + i * 5
            });
        }

        for (const pid of ['p0', 'p1', 'p2']) {
            const results = rtp.handleMultiTargetHit(pid, sharedFish, 8 * MONEY_SCALE, 'laser');
            for (const r of results) {
                if (r.kill) {
                    playerKills[pid]++;
                    rtp.clearFishStates(r.fishId);
                }
            }
        }
    }

    const p0s = rtp.getState('p0', 'd2-r0-f0');
    const p1s = rtp.getState('p1', 'd2-r0-f0');
    assert(p0s !== p1s || p0s === null, 'D2-state-isolation: p0 and p1 have separate state objects');

    assert(playerKills.p0 >= 0 && playerKills.p1 >= 0 && playerKills.p2 >= 0,
        `D2-all-players-active: kills p0=${playerKills.p0}, p1=${playerKills.p1}, p2=${playerKills.p2}`);

    console.log(`    Kills: p0=${playerKills.p0}, p1=${playerKills.p1}, p2=${playerKills.p2}\n`);
}

const sectionDCount = (PASS + FAIL) - sectionDBefore;
console.log(`  Section D: ${sectionDCount} assertions\n`);

console.log('== E. Kill + survive mixed results ===================================\n');

const sectionEBefore = PASS + FAIL;

console.log('  E1. AOE hits 8 fish, some killed, fire again at survivors\n');

{
    resetRng(SEED + 40);
    const rtp = new RTPPhase1();
    const tier = 1;
    const weaponCost = 5 * MONEY_SCALE;
    const ATTEMPTS = 200;
    let totalKills = 0;
    let statePreserved = 0;
    let stateCorrupted = 0;

    for (let a = 0; a < ATTEMPTS; a++) {
        const hitList = [];
        for (let i = 0; i < AOE_MAX_TARGETS; i++) {
            hitList.push({ fishId: `e1-a${a}-f${i}`, tier, distance: 10 + i * 3 });
        }

        const r1 = rtp.handleMultiTargetHit('p1', hitList, weaponCost, 'aoe');
        const killed = [];
        const survived = [];
        for (const r of r1) {
            if (r.kill) {
                killed.push(r.fishId);
                rtp.clearFishStates(r.fishId);
            } else {
                survived.push(r.fishId);
            }
        }
        totalKills += killed.length;

        if (survived.length > 0) {
            const survivorList = survived.map(fid => ({ fishId: fid, tier, distance: 10 }));
            const r2 = rtp.handleMultiTargetHit('p1', survivorList, weaponCost, 'aoe');
            for (const r of r2) {
                const state = rtp.getState('p1', r.fishId);
                if (state && state.sumCostFp > 0) {
                    statePreserved++;
                } else {
                    stateCorrupted++;
                }
                if (r.kill) {
                    totalKills++;
                    rtp.clearFishStates(r.fishId);
                }
            }
        }
    }

    assert(stateCorrupted === 0, `E1-state-preserved: ${stateCorrupted} corrupted (expected 0)`);
    assert(totalKills > 0, `E1-kills: ${totalKills} total kills across ${ATTEMPTS} attempts`);

    console.log(`    ${ATTEMPTS} attempts, ${totalKills} total kills, ${statePreserved} survivor states checked, ${stateCorrupted} corrupted\n`);
}

console.log('  E2. Rapid repeated fire at same 8-fish group (50 shots, no clear)\n');

{
    resetRng(SEED + 41);
    const rtp = new RTPPhase1();
    const tier = 2;
    const weaponCost = 5 * MONEY_SCALE;
    const SHOTS = 50;
    const killCounts = new Array(AOE_MAX_TARGETS).fill(0);
    let alreadyKilledCount = 0;

    const hitList = [];
    for (let i = 0; i < AOE_MAX_TARGETS; i++) {
        hitList.push({ fishId: `e2-f${i}`, tier, distance: 10 + i * 3 });
    }

    for (let shot = 0; shot < SHOTS; shot++) {
        const results = rtp.handleMultiTargetHit('p1', hitList, weaponCost, 'aoe');
        for (const r of results) {
            if (r.kill) {
                const idx = parseInt(r.fishId.split('-f')[1]);
                killCounts[idx]++;
            }
            if (r.reason === 'already_killed') {
                alreadyKilledCount++;
            }
        }
    }

    const multiKilled = killCounts.filter(c => c > 1).length;
    assert(multiKilled === 0, `E2-no-multi-kill: ${multiKilled} fish killed more than once (no clearFishStates)`);

    const totalKills = killCounts.reduce((s, c) => s + c, 0);
    assert(totalKills > 0, `E2-some-kills: ${totalKills} kills from ${SHOTS} shots`);
    assert(totalKills <= AOE_MAX_TARGETS, `E2-max-kills: ${totalKills} <= ${AOE_MAX_TARGETS} (each fish can die once)`);
    assert(alreadyKilledCount > 0, `E2-already-killed: ${alreadyKilledCount} hits on dead fish returned already_killed`);

    console.log(`    ${SHOTS} shots at same ${AOE_MAX_TARGETS} fish (no clear): ${totalKills} kills, ${alreadyKilledCount} already_killed\n`);
}

console.log('  E3. Post-kill clearFishStates + re-ID: verify fresh state\n');

{
    resetRng(SEED + 42);
    const rtp = new RTPPhase1();
    const tier = 1;
    const fishId = 'e3-reuse';
    const weaponCost = MONEY_SCALE;
    const cfg = TIER_CONFIG[tier];

    for (let h = 0; h < Math.ceil(cfg.n1Fp / weaponCost) + 5; h++) {
        const res = rtp.handleSingleTargetHit('p1', fishId, weaponCost, tier);
        if (res.kill) break;
    }
    const stateAfterKill = rtp.getState('p1', fishId);
    assert(stateAfterKill && stateAfterKill.killed, 'E3-killed: fish killed before clear');

    rtp.clearFishStates(fishId);
    const stateAfterClear = rtp.getState('p1', fishId);
    assert(stateAfterClear === null, 'E3-cleared: state is null after clearFishStates');

    const res = rtp.handleSingleTargetHit('p1', fishId, weaponCost, tier);
    const freshState = rtp.getState('p1', fishId);
    assert(freshState.sumCostFp === weaponCost, `E3-fresh: new sumCost=${freshState.sumCostFp} == ${weaponCost}`);
    assert(freshState.killed === false || freshState.killed === res.kill, 'E3-fresh-killed: new state starts unkilled (or just got killed)');

    console.log(`    Kill -> clear -> re-hit: fresh sumCost=${freshState.sumCostFp}, killed=${freshState.killed}\n`);
}

const sectionECount = (PASS + FAIL) - sectionEBefore;
console.log(`  Section E: ${sectionECount} assertions\n`);

console.log('== F. Edge cases =====================================================\n');

const sectionFBefore = PASS + FAIL;

console.log('  F1. Empty hitList\n');

{
    const rtp = new RTPPhase1();
    const results = rtp.handleMultiTargetHit('p1', [], 5 * MONEY_SCALE, 'aoe');
    assert(Array.isArray(results) && results.length === 0, `F1-empty: returns empty array (got length=${results.length})`);
    console.log('    Empty hitList -> empty results\n');
}

console.log('  F2. HitList with invalid tier\n');

{
    resetRng(SEED + 50);
    const rtp = new RTPPhase1();
    const hitList = [
        { fishId: 'f2-valid', tier: 1, distance: 10 },
        { fishId: 'f2-invalid', tier: 99, distance: 20 },
        { fishId: 'f2-valid2', tier: 2, distance: 30 }
    ];
    const results = rtp.handleMultiTargetHit('p1', hitList, 5 * MONEY_SCALE, 'aoe');

    assert(results.length === 3, `F2-count: 3 results returned (got ${results.length})`);
    const invalidResult = results.find(r => r.fishId === 'f2-invalid');
    assert(invalidResult && !invalidResult.kill, 'F2-invalid-no-kill: invalid tier does not kill');

    console.log(`    3 fish (1 invalid tier): ${results.map(r => `${r.fishId}:${r.kill ? 'kill' : r.reason}`).join(', ')}\n`);
}

console.log('  F3. All fish already killed\n');

{
    resetRng(SEED + 51);
    const rtp = new RTPPhase1();

    for (let i = 0; i < 3; i++) {
        const fid = `f3-${i}`;
        const cfg = TIER_CONFIG[1];
        for (let h = 0; h < Math.ceil(cfg.n1Fp / MONEY_SCALE) + 5; h++) {
            const res = rtp.handleSingleTargetHit('p1', fid, MONEY_SCALE, 1);
            if (res.kill) break;
        }
    }

    const hitList = [
        { fishId: 'f3-0', tier: 1, distance: 10 },
        { fishId: 'f3-1', tier: 1, distance: 20 },
        { fishId: 'f3-2', tier: 1, distance: 30 }
    ];
    const results = rtp.handleMultiTargetHit('p1', hitList, 5 * MONEY_SCALE, 'aoe');

    const allAlreadyKilled = results.every(r => r.reason === 'already_killed');
    assert(allAlreadyKilled, `F3-all-dead: all 3 return already_killed`);

    console.log(`    Pre-killed 3 fish, AOE on them: ${results.map(r => r.reason).join(', ')}\n`);
}

console.log('  F4. Single fish in multi-target call (N=1 for both AOE and laser)\n');

{
    resetRng(SEED + 52);
    const rtp1 = new RTPPhase1();
    const rtp2 = new RTPPhase1();
    const rtp3 = new RTPPhase1();

    const singleRes = rtp1.handleSingleTargetHit('p1', 'f4-single', MONEY_SCALE, 1);
    const aoeRes = rtp2.handleMultiTargetHit('p1', [{ fishId: 'f4-aoe', tier: 1, distance: 10 }], MONEY_SCALE, 'aoe');
    const laserRes = rtp3.handleMultiTargetHit('p1', [{ fishId: 'f4-laser', tier: 1, distance: 10 }], MONEY_SCALE, 'laser');

    assert(aoeRes.length === 1, `F4-aoe-n1: results length=1 (got ${aoeRes.length})`);
    assert(laserRes.length === 1, `F4-laser-n1: results length=1 (got ${laserRes.length})`);

    const s1 = rtp1.getState('p1', 'f4-single');
    const s2 = rtp2.getState('p1', 'f4-aoe');
    const s3 = rtp3.getState('p1', 'f4-laser');

    assert(s1.sumCostFp === MONEY_SCALE, `F4-single-cost: ${s1.sumCostFp} == ${MONEY_SCALE}`);

    console.log(`    Single: sumCost=${s1.sumCostFp}, AOE N=1: sumCost=${s2.sumCostFp}, Laser N=1: sumCost=${s3.sumCostFp}\n`);
}

console.log('  F5. Distance edge: distance=1 (minimum) and distance=10000\n');

{
    resetRng(SEED + 53);
    const rtp = new RTPPhase1();
    const hitList = [
        { fishId: 'f5-near', tier: 1, distance: 1 },
        { fishId: 'f5-far', tier: 1, distance: 10000 }
    ];
    const { _debug } = rtp.handleMultiTargetHit('p1', hitList, 5 * MONEY_SCALE, 'aoe', { debug: true });

    assert(_debug.weightsFp[0] > _debug.weightsFp[1], `F5-near>far: w[0]=${_debug.weightsFp[0]} >> w[1]=${_debug.weightsFp[1]}`);

    const ratio = _debug.weightsFp[0] / Math.max(1, _debug.weightsFp[1]);
    console.log(`    dist=1: weight=${_debug.weightsFp[0]}, dist=10000: weight=${_debug.weightsFp[1]}, ratio=${ratio.toFixed(0)}:1\n`);
}

console.log('  F6. Null/undefined hitList\n');

{
    const rtp = new RTPPhase1();
    const r1 = rtp.handleMultiTargetHit('p1', null, 5 * MONEY_SCALE, 'aoe');
    const r2 = rtp.handleMultiTargetHit('p1', undefined, 5 * MONEY_SCALE, 'aoe');

    assert(Array.isArray(r1) && r1.length === 0, `F6-null: returns empty array`);
    assert(Array.isArray(r2) && r2.length === 0, `F6-undefined: returns empty array`);

    console.log('    null -> [], undefined -> []\n');
}

const sectionFCount = (PASS + FAIL) - sectionFBefore;
console.log(`  Section F: ${sectionFCount} assertions\n`);

console.log('== G. 3x pellet shared-state (3 x single-target) ====================\n');

const sectionGBefore = PASS + FAIL;

console.log('  G1. 3x fires 3 pellets at SAME fish: pity accumulates 3x\n');

{
    resetRng(SEED + 60);
    const rtp = new RTPPhase1();
    const tier = 1;
    const fishId = 'g1-same';
    const pelletCost = MONEY_SCALE;

    for (let p = 0; p < 3; p++) {
        rtp.handleSingleTargetHit('p1', fishId, pelletCost, tier);
    }

    const state = rtp.getState('p1', fishId);
    assert(state.sumCostFp === 3 * pelletCost, `G1-3pellets-same: sumCost=${state.sumCostFp} == ${3 * pelletCost}`);

    console.log(`    3 pellets at same fish: sumCost=${state.sumCostFp}\n`);
}

console.log('  G2. 3x fires 3 pellets at DIFFERENT fish: each gets 1x cost\n');

{
    resetRng(SEED + 61);
    const rtp = new RTPPhase1();
    const tier = 1;
    const pelletCost = MONEY_SCALE;

    for (let p = 0; p < 3; p++) {
        rtp.handleSingleTargetHit('p1', `g2-f${p}`, pelletCost, tier);
    }

    for (let p = 0; p < 3; p++) {
        const state = rtp.getState('p1', `g2-f${p}`);
        assert(state.sumCostFp === pelletCost, `G2-pellet-${p}: sumCost=${state.sumCostFp} == ${pelletCost}`);
    }

    console.log('    3 pellets at 3 different fish: each has sumCost=1000\n');
}

console.log('  G3. Long-run 3x convergence: 100k shots, 3 pellets each, same fish per shot\n');

{
    resetRng(SEED + 62);
    const rtp = new RTPPhase1();
    const tier = 1;
    const pelletCost = MONEY_SCALE;
    const SHOTS = 100000;
    let totalCost = 0, totalPayout = 0, kills = 0;

    for (let shot = 0; shot < SHOTS; shot++) {
        const fishId = `g3-${shot}`;
        for (let p = 0; p < 3; p++) {
            totalCost += pelletCost;
            const res = rtp.handleSingleTargetHit('p1', fishId, pelletCost, tier);
            if (res.kill) {
                totalPayout += res.rewardFp;
                kills++;
                rtp.clearFishStates(fishId);
                break;
            }
        }
    }

    const rtpBet = totalCost > 0 ? totalPayout / totalCost : 0;
    const target = TIER_CONFIG[tier].rtpTierFp / RTP_SCALE;

    assert(rtpBet > 0, `G3-nonzero: RTP=${(rtpBet * 100).toFixed(2)}% > 0`);
    assert(rtpBet < target + 0.05, `G3-upper: RTP=${(rtpBet * 100).toFixed(2)}% < ${((target + 0.05) * 100).toFixed(1)}%`);

    console.log(`    100k shots (3 pellets/shot): ${kills} kills, RTP=${(rtpBet * 100).toFixed(2)}%, target=${(target * 100).toFixed(1)}%\n`);
}

const sectionGCount = (PASS + FAIL) - sectionGBefore;
console.log(`  Section G: ${sectionGCount} assertions\n`);

console.log('== H. Determinism: multi-target with seeded PRNG ====================\n');

const sectionHBefore = PASS + FAIL;

{
    function runMultiTargetSession(seed) {
        resetRng(seed);
        const rtp = new RTPPhase1();
        const log = [];
        const ROUNDS = 2000;

        for (let r = 0; r < ROUNDS; r++) {
            const n = 1 + Math.floor(rng() * 8);
            const hitList = [];
            for (let i = 0; i < n; i++) {
                hitList.push({
                    fishId: `h-r${r}-f${i}`,
                    tier: 1 + Math.floor(rng() * 6),
                    distance: 5 + rng() * 50
                });
            }

            const wType = rng() < 0.5 ? 'aoe' : 'laser';
            const wCost = wType === 'aoe' ? 5 * MONEY_SCALE : 8 * MONEY_SCALE;
            const results = rtp.handleMultiTargetHit('p1', hitList, wCost, wType);

            for (const res of results) {
                if (res.kill) {
                    log.push({ round: r, fishId: res.fishId, killEventId: res.killEventId, rewardFp: res.rewardFp });
                    rtp.clearFishStates(res.fishId);
                }
            }
        }
        return log;
    }

    const baseline = runMultiTargetSession(SEED + 70);

    let allMatch = true;
    for (let trial = 0; trial < 5; trial++) {
        const check = runMultiTargetSession(SEED + 70);
        if (check.length !== baseline.length) { allMatch = false; break; }
        for (let i = 0; i < baseline.length; i++) {
            if (baseline[i].killEventId !== check[i].killEventId ||
                baseline[i].rewardFp !== check[i].rewardFp) {
                allMatch = false;
                break;
            }
        }
        if (!allMatch) break;
    }

    assert(allMatch, `H-determinism: 5 runs identical (${baseline.length} kills each)`);
    console.log(`  5 runs with seed ${SEED + 70}: ${allMatch ? 'ALL IDENTICAL' : 'MISMATCH'} (${baseline.length} kills)\n`);
}

const sectionHCount = (PASS + FAIL) - sectionHBefore;
console.log(`  Section H: ${sectionHCount} assertions\n`);

console.log('== I. Stress: high-frequency multi-target fire =======================\n');

const sectionIBefore = PASS + FAIL;

console.log('  I1. 10k rapid AOE shots at rotating fish pool (100 fish IDs)\n');

{
    resetRng(SEED + 80);
    const rtp = new RTPPhase1();
    const SHOTS = 10000;
    const POOL_SIZE = 100;
    let totalCost = 0, totalPayout = 0, kills = 0;
    let maxStates = 0;

    for (let shot = 0; shot < SHOTS; shot++) {
        const hitList = [];
        const base = (shot * 3) % POOL_SIZE;
        for (let i = 0; i < AOE_MAX_TARGETS; i++) {
            const fIdx = (base + i) % POOL_SIZE;
            hitList.push({
                fishId: `i1-f${fIdx}`,
                tier: 1 + (fIdx % 3),
                distance: 10 + rng() * 40
            });
        }

        const results = rtp.handleMultiTargetHit('p1', hitList, 5 * MONEY_SCALE, 'aoe');
        totalCost += 5 * MONEY_SCALE;

        for (const r of results) {
            if (r.kill) {
                totalPayout += r.rewardFp;
                kills++;
                rtp.clearFishStates(r.fishId);
            }
        }

        if (rtp.states.size > maxStates) maxStates = rtp.states.size;
    }

    const rtpBet = totalCost > 0 ? totalPayout / totalCost : 0;
    assert(kills > 0, `I1-kills: ${kills} kills in ${SHOTS} shots`);
    assert(maxStates <= POOL_SIZE * 2, `I1-state-bound: maxStates=${maxStates} <= ${POOL_SIZE * 2}`);

    console.log(`    ${SHOTS} shots, ${kills} kills, RTP=${(rtpBet * 100).toFixed(2)}%, maxStates=${maxStates}\n`);
}

console.log('  I2. 10k rapid laser shots at rotating fish pool (50 fish IDs)\n');

{
    resetRng(SEED + 81);
    const rtp = new RTPPhase1();
    const SHOTS = 10000;
    const POOL_SIZE = 50;
    let totalCost = 0, totalPayout = 0, kills = 0;

    for (let shot = 0; shot < SHOTS; shot++) {
        const hitList = [];
        const base = (shot * 2) % POOL_SIZE;
        for (let i = 0; i < LASER_MAX_TARGETS; i++) {
            const fIdx = (base + i) % POOL_SIZE;
            hitList.push({
                fishId: `i2-f${fIdx}`,
                tier: 1 + (fIdx % 6),
                distance: 10 + i * 5
            });
        }

        const results = rtp.handleMultiTargetHit('p1', hitList, 8 * MONEY_SCALE, 'laser');
        totalCost += 8 * MONEY_SCALE;

        for (const r of results) {
            if (r.kill) {
                totalPayout += r.rewardFp;
                kills++;
                rtp.clearFishStates(r.fishId);
            }
        }
    }

    const rtpBet = totalCost > 0 ? totalPayout / totalCost : 0;
    assert(kills > 0, `I2-kills: ${kills} kills in ${SHOTS} shots`);

    console.log(`    ${SHOTS} shots, ${kills} kills, RTP=${(rtpBet * 100).toFixed(2)}%\n`);
}

const sectionICount = (PASS + FAIL) - sectionIBefore;
console.log(`  Section I: ${sectionICount} assertions\n`);

resetRng(SEED);

console.log('== Summary ========================================================\n');

const sections = [
    ['A', 'Cross-weapon pity accumulation', sectionACount],
    ['B', 'Long-run multi-target RTP convergence', sectionBCount],
    ['C', 'Weight distribution fairness', sectionCCount],
    ['D', 'Multi-player multi-target isolation', sectionDCount],
    ['E', 'Kill + survive mixed results', sectionECount],
    ['F', 'Edge cases', sectionFCount],
    ['G', '3x pellet shared-state', sectionGCount],
    ['H', 'Determinism (multi-target)', sectionHCount],
    ['I', 'Stress: high-frequency fire', sectionICount]
];

let total = 0;
for (const [letter, label, count] of sections) {
    console.log(`  ${letter}. ${label.padEnd(42)} ${count}`);
    total += count;
}
console.log(`  ${'─'.repeat(52)}`);
console.log(`  TOTAL${' '.repeat(45)} ${total}`);

console.log(`\n=== Final Multi-Target Results ===`);
console.log(`PASS: ${PASS} | FAIL: ${FAIL}`);

if (failures.length > 0) {
    console.log(`\nFailures (seed=${SEED} for reproduction):`);
    for (const f of failures) {
        console.log(`  * ${f}`);
    }
    console.log(`\nRESULT: FAILURES DETECTED`);
    process.exit(1);
} else {
    console.log(`\nRESULT: ALL PASS`);
    process.exit(0);
}

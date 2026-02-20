#!/usr/bin/env node
'use strict';

const {
    RTPPhase1,
    MONEY_SCALE,
    RTP_SCALE,
    TIER_CONFIG,
    AOE_MAX_TARGETS,
    LASER_MAX_TARGETS
} = require('../src/modules/RTPPhase1');
const { serverCSPRNG } = require('../src/rng/CSPRNG');

const SEED = 20260211;

function mulberry32(seed) {
    let s = seed | 0;
    return function () {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const rngRtp = mulberry32(SEED);
const rngSim = mulberry32(SEED + 42);
const _origRandom = serverCSPRNG.random.bind(serverCSPRNG);
serverCSPRNG.random = function () { return rngRtp(); };

let PASS = 0, FAIL = 0;
const failures = [], flagList = [];
const FLAG_PP = 1.5;
const TICK_SEC = 0.5;
const SHOTS_TARGET = 500000;

function assert(cond, msg) {
    if (cond) PASS++;
    else { FAIL++; failures.push(msg); console.log(`  FAIL: ${msg}`); }
}

function addFlag(label, rtp, target) {
    const thresh = target + FLAG_PP / 100;
    if (rtp > thresh) {
        flagList.push({ label, rtp, target, thresh });
        return true;
    }
    return false;
}

function makeMixedHitList(n, rng) {
    const tiers = [1, 1, 1, 2, 2, 3, 3, 4, 5, 6];
    const list = [];
    for (let i = 0; i < n; i++) {
        list.push({
            fishId: `m-${String(i).padStart(4, '0')}`,
            tier: tiers[i % tiers.length],
            distance: 10 + Math.floor(rng() * 50)
        });
    }
    return list;
}

function fishDensity(tick, rng) {
    const base = 8, amp = 6, period = 20;
    return Math.max(1, Math.round(base + amp * Math.sin(2 * Math.PI * tick / period) + (rng() - 0.5) * 4));
}

const summary = [];

console.log('=== Player Behavior Simulation (>=500k shots, seeded) ===');
console.log(`Seed: ${SEED} | Flag threshold: RTP > target + ${FLAG_PP}pp\n`);

// =====================================================================
// MODEL 1: DENSITY SNIPER
// =====================================================================

console.log('== Model 1: Density Sniper =======================================\n');
console.log('  Rule: idle until fishCount >= 12, fire 1-2 shots (5x/8x), idle\n');

const DENSITY_MIN = 12;

for (const wType of ['aoe', 'laser']) {
    const cap = wType === 'laser' ? LASER_MAX_TARGETS : AOE_MAX_TARGETS;
    const weaponCostFp = (wType === 'laser' ? 8 : 5) * MONEY_SCALE;
    const label = wType === 'laser' ? '8x-Laser' : '5x-Rocket';

    let payout = 0, cost = 0, shots = 0;
    let waitTicks = 0, bursts = 0, tick = 0;

    while (shots < SHOTS_TARGET) {
        const d = fishDensity(tick, rngSim);
        tick++;
        if (d < DENSITY_MIN) { waitTicks++; continue; }

        const shotsInBurst = rngSim() < 0.5 ? 1 : 2;
        bursts++;

        for (let i = 0; i < shotsInBurst && shots < SHOTS_TARGET; i++) {
            const rtp = new RTPPhase1();
            const hitList = makeMixedHitList(Math.min(d, 30), rngSim);
            const results = rtp.handleMultiTargetHit('p1', hitList, weaponCostFp, wType);
            cost += weaponCostFp;
            for (const r of results) if (r.kill) payout += r.rewardFp;
            shots++;
        }
    }

    const rtpBet = cost > 0 ? payout / cost : 0;
    const totalMin = tick * TICK_SEC / 60;
    const avgWait = (waitTicks / Math.max(bursts, 1)) * TICK_SEC;
    const payoutPerMin = payout / MONEY_SCALE / totalMin;
    const costPerMin = cost / MONEY_SCALE / totalMin;

    const target = 0.95;
    const fl = addFlag(`Sniper-${label}`, rtpBet, target);
    assert(
        rtpBet <= target + FLAG_PP / 100,
        `Sniper-${label}: RTP_per_bet=${(rtpBet * 100).toFixed(2)}% <= ${((target + FLAG_PP / 100) * 100).toFixed(1)}%`
    );

    console.log(`  ${label}:`);
    console.log(`    Shots:          ${shots.toLocaleString()} | Bursts: ${bursts.toLocaleString()}`);
    console.log(`    RTP_per_bet:    ${(rtpBet * 100).toFixed(2)}%${fl ? ' FLAG' : ''}`);
    console.log(`    RTP_per_minute: payout ${payoutPerMin.toFixed(0)} gold/min | cost ${costPerMin.toFixed(0)} gold/min`);
    console.log(`    Avg wait:       ${avgWait.toFixed(1)}s between bursts\n`);

    summary.push({ model: 'Sniper', config: label, metric: 'RTP_per_bet', value: rtpBet, flagged: fl });
}

// =====================================================================
// MODEL 2: PITY FARMER
// =====================================================================

console.log('== Model 2: Pity Farmer ==========================================\n');
console.log('  Rule: 1x until sumCost >= N1 - 2*cost_1x, switch 8x on same fish\n');
console.log('  Goal: detect cross-weapon pity exploitation\n');

const COST_1X = 1 * MONEY_SCALE;
const COST_8X = 8 * MONEY_SCALE;

for (const tier of [1, 2, 3]) {
    const cfg = TIER_CONFIG[tier];
    const n1Fp = cfg.n1Fp;
    const rewardFp = cfg.rewardFp;
    const switchAt = n1Fp - 2 * COST_1X;
    const avgShotsPerSess = Math.ceil(n1Fp / COST_1X);
    const sessions = Math.ceil(SHOTS_TARGET / avgShotsPerSess);

    let fCost = 0, fPayout = 0, fShots = 0;
    let warmupKills = 0, switchKills = 0, switchAttempts = 0;
    let nearPityShots = 0, nearPityKills = 0;
    let hardPityKills = 0, probKills = 0;

    for (let s = 0; s < sessions; s++) {
        const rtp = new RTPPhase1();
        const fishId = `farm-${s}`;
        let killed = false;

        while (!killed) {
            const st = rtp.getState('p1', fishId);
            const cur = st ? st.sumCostFp : 0;
            if (cur >= switchAt) break;

            const isNear = cur >= switchAt - COST_1X;
            if (isNear) nearPityShots++;

            const res = rtp.handleSingleTargetHit('p1', fishId, COST_1X, tier);
            fCost += COST_1X;
            fShots++;

            if (res.kill) {
                fPayout += res.rewardFp;
                warmupKills++;
                if (isNear) nearPityKills++;
                if (res.reason === 'hard_pity') hardPityKills++;
                else probKills++;
                killed = true;
            }
        }

        if (!killed) {
            switchAttempts++;
            const hitList = [{ fishId, tier, distance: 10 }];
            const results = rtp.handleMultiTargetHit('p1', hitList, COST_8X, 'laser');
            fCost += COST_8X;
            fShots++;

            for (const r of results) {
                if (r.kill) {
                    fPayout += r.rewardFp;
                    switchKills++;
                    if (r.reason === 'hard_pity') hardPityKills++;
                    else probKills++;
                    killed = true;
                }
            }
        }

        if (!killed) {
            for (let extra = 0; extra < 50; extra++) {
                const res = rtp.handleSingleTargetHit('p1', fishId, COST_1X, tier);
                fCost += COST_1X;
                fShots++;
                if (res.kill) {
                    fPayout += res.rewardFp;
                    if (res.reason === 'hard_pity') hardPityKills++;
                    else probKills++;
                    break;
                }
            }
        }
    }

    let bCost = 0, bPayout = 0, bShots = 0;
    for (let s = 0; s < sessions; s++) {
        const rtp = new RTPPhase1();
        const fishId = `base-${s}`;
        for (let i = 0; i < 300; i++) {
            const res = rtp.handleSingleTargetHit('p1', fishId, COST_1X, tier);
            bCost += COST_1X;
            bShots++;
            if (res.kill) { bPayout += res.rewardFp; break; }
        }
    }

    const fRtp = fCost > 0 ? fPayout / fCost : 0;
    const bRtp = bCost > 0 ? bPayout / bCost : 0;
    const pKillNear = nearPityShots > 0 ? nearPityKills / nearPityShots : 0;
    const pKillSwitch = switchAttempts > 0 ? switchKills / switchAttempts : 0;
    const evBefore = pKillNear * rewardFp - COST_1X;
    const evAfter = pKillSwitch * rewardFp - COST_8X;
    const diff = fRtp - bRtp;

    assert(
        fRtp <= bRtp + FLAG_PP / 100,
        `Farmer-T${tier}: farmer=${(fRtp * 100).toFixed(2)}% <= baseline+1.5pp=${((bRtp + FLAG_PP / 100) * 100).toFixed(2)}%`
    );

    const tierTarget = cfg.rtpTierFp / RTP_SCALE;
    const fl = addFlag(`Farmer-T${tier}`, fRtp, tierTarget);

    console.log(`  Tier ${tier} (N1=${n1Fp / MONEY_SCALE}, reward=${rewardFp / MONEY_SCALE}):`);
    console.log(`    Sessions:        ${sessions.toLocaleString()} | Farmer shots: ${fShots.toLocaleString()} | Baseline shots: ${bShots.toLocaleString()}`);
    console.log(`    Farmer RTP:      ${(fRtp * 100).toFixed(2)}%`);
    console.log(`    Baseline RTP:    ${(bRtp * 100).toFixed(2)}%`);
    console.log(`    Diff:            ${diff > 0 ? '+' : ''}${(diff * 100).toFixed(2)}pp ${diff > 0 ? '(farmer HIGHER)' : '(baseline higher)'}`);
    console.log(`    Kill breakdown:  hard_pity=${hardPityKills} | probability=${probKills}`);
    console.log(`    P(kill near N1): ${(pKillNear * 100).toFixed(1)}% (last 1x shots before switch)`);
    console.log(`    P(kill on 8x):   ${(pKillSwitch * 100).toFixed(1)}%`);
    console.log(`    EV_before (1x):  ${(evBefore / MONEY_SCALE).toFixed(2)} gold/shot`);
    console.log(`    EV_after  (8x):  ${(evAfter / MONEY_SCALE).toFixed(2)} gold/shot${fl ? ' FLAG' : ''}\n`);

    summary.push({
        model: 'Farmer', config: `T${tier}`,
        metric: 'farmer_rtp', value: fRtp,
        baseline: bRtp, diff, flagged: fl
    });
}

// =====================================================================
// MODEL 3: BURST TIMING PLAYER
// =====================================================================

console.log('== Model 3: Burst Timing Player ===================================\n');
console.log('  Rule: observe density, fire AOE only during 3s high-density window\n');
console.log('  Comparison: continuous auto-attack at same rate\n');

const BURST_DENSITY_THRESH = 11;
const BURST_WINDOW_TICKS = 6;
const BURST_WEAPON_COST = 5 * MONEY_SCALE;

{
    let bPayout = 0, bCost = 0, bShots = 0;
    let bTick = 0;
    let burstRemaining = 0;

    while (bShots < SHOTS_TARGET) {
        const d = fishDensity(bTick, rngSim);
        bTick++;
        if (d >= BURST_DENSITY_THRESH) burstRemaining = BURST_WINDOW_TICKS;

        if (burstRemaining > 0) {
            burstRemaining--;
            const rtp = new RTPPhase1();
            const hitList = makeMixedHitList(Math.min(d, 30), rngSim);
            const results = rtp.handleMultiTargetHit('p1', hitList, BURST_WEAPON_COST, 'aoe');
            bCost += BURST_WEAPON_COST;
            for (const r of results) if (r.kill) bPayout += r.rewardFp;
            bShots++;
        }
    }

    let aPayout = 0, aCost = 0, aShots = 0;
    let aTick = 0;

    while (aShots < SHOTS_TARGET) {
        const d = fishDensity(aTick, rngSim);
        aTick++;
        const rtp = new RTPPhase1();
        const hitList = makeMixedHitList(Math.min(d, 30), rngSim);
        const results = rtp.handleMultiTargetHit('p1', hitList, BURST_WEAPON_COST, 'aoe');
        aCost += BURST_WEAPON_COST;
        for (const r of results) if (r.kill) aPayout += r.rewardFp;
        aShots++;
    }

    const bRtpShot = bCost > 0 ? bPayout / bCost : 0;
    const aRtpShot = aCost > 0 ? aPayout / aCost : 0;
    const bTimeMin = bTick * TICK_SEC / 60;
    const aTimeMin = aTick * TICK_SEC / 60;
    const bPayMin = bPayout / MONEY_SCALE / bTimeMin;
    const aPayMin = aPayout / MONEY_SCALE / aTimeMin;
    const bCostMin = bCost / MONEY_SCALE / bTimeMin;
    const aCostMin = aCost / MONEY_SCALE / aTimeMin;
    const shotDiff = bRtpShot - aRtpShot;

    assert(
        bRtpShot <= aRtpShot + FLAG_PP / 100,
        `Burst vs Auto: burst=${(bRtpShot * 100).toFixed(2)}% <= auto+1.5pp=${((aRtpShot + FLAG_PP / 100) * 100).toFixed(2)}%`
    );

    const target = 0.95;
    const flB = addFlag('Burst-shot', bRtpShot, target);
    const flA = addFlag('Auto-shot', aRtpShot, target);

    assert(
        bRtpShot <= target + FLAG_PP / 100,
        `Burst-shot: ${(bRtpShot * 100).toFixed(2)}% <= ${((target + FLAG_PP / 100) * 100).toFixed(1)}%`
    );
    assert(
        aRtpShot <= target + FLAG_PP / 100,
        `Auto-shot: ${(aRtpShot * 100).toFixed(2)}% <= ${((target + FLAG_PP / 100) * 100).toFixed(1)}%`
    );

    console.log('  Burst Player (fire during density peaks only):');
    console.log(`    Shots: ${bShots.toLocaleString()} | Time: ${bTimeMin.toFixed(1)} min`);
    console.log(`    RTP_shot:  ${(bRtpShot * 100).toFixed(2)}%${flB ? ' FLAG' : ''}`);
    console.log(`    RTP_time:  payout ${bPayMin.toFixed(0)} gold/min | cost ${bCostMin.toFixed(0)} gold/min`);
    console.log('');
    console.log('  Auto-Attack (fire every tick):');
    console.log(`    Shots: ${aShots.toLocaleString()} | Time: ${aTimeMin.toFixed(1)} min`);
    console.log(`    RTP_shot:  ${(aRtpShot * 100).toFixed(2)}%${flA ? ' FLAG' : ''}`);
    console.log(`    RTP_time:  payout ${aPayMin.toFixed(0)} gold/min | cost ${aCostMin.toFixed(0)} gold/min`);
    console.log('');
    console.log('  Comparison:');
    console.log(`    Shot RTP diff:   ${shotDiff > 0 ? '+' : ''}${(shotDiff * 100).toFixed(2)}pp ${shotDiff > 0 ? '(burst higher)' : '(auto higher or equal)'}`);
    console.log(`    Time efficiency: burst=${bPayMin.toFixed(0)} vs auto=${aPayMin.toFixed(0)} gold/min payout\n`);

    summary.push(
        { model: 'Burst', config: 'burst', metric: 'RTP_shot', value: bRtpShot, flagged: flB },
        { model: 'Burst', config: 'auto', metric: 'RTP_shot', value: aRtpShot, flagged: flA }
    );
}

// =====================================================================
// SUMMARY TABLE
// =====================================================================

console.log('== Summary ========================================================\n');

const col = { m: 12, c: 12, met: 16, v: 10 };
const hdr = 'Model'.padEnd(col.m) + 'Config'.padEnd(col.c) + 'Metric'.padEnd(col.met) + 'Value'.padStart(col.v) + '  Flag';
console.log(`  ${hdr}`);
console.log(`  ${'─'.repeat(hdr.length)}`);
for (const s of summary) {
    const val = typeof s.value === 'number' ? `${(s.value * 100).toFixed(2)}%` : String(s.value);
    const extra = s.diff !== undefined ? ` (diff ${s.diff > 0 ? '+' : ''}${(s.diff * 100).toFixed(2)}pp)` : '';
    const row = s.model.padEnd(col.m) + s.config.padEnd(col.c) + s.metric.padEnd(col.met) + val.padStart(col.v) + (s.flagged ? '  FLAG' : '') + extra;
    console.log(`  ${row}`);
}

console.log(`\n=== Results ===`);
console.log(`PASS: ${PASS} | FAIL: ${FAIL}`);

if (flagList.length > 0) {
    console.log(`\nFlags (RTP > target + ${FLAG_PP}pp):`);
    for (const f of flagList) {
        console.log(`  FLAG: ${f.label}: ${(f.rtp * 100).toFixed(2)}% > ${(f.thresh * 100).toFixed(1)}%`);
    }
}

if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  * ${f}`);
}

console.log(FAIL === 0
    ? '\nRESULT: ALL PASS — no strategic player advantage detected'
    : '\nRESULT: FAILURES DETECTED — review above');

process.exit(FAIL > 0 ? 1 : 0);

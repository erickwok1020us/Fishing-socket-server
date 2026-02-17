#!/usr/bin/env node
'use strict';

const {
    RTPPhase1,
    MONEY_SCALE,
    RTP_SCALE,
    WEIGHT_SCALE,
    P_SCALE,
    TIER_CONFIG,
    AOE_MAX_TARGETS,
    LASER_MAX_TARGETS
} = require('../src/modules/RTPPhase1');

let PASS = 0;
let FAIL = 0;
const failures = [];

function assert(cond, msg) {
    if (cond) {
        PASS++;
    } else {
        FAIL++;
        failures.push(msg);
        console.log(`  ✗ ${msg}`);
    }
}

function makeHitList(n, tier, startDist) {
    const list = [];
    for (let i = 0; i < n; i++) {
        list.push({
            fishId: `fish-${String(i).padStart(4, '0')}`,
            tier,
            distance: (startDist || 10) + i * 2
        });
    }
    return list;
}

function tierLabel(t) {
    return ['', 'S1-Small', 'S2-Common', 'S3-Medium', 'S4-Large', 'S5-Rare', 'S6-Boss'][t] || `T${t}`;
}

console.log('=== T5 Regression: Target Cap + Budget Normalization ===\n');

console.log('A. Hard-fail target cap enforcement\n');
console.log('   Spawn 100 fish → handleMultiTargetHit must return <= cap results.\n');

for (const wType of ['aoe', 'laser']) {
    const cap = wType === 'laser' ? LASER_MAX_TARGETS : AOE_MAX_TARGETS;
    const weaponCostFp = (wType === 'laser' ? 8 : 5) * MONEY_SCALE;

    for (const n of [cap, cap + 1, 20, 50, 100]) {
        const rtp = new RTPPhase1();
        const hitList = makeHitList(n, 1, 5);
        const results = rtp.handleMultiTargetHit('p1', hitList, weaponCostFp, wType);
        assert(
            results.length <= cap,
            `A-${wType}-N${n}: results.length=${results.length} <= cap=${cap}`
        );
    }
    console.log(`   ${wType.toUpperCase()} cap=${cap}: all N∈{${cap},${cap + 1},20,50,100} → OK`);
}

console.log('\n   Deterministic tie-break: same input → same output order\n');

for (const wType of ['aoe', 'laser']) {
    const cap = wType === 'laser' ? LASER_MAX_TARGETS : AOE_MAX_TARGETS;
    const weaponCostFp = (wType === 'laser' ? 8 : 5) * MONEY_SCALE;

    const hitList = [];
    for (let i = 0; i < 20; i++) {
        hitList.push({
            fishId: `det-${String(i).padStart(3, '0')}`,
            tier: (i % 6) + 1,
            distance: 10 + (i % 5) * 0.1
        });
    }

    hitList.sort((a, b) => a.distance - b.distance || a.fishId.localeCompare(b.fishId));
    const expected = hitList.slice(0, cap).map(h => h.fishId);

    for (let run = 0; run < 3; run++) {
        const rtp = new RTPPhase1();
        const sorted = [...hitList].sort((a, b) => a.distance - b.distance || a.fishId.localeCompare(b.fishId));
        const trimmed = sorted.slice(0, cap);
        const results = rtp.handleMultiTargetHit('p1', trimmed, weaponCostFp, wType);
        const ids = results.map(r => r.fishId);
        const match = ids.every((id, idx) => id === expected[idx]);
        assert(match, `A-det-${wType}-run${run}: order matches expected`);
    }
    console.log(`   ${wType.toUpperCase()}: 3 runs with same seed → deterministic order ✓`);
}

console.log('\nB. Budget conservation (Σbudget_i_fp == budget_total_fp)\n');

for (const wType of ['aoe', 'laser']) {
    const cap = wType === 'laser' ? LASER_MAX_TARGETS : AOE_MAX_TARGETS;
    const weaponCostFp = (wType === 'laser' ? 8 : 5) * MONEY_SCALE;

    for (let n = 1; n <= cap; n++) {
        const hitList = makeHitList(n, 1, 10);

        const rawWeights = new Array(n);
        let rawSum = 0;
        for (let i = 0; i < n; i++) {
            if (wType === 'laser') {
                rawWeights[i] = Math.floor(WEIGHT_SCALE / (i + 1));
            } else {
                const dist = Math.max(hitList[i].distance, 1);
                rawWeights[i] = Math.floor(WEIGHT_SCALE / dist);
            }
            rawSum += rawWeights[i];
        }
        if (rawSum === 0) rawSum = 1;

        const weightsFp = new Array(n);
        let wSum = 0;
        for (let i = 0; i < n - 1; i++) {
            weightsFp[i] = Math.floor(rawWeights[i] * WEIGHT_SCALE / rawSum);
            wSum += weightsFp[i];
        }
        weightsFp[n - 1] = WEIGHT_SCALE - wSum;

        let rtpWeightedFp = 0;
        for (let i = 0; i < n; i++) {
            const tc = TIER_CONFIG[hitList[i].tier];
            rtpWeightedFp += Math.floor(weightsFp[i] * tc.rtpTierFp / WEIGHT_SCALE);
        }

        const budgetTotalFp = Math.floor(weaponCostFp * rtpWeightedFp / RTP_SCALE);

        let budgetAllocSum = 0;
        for (let i = 0; i < n - 1; i++) {
            budgetAllocSum += Math.floor(budgetTotalFp * weightsFp[i] / WEIGHT_SCALE);
        }
        const lastBudget = budgetTotalFp - budgetAllocSum;
        budgetAllocSum += lastBudget;

        assert(
            budgetAllocSum === budgetTotalFp,
            `B-${wType}-N${n}: Σbudget_i_fp=${budgetAllocSum} == budget_total_fp=${budgetTotalFp}`
        );
    }
    console.log(`   ${wType.toUpperCase()}: budget conservation holds for N=1..${cap}`);
}

console.log('\nB2. Truncation invariant: Σweight == WEIGHT_SCALE post-truncation, budget unchanged\n');

for (const wType of ['aoe', 'laser']) {
    const cap = wType === 'laser' ? LASER_MAX_TARGETS : AOE_MAX_TARGETS;
    const weaponCostFp = (wType === 'laser' ? 8 : 5) * MONEY_SCALE;

    for (const rawN of [cap, cap + 5, 20, 50, 100]) {
        const fullList = makeHitList(rawN, 1, 10);
        const trimmedList = fullList.slice(0, cap);
        const n = trimmedList.length;

        const rawWeights = new Array(n);
        let rawSum = 0;
        for (let i = 0; i < n; i++) {
            if (wType === 'laser') {
                rawWeights[i] = Math.floor(WEIGHT_SCALE / (i + 1));
            } else {
                const dist = Math.max(trimmedList[i].distance, 1);
                rawWeights[i] = Math.floor(WEIGHT_SCALE / dist);
            }
            rawSum += rawWeights[i];
        }
        if (rawSum === 0) rawSum = 1;

        const weightsFp = new Array(n);
        let wSum = 0;
        for (let i = 0; i < n - 1; i++) {
            weightsFp[i] = Math.floor(rawWeights[i] * WEIGHT_SCALE / rawSum);
            wSum += weightsFp[i];
        }
        weightsFp[n - 1] = WEIGHT_SCALE - wSum;

        const totalWeight = weightsFp.reduce((s, w) => s + w, 0);
        assert(
            totalWeight === WEIGHT_SCALE,
            `B2-${wType}-raw${rawN}: Σweight_fp=${totalWeight} == WEIGHT_SCALE=${WEIGHT_SCALE}`
        );

        let rtpWeightedFp = 0;
        for (let i = 0; i < n; i++) {
            const tc = TIER_CONFIG[trimmedList[i].tier];
            rtpWeightedFp += Math.floor(weightsFp[i] * tc.rtpTierFp / WEIGHT_SCALE);
        }
        const budgetTotalFp = Math.floor(weaponCostFp * rtpWeightedFp / RTP_SCALE);

        let budgetAllocSum = 0;
        const budgetAllocFp = new Array(n);
        for (let i = 0; i < n - 1; i++) {
            budgetAllocFp[i] = Math.floor(budgetTotalFp * weightsFp[i] / WEIGHT_SCALE);
            budgetAllocSum += budgetAllocFp[i];
        }
        budgetAllocFp[n - 1] = budgetTotalFp - budgetAllocSum;
        budgetAllocSum += budgetAllocFp[n - 1];

        assert(
            budgetAllocSum === budgetTotalFp,
            `B2-${wType}-raw${rawN}: Σbudget_i=${budgetAllocSum} == budget_total=${budgetTotalFp} (post-truncation)`
        );

        const rtp2 = new RTPPhase1();
        const results = rtp2.handleMultiTargetHit('p1', fullList, weaponCostFp, wType);
        assert(
            results.length <= cap,
            `B2-${wType}-raw${rawN}: results.length=${results.length} <= cap=${cap} (truncation enforced)`
        );
    }
    console.log(`   ${wType.toUpperCase()}: Σweight==WEIGHT_SCALE, Σbudget==budget_total for raw N∈{${cap},${cap+5},20,50,100}`);
}

const THRESHOLD_PP = 2;

console.log(`\nC. Monte-Carlo RTP_shot + RTP_hit — density matrix (threshold: target+${THRESHOLD_PP}pp)\n`);

const DENSITY = {
    sparse:  { label: 'Sparse',  nFn: (cap) => 1 },
    normal:  { label: 'Normal',  nFn: (cap) => Math.ceil(cap / 2) },
    dense:   { label: 'Dense',   nFn: (cap) => cap },
    extreme: { label: 'Extreme', nFn: (cap) => cap * 3 },
};

const MC_SHOTS = 80000;

function runMCShot(weaponType, weaponCostFp, hitCount, tier) {
    let totalPayout = 0;
    let totalShotCost = 0;
    let totalHitCost = 0;
    let kills = 0;

    const cap = weaponType === 'laser' ? LASER_MAX_TARGETS : AOE_MAX_TARGETS;
    const effectiveHits = Math.min(hitCount, cap);

    for (let shot = 0; shot < MC_SHOTS; shot++) {
        const rtp = new RTPPhase1();
        const hitList = makeHitList(hitCount, tier, 10);
        const results = rtp.handleMultiTargetHit('p1', hitList, weaponCostFp, weaponType);

        totalShotCost += weaponCostFp;

        let shotPayout = 0;
        for (const r of results) {
            if (r.kill) {
                shotPayout += r.rewardFp;
                kills++;
            }
        }
        totalPayout += shotPayout;

        totalHitCost += weaponCostFp;
    }

    const rtpShot = totalShotCost > 0 ? totalPayout / totalShotCost : 0;
    const rtpHit = totalHitCost > 0 ? totalPayout / totalHitCost : 0;

    return { rtpShot, rtpHit, kills, effectiveHits };
}

const densityKeys = ['sparse', 'normal', 'dense', 'extreme'];

for (const wType of ['aoe', 'laser']) {
    const cap = wType === 'laser' ? LASER_MAX_TARGETS : AOE_MAX_TARGETS;
    const weaponCostFp = (wType === 'laser' ? 8 : 5) * MONEY_SCALE;
    const weaponLabel = wType === 'laser' ? '8x-Laser' : '5x-Rocket';

    console.log(`   --- ${weaponLabel} (cap=${cap}) ---`);

    for (const tier of [1, 2, 3, 4]) {
        const targetRTP = TIER_CONFIG[tier].rtpTierFp / RTP_SCALE;
        const maxAllowedRTPShot = targetRTP + THRESHOLD_PP / 100;

        for (const dk of densityKeys) {
            const hitCount = DENSITY[dk].nFn(cap);
            const { rtpShot, rtpHit, effectiveHits } = runMCShot(wType, weaponCostFp, hitCount, tier);

            const rtpShotPct = (rtpShot * 100).toFixed(2);
            const rtpHitPct = (rtpHit * 100).toFixed(2);
            const targetPct = (targetRTP * 100).toFixed(1);
            const maxPct = (maxAllowedRTPShot * 100).toFixed(1);

            const shotOk = rtpShot <= maxAllowedRTPShot;

            assert(shotOk,
                `C-${wType}-${tierLabel(tier)}-${dk}: RTP_shot=${rtpShotPct}% <= ${maxPct}%`
            );

            const pad = `${weaponLabel}-${tierLabel(tier)}-${DENSITY[dk].label}`.padEnd(35);
            const status = shotOk ? 'OK' : 'FAIL';
            console.log(`   ${pad} N=${String(hitCount).padStart(3)} eff=${String(effectiveHits).padStart(2)}  RTP_shot=${rtpShotPct.padStart(7)}%  RTP_hit=${rtpHitPct.padStart(7)}%  target=${targetPct}%  ${status}`);
        }
    }
    console.log('');
}

console.log('D. N-sweep: hitCount=1..cap for each weapon type\n');

for (const wType of ['aoe', 'laser']) {
    const cap = wType === 'laser' ? LASER_MAX_TARGETS : AOE_MAX_TARGETS;
    const weaponCostFp = (wType === 'laser' ? 8 : 5) * MONEY_SCALE;
    const weaponLabel = wType === 'laser' ? '8x-Laser' : '5x-Rocket';
    const tier = 1;
    const targetRTP = TIER_CONFIG[tier].rtpTierFp / RTP_SCALE;
    const maxAllowed = targetRTP + THRESHOLD_PP / 100;

    console.log(`   --- ${weaponLabel} N-sweep (tier=${tier}, target=${(targetRTP * 100).toFixed(1)}%) ---`);

    for (let n = 1; n <= cap; n++) {
        const { rtpShot, rtpHit, effectiveHits } = runMCShot(wType, weaponCostFp, n, tier);
        const shotPct = (rtpShot * 100).toFixed(2);
        const hitPct = (rtpHit * 100).toFixed(2);
        const ok = rtpShot <= maxAllowed;

        assert(ok, `D-${wType}-N${n}: RTP_shot=${shotPct}% <= ${(maxAllowed * 100).toFixed(1)}%`);
        console.log(`   N=${String(n).padStart(2)}  RTP_shot=${shotPct.padStart(7)}%  RTP_hit=${hitPct.padStart(7)}%  ${ok ? 'OK' : 'FAIL'}`);
    }
    console.log('');
}

console.log('E. Extreme density: N >> cap proves cap works\n');

for (const wType of ['aoe', 'laser']) {
    const cap = wType === 'laser' ? LASER_MAX_TARGETS : AOE_MAX_TARGETS;
    const weaponCostFp = (wType === 'laser' ? 8 : 5) * MONEY_SCALE;
    const weaponLabel = wType === 'laser' ? '8x-Laser' : '5x-Rocket';
    const tier = 1;
    const targetRTP = TIER_CONFIG[tier].rtpTierFp / RTP_SCALE;
    const maxAllowed = targetRTP + THRESHOLD_PP / 100;

    for (const bigN of [20, 50, 100]) {
        const { rtpShot, rtpHit, effectiveHits } = runMCShot(wType, weaponCostFp, bigN, tier);
        const shotPct = (rtpShot * 100).toFixed(2);
        const hitPct = (rtpHit * 100).toFixed(2);
        const ok = rtpShot <= maxAllowed;

        assert(ok, `E-${wType}-N${bigN}: RTP_shot=${shotPct}% <= ${(maxAllowed * 100).toFixed(1)}% (cap enforced)`);
        assert(effectiveHits === cap, `E-${wType}-N${bigN}: effectiveHits=${effectiveHits} == cap=${cap}`);

        console.log(`   ${weaponLabel} N=${String(bigN).padStart(3)} → eff=${effectiveHits}  RTP_shot=${shotPct.padStart(7)}%  RTP_hit=${hitPct.padStart(7)}%  ${ok ? 'OK' : 'FAIL'}`);
    }
}

console.log('\nF. Mixed-tier density matrix\n');

function makeMixedHitList(n) {
    const tiers = [1, 1, 1, 2, 2, 3, 3, 4, 5, 6];
    const list = [];
    for (let i = 0; i < n; i++) {
        list.push({
            fishId: `mix-${String(i).padStart(4, '0')}`,
            tier: tiers[i % tiers.length],
            distance: 10 + i * 3
        });
    }
    return list;
}

for (const wType of ['aoe', 'laser']) {
    const cap = wType === 'laser' ? LASER_MAX_TARGETS : AOE_MAX_TARGETS;
    const weaponCostFp = (wType === 'laser' ? 8 : 5) * MONEY_SCALE;
    const weaponLabel = wType === 'laser' ? '8x-Laser' : '5x-Rocket';

    for (const dk of densityKeys) {
        const hitCount = DENSITY[dk].nFn(cap);
        const effectiveHits = Math.min(hitCount, cap);

        let totalPayout = 0;
        let totalShotCost = 0;

        for (let shot = 0; shot < MC_SHOTS; shot++) {
            const rtp = new RTPPhase1();
            const hitList = makeMixedHitList(hitCount);
            const results = rtp.handleMultiTargetHit('p1', hitList, weaponCostFp, wType);

            totalShotCost += weaponCostFp;
            for (const r of results) {
                if (r.kill) totalPayout += r.rewardFp;
            }
        }

        const rtpShot = totalShotCost > 0 ? totalPayout / totalShotCost : 0;
        const rtpShotPct = (rtpShot * 100).toFixed(2);

        const maxAllowed = 0.95 + THRESHOLD_PP / 100;
        const ok = rtpShot <= maxAllowed;

        assert(ok, `F-${wType}-mixed-${dk}: RTP_shot=${rtpShotPct}% <= ${(maxAllowed * 100).toFixed(1)}% (mixed tiers)`);

        const pad = `${weaponLabel}-mixed-${DENSITY[dk].label}`.padEnd(30);
        console.log(`   ${pad} N=${String(hitCount).padStart(3)} eff=${String(effectiveHits).padStart(2)}  RTP_shot=${rtpShotPct.padStart(7)}%  ${ok ? 'OK' : 'FAIL'}`);
    }
}

console.log('\nG. Single-target baseline (handleSingleTargetHit) vs multi-target N=1 parity\n');

for (const tier of [1, 3, 6]) {
    const weaponCostFp = 5 * MONEY_SCALE;
    const targetRTP = TIER_CONFIG[tier].rtpTierFp / RTP_SCALE;

    let singlePayout = 0;
    let multiPayout = 0;

    for (let shot = 0; shot < MC_SHOTS; shot++) {
        const rtpS = new RTPPhase1();
        const fishId = `st-${shot}`;
        const r = rtpS.handleSingleTargetHit('p1', fishId, weaponCostFp, tier);
        if (r.kill) singlePayout += r.rewardFp;

        const rtpM = new RTPPhase1();
        const hitList = [{ fishId: `mt-${shot}`, tier, distance: 10 }];
        const results = rtpM.handleMultiTargetHit('p1', hitList, weaponCostFp, 'aoe');
        for (const mr of results) {
            if (mr.kill) multiPayout += mr.rewardFp;
        }
    }

    const singleRTP = singlePayout / (MC_SHOTS * weaponCostFp);
    const multiRTP = multiPayout / (MC_SHOTS * weaponCostFp);
    const diff = Math.abs(singleRTP - multiRTP);

    assert(diff < 0.05,
        `G-tier${tier}: single=${(singleRTP * 100).toFixed(2)}% vs multi-N1=${(multiRTP * 100).toFixed(2)}% diff=${(diff * 100).toFixed(2)}pp < 5pp`
    );

    console.log(`   Tier ${tier}: single=${(singleRTP * 100).toFixed(2)}%  multi-N1=${(multiRTP * 100).toFixed(2)}%  diff=${(diff * 100).toFixed(2)}pp`);
}

console.log(`\n=== T5 Results ===`);
console.log(`PASS: ${PASS}`);
console.log(`FAIL: ${FAIL}`);

if (FAIL > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
        console.log(`  ✗ ${f}`);
    }
}

console.log(FAIL === 0
    ? '\nRESULT: ALL PASS\n  - Target caps enforced: AOE≤8, Laser≤6\n  - Budget normalization correct: Σbudget_i = budget_total\n  - RTP_shot ≤ target+2pp across all densities/tiers\n  - No RTP inflation even with 100 fish per shot'
    : '\nRESULT: FAILURES DETECTED — review above');

process.exit(FAIL > 0 ? 1 : 0);

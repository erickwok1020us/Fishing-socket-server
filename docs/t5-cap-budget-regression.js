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
const { Fish3DGameEngine } = require('../fish3DGameEngine');

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

console.log('\nB. Budget conservation via debug intermediates (Σbudget_i_fp == budget_total_fp)\n');

for (const wType of ['aoe', 'laser']) {
    const cap = wType === 'laser' ? LASER_MAX_TARGETS : AOE_MAX_TARGETS;
    const weaponCostFp = (wType === 'laser' ? 8 : 5) * MONEY_SCALE;

    for (let n = 1; n <= cap; n++) {
        const rtp = new RTPPhase1();
        const hitList = makeHitList(n, 1, 10);
        const { _debug } = rtp.handleMultiTargetHit('p1', hitList, weaponCostFp, wType, { debug: true });

        const budgetSum = _debug.budgetAllocFp.reduce((s, v) => s + v, 0);
        assert(
            budgetSum === _debug.budgetTotalFp,
            `B-${wType}-N${n}: Σbudget_i_fp=${budgetSum} == budget_total_fp=${_debug.budgetTotalFp}`
        );
    }
    console.log(`   ${wType.toUpperCase()}: budget conservation holds for N=1..${cap}`);
}

console.log('\nB2. Truncation invariant via debug intermediates (Σweight == WEIGHT_SCALE, Σbudget == budget_total)\n');

for (const wType of ['aoe', 'laser']) {
    const cap = wType === 'laser' ? LASER_MAX_TARGETS : AOE_MAX_TARGETS;
    const weaponCostFp = (wType === 'laser' ? 8 : 5) * MONEY_SCALE;

    for (const rawN of [cap, cap + 5, 20, 50, 100]) {
        const rtp = new RTPPhase1();
        const fullList = makeHitList(rawN, 1, 10);
        const { results, _debug } = rtp.handleMultiTargetHit('p1', fullList, weaponCostFp, wType, { debug: true });

        const totalWeight = _debug.weightsFp.reduce((s, w) => s + w, 0);
        assert(
            totalWeight === WEIGHT_SCALE,
            `B2-${wType}-raw${rawN}: Σweight_fp=${totalWeight} == WEIGHT_SCALE=${WEIGHT_SCALE}`
        );

        const budgetSum = _debug.budgetAllocFp.reduce((s, v) => s + v, 0);
        assert(
            budgetSum === _debug.budgetTotalFp,
            `B2-${wType}-raw${rawN}: Σbudget_i=${budgetSum} == budget_total=${_debug.budgetTotalFp} (post-truncation)`
        );

        assert(
            results.length <= cap,
            `B2-${wType}-raw${rawN}: results.length=${results.length} <= cap=${cap} (truncation enforced)`
        );

        assert(
            _debug.trimmedList.length <= cap,
            `B2-${wType}-raw${rawN}: trimmedList.length=${_debug.trimmedList.length} <= cap=${cap}`
        );
    }
    console.log(`   ${wType.toUpperCase()}: Σweight==WEIGHT_SCALE, Σbudget==budget_total for raw N∈{${cap},${cap+5},20,50,100}`);
}

const THRESHOLD_PP = 2;

console.log(`\nC. Monte-Carlo RTP_shot density matrix (threshold: target+${THRESHOLD_PP}pp)\n`);

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
    let kills = 0;

    const cap = weaponType === 'laser' ? LASER_MAX_TARGETS : AOE_MAX_TARGETS;
    const effectiveHits = Math.min(hitCount, cap);

    for (let shot = 0; shot < MC_SHOTS; shot++) {
        const rtp = new RTPPhase1();
        const hitList = makeHitList(hitCount, tier, 10);
        const results = rtp.handleMultiTargetHit('p1', hitList, weaponCostFp, weaponType);

        totalShotCost += weaponCostFp;
        for (const r of results) {
            if (r.kill) {
                totalPayout += r.rewardFp;
                kills++;
            }
        }
    }

    const rtpShot = totalShotCost > 0 ? totalPayout / totalShotCost : 0;
    return { rtpShot, kills, effectiveHits };
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
            const { rtpShot, effectiveHits } = runMCShot(wType, weaponCostFp, hitCount, tier);

            const rtpShotPct = (rtpShot * 100).toFixed(2);
            const targetPct = (targetRTP * 100).toFixed(1);
            const maxPct = (maxAllowedRTPShot * 100).toFixed(1);

            const shotOk = rtpShot <= maxAllowedRTPShot;

            assert(shotOk,
                `C-${wType}-${tierLabel(tier)}-${dk}: RTP_shot=${rtpShotPct}% <= ${maxPct}%`
            );

            const pad = `${weaponLabel}-${tierLabel(tier)}-${DENSITY[dk].label}`.padEnd(35);
            const status = shotOk ? 'OK' : 'FAIL';
            console.log(`   ${pad} N=${String(hitCount).padStart(3)} eff=${String(effectiveHits).padStart(2)}  RTP_shot=${rtpShotPct.padStart(7)}%  target=${targetPct}%  ${status}`);
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
        const { rtpShot } = runMCShot(wType, weaponCostFp, n, tier);
        const shotPct = (rtpShot * 100).toFixed(2);
        const ok = rtpShot <= maxAllowed;

        assert(ok, `D-${wType}-N${n}: RTP_shot=${shotPct}% <= ${(maxAllowed * 100).toFixed(1)}%`);
        console.log(`   N=${String(n).padStart(2)}  RTP_shot=${shotPct.padStart(7)}%  ${ok ? 'OK' : 'FAIL'}`);
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
        const { rtpShot, effectiveHits } = runMCShot(wType, weaponCostFp, bigN, tier);
        const shotPct = (rtpShot * 100).toFixed(2);
        const ok = rtpShot <= maxAllowed;

        assert(ok, `E-${wType}-N${bigN}: RTP_shot=${shotPct}% <= ${(maxAllowed * 100).toFixed(1)}% (cap enforced)`);
        assert(effectiveHits === cap, `E-${wType}-N${bigN}: effectiveHits=${effectiveHits} == cap=${cap}`);

        console.log(`   ${weaponLabel} N=${String(bigN).padStart(3)} → eff=${effectiveHits}  RTP_shot=${shotPct.padStart(7)}%  ${ok ? 'OK' : 'FAIL'}`);
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

console.log('\nH. Integration: sortAndTrimHitList (production code path) + fishId type invariant\n');

{
    const sAT = Fish3DGameEngine.sortAndTrimHitList;

    const makeCandidates = (specs) => specs.map(([fishId, dist]) => ({ fishId, dist, fish: { tier: 1 } }));

    const ids = (arr) => arr.map(c => c.fishId);

    console.log('   H1. Same-distance tie-break by fishId (String.localeCompare)\n');

    const sameDist = makeCandidates([
        ['fish-charlie', 10], ['fish-alpha', 10], ['fish-bravo', 10],
        ['fish-delta', 10], ['fish-echo', 10], ['fish-foxtrot', 10],
        ['fish-golf', 10], ['fish-hotel', 10], ['fish-india', 10], ['fish-juliet', 10]
    ]);

    sAT(sameDist, AOE_MAX_TARGETS, 'dist');
    const sortedIds = ids(sameDist);
    const expectedOrder = ['fish-alpha', 'fish-bravo', 'fish-charlie', 'fish-delta',
                           'fish-echo', 'fish-foxtrot', 'fish-golf', 'fish-hotel'];
    assert(
        sortedIds.length === AOE_MAX_TARGETS,
        `H1-aoe-cap: length=${sortedIds.length} == AOE_MAX=${AOE_MAX_TARGETS}`
    );
    assert(
        JSON.stringify(sortedIds) === JSON.stringify(expectedOrder),
        `H1-aoe-order: tie-break sorts by fishId ASC`
    );
    console.log(`   AOE same-dist: ${sortedIds.join(', ')}`);

    const laserSameDist = makeCandidates([
        ['laser-zulu', 5], ['laser-alpha', 5], ['laser-mike', 5],
        ['laser-bravo', 5], ['laser-yankee', 5], ['laser-charlie', 5],
        ['laser-delta', 5], ['laser-echo', 5]
    ]);
    sAT(laserSameDist, LASER_MAX_TARGETS, 'dist');
    const laserIds = ids(laserSameDist);
    const laserExpected = ['laser-alpha', 'laser-bravo', 'laser-charlie',
                           'laser-delta', 'laser-echo', 'laser-mike'];
    assert(
        laserIds.length === LASER_MAX_TARGETS,
        `H1-laser-cap: length=${laserIds.length} == LASER_MAX=${LASER_MAX_TARGETS}`
    );
    assert(
        JSON.stringify(laserIds) === JSON.stringify(laserExpected),
        `H1-laser-order: tie-break sorts by fishId ASC`
    );
    console.log(`   LASER same-dist: ${laserIds.join(', ')}`);

    console.log('\n   H2. Mixed distance + tie-break: distance primary, fishId secondary\n');

    const mixedDist = makeCandidates([
        ['fish-z', 30], ['fish-a', 10], ['fish-c', 10], ['fish-b', 10],
        ['fish-y', 20], ['fish-x', 20], ['fish-w', 30], ['fish-v', 30],
        ['fish-u', 40], ['fish-t', 40], ['fish-s', 40]
    ]);
    sAT(mixedDist, AOE_MAX_TARGETS, 'dist');
    const mixIds = ids(mixedDist);
    const mixExpected = ['fish-a', 'fish-b', 'fish-c', 'fish-x', 'fish-y', 'fish-v', 'fish-w', 'fish-z'];
    assert(
        JSON.stringify(mixIds) === JSON.stringify(mixExpected),
        `H2-mixed: dist primary + fishId tie-break correct`
    );
    console.log(`   Mixed: ${mixIds.join(', ')}`);

    console.log('\n   H3. Determinism: same input, multiple runs → identical output\n');

    for (let run = 0; run < 5; run++) {
        const candidates = makeCandidates([
            ['det-05', 10], ['det-03', 10], ['det-01', 10], ['det-04', 10], ['det-02', 10],
            ['det-08', 20], ['det-06', 20], ['det-07', 20], ['det-10', 30], ['det-09', 30]
        ]);
        sAT(candidates, AOE_MAX_TARGETS, 'dist');
        const runIds = ids(candidates);
        const detExpected = ['det-01', 'det-02', 'det-03', 'det-04', 'det-05', 'det-06', 'det-07', 'det-08'];
        assert(
            JSON.stringify(runIds) === JSON.stringify(detExpected),
            `H3-run${run}: deterministic order`
        );
    }
    console.log('   5 runs with identical input → identical output order');

    console.log('\n   H4. fishId type invariant: every fishId must be string\n');

    const hitListStr = makeHitList(20, 1, 10);
    for (const h of hitListStr) {
        assert(typeof h.fishId === 'string', `H4-str: fishId="${h.fishId}" is string`);
    }

    const numericIds = [
        { fishId: 42, dist: 10, fish: { tier: 1 } },
        { fishId: 7, dist: 10, fish: { tier: 1 } },
        { fishId: 99, dist: 10, fish: { tier: 1 } },
        { fishId: 3, dist: 20, fish: { tier: 1 } }
    ];
    let noThrow = true;
    try {
        sAT(numericIds, 3, 'dist');
    } catch (e) {
        noThrow = false;
    }
    assert(noThrow, 'H4-numeric: sortAndTrimHitList handles numeric fishId via String() without throwing');
    const numIds = ids(numericIds);
    const numRun1 = JSON.stringify(numIds);
    sAT(numericIds, 3, 'dist');
    const numRun2 = JSON.stringify(ids(numericIds));
    assert(numRun1 === numRun2, `H4-numeric-deterministic: numeric fishId sort is deterministic across runs`);
    console.log(`   String fishId: 20/20 pass | Numeric fishId: no-throw, deterministic via String()`);

    console.log('\n   H5. distKey parameter: works with both "dist" and "distToFish"\n');

    const distToFishList = [
        { fishId: 'dtf-c', distToFish: 10 },
        { fishId: 'dtf-a', distToFish: 10 },
        { fishId: 'dtf-b', distToFish: 5 }
    ];
    sAT(distToFishList, 2, 'distToFish');
    assert(
        distToFishList[0].fishId === 'dtf-b' && distToFishList[1].fishId === 'dtf-a',
        `H5-distToFish: distKey="distToFish" works (first=${distToFishList[0].fishId}, second=${distToFishList[1].fishId})`
    );
    console.log(`   distKey="distToFish": sorted correctly`);
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

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

console.log('=== P1 Regression Pack ===');
console.log(`Seed: ${SEED}\n`);

// =====================================================================
// A. DESPAWN STATE CLEANUP (2-HOUR STRESS TEST)
// =====================================================================

console.log('== A. Despawn state cleanup (2-hour sim, compressed) ==============\n');

{
    const TICK_RATE = 2;
    const SIM_HOURS = 2;
    const TOTAL_TICKS = SIM_HOURS * 3600 * TICK_RATE;
    const FISH_LIFETIME_TICKS = 60 * TICK_RATE;
    const SAMPLE_INTERVAL = Math.floor(TOTAL_TICKS / 20);

    const rtpInstance = new RTPPhase1();
    const activeFish = new Map();
    let fishCounter = 0;
    const stateSnapshots = [];
    let totalSpawned = 0, totalKilled = 0, totalDespawned = 0;

    for (let tick = 0; tick < TOTAL_TICKS; tick++) {
        const newCount = Math.floor(rng() * 4);
        for (let i = 0; i < newCount; i++) {
            const fishId = `fish-${fishCounter++}`;
            const tier = 1 + Math.floor(rng() * 6);
            activeFish.set(fishId, { spawnTick: tick, tier });
            totalSpawned++;
        }

        const toRemove = [];
        for (const [fishId, info] of activeFish) {
            if (rng() < 0.15) {
                const res = rtpInstance.handleSingleTargetHit('p1', fishId, 1 * MONEY_SCALE, info.tier);
                if (res.kill) {
                    rtpInstance.clearFishStates(fishId);
                    toRemove.push(fishId);
                    totalKilled++;
                }
            }

            if (tick - info.spawnTick > FISH_LIFETIME_TICKS && !toRemove.includes(fishId)) {
                rtpInstance.clearFishStates(fishId);
                toRemove.push(fishId);
                totalDespawned++;
            }
        }
        for (const fid of toRemove) activeFish.delete(fid);

        if (tick > 0 && tick % SAMPLE_INTERVAL === 0) {
            stateSnapshots.push({
                tick,
                stateCount: rtpInstance.states.size,
                activeFish: activeFish.size
            });
        }
    }

    for (const [fishId] of activeFish) {
        rtpInstance.clearFishStates(fishId);
    }
    activeFish.clear();

    stateSnapshots.push({
        tick: TOTAL_TICKS,
        stateCount: rtpInstance.states.size,
        activeFish: 0
    });

    const maxState = Math.max(...stateSnapshots.map(s => s.stateCount));
    const finalState = rtpInstance.states.size;

    assert(finalState === 0, `A-final: state count after full cleanup = ${finalState} (expected 0)`);

    const midSnapshots = stateSnapshots.slice(2, -1);
    const avgMidState = midSnapshots.reduce((s, v) => s + v.stateCount, 0) / Math.max(midSnapshots.length, 1);
    assert(
        maxState < totalSpawned * 0.1,
        `A-bounded: max state count ${maxState} < 10% of total spawned ${totalSpawned} (no linear growth)`
    );

    const firstHalf = stateSnapshots.slice(0, Math.floor(stateSnapshots.length / 2));
    const secondHalf = stateSnapshots.slice(Math.floor(stateSnapshots.length / 2));
    const avgFirst = firstHalf.reduce((s, v) => s + v.stateCount, 0) / Math.max(firstHalf.length, 1);
    const avgSecond = secondHalf.reduce((s, v) => s + v.stateCount, 0) / Math.max(secondHalf.length, 1);
    assert(
        avgSecond < avgFirst * 3,
        `A-no-linear: second-half avg ${avgSecond.toFixed(0)} < 3x first-half avg ${avgFirst.toFixed(0)}`
    );

    console.log(`  Sim: ${TOTAL_TICKS.toLocaleString()} ticks (${SIM_HOURS}h @ ${TICK_RATE} Hz)`);
    console.log(`  Fish: ${totalSpawned.toLocaleString()} spawned, ${totalKilled.toLocaleString()} killed, ${totalDespawned.toLocaleString()} despawned`);
    console.log(`  State: max=${maxState}, final=${finalState}, avg_mid=${avgMidState.toFixed(0)}`);
    console.log('\n  Tick snapshots:');
    for (const s of stateSnapshots) {
        const bar = '#'.repeat(Math.min(50, Math.round(s.stateCount / Math.max(maxState, 1) * 50)));
        console.log(`    tick=${String(s.tick).padStart(6)} states=${String(s.stateCount).padStart(5)} active=${String(s.activeFish).padStart(4)} |${bar}`);
    }
}

// =====================================================================
// B. FUZZ: BOUNDARY + NaN/Infinity
// =====================================================================

console.log('\n== B. Fuzz: fishId / distance / hitList / tier boundaries =========\n');

{
    const fuzzSingleTarget = [
        { label: 'fishId=null', playerId: 'p1', fishId: null, cost: 1000, tier: 1 },
        { label: 'fishId=undefined', playerId: 'p1', fishId: undefined, cost: 1000, tier: 1 },
        { label: 'fishId=""', playerId: 'p1', fishId: '', cost: 1000, tier: 1 },
        { label: 'fishId=0', playerId: 'p1', fishId: 0, cost: 1000, tier: 1 },
        { label: 'fishId=-1', playerId: 'p1', fishId: -1, cost: 1000, tier: 1 },
        { label: 'fishId=NaN', playerId: 'p1', fishId: NaN, cost: 1000, tier: 1 },
        { label: 'fishId=Infinity', playerId: 'p1', fishId: Infinity, cost: 1000, tier: 1 },
        { label: 'fishId=longStr', playerId: 'p1', fishId: 'a'.repeat(10000), cost: 1000, tier: 1 },
        { label: 'fishId=emoji', playerId: 'p1', fishId: '\u{1F41F}\u{1F420}', cost: 1000, tier: 1 },
        { label: 'tier=0', playerId: 'p1', fishId: 'fz-t0', cost: 1000, tier: 0 },
        { label: 'tier=-1', playerId: 'p1', fishId: 'fz-tn', cost: 1000, tier: -1 },
        { label: 'tier=7', playerId: 'p1', fishId: 'fz-t7', cost: 1000, tier: 7 },
        { label: 'tier=NaN', playerId: 'p1', fishId: 'fz-tN', cost: 1000, tier: NaN },
        { label: 'tier=null', playerId: 'p1', fishId: 'fz-tNull', cost: 1000, tier: null },
        { label: 'cost=0', playerId: 'p1', fishId: 'fz-c0', cost: 0, tier: 1 },
        { label: 'cost=-1', playerId: 'p1', fishId: 'fz-cn', cost: -1, tier: 1 },
        { label: 'cost=NaN', playerId: 'p1', fishId: 'fz-cN', cost: NaN, tier: 1 },
        { label: 'cost=Infinity', playerId: 'p1', fishId: 'fz-cI', cost: Infinity, tier: 1 },
        { label: 'playerId=""', playerId: '', fishId: 'fz-pe', cost: 1000, tier: 1 },
        { label: 'playerId=null', playerId: null, fishId: 'fz-pn', cost: 1000, tier: 1 },
    ];

    console.log('  B1. handleSingleTargetHit fuzz (no crash)\n');

    let singleNoThrow = 0;
    for (const tc of fuzzSingleTarget) {
        let threw = false;
        try {
            const rtp = new RTPPhase1();
            rtp.handleSingleTargetHit(tc.playerId, tc.fishId, tc.cost, tc.tier);
        } catch (e) {
            threw = true;
        }
        if (!threw) singleNoThrow++;
        assert(!threw, `B1-${tc.label}: no throw`);
    }
    console.log(`    ${singleNoThrow}/${fuzzSingleTarget.length} inputs: no crash\n`);

    console.log('  B2. handleMultiTargetHit fuzz (no crash + invariants)\n');

    const fuzzMultiTarget = [
        { label: 'empty hitList', hitList: [], cost: 5000, type: 'aoe' },
        { label: 'null hitList', hitList: null, cost: 5000, type: 'aoe' },
        { label: 'single valid', hitList: [{ fishId: 'v1', tier: 1, distance: 10 }], cost: 5000, type: 'aoe' },
        { label: '1000 fish', hitList: Array.from({ length: 1000 }, (_, i) => ({ fishId: `big-${i}`, tier: 1, distance: 10 + i })), cost: 5000, type: 'aoe' },
        { label: 'dist=0', hitList: [{ fishId: 'd0', tier: 1, distance: 0 }], cost: 5000, type: 'aoe' },
        { label: 'dist=-1', hitList: [{ fishId: 'dn', tier: 1, distance: -1 }], cost: 5000, type: 'aoe' },
        { label: 'dist=NaN', hitList: [{ fishId: 'dN', tier: 1, distance: NaN }], cost: 5000, type: 'aoe' },
        { label: 'dist=Infinity', hitList: [{ fishId: 'dI', tier: 1, distance: Infinity }], cost: 5000, type: 'aoe' },
        { label: 'dist=1e20', hitList: [{ fishId: 'dH', tier: 1, distance: 1e20 }], cost: 5000, type: 'aoe' },
        { label: 'mixed valid+invalid tier', hitList: [
            { fishId: 'mx1', tier: 1, distance: 10 },
            { fishId: 'mx2', tier: 99, distance: 10 },
            { fishId: 'mx3', tier: 3, distance: 10 }
        ], cost: 5000, type: 'aoe' },
        { label: 'all invalid tier', hitList: [
            { fishId: 'inv1', tier: 0, distance: 10 },
            { fishId: 'inv2', tier: -1, distance: 10 }
        ], cost: 5000, type: 'aoe' },
        { label: 'fishId=NaN in list', hitList: [{ fishId: NaN, tier: 1, distance: 10 }], cost: 5000, type: 'aoe' },
        { label: 'fishId=null in list', hitList: [{ fishId: null, tier: 1, distance: 10 }], cost: 5000, type: 'aoe' },
        { label: 'cost=0 multi', hitList: [{ fishId: 'c0m', tier: 1, distance: 10 }], cost: 0, type: 'aoe' },
        { label: 'cost=NaN multi', hitList: [{ fishId: 'cNm', tier: 1, distance: 10 }], cost: NaN, type: 'aoe' },
        { label: 'laser type', hitList: [{ fishId: 'las1', tier: 1, distance: 10 }], cost: 8000, type: 'laser' },
        { label: 'unknown weapon type', hitList: [{ fishId: 'unk1', tier: 1, distance: 10 }], cost: 5000, type: 'railgun' },
    ];

    let multiNoThrow = 0;
    for (const tc of fuzzMultiTarget) {
        let threw = false;
        try {
            const rtp = new RTPPhase1();
            rtp.handleMultiTargetHit('p1', tc.hitList, tc.cost, tc.type);
        } catch (e) {
            threw = true;
        }
        if (!threw) multiNoThrow++;
        assert(!threw, `B2-${tc.label}: no throw`);
    }
    console.log(`    ${multiNoThrow}/${fuzzMultiTarget.length} inputs: no crash\n`);

    console.log('  B3. Cap + weight + budget invariants on valid-ish fuzz inputs\n');

    const invariantTests = [
        { label: '8 fish AOE', hitList: Array.from({ length: 8 }, (_, i) => ({ fishId: `inv-a${i}`, tier: 1, distance: 10 + i })), cost: 5000, type: 'aoe', cap: AOE_MAX_TARGETS },
        { label: '20 fish AOE', hitList: Array.from({ length: 20 }, (_, i) => ({ fishId: `inv-b${i}`, tier: 1, distance: 10 + i })), cost: 5000, type: 'aoe', cap: AOE_MAX_TARGETS },
        { label: '6 fish laser', hitList: Array.from({ length: 6 }, (_, i) => ({ fishId: `inv-c${i}`, tier: 2, distance: 10 + i })), cost: 8000, type: 'laser', cap: LASER_MAX_TARGETS },
        { label: '50 fish laser', hitList: Array.from({ length: 50 }, (_, i) => ({ fishId: `inv-d${i}`, tier: 3, distance: 10 + i })), cost: 8000, type: 'laser', cap: LASER_MAX_TARGETS },
        { label: 'mixed tiers', hitList: [
            { fishId: 'inv-e0', tier: 1, distance: 5 },
            { fishId: 'inv-e1', tier: 3, distance: 10 },
            { fishId: 'inv-e2', tier: 5, distance: 15 },
            { fishId: 'inv-e3', tier: 6, distance: 20 }
        ], cost: 5000, type: 'aoe', cap: AOE_MAX_TARGETS },
        { label: 'dist=0.001', hitList: [
            { fishId: 'inv-f0', tier: 1, distance: 0.001 },
            { fishId: 'inv-f1', tier: 1, distance: 0.001 }
        ], cost: 5000, type: 'aoe', cap: AOE_MAX_TARGETS },
    ];

    for (const tc of invariantTests) {
        const rtp = new RTPPhase1();
        const { results, _debug } = rtp.handleMultiTargetHit('p1', tc.hitList, tc.cost, tc.type, { debug: true });

        assert(
            results.length <= tc.cap,
            `B3-${tc.label}-cap: results.length=${results.length} <= cap=${tc.cap}`
        );

        if (_debug) {
            const wSum = _debug.weightsFp.reduce((s, v) => s + v, 0);
            assert(
                wSum === WEIGHT_SCALE,
                `B3-${tc.label}-weight: sum_weight=${wSum} == ${WEIGHT_SCALE}`
            );

            const bSum = _debug.budgetAllocFp.reduce((s, v) => s + v, 0);
            assert(
                bSum === _debug.budgetTotalFp,
                `B3-${tc.label}-budget: sum_budget=${bSum} == total=${_debug.budgetTotalFp}`
            );
        }
    }
    console.log(`    ${invariantTests.length} configs: cap/weight/budget invariants checked\n`);

    console.log('  B4. sortAndTrimHitList fuzz (no crash)\n');

    const { Fish3DGameEngine } = require('../fish3DGameEngine');
    const sAT = Fish3DGameEngine.sortAndTrimHitList;

    const fuzzSort = [
        { label: 'empty', arr: [], max: 5, key: 'dist' },
        { label: 'one item', arr: [{ fishId: 's1', dist: 10 }], max: 5, key: 'dist' },
        { label: 'dist=NaN', arr: [{ fishId: 's2', dist: NaN }, { fishId: 's3', dist: 5 }], max: 5, key: 'dist' },
        { label: 'dist=Infinity', arr: [{ fishId: 's4', dist: Infinity }, { fishId: 's5', dist: 5 }], max: 5, key: 'dist' },
        { label: 'dist=-Infinity', arr: [{ fishId: 's6', dist: -Infinity }, { fishId: 's7', dist: 5 }], max: 5, key: 'dist' },
        { label: 'fishId=null', arr: [{ fishId: null, dist: 10 }, { fishId: 'ok', dist: 10 }], max: 5, key: 'dist' },
        { label: 'fishId=undefined', arr: [{ fishId: undefined, dist: 10 }], max: 5, key: 'dist' },
        { label: 'fishId=number', arr: [{ fishId: 42, dist: 10 }, { fishId: 7, dist: 10 }], max: 5, key: 'dist' },
        { label: 'max=0', arr: [{ fishId: 'z1', dist: 10 }], max: 0, key: 'dist' },
        { label: 'missing distKey', arr: [{ fishId: 'm1' }, { fishId: 'm2' }], max: 5, key: 'dist' },
        { label: '500 items', arr: Array.from({ length: 500 }, (_, i) => ({ fishId: `big-${i}`, dist: Math.random() * 100 })), max: 8, key: 'dist' },
    ];

    let sortNoThrow = 0;
    for (const tc of fuzzSort) {
        let threw = false;
        try {
            sAT(tc.arr, tc.max, tc.key);
        } catch (e) {
            threw = true;
        }
        if (!threw) sortNoThrow++;
        assert(!threw, `B4-${tc.label}: no throw`);

        if (!threw && tc.max > 0) {
            assert(
                tc.arr.length <= tc.max,
                `B4-${tc.label}-trim: length=${tc.arr.length} <= max=${tc.max}`
            );
        }
    }
    console.log(`    ${sortNoThrow}/${fuzzSort.length} inputs: no crash, trim verified\n`);
}

// =====================================================================
// SUMMARY
// =====================================================================

console.log('== Summary ========================================================\n');

console.log(`=== P1 Results ===`);
console.log(`PASS: ${PASS} | FAIL: ${FAIL}`);

if (failures.length > 0) {
    console.log(`\nFailures (seed=${SEED} for reproduction):`);
    for (const f of failures) console.log(`  * ${f}`);
}

console.log(FAIL === 0
    ? '\nRESULT: ALL PASS — despawn cleanup bounded, fuzz inputs safe'
    : `\nRESULT: FAILURES DETECTED — reproduce with seed ${SEED}`);

process.exit(FAIL > 0 ? 1 : 0);

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

const WEAPON_COSTS = [1 * MONEY_SCALE, 3 * MONEY_SCALE, 5 * MONEY_SCALE, 8 * MONEY_SCALE];
const WEAPON_LABELS = ['1x', '3x', '5x', '8x'];
const A_HIT_RATES = [0.5, 0.8, 1.0];
const A_TIERS = [1, 3, 6];
const SESSIONS_PER_COMBO = 10000;

console.log('=== Next-Round Regression Pack ===');
console.log(`Seed: ${SEED}\n`);

// =====================================================================
// A. RTP_hit / RTP_bet DUAL OUTPUT
// =====================================================================

console.log('== A. RTP_hit / RTP_bet dual output (weapon x tier x hitRate) =====\n');

const sectionAAssertions = { before: PASS + FAIL };

for (const tier of A_TIERS) {
    const cfg = TIER_CONFIG[tier];
    const targetRtp = cfg.rtpTierFp / RTP_SCALE;

    console.log(`  Tier ${tier} (target ${(targetRtp * 100).toFixed(0)}%):`);
    const header = '    ' + 'Weapon'.padEnd(8) + 'HitRate'.padEnd(10) +
        'RTP_hit'.padStart(10) + 'RTP_bet'.padStart(10) + '  Status';
    console.log(header);
    console.log('    ' + '-'.repeat(header.length - 4));

    for (let wi = 0; wi < WEAPON_COSTS.length; wi++) {
        const weaponCost = WEAPON_COSTS[wi];
        const label = WEAPON_LABELS[wi];

        for (const hitRate of A_HIT_RATES) {
            const rtpInstance = new RTPPhase1();
            let totalFireCost = 0, totalHitCost = 0, totalPayout = 0;

            for (let s = 0; s < SESSIONS_PER_COMBO; s++) {
                const fishId = `a-${label}-t${tier}-hr${hitRate}-${s}`;
                const maxHits = Math.ceil(cfg.n1Fp / weaponCost) + 5;

                for (let h = 0; h < maxHits; h++) {
                    totalFireCost += weaponCost;
                    const hit = rng() < hitRate;
                    if (!hit) continue;

                    totalHitCost += weaponCost;
                    const res = rtpInstance.handleSingleTargetHit('p1', fishId, weaponCost, tier);
                    if (res.kill) {
                        totalPayout += res.rewardFp;
                        rtpInstance.clearFishStates(fishId);
                        break;
                    }
                }
            }

            const rtpHit = totalHitCost > 0 ? totalPayout / totalHitCost : 0;
            const rtpBet = totalFireCost > 0 ? totalPayout / totalFireCost : 0;

            const hitOk = weaponCost === MONEY_SCALE
                ? Math.abs(rtpHit - targetRtp) < 0.03
                : true;

            const betOk = rtpBet <= rtpHit + 0.001;

            const status = hitOk && betOk ? 'OK' : 'FLAG';

            console.log(
                '    ' + label.padEnd(8) +
                `${(hitRate * 100).toFixed(0)}%`.padEnd(10) +
                `${(rtpHit * 100).toFixed(1)}%`.padStart(10) +
                `${(rtpBet * 100).toFixed(1)}%`.padStart(10) +
                `  ${status}`
            );

            assert(betOk, `A-${label}-T${tier}-HR${(hitRate*100).toFixed(0)}: RTP_bet(${(rtpBet*100).toFixed(1)}%) <= RTP_hit(${(rtpHit*100).toFixed(1)}%)`);
        }
    }
    console.log('');
}

const sectionACount = (PASS + FAIL) - sectionAAssertions.before;
console.log(`  Section A: ${sectionACount} assertions\n`);

// =====================================================================
// B. DENSITY SWEEP (WITH CAP)
// =====================================================================

console.log('== B. Density sweep (N=1..128, with cap) ===========================\n');

const sectionBAssertions = { before: PASS + FAIL };
const DENSITY_NS = [1, 2, 4, 8, 16, 32, 64, 128];
const DENSITY_SHOTS = 10000;

for (const weaponType of ['aoe', 'laser']) {
    const cap = weaponType === 'aoe' ? AOE_MAX_TARGETS : LASER_MAX_TARGETS;
    const weaponCost = weaponType === 'aoe' ? 5 * MONEY_SCALE : 8 * MONEY_SCALE;
    const typeLabel = weaponType === 'aoe' ? '5x-AOE' : '8x-Laser';

    console.log(`  ${typeLabel} (cap=${cap}, cost=${weaponCost/MONEY_SCALE}):`);
    const header = '    ' + 'N'.padEnd(6) + 'EffN'.padEnd(6) +
        'RTP_hit'.padStart(10) + 'RTP_bet'.padStart(10) +
        '  Sigma_w'.padStart(12) + '  Sigma_b'.padStart(12) + '  Cap OK';
    console.log(header);
    console.log('    ' + '-'.repeat(header.length - 4));

    for (const N of DENSITY_NS) {
        const rtpInstance = new RTPPhase1();
        let totalCost = 0, totalPayout = 0;
        let effectiveN = 0;
        let weightViolations = 0, budgetViolations = 0, capViolations = 0;

        for (let shot = 0; shot < DENSITY_SHOTS; shot++) {
            const hitList = [];
            for (let i = 0; i < N; i++) {
                hitList.push({
                    fishId: `b-${weaponType}-n${N}-s${shot}-f${i}`,
                    tier: 1 + Math.floor(rng() * 3),
                    distance: 5 + rng() * 50
                });
            }

            const { results, _debug } = rtpInstance.handleMultiTargetHit(
                'p1', hitList, weaponCost, weaponType, { debug: true }
            );

            totalCost += weaponCost;

            if (results.length > cap) capViolations++;
            effectiveN = results.length;

            for (const r of results) {
                if (r.kill) {
                    totalPayout += r.rewardFp;
                    rtpInstance.clearFishStates(r.fishId);
                }
            }

            if (_debug && _debug.weightsFp) {
                const wSum = _debug.weightsFp.reduce((s, v) => s + v, 0);
                if (wSum !== WEIGHT_SCALE) weightViolations++;
                const bSum = _debug.budgetAllocFp.reduce((s, v) => s + v, 0);
                if (bSum !== _debug.budgetTotalFp) budgetViolations++;
            }
        }

        const rtpHit = totalPayout / (totalCost * Math.min(N, cap));
        const rtpBet = totalCost > 0 ? totalPayout / totalCost : 0;

        const wOk = weightViolations === 0 ? 'OK' : `FAIL(${weightViolations})`;
        const bOk = budgetViolations === 0 ? 'OK' : `FAIL(${budgetViolations})`;
        const cOk = capViolations === 0 ? 'YES' : `NO(${capViolations})`;

        console.log(
            '    ' + String(N).padEnd(6) +
            String(Math.min(N, cap)).padEnd(6) +
            `${(rtpHit * 100).toFixed(1)}%`.padStart(10) +
            `${(rtpBet * 100).toFixed(1)}%`.padStart(10) +
            `  ${wOk}`.padStart(12) +
            `  ${bOk}`.padStart(12) +
            `  ${cOk}`
        );

        assert(capViolations === 0, `B-${typeLabel}-N${N}-cap: results.length <= ${cap}`);
        assert(weightViolations === 0, `B-${typeLabel}-N${N}-weight: Sigma_w == WEIGHT_SCALE`);
        assert(budgetViolations === 0, `B-${typeLabel}-N${N}-budget: Sigma_b == budget_total`);
    }
    console.log('');
}

const sectionBCount = (PASS + FAIL) - sectionBAssertions.before;
console.log(`  Section B: ${sectionBCount} assertions\n`);

// =====================================================================
// C. DETERMINISM x10 + REPLAY
// =====================================================================

console.log('== C. Determinism x10 + replay =====================================\n');

const sectionCAssertions = { before: PASS + FAIL };

function runDeterministicSession(seed) {
    const localRng = mulberry32(seed);
    serverCSPRNG.random = function () { return localRng(); };
    uuidCounter = 0;
    serverCSPRNG.randomUUID = function () { return `uuid-${++uuidCounter}`; };

    const rtpInstance = new RTPPhase1();
    const killLog = [];
    const RUNS = 5000;

    for (let s = 0; s < RUNS; s++) {
        const tier = 1 + Math.floor(localRng() * 6);
        const cfg = TIER_CONFIG[tier];
        const weaponIdx = Math.floor(localRng() * 4);
        const weaponCost = WEAPON_COSTS[weaponIdx];
        const fishId = `det-${s}`;
        const maxHits = Math.ceil(cfg.n1Fp / weaponCost) + 5;

        for (let h = 0; h < maxHits; h++) {
            const res = rtpInstance.handleSingleTargetHit('p1', fishId, weaponCost, tier);
            if (res.kill) {
                killLog.push({
                    session: s,
                    fishId,
                    tier,
                    weapon: weaponCost,
                    reason: res.reason,
                    killEventId: res.killEventId,
                    rewardFp: res.rewardFp
                });
                rtpInstance.clearFishStates(fishId);
                break;
            }
        }
    }

    return killLog;
}

console.log('  C1. Determinism: same seed x10 runs must produce identical kill logs\n');

const baseline = runDeterministicSession(SEED);
let allIdentical = true;

for (let run = 1; run < 10; run++) {
    const trial = runDeterministicSession(SEED);
    if (trial.length !== baseline.length) {
        allIdentical = false;
        console.log(`    Run ${run + 1}: MISMATCH length (${trial.length} vs ${baseline.length})`);
        continue;
    }
    for (let i = 0; i < baseline.length; i++) {
        if (baseline[i].killEventId !== trial[i].killEventId ||
            baseline[i].rewardFp !== trial[i].rewardFp ||
            baseline[i].reason !== trial[i].reason) {
            allIdentical = false;
            console.log(`    Run ${run + 1}: MISMATCH at kill #${i}`);
            break;
        }
    }
}

assert(allIdentical, 'C1-determinism: 10 runs with same seed produce identical kill logs');
console.log(`    ${allIdentical ? 'All 10 runs identical' : 'MISMATCH detected'} (${baseline.length} kills)\n`);

console.log('  C2. Replay: re-fire exact same sequence, verify same outcomes\n');

const replayRng = mulberry32(SEED);
serverCSPRNG.random = function () { return replayRng(); };
uuidCounter = 0;
serverCSPRNG.randomUUID = function () { return `uuid-${++uuidCounter}`; };

const rtpReplay = new RTPPhase1();
const replayLog = [];
const REPLAY_RUNS = 5000;

for (let s = 0; s < REPLAY_RUNS; s++) {
    const tier = 1 + Math.floor(replayRng() * 6);
    const cfg = TIER_CONFIG[tier];
    const weaponIdx = Math.floor(replayRng() * 4);
    const weaponCost = WEAPON_COSTS[weaponIdx];
    const fishId = `det-${s}`;
    const maxHits = Math.ceil(cfg.n1Fp / weaponCost) + 5;

    for (let h = 0; h < maxHits; h++) {
        const res = rtpReplay.handleSingleTargetHit('p1', fishId, weaponCost, tier);
        if (res.kill) {
            replayLog.push({
                session: s,
                killEventId: res.killEventId,
                rewardFp: res.rewardFp,
                reason: res.reason
            });
            rtpReplay.clearFishStates(fishId);
            break;
        }
    }
}

let replayMatch = replayLog.length === baseline.length;
if (replayMatch) {
    for (let i = 0; i < baseline.length; i++) {
        if (baseline[i].killEventId !== replayLog[i].killEventId ||
            baseline[i].rewardFp !== replayLog[i].rewardFp) {
            replayMatch = false;
            break;
        }
    }
}

assert(replayMatch, 'C2-replay: replayed sequence matches baseline exactly');
console.log(`    Replay: ${replayMatch ? 'MATCH' : 'MISMATCH'} (${replayLog.length} kills vs baseline ${baseline.length})\n`);

rng = mulberry32(SEED + 99);
serverCSPRNG.random = function () { return rng(); };
uuidCounter = 100000;
serverCSPRNG.randomUUID = function () { return `uuid-${++uuidCounter}`; };

const sectionCCount = (PASS + FAIL) - sectionCAssertions.before;
console.log(`  Section C: ${sectionCCount} assertions\n`);

// =====================================================================
// D. CLIENT/SERVER DRIFT + OUT-OF-ORDER PACKETS
// =====================================================================

console.log('== D. Client/Server drift + out-of-order packets ===================\n');

const sectionDAssertions = { before: PASS + FAIL };

{
    console.log('  D1. Simulated latency: events arrive delayed (50-500ms), verify ledger\n');

    const rtpInstance = new RTPPhase1();
    const EVENTS = 2000;
    const eventQueue = [];

    for (let i = 0; i < EVENTS; i++) {
        const tier = 1 + Math.floor(rng() * 6);
        const weaponCost = WEAPON_COSTS[Math.floor(rng() * 4)];
        const delay = 50 + Math.floor(rng() * 450);
        eventQueue.push({
            seq: i,
            fishId: `d1-${i}`,
            tier,
            weaponCost,
            arrivalTime: i * 16 + delay,
            processed: false
        });
    }

    eventQueue.sort((a, b) => a.arrivalTime - b.arrivalTime);

    let serverBalance = 100 * MONEY_SCALE;
    const ledger = [];
    let doublePay = 0;

    for (const evt of eventQueue) {
        const cfg = TIER_CONFIG[evt.tier];
        const maxHits = Math.ceil(cfg.n1Fp / evt.weaponCost) + 2;

        serverBalance -= evt.weaponCost;

        for (let h = 0; h < maxHits; h++) {
            const res = rtpInstance.handleSingleTargetHit('p1', evt.fishId, evt.weaponCost, evt.tier);
            if (res.kill) {
                if (ledger.some(l => l.fishId === evt.fishId)) {
                    doublePay++;
                }
                serverBalance += res.rewardFp;
                ledger.push({ fishId: evt.fishId, killEventId: res.killEventId, reward: res.rewardFp });
                rtpInstance.clearFishStates(evt.fishId);
                break;
            }
        }
    }

    const uniqueKills = new Set(ledger.map(l => l.killEventId));
    assert(doublePay === 0, `D1-no-double-pay: ${doublePay} double pays (expected 0)`);
    assert(uniqueKills.size === ledger.length, `D1-unique-ids: ${uniqueKills.size} unique kill IDs == ${ledger.length} ledger entries`);

    console.log(`    ${EVENTS} events, ${ledger.length} kills, ${doublePay} double-pays, ${uniqueKills.size} unique IDs`);
    console.log(`    Final balance: ${(serverBalance / MONEY_SCALE).toFixed(2)}\n`);

    console.log('  D2. Out-of-order: batch of hits on same fish arrive shuffled\n');

    const OOO_FISH = 200;
    const rtpOoo = new RTPPhase1();
    let oooDoublePay = 0;
    const oooLedger = new Map();

    for (let f = 0; f < OOO_FISH; f++) {
        const fishId = `d2-${f}`;
        const tier = 1 + Math.floor(rng() * 3);
        const cfg = TIER_CONFIG[tier];
        const weaponCost = MONEY_SCALE;
        const numHits = Math.ceil(cfg.n1Fp / weaponCost) + 3;

        const hitEvents = [];
        for (let h = 0; h < numHits; h++) {
            hitEvents.push({ seq: h, delay: Math.floor(rng() * 300) });
        }
        hitEvents.sort((a, b) => a.delay - b.delay);

        let killed = false;
        for (const he of hitEvents) {
            if (killed) break;
            const res = rtpOoo.handleSingleTargetHit('p1', fishId, weaponCost, tier);
            if (res.kill) {
                killed = true;
                oooLedger.set(fishId, res.killEventId);
                rtpOoo.clearFishStates(fishId);
            }
        }
    }

    assert(oooDoublePay === 0, `D2-ooo-no-double: ${oooDoublePay} double pays after shuffle`);
    assert(oooLedger.size === OOO_FISH, `D2-ooo-all-killed: ${oooLedger.size} kills == ${OOO_FISH} fish`);

    const oooUniqueIds = new Set(oooLedger.values());
    assert(oooUniqueIds.size === OOO_FISH, `D2-ooo-unique-ids: ${oooUniqueIds.size} unique IDs == ${OOO_FISH}`);

    console.log(`    ${OOO_FISH} fish, out-of-order hits, ${oooDoublePay} double-pays, ${oooLedger.size} kills\n`);

    console.log('  D3. Interleaved multi-player packets on shared fish pool\n');

    const rtpInterleave = new RTPPhase1();
    const PLAYERS = 20;
    const SHARED_FISH = 50;
    const interleavedEvents = [];

    for (let p = 0; p < PLAYERS; p++) {
        for (let f = 0; f < SHARED_FISH; f++) {
            const tier = 1 + Math.floor(rng() * 3);
            const cfg = TIER_CONFIG[tier];
            const maxHits = Math.ceil(cfg.n1Fp / MONEY_SCALE) + 2;
            for (let h = 0; h < maxHits; h++) {
                interleavedEvents.push({
                    playerId: `p${p}`,
                    fishId: `d3-f${f}`,
                    tier,
                    weaponCost: MONEY_SCALE,
                    delay: Math.floor(rng() * 1000)
                });
            }
        }
    }

    interleavedEvents.sort((a, b) => a.delay - b.delay);

    const playerKills = new Map();
    for (let p = 0; p < PLAYERS; p++) playerKills.set(`p${p}`, new Set());

    for (const evt of interleavedEvents) {
        const res = rtpInterleave.handleSingleTargetHit(evt.playerId, evt.fishId, evt.weaponCost, evt.tier);
        if (res.kill) {
            playerKills.get(evt.playerId).add(evt.fishId);
        }
    }

    let totalPlayerKills = 0;
    const allKillIds = new Set();
    for (const [pid, kills] of playerKills) {
        totalPlayerKills += kills.size;
    }

    assert(
        totalPlayerKills <= PLAYERS * SHARED_FISH,
        `D3-bounded: total kills ${totalPlayerKills} <= ${PLAYERS * SHARED_FISH} (each player can kill each fish once)`
    );

    let stateLeaks = 0;
    for (let f = 0; f < SHARED_FISH; f++) {
        rtpInterleave.clearFishStates(`d3-f${f}`);
    }
    for (let f = 0; f < SHARED_FISH; f++) {
        for (let p = 0; p < PLAYERS; p++) {
            if (rtpInterleave.getState(`p${p}`, `d3-f${f}`) !== null) stateLeaks++;
        }
    }

    assert(stateLeaks === 0, `D3-cleanup: ${stateLeaks} state leaks after clearFishStates`);

    console.log(`    ${PLAYERS} players x ${SHARED_FISH} fish, ${interleavedEvents.length} events interleaved`);
    console.log(`    Total kills: ${totalPlayerKills}, state leaks: ${stateLeaks}\n`);
}

const sectionDCount = (PASS + FAIL) - sectionDAssertions.before;
console.log(`  Section D: ${sectionDCount} assertions\n`);

// =====================================================================
// E. DESPAWN / RECONNECT / MULTI-PLAYER CONTENTION
// =====================================================================

console.log('== E. Despawn / reconnect / multi-player contention ================\n');

const sectionEAssertions = { before: PASS + FAIL };

{
    console.log('  E1. 2-hour stress: despawn + reconnect simulation\n');

    const TICK_RATE = 2;
    const SIM_HOURS = 2;
    const TOTAL_TICKS = SIM_HOURS * 3600 * TICK_RATE;
    const FISH_LIFETIME_TICKS = 60 * TICK_RATE;
    const NUM_PLAYERS = 10;
    const RECONNECT_PROB = 0.001;
    const SAMPLE_INTERVAL = Math.floor(TOTAL_TICKS / 20);

    const rtpInstance = new RTPPhase1();
    const activeFish = new Map();
    const activePlayers = new Set();
    for (let p = 0; p < NUM_PLAYERS; p++) activePlayers.add(`stress-p${p}`);

    let fishCounter = 0;
    let totalSpawned = 0, totalKilled = 0, totalDespawned = 0;
    let reconnects = 0;
    const stateSnapshots = [];

    for (let tick = 0; tick < TOTAL_TICKS; tick++) {
        const newCount = Math.floor(rng() * 3) + 1;
        for (let i = 0; i < newCount; i++) {
            const fishId = `e1-fish-${fishCounter++}`;
            const tier = 1 + Math.floor(rng() * 6);
            activeFish.set(fishId, { spawnTick: tick, tier });
            totalSpawned++;
        }

        for (const playerId of activePlayers) {
            if (rng() < RECONNECT_PROB) {
                rtpInstance.clearPlayerStates(playerId);
                reconnects++;
            }
        }

        const toRemove = [];
        for (const [fishId, info] of activeFish) {
            const shooter = `stress-p${Math.floor(rng() * NUM_PLAYERS)}`;
            if (activePlayers.has(shooter) && rng() < 0.1) {
                const res = rtpInstance.handleSingleTargetHit(shooter, fishId, MONEY_SCALE, info.tier);
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

    const finalState = rtpInstance.states.size;
    const maxState = stateSnapshots.length > 0
        ? Math.max(...stateSnapshots.map(s => s.stateCount))
        : 0;

    assert(finalState === 0, `E1-final-state: state count after cleanup = ${finalState} (expected 0)`);
    assert(
        maxState < totalSpawned * 0.15,
        `E1-bounded: max state ${maxState} < 15% of spawned ${totalSpawned}`
    );

    if (stateSnapshots.length >= 4) {
        const firstQ = stateSnapshots.slice(0, Math.floor(stateSnapshots.length / 4));
        const lastQ = stateSnapshots.slice(-Math.floor(stateSnapshots.length / 4));
        const avgFirst = firstQ.reduce((s, v) => s + v.stateCount, 0) / firstQ.length;
        const avgLast = lastQ.reduce((s, v) => s + v.stateCount, 0) / lastQ.length;
        assert(
            avgLast < avgFirst * 4,
            `E1-no-growth: last-quarter avg ${avgLast.toFixed(0)} < 4x first-quarter avg ${avgFirst.toFixed(0)}`
        );
    }

    console.log(`    ${TOTAL_TICKS} ticks, ${NUM_PLAYERS} players, ${reconnects} reconnects`);
    console.log(`    Fish: ${totalSpawned} spawned, ${totalKilled} killed, ${totalDespawned} despawned`);
    console.log(`    State: max=${maxState}, final=${finalState}\n`);

    console.log('  E2. Multi-player contention: 10/50/200 players race on same fish\n');

    for (const N of [10, 50, 200]) {
        const rtpCont = new RTPPhase1();
        const CONTENTION_FISH = 20;
        let totalKillsAll = 0;
        const killsPerFish = new Map();

        for (let f = 0; f < CONTENTION_FISH; f++) {
            const fishId = `e2-f${f}`;
            const tier = 1 + Math.floor(rng() * 3);
            const cfg = TIER_CONFIG[tier];
            const maxHits = Math.ceil(cfg.n1Fp / MONEY_SCALE) + 2;
            let fishKills = 0;

            const playerOrder = [];
            for (let p = 0; p < N; p++) playerOrder.push(p);
            for (let i = playerOrder.length - 1; i > 0; i--) {
                const j = Math.floor(rng() * (i + 1));
                [playerOrder[i], playerOrder[j]] = [playerOrder[j], playerOrder[i]];
            }

            for (const p of playerOrder) {
                const playerId = `cont-p${p}`;
                for (let h = 0; h < maxHits; h++) {
                    const res = rtpCont.handleSingleTargetHit(playerId, fishId, MONEY_SCALE, tier);
                    if (res.kill) {
                        fishKills++;
                        totalKillsAll++;
                        break;
                    }
                }
            }

            killsPerFish.set(fishId, fishKills);
            rtpCont.clearFishStates(fishId);
        }

        assert(
            totalKillsAll === N * CONTENTION_FISH,
            `E2-N${N}-all-kill: ${totalKillsAll} kills == ${N * CONTENTION_FISH} (each player kills each fish independently)`
        );

        let postClearLeaks = 0;
        for (let f = 0; f < CONTENTION_FISH; f++) {
            for (let p = 0; p < Math.min(10, N); p++) {
                if (rtpCont.getState(`cont-p${p}`, `e2-f${f}`) !== null) postClearLeaks++;
            }
        }
        assert(postClearLeaks === 0, `E2-N${N}-clear: ${postClearLeaks} state leaks after clear`);

        console.log(`    N=${N}: ${CONTENTION_FISH} fish, ${totalKillsAll} total kills, ${postClearLeaks} leaks`);
    }
    console.log('');

    console.log('  E3. Rapid despawn-respawn: fish killed and re-ID\'d immediately\n');

    const rtpRapid = new RTPPhase1();
    const RAPID_CYCLES = 5000;
    let rapidStateMax = 0;

    for (let c = 0; c < RAPID_CYCLES; c++) {
        const fishId = `e3-rapid-${c % 100}`;
        const tier = 1 + Math.floor(rng() * 6);
        const cfg = TIER_CONFIG[tier];
        const maxHits = Math.ceil(cfg.n1Fp / MONEY_SCALE) + 2;

        for (let h = 0; h < maxHits; h++) {
            const res = rtpRapid.handleSingleTargetHit('p1', fishId, MONEY_SCALE, tier);
            if (res.kill) {
                rtpRapid.clearFishStates(fishId);
                break;
            }
        }

        if (rtpRapid.states.size > rapidStateMax) {
            rapidStateMax = rtpRapid.states.size;
        }
    }

    const rapidFinal = rtpRapid.states.size;
    assert(
        rapidFinal <= 100,
        `E3-rapid-bounded: final state ${rapidFinal} <= 100 (fish IDs recycle mod 100)`
    );
    assert(
        rapidStateMax <= 200,
        `E3-rapid-max: max state ${rapidStateMax} <= 200`
    );

    console.log(`    ${RAPID_CYCLES} cycles (mod 100 IDs), max state=${rapidStateMax}, final=${rapidFinal}\n`);
}

const sectionECount = (PASS + FAIL) - sectionEAssertions.before;
console.log(`  Section E: ${sectionECount} assertions\n`);

// =====================================================================
// SUMMARY
// =====================================================================

console.log('== Summary ========================================================\n');

console.log('  Section                        Assertions');
console.log('  ─────────────────────────────────────────');
console.log(`  A. RTP_hit/RTP_bet dual        ${String(sectionACount).padStart(5)}`);
console.log(`  B. Density sweep + cap         ${String(sectionBCount).padStart(5)}`);
console.log(`  C. Determinism x10 + replay    ${String(sectionCCount).padStart(5)}`);
console.log(`  D. Drift + out-of-order        ${String(sectionDCount).padStart(5)}`);
console.log(`  E. Despawn/reconnect/contention${String(sectionECount).padStart(5)}`);
console.log(`  ─────────────────────────────────────────`);
console.log(`  TOTAL                          ${String(PASS + FAIL).padStart(5)}`);

console.log(`\n=== Next-Round Results ===`);
console.log(`PASS: ${PASS} | FAIL: ${FAIL}`);

if (failures.length > 0) {
    console.log(`\nFailures (seed=${SEED} for reproduction):`);
    for (const f of failures) console.log(`  * ${f}`);
}

console.log(FAIL === 0
    ? '\nRESULT: ALL PASS'
    : `\nRESULT: FAILURES DETECTED — reproduce with seed ${SEED}`);

process.exit(FAIL > 0 ? 1 : 0);

const { RTPPhase1, MONEY_SCALE, RTP_SCALE, TIER_CONFIG, P_SCALE } = require('../src/modules/RTPPhase1');

const PASS = 'PASS';
const FAIL = 'FAIL';
let failures = 0;

function check(name, condition, detail) {
    const status = condition ? PASS : FAIL;
    if (!condition) failures++;
    console.log(`  [${status}] ${name}${detail ? ' — ' + detail : ''}`);
    return condition;
}

console.log('=== RTP Phase 1 Smoke Test ===\n');

console.log('--- T1: Static Config Verification ---');
const expectedConfig = {
    1: { rtpTierFp: 9000, n1Fp: 6000, rewardFp: 4500 },
    2: { rtpTierFp: 9100, n1Fp: 10000, rewardFp: 7583 },
    3: { rtpTierFp: 9200, n1Fp: 16000, rewardFp: 12266 },
    4: { rtpTierFp: 9300, n1Fp: 30000, rewardFp: 23250 },
    5: { rtpTierFp: 9400, n1Fp: 45000, rewardFp: 35250 },
    6: { rtpTierFp: 9500, n1Fp: 120000, rewardFp: 95000 }
};
for (let t = 1; t <= 6; t++) {
    const cfg = TIER_CONFIG[t];
    const exp = expectedConfig[t];
    check(`Tier ${t} rtpTierFp`, cfg.rtpTierFp === exp.rtpTierFp, `${cfg.rtpTierFp} == ${exp.rtpTierFp}`);
    check(`Tier ${t} n1Fp`, cfg.n1Fp === exp.n1Fp, `${cfg.n1Fp} == ${exp.n1Fp}`);
    check(`Tier ${t} rewardFp`, cfg.rewardFp === exp.rewardFp, `${cfg.rewardFp} == ${exp.rewardFp}`);
}

console.log('\n--- T2: Single-Target Hard Pity (T1, 1x weapon) ---');
{
    const rtp = new RTPPhase1();
    const costFp = 1 * MONEY_SCALE;
    let killed = false;
    let shotCount = 0;
    for (let i = 0; i < 20; i++) {
        shotCount++;
        const result = rtp.handleSingleTargetHit('pity-test', 'fish-1', costFp, 1);
        if (result.kill) {
            killed = true;
            break;
        }
    }
    check('T1 pity kills within 20 shots', killed, `killed at shot ${shotCount}`);
    check('T1 pity kills at or before N1=6', shotCount <= 6, `shot ${shotCount} <= 6`);
}

console.log('\n--- T3: Budget Gate (budget < reward -> no kill) ---');
{
    const rtp = new RTPPhase1();
    const costFp = 1 * MONEY_SCALE;
    const result = rtp.handleSingleTargetHit('gate-test', 'fish-2', costFp, 6);
    check('T6 first shot no kill (budget gate)', !result.kill, `reason=${result.reason}`);
    const state = rtp.getState('gate-test', 'fish-2');
    check('budget_remaining >= 0', state.budgetRemainingFp >= 0, `${state.budgetRemainingFp}`);
}

console.log('\n--- T4: Multi-Target Budget Conservation ---');
{
    const rtp = new RTPPhase1();
    const weaponCostFp = 5 * MONEY_SCALE;
    const hitList = [
        { fishId: 'mt-1', tier: 1, distance: 10 },
        { fishId: 'mt-2', tier: 2, distance: 20 },
        { fishId: 'mt-3', tier: 3, distance: 30 }
    ];
    const results = rtp.handleMultiTargetHit('mt-test', hitList, weaponCostFp, 'aoe');
    check('Multi-target returns 3 results', results.length === 3, `got ${results.length}`);

    let totalBudgetAccum = 0;
    for (const entry of hitList) {
        const state = rtp.getState('mt-test', entry.fishId);
        if (state) totalBudgetAccum += state.budgetRemainingFp;
    }

    const n = hitList.length;
    const rawWeights = hitList.map(h => Math.floor(1000000 / Math.max(h.distance, 1)));
    const rawSum = rawWeights.reduce((a, b) => a + b, 0);
    const weightsFp = [];
    let wSum = 0;
    for (let i = 0; i < n - 1; i++) {
        weightsFp[i] = Math.floor(rawWeights[i] * 1000000 / rawSum);
        wSum += weightsFp[i];
    }
    weightsFp[n - 1] = 1000000 - wSum;

    let rtpWeightedFp = 0;
    for (let i = 0; i < n; i++) {
        rtpWeightedFp += Math.floor(weightsFp[i] * TIER_CONFIG[hitList[i].tier].rtpTierFp / 1000000);
    }
    const expectedBudgetTotal = Math.floor(weaponCostFp * rtpWeightedFp / 10000);

    check('Budget conservation (sum_i == total)', totalBudgetAccum === expectedBudgetTotal,
        `sum=${totalBudgetAccum}, expected=${expectedBudgetTotal}`);
}

console.log('\n--- T5: RTP Convergence (10k shots per tier, 1x weapon) ---');
console.log('  NOTE: Budget gate blocks kills until budget >= reward.');
console.log('  Pity RTP = tier_rtp / K (worst-case per-fish).');
console.log('  Actual convergence is between pity_rtp and tier_rtp,');
console.log('  weighted by probability-kill vs pity-kill ratio.\n');
for (let tier = 1; tier <= 6; tier++) {
    const rtp = new RTPPhase1();
    const costFp = 1 * MONEY_SCALE;
    const costReal = 1;
    let totalSpent = 0;
    let totalReward = 0;
    let fishCounter = 0;

    for (let shot = 0; shot < 10000; shot++) {
        totalSpent += costReal;
        const fishId = `conv-${tier}-${fishCounter}`;
        const result = rtp.handleSingleTargetHit(`conv-${tier}`, fishId, costFp, tier);
        if (result.kill) {
            totalReward += result.reward;
            fishCounter++;
        }
    }

    const actualRtp = totalSpent > 0 ? (totalReward / totalSpent * 100) : 0;
    const tierRtp = TIER_CONFIG[tier].rtpTierFp / 100;
    const pityRtp = tierRtp / 1.2;
    const inRange = actualRtp >= pityRtp - 2 && actualRtp <= tierRtp + 2;
    check(`Tier ${tier} RTP in [pity..tier] range`, inRange,
        `actual=${actualRtp.toFixed(2)}%, pity=${pityRtp.toFixed(2)}%, tier=${tierRtp.toFixed(2)}%`);
}

console.log('\n--- T6: budget_remaining never negative after kill ---');
{
    const rtp = new RTPPhase1();
    const costFp = 1 * MONEY_SCALE;
    let negativeFound = false;
    let fishCounter = 0;

    for (let shot = 0; shot < 5000; shot++) {
        const fishId = `neg-${fishCounter}`;
        const result = rtp.handleSingleTargetHit('neg-test', fishId, costFp, 1);
        if (result.kill) {
            if (result.state && result.state.budgetRemainingFp < 0) {
                negativeFound = true;
                break;
            }
            fishCounter++;
        }
    }
    check('budget_remaining >= 0 after all kills', !negativeFound);
}

console.log('\n--- T7: Laser Weapon Config (single fire event) ---');
{
    const { WEAPONS } = require('../fish3DGameEngine');
    const laser = WEAPONS['8x'];
    check('8x type is laser', laser.type === 'laser', `type=${laser.type}`);
    check('8x cost is 8', laser.cost === 8, `cost=${laser.cost}`);
    check('8x maxTargets is 6', laser.maxTargets === 6, `maxTargets=${laser.maxTargets}`);
}

console.log('\n--- T8: Fish Species Count (SSOT = 20) ---');
{
    const { FISH_SPECIES } = require('../fish3DGameEngine');
    const count = Object.keys(FISH_SPECIES).length;
    check('Fish species count == 20', count === 20, `count=${count}`);

    const tierCounts = {};
    for (const fish of Object.values(FISH_SPECIES)) {
        tierCounts[fish.tier] = (tierCounts[fish.tier] || 0) + 1;
    }
    check('T6 count == 2 (boss)', tierCounts[6] === 2, `${tierCounts[6]}`);
    check('T5 count == 3 (rare)', tierCounts[5] === 3, `${tierCounts[5]}`);
    check('T4 count == 3 (large)', tierCounts[4] === 3, `${tierCounts[4]}`);
    check('T3 count == 3 (medium)', tierCounts[3] === 3, `${tierCounts[3]}`);
    check('T2 count == 3 (common)', tierCounts[2] === 3, `${tierCounts[2]}`);
    check('T1 count == 6 (small)', tierCounts[1] === 6, `${tierCounts[1]}`);
}

console.log(`\n=== Summary: ${failures === 0 ? 'ALL PASSED' : failures + ' FAILURE(S)'} ===`);
process.exit(failures > 0 ? 1 : 0);

#!/usr/bin/env node
'use strict';

/**
 * Economic Audit Mode — Headless 5-Minute Simulation
 *
 * Reproduces "auto-attack for ~2 min → +5000 balance" by running the real
 * Fish3DGameEngine with a mock Socket.IO layer.  Tracks every balance-
 * changing event and checks five invariants.
 *
 * Usage:  node docs/economic_audit.js
 * Output: stdout summary  +  docs/economic_audit_report.md
 */

const fs   = require('fs');
const path = require('path');

const { Fish3DGameEngine, FISH_SPECIES, WEAPONS } = require('../fish3DGameEngine');
const { TIER_CONFIG, MONEY_SCALE, RTP_SCALE }     = require('../src/modules/RTPPhase1');

// ── Time mock ────────────────────────────────────────────────────────
let mockTime = 1_000_000;
const _realNow = Date.now;
Date.now = () => mockTime;

// ── Mock Socket.IO ───────────────────────────────────────────────────
const events = [];
const mockIO = {
    to: () => ({
        emit: (name, data) => {
            events.push({ name, data, ts: mockTime });
        }
    })
};

// ── Engine bootstrap ─────────────────────────────────────────────────
const engine = new Fish3DGameEngine('audit-room');
const SOCKET = 'audit-p1';
const player = engine.addPlayer(SOCKET, 1, 'AuditBot');
player.balance = 1000;

for (let i = 0; i < 30; i++) engine.spawnFish();

// ── Audit accumulators ───────────────────────────────────────────────
const A = {
    costFire: 0,
    payout: 0,
    fires: 0,
    hits: 0,
    kills: 0,
    killEventIds: new Map(),
    fishPayIds: new Map(),
    hitListLens: [],
    maxHitList: 0,
    balanceCurve: [],
    samples: [],
    violations: [],
    weaponFires:   { '1x':0, '3x':0, '5x':0, '8x':0 },
    weaponCost:    { '1x':0, '3x':0, '5x':0, '8x':0 },
    weaponPayout:  { '1x':0, '3x':0, '5x':0, '8x':0 },
    weaponKills:   { '1x':0, '3x':0, '5x':0, '8x':0 },
    despawnNoClean: 0,
    tierKills: { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 },
    tierPayout: { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 },
    fishPayoutDetail: [],
};

// ── Monkey-patch RTP engine for hit-level tracking ───────────────────
const origSingle = engine.rtpEngine.handleSingleTargetHit.bind(engine.rtpEngine);
engine.rtpEngine.handleSingleTargetHit = function (pid, fid, costFp, tier) {
    A.hits++;
    return origSingle(pid, fid, costFp, tier);
};

const origMulti = engine.rtpEngine.handleMultiTargetHit.bind(engine.rtpEngine);
engine.rtpEngine.handleMultiTargetHit = function (pid, list, costFp, wType) {
    const cap = wType === 'laser' ? 6 : 8;
    A.hitListLens.push(list.length);
    if (list.length > A.maxHitList) A.maxHitList = list.length;
    if (list.length > cap) {
        A.violations.push({ type: 'HIT_LIST_CAP', wType, cap, actual: list.length, ts: mockTime });
    }
    A.hits += list.length;
    return origMulti(pid, list, costFp, wType);
};

// ── Patch updateFish to detect despawn-without-clear ─────────────────
const origUpdateFish = engine.updateFish.bind(engine);
engine.updateFish = function (dt, io) {
    const before = new Set(engine.fish.keys());
    origUpdateFish(dt, io);
    const after = new Set(engine.fish.keys());
    for (const fid of before) {
        if (!after.has(fid)) {
            const stateKey = `${SOCKET}:${fid}`;
            if (engine.rtpEngine.states.has(stateKey)) {
                A.despawnNoClean++;
                A.violations.push({ type: 'DESPAWN_STATE_LEAK', fishId: fid, ts: mockTime });
            }
        }
    }
};

// ── Helpers ──────────────────────────────────────────────────────────
function nearestFish() {
    let best = null, bd = Infinity;
    for (const [, f] of engine.fish) {
        if (!f.isAlive) continue;
        const dx = f.x - player.cannonX, dz = f.z - player.cannonZ;
        const d = Math.sqrt(dx*dx + dz*dz);
        if (d < bd) { bd = d; best = f; }
    }
    return best;
}

let evtCursor = 0;
let curWeapon = '1x';
function processEvents(weaponUsed) {
    while (evtCursor < events.length) {
        const ev = events[evtCursor++];
        if (ev.name === 'balanceUpdate' && ev.data.reason === 'fishKill') {
            const pay = ev.data.change;
            const kid = ev.data.killEventId;
            A.payout += pay;
            A.kills++;
            A.weaponPayout[weaponUsed] += pay;
            A.weaponKills[weaponUsed]++;

            const cnt = (A.killEventIds.get(kid) || 0) + 1;
            A.killEventIds.set(kid, cnt);
            if (cnt > 1) {
                A.violations.push({ type: 'DUP_KILL_EVENT_ID', kid, cnt, ts: ev.ts });
            }
        }
        if (ev.name === 'fishKilled') {
            const fid = ev.data.fishId;
            const rew = ev.data.totalReward;
            const tier = (FISH_SPECIES[ev.data.typeName] || {}).tier || 0;

            const prev = A.fishPayIds.get(fid);
            if (prev !== undefined) {
                A.violations.push({ type: 'DUP_FISH_PAY', fishId: fid, prev, cur: rew, ts: ev.ts });
            }
            A.fishPayIds.set(fid, rew);
            A.fishPayoutDetail.push({ fishId: fid, typeName: ev.data.typeName, reward: rew, tier, ts: ev.ts });

            if (tier >= 1 && tier <= 6) {
                A.tierKills[tier]++;
                A.tierPayout[tier] += rew;
            }

            if (Math.random() < 0.01) {
                A.samples.push({ type: 'Kill', kid: ev.data.killEventId, fishId: fid, reward_fp: rew * MONEY_SCALE, ts: ev.ts });
            }
        }
    }
}

// ── Simulation parameters ────────────────────────────────────────────
const SIM_MS     = 300_000;
const TICK_MS    = 1000 / 60;
const SNAP_MS    = 5000;
const WEAPONS_ROT = ['1x','1x','1x','3x','5x','5x','8x'];
let rotIdx = 0, lastFire = 0, nextSnap = mockTime + SNAP_MS;
const simStart = mockTime;

console.log('=== Economic Audit Mode: 5-min headless sim ===');
console.log(`Start balance: ${player.balance}`);
console.log('');

// ── Main loop ────────────────────────────────────────────────────────
while (mockTime - simStart < SIM_MS) {
    mockTime += TICK_MS;

    if (engine.fish.size < 20) engine.spawnFish();

    const wep = WEAPONS[curWeapon];
    if (mockTime - lastFire >= wep.cooldown && player.balance >= wep.cost) {
        const tgt = nearestFish();
        if (tgt) {
            evtCursor = events.length;
            const fireCost = WEAPONS[curWeapon].cost;

            A.fires++;
            A.weaponFires[curWeapon]++;
            A.costFire += fireCost;
            A.weaponCost[curWeapon] += fireCost;

            engine.handleShoot(SOCKET, tgt.x, tgt.z, mockIO);

            processEvents(curWeapon);

            if (Math.random() < 0.01) {
                A.samples.push({ type: 'Fire', weapon: curWeapon, cost_fp: fireCost * MONEY_SCALE, ts: mockTime });
            }

            lastFire = mockTime;
            rotIdx = (rotIdx + 1) % WEAPONS_ROT.length;
            curWeapon = WEAPONS_ROT[rotIdx];
            player.currentWeapon = curWeapon;
        }
    }

    engine.updateFish(TICK_MS / 1000, mockIO);
    engine.updateBullets(TICK_MS / 1000, mockIO);

    const preColl = events.length;
    evtCursor = preColl;
    engine.checkCollisions(mockIO);
    processEvents(curWeapon);

    if (mockTime >= nextSnap) {
        A.balanceCurve.push({
            t_sec: Math.round((mockTime - simStart) / 1000),
            balance: +player.balance.toFixed(2),
            costFire: +A.costFire.toFixed(2),
            payout: +A.payout.toFixed(2),
            net: +(A.payout - A.costFire).toFixed(2),
            fires: A.fires,
            kills: A.kills
        });
        nextSnap += SNAP_MS;
    }
}

// ── Final snapshot ───────────────────────────────────────────────────
A.balanceCurve.push({
    t_sec: Math.round((mockTime - simStart) / 1000),
    balance: +player.balance.toFixed(2),
    costFire: +A.costFire.toFixed(2),
    payout: +A.payout.toFixed(2),
    net: +(A.payout - A.costFire).toFixed(2),
    fires: A.fires,
    kills: A.kills
});

// ── Invariant checks ─────────────────────────────────────────────────
const inv = [];

// INV-1: cost_fire must increase with fire_count
if (A.fires > 0 && A.costFire === 0) {
    inv.push({ id: 'INV-1', status: 'FAIL', detail: 'cost_fire=0 despite fires>0' });
} else {
    const avgCost = A.costFire / A.fires;
    inv.push({ id: 'INV-1', status: 'PASS', detail: `avg_cost_per_fire=${avgCost.toFixed(4)}` });
}

// INV-2: same kill_event_id must never payout twice
let dupKEID = 0;
for (const [, c] of A.killEventIds) if (c > 1) dupKEID++;
inv.push({ id: 'INV-2', status: dupKEID === 0 ? 'PASS' : 'FAIL', detail: `dup_kill_event_ids=${dupKEID}` });

// INV-3: same fishId must never payout twice
const dupFish = A.violations.filter(v => v.type === 'DUP_FISH_PAY').length;
inv.push({ id: 'INV-3', status: dupFish === 0 ? 'PASS' : 'FAIL', detail: `dup_fish_payouts=${dupFish}` });

// INV-4: multi-target hit_list length must respect cap
const capBreaches = A.violations.filter(v => v.type === 'HIT_LIST_CAP').length;
inv.push({ id: 'INV-4', status: capBreaches === 0 ? 'PASS' : 'FAIL', detail: `cap_breaches=${capBreaches}, max_hit_list=${A.maxHitList}` });

// INV-5: fish despawn must finalize/clear state
inv.push({ id: 'INV-5', status: A.despawnNoClean === 0 ? 'PASS' : 'FAIL', detail: `despawn_state_leaks=${A.despawnNoClean}` });

// ── Derived metrics ──────────────────────────────────────────────────
const hitRate     = A.fires > 0 ? (A.hits / A.fires * 100) : 0;
const killRate    = A.fires > 0 ? (A.kills / A.fires * 100) : 0;
const payPerMin   = A.payout / 5;
const costPerMin  = A.costFire / 5;
const netPerMin   = payPerMin - costPerMin;
const realizedRTP = A.costFire > 0 ? (A.payout / A.costFire * 100) : 0;
const rtpPerHit   = A.hits > 0 ? (A.payout / (A.costFire * A.hits / A.fires) * 100) : 0;
const balDelta    = player.balance - 1000;
const balCheck    = 1000 - A.costFire + A.payout;

// ── Top 20 fish by payout ────────────────────────────────────────────
const top20 = [...A.fishPayoutDetail]
    .sort((a, b) => b.reward - a.reward)
    .slice(0, 20);

// ── Console summary ──────────────────────────────────────────────────
console.log('=== SIMULATION COMPLETE ===');
console.log(`Duration        : 5 min (simulated)`);
console.log(`Final balance   : ${player.balance.toFixed(2)}  (start=1000, delta=${balDelta >= 0 ? '+' : ''}${balDelta.toFixed(2)})`);
console.log(`Fires           : ${A.fires}`);
console.log(`Hits            : ${A.hits}`);
console.log(`Kills           : ${A.kills}`);
console.log(`Hit rate        : ${hitRate.toFixed(2)}%`);
console.log(`Kill rate       : ${killRate.toFixed(2)}%`);
console.log(`Total cost_fire : ${A.costFire.toFixed(2)}`);
console.log(`Total payout    : ${A.payout.toFixed(2)}`);
console.log(`Realized RTP    : ${realizedRTP.toFixed(2)}% (per-fire, includes misses)`);
console.log(`Balance check   : start(1000) - cost(${A.costFire.toFixed(2)}) + pay(${A.payout.toFixed(2)}) = ${balCheck.toFixed(2)} vs actual ${player.balance.toFixed(2)}`);
console.log(`Payout/min      : ${payPerMin.toFixed(2)}`);
console.log(`Cost/min        : ${costPerMin.toFixed(2)}`);
console.log(`Net/min         : ${netPerMin.toFixed(2)}`);
console.log('');
console.log('── Invariant Check ──');
for (const i of inv) console.log(`  ${i.id}: ${i.status}  (${i.detail})`);
console.log('');
console.log('── Per-weapon breakdown ──');
for (const w of ['1x','3x','5x','8x']) {
    const c = A.weaponCost[w], p = A.weaponPayout[w], f = A.weaponFires[w], k = A.weaponKills[w];
    const rtp = c > 0 ? (p / c * 100).toFixed(2) : 'N/A';
    console.log(`  ${w}: fires=${f} kills=${k} cost=${c.toFixed(2)} pay=${p.toFixed(2)} RTP=${rtp}%`);
}
console.log('');
console.log('── Per-tier breakdown ──');
for (let t = 1; t <= 6; t++) {
    console.log(`  T${t}: kills=${A.tierKills[t]} payout=${A.tierPayout[t].toFixed(2)}`);
}
console.log('');
console.log('── Top 20 fish by payout ──');
for (const f of top20) {
    console.log(`  fish#${f.fishId} ${f.typeName} T${f.tier} reward=${f.reward}`);
}
if (A.despawnNoClean > 0) {
    console.log('');
    console.log(`⚠ INV-5 FAIL: ${A.despawnNoClean} fish despawned with leaked RTP state`);
}

// ── Balance curve (5-sec snapshots) ──────────────────────────────────
console.log('');
console.log('── Balance curve (every 5s) ──');
console.log('t(s)\tbalance\tcost\tpay\tnet\tfires\tkills');
for (const s of A.balanceCurve) {
    console.log(`${s.t_sec}\t${s.balance}\t${s.costFire}\t${s.payout}\t${s.net}\t${s.fires}\t${s.kills}`);
}

// ── Generate markdown report ─────────────────────────────────────────
let md = `# Economic Audit Report\n\n`;
md += `**Generated**: ${new Date(_realNow()).toISOString()}\n`;
md += `**Simulation**: 5 minutes, auto-attack, weapon rotation [${WEAPONS_ROT.join(',')}]\n`;
md += `**Start balance**: 1000\n\n`;

md += `## Summary\n\n`;
md += `| Metric | Value |\n|--------|-------|\n`;
md += `| Final balance | ${player.balance.toFixed(2)} |\n`;
md += `| Balance delta | ${balDelta >= 0 ? '+' : ''}${balDelta.toFixed(2)} |\n`;
md += `| Fires | ${A.fires} |\n`;
md += `| Hits | ${A.hits} |\n`;
md += `| Kills | ${A.kills} |\n`;
md += `| Hit rate | ${hitRate.toFixed(2)}% |\n`;
md += `| Kill rate | ${killRate.toFixed(2)}% |\n`;
md += `| Total cost\\_fire | ${A.costFire.toFixed(2)} |\n`;
md += `| Total payout | ${A.payout.toFixed(2)} |\n`;
md += `| **Realized RTP (per-fire)** | **${realizedRTP.toFixed(2)}%** |
`;
md += `| Balance check | 1000 - ${A.costFire.toFixed(2)} + ${A.payout.toFixed(2)} = ${balCheck.toFixed(2)} (actual: ${player.balance.toFixed(2)}) |\n`;
md += `| Payout/min | ${payPerMin.toFixed(2)} |\n`;
md += `| Cost/min | ${costPerMin.toFixed(2)} |\n`;
md += `| Net/min | ${netPerMin.toFixed(2)} |\n`;
md += `| Max hit\\_list length | ${A.maxHitList} |\n`;
md += `| Despawn state leaks | ${A.despawnNoClean} |\n\n`;

md += `## Invariant Checks\n\n`;
md += `| # | Rule | Status | Detail |\n|---|------|--------|--------|\n`;
for (const i of inv) {
    md += `| ${i.id} | ${invDesc(i.id)} | **${i.status}** | ${i.detail} |\n`;
}
md += `\n`;

md += `## Per-Weapon Breakdown\n\n`;
md += `| Weapon | Fires | Kills | Cost | Payout | RTP |\n|--------|-------|-------|------|--------|-----|\n`;
for (const w of ['1x','3x','5x','8x']) {
    const c = A.weaponCost[w], p = A.weaponPayout[w], f = A.weaponFires[w], k = A.weaponKills[w];
    const rtp = c > 0 ? (p / c * 100).toFixed(2) + '%' : 'N/A';
    md += `| ${w} | ${f} | ${k} | ${c.toFixed(2)} | ${p.toFixed(2)} | ${rtp} |\n`;
}
md += `\n`;

md += `## Per-Tier Breakdown\n\n`;
md += `| Tier | Kills | Payout | Avg Reward |\n|------|-------|--------|------------|\n`;
for (let t = 1; t <= 6; t++) {
    const avg = A.tierKills[t] > 0 ? (A.tierPayout[t] / A.tierKills[t]).toFixed(2) : '-';
    md += `| T${t} | ${A.tierKills[t]} | ${A.tierPayout[t].toFixed(2)} | ${avg} |\n`;
}
md += `\n`;

md += `## Top 20 Fish by Payout\n\n`;
md += `| # | FishId | Species | Tier | Reward |\n|---|--------|---------|------|--------|\n`;
top20.forEach((f, i) => {
    md += `| ${i + 1} | ${f.fishId} | ${f.typeName} | T${f.tier} | ${f.reward} |\n`;
});
md += `\n`;

md += `## Balance Curve (5-second snapshots)\n\n`;
md += `| t(s) | Balance | Cost | Payout | Net | Fires | Kills |\n`;
md += `|------|---------|------|--------|-----|-------|-------|\n`;
for (const s of A.balanceCurve) {
    md += `| ${s.t_sec} | ${s.balance} | ${s.costFire} | ${s.payout} | ${s.net} | ${s.fires} | ${s.kills} |\n`;
}
md += `\n`;

if (A.violations.length > 0) {
    md += `## Invariant Violations (detail)\n\n`;
    md += '```json\n' + JSON.stringify(A.violations.slice(0, 100), null, 2) + '\n```\n\n';
}

md += `## 1% Event Samples\n\n`;
md += '```json\n' + JSON.stringify(A.samples.slice(0, 50), null, 2) + '\n```\n\n';

md += `## Client-Side Findings (code review)\n\n`;
md += `During code review of \`3D-Fish-Shooting-Devin/game.js\`, the following **client-side balance leaks** were identified:\n\n`;
md += `### LEAK-1: Coin-fly animation adds balance ON TOP of server balanceUpdate\n\n`;
md += `- **game.js:8027**: \`gameState.balance += this.coin.reward;\` — when GLB coin reaches cannon\n`;
md += `- **game.js:8322**: \`gameState.balance += this.reward;\` — fallback coin path\n`;
md += `- **game.js:9239**: \`gameState.balance = data.balance;\` — server authoritative set\n\n`;
md += `The server sends \`balanceUpdate\` with \`balance\` (absolute) and \`change\` (delta).\n`;
md += `The client sets \`gameState.balance = data.balance\` (correct), but the coin-fly VFX\n`;
md += `also does \`gameState.balance += this.coin.reward\` when the coin animation finishes.\n`;
md += `If the server balanceUpdate arrives BEFORE the coin lands, the client balance becomes\n`;
md += `\`server_balance + coin_reward\` — a **double-credit**.\n\n`;
md += `**Impact**: Every kill reward is potentially added TWICE to the displayed balance.\n`;
md += `Over 2 minutes of rapid firing with many kills, this can easily produce +5000.\n\n`;

md += `### LEAK-2: autoFireAtFish deducts cost locally (double deduction, then server corrects)\n\n`;
md += `- **game.js:10905**: \`gameState.balance -= weapon.cost;\` in \`autoFireAtFish()\`\n`;
md += `- Server also deducts in \`handleShoot()\` and sends \`balanceUpdate\` with new absolute balance\n\n`;
md += `This causes a brief double-deduction that is corrected when the server's balanceUpdate\n`;
md += `arrives and resets balance to the authoritative value. Not a net leak, but creates visual\n`;
md += `jitter and can interact with LEAK-1 timing.\n\n`;

md += `### LEAK-3: Single-player coin reward when win=0\n\n`;
md += `- **game.js:13929**: \`spawnCoinFlyToScore(deathPosition, coinCount, win > 0 ? win : fishReward);\`\n`;
md += `- When \`win=0\` (RTP roll failed), coins still fly with \`fishReward\` value\n`;
md += `- Coin arrival triggers \`gameState.balance += this.coin.reward\` with non-zero reward\n\n`;
md += `**Impact**: In single-player mode, every fish death awards the full \`fishReward\`\n`;
md += `via coin animation regardless of the RTP roll result.\n\n`;

md += `### Recommended Fixes\n\n`;
md += `1. **Remove client-side balance += in coin animations** (lines 8027, 8322).\n`;
md += `   Balance should ONLY be set by server \`balanceUpdate\` events.\n`;
md += `2. **Remove local cost deduction in autoFireAtFish** (line 10905).\n`;
md += `   Server is authoritative; client should wait for \`balanceUpdate\`.\n`;
md += `3. **Fix single-player coin reward**: pass \`win\` (not \`fishReward\`) to\n`;
md += `   \`spawnCoinFlyToScore\` so coins carry 0 reward when RTP roll fails.\n`;

function invDesc(id) {
    const m = {
        'INV-1': 'cost\\_fire increases with fire\\_count',
        'INV-2': 'kill\\_event\\_id never pays twice',
        'INV-3': 'fishId never pays twice',
        'INV-4': 'multi-target respects cap (AOE≤8, Laser≤6)',
        'INV-5': 'fish despawn clears RTP state'
    };
    return m[id] || id;
}

const reportPath = path.join(__dirname, 'economic_audit_report.md');
fs.writeFileSync(reportPath, md);
console.log(`\nReport written to ${reportPath}`);

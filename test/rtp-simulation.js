const { FISH_SPECIES, WEAPONS } = require('../fish3DGameEngine');

const KILLS_PER_WEAPON = 1_000_000;
const RTP_TOLERANCE = 0.005;

function pickRandomFish(rng) {
    const species = Object.values(FISH_SPECIES);
    const totalWeight = species.reduce((s, f) => s + f.spawnWeight, 0);
    let roll = rng() * totalWeight;
    for (const fish of species) {
        roll -= fish.spawnWeight;
        if (roll <= 0) return fish;
    }
    return species[species.length - 1];
}

function simulateWeapon(weaponKey) {
    const weapon = WEAPONS[weaponKey];
    let totalCost = 0;
    let totalReward = 0;
    let kills = 0;
    const rng = Math.random;

    while (kills < KILLS_PER_WEAPON) {
        const fish = pickRandomFish(rng);
        const hp = fish.health;
        const shotsToKill = Math.ceil(hp / weapon.damage);
        const cost = shotsToKill * weapon.cost;
        const reward = Math.round(cost * weapon.rtp);

        totalCost += cost;
        totalReward += reward;
        kills++;
    }

    const observedRTP = totalReward / totalCost;
    const expectedRTP = weapon.rtp;
    const deviation = Math.abs(observedRTP - expectedRTP);
    const pass = deviation <= RTP_TOLERANCE;

    return {
        weapon: weaponKey,
        kills,
        totalCost,
        totalReward,
        expectedRTP,
        observedRTP: Math.round(observedRTP * 100000) / 100000,
        deviation: Math.round(deviation * 100000) / 100000,
        tolerance: RTP_TOLERANCE,
        pass
    };
}

console.log(`\n=== 1M Kill RTP Simulation ===`);
console.log(`Kills per weapon: ${KILLS_PER_WEAPON.toLocaleString()}`);
console.log(`Tolerance: ±${RTP_TOLERANCE * 100}%\n`);

const results = [];
let allPass = true;

for (const weaponKey of Object.keys(WEAPONS)) {
    const start = Date.now();
    const result = simulateWeapon(weaponKey);
    const elapsed = Date.now() - start;
    results.push(result);

    const status = result.pass ? 'PASS' : 'FAIL';
    console.log(
        `[${status}] ${weaponKey}: ` +
        `expected=${(result.expectedRTP * 100).toFixed(1)}% ` +
        `observed=${(result.observedRTP * 100).toFixed(3)}% ` +
        `deviation=${(result.deviation * 100).toFixed(3)}% ` +
        `(${elapsed}ms)`
    );

    if (!result.pass) allPass = false;
}

console.log(`\n=== Summary ===`);
console.log(`Total kills simulated: ${(KILLS_PER_WEAPON * Object.keys(WEAPONS).length).toLocaleString()}`);
console.log(`All weapons within ±${RTP_TOLERANCE * 100}%: ${allPass ? 'YES' : 'NO'}\n`);

if (!allPass) {
    console.error('RTP simulation FAILED');
    process.exit(1);
}

console.log('RTP simulation PASSED');

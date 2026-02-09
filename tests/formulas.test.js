/**
 * Formula Tests
 * Tests for the balance module formulas.
 * Run with: open tests/formulas.test.html in browser
 */

import * as Formulas from '../src/balance/Formulas.js';
import { SeededRNG } from '../src/simulation/SeededRNG.js';

const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
    tests.push({ name, fn });
}

function assertEqual(actual, expected, message = '') {
    if (actual !== expected) {
        throw new Error(`${message} Expected ${expected}, got ${actual}`);
    }
}

function assertClose(actual, expected, tolerance = 0.001, message = '') {
    if (Math.abs(actual - expected) > tolerance) {
        throw new Error(`${message} Expected ~${expected}, got ${actual}`);
    }
}

function assertInRange(actual, min, max, message = '') {
    if (actual < min || actual > max) {
        throw new Error(`${message} Expected ${min}-${max}, got ${actual}`);
    }
}

// ==================== CLAMP TESTS ====================

test('clamp: value within range', () => {
    assertEqual(Formulas.clamp(0.5, 0, 1), 0.5);
});

test('clamp: value below min', () => {
    assertEqual(Formulas.clamp(-0.5, 0, 1), 0);
});

test('clamp: value above max', () => {
    assertEqual(Formulas.clamp(1.5, 0, 1), 1);
});

// ==================== ANSWER PROBABILITY TESTS ====================

test('calculateAnswerProbability: base case', () => {
    const prob = Formulas.calculateAnswerProbability({
        baseAnswerProb: 0.18,
        reputation: 75
    });
    assertInRange(prob, 0.1, 0.3, 'Base answer probability');
});

test('calculateAnswerProbability: low reputation reduces probability', () => {
    const highRep = Formulas.calculateAnswerProbability({ baseAnswerProb: 0.2, reputation: 100 });
    const lowRep = Formulas.calculateAnswerProbability({ baseAnswerProb: 0.2, reputation: 20 });
    if (lowRep >= highRep) {
        throw new Error('Low reputation should reduce answer probability');
    }
});

test('calculateAnswerProbability: spam tag penalty', () => {
    const noSpam = Formulas.calculateAnswerProbability({ baseAnswerProb: 0.2, spamTagProbability: 0 });
    const withSpam = Formulas.calculateAnswerProbability({ baseAnswerProb: 0.2, spamTagProbability: 0.5 });
    if (withSpam >= noSpam) {
        throw new Error('Spam tag should reduce answer probability');
    }
});

test('calculateAnswerProbability: capped at 0.95', () => {
    const prob = Formulas.calculateAnswerProbability({
        baseAnswerProb: 1.0,
        leadIntent: 2.0,
        reputation: 100,
        dialerConnectMultiplier: 1.5,
        localPresenceBonus: 0.5
    });
    assertInRange(prob, 0, 0.95, 'Should be capped at 95%');
});

// ==================== CONVERSION PROBABILITY TESTS ====================

test('calculateConversionProbability: base case', () => {
    const prob = Formulas.calculateConversionProbability({
        baseConversionProb: 0.07,
        agentMultiplier: 1.0
    });
    assertInRange(prob, 0.03, 0.15, 'Base conversion probability');
});

test('calculateConversionProbability: fatigue reduces conversion', () => {
    const fresh = Formulas.calculateConversionProbability({ baseConversionProb: 0.1, fatigue: 0 });
    const tired = Formulas.calculateConversionProbability({ baseConversionProb: 0.1, fatigue: 0.9 });
    if (tired >= fresh) {
        throw new Error('Fatigue should reduce conversion probability');
    }
});

test('calculateConversionProbability: high morale helps', () => {
    const lowMorale = Formulas.calculateConversionProbability({ baseConversionProb: 0.1, morale: 0.2 });
    const highMorale = Formulas.calculateConversionProbability({ baseConversionProb: 0.1, morale: 0.9 });
    if (highMorale <= lowMorale) {
        throw new Error('High morale should improve conversion');
    }
});

// ==================== FATIGUE TESTS ====================

test('calculateFatiguePenalty: zero fatigue = no penalty', () => {
    const penalty = Formulas.calculateFatiguePenalty(0);
    assertClose(penalty, 0, 0.001, 'No fatigue should mean no penalty');
});

test('calculateFatiguePenalty: full fatigue = max penalty', () => {
    const penalty = Formulas.calculateFatiguePenalty(1);
    assertClose(penalty, 0.5, 0.001, 'Full fatigue should give max penalty');
});

test('calculateFatiguePenalty: exponential curve', () => {
    const halfFatigue = Formulas.calculateFatiguePenalty(0.5);
    // With exponent 2.5, 0.5^2.5 * 0.5 ≈ 0.088
    assertInRange(halfFatigue, 0.05, 0.15, 'Half fatigue should be low penalty');
});

test('calculateFatigueGain: resilience reduces gain', () => {
    const lowRes = Formulas.calculateFatigueGain(0.2, 0.01);
    const highRes = Formulas.calculateFatigueGain(0.8, 0.01);
    if (highRes >= lowRes) {
        throw new Error('High resilience should reduce fatigue gain');
    }
});

// ==================== ECONOMY TESTS ====================

test('calculateUpgradeCost: level 0 = base cost', () => {
    const cost = Formulas.calculateUpgradeCost(100, 0, 1.5);
    assertEqual(cost, 100);
});

test('calculateUpgradeCost: exponential growth', () => {
    const level1 = Formulas.calculateUpgradeCost(100, 1, 1.5);
    const level2 = Formulas.calculateUpgradeCost(100, 2, 1.5);
    assertEqual(level1, 150);
    assertEqual(level2, 225);
});

test('calculateConversionRevenue: base case', () => {
    const revenue = Formulas.calculateConversionRevenue({ baseRevenue: 120 });
    assertEqual(revenue, 120);
});

test('calculateConversionRevenue: with multipliers', () => {
    const revenue = Formulas.calculateConversionRevenue({
        baseRevenue: 100,
        leadQualityMultiplier: 1.5,
        upgradeBonuses: 0.2
    });
    assertEqual(revenue, 180); // 100 * 1.5 * 1.2 = 180
});

// ==================== AHT TESTS ====================

test('calculateAHT: base case without variance', () => {
    const aht = Formulas.calculateAHT({
        baseAHT: 180,
        agentSpeedWrapup: 0,
        consistencyVariance: 0,
        randomFn: () => 0.5
    });
    assertEqual(aht, 180);
});

test('calculateAHT: speed wrapup reduces time', () => {
    const slow = Formulas.calculateAHT({ baseAHT: 180, agentSpeedWrapup: 0, randomFn: () => 0.5 });
    const fast = Formulas.calculateAHT({ baseAHT: 180, agentSpeedWrapup: 1, randomFn: () => 0.5 });
    if (fast >= slow) {
        throw new Error('Speed wrapup should reduce AHT');
    }
});

test('calculateAHT: minimum floor of 30 seconds', () => {
    const aht = Formulas.calculateAHT({
        baseAHT: 180,
        agentSpeedWrapup: 1,
        dialerAHTReduction: 0.5,
        consistencyVariance: 0.5,
        randomFn: () => 0 // Maximum negative variance
    });
    assertInRange(aht, 30, 200, 'AHT should be at least 30 seconds');
});

// ==================== REPUTATION TESTS ====================

test('calculateSpamTagProbability: high reputation = low spam', () => {
    const prob = Formulas.calculateSpamTagProbability({ reputation: 100 });
    assertClose(prob, 0, 0.01, 'Perfect reputation should have no spam');
});

test('calculateSpamTagProbability: low reputation = high spam', () => {
    const prob = Formulas.calculateSpamTagProbability({ reputation: 20 });
    assertInRange(prob, 0.3, 0.5, 'Low reputation should have high spam risk');
});

test('calculateSpamTagProbability: volume spike increases spam', () => {
    const normal = Formulas.calculateSpamTagProbability({ reputation: 50, dialVolume: 100, volumeThreshold: 200 });
    const spike = Formulas.calculateSpamTagProbability({ reputation: 50, dialVolume: 500, volumeThreshold: 200 });
    if (spike <= normal) {
        throw new Error('Volume spike should increase spam probability');
    }
});

// ==================== TRAINING TESTS ====================

test('calculateTrainingXP: diminishing returns at higher levels', () => {
    const lowLevel = Formulas.calculateTrainingXP(100, 0.1);
    const highLevel = Formulas.calculateTrainingXP(100, 0.8);
    if (highLevel >= lowLevel) {
        throw new Error('Higher skill level should give less XP');
    }
});

test('calculateTrainingXP: efficiency bonus helps', () => {
    const noBonus = Formulas.calculateTrainingXP(100, 0.5, 0);
    const withBonus = Formulas.calculateTrainingXP(100, 0.5, 0.5);
    if (withBonus <= noBonus) {
        throw new Error('Training efficiency should increase XP');
    }
});

// ==================== SEEDED RNG TESTS ====================

test('SeededRNG: same seed = same sequence', () => {
    const rng1 = new SeededRNG(12345);
    const rng2 = new SeededRNG(12345);

    for (let i = 0; i < 10; i++) {
        if (rng1.random() !== rng2.random()) {
            throw new Error('Same seed should produce same sequence');
        }
    }
});

test('SeededRNG: different seeds = different sequences', () => {
    const rng1 = new SeededRNG(12345);
    const rng2 = new SeededRNG(54321);

    let same = 0;
    for (let i = 0; i < 10; i++) {
        if (rng1.random() === rng2.random()) same++;
    }
    if (same > 2) {
        throw new Error('Different seeds should produce different sequences');
    }
});

test('SeededRNG: chance respects probability', () => {
    const rng = new SeededRNG(42);
    let hits = 0;
    const trials = 1000;

    for (let i = 0; i < trials; i++) {
        if (rng.chance(0.3)) hits++;
    }

    const rate = hits / trials;
    assertInRange(rate, 0.25, 0.35, '30% chance should hit ~30% of time');
});

test('SeededRNG: reset restores initial state', () => {
    const rng = new SeededRNG(12345);
    const first = rng.random();
    rng.random();
    rng.random();
    rng.reset();
    const afterReset = rng.random();
    assertEqual(first, afterReset, 'Reset should restore initial state');
});

// ==================== AGGREGATE TESTS ====================

test('estimatePeriodMetrics: reasonable estimates', () => {
    const metrics = Formulas.estimatePeriodMetrics({
        agents: 5,
        dialsPerMinutePerAgent: 10,
        answerProb: 0.18,
        conversionProb: 0.07,
        revenuePerConversion: 120,
        minutes: 60,
        occupancyTarget: 0.5
    });

    // 5 agents * 10 dials/min * 30 effective minutes = 1500 dials expected
    assertInRange(metrics.dials, 1400, 1600, 'Dial estimate');
    assertInRange(metrics.contacts, 200, 350, 'Contact estimate');
    assertInRange(metrics.conversions, 10, 30, 'Conversion estimate');
});

// ==================== RUN TESTS ====================

function runTests() {
    const results = document.getElementById('results');
    results.innerHTML = '<h2>Running Tests...</h2>';

    let output = '';

    for (const { name, fn } of tests) {
        try {
            fn();
            passed++;
            output += `<div class="pass">✓ ${name}</div>`;
        } catch (e) {
            failed++;
            output += `<div class="fail">✗ ${name}: ${e.message}</div>`;
        }
    }

    const summary = `<h2>Results: ${passed} passed, ${failed} failed</h2>`;
    results.innerHTML = summary + output;
}

// Auto-run if in browser
if (typeof window !== 'undefined') {
    window.runTests = runTests;
}

export { runTests };

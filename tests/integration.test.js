/**
 * Comprehensive Integration Tests for Call Center Tycoon
 * Tests all major game systems work together correctly.
 */

// Test utilities
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

function assertClose(actual, expected, tolerance = 0.01, message = '') {
    if (Math.abs(actual - expected) > tolerance) {
        throw new Error(`${message} Expected ~${expected}, got ${actual}`);
    }
}

function assertInRange(actual, min, max, message = '') {
    if (actual < min || actual > max) {
        throw new Error(`${message} Expected ${min}-${max}, got ${actual}`);
    }
}

function assertTrue(value, message = '') {
    if (!value) {
        throw new Error(`${message} Expected true, got ${value}`);
    }
}

function assertFalse(value, message = '') {
    if (value) {
        throw new Error(`${message} Expected false, got ${value}`);
    }
}

// ==================== SEEDED RNG TESTS ====================

test('SeededRNG produces consistent results', async () => {
    const { SeededRNG } = await import('../src/simulation/SeededRNG.js');

    const rng1 = new SeededRNG(12345);
    const rng2 = new SeededRNG(12345);

    for (let i = 0; i < 100; i++) {
        assertEqual(rng1.random(), rng2.random(), 'Same seed should produce same sequence');
    }
});

test('SeededRNG.chance respects probability', async () => {
    const { SeededRNG } = await import('../src/simulation/SeededRNG.js');
    const rng = new SeededRNG(42);

    let hits = 0;
    const trials = 1000;

    for (let i = 0; i < trials; i++) {
        if (rng.chance(0.5)) hits++;
    }

    assertInRange(hits / trials, 0.45, 0.55, '50% chance should hit ~50% of time');
});

test('SeededRNG.range produces values in range', async () => {
    const { SeededRNG } = await import('../src/simulation/SeededRNG.js');
    const rng = new SeededRNG(999);

    for (let i = 0; i < 100; i++) {
        const val = rng.range(10, 20);
        assertInRange(val, 10, 20, 'range(10,20) should produce 10-20');
    }
});

// ==================== AGENT TESTS ====================

test('Agent initializes with valid stats', async () => {
    const { Agent } = await import('../src/models/Agent.js');

    const agent = new Agent({
        id: 'test_1',
        baseStats: {
            talktrack: 0.4,
            speedWrapup: 0.4,
            compliance: 0.5
        },
        statVariance: 0.1,
        randomFn: () => 0.5
    });

    assertTrue(agent.name.length > 0, 'Agent should have a name');
    assertInRange(agent.skillTalktrack, 0, 1, 'Talktrack should be 0-1');
    assertInRange(agent.speedWrapup, 0, 1, 'SpeedWrapup should be 0-1');
    assertEqual(agent.state, 'idle', 'New agent should be idle');
    assertEqual(agent.fatigue, 0, 'New agent should have no fatigue');
});

test('Agent state machine transitions correctly', async () => {
    const { Agent, AgentState } = await import('../src/models/Agent.js');

    const agent = new Agent({
        id: 'test_2',
        baseStats: { talktrack: 0.5 },
        randomFn: () => 0.5
    });

    assertEqual(agent.state, AgentState.IDLE);
    assertTrue(agent.isAvailable());

    agent.startDialing(5);
    assertEqual(agent.state, AgentState.DIALING);
    assertFalse(agent.isAvailable());

    agent.startCall(30, {});
    assertEqual(agent.state, AgentState.ON_CALL);

    agent.startWrapUp(10);
    assertEqual(agent.state, AgentState.WRAP_UP);

    agent.completeWrapUp();
    assertEqual(agent.state, AgentState.IDLE);
    assertTrue(agent.isAvailable());
});

test('Agent fatigue increases and decreases', async () => {
    const { Agent } = await import('../src/models/Agent.js');

    const agent = new Agent({
        id: 'test_3',
        baseStats: { resilience: 0.5 },
        randomFn: () => 0.5
    });

    assertEqual(agent.fatigue, 0);

    agent.adjustFatigue(0.3);
    assertClose(agent.fatigue, 0.3, 0.001);

    agent.adjustFatigue(0.5);
    assertClose(agent.fatigue, 0.8, 0.001);

    // Should clamp at 1
    agent.adjustFatigue(0.5);
    assertEqual(agent.fatigue, 1);

    // Negative adjusts down
    agent.adjustFatigue(-0.3);
    assertClose(agent.fatigue, 0.7, 0.001);
});

test('Agent records stats correctly', async () => {
    const { Agent } = await import('../src/models/Agent.js');

    const agent = new Agent({
        id: 'test_4',
        baseStats: {},
        randomFn: () => 0.5
    });

    agent.recordDial();
    agent.recordDial();
    assertEqual(agent.dailyStats.dials, 2);

    agent.recordConversion(100);
    assertEqual(agent.dailyStats.conversions, 1);
    assertEqual(agent.dailyStats.revenue, 100);

    agent.resetDailyStats();
    assertEqual(agent.dailyStats.dials, 0);
    assertEqual(agent.dailyStats.conversions, 0);
});

// ==================== LEAD TESTS ====================

test('Lead initializes correctly', async () => {
    const { Lead } = await import('../src/models/Lead.js');

    const lead = new Lead({
        id: 'lead_1',
        sourceId: 'test_source',
        baseAnswerProbability: 0.18,
        baseConversionProbability: 0.07,
        randomFn: () => 0.5
    });

    assertEqual(lead.status, 'fresh');
    assertTrue(lead.isDialable());
    assertEqual(lead.dialAttempts, 0);
});

test('Lead tracks dial attempts', async () => {
    const { Lead } = await import('../src/models/Lead.js');

    const lead = new Lead({
        id: 'lead_2',
        sourceId: 'test',
        maxDialAttempts: 3,
        randomFn: () => 0.5
    });

    assertTrue(lead.isDialable());

    lead.recordDial();
    assertEqual(lead.dialAttempts, 1);
    assertTrue(lead.isDialable());

    lead.recordDial();
    lead.recordDial();
    assertEqual(lead.dialAttempts, 3);
    assertEqual(lead.status, 'exhausted');
    assertFalse(lead.isDialable());
});

test('Lead freshness decays', async () => {
    const { Lead } = await import('../src/models/Lead.js');

    // Create lead from "30 days ago"
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    const oldLead = new Lead({
        id: 'old_lead',
        sourceId: 'test',
        freshnessDecayPerDay: 0.02,
        createdAt: thirtyDaysAgo,
        randomFn: () => 0.5
    });

    const freshness = oldLead.getFreshness();
    assertInRange(freshness, 0.2, 0.6, '30 day old lead should have reduced freshness');

    // New lead should be fresh
    const newLead = new Lead({
        id: 'new_lead',
        sourceId: 'test',
        randomFn: () => 0.5
    });

    assertClose(newLead.getFreshness(), 1, 0.01, 'New lead should be at full freshness');
});

test('LeadPool generates and tracks leads', async () => {
    const { LeadPool, LeadSource } = await import('../src/models/Lead.js');

    const pool = new LeadPool();
    pool.addSource(new LeadSource({
        id: 'standard',
        name: 'Standard Leads',
        costPerLead: 2,
        baseAnswerProbability: 0.18
    }));

    // Unlock the source
    pool.sources.get('standard').unlocked = true;

    const leads = pool.generateLeads('standard', 50, () => Math.random());
    assertEqual(leads.length, 50);
    assertEqual(pool.getStats().total, 50);
    assertEqual(pool.getStats().fresh, 50);
    assertEqual(pool.getStats().dialable, 50);
});

// ==================== DIALER TESTS ====================

test('Dialer initializes with correct stats', async () => {
    const { Dialer } = await import('../src/models/Dialer.js');

    const dialer = new Dialer({
        id: 'manual',
        name: 'Manual Dialer',
        dialsPerMinutePerAgent: 4,
        connectRateMultiplier: 1.0,
        costPerAgentPerDay: 0
    });

    assertEqual(dialer.dialsPerMinutePerAgent, 4);
    assertFalse(dialer.unlocked); // Should start locked unless unlockCost is 0
});

test('DialerManager switches dialers correctly', async () => {
    const { Dialer, DialerManager } = await import('../src/models/Dialer.js');

    const manager = new DialerManager();

    manager.addDialer(new Dialer({ id: 'manual', name: 'Manual', unlockCost: 0 }));
    manager.addDialer(new Dialer({ id: 'power', name: 'Power', unlockCost: 500 }));

    const manual = manager.dialers.get('manual');
    manual.unlocked = true;
    manager.setActiveDialer('manual');

    assertEqual(manager.activeDialerId, 'manual');

    // Can't switch to locked dialer
    const result = manager.setActiveDialer('power');
    assertFalse(result);
    assertEqual(manager.activeDialerId, 'manual');
});

// ==================== GAME STATE TESTS ====================

test('GameState initializes correctly', async () => {
    const { GameState } = await import('../src/models/GameState.js');

    const state = new GameState();

    assertEqual(state.cash, 500);
    assertEqual(state.reputation, 75);
    assertEqual(state.agents.length, 0);
    assertEqual(state.gameTime.day, 1);
    assertEqual(state.gameTime.hour, 9);
    assertTrue(state.isWorkHours());
});

test('GameState tracks cash correctly', async () => {
    const { GameState } = await import('../src/models/GameState.js');

    const state = new GameState();

    state.adjustCash(100); // Revenue
    assertEqual(state.cash, 600);
    assertEqual(state.dailyStats.revenue, 100);

    state.adjustCash(-50); // Cost
    assertEqual(state.cash, 550);
    assertEqual(state.dailyStats.costs, 50);
});

test('GameState advances time correctly', async () => {
    const { GameState } = await import('../src/models/GameState.js');

    const state = new GameState();

    assertEqual(state.gameTime.hour, 9);
    assertEqual(state.gameTime.minute, 0);

    state.advanceTime(30);
    assertEqual(state.gameTime.hour, 9);
    assertEqual(state.gameTime.minute, 30);

    state.advanceTime(45);
    assertEqual(state.gameTime.hour, 10);
    assertEqual(state.gameTime.minute, 15);
});

test('GameState work hours check is correct', async () => {
    const { GameState } = await import('../src/models/GameState.js');

    const state = new GameState();

    state.gameTime.hour = 9;
    assertTrue(state.isWorkHours(), '9am should be work hours');

    state.gameTime.hour = 16;
    assertTrue(state.isWorkHours(), '4pm should be work hours');

    state.gameTime.hour = 17;
    assertFalse(state.isWorkHours(), '5pm should not be work hours');

    state.gameTime.hour = 8;
    assertFalse(state.isWorkHours(), '8am should not be work hours');
});

// ==================== FORMULA TESTS ====================

test('Answer probability is calculated correctly', async () => {
    const Formulas = await import('../src/balance/Formulas.js');

    const prob = Formulas.calculateAnswerProbability({
        baseAnswerProb: 0.18,
        reputation: 75
    });

    assertInRange(prob, 0.1, 0.25, 'Base answer probability should be reasonable');

    // Low reputation should reduce probability
    const lowRepProb = Formulas.calculateAnswerProbability({
        baseAnswerProb: 0.18,
        reputation: 20
    });

    assertTrue(lowRepProb < prob, 'Low reputation should reduce answer probability');
});

test('Conversion probability respects fatigue', async () => {
    const Formulas = await import('../src/balance/Formulas.js');

    const freshProb = Formulas.calculateConversionProbability({
        baseConversionProb: 0.1,
        fatigue: 0
    });

    const tiredProb = Formulas.calculateConversionProbability({
        baseConversionProb: 0.1,
        fatigue: 0.9
    });

    assertTrue(tiredProb < freshProb, 'Fatigue should reduce conversion probability');
});

test('Upgrade cost scales exponentially', async () => {
    const Formulas = await import('../src/balance/Formulas.js');

    const level0 = Formulas.calculateUpgradeCost(100, 0, 1.5);
    const level1 = Formulas.calculateUpgradeCost(100, 1, 1.5);
    const level2 = Formulas.calculateUpgradeCost(100, 2, 1.5);

    assertEqual(level0, 100);
    assertEqual(level1, 150);
    assertEqual(level2, 225);
});

// ==================== UPGRADE MANAGER TESTS ====================

test('UpgradeManager calculates costs correctly', async () => {
    const { GameState } = await import('../src/models/GameState.js');
    const { UpgradeManager } = await import('../src/economy/UpgradeManager.js');

    const state = new GameState();

    const upgradeConfigs = [
        {
            id: 'test_upgrade',
            name: 'Test Upgrade',
            baseCost: 100,
            costGrowthRate: 1.5,
            maxLevel: 5,
            effects: [{ type: 'testBonus', value: 0.1 }]
        }
    ];

    const manager = new UpgradeManager(state, upgradeConfigs);

    const available = manager.getAllUpgrades();
    assertEqual(available[0].cost, 100); // Level 0 cost

    state.setUpgradeLevel('test_upgrade', 1);
    manager.recalculateEffects();

    const updated = manager.getAllUpgrades();
    assertEqual(updated[0].cost, 150); // Level 1 cost
});

// ==================== SIMULATION ENGINE TESTS ====================

test('SimulationEngine processes ticks', async () => {
    const { GameState } = await import('../src/models/GameState.js');
    const { SimulationEngine } = await import('../src/simulation/SimulationEngine.js');
    const { Agent } = await import('../src/models/Agent.js');
    const { Dialer, DialerManager } = await import('../src/models/Dialer.js');
    const { LeadPool, LeadSource } = await import('../src/models/Lead.js');

    const state = new GameState();

    // Setup dialer
    const dialer = new Dialer({
        id: 'manual',
        name: 'Manual',
        dialsPerMinutePerAgent: 6,
        unlockCost: 0
    });
    dialer.unlocked = true;
    state.dialerManager.addDialer(dialer);
    state.dialerManager.setActiveDialer('manual');

    // Setup leads
    state.leadPool.addSource(new LeadSource({
        id: 'standard',
        name: 'Standard',
        unlockCost: 0
    }));
    state.leadPool.sources.get('standard').unlocked = true;
    state.leadPool.generateLeads('standard', 100, () => Math.random());

    // Add agent
    state.addAgent({ talktrack: 0.5 }, 0.1, () => Math.random());

    const configs = {
        defaults: {
            agent: {
                baseAHTSeconds: 180,
                baseWrapUpSeconds: 30,
                baseFatigueGainPerCallMinute: 0.01,
                baseFatigueRecoveryPerMinute: 0.005
            },
            call: {
                dialDurationSeconds: 10,
                baseRevenuePerConversion: 120,
                timeOfDayFactors: {}
            }
        }
    };

    const engine = new SimulationEngine(state, configs, 12345);

    // Process some minutes
    for (let i = 0; i < 10; i++) {
        engine.processMinute();
    }

    // Should have recorded some dials
    assertTrue(state.dailyStats.dials > 0, 'Should have recorded dials');
});

// ==================== SAVE/LOAD TESTS ====================

test('GameState serializes and deserializes', async () => {
    const { GameState } = await import('../src/models/GameState.js');
    const { Agent } = await import('../src/models/Agent.js');

    const state = new GameState();
    state.cash = 1234;
    state.reputation = 85;
    state.addAgent({ talktrack: 0.6 }, 0.1, () => 0.5);
    state.gameTime.day = 5;
    state.dailyStats.dials = 100;

    const json = state.toJSON();

    // Verify JSON has key fields
    assertEqual(json.cash, 1234);
    assertEqual(json.reputation, 85);
    assertEqual(json.agents.length, 1);
    assertEqual(json.gameTime.day, 5);

    // Create new state and load
    const newState = new GameState();
    newState.loadFromJSON(json, { dialers: [], leadSources: [] });

    assertEqual(newState.cash, 1234);
    assertEqual(newState.reputation, 85);
    assertEqual(newState.agents.length, 1);
    assertEqual(newState.gameTime.day, 5);
});

// ==================== RUN TESTS ====================

async function runTests() {
    const results = document.getElementById('results');
    results.innerHTML = '<h2>Running Tests...</h2>';

    let output = '';

    for (const { name, fn } of tests) {
        try {
            await fn();
            passed++;
            output += `<div class="pass">✓ ${name}</div>`;
        } catch (e) {
            failed++;
            output += `<div class="fail">✗ ${name}: ${e.message}</div>`;
            console.error(`Test failed: ${name}`, e);
        }
    }

    const summary = `<h2>Results: ${passed} passed, ${failed} failed</h2>`;
    results.innerHTML = summary + output;

    // Log summary
    console.log(`\n=== Test Results ===`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total: ${tests.length}`);
}

// Export for HTML runner
window.runTests = runTests;

export { runTests };

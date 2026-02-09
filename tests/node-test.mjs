/**
 * Node.js Test Runner for Call Center Tycoon
 * Run with: node tests/node-test.mjs
 */

console.log('🧪 Call Center Tycoon - Node.js Tests');
console.log('=====================================\n');

let passed = 0;
let failed = 0;

async function test(name, fn) {
    try {
        await fn();
        console.log(`✅ ${name}`);
        passed++;
    } catch (e) {
        console.log(`❌ ${name}: ${e.message}`);
        failed++;
    }
}

function assertEqual(actual, expected, msg = '') {
    if (actual !== expected) throw new Error(`${msg} Expected ${expected}, got ${actual}`);
}

function assertInRange(val, min, max, msg = '') {
    if (val < min || val > max) throw new Error(`${msg} Expected ${min}-${max}, got ${val}`);
}

function assertTrue(val, msg = '') {
    if (!val) throw new Error(`${msg} Expected true`);
}

// ====================
// Run Tests
// ====================

async function runTests() {
    console.log('📦 Testing Formulas...\n');

    const Formulas = await import('../src/balance/Formulas.js');

    await test('clamp works correctly', () => {
        assertEqual(Formulas.clamp(0.5, 0, 1), 0.5);
        assertEqual(Formulas.clamp(-0.5, 0, 1), 0);
        assertEqual(Formulas.clamp(1.5, 0, 1), 1);
    });

    await test('calculateAnswerProbability returns valid range', () => {
        const prob = Formulas.calculateAnswerProbability({ baseAnswerProb: 0.18 });
        assertInRange(prob, 0, 0.95);
    });

    await test('calculateConversionProbability returns valid range', () => {
        const prob = Formulas.calculateConversionProbability({ baseConversionProb: 0.07 });
        assertInRange(prob, 0, 0.8);
    });

    await test('calculateFatiguePenalty works correctly', () => {
        assertEqual(Formulas.calculateFatiguePenalty(0), 0);
        assertInRange(Formulas.calculateFatiguePenalty(1), 0.45, 0.55);
    });

    await test('calculateUpgradeCost scales exponentially', () => {
        assertEqual(Formulas.calculateUpgradeCost(100, 0, 1.5), 100);
        assertEqual(Formulas.calculateUpgradeCost(100, 1, 1.5), 150);
        assertEqual(Formulas.calculateUpgradeCost(100, 2, 1.5), 225);
    });

    console.log('\n📦 Testing SeededRNG...\n');

    const { SeededRNG } = await import('../src/simulation/SeededRNG.js');

    await test('SeededRNG produces identical sequences', () => {
        const rng1 = new SeededRNG(12345);
        const rng2 = new SeededRNG(12345);
        for (let i = 0; i < 10; i++) {
            assertEqual(rng1.random(), rng2.random());
        }
    });

    await test('SeededRNG.chance works', () => {
        const rng = new SeededRNG(42);
        let hits = 0;
        for (let i = 0; i < 1000; i++) {
            if (rng.chance(0.5)) hits++;
        }
        assertInRange(hits / 1000, 0.4, 0.6);
    });

    console.log('\n📦 Testing Agent...\n');

    const { Agent, AgentState } = await import('../src/models/Agent.js');

    await test('Agent initializes correctly', () => {
        const agent = new Agent({
            id: 'test1',
            baseStats: { talktrack: 0.4 },
            randomFn: () => 0.5
        });
        assertTrue(agent.name.length > 0);
        assertEqual(agent.state, AgentState.IDLE);
        assertEqual(agent.fatigue, 0);
    });

    await test('Agent state machine works', () => {
        const agent = new Agent({ id: 'test2', baseStats: {} });
        assertEqual(agent.state, AgentState.IDLE);
        agent.startDialing(5);
        assertEqual(agent.state, AgentState.DIALING);
        agent.startCall(30, {});
        assertEqual(agent.state, AgentState.ON_CALL);
    });

    console.log('\n📦 Testing Lead...\n');

    const { Lead, LeadPool, LeadSource } = await import('../src/models/Lead.js');

    await test('Lead initializes correctly', () => {
        const lead = new Lead({
            id: 'lead1',
            sourceId: 'test',
            randomFn: () => 0.5
        });
        assertEqual(lead.status, 'fresh');
        assertTrue(lead.isDialable());
    });

    await test('LeadPool generates leads', () => {
        const pool = new LeadPool();
        const source = new LeadSource({
            id: 'standard',
            name: 'Standard',
            unlockCost: 0
        });
        source.unlocked = true;
        pool.addSource(source);

        const leads = pool.generateLeads('standard', 50, () => Math.random());
        assertEqual(leads.length, 50);
        assertEqual(pool.getStats().total, 50);
    });

    console.log('\n📦 Testing Dialer...\n');

    const { Dialer, DialerManager } = await import('../src/models/Dialer.js');

    await test('Dialer initializes correctly', () => {
        const dialer = new Dialer({
            id: 'manual',
            name: 'Manual',
            dialsPerMinutePerAgent: 4
        });
        assertEqual(dialer.dialsPerMinutePerAgent, 4);
    });

    await test('DialerManager switches correctly', () => {
        const manager = new DialerManager();
        const d1 = new Dialer({ id: 'manual', name: 'Manual', unlockCost: 0 });
        d1.unlocked = true;
        manager.addDialer(d1);
        manager.setActiveDialer('manual');
        assertEqual(manager.activeDialerId, 'manual');
    });

    console.log('\n📦 Testing GameState...\n');

    const { GameState } = await import('../src/models/GameState.js');

    await test('GameState initializes correctly', () => {
        const state = new GameState();
        assertEqual(state.cash, 500);
        assertEqual(state.reputation, 75);
        assertEqual(state.gameTime.hour, 9);
    });

    await test('GameState work hours check', () => {
        const state = new GameState();
        state.gameTime.hour = 12;
        assertTrue(state.isWorkHours());
        state.gameTime.hour = 20;
        assertTrue(!state.isWorkHours());
    });

    // ====================
    // Results
    // ====================

    console.log('\n=====================================');
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log('=====================================');

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch(e => {
    console.error('Test runner error:', e);
    process.exit(1);
});

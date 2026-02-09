/**
 * Game Entry Point
 * Initializes game and exports API.
 */

import { GameState } from './models/GameState.js';
import { LeadSource, LeadPool } from './models/Lead.js';
import { Dialer, DialerManager } from './models/Dialer.js';
import { SimulationEngine } from './simulation/SimulationEngine.js';
import { UpgradeManager } from './economy/UpgradeManager.js';
import { SaveManager } from './persistence/SaveManager.js';
import { SeededRNG } from './simulation/SeededRNG.js';

export class Game {
    constructor() {
        this.state = null;
        this.engine = null;
        this.upgradeManager = null;
        this.saveManager = null;
        this.configs = {};
        this.isRunning = false;
        this.tickInterval = null;
    }

    async loadConfigs() {
        const [defaults, dialers, leadSources, upgrades, events] = await Promise.all([
            fetch('./data/defaults.json').then(r => r.json()),
            fetch('./data/dialers.json').then(r => r.json()),
            fetch('./data/leadSources.json').then(r => r.json()),
            fetch('./data/upgrades.json').then(r => r.json()),
            fetch('./data/events.json').then(r => r.json())
        ]);

        this.configs = {
            defaults,
            dialers: dialers.dialers,
            leadSources: leadSources.leadSources,
            upgrades: upgrades.upgrades,
            events: events.events
        };
    }

    async init() {
        await this.loadConfigs();

        this.state = new GameState();
        this.saveManager = new SaveManager(this.state);

        // Try to load existing save
        if (this.saveManager.hasSave()) {
            this.saveManager.load(this.configs);
        } else {
            this.setupNewGame();
        }

        this.engine = new SimulationEngine(this.state, this.configs);
        this.upgradeManager = new UpgradeManager(this.state, this.configs.upgrades);
        this.upgradeManager.recalculateEffects();

        return this;
    }

    setupNewGame() {
        // Initialize dialers
        for (const dialerConfig of this.configs.dialers) {
            this.state.dialerManager.addDialer(new Dialer(dialerConfig));
        }

        // Initialize lead sources
        for (const sourceConfig of this.configs.leadSources) {
            this.state.leadPool.addSource(new LeadSource(sourceConfig));
        }

        // Add starting agent
        const rng = new SeededRNG(Date.now());
        this.state.addAgent(
            this.configs.defaults.agent.baseStats,
            this.configs.defaults.agent.statVariance,
            () => rng.random()
        );

        // Add starting leads
        this.state.leadPool.generateLeads('standard_leads', 50, () => rng.random());

        // Set starting cash
        this.state.cash = this.configs.defaults.game.startingCash;
    }

    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.state.isPaused = false;

        this.tickInterval = setInterval(() => {
            this.engine.processMinute();
            this.autoSave();
        }, this.configs.defaults.game.tickIntervalMs / this.state.speedMultiplier);
    }

    pause() {
        this.isRunning = false;
        this.state.isPaused = true;

        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
    }

    setSpeed(multiplier) {
        this.state.speedMultiplier = multiplier;
        if (this.isRunning) {
            this.pause();
            this.start();
        }
    }

    autoSave() {
        // Save every game-minute
        this.saveManager.save();
    }

    simulateDay() {
        this.pause();
        return this.engine.simulateDay();
    }

    getMetrics() {
        return this.engine.getMetricsSummary();
    }

    // Upgrade actions
    purchaseUpgrade(upgradeId) {
        return this.upgradeManager.purchase(upgradeId, () => this.engine.rng.random());
    }

    getAvailableUpgrades() {
        return this.upgradeManager.getAvailableUpgrades();
    }

    getAllUpgrades() {
        return this.upgradeManager.getAllUpgrades();
    }

    // Dialer actions
    unlockDialer(dialerId) {
        const dialer = this.state.dialerManager.dialers.get(dialerId);
        if (!dialer) return false;

        if (this.state.cash >= dialer.unlockCost) {
            this.state.adjustCash(-dialer.unlockCost);
            return this.state.dialerManager.unlockDialer(dialerId);
        }
        return false;
    }

    setDialer(dialerId) {
        return this.state.dialerManager.setActiveDialer(dialerId);
    }

    getDialers() {
        return this.state.dialerManager.getAllDialers();
    }

    // Training actions
    trainAgent(agentId, skill) {
        const agent = this.state.agents.find(a => a.id === agentId);
        if (!agent || !agent.isAvailable()) return false;

        const cost = this.configs.defaults.training.sessionCost;
        if (this.state.cash < cost) return false;

        this.state.adjustCash(-cost);
        agent.startTraining(skill, this.configs.defaults.training.sessionDurationMinutes * 60);
        return true;
    }

    // Reset
    resetGame() {
        this.pause();
        this.saveManager.deleteSave();
        this.state = new GameState();
        this.saveManager = new SaveManager(this.state);
        this.setupNewGame();
        this.engine = new SimulationEngine(this.state, this.configs);
        this.upgradeManager = new UpgradeManager(this.state, this.configs.upgrades);
    }
}

// Export for use in browser
export { GameState, SimulationEngine, UpgradeManager, SaveManager, SeededRNG };

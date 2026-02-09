/**
 * GameState - Central game state container
 */

import { Agent } from './Agent.js';
import { LeadPool, LeadSource } from './Lead.js';
import { Dialer, DialerManager } from './Dialer.js';
import { clamp } from '../balance/Formulas.js';

export class GameState {
    constructor() {
        this.cash = 500;
        this.reputation = 75;

        this.agents = [];
        this.nextAgentId = 1;

        this.leadPool = new LeadPool();
        this.dialerManager = new DialerManager();

        this.upgrades = new Map(); // upgradeId -> level
        this.upgradeEffects = {}; // Cached effects

        this.gameTime = {
            day: 1,
            hour: 9,
            minute: 0,
            totalMinutes: 0
        };

        this.dailyStats = this._createEmptyDailyStats();
        this.lifetimeStats = this._createEmptyLifetimeStats();

        this.activeEvents = [];
        this.eventHistory = [];

        this.isPaused = true;
        this.speedMultiplier = 1;
    }

    _createEmptyDailyStats() {
        return {
            dials: 0, contacts: 0, conversions: 0,
            revenue: 0, costs: 0, profit: 0,
            complaints: 0, abandonments: 0
        };
    }

    _createEmptyLifetimeStats() {
        return {
            totalDials: 0, totalContacts: 0, totalConversions: 0,
            totalRevenue: 0, totalCosts: 0, daysPlayed: 0
        };
    }

    addAgent(baseStats, statVariance, randomFn) {
        const agent = new Agent({
            id: `agent_${this.nextAgentId++}`,
            baseStats,
            statVariance,
            randomFn
        });
        this.agents.push(agent);
        return agent;
    }

    removeAgent(agentId) {
        this.agents = this.agents.filter(a => a.id !== agentId);
    }

    getAvailableAgents() {
        return this.agents.filter(a => a.isAvailable());
    }

    getWorkingAgents() {
        return this.agents.filter(a => a.isWorking());
    }

    adjustCash(amount) {
        this.cash += amount;
        if (amount > 0) {
            this.dailyStats.revenue += amount;
            this.lifetimeStats.totalRevenue += amount;
        } else {
            this.dailyStats.costs += Math.abs(amount);
            this.lifetimeStats.totalCosts += Math.abs(amount);
        }
    }

    adjustReputation(amount) {
        this.reputation = clamp(this.reputation + amount, 0, 100);
    }

    recordDial() {
        this.dailyStats.dials++;
        this.lifetimeStats.totalDials++;
    }

    recordContact() {
        this.dailyStats.contacts++;
        this.lifetimeStats.totalContacts++;
    }

    recordConversion(revenue) {
        this.dailyStats.conversions++;
        this.lifetimeStats.totalConversions++;
        this.adjustCash(revenue);
    }

    recordComplaint() {
        this.dailyStats.complaints++;
    }

    recordAbandonment() {
        this.dailyStats.abandonments++;
    }

    advanceTime(minutes = 1) {
        this.gameTime.minute += minutes;
        this.gameTime.totalMinutes += minutes;

        while (this.gameTime.minute >= 60) {
            this.gameTime.minute -= 60;
            this.gameTime.hour++;
        }

        if (this.gameTime.hour >= 24) {
            this.endDay();
        }
    }

    endDay() {
        this.dailyStats.profit = this.dailyStats.revenue - this.dailyStats.costs;
        this.lifetimeStats.daysPlayed++;

        for (const agent of this.agents) {
            agent.resetDailyStats();
            agent.fatigue = Math.max(0, agent.fatigue - 0.3);
        }

        this.gameTime.day++;
        this.gameTime.hour = 9;
        this.gameTime.minute = 0;

        const oldStats = { ...this.dailyStats };
        this.dailyStats = this._createEmptyDailyStats();

        return oldStats;
    }

    isWorkHours() {
        return this.gameTime.hour >= 9 && this.gameTime.hour < 17;
    }

    getUpgradeLevel(upgradeId) {
        return this.upgrades.get(upgradeId) || 0;
    }

    setUpgradeLevel(upgradeId, level) {
        this.upgrades.set(upgradeId, level);
    }

    toJSON() {
        return {
            version: 1,
            cash: this.cash,
            reputation: this.reputation,
            agents: this.agents.map(a => a.toJSON()),
            nextAgentId: this.nextAgentId,
            leadPool: this.leadPool.toJSON(),
            dialerManager: this.dialerManager.toJSON(),
            upgrades: Object.fromEntries(this.upgrades),
            gameTime: { ...this.gameTime },
            dailyStats: { ...this.dailyStats },
            lifetimeStats: { ...this.lifetimeStats },
            savedAt: Date.now()
        };
    }

    loadFromJSON(data, configs) {
        this.cash = data.cash ?? 500;
        this.reputation = data.reputation ?? 75;

        this.agents = (data.agents || []).map(a => Agent.fromJSON(a));
        this.nextAgentId = data.nextAgentId || this.agents.length + 1;

        if (data.leadPool && configs.leadSources) {
            this.leadPool.loadFromJSON(data.leadPool, configs.leadSources);
        }

        if (data.dialerManager && configs.dialers) {
            this.dialerManager.loadFromJSON(data.dialerManager, configs.dialers);
        }

        this.upgrades = new Map(Object.entries(data.upgrades || {}));
        this.gameTime = data.gameTime || { day: 1, hour: 9, minute: 0, totalMinutes: 0 };
        this.dailyStats = data.dailyStats || this._createEmptyDailyStats();
        this.lifetimeStats = data.lifetimeStats || this._createEmptyLifetimeStats();
    }
}

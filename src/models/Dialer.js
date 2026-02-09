/**
 * Dialer Model
 * Represents dialer technology with throughput, quality, and cost tradeoffs.
 */

export const DialerType = {
    MANUAL: 'manual',
    POWER: 'power',
    PROGRESSIVE: 'progressive',
    PREDICTIVE: 'predictive',
    AI_ASSISTED: 'ai_assisted'
};

export class Dialer {
    constructor(config) {
        this.id = config.id;
        this.name = config.name;
        this.description = config.description || '';
        this.tier = config.tier || 1;
        this.dialsPerMinutePerAgent = config.dialsPerMinutePerAgent || 6;
        this.connectRateMultiplier = config.connectRateMultiplier || 1.0;
        this.qaAssistMultiplier = config.qaAssistMultiplier || 1.0;
        this.ahtReductionFactor = config.ahtReductionFactor || 0;
        this.agentOccupancyTarget = config.agentOccupancyTarget || 0.5;
        this.abandonmentRate = config.abandonmentRate || 0;
        this.spamRiskMultiplier = config.spamRiskMultiplier || 1.0;
        this.costPerAgentPerDay = config.costPerAgentPerDay || 0;
        this.unlockCost = config.unlockCost || 0;
        this.prerequisites = config.prerequisites || [];
        this.unlocked = this.unlockCost === 0;
    }

    getDialIntervalSeconds() {
        return 60 / this.dialsPerMinutePerAgent;
    }

    canUnlock(unlockedDialers) {
        if (this.unlocked) return false;
        return this.prerequisites.every(prereq => unlockedDialers.has(prereq));
    }

    getDailyCost(agentCount) {
        return this.costPerAgentPerDay * agentCount;
    }

    shouldAbandon(randomFn = Math.random) {
        return randomFn() < this.abandonmentRate;
    }

    toJSON() {
        return { id: this.id, unlocked: this.unlocked };
    }
}

export class DialerManager {
    constructor() {
        this.dialers = new Map();
        this.activeDialerId = 'manual';
    }

    addDialer(dialer) {
        this.dialers.set(dialer.id, dialer);
    }

    getActiveDialer() {
        return this.dialers.get(this.activeDialerId);
    }

    setActiveDialer(dialerId) {
        const dialer = this.dialers.get(dialerId);
        if (dialer && dialer.unlocked) {
            this.activeDialerId = dialerId;
            return true;
        }
        return false;
    }

    unlockDialer(dialerId) {
        const dialer = this.dialers.get(dialerId);
        if (dialer && !dialer.unlocked) {
            const unlockedSet = new Set(
                Array.from(this.dialers.values()).filter(d => d.unlocked).map(d => d.id)
            );
            if (dialer.canUnlock(unlockedSet)) {
                dialer.unlocked = true;
                return true;
            }
        }
        return false;
    }

    getUnlockedDialers() {
        return Array.from(this.dialers.values()).filter(d => d.unlocked);
    }

    getAllDialers() {
        return Array.from(this.dialers.values()).sort((a, b) => a.tier - b.tier);
    }

    toJSON() {
        return {
            dialers: Array.from(this.dialers.values()).map(d => d.toJSON()),
            activeDialerId: this.activeDialerId
        };
    }

    loadFromJSON(data, dialerConfigs) {
        for (const config of dialerConfigs) {
            const dialer = new Dialer(config);
            const savedDialer = data.dialers?.find(d => d.id === config.id);
            if (savedDialer) dialer.unlocked = savedDialer.unlocked;
            this.dialers.set(dialer.id, dialer);
        }
        this.activeDialerId = data.activeDialerId || 'manual';
    }
}

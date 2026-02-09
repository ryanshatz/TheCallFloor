/**
 * Upgrade Manager
 * Handles purchasing and applying upgrades.
 */

import * as Formulas from '../balance/Formulas.js';

export class UpgradeManager {
    constructor(gameState, upgradeConfigs) {
        this.state = gameState;
        this.configs = new Map();

        for (const config of upgradeConfigs) {
            this.configs.set(config.id, config);
        }
    }

    getUpgradeConfig(upgradeId) {
        return this.configs.get(upgradeId);
    }

    getCurrentLevel(upgradeId) {
        return this.state.getUpgradeLevel(upgradeId);
    }

    getUpgradeCost(upgradeId) {
        const config = this.configs.get(upgradeId);
        if (!config) return Infinity;

        const level = this.getCurrentLevel(upgradeId);
        if (level >= config.maxLevel) return Infinity;

        return Formulas.calculateUpgradeCost(config.baseCost, level, config.costGrowthRate);
    }

    canAfford(upgradeId) {
        return this.state.cash >= this.getUpgradeCost(upgradeId);
    }

    canPurchase(upgradeId) {
        const config = this.configs.get(upgradeId);
        if (!config) return false;

        const level = this.getCurrentLevel(upgradeId);
        if (level >= config.maxLevel) return false;

        if (!this.canAfford(upgradeId)) return false;

        for (const prereq of config.prerequisites || []) {
            if (this.getCurrentLevel(prereq) < 1) return false;
        }

        return true;
    }

    purchase(upgradeId, randomFn = Math.random) {
        if (!this.canPurchase(upgradeId)) return false;

        const config = this.configs.get(upgradeId);
        const cost = this.getUpgradeCost(upgradeId);

        this.state.adjustCash(-cost);
        this.state.setUpgradeLevel(upgradeId, this.getCurrentLevel(upgradeId) + 1);

        this.applyEffects(config.effects, randomFn);
        this.recalculateEffects();

        return true;
    }

    applyEffects(effects, randomFn) {
        for (const effect of effects || []) {
            switch (effect.type) {
                case 'add_agent':
                    for (let i = 0; i < effect.value; i++) {
                        this.state.addAgent(
                            this.getNewAgentStats(),
                            0.15,
                            randomFn
                        );
                    }
                    break;
                case 'add_leads':
                    this.state.leadPool.generateLeads(
                        effect.source || 'standard_leads',
                        effect.value,
                        randomFn
                    );
                    break;
            }
        }
    }

    getNewAgentStats() {
        const bonus = (this.state.upgradeEffects.newAgentStatBonus || 0);
        return {
            skillTalktrack: 0.4 + bonus,
            speedWrapup: 0.4 + bonus,
            complianceDiscipline: 0.5 + bonus,
            resilience: 0.5 + bonus,
            charisma: 0.3 + bonus,
            consistency: 0.4 + bonus
        };
    }

    recalculateEffects() {
        const effects = {
            answerRateBonus: 0,
            spamReduction: 0,
            leadRoutingEfficiency: 0,
            trainingEfficiency: 0,
            fatigueRecoveryBonus: 0,
            fatigueGainReduction: 0,
            newAgentStatBonus: 0,
            globalSkillTalktrack: 0,
            globalCompliance: 0,
            globalSpeedWrapup: 0,
            globalConsistency: 0
        };

        for (const [upgradeId, level] of this.state.upgrades) {
            const config = this.configs.get(upgradeId);
            if (!config) continue;

            for (const effect of config.effects || []) {
                const value = effect.value * level;

                switch (effect.type) {
                    case 'answer_rate_bonus':
                        effects.answerRateBonus += value;
                        break;
                    case 'spam_reduction':
                        effects.spamReduction += value;
                        break;
                    case 'lead_routing_efficiency':
                        effects.leadRoutingEfficiency += value;
                        break;
                    case 'training_efficiency':
                        effects.trainingEfficiency += value;
                        break;
                    case 'fatigue_recovery_bonus':
                        effects.fatigueRecoveryBonus += value;
                        break;
                    case 'fatigue_gain_reduction':
                        effects.fatigueGainReduction += value;
                        break;
                    case 'new_agent_stat_bonus':
                        effects.newAgentStatBonus += value;
                        break;
                    case 'global_skill_talktrack':
                        effects.globalSkillTalktrack += value;
                        break;
                    case 'global_compliance':
                        effects.globalCompliance += value;
                        break;
                    case 'global_speed_wrapup':
                        effects.globalSpeedWrapup += value;
                        break;
                    case 'global_consistency':
                        effects.globalConsistency += value;
                        break;
                }
            }
        }

        this.state.upgradeEffects = effects;
        this.applyGlobalAgentBonuses(effects);
    }

    applyGlobalAgentBonuses(effects) {
        for (const agent of this.state.agents) {
            // Global bonuses are applied on top of base stats
        }
    }

    getAvailableUpgrades() {
        const available = [];
        for (const [id, config] of this.configs) {
            if (this.canPurchase(id)) {
                available.push({
                    ...config,
                    currentLevel: this.getCurrentLevel(id),
                    cost: this.getUpgradeCost(id)
                });
            }
        }
        return available;
    }

    getAllUpgrades() {
        return Array.from(this.configs.values()).map(config => ({
            ...config,
            currentLevel: this.getCurrentLevel(config.id),
            cost: this.getUpgradeCost(config.id),
            canPurchase: this.canPurchase(config.id)
        }));
    }
}

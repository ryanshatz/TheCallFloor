/**
 * Simulation Engine
 * Core tick-based simulation processor.
 */

import { SeededRNG } from './SeededRNG.js';
import { AgentState } from '../models/Agent.js';
import * as Formulas from '../balance/Formulas.js';

export class SimulationEngine {
    constructor(gameState, configs, seed = Date.now()) {
        this.state = gameState;
        this.configs = configs;
        this.rng = new SeededRNG(seed);
        this.ticksPerMinute = 6; // 10-second ticks
        this.callbacks = {
            onTick: null,
            onMinute: null,
            onHour: null,
            onDayEnd: null,
            onConversion: null,
            onEvent: null
        };
    }

    on(event, callback) {
        if (this.callbacks.hasOwnProperty(event)) {
            this.callbacks[event] = callback;
        }
    }

    tick() {
        if (this.state.isPaused || !this.state.isWorkHours()) return;

        const dialer = this.state.dialerManager.getActiveDialer();
        if (!dialer) return;

        this.processAgentStates();
        this.processDialing(dialer);
        this.processFatigue();

        if (this.callbacks.onTick) this.callbacks.onTick(this.state);
    }

    processMinute() {
        for (let i = 0; i < this.ticksPerMinute; i++) {
            this.tick();
        }
        this.state.advanceTime(1);
        if (this.callbacks.onMinute) this.callbacks.onMinute(this.state);
    }

    processAgentStates() {
        for (const agent of this.state.agents) {
            if (agent.stateTimeRemaining > 0) {
                agent.stateTimeRemaining -= 10;

                if (agent.stateTimeRemaining <= 0) {
                    this.transitionAgentState(agent);
                }
            }
        }
    }

    transitionAgentState(agent) {
        switch (agent.state) {
            case AgentState.DIALING:
                agent.state = AgentState.IDLE;
                break;
            case AgentState.ON_CALL:
                const wrapTime = Formulas.calculateWrapUpTime({
                    baseWrapUp: this.configs.defaults.agent.baseWrapUpSeconds,
                    agentSpeedWrapup: agent.speedWrapup,
                    dialerAHTReduction: this.state.dialerManager.getActiveDialer()?.ahtReductionFactor || 0
                });
                agent.startWrapUp(wrapTime);
                break;
            case AgentState.WRAP_UP:
                agent.completeWrapUp();
                break;
            case AgentState.BREAK:
                agent.state = AgentState.IDLE;
                break;
            case AgentState.TRAINING:
                this.completeTraining(agent);
                agent.state = AgentState.IDLE;
                break;
        }
    }

    processDialing(dialer) {
        const availableAgents = this.state.getAvailableAgents();
        const dialableLeads = this.state.leadPool.getDialableLeads();

        if (availableAgents.length === 0 || dialableLeads.length === 0) return;

        const dialsThisTick = Math.ceil(dialer.dialsPerMinutePerAgent * availableAgents.length / this.ticksPerMinute);

        for (let i = 0; i < Math.min(dialsThisTick, availableAgents.length, dialableLeads.length); i++) {
            const agent = availableAgents[i];
            const lead = this.state.leadPool.getNextLead(this.state.gameTime.hour, () => this.rng.random());

            if (!agent || !lead) break;

            this.processDial(agent, lead, dialer);
        }
    }

    processDial(agent, lead, dialer) {
        agent.startDialing(this.configs.defaults.call.dialDurationSeconds);
        agent.recordDial();
        lead.recordDial();
        this.state.recordDial();

        const answerProb = Formulas.calculateAnswerProbability({
            baseAnswerProb: lead.getAnswerProbability(this.state.gameTime.hour),
            leadIntent: lead.intentMultiplier,
            hourOfDay: this.state.gameTime.hour,
            reputation: this.state.reputation,
            dialerConnectMultiplier: dialer.connectRateMultiplier,
            localPresenceBonus: this.state.upgradeEffects.answerRateBonus || 0,
            spamTagProbability: Formulas.calculateSpamTagProbability({
                reputation: this.state.reputation,
                dialVolume: this.state.dailyStats.dials,
                dialerSpamMultiplier: dialer.spamRiskMultiplier,
                spamReduction: this.state.upgradeEffects.spamReduction || 0
            }),
            timeFactors: this.configs.defaults.call.timeOfDayFactors
        });

        if (this.rng.chance(answerProb)) {
            this.processAnswer(agent, lead, dialer);
        } else if (dialer.shouldAbandon(() => this.rng.random())) {
            this.state.recordAbandonment();
            this.state.adjustReputation(-0.5);
        }
    }

    processAnswer(agent, lead, dialer) {
        lead.recordContact();
        this.state.recordContact();

        const conversionProb = Formulas.calculateConversionProbability({
            baseConversionProb: lead.getConversionProbability(),
            agentMultiplier: agent.getConversionMultiplier(),
            fatigue: agent.fatigue,
            dialerQAMultiplier: dialer.qaAssistMultiplier,
            leadRoutingBonus: this.state.upgradeEffects.leadRoutingEfficiency || 0,
            morale: agent.morale
        });

        const aht = Formulas.calculateAHT({
            baseAHT: this.configs.defaults.agent.baseAHTSeconds,
            agentSpeedWrapup: agent.speedWrapup,
            dialerAHTReduction: dialer.ahtReductionFactor,
            consistencyVariance: 1 - agent.consistency,
            randomFn: () => this.rng.random()
        });

        agent.startCall(aht, { lead, duration: aht });

        if (this.rng.chance(conversionProb)) {
            const revenue = Formulas.calculateConversionRevenue({
                baseRevenue: this.configs.defaults.call.baseRevenuePerConversion,
                leadQualityMultiplier: lead.intentMultiplier
            });

            lead.recordConversion();
            agent.recordConversion(revenue);
            this.state.recordConversion(revenue);

            if (this.callbacks.onConversion) {
                this.callbacks.onConversion({ agent, lead, revenue });
            }
        }

        if (this.rng.chance(lead.complianceRisk * (1 - agent.complianceDiscipline))) {
            agent.recordComplaint();
            this.state.recordComplaint();
            this.state.adjustReputation(-2);
        }
    }

    processFatigue() {
        for (const agent of this.state.agents) {
            if (agent.state === AgentState.ON_CALL) {
                const gain = Formulas.calculateFatigueGain(
                    agent.resilience,
                    this.configs.defaults.agent.baseFatigueGainPerCallMinute / this.ticksPerMinute,
                    this.state.upgradeEffects.fatigueGainReduction || 0
                );
                agent.adjustFatigue(gain);
            } else if (agent.state === AgentState.BREAK) {
                const recovery = Formulas.calculateFatigueRecovery(
                    this.configs.defaults.agent.baseFatigueRecoveryPerMinute / this.ticksPerMinute,
                    this.state.upgradeEffects.fatigueRecoveryBonus || 0
                );
                agent.adjustFatigue(-recovery * 3);
            } else if (agent.state === AgentState.IDLE) {
                const recovery = Formulas.calculateFatigueRecovery(
                    this.configs.defaults.agent.baseFatigueRecoveryPerMinute / this.ticksPerMinute,
                    this.state.upgradeEffects.fatigueRecoveryBonus || 0
                );
                agent.adjustFatigue(-recovery * 0.5);
            }
        }
    }

    completeTraining(agent) {
        const skill = agent.currentCall?.trainingSkill;
        if (!skill) return;

        const xp = Formulas.calculateTrainingXP(
            this.configs.defaults.training.baseXPPerSession,
            agent[skill] || 0,
            this.state.upgradeEffects.trainingEfficiency || 0
        );

        agent.addTrainingXP(skill, xp);
        agent.currentCall = null;
    }

    simulateDay() {
        const originalHour = this.state.gameTime.hour;
        const results = { dials: 0, contacts: 0, conversions: 0, revenue: 0 };

        while (this.state.gameTime.hour < 17 && this.state.gameTime.hour >= 9) {
            this.processMinute();
        }

        return this.state.endDay();
    }

    fastForward(minutes) {
        const results = [];
        for (let i = 0; i < minutes; i++) {
            this.processMinute();
            if (this.state.gameTime.hour >= 17) {
                results.push(this.state.endDay());
                this.state.gameTime.hour = 9;
            }
        }
        return results;
    }

    getMetricsSummary() {
        const ds = this.state.dailyStats;
        const contactRate = ds.dials > 0 ? ds.contacts / ds.dials : 0;
        const conversionRate = ds.contacts > 0 ? ds.conversions / ds.contacts : 0;

        return {
            day: this.state.gameTime.day,
            hour: this.state.gameTime.hour,
            cash: this.state.cash,
            agents: this.state.agents.length,
            leads: this.state.leadPool.getStats().dialable,
            dials: ds.dials,
            contacts: ds.contacts,
            conversions: ds.conversions,
            revenue: ds.revenue,
            costs: ds.costs,
            profit: ds.revenue - ds.costs,
            contactRate: (contactRate * 100).toFixed(1) + '%',
            conversionRate: (conversionRate * 100).toFixed(1) + '%',
            reputation: this.state.reputation.toFixed(0)
        };
    }
}

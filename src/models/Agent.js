/**
 * Agent Model
 * Represents a call center agent with stats, state, and training progress.
 */

import { clamp } from '../balance/Formulas.js';

/**
 * Agent states in the state machine
 * @enum {string}
 */
export const AgentState = {
    IDLE: 'idle',
    DIALING: 'dialing',
    ON_CALL: 'on_call',
    WRAP_UP: 'wrap_up',
    BREAK: 'break',
    TRAINING: 'training',
    COACHING: 'coaching',
    UNAVAILABLE: 'unavailable'
};

/**
 * Generate a random agent name
 * @param {function} randomFn - Random number generator function
 * @returns {string}
 */
function generateAgentName(randomFn) {
    const firstNames = [
        'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery',
        'Jamie', 'Drew', 'Cameron', 'Skyler', 'Reese', 'Parker', 'Blake', 'Hayden',
        'Mike', 'Sarah', 'Chris', 'Jessica', 'David', 'Emily', 'James', 'Ashley',
        'Marcus', 'Linda', 'Kevin', 'Michelle', 'Brian', 'Stephanie', 'Tony', 'Rachel'
    ];
    const lastInitials = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    const firstName = firstNames[Math.floor(randomFn() * firstNames.length)];
    const lastInitial = lastInitials[Math.floor(randomFn() * lastInitials.length)];

    return `${firstName} ${lastInitial}.`;
}

/**
 * Agent class representing a call center employee
 */
export class Agent {
    /**
     * Create a new agent
     * @param {Object} config
     * @param {string} config.id - Unique identifier
     * @param {string} config.name - Display name
     * @param {Object} config.baseStats - Default stat values
     * @param {number} config.statVariance - Random variance in initial stats
     * @param {function} config.randomFn - RNG function for stat generation
     */
    constructor({
        id,
        name = null,
        baseStats = {},
        statVariance = 0.15,
        randomFn = Math.random
    }) {
        this.id = id;
        this.name = name || generateAgentName(randomFn);

        // Core stats (0-1)
        this.skillTalktrack = this._generateStat(baseStats.skillTalktrack ?? 0.4, statVariance, randomFn);
        this.speedWrapup = this._generateStat(baseStats.speedWrapup ?? 0.4, statVariance, randomFn);
        this.complianceDiscipline = this._generateStat(baseStats.complianceDiscipline ?? 0.5, statVariance, randomFn);
        this.resilience = this._generateStat(baseStats.resilience ?? 0.5, statVariance, randomFn);
        this.charisma = this._generateStat(baseStats.charisma ?? 0.3, statVariance, randomFn);
        this.consistency = this._generateStat(baseStats.consistency ?? 0.4, statVariance, randomFn);

        // Dynamic state
        this.fatigue = 0;
        this.morale = 0.7;
        this.state = AgentState.IDLE;
        this.stateTimeRemaining = 0; // Seconds remaining in current state

        // Current call data
        this.currentCall = null;

        // Training XP per skill
        this.trainingXP = {
            skillTalktrack: 0,
            speedWrapup: 0,
            complianceDiscipline: 0,
            resilience: 0,
            charisma: 0,
            consistency: 0
        };

        // Performance stats (reset daily)
        this.dailyStats = this._createEmptyDailyStats();

        // Lifetime stats
        this.lifetimeStats = {
            totalCalls: 0,
            totalConversions: 0,
            totalTalkTime: 0,
            daysWorked: 0
        };

        // Hire timestamp
        this.hiredAt = Date.now();
    }

    /**
     * Generate a stat with variance
     * @private
     */
    _generateStat(base, variance, randomFn) {
        const variation = (randomFn() - 0.5) * 2 * variance;
        return clamp(base + variation, 0.1, 0.9);
    }

    /**
     * Create empty daily stats object
     * @private
     */
    _createEmptyDailyStats() {
        return {
            dials: 0,
            contacts: 0,
            conversions: 0,
            talkTimeSeconds: 0,
            revenue: 0,
            complaints: 0
        };
    }

    /**
     * Reset daily stats (call at end of day)
     */
    resetDailyStats() {
        this.dailyStats = this._createEmptyDailyStats();
        this.lifetimeStats.daysWorked++;
    }

    /**
     * Check if agent is available to take a call
     * @returns {boolean}
     */
    isAvailable() {
        return this.state === AgentState.IDLE;
    }

    /**
     * Check if agent is actively working (not on break/training)
     * @returns {boolean}
     */
    isWorking() {
        return [AgentState.IDLE, AgentState.DIALING, AgentState.ON_CALL, AgentState.WRAP_UP]
            .includes(this.state);
    }

    /**
     * Transition to dialing state
     * @param {number} dialDurationSeconds
     */
    startDialing(dialDurationSeconds) {
        this.state = AgentState.DIALING;
        this.stateTimeRemaining = dialDurationSeconds;
    }

    /**
     * Transition to on-call state
     * @param {number} callDurationSeconds
     * @param {Object} callData - Data about the current call
     */
    startCall(callDurationSeconds, callData = {}) {
        this.state = AgentState.ON_CALL;
        this.stateTimeRemaining = callDurationSeconds;
        this.currentCall = callData;
        this.dailyStats.contacts++;
        this.lifetimeStats.totalCalls++;
    }

    /**
     * Transition to wrap-up state
     * @param {number} wrapUpSeconds
     */
    startWrapUp(wrapUpSeconds) {
        this.state = AgentState.WRAP_UP;
        this.stateTimeRemaining = wrapUpSeconds;

        if (this.currentCall) {
            this.dailyStats.talkTimeSeconds += this.currentCall.duration || 0;
            this.lifetimeStats.totalTalkTime += this.currentCall.duration || 0;
        }
        this.currentCall = null;
    }

    /**
     * Complete call and go back to idle
     */
    completeWrapUp() {
        this.state = AgentState.IDLE;
        this.stateTimeRemaining = 0;
    }

    /**
     * Go on break
     * @param {number} breakDurationSeconds
     */
    startBreak(breakDurationSeconds) {
        this.state = AgentState.BREAK;
        this.stateTimeRemaining = breakDurationSeconds;
    }

    /**
     * Start training session
     * @param {string} skillToTrain
     * @param {number} trainingDurationSeconds
     */
    startTraining(skillToTrain, trainingDurationSeconds) {
        this.state = AgentState.TRAINING;
        this.stateTimeRemaining = trainingDurationSeconds;
        this.currentCall = { trainingSkill: skillToTrain };
    }

    /**
     * Record a conversion
     * @param {number} revenue
     */
    recordConversion(revenue) {
        this.dailyStats.conversions++;
        this.dailyStats.revenue += revenue;
        this.lifetimeStats.totalConversions++;
    }

    /**
     * Record a dial attempt
     */
    recordDial() {
        this.dailyStats.dials++;
    }

    /**
     * Record a complaint
     */
    recordComplaint() {
        this.dailyStats.complaints++;
    }

    /**
     * Update fatigue (increase or decrease)
     * @param {number} delta - Amount to change (positive = more tired)
     */
    adjustFatigue(delta) {
        this.fatigue = clamp(this.fatigue + delta, 0, 1);
    }

    /**
     * Update morale
     * @param {number} delta - Amount to change
     */
    adjustMorale(delta) {
        this.morale = clamp(this.morale + delta, 0, 1);
    }

    /**
     * Apply stat bonus (from upgrades/training)
     * @param {string} stat - Stat name
     * @param {number} bonus - Amount to add
     */
    applyStat(stat, bonus) {
        if (this[stat] !== undefined) {
            this[stat] = clamp(this[stat] + bonus, 0, 1);
        }
    }

    /**
     * Add training XP to a skill
     * @param {string} skill
     * @param {number} xp
     */
    addTrainingXP(skill, xp) {
        if (this.trainingXP[skill] !== undefined) {
            this.trainingXP[skill] += xp;
        }
    }

    /**
     * Calculate effective conversion multiplier
     * @returns {number}
     */
    getConversionMultiplier() {
        const talktrackEffect = 0.7 + (this.skillTalktrack * 0.6);
        const charismaEffect = 1 + (this.charisma * 0.15);
        const consistencyEffect = 1 + (this.consistency * 0.05);
        return talktrackEffect * charismaEffect * consistencyEffect;
    }

    /**
     * Get agent contact rate (contacts / dials)
     * @returns {number}
     */
    getContactRate() {
        if (this.dailyStats.dials === 0) return 0;
        return this.dailyStats.contacts / this.dailyStats.dials;
    }

    /**
     * Get agent conversion rate (conversions / contacts)
     * @returns {number}
     */
    getConversionRate() {
        if (this.dailyStats.contacts === 0) return 0;
        return this.dailyStats.conversions / this.dailyStats.contacts;
    }

    /**
     * Serialize agent for saving
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            skillTalktrack: this.skillTalktrack,
            speedWrapup: this.speedWrapup,
            complianceDiscipline: this.complianceDiscipline,
            resilience: this.resilience,
            charisma: this.charisma,
            consistency: this.consistency,
            fatigue: this.fatigue,
            morale: this.morale,
            state: this.state,
            stateTimeRemaining: this.stateTimeRemaining,
            trainingXP: { ...this.trainingXP },
            dailyStats: { ...this.dailyStats },
            lifetimeStats: { ...this.lifetimeStats },
            hiredAt: this.hiredAt
        };
    }

    /**
     * Create agent from saved data
     * @param {Object} data
     * @returns {Agent}
     */
    static fromJSON(data) {
        const agent = new Agent({
            id: data.id,
            name: data.name,
            baseStats: {},
            statVariance: 0
        });

        // Override with saved values
        agent.skillTalktrack = data.skillTalktrack;
        agent.speedWrapup = data.speedWrapup;
        agent.complianceDiscipline = data.complianceDiscipline;
        agent.resilience = data.resilience;
        agent.charisma = data.charisma;
        agent.consistency = data.consistency;
        agent.fatigue = data.fatigue;
        agent.morale = data.morale;
        agent.state = data.state;
        agent.stateTimeRemaining = data.stateTimeRemaining;
        agent.trainingXP = { ...data.trainingXP };
        agent.dailyStats = { ...data.dailyStats };
        agent.lifetimeStats = { ...data.lifetimeStats };
        agent.hiredAt = data.hiredAt;

        return agent;
    }
}

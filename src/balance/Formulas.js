/**
 * Centralized Formula Module
 * ALL game math lives here. No magic numbers in other files.
 * Formulas are documented and tunable.
 */

/**
 * Clamp a value between min and max
 * @param {number} value 
 * @param {number} min 
 * @param {number} max 
 * @returns {number}
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation
 * @param {number} a 
 * @param {number} b 
 * @param {number} t - Value between 0 and 1
 * @returns {number}
 */
export function lerp(a, b, t) {
    return a + (b - a) * clamp(t, 0, 1);
}

// ============================================
// ANSWER PROBABILITY FORMULAS
// ============================================

/**
 * Calculate probability a call will be answered
 * 
 * Formula:
 * answered = clamp(
 *   baseAnswerProb 
 *   * leadIntentFactor 
 *   * timeWindowFactor 
 *   * reputationFactor 
 *   * dialerConnectMultiplier
 *   * localPresenceBonus,
 *   0, 0.95
 * )
 * 
 * @param {Object} params
 * @param {number} params.baseAnswerProb - Lead's base answer probability (0-1)
 * @param {number} params.leadIntent - Lead source intent multiplier
 * @param {number} params.hourOfDay - Current hour (0-23)
 * @param {number} params.reputation - Caller ID reputation (0-100)
 * @param {number} params.dialerConnectMultiplier - Dialer's connect rate modifier
 * @param {number} params.localPresenceBonus - Bonus from local presence upgrade (0-1)
 * @param {number} params.spamTagProbability - Probability call is spam-tagged (0-1)
 * @param {Object} params.timeFactors - Hour-to-factor mapping
 * @returns {number} Probability of answer (0-0.95)
 */
export function calculateAnswerProbability({
    baseAnswerProb = 0.18,
    leadIntent = 1.0,
    hourOfDay = 12,
    reputation = 75,
    dialerConnectMultiplier = 1.0,
    localPresenceBonus = 0,
    spamTagProbability = 0,
    timeFactors = {}
}) {
    // Time of day factor (default to 1.0 if not specified)
    const timeWindowFactor = timeFactors[hourOfDay] || 1.0;

    // Reputation factor: scales from 0.5 at rep=0 to 1.2 at rep=100
    const reputationFactor = 0.5 + (reputation / 100) * 0.7;

    // Spam tag reduces answer rate significantly
    const spamPenalty = 1 - (spamTagProbability * 0.6);

    // Local presence adds flat bonus
    const localBonus = 1 + localPresenceBonus;

    const probability = baseAnswerProb
        * leadIntent
        * timeWindowFactor
        * reputationFactor
        * dialerConnectMultiplier
        * spamPenalty
        * localBonus;

    // Cap at 95% - nothing is guaranteed
    return clamp(probability, 0, 0.95);
}

// ============================================
// CONVERSION PROBABILITY FORMULAS
// ============================================

/**
 * Calculate effective conversion multiplier from agent stats
 * 
 * @param {Object} agent - Agent with stats
 * @returns {number} Multiplier (typically 0.7 - 1.5)
 */
export function calculateAgentConversionMultiplier(agent) {
    // Talktrack is primary driver
    const talktrackEffect = 0.7 + (agent.skillTalktrack * 0.6);

    // Charisma adds small bonus
    const charismaEffect = 1 + (agent.charisma * 0.15);

    // Consistency reduces variance penalty (handled in actual conversion, but still affects average)
    const consistencyEffect = 1 + (agent.consistency * 0.05);

    return talktrackEffect * charismaEffect * consistencyEffect;
}

/**
 * Calculate probability of conversion on an answered call
 * 
 * @param {Object} params
 * @param {number} params.baseConversionProb - Lead's base conversion probability
 * @param {number} params.agentMultiplier - Agent's effective conversion multiplier
 * @param {number} params.fatigue - Agent's fatigue level (0-1)
 * @param {number} params.dialerQAMultiplier - Dialer's QA assist multiplier
 * @param {number} params.leadRoutingBonus - Bonus from CRM/lead routing (0-1)
 * @param {number} params.morale - Agent morale (0-1)
 * @returns {number} Probability of conversion (0-0.80)
 */
export function calculateConversionProbability({
    baseConversionProb = 0.07,
    agentMultiplier = 1.0,
    fatigue = 0,
    dialerQAMultiplier = 1.0,
    leadRoutingBonus = 0,
    morale = 0.5
}) {
    // Fatigue penalty: exponential impact at high fatigue
    const fatiguePenalty = calculateFatiguePenalty(fatigue);

    // Morale factor: low morale hurts, high morale helps slightly
    const moraleFactor = 0.8 + (morale * 0.4);

    // Lead routing improvement
    const routingFactor = 1 + leadRoutingBonus;

    const probability = baseConversionProb
        * agentMultiplier
        * (1 - fatiguePenalty)
        * dialerQAMultiplier
        * moraleFactor
        * routingFactor;

    // Cap at 80% - even the best agent can't close everyone
    return clamp(probability, 0, 0.80);
}

// ============================================
// FATIGUE FORMULAS
// ============================================

/**
 * Calculate fatigue penalty on performance
 * Uses exponential curve so low fatigue has minimal impact,
 * but high fatigue severely degrades performance.
 * 
 * @param {number} fatigue - Fatigue level (0-1)
 * @param {number} exponent - Controls curve steepness (default 2.5)
 * @param {number} maxPenalty - Maximum penalty at full fatigue (default 0.5)
 * @returns {number} Penalty amount (0 to maxPenalty)
 */
export function calculateFatiguePenalty(fatigue, exponent = 2.5, maxPenalty = 0.5) {
    return Math.pow(clamp(fatigue, 0, 1), exponent) * maxPenalty;
}

/**
 * Calculate fatigue increase per minute of call time
 * 
 * @param {number} resilience - Agent's resilience stat (0-1)
 * @param {number} baseFatigueGain - Base fatigue gain per call minute
 * @param {number} fatigueGainReduction - Reduction from ergonomic upgrades (0-1)
 * @returns {number} Fatigue gain per call minute
 */
export function calculateFatigueGain(resilience, baseFatigueGain = 0.01, fatigueGainReduction = 0) {
    const resilienceReduction = resilience * 0.6; // High resilience reduces fatigue gain by up to 60%
    return baseFatigueGain * (1 - resilienceReduction) * (1 - fatigueGainReduction);
}

/**
 * Calculate fatigue recovery per minute during break/idle
 * 
 * @param {number} baseFatigueRecovery - Base recovery rate per minute
 * @param {number} recoveryBonus - Bonus from break room upgrades (0-1)
 * @returns {number} Fatigue recovery per minute
 */
export function calculateFatigueRecovery(baseFatigueRecovery = 0.02, recoveryBonus = 0) {
    return baseFatigueRecovery * (1 + recoveryBonus);
}

// ============================================
// CALL DURATION FORMULAS
// ============================================

/**
 * Calculate effective Average Handle Time (AHT)
 * 
 * @param {Object} params
 * @param {number} params.baseAHT - Base AHT in seconds
 * @param {number} params.agentSpeedWrapup - Agent's wrapup speed stat (0-1)
 * @param {number} params.dialerAHTReduction - Dialer's AHT reduction factor
 * @param {number} params.consistencyVariance - How much variance to add based on consistency
 * @param {function} params.randomFn - Random function for variance
 * @returns {number} AHT in seconds
 */
export function calculateAHT({
    baseAHT = 180,
    agentSpeedWrapup = 0.4,
    dialerAHTReduction = 0,
    consistencyVariance = 0.3,
    randomFn = Math.random
}) {
    // Speed wrapup reduces AHT by up to 30%
    const speedReduction = agentSpeedWrapup * 0.3;

    // Total reduction
    const totalReduction = Math.min(speedReduction + dialerAHTReduction, 0.5);

    const baseTime = baseAHT * (1 - totalReduction);

    // Add variance (±variance% of base)
    const variance = (randomFn() - 0.5) * 2 * consistencyVariance * baseTime;

    return Math.max(30, Math.round(baseTime + variance));
}

/**
 * Calculate wrap-up time after a call
 * 
 * @param {Object} params
 * @param {number} params.baseWrapUp - Base wrap-up time in seconds
 * @param {number} params.agentSpeedWrapup - Agent's wrapup speed stat (0-1)
 * @param {number} params.dialerAHTReduction - AI assist reduction
 * @returns {number} Wrap-up time in seconds
 */
export function calculateWrapUpTime({
    baseWrapUp = 45,
    agentSpeedWrapup = 0.4,
    dialerAHTReduction = 0
}) {
    const speedReduction = agentSpeedWrapup * 0.4;
    const totalReduction = Math.min(speedReduction + dialerAHTReduction, 0.6);
    return Math.max(10, Math.round(baseWrapUp * (1 - totalReduction)));
}

// ============================================
// REPUTATION FORMULAS
// ============================================

/**
 * Calculate spam tag probability based on reputation and volume
 * 
 * @param {Object} params
 * @param {number} params.reputation - Current reputation score (0-100)
 * @param {number} params.dialVolume - Dials in current period
 * @param {number} params.volumeThreshold - Normal dial volume threshold
 * @param {number} params.dialerSpamMultiplier - Dialer's spam risk multiplier
 * @param {number} params.spamReduction - Reduction from number pool upgrades (0-1)
 * @returns {number} Probability of spam tagging (0-1)
 */
export function calculateSpamTagProbability({
    reputation = 75,
    dialVolume = 0,
    volumeThreshold = 200,
    dialerSpamMultiplier = 1.0,
    spamReduction = 0
}) {
    // Base spam probability inversely related to reputation
    const baseSpam = Math.max(0, (100 - reputation) / 200); // 0-0.5 range

    // Volume spike increases spam risk
    const volumeRatio = dialVolume / Math.max(volumeThreshold, 1);
    const volumeFactor = volumeRatio > 1.5 ? 1 + (volumeRatio - 1.5) * 0.5 : 1;

    // Apply modifiers
    const probability = baseSpam * dialerSpamMultiplier * volumeFactor * (1 - spamReduction);

    return clamp(probability, 0, 0.8);
}

/**
 * Calculate reputation change from complaints and volume
 * 
 * @param {Object} params
 * @param {number} params.complaints - Number of complaints in period
 * @param {number} params.abandonments - Abandoned calls (predictive dialer)
 * @param {number} params.conversions - Successful conversions
 * @param {number} params.complianceDiscipline - Average agent compliance stat
 * @param {number} params.idleHours - Hours of idle time (recovery)
 * @param {number} params.recoveryRate - Base recovery per idle hour
 * @returns {number} Net reputation change
 */
export function calculateReputationChange({
    complaints = 0,
    abandonments = 0,
    conversions = 0,
    complianceDiscipline = 0.5,
    idleHours = 0,
    recoveryRate = 0.5
}) {
    // Complaints hurt a lot
    const complaintImpact = complaints * -2;

    // Abandonments hurt somewhat
    const abandonImpact = abandonments * -0.5;

    // Conversions help slightly (happy customers)
    const conversionBoost = conversions * 0.1;

    // Compliance discipline reduces negative impacts
    const disciplineFactor = 0.5 + complianceDiscipline;

    // Idle time helps recovery
    const recovery = idleHours * recoveryRate;

    const netChange = (complaintImpact + abandonImpact) / disciplineFactor
        + conversionBoost
        + recovery;

    return netChange;
}

// ============================================
// ECONOMY FORMULAS
// ============================================

/**
 * Calculate upgrade cost at a given level
 * Uses exponential growth with diminishing returns
 * 
 * @param {number} baseCost - Base cost at level 0
 * @param {number} level - Current level
 * @param {number} growthRate - Cost growth multiplier per level
 * @returns {number} Cost for next upgrade
 */
export function calculateUpgradeCost(baseCost, level, growthRate = 1.5) {
    return Math.round(baseCost * Math.pow(growthRate, level));
}

/**
 * Calculate daily wage cost for agents
 * 
 * @param {number} hourlyWage - Wage per hour
 * @param {number} hoursPerDay - Work hours per day
 * @returns {number} Daily wage cost
 */
export function calculateDailyWage(hourlyWage, hoursPerDay = 8) {
    return hourlyWage * hoursPerDay;
}

/**
 * Calculate revenue from a successful conversion
 * 
 * @param {Object} params
 * @param {number} params.baseRevenue - Base revenue per conversion
 * @param {number} params.leadQualityMultiplier - Lead source quality factor
 * @param {number} params.upgradeBonuses - Revenue bonuses from upgrades
 * @returns {number} Revenue amount
 */
export function calculateConversionRevenue({
    baseRevenue = 120,
    leadQualityMultiplier = 1.0,
    upgradeBonuses = 0
}) {
    return Math.round(baseRevenue * leadQualityMultiplier * (1 + upgradeBonuses));
}

// ============================================
// TRAINING FORMULAS
// ============================================

/**
 * Calculate XP required for next skill level
 * Uses increasing requirements with diminishing returns
 * 
 * @param {number} currentLevel - Current skill level (0-1)
 * @param {number} baseXP - Base XP for first level up
 * @returns {number} XP required
 */
export function calculateXPRequired(currentLevel, baseXP = 100) {
    // Each 0.1 level requires progressively more XP
    const levelStep = Math.floor(currentLevel * 10);
    return Math.round(baseXP * Math.pow(1.3, levelStep));
}

/**
 * Calculate XP gain from training session
 * 
 * @param {number} baseXP - Base XP from session
 * @param {number} currentLevel - Current skill level
 * @param {number} trainingEfficiency - Bonus from upgrades (0-1)
 * @param {number} diminishingFactor - How much higher levels reduce gains
 * @returns {number} XP gained
 */
export function calculateTrainingXP(baseXP, currentLevel, trainingEfficiency = 0, diminishingFactor = 0.85) {
    // Higher skill = less XP gain (diminishing returns)
    const diminishingMultiplier = Math.pow(diminishingFactor, currentLevel * 10);

    // Training efficiency adds bonus
    const efficiencyMultiplier = 1 + trainingEfficiency;

    return Math.round(baseXP * diminishingMultiplier * efficiencyMultiplier);
}

/**
 * Calculate skill level increase from XP
 * 
 * @param {number} currentLevel - Current level (0-1)
 * @param {number} xpGained - XP gained
 * @param {number} xpRequired - XP required for next step
 * @returns {number} New level (capped at 1.0)
 */
export function calculateNewSkillLevel(currentLevel, xpGained, xpRequired) {
    const stepSize = 0.01; // Each step = 0.01 skill increase
    const steps = Math.floor(xpGained / xpRequired);
    return clamp(currentLevel + (steps * stepSize), 0, 1);
}

// ============================================
// AGGREGATE SIMULATION FORMULAS (for fast-forward)
// ============================================

/**
 * Estimate expected results for a period using expected values
 * Used for fast-forward simulation
 * 
 * @param {Object} params
 * @param {number} params.agents - Number of agents
 * @param {number} params.dialsPerMinutePerAgent - Dialer throughput
 * @param {number} params.answerProb - Expected answer probability
 * @param {number} params.conversionProb - Expected conversion probability
 * @param {number} params.revenuePerConversion - Revenue per sale
 * @param {number} params.minutes - Period length in minutes
 * @param {number} params.occupancyTarget - Expected agent utilization
 * @returns {Object} Expected metrics
 */
export function estimatePeriodMetrics({
    agents,
    dialsPerMinutePerAgent,
    answerProb,
    conversionProb,
    revenuePerConversion,
    minutes,
    occupancyTarget = 0.5
}) {
    // Not all agents dialing all the time due to calls, wrap-up, breaks
    const effectiveDialingMinutes = minutes * occupancyTarget;

    const totalDials = Math.round(agents * dialsPerMinutePerAgent * effectiveDialingMinutes);
    const expectedContacts = Math.round(totalDials * answerProb);
    const expectedConversions = Math.round(expectedContacts * conversionProb);
    const expectedRevenue = expectedConversions * revenuePerConversion;

    return {
        dials: totalDials,
        contacts: expectedContacts,
        conversions: expectedConversions,
        revenue: expectedRevenue,
        contactRate: totalDials > 0 ? expectedContacts / totalDials : 0,
        conversionRate: expectedContacts > 0 ? expectedConversions / expectedContacts : 0
    };
}

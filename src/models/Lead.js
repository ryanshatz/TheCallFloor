/**
 * Lead and LeadSource Models
 * Manages lead generation, quality, and lifecycle.
 */

import { clamp } from '../balance/Formulas.js';

/**
 * Lead Source - Configuration for where leads come from
 */
export class LeadSource {
    constructor(config) {
        this.id = config.id;
        this.name = config.name;
        this.description = config.description || '';
        this.tier = config.tier || 1;

        // Cost and economics
        this.costPerLead = config.costPerLead || 2.5;

        // Quality metrics
        this.intentMultiplier = config.intentMultiplier || 1.0;
        this.freshnessDecayPerDay = config.freshnessDecayPerDay || 0.01;
        this.complianceRisk = config.complianceRisk || 0.1;

        // Supply
        this.supplyPerDay = config.supplyPerDay || 100;

        // Base probabilities
        this.baseAnswerProbability = config.baseAnswerProbability || 0.18;
        this.baseConversionProbability = config.baseConversionProbability || 0.07;

        // Unlock requirements
        this.unlockCost = config.unlockCost || 0;
        this.prerequisites = config.prerequisites || [];

        // State
        this.unlocked = this.unlockCost === 0;
    }

    /**
     * Create a lead from this source
     * @param {string} leadId 
     * @param {function} randomFn 
     * @returns {Lead}
     */
    generateLead(leadId, randomFn = Math.random) {
        return new Lead({
            id: leadId,
            sourceId: this.id,
            baseAnswerProbability: this.baseAnswerProbability,
            baseConversionProbability: this.baseConversionProbability,
            intentMultiplier: this.intentMultiplier,
            complianceRisk: this.complianceRisk,
            freshnessDecayPerDay: this.freshnessDecayPerDay,
            createdAt: Date.now(),
            randomFn
        });
    }

    /**
     * Serialize for saving
     */
    toJSON() {
        return {
            id: this.id,
            unlocked: this.unlocked
        };
    }
}

/**
 * Individual Lead - A contact to be called
 */
export class Lead {
    constructor({
        id,
        sourceId,
        baseAnswerProbability = 0.18,
        baseConversionProbability = 0.07,
        intentMultiplier = 1.0,
        complianceRisk = 0.1,
        freshnessDecayPerDay = 0.01,
        createdAt = Date.now(),
        randomFn = Math.random
    }) {
        this.id = id;
        this.sourceId = sourceId;

        // Base probabilities with slight variance
        const variance = 0.1;
        this.baseAnswerProbability = clamp(
            baseAnswerProbability * (1 + (randomFn() - 0.5) * variance),
            0.05, 0.95
        );
        this.baseConversionProbability = clamp(
            baseConversionProbability * (1 + (randomFn() - 0.5) * variance),
            0.01, 0.5
        );

        // Quality factors
        this.intentMultiplier = intentMultiplier;
        this.complianceRisk = complianceRisk;
        this.freshnessDecayPerDay = freshnessDecayPerDay;

        // Timing
        this.createdAt = createdAt;
        this.lastDialedAt = null;
        this.dialAttempts = 0;
        this.maxDialAttempts = 3;

        // Contact window (prefer certain hours)
        this.preferredHours = this._generatePreferredHours(randomFn);

        // Status
        this.status = 'fresh'; // fresh, contacted, converted, exhausted, dnc
        this.convertedAt = null;
    }

    /**
     * Generate preferred contact hours
     * @private
     */
    _generatePreferredHours(randomFn) {
        // Most leads prefer 10am-2pm or 5pm-7pm
        const morning = randomFn() > 0.3;
        const evening = randomFn() > 0.5;

        const hours = [];
        if (morning) {
            hours.push(10, 11, 12, 13, 14);
        }
        if (evening) {
            hours.push(17, 18, 19);
        }
        // Always include some hours
        if (hours.length === 0) {
            hours.push(10, 11, 14, 15);
        }
        return hours;
    }

    /**
     * Get current freshness (decays over time)
     * @returns {number} 0-1 freshness score
     */
    getFreshness() {
        const daysSinceCreated = (Date.now() - this.createdAt) / (1000 * 60 * 60 * 24);
        const decay = daysSinceCreated * this.freshnessDecayPerDay;
        return clamp(1 - decay, 0.2, 1);
    }

    /**
     * Get time-of-day multiplier for current hour
     * @param {number} hourOfDay 
     * @returns {number}
     */
    getTimeMultiplier(hourOfDay) {
        if (this.preferredHours.includes(hourOfDay)) {
            return 1.2;
        }
        // Early morning or late evening penalty
        if (hourOfDay < 9 || hourOfDay > 19) {
            return 0.5;
        }
        return 1.0;
    }

    /**
     * Calculate effective answer probability
     * @param {number} hourOfDay 
     * @returns {number}
     */
    getAnswerProbability(hourOfDay) {
        const freshness = this.getFreshness();
        const timeFactor = this.getTimeMultiplier(hourOfDay);

        // Each dial attempt reduces answer probability
        const dialPenalty = Math.pow(0.8, this.dialAttempts);

        return clamp(
            this.baseAnswerProbability * this.intentMultiplier * freshness * timeFactor * dialPenalty,
            0.01, 0.95
        );
    }

    /**
     * Calculate effective conversion probability
     * @returns {number}
     */
    getConversionProbability() {
        const freshness = this.getFreshness();
        return clamp(
            this.baseConversionProbability * this.intentMultiplier * freshness,
            0.01, 0.5
        );
    }

    /**
     * Check if lead can be dialed (fresh leads only)
     * @returns {boolean}
     */
    isDialable() {
        return this.status === 'fresh' && this.dialAttempts < this.maxDialAttempts;
    }

    /**
     * Check if lead can be redialed (contacted but not converted)
     * Allows calling back leads that answered but didn't convert
     * @returns {boolean}
     */
    isRedialable() {
        return this.status === 'contacted' && this.dialAttempts < this.maxDialAttempts + 2;
    }

    /**
     * Record a dial attempt
     * @param {number} timestamp
     */
    recordDial(timestamp = Date.now()) {
        this.dialAttempts++;
        this.lastDialedAt = timestamp;

        if (this.dialAttempts >= this.maxDialAttempts) {
            this.status = 'exhausted';
        }
    }

    /**
     * Record successful contact
     */
    recordContact() {
        this.status = 'contacted';
    }

    /**
     * Record conversion
     * @param {number} timestamp
     */
    recordConversion(timestamp = Date.now()) {
        this.status = 'converted';
        this.convertedAt = timestamp;
    }

    /**
     * Mark as Do Not Call
     */
    markDNC() {
        this.status = 'dnc';
    }

    /**
     * Serialize for saving
     */
    toJSON() {
        return {
            id: this.id,
            sourceId: this.sourceId,
            baseAnswerProbability: this.baseAnswerProbability,
            baseConversionProbability: this.baseConversionProbability,
            intentMultiplier: this.intentMultiplier,
            complianceRisk: this.complianceRisk,
            freshnessDecayPerDay: this.freshnessDecayPerDay,
            createdAt: this.createdAt,
            lastDialedAt: this.lastDialedAt,
            dialAttempts: this.dialAttempts,
            maxDialAttempts: this.maxDialAttempts,
            preferredHours: this.preferredHours,
            status: this.status,
            convertedAt: this.convertedAt
        };
    }

    /**
     * Create lead from saved data
     */
    static fromJSON(data) {
        const lead = new Lead({
            id: data.id,
            sourceId: data.sourceId,
            baseAnswerProbability: data.baseAnswerProbability,
            baseConversionProbability: data.baseConversionProbability,
            intentMultiplier: data.intentMultiplier,
            complianceRisk: data.complianceRisk,
            freshnessDecayPerDay: data.freshnessDecayPerDay,
            createdAt: data.createdAt
        });

        lead.lastDialedAt = data.lastDialedAt;
        lead.dialAttempts = data.dialAttempts;
        lead.maxDialAttempts = data.maxDialAttempts;
        lead.preferredHours = data.preferredHours;
        lead.status = data.status;
        lead.convertedAt = data.convertedAt;

        return lead;
    }
}

/**
 * Lead Pool Manager - Manages inventory of leads
 */
export class LeadPool {
    constructor() {
        this.leads = new Map(); // id -> Lead
        this.sources = new Map(); // id -> LeadSource
        this.nextLeadId = 1;
    }

    /**
     * Register a lead source
     * @param {LeadSource} source 
     */
    addSource(source) {
        this.sources.set(source.id, source);
    }

    /**
     * Get unlocked sources
     * @returns {LeadSource[]}
     */
    getUnlockedSources() {
        return Array.from(this.sources.values()).filter(s => s.unlocked);
    }

    /**
     * Add leads from a source
     * @param {string} sourceId 
     * @param {number} count 
     * @param {function} randomFn 
     * @returns {Lead[]}
     */
    generateLeads(sourceId, count, randomFn = Math.random) {
        const source = this.sources.get(sourceId);
        if (!source || !source.unlocked) {
            return [];
        }

        const newLeads = [];
        for (let i = 0; i < count; i++) {
            const lead = source.generateLead(`lead_${this.nextLeadId++}`, randomFn);
            this.leads.set(lead.id, lead);
            newLeads.push(lead);
        }
        return newLeads;
    }

    /**
     * Get all dialable leads (fresh)
     * @returns {Lead[]}
     */
    getDialableLeads() {
        return Array.from(this.leads.values()).filter(l => l.isDialable());
    }

    /**
     * Get redialable leads (contacted but not converted)
     * @returns {Lead[]}
     */
    getRedialableLeads() {
        return Array.from(this.leads.values()).filter(l => l.isRedialable());
    }

    /**
     * Get a lead to dial (prioritizes fresher, higher intent)
     * @param {number} hourOfDay
     * @param {function} randomFn
     * @returns {Lead|null}
     */
    getNextLead(hourOfDay, randomFn = Math.random) {
        let dialable = this.getDialableLeads();
        let isRedial = false;

        // If no fresh leads, fall back to redialing contacted leads
        if (dialable.length === 0) {
            dialable = this.getRedialableLeads();
            isRedial = true;
            if (dialable.length === 0) return null;
        }

        // Score leads by expected value
        const scored = dialable.map(lead => {
            let score = lead.getAnswerProbability(hourOfDay) * lead.getConversionProbability();
            // Redials have lower priority and success rate
            if (isRedial) {
                score *= 0.6; // 40% penalty for redials
            }
            return { lead, score, isRedial };
        });

        // Sort by score descending
        scored.sort((a, b) => b.score - a.score);

        // Pick from top 20% with some randomness
        const topCount = Math.max(1, Math.floor(scored.length * 0.2));
        const topLeads = scored.slice(0, topCount);
        const index = Math.floor(randomFn() * topLeads.length);

        return topLeads[index].lead;
    }

    /**
     * Get lead by ID
     * @param {string} id 
     * @returns {Lead|undefined}
     */
    getLead(id) {
        return this.leads.get(id);
    }

    /**
     * Remove exhausted/converted leads older than X days
     * @param {number} maxAgeDays 
     */
    cleanup(maxAgeDays = 30) {
        const threshold = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);

        for (const [id, lead] of this.leads) {
            if ((lead.status === 'exhausted' || lead.status === 'converted')
                && lead.createdAt < threshold) {
                this.leads.delete(id);
            }
        }
    }

    /**
     * Get lead pool stats
     * @returns {Object}
     */
    getStats() {
        let fresh = 0, contacted = 0, converted = 0, exhausted = 0, dnc = 0;

        for (const lead of this.leads.values()) {
            switch (lead.status) {
                case 'fresh': fresh++; break;
                case 'contacted': contacted++; break;
                case 'converted': converted++; break;
                case 'exhausted': exhausted++; break;
                case 'dnc': dnc++; break;
            }
        }

        // Count redialable leads (contacted but can be called again)
        const redialable = Array.from(this.leads.values()).filter(l => l.isRedialable()).length;

        return {
            total: this.leads.size,
            fresh,
            contacted,
            converted,
            exhausted,
            dnc,
            dialable: fresh,
            redialable: redialable,
            available: fresh + redialable // Total leads that can be dialed
        };
    }

    /**
     * Serialize for saving
     */
    toJSON() {
        return {
            leads: Array.from(this.leads.values()).map(l => l.toJSON()),
            sources: Array.from(this.sources.values()).map(s => s.toJSON()),
            nextLeadId: this.nextLeadId
        };
    }

    /**
     * Load from saved data
     */
    loadFromJSON(data, sourceConfigs) {
        // Restore sources from configs
        for (const config of sourceConfigs) {
            const source = new LeadSource(config);
            // Restore unlock state
            const savedSource = data.sources?.find(s => s.id === config.id);
            if (savedSource) {
                source.unlocked = savedSource.unlocked;
            }
            this.sources.set(source.id, source);
        }

        // Restore leads
        this.leads.clear();
        for (const leadData of data.leads || []) {
            const lead = Lead.fromJSON(leadData);
            this.leads.set(lead.id, lead);
        }

        this.nextLeadId = data.nextLeadId || this.leads.size + 1;
    }
}

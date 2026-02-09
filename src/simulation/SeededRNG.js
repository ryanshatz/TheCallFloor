/**
 * Seeded Random Number Generator
 * Uses mulberry32 algorithm for reproducible randomness.
 * Essential for deterministic simulation and debugging.
 */
export class SeededRNG {
    /**
     * @param {number} seed - Initial seed value
     */
    constructor(seed = Date.now()) {
        this.seed = seed;
        this.state = seed;
    }

    /**
     * Generate next random number between 0 and 1
     * @returns {number} Random float [0, 1)
     */
    random() {
        // Mulberry32 algorithm
        let t = this.state += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    /**
     * Generate random integer in range [min, max] inclusive
     * @param {number} min 
     * @param {number} max 
     * @returns {number}
     */
    randomInt(min, max) {
        return Math.floor(this.random() * (max - min + 1)) + min;
    }

    /**
     * Generate random float in range [min, max)
     * @param {number} min 
     * @param {number} max 
     * @returns {number}
     */
    randomFloat(min, max) {
        return this.random() * (max - min) + min;
    }

    /**
     * Returns true with the given probability
     * @param {number} probability - Value between 0 and 1
     * @returns {boolean}
     */
    chance(probability) {
        return this.random() < probability;
    }

    /**
     * Pick a random element from array
     * @param {Array} array 
     * @returns {*}
     */
    pick(array) {
        if (!array || array.length === 0) return null;
        return array[this.randomInt(0, array.length - 1)];
    }

    /**
     * Shuffle array in place using Fisher-Yates
     * @param {Array} array 
     * @returns {Array}
     */
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = this.randomInt(0, i);
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Generate a value with normal distribution
     * Uses Box-Muller transform
     * @param {number} mean 
     * @param {number} stdDev 
     * @returns {number}
     */
    gaussian(mean = 0, stdDev = 1) {
        const u1 = this.random();
        const u2 = this.random();
        const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        return z0 * stdDev + mean;
    }

    /**
     * Reset to initial seed state
     */
    reset() {
        this.state = this.seed;
    }

    /**
     * Set new seed
     * @param {number} seed 
     */
    setSeed(seed) {
        this.seed = seed;
        this.state = seed;
    }
}

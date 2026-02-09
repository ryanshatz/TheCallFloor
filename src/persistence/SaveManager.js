/**
 * Save Manager
 * Handles persistence to localStorage.
 */

const SAVE_KEY = 'callCenterTycoon_save';
const SAVE_VERSION = 1;

export class SaveManager {
    constructor(gameState) {
        this.state = gameState;
    }

    save() {
        try {
            const saveData = this.state.toJSON();
            saveData.savedAt = Date.now();
            localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
            return true;
        } catch (e) {
            console.error('Failed to save game:', e);
            return false;
        }
    }

    load(configs) {
        try {
            const data = localStorage.getItem(SAVE_KEY);
            if (!data) return false;

            const saveData = JSON.parse(data);
            if (saveData.version !== SAVE_VERSION) {
                console.warn('Save version mismatch, may need migration');
            }

            this.state.loadFromJSON(saveData, configs);
            return true;
        } catch (e) {
            console.error('Failed to load game:', e);
            return false;
        }
    }

    hasSave() {
        return localStorage.getItem(SAVE_KEY) !== null;
    }

    deleteSave() {
        localStorage.removeItem(SAVE_KEY);
    }

    exportSave() {
        const saveData = this.state.toJSON();
        return btoa(JSON.stringify(saveData));
    }

    importSave(encoded, configs) {
        try {
            const saveData = JSON.parse(atob(encoded));
            this.state.loadFromJSON(saveData, configs);
            return true;
        } catch (e) {
            console.error('Failed to import save:', e);
            return false;
        }
    }
}

/**
 * Local Storage Service & Initial Data Loader
 */
window.StorageService = {
    keys: window.BAR_CONFIG.STORAGE_KEYS,

    getIngredients() {
        try {
            return JSON.parse(localStorage.getItem(this.keys.INGREDIENTS) || '[]');
        } catch (e) {
            console.error('Failed to parse ingredients from localStorage', e);
            return [];
        }
    },

    setIngredients(data) {
        localStorage.setItem(this.keys.INGREDIENTS, JSON.stringify(data || []));
    },

    getRecipes() {
        try {
            return JSON.parse(localStorage.getItem(this.keys.RECIPES) || '[]');
        } catch (e) {
            console.error('Failed to parse recipes from localStorage', e);
            return [];
        }
    },

    setRecipes(data) {
        localStorage.setItem(this.keys.RECIPES, JSON.stringify(data || []));
    },

    getOrders() {
        try {
            return JSON.parse(localStorage.getItem(this.keys.ORDERS) || '[]');
        } catch (e) {
            console.error('Failed to parse orders from localStorage', e);
            return [];
        }
    },

    setOrders(data) {
        localStorage.setItem(this.keys.ORDERS, JSON.stringify(data || []));
    },

    getAudits() {
        try {
            return JSON.parse(localStorage.getItem(this.keys.AUDITS) || '[]');
        } catch (e) {
            console.error('Failed to parse audits from localStorage', e);
            return [];
        }
    },

    setAudits(data) {
        localStorage.setItem(this.keys.AUDITS, JSON.stringify(data || []));
    },

    getGhConfig() {
        return {
            username: localStorage.getItem(this.keys.GH_USER) || window.BAR_CONFIG.DEFAULTS.GH_USER,
            repo: localStorage.getItem(this.keys.GH_REPO) || window.BAR_CONFIG.DEFAULTS.GH_REPO,
            token: localStorage.getItem(this.keys.GH_TOKEN) || ''
        };
    },

    setGhConfig(config) {
        if (config.username) localStorage.setItem(this.keys.GH_USER, config.username);
        if (config.repo) localStorage.setItem(this.keys.GH_REPO, config.repo);
        if (config.token !== undefined) localStorage.setItem(this.keys.GH_TOKEN, config.token);
    },

    /**
     * Seeds initial data from local data.json if local storage is empty
     */
    async seedFromLocalFile() {
        try {
            const res = await fetch('./data.json');
            if (res.ok) {
                const data = await res.json();
                return {
                    ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
                    recipes: Array.isArray(data.recipes) ? data.recipes : [],
                    orders: Array.isArray(data.orders) ? data.orders : [],
                    audits: Array.isArray(data.audits) ? data.audits : []
                };
            }
        } catch (e) {
            console.warn('Could not load seed data from ./data.json:', e);
        }
        return null;
    }
};

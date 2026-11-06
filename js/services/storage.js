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

    getLastSha() {
        return localStorage.getItem(this.keys.SYNC_SHA) || '';
    },

    setLastSha(sha) {
        if (sha) localStorage.setItem(this.keys.SYNC_SHA, sha);
    },

    isDirty() {
        return localStorage.getItem(this.keys.SYNC_DIRTY) === '1';
    },

    setDirty(dirty) {
        localStorage.setItem(this.keys.SYNC_DIRTY, dirty ? '1' : '0');
    },

    getDeletedIds() {
        try {
            const parsed = JSON.parse(localStorage.getItem(this.keys.DELETED_IDS) || '{}');
            return {
                ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
                recipes: Array.isArray(parsed.recipes) ? parsed.recipes : [],
                orders: Array.isArray(parsed.orders) ? parsed.orders : [],
                audits: Array.isArray(parsed.audits) ? parsed.audits : []
            };
        } catch (e) {
            return { ingredients: [], recipes: [], orders: [], audits: [] };
        }
    },

    markDeleted(collection, id) {
        if (!collection || !id) return;
        const deleted = this.getDeletedIds();
        if (Array.isArray(deleted[collection]) && !deleted[collection].includes(id)) {
            deleted[collection].push(id);
            localStorage.setItem(this.keys.DELETED_IDS, JSON.stringify(deleted));
        }
    },

    clearDeletedIds() {
        localStorage.removeItem(this.keys.DELETED_IDS);
    },

    getDirtyIngIds() {
        try {
            const arr = JSON.parse(localStorage.getItem(this.keys.DIRTY_ING_IDS) || '[]');
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    },

    markDirtyIng(ids) {
        const list = Array.isArray(ids) ? ids : [ids];
        const set = new Set(this.getDirtyIngIds());
        for (let i = 0; i < list.length; i++) {
            if (list[i]) set.add(list[i]);
        }
        localStorage.setItem(this.keys.DIRTY_ING_IDS, JSON.stringify(Array.from(set)));
    },

    clearDirtyIngIds() {
        localStorage.removeItem(this.keys.DIRTY_ING_IDS);
    },

    /**
     * Deterministic union-by-id merge with tombstone filtering and session-dirty ingredient priority.
     */
    mergeCollections(local, remote, deletedIds, dirtyIngIds) {
        const del = deletedIds || this.getDeletedIds();
        const dirtyIngSet = new Set(dirtyIngIds || this.getDirtyIngIds());

        const mergeList = (localArr = [], remoteArr = [], delList = [], isIngredients = false, newestFirst = false) => {
            const delSet = new Set(delList);
            const localMap = new Map();
            const remoteMap = new Map();

            for (let i = 0; i < localArr.length; i++) {
                const item = localArr[i];
                if (item && item.id && !delSet.has(item.id)) localMap.set(item.id, item);
            }
            for (let i = 0; i < remoteArr.length; i++) {
                const item = remoteArr[i];
                if (item && item.id && !delSet.has(item.id)) remoteMap.set(item.id, item);
            }

            const result = [];
            const seen = new Set();

            if (newestFirst) {
                for (const [id, lItem] of localMap.entries()) {
                    result.push(lItem);
                    seen.add(id);
                }
                for (const [id, rItem] of remoteMap.entries()) {
                    if (!seen.has(id)) {
                        result.push(rItem);
                        seen.add(id);
                    }
                }
            } else {
                for (const [id, rItem] of remoteMap.entries()) {
                    if (localMap.has(id) && (!isIngredients || dirtyIngSet.has(id))) {
                        result.push(localMap.get(id));
                    } else {
                        result.push(rItem);
                    }
                    seen.add(id);
                }
                for (const [id, lItem] of localMap.entries()) {
                    if (!seen.has(id)) {
                        result.push(lItem);
                        seen.add(id);
                    }
                }
            }
            return result;
        };

        return {
            ingredients: mergeList(local.ingredients, remote.ingredients, del.ingredients, true, false),
            recipes: mergeList(local.recipes, remote.recipes, del.recipes, false, false),
            orders: mergeList(local.orders, remote.orders, del.orders, false, true),
            audits: mergeList(local.audits, remote.audits, del.audits, false, true)
        };
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

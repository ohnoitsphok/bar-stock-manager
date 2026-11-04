/**
 * Inventory Module - Optimized with O(1) Lookup Map & Memoized Sorting/Valuation
 */
window.InventoryModule = {
    // Initial Form & Filter State
    searchQuery: '',
    editingId: null,
    showMobileForm: false,
    groupByCategory: false,
    sortBy: 'name',
    sortOrder: 'asc',
    form: window.BAR_CONFIG.createDefaultIngredientForm(),

    // Internal non-DOM caches
    _ingMapCache: null,
    _ingMapKey: '',
    _summaryCache: null,
    _summaryKey: '',
    _baseSortedCache: null,
    _baseSortedKey: '',
    _sortedCache: null,
    _sortedKey: '',
    _searchMatchCache: null,
    _searchMatchKey: '',

    /**
     * Pre-sorted base array cached by version + sorting criteria.
     * Only re-sorted when ingredients, sorting order, or category grouping changes.
     */
    get baseSortedIngredients() {
        const list = Array.isArray(this.ingredients) ? this.ingredients : [];
        const group = Boolean(this.groupByCategory);
        const sortBy = this.sortBy || 'name';
        const sortOrder = this.sortOrder || 'asc';

        const baseKey = `${this._ingVersion || 0}|${list.length}|${group}|${sortBy}|${sortOrder}`;
        if (this._baseSortedCache && this._baseSortedKey === baseKey) {
            return this._baseSortedCache;
        }

        const dir = sortOrder === 'asc' ? 1 : -1;
        const decorated = new Array(list.length);

        for (let i = 0; i < list.length; i++) {
            const item = list[i] || {};
            const nameLower = (item.name || '').toLowerCase();
            const catRaw = item.category || 'Uncategorized';
            const catLower = catRaw.toLowerCase();

            let numVal = 0;
            if (sortBy === 'stock') {
                numVal = Number(item.stock || 0);
            } else if (sortBy === 'price') {
                numVal = Number(item.price || 0);
            } else if (sortBy === 'value') {
                numVal = Number(item.stock || 0) * Number(item.price || 0);
            }

            decorated[i] = {
                item,
                id: item.id,
                nameLower,
                catRaw,
                catLower,
                numVal
            };
        }

        // Fast string comparison avoids expensive localeCompare collation object overhead
        decorated.sort((a, b) => {
            if (group && a.catRaw !== b.catRaw) {
                return a.catRaw < b.catRaw ? -1 : (a.catRaw > b.catRaw ? 1 : 0);
            }
            if (sortBy === 'name') {
                if (a.nameLower === b.nameLower) return 0;
                return dir * (a.nameLower < b.nameLower ? -1 : 1);
            }
            return dir * (a.numVal - b.numVal);
        });

        this._baseSortedCache = decorated;
        this._baseSortedKey = baseKey;
        return decorated;
    },

    /**
     * Stable sorted list of ingredients for the table DOM.
     * Crucial: Does NOT change when searching, preventing costly DOM row teardown/rebuild!
     */
    get sortedIngredients() {
        const base = this.baseSortedIngredients;
        const key = `${this._ingVersion || 0}|${base.length}|${this.groupByCategory}|${this.sortBy}|${this.sortOrder}`;
        if (this._sortedCache && this._sortedKey === key) {
            return this._sortedCache;
        }

        const result = new Array(base.length);
        for (let i = 0; i < base.length; i++) {
            result[i] = base[i].item;
        }

        this._sortedCache = result;
        this._sortedKey = key;
        return result;
    },

    /**
     * Instantaneous O(1) visibility filter using pre-indexed lower-case search targets.
     * Replaces destructive x-for diffing with instant CSS display toggling.
     */
    get searchMatchingIds() {
        const q = (this.searchQuery || '').toLowerCase().trim();
        if (!q) return null;

        const key = `${this._ingVersion || 0}|${this.ingredients.length}|${q}`;
        if (this._searchMatchCache && this._searchMatchKey === key) {
            return this._searchMatchCache;
        }

        const set = new Set();
        const base = this.baseSortedIngredients;
        for (let i = 0; i < base.length; i++) {
            const entry = base[i];
            if (entry.nameLower.includes(q) || entry.catLower.includes(q)) {
                set.add(entry.id);
            }
        }

        this._searchMatchCache = set;
        this._searchMatchKey = key;
        return set;
    },

    isItemVisible(id) {
        if (!this.searchQuery || !this.searchQuery.trim()) return true;
        const matches = this.searchMatchingIds;
        return matches ? matches.has(id) : true;
    },

    /**
     * O(1) Ingredient Lookup Map cached by version + array length
     */
    get ingredientMap() {
        const list = Array.isArray(this.ingredients) ? this.ingredients : [];
        const key = `${this._ingVersion || 0}_${list.length}`;
        if (this._ingMapCache && this._ingMapKey === key) {
            return this._ingMapCache;
        }
        const map = new Map();
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (item && item.id !== undefined) {
                map.set(item.id, item);
            }
        }
        this._ingMapCache = map;
        this._ingMapKey = key;
        return map;
    },

    getIngredientById(id) {
        return this.ingredientMap.get(id) || null;
    },

    /**
     * Single-pass memoized summary for KPI cards (lowStockCount + totalInventoryValue)
     */
    get inventorySummary() {
        const list = Array.isArray(this.ingredients) ? this.ingredients : [];
        const key = `${this._ingVersion || 0}_${list.length}`;
        if (this._summaryCache && this._summaryKey === key) {
            return this._summaryCache;
        }

        let lowStockCount = 0;
        let totalInventoryValue = 0;

        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (!item) continue;
            const stock = Number(item.stock || 0);
            const par = Number(item.par || 0);
            const price = Number(item.price || 0);

            if (stock <= par) lowStockCount++;
            totalInventoryValue += stock * price;
        }

        this._summaryCache = { lowStockCount, totalInventoryValue };
        this._summaryKey = key;
        return this._summaryCache;
    },

    get lowStockCount() {
        return this.inventorySummary.lowStockCount;
    },

    get totalInventoryValue() {
        return this.inventorySummary.totalInventoryValue;
    },


    // Methods
    saveIngredient() {
        if (!this.form.name || !this.form.name.trim()) {
            return alert('Please enter an ingredient name.');
        }

        if (this.editingId) {
            const idx = this.ingredients.findIndex(i => i.id === this.editingId);
            if (idx !== -1) {
                this.ingredients[idx] = { ...this.form, id: this.editingId };
            }
        } else {
            const newId = Date.now().toString();
            this.ingredients.push({ ...this.form, id: newId });
        }

        this.resetForm();
        this.persist('ingredients');
    },

    editItem(item) {
        this.editingId = item.id;
        this.form = { ...item };
    },

    deleteItem(id) {
        if (confirm('Delete this ingredient?')) {
            this.ingredients = this.ingredients.filter(i => i.id !== id);
            if (this.editingId === id) this.resetForm();
            this.persist('ingredients');
        }
    },

    adjustStock(id, delta) {
        const item = this.getIngredientById(id);
        if (item) {
            item.stock = Math.max(0, Number(((item.stock || 0) + delta).toFixed(1)));
            this.persist('ingredients');
        }
    },

    resetForm() {
        this.editingId = null;
        this.form = window.BAR_CONFIG.createDefaultIngredientForm();
    },

    getIngredientName(id) {
        const ing = this.getIngredientById(id);
        return ing ? ing.name : 'Unknown';
    },

    getIngredientUnit(id) {
        const ing = this.getIngredientById(id);
        return ing ? (ing.volume_unit || 'ml') : 'ml';
    },

    // Export Actions
    exportInventoryXlsx() {
        const sheetData = window.ExportService.buildInventorySheet(this.ingredients);
        const filename = `Strelitzia_Inventory_${new Date().toISOString().slice(0, 10)}.xlsx`;
        window.ExportService.exportToXLSX(filename, {
            'Inventory': sheetData
        });
    },

    exportInventoryCsv() {
        const sheetData = window.ExportService.buildInventorySheet(this.ingredients);
        const filename = `Strelitzia_Inventory_${new Date().toISOString().slice(0, 10)}.csv`;
        window.ExportService.exportToCSV(filename, sheetData[0], sheetData.slice(1));
    },

    async copyInventoryToClipboard() {
        const sheetData = window.ExportService.buildInventorySheet(this.ingredients);
        await window.ExportService.copyToClipboard(sheetData[0], sheetData.slice(1));
    }
};

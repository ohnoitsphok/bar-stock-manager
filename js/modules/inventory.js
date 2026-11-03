/**
 * Inventory Module - Optimized with O(1) Lookup Map & Memoized Sorting/Valuation
 */
window.InventoryModule = {
    // Initial Form & Filter State
    searchQuery: '',
    editingId: null,
    groupByCategory: false,
    sortBy: 'name',
    sortOrder: 'asc',
    form: window.BAR_CONFIG.createDefaultIngredientForm(),

    // Internal non-DOM caches
    _ingMapCache: null,
    _ingMapKey: '',
    _summaryCache: null,
    _summaryKey: '',
    _sortedCache: null,
    _sortedKey: '',

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

    /**
     * Memoized & pre-indexed (Schwartzian transform) ingredient sorting
     */
    get sortedIngredients() {
        const list = Array.isArray(this.ingredients) ? this.ingredients : [];
        const q = (this.searchQuery || '').toLowerCase().trim();
        const group = Boolean(this.groupByCategory);
        const sortBy = this.sortBy || 'name';
        const sortOrder = this.sortOrder || 'asc';

        const cacheKey = `${this._ingVersion || 0}|${list.length}|${q}|${group}|${sortBy}|${sortOrder}`;
        if (this._sortedCache && this._sortedKey === cacheKey) {
            return this._sortedCache;
        }

        const dir = sortOrder === 'asc' ? 1 : -1;
        const decorated = [];

        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (!item) continue;
            const nameLower = (item.name || '').toLowerCase();
            const catRaw = item.category || 'Uncategorized';
            const catLower = catRaw.toLowerCase();

            if (q && !nameLower.includes(q) && !catLower.includes(q)) {
                continue;
            }

            let numVal = 0;
            if (sortBy === 'stock') {
                numVal = Number(item.stock || 0);
            } else if (sortBy === 'price') {
                numVal = Number(item.price || 0);
            } else if (sortBy === 'value') {
                numVal = Number(item.stock || 0) * Number(item.price || 0);
            }

            decorated.push({
                item,
                nameLower,
                catRaw,
                numVal
            });
        }

        decorated.sort((a, b) => {
            if (group && a.catRaw !== b.catRaw) {
                return a.catRaw.localeCompare(b.catRaw);
            }
            if (sortBy === 'name') {
                return dir * a.nameLower.localeCompare(b.nameLower);
            }
            return dir * (a.numVal - b.numVal);
        });

        const result = new Array(decorated.length);
        for (let i = 0; i < decorated.length; i++) {
            result[i] = decorated[i].item;
        }

        this._sortedCache = result;
        this._sortedKey = cacheKey;
        return result;
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

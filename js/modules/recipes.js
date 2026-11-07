/**
 * Recipes Module - Optimized with O(1) Ingredient Lookups & Memoized Recipe Costing
 */
window.RecipeModule = {
    editingRecipeId: null,
    recipeSearchQuery: '',
    recipeFilterQuery: '',
    recipeCategoryFilter: 'All',
    recipeDropdownOpen: false,
    recipeForm: window.BAR_CONFIG.createDefaultRecipeForm(),
    tempRecipeIngId: '',
    tempRecipeAmount: 50,

    // Internal caches
    _recipeFilterCache: null,
    _recipeFilterKey: '',
    _recipeMetricsMap: null,
    _recipeMetricsKey: '',

    get filteredRecipeIngredients() {
        const base = this.baseSortedIngredients;
        const rawQ = (this.recipeSearchQuery || '').toLowerCase().trim();
        const q = rawQ.includes('(') ? rawQ.split('(')[0].trim() : rawQ;
        const key = `${this._ingVersion || 0}|${base ? base.length : (this.ingredients || []).length}|${q}`;
        if (this._recipeFilterCache && this._recipeFilterKey === key) {
            return this._recipeFilterCache;
        }

        const limit = window.BAR_CONFIG?.DEFAULTS?.COMBOBOX_MAX_RESULTS || 15;
        const res = [];
        if (base && base.length > 0) {
            for (let i = 0; i < base.length && res.length < limit; i++) {
                const entry = base[i];
                if (!q || entry.nameLower.includes(q) || entry.catLower.includes(q)) {
                    res.push(entry.item);
                }
            }
        } else {
            const list = Array.isArray(this.ingredients) ? this.ingredients : [];
            for (let i = 0; i < list.length && res.length < limit; i++) {
                const ing = list[i];
                if (!ing) continue;
                if (!q || (ing.name || '').toLowerCase().includes(q) || (ing.category || '').toLowerCase().includes(q)) {
                    res.push(ing);
                }
            }
        }

        this._recipeFilterCache = res;
        this._recipeFilterKey = key;
        return res;
    },

    selectRecipeIngredient(ing) {
        this.tempRecipeIngId = ing.id;
        this.recipeSearchQuery = `${ing.name} (${ing.volume_unit || 'ml'})`;
        this.recipeDropdownOpen = false;
    },

    addRecipeItem() {
        const query = (this.recipeSearchQuery || '').trim();
        if (!query) return;

        if (!this.tempRecipeIngId && this.filteredRecipeIngredients.length > 0) {
            this.tempRecipeIngId = this.filteredRecipeIngredients[0].id;
        }
        if (!this.tempRecipeIngId || !this.tempRecipeAmount || this.tempRecipeAmount <= 0) return;

        this.recipeForm.items.push({
            ingredient_id: this.tempRecipeIngId,
            amount: Number(this.tempRecipeAmount)
        });

        this.tempRecipeIngId = '';
        this.recipeSearchQuery = '';
        this.tempRecipeAmount = 50;
    },

    startEditRecipe(recipe) {
        if (!recipe) return;
        this.editingRecipeId = recipe.id;
        this.recipeForm = {
            name: recipe.name || '',
            category: recipe.category || '',
            selling_price: Number(recipe.selling_price || recipe.price || 0),
            items: (recipe.items || []).map(item => ({ ...item }))
        };
    },

    cancelEditRecipe() {
        this.editingRecipeId = null;
        this.recipeForm = window.BAR_CONFIG.createDefaultRecipeForm();
    },

    get displayRecipes() {
        const list = Array.isArray(this.recipes) ? this.recipes : [];
        const q = (this.recipeFilterQuery || '').toLowerCase().trim();
        const cat = this.recipeCategoryFilter || 'All';

        if (!q && cat === 'All') return list;

        return list.filter(r => {
            const matchCat = cat === 'All' || r.category === cat;
            const matchQ = !q || (r.name || '').toLowerCase().includes(q) || (r.items || []).some(ri => {
                const ing = this.getIngredientById ? this.getIngredientById(ri.ingredient_id) : null;
                return ing && (ing.name || '').toLowerCase().includes(q);
            });
            return matchCat && matchQ;
        });
    },

    saveRecipe() {
        if (!this.recipeForm.name || !this.recipeForm.name.trim()) {
            return this.notify ? this.notify('Please enter a cocktail recipe name.', 'warning') : alert('Please enter a cocktail recipe name.');
        }
        if (!this.recipeForm.items || this.recipeForm.items.length === 0) {
            return this.notify ? this.notify('Please add at least one ingredient to the recipe.', 'warning') : alert('Please add at least one ingredient to the recipe.');
        }

        const sellPrice = Number(this.recipeForm.selling_price || this.recipeForm.price || 0);
        const payload = {
            name: this.recipeForm.name.trim(),
            category: (this.recipeForm.category || 'Cocktail').trim(),
            selling_price: sellPrice,
            items: this.recipeForm.items
        };

        if (this.editingRecipeId) {
            const idx = this.recipes.findIndex(r => r.id === this.editingRecipeId);
            if (idx !== -1) {
                this.recipes[idx] = { ...payload, id: this.editingRecipeId };
            }
            this.editingRecipeId = null;
            if (this.notify) this.notify('Cocktail recipe updated', 'success');
        } else {
            this.recipes.push({
                ...payload,
                id: Date.now().toString()
            });
            if (this.notify) this.notify('New cocktail added to menu', 'success');
        }

        this.recipeForm = window.BAR_CONFIG.createDefaultRecipeForm();
        this.persist('recipes');
    },

    deleteRecipe(id) {
        if (confirm('Delete this recipe?')) {
            this.recipes = this.recipes.filter(r => r.id !== id);
            window.StorageService.markDeleted('recipes', id);
            if (this.editingRecipeId === id) this.cancelEditRecipe();
            this.persist('recipes');
            if (this.notify) this.notify('Cocktail recipe removed', 'info');
        }
    },

    calcRecipeItemCost(ri) {
        if (!ri) return 0;
        const ing = this.getIngredientById ? this.getIngredientById(ri.ingredient_id) : this.ingredients.find(i => i.id === ri.ingredient_id);
        if (!ing || !ing.unit_volume || Number(ing.unit_volume) <= 0) return 0;
        const costPerUnit = Number(ing.price || 0) / Number(ing.unit_volume);
        return costPerUnit * Number(ri.amount || 0);
    },

    /**
     * Memoized per-recipe metrics (totalCost & pourCostPct) keyed by data versions
     */
    getRecipeMetrics(recipe) {
        if (!recipe || !Array.isArray(recipe.items)) {
            return { totalCost: 0, pourCostPct: '0.0', pourCostNum: 0 };
        }

        const stateKey = `${this._ingVersion || 0}_${this._recipeVersion || 0}_${(this.ingredients || []).length}_${(this.recipes || []).length}`;
        if (this._recipeMetricsKey !== stateKey || !this._recipeMetricsMap) {
            this._recipeMetricsMap = new Map();
            this._recipeMetricsKey = stateKey;
        }

        if (recipe.id && this._recipeMetricsMap.has(recipe.id)) {
            return this._recipeMetricsMap.get(recipe.id);
        }

        let totalCost = 0;
        const items = recipe.items;
        for (let i = 0; i < items.length; i++) {
            totalCost += this.calcRecipeItemCost(items[i]);
        }

        const sellPrice = Number(recipe.selling_price || recipe.price || 0);
        const pourCostNum = sellPrice > 0 ? (totalCost / sellPrice) * 100 : 0;
        const pourCostPct = sellPrice > 0 ? pourCostNum.toFixed(1) : '0';

        const metrics = { totalCost, pourCostPct, pourCostNum };
        if (recipe.id) {
            this._recipeMetricsMap.set(recipe.id, metrics);
        }
        return metrics;
    },

    calcRecipeTotalCost(recipe) {
        return this.getRecipeMetrics(recipe).totalCost;
    },

    calcPourCostPct(recipe) {
        return this.getRecipeMetrics(recipe).pourCostPct;
    },

    // Export Actions
    exportRecipesXlsx() {
        const sheetData = window.ExportService.buildRecipesSheet(this.recipes, this.ingredients, this.ingredientMap);
        const filename = `Strelitzia_Recipes_${new Date().toISOString().slice(0, 10)}.xlsx`;
        window.ExportService.exportToXLSX(filename, {
            'Cocktail Recipes': sheetData
        });
    },

    exportRecipesCsv() {
        const sheetData = window.ExportService.buildRecipesSheet(this.recipes, this.ingredients, this.ingredientMap);
        const filename = `Strelitzia_Recipes_${new Date().toISOString().slice(0, 10)}.csv`;
        window.ExportService.exportToCSV(filename, sheetData[0], sheetData.slice(1));
    },

    async copyRecipesToClipboard() {
        const sheetData = window.ExportService.buildRecipesSheet(this.recipes, this.ingredients, this.ingredientMap);
        await window.ExportService.copyToClipboard(sheetData[0], sheetData.slice(1));
    }
};

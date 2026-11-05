/**
 * Main Application Orchestrator & Alpine Component Definition
 */
function barApp() {
    const appState = {
        // Navigation & Global UI State
        activeTab: 'inventory', // 'inventory' | 'reports' | 'recipes' | 'settings'
        syncStatus: 'Running locally (Not synced yet)',
        ghConfig: window.StorageService.getGhConfig(),
        ingredients: window.StorageService.getIngredients(),
        recipes: window.StorageService.getRecipes(),
        orders: window.StorageService.getOrders(),
        audits: window.StorageService.getAudits(),

        // Reactive version counters for O(1) cache invalidation
        _ingVersion: 0,
        _recipeVersion: 0,
        _orderVersion: 0,
        _auditVersion: 0,
        _debouncedPush: null,

        // Non-blocking in-app toasts
        toasts: [],
        notify(message, type = 'success', timeout = 3200) {
            const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
            this.toasts.push({ id, message, type });
            setTimeout(() => {
                this.toasts = this.toasts.filter(t => t.id !== id);
            }, timeout);
        },

        async initApp() {
            // Listen for decoupled notification events
            window.addEventListener('bar-toast', (e) => {
                if (e.detail && e.detail.message) {
                    this.notify(e.detail.message, e.detail.type || 'success');
                }
            });

            // 1. Initial fallback: if storage is empty, seed from local data.json
            if (this.ingredients.length === 0 && this.recipes.length === 0) {
                const seed = await window.StorageService.seedFromLocalFile();
                if (seed && seed.ingredients.length > 0) {
                    this.ingredients = seed.ingredients;
                    this.recipes = seed.recipes;
                    this.orders = seed.orders;
                    this.audits = seed.audits || [];
                    this._ingVersion++;
                    this._recipeVersion++;
                    this._orderVersion++;
                    this._auditVersion++;
                    window.StorageService.setIngredients(this.ingredients);
                    window.StorageService.setRecipes(this.recipes);
                    window.StorageService.setOrders(this.orders);
                    window.StorageService.setAudits(this.audits);
                    this.syncStatus = 'Loaded initial data from local data.json';
                }
            }

            // 2. Setup debounced push to GitHub to prevent concurrent race conditions
            this._debouncedPush = window.BarUtils.debounce(async () => {
                await this.syncToGitHub(true);
            }, window.BAR_CONFIG.DEFAULTS.DEBOUNCE_SYNC_MS);

            // 3. Remote sync if configured
            if (this.ghConfig.token && this.ghConfig.username) {
                await this.syncFromGitHub();
            }
        },

        /**
         * Targeted persistence: only serializes modified collections to localStorage
         * and bumps reactive version counters to invalidate affected memoized getters.
         * @param {'all'|'ingredients'|'recipes'|'orders'|'audits'} scope
         */
        persist(scope = 'all') {
            if (scope === 'all' || scope === 'ingredients' || scope === 'orders' || scope === 'audits') {
                this._ingVersion++;
                window.StorageService.setIngredients(this.ingredients);
            }
            if (scope === 'all' || scope === 'recipes') {
                this._recipeVersion++;
                window.StorageService.setRecipes(this.recipes);
            }
            if (scope === 'all' || scope === 'orders') {
                this._orderVersion++;
                window.StorageService.setOrders(this.orders);
            }
            if (scope === 'all' || scope === 'audits') {
                this._auditVersion++;
                window.StorageService.setAudits(this.audits);
            }

            if (this.ghConfig.token) {
                this.syncStatus = 'Pending cloud sync...';
                if (this._debouncedPush) {
                    this._debouncedPush();
                } else {
                    this.syncToGitHub(true);
                }
            }
        },

        async syncToGitHub(silent = false) {
            if (!this.ghConfig.token || !this.ghConfig.username || !this.ghConfig.repo) {
                if (!silent) this.notify('Please fill in GitHub username, repo name, and Token.', 'warning');
                return;
            }
            window.StorageService.setGhConfig(this.ghConfig);

            this.syncStatus = 'Syncing to GitHub...';
            try {
                await window.GitHubSyncService.push(this.ghConfig, {
                    ingredients: this.ingredients,
                    recipes: this.recipes,
                    orders: this.orders,
                    audits: this.audits
                });
                this.syncStatus = 'Synced with GitHub';
                if (!silent) this.notify('Synced successfully with GitHub', 'success');
            } catch (err) {
                this.syncStatus = 'Sync failed';
                if (!silent) this.notify('GitHub Error: ' + (err.message || 'Check console'), 'error');
                console.error('GitHub Push Error:', err);
            }
        },

        async syncFromGitHub(silent = false) {
            if (!this.ghConfig.token || !this.ghConfig.username || !this.ghConfig.repo) return;
            this.syncStatus = 'Pulling from GitHub...';
            try {
                const remote = await window.GitHubSyncService.pull(this.ghConfig);
                this.ingredients = remote.ingredients;
                this.recipes = remote.recipes;
                this.orders = remote.orders;
                this.audits = remote.audits || [];
                this._ingVersion++;
                this._recipeVersion++;
                this._orderVersion++;
                this._auditVersion++;
                window.StorageService.setIngredients(this.ingredients);
                window.StorageService.setRecipes(this.recipes);
                window.StorageService.setOrders(this.orders);
                window.StorageService.setAudits(this.audits);
                this.syncStatus = 'Synced with GitHub';
                if (!silent) this.notify('Pulled latest data from GitHub', 'success');
            } catch (err) {
                this.syncStatus = 'Pull failed';
                if (!silent) this.notify('GitHub Pull Error: ' + (err.message || 'Check console'), 'error');
                console.error('GitHub Pull Error:', err);
            }
        },

        formatCurrency(val, decimals = 0) {
            return window.BarUtils.formatCurrency(val, decimals);
        },

        formatMonthLabel(yearMonthStr) {
            return window.BarUtils.formatMonthLabel(yearMonthStr);
        },

        exportFullWorkbookXlsx() {
            const filename = `Strelitzia_Complete_Bar_Manager_${new Date().toISOString().slice(0, 10)}.xlsx`;
            const map = this.ingredientMap;
            
            const inventorySheet = window.ExportService.buildInventorySheet(this.ingredients);
            const recipesSheet = window.ExportService.buildRecipesSheet(this.recipes, this.ingredients, map);
            const ordersSheet = window.ExportService.buildOrdersSheet(this.orders, this.ingredients, map);

            // Active month report sheet
            const activeMonth = this.activeReportMonth || window.BarUtils.parseYearMonth(new Date());
            const monthLabel = window.BarUtils.formatMonthLabel(activeMonth);
            const summary = {
                importCost: this.monthlyImportTotal,
                usageValue: this.monthlyUsageTotal,
                netVariance: (this.monthlyAuditsList || []).reduce((sum, a) => {
                    return sum + (this.getAuditNetVariance ? this.getAuditNetVariance(a) : (a.items || []).reduce((s, i) => s + Number(i.variance || 0), 0));
                }, 0)
            };
            const monthlySheet = window.ExportService.buildMonthlyReportSheet(
                monthLabel,
                summary,
                this.mostUsedIngredients,
                this.monthlyImportsList,
                this.monthlyAuditsList
            );

            window.ExportService.exportToXLSX(filename, {
                'Inventory': inventorySheet,
                'Cocktail Recipes': recipesSheet,
                'Purchase Orders': ordersSheet,
                'Monthly Analytics': monthlySheet
            });
        }
    };

    // Compose module slices while preserving getters and prototype methods
    const modules = [
        window.InventoryModule,
        window.RecipeModule,
        window.OrderModule,
        window.AuditModule,
        window.AnalyticsModule
    ];

    for (const mod of modules) {
        Object.defineProperties(appState, Object.getOwnPropertyDescriptors(mod));
    }

    return appState;
}

// Attach globally for Alpine x-data="barApp()"
window.barApp = barApp;

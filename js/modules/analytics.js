/**
 * Analytics Module - Optimized with O(1) Audit Indexing & Unified Monthly Snapshot Cache
 */
window.AnalyticsModule = {
    selectedReportMonth: '',
    leaderboardMode: 'value', // 'value' | 'volume'
    reportsActiveSubTab: 'analytics', // 'analytics' | 'orders'

    // Internal caches
    _monthsCache: null,
    _monthsCacheKey: '',
    _snapshotCache: null,
    _snapshotCacheKey: '',

    get availableReportMonths() {
        const orders = Array.isArray(this.orders) ? this.orders : [];
        const audits = Array.isArray(this.audits) ? this.audits : [];
        const key = `${this._orderVersion || 0}_${this._auditVersion || 0}_${orders.length}_${audits.length}`;

        if (this._monthsCache && this._monthsCacheKey === key) {
            return this._monthsCache;
        }

        const monthsSet = new Set();

        for (let i = 0; i < orders.length; i++) {
            const ym = window.BarUtils.parseYearMonth(orders[i]?.date);
            if (ym) monthsSet.add(ym);
        }

        for (let i = 0; i < audits.length; i++) {
            const a = audits[i];
            const ym = a?.month || window.BarUtils.parseYearMonth(a?.date);
            if (ym) monthsSet.add(ym);
        }

        monthsSet.add(window.BarUtils.parseYearMonth(new Date()));

        const sorted = Array.from(monthsSet).sort().reverse();
        this._monthsCache = sorted;
        this._monthsCacheKey = key;
        return sorted;
    },

    get activeReportMonth() {
        const months = this.availableReportMonths;
        if (this.selectedReportMonth && months.includes(this.selectedReportMonth)) {
            return this.selectedReportMonth;
        }
        return months[0] || window.BarUtils.parseYearMonth(new Date());
    },

    /**
     * Unified memoized snapshot for the active report month.
     * Replaces O(I^2) linear scans with O(1) Map lookups and caches all derived metrics.
     */
    get monthlySnapshot() {
        const targetMonth = this.activeReportMonth;
        const ingredients = Array.isArray(this.ingredients) ? this.ingredients : [];
        const orders = Array.isArray(this.orders) ? this.orders : [];
        const audits = Array.isArray(this.audits) ? this.audits : [];

        const key = `${this._ingVersion || 0}_${this._orderVersion || 0}_${this._auditVersion || 0}_${ingredients.length}_${orders.length}_${audits.length}_${targetMonth}`;
        if (this._snapshotCache && this._snapshotCacheKey === key) {
            return this._snapshotCache;
        }

        // 1. Filter monthly orders & compute import totals + per-ingredient imported quantities
        const importsList = [];
        let importTotal = 0;
        const importedUnitsMap = new Map();

        for (let i = 0; i < orders.length; i++) {
            const o = orders[i];
            if (!o || window.BarUtils.parseYearMonth(o.date) !== targetMonth) continue;
            importsList.push(o);

            const items = o.items || [];
            for (let j = 0; j < items.length; j++) {
                const item = items[j];
                const qty = Number(item.quantity || 0);
                const price = Number(item.unit_price || 0);
                importTotal += qty * price;
                importedUnitsMap.set(
                    item.ingredient_id,
                    (importedUnitsMap.get(item.ingredient_id) || 0) + qty
                );
            }
        }

        // 2. Filter monthly audits & index latest audit items in O(1) Map
        const auditsList = [];
        for (let i = 0; i < audits.length; i++) {
            const a = audits[i];
            if (!a) continue;
            if (a.month === targetMonth || window.BarUtils.parseYearMonth(a.date) === targetMonth) {
                auditsList.push(a);
            }
        }

        let latestAuditMap = null;
        if (auditsList.length > 0) {
            latestAuditMap = new Map();
            const latestItems = auditsList[0].items || [];
            for (let i = 0; i < latestItems.length; i++) {
                const ai = latestItems[i];
                if (ai && ai.ingredient_id !== undefined) {
                    latestAuditMap.set(ai.ingredient_id, ai);
                }
            }
        }

        // 3. Compute ingredient consumption in O(I)
        const usageList = [];
        let grandTotalValue = 0;

        for (let i = 0; i < ingredients.length; i++) {
            const ing = ingredients[i];
            if (!ing) continue;
            const imported = importedUnitsMap.get(ing.id) || 0;
            let usedUnits = 0;

            if (latestAuditMap) {
                const auditItem = latestAuditMap.get(ing.id);
                if (auditItem) {
                    const endingStock = Number(auditItem.physical_stock || 0);
                    const beginningStock = Number(auditItem.system_stock || 0);
                    const rawUsage = (beginningStock + imported) - endingStock;
                    usedUnits = Math.max(0, Number(rawUsage.toFixed(1)));
                } else {
                    usedUnits = imported;
                }
            } else {
                usedUnits = imported;
            }

            if (usedUnits > 0) {
                const unitPrice = Number(ing.price || 0);
                const usedValue = usedUnits * unitPrice;
                grandTotalValue += usedValue;

                usageList.push({
                    id: ing.id,
                    name: ing.name,
                    category: ing.category,
                    unit_volume: ing.unit_volume,
                    volume_unit: ing.volume_unit || 'ml',
                    usedUnits: Number(usedUnits.toFixed(1)),
                    unitPrice,
                    usedValue: Math.round(usedValue),
                    pctOfTotal: '0'
                });
            }
        }

        for (let i = 0; i < usageList.length; i++) {
            const item = usageList[i];
            item.pctOfTotal = grandTotalValue > 0 ? ((item.usedValue / grandTotalValue) * 100).toFixed(1) : '0';
        }

        const sortedByValue = [...usageList].sort((a, b) => b.usedValue - a.usedValue);
        const sortedByVolume = [...usageList].sort((a, b) => b.usedUnits - a.usedUnits);

        this._snapshotCache = {
            importsList,
            importTotal,
            auditsList,
            usageData: {
                items: usageList,
                totalUsageValue: grandTotalValue
            },
            totalUsageValue: grandTotalValue,
            sortedByValue,
            sortedByVolume
        };
        this._snapshotCacheKey = key;
        return this._snapshotCache;
    },

    get monthlyImportsList() {
        return this.monthlySnapshot.importsList;
    },

    get monthlyImportTotal() {
        return this.monthlySnapshot.importTotal;
    },

    get monthlyAuditsList() {
        return this.monthlySnapshot.auditsList;
    },

    get monthlyUsageData() {
        return this.monthlySnapshot.usageData;
    },

    get monthlyUsageTotal() {
        return this.monthlySnapshot.totalUsageValue;
    },

    get mostUsedIngredients() {
        return this.leaderboardMode === 'volume'
            ? this.monthlySnapshot.sortedByVolume
            : this.monthlySnapshot.sortedByValue;
    },

    exportMonthlyReportXlsx() {
        const monthLabel = window.BarUtils.formatMonthLabel(this.activeReportMonth);
        const filename = `Strelitzia_Report_${this.activeReportMonth}.xlsx`;

        const summary = {
            importCost: this.monthlyImportTotal,
            usageValue: this.monthlyUsageTotal,
            netVariance: (this.monthlyAuditsList || []).reduce((sum, a) => {
                return sum + (this.getAuditNetVariance ? this.getAuditNetVariance(a) : (a.items || []).reduce((s, i) => s + Number(i.variance || 0), 0));
            }, 0)
        };

        const sheetData = window.ExportService.buildMonthlyReportSheet(
            monthLabel,
            summary,
            this.mostUsedIngredients,
            this.monthlyImportsList,
            this.monthlyAuditsList
        );

        window.ExportService.exportToXLSX(filename, {
            'Monthly Report': sheetData
        });
    },

    exportMonthlyReportCsv() {
        const monthLabel = window.BarUtils.formatMonthLabel(this.activeReportMonth);
        const filename = `Strelitzia_Report_${this.activeReportMonth}.csv`;

        const summary = {
            importCost: this.monthlyImportTotal,
            usageValue: this.monthlyUsageTotal,
            netVariance: 0
        };

        const sheetData = window.ExportService.buildMonthlyReportSheet(
            monthLabel,
            summary,
            this.mostUsedIngredients,
            this.monthlyImportsList,
            this.monthlyAuditsList
        );

        window.ExportService.exportToCSV(filename, sheetData[0], sheetData.slice(1));
    },

    async copyMonthlyReportToClipboard() {
        const monthLabel = window.BarUtils.formatMonthLabel(this.activeReportMonth);
        const summary = {
            importCost: this.monthlyImportTotal,
            usageValue: this.monthlyUsageTotal,
            netVariance: 0
        };

        const sheetData = window.ExportService.buildMonthlyReportSheet(
            monthLabel,
            summary,
            this.mostUsedIngredients,
            this.monthlyImportsList,
            this.monthlyAuditsList
        );

        await window.ExportService.copyToClipboard(sheetData[0], sheetData.slice(1));
    }
};

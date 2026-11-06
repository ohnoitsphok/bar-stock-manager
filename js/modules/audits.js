/**
 * Audits Module - Optimized with Lazy Modal DOM Rendering & Single-Pass Variance Stats
 */
window.AuditModule = {
    auditModalOpen: false,
    auditFilterCategory: 'All',
    auditSearchQuery: '',
    auditCounts: {},
    auditNotes: '',

    // Internal cache for historical audit net variances
    _auditNetVarMap: null,
    _auditNetVarKey: '',

    get auditIngredients() {
        // Avoid rendering 136 hidden DOM rows when modal is closed
        if (!this.auditModalOpen) return [];
        return Array.isArray(this.ingredients) ? this.ingredients : [];
    },

    isAuditItemVisible(ing) {
        if (!ing) return false;
        if (this.auditFilterCategory !== 'All' && ing.category !== this.auditFilterCategory) {
            return false;
        }
        const q = (this.auditSearchQuery || '').toLowerCase().trim();
        if (!q) return true;
        return (ing.name || '').toLowerCase().includes(q);
    },

    /**
     * Single-pass summary of current modal discrepancies and net variance
     */
    get auditSummary() {
        if (!this.auditModalOpen) {
            return { varianceTotal: 0, discrepancyCount: 0 };
        }
        let total = 0;
        let count = 0;
        const list = Array.isArray(this.ingredients) ? this.ingredients : [];
        const counts = this.auditCounts || {};

        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (!item) continue;
            const sys = Number(item.stock || 0);
            const counted = counts[item.id] !== undefined ? Number(counts[item.id]) : sys;
            const diff = counted - sys;
            if (Math.abs(diff) >= 0.05) {
                count++;
                total += diff;
            }
        }
        return {
            varianceTotal: Number(total.toFixed(1)),
            discrepancyCount: count
        };
    },

    get auditVarianceTotal() {
        return this.auditSummary.varianceTotal;
    },

    get auditDiscrepancyCount() {
        return this.auditSummary.discrepancyCount;
    },

    getAuditNetVariance(audit) {
        if (!audit || !Array.isArray(audit.items)) return 0;
        const key = `${this._auditVersion || 0}_${(this.audits || []).length}`;
        if (this._auditNetVarKey !== key || !this._auditNetVarMap) {
            this._auditNetVarMap = new Map();
            this._auditNetVarKey = key;
        }
        if (audit.id && this._auditNetVarMap.has(audit.id)) {
            return this._auditNetVarMap.get(audit.id);
        }
        let sum = 0;
        for (let i = 0; i < audit.items.length; i++) {
            sum += Number(audit.items[i].variance || 0);
        }
        const net = Number(sum.toFixed(1));
        if (audit.id) {
            this._auditNetVarMap.set(audit.id, net);
        }
        return net;
    },

    openStockTakeModal() {
        this.auditNotes = '';
        this.auditFilterCategory = 'All';
        this.auditSearchQuery = '';
        
        // Pre-fill physical counts with current system stock as baseline
        const counts = {};
        const list = this.ingredients || [];
        for (let i = 0; i < list.length; i++) {
            const ing = list[i];
            if (ing) counts[ing.id] = Number(ing.stock || 0);
        }
        this.auditCounts = counts;
        this.auditModalOpen = true;
    },

    closeStockTakeModal() {
        this.auditModalOpen = false;
    },

    getAuditItemVariance(ing) {
        if (!ing) return 0;
        const counted = this.auditCounts[ing.id] !== undefined ? Number(this.auditCounts[ing.id]) : Number(ing.stock || 0);
        return Number((counted - Number(ing.stock || 0)).toFixed(1));
    },

    adjustAuditCount(ing, delta) {
        if (!ing) return;
        const current = this.auditCounts[ing.id] !== undefined ? Number(this.auditCounts[ing.id]) : Number(ing.stock || 0);
        this.auditCounts[ing.id] = Math.max(0, Number((current + delta).toFixed(1)));
    },

    setAuditFraction(ing, fraction) {
        if (!ing) return;
        const current = this.auditCounts[ing.id] !== undefined ? Number(this.auditCounts[ing.id]) : Number(ing.stock || 0);
        const whole = Math.floor(current);
        const val = fraction === 1 ? (whole === current && whole > 0 ? whole : whole + 1) : whole + fraction;
        this.auditCounts[ing.id] = Number(val.toFixed(2));
    },

    submitStockTake() {
        const { discrepancyCount: discrepancies, varianceTotal: varianceSum } = this.auditSummary;
        const confirmMsg = `Complete stock-take audit?\n\n• Items with discrepancies: ${discrepancies}\n• Net stock variance: ${varianceSum > 0 ? '+' : ''}${varianceSum} units\n\nThis will update all inventory stock levels to your entered physical counts.`;
        
        if (!confirm(confirmMsg)) return;

        const now = new Date();
        const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const monthStr = window.BarUtils.parseYearMonth(now);

        const auditItems = (this.ingredients || []).map(i => {
            const counted = this.auditCounts[i.id] !== undefined ? Number(this.auditCounts[i.id]) : Number(i.stock || 0);
            const sysStock = Number(i.stock || 0);
            const varUnits = Number((counted - sysStock).toFixed(1));
            
            // Apply new physical stock to live inventory
            i.stock = Math.max(0, counted);

            return {
                ingredient_id: i.id,
                system_stock: sysStock,
                physical_stock: counted,
                variance: varUnits,
                unit_price: Number(i.price || 0)
            };
        });

        const newAudit = {
            id: Date.now().toString(),
            date: dateStr,
            month: monthStr,
            notes: this.auditNotes || 'Periodical Physical Stock Count',
            items: auditItems
        };

        if (!Array.isArray(this.audits)) {
            this.audits = [];
        }
        this.audits.unshift(newAudit);
        window.StorageService.markDirtyIng(auditItems.map(a => a.ingredient_id));

        this.closeStockTakeModal();
        this.persist('audits');

        if (this.notify) {
            this.notify('Stock-take audit completed & inventory updated', 'success');
        } else {
            alert('Stock-take audit saved! Inventory stock successfully updated to physical counts.');
        }
    },

    deleteAudit(id) {
        if (confirm('Delete this historical audit log? (Note: Live stock levels will not be reverted)')) {
            this.audits = (this.audits || []).filter(a => a.id !== id);
            window.StorageService.markDeleted('audits', id);
            this.persist('audits');
            if (this.notify) this.notify('Audit record deleted', 'info');
        }
    }
};

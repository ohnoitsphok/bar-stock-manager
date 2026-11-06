/**
 * Orders Module - Optimized with O(1) Lookups & Memoized Order Totals
 */
window.OrderModule = {
    editingOrderId: null,
    orderSearchQuery: '',
    orderDropdownOpen: false,
    orderForm: window.BAR_CONFIG.createDefaultOrderForm(),
    tempOrderIngId: '',
    tempOrderQty: 1,
    tempOrderPrice: 0,

    // Internal caches
    _orderFilterCache: null,
    _orderFilterKey: '',
    _orderTotalsMap: null,
    _orderTotalsKey: '',

    get filteredOrderIngredients() {
        const base = this.baseSortedIngredients;
        const q = (this.orderSearchQuery || '').toLowerCase().trim();
        const key = `${this._ingVersion || 0}|${base ? base.length : (this.ingredients || []).length}|${q}`;
        if (this._orderFilterCache && this._orderFilterKey === key) {
            return this._orderFilterCache;
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

        this._orderFilterCache = res;
        this._orderFilterKey = key;
        return res;
    },

    selectOrderIngredient(ing) {
        this.tempOrderIngId = ing.id;
        this.orderSearchQuery = ing.name;
        this.tempOrderPrice = Number(ing.price || 0);
        this.orderDropdownOpen = false;
    },

    addOrderItem() {
        if (!this.tempOrderIngId && this.filteredOrderIngredients.length > 0) {
            const topMatch = this.filteredOrderIngredients[0];
            this.tempOrderIngId = topMatch.id;
            if (!this.tempOrderPrice) this.tempOrderPrice = Number(topMatch.price || 0);
        }
        if (!this.tempOrderIngId || !this.tempOrderQty || this.tempOrderQty <= 0) return;

        this.orderForm.items.push({
            ingredient_id: this.tempOrderIngId,
            quantity: Number(this.tempOrderQty),
            unit_price: Number(this.tempOrderPrice || 0)
        });

        this.tempOrderIngId = '';
        this.orderSearchQuery = '';
        this.tempOrderQty = 1;
        this.tempOrderPrice = 0;
    },

    removeOrderItem(idx) {
        if (this.orderForm && Array.isArray(this.orderForm.items)) {
            this.orderForm.items.splice(idx, 1);
        }
    },

    calcOrderTotal(order) {
        return this.getOrderTotal(order);
    },

    getOrderTotal(order) {
        if (!order || !Array.isArray(order.items)) return 0;
        const key = `${this._orderVersion || 0}_${(this.orders || []).length}`;
        if (this._orderTotalsKey !== key || !this._orderTotalsMap) {
            this._orderTotalsMap = new Map();
            this._orderTotalsKey = key;
        }
        if (order.id && this._orderTotalsMap.has(order.id)) {
            return this._orderTotalsMap.get(order.id);
        }
        let sum = 0;
        for (let i = 0; i < order.items.length; i++) {
            const oi = order.items[i];
            sum += Number(oi.quantity || 0) * Number(oi.unit_price || 0);
        }
        if (order.id) {
            this._orderTotalsMap.set(order.id, sum);
        }
        return sum;
    },

    submitOrder() {
        if (!this.orderForm.items || this.orderForm.items.length === 0) {
            return this.notify ? this.notify('Please add at least one item to the order.', 'warning') : alert('Please add at least one item to the order.');
        }

        if (this.editingOrderId) {
            // Roll back previous stock received from the old order state
            const oldOrder = this.orders.find(o => o.id === this.editingOrderId);
            if (oldOrder && Array.isArray(oldOrder.items)) {
                oldOrder.items.forEach(oi => {
                    const ing = this.getIngredientById ? this.getIngredientById(oi.ingredient_id) : this.ingredients.find(i => i.id === oi.ingredient_id);
                    if (ing) {
                        ing.stock = Math.max(0, Number(((ing.stock || 0) - oi.quantity).toFixed(1)));
                    }
                });
            }

            const idx = this.orders.findIndex(o => o.id === this.editingOrderId);
            if (idx !== -1) {
                this.orders[idx] = {
                    ...this.orderForm,
                    id: this.editingOrderId,
                    date: this.orders[idx].date
                };
            }
            this.editingOrderId = null;
            if (this.notify) this.notify('Purchase order updated & stock adjusted', 'success');
        } else {
            const now = new Date();
            const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const newOrder = {
                ...this.orderForm,
                id: Date.now().toString(),
                date: dateStr
            };
            this.orders.unshift(newOrder);
            if (this.notify) this.notify('Purchase order logged & stock received', 'success');
        }

        // Apply new stock quantities & update unit price if applicable
        const dirtyIngIds = [];
        this.orderForm.items.forEach(oi => {
            const ing = this.getIngredientById ? this.getIngredientById(oi.ingredient_id) : this.ingredients.find(i => i.id === oi.ingredient_id);
            if (ing) {
                ing.stock = Number(((ing.stock || 0) + oi.quantity).toFixed(1));
                if (oi.unit_price > 0) {
                    ing.price = oi.unit_price;
                }
                dirtyIngIds.push(ing.id);
            }
        });
        window.StorageService.markDirtyIng(dirtyIngIds);

        this.orderForm = window.BAR_CONFIG.createDefaultOrderForm();
        this.persist('orders');
    },

    startEditOrder(order) {
        this.editingOrderId = order.id;
        this.orderForm = {
            supplier: order.supplier || '',
            items: (order.items || []).map(item => ({ ...item }))
        };
    },

    cancelEditOrder() {
        this.editingOrderId = null;
        this.orderForm = window.BAR_CONFIG.createDefaultOrderForm();
    },

    deleteOrder(id) {
        if (confirm('Delete this purchase order? (Note: Stock added by this order will be deducted back)')) {
            const order = this.orders.find(o => o.id === id);
            const dirtyIngIds = [];
            if (order && Array.isArray(order.items)) {
                order.items.forEach(oi => {
                    const ing = this.getIngredientById ? this.getIngredientById(oi.ingredient_id) : this.ingredients.find(i => i.id === oi.ingredient_id);
                    if (ing) {
                        ing.stock = Math.max(0, Number(((ing.stock || 0) - oi.quantity).toFixed(1)));
                        dirtyIngIds.push(ing.id);
                    }
                });
            }
            window.StorageService.markDirtyIng(dirtyIngIds);
            window.StorageService.markDeleted('orders', id);

            this.orders = this.orders.filter(o => o.id !== id);
            if (this.editingOrderId === id) this.cancelEditOrder();
            this.persist('orders');
            if (this.notify) this.notify('Order deleted & received stock rolled back', 'info');
        }
    },

    // Export Actions
    exportOrdersXlsx() {
        const sheetData = window.ExportService.buildOrdersSheet(this.orders, this.ingredients, this.ingredientMap);
        const filename = `Strelitzia_Purchase_Orders_${new Date().toISOString().slice(0, 10)}.xlsx`;
        window.ExportService.exportToXLSX(filename, {
            'Purchase Orders': sheetData
        });
    },

    exportOrdersCsv() {
        const sheetData = window.ExportService.buildOrdersSheet(this.orders, this.ingredients, this.ingredientMap);
        const filename = `Strelitzia_Purchase_Orders_${new Date().toISOString().slice(0, 10)}.csv`;
        window.ExportService.exportToCSV(filename, sheetData[0], sheetData.slice(1));
    },

    async copyOrdersToClipboard() {
        const sheetData = window.ExportService.buildOrdersSheet(this.orders, this.ingredients, this.ingredientMap);
        await window.ExportService.copyToClipboard(sheetData[0], sheetData.slice(1));
    }
};

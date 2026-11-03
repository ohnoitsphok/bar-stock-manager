/**
 * Data Export Service - XLSX (SheetJS), UTF-8 CSV, and Google Sheets Clipboard
 */
window.ExportService = {
    /**
     * Export multiple sheets to a single .xlsx file using SheetJS
     * @param {string} filename - e.g. "Bar_Inventory_2026-11-03.xlsx"
     * @param {Object} sheets - e.g. { "Inventory": [headers, ...rows], "Recipes": [...] }
     */
    exportToXLSX(filename, sheets) {
        if (!window.XLSX) {
            console.warn('SheetJS (XLSX) library not loaded. Falling back to CSV export.');
            // Fallback: export first sheet as CSV
            const firstSheetName = Object.keys(sheets)[0];
            if (firstSheetName && sheets[firstSheetName].length > 0) {
                const [headers, ...rows] = sheets[firstSheetName];
                this.exportToCSV(filename.replace(/\.xlsx$/, '.csv'), headers, rows);
            }
            return;
        }

        const wb = window.XLSX.utils.book_new();

        for (const [sheetName, data] of Object.entries(sheets)) {
            const ws = window.XLSX.utils.aoa_to_sheet(data);

            // Auto-calculate approximate column widths
            const colWidths = [];
            data.forEach(row => {
                row.forEach((cell, colIdx) => {
                    const cellStr = cell !== null && cell !== undefined ? String(cell) : '';
                    const len = Math.max(cellStr.length, 10);
                    colWidths[colIdx] = Math.max(colWidths[colIdx] || 10, Math.min(len + 3, 50));
                });
            });
            ws['!cols'] = colWidths.map(w => ({ wch: w }));

            window.XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31)); // Max sheet name length is 31
        }

        window.XLSX.writeFile(wb, filename);
    },

    /**
     * Export data to a UTF-8 CSV with Byte Order Mark (BOM) for Excel & Google Sheets
     */
    exportToCSV(filename, headers, rows) {
        const escapeCell = (val) => {
            if (val === null || val === undefined) return '""';
            const str = String(val).replace(/"/g, '""');
            return `"${str}"`;
        };

        const csvRows = [];
        if (headers && headers.length > 0) {
            csvRows.push(headers.map(escapeCell).join(','));
        }

        rows.forEach(row => {
            csvRows.push(row.map(escapeCell).join(','));
        });

        const csvContent = '\uFEFF' + csvRows.join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        window.BarUtils.downloadBlob(blob, filename);
    },

    /**
     * Copy tab-separated values (TSV) directly to clipboard for 1-click Google Sheets pasting
     */
    async copyToClipboard(headers, rows) {
        const lines = [];
        if (headers && headers.length > 0) {
            lines.push(headers.join('\t'));
        }
        rows.forEach(row => {
            const rowStr = row.map(cell => {
                if (cell === null || cell === undefined) return '';
                return String(cell).replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
            }).join('\t');
            lines.push(rowStr);
        });

        const tsv = lines.join('\n');

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(tsv);
                alert(`📋 Copied ${rows.length} rows to clipboard! Open Google Sheets and press Ctrl+V to paste.`);
                return true;
            }
        } catch (e) {
            console.warn('Clipboard API blocked, using fallback textarea:', e);
        }

        // Fallback for browsers blocking clipboard API
        const textarea = document.createElement('textarea');
        textarea.value = tsv;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert(`📋 Copied ${rows.length} rows to clipboard! Open Google Sheets and press Ctrl+V to paste.`);
        return true;
    },

    /**
     * Formatters for specific domain models
     */
    buildInventorySheet(ingredients) {
        const headers = [
            'Item Name',
            'Category',
            'Bottle Size',
            'Unit',
            'Current Stock',
            'Par Level',
            'Bottle Price (VND)',
            'Cost / Unit (VND)',
            'Total Value (VND)',
            'Stock Status',
            'Expiry / Batch'
        ];

        const rows = (ingredients || []).map(i => {
            const unitVol = Number(i.unit_volume || 0);
            const price = Number(i.price || 0);
            const stock = Number(i.stock || 0);
            const par = Number(i.par || 0);
            const unitCost = unitVol > 0 ? (price / unitVol) : 0;
            const totalVal = stock * price;
            const isLowStock = stock <= par;

            return [
                i.name || '',
                i.category || 'Uncategorized',
                unitVol,
                i.volume_unit || 'ml',
                stock,
                par,
                price,
                Math.round(unitCost * 100) / 100,
                totalVal,
                isLowStock ? 'LOW STOCK' : 'OK',
                i.expiry || ''
            ];
        });

        return [headers, ...rows];
    },

    _ensureIngMap(ingredients, ingMap) {
        if (ingMap instanceof Map) return ingMap;
        const map = new Map();
        const list = ingredients || [];
        for (let i = 0; i < list.length; i++) {
            if (list[i] && list[i].id !== undefined) {
                map.set(list[i].id, list[i]);
            }
        }
        return map;
    },

    buildRecipesSheet(recipes, ingredients, ingMap) {
        const headers = [
            'Cocktail Name',
            'Selling Price (VND)',
            'Pour Cost (VND)',
            'Pour Cost %',
            'Status',
            'Ingredients Breakdown'
        ];

        const lookup = this._ensureIngMap(ingredients, ingMap);

        const rows = (recipes || []).map(r => {
            let totalCost = 0;
            const itemsList = (r.items || []).map(ri => {
                const ing = lookup.get(ri.ingredient_id);
                if (ing && ing.unit_volume > 0) {
                    const itemCost = (Number(ing.price || 0) / Number(ing.unit_volume)) * Number(ri.amount || 0);
                    totalCost += itemCost;
                    return `${ing.name}: ${ri.amount}${ing.volume_unit || 'ml'}`;
                }
                return `Unknown (${ri.amount})`;
            }).join(' | ');

            const sellPrice = Number(r.selling_price || 0);
            const pourCostPct = sellPrice > 0 ? Math.round((totalCost / sellPrice) * 1000) / 10 : 0;
            const status = pourCostPct > 25 ? 'HIGH COST (>25%)' : 'OK';

            return [
                r.name || '',
                sellPrice,
                Math.round(totalCost),
                `${pourCostPct}%`,
                status,
                itemsList
            ];
        });

        return [headers, ...rows];
    },

    buildOrdersSheet(orders, ingredients, ingMap) {
        const headers = [
            'Order Date',
            'Supplier',
            'Line Items Count',
            'Total Order Cost (VND)',
            'Items Breakdown'
        ];

        const lookup = this._ensureIngMap(ingredients, ingMap);

        const rows = (orders || []).map(o => {
            let totalCost = 0;
            const itemsList = (o.items || []).map(oi => {
                const ing = lookup.get(oi.ingredient_id);
                const ingName = ing ? ing.name : 'Unknown';
                const lineTotal = Number(oi.quantity || 0) * Number(oi.unit_price || 0);
                totalCost += lineTotal;
                return `${ingName} (x${oi.quantity} @ ${oi.unit_price} ₫)`;
            }).join(' | ');

            return [
                o.date || '',
                o.supplier || 'General Order',
                (o.items || []).length,
                totalCost,
                itemsList
            ];
        });

        return [headers, ...rows];
    },

    buildMonthlyReportSheet(monthLabel, summary, topIngredients, monthlyImports, monthlyAudits) {
        const data = [
            [`MONTHLY REPORT: ${monthLabel.toUpperCase()}`],
            ['Generated At', new Date().toLocaleString()],
            ['Total Import Cost (VND)', summary.importCost || 0],
            ['Total Usage Value (VND)', summary.usageValue || 0],
            ['Net Stock Variance (Units)', summary.netVariance || 0],
            [],
            ['--- MOST USED INGREDIENTS (LEADERBOARD) ---'],
            ['Rank', 'Ingredient Name', 'Category', 'Units Used', 'Unit', 'Total Cost Value (VND)', '% of Monthly Usage']
        ];

        (topIngredients || []).forEach((item, idx) => {
            data.push([
                idx + 1,
                item.name,
                item.category,
                item.usedUnits,
                item.volume_unit,
                item.usedValue,
                `${item.pctOfTotal}%`
            ]);
        });

        data.push([]);
        data.push(['--- MONTHLY PURCHASE ORDERS (IMPORTS) ---']);
        data.push(['Date', 'Supplier', 'Order Total (VND)', 'Items']);
        (monthlyImports || []).forEach(o => {
            const total = (o.items || []).reduce((acc, i) => acc + (i.quantity * i.unit_price), 0);
            const items = (o.items || []).map(i => `${i.quantity}x @ ${i.unit_price}₫`).join(', ');
            data.push([o.date, o.supplier || 'General', total, items]);
        });

        data.push([]);
        data.push(['--- PHYSICAL AUDITS CONDUCTED IN MONTH ---']);
        data.push(['Date', 'Notes', 'Items Counted', 'Total Discrepancy']);
        (monthlyAudits || []).forEach(a => {
            const count = (a.items || []).length;
            const varianceSum = (a.items || []).reduce((acc, i) => acc + (Number(i.variance || 0)), 0);
            data.push([a.date, a.notes || '', count, varianceSum]);
        });

        return data;
    }
};

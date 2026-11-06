/**
 * Global Configuration & Constants
 */
window.BAR_CONFIG = {
    STORAGE_KEYS: {
        INGREDIENTS: 'bar_ingredients',
        RECIPES: 'bar_recipes',
        ORDERS: 'bar_orders',
        AUDITS: 'bar_audits',
        GH_USER: 'gh_user',
        GH_REPO: 'gh_repo',
        GH_TOKEN: 'gh_token',
        SYNC_SHA: 'bar_sync_sha',
        SYNC_DIRTY: 'bar_sync_dirty',
        DELETED_IDS: 'bar_deleted_ids',
        DIRTY_ING_IDS: 'bar_dirty_ing_ids'
    },
    
    DEFAULTS: {
        GH_USER: 'ohnoitsphok',
        GH_REPO: 'bar-stock-manager',
        POUR_COST_THRESHOLD_PCT: 25,
        COMBOBOX_MAX_RESULTS: 15,
        DEBOUNCE_SYNC_MS: 1500
    },

    CATEGORIES: [
        'Spirit - Gin',
        'Spirit - Whisky',
        'Spirit - Vodka',
        'Spirit - Rum',
        'Spirit - Tequila / Mezcal',
        'Spirit - Brandy / Cognac',
        'Spirit - Other',
        'Liqueurs & Modifiers',
        'Vermouth & Aperitifs',
        'House Syrups & Cordials',
        'Bitters & Tinctures',
        'Fresh Citrus & Produce',
        'Dairy & Cream',
        'Mixers & Soda',
        'Garnishes & Dry Goods'
    ],

    VOLUME_UNITS: ['ml', 'g', 'pcs', 'dashes'],

    createDefaultIngredientForm: () => ({
        name: '',
        category: 'Spirit - Gin',
        unit_volume: 700,
        volume_unit: 'ml',
        stock: 1,
        par: 1,
        price: 0,
        expiry: ''
    }),

    createDefaultRecipeForm: () => ({
        name: '',
        category: '',
        selling_price: 0,
        items: []
    }),

    createDefaultOrderForm: () => ({
        supplier: '',
        items: []
    })
};

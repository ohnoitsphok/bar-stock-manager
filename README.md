# 🍸 Bar Stock Manager

A modern, responsive, zero-build web application for bar inventory control, cocktail recipe cost calculations, purchase order tracking, stock-taking audits, and monthly consumption analytics.

Designed for bar managers and bartenders to manage high-volume spirits, liqueurs, syrups, and fresh ingredients on desktop or mobile without requiring complex backend servers or database setup.

---

## ✨ Features

### 1. 📦 Inventory Management
- **Real-Time Stock Tracking**: Track spirits and ingredients by bottle/unit count and bottle volume (e.g. 700 ml, 1000 ml).
- **Cost Calculation**: Automatic calculation of unit cost and cost-per-milliliter/gram based on purchase prices.
- **Low-Stock Warnings**: Visual badges and filtering for ingredients falling below custom minimum threshold alerts.
- **Category Organization**: Filter and group by Spirits, Liqueurs, Wine & Vermouth, Beer & Cider, Mixers, Syrups & Cordials, Fresh & Perishables, and Bitters.
- **Mobile Touch Steppers**: Quick `+` and `-` count adjustment buttons sized for rapid thumb tapping on phone viewports.

### 2. 🍹 Cocktail Recipe Builder & Pour Cost
- **Recipe Costing**: Build cocktails by picking ingredients from inventory with milliliter/dash precision.
- **Dynamic Pour Cost %**: Live calculation of total recipe cost, target selling price, and Pour Cost percentage (`Total Cost / Menu Price * 100`).
- **Target Pour Cost Indicator**: Instant visual feedback (green/red badges) showing if a cocktail meets the industry-standard $\le 20\%$ target margin.

### 3. 📝 Purchase Orders & History
- **Stock Increment on Restock**: Log vendor purchase orders with item selection, quantities, and purchase prices.
- **Inventory Rollback**: Deleting an accidental purchase order automatically deducts the added quantities back from current stock.
- **Order Audit Trail**: Detailed timestamped history of all historical purchases.

### 4. 🔍 Periodic Stock-Take Audits
- **Expected vs. Actual Counts**: Fast, guided stock-taking modal listing all current bottles and expected inventory.
- **Variance Tracking**: Auto-computes variance (difference) and total value loss in currency ($ / VND / EUR).
- **Audit Logging**: Saves timestamped stock-take records with staff notes for discrepancy audits.

### 5. 📊 Monthly Analytics & Leaderboards
- **Monthly Usage & Imports**: Filter by month to view total imported inventory value, calculated consumption value, and net stock changes.
- **Dual-Rank Ingredient Leaderboard**:
  - **By Usage Value**: Find high-value spirits and ingredients driving bar beverage costs.
  - **By Volume / Unit Count**: Track high-turnover ingredients by volume consumed.

### 6. 📑 Spreadsheet Exports (Excel & Google Sheets)
- **Multi-Sheet Excel Workbook (`.xlsx`)**: One-click download powered by SheetJS containing:
  - *Inventory*: Current stock, values, and cost-per-ml.
  - *Recipes*: Full cocktail catalog and pour cost breakdown.
  - *Monthly Usage*: Usage volume and value for the selected month.
  - *Order History*: Historical purchase log.
- **CSV Export**: Clean `.csv` export with UTF-8 BOM encoding for seamless opening in Microsoft Excel without character corruption.
- **Google Sheets One-Click Copy**: Copies TSV data directly to clipboard; paste immediately into any Google Sheets document.

### 7. ☁️ Bidirectional GitHub Cloud Sync
- **Serverless Data Persistence**: Operates entirely client-side using `localStorage`, with optional cloud sync directly to your GitHub repository using GitHub's REST Contents API.
- **Zero Backend Required**: Safe bidirectional push/pull with `data.json` using a personal access token (PAT).

---

## 📱 Mobile-First UX Design

- **Responsive Viewports**: Tailored for mobile screens (360px–480px) and tablet/desktop layouts.
- **Collapsible Forms**: Add/Edit forms collapse automatically on mobile so staff immediately see the stock table during shifts.
- **iOS Safari Optimization**: Inputs enforced at `16px` to prevent unwanted auto-zooming on iPhone devices.
- **Fluid Touch Gestures**: Momentum scrolling and tap-highlight suppression for a native app feel.

---

## 🛠️ Tech Stack & Architecture

This project strictly adheres to a **zero-build** web architecture—no Node.js, Webpack, or Vite compilation required. It runs straight out of the box in any modern browser.

| Technology | Purpose |
| :--- | :--- |
| **Alpine.js v3** | Reactive client-side component state, declarative data binding, and computed getters |
| **Tailwind CSS (CDN)** | Utility-first responsive dark-mode styling |
| **SheetJS (xlsx)** | Client-side `.xlsx` spreadsheet generation |
| **FontAwesome 6** | UI icons |
| **Vanilla ES6+ Modules** | Decoupled, maintainable JavaScript modules |

### Directory Structure

```text
bar-stock-manager/
├── index.html              # Main application shell and UI templates
├── data.json               # Seed database for ingredients, recipes, and orders
├── .gitattributes          # Line-ending normalization (LF)
├── css/
│   └── styles.css          # Custom styling, scrollbars, containment, and mobile tweaks
└── js/
    ├── app.js              # Alpine.js barApp composition and bootstrap
    ├── config.js           # App constants, categories, and form prototypes
    ├── utils.js            # Currency formatting, base64 transcoding, date helpers
    ├── services/
    │   ├── storage.js      # LocalStorage persistence & data.json seeder
    │   ├── github.js       # GitHub REST API sync with SHA verification
    │   └── exporter.js     # SheetJS Excel, CSV (UTF-8 BOM), and TSV clipboard engine
    └── modules/
        ├── inventory.js    # Stock calculations, sorting, low-stock filters
        ├── recipes.js      # Recipe cost breakdown and pour cost calculations
        ├── orders.js       # Purchase order logging and stock rollback
        ├── audits.js       # Stock-take sessions, variance calculations, and audit logs
        └── analytics.js    # Monthly consumption formulas and dual-rank leaderboards
```

---

## 🚀 Getting Started

### Quick Start (Local)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/vohaiphong/bar-stock-manager.git
   cd bar-stock-manager
   ```

2. **Run locally:**
   Because the app loads `data.json` via `fetch()`, run any local static HTTP server:
   
   - Using Python:
     ```bash
     python -m http.server 8000
     ```
   - Using VS Code: Right-click `index.html` $\rightarrow$ **Open with Live Server**.

3. **Open in browser:**
   Navigate to `http://localhost:8000`.

---

## 🔑 Setting Up GitHub Sync (Optional)

To enable automatic multi-device synchronization:

1. In GitHub, create a **Personal Access Token (PAT)**:
   - Go to **GitHub Settings** $\rightarrow$ **Developer Settings** $\rightarrow$ **Personal Access Tokens** $\rightarrow$ **Tokens (classic)**.
   - Generate new token with `repo` scope (or Fine-grained token with *Contents: Read & Write* permission for this repository).
2. Open the app, click **GitHub Sync** in the top-right corner.
3. Enter your:
   - **Repository**: `username/repository-name`
   - **Branch**: `main`
   - **Personal Access Token**: `ghp_...`
4. Click **Save & Pull** to sync data directly with your GitHub repo's `data.json`.

---

## 📄 License

MIT License. Open source and free for commercial and personal use in bars, restaurants, and cocktail lounges.

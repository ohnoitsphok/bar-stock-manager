# Graph Report - bar-stock-manager  (2026-11-05)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 117 nodes · 125 edges · 11 communities (5 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c543ac09`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 4
- Community 5
- Community 7
- Community 8

## God Nodes (most connected - your core abstractions)
1. `getIngredientById()` - 4 edges
2. `getRecipeMetrics()` - 4 edges
3. `resetForm()` - 3 edges
4. `_ensureIngMap()` - 3 edges
5. `getBaseUrl()` - 3 edges
6. `getHeaders()` - 3 edges
7. `pull()` - 3 edges
8. `push()` - 3 edges
9. `adjustStock()` - 2 edges
10. `deleteItem()` - 2 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (11 total, 6 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.13
Nodes (7): adjustStock(), deleteItem(), getIngredientById(), getIngredientName(), getIngredientUnit(), resetForm(), saveIngredient()

### Community 1 - "Community 1"
Cohesion: 0.17
Nodes (6): calcPourCostPct(), calcRecipeItemCost(), calcRecipeTotalCost(), cancelEditRecipe(), deleteRecipe(), getRecipeMetrics()

### Community 2 - "Community 2"
Cohesion: 0.14
Nodes (8): _currencyFormatters, formatCurrency(), getCurrencyFormatter(), MONTH_NAMES, _monthLabelCache, _textDecoder, _textEncoder, _yearMonthCache

### Community 7 - "Community 7"
Cohesion: 0.31
Nodes (5): buildOrdersSheet(), buildRecipesSheet(), _ensureIngMap(), exportToCSV(), exportToXLSX()

### Community 8 - "Community 8"
Cohesion: 0.80
Nodes (4): getBaseUrl(), getHeaders(), pull(), push()

## Knowledge Gaps
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.12631578947368421 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
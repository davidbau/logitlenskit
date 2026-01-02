# LogitLensWidget Refactoring Plan

Goal: Make the code cleaner, more understandable, and more maintainable for students, without changing any functionality.

## Current State
- 2567 lines in a single file
- ~40 state variables as scattered closure variables
- `drawAllTrajectories` is 500+ lines, reads 19 state vars, writes 6
- Heavy coupling through shared state like `uid`, `pinnedGroups`, `currentCellWidth`
- 2 dead code functions identified

---

## Step 1: Remove Dead Code
Delete genuinely unused functions identified by callgraph analysis:
- `getDefaultTitle` (defined but never called)
- `openColorPicker` (defined but never called)

---

## Step 2: Extract State into Explicit State Object
Currently 40+ variables float as closure variables. Consolidate into a single `state` object:

```javascript
var state = {
  // Layout
  chartHeight: null,
  inputTokenWidth: 100,
  currentCellWidth: 44,
  currentMaxRows: null,
  maxTableWidth: null,

  // Layer visibility
  plotMinLayer: 0,
  currentVisibleIndices: [],
  currentStride: 1,

  // Pinned trajectories
  pinnedGroups: [],
  pinnedRows: [],
  lastPinnedGroupIndex: 0,

  // Colors
  colorModes: [...],
  colorIndex: 0,
  heatmapBaseColor: '#ff6600',
  heatmapNextColor: null,

  // UI state
  customTitle: null,
  darkModeOverride: null,
  linkedWidgets: [],

  // Transient state (popups, menus)
  colorPickerTarget: null,
};
```

Benefits:
- Students can see all state in one place
- Makes `getState()`/`setState()` trivial
- Easier to understand what the widget "remembers"

---

## Step 3: Extract DOM ID Helpers
Replace scattered `document.getElementById(uid + "_xxx")` with helper object:

```javascript
var dom = {
  widget: function() { return document.getElementById(uid); },
  table: function() { return document.getElementById(uid + "_table"); },
  chart: function() { return document.getElementById(uid + "_svg"); },
  chartCanvas: function() { return document.getElementById(uid + "_chart"); },
  popup: function() { return document.getElementById(uid + "_popup"); },
  colorMenu: function() { return document.getElementById(uid + "_color_menu"); },
  colorPicker: function() { return document.getElementById(uid + "_color_picker"); },
  title: function() { return document.getElementById(uid + "_title"); },
  overlay: function() { return document.getElementById(uid + "_overlay"); },
};
```

---

## Step 4: Add Section Comments
Group related functions with clear section headers:

```javascript
// ═══════════════════════════════════════════════════════════════
// SECTION: Color Management
// ═══════════════════════════════════════════════════════════════
```

Sections:
1. Data Normalization
2. Constants and Configuration
3. State Object
4. DOM Helpers
5. Utility Functions (escapeHtml, visualizeSpaces, etc.)
6. Color Management
7. Trajectory/Group Management
8. Table Rendering
9. Chart Rendering
10. Popup and Menu Management
11. Resize Handling
12. State Serialization and Sync
13. Dark Mode
14. Initialization and Public API

---

## Step 5: Document the Data Model
Add a comprehensive comment block at the top explaining data structures:

```javascript
/**
 * LogitLensWidget - Interactive visualization of transformer logit lens data
 *
 * DATA MODEL
 * ==========
 *
 * Input data (widgetData after normalization):
 * {
 *   layers: number[],           // Layer indices [0, 1, 2, ...]
 *   tokens: string[],           // Input tokens ["The", " capital", ...]
 *   cells: [                    // [position][layer]
 *     [{ token, prob, trajectory, topk }, ...]
 *   ],
 *   meta: { model, version }
 * }
 *
 * Pinned trajectory group:
 * {
 *   tokens: string[],           // Tokens in this group (usually 1)
 *   color: string,              // Hex color like "#ff6600"
 *   lineStyle: { name, dash }   // Line style for chart
 * }
 *
 * Pinned row:
 * {
 *   pos: number,                // Token position (row index)
 *   lineStyle: { name, dash }   // Line style for this row's trajectories
 * }
 */
```

---

## Step 6: Break Up `drawAllTrajectories`
Split the 500+ line function into focused sub-functions:

```javascript
function drawAllTrajectories() {
  var ctx = prepareChartContext();
  clearChart(ctx);
  drawAxes(ctx);
  drawGridLines(ctx);
  drawPinnedTrajectories(ctx);
  drawHoverTrajectory(ctx);
  drawLegend(ctx);
  setupChartInteractions(ctx);
}
```

The `ctx` object contains computed values needed by sub-functions:
```javascript
function prepareChartContext() {
  return {
    svg: dom.chart(),
    width: ...,
    height: ...,
    margin: getChartMargin(),
    xScale: ...,
    yScale: ...,
    visibleLayers: computeVisibleLayers(),
  };
}
```

---

## Step 7: Create Explicit Render Pipeline
Make data flow explicit with a central render function:

```javascript
function render() {
  buildTable();
  drawAllTrajectories();
}

// Optional: All state changes could go through here
function updateState(changes) {
  Object.assign(state, changes);
  render();
}
```

---

## Implementation Order

1. [x] Write this plan
2. [x] Step 1: Remove dead code
3. [x] Step 2: Extract state object
4. [x] Step 3: Extract DOM helpers
5. [x] Step 4: Add section comments
6. [x] Step 5: Document data model
7. [x] Step 6: Break up drawAllTrajectories (added sub-section comments, extracted niceMax/formatPct utilities)
8. [x] Step 7: Create render pipeline (added render() function and documentation)

After each step: run tests to verify no functionality changed.

---

## Testing Strategy

After each refactoring step:
1. Run `npm test` to verify unit tests pass
2. Open the widget in browser and verify:
   - Table renders correctly
   - Clicking cells shows popup
   - Pinning trajectories works
   - Chart renders and updates
   - Resize handles work
   - Color picker works
   - Dark mode works
   - State save/restore works

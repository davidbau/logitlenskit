# JavaScript API Reference

The LogitLensWidget is a **self-contained, zero-dependency** JavaScript visualization for logit lens data. It renders as pure HTML/CSS/SVG—no React, no D3, no build step required.

**Design philosophy:**
- Works anywhere: Jupyter notebooks, static HTML pages, web apps
- No installation: just include the script and call `LogitLensWidget()`
- Interactive by default: click, hover, drag, pin tokens—all built in
- Linkable widgets: compare models side-by-side with synchronized sizing

## Installation

For browser use, include the script directly:

```html
<script src="https://davidbau.github.io/logitlenskit/js/src/logit-lens-widget.js"></script>
```

For local development:

```bash
cd js
npm install
npm test  # Run tests
```

## Quick Start

```javascript
// Create widget in a container
var widget = LogitLensWidget("#container", data);

// With custom title
var widget = LogitLensWidget("#container", data, { title: "My Analysis" });

// Compare two models with linked column sizing
var w1 = LogitLensWidget("#viz1", llamaData, { title: "Llama 70B" });
var w2 = LogitLensWidget("#viz2", gptData, { title: "GPT-J 6B" });
w1.linkColumnsTo(w2);  // Resize one, both update
```

---

## LogitLensWidget

```javascript
LogitLensWidget(container, data, uiState)
```

This is the main entry point for creating a logit lens visualization. It takes logit lens data in either V1 or V2 JSON format, renders an interactive table and trajectory chart, and returns a widget interface for programmatic control. The widget handles all user interactions internally—clicking cells, pinning tokens, resizing columns—so you typically just need to call this once and let users explore.

### Parameters

#### `container` (string | Element) - required

The container specifies where the widget should be rendered in the DOM. You can provide either a CSS selector string or a direct reference to a DOM element. The widget will fill the container and manage its own layout within that space.
- CSS selector: `"#myDiv"`, `".container"`, `"#main .viz"`
- DOM Element: `document.getElementById("myDiv")`

#### `data` (Object) - required

The data object contains the logit lens analysis results. The widget accepts both V1 and V2 formats (see [DATA_FORMAT.md](DATA_FORMAT.md)), automatically detecting and normalizing V2 data internally. Here is the V1 structure that the widget uses internally:

```javascript
{
  layers: [0, 1, 2, ..., 79],           // Layer indices
  tokens: ["<s>", "The", " quick"],     // Input token strings
  cells: [                               // [position][layer] array
    [                                    // Position 0
      {                                  // Layer 0
        token: " the",                   // Top-1 predicted token
        prob: 0.0234,                    // Top-1 probability (0-1)
        trajectory: [0.01, 0.02, ...],   // Top-1's prob at each layer
        topk: [                          // Top-k predictions
          { token: " the", prob: 0.0234, trajectory: [...] },
          { token: " a", prob: 0.0189, trajectory: [...] },
        ]
      },
      // ... more layers
    ],
    // ... more positions
  ]
}
```

See [DATA_FORMAT.md](DATA_FORMAT.md) for complete specification.

#### `uiState` (Object) - optional

The uiState parameter allows you to restore a previously saved widget configuration or set initial display options. You can capture the current state with `widget.getState()` and pass it here to recreate an identical view. This is useful for saving user preferences, creating reproducible visualizations, or duplicating widgets.

**Display options:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `title` | string | "Logit Lens: Top Predictions by Layer" | Widget title displayed above the table |
| `cellWidth` | number | 44 | Width of each prediction cell in pixels |
| `inputTokenWidth` | number | 100 | Width of the input token column in pixels |
| `chartHeight` | number | 140 | Height of the trajectory chart in pixels (60-400) |
| `maxRows` | number | null | Maximum visible rows (`null` shows all) |
| `maxTableWidth` | number | null | Maximum table width (`null` fits to content) |
| `plotMinLayer` | number | 0 | First layer shown in the trajectory chart |
| `darkMode` | boolean | null | Force dark (`true`) or light (`false`) mode; `null` auto-detects |

**Pinning options:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `pinnedRows` | array | [last row] | Input positions to pin. **By default, the last row is auto-pinned** so users see a trajectory immediately. Pass `[]` to disable auto-pinning. Each entry: `{pos: number, line: "solid"|"dashed"|"dotted"}` |
| `pinnedGroups` | array | [] | Token trajectory groups. Each entry: `{tokens: string[], color: string}` |

**Color options:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `colorModes` | array | ["top", lastToken] | Color modes to cycle through. Values: `"top"`, `"none"`, or token strings |
| `colorMode` | string | - | (Legacy) Single color mode. Use `colorModes` array instead |
| `heatmapBaseColor` | string | null | Custom base heatmap color (hex like `"#8844ff"`) |
| `heatmapNextColor` | string | null | Custom next-token heatmap color |

### Returns

Widget interface object:

```javascript
{
  uid: "ll_interact_0",              // Unique widget ID
  getState: function() {...},        // Get serializable UI state
  getColumnState: function() {...},  // Get column sizing
  setColumnState: function(s) {...}, // Set column sizing
  linkColumnsTo: function(w) {...},  // Link to another widget
  unlinkColumns: function(w) {...}   // Unlink from widget
}
```

---

## Widget Interface

The widget returns an interface object with methods for programmatic control. These methods let you save and restore state, synchronize column widths between widgets, and access the unique widget identifier.

### `getState()`

```javascript
var state = widget.getState();
```

Returns a JSON-serializable object containing all UI state. Use this to save and restore widget configuration.

```javascript
// Save state
localStorage.setItem('widgetState', JSON.stringify(widget.getState()));

// Restore state
var saved = JSON.parse(localStorage.getItem('widgetState'));
var widget = LogitLensWidget("#viz", data, saved);
```

### `getColumnState()`

```javascript
var colState = widget.getColumnState();
// { cellWidth: 44, inputTokenWidth: 100, maxTableWidth: null }
```

This method returns only the column-sizing portion of the widget state. It is primarily used internally for widget linking, but you can also use it to read current column dimensions without the other state properties.

### `setColumnState(state, fromSync)`

```javascript
widget.setColumnState({ cellWidth: 60, inputTokenWidth: 120 });
```

This method updates the widget's column dimensions programmatically. You can use it to set specific column widths from code rather than requiring the user to drag resize handles. The `fromSync` parameter is an internal flag used during widget linking to prevent infinite update loops.

| Parameter | Type | Description |
|-----------|------|-------------|
| `state` | Object | Column state with cellWidth, inputTokenWidth, maxTableWidth |
| `fromSync` | boolean | Internal flag to prevent infinite loops when syncing |

### `linkColumnsTo(otherWidget)`

```javascript
widget1.linkColumnsTo(widget2);
```

This method establishes bidirectional column synchronization between two widgets. When either widget's columns are resized by dragging, the other widget updates automatically to match. This is useful for side-by-side model comparisons where you want both visualizations to maintain the same column layout as users explore.

**Synced properties**: `cellWidth`, `inputTokenWidth`, `maxTableWidth`

**Not synced**: `chartHeight`, `pinnedGroups`, `pinnedRows`, `colorMode`, `title`

### `unlinkColumns(otherWidget)`

```javascript
widget1.unlinkColumns(widget2);
```

This method removes the column synchronization that was previously established with `linkColumnsTo()`. After unlinking, each widget can be resized independently without affecting the other.

---

## Interactive Features

The widget provides rich interactivity without requiring any additional code. Users can explore the data through clicking, hovering, and dragging gestures. This section documents all available interactions so you can guide users or understand what's possible.

### Table Gestures

The main table responds to various mouse interactions. Clicking cells opens detailed popups, clicking input tokens pins rows for comparison, and dragging borders resizes columns.

| Gesture | Target | Effect |
|---------|--------|--------|
| **Click** | Prediction cell | Open popup with top-k predictions |
| **Click** | Input token | Pin/unpin row for comparison |
| **Click** | Title text | Edit title inline |
| **Click** | "(colored by X)" | Open color mode menu |
| **Hover** | Prediction cell | Show trajectory preview (gray dotted) |
| **Hover** | Input token row | Highlight row |
| **Drag** | Column border | Resize column width |
| **Drag** | Input column border | Resize input column |
| **Drag** | Table right edge | Adjust max table width |
| **Drag** | Table bottom edge | Limit visible rows |
| **Drag** | Chart x-axis | Resize chart height |

### Popup Interactions

When you click a prediction cell, a popup appears showing all top-k predictions at that layer and position. The popup allows you to pin tokens for trajectory tracking.

| Gesture | Effect |
|---------|--------|
| **Click** token | Pin/unpin token trajectory (new group) |
| **Shift+Click** token | Add/remove from last active group |
| **Click** X button | Close popup |
| **Click** outside | Close popup |

### Token Pinning

Token pinning is the primary way to compare how different tokens' probabilities evolve across layers. When you click a token in the popup, it becomes "pinned" and its trajectory remains visible in the chart even after closing the popup. Pinned tokens are organized into colored groups, and the chart shows the sum of probabilities for all tokens in each group.
- First pin creates a new colored group
- Shift+click adds tokens to existing group
- Similar tokens show grouping hints
- Pinned tokens' probabilities sum in trajectory

### Row Pinning

Row pinning allows you to compare trajectories across different input positions. When you click an input token in the leftmost column, that row becomes pinned and its trajectory appears in the chart with a distinct line style (solid, dashed, or dotted). This lets you see how the model's predictions differ for different parts of the input.

**Auto-pinning:** By default, the widget automatically pins the last input row when it initializes. This ensures users immediately see a trajectory in the chart, making the interface more discoverable. To disable this behavior, pass `pinnedRows: []` in the uiState.

- Each pinned row uses a different line style (solid, dashed, dotted)
- When a row is pinned, its highest-probability token (>5%) at that position is auto-selected
- Yellow background indicates pinned rows
- Multiple rows can be pinned for side-by-side comparison

### Color Modes

The table cells can be colored to highlight probability patterns. By default, cells are colored by the top-1 prediction's probability (darker = higher probability). You can change the color mode by clicking the "(colored by X)" text below the title to open a menu with options.
- **top prediction**: Cells colored by top-1 probability
- **[specific token]**: Cells colored by that token's probability
- **none**: All cells white

---

## Resize Handles

The widget includes several draggable resize handles for customizing the layout. These handles appear when you hover over the "showing every N layers..." text at the bottom of the table. You can drag these handles to adjust column widths, chart height, and the overall table dimensions.

| Handle | Location | Effect |
|--------|----------|--------|
| Column borders | Between layer headers | Adjust cell width |
| Input border | Right of input column | Adjust input column width |
| Right edge | Table right side | Constrain max table width |
| Bottom edge | Table bottom | Limit visible rows |
| X-axis | Chart x-axis area | Adjust chart height (60-400px) |
| Y-axis | Chart y-axis area | Adjust input column width |

---

## Layer Stride Display

Large models like Llama-70B have 80 layers, which cannot all be displayed as columns without making each column too narrow to read. The widget automatically computes a "stride" to show evenly-spaced layers that fit the available width. As you resize columns, the stride adjusts dynamically.
1. Computes how many columns fit given cell width and container
2. Shows evenly-spaced layers (e.g., "showing every 4 layers")
3. Dragging column borders adjusts stride dynamically

---

## CSS Scoping

Each widget instance generates a unique ID (like `ll_interact_0`, `ll_interact_1`, etc.) and injects CSS rules scoped to that ID. This ensures that multiple widgets on the same page remain completely independent—styling one widget does not affect others, and their interactive states are isolated.

---

## Browser Compatibility

The widget uses modern CSS and JavaScript features for its interactive functionality. It requires a browser that supports the following features, which are available in all major browsers released since late 2023.
- CSS `:has()` selector (Chrome 105+, Safari 15.4+, Firefox 121+)
- ES6 template literals
- SVG support

---

## Examples

These examples demonstrate common usage patterns for the widget. Each example shows the minimal code needed to accomplish a specific task.

### Basic Usage

The simplest way to create a widget is to pass just the container selector and data object. The widget will use default settings for everything else.

```javascript
var widget = LogitLensWidget("#viz", data);
```

### Custom Initial State

You can customize the widget's appearance by passing a uiState object with your preferred settings. This example creates a widget with a custom title, wider columns, taller chart, and no cell coloring.

```javascript
var widget = LogitLensWidget("#viz", data, {
    title: "GPT-2: The quick brown fox",
    cellWidth: 50,
    chartHeight: 200,
    colorModes: ["none"]
});
```

### Disable Auto-Pinning

By default, the widget auto-pins the last input row so users immediately see a trajectory. If you want users to start with a blank chart and discover pinning on their own, pass an empty `pinnedRows` array:

```javascript
var widget = LogitLensWidget("#viz", data, {
    title: "Explore the data",
    pinnedRows: []  // No rows pinned initially
});
```

### Pre-Pin Specific Rows

You can specify exactly which rows should be pinned when the widget loads. This is useful for highlighting specific input positions that are relevant to your analysis:

```javascript
var widget = LogitLensWidget("#viz", data, {
    title: "Comparing subject vs. verb",
    pinnedRows: [
        { pos: 1, line: "solid" },    // "cat" - the subject
        { pos: 3, line: "dashed" }    // "sat" - the verb
    ]
});
```

### Save and Restore State

This pattern demonstrates how to persist the widget's state across page reloads using localStorage. The user's customizations (pinned tokens, column widths, etc.) are preserved automatically.

```javascript
// Save
var state = widget.getState();
localStorage.setItem('widget', JSON.stringify(state));

// Restore
var saved = JSON.parse(localStorage.getItem('widget'));
var widget = LogitLensWidget("#viz", data, saved);
```

### Linked Widgets for Comparison

When comparing two models on the same prompt, linking their columns ensures they stay synchronized. This example creates two widgets side by side and links their column sizing so resizing one automatically resizes the other.

```javascript
var widget1 = LogitLensWidget("#viz1", data1, { title: "Llama 8B" });
var widget2 = LogitLensWidget("#viz2", data2, { title: "Llama 70B" });

// Resize either widget and both update
widget1.linkColumnsTo(widget2);

// Later, unlink
widget1.unlinkColumns(widget2);
```

### Duplicate Widget

You can create an exact copy of a widget—including all user customizations—by passing the first widget's state to a new widget constructor. This is useful for creating a snapshot of the current view or for A/B comparisons with identical starting points.

```javascript
var widget1 = LogitLensWidget("#viz1", data);
// ... user interacts, changes settings ...

// Create identical copy with same pinned tokens, column widths, etc.
var widget2 = LogitLensWidget("#viz2", data, widget1.getState());
```

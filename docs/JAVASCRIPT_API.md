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

---

## Extended API

The widget provides an extended API for programmatic control beyond the basic initialization and state management. These methods allow you to build interactive applications that coordinate multiple widgets, respond to user actions, and dynamically update the visualization.

### Event System

The widget implements an event emitter pattern that lets you respond to user interactions and state changes. This is essential for building coordinated multi-widget dashboards or integrating the widget with other UI components.

#### `on(event, callback)`

```javascript
widget.on('hover', function(pos) {
    console.log('User is hovering over position:', pos);
});
```

Registers a callback function to be called when the specified event fires. The callback receives event-specific data as its argument. Returns the widget instance for method chaining.

**Available events:**

| Event | Callback Argument | When Fired |
|-------|-------------------|------------|
| `hover` | position (number) | Mouse enters a different row |
| `title` | title (string) | Title is changed via API or user edit |
| `colorModes` | modes (array) | Color modes change |
| `pinnedRows` | rows (array) | Pinned rows change |
| `pinnedGroups` | groups (array) | Token groups change |
| `trajectoryMetric` | metric (string) | Chart Y-axis metric changes |
| `showHeatmap` | show (boolean) | Heatmap visibility changes |
| `showChart` | show (boolean) | Chart visibility changes |

**Why use events?** Events enable loose coupling between widgets and your application code. Instead of polling for changes or wrapping user interactions, you can simply subscribe to the events you care about. This is particularly useful for:

- Synchronizing hover states across multiple widgets showing related data
- Updating external UI elements when the user pins tokens or changes settings
- Logging user interactions for analytics or debugging
- Building "linked views" where selections in one widget filter another

#### `off(event, callback)`

```javascript
var myListener = function(pos) { /* ... */ };
widget.on('hover', myListener);
// Later...
widget.off('hover', myListener);
```

Removes a previously registered event listener. You must pass the exact same function reference that was used with `on()`. Returns the widget instance for method chaining.

---

### Visibility Controls

The widget provides fine-grained control over which visual elements are displayed. These methods are useful for creating simplified views, responsive layouts, or progressive disclosure interfaces.

#### `setShowHeatmap(show)` / `getShowHeatmap()`

```javascript
// Create a "clean" view without colored cells
widget.setShowHeatmap(false);

// Check current state
if (widget.getShowHeatmap()) {
    console.log('Heatmap coloring is enabled');
}
```

Controls whether the probability heatmap coloring is applied to prediction cells. When disabled, cells display a neutral background color while still showing the predicted token text. This is useful when you want to focus attention on the token text itself rather than the probability gradients, or when creating screenshots for publication where colors might not reproduce well.

The heatmap toggle only affects the cell background colors—the trajectory chart and all other functionality remains active. Users can still click cells to see popups and pin tokens for comparison.

#### `setShowChart(show)` / `getShowChart()`

```javascript
// Hide the trajectory chart to save space
widget.setShowChart(false);

// Show it again
widget.setShowChart(true);
```

Controls the visibility of the trajectory chart below the table. Hiding the chart can be useful when screen space is limited, when you're embedding the widget in a constrained layout, or when the chart isn't relevant for your specific analysis. The chart container is completely hidden (not just collapsed), so the table expands to fill the available space.

Even when the chart is hidden, trajectory data is still computed and available. If you show the chart again, it will display whatever tokens and rows were pinned.

---

### Trajectory Metrics

By default, the trajectory chart shows how token **probabilities** evolve across layers. For some analyses, it's more informative to see how the token's **rank** changes—whether the model is moving the token up or down in its preference ordering.

#### `setTrajectoryMetric(metric)` / `getTrajectoryMetric()`

```javascript
// Switch to rank-based display
widget.setTrajectoryMetric('rank');

// Check current metric
var metric = widget.getTrajectoryMetric(); // 'probability' or 'rank'
```

Changes what the Y-axis of the trajectory chart displays:

- **`'probability'`** (default): Y-axis shows probability values from 0% to the maximum observed. Higher on the chart means higher probability.
- **`'rank'`**: Y-axis shows the token's rank position (1 = top prediction). Rank 1 appears at the top of the chart, with higher rank numbers (worse predictions) appearing lower.

**Why use rank mode?** Probability mode can be misleading when comparing tokens with very different probability scales. A token might be "climbing" from rank 50 to rank 2 while its raw probability stays small. Rank mode reveals this improvement clearly. It's also useful when comparing models with different calibration—their probability scales may differ, but rank provides a normalized comparison.

When switching to rank mode, the chart automatically adjusts its Y-axis label and scale. The scale is determined by the tokens visible in the topk lists at each layer. If a token falls outside the topk at a particular layer, its rank may not be available for that point.

---

### Hover Synchronization

For multi-widget dashboards comparing the same prompt across different models, you often want hover states to be synchronized—hovering over a position in one widget should highlight the corresponding position in all related widgets. The hover API enables this coordination.

#### `hoverRow(pos)` / `clearHover()` / `getHoveredRow()`

```javascript
// Programmatically set hover position
widget.hoverRow(3);  // Hover over position 3

// Reset to default (last position)
widget.clearHover();

// Query current hover
var pos = widget.getHoveredRow();  // Returns position number
```

These methods allow external control of the hover state. When you call `hoverRow()`, the widget updates its visual highlighting as if the user had moved their mouse to that row. The trajectory chart preview updates accordingly.

**Building synchronized widgets:**

```javascript
var w1 = LogitLensWidget("#viz1", llamaData);
var w2 = LogitLensWidget("#viz2", gptData);

// When user hovers in widget 1, update widget 2
w1.on('hover', function(pos) {
    w2.hoverRow(pos);
});

// And vice versa
w2.on('hover', function(pos) {
    w1.hoverRow(pos);
});
```

This pattern creates a "linked hover" experience where moving the mouse in either widget highlights the corresponding position in both. Combined with `linkColumnsTo()` for sizing, this provides a fully synchronized comparison view.

---

### Title Management

The widget title appears above the table and can be edited by clicking on it. The title API provides programmatic access to this feature.

#### `setTitle(title)` / `getTitle()`

```javascript
// Set a descriptive title
widget.setTitle('GPT-4: "The capital of France is"');

// Read current title
var currentTitle = widget.getTitle();
```

The title is displayed prominently at the top of the widget and helps users understand what they're looking at. When you have multiple widgets on a page, distinct titles are essential for orientation.

Title changes fire the `title` event, so you can track when users edit titles or update external UI elements accordingly.

---

### Color Mode API

Color modes control how prediction cells are shaded. The widget can highlight cells based on the probability of the top prediction, a specific token, entropy (uncertainty), or no coloring at all. Multiple color modes can be active simultaneously, with the highest-probability mode "winning" for each cell.

#### `setColorModes(modes)` / `getColorModes()`

```javascript
// Show only top-prediction coloring
widget.setColorModes(['top']);

// Color by a specific token
widget.setColorModes(['Paris', ' Paris']);

// Multiple modes: cells colored by whichever has higher probability
widget.setColorModes(['top', 'Paris']);

// Show entropy (uncertainty) coloring
widget.setColorModes(['entropy']);

// No coloring
widget.setColorModes([]);
```

The modes array can contain:
- `'top'`: Color by top-1 prediction probability (default purple gradient)
- `'entropy'`: Color by entropy/uncertainty (purple gradient, requires entropy data)
- Token strings: Color by that specific token's probability
- Empty array: No cell coloring

When multiple modes are specified, each cell is colored according to whichever mode has the highest value at that cell. This creates a "competition" visualization showing where different tokens dominate.

#### `addColorMode(mode)` / `removeColorMode(mode)`

```javascript
// Add entropy coloring alongside existing modes
widget.addColorMode('entropy');

// Remove a specific mode
widget.removeColorMode('top');
```

Convenience methods for modifying the color modes without replacing the entire array. Useful when building UI controls that toggle individual modes on and off.

**Entropy coloring:** The `'entropy'` mode is only available when the data includes entropy values (see Data Format). Entropy indicates the model's uncertainty at each position and layer—high entropy means the model is torn between many options, while low entropy means it's confident in its prediction. The entropy color mode uses a purple gradient where darker colors indicate higher uncertainty.

---

### Row and Group Manipulation

Pinned rows and token groups are core to the widget's analytical capability. The manipulation API provides programmatic control over what's being compared.

#### `getPinnedRows()` / `setPinnedRows(rows)` / `togglePinnedRow(pos)`

```javascript
// Get currently pinned rows
var rows = widget.getPinnedRows();
// Returns: [{pos: 4, line: 'solid'}, {pos: 2, line: 'dashed'}]

// Set specific rows to pin
widget.setPinnedRows([
    { pos: 0, line: 'solid' },
    { pos: 3, line: 'dashed' }
]);

// Toggle a single row
widget.togglePinnedRow(2);  // Pins if unpinned, unpins if pinned
```

Pinned rows determine which input positions have their trajectories shown in the chart. Each pinned row gets a distinct line style (solid, dashed, or dotted) to distinguish them visually. The `line` property in each row object controls this styling.

**Smart row visibility:** When the widget has a `maxRows` constraint (limiting how many rows are visible), pinned rows are guaranteed to remain visible. The widget uses a smart algorithm that prioritizes showing pinned rows, then fills remaining space with the most recent unpinned rows. This ensures that rows you've explicitly marked as important never get hidden.

#### `getPinnedGroups()` / `setPinnedGroups(groups)`

```javascript
// Get currently pinned token groups
var groups = widget.getPinnedGroups();
// Returns: [{tokens: ['Paris', ' Paris'], color: '#ff5722'}]

// Set specific groups
widget.setPinnedGroups([
    { tokens: ['Paris', ' Paris'], color: '#4caf50' },
    { tokens: ['London', ' London'], color: '#2196f3' }
]);
```

Token groups allow comparing multiple tokens' trajectories. Each group has a color and a list of tokens. The trajectory shown for a group is the sum of probabilities for all tokens in that group—useful for aggregating variants like `'Paris'` and `' Paris'` (with leading space).

#### `pinToken(token, options)` / `unpinToken(token)`

```javascript
// Pin a token with a specific color
widget.pinToken('Paris', { color: '#ff5722' });

// Pin with default color
widget.pinToken('London');

// Remove a token from all groups
widget.unpinToken('Paris');
```

Higher-level methods for working with individual tokens. `pinToken()` creates a new group containing just that token (or adds to an existing group if using modifier keys). `unpinToken()` removes the token from whatever group it's in.

---

### Data Capability Detection

Different datasets may include different types of information. These methods let you query what capabilities are available, so you can conditionally enable UI features or avoid errors from missing data.

#### `hasEntropyData()`

```javascript
if (widget.hasEntropyData()) {
    // Safe to use entropy color mode
    widget.addColorMode('entropy');
} else {
    console.log('This dataset does not include entropy values');
}
```

Returns `true` if the data includes entropy values for each cell. Entropy is calculated during data collection by the Python library and represents the uncertainty of the probability distribution at each layer and position. Not all datasets include this information.

#### `hasRankData()`

```javascript
if (widget.hasRankData()) {
    // Can show rank-based trajectories
    widget.setTrajectoryMetric('rank');
}
```

Returns `true` if the data includes explicit rank information for tracked tokens. When rank data isn't available, the widget can still compute approximate ranks from the topk lists, but this may be less accurate for tokens that frequently fall outside the topk.

#### `isTokenTracked(token, pos)`

```javascript
if (widget.isTokenTracked('Paris', 4)) {
    console.log('"Paris" has trajectory data at position 4');
} else {
    console.log('"Paris" is not in the topk at position 4');
}
```

Checks whether a specific token has trajectory data at a given position. Trajectory data is only available for tokens that appear in the topk lists at that position. This method returns `true` if the token can be meaningfully visualized at that position, `false` otherwise.

This is useful for building UI that suggests or validates token selections—you can check whether pinning a token will actually show useful data before doing so.

---

### Method Chaining

All setter methods return the widget instance, enabling fluent method chaining:

```javascript
widget
    .setTitle('Analysis of GPT-4')
    .setShowChart(true)
    .setShowHeatmap(true)
    .setColorModes(['top', 'entropy'])
    .setTrajectoryMetric('probability')
    .on('hover', handleHover)
    .on('title', handleTitleChange);
```

This pattern is convenient for configuration and setup code, reducing the number of separate statements needed.

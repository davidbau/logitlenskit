# JavaScript API Reference

## Installation

```bash
cd js
npm install
```

For browser use, include the script directly:

```html
<script src="https://davidbau.github.io/logitlenskit/js/src/logit-lens-widget.js"></script>
```

## Quick Start

```javascript
// Create widget
var widget = LogitLensWidget("#container", data);

// With custom title
var widget = LogitLensWidget("#container", data, { title: "My Analysis" });

// Link two widgets for synchronized column sizing
widget1.linkColumnsTo(widget2);
```

---

## LogitLensWidget

```javascript
LogitLensWidget(container, data, uiState)
```

Create an interactive logit lens visualization widget.

### Parameters

#### `container` (string | Element) - required

Where to render the widget:
- CSS selector: `"#myDiv"`, `".container"`, `"#main .viz"`
- DOM Element: `document.getElementById("myDiv")`

#### `data` (Object) - required

Logit lens data with structure:

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

Saved UI state to restore:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `title` | string | "Logit Lens: Top Predictions by Layer" | Widget title |
| `cellWidth` | number | 44 | Column width in pixels |
| `inputTokenWidth` | number | 100 | Input token column width |
| `chartHeight` | number | 140 | SVG chart height (60-400) |
| `maxRows` | number | null | Max visible rows (null = all) |
| `maxTableWidth` | number | null | Max table width (null = fit) |
| `colorMode` | string | "top" | "top", "none", or token string |
| `pinnedGroups` | array | [] | Pinned token groups |
| `pinnedRows` | array | [] | Pinned input positions |

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

Returns only the column-related state (for linking).

### `setColumnState(state, fromSync)`

```javascript
widget.setColumnState({ cellWidth: 60, inputTokenWidth: 120 });
```

Update column sizing programmatically.

| Parameter | Type | Description |
|-----------|------|-------------|
| `state` | Object | Column state with cellWidth, inputTokenWidth, maxTableWidth |
| `fromSync` | boolean | Internal flag to prevent infinite loops when syncing |

### `linkColumnsTo(otherWidget)`

```javascript
widget1.linkColumnsTo(widget2);
```

Establish bidirectional column synchronization. When either widget's columns are resized, the other updates automatically.

**Synced properties**: `cellWidth`, `inputTokenWidth`, `maxTableWidth`

**Not synced**: `chartHeight`, `pinnedGroups`, `pinnedRows`, `colorMode`, `title`

### `unlinkColumns(otherWidget)`

```javascript
widget1.unlinkColumns(widget2);
```

Remove column synchronization between widgets.

---

## Interactive Features

### Table Gestures

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

| Gesture | Effect |
|---------|--------|
| **Click** token | Pin/unpin token trajectory (new group) |
| **Shift+Click** token | Add/remove from last active group |
| **Click** X button | Close popup |
| **Click** outside | Close popup |

### Token Pinning

Clicking a token in the popup pins it for persistent trajectory display:
- First pin creates a new colored group
- Shift+click adds tokens to existing group
- Similar tokens show grouping hints
- Pinned tokens' probabilities sum in trajectory

### Row Pinning

Clicking an input token pins that row:
- Each pinned row uses different line style (solid, dashed, dotted)
- Auto-pins highest probability token (>5%) at position
- Yellow background indicates pinned rows
- Enables multi-position comparison

### Color Modes

Access via "(colored by X)" button:
- **top prediction**: Cells colored by top-1 probability
- **[specific token]**: Cells colored by that token's probability
- **none**: All cells white

---

## Resize Handles

Hover over "showing every N layers..." to reveal all handles:

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

With many layers (e.g., 80 in Llama 70B), not all can display at once. The widget:
1. Computes how many columns fit given cell width and container
2. Shows evenly-spaced layers (e.g., "showing every 4 layers")
3. Dragging column borders adjusts stride dynamically

---

## CSS Scoping

Each widget injects scoped CSS using unique ID prefix (`#ll_interact_0`, etc.), allowing multiple independent widgets on the same page.

---

## Browser Compatibility

Requires modern browser with:
- CSS `:has()` selector (Chrome 105+, Safari 15.4+, Firefox 121+)
- ES6 template literals
- SVG support

---

## Examples

### Basic Usage

```javascript
var widget = LogitLensWidget("#viz", data);
```

### Custom Initial State

```javascript
var widget = LogitLensWidget("#viz", data, {
    title: "GPT-2: The quick brown fox",
    cellWidth: 50,
    chartHeight: 200,
    colorMode: "none"
});
```

### Save and Restore State

```javascript
// Save
var state = widget.getState();
localStorage.setItem('widget', JSON.stringify(state));

// Restore
var saved = JSON.parse(localStorage.getItem('widget'));
var widget = LogitLensWidget("#viz", data, saved);
```

### Linked Widgets for Comparison

```javascript
var widget1 = LogitLensWidget("#viz1", data1, { title: "Llama 8B" });
var widget2 = LogitLensWidget("#viz2", data2, { title: "Llama 70B" });

// Resize either widget and both update
widget1.linkColumnsTo(widget2);

// Later, unlink
widget1.unlinkColumns(widget2);
```

### Duplicate Widget

```javascript
var widget1 = LogitLensWidget("#viz1", data);
// ... user interacts, changes settings ...

// Create identical copy
var widget2 = LogitLensWidget("#viz2", data, widget1.getState());
```

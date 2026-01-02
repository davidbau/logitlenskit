# Data Flow Visualization Plan

## Goal
Create a companion visualization to the call graph that shows function ↔ state variable relationships.

## Design
- **Force-directed layout** (same interactive feel as call graph)
- **Two node types:**
  - Circles for functions
  - Rectangles or diamonds for state variables
- **Edge colors:**
  - Blue for reads
  - Red/orange for writes
- **Physics:** State nodes are "heavier" so they drift toward center, functions cluster around shared state
- **Fully draggable** - rearrange anything while exploring

## Implementation
1. Create `build-dataflow.js`:
   - Parse code to find closure variables (state)
   - For each function, track which variables it reads vs. writes
   - Build bipartite graph (functions ↔ state variables)
   - Track evolution over commits (like call graph)

2. Create `dataflow.html`:
   - D3.js force-directed visualization
   - Different shapes for functions vs. state
   - Colored edges for read/write
   - Timeline slider (like call graph)
   - Tooltips showing details

## What it reveals
- Which state is most "central" (touched by many functions)
- Which functions are pure readers vs. heavy mutators
- Natural clusters (functions sharing state = implicit modules)
- How data dependencies evolved over time

/**
 * LogitLensKit JavaScript Widget
 *
 * Interactive visualization for transformer logit lens analysis.
 * See https://davidbau.github.io/logitlenskit/ for live demo.
 */

// Import the widget (for bundler use)
// The widget is also available as a global when loaded via script tag

// Re-export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LogitLensWidget };
}

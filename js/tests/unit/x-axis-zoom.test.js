/**
 * Unit tests for x-axis zoom (plotMinLayer) feature
 */

var fs = require('fs');
var path = require('path');

// Load widget code
var widgetPath = path.join(__dirname, '../../src/logit-lens-widget.js');
var widgetCode = fs.readFileSync(widgetPath, 'utf8');
eval(widgetCode);

// Load test data with 12 layers
var fixturesPath = path.join(__dirname, '../fixtures/sample-data-12-layers.json');
var testData = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));

describe('X-Axis Zoom (plotMinLayer)', function() {
    beforeEach(function() {
        document.body.innerHTML = '<div id="container" style="width: 800px;"></div>';
    });

    afterEach(function() {
        document.body.innerHTML = '';
    });

    test('default plotMinLayer should be 0', function() {
        var widget = LogitLensWidget('#container', testData);
        var state = widget.getState();
        expect(state.plotMinLayer).toBe(0);
    });

    test('plotMinLayer should be included in getState', function() {
        var widget = LogitLensWidget('#container', testData);
        var state = widget.getState();
        expect(state).toHaveProperty('plotMinLayer');
        expect(typeof state.plotMinLayer).toBe('number');
    });

    test('plotMinLayer should be restorable from initial state', function() {
        // Create widget with custom plotMinLayer
        var initialState = { plotMinLayer: 5.5 };
        var widget = LogitLensWidget('#container', testData, initialState);

        var state = widget.getState();
        expect(state.plotMinLayer).toBe(5.5);
    });

    test('plotMinLayer state should round-trip correctly', function() {
        var widget1 = LogitLensWidget('#container', testData);

        // Manually set plotMinLayer via restoring state
        var customState = widget1.getState();
        customState.plotMinLayer = 3.7;

        // Create new widget with this state
        document.body.innerHTML = '<div id="container2" style="width: 800px;"></div>';
        var widget2 = LogitLensWidget('#container2', testData, customState);

        var restoredState = widget2.getState();
        expect(restoredState.plotMinLayer).toBeCloseTo(3.7, 1);
    });

    test('tick labels except last should be draggable', function() {
        var widget = LogitLensWidget('#container', testData);

        // Find tick groups with col-resize cursor
        var svg = document.querySelector('#container svg');
        if (!svg) return;

        var tickGroups = svg.querySelectorAll('g[style*="col-resize"]');
        // Should have draggable tick labels (not all layers shown, but those shown should be draggable)
        expect(tickGroups.length).toBeGreaterThan(0);
    });

    test('tick labels should have hover backgrounds', function() {
        var widget = LogitLensWidget('#container', testData);

        // Find tick hover backgrounds
        var svg = document.querySelector('#container svg');
        if (!svg) return;

        var hoverBgs = svg.querySelectorAll('.tick-hover-bg');
        // Should have hover backgrounds for draggable ticks
        expect(hoverBgs.length).toBeGreaterThan(0);

        // Check that they start hidden
        hoverBgs.forEach(function(bg) {
            expect(bg.style.display).toBe('none');
        });
    });

    test('x-axis should have hover background', function() {
        var widget = LogitLensWidget('#container', testData);

        var svg = document.querySelector('#container svg');
        if (!svg) return;

        var xAxisHoverBg = svg.querySelector('.xaxis-hover-bg');
        expect(xAxisHoverBg).not.toBeNull();
        expect(xAxisHoverBg.style.display).toBe('none');
    });

    test('y-axis should have hover background', function() {
        var widget = LogitLensWidget('#container', testData);

        var svg = document.querySelector('#container svg');
        if (!svg) return;

        var yAxisHoverBg = svg.querySelector('.yaxis-hover-bg');
        expect(yAxisHoverBg).not.toBeNull();
        expect(yAxisHoverBg.style.display).toBe('none');
    });

    test('plotMinLayer should be clamped to valid range', function() {
        // Create widget with out-of-range plotMinLayer (should be clamped)
        var initialState = { plotMinLayer: -5 };
        var widget = LogitLensWidget('#container', testData, initialState);

        var state = widget.getState();
        // Negative values should be clamped to 0
        expect(state.plotMinLayer).toBeGreaterThanOrEqual(0);
    });

    test('plotMinLayer should not exceed nLayers - 1', function() {
        // Create widget with plotMinLayer too high
        var initialState = { plotMinLayer: 100 };
        var widget = LogitLensWidget('#container', testData, initialState);

        var state = widget.getState();
        // Should be clamped to less than nLayers - 1
        expect(state.plotMinLayer).toBeLessThan(testData.layers.length - 1);
    });
});

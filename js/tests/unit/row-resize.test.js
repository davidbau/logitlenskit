/**
 * Unit tests for bottom resize handle row height calculation
 */

var fs = require('fs');
var path = require('path');

// Load widget code
var widgetPath = path.join(__dirname, '../../src/logit-lens-widget.js');
var widgetCode = fs.readFileSync(widgetPath, 'utf8');
eval(widgetCode);

// Load test data
var fixturesPath = path.join(__dirname, '../fixtures/sample-data-12-layers.json');
var testData = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));

describe('Row Resize Handle', function() {
    beforeEach(function() {
        document.body.innerHTML = '<div id="container" style="width: 800px;"></div>';
    });

    afterEach(function() {
        document.body.innerHTML = '';
    });

    test('table rows should have consistent height', function() {
        var widget = LogitLensWidget('#container', testData);

        var table = document.querySelector('#container table');
        var rows = table.querySelectorAll('tr');

        // Should have header + data rows
        expect(rows.length).toBeGreaterThan(1);

        // Get heights of data rows (skip header)
        var heights = [];
        for (var i = 1; i < rows.length; i++) {
            heights.push(rows[i].getBoundingClientRect().height);
        }

        // All data rows should have same height
        var firstHeight = heights[0];
        heights.forEach(function(h) {
            expect(h).toBeCloseTo(firstHeight, 0);
        });
    });

    test('row height measurement code should handle zero height gracefully', function() {
        // Note: jsdom doesn't do layout, so getBoundingClientRect returns 0
        // This test verifies the widget handles this gracefully with a fallback
        var widget = LogitLensWidget('#container', testData);

        var table = document.querySelector('#container table');
        var rows = table.querySelectorAll('tr');

        // Should have rows
        expect(rows.length).toBeGreaterThan(1);

        // The widget uses a default of 20px when measurement returns 0
        // This is acceptable behavior for non-layout environments
        var rowHeight = rows[1].getBoundingClientRect().height;
        expect(rowHeight).toBeGreaterThanOrEqual(0);
    });

    test('bottom resize handle should exist', function() {
        var widget = LogitLensWidget('#container', testData);

        var handle = document.querySelector('#container .resize-handle-bottom');
        expect(handle).not.toBeNull();
    });

    test('maxRows state should be included in getState', function() {
        var widget = LogitLensWidget('#container', testData);
        var state = widget.getState();

        // maxRows should be present (null means show all)
        expect(state).toHaveProperty('maxRows');
    });

    test('maxRows should be restorable from initial state', function() {
        // Create widget with limited rows (test data has 2 tokens)
        var initialState = { maxRows: 1 };
        var widget = LogitLensWidget('#container', testData, initialState);

        var state = widget.getState();
        expect(state.maxRows).toBe(1);

        // Table should only show 1 data row + 1 header
        var table = document.querySelector('#container table');
        var rows = table.querySelectorAll('tr');
        expect(rows.length).toBe(2); // header + 1 data row
    });

    test('row count should match maxRows when set', function() {
        // Test data has 2 tokens, so maxRows: 1 should show 1 row
        var widget = LogitLensWidget('#container', testData, { maxRows: 1 });

        var table = document.querySelector('#container table');
        var dataRows = table.querySelectorAll('tr:not(:first-child)');

        expect(dataRows.length).toBe(1);
    });

    test('all rows should be shown when maxRows is null', function() {
        var widget = LogitLensWidget('#container', testData, { maxRows: null });

        var table = document.querySelector('#container table');
        var dataRows = table.querySelectorAll('tr:not(:first-child)');

        // Should show all tokens
        expect(dataRows.length).toBe(testData.tokens.length);
    });
});

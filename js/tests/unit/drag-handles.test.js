/**
 * Unit tests for drag handle interactions
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

// Helper to create and dispatch mouse events
function simulateDrag(element, startX, startY, endX, endY) {
    var mousedown = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: startX,
        clientY: startY
    });
    element.dispatchEvent(mousedown);

    var mousemove = new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: endX,
        clientY: endY
    });
    document.dispatchEvent(mousemove);

    var mouseup = new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        clientX: endX,
        clientY: endY
    });
    document.dispatchEvent(mouseup);
}

describe('Column Resize Handle Drag', function() {
    beforeEach(function() {
        document.body.innerHTML = '<div id="container" style="width: 800px;"></div>';
    });

    afterEach(function() {
        document.body.innerHTML = '';
    });

    test('dragging column handle right should increase cellWidth', function() {
        var widget = LogitLensWidget('#container', testData);
        var initialState = widget.getState();
        var initialCellWidth = initialState.cellWidth;

        // Find a column resize handle
        var handle = document.querySelector('#container .resize-handle');
        expect(handle).not.toBeNull();

        // Simulate drag to the right (increase width)
        simulateDrag(handle, 100, 50, 200, 50);

        var newState = widget.getState();
        expect(newState.cellWidth).toBeGreaterThan(initialCellWidth);
    });

    test('dragging column handle left should decrease cellWidth', function() {
        var widget = LogitLensWidget('#container', testData, { cellWidth: 80 });
        var initialState = widget.getState();
        var initialCellWidth = initialState.cellWidth;

        var handle = document.querySelector('#container .resize-handle');
        expect(handle).not.toBeNull();

        // Simulate drag to the left (decrease width)
        simulateDrag(handle, 200, 50, 100, 50);

        var newState = widget.getState();
        expect(newState.cellWidth).toBeLessThan(initialCellWidth);
    });

    test('cellWidth should be clamped to min value', function() {
        var widget = LogitLensWidget('#container', testData, { cellWidth: 50 });

        var handle = document.querySelector('#container .resize-handle');
        expect(handle).not.toBeNull();

        // Simulate large drag to the left
        simulateDrag(handle, 200, 50, 0, 50);

        var newState = widget.getState();
        // minCellWidth is 10
        expect(newState.cellWidth).toBeGreaterThanOrEqual(10);
    });

    test('cellWidth should be clamped to max value', function() {
        var widget = LogitLensWidget('#container', testData, { cellWidth: 100 });

        var handle = document.querySelector('#container .resize-handle');
        expect(handle).not.toBeNull();

        // Simulate large drag to the right
        simulateDrag(handle, 100, 50, 1000, 50);

        var newState = widget.getState();
        // maxCellWidth is 200
        expect(newState.cellWidth).toBeLessThanOrEqual(200);
    });

    test('handle should get dragging class during drag', function() {
        var widget = LogitLensWidget('#container', testData);

        var handle = document.querySelector('#container .resize-handle');
        expect(handle).not.toBeNull();
        expect(handle.classList.contains('dragging')).toBe(false);

        // Start drag
        var mousedown = new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            clientX: 100,
            clientY: 50
        });
        handle.dispatchEvent(mousedown);

        expect(handle.classList.contains('dragging')).toBe(true);

        // End drag
        var mouseup = new MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(mouseup);

        expect(handle.classList.contains('dragging')).toBe(false);
    });
});

describe('Input Column Resize Handle Drag', function() {
    beforeEach(function() {
        document.body.innerHTML = '<div id="container" style="width: 800px;"></div>';
    });

    afterEach(function() {
        document.body.innerHTML = '';
    });

    test('dragging input handle right should increase inputTokenWidth', function() {
        var widget = LogitLensWidget('#container', testData);
        var initialState = widget.getState();
        var initialWidth = initialState.inputTokenWidth;

        var handle = document.querySelector('#container .resize-handle-input');
        expect(handle).not.toBeNull();

        // Simulate drag to the right
        simulateDrag(handle, 100, 50, 150, 50);

        var newState = widget.getState();
        expect(newState.inputTokenWidth).toBeGreaterThan(initialWidth);
    });

    test('dragging input handle left should decrease inputTokenWidth', function() {
        var widget = LogitLensWidget('#container', testData, { inputTokenWidth: 100 });
        var initialState = widget.getState();
        var initialWidth = initialState.inputTokenWidth;

        var handle = document.querySelector('#container .resize-handle-input');
        expect(handle).not.toBeNull();

        // Simulate drag to the left
        simulateDrag(handle, 150, 50, 100, 50);

        var newState = widget.getState();
        expect(newState.inputTokenWidth).toBeLessThan(initialWidth);
    });

    test('inputTokenWidth should be clamped to min value', function() {
        var widget = LogitLensWidget('#container', testData, { inputTokenWidth: 60 });

        var handle = document.querySelector('#container .resize-handle-input');
        expect(handle).not.toBeNull();

        // Simulate large drag to the left
        simulateDrag(handle, 200, 50, 0, 50);

        var newState = widget.getState();
        // min is 40
        expect(newState.inputTokenWidth).toBeGreaterThanOrEqual(40);
    });

    test('inputTokenWidth should be clamped to max value', function() {
        var widget = LogitLensWidget('#container', testData, { inputTokenWidth: 100 });

        var handle = document.querySelector('#container .resize-handle-input');
        expect(handle).not.toBeNull();

        // Simulate large drag to the right
        simulateDrag(handle, 100, 50, 500, 50);

        var newState = widget.getState();
        // max is 200
        expect(newState.inputTokenWidth).toBeLessThanOrEqual(200);
    });
});

describe('Bottom Resize Handle Drag', function() {
    beforeEach(function() {
        document.body.innerHTML = '<div id="container" style="width: 800px;"></div>';
    });

    afterEach(function() {
        document.body.innerHTML = '';
    });

    test('bottom resize handle should exist', function() {
        var widget = LogitLensWidget('#container', testData);

        var handle = document.querySelector('#container .resize-handle-bottom');
        expect(handle).not.toBeNull();
    });

    test('dragging bottom handle up should decrease maxRows', function() {
        // Start with all rows visible (maxRows = null)
        var widget = LogitLensWidget('#container', testData, { maxRows: null });
        var initialState = widget.getState();
        expect(initialState.maxRows).toBeNull();

        var handle = document.querySelector('#container .resize-handle-bottom');
        expect(handle).not.toBeNull();

        // Simulate drag up (negative Y delta) - in jsdom, measuredRowHeight defaults to 20
        // So dragging up by 40 pixels should reduce by 2 rows
        simulateDrag(handle, 100, 100, 100, 60);

        var newState = widget.getState();
        // Should now have a limited number of rows
        expect(newState.maxRows).not.toBeNull();
        expect(newState.maxRows).toBeLessThan(testData.tokens.length);
    });

    test('dragging bottom handle down should increase maxRows', function() {
        // Start with limited rows
        var widget = LogitLensWidget('#container', testData, { maxRows: 1 });
        var initialState = widget.getState();
        expect(initialState.maxRows).toBe(1);

        var handle = document.querySelector('#container .resize-handle-bottom');
        expect(handle).not.toBeNull();

        // Simulate drag down (positive Y delta)
        simulateDrag(handle, 100, 100, 100, 160);

        var newState = widget.getState();
        // Should have more rows now (or null if showing all)
        if (newState.maxRows !== null) {
            expect(newState.maxRows).toBeGreaterThan(1);
        }
    });

    test('maxRows should be clamped to at least 1', function() {
        var widget = LogitLensWidget('#container', testData, { maxRows: 2 });

        var handle = document.querySelector('#container .resize-handle-bottom');
        expect(handle).not.toBeNull();

        // Simulate very large drag up
        simulateDrag(handle, 100, 100, 100, -1000);

        var newState = widget.getState();
        expect(newState.maxRows).toBeGreaterThanOrEqual(1);
    });

    test('handle should get dragging class during drag', function() {
        var widget = LogitLensWidget('#container', testData);

        var handle = document.querySelector('#container .resize-handle-bottom');
        expect(handle.classList.contains('dragging')).toBe(false);

        // Start drag
        var mousedown = new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            clientX: 100,
            clientY: 100
        });
        handle.dispatchEvent(mousedown);

        expect(handle.classList.contains('dragging')).toBe(true);

        // End drag
        var mouseup = new MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(mouseup);

        expect(handle.classList.contains('dragging')).toBe(false);
    });
});

describe('Right Edge Resize Handle Drag', function() {
    beforeEach(function() {
        document.body.innerHTML = '<div id="container" style="width: 800px;"></div>';
    });

    afterEach(function() {
        document.body.innerHTML = '';
    });

    test('right resize handle should exist', function() {
        var widget = LogitLensWidget('#container', testData);

        var handle = document.querySelector('#container .resize-handle-right');
        expect(handle).not.toBeNull();
    });

    test('dragging right handle should trigger drag state', function() {
        var widget = LogitLensWidget('#container', testData);

        var handle = document.querySelector('#container .resize-handle-right');
        expect(handle).not.toBeNull();

        // Note: In jsdom, offsetWidth returns 0 so actual resize calculation
        // may not produce meaningful results. We verify the drag mechanism works.

        // Simulate drag to the left
        simulateDrag(handle, 700, 100, 500, 100);

        // The widget should still function (no errors thrown)
        var newState = widget.getState();
        expect(newState).toHaveProperty('maxTableWidth');
    });

    test('handle should get dragging class during drag', function() {
        var widget = LogitLensWidget('#container', testData);

        var handle = document.querySelector('#container .resize-handle-right');
        expect(handle.classList.contains('dragging')).toBe(false);

        // Start drag
        var mousedown = new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            clientX: 700,
            clientY: 100
        });
        handle.dispatchEvent(mousedown);

        expect(handle.classList.contains('dragging')).toBe(true);

        // End drag
        var mouseup = new MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(mouseup);

        expect(handle.classList.contains('dragging')).toBe(false);
    });
});

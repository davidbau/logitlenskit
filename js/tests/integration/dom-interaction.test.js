/**
 * Integration tests for DOM interactions
 */

var fs = require('fs');
var path = require('path');

// Load widget code
var widgetPath = path.join(__dirname, '../../src/logit-lens-widget.js');
var widgetCode = fs.readFileSync(widgetPath, 'utf8');
eval(widgetCode);

// Load test data
var fixturesPath = path.join(__dirname, '../fixtures/sample-data-small.json');
var testData = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));

describe('DOM Interaction Tests', function() {
    beforeEach(function() {
        document.body.innerHTML = '<div id="container"></div>';
    });

    afterEach(function() {
        document.body.innerHTML = '';
    });

    test('clicking a cell should show popup', function() {
        var widget = LogitLensWidget('#container', testData);

        // Find a prediction cell (not an input token)
        var cell = document.querySelector('.pred-cell');
        expect(cell).not.toBeNull();

        // Click it
        cell.click();

        // Check for popup (should appear in DOM)
        var popup = document.querySelector('.popup');
        expect(popup).not.toBeNull();
        // Popup should be visible
        expect(popup.style.display).not.toBe('none');
    });

    test('clicking popup close button should close it', function() {
        var widget = LogitLensWidget('#container', testData);

        // Open popup
        var cell = document.querySelector('.pred-cell');
        cell.click();

        // Verify popup exists and has visible class
        var popup = document.querySelector('.popup');
        expect(popup).not.toBeNull();
        expect(popup.classList.contains('visible')).toBe(true);

        // Click close button
        var closeBtn = document.querySelector('.popup-close');
        closeBtn.click();

        // Popup should lose visible class
        expect(popup.classList.contains('visible')).toBe(false);
    });

    test('widget should render all tokens', function() {
        var widget = LogitLensWidget('#container', testData);

        // Get input tokens
        var inputTokens = document.querySelectorAll('.input-token');
        expect(inputTokens.length).toBe(testData.tokens.length);
    });

    test('widget should render all layers in header', function() {
        var widget = LogitLensWidget('#container', testData);

        // Get layer headers
        var layerHeaders = document.querySelectorAll('.layer-hdr');
        expect(layerHeaders.length).toBe(testData.layers.length);
    });

    test('title should be displayed when provided', function() {
        var customTitle = 'Test Visualization';
        var widget = LogitLensWidget('#container', testData, { title: customTitle });

        var titleElement = document.querySelector('.ll-title');
        expect(titleElement).not.toBeNull();
        expect(titleElement.textContent).toContain(customTitle);
    });

    test('getColumnState and setColumnState round trip', function() {
        var widget = LogitLensWidget('#container', testData, { cellWidth: 70 });

        var state1 = widget.getColumnState();
        expect(state1.cellWidth).toBe(70);

        // Modify state
        widget.setColumnState({ cellWidth: 90 });

        var state2 = widget.getColumnState();
        expect(state2.cellWidth).toBe(90);
    });

    test('widget table should have correct dimensions', function() {
        var widget = LogitLensWidget('#container', testData);

        // Get all rows (tokens)
        var rows = document.querySelectorAll('.ll-table tr');
        // Should have header row + token rows
        expect(rows.length).toBeGreaterThan(testData.tokens.length);

        // Each row should have correct number of cells
        var firstDataRow = rows[1]; // Skip header
        var cells = firstDataRow.querySelectorAll('td');
        // Input token + layer cells
        expect(cells.length).toBe(1 + testData.layers.length);
    });
});

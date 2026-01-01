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

    test('clicking different cell while popup open should only dismiss popup', function() {
        var widget = LogitLensWidget('#container', testData);

        // Get two different cells
        var cells = document.querySelectorAll('.pred-cell');
        expect(cells.length).toBeGreaterThan(1);
        var cell1 = cells[0];
        var cell2 = cells[1];

        // Click first cell to open popup
        cell1.click();

        // Verify popup is visible
        var popup = document.querySelector('.popup');
        expect(popup.classList.contains('visible')).toBe(true);
        expect(cell1.classList.contains('selected')).toBe(true);

        // Click second cell - should dismiss popup, not open new one
        cell2.click();

        // Popup should be closed
        expect(popup.classList.contains('visible')).toBe(false);
        // Neither cell should be selected
        expect(cell1.classList.contains('selected')).toBe(false);
        expect(cell2.classList.contains('selected')).toBe(false);

        // Click second cell again - now it should open popup
        cell2.click();
        expect(popup.classList.contains('visible')).toBe(true);
        expect(cell2.classList.contains('selected')).toBe(true);
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

describe('Popup Overlay Tests', function() {
    beforeEach(function() {
        document.body.innerHTML = '<div id="container"></div>';
    });

    afterEach(function() {
        document.body.innerHTML = '';
    });

    test('overlay should be created when popup opens', function() {
        var widget = LogitLensWidget('#container', testData);

        // Initially no overlay
        var overlay = document.querySelector('[id$="_overlay"]');
        expect(overlay).toBeNull();

        // Open popup by clicking a cell
        var cell = document.querySelector('.pred-cell');
        cell.click();

        // Overlay should exist
        overlay = document.querySelector('[id$="_overlay"]');
        expect(overlay).not.toBeNull();
        expect(overlay.style.position).toBe('fixed');
    });

    test('clicking overlay should dismiss popup', function() {
        var widget = LogitLensWidget('#container', testData);

        // Open popup
        var cell = document.querySelector('.pred-cell');
        cell.click();

        var popup = document.querySelector('.popup');
        expect(popup.classList.contains('visible')).toBe(true);

        // Click on overlay
        var overlay = document.querySelector('[id$="_overlay"]');
        overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

        // Popup should be dismissed
        expect(popup.classList.contains('visible')).toBe(false);
    });

    test('overlay should be removed when popup is dismissed', function() {
        var widget = LogitLensWidget('#container', testData);

        // Open popup
        var cell = document.querySelector('.pred-cell');
        cell.click();

        // Overlay exists
        var overlay = document.querySelector('[id$="_overlay"]');
        expect(overlay).not.toBeNull();

        // Click overlay to dismiss
        overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

        // Overlay should be removed
        overlay = document.querySelector('[id$="_overlay"]');
        expect(overlay).toBeNull();
    });

    test('closing popup via close button should also remove overlay', function() {
        var widget = LogitLensWidget('#container', testData);

        // Open popup
        var cell = document.querySelector('.pred-cell');
        cell.click();

        // Overlay exists
        var overlay = document.querySelector('[id$="_overlay"]');
        expect(overlay).not.toBeNull();

        // Click close button
        var closeBtn = document.querySelector('.popup-close');
        closeBtn.click();

        // Overlay should be removed
        overlay = document.querySelector('[id$="_overlay"]');
        expect(overlay).toBeNull();
    });
});

/**
 * Unit tests for multi-select color modes feature
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

describe('Color Modes Multi-Select', function() {
    beforeEach(function() {
        document.body.innerHTML = '<div id="container" style="width: 800px;"></div>';
    });

    afterEach(function() {
        document.body.innerHTML = '';
    });

    test('default colorModes should be ["top"]', function() {
        var widget = LogitLensWidget('#container', testData);
        var state = widget.getState();

        expect(state.colorModes).toEqual(['top']);
    });

    test('colorModes should be an array in getState', function() {
        var widget = LogitLensWidget('#container', testData);
        var state = widget.getState();

        expect(Array.isArray(state.colorModes)).toBe(true);
    });

    test('colorModes should be restorable from initial state', function() {
        var initialState = { colorModes: ['top', 'foo'] };
        var widget = LogitLensWidget('#container', testData, initialState);

        var state = widget.getState();
        expect(state.colorModes).toEqual(['top', 'foo']);
    });

    test('empty colorModes array means none selected', function() {
        var widget = LogitLensWidget('#container', testData, { colorModes: [] });

        var state = widget.getState();
        expect(state.colorModes).toEqual([]);
    });

    test('backward compat: old colorMode string should convert to array', function() {
        var widget = LogitLensWidget('#container', testData, { colorMode: 'top' });

        var state = widget.getState();
        expect(state.colorModes).toEqual(['top']);
    });

    test('backward compat: colorMode "none" should convert to empty array', function() {
        var widget = LogitLensWidget('#container', testData, { colorMode: 'none' });

        var state = widget.getState();
        expect(state.colorModes).toEqual([]);
    });

    test('colorModes state should round-trip correctly', function() {
        var widget1 = LogitLensWidget('#container', testData, { colorModes: ['top', 'test'] });
        var state1 = widget1.getState();

        document.body.innerHTML = '<div id="container2" style="width: 800px;"></div>';
        var widget2 = LogitLensWidget('#container2', testData, state1);
        var state2 = widget2.getState();

        expect(state2.colorModes).toEqual(['top', 'test']);
    });
});

describe('Color Mode Menu', function() {
    beforeEach(function() {
        document.body.innerHTML = '<div id="container" style="width: 800px;"></div>';
    });

    afterEach(function() {
        document.body.innerHTML = '';
    });

    test('color mode button should exist', function() {
        var widget = LogitLensWidget('#container', testData);

        var btn = document.querySelector('#container .color-mode-btn');
        expect(btn).not.toBeNull();
    });

    test('clicking color mode button should show menu', function() {
        var widget = LogitLensWidget('#container', testData);

        var btn = document.querySelector('#container .color-mode-btn');
        btn.click();

        var menu = document.querySelector('#container .color-menu.visible');
        expect(menu).not.toBeNull();
    });

    test('menu should have checkmark for active mode', function() {
        var widget = LogitLensWidget('#container', testData);

        var btn = document.querySelector('#container .color-mode-btn');
        btn.click();

        var menuItems = document.querySelectorAll('#container .color-menu-item');
        expect(menuItems.length).toBeGreaterThan(0);

        // First item should be "top" which is active by default
        var firstItem = menuItems[0];
        expect(firstItem.textContent).toContain('✓');
    });

    test('regular click should select single mode', function() {
        var widget = LogitLensWidget('#container', testData);

        // Open menu
        var btn = document.querySelector('#container .color-mode-btn');
        btn.click();

        // Click on "None"
        var noneItem = document.querySelector('#container .color-menu-item[data-mode="none"]');
        noneItem.click();

        var state = widget.getState();
        expect(state.colorModes).toEqual([]);
    });

    test('shift+click should toggle mode', function() {
        var widget = LogitLensWidget('#container', testData);

        // Open menu
        var btn = document.querySelector('#container .color-mode-btn');
        btn.click();

        // Get all menu items except None
        var menuItems = document.querySelectorAll('#container .color-menu-item:not([data-mode="none"])');
        if (menuItems.length < 2) return; // Need at least 2 items to test

        // Shift+click on second item to add it
        var secondItem = menuItems[1];
        var shiftClick = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            shiftKey: true
        });
        secondItem.dispatchEvent(shiftClick);

        var state = widget.getState();
        expect(state.colorModes.length).toBeGreaterThan(1);
    });

    test('ctrl+click should toggle mode', function() {
        var widget = LogitLensWidget('#container', testData);

        // Open menu
        var btn = document.querySelector('#container .color-mode-btn');
        btn.click();

        var menuItems = document.querySelectorAll('#container .color-menu-item:not([data-mode="none"])');
        if (menuItems.length < 2) return;

        // Ctrl+click on second item
        var secondItem = menuItems[1];
        var ctrlClick = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            ctrlKey: true
        });
        secondItem.dispatchEvent(ctrlClick);

        var state = widget.getState();
        expect(state.colorModes.length).toBeGreaterThan(1);
    });

    test('meta+click should toggle mode', function() {
        var widget = LogitLensWidget('#container', testData);

        // Open menu
        var btn = document.querySelector('#container .color-mode-btn');
        btn.click();

        var menuItems = document.querySelectorAll('#container .color-menu-item:not([data-mode="none"])');
        if (menuItems.length < 2) return;

        // Meta+click (Cmd on Mac) on second item
        var secondItem = menuItems[1];
        var metaClick = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            metaKey: true
        });
        secondItem.dispatchEvent(metaClick);

        var state = widget.getState();
        expect(state.colorModes.length).toBeGreaterThan(1);
    });

    test('shift+click on active mode should remove it', function() {
        var widget = LogitLensWidget('#container', testData, { colorModes: ['top'] });

        // Open menu
        var btn = document.querySelector('#container .color-mode-btn');
        btn.click();

        // Shift+click on first item (top) to remove it
        var topItem = document.querySelector('#container .color-menu-item[data-mode="top"]');
        var shiftClick = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            shiftKey: true
        });
        topItem.dispatchEvent(shiftClick);

        var state = widget.getState();
        expect(state.colorModes).not.toContain('top');
    });

    test('None click should clear all modes', function() {
        var widget = LogitLensWidget('#container', testData, { colorModes: ['top', 'test'] });

        // Open menu
        var btn = document.querySelector('#container .color-mode-btn');
        btn.click();

        // Click on None
        var noneItem = document.querySelector('#container .color-menu-item[data-mode="none"]');
        noneItem.click();

        var state = widget.getState();
        expect(state.colorModes).toEqual([]);
    });
});

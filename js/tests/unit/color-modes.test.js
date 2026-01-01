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

    test('clicking color mode button again should close menu', function() {
        var widget = LogitLensWidget('#container', testData);

        var btn = document.querySelector('#container .color-mode-btn');

        // Open menu
        btn.click();
        var menu = document.querySelector('#container .color-menu');
        expect(menu.classList.contains('visible')).toBe(true);

        // Click button again to close - need to get fresh reference since updateTitle recreates button
        var btn2 = document.querySelector('#container .color-mode-btn');
        btn2.click();

        // Menu should be closed
        expect(menu.classList.contains('visible')).toBe(false);
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

    test('regular click should select single mode', function(done) {
        var widget = LogitLensWidget('#container', testData);

        // Open menu
        var btn = document.querySelector('#container .color-mode-btn');
        btn.click();

        // Click on "None"
        var noneItem = document.querySelector('#container .color-menu-item[data-mode="none"]');
        noneItem.click();

        // Wait for blink animation (200ms) plus buffer
        setTimeout(function() {
            var state = widget.getState();
            expect(state.colorModes).toEqual([]);
            done();
        }, 250);
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

    test('shift+click should not rebuild menu, just toggle checkmark and update title', function() {
        var widget = LogitLensWidget('#container', testData);

        // Open menu
        var btn = document.querySelector('#container .color-mode-btn');
        var initialBtnText = btn.textContent;
        btn.click();

        // Get menu and menu items
        var menu = document.querySelector('#container .color-menu');
        var menuItems = document.querySelectorAll('#container .color-menu-item:not([data-mode="none"])');
        if (menuItems.length < 2) return;

        // Store reference to the second item element
        var secondItem = menuItems[1];
        var secondItemMode = secondItem.dataset.mode;
        var secondItemCheckmark = secondItem.querySelector('span');

        // Verify checkmark is initially hidden (not active)
        expect(secondItemCheckmark.style.visibility).not.toBe('visible');

        // Shift+click on second item
        var shiftClick = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            shiftKey: true
        });
        secondItem.dispatchEvent(shiftClick);

        // Menu should still be visible
        expect(menu.classList.contains('visible')).toBe(true);

        // The same menu item element should still exist (not rebuilt)
        var menuItemsAfter = document.querySelectorAll('#container .color-menu-item:not([data-mode="none"])');
        expect(menuItemsAfter[1]).toBe(secondItem);

        // Checkmark should now be visible on the same element
        expect(secondItemCheckmark.style.visibility).toBe('visible');
        expect(secondItemCheckmark.style.fontWeight).toBe('bold');

        // Title/button text should be updated to include "and"
        var newBtn = document.querySelector('#container .color-mode-btn');
        expect(newBtn.textContent).toContain('and');
        expect(newBtn.textContent).not.toBe(initialBtnText);
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

    test('shift+click when None is checked should clear None checkmark', function() {
        // Start with None selected (empty colorModes)
        var widget = LogitLensWidget('#container', testData, { colorModes: [] });

        // Open menu
        var btn = document.querySelector('#container .color-mode-btn');
        btn.click();

        // Verify None checkmark is visible initially
        var noneItem = document.querySelector('#container .color-menu-item[data-mode="none"]');
        var noneCheckmark = noneItem.querySelector('span');
        expect(noneCheckmark.style.visibility).not.toBe('hidden');

        // Get another menu item to shift-click
        var menuItems = document.querySelectorAll('#container .color-menu-item:not([data-mode="none"])');
        expect(menuItems.length).toBeGreaterThan(0);
        var firstItem = menuItems[0];

        // Shift+click on the item to add it
        var shiftClick = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            shiftKey: true
        });
        firstItem.dispatchEvent(shiftClick);

        // None checkmark should now be hidden
        expect(noneCheckmark.style.visibility).toBe('hidden');

        // The clicked item should have a visible checkmark
        var firstItemCheckmark = firstItem.querySelector('span');
        expect(firstItemCheckmark.style.visibility).toBe('visible');

        // State should have the mode
        var state = widget.getState();
        expect(state.colorModes.length).toBe(1);
    });

    test('None click should clear all modes', function(done) {
        var widget = LogitLensWidget('#container', testData, { colorModes: ['top', 'test'] });

        // Open menu
        var btn = document.querySelector('#container .color-mode-btn');
        btn.click();

        // Click on None
        var noneItem = document.querySelector('#container .color-menu-item[data-mode="none"]');
        noneItem.click();

        // Wait for blink animation (200ms) plus buffer
        setTimeout(function() {
            var state = widget.getState();
            expect(state.colorModes).toEqual([]);
            done();
        }, 250);
    });

    test('menu item should get blink animation on click', function() {
        var widget = LogitLensWidget('#container', testData);

        // Open menu
        var btn = document.querySelector('#container .color-mode-btn');
        btn.click();

        // Click on an item
        var topItem = document.querySelector('#container .color-menu-item[data-mode="top"]');
        topItem.click();

        // Animation should be applied immediately
        expect(topItem.style.animation).toContain('menuBlink');
    });

    test('clicking cell while menu open should dismiss menu without opening popup', function() {
        var widget = LogitLensWidget('#container', testData);

        // Open color menu
        var btn = document.querySelector('#container .color-mode-btn');
        btn.click();

        var menu = document.querySelector('#container .color-menu');
        expect(menu.classList.contains('visible')).toBe(true);

        // Click on a prediction cell
        var cell = document.querySelector('#container .pred-cell');
        cell.click();

        // Menu should be dismissed
        expect(menu.classList.contains('visible')).toBe(false);

        // Popup should NOT be open
        var popup = document.querySelector('#container .popup');
        expect(popup.classList.contains('visible')).toBe(false);
    });

    test('overlay should be created when menu opens', function() {
        var widget = LogitLensWidget('#container', testData);

        // Initially no overlay
        var overlay = document.querySelector('[id$="_overlay"]');
        expect(overlay).toBeNull();

        // Open menu
        var btn = document.querySelector('#container .color-mode-btn');
        btn.click();

        // Overlay should exist
        overlay = document.querySelector('[id$="_overlay"]');
        expect(overlay).not.toBeNull();
        expect(overlay.style.position).toBe('fixed');
    });

    test('clicking overlay should dismiss menu', function() {
        var widget = LogitLensWidget('#container', testData);

        // Open menu
        var btn = document.querySelector('#container .color-mode-btn');
        btn.click();

        var menu = document.querySelector('#container .color-menu');
        expect(menu.classList.contains('visible')).toBe(true);

        // Click on overlay (using mousedown since that's what triggers dismiss)
        var overlay = document.querySelector('[id$="_overlay"]');
        overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

        // Menu should be dismissed
        expect(menu.classList.contains('visible')).toBe(false);
    });

    test('overlay should be removed when menu is dismissed', function() {
        var widget = LogitLensWidget('#container', testData);

        // Open menu
        var btn = document.querySelector('#container .color-mode-btn');
        btn.click();

        // Overlay exists
        var overlay = document.querySelector('[id$="_overlay"]');
        expect(overlay).not.toBeNull();

        // Click overlay to dismiss
        overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

        // Overlay should be removed
        overlay = document.querySelector('[id$="_overlay"]');
        expect(overlay).toBeNull();
    });

    test('closing menu via button should also remove overlay', function() {
        var widget = LogitLensWidget('#container', testData);

        // Open menu
        var btn = document.querySelector('#container .color-mode-btn');
        btn.click();

        // Overlay exists
        var overlay = document.querySelector('[id$="_overlay"]');
        expect(overlay).not.toBeNull();

        // Click button again to close (toggle)
        btn = document.querySelector('#container .color-mode-btn');
        btn.click();

        // Overlay should be removed
        overlay = document.querySelector('[id$="_overlay"]');
        expect(overlay).toBeNull();
    });
});

describe('Color Mode Button Visibility', function() {
    beforeEach(function() {
        document.body.innerHTML = '<div id="container" style="width: 800px;"></div>';
    });

    afterEach(function() {
        document.body.innerHTML = '';
    });

    test('button should have content even when None is selected', function() {
        var widget = LogitLensWidget('#container', testData, { colorModes: [] });

        var btn = document.querySelector('#container .color-mode-btn');
        expect(btn).not.toBeNull();
        // Button should have some text content for clickable area
        expect(btn.textContent.length).toBeGreaterThan(0);
    });

    test('button should be invisible when None is selected', function() {
        var widget = LogitLensWidget('#container', testData, { colorModes: [] });

        var btn = document.querySelector('#container .color-mode-btn');
        expect(btn.style.color).toBe('transparent');
    });

    test('button should still be clickable when None is selected', function() {
        var widget = LogitLensWidget('#container', testData, { colorModes: [] });

        var btn = document.querySelector('#container .color-mode-btn');
        btn.click();

        // Menu should appear
        var menu = document.querySelector('#container .color-menu.visible');
        expect(menu).not.toBeNull();
    });

    test('button should have pointer cursor when None is selected', function() {
        var widget = LogitLensWidget('#container', testData, { colorModes: [] });

        var btn = document.querySelector('#container .color-mode-btn');
        expect(btn.style.cursor).toBe('pointer');
    });
});

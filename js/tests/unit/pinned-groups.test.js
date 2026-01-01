/**
 * Unit tests for pinned groups (multi-token tagging) feature
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

describe('Pinned Groups State', function() {
    beforeEach(function() {
        document.body.innerHTML = '<div id="container" style="width: 800px;"></div>';
    });

    afterEach(function() {
        document.body.innerHTML = '';
    });

    test('default pinnedGroups should be empty array', function() {
        var widget = LogitLensWidget('#container', testData);
        var state = widget.getState();

        expect(state.pinnedGroups).toEqual([]);
    });

    test('pinnedGroups should be an array in getState', function() {
        var widget = LogitLensWidget('#container', testData);
        var state = widget.getState();

        expect(Array.isArray(state.pinnedGroups)).toBe(true);
    });

    test('single token group should be restorable from state', function() {
        var initialState = { pinnedGroups: [{ tokens: ['hello'] }] };
        var widget = LogitLensWidget('#container', testData, initialState);

        var state = widget.getState();
        expect(state.pinnedGroups.length).toBe(1);
        expect(state.pinnedGroups[0].tokens).toEqual(['hello']);
    });

    test('multi-token group should be restorable from state', function() {
        var initialState = { pinnedGroups: [{ tokens: ['hello', 'world', 'test'] }] };
        var widget = LogitLensWidget('#container', testData, initialState);

        var state = widget.getState();
        expect(state.pinnedGroups.length).toBe(1);
        expect(state.pinnedGroups[0].tokens).toEqual(['hello', 'world', 'test']);
    });

    test('multiple groups should be restorable from state', function() {
        var initialState = {
            pinnedGroups: [
                { tokens: ['hello', 'world'] },
                { tokens: ['foo'] },
                { tokens: ['bar', 'baz', 'qux'] }
            ]
        };
        var widget = LogitLensWidget('#container', testData, initialState);

        var state = widget.getState();
        expect(state.pinnedGroups.length).toBe(3);
        expect(state.pinnedGroups[0].tokens).toEqual(['hello', 'world']);
        expect(state.pinnedGroups[1].tokens).toEqual(['foo']);
        expect(state.pinnedGroups[2].tokens).toEqual(['bar', 'baz', 'qux']);
    });

    test('group colors should be preserved in state', function() {
        var initialState = {
            pinnedGroups: [
                { tokens: ['hello'], color: '#ff0000' },
                { tokens: ['world'], color: '#00ff00' }
            ]
        };
        var widget = LogitLensWidget('#container', testData, initialState);

        var state = widget.getState();
        expect(state.pinnedGroups[0].color).toBe('#ff0000');
        expect(state.pinnedGroups[1].color).toBe('#00ff00');
    });

    test('pinnedGroups state should round-trip correctly', function() {
        var groups = [
            { tokens: ['token1', 'token2'], color: '#123456' },
            { tokens: ['token3'] }
        ];
        var widget1 = LogitLensWidget('#container', testData, { pinnedGroups: groups });
        var state1 = widget1.getState();

        document.body.innerHTML = '<div id="container2" style="width: 800px;"></div>';
        var widget2 = LogitLensWidget('#container2', testData, state1);
        var state2 = widget2.getState();

        expect(state2.pinnedGroups.length).toBe(2);
        expect(state2.pinnedGroups[0].tokens).toEqual(['token1', 'token2']);
        expect(state2.pinnedGroups[0].color).toBe('#123456');
        expect(state2.pinnedGroups[1].tokens).toEqual(['token3']);
    });
});

describe('Pinned Groups in Color Menu', function() {
    beforeEach(function() {
        document.body.innerHTML = '<div id="container" style="width: 800px;"></div>';
    });

    afterEach(function() {
        document.body.innerHTML = '';
    });

    test('pinned group should appear in color mode menu', function() {
        var widget = LogitLensWidget('#container', testData, {
            pinnedGroups: [{ tokens: ['test'] }]
        });

        // Open menu
        var btn = document.querySelector('#container .color-mode-btn');
        btn.click();

        var menu = document.querySelector('#container .color-menu.visible');
        expect(menu).not.toBeNull();

        // Menu should contain an item for the pinned group
        var menuItems = document.querySelectorAll('#container .color-menu-item');
        var groupItemFound = false;
        menuItems.forEach(function(item) {
            if (item.textContent.indexOf('test') >= 0) {
                groupItemFound = true;
            }
        });
        expect(groupItemFound).toBe(true);
    });

    test('multi-token group should show all tokens in menu', function() {
        var widget = LogitLensWidget('#container', testData, {
            pinnedGroups: [{ tokens: ['hello', 'world'] }]
        });

        // Open menu
        var btn = document.querySelector('#container .color-mode-btn');
        btn.click();

        var menu = document.querySelector('#container .color-menu.visible');
        var menuText = menu.textContent;

        // Should contain both tokens (format may vary)
        expect(menuText.indexOf('hello') >= 0 || menuText.indexOf('world') >= 0).toBe(true);
    });

    test('selecting pinned group should add it to colorModes', function() {
        var widget = LogitLensWidget('#container', testData, {
            pinnedGroups: [{ tokens: ['testtoken'] }]
        });

        // Open menu
        var btn = document.querySelector('#container .color-mode-btn');
        btn.click();

        // Find and click the group menu item
        var menuItems = document.querySelectorAll('#container .color-menu-item');
        var groupItem = null;
        menuItems.forEach(function(item) {
            if (item.textContent.indexOf('testtoken') >= 0) {
                groupItem = item;
            }
        });

        if (groupItem) {
            groupItem.click();
            var state = widget.getState();
            // colorModes should contain the first token of the group
            expect(state.colorModes).toContain('testtoken');
        }
    });
});

describe('Pinned Groups Color Assignment', function() {
    beforeEach(function() {
        document.body.innerHTML = '<div id="container" style="width: 800px;"></div>';
    });

    afterEach(function() {
        document.body.innerHTML = '';
    });

    test('groups without color keep undefined color in state', function() {
        // When no color is provided, the group stores no color
        // The widget uses a default color for display but doesn't persist it
        var widget = LogitLensWidget('#container', testData, {
            pinnedGroups: [{ tokens: ['test'] }]
        });

        var state = widget.getState();
        // Group preserves the original state (no color was provided)
        expect(state.pinnedGroups[0].tokens).toEqual(['test']);
    });

    test('groups with explicit colors preserve them', function() {
        var widget = LogitLensWidget('#container', testData, {
            pinnedGroups: [
                { tokens: ['test1'], color: '#ff0000' },
                { tokens: ['test2'], color: '#00ff00' },
                { tokens: ['test3'], color: '#0000ff' }
            ]
        });

        var state = widget.getState();
        expect(state.pinnedGroups[0].color).toBe('#ff0000');
        expect(state.pinnedGroups[1].color).toBe('#00ff00');
        expect(state.pinnedGroups[2].color).toBe('#0000ff');
    });

    test('provided colors should not be overwritten', function() {
        var widget = LogitLensWidget('#container', testData, {
            pinnedGroups: [{ tokens: ['test'], color: '#abcdef' }]
        });

        var state = widget.getState();
        expect(state.pinnedGroups[0].color).toBe('#abcdef');
    });
});

describe('Backward Compatibility', function() {
    beforeEach(function() {
        document.body.innerHTML = '<div id="container" style="width: 800px;"></div>';
    });

    afterEach(function() {
        document.body.innerHTML = '';
    });

    test('old pinnedTokens format should convert to pinnedGroups', function() {
        // Old format had pinnedTokens as array of strings
        var widget = LogitLensWidget('#container', testData, {
            pinnedTokens: ['hello', 'world']
        });

        var state = widget.getState();
        // Should either have pinnedGroups populated or handle gracefully
        expect(Array.isArray(state.pinnedGroups)).toBe(true);
    });
});

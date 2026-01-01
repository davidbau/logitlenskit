/**
 * Unit tests for color picker feature
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

describe('Color Picker Feature', function() {
    beforeEach(function() {
        document.body.innerHTML = '<div id="container" style="width: 800px;"></div>';
    });

    afterEach(function() {
        document.body.innerHTML = '';
    });

    test('hidden color picker input should exist', function() {
        var widget = LogitLensWidget('#container', testData);

        var colorPicker = document.querySelector('#container input[type="color"]');
        expect(colorPicker).not.toBeNull();
    });

    test('heatmapBaseColor should be included in getState', function() {
        var widget = LogitLensWidget('#container', testData);
        var state = widget.getState();

        expect(state).toHaveProperty('heatmapBaseColor');
    });

    test('heatmapBaseColor should be restorable from initial state', function() {
        var initialState = { heatmapBaseColor: '#ff0000' };
        var widget = LogitLensWidget('#container', testData, initialState);

        var state = widget.getState();
        expect(state.heatmapBaseColor).toBe('#ff0000');
    });

    test('heatmapBaseColor null should use default blue gradient', function() {
        var widget = LogitLensWidget('#container', testData, { heatmapBaseColor: null });

        var state = widget.getState();
        expect(state.heatmapBaseColor).toBeNull();
    });

    test('pinnedGroups colors should be preserved in state', function() {
        // Create widget and check that pinnedGroups preserve custom colors
        // pinnedGroups need to have a tokens array
        var customGroups = [{ tokens: ['test'], color: '#123456' }];
        var widget = LogitLensWidget('#container', testData, { pinnedGroups: customGroups });

        var state = widget.getState();
        expect(state.pinnedGroups.length).toBe(1);
        expect(state.pinnedGroups[0].color).toBe('#123456');
    });
});

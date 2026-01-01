/**
 * Unit tests for layer stride calculation accuracy
 */

var fs = require('fs');
var path = require('path');

// Load widget code
var widgetPath = path.join(__dirname, '../../src/logit-lens-widget.js');
var widgetCode = fs.readFileSync(widgetPath, 'utf8');
eval(widgetCode);

// Load test data with 12 layers (enough to trigger stride behavior in narrow container)
var fixturesPath = path.join(__dirname, '../fixtures/sample-data-12-layers.json');
var testData = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));

describe('Stride Calculation', function() {
    beforeEach(function() {
        document.body.innerHTML = '<div id="container" style="width: 500px;"></div>';
    });

    afterEach(function() {
        document.body.innerHTML = '';
    });

    test('stride displayed in hint should match actual layer gaps', function() {
        var widget = LogitLensWidget('#container', testData);

        // Get the displayed layer headers
        var layerHeaders = document.querySelectorAll('.layer-hdr');
        if (layerHeaders.length <= 1) {
            // All layers shown - no stride needed
            var hint = document.querySelector('.resize-hint-main');
            expect(hint.textContent).toContain('showing all');
            return;
        }

        // Extract layer numbers from headers
        var displayedLayers = [];
        layerHeaders.forEach(function(hdr) {
            var layerNum = parseInt(hdr.textContent.trim(), 10);
            if (!isNaN(layerNum)) {
                displayedLayers.push(layerNum);
            }
        });

        // Check if layers are shown with stride
        if (displayedLayers.length >= 2) {
            // Calculate actual stride between displayed layers
            var actualStrides = [];
            for (var i = 1; i < displayedLayers.length; i++) {
                actualStrides.push(displayedLayers[i] - displayedLayers[i - 1]);
            }

            // Get the hint text
            var hint = document.querySelector('.resize-hint-main');
            var hintText = hint.textContent;

            if (hintText.includes('every')) {
                // Extract claimed stride from hint
                var match = hintText.match(/every (\d+) layers/);
                expect(match).not.toBeNull();
                var claimedStride = parseInt(match[1], 10);

                // Verify the actual stride matches the claimed stride
                // All gaps should be equal to the claimed stride
                actualStrides.forEach(function(stride) {
                    expect(stride).toBe(claimedStride);
                });
            }
        }
    });

    test('widget with all layers should show "showing all N layers"', function() {
        // Use small data that fits all layers
        var smallDataPath = path.join(__dirname, '../fixtures/sample-data-small.json');
        var smallData = JSON.parse(fs.readFileSync(smallDataPath, 'utf8'));

        document.body.innerHTML = '<div id="container" style="width: 1000px;"></div>';
        var widget = LogitLensWidget('#container', smallData);

        var hint = document.querySelector('.resize-hint-main');
        expect(hint.textContent).toContain('showing all');
        expect(hint.textContent).toContain(smallData.layers.length.toString());
    });

    test('stride should always end at the last layer', function() {
        var widget = LogitLensWidget('#container', testData);

        // Get the displayed layer headers
        var layerHeaders = document.querySelectorAll('.layer-hdr');
        if (layerHeaders.length === 0) return;

        // Get the last displayed layer number
        var lastHeader = layerHeaders[layerHeaders.length - 1];
        var lastDisplayedLayer = parseInt(lastHeader.textContent.trim(), 10);

        // Should end at the last layer (11 for 12 layers)
        expect(lastDisplayedLayer).toBe(testData.layers.length - 1);
    });

    test('stride text should match actual gap between consecutive layers', function() {
        // This test verifies that "every N layers" means the gap between
        // consecutive displayed layers is N, not N+1 or some other value
        var widget = LogitLensWidget('#container', testData);

        // Get the displayed layer headers
        var layerHeaders = document.querySelectorAll('.layer-hdr');
        if (layerHeaders.length < 2) return; // Need at least 2 to measure gap

        // Extract layer numbers
        var displayedLayers = [];
        layerHeaders.forEach(function(hdr) {
            var layerNum = parseInt(hdr.textContent.trim(), 10);
            if (!isNaN(layerNum)) {
                displayedLayers.push(layerNum);
            }
        });

        if (displayedLayers.length < 2) return;

        // Calculate actual gaps between consecutive layers
        var gaps = [];
        for (var i = 1; i < displayedLayers.length; i++) {
            gaps.push(displayedLayers[i] - displayedLayers[i - 1]);
        }

        // All gaps should be equal (same stride)
        var allGapsEqual = gaps.every(function(g) { return g === gaps[0]; });
        expect(allGapsEqual).toBe(true);

        // Get the hint text
        var hint = document.querySelector('.resize-hint-main');
        if (!hint) return;
        var hintText = hint.textContent;

        // If showing with stride, verify the number matches the actual gap
        if (hintText.includes('every')) {
            var match = hintText.match(/every (\d+) layers/);
            if (match) {
                var claimedStride = parseInt(match[1], 10);
                var actualGap = gaps[0];
                // The claimed stride should equal the actual gap between layers
                // e.g., layers 7, 11, 15 have gap of 4, so should say "every 4 layers"
                expect(claimedStride).toBe(actualGap);
            }
        }
    });
});

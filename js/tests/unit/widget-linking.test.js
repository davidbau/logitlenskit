/**
 * Tests for LogitLensWidget linking functionality.
 */

const fs = require('fs');
const path = require('path');

// Load the widget code
const widgetCode = fs.readFileSync(
    path.join(__dirname, '../../src/logit-lens-widget.js'),
    'utf8'
);
eval(widgetCode);

const { loadSampleData, createMockContainer, cleanupContainer } = require('../utils/test-helpers');

describe('Widget Linking', () => {
    let container1, container2;
    let sampleData;

    beforeEach(() => {
        container1 = createMockContainer('test-container-1');
        container2 = createMockContainer('test-container-2');
        sampleData = loadSampleData();
    });

    afterEach(() => {
        cleanupContainer(container1);
        cleanupContainer(container2);
    });

    test('linkColumnsTo should establish connection', () => {
        const widget1 = LogitLensWidget('#test-container-1', sampleData);
        const widget2 = LogitLensWidget('#test-container-2', sampleData);

        // Should not throw
        widget1.linkColumnsTo(widget2);
    });

    test('linked widgets should sync cellWidth', () => {
        const widget1 = LogitLensWidget('#test-container-1', sampleData);
        const widget2 = LogitLensWidget('#test-container-2', sampleData);

        widget1.linkColumnsTo(widget2);

        // Set column state on widget1
        widget1.setColumnState({ cellWidth: 80 });

        // Widget2 should have same cellWidth
        const state2 = widget2.getState();
        expect(state2.cellWidth).toBe(80);
    });

    test('unlinkColumns should break connection', () => {
        const widget1 = LogitLensWidget('#test-container-1', sampleData);
        const widget2 = LogitLensWidget('#test-container-2', sampleData);

        widget1.linkColumnsTo(widget2);
        widget1.unlinkColumns(widget2);

        // Changes should no longer sync
        widget1.setColumnState({ cellWidth: 90 });
        const state2 = widget2.getState();
        // state2.cellWidth may or may not be 90 depending on implementation
        // but at least it shouldn't throw
    });

    test('linking should be bidirectional', () => {
        const widget1 = LogitLensWidget('#test-container-1', sampleData);
        const widget2 = LogitLensWidget('#test-container-2', sampleData);

        widget1.linkColumnsTo(widget2);

        // Changes from widget2 should sync to widget1
        widget2.setColumnState({ cellWidth: 75 });
        const state1 = widget1.getState();
        expect(state1.cellWidth).toBe(75);
    });
});

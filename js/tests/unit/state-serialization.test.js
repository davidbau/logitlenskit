/**
 * Tests for LogitLensWidget state serialization.
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

describe('State Serialization', () => {
    let container;
    let sampleData;

    beforeEach(() => {
        container = createMockContainer();
        sampleData = loadSampleData();
    });

    afterEach(() => {
        cleanupContainer(container);
    });

    test('getState should return object with required properties', () => {
        const widget = LogitLensWidget('#test-container', sampleData);
        const state = widget.getState();

        expect(state).toHaveProperty('title');
        expect(state).toHaveProperty('cellWidth');
        expect(state).toHaveProperty('inputTokenWidth');
        expect(state).toHaveProperty('chartHeight');
        expect(state).toHaveProperty('colorModes');
        expect(state).toHaveProperty('pinnedGroups');
        expect(state).toHaveProperty('pinnedRows');
    });

    test('state should be JSON serializable', () => {
        const widget = LogitLensWidget('#test-container', sampleData);
        const state = widget.getState();

        // Should not throw
        const json = JSON.stringify(state);
        const parsed = JSON.parse(json);

        expect(parsed.cellWidth).toBe(state.cellWidth);
        expect(parsed.title).toBe(state.title);
    });

    test('state should round-trip correctly', () => {
        const widget1 = LogitLensWidget('#test-container', sampleData, {
            title: 'Test Title',
            cellWidth: 55,
            chartHeight: 180,
        });
        const state = widget1.getState();

        // Create new container for second widget
        const container2 = createMockContainer('test-container-2');
        const widget2 = LogitLensWidget('#test-container-2', sampleData, state);
        const state2 = widget2.getState();

        expect(state2.title).toBe('Test Title');
        expect(state2.cellWidth).toBe(55);
        expect(state2.chartHeight).toBe(180);

        cleanupContainer(container2);
    });

    test('default state values should be reasonable', () => {
        const widget = LogitLensWidget('#test-container', sampleData);
        const state = widget.getState();

        expect(state.cellWidth).toBeGreaterThan(20);
        expect(state.cellWidth).toBeLessThan(200);
        expect(state.inputTokenWidth).toBeGreaterThan(50);
        expect(state.chartHeight).toBeGreaterThan(50);
        expect(state.chartHeight).toBeLessThan(500);
    });
});

describe('getColumnState and setColumnState', () => {
    let container;
    let sampleData;

    beforeEach(() => {
        container = createMockContainer();
        sampleData = loadSampleData();
    });

    afterEach(() => {
        cleanupContainer(container);
    });

    test('getColumnState should return column sizing', () => {
        const widget = LogitLensWidget('#test-container', sampleData);
        const colState = widget.getColumnState();

        expect(colState).toHaveProperty('cellWidth');
        expect(colState).toHaveProperty('inputTokenWidth');
        expect(colState).toHaveProperty('maxTableWidth');
    });

    test('setColumnState should update column sizing', () => {
        const widget = LogitLensWidget('#test-container', sampleData);

        widget.setColumnState({
            cellWidth: 70,
            inputTokenWidth: 120,
        });

        const state = widget.getState();
        expect(state.cellWidth).toBe(70);
        expect(state.inputTokenWidth).toBe(120);
    });
});

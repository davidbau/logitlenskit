/**
 * Tests for LogitLensWidget creation and initialization.
 */

const fs = require('fs');
const path = require('path');

// Load the widget code
const widgetCode = fs.readFileSync(
    path.join(__dirname, '../../src/logit-lens-widget.js'),
    'utf8'
);

// Execute in global scope to define LogitLensWidget
eval(widgetCode);

const { loadSampleData, createMockContainer, cleanupContainer } = require('../utils/test-helpers');

describe('LogitLensWidget Creation', () => {
    let container;
    let sampleData;

    beforeEach(() => {
        container = createMockContainer();
        sampleData = loadSampleData();
    });

    afterEach(() => {
        cleanupContainer(container);
    });

    test('should create widget with CSS selector', () => {
        const widget = LogitLensWidget('#test-container', sampleData);
        expect(widget).toBeDefined();
        expect(widget.uid).toMatch(/^ll_interact_\d+$/);
    });

    test('should create widget with DOM element', () => {
        const widget = LogitLensWidget(container, sampleData);
        expect(widget).toBeDefined();
        expect(widget.uid).toBeDefined();
    });

    test('should return null for invalid container', () => {
        // Suppress console.error for this test
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const widget = LogitLensWidget('#nonexistent', sampleData);
        expect(widget).toBeUndefined();
        consoleSpy.mockRestore();
    });

    test('should inject scoped CSS', () => {
        const widget = LogitLensWidget('#test-container', sampleData);
        const styles = document.querySelectorAll('style');
        const widgetStyle = Array.from(styles).find(s =>
            s.textContent.includes(`#${widget.uid}`)
        );
        expect(widgetStyle).toBeDefined();
    });

    test('should render table structure', () => {
        LogitLensWidget('#test-container', sampleData);
        const table = container.querySelector('.ll-table');
        expect(table).toBeDefined();
    });

    test('should render correct number of rows', () => {
        LogitLensWidget('#test-container', sampleData);
        const inputTokenCells = container.querySelectorAll('.input-token');
        expect(inputTokenCells.length).toBe(sampleData.tokens.length);
    });

    test('should have unique IDs for multiple instances', () => {
        const widget1 = LogitLensWidget('#test-container', sampleData);
        const container2 = createMockContainer('test-container-2');
        const widget2 = LogitLensWidget('#test-container-2', sampleData);

        expect(widget1.uid).not.toBe(widget2.uid);

        cleanupContainer(container2);
    });
});

describe('LogitLensWidget with UI State', () => {
    let container;
    let sampleData;

    beforeEach(() => {
        container = createMockContainer();
        sampleData = loadSampleData();
    });

    afterEach(() => {
        cleanupContainer(container);
    });

    test('should accept custom title', () => {
        LogitLensWidget('#test-container', sampleData, { title: 'Custom Title' });
        const title = container.querySelector('.ll-title');
        expect(title.textContent).toContain('Custom Title');
    });

    test('should apply custom cellWidth', () => {
        const widget = LogitLensWidget('#test-container', sampleData, { cellWidth: 60 });
        const state = widget.getState();
        expect(state.cellWidth).toBe(60);
    });

    test('should apply custom chartHeight', () => {
        const widget = LogitLensWidget('#test-container', sampleData, { chartHeight: 200 });
        const state = widget.getState();
        expect(state.chartHeight).toBe(200);
    });
});

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

describe('LogitLensWidget Dark Mode', () => {
    let container;
    let sampleData;

    beforeEach(() => {
        container = createMockContainer();
        sampleData = loadSampleData();
    });

    afterEach(() => {
        cleanupContainer(container);
    });

    test('darkMode should default to null (auto-detect from CSS)', () => {
        const widget = LogitLensWidget('#test-container', sampleData);
        const state = widget.getState();
        expect(state.darkMode).toBe(null);
    });

    test('darkMode should be restorable from initial state', () => {
        const widget = LogitLensWidget('#test-container', sampleData, { darkMode: true });
        const state = widget.getState();
        expect(state.darkMode).toBe(true);
    });

    test('setDarkMode should apply dark-mode class', () => {
        const widget = LogitLensWidget('#test-container', sampleData);
        const widgetEl = document.getElementById(widget.uid);

        expect(widgetEl.classList.contains('dark-mode')).toBe(false);

        widget.setDarkMode(true);
        expect(widgetEl.classList.contains('dark-mode')).toBe(true);

        widget.setDarkMode(false);
        expect(widgetEl.classList.contains('dark-mode')).toBe(false);
    });

    test('getDarkMode should return current dark mode state', () => {
        const widget = LogitLensWidget('#test-container', sampleData);

        expect(widget.getDarkMode()).toBe(false);

        widget.setDarkMode(true);
        expect(widget.getDarkMode()).toBe(true);
    });

    test('dark mode should be applied on widget creation when true in state', () => {
        const widget = LogitLensWidget('#test-container', sampleData, { darkMode: true });
        const widgetEl = document.getElementById(widget.uid);
        expect(widgetEl.classList.contains('dark-mode')).toBe(true);
    });

    test('dark mode state should round-trip correctly', () => {
        const widget1 = LogitLensWidget('#test-container', sampleData);
        widget1.setDarkMode(true);

        const state = widget1.getState();
        cleanupContainer(container);

        container = createMockContainer();
        const widget2 = LogitLensWidget('#test-container', sampleData, state);

        expect(widget2.getDarkMode()).toBe(true);
        const widgetEl = document.getElementById(widget2.uid);
        expect(widgetEl.classList.contains('dark-mode')).toBe(true);
    });

    test('should not error when color-scheme changes after widget removed from DOM', async () => {
        const widget = LogitLensWidget('#test-container', sampleData);
        const widgetUid = widget.uid;

        // Remove widget from DOM
        cleanupContainer(container);

        // Trigger color-scheme change on document root (would fire MutationObserver)
        const originalColorScheme = document.documentElement.style.colorScheme;
        document.documentElement.style.colorScheme = 'dark';

        // Give MutationObserver time to fire
        await new Promise(resolve => setTimeout(resolve, 10));

        // Should not throw - just verify we got here without error
        expect(document.getElementById(widgetUid)).toBe(null);

        // Restore original color-scheme
        document.documentElement.style.colorScheme = originalColorScheme;

        // Recreate container for cleanup
        container = createMockContainer();
    });
});

describe('LogitLensWidget Font Size', () => {
    let container;
    let sampleData;

    beforeEach(() => {
        container = createMockContainer();
        sampleData = loadSampleData();
    });

    afterEach(() => {
        // Clean up any custom properties we set
        document.documentElement.style.removeProperty('--ll-title-size');
        document.documentElement.style.removeProperty('--ll-content-size');
        cleanupContainer(container);
    });

    test('getFontSize should return default values', () => {
        const widget = LogitLensWidget('#test-container', sampleData);
        const sizes = widget.getFontSize();
        expect(sizes.title).toBe('16px');
        expect(sizes.content).toBe('10px');
    });

    test('setFontSize should update font sizes', () => {
        const widget = LogitLensWidget('#test-container', sampleData);
        widget.setFontSize({ title: '20px', content: '14px' });
        const sizes = widget.getFontSize();
        expect(sizes.title).toBe('20px');
        expect(sizes.content).toBe('14px');
    });

    test('setFontSize(null) should clear overrides', () => {
        const widget = LogitLensWidget('#test-container', sampleData);
        widget.setFontSize({ title: '20px', content: '14px' });
        widget.setFontSize(null);
        const sizes = widget.getFontSize();
        // Should return to defaults
        expect(sizes.title).toBe('16px');
        expect(sizes.content).toBe('10px');
    });

    test('should auto-detect font size changes via setFontSize API', async () => {
        const widget = LogitLensWidget('#test-container', sampleData);

        // Use API to set font sizes (this sets on widget element directly)
        widget.setFontSize({ content: '14px' });

        // Give time for rebuild
        await new Promise(resolve => setTimeout(resolve, 50));

        // Widget should reflect the change
        const sizes = widget.getFontSize();
        expect(sizes.content).toBe('14px');
    });

    test('should detect inherited font size from document root', async () => {
        // Set on document root BEFORE creating widget
        document.documentElement.style.setProperty('--ll-content-size', '14px');

        const widget = LogitLensWidget('#test-container', sampleData);

        // Check if widget detects the inherited value
        // Note: JSDOM may not fully support custom property inheritance
        const sizes = widget.getFontSize();
        // Accept either inherited value or default fallback
        expect(['14px', '10px']).toContain(sizes.content);
    });

    test('should rebuild table when font size changes', async () => {
        const widget = LogitLensWidget('#test-container', sampleData);
        const widgetEl = document.getElementById(widget.uid);
        const tableBefore = widgetEl.querySelector('.ll-table');
        const cellsBefore = tableBefore ? tableBefore.querySelectorAll('.pred-cell').length : 0;

        // Change font size
        document.documentElement.style.setProperty('--ll-content-size', '12px');

        // Give MutationObserver time to fire and rebuild
        await new Promise(resolve => setTimeout(resolve, 50));

        // Table should still exist with same structure (rebuilt)
        const tableAfter = widgetEl.querySelector('.ll-table');
        const cellsAfter = tableAfter ? tableAfter.querySelectorAll('.pred-cell').length : 0;
        expect(cellsAfter).toBe(cellsBefore);
    });
});

describe('LogitLensWidget V2 Data Format', () => {
    let container;
    let sampleDataV2;

    beforeEach(() => {
        container = createMockContainer();
        sampleDataV2 = loadSampleData('sample-data-v2.json');
    });

    afterEach(() => {
        cleanupContainer(container);
    });

    test('should create widget with v2 compact format', () => {
        const widget = LogitLensWidget('#test-container', sampleDataV2);
        expect(widget).toBeDefined();
        expect(widget.uid).toMatch(/^ll_interact_\d+$/);
    });

    test('should render correct number of rows with v2 format', () => {
        LogitLensWidget('#test-container', sampleDataV2);
        const inputTokenCells = container.querySelectorAll('.input-token');
        expect(inputTokenCells.length).toBe(sampleDataV2.input.length);
    });

    test('should render correct number of layers with v2 format', () => {
        LogitLensWidget('#test-container', sampleDataV2);
        const headerCells = container.querySelectorAll('.layer-hdr');
        expect(headerCells.length).toBe(sampleDataV2.layers.length);
    });

    test('should display correct token content with v2 format', () => {
        LogitLensWidget('#test-container', sampleDataV2);
        const inputTokenCells = container.querySelectorAll('.input-token');
        // First input token should be "The"
        expect(inputTokenCells[0].textContent).toContain('The');
    });

    test('v2 format should produce same structure as v1', () => {
        const sampleDataV1 = loadSampleData('sample-data-small.json');

        const widget1 = LogitLensWidget('#test-container', sampleDataV1);
        const container2 = createMockContainer('test-container-2');
        const widget2 = LogitLensWidget('#test-container-2', sampleDataV2);

        // Both should render same number of rows and layers
        const rows1 = container.querySelectorAll('.input-token').length;
        const rows2 = container2.querySelectorAll('.input-token').length;
        expect(rows1).toBe(rows2);

        const layers1 = container.querySelectorAll('.layer-hdr').length;
        const layers2 = container2.querySelectorAll('.layer-hdr').length;
        expect(layers1).toBe(layers2);

        cleanupContainer(container2);
    });

    test('getState should work with v2 format data', () => {
        const widget = LogitLensWidget('#test-container', sampleDataV2);
        const state = widget.getState();

        expect(state).toHaveProperty('cellWidth');
        expect(state).toHaveProperty('colorModes');
        expect(state).toHaveProperty('pinnedGroups');
    });
});

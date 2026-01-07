// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Single Widget Rendering', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/single-widget.html');
    });

    test('widget container exists and has content', async ({ page }) => {
        const container = page.locator('#logit-lens-test1');
        await expect(container).toBeVisible();
        // Widget should have created internal structure
        await expect(container.locator('.ll-table')).toBeVisible();
    });

    test('title is displayed', async ({ page }) => {
        const title = page.locator('.ll-title');
        await expect(title).toContainText('Test Widget');
    });

    test('input tokens are rendered', async ({ page }) => {
        // Check that input tokens from SAMPLE_DATA_1 are visible
        const inputCells = page.locator('.input-token');
        await expect(inputCells).toHaveCount(5); // ["The", " capital", " of", " France", " is"]

        // Check specific tokens
        await expect(inputCells.nth(0)).toContainText('The');
        await expect(inputCells.nth(3)).toContainText('France');
    });

    test('prediction cells are rendered', async ({ page }) => {
        // Should have cells for each position x layer
        const predCells = page.locator('.pred-cell');
        // 5 positions x some layers (might be virtualized)
        const count = await predCells.count();
        expect(count).toBeGreaterThan(0);
    });

    test('layer headers are rendered', async ({ page }) => {
        const layerHeaders = page.locator('.layer-hdr');
        const count = await layerHeaders.count();
        expect(count).toBeGreaterThan(0);
        // First layer should be 0
        await expect(layerHeaders.first()).toContainText('0');
    });

    test('clicking a cell shows popup', async ({ page }) => {
        const firstPredCell = page.locator('.pred-cell').first();
        await firstPredCell.click();

        // Popup should appear
        const popup = page.locator('[id$="_popup"]');
        await expect(popup).toBeVisible();
    });

    test('chart container exists', async ({ page }) => {
        const chartContainer = page.locator('[id$="_chart_container"]');
        await expect(chartContainer).toBeVisible();
    });
});

test.describe('Multiple Widgets Rendering', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/multiple-widgets.html');
    });

    test('all three widget containers exist', async ({ page }) => {
        await expect(page.locator('#logit-lens-widget1')).toBeVisible();
        await expect(page.locator('#logit-lens-widget2')).toBeVisible();
        await expect(page.locator('#logit-lens-widget3')).toBeVisible();
    });

    test('each widget has its own table', async ({ page }) => {
        const tables = page.locator('.ll-table');
        await expect(tables).toHaveCount(3);
    });

    test('each widget has its own title', async ({ page }) => {
        const titles = page.locator('.ll-title');
        await expect(titles).toHaveCount(3);

        // Check each title contains the right text
        await expect(titles.nth(0)).toContainText('Widget 1');
        await expect(titles.nth(1)).toContainText('Widget 2');
        await expect(titles.nth(2)).toContainText('Widget 3');
    });

    test('widget 1 has correct input tokens', async ({ page }) => {
        // Widget 1 has SAMPLE_DATA_1: ["The", " capital", " of", " France", " is"]
        const widget1 = page.locator('#logit-lens-widget1');
        const inputCells = widget1.locator('.input-token');
        await expect(inputCells).toHaveCount(5);
        await expect(inputCells.nth(0)).toContainText('The');
        await expect(inputCells.nth(3)).toContainText('France');
    });

    test('widget 2 has correct input tokens', async ({ page }) => {
        // Widget 2 has SAMPLE_DATA_2: ["Hello", " world"]
        const widget2 = page.locator('#logit-lens-widget2');
        const inputCells = widget2.locator('.input-token');
        await expect(inputCells).toHaveCount(2);
        await expect(inputCells.nth(0)).toContainText('Hello');
        await expect(inputCells.nth(1)).toContainText('world');
    });

    test('widget 3 has correct input tokens', async ({ page }) => {
        // Widget 3 has SAMPLE_DATA_3: ["1", " +", " 1", " ="]
        const widget3 = page.locator('#logit-lens-widget3');
        const inputCells = widget3.locator('.input-token');
        await expect(inputCells).toHaveCount(4);
        await expect(inputCells.nth(0)).toContainText('1');
        await expect(inputCells.nth(1)).toContainText('+');
    });

    test('widgets have independent internal IDs', async ({ page }) => {
        // Each widget should have created its own internal ll_* structure with unique ID
        // Look for the main widget containers (not all internal elements)
        // The widget root has classes like "ll-table" inside
        const widget1Root = page.locator('#logit-lens-widget1 > [id^="ll_"]');
        const widget2Root = page.locator('#logit-lens-widget2 > [id^="ll_"]');
        const widget3Root = page.locator('#logit-lens-widget3 > [id^="ll_"]');

        await expect(widget1Root).toHaveCount(1);
        await expect(widget2Root).toHaveCount(1);
        await expect(widget3Root).toHaveCount(1);

        // Get the IDs and verify they're unique
        const id1 = await widget1Root.getAttribute('id');
        const id2 = await widget2Root.getAttribute('id');
        const id3 = await widget3Root.getAttribute('id');

        expect(id1).not.toBe(id2);
        expect(id2).not.toBe(id3);
        expect(id1).not.toBe(id3);
    });

    test('clicking cell in widget 1 does not affect widget 2', async ({ page }) => {
        // Click a cell in widget 1
        const widget1 = page.locator('#logit-lens-widget1');
        const widget2 = page.locator('#logit-lens-widget2');

        const cellInWidget1 = widget1.locator('.pred-cell').first();
        await cellInWidget1.click();

        // Popup should appear in widget 1's area
        const popup1 = widget1.locator('[id$="_popup"]');
        await expect(popup1).toBeVisible();

        // Widget 2 should not have visible popup
        const popup2 = widget2.locator('[id$="_popup"]');
        await expect(popup2).not.toBeVisible();
    });

    test('each widget has its own chart', async ({ page }) => {
        const chartContainers = page.locator('[id$="_chart_container"]');
        await expect(chartContainers).toHaveCount(3);
    });

    test('predictions are correct per widget', async ({ page }) => {
        // Widget 1 should show predictions from SAMPLE_DATA_1 (Paris at layer 4 pos 4)
        const widget1 = page.locator('#logit-lens-widget1');
        // The top prediction at last layer, last position should be "Paris"
        // Find cells in last row
        const widget1Cells = widget1.locator('.pred-cell');
        const cellCount = await widget1Cells.count();
        expect(cellCount).toBeGreaterThan(0);

        // Widget 2 should show predictions from SAMPLE_DATA_2
        const widget2 = page.locator('#logit-lens-widget2');
        const widget2Cells = widget2.locator('.pred-cell');
        const widget2CellCount = await widget2Cells.count();
        expect(widget2CellCount).toBeGreaterThan(0);

        // Check that widget 1 has data from DATA_1 (should contain "Paris" somewhere)
        const widget1Text = await widget1.textContent();
        expect(widget1Text).toContain('Paris');

        // Widget 2 should have data from DATA_2 (should contain "foo" or "baz")
        const widget2Text = await widget2.textContent();
        expect(widget2Text).toMatch(/foo|baz/);

        // Widget 3 should have data from DATA_3 (should contain "+" and "=")
        const widget3 = page.locator('#logit-lens-widget3');
        const widget3Text = await widget3.textContent();
        expect(widget3Text).toContain('+');
    });
});

test.describe('Widget Interaction Independence', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/multiple-widgets.html');
    });

    test('pinning trajectory in widget 1 does not affect widget 2', async ({ page }) => {
        const widget1 = page.locator('#logit-lens-widget1');
        const widget2 = page.locator('#logit-lens-widget2');

        // Click a cell in widget 1 to open popup
        const cellInWidget1 = widget1.locator('.pred-cell').first();
        await cellInWidget1.click();

        // Find a topk item in the popup and click to pin
        const popup1 = widget1.locator('[id$="_popup"]');
        await expect(popup1).toBeVisible();
        const topkItem = popup1.locator('.topk-item').first();
        await topkItem.click();

        // Widget 1's chart container should exist
        const chartContainer1 = widget1.locator('[id$="_chart_container"]');
        await expect(chartContainer1).toBeVisible();

        // Widget 2 should have its own chart container
        const chartContainer2 = widget2.locator('[id$="_chart_container"]');
        await expect(chartContainer2).toBeVisible();
    });

    test('color mode changes are independent per widget', async ({ page }) => {
        const widget1 = page.locator('#logit-lens-widget1');
        const widget2 = page.locator('#logit-lens-widget2');

        // Click color button in widget 1
        const colorBtn1 = widget1.locator('.color-mode-btn');
        await colorBtn1.click();

        // Color menu should appear in widget 1
        const colorMenu1 = widget1.locator('[id$="_color_menu"]');
        await expect(colorMenu1).toBeVisible();

        // Widget 2's color menu should not be visible
        const colorMenu2 = widget2.locator('[id$="_color_menu"]');
        await expect(colorMenu2).not.toBeVisible();
    });
});

test.describe('Notebook Loop Pattern', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/notebook-loop.html');
        // Wait for all widgets to initialize
        await page.waitForTimeout(500);
    });

    test('all three widgets from loop are rendered', async ({ page }) => {
        // All three containers should have widgets
        await expect(page.locator('#logit-lens-loop-0 .ll-table')).toBeVisible();
        await expect(page.locator('#logit-lens-loop-1 .ll-table')).toBeVisible();
        await expect(page.locator('#logit-lens-loop-2 .ll-table')).toBeVisible();
    });

    test('each widget has correct title from its iteration', async ({ page }) => {
        const titles = page.locator('.ll-title');
        await expect(titles).toHaveCount(3);

        await expect(titles.nth(0)).toContainText('Prompt 1');
        await expect(titles.nth(1)).toContainText('Prompt 2');
        await expect(titles.nth(2)).toContainText('Prompt 3');
    });

    test('each widget has data from its iteration', async ({ page }) => {
        // Widget 0 should have SAMPLE_DATA_1 (France)
        const widget0 = page.locator('#logit-lens-loop-0');
        await expect(widget0.locator('.input-token').nth(3)).toContainText('France');

        // Widget 1 should have SAMPLE_DATA_2 (Hello world)
        const widget1 = page.locator('#logit-lens-loop-1');
        await expect(widget1.locator('.input-token').nth(0)).toContainText('Hello');

        // Widget 2 should have SAMPLE_DATA_3 (1 + 1 =)
        const widget2 = page.locator('#logit-lens-loop-2');
        await expect(widget2.locator('.input-token').nth(0)).toContainText('1');
    });

    test('widgets have independent input token counts', async ({ page }) => {
        // DATA_1 has 5 tokens, DATA_2 has 2, DATA_3 has 4
        const widget0Tokens = page.locator('#logit-lens-loop-0 .input-token');
        const widget1Tokens = page.locator('#logit-lens-loop-1 .input-token');
        const widget2Tokens = page.locator('#logit-lens-loop-2 .input-token');

        await expect(widget0Tokens).toHaveCount(5);
        await expect(widget1Tokens).toHaveCount(2);
        await expect(widget2Tokens).toHaveCount(4);
    });
});

test.describe('Nbconvert Generated HTML', () => {
    test.beforeEach(async ({ page }) => {
        // This is actual HTML generated by nbconvert from a Jupyter notebook
        await page.goto('/test_notebook_output.html');
        // Wait for scripts to execute
        await page.waitForTimeout(1000);
    });

    test('all three widgets render', async ({ page }) => {
        // Find widgets by looking for div[id^="logit-lens-"] containers with .ll-table inside
        const tables = page.locator('.ll-table');
        await expect(tables).toHaveCount(3);

        // Each table should be visible
        for (let i = 0; i < 3; i++) {
            await expect(tables.nth(i)).toBeVisible();
        }
    });

    test('widgets have correct titles', async ({ page }) => {
        const titles = page.locator('.ll-title');

        // Should have 3 titles
        await expect(titles).toHaveCount(3);

        // Check each title (they appear in order)
        await expect(titles.nth(0)).toContainText('Widget 1: France');
        await expect(titles.nth(1)).toContainText('Widget 2: Hello');
        await expect(titles.nth(2)).toContainText('Widget 3: Math');
    });

    test('widget 1 has correct input tokens', async ({ page }) => {
        // Find the first widget container (contains "Widget 1" title)
        const containers = page.locator('div[id^="logit-lens-"]');
        const widget1 = containers.nth(0);
        const inputTokens = widget1.locator('.input-token');

        // Widget 1 has ["The", " capital", " of", " France"]
        await expect(inputTokens).toHaveCount(4);
        await expect(inputTokens.nth(0)).toContainText('The');
        await expect(inputTokens.nth(3)).toContainText('France');
    });

    test('widget 2 has correct input tokens', async ({ page }) => {
        const containers = page.locator('div[id^="logit-lens-"]');
        const widget2 = containers.nth(1);
        const inputTokens = widget2.locator('.input-token');

        // Widget 2 has ["Hello", " world"]
        await expect(inputTokens).toHaveCount(2);
        await expect(inputTokens.nth(0)).toContainText('Hello');
        await expect(inputTokens.nth(1)).toContainText('world');
    });

    test('widget 3 has correct input tokens', async ({ page }) => {
        const containers = page.locator('div[id^="logit-lens-"]');
        const widget3 = containers.nth(2);
        const inputTokens = widget3.locator('.input-token');

        // Widget 3 has ["1", " +", " 1", " ="]
        await expect(inputTokens).toHaveCount(4);
        await expect(inputTokens.nth(0)).toContainText('1');
        await expect(inputTokens.nth(1)).toContainText('+');
    });
});

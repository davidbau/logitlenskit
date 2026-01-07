// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Jupyter Notebook Widget Rendering', () => {
    test.beforeEach(async ({ page }) => {
        // Serve the executed notebook HTML
        await page.goto('/test_notebook_output.html');
        // Wait for widgets to initialize
        await page.waitForTimeout(1000);
    });

    test('all three widgets render tables', async ({ page }) => {
        const tables = page.locator('.ll-table');
        const count = await tables.count();
        console.log(`Found ${count} tables`);
        expect(count).toBe(3);
    });

    test('all three widgets have titles', async ({ page }) => {
        const titles = page.locator('.ll-title');
        await expect(titles).toHaveCount(3);

        await expect(titles.nth(0)).toContainText('Widget 1');
        await expect(titles.nth(1)).toContainText('Widget 2');
        await expect(titles.nth(2)).toContainText('Widget 3');
    });

    test('widgets have different input token counts', async ({ page }) => {
        // Get all widget containers
        const containers = page.locator('[id^="logit-lens-"]');
        const containerCount = await containers.count();
        console.log(`Found ${containerCount} containers`);

        // Each widget should have different number of input tokens
        // Widget 1: 4 tokens (France), Widget 2: 2 tokens (Hello), Widget 3: 4 tokens (Math)
        const allInputTokens = page.locator('.input-token');
        const totalTokens = await allInputTokens.count();
        console.log(`Total input tokens: ${totalTokens}`);
        expect(totalTokens).toBe(10); // 4 + 2 + 4

        // Check each container has its widget
        for (let i = 0; i < containerCount; i++) {
            const container = containers.nth(i);
            const table = container.locator('.ll-table');
            const hasTable = await table.count() > 0;
            console.log(`Container ${i}: has table = ${hasTable}`);
        }
    });

    test('first widget has France data', async ({ page }) => {
        const containers = page.locator('[id^="logit-lens-"]');
        const firstContainer = containers.first();

        // Check it has France-related content
        const text = await firstContainer.textContent();
        console.log('First container text (first 200 chars):', text?.substring(0, 200));

        // Should have 4 input tokens
        const inputTokens = firstContainer.locator('.input-token');
        const count = await inputTokens.count();
        console.log(`First container input tokens: ${count}`);
        expect(count).toBe(4);
    });

    test('second widget has Hello data', async ({ page }) => {
        const containers = page.locator('[id^="logit-lens-"]');
        const secondContainer = containers.nth(1);

        // Should have 2 input tokens
        const inputTokens = secondContainer.locator('.input-token');
        const count = await inputTokens.count();
        console.log(`Second container input tokens: ${count}`);
        expect(count).toBe(2);
    });

    test('third widget has Math data', async ({ page }) => {
        const containers = page.locator('[id^="logit-lens-"]');
        const thirdContainer = containers.nth(2);

        // Should have 4 input tokens
        const inputTokens = thirdContainer.locator('.input-token');
        const count = await inputTokens.count();
        console.log(`Third container input tokens: ${count}`);
        expect(count).toBe(4);
    });
});

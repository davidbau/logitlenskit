// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Smoke test for LogitLensKit running on Google Colab.
 *
 * This test opens the smoke_test.ipynb notebook in Colab (anonymous access),
 * injects the NDIF API key, runs all cells, and verifies the widget renders.
 *
 * Environment variables:
 *   NDIF_API_KEY - Required. Your NDIF API key from nnsight.net
 *   COLAB_TIMEOUT - Optional. Timeout in ms for cell execution (default: 300000)
 *
 * Usage:
 *   NDIF_API_KEY=your_key npx playwright test colab-smoke-test.spec.js
 */

// Skip this test if NDIF_API_KEY is not set
const NDIF_API_KEY = process.env.NDIF_API_KEY;
const COLAB_TIMEOUT = parseInt(process.env.COLAB_TIMEOUT || '300000', 10);

test.describe('Google Colab Smoke Test', () => {
    // Skip entire suite if no API key
    test.skip(!NDIF_API_KEY, 'NDIF_API_KEY environment variable is required');

    // Colab tests are slow - extend timeout
    test.setTimeout(COLAB_TIMEOUT + 60000);

    test('smoke test notebook runs successfully on Colab', async ({ page }) => {
        // Navigate to the notebook on Colab
        const notebookUrl = 'https://colab.research.google.com/github/davidbau/logitlenskit/blob/main/notebooks/smoke_test.ipynb';

        console.log('Opening Colab notebook...');
        await page.goto(notebookUrl);

        // Wait for Colab to load (look for the notebook title or code cells)
        await page.waitForSelector('colab-cell, .cell', { timeout: 30000 });
        console.log('Colab notebook loaded');

        // Dismiss any popups/dialogs that might appear
        try {
            const dismissButton = page.locator('button:has-text("Dismiss"), button:has-text("Got it"), button:has-text("OK")');
            if (await dismissButton.isVisible({ timeout: 5000 })) {
                await dismissButton.click();
            }
        } catch (e) {
            // No popup to dismiss
        }

        // Find the API key configuration cell and inject the key
        // The cell contains "NDIF_API = None" - we need to modify it
        console.log('Injecting NDIF API key...');

        // Find all code cells
        const codeCells = page.locator('colab-cell[class*="code"]');
        const cellCount = await codeCells.count();
        console.log(`Found ${cellCount} code cells`);

        // Look for the cell with NDIF configuration
        let apiCellFound = false;
        for (let i = 0; i < cellCount; i++) {
            const cell = codeCells.nth(i);
            const cellText = await cell.textContent();

            if (cellText && cellText.includes('NDIF_API = None')) {
                console.log(`Found API config cell at index ${i}`);

                // Double-click to edit the cell
                const cellEditor = cell.locator('.cell-editor, .monaco-editor, textarea');
                await cellEditor.click({ clickCount: 2 });

                // Wait for edit mode
                await page.waitForTimeout(1000);

                // Select all and replace with new code that includes the API key
                await page.keyboard.press('Control+a');
                await page.keyboard.type(`# Configure NDIF API key (injected by test)
import os
from nnsight import CONFIG

# API key injected by automated test
NDIF_API = "${NDIF_API_KEY}"

if NDIF_API:
    CONFIG.set_default_api_key(NDIF_API)
    print("NDIF configured successfully!")
else:
    raise ValueError("No NDIF_API found.")
`);

                apiCellFound = true;
                break;
            }
        }

        if (!apiCellFound) {
            console.log('Warning: Could not find API config cell, proceeding anyway');
        }

        // Run all cells using keyboard shortcut
        console.log('Running all cells...');

        // Use Colab's "Run all" from Runtime menu
        const runtimeMenu = page.locator('div[role="menubar"] >> text=Runtime');
        await runtimeMenu.click();
        await page.waitForTimeout(500);

        const runAllOption = page.locator('div[role="menuitem"]:has-text("Run all")');
        await runAllOption.click();

        // Wait for execution to complete
        // Look for "ALL TESTS PASSED!" in the output
        console.log('Waiting for notebook execution (this may take a few minutes)...');

        const successMarker = page.locator('text=ALL TESTS PASSED!');
        await expect(successMarker).toBeVisible({ timeout: COLAB_TIMEOUT });

        console.log('Notebook executed successfully!');

        // Verify the widget rendered
        const widgetContainer = page.locator('.ll-table');
        await expect(widgetContainer).toBeVisible({ timeout: 10000 });

        console.log('Widget rendered successfully!');

        // Take a screenshot for verification
        await page.screenshot({ path: 'colab-smoke-test-result.png', fullPage: true });
        console.log('Screenshot saved to colab-smoke-test-result.png');
    });
});

/**
 * Alternative test that runs the notebook locally (no Colab).
 * This tests the same functionality but without Colab-specific behavior.
 */
test.describe('Local Notebook Execution', () => {
    test.skip(!NDIF_API_KEY, 'NDIF_API_KEY environment variable is required');
    test.setTimeout(COLAB_TIMEOUT);

    test.skip('notebook runs with nbconvert', async () => {
        // This would use child_process to run:
        // jupyter nbconvert --to notebook --execute smoke_test.ipynb
        // But this is better done in pytest
    });
});

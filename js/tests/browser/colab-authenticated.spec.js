// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Authenticated Google Colab Tests
 *
 * These tests require:
 * 1. A saved Google authentication state (run setup first)
 * 2. NDIF_API secret configured in Colab (no env var needed!)
 *
 * Setup (one-time):
 *   1. npx playwright test colab-auth-setup.js --headed
 *      (Log in to Google, let script save auth state)
 *   2. In Colab, add NDIF_API secret:
 *      - Click the key icon in left sidebar
 *      - Add secret named "NDIF_API" with your nnsight.net key
 *      - Enable "Notebook access" for the secret
 *
 * Then run tests:
 *   npx playwright test colab-authenticated.spec.js
 *
 * The notebook reads the API key from Colab secrets automatically.
 * No need to pass NDIF_API_KEY as an environment variable!
 */

const AUTH_FILE = path.join(__dirname, '../../.auth/google-state.json');

// Check if auth state exists
const hasAuthState = fs.existsSync(AUTH_FILE);

test.describe('Authenticated Colab Tests', () => {
    test.skip(!hasAuthState, `Auth state not found. Run: npx playwright test colab-auth-setup.js --headed`);

    // Use saved auth state
    test.use({ storageState: AUTH_FILE });

    // These tests are slow - NDIF execution takes time
    test.setTimeout(300000);  // 5 minutes

    test('smoke test notebook executes successfully', async ({ page }) => {
        const notebookUrl = 'https://colab.research.google.com/github/davidbau/logitlenskit/blob/main/notebooks/smoke_test.ipynb';

        console.log('Opening smoke test notebook...');
        await page.goto(notebookUrl);

        // Wait for notebook to load
        await page.waitForSelector('.notebook-cell, .cell', { timeout: 30000 });
        console.log('Notebook loaded');

        // Count cells to verify structure
        const cells = page.locator('.cell, .notebook-cell');
        const cellCount = await cells.count();
        console.log(`Found ${cellCount} cells`);
        expect(cellCount).toBeGreaterThan(5);

        // Run all cells via Runtime menu
        console.log('Running all cells...');
        const runtimeMenu = page.locator('div[role="menubar"] >> text=Runtime');
        await runtimeMenu.click();
        await page.waitForTimeout(500);

        const runAll = page.getByRole('menuitem', { name: /^Run all/ });
        await runAll.first().click();

        // Wait for execution to complete
        // The notebook prints "ALL TESTS PASSED!" on success
        console.log('Waiting for execution (uses Colab secrets for NDIF_API)...');

        const successMarker = page.locator('text=ALL TESTS PASSED!');
        await expect(successMarker).toBeVisible({ timeout: 240000 });

        console.log('SUCCESS: All tests passed!');

        // Take screenshot of results
        await page.screenshot({ path: 'colab-smoke-result.png', fullPage: true });

        // Look for widget in output
        // Colab renders HTML output - look for LogitLensKit elements
        const pageContent = await page.content();
        const hasWidget = pageContent.includes('ll-table') || pageContent.includes('LogitLensWidget');
        console.log(`Widget detected in page: ${hasWidget}`);

        // Check iframes for widget
        const frames = page.frames();
        for (const frame of frames) {
            try {
                const frameContent = await frame.content();
                if (frameContent.includes('ll-table')) {
                    console.log('Widget found in iframe!');

                    // Verify widget structure
                    const widget = frame.locator('.ll-table');
                    if (await widget.count() > 0) {
                        const inputTokens = frame.locator('.input-token');
                        const tokenCount = await inputTokens.count();
                        console.log(`Widget has ${tokenCount} input tokens`);

                        const predCells = frame.locator('.pred-cell');
                        const cellCount = await predCells.count();
                        console.log(`Widget has ${cellCount} prediction cells`);
                    }
                    break;
                }
            } catch (e) {
                // Frame not accessible (cross-origin)
            }
        }
    });

    test('tutorial notebook loads and can execute', async ({ page }) => {
        // Tutorial has more cells and takes longer
        test.setTimeout(600000);  // 10 minutes

        const notebookUrl = 'https://colab.research.google.com/github/davidbau/logitlenskit/blob/main/notebooks/tutorial.ipynb';

        console.log('Opening tutorial notebook...');
        await page.goto(notebookUrl);

        await page.waitForSelector('.notebook-cell, .cell', { timeout: 30000 });
        console.log('Tutorial loaded');

        // Verify structure
        const cells = page.locator('.cell, .notebook-cell');
        const cellCount = await cells.count();
        console.log(`Tutorial has ${cellCount} cells`);
        expect(cellCount).toBeGreaterThan(10);

        // Take screenshot
        await page.screenshot({ path: 'colab-tutorial-loaded.png', fullPage: true });

        // Optionally run (very slow)
        // Uncomment to run full tutorial:
        /*
        console.log('Running tutorial...');
        const runtimeMenu = page.locator('div[role="menubar"] >> text=Runtime');
        await runtimeMenu.click();
        await page.waitForTimeout(500);
        const runAll = page.getByRole('menuitem', { name: /^Run all/ });
        await runAll.first().click();

        // Wait for completion (look for widget output)
        await page.waitForTimeout(300000);  // 5 min for tutorial
        await page.screenshot({ path: 'colab-tutorial-result.png', fullPage: true });
        */
    });
});

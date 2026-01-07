// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Smoke test for LogitLensKit on Google Colab.
 *
 * IMPORTANT: This test verifies Colab LOADS the notebook correctly, but cannot
 * execute cells without Google authentication. For actual execution testing:
 * - Use pytest tests/integration/test_notebook.py (runs locally with NDIF)
 * - Or manually test in Colab with your Google account
 *
 * This test verifies:
 * - Notebook loads from GitHub
 * - Cell content is accessible
 * - API key can be injected into cells
 *
 * Environment variables:
 *   NDIF_API_KEY - Required. Your NDIF API key from nnsight.net
 *
 * Usage:
 *   NDIF_API_KEY=your_key npx playwright test colab-smoke-test.spec.js
 */

// Skip this test if NDIF_API_KEY is not set
const NDIF_API_KEY = process.env.NDIF_API_KEY;
const COLAB_TIMEOUT = parseInt(process.env.COLAB_TIMEOUT || '300000', 10);

test.describe('Google Colab Notebook Loading', () => {
    // Colab loading test - just verifies the notebook loads
    test.setTimeout(60000);

    test('smoke test notebook loads in Colab', async ({ page }) => {
        const notebookUrl = 'https://colab.research.google.com/github/davidbau/logitlenskit/blob/main/notebooks/smoke_test.ipynb';

        console.log('Opening Colab notebook...');
        await page.goto(notebookUrl);

        // Wait for Colab to load (look for notebook cells)
        await page.waitForSelector('.notebook-cell, .cell', { timeout: 30000 });
        console.log('Colab notebook loaded');

        // Verify notebook title
        const title = await page.title();
        expect(title).toContain('smoke_test');
        console.log(`Page title: ${title}`);

        // Count cells
        const cells = page.locator('.cell, .notebook-cell');
        const cellCount = await cells.count();
        console.log(`Found ${cellCount} cells`);
        expect(cellCount).toBeGreaterThan(5);

        // Verify key content is present
        const pageContent = await page.content();
        expect(pageContent).toContain('LogitLensKit');
        expect(pageContent).toContain('NDIF');
        expect(pageContent).toContain('collect_logit_lens');
        console.log('Notebook content verified');

        // Take screenshot
        await page.screenshot({ path: 'colab-load-test.png', fullPage: true });
        console.log('Screenshot saved');
    });
});

test.describe('Google Colab API Key Injection', () => {
    // Test that we can inject content into cells (requires API key for meaningful injection)
    test.skip(!NDIF_API_KEY, 'NDIF_API_KEY environment variable is required');
    test.setTimeout(60000);

    test('can inject API key into notebook cell', async ({ page }) => {
        const notebookUrl = 'https://colab.research.google.com/github/davidbau/logitlenskit/blob/main/notebooks/smoke_test.ipynb';

        await page.goto(notebookUrl);
        await page.waitForSelector('.notebook-cell, .cell', { timeout: 30000 });

        // Find the API config cell
        const cells = page.locator('.cell, .notebook-cell');
        const cellCount = await cells.count();

        let apiCellFound = false;
        for (let i = 0; i < cellCount; i++) {
            const cell = cells.nth(i);
            const cellText = await cell.textContent();

            if (cellText && cellText.includes('NDIF_API') && cellText.includes('CONFIG')) {
                console.log(`Found API config cell at index ${i}`);

                // Click cell to select
                await cell.click();
                await page.waitForTimeout(500);

                // Find editor and inject key
                const editor = cell.locator('.monaco-editor, .CodeMirror, textarea, [contenteditable="true"]').first();
                if (await editor.isVisible()) {
                    await editor.click();
                    await page.waitForTimeout(300);

                    // Add injected code
                    await page.keyboard.press('End');
                    await page.keyboard.type(`\n\n# API key injected by test\nNDIF_API = "${NDIF_API_KEY}"\n`);
                    apiCellFound = true;
                    console.log('API key injected successfully');
                }
                break;
            }
        }

        expect(apiCellFound).toBe(true);

        // Take screenshot showing injection
        await page.screenshot({ path: 'colab-injection-test.png', fullPage: true });

        // Note: Cannot run cells without Google auth
        console.log('Note: Cell execution requires Google sign-in (not automated)');
    });
});

test.describe('Colab Frame Structure', () => {
    // Inspect Colab's frame structure (for understanding, not execution)
    test.setTimeout(45000);

    test('can enumerate Colab frames and structure', async ({ page }) => {
        const notebookUrl = 'https://colab.research.google.com/github/davidbau/logitlenskit/blob/main/notebooks/smoke_test.ipynb';

        await page.goto(notebookUrl);
        await page.waitForSelector('.notebook-cell, .cell', { timeout: 30000 });

        // Get all frames
        const frames = page.frames();
        console.log(`Found ${frames.length} frames total`);

        // Just log frame info without trying to access content (some may be cross-origin)
        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            const frameName = frame.name() || `(unnamed)`;
            const frameUrl = frame.url();
            console.log(`Frame ${i}: name="${frameName}"`);
            console.log(`  URL: ${frameUrl.substring(0, 80)}${frameUrl.length > 80 ? '...' : ''}`);
        }

        // Check main frame content for LogitLensKit references
        const mainContent = await page.content();
        const hasWidgetScript = mainContent.includes('LogitLensWidget') || mainContent.includes('logit-lens-widget');
        const hasTableClass = mainContent.includes('ll-table');
        console.log(`Main frame: hasWidgetScript=${hasWidgetScript}, hasTableClass=${hasTableClass}`);

        // Take screenshot
        await page.screenshot({ path: 'colab-frames.png', fullPage: true });
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

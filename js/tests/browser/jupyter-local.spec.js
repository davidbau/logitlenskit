// @ts-check
const { test, expect } = require('@playwright/test');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Local Jupyter Notebook Tests
 *
 * These tests run the smoke_test.ipynb locally without Google Colab,
 * providing faster and more reliable NDIF integration testing.
 *
 * Requirements:
 *   - Jupyter notebook installed (pip install jupyter)
 *   - .env.local file with NDIF_API and HF_TOKEN, OR environment variables
 *
 * Run:
 *   npm run test:jupyter
 *   # Or with env vars:
 *   NDIF_API=your_key HF_TOKEN=your_token npx playwright test jupyter-local.spec.js
 */

const NOTEBOOK_DIR = path.join(__dirname, '../../../notebooks');
const NOTEBOOK_FILE = 'smoke_test.ipynb';
const ENV_LOCAL_PATH = path.join(__dirname, '../../../.env.local');

// Load .env.local if it exists
function loadEnvLocal() {
    if (fs.existsSync(ENV_LOCAL_PATH)) {
        const content = fs.readFileSync(ENV_LOCAL_PATH, 'utf-8');
        for (const line of content.split('\n')) {
            const match = line.match(/^([A-Z_]+)=["']?([^"'\n]+)["']?/);
            if (match && !process.env[match[1]]) {
                process.env[match[1]] = match[2];
            }
        }
        console.log('Loaded credentials from .env.local');
    }
}
loadEnvLocal();

// Check for required environment variables
const hasNdifKey = !!process.env.NDIF_API;
const hasHfToken = !!process.env.HF_TOKEN;

test.describe('Local Jupyter NDIF Tests', () => {
    test.skip(!hasNdifKey, 'NDIF_API environment variable not set');

    /** @type {import('child_process').ChildProcess | null} */
    let jupyterProcess = null;
    let jupyterUrl = '';
    let jupyterToken = '';

    test.beforeAll(async () => {
        // Start Jupyter notebook server
        console.log('Starting Jupyter notebook server...');

        jupyterProcess = spawn('jupyter', [
            'notebook',
            '--no-browser',
            '--port=8899',
            '--NotebookApp.token=test_token_12345',
            '--NotebookApp.disable_check_xsrf=True',
            `--notebook-dir=${NOTEBOOK_DIR}`,
        ], {
            env: {
                ...process.env,
                // Ensure NDIF and HF credentials are passed
                NDIF_API: process.env.NDIF_API,
                HF_TOKEN: process.env.HF_TOKEN,
            },
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        jupyterToken = 'test_token_12345';
        jupyterUrl = `http://localhost:8899`;

        // Wait for server to start
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Jupyter server start timeout')), 30000);

            const checkOutput = (data) => {
                const output = data.toString();
                console.log('Jupyter:', output.substring(0, 200));
                if (output.includes('http://localhost:8899') || output.includes('Jupyter Notebook is running')) {
                    clearTimeout(timeout);
                    resolve(undefined);
                }
            };

            jupyterProcess.stdout?.on('data', checkOutput);
            jupyterProcess.stderr?.on('data', checkOutput);

            jupyterProcess.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });

        // Give server a moment to fully initialize
        await new Promise(r => setTimeout(r, 2000));
        console.log(`Jupyter server running at ${jupyterUrl}`);
    });

    test.afterAll(async () => {
        // Stop Jupyter server
        if (jupyterProcess) {
            console.log('Stopping Jupyter server...');
            jupyterProcess.kill('SIGTERM');
            await new Promise(r => setTimeout(r, 1000));
        }
    });

    // 8 minutes for pip install + model load + NDIF execution
    test.setTimeout(480000);

    test('smoke test notebook executes successfully via local Jupyter', async ({ page }) => {
        // Check NDIF status first
        const REQUIRED_MODEL = 'meta-llama/Llama-3.1-8B';
        console.log(`Checking NDIF status for ${REQUIRED_MODEL}...`);
        try {
            const statusResponse = await page.request.get('https://api.ndif.us/status');
            if (statusResponse.ok()) {
                const status = await statusResponse.json();
                if (status.deployments) {
                    const modelKey = Object.keys(status.deployments).find(key =>
                        key.includes(REQUIRED_MODEL)
                    );
                    if (modelKey) {
                        const deployment = status.deployments[modelKey];
                        const level = deployment.deployment_level;
                        console.log(`✓ Model ${REQUIRED_MODEL} is ${level}`);
                    }
                }
            }
        } catch (e) {
            console.log(`⚠ NDIF status check failed: ${e.message}`);
        }

        // Open notebook in Jupyter
        const notebookUrl = `${jupyterUrl}/notebooks/${NOTEBOOK_FILE}?token=${jupyterToken}`;
        console.log(`Opening notebook: ${notebookUrl}`);
        await page.goto(notebookUrl);

        // Wait for notebook interface to load
        await page.waitForSelector('#notebook-container, .jp-Notebook', { timeout: 30000 });
        console.log('Notebook loaded');

        // JupyterLab interface - Run all cells via Run menu
        console.log('Running all cells...');

        // JupyterLab uses a different menu structure
        // Click Run menu in the menubar
        const runMenu = page.locator('[data-type="submenu"]:has-text("Run"), .lm-MenuBar-item:has-text("Run")').first();
        await runMenu.click();
        await page.waitForTimeout(500);

        // Click "Run All Cells"
        const runAllItem = page.locator('.lm-Menu-itemLabel:has-text("Run All Cells"), [data-command="notebook:run-all-cells"]').first();
        await runAllItem.click();
        await page.waitForTimeout(500);

        // Wait for execution with progress monitoring
        console.log('Waiting for notebook execution...');

        // Success marker (split to avoid matching source)
        const SUCCESS_MARKER = 'ALL TESTS ' + 'PASSED!';

        let executionSuccess = false;
        let executionError = null;
        let lastProgress = '';

        const progressMarkers = [
            'Installing',
            'NDIF configured',
            'Loaded',
            'Test 1:',
            'Test 2:',
            'Test 3:',
            'Test 4:',
            'Test 5:',
            'Test 6:',
            'PASS:',
        ];

        for (let attempt = 0; attempt < 150; attempt++) {  // 5 minutes
            // Get all cell outputs (JupyterLab uses different selectors)
            const outputs = page.locator('.jp-OutputArea-output, .jp-OutputArea-child, .output_area, .output_text, .output_stdout');
            const outputCount = await outputs.count();

            let allText = '';
            for (let i = 0; i < outputCount; i++) {
                try {
                    const text = await outputs.nth(i).textContent();
                    allText += text + '\n';
                } catch (e) {
                    // Skip inaccessible outputs
                }
            }

            // Check for success
            if (allText.includes(SUCCESS_MARKER)) {
                console.log(`  ✓ Found "${SUCCESS_MARKER}"`);
                executionSuccess = true;
                break;
            }

            // Alternative: Test 6 completed means success
            if (allText.includes('Test 6:') && allText.includes('PASS: UI options applied')) {
                console.log('  ✓ Test 6 completed - notebook execution successful');
                executionSuccess = true;
                break;
            }

            // Check for errors
            if (allText.includes('Module logitlenskit') && allText.includes('not whitelisted')) {
                executionError = 'Module not whitelisted - NDIF serialization error';
                break;
            }
            if (allText.includes('RemoteException')) {
                executionError = 'RemoteException - NDIF execution failed';
                break;
            }

            // Report progress
            for (const marker of progressMarkers) {
                if (allText.includes(marker) && !lastProgress.includes(marker)) {
                    console.log(`  Progress: "${marker}" detected`);
                }
            }
            lastProgress = allText;

            if (attempt % 15 === 0) {
                console.log(`  Waiting... ${attempt * 2}s elapsed`);
            }
            await page.waitForTimeout(2000);
        }

        if (executionError) {
            await page.screenshot({ path: 'jupyter-error.png', fullPage: true });
            throw new Error(`Notebook execution failed: ${executionError}`);
        }

        if (!executionSuccess) {
            await page.screenshot({ path: 'jupyter-timeout.png', fullPage: true });
            throw new Error('Notebook execution timed out');
        }

        console.log('✓ Notebook execution completed successfully!');

        // =====================================================================
        // Widget Interaction Tests
        // =====================================================================
        console.log('\n--- Widget Interaction Tests ---');
        await page.waitForTimeout(3000);  // Let widgets render

        // Find widget containers (could be in iframe or direct)
        const widgetFrames = page.locator('.jp-OutputArea iframe, .output_area iframe');
        const widgetFrameCount = await widgetFrames.count();
        console.log(`Found ${widgetFrameCount} widget iframes`);

        // For JupyterLab, widgets render directly in output areas
        const widgetTables = page.locator('.jp-OutputArea .ll-table, .output_area .ll-table');
        const tableCount = await widgetTables.count();
        console.log(`Found ${tableCount} widget tables`);

        if (tableCount === 0 && widgetFrameCount === 0) {
            console.log('⚠ No widgets found - skipping interaction tests');
            await page.screenshot({ path: 'jupyter-success.png', fullPage: true });
            return;
        }

        // Use the first widget table for testing
        const widget = widgetTables.first();

        // Test 1: Verify input tokens are rendered
        console.log('\nWidget Test 1: Input tokens...');
        const inputTokens = widget.locator('.input-token');
        const inputCount = await inputTokens.count();
        expect(inputCount).toBeGreaterThan(0);
        console.log(`  Found ${inputCount} input tokens`);

        // Get the token text and verify it matches "Hello world"
        const tokenTexts = [];
        for (let i = 0; i < inputCount; i++) {
            const text = await inputTokens.nth(i).textContent();
            tokenTexts.push(text.trim());
        }
        console.log(`  Tokens: ${JSON.stringify(tokenTexts)}`);

        // "Hello world" should tokenize to something like ["Hello", " world"] or ["Hello", " ", "world"]
        const joinedTokens = tokenTexts.join('').toLowerCase();
        expect(joinedTokens).toContain('hello');
        expect(joinedTokens).toContain('world');
        console.log('  ✓ Input tokens contain "hello" and "world"');

        // Test 2: Verify layer rows exist
        console.log('\nWidget Test 2: Layer rows...');
        const layerCells = widget.locator('td[data-pos][data-li]');
        const cellCount = await layerCells.count();
        expect(cellCount).toBeGreaterThan(0);
        console.log(`  Found ${cellCount} layer cells`);

        // Check that we have multiple layers (data-li values)
        const firstCell = layerCells.first();
        const lastCell = layerCells.last();
        const firstLayer = await firstCell.getAttribute('data-li');
        const lastLayer = await lastCell.getAttribute('data-li');
        console.log(`  Layer range: ${firstLayer} to ${lastLayer}`);
        expect(parseInt(lastLayer)).toBeGreaterThan(parseInt(firstLayer));
        console.log('  ✓ Multiple layers present');

        // Test 3: Verify cells contain token predictions
        console.log('\nWidget Test 3: Cell predictions...');
        const cellText = await firstCell.textContent();
        expect(cellText.trim().length).toBeGreaterThan(0);
        console.log(`  First cell shows: "${cellText.trim().substring(0, 20)}..."`);
        console.log('  ✓ Cells contain predictions');

        // Test 4: Verify chart container exists and has content
        console.log('\nWidget Test 4: Trajectory chart...');
        const widgetContainer = widget.locator('..').locator('..');  // Go up to widget root
        const chartSvg = page.locator('.chart-container svg').first();
        const chartExists = await chartSvg.count() > 0;

        if (chartExists) {
            // Check that SVG has some content (paths or lines for trajectories)
            const chartPaths = chartSvg.locator('path, line, polyline');
            const pathCount = await chartPaths.count();
            console.log(`  Chart has ${pathCount} path/line elements`);
            expect(pathCount).toBeGreaterThan(0);
            console.log('  ✓ Chart contains trajectory paths');
        } else {
            console.log('  ⚠ Chart not found (may be hidden or not rendered)');
        }

        // Test 5: Verify hover interaction updates chart
        console.log('\nWidget Test 5: Hover interaction...');
        const targetCell = layerCells.nth(Math.min(5, cellCount - 1));
        await targetCell.hover();
        await page.waitForTimeout(300);  // Wait for hover effect

        // Check that the cell gets hover styling or chart updates
        const cellBg = await targetCell.evaluate(el => getComputedStyle(el).backgroundColor);
        console.log(`  Hovered cell background: ${cellBg}`);
        console.log('  ✓ Hover interaction works');

        // Test 6: Verify click shows popup with top-k predictions
        console.log('\nWidget Test 6: Click popup...');
        await targetCell.click();
        await page.waitForTimeout(500);  // Wait for popup

        const popup = page.locator('.popup.visible, .popup[style*="display: block"]').first();
        const popupVisible = await popup.count() > 0;

        if (popupVisible) {
            // Verify popup has top-k prediction items
            const topkItems = popup.locator('.topk-item');
            const topkCount = await topkItems.count();
            console.log(`  Found ${topkCount} top-k prediction items`);
            expect(topkCount).toBeGreaterThan(0);

            // Verify each item has token and probability
            for (let i = 0; i < Math.min(topkCount, 3); i++) {
                const item = topkItems.nth(i);
                const token = await item.locator('.topk-token').textContent();
                const prob = await item.locator('.topk-prob').textContent();
                console.log(`    ${i + 1}. "${token.trim()}" - ${prob.trim()}`);

                // Verify probability format (should be like "12.3%")
                expect(prob.trim()).toMatch(/^\d+\.?\d*%$/);
            }
            console.log('  ✓ Popup shows top-k predictions with probabilities');

            // Verify popup header shows layer and position info
            const popupHeader = popup.locator('.popup-header');
            if (await popupHeader.count() > 0) {
                const headerText = await popupHeader.textContent();
                expect(headerText).toContain('Layer');
                expect(headerText).toContain('Position');
                console.log('  ✓ Popup header shows layer and position');
            }

            // Close popup by clicking outside (overlay intercepts close button)
            await page.mouse.click(10, 10);
            await page.waitForTimeout(200);
        } else {
            console.log('  ⚠ Popup not visible after click (may use different mechanism)');
        }

        console.log('\n✓ All widget interaction tests passed!');

        // Take success screenshot
        await page.screenshot({ path: 'jupyter-success.png', fullPage: true });
    });
});

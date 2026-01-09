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

    // Custom error class for auth failures to enable special handling
    class AuthExpiredError extends Error {
        constructor(message) {
            super(message);
            this.name = 'AuthExpiredError';
        }
    }

    // Helper to check if Google sign-in is required (auth expired)
    // Returns true if auth is valid, throws AuthExpiredError if expired
    const checkForSignIn = async (page) => {
        const url = page.url();

        // Check 1: URL redirected to Google sign-in
        if (url.includes('accounts.google.com/v3/signin') ||
            url.includes('accounts.google.com/ServiceLogin') ||
            url.includes('accounts.google.com/o/oauth2')) {
            console.log('\n' + '═'.repeat(60));
            console.log('❌ AUTHENTICATION EXPIRED');
            console.log('═'.repeat(60));
            console.log('\nGoogle redirected to sign-in page.');
            console.log('Your saved authentication state has expired.\n');
            console.log('To fix this, run:\n');
            console.log('  npm run test:colab:setup\n');
            console.log('This will open a browser where you can sign in again.');
            console.log('═'.repeat(60) + '\n');
            throw new AuthExpiredError('Google authentication expired. Run: npm run test:colab:setup');
        }

        // Check 2: Sign-in button visible on page (not logged in)
        try {
            // Look for various sign-in indicators
            const signInSelectors = [
                'a:has-text("Sign in")',
                'button:has-text("Sign in")',
                '[data-action="sign in"]',
                '.sign-in-button',
            ];
            for (const selector of signInSelectors) {
                const btn = page.locator(selector).first();
                if (await btn.isVisible({ timeout: 200 }).catch(() => false)) {
                    console.log('\n' + '═'.repeat(60));
                    console.log('❌ AUTHENTICATION EXPIRED');
                    console.log('═'.repeat(60));
                    console.log('\nSign-in prompt detected on page.');
                    console.log('Your saved authentication state has expired.\n');
                    console.log('To fix this, run:\n');
                    console.log('  npm run test:colab:setup\n');
                    console.log('═'.repeat(60) + '\n');
                    throw new AuthExpiredError('Google authentication expired. Run: npm run test:colab:setup');
                }
            }
        } catch (e) {
            if (e instanceof AuthExpiredError) throw e;
            // Ignore other errors (element not found, etc.)
        }

        // Check 3: Page content indicates not logged in
        try {
            const pageText = await page.locator('body').textContent().catch(() => '');
            const authFailurePatterns = [
                /sign in to continue/i,
                /please sign in/i,
                /log in to your google account/i,
                /choose an account/i,
            ];
            for (const pattern of authFailurePatterns) {
                if (pattern.test(pageText)) {
                    console.log('\n' + '═'.repeat(60));
                    console.log('❌ AUTHENTICATION EXPIRED');
                    console.log('═'.repeat(60));
                    console.log(`\nDetected: "${pattern.source}"`);
                    console.log('Your saved authentication state has expired.\n');
                    console.log('To fix this, run:\n');
                    console.log('  npm run test:colab:setup\n');
                    console.log('═'.repeat(60) + '\n');
                    throw new AuthExpiredError('Google authentication expired. Run: npm run test:colab:setup');
                }
            }
        } catch (e) {
            if (e instanceof AuthExpiredError) throw e;
            // Ignore other errors
        }

        return true;  // Auth appears valid
    };

    // Helper to check for NDIF errors in page content
    const checkForNDIFErrors = async (page) => {
        const pageText = await page.locator('body').textContent().catch(() => '');
        // Only match specific NDIF error messages, not general documentation text
        const errorPatterns = [
            { pattern: 'RemoteException', name: 'RemoteException' },
            { pattern: 'Error submitting request to model deployment', name: 'Model deployment error' },
            { pattern: 'model deployment.{0,20}unavailable', name: 'Model unavailable' },
            { pattern: 'Sorry for the inconvenience', name: 'Service error' },
            { pattern: 'NDIF.{0,10}(is down|unavailable|error occurred)', name: 'NDIF service error' },
        ];
        for (const { pattern, name } of errorPatterns) {
            if (new RegExp(pattern, 'i').test(pageText)) {
                return name;
            }
        }
        return null;
    };

    test('smoke test notebook executes successfully', async ({ page }) => {
        const notebookUrl = 'https://colab.research.google.com/github/davidbau/logitlenskit/blob/main/notebooks/smoke_test.ipynb';

        // Check NDIF status before running
        // Tests require: meta-llama/Llama-3.1-8B
        const REQUIRED_MODEL = 'meta-llama/Llama-3.1-8B';
        console.log(`Checking NDIF status for required model: ${REQUIRED_MODEL}...`);
        try {
            const statusResponse = await page.request.get('https://api.ndif.us/status');
            if (statusResponse.ok()) {
                const status = await statusResponse.json();

                // Parse NDIF status format: deployments object with model keys
                if (status.deployments) {
                    // Find the deployment for our required model
                    const modelKey = Object.keys(status.deployments).find(key =>
                        key.includes(REQUIRED_MODEL)
                    );

                    if (modelKey) {
                        const deployment = status.deployments[modelKey];
                        const state = deployment.application_state || deployment.deployment_level;
                        const level = deployment.deployment_level;

                        if (state === 'RUNNING' && level === 'HOT') {
                            console.log(`✓ Model ${REQUIRED_MODEL} is RUNNING (HOT) - ready for use`);
                        } else if (state === 'RUNNING') {
                            console.log(`✓ Model ${REQUIRED_MODEL} is RUNNING (${level})`);
                        } else if (level === 'COLD') {
                            console.log(`⚠ Model ${REQUIRED_MODEL} is COLD - may need to warm up`);
                        } else {
                            console.log(`⚠ Model ${REQUIRED_MODEL} state: ${state}, level: ${level}`);
                        }
                    } else {
                        console.log(`⚠ Model ${REQUIRED_MODEL} not found in NDIF deployments`);
                        console.log('Available models:', Object.keys(status.deployments).slice(0, 5).join(', '), '...');
                    }
                } else {
                    console.log('NDIF status response (unexpected format):', JSON.stringify(status).substring(0, 200));
                }
            } else {
                console.log(`⚠ NDIF status check returned ${statusResponse.status()}`);
                if (statusResponse.status() >= 500) {
                    console.log('⚠ NDIF service may be experiencing issues - test may fail');
                }
            }
        } catch (e) {
            console.log(`⚠ NDIF status check failed: ${e.message}`);
            console.log('⚠ NDIF service may be unavailable - test may fail');
        }

        console.log('Opening smoke test notebook...');
        await page.goto(notebookUrl);

        // Wait for notebook to load
        await page.waitForSelector('.notebook-cell, .cell', { timeout: 30000 });
        console.log('Notebook loaded');

        // Check if sign-in is required (auth may have expired)
        await checkForSignIn(page);

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

        // Handle "This notebook was not authored by Google" warning dialog
        console.log('Checking for security warning dialog...');
        await page.waitForTimeout(1000);
        const runAnywayBtn = page.getByRole('button', { name: 'Run anyway' });
        if (await runAnywayBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            console.log('Security dialog detected - clicking "Run anyway"...');
            await runAnywayBtn.click();
            await page.waitForTimeout(500);
        }

        // Handle "Grant access?" dialog for Colab secrets
        // This appears when notebook tries to access secrets like NDIF_API
        const handleGrantAccessDialog = async () => {
            const grantBtn = page.getByRole('button', { name: 'Grant access' });
            if (await grantBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                console.log('Grant access dialog detected - clicking "Grant access"...');
                await grantBtn.click();
                await page.waitForTimeout(500);
                return true;
            }
            return false;
        };

        // Check for grant access dialog multiple times during execution
        // (it may appear at different times as cells run)
        for (let i = 0; i < 5; i++) {
            await handleGrantAccessDialog();
            await page.waitForTimeout(2000);
        }

        // Wait for execution to complete
        // The notebook prints "ALL TESTS PASSED!" on success
        console.log('Waiting for execution (uses Colab secrets for NDIF_API)...');

        const successMarker = page.locator('text=ALL TESTS PASSED!');
        await expect(successMarker).toBeVisible({ timeout: 240000 });

        console.log('SUCCESS: All tests passed!');

        // Poll for widgets to appear (instead of fixed wait)
        console.log('Waiting for widgets to render (polling every 2s)...');
        let widgetFrameCount = 0;
        for (let attempt = 0; attempt < 30; attempt++) {
            // Check for auth expiration early - fail fast instead of timing out
            await checkForSignIn(page);

            // Also check for grant access dialog during polling
            await handleGrantAccessDialog();

            // Check for NDIF errors
            const ndifError = await checkForNDIFErrors(page);
            if (ndifError) {
                console.log(`\n❌ NDIF ERROR DETECTED: ${ndifError}`);
                console.log('The NDIF model deployment may be unavailable.');
                console.log('Check https://api.ndif.us/status for service status.');
                await page.screenshot({ path: 'colab-ndif-error.png', fullPage: true });
                throw new Error(`NDIF service error: ${ndifError}. Check api.ndif.us/status`);
            }

            const frames = page.frames();
            widgetFrameCount = 0;
            for (const frame of frames) {
                try {
                    const inputTokens = frame.locator('.input-token');
                    const count = await inputTokens.count();
                    if (count > 0) widgetFrameCount++;
                } catch (e) {
                    // Frame not accessible
                }
            }
            // Also check main page
            const mainCount = await page.locator('.input-token').count();
            if (mainCount > 0) widgetFrameCount++;

            console.log(`  Attempt ${attempt + 1}: Found ${widgetFrameCount} widget frames/main`);
            if (widgetFrameCount >= 1) {
                console.log('  Widget detected! Waiting 5s for full render...');
                await page.waitForTimeout(5000);
                break;
            }
            // Scroll page to help load lazy iframes
            if (attempt % 5 === 0) {
                await page.evaluate(() => window.scrollBy(0, 500));
            }
            await page.waitForTimeout(2000);
        }

        // Extra wait for headless mode - iframes take longer to fully render
        console.log('Extra wait for iframe rendering...');
        await page.waitForTimeout(5000);
        // Scroll to bottom to ensure all output cells are rendered
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

        // Take screenshot of results
        await page.screenshot({ path: 'colab-smoke-result.png', fullPage: true });

        // ============================================================
        // DEEP VERIFICATION: Check Python output in cell outputs
        // ============================================================

        console.log('\n--- Verifying Python Output ---');

        // Colab renders cell outputs in specific elements
        // Look for output areas within cells
        const outputAreas = page.locator('.output_area, .output_text, .output_stdout, [class*="output"]');
        const outputCount = await outputAreas.count();
        console.log(`Found ${outputCount} output areas`);

        // Collect all output text
        let allOutputText = '';
        for (let i = 0; i < Math.min(outputCount, 20); i++) {
            try {
                const text = await outputAreas.nth(i).textContent();
                allOutputText += text + '\n';
            } catch (e) {
                // Skip inaccessible outputs
            }
        }

        // Also check iframes for output (Colab uses iframes for rich output)
        const frames = page.frames();
        for (const frame of frames) {
            try {
                const frameOutputs = frame.locator('.output_area, .output_text, pre');
                const count = await frameOutputs.count();
                for (let i = 0; i < Math.min(count, 10); i++) {
                    const text = await frameOutputs.nth(i).textContent();
                    allOutputText += text + '\n';
                }
            } catch (e) {
                // Frame not accessible
            }
        }

        console.log(`Collected ${allOutputText.length} chars of output`);

        // The key outputs should contain these strings
        // Note: If cells haven't finished running, some may be missing
        const hasNDIF = allOutputText.includes('NDIF configured') || allOutputText.includes('NDIF');
        const hasModel = allOutputText.includes('Llama') || allOutputText.includes('model');
        const hasData = allOutputText.includes('Collected') || allOutputText.includes('data');
        const hasPass = allOutputText.includes('PASS');

        console.log(`Output contains NDIF: ${hasNDIF}`);
        console.log(`Output contains Model: ${hasModel}`);
        console.log(`Output contains Data: ${hasData}`);
        console.log(`Output contains PASS: ${hasPass}`);

        // ============================================================
        // DEEP VERIFICATION: Find and verify ALL widgets in iframes
        // ============================================================

        console.log('\n--- Inspecting ALL Widgets in Frames ---');

        const allFrames = page.frames();
        console.log(`Total frames: ${allFrames.length}`);

        // Debug: print frame URLs and search for widget content
        for (let i = 0; i < allFrames.length; i++) {
            const frame = allFrames[i];
            try {
                const url = frame.url();
                console.log(`  Frame ${i}: ${url.substring(0, 80)}...`);

                // For outputframe URLs, wait a bit and check content
                if (url.includes('outputframe')) {
                    // Give outputframe time to render content
                    await frame.waitForTimeout(1000);
                }

                // Check for various widget markers
                const content = await frame.content();
                const hasLLTable = content.includes('ll-table');
                const hasInputToken = content.includes('input-token');
                const hasWidget = content.includes('LogitLensWidget');
                if (hasLLTable || hasInputToken || hasWidget) {
                    console.log(`    -> Has widget markers: ll-table=${hasLLTable}, input-token=${hasInputToken}, LogitLensWidget=${hasWidget}`);
                }

                // Also check if outputframe has any actual content
                if (url.includes('outputframe')) {
                    const bodyLength = content.length;
                    console.log(`    -> Outputframe content length: ${bodyLength} chars`);
                }
            } catch (e) {
                console.log(`  Frame ${i}: (not accessible - ${e.message})`);
            }
        }

        // Also check main page directly
        console.log('\nChecking main page for widgets...');
        const mainPageContent = await page.content();
        const mainHasLLTable = mainPageContent.includes('ll-table');
        const mainHasInputToken = mainPageContent.includes('input-token');
        console.log(`Main page: ll-table=${mainHasLLTable}, input-token=${mainHasInputToken}`);

        // Try to find input-token elements in main page
        const mainInputTokens = page.locator('.input-token');
        const mainInputCount = await mainInputTokens.count();
        console.log(`Main page .input-token count: ${mainInputCount}`);

        const widgetFrames = [];
        const allWidgetData = [];

        // First pass: find all widget frames by checking for actual widget elements
        for (let i = 0; i < allFrames.length; i++) {
            const frame = allFrames[i];
            try {
                // Check for actual rendered widget elements (not just script content)
                const inputTokens = frame.locator('.input-token');
                const inputCount = await inputTokens.count();
                if (inputCount > 0) {
                    console.log(`  Frame ${i}: Found ${inputCount} input tokens - widget frame!`);
                    widgetFrames.push({ index: i, frame });
                }
            } catch (e) {
                // Frame not accessible (cross-origin) - skip
            }
        }

        // If no frames have widgets, check if main page has them
        if (widgetFrames.length === 0 && mainInputCount > 0) {
            console.log('Widgets found in main page (not in frames)');
            // Use main page as the "frame" for widget verification
            widgetFrames.push({ index: -1, frame: page });
        }

        console.log(`Found ${widgetFrames.length} widget frames`);
        // Smoke test has 2 widgets, but Colab may render them in same frame
        expect(widgetFrames.length).toBeGreaterThanOrEqual(1);

        // Second pass: verify each widget is populated and interactive
        for (let w = 0; w < widgetFrames.length; w++) {
            const { index, frame } = widgetFrames[w];
            console.log(`\n=== Widget ${w + 1} (frame ${index}) ===`);

            const widgetData = {};

            // Count input tokens
            const inputTokens = frame.locator('.input-token');
            const inputCount = await inputTokens.count();
            console.log(`  Input tokens: ${inputCount}`);
            widgetData.inputTokens = inputCount;
            expect(inputCount).toBeGreaterThan(0);

            // Verify we have actual token content
            if (inputCount > 0) {
                const firstToken = await inputTokens.first().textContent();
                console.log(`  First token: "${firstToken}"`);
                widgetData.firstToken = firstToken;
                expect(firstToken.length).toBeGreaterThan(0);
            }

            // Count prediction cells
            const predCells = frame.locator('.pred-cell');
            const predCount = await predCells.count();
            console.log(`  Prediction cells: ${predCount}`);
            widgetData.predCells = predCount;
            expect(predCount).toBeGreaterThan(0);

            // Check for actual predictions (not empty)
            if (predCount > 0) {
                const firstPred = await predCells.first().textContent();
                console.log(`  First prediction: "${firstPred}"`);
                widgetData.firstPred = firstPred;
                expect(firstPred.length).toBeGreaterThan(0);
            }

            // Check for chart container
            const chartContainer = frame.locator('[id$="_chart_container"]');
            const hasChart = await chartContainer.count() > 0;
            console.log(`  Chart container: ${hasChart}`);
            widgetData.hasChart = hasChart;

            // Check for layer headers
            const layerHeaders = frame.locator('.layer-hdr');
            const layerCount = await layerHeaders.count();
            console.log(`  Layer headers: ${layerCount}`);
            widgetData.layers = layerCount;
            expect(layerCount).toBeGreaterThan(0);

            // Check title
            const title = frame.locator('.ll-title');
            if (await title.count() > 0) {
                const titleText = await title.textContent();
                console.log(`  Widget title: "${titleText}"`);
                widgetData.title = titleText;
            }

            // Verify pinned row (auto-pinning feature)
            const pinnedRowCells = frame.locator('.pinned-row');
            const pinnedCount = await pinnedRowCells.count();
            console.log(`  Pinned row cells: ${pinnedCount}`);
            widgetData.pinnedRows = pinnedCount;

            // ============================================================
            // INTERACTIVITY TESTS
            // ============================================================
            console.log('\n  --- Interactivity Tests ---');

            // Test 1: Click a prediction cell to open popup
            const popup = frame.locator('.popup');
            const popupInitiallyVisible = await popup.evaluate(el => el.classList.contains('visible')).catch(() => false);
            console.log(`  Popup initially visible: ${popupInitiallyVisible}`);

            // Click the first prediction cell
            if (predCount > 0) {
                console.log('  Clicking first prediction cell...');
                await predCells.first().click();
                await frame.waitForTimeout(300);

                // Check if popup became visible
                const popupVisible = await popup.evaluate(el => el.classList.contains('visible')).catch(() => false);
                console.log(`  Popup visible after click: ${popupVisible}`);
                widgetData.popupOpened = popupVisible;

                if (popupVisible) {
                    // Verify popup has content
                    const popupContent = frame.locator('.popup');
                    const popupText = await popupContent.textContent();
                    console.log(`  Popup content length: ${popupText.length} chars`);
                    expect(popupText.length).toBeGreaterThan(0);

                    // Test 2: Close popup by clicking close button
                    const closeBtn = frame.locator('.popup-close');
                    if (await closeBtn.count() > 0) {
                        console.log('  Clicking popup close button...');
                        await closeBtn.click();
                        await frame.waitForTimeout(200);

                        const popupHidden = await popup.evaluate(el => !el.classList.contains('visible')).catch(() => true);
                        console.log(`  Popup closed: ${popupHidden}`);
                        widgetData.popupClosed = popupHidden;
                    }
                }
            }

            // Test 3: Verify row can be pinned by clicking input token
            console.log('  Testing row pinning...');
            if (inputCount > 1) {
                // Click a non-last token to pin that row
                const secondToken = inputTokens.nth(1);
                await secondToken.click();
                await frame.waitForTimeout(300);

                // Check if pinned rows increased
                const newPinnedCount = await frame.locator('.pinned-row').count();
                console.log(`  Pinned cells after click: ${newPinnedCount}`);
                widgetData.rowPinningWorks = newPinnedCount >= pinnedCount;
            }

            // Test 4: Check color mode button exists and is clickable
            const colorBtn = frame.locator('.color-btn, [class*="color"]').first();
            if (await colorBtn.count() > 0) {
                console.log('  Color mode button found');
                widgetData.hasColorButton = true;
            }

            allWidgetData.push(widgetData);
        }

        // Final summary
        console.log('\n--- All Widgets Summary ---');
        for (let i = 0; i < allWidgetData.length; i++) {
            console.log(`Widget ${i + 1}: ${JSON.stringify(allWidgetData[i], null, 2)}`);
        }

        // Verify all widgets are properly populated
        for (let i = 0; i < allWidgetData.length; i++) {
            expect(allWidgetData[i].inputTokens).toBeGreaterThan(0);
            expect(allWidgetData[i].predCells).toBeGreaterThan(0);
            expect(allWidgetData[i].layers).toBeGreaterThan(0);
        }

        console.log(`\n✓ All ${widgetFrames.length} widgets verified with data and interactivity`);
    });

    test('tutorial notebook executes all widgets successfully', async ({ page }) => {
        // Tutorial has more cells and takes longer - 15 minutes for full execution
        test.setTimeout(900000);

        const notebookUrl = 'https://colab.research.google.com/github/davidbau/logitlenskit/blob/main/notebooks/tutorial.ipynb';

        // Check NDIF status before running
        // Tutorial requires: meta-llama/Llama-3.1-8B
        const REQUIRED_MODEL = 'meta-llama/Llama-3.1-8B';
        console.log(`Checking NDIF status for required model: ${REQUIRED_MODEL}...`);
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
                        const state = deployment.application_state || deployment.deployment_level;
                        const level = deployment.deployment_level;

                        if (state === 'RUNNING' && level === 'HOT') {
                            console.log(`✓ Model ${REQUIRED_MODEL} is RUNNING (HOT) - ready for use`);
                        } else if (state === 'RUNNING') {
                            console.log(`✓ Model ${REQUIRED_MODEL} is RUNNING (${level})`);
                        } else if (level === 'COLD') {
                            console.log(`⚠ Model ${REQUIRED_MODEL} is COLD - may need to warm up`);
                        } else {
                            console.log(`⚠ Model ${REQUIRED_MODEL} state: ${state}, level: ${level}`);
                        }
                    } else {
                        console.log(`⚠ Model ${REQUIRED_MODEL} not found in NDIF deployments`);
                    }
                }
            } else {
                console.log(`⚠ NDIF status check returned ${statusResponse.status()}`);
                if (statusResponse.status() >= 500) {
                    console.log('⚠ NDIF service may be experiencing issues - tutorial may fail');
                }
            }
        } catch (e) {
            console.log(`⚠ NDIF status check failed: ${e.message}`);
            console.log('⚠ NDIF service may be unavailable - tutorial may fail');
        }

        console.log('Opening tutorial notebook...');
        await page.goto(notebookUrl);

        await page.waitForSelector('.notebook-cell, .cell', { timeout: 30000 });
        console.log('Tutorial loaded');

        // Check if sign-in is required (auth may have expired)
        await checkForSignIn(page);

        // Verify structure - tutorial has 20 cells
        const cells = page.locator('.cell, .notebook-cell');
        const cellCount = await cells.count();
        console.log(`Tutorial has ${cellCount} cells`);
        expect(cellCount).toBeGreaterThan(15);

        // Run all cells
        console.log('Running all cells (uses Colab secrets for NDIF_API)...');
        const runtimeMenu = page.locator('div[role="menubar"] >> text=Runtime');
        await runtimeMenu.click();
        await page.waitForTimeout(500);

        const runAll = page.getByRole('menuitem', { name: /^Run all/ });
        await runAll.first().click();

        // Handle "This notebook was not authored by Google" warning dialog
        console.log('Checking for security warning dialog...');
        await page.waitForTimeout(1000);
        const runAnywayBtn = page.getByRole('button', { name: 'Run anyway' });
        if (await runAnywayBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            console.log('Security dialog detected - clicking "Run anyway"...');
            await runAnywayBtn.click();
            await page.waitForTimeout(500);
        }

        // Handle "Grant access?" dialog for Colab secrets
        const handleGrantAccessDialog = async () => {
            const grantBtn = page.getByRole('button', { name: 'Grant access' });
            if (await grantBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                console.log('Grant access dialog detected - clicking "Grant access"...');
                await grantBtn.click();
                await page.waitForTimeout(500);
                return true;
            }
            return false;
        };

        // Check for grant access dialog multiple times during execution
        for (let i = 0; i < 5; i++) {
            await handleGrantAccessDialog();
            await page.waitForTimeout(2000);
        }

        // Wait for tutorial execution with progress monitoring
        // Tutorial has ~6 widgets across cells 5, 13, 16, and 18 (3 in loop)
        console.log('Waiting for tutorial execution (this takes several minutes)...');
        console.log('Monitoring cell outputs for progress...');

        // Progress markers to watch for
        const progressMarkers = [
            'Installing build',
            'NDIF API key configured',
            'Loaded',  // Model loading
            'layers',  // Model info
            'capital of France',  // First widget prompt
            'Eiffel Tower',  // Second widget prompt
            '1 + 1',  // Third widget prompt
            'quick brown fox',  // Fourth widget (from loop)
        ];

        let widgetCount = 0;
        let lastProgress = '';

        for (let attempt = 0; attempt < 90; attempt++) {  // Up to 15 minutes
            // Check for auth expiration early - fail fast instead of timing out
            await checkForSignIn(page);

            // Handle grant access dialog during polling
            await handleGrantAccessDialog();

            // Check for NDIF errors
            const ndifError = await checkForNDIFErrors(page);
            if (ndifError) {
                console.log(`\n❌ NDIF ERROR DETECTED: ${ndifError}`);
                console.log('The NDIF model deployment may be unavailable.');
                console.log('Check https://api.ndif.us/status for service status.');
                await page.screenshot({ path: 'colab-tutorial-ndif-error.png', fullPage: true });
                throw new Error(`NDIF service error: ${ndifError}. Check api.ndif.us/status`);
            }

            // Check page content for progress
            try {
                const pageText = await page.locator('body').textContent();

                // Report progress markers as they appear
                for (const marker of progressMarkers) {
                    if (pageText.includes(marker) && !lastProgress.includes(marker)) {
                        console.log(`  Progress: "${marker}" detected`);
                        lastProgress = pageText;
                    }
                }
            } catch (e) {
                // Ignore
            }

            // Count widget frames by checking for actual rendered elements
            const frames = page.frames();
            let newWidgetCount = 0;
            for (const frame of frames) {
                try {
                    const inputTokens = frame.locator('.input-token');
                    const count = await inputTokens.count();
                    if (count > 0) newWidgetCount++;
                } catch (e) {
                    // Frame not accessible
                }
            }

            // Also check main page
            const mainCount = await page.locator('.input-token').count();
            if (mainCount > 0) newWidgetCount++;

            if (newWidgetCount > widgetCount) {
                widgetCount = newWidgetCount;
                console.log(`  Widgets found: ${widgetCount}`);
            }

            // Tutorial should have at least 4 widgets, ideally 6
            if (widgetCount >= 4) {
                console.log('  Sufficient widgets detected! Waiting 30s for remaining widgets...');
                await page.waitForTimeout(30000);
                // Check again for any additional widgets
                for (const frame of page.frames()) {
                    try {
                        const count = await frame.locator('.input-token').count();
                        if (count > 0) widgetCount++;
                    } catch (e) {}
                }
                break;
            }

            if (attempt % 6 === 0) {
                console.log(`  Waiting... ${(attempt + 1) * 10}s elapsed, widgets: ${widgetCount}`);
            }
            await page.waitForTimeout(10000);  // Check every 10 seconds
        }

        // Take screenshot of results
        await page.screenshot({ path: 'colab-tutorial-result.png', fullPage: true });

        // ============================================================
        // VERIFY ALL TUTORIAL WIDGETS
        // ============================================================

        console.log('\n--- Inspecting ALL Tutorial Widgets ---');

        const allFrames = page.frames();
        console.log(`Total frames: ${allFrames.length}`);

        const widgetFrames = [];

        // Find all widget frames by checking for actual widget elements
        for (let i = 0; i < allFrames.length; i++) {
            const frame = allFrames[i];
            try {
                const inputTokens = frame.locator('.input-token');
                const inputCount = await inputTokens.count();
                if (inputCount > 0) {
                    console.log(`  Frame ${i}: Found ${inputCount} input tokens - widget frame!`);
                    widgetFrames.push({ index: i, frame });
                }
            } catch (e) {
                // Frame not accessible
            }
        }

        // Also check main page for widgets
        const mainInputTokens = page.locator('.input-token');
        const mainInputCount = await mainInputTokens.count();
        if (mainInputCount > 0) {
            console.log(`Main page: Found ${mainInputCount} input tokens - adding as widget source`);
            widgetFrames.push({ index: -1, frame: page });
        }

        console.log(`Found ${widgetFrames.length} widget frames (including main page if applicable)`);
        // Tutorial should have at least 4 widgets (cells 5, 13, 16, and some from cell 18)
        expect(widgetFrames.length).toBeGreaterThanOrEqual(4);

        // Verify each widget is populated
        const tutorialWidgetData = [];
        for (let w = 0; w < widgetFrames.length; w++) {
            const { index, frame } = widgetFrames[w];
            console.log(`\n=== Tutorial Widget ${w + 1} (frame ${index}) ===`);

            const widgetData = {};

            // Count input tokens
            const inputTokens = frame.locator('.input-token');
            const inputCount = await inputTokens.count();
            console.log(`  Input tokens: ${inputCount}`);
            widgetData.inputTokens = inputCount;
            expect(inputCount).toBeGreaterThan(0);

            // Get first token to show the prompt
            if (inputCount > 0) {
                const firstToken = await inputTokens.first().textContent();
                widgetData.firstToken = firstToken;
                console.log(`  First token: "${firstToken}"`);
            }

            // Count prediction cells
            const predCells = frame.locator('.pred-cell');
            const predCount = await predCells.count();
            console.log(`  Prediction cells: ${predCount}`);
            widgetData.predCells = predCount;
            expect(predCount).toBeGreaterThan(0);

            // Count layer headers
            const layerHeaders = frame.locator('.layer-hdr');
            const layerCount = await layerHeaders.count();
            console.log(`  Layer headers: ${layerCount}`);
            widgetData.layers = layerCount;
            expect(layerCount).toBeGreaterThan(0);

            // Check titles (may be multiple widgets in same frame)
            const titles = frame.locator('.ll-title');
            const titleCount = await titles.count();
            if (titleCount > 0) {
                // Get all titles for logging
                const allTitles = [];
                for (let t = 0; t < Math.min(titleCount, 5); t++) {
                    const titleText = await titles.nth(t).textContent();
                    allTitles.push(titleText);
                }
                console.log(`  Widget titles (${titleCount}): ${allTitles.map(t => `"${t.substring(0, 40)}..."`).join(', ')}`);
                widgetData.title = allTitles[0];
                widgetData.titleCount = titleCount;
            }

            // Test interactivity: click a prediction cell
            if (predCount > 0) {
                console.log('  Testing popup interaction...');
                await predCells.first().click();
                await frame.waitForTimeout(300);

                const popup = frame.locator('.popup').first();
                const popupVisible = await popup.evaluate(el => el.classList.contains('visible')).catch(() => false);
                widgetData.popupWorks = popupVisible;
                console.log(`  Popup opened: ${popupVisible}`);

                // Close popup
                if (popupVisible) {
                    const closeBtn = frame.locator('.popup-close').first();
                    if (await closeBtn.isVisible().catch(() => false)) {
                        await closeBtn.click();
                    }
                }
            }

            tutorialWidgetData.push(widgetData);
        }

        // Final summary
        console.log('\n--- Tutorial Widgets Summary ---');
        console.log(`Total widgets found: ${tutorialWidgetData.length}`);
        for (let i = 0; i < tutorialWidgetData.length; i++) {
            const w = tutorialWidgetData[i];
            console.log(`  Widget ${i + 1}: ${w.title || 'No title'} - ${w.inputTokens} tokens, ${w.layers} layers`);
        }

        // All widgets should have data
        for (const w of tutorialWidgetData) {
            expect(w.inputTokens).toBeGreaterThan(0);
            expect(w.predCells).toBeGreaterThan(0);
            expect(w.layers).toBeGreaterThan(0);
        }

        console.log(`\n✓ All ${tutorialWidgetData.length} tutorial widgets verified!`);
    });
});

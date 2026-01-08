/**
 * Google Colab Authentication Setup
 *
 * Run this script once to log in to Google and save the auth state.
 * The saved state can then be used for automated Colab tests.
 *
 * This uses real Chrome (not Chromium) with a persistent profile to avoid
 * Google's "This browser may not be secure" error.
 *
 * Usage:
 *   npm run test:colab:setup
 *   # Or: npx playwright test tests/browser/colab-auth-setup.spec.js --headed
 *
 * After running:
 *   - A Chrome window will open
 *   - Log in to your Google account
 *   - The script will save the auth state to .auth/google-state.json
 *   - This file should NOT be committed to git (it contains session cookies)
 */

const { test, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const AUTH_FILE = path.join(__dirname, '../../.auth/google-state.json');
const USER_DATA_DIR = path.join(__dirname, '../../.auth/chrome-profile');

// Give user 5 minutes to sign in
test.setTimeout(300000);

test('setup Google authentication for Colab tests', async () => {
    // Create auth directory if it doesn't exist
    const authDir = path.dirname(AUTH_FILE);
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  GOOGLE COLAB AUTHENTICATION SETUP');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('  A Chrome window will open.');
    console.log('  Please sign in to your Google account.');
    console.log('  You have 5 minutes to complete sign-in.');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    // Use real Chrome with a persistent profile to avoid "browser not secure" error
    // Google blocks automated Chromium but typically allows real Chrome
    let context;
    try {
        context = await chromium.launchPersistentContext(USER_DATA_DIR, {
            headless: false,
            channel: 'chrome',  // Use installed Chrome, not Chromium
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-first-run',
                '--no-default-browser-check',
            ],
        });
    } catch (e) {
        console.log('');
        console.log('ERROR: Could not launch Chrome.');
        console.log('Make sure Google Chrome is installed on your system.');
        console.log('');
        console.log('On macOS: brew install --cask google-chrome');
        console.log('On Ubuntu: sudo apt install google-chrome-stable');
        console.log('');
        throw e;
    }

    const page = await context.newPage();

    // Go to Colab - it will redirect to Google sign-in
    await page.goto('https://colab.research.google.com/');

    console.log('Waiting for sign-in to complete...');
    console.log('');

    // Wait for the main Colab interface to appear (indicates successful login)
    // Look for various indicators that we're logged in
    try {
        await page.waitForSelector(
            '[aria-label="New notebook"], button:has-text("New notebook"), .new-notebook-button, [data-tooltip="New notebook"]',
            { timeout: 300000 }
        );
    } catch (e) {
        // If we can't find new notebook button, check if we're on colab main page
        const url = page.url();
        if (url.includes('colab.research.google.com') && !url.includes('accounts.google.com')) {
            console.log('Detected Colab page (may be logged in)');
        } else {
            throw e;
        }
    }

    console.log('');
    console.log('✓ Sign-in detected!');
    console.log('');
    console.log('Saving authentication state...');

    // Save the storage state (cookies, localStorage, sessionStorage)
    await context.storageState({ path: AUTH_FILE });

    await context.close();

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  SUCCESS!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log(`  Auth state saved to: ${AUTH_FILE}`);
    console.log('');
    console.log('  Next step: Add secrets to Colab:');
    console.log('    1. Go to https://colab.research.google.com');
    console.log('    2. Click the key icon 🔑 in the left sidebar');
    console.log('    3. Add these secrets (enable "Notebook access" for each):');
    console.log('');
    console.log('       NDIF_API  - Your key from https://nnsight.net');
    console.log('       HF_TOKEN  - Your token from https://huggingface.co/settings/tokens');
    console.log('                   (Required for gated models like Llama)');
    console.log('');
    console.log('  Then run: npm run test:colab');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
});

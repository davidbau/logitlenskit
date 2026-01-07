/**
 * Google Colab Authentication Setup
 *
 * Run this script once to log in to Google and save the auth state.
 * The saved state can then be used for automated Colab tests.
 *
 * Usage:
 *   npx playwright test colab-auth-setup.js --headed
 *
 * After running:
 *   - A browser window will open
 *   - Log in to your Google account
 *   - The script will save the auth state to .auth/google-state.json
 *   - This file should NOT be committed to git (it contains session cookies)
 */

const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const AUTH_FILE = path.join(__dirname, '../../.auth/google-state.json');

test('setup Google authentication for Colab tests', async ({ page, context }) => {
    // Create auth directory if it doesn't exist
    const authDir = path.dirname(AUTH_FILE);
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }

    console.log('Opening Google Colab...');
    console.log('Please sign in to your Google account when prompted.');
    console.log('');

    // Go to Colab - it will redirect to Google sign-in
    await page.goto('https://colab.research.google.com/');

    // Wait for user to sign in (look for the Colab interface elements)
    console.log('Waiting for you to complete sign-in...');
    console.log('(You have 5 minutes to complete the sign-in process)');

    // Wait for the main Colab interface to appear (indicates successful login)
    // Or wait for the "Create new notebook" or similar UI elements
    await page.waitForSelector('[aria-label="New notebook"], .new-notebook, button:has-text("New notebook")', {
        timeout: 300000  // 5 minutes
    });

    console.log('Sign-in detected! Saving authentication state...');

    // Save the storage state (cookies, localStorage, sessionStorage)
    await context.storageState({ path: AUTH_FILE });

    console.log(`Authentication state saved to: ${AUTH_FILE}`);
    console.log('');
    console.log('You can now run authenticated Colab tests with:');
    console.log('  npx playwright test colab-authenticated.spec.js');
});

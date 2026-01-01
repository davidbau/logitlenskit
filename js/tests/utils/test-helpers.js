/**
 * Test utilities for LogitLensWidget tests.
 */

const fs = require('fs');
const path = require('path');

/**
 * Load sample data from fixtures.
 */
function loadSampleData(filename = 'sample-data-small.json') {
    const fixturePath = path.join(__dirname, '..', 'fixtures', filename);
    return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
}

/**
 * Create a mock container element.
 */
function createMockContainer(id = 'test-container') {
    const container = document.createElement('div');
    container.id = id;
    document.body.appendChild(container);
    return container;
}

/**
 * Clean up mock container.
 */
function cleanupContainer(container) {
    if (container && container.parentNode) {
        container.parentNode.removeChild(container);
    }
}

/**
 * Wait for DOM updates.
 */
function waitForDom() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

module.exports = {
    loadSampleData,
    createMockContainer,
    cleanupContainer,
    waitForDom,
};

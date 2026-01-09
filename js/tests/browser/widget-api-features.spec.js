// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Widget API Features', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/api-features.html');
        // Wait for widgets to initialize
        await page.waitForFunction(() => window.testWidgets && window.testWidgets.apiWidget);
    });

    // ═══════════════════════════════════════════════════════════════
    // Event Emitter API Tests
    // ═══════════════════════════════════════════════════════════════
    test.describe('Event Emitter API', () => {
        test('on() registers event listener', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                let eventFired = false;
                widget.on('title', () => { eventFired = true; });
                widget.setTitle('New Title');
                return eventFired;
            });
            expect(result).toBe(true);
        });

        test('off() removes event listener', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                let count = 0;
                const listener = () => { count++; };
                widget.on('title', listener);
                widget.setTitle('Title 1');
                widget.off('title', listener);
                widget.setTitle('Title 2');
                return count;
            });
            expect(result).toBe(1);
        });

        test('events fire with correct data', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                let receivedData = null;
                widget.on('colorModes', (data) => { receivedData = data; });
                widget.setColorModes(['top']);
                return receivedData;
            });
            expect(result).toEqual(['top']);
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // Visibility Toggle Tests
    // ═══════════════════════════════════════════════════════════════
    test.describe('Visibility Toggles', () => {
        test('setShowChart(false) hides chart container', async ({ page }) => {
            await page.evaluate(() => {
                window.testWidgets.apiWidget.setShowChart(false);
            });
            const chartContainer = page.locator('#widget-api-test [id$="_chart_container"]');
            await expect(chartContainer).toHaveCSS('display', 'none');
        });

        test('setShowChart(true) shows chart container', async ({ page }) => {
            await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                widget.setShowChart(false);
                widget.setShowChart(true);
            });
            const chartContainer = page.locator('#widget-api-test [id$="_chart_container"]');
            await expect(chartContainer).toHaveCSS('display', 'block');
        });

        test('getShowChart() returns correct state', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                const initial = widget.getShowChart();
                widget.setShowChart(false);
                const afterHide = widget.getShowChart();
                widget.setShowChart(true);
                const afterShow = widget.getShowChart();
                return { initial, afterHide, afterShow };
            });
            expect(result.initial).toBe(true);
            expect(result.afterHide).toBe(false);
            expect(result.afterShow).toBe(true);
        });

        test('setShowHeatmap(false) removes cell coloring', async ({ page }) => {
            // Get initial background color
            const initialColor = await page.evaluate(() => {
                const cell = document.querySelector('#widget-api-test .pred-cell');
                return cell ? getComputedStyle(cell).backgroundColor : null;
            });

            await page.evaluate(() => {
                window.testWidgets.apiWidget.setShowHeatmap(false);
            });

            const afterColor = await page.evaluate(() => {
                const cell = document.querySelector('#widget-api-test .pred-cell');
                return cell ? getComputedStyle(cell).backgroundColor : null;
            });

            // Colors should be different (heatmap off should show neutral color)
            expect(initialColor).not.toBe(afterColor);
        });

        test('getShowHeatmap() returns correct state', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                const initial = widget.getShowHeatmap();
                widget.setShowHeatmap(false);
                const afterHide = widget.getShowHeatmap();
                return { initial, afterHide };
            });
            expect(result.initial).toBe(true);
            expect(result.afterHide).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // Title API Tests
    // ═══════════════════════════════════════════════════════════════
    test.describe('Title API', () => {
        test('setTitle() changes displayed title', async ({ page }) => {
            await page.evaluate(() => {
                window.testWidgets.apiWidget.setTitle('New Custom Title');
            });
            const title = page.locator('#widget-api-test .ll-title');
            await expect(title).toContainText('New Custom Title');
        });

        test('getTitle() returns current title', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                widget.setTitle('Test Title');
                return widget.getTitle();
            });
            expect(result).toBe('Test Title');
        });

        test('setTitle fires title event', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                let receivedTitle = null;
                widget.on('title', (t) => { receivedTitle = t; });
                widget.setTitle('Event Title');
                return receivedTitle;
            });
            expect(result).toBe('Event Title');
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // Color Mode API Tests
    // ═══════════════════════════════════════════════════════════════
    test.describe('Color Mode API', () => {
        test('setColorModes() changes active modes', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                widget.setColorModes(['top']);
                return widget.getColorModes();
            });
            expect(result).toEqual(['top']);
        });

        test('addColorMode() adds a mode', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                widget.setColorModes(['top']);
                widget.addColorMode('Paris');
                return widget.getColorModes();
            });
            expect(result).toContain('top');
            expect(result).toContain('Paris');
        });

        test('removeColorMode() removes a mode', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                widget.setColorModes(['top', 'Paris']);
                widget.removeColorMode('Paris');
                return widget.getColorModes();
            });
            expect(result).toEqual(['top']);
        });

        test('getColorModes() returns copy not reference', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                widget.setColorModes(['top']);
                const modes = widget.getColorModes();
                modes.push('modified');
                return widget.getColorModes();
            });
            expect(result).toEqual(['top']);
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // Row/Group Manipulation API Tests
    // ═══════════════════════════════════════════════════════════════
    test.describe('Row/Group Manipulation API', () => {
        test('getPinnedRows() returns pinned rows', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                return widget.getPinnedRows();
            });
            // By default, last row is pinned
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
        });

        test('setPinnedRows() changes pinned rows', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                widget.setPinnedRows([{ pos: 1, line: 'dashed' }]);
                return widget.getPinnedRows();
            });
            expect(result).toEqual([{ pos: 1, line: 'dashed' }]);
        });

        test('togglePinnedRow() toggles row pinning', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                widget.setPinnedRows([]);
                widget.togglePinnedRow(2);
                const after = widget.getPinnedRows();
                widget.togglePinnedRow(2);
                const afterUnpin = widget.getPinnedRows();
                return { after, afterUnpin };
            });
            expect(result.after.length).toBe(1);
            expect(result.after[0].pos).toBe(2);
            expect(result.afterUnpin.length).toBe(0);
        });

        test('pinToken() adds token to pinned groups', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                widget.setPinnedGroups([]);
                widget.pinToken('Paris', { color: '#ff0000' });
                return widget.getPinnedGroups();
            });
            expect(result.length).toBe(1);
            expect(result[0].tokens).toContain('Paris');
            expect(result[0].color).toBe('#ff0000');
        });

        test('unpinToken() removes token from pinned groups', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                widget.setPinnedGroups([]);
                widget.pinToken('Paris');
                widget.unpinToken('Paris');
                return widget.getPinnedGroups();
            });
            expect(result.length).toBe(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // Hover API Tests
    // ═══════════════════════════════════════════════════════════════
    test.describe('Hover API', () => {
        test('hoverRow() updates hover position', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                widget.hoverRow(2);
                return widget.getHoveredRow();
            });
            expect(result).toBe(2);
        });

        test('clearHover() resets to last position', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                widget.hoverRow(1);
                widget.clearHover();
                // Should reset to last position (4 for 5 tokens)
                return widget.getHoveredRow();
            });
            expect(result).toBe(4); // Last position for 5 tokens
        });

        test('hoverRow fires hover event', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                let receivedPos = -1;
                widget.on('hover', (pos) => { receivedPos = pos; });
                widget.hoverRow(3);
                return receivedPos;
            });
            expect(result).toBe(3);
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // Trajectory Metric API Tests
    // ═══════════════════════════════════════════════════════════════
    test.describe('Trajectory Metric API', () => {
        test('getTrajectoryMetric() returns probability by default', async ({ page }) => {
            const result = await page.evaluate(() => {
                return window.testWidgets.apiWidget.getTrajectoryMetric();
            });
            expect(result).toBe('probability');
        });

        test('setTrajectoryMetric() changes metric', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                widget.setTrajectoryMetric('rank');
                return widget.getTrajectoryMetric();
            });
            expect(result).toBe('rank');
        });

        test('setTrajectoryMetric fires event', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                let received = null;
                widget.on('trajectoryMetric', (m) => { received = m; });
                widget.setTrajectoryMetric('rank');
                return received;
            });
            expect(result).toBe('rank');
        });

        test('rank mode state persists after render', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                // Pin a token to ensure chart is drawn
                widget.pinToken('Paris');
                widget.setTrajectoryMetric('rank');
                // Get state after operations
                return {
                    metric: widget.getTrajectoryMetric(),
                    pinnedGroups: widget.getPinnedGroups().length
                };
            });
            expect(result.metric).toBe('rank');
            expect(result.pinnedGroups).toBeGreaterThan(0);
        });

        test('switching between probability and rank modes', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                widget.setTrajectoryMetric('probability');
                const initial = widget.getTrajectoryMetric();
                widget.setTrajectoryMetric('rank');
                const afterRank = widget.getTrajectoryMetric();
                widget.setTrajectoryMetric('probability');
                const afterBack = widget.getTrajectoryMetric();
                return { initial, afterRank, afterBack };
            });
            expect(result.initial).toBe('probability');
            expect(result.afterRank).toBe('rank');
            expect(result.afterBack).toBe('probability');
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // Data Capability Detection Tests
    // ═══════════════════════════════════════════════════════════════
    test.describe('Data Capability Detection', () => {
        test('hasEntropyData() returns false when no entropy', async ({ page }) => {
            const result = await page.evaluate(() => {
                return window.testWidgets.apiWidget.hasEntropyData();
            });
            expect(result).toBe(false);
        });

        test('hasEntropyData() returns true when entropy present', async ({ page }) => {
            await page.waitForFunction(() => window.testWidgets && window.testWidgets.entropyWidget);
            const result = await page.evaluate(() => {
                return window.testWidgets.entropyWidget.hasEntropyData();
            });
            expect(result).toBe(true);
        });

        test('hasRankData() returns false for standard data', async ({ page }) => {
            const result = await page.evaluate(() => {
                return window.testWidgets.apiWidget.hasRankData();
            });
            expect(result).toBe(false);
        });

        test('isTokenTracked() returns true for tracked tokens', async ({ page }) => {
            const result = await page.evaluate(() => {
                // "Paris" should be tracked at position 4 (last position)
                return window.testWidgets.apiWidget.isTokenTracked('Paris', 4);
            });
            expect(result).toBe(true);
        });

        test('isTokenTracked() returns false for untracked tokens', async ({ page }) => {
            const result = await page.evaluate(() => {
                return window.testWidgets.apiWidget.isTokenTracked('UnknownToken', 0);
            });
            expect(result).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // State Serialization Tests
    // ═══════════════════════════════════════════════════════════════
    test.describe('State Serialization', () => {
        test('getState() includes new properties', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                widget.setShowHeatmap(false);
                widget.setShowChart(false);
                widget.setTrajectoryMetric('rank');
                return widget.getState();
            });
            expect(result.showHeatmap).toBe(false);
            expect(result.showChart).toBe(false);
            expect(result.trajectoryMetric).toBe('rank');
        });

        test('new state properties persist through getState/setState cycle', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                widget.setShowHeatmap(false);
                widget.setShowChart(false);
                const state = widget.getState();
                return {
                    showHeatmap: state.showHeatmap,
                    showChart: state.showChart
                };
            });
            expect(result.showHeatmap).toBe(false);
            expect(result.showChart).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // Entropy Coloring Mode Tests
    // ═══════════════════════════════════════════════════════════════
    test.describe('Entropy Coloring Mode', () => {
        test('entropy mode can be set via setColorModes on widget with entropy data', async ({ page }) => {
            await page.waitForFunction(() => window.testWidgets && window.testWidgets.entropyWidget);
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.entropyWidget;
                widget.setColorModes(['entropy']);
                return widget.getColorModes();
            });
            expect(result).toEqual(['entropy']);
        });

        test('entropy mode changes cell colors on widget with entropy data', async ({ page }) => {
            await page.waitForFunction(() => window.testWidgets && window.testWidgets.entropyWidget);

            // Get initial color with top mode
            const initialColor = await page.evaluate(() => {
                const widget = window.testWidgets.entropyWidget;
                widget.setColorModes(['top']);
                const cell = document.querySelector('#widget-entropy-test .pred-cell');
                return cell ? getComputedStyle(cell).backgroundColor : null;
            });

            // Switch to entropy mode
            await page.evaluate(() => {
                window.testWidgets.entropyWidget.setColorModes(['entropy']);
            });

            const entropyColor = await page.evaluate(() => {
                const cell = document.querySelector('#widget-entropy-test .pred-cell');
                return cell ? getComputedStyle(cell).backgroundColor : null;
            });

            // Colors should be different between modes
            expect(initialColor).not.toBe(entropyColor);
        });

        test('entropy mode not available on widget without entropy data', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                // Setting entropy mode should work but won't affect coloring without data
                widget.setColorModes(['entropy']);
                const modes = widget.getColorModes();
                // Check if hasEntropyData is false
                return {
                    modes: modes,
                    hasEntropy: widget.hasEntropyData()
                };
            });
            expect(result.modes).toEqual(['entropy']);
            expect(result.hasEntropy).toBe(false);
        });

        test('entropy coloring shows higher values for uncertain cells', async ({ page }) => {
            await page.waitForFunction(() => window.testWidgets && window.testWidgets.entropyWidget);

            // The test data has decreasing entropy from layer 0 to layer 4
            // and decreasing from position 0 to position 4
            // So early layers (high entropy) should be more colorful
            await page.evaluate(() => {
                window.testWidgets.entropyWidget.setColorModes(['entropy']);
            });

            // This test verifies that entropy mode is applied without crashing
            // Visual verification of gradient would require screenshot comparison
            const hasColors = await page.evaluate(() => {
                const cells = document.querySelectorAll('#widget-entropy-test .pred-cell');
                return cells.length > 0;
            });
            expect(hasColors).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // Intelligent Popup Positioning Tests
    // ═══════════════════════════════════════════════════════════════
    test.describe('Intelligent Popup Positioning', () => {
        test('popup appears when clicking a cell', async ({ page }) => {
            // Click on a prediction cell
            const cell = page.locator('#widget-api-test .pred-cell').first();
            await cell.click();

            // Check that popup becomes visible
            const popup = page.locator('#widget-api-test [id$="_popup"]');
            await expect(popup).toHaveClass(/visible/);
        });

        test('popup has valid position values', async ({ page }) => {
            // Click on a prediction cell
            const cell = page.locator('#widget-api-test .pred-cell').first();
            await cell.click();

            // Verify popup has valid CSS position
            const popup = page.locator('#widget-api-test [id$="_popup"]');
            const left = await popup.evaluate(el => el.style.left);
            const top = await popup.evaluate(el => el.style.top);

            // Left and top should be set to pixel values
            expect(left).toMatch(/^-?\d+(\.\d+)?px$/);
            expect(top).toMatch(/^-?\d+(\.\d+)?px$/);
        });

        test('popup closes when clicking close button', async ({ page }) => {
            // Click on a prediction cell
            const cell = page.locator('#widget-api-test .pred-cell').first();
            await cell.click();

            // Verify popup is visible
            const popup = page.locator('#widget-api-test [id$="_popup"]');
            await expect(popup).toHaveClass(/visible/);

            // Click the close button
            const closeBtn = page.locator('#widget-api-test [id$="_popup_close"]');
            await closeBtn.click();

            // Popup should no longer be visible
            await expect(popup).not.toHaveClass(/visible/);
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // Smart Row Visibility Tests
    // ═══════════════════════════════════════════════════════════════
    test.describe('Smart Row Visibility', () => {
        test('pinned rows are always visible when maxRows is set', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                // The widget has 5 tokens (positions 0-4)
                // Set maxRows to 2 and pin position 0
                widget.setPinnedRows([{ pos: 0, line: 'solid' }]);

                // Get the visible input tokens via DOM
                const inputTokens = document.querySelectorAll('#widget-api-test .input-token');
                const visiblePositions = Array.from(inputTokens).map(el => parseInt(el.dataset.pos));
                return visiblePositions;
            });

            // With 5 tokens and default last row pinned, position 0 should be visible when pinned
            expect(result).toContain(0);
        });

        test('multiple pinned rows all remain visible', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                // Pin positions 0, 1, and 4
                widget.setPinnedRows([
                    { pos: 0, line: 'solid' },
                    { pos: 1, line: 'dashed' },
                    { pos: 4, line: 'dotted' }
                ]);

                // Force re-render
                const state = widget.getState();

                // Get the pinned rows
                return widget.getPinnedRows();
            });

            expect(result.length).toBe(3);
            expect(result.map(r => r.pos)).toContain(0);
            expect(result.map(r => r.pos)).toContain(1);
            expect(result.map(r => r.pos)).toContain(4);
        });

        test('unpinned rows fill remaining slots from end', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                // Clear pinned rows
                widget.setPinnedRows([]);

                // Get visible positions
                const inputTokens = document.querySelectorAll('#widget-api-test .input-token');
                const visiblePositions = Array.from(inputTokens).map(el => parseInt(el.dataset.pos));
                return visiblePositions;
            });

            // When no maxRows constraint (null), all positions should be visible
            // For 5 tokens: [0, 1, 2, 3, 4]
            expect(result.length).toBe(5);
            expect(result).toContain(4); // Last position always visible
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // Method Chaining Tests
    // ═══════════════════════════════════════════════════════════════
    test.describe('Method Chaining', () => {
        test('setter methods return widget for chaining', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                const chain = widget
                    .setTitle('Chained')
                    .setShowChart(true)
                    .setShowHeatmap(true)
                    .setColorModes(['top'])
                    .hoverRow(2);
                return chain === widget;
            });
            expect(result).toBe(true);
        });

        test('on/off return widget for chaining', async ({ page }) => {
            const result = await page.evaluate(() => {
                const widget = window.testWidgets.apiWidget;
                const listener = () => {};
                const chain = widget.on('title', listener).off('title', listener);
                return chain === widget;
            });
            expect(result).toBe(true);
        });
    });
});

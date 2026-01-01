var LogitLensWidget = (function() {
    var instanceCount = 0;

    return function(containerArg, widgetData, uiState) {
        var uid = "ll_interact_" + instanceCount++;
        var container;
        if (typeof containerArg === 'string') {
            container = document.querySelector(containerArg);
        } else if (containerArg instanceof Element) {
            container = containerArg;
        }
        if (!container) {
            console.error("Container not found:", containerArg);
            return;
        }

        // Inject scoped CSS
        var style = document.createElement("style");
        style.textContent = `
            #${uid} {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                margin: 20px 0;
                padding: 0;
                position: relative;
                -webkit-user-select: none;
                user-select: none;
            }
            #${uid} .ll-title { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
            #${uid} .color-mode-btn {
                display: inline-block; padding: 0; background: white;
                border-radius: 4px; font-size: 16px; cursor: pointer; color: #333;
                border: none;
            }
            #${uid} .color-mode-btn:hover { background: #f5f5f5; }
            #${uid} .ll-table { border-collapse: collapse; font-size: 10px; table-layout: fixed; }
            #${uid} .ll-table td, #${uid} .ll-table th { border: 1px solid #ddd; box-sizing: border-box; }
            #${uid} .pred-cell {
                height: 22px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                padding: 2px 4px; font-family: monospace; font-size: 9px; cursor: pointer; position: relative;
            }
            #${uid} .pred-cell:hover { outline: 2px solid #e91e63; outline-offset: -1px; }
            #${uid} .pred-cell.selected { background: #fff59d !important; color: #333 !important; }
            #${uid} .input-token {
                padding: 2px 8px; text-align: right; font-weight: 500; color: #333;
                background: #f5f5f5; white-space: nowrap; overflow: hidden;
                text-overflow: ellipsis; font-family: monospace; font-size: 10px; cursor: pointer;
                position: relative;
            }
            #${uid} .input-token:hover { background: #e8e8e8; }
            #${uid} tr:has(.input-token:hover) { outline: 2px solid rgba(255, 193, 7, 0.8); outline-offset: -1px; }
            #${uid} tr:has(.input-token:hover) .input-token { background: #fff59d !important; }
            #${uid} .layer-hdr {
                padding: 4px 2px; text-align: center; font-weight: 500; color: #666;
                background: #f5f5f5; font-size: 9px; position: relative;
            }
            #${uid} .corner-hdr { padding: 4px 8px; text-align: right; font-weight: 500; color: #666; background: white; position: relative; }
            #${uid} .chart-container { margin-top: 8px; background: #fafafa; border-radius: 4px; padding: 8px 0; }
            #${uid} .chart-container svg { display: block; margin: 0; padding: 0; }
            #${uid} .popup {
                display: none; position: absolute; background: white; border: 1px solid #ddd;
                border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); padding: 12px;
                z-index: 100; min-width: 180px; max-width: 280px;
            }
            #${uid} .popup.visible { display: block; }
            #${uid} .popup-header { font-weight: 600; font-size: 13px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #eee; }
            #${uid} .popup-header code { font-weight: 400; font-size: 12px; background: #f5f5f5; padding: 2px 6px; border-radius: 3px; margin-left: 4px; }
            #${uid} .popup-close { position: absolute; top: 8px; right: 10px; cursor: pointer; color: #999; font-size: 16px; }
            #${uid} .popup-close:hover { color: #333; }
            #${uid} .topk-item {
                padding: 4px 6px; margin: 2px 0; border-radius: 3px; cursor: pointer;
                display: flex; justify-content: space-between; font-size: 11px;
            }
            #${uid} .topk-item:hover { background: #e3f2fd; }
            #${uid} .topk-item.active { background: #bbdefb; }
            #${uid} .topk-token { font-family: monospace; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            #${uid} .topk-prob { color: #666; margin-left: 8px; }
            #${uid} .topk-item.pinned { border-left: 3px solid currentColor; }
            #${uid} .resize-handle {
                position: absolute; width: 6px; height: 100%; background: transparent;
                cursor: col-resize; right: -3px; top: 0; z-index: 10;
            }
            #${uid} .resize-handle:hover, #${uid} .resize-handle.dragging { background: rgba(33, 150, 243, 0.4); }
            #${uid} .resize-handle-input {
                position: absolute; width: 6px; height: 100%; background: transparent;
                cursor: col-resize; right: -3px; top: 0; z-index: 10;
            }
            #${uid} .resize-handle-input:hover, #${uid} .resize-handle-input.dragging { background: rgba(76, 175, 80, 0.4); }
            #${uid} .table-wrapper { position: relative; display: inline-block; }
            #${uid} .resize-handle-bottom {
                position: absolute; bottom: -3px; left: 0; right: 0; height: 6px;
                cursor: row-resize; background: transparent;
            }
            #${uid} .resize-handle-bottom:hover, #${uid} .resize-handle-bottom.dragging { background: rgba(33, 150, 243, 0.4); }
            #${uid} .resize-handle-right {
                position: absolute; top: 0; bottom: 0; right: -3px; width: 6px;
                cursor: ew-resize; background: transparent;
            }
            #${uid} .resize-handle-right:hover, #${uid} .resize-handle-right.dragging { background: rgba(33, 150, 243, 0.4); }
            #${uid} .resize-hint { font-size: 9px; color: #999; margin-top: 4px; cursor: default; }
            #${uid} .resize-hint-extra { display: none; }
            #${uid}.show-all-handles .resize-handle,
            #${uid}.show-all-handles .resize-handle-input,
            #${uid}.show-all-handles .resize-handle-right { background: rgba(33, 150, 243, 0.3); }
            #${uid} .color-menu {
                display: none; position: absolute; background: white; border: 1px solid #ddd;
                border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 200; min-width: 150px;
            }
            #${uid} .color-menu.visible { display: block; }
            #${uid} .color-menu-item { padding: 0; cursor: pointer; font-size: 12px; display: flex; align-items: stretch; }
            #${uid} .color-menu-item:hover, #${uid} .color-menu-item.picking { background: #f0f0f0; }
            #${uid} .color-menu-item .color-menu-label { padding: 8px 12px 8px 0; flex: 1; }
            #${uid} .color-menu-item .color-swatch { width: 32px; height: auto; min-height: 24px; border: 0; border-left: 1px solid #ccc; background: transparent; cursor: pointer; opacity: 0; transition: opacity 0.15s; padding: 0; -webkit-appearance: none; -moz-appearance: none; appearance: none; }
            #${uid} .color-menu-item:hover .color-swatch, #${uid} .color-menu-item.picking .color-swatch { opacity: 1; }
            #${uid} .color-menu-item .color-swatch:hover { border-left-color: #666; }
            #${uid} .legend-close { cursor: pointer; }
            #${uid} .legend-close:hover { fill: #e91e63 !important; }
            @keyframes menuBlink-${uid} {
                0% { background: #f0f0f0; }
                50% { background: #d0d0d0; }
                100% { background: #f0f0f0; }
            }
        `;
        document.head.appendChild(style);

        // Inject HTML structure
        container.innerHTML = `
            <div id="${uid}">
                <div class="ll-title" id="${uid}_title">Logit Lens: Top Predictions by Layer</div>
                <div class="table-wrapper">
                    <table class="ll-table" id="${uid}_table"></table>
                    <div class="resize-handle-bottom" id="${uid}_resize_bottom"></div>
                    <div class="resize-handle-right" id="${uid}_resize_right"></div>
                </div>
                <div class="resize-hint" id="${uid}_resize_hint">drag column borders to resize</div>
                <div class="chart-container" id="${uid}_chart_container">
                    <svg id="${uid}_chart" height="140"></svg>
                </div>
                <div class="popup" id="${uid}_popup">
                    <span class="popup-close" id="${uid}_popup_close">&times;</span>
                    <div class="popup-header">
                        Layer <span id="${uid}_popup_layer"></span>, Position <span id="${uid}_popup_pos"></span>
                    </div>
                    <div id="${uid}_popup_content"></div>
                </div>
                <input type="color" id="${uid}_color_picker" style="position: absolute; opacity: 0; pointer-events: none;">
                <div class="color-menu" id="${uid}_color_menu"></div>
            </div>
        `;

        // Widget logic (same as original, just using uid and widgetData)
        var widgetInterface = (function() {
            var nLayers = widgetData.layers.length;

            // UI state variables - can be restored from uiState parameter
            var chartHeight = (uiState && uiState.chartHeight) || 140;
            var inputTokenWidth = (uiState && uiState.inputTokenWidth) || 100;

            var minChartHeight = 60;
            var maxChartHeight = 400;
            var chartMargin = { top: 10, right: 8, bottom: 25, left: 10 };
            function getChartInnerHeight() { return chartHeight - chartMargin.top - chartMargin.bottom; }
            var minCellWidth = 10;
            var maxCellWidth = 200;
            var currentCellWidth = (uiState && uiState.cellWidth) || 44;
            var currentVisibleIndices = [];
            var currentStride = 1;
            var currentMaxRows = (uiState && uiState.maxRows !== undefined) ? uiState.maxRows : null;
            var maxTableWidth = (uiState && uiState.maxTableWidth !== undefined) ? uiState.maxTableWidth : null;
            var plotMinLayer = (uiState && uiState.plotMinLayer !== undefined) ? uiState.plotMinLayer : 0;
            // Clamp plotMinLayer to valid range: [0, nLayers - 2]
            plotMinLayer = Math.max(0, Math.min(nLayers - 2, plotMinLayer));
            var openPopupCell = null;
            var justDismissedColorMenu = false; // Flag to prevent popup after menu dismiss
            var currentHoverPos = widgetData.tokens.length - 1;
            // colorModes is an array of active color modes; empty array means "none"
            // Backward compat: old state may have colorMode as string
            var colorModes = (uiState && uiState.colorModes) ? uiState.colorModes.slice() :
                             (uiState && uiState.colorMode && uiState.colorMode !== "none") ? [uiState.colorMode] :
                             (uiState && uiState.colorMode === "none") ? [] : ["top"];
            var customTitle = (uiState && uiState.title) || "Logit Lens: Top Predictions by Layer";

            var colors = ["#2196F3", "#e91e63", "#4CAF50", "#FF9800", "#9C27B0", "#00BCD4", "#F44336", "#8BC34A"];
            var colorIndex = (uiState && uiState.colorIndex) || 0;
            var pinnedGroups = (uiState && uiState.pinnedGroups) ? JSON.parse(JSON.stringify(uiState.pinnedGroups)) : [];
            var heatmapBaseColor = (uiState && uiState.heatmapBaseColor) || null; // null = default blue gradient
            var heatmapNextColor = (uiState && uiState.heatmapNextColor) || null; // null = default blue gradient
            var colorPickerTarget = null; // { type: 'trajectory', groupIdx: N } or { type: 'heatmap' } or { type: 'heatmapNext' }
            var lastPinnedGroupIndex = (uiState && uiState.lastPinnedGroupIndex !== undefined) ? uiState.lastPinnedGroupIndex : -1;

            // Pinned rows: array of {pos: number, lineStyle: object}
            var lineStyles = [
                { dash: "", name: "solid" },
                { dash: "8,4", name: "dashed" },
                { dash: "2,3", name: "dotted" },
                { dash: "8,4,2,4", name: "dash-dot" }
            ];

            // Restore pinned rows from uiState, mapping lineStyle names back to objects
            var pinnedRows = [];
            if (uiState && uiState.pinnedRows) {
                pinnedRows = uiState.pinnedRows.map(function(pr) {
                    var style = lineStyles.find(function(ls) { return ls.name === pr.lineStyleName; }) || lineStyles[0];
                    return { pos: pr.pos, lineStyle: style };
                });
            }

            function getNextColor() {
                var c = colors[colorIndex % colors.length];
                colorIndex++;
                return c;
            }

            function getColorForToken(token) {
                for (var i = 0; i < pinnedGroups.length; i++) {
                    if (pinnedGroups[i].tokens.indexOf(token) >= 0) return pinnedGroups[i].color;
                }
                return null;
            }

            function findGroupForToken(token) {
                for (var i = 0; i < pinnedGroups.length; i++) {
                    if (pinnedGroups[i].tokens.indexOf(token) >= 0) return i;
                }
                return -1;
            }

            function getGroupLabel(group) {
                return group.tokens.map(function(t) { return visualizeSpaces(t); }).join("+");
            }

            function getGroupTrajectory(group, pos) {
                var result = widgetData.layers.map(function() { return 0; });
                for (var i = 0; i < group.tokens.length; i++) {
                    var traj = getTrajectoryForToken(group.tokens[i], pos);
                    for (var j = 0; j < result.length; j++) {
                        result[j] += traj[j];
                    }
                }
                return result;
            }

            function getGroupProbAtLayer(group, pos, layerIdx) {
                var sum = 0;
                for (var i = 0; i < group.tokens.length; i++) {
                    var traj = getTrajectoryForToken(group.tokens[i], pos);
                    sum += traj[layerIdx] || 0;
                }
                return sum;
            }

            function getWinningGroupAtCell(pos, layerIdx) {
                var cellData = widgetData.cells[pos][layerIdx];
                var top1Prob = cellData.prob;
                var winningGroup = null;
                var winningProb = top1Prob;

                for (var i = 0; i < pinnedGroups.length; i++) {
                    var groupProb = getGroupProbAtLayer(pinnedGroups[i], pos, layerIdx);
                    if (groupProb > winningProb) {
                        winningProb = groupProb;
                        winningGroup = pinnedGroups[i];
                    }
                }
                return winningGroup;
            }

            function findPinnedRow(pos) {
                for (var i = 0; i < pinnedRows.length; i++) {
                    if (pinnedRows[i].pos === pos) return i;
                }
                return -1;
            }

            function getLineStyleForRow(pos) {
                var idx = findPinnedRow(pos);
                if (idx >= 0) return pinnedRows[idx].lineStyle;
                return lineStyles[0];  // default solid
            }

            function allPinnedGroupsBelowThreshold(pos, threshold) {
                // Check if all pinned groups have max prob < threshold at this position
                if (pinnedGroups.length === 0) return true;
                for (var i = 0; i < pinnedGroups.length; i++) {
                    var traj = getGroupTrajectory(pinnedGroups[i], pos);
                    var maxProb = Math.max.apply(null, traj);
                    if (maxProb >= threshold) return false;
                }
                return true;
            }

            function findHighestProbToken(pos, minLayer, minProb) {
                // Find the token that achieves highest probability at this position
                // considering only layers >= minLayer, and only if max prob >= minProb
                var bestToken = null;
                var bestProb = 0;

                // Look through all cells at this position
                for (var li = minLayer; li < widgetData.cells[pos].length; li++) {
                    var cellData = widgetData.cells[pos][li];
                    // Check top-1 token
                    if (cellData.prob > bestProb) {
                        bestProb = cellData.prob;
                        bestToken = cellData.token;
                    }
                    // Also check topk
                    for (var ki = 0; ki < cellData.topk.length; ki++) {
                        if (cellData.topk[ki].prob > bestProb) {
                            bestProb = cellData.topk[ki].prob;
                            bestToken = cellData.topk[ki].token;
                        }
                    }
                }

                if (bestProb >= minProb) return bestToken;
                return null;
            }

            function togglePinnedRow(pos) {
                var idx = findPinnedRow(pos);
                if (idx >= 0) {
                    // Unpin the row
                    pinnedRows.splice(idx, 1);
                    return false;
                } else {
                    // Check if we should auto-pin a token
                    if (allPinnedGroupsBelowThreshold(pos, 0.01)) {
                        var bestToken = findHighestProbToken(pos, 2, 0.05);
                        if (bestToken && findGroupForToken(bestToken) < 0) {
                            // Pin this token
                            var newGroup = { color: getNextColor(), tokens: [bestToken] };
                            pinnedGroups.push(newGroup);
                            lastPinnedGroupIndex = pinnedGroups.length - 1;
                        }
                    }
                    // Pin the row with next available line style
                    var styleIdx = pinnedRows.length % lineStyles.length;
                    pinnedRows.push({ pos: pos, lineStyle: lineStyles[styleIdx] });
                    return true;
                }
            }

            function escapeHtml(text) {
                var div = document.createElement("div");
                div.textContent = text;
                return div.innerHTML;
            }

            function normalizeForComparison(token) {
                // Remove spaces and punctuation, lowercase
                return token.replace(/[\s.,!?;:'"()\[\]{}\-_]/g, '').toLowerCase();
            }

            function hasSimilarTokensInList(topkList, targetToken) {
                var targetNorm = normalizeForComparison(targetToken);
                if (!targetNorm) return false;  // nothing left after normalization

                for (var i = 0; i < topkList.length; i++) {
                    if (topkList[i].token === targetToken) continue;  // skip the target itself
                    var otherNorm = normalizeForComparison(topkList[i].token);
                    if (otherNorm && otherNorm === targetNorm) {
                        return true;
                    }
                }
                return false;
            }

            // Map of invisible/special characters to their entity names
            // Note: regular space and modifier letter shelf are NOT here - spaces get visualized as shelf
            var invisibleEntityMap = {
                '\u00A0': '&nbsp;',      // Non-breaking space
                '\u00AD': '&shy;',       // Soft hyphen
                '\u200B': '&#8203;',     // Zero-width space
                '\u200C': '&zwnj;',      // Zero-width non-joiner
                '\u200D': '&zwj;',       // Zero-width joiner
                '\uFEFF': '&#65279;',    // Zero-width no-break space (BOM)
                '\u2060': '&#8288;',     // Word joiner
                '\u2002': '&ensp;',      // En space
                '\u2003': '&emsp;',      // Em space
                '\u2009': '&thinsp;',    // Thin space
                '\u200A': '&#8202;',     // Hair space
                '\u2006': '&#8198;',     // Six-per-em space
                '\u2008': '&#8200;',     // Punctuation space
                '\u200E': '&lrm;',       // Left-to-right mark
                '\u200F': '&rlm;',       // Right-to-left mark
                '\t': '&#9;',            // Tab
                '\n': '&#10;',           // Newline
                '\r': '&#13;'            // Carriage return
            };

            function visualizeSpaces(text, spellOutEntities) {
                var result = text;

                // If spellOutEntities is true, convert invisible chars to entity names FIRST
                if (spellOutEntities) {
                    var output = '';
                    for (var i = 0; i < result.length; i++) {
                        var ch = result[i];
                        if (invisibleEntityMap[ch]) {
                            output += invisibleEntityMap[ch];
                        } else {
                            output += ch;
                        }
                    }
                    result = output;
                }

                // Then convert leading/trailing spaces to modifier letter shelf
                var leadingSpaces = 0;
                while (leadingSpaces < result.length && result[leadingSpaces] === ' ') leadingSpaces++;
                if (leadingSpaces > 0) {
                    result = '\u02FD'.repeat(leadingSpaces) + result.slice(leadingSpaces);
                }
                var trailingSpaces = 0;
                while (trailingSpaces < result.length && result[result.length - 1 - trailingSpaces] === ' ') trailingSpaces++;
                if (trailingSpaces > 0) {
                    result = result.slice(0, result.length - trailingSpaces) + '\u02FD'.repeat(trailingSpaces);
                }

                return result;
            }

            function probToColor(prob, baseColor) {
                if (baseColor) {
                    var hex = baseColor.replace('#', '');
                    var r = parseInt(hex.substr(0, 2), 16);
                    var g = parseInt(hex.substr(2, 2), 16);
                    var b = parseInt(hex.substr(4, 2), 16);
                    var blend = prob;
                    var rr = Math.round(255 - (255 - r) * blend);
                    var gg = Math.round(255 - (255 - g) * blend);
                    var bb = Math.round(255 - (255 - b) * blend);
                    return "rgb(" + rr + "," + gg + "," + bb + ")";
                }
                var rVal = Math.round(255 * (1 - prob * 0.8));
                var gVal = Math.round(255 * (1 - prob * 0.6));
                return "rgb(" + rVal + "," + gVal + ",255)";
            }

            function getTrajectoryForToken(token, pos) {
                for (var li = 0; li < widgetData.cells[pos].length; li++) {
                    var cellData = widgetData.cells[pos][li];
                    if (cellData.token === token) return cellData.trajectory;
                    for (var ki = 0; ki < cellData.topk.length; ki++) {
                        if (cellData.topk[ki].token === token) return cellData.topk[ki].trajectory;
                    }
                }
                return widgetData.layers.map(function() { return 0; });
            }

            function computeVisibleLayers(cellWidth, containerWidth) {
                var availableWidth = containerWidth - inputTokenWidth - 1;
                var maxCols = Math.max(1, Math.floor(availableWidth / cellWidth));

                if (maxCols >= nLayers) {
                    return { stride: 1, indices: widgetData.layers.map(function(_, i) { return i; }) };
                }

                var stride = maxCols > 1
                    ? Math.max(1, Math.floor((nLayers - 1) / (maxCols - 1)))
                    : nLayers;

                var indices = [];
                var lastLayer = nLayers - 1;
                for (var i = lastLayer; i >= 0; i -= stride) {
                    indices.unshift(i);
                }

                while (indices.length > maxCols) {
                    indices.shift();
                }

                return { stride: stride, indices: indices };
            }

            function updateChartDimensions() {
                var table = document.getElementById(uid + "_table");
                var tableWidth = table.offsetWidth;
                var svg = document.getElementById(uid + "_chart");
                svg.setAttribute("width", tableWidth);

                var firstInputCell = table.querySelector(".input-token");
                if (firstInputCell) {
                    var tableRect = table.getBoundingClientRect();
                    var inputCellRect = firstInputCell.getBoundingClientRect();
                    var actualInputRight = inputCellRect.right - tableRect.left;
                    return tableWidth - actualInputRight;
                }
                return tableWidth - inputTokenWidth;
            }

            function buildTable(cellWidth, visibleLayerIndices, maxRows, stride) {
                currentVisibleIndices = visibleLayerIndices;
                currentMaxRows = maxRows;
                if (stride !== undefined) currentStride = stride;
                var table = document.getElementById(uid + "_table");
                var html = "";

                var totalTokens = widgetData.tokens.length;
                var visiblePositions;
                if (maxRows === null || maxRows >= totalTokens) {
                    visiblePositions = widgetData.tokens.map(function(_, i) { return i; });
                } else {
                    var startPos = totalTokens - maxRows;
                    visiblePositions = [];
                    for (var i = startPos; i < totalTokens; i++) {
                        visiblePositions.push(i);
                    }
                }

                html += "<colgroup>";
                html += '<col style="width:' + inputTokenWidth + 'px;">';
                visibleLayerIndices.forEach(function() {
                    html += '<col style="width:' + cellWidth + 'px;">';
                });
                html += "</colgroup>";

                var halfwayCol = Math.floor(visibleLayerIndices.length / 2);

                // Default colors for heatmap modes
                var defaultBaseColor = "#8844ff";  // purple for "top"
                var defaultNextColor = "#cc6622";  // burnt orange for specific token

                // Helper to get color for a mode
                function getColorForMode(mode) {
                    if (mode === "top") return heatmapBaseColor || defaultBaseColor;
                    var groupColor = getColorForToken(mode);
                    if (groupColor) return groupColor;
                    return heatmapNextColor || defaultNextColor;
                }

                // Helper to get probability for a mode at a cell
                function getProbForMode(mode, cellData) {
                    if (mode === "top") return cellData.prob;
                    var found = cellData.topk.find(function(t) { return t.token === mode; });
                    return found ? found.prob : 0;
                }

                visiblePositions.forEach(function(pos, rowIdx) {
                    var tok = widgetData.tokens[pos];
                    var isFirstVisibleRow = rowIdx === 0;
                    var isPinnedRow = findPinnedRow(pos) >= 0;
                    var rowLineStyle = getLineStyleForRow(pos);

                    html += "<tr>";

                    // Input token cell with optional yellow background for pinned rows
                    var inputStyle = "width:" + inputTokenWidth + "px; max-width:" + inputTokenWidth + "px;";
                    if (isPinnedRow) {
                        inputStyle += " background: #fff59d;";
                    }

                    html += '<td class="input-token' + (isPinnedRow ? ' pinned-row' : '') + '" data-pos="' + pos + '" title="' + escapeHtml(tok) + '" style="' + inputStyle + '">';

                    // Mini SVG line style indicator for pinned rows (wider to show dash-dot pattern)
                    if (isPinnedRow) {
                        html += '<svg width="20" height="10" style="vertical-align: middle; margin-right: 2px;">';
                        html += '<line x1="0" y1="5" x2="20" y2="5" stroke="#333" stroke-width="1.5"';
                        if (rowLineStyle.dash) {
                            html += ' stroke-dasharray="' + rowLineStyle.dash + '"';
                        }
                        html += '/></svg>';
                    }

                    html += escapeHtml(tok);
                    if (isFirstVisibleRow) {
                        html += '<div class="resize-handle-input" data-col="-1"></div>';
                    }
                    html += '</td>';

                    visibleLayerIndices.forEach(function(li, colIdx) {
                        var cellData = widgetData.cells[pos][li];

                        // Find winning mode: highest probability, ties go to later mode in list
                        var cellProb = 0;
                        var winningColor = null;
                        if (colorModes.length > 0) {
                            colorModes.forEach(function(mode) {
                                var modeProb = getProbForMode(mode, cellData);
                                if (modeProb >= cellProb) {  // >= so later modes win ties
                                    cellProb = modeProb;
                                    winningColor = getColorForMode(mode);
                                }
                            });
                        }

                        var color = colorModes.length === 0 ? "#fff" : probToColor(cellProb, winningColor);
                        var textColor = colorModes.length === 0 ? "#333" : (cellProb < 0.5 ? "#333" : "#fff");
                        var pinnedColor = getColorForToken(cellData.token);
                        if (!pinnedColor) {
                            var winningGroup = getWinningGroupAtCell(pos, li);
                            if (winningGroup) pinnedColor = winningGroup.color;
                        }
                        var pinnedStyle = pinnedColor ? "box-shadow: inset 0 0 0 2px " + pinnedColor + ";" : "";

                        // Bold the last token in the last layer (main model prediction)
                        var isMainPrediction = (rowIdx === visiblePositions.length - 1) && (colIdx === visibleLayerIndices.length - 1);
                        var boldStyle = isMainPrediction ? "font-weight: bold;" : "";

                        var hasHandle = isFirstVisibleRow && colIdx < halfwayCol;

                        html += '<td class="pred-cell' + (pinnedColor ? ' pinned' : '') + '" ' +
                            'data-pos="' + pos + '" data-li="' + li + '" data-col="' + colIdx + '" ' +
                            'style="background:' + color + '; color:' + textColor + '; width:' + cellWidth + 'px; max-width:' + cellWidth + 'px; ' + pinnedStyle + boldStyle + '">' +
                            escapeHtml(cellData.token);
                        if (hasHandle) {
                            html += '<div class="resize-handle" data-col="' + colIdx + '"></div>';
                        }
                        html += '</td>';
                    });
                    html += "</tr>";
                });

                html += "<tr>";
                html += '<th class="corner-hdr" style="width:' + inputTokenWidth + 'px; max-width:' + inputTokenWidth + 'px;">Layer<div class="resize-handle-input" data-col="-1"></div></th>';
                visibleLayerIndices.forEach(function(li, colIdx) {
                    var hasHandle = colIdx < halfwayCol;
                    html += '<th class="layer-hdr" style="width:' + cellWidth + 'px; max-width:' + cellWidth + 'px;">' + widgetData.layers[li];
                    if (hasHandle) {
                        html += '<div class="resize-handle" data-col="' + colIdx + '"></div>';
                    }
                    html += '</th>';
                });
                html += "</tr>";

                table.innerHTML = html;
                attachCellListeners();
                attachResizeListeners();

                var containerWidth = getContainerWidth();
                var actualTableWidth = table.offsetWidth;
                if (actualTableWidth > containerWidth) {
                    console.log("Table width overflow detected:", {
                        containerWidth: containerWidth,
                        actualTableWidth: actualTableWidth,
                        overflow: actualTableWidth - containerWidth
                    });
                }

                var chartInnerWidth = updateChartDimensions();
                drawAllTrajectories(null, null, null, chartInnerWidth, currentHoverPos);
                updateTitle();

                var hint = document.getElementById(uid + "_resize_hint");
                var hintMain = currentStride > 1 ?
                    "showing every " + currentStride + " layers ending at " + (nLayers-1) :
                    "showing all " + nLayers + " layers";
                hint.innerHTML = '<span class="resize-hint-main">' + hintMain + '</span><span class="resize-hint-extra"> (drag column borders to adjust)</span>';

                // Hover over hint shows extra text and all resize handles
                hint.addEventListener("mouseenter", function() {
                    hint.querySelector(".resize-hint-extra").style.display = "inline";
                    document.getElementById(uid).classList.add("show-all-handles");
                });
                hint.addEventListener("mouseleave", function() {
                    hint.querySelector(".resize-hint-extra").style.display = "none";
                    document.getElementById(uid).classList.remove("show-all-handles");
                });
            }

            function getDefaultTitle() {
                // Concatenated input tokens, omitting special tokens like <s>
                var tokens = widgetData.tokens.slice();
                if (tokens.length > 0 && /^<[^>]+>$/.test(tokens[0].trim())) {
                    tokens = tokens.slice(1);
                }
                return tokens.join("");
            }

            function updateTitle() {
                var titleEl = document.getElementById(uid + "_title");

                // Constrain title width to match maxTableWidth if set, but allow wrapping
                if (maxTableWidth !== null) {
                    titleEl.style.maxWidth = maxTableWidth + "px";
                } else {
                    titleEl.style.maxWidth = "";
                }
                titleEl.style.whiteSpace = "normal";
                var displayLabel = "";
                var pinnedColor = null;
                var useColoredBy = true;

                if (colorModes.length === 0) {
                    // No modes = "none"
                    displayLabel = "";
                    useColoredBy = false;
                } else if (colorModes.length === 1) {
                    // Single mode - show its name
                    var mode = colorModes[0];
                    if (mode === "top") {
                        displayLabel = "top prediction";
                    } else {
                        var groupIdx = findGroupForToken(mode);
                        if (groupIdx >= 0) {
                            var group = pinnedGroups[groupIdx];
                            displayLabel = getGroupLabel(group);
                            pinnedColor = group.color;
                        } else {
                            displayLabel = visualizeSpaces(mode);
                        }

                        // Check if selected color matches top prediction at last position
                        var lastPos = widgetData.tokens.length - 1;
                        var lastLayerIdx = currentVisibleIndices[currentVisibleIndices.length - 1];
                        var topToken = widgetData.cells[lastPos][lastLayerIdx].token;

                        if (mode === topToken) {
                            var tokens = widgetData.tokens.slice();
                            if (tokens.length > 0 && /^<[^>]+>$/.test(tokens[0].trim())) {
                                tokens = tokens.slice(1);
                            }
                            if (tokens.length >= 3) {
                                var suffix = tokens.slice(-3).join("");
                                if (suffix.length > 0 && customTitle.endsWith(suffix)) {
                                    useColoredBy = false;
                                }
                            }
                        }
                    }
                } else {
                    // Multiple modes - show all labels joined by " and "
                    var labels = colorModes.map(function(mode) {
                        if (mode === "top") return "top prediction";
                        var groupIdx = findGroupForToken(mode);
                        if (groupIdx >= 0) {
                            return getGroupLabel(pinnedGroups[groupIdx]);
                        }
                        return visualizeSpaces(mode);
                    });
                    displayLabel = labels.join(" and ");
                }

                var btnStyle = pinnedColor ? "background: " + pinnedColor + "22;" : "";

                // "None" mode: invisible button but still clickable with placeholder text
                if (colorModes.length === 0) {
                    btnStyle = "background: transparent; border: none; color: transparent; cursor: pointer;";
                    displayLabel = "colored by None";  // Placeholder for clickable area
                    useColoredBy = false;
                }

                var labelPrefix = useColoredBy ? "colored by " : "";
                var labelContent = "(" + labelPrefix + escapeHtml(displayLabel) + ")";
                titleEl.innerHTML = '<span class="ll-title-text" id="' + uid + '_title_text" style="cursor: text;">' + escapeHtml(customTitle) + '</span> <span class="color-mode-btn" id="' + uid + '_color_btn" style="' + btnStyle + '">' + labelContent + '</span>';
                document.getElementById(uid + "_color_btn").addEventListener("click", showColorModeMenu);
                document.getElementById(uid + "_title_text").addEventListener("click", startTitleEdit);
            }

            function startTitleEdit(e) {
                e.stopPropagation();
                var titleTextEl = document.getElementById(uid + "_title_text");
                var currentText = customTitle;
                var input = document.createElement("input");
                input.type = "text";
                input.value = currentText;
                input.style.cssText = "font-size: 16px; font-weight: 600; font-family: inherit; border: 1px solid #2196F3; border-radius: 3px; padding: 1px 4px; outline: none; width: " + Math.max(200, titleTextEl.offsetWidth) + "px;";

                titleTextEl.innerHTML = "";
                titleTextEl.appendChild(input);
                input.focus();
                input.select();

                function finishEdit() {
                    var newTitle = input.value.trim();
                    if (newTitle) {
                        customTitle = newTitle;
                    } else {
                        // Default to concatenated input tokens, omitting special tokens like <s>
                        var tokens = widgetData.tokens.slice();
                        if (tokens.length > 0 && /^<[^>]+>$/.test(tokens[0].trim())) {
                            tokens = tokens.slice(1);
                        }
                        customTitle = tokens.join("");
                    }
                    updateTitle();
                }

                input.addEventListener("blur", finishEdit);
                input.addEventListener("keydown", function(ev) {
                    if (ev.key === "Enter") {
                        ev.preventDefault();
                        input.blur();
                    } else if (ev.key === "Escape") {
                        ev.preventDefault();
                        input.value = customTitle;  // restore original
                        input.blur();
                    }
                });
            }

            function showColorModeMenu(e) {
                e.stopPropagation();
                // Close other menus/popups first
                closePopup();
                colorPickerTarget = null;
                var menu = document.getElementById(uid + "_color_menu");

                // Toggle: if menu is already visible, just close it
                if (menu.classList.contains("visible")) {
                    menu.classList.remove("visible");
                    return;
                }
                var btn = e.target;
                var rect = btn.getBoundingClientRect();
                var containerRect = document.getElementById(uid).getBoundingClientRect();

                menu.style.left = (rect.left - containerRect.left) + "px";
                menu.style.top = (rect.bottom - containerRect.top + 5) + "px";

                var lastPos = widgetData.tokens.length - 1;
                var lastLayerIdx = currentVisibleIndices[currentVisibleIndices.length - 1];
                var topToken = widgetData.cells[lastPos][lastLayerIdx].token;

                // Build menu items with color swatches
                var menuItems = [];

                // "top prediction" - uses heatmapBaseColor
                menuItems.push({
                    mode: "top",
                    label: "top prediction",
                    color: heatmapBaseColor || "#8844ff",
                    colorType: "heatmap",
                    groupIdx: null
                });

                // Specific top token (if not pinned) - uses heatmapNextColor
                if (findGroupForToken(topToken) < 0) {
                    menuItems.push({
                        mode: topToken,
                        label: topToken,
                        color: heatmapNextColor || "#cc6622",
                        colorType: "heatmapNext",
                        groupIdx: null
                    });
                }

                // Pinned groups - each uses its own color
                pinnedGroups.forEach(function(group, idx) {
                    var label = getGroupLabel(group);
                    var modeToken = group.tokens[0];
                    menuItems.push({
                        mode: modeToken,
                        label: label,
                        color: group.color,
                        colorType: "trajectory",
                        groupIdx: idx,
                        borderColor: group.color
                    });
                });

                // Build HTML with checkmarks for active modes
                var html = "";
                menuItems.forEach(function(item, idx) {
                    var isActive = colorModes.indexOf(item.mode) >= 0;
                    var borderStyle = item.borderColor ? "border-left: 3px solid " + item.borderColor + ";" : "";
                    var checkmark = isActive ? '<span style="padding: 8px 10px 8px 20px; font-weight: bold;">✓</span>' : '<span style="padding: 8px 10px 8px 20px; visibility: hidden;">✓</span>';
                    html += '<div class="color-menu-item" data-mode="' + escapeHtml(item.mode) + '" data-idx="' + idx + '" style="' + borderStyle + '">';
                    html += checkmark + '<span class="color-menu-label">' + escapeHtml(item.label) + '</span>';
                    html += '<input type="color" class="color-swatch" value="' + item.color + '" data-idx="' + idx + '" style="border:0;background:transparent;padding:0;">';
                    html += '</div>';
                });

                // "None" item - no color swatch, but has invisible checkmark for alignment
                var noneActive = colorModes.length === 0;
                var noneCheckmark = noneActive ? '<span style="padding: 8px 10px 8px 20px; font-weight: bold;">✓</span>' : '<span style="padding: 8px 10px 8px 20px; visibility: hidden;">✓</span>';
                html += '<div class="color-menu-item" data-mode="none" style="border-top: 1px solid #eee; margin-top: 4px;">' + noneCheckmark + '<span class="color-menu-label">None</span></div>';

                menu.innerHTML = html;
                menu.classList.add("visible");

                // Add click handlers for menu items
                menu.querySelectorAll(".color-menu-item").forEach(function(item) {
                    item.addEventListener("click", function(ev) {
                        // Don't close menu if clicking on color swatch
                        if (ev.target.classList.contains("color-swatch")) return;
                        ev.stopPropagation();

                        var mode = item.dataset.mode;
                        var isModifierClick = ev.shiftKey || ev.ctrlKey || ev.metaKey;

                        if (isModifierClick && mode !== "none") {
                            // Shift/Ctrl/Cmd+click toggles the mode
                            var idx = colorModes.indexOf(mode);
                            var checkmarkSpan = item.querySelector("span");
                            if (idx >= 0) {
                                colorModes.splice(idx, 1);
                                // Update checkmark to hidden
                                if (checkmarkSpan) {
                                    checkmarkSpan.style.visibility = "hidden";
                                    checkmarkSpan.style.fontWeight = "normal";
                                }
                            } else {
                                colorModes.push(mode);
                                // Update checkmark to visible
                                if (checkmarkSpan) {
                                    checkmarkSpan.style.visibility = "visible";
                                    checkmarkSpan.style.fontWeight = "bold";
                                }
                            }
                            // Update None item checkmark based on whether colorModes is empty
                            var noneItem = menu.querySelector('.color-menu-item[data-mode="none"]');
                            if (noneItem) {
                                var noneCheckmark = noneItem.querySelector("span");
                                if (noneCheckmark) {
                                    if (colorModes.length === 0) {
                                        noneCheckmark.style.visibility = "visible";
                                        noneCheckmark.style.fontWeight = "bold";
                                    } else {
                                        noneCheckmark.style.visibility = "hidden";
                                        noneCheckmark.style.fontWeight = "normal";
                                    }
                                }
                            }
                            // Update table without closing menu
                            buildTable(currentCellWidth, currentVisibleIndices, currentMaxRows);
                            return;
                        }

                        // Regular click: blink then close menu
                        item.style.animation = "menuBlink-" + uid + " 0.2s ease-in-out";
                        setTimeout(function() {
                            if (mode === "none") {
                                colorModes = [];
                            } else {
                                colorModes = [mode];
                            }
                            menu.classList.remove("visible");
                            buildTable(currentCellWidth, currentVisibleIndices, currentMaxRows);
                        }, 200);
                    });
                });

                // Add handlers for color swatches
                menu.querySelectorAll(".color-swatch").forEach(function(swatch) {
                    var idx = parseInt(swatch.dataset.idx);
                    var itemData = menuItems[idx];
                    var menuItem = swatch.closest(".color-menu-item");

                    swatch.addEventListener("click", function(ev) {
                        ev.stopPropagation();
                        // Add picking class to keep item active while picker is open
                        if (menuItem) menuItem.classList.add("picking");
                    });

                    swatch.addEventListener("input", function(ev) {
                        ev.stopPropagation();
                        var newColor = swatch.value;

                        if (itemData.colorType === "heatmap") {
                            heatmapBaseColor = newColor;
                        } else if (itemData.colorType === "heatmapNext") {
                            heatmapNextColor = newColor;
                        } else if (itemData.colorType === "trajectory" && itemData.groupIdx !== null) {
                            pinnedGroups[itemData.groupIdx].color = newColor;
                            // Update the border color on the menu item
                            if (menuItem) menuItem.style.borderLeftColor = newColor;
                        }
                        buildTable(currentCellWidth, currentVisibleIndices, currentMaxRows);
                    });

                    // Remove picking class when color picker closes
                    swatch.addEventListener("change", function(ev) {
                        if (menuItem) menuItem.classList.remove("picking");
                    });

                    swatch.addEventListener("blur", function(ev) {
                        if (menuItem) menuItem.classList.remove("picking");
                    });
                });
            }

            function getContainerWidth() {
                var el = document.getElementById(uid);
                var actualWidth = el.offsetWidth || 900;
                if (maxTableWidth !== null) {
                    return Math.min(maxTableWidth, actualWidth);
                }
                return actualWidth;
            }

            function getActualContainerWidth() {
                var el = document.getElementById(uid);
                return el.offsetWidth || 900;
            }

            // Shared drag state for column resizing (prevents listener accumulation)
            var colResizeDrag = { active: false, type: null, startX: 0, startWidth: 0, colIdx: 0 };
            var yAxisDrag = { active: false, startX: 0, startWidth: 0 };
            var xAxisDrag = { active: false, startY: 0, startHeight: 0 };
            var plotMinLayerDrag = { active: false, startX: 0, startMinLayer: 0, layerIdx: 0, layerXAtStart: 0, usableWidth: 0, dotRadius: 0 };
            var rightEdgeDrag = { active: false, startX: 0, startTableWidth: 0, hadMaxTableWidth: false, startMaxTableWidth: null };

            function attachResizeListeners() {
                document.querySelectorAll("#" + uid + " .resize-handle-input").forEach(function(handle) {
                    handle.addEventListener("mousedown", function(e) {
                        closePopup();
                        colResizeDrag = { active: true, type: 'input', startX: e.clientX, startWidth: inputTokenWidth, colIdx: 0 };
                        handle.classList.add("dragging");
                        e.preventDefault();
                        e.stopPropagation();
                    });
                });

                document.querySelectorAll("#" + uid + " .resize-handle").forEach(function(handle) {
                    var colIdx = parseInt(handle.dataset.col);
                    handle.addEventListener("mousedown", function(e) {
                        closePopup();
                        colResizeDrag = { active: true, type: 'column', startX: e.clientX, startWidth: currentCellWidth, colIdx: colIdx };
                        handle.classList.add("dragging");
                        e.preventDefault();
                        e.stopPropagation();
                    });
                });
            }

            // Single document-level listeners for column resize (added once per widget)
            document.addEventListener("mousemove", function(e) {
                if (!colResizeDrag.active) return;
                var delta = e.clientX - colResizeDrag.startX;

                if (colResizeDrag.type === 'input') {
                    inputTokenWidth = Math.max(40, Math.min(200, colResizeDrag.startWidth + delta));
                    var result = computeVisibleLayers(currentCellWidth, getContainerWidth());
                    buildTable(currentCellWidth, result.indices, currentMaxRows, result.stride);
                    notifyLinkedWidgets();
                } else if (colResizeDrag.type === 'column') {
                    var numCols = colResizeDrag.colIdx + 1;
                    var widthDelta = delta / numCols;
                    var newWidth = Math.max(minCellWidth, Math.min(maxCellWidth, colResizeDrag.startWidth + widthDelta));
                    if (Math.abs(newWidth - currentCellWidth) > 1) {
                        currentCellWidth = newWidth;
                        var result = computeVisibleLayers(currentCellWidth, getContainerWidth());
                        buildTable(currentCellWidth, result.indices, currentMaxRows, result.stride);
                        notifyLinkedWidgets();
                    }
                }
            });

            document.addEventListener("mouseup", function() {
                if (colResizeDrag.active) {
                    colResizeDrag.active = false;
                    document.querySelectorAll("#" + uid + " .resize-handle-input, #" + uid + " .resize-handle").forEach(function(h) {
                        h.classList.remove("dragging");
                    });
                }
                if (yAxisDrag.active) {
                    yAxisDrag.active = false;
                }
                if (xAxisDrag.active) {
                    xAxisDrag.active = false;
                }
                if (plotMinLayerDrag.active) {
                    plotMinLayerDrag.active = false;
                }
                if (rightEdgeDrag.active) {
                    rightEdgeDrag.active = false;
                    document.getElementById(uid + "_resize_right").classList.remove("dragging");
                }
            });

            // X-axis drag for chart height
            document.addEventListener("mousemove", function(e) {
                if (!xAxisDrag.active) return;
                var delta = e.clientY - xAxisDrag.startY;
                var newHeight = Math.max(minChartHeight, Math.min(maxChartHeight, xAxisDrag.startHeight + delta));
                if (Math.abs(newHeight - chartHeight) > 2) {
                    chartHeight = newHeight;
                    var svg = document.getElementById(uid + "_chart");
                    svg.setAttribute("height", chartHeight);
                    var chartInnerWidth = updateChartDimensions();
                    drawAllTrajectories(null, null, null, chartInnerWidth, currentHoverPos);
                }
            });

            document.addEventListener("mousemove", function(e) {
                if (!yAxisDrag.active) return;
                var delta = e.clientX - yAxisDrag.startX;
                inputTokenWidth = Math.max(40, Math.min(200, yAxisDrag.startWidth + delta));
                var result = computeVisibleLayers(currentCellWidth, getContainerWidth());
                buildTable(currentCellWidth, result.indices, currentMaxRows, result.stride);
                notifyLinkedWidgets();
            });

            // Plot min layer drag for x-axis zoom
            document.addEventListener("mousemove", function(e) {
                if (!plotMinLayerDrag.active) return;
                var delta = e.clientX - plotMinLayerDrag.startX;

                // Calculate what plotMinLayer value would put the dragged layer at the new x position
                // The relationship is: x = dotRadius + ((layerIdx - plotMinLayer) / visibleRange) * (usableWidth - 2*dotRadius)
                // where visibleRange = (nLayers - 1) - plotMinLayer
                // Solving for plotMinLayer given a new x position for the dragged layer:
                var dr = plotMinLayerDrag.dotRadius;
                var uw = plotMinLayerDrag.usableWidth;
                var layerIdx = plotMinLayerDrag.layerIdx;
                var targetX = plotMinLayerDrag.layerXAtStart + delta;

                // Clamp targetX to valid range
                targetX = Math.max(dr, Math.min(uw - dr, targetX));

                // From the formula: targetX = dr + ((layerIdx - newMinLayer) / ((nLayers-1) - newMinLayer)) * (uw - 2*dr)
                // Let's solve for newMinLayer:
                // (targetX - dr) / (uw - 2*dr) = (layerIdx - newMinLayer) / ((nLayers-1) - newMinLayer)
                // Let t = (targetX - dr) / (uw - 2*dr)
                // t * ((nLayers-1) - newMinLayer) = layerIdx - newMinLayer
                // t * (nLayers-1) - t * newMinLayer = layerIdx - newMinLayer
                // t * (nLayers-1) - layerIdx = t * newMinLayer - newMinLayer
                // t * (nLayers-1) - layerIdx = newMinLayer * (t - 1)
                // newMinLayer = (t * (nLayers-1) - layerIdx) / (t - 1)
                var t = (targetX - dr) / (uw - 2 * dr);
                if (Math.abs(t - 1) < 0.001) {
                    // t is very close to 1, which means the layer is at the right edge
                    // This shouldn't happen for draggable layers (only last is non-draggable)
                    return;
                }
                var newMinLayer = (t * (nLayers - 1) - layerIdx) / (t - 1);

                // Clamp to valid range: 0 <= plotMinLayer < nLayers - 1
                // Also can't set it beyond the dragged layer (that would flip the axis)
                newMinLayer = Math.max(0, Math.min(layerIdx - 0.1, newMinLayer));

                if (Math.abs(newMinLayer - plotMinLayer) > 0.01) {
                    plotMinLayer = newMinLayer;
                    var chartInnerWidth = updateChartDimensions();
                    drawAllTrajectories(null, null, null, chartInnerWidth, currentHoverPos);
                }
            });

            function attachCellListeners() {
                document.querySelectorAll("#" + uid + " .pred-cell, #" + uid + " .input-token").forEach(function(cell) {
                    var pos = parseInt(cell.dataset.pos);
                    if (isNaN(pos)) return;
                    var isInputToken = cell.classList.contains("input-token");

                    cell.addEventListener("mouseenter", function() {
                        currentHoverPos = pos;
                        var chartInnerWidth = updateChartDimensions();

                        if (isInputToken) {
                            // For input tokens, show the token that would be auto-pinned (if any)
                            var bestToken = findHighestProbToken(pos, 2, 0.05);
                            if (bestToken && findGroupForToken(bestToken) < 0) {
                                var traj = getTrajectoryForToken(bestToken, pos);
                                drawAllTrajectories(traj, "#999", bestToken, chartInnerWidth, pos);
                            } else {
                                drawAllTrajectories(null, null, null, chartInnerWidth, pos);
                            }
                        } else {
                            // For prediction cells, show that cell's token trajectory
                            // Always show hover trajectory (gray line) even if token is pinned
                            // This allows both row-based colored lines and cell-based gray lines to coexist
                            var li = cell.dataset.li ? parseInt(cell.dataset.li) : 0;
                            var cellData = widgetData.cells[pos][li] || widgetData.cells[pos][0];
                            drawAllTrajectories(cellData.trajectory, "#999", cellData.token, chartInnerWidth, pos);
                        }
                    });

                    cell.addEventListener("mouseleave", function() {
                        // Clear hover trajectory when leaving cell
                        var chartInnerWidth = updateChartDimensions();
                        drawAllTrajectories(null, null, null, chartInnerWidth, currentHoverPos);
                    });
                });

                // Input token click handler for row pinning
                document.querySelectorAll("#" + uid + " .input-token").forEach(function(cell) {
                    var pos = parseInt(cell.dataset.pos);
                    if (isNaN(pos)) return;

                    cell.addEventListener("click", function(e) {
                        e.stopPropagation();
                        closePopup();
                        document.getElementById(uid + "_color_menu").classList.remove("visible");
                        togglePinnedRow(pos);
                        buildTable(currentCellWidth, currentVisibleIndices, currentMaxRows);
                    });
                });

                document.querySelectorAll("#" + uid + " .pred-cell").forEach(function(cell) {
                    var pos = parseInt(cell.dataset.pos);
                    var li = parseInt(cell.dataset.li);
                    var cellData = widgetData.cells[pos][li];

                    cell.addEventListener("click", function(e) {
                        e.stopPropagation();
                        var addToGroup = e.shiftKey || e.ctrlKey || e.metaKey;

                        if (e.shiftKey) {
                            togglePinnedTrajectory(cellData.token, addToGroup);
                            buildTable(currentCellWidth, currentVisibleIndices, currentMaxRows);
                            return;
                        }
                        // If color menu is open, first click just dismisses it
                        var colorMenu = document.getElementById(uid + "_color_menu");
                        if (colorMenu && colorMenu.classList.contains("visible")) {
                            colorMenu.classList.remove("visible");
                            return;
                        }
                        // If popup is open, first click just dismisses it (even on different cell)
                        if (openPopupCell) { closePopup(); return; }
                        document.querySelectorAll("#" + uid + " .pred-cell.selected").forEach(function(c) { c.classList.remove("selected"); });
                        cell.classList.add("selected");
                        showPopup(cell, pos, li, cellData);
                    });
                });

                document.getElementById(uid + "_popup_close").addEventListener("click", closePopup);
            }

            function closePopup() {
                var popup = document.getElementById(uid + "_popup");
                if (popup) popup.classList.remove("visible");
                document.querySelectorAll("#" + uid + " .pred-cell.selected").forEach(function(c) { c.classList.remove("selected"); });
                openPopupCell = null;
            }

            function closeColorModeMenu() {
                var menu = document.getElementById(uid + "_color_menu");
                if (menu) menu.classList.remove("visible");
            }

            function showPopup(cell, pos, li, cellData) {
                // Close other menus/popups first
                closeColorModeMenu();
                colorPickerTarget = null;
                openPopupCell = cell;
                var popup = document.getElementById(uid + "_popup");
                var rect = cell.getBoundingClientRect();
                var containerRect = document.getElementById(uid).getBoundingClientRect();

                popup.style.left = (rect.left - containerRect.left + rect.width + 5) + "px";
                popup.style.top = (rect.top - containerRect.top) + "px";

                document.getElementById(uid + "_popup_layer").textContent = widgetData.layers[li];
                document.getElementById(uid + "_popup_pos").innerHTML = pos + "<br>Input <code>" + escapeHtml(visualizeSpaces(widgetData.tokens[pos])) + "</code>";

                var contentHtml = "";
                cellData.topk.forEach(function(item, ki) {
                    var probPct = (item.prob * 100).toFixed(1);
                    var pinnedColor = getColorForToken(item.token);
                    var pinnedStyle = pinnedColor ? "background: " + pinnedColor + "22; border-left-color: " + pinnedColor + ";" : "";
                    var visualizedToken = visualizeSpaces(item.token);
                    var tooltipToken = visualizeSpaces(item.token, true);  // Spell out entities for tooltip
                    contentHtml += '<div class="topk-item' + (pinnedColor ? ' pinned' : '') + '" data-ki="' + ki + '" style="' + pinnedStyle + '" title="' + escapeHtml(tooltipToken) + '">';
                    contentHtml += '<span class="topk-token">' + escapeHtml(visualizedToken) + '</span>';
                    contentHtml += '<span class="topk-prob">' + probPct + '%</span>';
                    contentHtml += '</div>';
                });

                // Add hint if first token is pinned and there are similar tokens
                var firstToken = cellData.topk[0].token;
                var firstIsPinned = findGroupForToken(firstToken) >= 0;
                if (firstIsPinned && hasSimilarTokensInList(cellData.topk, firstToken)) {
                    contentHtml += '<div style="font-size: 10px; font-style: italic; color: #666; margin-top: 8px; padding-top: 6px; border-top: 1px solid #eee;">Shift-click to group tokens</div>';
                }

                document.getElementById(uid + "_popup_content").innerHTML = contentHtml;

                document.querySelectorAll("#" + uid + "_popup_content .topk-item").forEach(function(item) {
                    var ki = parseInt(item.dataset.ki);
                    var tokData = cellData.topk[ki];

                    item.addEventListener("mouseenter", function() {
                        document.querySelectorAll("#" + uid + "_popup_content .topk-item").forEach(function(it) { it.classList.remove("active"); });
                        item.classList.add("active");
                        var chartInnerWidth = updateChartDimensions();
                        // Always show hover trajectory even if token is pinned
                        drawAllTrajectories(tokData.trajectory, "#999", tokData.token, chartInnerWidth, pos);
                    });

                    item.addEventListener("mouseleave", function() {
                        var chartInnerWidth = updateChartDimensions();
                        drawAllTrajectories(null, null, null, chartInnerWidth, pos);
                    });

                    item.addEventListener("click", function(e) {
                        e.stopPropagation();
                        var addToGroup = e.shiftKey || e.ctrlKey || e.metaKey;
                        togglePinnedTrajectory(tokData.token, addToGroup);
                        buildTable(currentCellWidth, currentVisibleIndices, currentMaxRows);
                        var newCell = document.querySelector("#" + uid + " .pred-cell[data-pos='" + pos + "'][data-li='" + li + "']");
                        if (newCell) {
                            newCell.classList.add("selected");
                            showPopup(newCell, pos, li, cellData);
                        }
                    });
                });

                popup.classList.add("visible");
                var chartInnerWidth = updateChartDimensions();
                // Always show hover trajectory even if token is pinned
                drawAllTrajectories(cellData.trajectory, "#999", cellData.token, chartInnerWidth, pos);
            }

            function togglePinnedTrajectory(token, addToGroup) {
                var existingGroupIdx = findGroupForToken(token);

                if (addToGroup && lastPinnedGroupIndex >= 0 && lastPinnedGroupIndex < pinnedGroups.length) {
                    var lastGroup = pinnedGroups[lastPinnedGroupIndex];

                    if (existingGroupIdx === lastPinnedGroupIndex) {
                        lastGroup.tokens = lastGroup.tokens.filter(function(t) { return t !== token; });
                        if (lastGroup.tokens.length === 0) {
                            pinnedGroups.splice(lastPinnedGroupIndex, 1);
                            lastPinnedGroupIndex = pinnedGroups.length - 1;
                        }
                        return false;
                    } else if (existingGroupIdx >= 0) {
                        pinnedGroups[existingGroupIdx].tokens = pinnedGroups[existingGroupIdx].tokens.filter(function(t) { return t !== token; });
                        if (pinnedGroups[existingGroupIdx].tokens.length === 0) {
                            pinnedGroups.splice(existingGroupIdx, 1);
                            if (lastPinnedGroupIndex > existingGroupIdx) lastPinnedGroupIndex--;
                        }
                        lastGroup.tokens.push(token);
                        return true;
                    } else {
                        lastGroup.tokens.push(token);
                        return true;
                    }
                } else {
                    if (existingGroupIdx >= 0) {
                        var group = pinnedGroups[existingGroupIdx];
                        group.tokens = group.tokens.filter(function(t) { return t !== token; });
                        if (group.tokens.length === 0) {
                            pinnedGroups.splice(existingGroupIdx, 1);
                            if (lastPinnedGroupIndex >= pinnedGroups.length) {
                                lastPinnedGroupIndex = pinnedGroups.length - 1;
                            }
                        }
                        return false;
                    } else {
                        var newGroup = { color: getNextColor(), tokens: [token] };
                        pinnedGroups.push(newGroup);
                        lastPinnedGroupIndex = pinnedGroups.length - 1;
                        return true;
                    }
                }
            }

            function drawAllTrajectories(hoverTrajectory, hoverColor, hoverLabel, chartInnerWidth, pos) {
                var svg = document.getElementById(uid + "_chart");
                svg.innerHTML = "";

                var table = document.getElementById(uid + "_table");
                var firstInputCell = table.querySelector(".input-token");
                var tableRect = table.getBoundingClientRect();
                var inputCellRect = firstInputCell.getBoundingClientRect();
                var actualInputRight = inputCellRect.right - tableRect.left;

                var legendG = document.createElementNS("http://www.w3.org/2000/svg", "g");
                legendG.setAttribute("class", "legend-area");
                svg.appendChild(legendG);

                var chartInnerHeight = getChartInnerHeight();

                var g = document.createElementNS("http://www.w3.org/2000/svg", "g");
                g.setAttribute("transform", "translate(" + actualInputRight + "," + chartMargin.top + ")");
                svg.appendChild(g);

                // X-axis group (draggable to resize chart height)
                var xAxisGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
                xAxisGroup.style.cursor = "row-resize";

                // Add hover background for x-axis (hidden by default)
                var xAxisHoverBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                xAxisHoverBg.setAttribute("x", 0); xAxisHoverBg.setAttribute("y", chartInnerHeight - 2);
                xAxisHoverBg.setAttribute("width", chartInnerWidth); xAxisHoverBg.setAttribute("height", 4);
                xAxisHoverBg.setAttribute("fill", "rgba(33, 150, 243, 0.3)");
                xAxisHoverBg.style.display = "none";
                xAxisHoverBg.classList.add("xaxis-hover-bg");
                xAxisGroup.appendChild(xAxisHoverBg);

                // Invisible wider hit target for easier dragging
                var xAxisHitTarget = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                xAxisHitTarget.setAttribute("x", 0); xAxisHitTarget.setAttribute("y", chartInnerHeight - 4);
                xAxisHitTarget.setAttribute("width", chartInnerWidth); xAxisHitTarget.setAttribute("height", 8);
                xAxisHitTarget.setAttribute("fill", "transparent");
                xAxisGroup.appendChild(xAxisHitTarget);

                var xAxis = document.createElementNS("http://www.w3.org/2000/svg", "line");
                xAxis.setAttribute("x1", 0); xAxis.setAttribute("y1", chartInnerHeight);
                xAxis.setAttribute("x2", chartInnerWidth); xAxis.setAttribute("y2", chartInnerHeight);
                xAxis.setAttribute("stroke", "#ccc");
                xAxisGroup.appendChild(xAxis);
                g.appendChild(xAxisGroup);

                xAxisGroup.addEventListener("mouseenter", function() {
                    xAxisHoverBg.style.display = "block";
                });
                xAxisGroup.addEventListener("mouseleave", function() {
                    xAxisHoverBg.style.display = "none";
                });
                xAxisGroup.addEventListener("mousedown", function(e) {
                    closePopup();
                    xAxisDrag = { active: true, startY: e.clientY, startHeight: chartHeight };
                    xAxis.setAttribute("stroke", "rgba(33, 150, 243, 0.6)");
                    e.preventDefault();
                    e.stopPropagation();
                });

                var dotRadius = 3;
                var labelMargin = chartMargin.right;
                var usableWidth = chartInnerWidth - labelMargin;

                // X-axis scaling: maps layers to x positions, accounting for plotMinLayer zoom
                // Layer plotMinLayer maps to x=dotRadius (left edge)
                // Layer (nLayers-1) maps to x=usableWidth-dotRadius (right edge)
                function layerToXForLabels(layerIdx) {
                    if (nLayers <= 1) return usableWidth / 2;
                    var visibleLayerRange = (nLayers - 1) - plotMinLayer;
                    if (visibleLayerRange <= 0) return usableWidth / 2;
                    return dotRadius + ((layerIdx - plotMinLayer) / visibleLayerRange) * (usableWidth - 2 * dotRadius);
                }

                // Add clip-path to clip trajectories at left edge when zoomed
                // Extend left to include y-axis tick label (at x=-5)
                var clipId = uid + "_chart_clip";
                var defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
                var clipPath = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
                clipPath.setAttribute("id", clipId);
                var clipRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                clipRect.setAttribute("x", "-35");
                clipRect.setAttribute("y", "-5");
                clipRect.setAttribute("width", chartInnerWidth + 35);
                clipRect.setAttribute("height", chartInnerHeight + 30);
                clipPath.appendChild(clipRect);
                defs.appendChild(clipPath);
                svg.appendChild(defs);

                // Apply clip-path to the main chart group
                g.setAttribute("clip-path", "url(#" + clipId + ")");

                // Create a separate clip-path for trajectories that clips at x=0
                // (the plot area edge, not extending into y-axis label area)
                var trajClipId = uid + "_traj_clip";
                var trajClipPath = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
                trajClipPath.setAttribute("id", trajClipId);
                var trajClipRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                trajClipRect.setAttribute("x", "0");
                trajClipRect.setAttribute("y", "-5");
                trajClipRect.setAttribute("width", chartInnerWidth);
                trajClipRect.setAttribute("height", chartInnerHeight + 10);
                trajClipPath.appendChild(trajClipRect);
                defs.appendChild(trajClipPath);

                // Create trajectory group with its own clip-path
                var trajG = document.createElementNS("http://www.w3.org/2000/svg", "g");
                trajG.setAttribute("clip-path", "url(#" + trajClipId + ")");
                g.appendChild(trajG)

                // Calculate tick label stride based on actual pixel spacing
                // Aim for ~24px minimum gap between tick labels
                var minTickGap = 24;
                var labelStride = 1;
                if (currentVisibleIndices.length >= 2) {
                    // Calculate pixel distance between consecutive visible layer indices
                    var firstX = layerToXForLabels(currentVisibleIndices[0]);
                    var secondX = layerToXForLabels(currentVisibleIndices[1]);
                    var pixelsPerIndex = Math.abs(secondX - firstX);
                    // Only adjust stride if we have meaningful pixel spacing
                    // (In jsdom/no-layout environments, pixelsPerIndex may be 0 or tiny)
                    if (pixelsPerIndex >= 1 && pixelsPerIndex < minTickGap) {
                        labelStride = Math.ceil(minTickGap / pixelsPerIndex);
                    }
                }

                var lastIdx = currentVisibleIndices.length - 1;
                var showAtIndex = new Set();
                for (var i = lastIdx; i >= 0; i -= labelStride) {
                    showAtIndex.add(i);
                }
                showAtIndex.add(0);
                if (labelStride > 1) {
                    for (var i = lastIdx; i > 0; i -= labelStride) {
                        if (i < labelStride) {
                            showAtIndex.delete(i);
                            break;
                        }
                    }
                }

                // X-axis tick labels (all except last are draggable for x-zoom)
                // Skip labels that would appear to the left of x=0 when zoomed (don't rely on clipping)
                var isLastVisibleIndex = currentVisibleIndices.length - 1;
                var minXForLabel = 8; // Half width of label, so text doesn't get cut off
                currentVisibleIndices.forEach(function(layerIdx, i) {
                    if (showAtIndex.has(i)) {
                        var x = layerToXForLabels(layerIdx);
                        // Skip labels that would be drawn too far left (only when zoomed)
                        if (plotMinLayer > 0 && x < minXForLabel) return;

                        var isLast = (i === isLastVisibleIndex);
                        var isDraggable = !isLast && layerIdx > 0;

                        // Create a group for the tick label (for hover effects)
                        var tickGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");

                        // Add hover highlight background (hidden by default)
                        // Size to fit tick label text plus small padding
                        if (isDraggable) {
                            var hoverBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                            hoverBg.setAttribute("x", x - 8);
                            hoverBg.setAttribute("y", chartInnerHeight + 3);
                            hoverBg.setAttribute("width", 16);
                            hoverBg.setAttribute("height", 11);
                            hoverBg.setAttribute("rx", 2);
                            hoverBg.setAttribute("fill", "rgba(33, 150, 243, 0.3)");
                            hoverBg.style.display = "none";
                            hoverBg.classList.add("tick-hover-bg");
                            tickGroup.appendChild(hoverBg);
                        }

                        var label = document.createElementNS("http://www.w3.org/2000/svg", "text");
                        label.setAttribute("x", x);
                        label.setAttribute("y", chartInnerHeight + 12);
                        label.setAttribute("text-anchor", "middle");
                        label.setAttribute("font-size", "9");
                        label.setAttribute("fill", "#666");
                        label.textContent = widgetData.layers[layerIdx];
                        tickGroup.appendChild(label);

                        if (isDraggable) {
                            tickGroup.style.cursor = "col-resize";
                            tickGroup.dataset.layerIdx = layerIdx;

                            tickGroup.addEventListener("mouseenter", function() {
                                var bg = tickGroup.querySelector(".tick-hover-bg");
                                if (bg) bg.style.display = "block";
                            });
                            tickGroup.addEventListener("mouseleave", function() {
                                var bg = tickGroup.querySelector(".tick-hover-bg");
                                if (bg) bg.style.display = "none";
                            });
                            tickGroup.addEventListener("mousedown", function(e) {
                                closePopup();
                                var layerIdxDragged = parseInt(tickGroup.dataset.layerIdx);
                                plotMinLayerDrag = {
                                    active: true,
                                    startX: e.clientX,
                                    startMinLayer: plotMinLayer,
                                    layerIdx: layerIdxDragged,
                                    layerXAtStart: layerToXForLabels(layerIdxDragged),
                                    usableWidth: usableWidth,
                                    dotRadius: dotRadius
                                };
                                e.preventDefault();
                                e.stopPropagation();
                            });
                        }

                        g.appendChild(tickGroup);
                    }
                });

                var yAxisGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
                yAxisGroup.style.cursor = "col-resize";

                // Add hover background for y-axis (hidden by default)
                var yAxisHoverBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                yAxisHoverBg.setAttribute("x", -2); yAxisHoverBg.setAttribute("y", 0);
                yAxisHoverBg.setAttribute("width", 4); yAxisHoverBg.setAttribute("height", chartInnerHeight);
                yAxisHoverBg.setAttribute("fill", "rgba(33, 150, 243, 0.3)");
                yAxisHoverBg.style.display = "none";
                yAxisHoverBg.classList.add("yaxis-hover-bg");
                yAxisGroup.appendChild(yAxisHoverBg);

                var yAxisHitTarget = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                yAxisHitTarget.setAttribute("x", -4); yAxisHitTarget.setAttribute("y", 0);
                yAxisHitTarget.setAttribute("width", 8); yAxisHitTarget.setAttribute("height", chartInnerHeight);
                yAxisHitTarget.setAttribute("fill", "transparent");
                yAxisGroup.appendChild(yAxisHitTarget);

                var yAxis = document.createElementNS("http://www.w3.org/2000/svg", "line");
                yAxis.setAttribute("x1", 0); yAxis.setAttribute("y1", 0);
                yAxis.setAttribute("x2", 0); yAxis.setAttribute("y2", chartInnerHeight);
                yAxis.setAttribute("stroke", "#ccc");
                yAxisGroup.appendChild(yAxis);
                g.appendChild(yAxisGroup);

                yAxisGroup.addEventListener("mouseenter", function() {
                    yAxisHoverBg.style.display = "block";
                });
                yAxisGroup.addEventListener("mouseleave", function() {
                    yAxisHoverBg.style.display = "none";
                });
                yAxisGroup.addEventListener("mousedown", function(e) {
                    closePopup();
                    yAxisDrag = { active: true, startX: e.clientX, startWidth: inputTokenWidth };
                    yAxis.setAttribute("stroke", "rgba(33, 150, 243, 0.6)");
                    e.preventDefault();
                    e.stopPropagation();
                });

                var yLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
                yLabel.setAttribute("x", -chartInnerHeight / 2);
                yLabel.setAttribute("y", -actualInputRight + 15);
                yLabel.setAttribute("text-anchor", "middle");
                yLabel.setAttribute("font-size", "10");
                yLabel.setAttribute("fill", "#666");
                yLabel.setAttribute("transform", "rotate(-90)");
                yLabel.textContent = "Probability";
                svg.appendChild(yLabel);

                // Determine which positions to show trajectories for
                var positionsToShow = [];
                if (pinnedRows.length > 0) {
                    // Only show pinned rows
                    pinnedRows.forEach(function(pr) { positionsToShow.push(pr.pos); });
                } else {
                    // Show current hover position
                    positionsToShow.push(pos);
                }

                var allProbs = [];
                positionsToShow.forEach(function(showPos) {
                    pinnedGroups.forEach(function(group) {
                        var traj = getGroupTrajectory(group, showPos);
                        allProbs = allProbs.concat(traj);
                    });
                });
                if (hoverTrajectory) allProbs = allProbs.concat(hoverTrajectory);
                var rawMaxProb = Math.max.apply(null, allProbs.concat([0.001]));  // 0.1% minimum

                // Round up to a nice scale value
                function niceMax(p) {
                    if (p >= 0.95) return 1.0;
                    var niceValues = [0.003, 0.005, 0.01, 0.02, 0.03, 0.05, 0.1, 0.2, 0.3, 0.5, 1.0];
                    for (var i = 0; i < niceValues.length; i++) {
                        if (p <= niceValues[i]) return niceValues[i];
                    }
                    return 1.0;
                }
                var maxProb = niceMax(rawMaxProb);

                // Format percentage label with minimal digits
                function formatPct(p) {
                    var pct = p * 100;
                    if (pct >= 1) return Math.round(pct) + "%";
                    if (pct >= 0.1) return pct.toFixed(1) + "%";
                    return pct.toFixed(2) + "%";
                }

                // Draw max scale tick and label at top of y-axis (only if there's data)
                var hasData = pinnedGroups.length > 0 || (hoverTrajectory && hoverLabel);
                if (hasData) {
                    var tickY = 0;  // top of chart
                    var tickLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
                    tickLine.setAttribute("x1", -3); tickLine.setAttribute("y1", tickY);
                    tickLine.setAttribute("x2", 3); tickLine.setAttribute("y2", tickY);
                    tickLine.setAttribute("stroke", "#999");
                    g.appendChild(tickLine);

                    var tickLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
                    tickLabel.setAttribute("x", -5); tickLabel.setAttribute("y", tickY + 3);
                    tickLabel.setAttribute("text-anchor", "end");
                    tickLabel.setAttribute("font-size", "8");
                    tickLabel.setAttribute("fill", "#666");
                    tickLabel.textContent = formatPct(maxProb);
                    g.appendChild(tickLabel);
                }

                // Calculate legend entry count for vertical centering
                var legendEntryCount = 0;
                if (pinnedRows.length > 1 && pinnedGroups.length === 1) {
                    legendEntryCount = 1 + pinnedRows.length;  // title + row entries
                } else {
                    legendEntryCount = pinnedGroups.length;
                }
                if (hoverTrajectory && hoverLabel) {
                    legendEntryCount += 1;  // hover entry
                }
                var legendTotalHeight = legendEntryCount * 14;
                var legendY = chartMargin.top + Math.max(10, (chartInnerHeight - legendTotalHeight) / 2);

                // Draw trajectories for each position with appropriate line style
                positionsToShow.forEach(function(showPos) {
                    var lineStyle = getLineStyleForRow(showPos);

                    pinnedGroups.forEach(function(group, groupIdx) {
                        var traj = getGroupTrajectory(group, showPos);
                        var groupLabel = getGroupLabel(group);
                        drawSingleTrajectory(trajG, traj, group.color, maxProb, groupLabel, false, chartInnerWidth, lineStyle.dash);
                    });
                });

                // Draw legend entries
                // Special case: multiple pinned rows with single group - show group as title, rows as entries
                if (pinnedRows.length > 1 && pinnedGroups.length === 1) {
                    var group = pinnedGroups[0];
                    var groupLabel = getGroupLabel(group);

                    // Title entry (group label, no line, outdented, clipped to not exceed y-axis)
                    var titleItem = document.createElementNS("http://www.w3.org/2000/svg", "g");
                    titleItem.setAttribute("transform", "translate(5, " + legendY + ")");

                    var titleClipId = uid + "_legend_title_clip";
                    var titleClipPath = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
                    titleClipPath.setAttribute("id", titleClipId);
                    var titleClipRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                    titleClipRect.setAttribute("x", "0"); titleClipRect.setAttribute("y", "-10");
                    titleClipRect.setAttribute("width", actualInputRight - 10); titleClipRect.setAttribute("height", "20");
                    titleClipPath.appendChild(titleClipRect);
                    titleItem.appendChild(titleClipPath);

                    var titleText = document.createElementNS("http://www.w3.org/2000/svg", "text");
                    titleText.setAttribute("x", "0"); titleText.setAttribute("y", "4");
                    titleText.setAttribute("font-size", "10"); titleText.setAttribute("fill", group.color);
                    titleText.setAttribute("font-weight", "600");
                    titleText.setAttribute("clip-path", "url(#" + titleClipId + ")");
                    titleText.textContent = groupLabel;
                    titleItem.appendChild(titleText);
                    legendG.appendChild(titleItem);
                    legendY += 14;

                    // Entry per pinned row
                    pinnedRows.forEach(function(pr, prIdx) {
                        var rowToken = widgetData.tokens[pr.pos];
                        var lineStyle = pr.lineStyle;

                        var legendItem = document.createElementNS("http://www.w3.org/2000/svg", "g");
                        legendItem.setAttribute("transform", "translate(18, " + legendY + ")");
                        legendItem.style.cursor = "pointer";

                        var hitTarget = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                        hitTarget.setAttribute("x", "-15"); hitTarget.setAttribute("y", "-8");
                        hitTarget.setAttribute("width", inputTokenWidth - 5); hitTarget.setAttribute("height", "14");
                        hitTarget.setAttribute("fill", "transparent");
                        legendItem.appendChild(hitTarget);

                        var closeBtn = document.createElementNS("http://www.w3.org/2000/svg", "text");
                        closeBtn.setAttribute("class", "legend-close");
                        closeBtn.setAttribute("x", "-12"); closeBtn.setAttribute("y", "4");
                        closeBtn.setAttribute("font-size", "16"); closeBtn.setAttribute("fill", "#999");
                        closeBtn.style.display = "none";
                        closeBtn.textContent = "\u00d7";
                        legendItem.appendChild(closeBtn);

                        var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                        line.setAttribute("x1", "0"); line.setAttribute("y1", "0");
                        line.setAttribute("x2", "20"); line.setAttribute("y2", "0");
                        line.setAttribute("stroke", group.color); line.setAttribute("stroke-width", "2");
                        if (lineStyle.dash) {
                            line.setAttribute("stroke-dasharray", lineStyle.dash);
                        }
                        legendItem.appendChild(line);

                        var clipId = uid + "_legend_row_clip_" + prIdx;
                        var clipPath = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
                        clipPath.setAttribute("id", clipId);
                        var clipRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                        clipRect.setAttribute("x", "25"); clipRect.setAttribute("y", "-10");
                        clipRect.setAttribute("width", inputTokenWidth - 50); clipRect.setAttribute("height", "20");
                        clipPath.appendChild(clipRect);
                        legendItem.appendChild(clipPath);

                        var text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                        text.setAttribute("x", "25"); text.setAttribute("y", "4");
                        text.setAttribute("font-size", "9"); text.setAttribute("fill", "#333");
                        text.setAttribute("clip-path", "url(#" + clipId + ")");
                        text.textContent = visualizeSpaces(rowToken);
                        legendItem.appendChild(text);

                        legendItem.addEventListener("mouseenter", function() { closeBtn.style.display = "block"; });
                        legendItem.addEventListener("mouseleave", function() { closeBtn.style.display = "none"; });
                        closeBtn.addEventListener("click", function(e) {
                            e.stopPropagation();
                            // Unpin this row
                            pinnedRows.splice(prIdx, 1);
                            buildTable(currentCellWidth, currentVisibleIndices, currentMaxRows);
                        });

                        legendG.appendChild(legendItem);
                        legendY += 14;
                    });
                } else {
                    // Standard legend: one entry per pinned group
                    pinnedGroups.forEach(function(group, groupIdx) {
                        var groupLabel = getGroupLabel(group);

                        var legendItem = document.createElementNS("http://www.w3.org/2000/svg", "g");
                        legendItem.setAttribute("transform", "translate(18, " + legendY + ")");
                        legendItem.style.cursor = "pointer";

                        var hitTarget = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                        hitTarget.setAttribute("x", "-15"); hitTarget.setAttribute("y", "-8");
                        hitTarget.setAttribute("width", inputTokenWidth - 5); hitTarget.setAttribute("height", "14");
                        hitTarget.setAttribute("fill", "transparent");
                        legendItem.appendChild(hitTarget);

                        var closeBtn = document.createElementNS("http://www.w3.org/2000/svg", "text");
                        closeBtn.setAttribute("class", "legend-close");
                        closeBtn.setAttribute("x", "-12"); closeBtn.setAttribute("y", "4");
                        closeBtn.setAttribute("font-size", "16"); closeBtn.setAttribute("fill", "#999");
                        closeBtn.style.display = "none";
                        closeBtn.textContent = "\u00d7";
                        legendItem.appendChild(closeBtn);

                        var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                        line.setAttribute("x1", "0"); line.setAttribute("y1", "0");
                        line.setAttribute("x2", "15"); line.setAttribute("y2", "0");
                        line.setAttribute("stroke", group.color); line.setAttribute("stroke-width", "2");
                        legendItem.appendChild(line);

                        var clipId = uid + "_legend_clip_" + groupIdx;
                        var clipPath = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
                        clipPath.setAttribute("id", clipId);
                        var clipRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                        clipRect.setAttribute("x", "20"); clipRect.setAttribute("y", "-10");
                        clipRect.setAttribute("width", inputTokenWidth - 45); clipRect.setAttribute("height", "20");
                        clipPath.appendChild(clipRect);
                        legendItem.appendChild(clipPath);

                        var text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                        text.setAttribute("x", "20"); text.setAttribute("y", "4");
                        text.setAttribute("font-size", "9"); text.setAttribute("fill", "#333");
                        text.setAttribute("clip-path", "url(#" + clipId + ")");
                        text.textContent = groupLabel;
                        legendItem.appendChild(text);

                        legendItem.addEventListener("mouseenter", function() { closeBtn.style.display = "block"; });
                        legendItem.addEventListener("mouseleave", function() { closeBtn.style.display = "none"; });
                        closeBtn.addEventListener("click", function(e) {
                            e.stopPropagation();
                            pinnedGroups.splice(groupIdx, 1);
                            if (lastPinnedGroupIndex >= pinnedGroups.length) {
                                lastPinnedGroupIndex = pinnedGroups.length - 1;
                            }
                            buildTable(currentCellWidth, currentVisibleIndices, currentMaxRows);
                        });

                        legendG.appendChild(legendItem);
                        legendY += 14;
                    });
                }

                // Show hover trajectory for comparison (even when rows are pinned)
                if (hoverTrajectory && hoverLabel) {
                    drawSingleTrajectory(trajG, hoverTrajectory, hoverColor || "#999", maxProb, hoverLabel, true, chartInnerWidth, "");

                    var legendItem = document.createElementNS("http://www.w3.org/2000/svg", "g");
                    legendItem.setAttribute("class", "legend-item hover-legend");
                    legendItem.setAttribute("transform", "translate(18, " + legendY + ")");

                    var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                    line.setAttribute("x1", "0"); line.setAttribute("y1", "0");
                    line.setAttribute("x2", "15"); line.setAttribute("y2", "0");
                    line.setAttribute("stroke", hoverColor || "#999");
                    line.setAttribute("stroke-width", "1.5");
                    line.setAttribute("stroke-dasharray", "4,2");
                    line.style.opacity = "0.7";
                    legendItem.appendChild(line);

                    var clipId = uid + "_hover_clip";
                    var clipPath = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
                    clipPath.setAttribute("id", clipId);
                    var clipRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                    clipRect.setAttribute("x", "20"); clipRect.setAttribute("y", "-10");
                    clipRect.setAttribute("width", inputTokenWidth - 45); clipRect.setAttribute("height", "20");
                    clipPath.appendChild(clipRect);
                    legendItem.appendChild(clipPath);

                    var text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                    text.setAttribute("x", "20"); text.setAttribute("y", "4");
                    text.setAttribute("font-size", "9"); text.setAttribute("fill", "#666");
                    text.setAttribute("clip-path", "url(#" + clipId + ")");
                    text.textContent = visualizeSpaces(hoverLabel);
                    legendItem.appendChild(text);

                    legendG.appendChild(legendItem);
                }
            }

            function drawSingleTrajectory(g, trajectory, color, maxProb, label, isHover, chartInnerWidth, dashPattern) {
                if (!trajectory || trajectory.length === 0) return;

                var chartInnerHeight = getChartInnerHeight();
                var dotRadius = isHover ? 2 : 3;
                var labelMargin = chartMargin.right;
                var usableWidth = chartInnerWidth - labelMargin;
                function layerToX(layerIdx) {
                    if (nLayers <= 1) return usableWidth / 2;
                    var visibleLayerRange = (nLayers - 1) - plotMinLayer;
                    if (visibleLayerRange <= 0) return usableWidth / 2;
                    return dotRadius + ((layerIdx - plotMinLayer) / visibleLayerRange) * (usableWidth - 2 * dotRadius);
                }

                var pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
                if (isHover) pathEl.style.opacity = "0.7";

                var d = "";
                trajectory.forEach(function(p, layerIdx) {
                    var x = layerToX(layerIdx);
                    var y = chartInnerHeight - (p / maxProb) * chartInnerHeight;
                    d += (layerIdx === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1);
                });

                pathEl.setAttribute("d", d);
                pathEl.setAttribute("fill", "none");
                pathEl.setAttribute("stroke", color);
                pathEl.setAttribute("stroke-width", isHover ? "1.5" : "2");
                // Use provided dash pattern, or default hover pattern
                if (isHover) {
                    pathEl.setAttribute("stroke-dasharray", "4,2");
                } else if (dashPattern) {
                    pathEl.setAttribute("stroke-dasharray", dashPattern);
                }
                g.appendChild(pathEl);

                currentVisibleIndices.forEach(function(layerIdx) {
                    var p = trajectory[layerIdx];
                    var x = layerToX(layerIdx);
                    var y = chartInnerHeight - (p / maxProb) * chartInnerHeight;

                    var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                    circle.setAttribute("cx", x.toFixed(1));
                    circle.setAttribute("cy", y.toFixed(1));
                    circle.setAttribute("r", isHover ? 2 : 3);
                    circle.setAttribute("fill", color);
                    if (isHover) circle.style.opacity = "0.7";

                    var title = document.createElementNS("http://www.w3.org/2000/svg", "title");
                    title.textContent = (label || "") + " L" + widgetData.layers[layerIdx] + ": " + (p * 100).toFixed(2) + "%";
                    circle.appendChild(title);
                    g.appendChild(circle);
                });
            }

            // Global event listeners
            // Use mousedown in capture phase to dismiss popups before other handlers fire
            document.addEventListener("mousedown", function(e) {
                // Check if widget still exists (may have been removed)
                var container = document.getElementById(uid);
                if (!container) return;

                var popupVisible = document.querySelector("#" + uid + " .popup.visible");
                var colorMenu = document.getElementById(uid + "_color_menu");
                var colorMenuVisible = colorMenu && colorMenu.classList.contains("visible");

                // If popup is visible and click is outside popup and close button
                if (popupVisible && !e.target.closest("#" + uid + " .popup") && !e.target.closest("#" + uid + " .pred-cell")) {
                    closePopup();
                    e.stopPropagation();
                    e.preventDefault();
                    return;
                }

                // If color menu is visible and click is outside menu and button
                if (colorMenuVisible && !e.target.closest("#" + uid + " .color-mode-btn") && !e.target.closest("#" + uid + "_color_menu")) {
                    colorMenu.classList.remove("visible");
                    justDismissedColorMenu = true; // Prevent click handler from opening popup
                    e.stopPropagation();
                    e.preventDefault();
                    return;
                }
            }, true); // capture phase

            // Click handler to reset justDismissedColorMenu flag and prevent popup
            document.addEventListener("click", function(e) {
                if (justDismissedColorMenu) {
                    justDismissedColorMenu = false;
                    e.stopPropagation();
                    e.preventDefault();
                }
            }, true); // capture phase

            document.getElementById(uid).addEventListener("mousedown", function(e) {
                if (e.shiftKey) e.preventDefault();
            });

            document.getElementById(uid).addEventListener("mouseleave", function() {
                currentHoverPos = widgetData.tokens.length - 1;
                var chartInnerWidth = updateChartDimensions();
                drawAllTrajectories(null, null, null, chartInnerWidth, currentHoverPos);
            });

            // Color picker handler
            var colorPicker = document.getElementById(uid + "_color_picker");
            colorPicker.addEventListener("input", function(e) {
                if (!colorPickerTarget) return;
                var newColor = e.target.value;
                if (colorPickerTarget.type === "trajectory") {
                    var group = pinnedGroups[colorPickerTarget.groupIdx];
                    if (group) {
                        group.color = newColor;
                        buildTable(currentCellWidth, currentVisibleIndices, currentMaxRows);
                    }
                } else if (colorPickerTarget.type === "heatmap") {
                    heatmapBaseColor = newColor;
                    buildTable(currentCellWidth, currentVisibleIndices, currentMaxRows);
                }
            });
            colorPicker.addEventListener("change", function() {
                colorPickerTarget = null;
            });

            // Helper to open color picker
            function openColorPicker(x, y, currentColor, target) {
                colorPickerTarget = target;
                colorPicker.value = currentColor;
                colorPicker.style.left = x + "px";
                colorPicker.style.top = y + "px";
                colorPicker.click();
            }

            // Bottom resize handle for truncating rows
            (function() {
                var handle = document.getElementById(uid + "_resize_bottom");
                var table = document.getElementById(uid + "_table");
                var isDragging = false, startY = 0, startMaxRows = null, measuredRowHeight = 20;

                handle.addEventListener("mousedown", function(e) {
                    closePopup();
                    isDragging = true;
                    startY = e.clientY;
                    startMaxRows = currentMaxRows;
                    // Measure actual row height from DOM (use second row to skip header)
                    var rows = table.querySelectorAll("tr");
                    if (rows.length >= 2) {
                        measuredRowHeight = rows[1].getBoundingClientRect().height;
                    }
                    handle.classList.add("dragging");
                    e.preventDefault();
                    e.stopPropagation();
                });

                document.addEventListener("mousemove", function(e) {
                    if (!isDragging) return;
                    var delta = e.clientY - startY;
                    var rowDelta = Math.round(delta / measuredRowHeight);

                    var totalTokens = widgetData.tokens.length;
                    var startRows = startMaxRows === null ? totalTokens : startMaxRows;
                    var newMaxRows = startRows + rowDelta;
                    newMaxRows = Math.max(1, Math.min(totalTokens, newMaxRows));
                    if (newMaxRows >= totalTokens) newMaxRows = null;

                    if (newMaxRows !== currentMaxRows) {
                        buildTable(currentCellWidth, currentVisibleIndices, newMaxRows);
                    }
                });

                document.addEventListener("mouseup", function() {
                    if (isDragging) {
                        isDragging = false;
                        handle.classList.remove("dragging");
                    }
                });
            })();

            // Right edge resize handle for table width
            (function() {
                var handle = document.getElementById(uid + "_resize_right");

                handle.addEventListener("mousedown", function(e) {
                    closePopup();
                    var table = document.getElementById(uid + "_table");
                    rightEdgeDrag = {
                        active: true,
                        startX: e.clientX,
                        startTableWidth: table.offsetWidth,
                        startCellWidth: currentCellWidth,
                        hadMaxTableWidth: maxTableWidth !== null,
                        startMaxTableWidth: maxTableWidth
                    };
                    handle.classList.add("dragging");
                    e.preventDefault();
                    e.stopPropagation();
                });
            })();

            // Right edge drag handler
            document.addEventListener("mousemove", function(e) {
                if (!rightEdgeDrag.active) return;
                var delta = e.clientX - rightEdgeDrag.startX;
                var actualContainerWidth = getActualContainerWidth();
                var targetTableWidth = rightEdgeDrag.startTableWidth + delta;

                if (delta >= 0) {
                    // Dragging right - expand maxTableWidth and smoothly expand column width
                    // Don't exceed container width
                    targetTableWidth = Math.min(targetTableWidth, actualContainerWidth);

                    // Snap maxTableWidth to null when close to container, otherwise set it
                    if (targetTableWidth >= actualContainerWidth - currentCellWidth) {
                        maxTableWidth = null;
                    } else {
                        maxTableWidth = targetTableWidth;
                    }

                    // Calculate new cell width to achieve target table width
                    var availableForCells = targetTableWidth - inputTokenWidth - 1;
                    var numVisibleCols = currentVisibleIndices.length;
                    if (numVisibleCols > 0) {
                        var newCellWidth = availableForCells / numVisibleCols;

                        // If cell width exceeds max, add one more column and shrink to fit
                        if (newCellWidth > maxCellWidth && numVisibleCols < nLayers) {
                            numVisibleCols = numVisibleCols + 1;
                            newCellWidth = availableForCells / numVisibleCols;
                        }

                        newCellWidth = Math.max(minCellWidth, Math.min(maxCellWidth, newCellWidth));
                        // Use a small threshold relative to cell count for smooth dragging
                        var threshold = 0.5 / Math.max(1, numVisibleCols);
                        if (Math.abs(newCellWidth - currentCellWidth) > threshold) {
                            currentCellWidth = newCellWidth;
                            var result = computeVisibleLayers(currentCellWidth, getContainerWidth());
                            buildTable(currentCellWidth, result.indices, currentMaxRows, result.stride);
                            notifyLinkedWidgets();
                        }
                    }
                } else {
                    // Dragging left - introduce maxTableWidth constraint without changing column width
                    targetTableWidth = Math.max(inputTokenWidth + minCellWidth + 1, targetTableWidth);

                    // If user drags back to or past start and didn't have maxTableWidth, abort constraint
                    if (!rightEdgeDrag.hadMaxTableWidth && targetTableWidth >= rightEdgeDrag.startTableWidth) {
                        maxTableWidth = null;
                    } else {
                        maxTableWidth = targetTableWidth;
                    }

                    // Rebuild table with constraint (may introduce strides), keep column width unchanged
                    var result = computeVisibleLayers(currentCellWidth, getContainerWidth());
                    buildTable(currentCellWidth, result.indices, currentMaxRows, result.stride);
                    notifyLinkedWidgets();
                }
            });

            // Linked widgets for column synchronization
            var linkedWidgets = [];
            var isSyncing = false;  // Prevent infinite sync loops

            function getColumnState() {
                return {
                    cellWidth: currentCellWidth,
                    inputTokenWidth: inputTokenWidth,
                    maxTableWidth: maxTableWidth
                };
            }

            function setColumnState(state, fromSync) {
                if (isSyncing) return;  // Prevent loops
                var changed = false;

                if (state.cellWidth !== undefined && state.cellWidth !== currentCellWidth) {
                    currentCellWidth = state.cellWidth;
                    changed = true;
                }
                if (state.inputTokenWidth !== undefined && state.inputTokenWidth !== inputTokenWidth) {
                    inputTokenWidth = state.inputTokenWidth;
                    changed = true;
                }
                if (state.maxTableWidth !== undefined && state.maxTableWidth !== maxTableWidth) {
                    maxTableWidth = state.maxTableWidth;
                    changed = true;
                }

                if (changed) {
                    var result = computeVisibleLayers(currentCellWidth, getContainerWidth());
                    buildTable(currentCellWidth, result.indices, currentMaxRows, result.stride);

                    // Sync to linked widgets if this wasn't triggered by a sync
                    if (!fromSync) {
                        notifyLinkedWidgets();
                    }
                }
            }

            function notifyLinkedWidgets() {
                if (isSyncing) return;
                isSyncing = true;
                var state = getColumnState();
                linkedWidgets.forEach(function(w) {
                    if (w.setColumnState) {
                        w.setColumnState(state, true);
                    }
                });
                isSyncing = false;
            }

            // Function to get current UI state for serialization
            function getState() {
                return {
                    chartHeight: chartHeight,
                    inputTokenWidth: inputTokenWidth,
                    cellWidth: currentCellWidth,
                    maxRows: currentMaxRows,
                    maxTableWidth: maxTableWidth,
                    plotMinLayer: plotMinLayer,
                    colorModes: colorModes.slice(),
                    title: customTitle,
                    colorIndex: colorIndex,
                    pinnedGroups: JSON.parse(JSON.stringify(pinnedGroups)),
                    lastPinnedGroupIndex: lastPinnedGroupIndex,
                    pinnedRows: pinnedRows.map(function(pr) {
                        return { pos: pr.pos, lineStyleName: pr.lineStyle.name };
                    }),
                    heatmapBaseColor: heatmapBaseColor,
                    heatmapNextColor: heatmapNextColor
                };
            }

            // Initial build with container width
            var containerWidth = getContainerWidth();
            var result = computeVisibleLayers(currentCellWidth, containerWidth);
            buildTable(currentCellWidth, result.indices, currentMaxRows, result.stride);

            // Apply restored chart height to SVG element
            var svg = document.getElementById(uid + "_chart");
            if (svg) {
                svg.setAttribute("height", chartHeight);
            }

            // Build the public interface object that will be returned
            // This same object is used for linking, so references are consistent
            var publicInterface = {
                uid: uid,
                getState: getState,
                getColumnState: getColumnState,
                setColumnState: setColumnState,
                linkColumnsTo: function(otherWidget) {
                    if (linkedWidgets.indexOf(otherWidget) < 0) {
                        linkedWidgets.push(otherWidget);
                    }
                    // Also link the other direction using our public interface
                    if (otherWidget.linkColumnsTo) {
                        var otherLinked = otherWidget._getLinkedWidgets ? otherWidget._getLinkedWidgets() : [];
                        if (otherLinked.indexOf(publicInterface) < 0) {
                            otherWidget.linkColumnsTo(publicInterface);
                        }
                    }
                    // Sync current state to the other widget
                    otherWidget.setColumnState(getColumnState(), true);
                },
                unlinkColumns: function(otherWidget) {
                    var idx = linkedWidgets.indexOf(otherWidget);
                    if (idx >= 0) {
                        linkedWidgets.splice(idx, 1);
                    }
                },
                _getLinkedWidgets: function() { return linkedWidgets; }
            };

            return publicInterface;
        })();

        return widgetInterface;
    };
})();

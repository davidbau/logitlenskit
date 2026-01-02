#!/usr/bin/env node
/**
 * Generates data flow graph from git history for visualization.
 * Shows function <-> state variable relationships (reads/writes).
 *
 * Usage: node build/build-dataflow.js
 * Output: coverage/dataflow-data.js, coverage/dataflow.html
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const REPO_NAME = 'davidbau/logitlenskit';
const SOURCE_FILE = 'js/src/logit-lens-widget.js';

// Use acorn-loose for more forgiving parsing
let acornLoose;
try {
  acornLoose = require('acorn-loose');
} catch (e) {
  console.error('acorn-loose not found, installing...');
  execSync('npm install acorn-loose', { stdio: 'inherit' });
  acornLoose = require('acorn-loose');
}

// Convert character offset to line number
function offsetToLine(offset, lineOffsets) {
  for (let i = 0; i < lineOffsets.length; i++) {
    if (offset < lineOffsets[i]) {
      return i;
    }
  }
  return lineOffsets.length;
}

// Build array of line start offsets
function buildLineOffsets(text) {
  const offsets = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      offsets.push(i + 1);
    }
  }
  return offsets;
}

// Parse JavaScript and extract data flow graph
function extractDataFlow(js) {
  const functions = new Map(); // name -> { reads: Set, writes: Set, line: number }
  const stateVars = new Map(); // name -> { line: number, readers: Set, writers: Set }

  const lineOffsets = buildLineOffsets(js);

  let ast;
  try {
    ast = acornLoose.parse(js, {
      ecmaVersion: 2022,
      sourceType: 'script',
      allowHashBang: true,
      locations: true
    });
  } catch (e) {
    console.warn('Parse error:', e.message);
    return { nodes: [], edges: [] };
  }

  // First pass: collect all closure-level variable declarations (state)
  // Track depth relative to IIFEs to find variables that persist across function calls
  function collectStateVars(node, iifeDepth = 0, insideNamedFunc = false) {
    if (!node || typeof node !== 'object') return;

    // Track if we're entering an IIFE (resets scope)
    let newIifeDepth = iifeDepth;
    let newInsideNamedFunc = insideNamedFunc;

    // Detect IIFE: (function() { ... })() or (() => { ... })()
    if (node.type === 'CallExpression' && node.callee &&
        (node.callee.type === 'FunctionExpression' || node.callee.type === 'ArrowFunctionExpression')) {
      newIifeDepth = iifeDepth + 1;
      newInsideNamedFunc = false; // IIFE creates new closure scope
    }

    // Detect named function (not IIFE) - variables inside are local, not state
    if ((node.type === 'FunctionDeclaration' && node.id?.name) ||
        (node.type === 'FunctionExpression' && node.id?.name)) {
      newInsideNamedFunc = true;
    }

    // Collect variable declarations at IIFE scope (not inside named functions)
    // These are the "state" variables that persist across calls
    if (node.type === 'VariableDeclaration' && newIifeDepth > 0 && !newInsideNamedFunc) {
      for (const decl of node.declarations || []) {
        if (decl.id?.type === 'Identifier') {
          const varName = decl.id.name;
          const isConst = node.kind === 'const';

          // Skip if it's a function/class definition
          const isFunc = decl.init?.type === 'FunctionExpression' ||
                        decl.init?.type === 'ArrowFunctionExpression' ||
                        decl.init?.type === 'ClassExpression';
          // Skip loop variables and very short names (likely iterators)
          const isIterator = varName.length <= 2 && /^[ijklmn]$/.test(varName);
          // Skip temporary variables (declared inside blocks)
          const isTemp = varName.startsWith('_') || varName === 'temp' || varName === 'tmp';

          if (!isFunc && !isIterator && !isTemp) {
            const loc = decl.start || 0;
            const line = decl.loc?.start?.line || offsetToLine(loc, lineOffsets);
            stateVars.set(varName, {
              line,
              isConst,
              readers: new Set(),
              writers: new Set()
            });
          }
        }
      }
    }

    // Recurse into children
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'range') continue;
      const child = node[key];

      if (Array.isArray(child)) {
        child.forEach(c => collectStateVars(c, newIifeDepth, newInsideNamedFunc));
      } else if (child && typeof child === 'object') {
        collectStateVars(child, newIifeDepth, newInsideNamedFunc);
      }
    }
  }

  collectStateVars(ast);

  // Second pass: collect functions and their reads/writes
  function collectFunctions(node, currentFunc = null, depth = 0) {
    if (!node || typeof node !== 'object') return;

    // Detect function definitions
    let funcName = null;
    if (node.type === 'FunctionDeclaration' && node.id?.name) {
      funcName = node.id.name;
    } else if (node.type === 'MethodDefinition' && node.key?.name) {
      funcName = node.key.name;
    } else if ((node.type === 'Property' || node.type === 'MethodDefinition') &&
               node.key?.name &&
               (node.value?.type === 'FunctionExpression' || node.value?.type === 'ArrowFunctionExpression')) {
      funcName = node.key.name;
    } else if (node.type === 'VariableDeclarator' && node.id?.name &&
               (node.init?.type === 'FunctionExpression' || node.init?.type === 'ArrowFunctionExpression')) {
      funcName = node.id.name;
    }

    if (funcName && !functions.has(funcName)) {
      const loc = node.start || 0;
      const line = node.loc?.start?.line || offsetToLine(loc, lineOffsets);
      functions.set(funcName, {
        reads: new Set(),
        writes: new Set(),
        line
      });
    }

    const activeFunc = funcName || currentFunc;

    // Track reads and writes if we're inside a function
    if (activeFunc && functions.has(activeFunc)) {
      const funcData = functions.get(activeFunc);

      // Detect writes: assignments to state variables
      if (node.type === 'AssignmentExpression' && node.left?.type === 'Identifier') {
        const varName = node.left.name;
        if (stateVars.has(varName)) {
          funcData.writes.add(varName);
          stateVars.get(varName).writers.add(activeFunc);
        }
      }

      // Detect writes: update expressions (++, --)
      if (node.type === 'UpdateExpression' && node.argument?.type === 'Identifier') {
        const varName = node.argument.name;
        if (stateVars.has(varName)) {
          funcData.writes.add(varName);
          stateVars.get(varName).writers.add(activeFunc);
        }
      }

      // Detect writes: array methods that mutate (push, pop, splice, etc.)
      if (node.type === 'CallExpression' &&
          node.callee?.type === 'MemberExpression' &&
          node.callee.object?.type === 'Identifier') {
        const varName = node.callee.object.name;
        const methodName = node.callee.property?.name;
        const mutatingMethods = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill'];
        if (stateVars.has(varName) && mutatingMethods.includes(methodName)) {
          funcData.writes.add(varName);
          stateVars.get(varName).writers.add(activeFunc);
        }
      }

      // Detect reads: identifier references to state variables
      if (node.type === 'Identifier' && stateVars.has(node.name)) {
        // Check if this is a read (not left side of assignment)
        funcData.reads.add(node.name);
        stateVars.get(node.name).readers.add(activeFunc);
      }
    }

    // Recurse into children
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'range') continue;
      const child = node[key];

      if (Array.isArray(child)) {
        child.forEach(c => collectFunctions(c, activeFunc, depth + 1));
      } else if (child && typeof child === 'object') {
        collectFunctions(child, activeFunc, depth + 1);
      }
    }
  }

  collectFunctions(ast);

  // Build nodes and edges
  const nodes = [];
  const edges = [];

  // Add function nodes
  for (const [name, data] of functions) {
    // Only include functions that interact with state
    if (data.reads.size > 0 || data.writes.size > 0) {
      nodes.push({
        id: name,
        type: 'function',
        line: data.line,
        readCount: data.reads.size,
        writeCount: data.writes.size
      });
    }
  }

  // Add state variable nodes (only those that are accessed)
  for (const [name, data] of stateVars) {
    if (data.readers.size > 0 || data.writers.size > 0) {
      nodes.push({
        id: name,
        type: 'state',
        line: data.line,
        isConst: data.isConst,
        readerCount: data.readers.size,
        writerCount: data.writers.size
      });
    }
  }

  // Add edges
  for (const [funcName, funcData] of functions) {
    // Read edges (function -> state)
    for (const varName of funcData.reads) {
      if (stateVars.has(varName) && (stateVars.get(varName).readers.size > 0 || stateVars.get(varName).writers.size > 0)) {
        edges.push({
          source: funcName,
          target: varName,
          type: 'read'
        });
      }
    }
    // Write edges (function -> state)
    for (const varName of funcData.writes) {
      if (stateVars.has(varName)) {
        edges.push({
          source: funcName,
          target: varName,
          type: 'write'
        });
      }
    }
  }

  // Deduplicate edges (a function might read and write the same var)
  const edgeSet = new Map();
  for (const edge of edges) {
    const key = `${edge.source}|${edge.target}|${edge.type}`;
    edgeSet.set(key, edge);
  }

  return {
    nodes,
    edges: Array.from(edgeSet.values()),
    funcCount: functions.size,
    stateCount: stateVars.size
  };
}

// Get repository root directory
function getRepoRoot() {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch (e) {
    return process.cwd();
  }
}

// Get file content at a specific commit
function getFileAtCommit(commitHash, filePath, repoRoot) {
  try {
    return execSync(`git show ${commitHash}:${filePath}`, {
      encoding: 'utf-8',
      cwd: repoRoot,
      maxBuffer: 10 * 1024 * 1024
    });
  } catch (e) {
    return null;
  }
}

// Get list of commits that touched the source file
function getCommitHistory(filePath, repoRoot) {
  try {
    const output = execSync(
      `git log --format="%H|%ad|%s|%an|%ae" --date=short --follow -- "${filePath}"`,
      { encoding: 'utf-8', cwd: repoRoot, maxBuffer: 10 * 1024 * 1024 }
    );
    return output.trim().split('\n').filter(Boolean).map(line => {
      const [hash, date, message, authorName, authorEmail] = line.split('|');
      return { hash, date, message: message || '', authorName, authorEmail };
    }).reverse();
  } catch (e) {
    console.error('Error getting commit history:', e.message);
    return [];
  }
}

// Detect AI co-authors from commit message or trailers
function getCoauthorFlags(commitHash, repoRoot) {
  try {
    const fullMessage = execSync(`git log -1 --format="%B" ${commitHash}`, {
      encoding: 'utf-8',
      cwd: repoRoot
    }).toLowerCase();

    return {
      claudeCoauthored: fullMessage.includes('claude') || fullMessage.includes('anthropic'),
      geminiCoauthored: fullMessage.includes('gemini') || fullMessage.includes('google'),
      codexCoauthored: fullMessage.includes('codex') || fullMessage.includes('openai') || fullMessage.includes('copilot')
    };
  } catch (e) {
    return { claudeCoauthored: false, geminiCoauthored: false, codexCoauthored: false };
  }
}

// Main execution
function main() {
  console.log('Extracting data flow history...');

  const repoRoot = getRepoRoot();
  const commits = getCommitHistory(SOURCE_FILE, repoRoot);
  console.log(`Found ${commits.length} commits`);

  if (commits.length === 0) {
    console.error('No commits found');
    process.exit(1);
  }

  const snapshots = [];

  for (let i = 0; i < commits.length; i++) {
    const commit = commits[i];
    process.stdout.write(`Processing ${i + 1}/${commits.length}: ${commit.date} ${commit.hash.slice(0, 7)}`);

    const content = getFileAtCommit(commit.hash, SOURCE_FILE, repoRoot);
    if (!content) {
      console.log(' (no file)');
      continue;
    }

    const { nodes, edges, funcCount, stateCount } = extractDataFlow(content);
    const coauthorFlags = getCoauthorFlags(commit.hash, repoRoot);

    const lineCount = content.split('\n').length;

    snapshots.push({
      hash: commit.hash.slice(0, 7),
      date: commit.date,
      message: commit.message.slice(0, 80),
      ...coauthorFlags,
      lineCount,
      funcCount,
      stateCount,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodes,
      edges
    });

    console.log(` - ${nodes.length} nodes, ${edges.length} edges`);
  }

  // Write output
  const coverageDir = path.join(__dirname, '..', 'coverage');
  if (!fs.existsSync(coverageDir)) {
    fs.mkdirSync(coverageDir, { recursive: true });
  }

  // Copy HTML template
  const htmlSource = path.join(__dirname, 'dataflow.html');
  const htmlDest = path.join(coverageDir, 'dataflow.html');
  if (fs.existsSync(htmlSource)) {
    fs.copyFileSync(htmlSource, htmlDest);
  }

  // Write data as JSONP
  const data = { snapshots };
  const jsonp = `window.dataflowData = ${JSON.stringify(data)};`;
  const outputPath = path.join(coverageDir, 'dataflow-data.js');
  fs.writeFileSync(outputPath, jsonp);

  console.log(`\nWritten ${outputPath}: ${snapshots.length} snapshots`);

  if (snapshots.length > 0) {
    const last = snapshots[snapshots.length - 1];
    console.log(`Final graph: ${last.nodeCount} nodes (${last.funcCount} functions, ${last.stateCount} state vars), ${last.edgeCount} edges`);
  }
}

main();

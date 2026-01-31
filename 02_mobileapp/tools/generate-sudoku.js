#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

// Base solved Sudoku (valid)
const SOLUTION_BASE = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

function clone9(g) {
  return g.map((row) => row.slice());
}

function hashStringToInt(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function rngFromSeed(seed) {
  return lcg(hashStringToInt(String(seed)));
}

function shuffleInPlace(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
}

function permuteSolutionFromSeed(seed) {
  const rand = rngFromSeed(seed);

  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  shuffleInPlace(digits, rand);
  const digitMap = new Map();
  for (let i = 0; i < 9; i++) digitMap.set(i + 1, digits[i]);

  const bandOrder = [0, 1, 2];
  shuffleInPlace(bandOrder, rand);
  const rowOrder = [];
  for (const b of bandOrder) {
    const rows = [0, 1, 2];
    shuffleInPlace(rows, rand);
    for (const r of rows) rowOrder.push(b * 3 + r);
  }

  const stackOrder = [0, 1, 2];
  shuffleInPlace(stackOrder, rand);
  const colOrder = [];
  for (const s of stackOrder) {
    const cols = [0, 1, 2];
    shuffleInPlace(cols, rand);
    for (const c of cols) colOrder.push(s * 3 + c);
  }

  const transpose = rand() < 0.5;
  const out = Array.from({ length: 9 }, () => Array(9).fill(0));

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const baseVal = SOLUTION_BASE[rowOrder[r]][colOrder[c]];
      const v = digitMap.get(baseVal) || baseVal;
      if (transpose) out[c][r] = v;
      else out[r][c] = v;
    }
  }
  return out;
}

function makeMask(seed, clues) {
  const rand = rngFromSeed(seed);
  const total = 81;
  const keep = Math.max(0, Math.min(total, clues));
  const indices = Array.from({ length: total }, (_, i) => i);
  shuffleInPlace(indices, rand);
  const mask = Array(total).fill('0');
  for (let i = 0; i < keep; i++) mask[indices[i]] = '1';
  return mask.join('');
}

function buildPuzzleFromSeedAndMask(seed, mask) {
  const solution = permuteSolutionFromSeed(seed);
  const puzzle = clone9(solution);
  for (let i = 0; i < 81; i++) {
    if (mask[i] !== '1') puzzle[Math.floor(i / 9)][i % 9] = 0;
  }
  return puzzle;
}

function isValid(grid, r, c, n) {
  for (let i = 0; i < 9; i++) {
    if (grid[r][i] === n) return false;
    if (grid[i][c] === n) return false;
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let rr = br; rr < br + 3; rr++) {
    for (let cc = bc; cc < bc + 3; cc++) {
      if (grid[rr][cc] === n) return false;
    }
  }
  return true;
}

function findBestEmpty(grid) {
  let best = null;
  let bestCandidates = null;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] !== 0) continue;
      const candidates = [];
      for (let n = 1; n <= 9; n++) {
        if (isValid(grid, r, c, n)) candidates.push(n);
      }
      if (candidates.length === 0) return { r, c, candidates };
      if (!best || candidates.length < bestCandidates.length) {
        best = { r, c };
        bestCandidates = candidates;
        if (candidates.length === 1) return { r, c, candidates };
      }
    }
  }
  if (!best) return null;
  return { r: best.r, c: best.c, candidates: bestCandidates };
}

function countSolutions(grid, limit) {
  const cell = findBestEmpty(grid);
  if (!cell) return 1;
  if (cell.candidates.length === 0) return 0;
  let count = 0;
  for (const n of cell.candidates) {
    grid[cell.r][cell.c] = n;
    count += countSolutions(grid, limit);
    if (count >= limit) {
      grid[cell.r][cell.c] = 0;
      return count;
    }
    grid[cell.r][cell.c] = 0;
  }
  return count;
}

function generateSet(label, clues, count, maxTries) {
  const results = [];
  const seen = new Set();
  let tries = 0;
  while (results.length < count && tries < maxTries) {
    tries++;
    const seed = `${label}-${tries}-${Math.floor(Math.random() * 1e9)}`;
    const mask = makeMask(`${seed}-mask`, clues);
    const key = `${seed}|${mask}`;
    if (seen.has(key)) continue;
    const puzzle = buildPuzzleFromSeedAndMask(seed, mask);
    const solutions = countSolutions(clone9(puzzle), 2);
    if (solutions === 1) {
      seen.add(key);
      results.push({ seed, mask, clues });
      console.log(`[${label}] ${results.length}/${count} ok (tries ${tries})`);
    }
  }
  if (results.length < count) {
    throw new Error(`Not enough unique puzzles for ${label}. Got ${results.length}/${count}.`);
  }
  return results;
}

function main() {
  const easy = generateSet('E', 42, 10, 5000);
  const medium = generateSet('M', 36, 10, 8000);
  const hard = generateSet('H', 30, 10, 12000);

  const out = { easy, medium, hard };
  const outPath = path.join(__dirname, 'puzzles.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${outPath}`);
}

main();

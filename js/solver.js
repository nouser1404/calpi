// js/solver.js

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

function gcdArray(arr) {
  return arr.reduce((g, x) => gcd(g, x), arr[0]);
}

function parseModules(text) {
  const parts = String(text || "").split(/[,; ]+/).filter(Boolean);
  const values = [];
  for (const p of parts) {
    const v = parseInt(p, 10);
    if (isNaN(v) || v <= 0) return null;
    values.push(v);
  }
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

// Horizontal: meilleure longueur <= mur, gap minimal, modules min
function solveOptimalCombination(wallLength, moduleWidths) {
  if (wallLength <= 0 || !moduleWidths || moduleWidths.length === 0) return null;

  const step = gcdArray(moduleWidths);
  const widthsUnits = moduleWidths.map(w => w / step);
  const wallUnits = Math.floor(wallLength / step);
  if (wallUnits <= 0) return null;

  const dp = new Array(wallUnits + 1).fill(null);
  dp[0] = { count: 0, counts: new Array(moduleWidths.length).fill(0), totalUnits: 0 };

  for (let i = 1; i <= wallUnits; i++) {
    let best = null;
    for (let j = 0; j < widthsUnits.length; j++) {
      const w = widthsUnits[j];
      if (i - w >= 0 && Number.isInteger(i - w)) {
        const prev = dp[i - w];
        if (!prev) continue;
        const candidateCount = prev.count + 1;
        if (!best || candidateCount < best.count) {
          const newCounts = prev.counts.slice();
          newCounts[j]++;
          best = { count: candidateCount, counts: newCounts, totalUnits: i };
        }
      }
    }
    dp[i] = best;
  }

  let bestSolution = null;
  let bestGap = Infinity;

  for (let i = 0; i <= wallUnits; i++) {
    const sol = dp[i];
    if (!sol) continue;
    const lenMm = sol.totalUnits * step;
    if (lenMm > wallLength) continue;
    const gap = wallLength - lenMm;
    if (!bestSolution || gap < bestGap || (gap === bestGap && sol.count < bestSolution.solution.count)) {
      bestGap = gap;
      bestSolution = { solution: sol, totalLength: lenMm, gap };
    }
  }

  if (!bestSolution) {
    return {
      moduleWidths,
      wallLength,
      solution: { count: 0, counts: new Array(moduleWidths.length).fill(0), totalUnits: 0 },
      totalLength: 0,
      gap: wallLength
    };
  }

  return {
    moduleWidths,
    wallLength,
    solution: bestSolution.solution,
    totalLength: bestSolution.totalLength,
    gap: bestSolution.gap
  };
}

// Vertical: meilleure hauteur <= cible, gap minimal, étages min
function solveVerticalComposition(targetHeightMm, rawHeights) {
  if (!targetHeightMm || targetHeightMm <= 0) return null;

  let heights = (rawHeights && rawHeights.length ? rawHeights : [320])
    .filter(h => h > 0 && h <= 320)
    .sort((a, b) => a - b);
  if (heights.length === 0) heights = [320];

  const step = gcdArray(heights);
  const heightsUnits = heights.map(h => h / step);
  const targetUnits = Math.floor(targetHeightMm / step);

  const dp = new Array(targetUnits + 1).fill(null);
  dp[0] = { count: 0, counts: new Array(heights.length).fill(0), totalUnits: 0 };

  for (let i = 1; i <= targetUnits; i++) {
    let best = null;
    for (let j = 0; j < heightsUnits.length; j++) {
      const h = heightsUnits[j];
      if (i - h >= 0 && Number.isInteger(i - h)) {
        const prev = dp[i - h];
        if (!prev) continue;
        const candidateCount = prev.count + 1;
        if (!best || candidateCount < best.count) {
          const newCounts = prev.counts.slice();
          newCounts[j]++;
          best = { count: candidateCount, counts: newCounts, totalUnits: i };
        }
      }
    }
    dp[i] = best;
  }

  let bestSolution = null;
  let bestGap = Infinity;

  for (let i = 0; i <= targetUnits; i++) {
    const sol = dp[i];
    if (!sol) continue;
    const lenMm = sol.totalUnits * step;
    if (lenMm > targetHeightMm) continue;
    const gap = targetHeightMm - lenMm;
    if (!bestSolution || gap < bestGap || (gap === bestGap && sol.count < bestSolution.solution.count)) {
      bestGap = gap;
      bestSolution = { solution: sol, totalHeightMm: lenMm, gap };
    }
  }

  if (!bestSolution) {
    return { rowHeights: [heights[0]], realHeightMm: heights[0], targetHeightMm };
  }

  const rowHeights = [];
  heights.forEach((h, idx) => {
    const q = bestSolution.solution.counts[idx];
    for (let k = 0; k < q; k++) rowHeights.push(h);
  });
  if (rowHeights.length === 0) rowHeights.push(heights[0]);

  return { rowHeights, realHeightMm: bestSolution.totalHeightMm, targetHeightMm };
}

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
// Options:
// - maxGapMm: number | null  -> si défini, ignore les solutions dont le gap est supérieur
// - preferLargerModules: boolean -> à gap et count égaux, favorise les modules les plus grands
function solveOptimalCombination(wallLength, moduleWidths, options = {}) {
  if (wallLength <= 0 || !moduleWidths || moduleWidths.length === 0) return null;

  const { maxGapMm = null, preferLargerModules = true } = options || {};

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

  // score: favorise l'utilisation de modules plus grands (indices plus élevés)
  function largerModulesScore(counts) {
    let score = 0;
    for (let idx = 0; idx < counts.length; idx++) score += counts[idx] * idx;
    return score;
  }

  let bestSolution = null;
  let bestGap = Infinity;

  for (let i = 0; i <= wallUnits; i++) {
    const sol = dp[i];
    if (!sol) continue;
    const lenMm = sol.totalUnits * step;
    if (lenMm > wallLength) continue;

    const gap = wallLength - lenMm;
    if (maxGapMm != null && gap > maxGapMm) continue;

    if (!bestSolution) {
      bestGap = gap;
      bestSolution = { solution: sol, totalLength: lenMm, gap };
      continue;
    }

    const bestCount = bestSolution.solution.count;
    const candidateBetterGap = gap < bestGap;
    const candidateEqualGap = gap === bestGap;
    const candidateBetterCount = sol.count < bestCount;
    const candidateEqualCount = sol.count === bestCount;

    let shouldReplace = false;

    if (candidateBetterGap) {
      shouldReplace = true;
    } else if (candidateEqualGap && candidateBetterCount) {
      shouldReplace = true;
    } else if (candidateEqualGap && candidateEqualCount && preferLargerModules) {
      const candScore = largerModulesScore(sol.counts);
      const bestScore = largerModulesScore(bestSolution.solution.counts);
      if (candScore > bestScore) shouldReplace = true;
    }

    if (shouldReplace) {
      bestGap = gap;
      bestSolution = { solution: sol, totalLength: lenMm, gap };
    }
  }

  // Construit la liste "dépliée" des modules pour affichage
  function expandModules(widths, counts) {
    const expanded = [];
    for (let idx = 0; idx < widths.length; idx++) {
      for (let k = 0; k < counts[idx]; k++) expanded.push(widths[idx]);
    }
    // Tri décroissant pour lecture plus agréable (les plus grands d'abord)
    return expanded.sort((a, b) => b - a);
  }

  if (!bestSolution) {
    const emptyCounts = new Array(moduleWidths.length).fill(0);
    return {
      moduleWidths,
      wallLength,
      options: { maxGapMm, preferLargerModules },
      possible: true,
      solution: { count: 0, counts: emptyCounts, totalUnits: 0 },
      expandedModules: [],
      totalLength: 0,
      gap: wallLength
    };
  }

  return {
    moduleWidths,
    wallLength,
    options: { maxGapMm, preferLargerModules },
    possible: true,
    solution: bestSolution.solution,
    expandedModules: expandModules(moduleWidths, bestSolution.solution.counts),
    totalLength: bestSolution.totalLength,
    gap: bestSolution.gap
  };
}

// Vertical: meilleure hauteur <= cible, gap minimal, étages min
// Options:
// - maxGapMm: number | null  -> si défini, ignore les solutions dont le gap est supérieur
// - preferTallerRows: boolean -> à gap et count égaux, favorise les hauteurs les plus grandes
function solveVerticalComposition(targetHeightMm, rawHeights, options = {}) {
  if (!targetHeightMm || targetHeightMm <= 0) return null;

  const { maxGapMm = null, preferTallerRows = true } = options || {};

  let heights = (rawHeights && rawHeights.length ? rawHeights : [320])
    .filter(h => h > 0 && h <= 320)
    .sort((a, b) => a - b);
  if (heights.length === 0) heights = [320];

  const minH = heights[0];
  if (targetHeightMm < minH) {
    // Impossible d'ajouter une rangée sans dépasser la cible
    return {
      rowHeights: [],
      realHeightMm: 0,
      targetHeightMm,
      gap: targetHeightMm,
      possible: false,
      options: { maxGapMm, preferTallerRows }
    };
  }

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

  function tallerRowsScore(counts) {
    let score = 0;
    for (let idx = 0; idx < counts.length; idx++) score += counts[idx] * idx;
    return score;
  }

  let bestSolution = null;
  let bestGap = Infinity;

  for (let i = 0; i <= targetUnits; i++) {
    const sol = dp[i];
    if (!sol) continue;
    const lenMm = sol.totalUnits * step;
    if (lenMm > targetHeightMm) continue;

    const gap = targetHeightMm - lenMm;
    if (maxGapMm != null && gap > maxGapMm) continue;

    if (!bestSolution) {
      bestGap = gap;
      bestSolution = { solution: sol, totalHeightMm: lenMm, gap };
      continue;
    }

    const bestCount = bestSolution.solution.count;
    const candidateBetterGap = gap < bestGap;
    const candidateEqualGap = gap === bestGap;
    const candidateBetterCount = sol.count < bestCount;
    const candidateEqualCount = sol.count === bestCount;

    let shouldReplace = false;

    if (candidateBetterGap) {
      shouldReplace = true;
    } else if (candidateEqualGap && candidateBetterCount) {
      shouldReplace = true;
    } else if (candidateEqualGap && candidateEqualCount && preferTallerRows) {
      const candScore = tallerRowsScore(sol.counts);
      const bestScore = tallerRowsScore(bestSolution.solution.counts);
      if (candScore > bestScore) shouldReplace = true;
    }

    if (shouldReplace) {
      bestGap = gap;
      bestSolution = { solution: sol, totalHeightMm: lenMm, gap };
    }
  }

  // Si aucune solution n'est trouvée dans les contraintes, renvoyer une compo minimale valide
  if (!bestSolution) {
    // La rangée minimale est <= targetHeightMm (car on a déjà vérifié target >= minH)
    return {
      rowHeights: [minH],
      realHeightMm: minH,
      targetHeightMm,
      gap: targetHeightMm - minH,
      possible: true,
      options: { maxGapMm, preferTallerRows }
    };
  }

  const rowHeights = [];
  heights.forEach((h, idx) => {
    const q = bestSolution.solution.counts[idx];
    for (let k = 0; k < q; k++) rowHeights.push(h);
  });
  if (rowHeights.length === 0) rowHeights.push(minH);

  // Tri décroissant pour affichage (les plus grands d'abord)
  rowHeights.sort((a, b) => b - a);

  return {
    rowHeights,
    realHeightMm: bestSolution.totalHeightMm,
    targetHeightMm,
    gap: bestSolution.gap,
    possible: true,
    options: { maxGapMm, preferTallerRows }
  };
}

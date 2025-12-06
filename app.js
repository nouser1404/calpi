// --- ÉTAT GLOBAL ---
let currentResult = null;      // { wallLength, moduleWidths }
let currentLayoutModules = []; // [{ width, index }]

// ----- UTILITAIRES -----

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
  const parts = text.split(/[,; ]+/).filter(Boolean);
  const widths = [];
  for (const p of parts) {
    const v = parseInt(p, 10);
    if (isNaN(v) || v <= 0) return null;
    widths.push(v);
  }
  const unique = Array.from(new Set(widths)).sort((a, b) => a - b);
  return unique;
}

// ----- SOLVEUR : COMBINAISON HORIZONTALE OPTIMALE ≤ mur -----

function solveOptimalCombination(wallLength, moduleWidths) {
  if (wallLength <= 0 || moduleWidths.length === 0) return null;

  const step = gcdArray(moduleWidths);
  const widthsUnits = moduleWidths.map(w => w / step);
  const wallUnits = Math.floor(wallLength / step);
  if (wallUnits <= 0) return null;

  const dp = new Array(wallUnits + 1).fill(null);
  dp[0] = {
    count: 0,
    counts: new Array(moduleWidths.length).fill(0),
    totalUnits: 0
  };

  for (let i = 1; i <= wallUnits; i++) {
    let best = null;
    for (let j = 0; j < widthsUnits.length; j++) {
      const w = widthsUnits[j];
      if (i - w >= 0 && Number.isInteger(i - w)) {
        const prev = dp[i - w];
        if (prev) {
          const candidateCount = prev.count + 1;
          if (!best || candidateCount < best.count) {
            const newCounts = prev.counts.slice();
            newCounts[j]++;
            best = {
              count: candidateCount,
              counts: newCounts,
              totalUnits: i
            };
          }
        }
      }
    }
    dp[i] = best;
  }

  let bestSolution = null;
  let bestGap = Infinity;

  for (let i = 1; i <= wallUnits; i++) {
    const sol = dp[i];
    if (!sol) continue;
    const lenMm = sol.totalUnits * step;
    if (lenMm > wallLength) continue;
    const gap = wallLength - lenMm;
    if (!bestSolution || gap < bestGap || (gap === bestGap && sol.count < bestSolution.solution.count)) {
      bestGap = gap;
      bestSolution = {
        solution: sol,
        totalLength: lenMm,
        gap
      };
    }
  }

  if (!bestSolution) {
    // Aucun module ne tient
    return {
      moduleWidths,
      wallLength,
      solution: {
        count: 0,
        counts: new Array(moduleWidths.length).fill(0),
        totalUnits: 0
      },
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

// ----- SOLVEUR VERTICAL : COMBINAISON D'ÉTAGES ≤ hauteur corps -----

function solveVerticalComposition(targetHeightMm, rawHeights) {
  if (!targetHeightMm || targetHeightMm <= 0) return null;

  // Nettoyage : hauteurs >0 et ≤ 320
  let heights = (rawHeights && rawHeights.length ? rawHeights : [320])
    .filter(h => h > 0 && h <= 320)
    .sort((a, b) => a - b);

  if (heights.length === 0) heights = [320];

  const step = gcdArray(heights);
  const heightsUnits = heights.map(h => h / step);
  const targetUnits = Math.floor(targetHeightMm / step);

  if (targetUnits <= 0) {
    // au moins un étage de la plus petite hauteur
    return { rowHeights: [heights[0]], realHeightMm: heights[0], targetHeightMm };
  }

  const dp = new Array(targetUnits + 1).fill(null);
  dp[0] = {
    count: 0,
    counts: new Array(heights.length).fill(0),
    totalUnits: 0
  };

  for (let i = 1; i <= targetUnits; i++) {
    let best = null;
    for (let j = 0; j < heightsUnits.length; j++) {
      const h = heightsUnits[j];
      if (i - h >= 0 && Number.isInteger(i - h)) {
        const prev = dp[i - h];
        if (prev) {
          const candidateCount = prev.count + 1;
          if (!best || candidateCount < best.count) {
            const newCounts = prev.counts.slice();
            newCounts[j]++;
            best = {
              count: candidateCount,
              counts: newCounts,
              totalUnits: i
            };
          }
        }
      }
    }
    dp[i] = best;
  }

  let bestSolution = null;
  let bestGap = Infinity;

  for (let i = 1; i <= targetUnits; i++) {
    const sol = dp[i];
    if (!sol) continue;
    const lenMm = sol.totalUnits * step;
    if (lenMm > targetHeightMm) continue;
    const gap = targetHeightMm - lenMm;
    if (!bestSolution || gap < bestGap || (gap === bestGap && sol.count < bestSolution.solution.count)) {
      bestGap = gap;
      bestSolution = {
        solution: sol,
        totalHeightMm: lenMm,
        gap
      };
    }
  }

  if (!bestSolution) {
    // aucun combo sous la hauteur : on met un étage minimal
    return { rowHeights: [heights[0]], realHeightMm: heights[0], targetHeightMm };
  }

  const rowHeights = [];
  heights.forEach((h, idx) => {
    const q = bestSolution.solution.counts[idx];
    for (let k = 0; k < q; k++) rowHeights.push(h);
  });

  if (rowHeights.length === 0) rowHeights.push(heights[0]);

  return {
    rowHeights,
    realHeightMm: bestSolution.totalHeightMm,
    targetHeightMm
  };
}

// ----- METRIQUES À PARTIR DU LAYOUT ACTUEL -----

function computeMetrics() {
  if (!currentResult) return null;
  const wallLength = currentResult.wallLength;
  const moduleWidths = currentResult.moduleWidths;
  const totalLength = currentLayoutModules.reduce((s, m) => s + m.width, 0);
  const gap = Math.max(0, wallLength - totalLength);
  const counts = moduleWidths.map(w =>
    currentLayoutModules.filter(m => m.width === w).length
  );
  const countTotal = currentLayoutModules.length;
  return { wallLength, moduleWidths, totalLength, gap, counts, countTotal };
}

// ----- VISUEL 1D (DRAG & DROP) -----

function render1DBar(container, layoutModules, totalLength) {
  container.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "visual-wrapper";

  const bar = document.createElement("div");
  bar.className = "visual-bar";
  bar.id = "visual-bar-draggable";

  layoutModules.forEach((mod, idx) => {
    const div = document.createElement("div");
    div.className = "module-block module-color-" + (mod.index % 7);
    div.draggable = true;
    div.dataset.idx = String(idx);
    div.style.flexGrow = String(mod.width);
    div.textContent = mod.width + " mm";
    bar.appendChild(div);
  });

  const caption = document.createElement("div");
  caption.className = "visual-caption";
  caption.textContent =
    "Vue en plan frontale : chaque rectangle = un module, la barre complète ≈ " +
    totalLength.toFixed(0) + " mm.";

  wrapper.appendChild(bar);
  wrapper.appendChild(caption);
  container.appendChild(wrapper);
}

// ----- GRADUATION DU MUR -----

function buildScaleHtml(wallLength) {
  const step = 500;
  if (wallLength <= 0) return "";

  const segments = [];
  let current = 0;
  while (current < wallLength) {
    const remaining = wallLength - current;
    const segLength = Math.min(step, remaining);
    segments.push({ start: current, length: segLength });
    current += segLength;
  }

  if (segments.length === 0) return "";

  let html = '<div class="scale-wrapper">';
  html += '<div class="scale-title">Graduation du mur (mm)</div>';
  html += '<div class="scale-bar">';
  html += '<div class="scale-origin">0</div>';

  segments.forEach(seg => {
    const endVal = seg.start + seg.length;
    html += `<div class="scale-segment" style="flex-grow:${seg.length};">
               <div class="scale-tick"></div>
               <div class="scale-label">${endVal}</div>
             </div>`;
  });

  html += '</div></div>';
  return html;
}

// ----- VUE 2D DU MEUBLE (multi-étages + plinthe + top) -----

function build2DViewHtml(layoutModules, wallLength, totalTargetHeightMm, verticalHeights, plinthMm, topMm) {
  if (!totalTargetHeightMm || totalTargetHeightMm <= 0) return "";
  if (!layoutModules || layoutModules.length === 0) return "";

  const basePlinth = plinthMm > 0 ? plinthMm : 0;
  const baseTop = topMm > 0 ? topMm : 0;

  let bodyTarget = totalTargetHeightMm - basePlinth - baseTop;
  if (bodyTarget <= 0) {
    // Hauteur totale trop petite par rapport à plinthe+top : on se rabat sur un étage minimal
    bodyTarget = Math.max(1, totalTargetHeightMm - basePlinth - baseTop);
  }

  const verticalInfo = solveVerticalComposition(bodyTarget, verticalHeights);
  if (!verticalInfo) return "";

  const { rowHeights, realHeightMm: bodyHeightMm, targetHeightMm: bodyTargetMm } = verticalInfo;

  const totalRealHeightMm = basePlinth + bodyHeightMm + baseTop;
  const totalLength = layoutModules.reduce((s, m) => s + m.width, 0);
  if (totalLength <= 0) return "";

  // Échelle verticale
  const targetWidthPx = 600;
  const scale = wallLength > 0 ? wallLength / targetWidthPx : 1;
  let heightPx = totalRealHeightMm / (scale || 1);
  if (heightPx > 350) heightPx = 350;
  if (heightPx < 80) heightPx = 80;

  let html = '<div class="view2d-wrapper">';
  html += '<div class="view2d-title">Vue 2D du meuble (plinthe + corps + top)</div>';
  html += `<div class="view2d-container" style="height:${heightPx}px;">`;

  const totalH = totalRealHeightMm;

  // Plinthe (zone vide, mais représentée dans les proportions)
  let currentTopMm = 0;
  if (basePlinth > 0) {
    const plinthPct = (basePlinth / totalH) * 100;
    html += `<div class="view2d-module"
                 style="left:0; width:100%; top:${currentTopMm / totalH * 100}%; height:${plinthPct}%; opacity:0.2;">
               <span>Plinthe ${basePlinth.toFixed(0)} mm</span>
             </div>`;
    currentTopMm += basePlinth;
  }

  // Corps du meuble : étages de rangements
  rowHeights.forEach((hRow) => {
    const rowTopMm = currentTopMm;
    const rowHeightPct = (hRow / totalH) * 100;
    const topPct = (rowTopMm / totalH) * 100;
    let currentX = 0;

    layoutModules.forEach((mod) => {
      const startX = currentX;
      const width = mod.width;
      const leftPct = (startX / totalLength) * 100;
      const widthPct = (width / totalLength) * 100;
      const clsColor = "module-color-" + (mod.index % 7);

      html += `<div class="view2d-module ${clsColor}"
                   style="left:${leftPct}%; width:${widthPct}%; top:${topPct}%; height:${rowHeightPct}%;">
                 <span>${width} mm</span>
               </div>`;
      currentX += width;
    });

    currentTopMm += hRow;
  });

  // Top technique
  if (baseTop > 0) {
    const topPct = (currentTopMm / totalH) * 100;
    const topHeightPct = (baseTop / totalH) * 100;
    html += `<div class="view2d-module"
                 style="left:0; width:100%; top:${topPct}%; height:${topHeightPct}%; opacity:0.2;">
               <span>Top ${baseTop.toFixed(0)} mm</span>
             </div>`;
  }

  html += '<div class="view2d-border"></div>';
  html += '</div>';

  const diffTotal = totalRealHeightMm - totalTargetHeightMm;
  const diffBody = bodyHeightMm - bodyTargetMm;

  html += `<div class="view2d-caption">
             Composition verticale optimisée (règle de proportionnalité sur les hauteurs d’étage) :<br>
             Plinthe/fileur bas : ${basePlinth.toFixed(0)} mm<br>
             Corps du meuble : ${rowHeights.join(" + ")} mm ≈ ${bodyHeightMm.toFixed(0)} mm
             (cible corps ≈ ${bodyTargetMm.toFixed(0)} mm, écart ${diffBody >= 0 ? "+" : ""}${diffBody.toFixed(0)} mm)<br>
             Top technique : ${baseTop.toFixed(0)} mm<br>
             Hauteur totale réalisée : ${totalRealHeightMm.toFixed(0)} mm
             (cible ${totalTargetHeightMm.toFixed(0)} mm, écart ${diffTotal >= 0 ? "+" : ""}${diffTotal.toFixed(0)} mm).<br>
             Largeur totale meuble ≈ ${totalLength.toFixed(0)} mm (≤ mur ${wallLength.toFixed(0)} mm).
           </div>`;

  html += '</div>';
  return html;
}

// ----- EDITION DES MODULES ( + / - ) -----

function buildEditModulesHtml(metrics) {
  const { moduleWidths, counts } = metrics;
  let html = '<div class="edit-modules">';
  html += '<h3>Éditer les modules</h3>';
  html += '<p>Ajoute ou retire des modules par format. L’appli bloque si tu dépasses la longueur du mur.</p>';
  moduleWidths.forEach((w, idx) => {
    html += `<div class="edit-row">
               <span>${w} mm</span>
               <span>Qté : ${counts[idx]}</span>
               <button type="button" class="btn-remove" data-width="${w}">-1</button>
               <button type="button" class="btn-add" data-width="${w}">+1</button>
             </div>`;
  });
  html += '</div>';
  return html;
}

// ----- FORMATAGE GLOBAL DU RÉSULTAT -----

function formatResult(metrics, targetTol) {
  const { wallLength, totalLength, gap, counts, moduleWidths, countTotal } = metrics;
  const tol = Math.round(gap);

  let html = `<div class="result" id="result-content">`;
  html += `<p><strong>Longueur du mur :</strong> ${wallLength.toFixed(0)} mm</p>`;
  html += `<p><strong>Longueur totale des modules :</strong> ${totalLength.toFixed(0)} mm 
             <span class="tag">jeu résiduel ${tol} mm</span></p>`;
  html += `<p><strong>Tolérance horizontale nécessaire :</strong> ±${tol} mm`;

  if (typeof targetTol === "number" && !isNaN(targetTol) && targetTol >= 0) {
    if (tol <= targetTol) {
      html += ` <span class="tag tag-ok">OK pour ta tolérance cible (±${targetTol} mm)</span>`;
    } else {
      html += ` <span class="tag tag-warn">> tolérance cible (±${targetTol} mm) – gamme / composition à optimiser</span>`;
    }
  } else if (tol <= 20) {
    html += ` <span class="tag tag-ok">OK pour objectif ±20 mm</span>`;
  }
  html += `</p>`;
  html += `<p><strong>Nombre total de modules :</strong> ${countTotal}</p>`;

  html += `<div id="visual1d"></div>`;
  html += `<div id="scale"></div>`;
  html += `<div id="view2d"></div>`;

  html += `<h3>Détail par format</h3>`;
  html += `<table><thead><tr>
           <th style="text-align:left;">Largeur (mm)</th>
           <th>Qté</th>
           <th>Total (mm)</th>
           </tr></thead><tbody>`;
  moduleWidths.forEach((w, idx) => {
    const q = counts[idx];
    if (q > 0) {
      html += `<tr>
                 <td style="text-align:left;">${w}</td>
                 <td>${q}</td>
                 <td>${q * w}</td>
               </tr>`;
    }
  });
  html += `</tbody></table>`;

  html += buildEditModulesHtml(metrics);

  html += `<div class="export-buttons">
             <button type="button" id="exportPngBtn">Exporter le rendu en image (PNG)</button>
             <button type="button" id="exportJsonBtn">Exporter le projet (.json)</button>
             <button type="button" id="importJsonBtn">Importer un projet (.json)</button>
             <input type="file" id="importFileInput" accept=".json" style="display:none;">
           </div>`;

  html += `<p style="font-size:0.9rem; color:#555;">
             Le meuble ne dépasse jamais le mur. Le jeu résiduel horizontal est à prendre dans les fileurs / joues / marges.<br>
             Verticalement, la hauteur est optimisée en combinant des étages ≤ 320 mm entre une plinthe et un top technique.
           </p>`;

  html += `</div>`;
  return html;
}

// ----- RENDU COMPLET À PARTIR DU LAYOUT ACTUEL -----

function renderAll() {
  const outDiv = document.getElementById("output");
  if (!currentResult) return;

  const metrics = computeMetrics();
  if (!metrics) return;

  const targetTolInput = document.getElementById("targetTol");
  const targetTol = parseFloat(targetTolInput.value);
  const targetTolValue = isNaN(targetTol) ? null : targetTol;

  const heightInput = document.getElementById("heightInput");
  const heightMm = parseFloat(heightInput.value);
  const heightValue = isNaN(heightMm) ? null : heightMm;

  const plinthInput = document.getElementById("plinthInput");
  const topInput = document.getElementById("topInput");
  const plinthMm = parseFloat(plinthInput.value);
  const topMm = parseFloat(topInput.value);
  const plinthVal = isNaN(plinthMm) ? 0 : plinthMm;
  const topVal = isNaN(topMm) ? 0 : topMm;

  const vertInputEl = document.getElementById("vertModulesInput");
  const vertHeightsParsed = parseModules(vertInputEl.value || "");
  const verticalHeights = vertHeightsParsed || [320];

  outDiv.innerHTML = formatResult(metrics, targetTolValue);
  outDiv.style.display = "block";

  const visual1dContainer = document.getElementById("visual1d");
  const scaleContainer = document.getElementById("scale");
  const view2dContainer = document.getElementById("view2d");

  render1DBar(visual1dContainer, currentLayoutModules, metrics.totalLength);
  scaleContainer.innerHTML = buildScaleHtml(metrics.wallLength);
  view2dContainer.innerHTML = build2DViewHtml(
    currentLayoutModules,
    metrics.wallLength,
    heightValue,
    verticalHeights,
    plinthVal,
    topVal
  );

  setupDragAndDrop();
  setupEditButtons();
  setupExportButtons();
}

// ----- DRAG & DROP -----

function setupDragAndDrop() {
  const bar = document.getElementById("visual-bar-draggable");
  if (!bar) return;

  let dragIndex = null;

  bar.addEventListener("dragstart", (e) => {
    const block = e.target.closest(".module-block");
    if (!block) return;
    dragIndex = parseInt(block.dataset.idx, 10);
    block.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });

  bar.addEventListener("dragend", (e) => {
    const block = e.target.closest(".module-block");
    if (block) block.classList.remove("dragging");
  });

  bar.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  });

  bar.addEventListener("drop", (e) => {
    e.preventDefault();
    const targetBlock = e.target.closest(".module-block");
    if (!targetBlock || dragIndex === null) return;
    const targetIndex = parseInt(targetBlock.dataset.idx, 10);
    if (isNaN(targetIndex)) return;

    const item = currentLayoutModules.splice(dragIndex, 1)[0];
    currentLayoutModules.splice(targetIndex, 0, item);
    renderAll();
  });
}

// ----- BOUTONS + / - -----

function setupEditButtons() {
  const addButtons = document.querySelectorAll(".btn-add");
  const removeButtons = document.querySelectorAll(".btn-remove");

  const metrics = computeMetrics();
  if (!metrics) return;
  const { wallLength } = metrics;

  addButtons.forEach(btn => {
    btn.onclick = () => {
      const w = parseInt(btn.dataset.width, 10);
      const newTotal = currentLayoutModules.reduce((s, m) => s + m.width, 0) + w;
      if (newTotal > wallLength) {
        alert("Ajout refusé : on dépasserait la longueur du mur.");
        return;
      }
      const typeIndex = currentResult.moduleWidths.indexOf(w);
      if (typeIndex === -1) return;
      currentLayoutModules.push({ width: w, index: typeIndex });
      renderAll();
    };
  });

  removeButtons.forEach(btn => {
    btn.onclick = () => {
      const w = parseInt(btn.dataset.width, 10);
      const idx = currentLayoutModules.findIndex(m => m.width === w);
      if (idx === -1) return;
      currentLayoutModules.splice(idx, 1);
      renderAll();
    };
  });
}

// ----- EXPORT / IMPORT -----

function setupExportButtons() {
  setupExportPngButton();
  setupExportJsonButton();
  setupImportJsonButton();
}

function setupExportPngButton() {
  const btn = document.getElementById("exportPngBtn");
  if (!btn || typeof html2canvas === "undefined") return;

  btn.onclick = () => {
    const resultDiv = document.getElementById("result-content");
    if (!resultDiv) return;
    html2canvas(resultDiv, { scale: 2 }).then((canvas) => {
      const link = document.createElement("a");
      link.download = "calepinage.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    });
  };
}

function setupExportJsonButton() {
  const btn = document.getElementById("exportJsonBtn");
  if (!btn) return;

  btn.onclick = () => {
    if (!currentResult) return;
    const wallLength = currentResult.wallLength;
    const moduleWidths = currentResult.moduleWidths.slice();

    const heightInput = document.getElementById("heightInput");
    const targetTolInput = document.getElementById("targetTol");
    const vertInputEl = document.getElementById("vertModulesInput");
    const plinthInput = document.getElementById("plinthInput");
    const topInput = document.getElementById("topInput");

    const heightMm = parseFloat(heightInput.value);
    const targetTol = parseFloat(targetTolInput.value);
    const vertHeightsParsed = parseModules(vertInputEl.value || "");
    const verticalHeights = vertHeightsParsed || [320];
    const plinthMm = parseFloat(plinthInput.value);
    const topMm = parseFloat(topInput.value);

    const data = {
      wallLength,
      moduleWidths,
      layoutModules: currentLayoutModules,
      heightMm: isNaN(heightMm) ? null : heightMm,
      targetTol: isNaN(targetTol) ? null : targetTol,
      verticalHeights,
      plinthMm: isNaN(plinthMm) ? null : plinthMm,
      topMm: isNaN(topMm) ? null : topMm
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.download = "calepinage-projet.json";
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  };
}

function setupImportJsonButton() {
  const btn = document.getElementById("importJsonBtn");
  const fileInput = document.getElementById("importFileInput");
  if (!btn || !fileInput) return;

  btn.onclick = () => {
    fileInput.value = "";
    fileInput.click();
  };

  fileInput.onchange = () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data || typeof data.wallLength !== "number" || !Array.isArray(data.moduleWidths)) {
          alert("Fichier invalide.");
          return;
        }

        currentResult = {
          wallLength: data.wallLength,
          moduleWidths: data.moduleWidths.slice()
        };
        currentLayoutModules = Array.isArray(data.layoutModules)
          ? data.layoutModules.map(m => ({ width: m.width, index: m.index }))
          : [];

        document.getElementById("wallLength").value = String(data.wallLength);
        document.getElementById("modulesInput").value = data.moduleWidths.join(", ");

        if (typeof data.heightMm === "number") {
          document.getElementById("heightInput").value = String(data.heightMm);
        }
        if (typeof data.targetTol === "number") {
          document.getElementById("targetTol").value = String(data.targetTol);
        }
        if (Array.isArray(data.verticalHeights)) {
          document.getElementById("vertModulesInput").value = data.verticalHeights.join(", ");
        }
        if (typeof data.plinthMm === "number") {
          document.getElementById("plinthInput").value = String(data.plinthMm);
        }
        if (typeof data.topMm === "number") {
          document.getElementById("topInput").value = String(data.topMm);
        }

        renderAll();
      } catch (err) {
        console.error(err);
        alert("Erreur lors de la lecture du fichier.");
      }
    };
    reader.readAsText(file);
  };
}

// ----- UI PRINCIPALE -----

document.getElementById("computeBtn").addEventListener("click", () => {
  const wallInput = document.getElementById("wallLength");
  const modulesInput = document.getElementById("modulesInput");
  const outDiv = document.getElementById("output");
  const errDiv = document.getElementById("error");

  errDiv.textContent = "";
  outDiv.style.display = "none";
  outDiv.innerHTML = "";

  const wallLength = parseFloat(wallInput.value);
  if (isNaN(wallLength) || wallLength <= 0) {
    errDiv.textContent = "Merci d’indiquer une longueur de mur valide (en mm).";
    return;
  }

  const moduleWidths = parseModules(modulesInput.value);
  if (!moduleWidths || moduleWidths.length === 0) {
    errDiv.textContent = "Merci d’indiquer au moins une largeur de module valide (en mm).";
    return;
  }

  const solved = solveOptimalCombination(wallLength, moduleWidths);
  if (!solved) {
    errDiv.textContent = "Aucune combinaison trouvée. Essaie d’ajouter des largeurs ou d’élargir la gamme.";
    return;
  }

  currentResult = {
    wallLength: solved.wallLength,
    moduleWidths: solved.moduleWidths
  };

  currentLayoutModules = [];
  solved.moduleWidths.forEach((w, idx) => {
    const q = solved.solution.counts[idx];
    for (let k = 0; k < q; k++) {
      currentLayoutModules.push({ width: w, index: idx });
    }
  });

  renderAll();
});

// ----- PRESETS -----

const modulesInputEl = document.getElementById("modulesInput");
document.getElementById("presetStd").addEventListener("click", () => {
  modulesInputEl.value = "200, 240, 320, 480, 640, 960, 1280";
});
document.getElementById("preset300").addEventListener("click", () => {
  modulesInputEl.value = "300, 450, 600, 900, 1200";
});

// js/main.js

const STORAGE_KEY = "calepinage_projects_v2";

let currentResult = null;       // { wallLength, moduleWidths }
let currentLayoutModules = [];  // [{width, index}]
let currentVerticalInfo = null;
let currentCutList = [];

function $(id) { return document.getElementById(id); }

function computeMetrics() {
  if (!currentResult) return null;
  const wallLength = currentResult.wallLength;
  const moduleWidths = currentResult.moduleWidths;

  const totalLength = currentLayoutModules.reduce((s, m) => s + m.width, 0);
  const gap = Math.max(0, wallLength - totalLength);
  const counts = moduleWidths.map(w => currentLayoutModules.filter(m => m.width === w).length);

  return {
    wallLength,
    moduleWidths,
    totalLength,
    gap,
    counts,
    countTotal: currentLayoutModules.length
  };
}

function readInputs() {
  const wallLength = parseFloat($("wallLength").value);
  const heightTotal = parseFloat($("heightInput").value);

  const assemblyMode = $("assemblyMode").value; // 'independent' | 'shared'
  const cornerAllowance = parseFloat($("cornerAllowance").value) || 0;


  const plinthMm = parseFloat($("plinthInput").value) || 0;
  const topMm = parseFloat($("topInput").value) || 0;

  const depthMm = parseFloat($("depthInput").value) || 400;
  const matThk = parseFloat($("matThkInput").value) || 19;
  const backThk = parseFloat($("backThkInput").value) || 0;
  const includeBack = !!$("includeBackInput").checked;

  const moduleWidths = parseModules($("modulesInput").value);
  const verticalHeights = parseModules($("vertModulesInput").value) || [320];

  const targetTol = parseFloat($("targetTol").value);
  const targetTolValue = isNaN(targetTol) ? null : targetTol;

  return {
    wallLength,
    heightTotal: isNaN(heightTotal) ? null : heightTotal,
    plinthMm,
    topMm,
    depthMm,
    matThk,
    backThk,
    includeBack,
    moduleWidths,
    verticalHeights,
    targetTolValue
  };
}

function computeAll() {
  const err = $("error");
  err.textContent = "";

  const inputs = readInputs();

  if (isNaN(inputs.wallLength) || inputs.wallLength <= 0) {
    err.textContent = "Merci d’indiquer une longueur de mur valide.";
    return false;
  }
  if (!inputs.moduleWidths || inputs.moduleWidths.length === 0) {
    err.textContent = "Merci d’indiquer des largeurs de modules valides.";
    return false;
  }

  // Solve horizontal
  const solvedH = solveOptimalCombination(inputs.wallLength, inputs.moduleWidths);
  if (!solvedH) {
    err.textContent = "Impossible de trouver une combinaison horizontale.";
    return false;
  }

  currentResult = { wallLength: solvedH.wallLength, moduleWidths: solvedH.moduleWidths };
  currentLayoutModules = [];
  solvedH.moduleWidths.forEach((w, idx) => {
    const q = solvedH.solution.counts[idx];
    for (let k = 0; k < q; k++) currentLayoutModules.push({ width: w, index: idx });
  });

  // Solve vertical for body
  const bodyTarget = inputs.heightTotal
    ? Math.max(1, inputs.heightTotal - inputs.plinthMm - inputs.topMm)
    : 320;

  currentVerticalInfo = solveVerticalComposition(bodyTarget, inputs.verticalHeights);

  // Cut-list atelier
  currentCutList = buildCutList({
    layoutModules: currentLayoutModules,
    verticalInfo: currentVerticalInfo,
    depthMm: inputs.depthMm,
    matThk: inputs.matThk,
    backThk: inputs.backThk,
    includeBack: inputs.includeBack,
    assemblyMode: inputs.assemblyMode,
    cornerAllowance: inputs.cornerAllowance
  });
  

  renderAll();
  return true;
}

function renderAll() {
  const out = $("output");
  const metrics = computeMetrics();
  if (!metrics) return;

  const inputs = readInputs();

  out.innerHTML = formatResult(
    metrics,
    inputs.targetTolValue,
    inputs,
    currentVerticalInfo,
    currentCutList
  );
  out.style.display = "block";

  // Inject visual blocks
  render1DBar($("visual1d"), currentLayoutModules, metrics.totalLength);
  $("scale").innerHTML = buildScaleHtml(metrics.wallLength);
  $("view2d").innerHTML = build2DViewHtml(currentLayoutModules, metrics.wallLength, currentVerticalInfo?.realHeightMm || 0);
  $("explodedView").innerHTML = buildExplodedViewHtml(currentLayoutModules, currentVerticalInfo);

  // Wire export buttons
  wireExports(inputs);
}

function wireExports(inputs) {
  const pngBtn = $("exportPngBtn");
  const pdfBtn = $("exportPdfBtn");
  if (pngBtn) pngBtn.onclick = exportPNG;
  if (pdfBtn) pdfBtn.onclick = () => exportPDFMulti(inputs);
}

async function exportPNG() {
  const node = $("result-content");
  if (!node || typeof html2canvas === "undefined") return;

  const canvas = await html2canvas(node, { scale: 2 });
  const link = document.createElement("a");
  link.download = "calepinage.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// --- PDF multi-pages ---
// Page 1: Résumé + paramètres
// Page 2: Captures (vue 2D + éclaté)
// Page 3: Cut-list (table)
async function exportPDFMulti(inputs) {
  if (!window.jspdf || !window.jspdf.jsPDF) return alert("jsPDF non chargé.");
  const { jsPDF } = window.jspdf;

  const metrics = computeMetrics();
  if (!metrics) return;

  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 12;

  // -------- Page 1: résumé --------
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("Calepinage - Fiche projet", margin, 16);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);

  const lines = [];
  lines.push(`Mur: ${metrics.wallLength} mm`);
  lines.push(`Largeur modules: ${metrics.totalLength.toFixed(0)} mm (jeu ${Math.round(metrics.gap)} mm)`);
  lines.push(`Nombre de modules: ${metrics.countTotal}`);
  if (inputs.heightTotal) {
    const bodyTarget = Math.max(0, inputs.heightTotal - inputs.plinthMm - inputs.topMm);
    const bodyReal = currentVerticalInfo?.realHeightMm || 0;
    lines.push(`Hauteur totale cible: ${inputs.heightTotal} mm`);
    lines.push(`Plinthe: ${inputs.plinthMm} mm | Fileur haut: ${inputs.topMm} mm`);
    lines.push(`Corps: ${bodyReal} mm (cible ${bodyTarget} mm)`);
  }
  lines.push(`Profondeur: ${inputs.depthMm} mm`);
  lines.push(`Épaisseur matériau: ${inputs.matThk} mm`);
  lines.push(`Fond: ${inputs.includeBack ? `${inputs.backThk} mm (inclus)` : "non inclus"}`);

  let y = 28;
  for (const l of lines) {
    pdf.text(l, margin, y);
    y += 6;
  }

  // -------- Page 2: images (2D + éclaté) --------
  pdf.addPage();
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("Vues", margin, 16);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);

  const view2dNode = $("view2dBlock");
  const explodedNode = $("explodedBlock");

  // helper: capture node to image and add to pdf
  async function addNodeImage(node, title, startY) {
    if (!node || typeof html2canvas === "undefined") {
      pdf.text(`${title}: (non disponible)`, margin, startY);
      return startY + 10;
    }
    pdf.text(title, margin, startY);
    const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff" });
    const img = canvas.toDataURL("image/png");

    const maxW = pageW - 2 * margin;
    const imgW = maxW;
    const imgH = (canvas.height * imgW) / canvas.width;

    let yLocal = startY + 4;
    let hLocal = imgH;

    // fit in remaining page height
    const maxH = pageH - margin - yLocal;
    if (hLocal > maxH) {
      const ratio = maxH / hLocal;
      hLocal = maxH;
      // imgW = imgW * ratio; (si tu veux conserver ratio sur W)
      // On garde largeur max et on accepte qu'elle soit réduite via ratio:
      // => mieux: réduire largeur selon ratio
      const newW = imgW * ratio;
      pdf.addImage(img, "PNG", margin, yLocal, newW, hLocal);
      return yLocal + hLocal + 8;
    } else {
      pdf.addImage(img, "PNG", margin, yLocal, imgW, hLocal);
      return yLocal + hLocal + 8;
    }
  }

  let y2 = 22;
  y2 = await addNodeImage(view2dNode, "Vue 2D (corps)", y2);
  y2 = await addNodeImage(explodedNode, "Vue éclatée (étages)", y2);

  // -------- Page 3: Cut-list --------
  pdf.addPage();
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("Cut-list atelier (panneaux)", margin, 16);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);

  // Table header
  let y3 = 24;
  const col = {
    part: margin,
    len: margin + 70,
    wid: margin + 105,
    thk: margin + 140,
    qty: margin + 165
  };

  pdf.setFont("helvetica", "bold");
  pdf.text("Pièce", col.part, y3);
  pdf.text("L (mm)", col.len, y3);
  pdf.text("l (mm)", col.wid, y3);
  pdf.text("e (mm)", col.thk, y3);
  pdf.text("Qté", col.qty, y3);
  pdf.setFont("helvetica", "normal");

  y3 += 6;
  pdf.line(margin, y3 - 4, pageW - margin, y3 - 4);

  const rows = currentCutList || [];
  for (const r of rows) {
    if (y3 > pageH - margin) {
      pdf.addPage();
      y3 = 18;
    }
    pdf.text(String(r.part), col.part, y3);
    pdf.text(String(r.len), col.len, y3);
    pdf.text(String(r.wid), col.wid, y3);
    pdf.text(String(r.thk), col.thk, y3);
    pdf.text(String(r.qty), col.qty, y3);
    y3 += 5;
  }

  // Save
  pdf.save("calepinage_multi_pages.pdf");
}

/* =========================
   CUT LIST (atelier)
   =========================
   Hypothèse simple & robuste :
   - Chaque caisson = 2 côtés + 1 dessus + 1 dessous (+ fond optionnel)
   - Dimensions (mm) :
     côtés : hauteur étage x profondeur
     dessus/dessous : largeur intérieure (?) -> ici on fait largeur "caisson" x profondeur
   Notes :
   - Si tu veux intégrer un "jeu" ou un type d'assemblage (rainure/fond en feuillure),
     on le fera ensuite (mais là c’est exploitable immédiatement).
*/

function buildCutList({ layoutModules, verticalInfo, depthMm, matThk, backThk, includeBack, assemblyMode, cornerAllowance }) {
  const rows = [];
  if (!verticalInfo || !verticalInfo.rowHeights) return rows;

  const rowHeights = verticalInfo.rowHeights;
  const R = rowHeights.length;
  const N = layoutModules.length;
  if (N === 0 || R === 0) return rows;

  const map = new Map();
  function add(part, len, wid, thk, qty) {
    const key = `${part}|${len}|${wid}|${thk}`;
    map.set(key, (map.get(key) || 0) + qty);
  }

  // Surcote : si tu veux laisser un peu de marge à l’usinage d’angle
  // (tu peux aussi la mettre à 0 si tu préfères du net net).
  const A = Math.max(0, cornerAllowance || 0);

  if (assemblyMode === "shared") {
    // MODE PANNEAUX PARTAGÉS (cloisons communes)
    for (const h of rowHeights) {
      add("Joue extrême", h, depthMm, matThk, 2);
      if (N > 1) add("Cloison intermédiaire", h, depthMm, matThk, N - 1);
    }

    // Plateaux partagés entre étages (alignés)
    layoutModules.forEach((mod) => {
      const w = mod.width;
      add("Dessous (base)", w, depthMm, matThk, 1);
      if (R > 1) add("Plateau intermédiaire", w, depthMm, matThk, R - 1);
      add("Dessus (top)", w, depthMm, matThk, 1);
    });

  } else {
    // MODE ANGLES (CAISSONS INDÉPENDANTS)
    for (const h of rowHeights) {
      for (const mod of layoutModules) {
        const w = mod.width;

        // Côtés (2)
        add("Côté", h + A, depthMm + A, matThk, 2);

        // Dessus + dessous (1 chacun)
        add("Dessus", w + A, depthMm + A, matThk, 1);
        add("Dessous", w + A, depthMm + A, matThk, 1);
      }
    }
  }

  // Fonds : toujours 1 par caisson et par étage (dans les 2 modes)
  if (includeBack && backThk > 0) {
    for (const h of rowHeights) {
      for (const mod of layoutModules) {
        add("Fond", mod.width, h, backThk, 1);
      }
    }
  }

  // Map -> array
  for (const [key, qty] of map.entries()) {
    const [part, len, wid, thk] = key.split("|");
    rows.push({ part, len: Number(len), wid: Number(wid), thk: Number(thk), qty });
  }

  rows.sort((a, b) =>
    a.part.localeCompare(b.part) ||
    a.thk - b.thk ||
    a.len - b.len ||
    a.wid - b.wid
  );

  return rows;
}


/* =========================
   Sauvegardes (localStorage)
   ========================= */

function loadProjects() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveProjects(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function refreshProjectsUI() {
  const container = $("projectsList");
  if (!container) return;

  const list = loadProjects();
  if (list.length === 0) {
    container.innerHTML = `<p class="hint">Aucune sauvegarde pour le moment.</p>`;
    return;
  }

  container.innerHTML = list.map(p => {
    const date = new Date(p.savedAt).toLocaleString();
    return `
      <div class="project-item">
        <div class="title">${escapeHtml(p.name || "Sans nom")}</div>
        <div class="meta">${date}</div>
        <div class="actions">
          <button type="button" data-act="load" data-id="${p.id}">Charger</button>
          <button type="button" data-act="delete" data-id="${p.id}">Supprimer</button>
        </div>
      </div>
    `;
  }).join("");

  container.querySelectorAll("button").forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      if (act === "load") loadProjectById(id);
      if (act === "delete") deleteProjectById(id);
    };
  });
}

function uuid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function getCurrentProjectData(name) {
  const inputs = readInputs();

  return {
    id: uuid(),
    name: name || "Sans nom",
    savedAt: Date.now(),
    inputs: {
      wallLength: inputs.wallLength,
      heightTotal: inputs.heightTotal,
      plinthMm: inputs.plinthMm,
      topMm: inputs.topMm,
      depthMm: inputs.depthMm,
      matThk: inputs.matThk,
      backThk: inputs.backThk,
      includeBack: inputs.includeBack,
      modulesInput: $("modulesInput").value,
      vertModulesInput: $("vertModulesInput").value,
      targetTolValue: inputs.targetTolValue
    }
  };
}

function applyProjectData(project) {
  const inp = project.inputs || {};
  $("wallLength").value = inp.wallLength ?? "";
  $("heightInput").value = inp.heightTotal ?? "";
  $("plinthInput").value = inp.plinthMm ?? 0;
  $("topInput").value = inp.topMm ?? 0;

  $("depthInput").value = inp.depthMm ?? 400;
  $("matThkInput").value = inp.matThk ?? 19;
  $("backThkInput").value = inp.backThk ?? 0;
  $("includeBackInput").checked = (inp.includeBack ?? true);

  $("modulesInput").value = inp.modulesInput ?? $("modulesInput").value;
  $("vertModulesInput").value = inp.vertModulesInput ?? $("vertModulesInput").value;
  $("targetTol").value = (inp.targetTolValue ?? "");

  computeAll();
}

function saveCurrentProject() {
  const ok = computeAll(); // recalcul pour être sûr que tout est cohérent
  if (!ok) return;

  const name = ($("projectName").value || "").trim();
  const project = getCurrentProjectData(name);

  const list = loadProjects();
  list.unshift(project);
  saveProjects(list);
  refreshProjectsUI();
}

function loadProjectById(id) {
  const list = loadProjects();
  const p = list.find(x => x.id === id);
  if (!p) return;
  applyProjectData(p);
}

function deleteProjectById(id) {
  const list = loadProjects().filter(x => x.id !== id);
  saveProjects(list);
  refreshProjectsUI();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}

/* =========================
   Export / Import JSON
   ========================= */

function exportJSON() {
  const ok = computeAll();
  if (!ok) return;

  const name = ($("projectName").value || "calepinage").trim() || "calepinage";
  const data = getCurrentProjectData(name);

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.download = `${name.replace(/[^\w\-]+/g, "_")}.json`;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}

function importJSONFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !data.inputs) return alert("JSON invalide.");
      applyProjectData(data);
    } catch (e) {
      console.error(e);
      alert("Erreur de lecture JSON.");
    }
  };
  reader.readAsText(file);
}

/* =========================
   Init
   ========================= */

function setPresetMassif() {
  $("modulesInput").value = "200, 202, 204, 206, 208, 210, 280, 320, 360, 400, 480, 560, 640, 720, 800";
  $("vertModulesInput").value = "160, 162, 164, 166, 168, 170, 172, 174, 176, 178, 180, 200, 240, 280, 320";
  $("targetTol").value = "2";
}

document.addEventListener("DOMContentLoaded", () => {
  $("computeBtn").onclick = computeAll;
  $("presetMassifBtn").onclick = () => { setPresetMassif(); };

  $("saveProjectBtn").onclick = saveCurrentProject;
  $("exportJsonBtn").onclick = exportJSON;

  $("importJsonBtn").onclick = () => $("importJsonFile").click();
  $("importJsonFile").onchange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) importJSONFile(f);
  };

  refreshProjectsUI();
});

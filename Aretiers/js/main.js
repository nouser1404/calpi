// js/main.js
import { computeModel } from "./geometry.js";
import { draw } from "./render.js";
import { renderSummary, renderTable, renderDetails } from "./ui.js";
import {
  buildTriangleTemplate2D,
  buildFrustumTemplate2D,
  templateToSVG,
  downloadSVG
} from "./templates.js";

const els = {
  n: document.getElementById("n"),
  R: document.getElementById("R"),
  H: document.getElementById("H"),
  zCut: document.getElementById("zCut"),
  dx: document.getElementById("dx"),
  dy: document.getElementById("dy"),
  showToolAngle: document.getElementById("showToolAngle"),
  recalc: document.getElementById("recalc"),
  canvas: document.getElementById("view"),
  summary: document.getElementById("summary"),
  tbody: document.querySelector("#results tbody"),
  details: document.getElementById("details"),

  // (ajout gabarits)
  faceIndex: document.getElementById("faceIndex"),
  exportFaceSvg: document.getElementById("exportFaceSvg"),
  exportAllSvg: document.getElementById("exportAllSvg"),
  preferHoveredFace: document.getElementById("preferHoveredFace"),
  svgAnnot: document.getElementById("svgAnnot"),
  svgShowEdges: document.getElementById("svgShowEdges"),

};

const ctx = els.canvas.getContext("2d");
let hoverIndex = null;
let lastModel = null;
let lastParams = null;

function readParams() {
  const n = Math.max(3, parseInt(els.n.value, 10) || 3);
  const R = Math.max(0, Number(els.R.value) || 0);
  const H = Math.max(0, Number(els.H.value) || 0);
  let zCut = Number(els.zCut.value) || 0;
  const dx = Number(els.dx.value) || 0;
  const dy = Number(els.dy.value) || 0;

  zCut = Math.max(0, Math.min(H, zCut));
  return { n, R, H, zCut, dx, dy };
}

function syncFaceSelect(n) {
  if (!els.faceIndex) return;

  const prev = els.faceIndex.value;
  els.faceIndex.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = `Face ${i}`;
    els.faceIndex.appendChild(opt);
  }
  if (prev !== "") {
    els.faceIndex.value = String(Math.min(n - 1, Number(prev)));
  }
}

function recalc() {
  const p = readParams();
  const model = computeModel(p);

  lastModel = model;
  lastParams = p;

  syncFaceSelect(model.base.length);

  renderSummary(els.summary, model, p);
  renderTable(els.tbody, model, els.showToolAngle.checked);
  renderDetails(els.details, p);
  draw(ctx, model, hoverIndex);
}

els.recalc.addEventListener("click", recalc);
[els.n, els.R, els.H, els.zCut, els.dx, els.dy, els.showToolAngle].forEach(inp => {
  inp.addEventListener("input", recalc);
});

// Hover table -> highlight edge
els.tbody.addEventListener("mousemove", (e) => {
  const tr = e.target.closest("tr");
  if (!tr) return;
  hoverIndex = Number(tr.dataset.index);
  draw(ctx, lastModel, hoverIndex);

  // si on préfère la face survolée, on met à jour le select
  if (els.faceIndex && els.preferHoveredFace?.checked) {
    els.faceIndex.value = String(hoverIndex);
  }
});

els.tbody.addEventListener("mouseleave", () => {
  hoverIndex = null;
  draw(ctx, lastModel, hoverIndex);
});

function getActiveFaceIndex() {
  if (els.preferHoveredFace?.checked && hoverIndex !== null && Number.isFinite(hoverIndex)) {
    return hoverIndex;
  }
  if (els.faceIndex) return Number(els.faceIndex.value || 0);
  return 0;
}

function exportFaceSVG(i) {
  if (!lastModel) return;

  const isFrustum = !!lastModel.trunc;
  const tpl = isFrustum
    ? buildFrustumTemplate2D(lastModel, i)
    : buildTriangleTemplate2D(lastModel, i);

  const annotMode = els.svgAnnot?.value ?? "none";
  const showEdges = els.svgShowEdges?.checked ?? true;
  
  const svg = templateToSVG(tpl, {
    units: "mm",
    marginMm: 10,
    // 👇 nouvelles options
    annotMode,
    showEdges,
    model: lastModel, // pour accéder aux angles de corroyage
  });
  





  const filename = isFrustum
    ? `gabarit_face_${i}_tronque.svg`
    : `gabarit_face_${i}.svg`;

  downloadSVG(filename, svg);
}

function exportAllSVG() {
  if (!lastModel) return;
  const n = lastModel.base.length;
  for (let i = 0; i < n; i++) exportFaceSVG(i);
}

els.exportFaceSvg?.addEventListener("click", () => exportFaceSVG(getActiveFaceIndex()));
els.exportAllSvg?.addEventListener("click", exportAllSVG);

// au changement du select, on force un redraw (optionnel)
els.faceIndex?.addEventListener("change", () => {
  const idx = Number(els.faceIndex.value || 0);
  hoverIndex = idx; // petit confort: surligne la face sélectionnée
  draw(ctx, lastModel, hoverIndex);
});

recalc();

// PWA: register service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  });
}

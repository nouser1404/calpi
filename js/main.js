// js/main.js — Calpinage panneaux (débit optimisé)

const STORAGE_KEY = "calpinage_panneaux_v1";

let currentNesting = null; // résultat solvePanelNesting

function $(id) { return document.getElementById(id); }

function setFieldInvalid(id, isInvalid) {
  const el = $(id);
  if (!el) return;
  if (isInvalid) el.setAttribute("aria-invalid", "true");
  else el.removeAttribute("aria-invalid");
}

function showError(message, focusId) {
  const err = $("error");
  if (err) err.textContent = message;
  if (focusId) {
    const el = $(focusId);
    if (el && typeof el.focus === "function") {
      el.focus();
      try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch {}
    }
    setFieldInvalid(focusId, true);
  }
}

function clearErrors() {
  const err = $("error");
  if (err) err.textContent = "";
}

function readPanelInputs() {
  const lengthMm = parseFloat($("panelLength").value);
  const widthMm = parseFloat($("panelWidth").value);
  const thicknessMm = parseFloat($("panelThickness").value);
  const coating = ($("panelCoating") && $("panelCoating").value) || "melamine";
  const sawKerfMm = parseFloat($("sawKerf").value) || 0;
  return {
    lengthMm: isNaN(lengthMm) ? 2800 : lengthMm,
    widthMm: isNaN(widthMm) ? 1900 : widthMm,
    thicknessMm: isNaN(thicknessMm) ? 19 : thicknessMm,
    coating,
    sawKerfMm: isNaN(sawKerfMm) ? 3 : Math.max(0, sawKerfMm)
  };
}

function readPiecesFromDOM() {
  const pieces = [];
  const container = $("piecesContainer");
  if (!container) return pieces;

  container.querySelectorAll(".piece-row:not(.piece-row-header)").forEach((row, idx) => {
    const nameEl = row.querySelector(".piece-name");
    const lenEl = row.querySelector(".piece-length");
    const widEl = row.querySelector(".piece-width");
    const qtyEl = row.querySelector(".piece-qty");
    const chantLong = row.querySelector(".chant-long");
    const chantLarg = row.querySelector(".chant-larg");
    const name = nameEl ? (nameEl.value || "").trim() || `Pièce ${idx + 1}` : `Pièce ${idx + 1}`;
    const len = parseFloat(lenEl ? lenEl.value : 0);
    const wid = parseFloat(widEl ? widEl.value : 0);
    const qty = Math.max(0, Math.floor(parseFloat(qtyEl ? qtyEl.value : 0) || 0));
    if (len > 0 && wid > 0 && qty > 0) {
      pieces.push({
        id: `p${idx}`,
        name,
        lengthMm: len,
        widthMm: wid,
        qty,
        chantLongueur: chantLong ? chantLong.checked : false,
        chantLargeur: chantLarg ? chantLarg.checked : false
      });
    }
  });
  return pieces;
}

function addPieceRow(data = {}) {
  const container = $("piecesContainer");
  if (!container) return;

  const name = (data.name != null ? data.name : "").trim() || "";
  const len = data.lengthMm != null ? data.lengthMm : "";
  const wid = data.widthMm != null ? data.widthMm : "";
  const qty = data.qty != null ? data.qty : 1;
  const chantLongueur = !!data.chantLongueur;
  const chantLargeur = !!data.chantLargeur;

  const row = document.createElement("div");
  row.className = "piece-row";
  row.innerHTML = `
    <input type="text" class="piece-name" placeholder="Nom" value="${escapeAttr(name)}">
    <input type="number" class="piece-length" min="1" step="1" placeholder="Long." value="${escapeAttr(String(len))}">
    <input type="number" class="piece-width" min="1" step="1" placeholder="Larg." value="${escapeAttr(String(wid))}">
    <input type="number" class="piece-qty" min="1" step="1" value="${escapeAttr(String(qty))}">
    <label class="chant-cb" title="Chant sur la longueur"><input type="checkbox" class="chant-long" ${chantLongueur ? "checked" : ""}></label>
    <label class="chant-cb" title="Chant sur la largeur"><input type="checkbox" class="chant-larg" ${chantLargeur ? "checked" : ""}></label>
    <button type="button" class="btn-remove-piece" aria-label="Supprimer la pièce">×</button>
  `;
  container.appendChild(row);

  row.querySelector(".btn-remove-piece").onclick = () => {
    row.remove();
  };
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function computeAll() {
  clearErrors();

  const panel = readPanelInputs();
  const pieces = readPiecesFromDOM();

  if (panel.lengthMm <= 0 || panel.widthMm <= 0) {
    showError("Indiquez les dimensions du panneau (longueur et largeur).", "panelLength");
    return false;
  }
  if (pieces.length === 0) {
    showError("Ajoutez au moins une pièce à débiter (nom, dimensions et quantité).", "piecesContainer");
    return false;
  }

  currentNesting = solvePanelNesting(
    {
      lengthMm: panel.lengthMm,
      widthMm: panel.widthMm,
      sawKerfMm: panel.sawKerfMm
    },
    pieces,
    { allowRotation: true }
  );

  renderAll(panel);
  return true;
}

function renderAll(panelInputs) {
  const out = $("output");
  if (!currentNesting) return;

  const panel = panelInputs || readPanelInputs();
  out.innerHTML = formatCalpinageResult(currentNesting, panel);
  out.style.display = "block";

  const viewContainers = out.querySelectorAll(".calpinage-panel-view");
  viewContainers.forEach((container, idx) => {
    if (currentNesting.panels[idx]) {
      injectCalpinageSVG(container, currentNesting.panels[idx], currentNesting.panelLengthMm, currentNesting.panelWidthMm, currentNesting.sawKerfMm);
    }
  });

  wireExportButtons(panel);
}

function wireExportButtons(panelInputs) {
  const pdfBtn = $("exportPdfBtn");
  if (pdfBtn) pdfBtn.onclick = () => exportPDFCalpinage(panelInputs);
}

async function exportPDFCalpinage(panelInputs) {
  if (!window.jspdf || !window.jspdf.jsPDF) return alert("jsPDF non chargé.");
  const { jsPDF } = window.jspdf;
  if (!currentNesting) return;

  const panel = panelInputs || readPanelInputs();
  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 18;
  const listColW = 62;
  const drawLeft = margin + listColW;
  const drawAreaW = pageW - drawLeft - margin;

  const projectName = ($("projectName") && $("projectName").value) || "Calpinage";
  const wastePct = (currentNesting.wastePct != null ? currentNesting.wastePct : (currentNesting.totalPanelArea > 0 ? 100 * currentNesting.totalWaste / currentNesting.totalPanelArea : 0)).toFixed(1);
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const insetMm = 3.5;

  for (let i = 0; i < currentNesting.panels.length; i++) {
    const pan = currentNesting.panels[i];
    if (i > 0) pdf.addPage();

    if (i === 0) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text(projectName, margin, 16);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(`Date : ${today}`, margin, 23);
      pdf.text(`Panneau : ${currentNesting.panelLengthMm} × ${currentNesting.panelWidthMm} mm  |  Épaisseur : ${panel.thicknessMm} mm  |  Revêtement : ${getCoatingLabel(panel.coating)}  |  Lame : ${currentNesting.sawKerfMm} mm`, margin, 29);
      pdf.text(`Nombre total de panneaux : ${currentNesting.panels.length}  |  Chute totale : ${wastePct} %  |  Utilisation : ${(100 - parseFloat(wastePct)).toFixed(1)} %`, margin, 35);
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text(`Panneau ${i + 1}`, margin, i === 0 ? 44 : 20);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(`${currentNesting.panelLengthMm} × ${currentNesting.panelWidthMm} mm`, margin, i === 0 ? 50 : 26);
    pdf.text(`Chute : ${wastePct} %`, margin, i === 0 ? 56 : 32);

    const yListStart = i === 0 ? 62 : 38;
    let yList = yListStart;

    const colW = [8, 22, 12, 12];
    const colX = [margin, margin + colW[0], margin + colW[0] + colW[1], margin + colW[0] + colW[1] + colW[2]];
    const listWidth = listColW - 4;
    const rowH = 5.5;

    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.2);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.rect(margin, yList - 4, listWidth, rowH);
    pdf.line(margin + colW[0], yList - 4, margin + colW[0], yList - 4 + rowH);
    pdf.line(margin + colW[0] + colW[1], yList - 4, margin + colW[0] + colW[1], yList - 4 + rowH);
    pdf.line(margin + colW[0] + colW[1] + colW[2], yList - 4, margin + colW[0] + colW[1] + colW[2], yList - 4 + rowH);
    pdf.text("N°", colX[0] + 1, yList - 0.5);
    pdf.text("Nom", colX[1] + 1, yList - 0.5);
    pdf.text("L", colX[2] + 2, yList - 0.5);
    pdf.text("l", colX[3] + 2, yList - 0.5);
    pdf.setFont("helvetica", "normal");
    yList += rowH;

    pan.pieces.forEach(p => {
      if (p.overflow) return;
      if (yList > pageH - margin - 15) { pdf.addPage(); yList = margin + rowH; }
      pdf.rect(margin, yList - 4, listWidth, rowH);
      pdf.line(margin + colW[0], yList - 4, margin + colW[0], yList - 4 + rowH);
      pdf.line(margin + colW[0] + colW[1], yList - 4, margin + colW[0] + colW[1], yList - 4 + rowH);
      pdf.line(margin + colW[0] + colW[1] + colW[2], yList - 4, margin + colW[0] + colW[1] + colW[2], yList - 4 + rowH);
      pdf.text(String(p.pieceIndex != null ? p.pieceIndex : ""), colX[0] + 1, yList - 0.5);
      const nom = (p.name || "").substring(0, 14);
      pdf.text(nom, colX[1] + 1, yList - 0.5);
      pdf.text(String(p.originalLength), colX[2] + 2, yList - 0.5);
      pdf.text(String(p.originalWidth), colX[3] + 2, yList - 0.5);
      yList += rowH;
    });

    const yDraw = i === 0 ? 68 : 44;
    const maxH = pageH - yDraw - margin;
    const scale = Math.min(drawAreaW / currentNesting.panelLengthMm, maxH / currentNesting.panelWidthMm);
    const drawW = currentNesting.panelLengthMm * scale;
    const drawH = currentNesting.panelWidthMm * scale;

    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.3);
    pdf.rect(drawLeft, yDraw, drawW, drawH);

    const ins = insetMm * scale / 2;

    pan.pieces.forEach(p => {
      if (p.overflow) return;
      const x = drawLeft + p.x * scale;
      const py = yDraw + p.y * scale;
      const w = p.lengthMm * scale;
      const h = p.widthMm * scale;
      const chantTop = p.rotated ? p.chantLargeur : p.chantLongueur;
      const chantBottom = p.rotated ? p.chantLargeur : p.chantLongueur;
      const chantLeft = p.rotated ? p.chantLongueur : p.chantLargeur;
      const chantRight = p.rotated ? p.chantLongueur : p.chantLargeur;

      pdf.setDrawColor(60, 60, 60);
      pdf.setLineWidth(0.45);
      if (chantTop) {
        pdf.setDrawColor(180, 100, 0);
        drawDashedLine(pdf, x + ins, py + ins, x + w - ins, py + ins);
        pdf.setDrawColor(60, 60, 60);
      } else pdf.line(x, py, x + w, py);
      if (chantRight) {
        pdf.setDrawColor(180, 100, 0);
        drawDashedLine(pdf, x + w - ins, py + ins, x + w - ins, py + h - ins);
        pdf.setDrawColor(60, 60, 60);
      } else pdf.line(x + w, py, x + w, py + h);
      if (chantBottom) {
        pdf.setDrawColor(180, 100, 0);
        drawDashedLine(pdf, x + w - ins, py + h - ins, x + ins, py + h - ins);
        pdf.setDrawColor(60, 60, 60);
      } else pdf.line(x + w, py + h, x, py + h);
      if (chantLeft) {
        pdf.setDrawColor(180, 100, 0);
        drawDashedLine(pdf, x + ins, py + h - ins, x + ins, py + ins);
        pdf.setDrawColor(60, 60, 60);
      } else pdf.line(x, py + h, x, py);

      const dimInset = 3;
      pdf.setFontSize(5);
      const num = p.pieceIndex != null ? p.pieceIndex : "";
      pdf.text((p.name || "") + " " + num, x + w / 2, py + h / 2 + 1.5, { align: "center" });
      pdf.text(String(p.lengthMm), x + w / 2, py + dimInset + 2, { align: "center" });
      pdf.text(String(p.widthMm), x + dimInset + 2, py + h / 2, { align: "center", angle: -90 });
    });
  }

  pdf.save(`${(projectName || "calpinage").replace(/[^\w\-]+/g, "_")}.pdf`);
}

function drawDashedLine(pdf, x1, y1, x2, y2) {
  const segLen = 2;
  const gap = 1.2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-6) return;
  const step = segLen + gap;
  let d = 0;
  while (d < len) {
    const d2 = Math.min(d + segLen, len);
    const t1 = d / len;
    const t2 = d2 / len;
    pdf.line(x1 + dx * t1, y1 + dy * t1, x1 + dx * t2, y1 + dy * t2);
    d = d2 + gap;
  }
}

function getCoatingLabel(value) {
  const map = {
    melamine: "Mélaminé",
    stratifie: "Stratifié",
    contreplaque: "Contreplaqué",
    mdf: "MDF",
    osb: "OSB",
    autre: "Autre"
  };
  return map[value] || value;
}

function formatCalpinageResult(nesting, panel) {
  const totalPanelArea = nesting.totalPanelArea || 0;
  const totalUsedArea = nesting.totalUsedArea || 0;
  const utilization = totalPanelArea > 0 ? (100 * totalUsedArea / totalPanelArea).toFixed(1) : "0";
  const wastePct = nesting.wastePct != null ? nesting.wastePct.toFixed(1) : (totalPanelArea > 0 ? (100 * (nesting.totalWaste || 0) / totalPanelArea).toFixed(1) : "0");

  let html = '<div class="result" id="result-content">';
  html += '<div class="result-summary" style="display:flex; flex-wrap:wrap; gap:0.4rem; align-items:center; margin:0.2rem 0 0.8rem;">';
  html += `<span class="tag">${nesting.panels.length} panneau(x)</span>`;
  html += `<span class="tag">Utilisation ${utilization} %</span>`;
  html += `<span class="tag">Chute ${wastePct} %</span>`;
  if (nesting.totalCutSegments != null) html += `<span class="tag">Traits de scie : ${nesting.totalCutSegments}</span>`;
  html += `</div>`;

  html += `<p><strong>Panneau :</strong> ${nesting.panelLengthMm} × ${nesting.panelWidthMm} mm | Épaisseur : ${panel.thicknessMm} mm | Revêtement : ${getCoatingLabel(panel.coating)} | Lame : ${nesting.sawKerfMm} mm</p>`;
  html += `<div class="btnrow" style="margin-top:0.8rem;">
      <button id="exportPdfBtn" type="button">Exporter PDF (calpinage + liste de débit)</button>
    </div>`;

  nesting.panels.forEach((pan, idx) => {
    html += `<div class="calpinage-panel-view" data-panel-index="${idx}" style="margin-top:1rem;"></div>`;
  });

  html += buildCutListTableHtml(nesting.cutList || []);
  html += "</div>";
  return html;
}

function injectCalpinageSVG(container, panelData, panelL, panelW, kerf) {
  const scale = 500 / Math.max(panelL, panelW);
  const w = panelL * scale;
  const h = panelW * scale;
  const inset = 8;

  let svg = `<svg class="calpinage-svg" viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px; border:1px solid #ccc; border-radius:8px;">`;
  svg += `<rect x="0" y="0" width="${w}" height="${h}" fill="#f8f8f8" stroke="#999"/>`;

  (panelData.pieces || []).forEach((p, i) => {
    if (p.overflow) return;
    const x = p.x * scale;
    const y = p.y * scale;
    const pw = p.lengthMm * scale;
    const ph = p.widthMm * scale;
    const chantTop = p.rotated ? p.chantLargeur : p.chantLongueur;
    const chantBottom = p.rotated ? p.chantLargeur : p.chantLongueur;
    const chantLeft = p.rotated ? p.chantLongueur : p.chantLargeur;
    const chantRight = p.rotated ? p.chantLongueur : p.chantLargeur;

    const color = `hsl(${(i * 47) % 360}, 55%, 88%)`;
    svg += `<rect x="${x}" y="${y}" width="${pw}" height="${ph}" fill="${color}" stroke="none"/>`;

    const strokeCut = "#333";
    const strokeChant = "#b36b00";
    const dash = `stroke-dasharray="4,3"`;
    const cutWidth = 2.2;

    if (chantTop) {
      svg += `<line x1="${x + inset}" y1="${y + inset}" x2="${x + pw - inset}" y2="${y + inset}" stroke="${strokeChant}" stroke-width="1.5" ${dash}/>`;
    } else {
      svg += `<line x1="${x}" y1="${y}" x2="${x + pw}" y2="${y}" stroke="${strokeCut}" stroke-width="${cutWidth}"/>`;
    }
    if (chantRight) {
      svg += `<line x1="${x + pw - inset}" y1="${y + inset}" x2="${x + pw - inset}" y2="${y + ph - inset}" stroke="${strokeChant}" stroke-width="1.5" ${dash}/>`;
    } else {
      svg += `<line x1="${x + pw}" y1="${y}" x2="${x + pw}" y2="${y + ph}" stroke="${strokeCut}" stroke-width="${cutWidth}"/>`;
    }
    if (chantBottom) {
      svg += `<line x1="${x + pw - inset}" y1="${y + ph - inset}" x2="${x + inset}" y2="${y + ph - inset}" stroke="${strokeChant}" stroke-width="1.5" ${dash}/>`;
    } else {
      svg += `<line x1="${x + pw}" y1="${y + ph}" x2="${x}" y2="${y + ph}" stroke="${strokeCut}" stroke-width="${cutWidth}"/>`;
    }
    if (chantLeft) {
      svg += `<line x1="${x + inset}" y1="${y + ph - inset}" x2="${x + inset}" y2="${y + inset}" stroke="${strokeChant}" stroke-width="1.5" ${dash}/>`;
    } else {
      svg += `<line x1="${x}" y1="${y + ph}" x2="${x}" y2="${y}" stroke="${strokeCut}" stroke-width="${cutWidth}"/>`;
    }

    const num = p.pieceIndex != null ? p.pieceIndex : i + 1;
    const nom = escapeHtml(p.name || "");
    const dimInset = 12;
    svg += `<text x="${x + pw / 2}" y="${y + ph / 2 - 6}" text-anchor="middle" dominant-baseline="middle" font-size="9" font-weight="bold" fill="#333">${nom} ${num}</text>`;
    svg += `<text x="${x + pw / 2}" y="${y + dimInset}" text-anchor="middle" font-size="8" fill="#444">${p.lengthMm}</text>`;
    const vx = x + dimInset;
    const vy = y + ph / 2;
    svg += `<text x="${vx}" y="${vy}" text-anchor="middle" dominant-baseline="middle" font-size="8" fill="#444" transform="rotate(-90, ${vx}, ${vy})">${p.widthMm}</text>`;
  });

  svg += `</svg>`;
  container.innerHTML = `<div class="calpinage-panel-title">Panneau — traits pleins = coupes, pointillés en retrait = chants plaqués. Cotes en mm le long des côtés.</div>${svg}`;
}

function buildCutListTableHtml(cutList) {
  let html = `<h3>Liste de débit</h3>`;
  html += `<div class="table-wrap"><table class="cut-list-table"><thead><tr>
    <th style="text-align:left;">Pièce</th>
    <th>Longueur (mm)</th>
    <th>Largeur (mm)</th>
    <th>Qté</th>
  </tr></thead><tbody>`;

  (cutList || []).forEach(p => {
    const rowClass = p.qty > 1 ? "cut-list-multi" : "";
    html += `<tr class="${rowClass}">
      <td style="text-align:left;">${escapeHtml(p.name)}</td>
      <td>${p.lengthMm}</td>
      <td>${p.widthMm}</td>
      <td>${p.qty}</td>
    </tr>`;
  });

  html += `</tbody></table></div>`;
  return html;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
}

function getCurrentProjectData(name) {
  const panel = readPanelInputs();
  const pieces = readPiecesFromDOM();
  return {
    id: Math.random().toString(16).slice(2) + "-" + Date.now().toString(16),
    name: (name || "").trim() || "Sans nom",
    savedAt: Date.now(),
    panel,
    pieces
  };
}

function applyProjectData(project) {
  const p = project.panel || {};
  const pieces = project.pieces || [];
  $("panelLength").value = p.lengthMm ?? 2800;
  $("panelWidth").value = p.widthMm ?? 1900;
  $("panelThickness").value = p.thicknessMm ?? 19;
  if ($("panelCoating")) $("panelCoating").value = p.coating ?? "melamine";
  $("sawKerf").value = p.sawKerfMm ?? 3;

  const container = $("piecesContainer");
  if (container) {
    container.innerHTML = "";
    const header = document.createElement("div");
    header.className = "piece-row piece-row-header";
    header.innerHTML = `<span class="piece-name">Nom</span><span class="piece-length">Long. (mm)</span><span class="piece-width">Larg. (mm)</span><span class="piece-qty">Qté</span><span class="piece-chants">Chant long.</span><span class="piece-chants">Chant larg.</span><span class="piece-actions"></span>`;
    container.appendChild(header);
    if (pieces.length === 0) {
      addPieceRow({});
    } else {
      pieces.forEach(pi => addPieceRow({
        name: pi.name,
        lengthMm: pi.lengthMm,
        widthMm: pi.widthMm,
        qty: pi.qty,
        chantLongueur: pi.chantLongueur ?? false,
        chantLargeur: pi.chantLargeur ?? false
      }));
    }
  }
  if (project.name) $("projectName").value = project.name;
  computeAll();
}

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
    container.innerHTML = `<p class="hint">Aucune sauvegarde.</p>`;
    return;
  }
  container.innerHTML = list.map(p => {
    const date = new Date(p.savedAt).toLocaleString();
    return `
      <div class="project-item">
        <div class="title">${escapeHtml(p.name || "Sans nom")}</div>
        <div class="meta">${date}</div>
        <div class="actions">
          <button type="button" data-act="load" data-id="${escapeAttr(p.id)}">Charger</button>
          <button type="button" data-act="delete" data-id="${escapeAttr(p.id)}">Supprimer</button>
        </div>
      </div>`;
  }).join("");

  container.querySelectorAll("button").forEach(btn => {
    const id = btn.dataset.id;
    const act = btn.dataset.act;
    if (act === "load") {
      const proj = list.find(x => x.id === id);
      if (proj) applyProjectData(proj);
    }
    if (act === "delete") {
      saveProjects(list.filter(x => x.id !== id));
      refreshProjectsUI();
    }
  });
}

function saveCurrentProject() {
  const ok = computeAll();
  if (!ok) return;
  const name = ($("projectName").value || "").trim();
  const project = getCurrentProjectData(name);
  const list = loadProjects();
  list.unshift(project);
  saveProjects(list);
  refreshProjectsUI();
}

function exportJSON() {
  const ok = computeAll();
  if (!ok) return;
  const name = ($("projectName").value || "calpinage").trim() || "calpinage";
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
      if (!data) return alert("JSON invalide.");
      applyProjectData(data);
    } catch (e) {
      console.error(e);
      alert("Erreur de lecture JSON.");
    }
  };
  reader.readAsText(file);
}

document.addEventListener("DOMContentLoaded", () => {
  const container = $("piecesContainer");
  if (container && !container.querySelector(".piece-row:not(.piece-row-header)")) {
    addPieceRow({});
  }

  $("addPieceBtn").onclick = () => addPieceRow({});
  $("computeBtn").onclick = computeAll;

  $("saveProjectBtn").onclick = saveCurrentProject;
  $("exportJsonBtn").onclick = exportJSON;
  $("importJsonBtn").onclick = () => $("importJsonFile").click();
  $("importJsonFile").onchange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) importJSONFile(f);
  };

  const form = $("paramsForm");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      computeAll();
    });
    form.addEventListener("reset", () => {
      clearErrors();
      $("output").style.display = "none";
      setTimeout(() => {
        if ($("piecesContainer") && $("piecesContainer").children.length === 0) addPieceRow({});
      }, 0);
    });
  }

  refreshProjectsUI();
});

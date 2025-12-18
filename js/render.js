// js/render.js

function render1DBar(container, layoutModules, totalLength) {
  container.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "visual-wrapper";

  const bar = document.createElement("div");
  bar.className = "visual-bar";

  layoutModules.forEach((mod) => {
    const div = document.createElement("div");
    div.className = "module-block module-color-" + (mod.index % 7);
    div.style.flexGrow = String(mod.width);
    div.textContent = mod.width + " mm";
    bar.appendChild(div);
  });

  const caption = document.createElement("div");
  caption.className = "visual-caption";
  caption.textContent = `Vue en plan : longueur totale ≈ ${totalLength.toFixed(0)} mm.`;

  wrapper.appendChild(bar);
  wrapper.appendChild(caption);
  container.appendChild(wrapper);
}

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

  let html = '<div class="scale-wrapper">';
  html += '<div class="scale-title">Graduation (mm)</div>';
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

function build2DViewHtml(layoutModules, wallLength, bodyHeightMm) {
  if (!bodyHeightMm || bodyHeightMm <= 0) return "";
  const totalLength = layoutModules.reduce((s, m) => s + m.width, 0);
  if (totalLength <= 0) return "";

  const targetWidthPx = 650;
  const scale = wallLength > 0 ? wallLength / targetWidthPx : 1;
  let heightPx = bodyHeightMm / (scale || 1);
  if (heightPx > 320) heightPx = 320;
  if (heightPx < 90) heightPx = 90;

  let html = '<div class="view2d-wrapper" id="view2dBlock">';
  html += '<div class="view2d-title">Vue 2D (corps du meuble)</div>';
  html += `<div class="view2d-container" style="height:${heightPx}px;">`;

  let currentX = 0;
  layoutModules.forEach((mod) => {
    const leftPct = (currentX / totalLength) * 100;
    const widthPct = (mod.width / totalLength) * 100;
    const clsColor = "module-color-" + (mod.index % 7);
    html += `<div class="view2d-module ${clsColor}"
                 style="left:${leftPct}%; width:${widthPct}%;">
               <span>${mod.width} mm</span>
             </div>`;
    currentX += mod.width;
  });

  html += '<div class="view2d-border"></div>';
  html += '</div>';
  html += `<div class="view2d-caption">Largeur ≈ ${totalLength.toFixed(0)} mm | Hauteur corps ≈ ${bodyHeightMm.toFixed(0)} mm</div>`;
  html += '</div>';
  return html;
}

function buildExplodedViewHtml(layoutModules, verticalInfo) {
  if (!verticalInfo || !verticalInfo.rowHeights || verticalInfo.rowHeights.length === 0) return "";
  const totalLength = layoutModules.reduce((s, m) => s + m.width, 0);
  if (totalLength <= 0) return "";

  const rowHeights = verticalInfo.rowHeights;

  let html = '<div class="exploded-wrapper" id="explodedBlock">';
  html += '<div class="exploded-title">Vue éclatée (étages du corps)</div>';

  rowHeights.forEach((h, idx) => {
    html += `<div class="exploded-row">`;
    html += `<div class="exploded-row-header">Étage ${idx + 1} – hauteur ${h} mm</div>`;
    html += `<div class="exploded-row-bar">`;
    layoutModules.forEach((mod) => {
      const clsColor = "module-color-" + (mod.index % 7);
      html += `<div class="exploded-module ${clsColor}" style="flex-grow:${mod.width};">
                 <span>${mod.width} mm</span>
               </div>`;
    });
    html += `</div></div>`;
  });

  html += '</div>';
  return html;
}

function buildDetailTableHtml(moduleWidths, counts) {
  let html = `<h3>Détail par largeur</h3>`;
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
  return html;
}

function buildCutListTableHtml(cutList) {
  let html = `<h3>Cut-list atelier (panneaux)</h3>`;
  html += `<table><thead><tr>
    <th style="text-align:left;">Pièce</th>
    <th>Longueur (mm)</th>
    <th>Largeur (mm)</th>
    <th>Épaisseur (mm)</th>
    <th>Qté</th>
  </tr></thead><tbody>`;

  cutList.forEach(p => {
    html += `<tr>
      <td style="text-align:left;">${p.part}</td>
      <td>${p.len}</td>
      <td>${p.wid}</td>
      <td>${p.thk}</td>
      <td>${p.qty}</td>
    </tr>`;
  });

  html += `</tbody></table>`;
  return html;
}

function formatResult(metrics, targetTol, inputs, verticalInfo, cutList) {
  const { wallLength, totalLength, gap, counts, moduleWidths, countTotal } = metrics;
  const tol = Math.round(gap);

  const heightTotal = inputs.heightTotal || null;
  const plinthMm = inputs.plinthMm || 0;
  const topMm = inputs.topMm || 0;

  const bodyTarget = heightTotal ? Math.max(0, heightTotal - plinthMm - topMm) : 0;
  const bodyReal = verticalInfo ? verticalInfo.realHeightMm : 0;
  const vGap = Math.max(0, bodyTarget - bodyReal);

  let html = `<div class="result" id="result-content">`;

  html += `<p><strong>Mur :</strong> ${wallLength.toFixed(0)} mm</p>`;
  html += `<p><strong>Largeur modules :</strong> ${totalLength.toFixed(0)} mm <span class="tag">jeu ${tol} mm</span></p>`;
  html += `<p><strong>Tolérance horizontale nécessaire :</strong> ±${tol} mm`;

  if (typeof targetTol === "number" && !isNaN(targetTol) && targetTol >= 0) {
    html += (tol <= targetTol)
      ? ` <span class="tag tag-ok">OK (≤ ${targetTol} mm)</span>`
      : ` <span class="tag tag-warn">> ${targetTol} mm</span>`;
  }
  html += `</p>`;

  html += `<p><strong>Nombre de modules :</strong> ${countTotal}</p>`;

  if (heightTotal) {
    html += `<p><strong>Hauteur totale cible :</strong> ${heightTotal} mm</p>`;
    html += `<p><strong>Plinthe :</strong> ${plinthMm} mm | <strong>Fileur haut :</strong> ${topMm} mm</p>`;
    html += `<p><strong>Corps (cible) :</strong> ${bodyTarget} mm | <strong>Corps (réalisé) :</strong> ${bodyReal} mm
      <span class="tag">jeu vertical ${vGap} mm</span></p>`;
  }

  html += `<p class="hint">
    Profondeur : ${inputs.depthMm} mm | Épaisseur matériau : ${inputs.matThk} mm | Fond : ${inputs.backThk} mm
  </p>`;

  html += `<div class="btnrow" style="margin-top:0.8rem;">
      <button id="exportPngBtn" type="button">Exporter PNG</button>
      <button id="exportPdfBtn" type="button">Exporter PDF (multi-pages)</button>
    </div>`;

  html += `<div id="visual1d"></div>`;
  html += `<div id="scale"></div>`;
  html += `<div id="view2d"></div>`;
  html += `<div id="explodedView"></div>`;

  html += buildDetailTableHtml(moduleWidths, counts);
  html += buildCutListTableHtml(cutList || []);

  html += `</div>`;
  return html;
}

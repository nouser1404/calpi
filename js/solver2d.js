// js/solver2d.js — Optimisation du débit panneaux (calpinage 2D)
// Multi-stratégies + essai des deux orientations panneau + BSSF pour limiter la chute.

/**
 * Pièces en entrée : chantLongueur, chantLargeur (booléens).
 * En sortie chaque pièce placée a : chantLongueur, chantLargeur, rotated, pieceIndex (numéro global).
 */
function solvePanelNesting(panel, pieces, options = {}) {
  const { allowRotation = true } = options;
  const kerf = Math.max(0, Number(panel.sawKerfMm) || 0);
  const panelL = Math.max(1, Number(panel.lengthMm) || 0);
  const panelW = Math.max(1, Number(panel.widthMm) || 0);

  const expanded = [];
  (pieces || []).forEach((p, idx) => {
    const len = Math.max(1, Number(p.lengthMm) || 0);
    const wid = Math.max(1, Number(p.widthMm) || 0);
    const qty = Math.max(0, Math.floor(Number(p.qty) || 0));
    const name = p.name != null ? String(p.name).trim() || `Pièce ${idx + 1}` : `Pièce ${idx + 1}`;
    const id = p.id != null ? p.id : `p${idx}`;
    const hasFour = p.chantTop != null || p.chantRight != null || p.chantBottom != null || p.chantLeft != null;
    const chantTop = hasFour ? !!p.chantTop : !!p.chantLongueur;
    const chantRight = hasFour ? !!p.chantRight : !!p.chantLargeur;
    const chantBottom = hasFour ? !!p.chantBottom : !!p.chantLongueur;
    const chantLeft = hasFour ? !!p.chantLeft : !!p.chantLargeur;
    for (let k = 0; k < qty; k++) {
      expanded.push({
        id,
        name,
        lengthMm: len,
        widthMm: wid,
        originalLength: len,
        originalWidth: wid,
        rotated: false,
        chantTop,
        chantRight,
        chantBottom,
        chantLeft,
        chantLongueur: chantTop || chantBottom,
        chantLargeur: chantLeft || chantRight
      });
    }
  });

  if (expanded.length === 0) {
    return {
      panels: [],
      cutList: [],
      totalWaste: 0,
      totalUsedArea: 0,
      totalPanelArea: 0,
      wastePct: 0,
      panelLengthMm: panelL,
      panelWidthMm: panelW,
      sawKerfMm: kerf
    };
  }

  const sortStrategies = [
    (a, b) => (b.lengthMm * b.widthMm) - (a.lengthMm * a.widthMm),
    (a, b) => Math.max(b.lengthMm, b.widthMm) - Math.max(a.lengthMm, a.widthMm),
    (a, b) => (b.lengthMm + b.widthMm) - (a.lengthMm + a.widthMm),
    (a, b) => b.lengthMm - a.lengthMm || (b.lengthMm * b.widthMm) - (a.lengthMm * a.widthMm),
    (a, b) => b.widthMm - a.widthMm || (b.lengthMm * b.widthMm) - (a.lengthMm * a.widthMm),
    (a, b) => Math.min(b.lengthMm, b.widthMm) - Math.min(a.lengthMm, a.widthMm)
  ];

  let bestResult = null;
  let bestUsed = 0;
  let bestPanels = Infinity;
  let bestBoundary = -1;

  function tryRun(usePanelW, usePanelH) {
    for (const sortFn of sortStrategies) {
      const toPlace = expanded.slice().sort(sortFn);
      const result = runOnePass(usePanelW, usePanelH, kerf, toPlace, allowRotation);
      const used = result.totalUsedArea;
      const numPanels = result.panels.length;
      const boundary = result.totalBoundaryEdges ?? 0;
      const better =
        used > bestUsed ||
        (used === bestUsed && numPanels < bestPanels) ||
        (used === bestUsed && numPanels === bestPanels && boundary > bestBoundary);
      if (better) {
        bestUsed = used;
        bestPanels = numPanels;
        bestBoundary = boundary;
        bestResult = result;
      }
    }
  }

  tryRun(panelL, panelW);
  tryRun(panelW, panelL);

  const res = bestResult || runOnePass(panelL, panelW, kerf, expanded.slice().sort((a, b) => (b.lengthMm * b.widthMm) - (a.lengthMm * a.widthMm)), allowRotation);
  res.panelLengthMm = res.panelLengthMm ?? panelL;
  res.panelWidthMm = res.panelWidthMm ?? panelW;
  res.sawKerfMm = kerf;
  res.wastePct = res.totalPanelArea > 0 ? (100 * res.totalWaste / res.totalPanelArea) : 0;
  return res;
}

function runOnePass(panelW, panelH, kerf, toPlace, allowRotation) {
  const panels = [];
  const cutList = [];
  let pieceIndex = 0;

  function newPanel() {
    panels.push({
      freeRects: [{ x: 0, y: 0, w: panelW, h: panelH }],
      pieces: [],
      usedArea: 0
    });
    return panels[panels.length - 1];
  }

  function placePiece(pan, piece) {
    let bestRect = null;
    let bestShortSide = Infinity;
    let bestAreaWaste = Infinity;
    let bestBoundaryScore = -1;
    let bestRotated = false;
    const pw = piece.lengthMm;
    const ph = piece.widthMm;

    for (const rot of allowRotation ? [false, true] : [false]) {
      const w = rot ? ph : pw;
      const h = rot ? pw : ph;
      for (const r of pan.freeRects) {
        if (r.w >= w && r.h >= h) {
          const shortSide = Math.min(r.w - w, r.h - h);
          const areaWaste = r.w * r.h - w * h;
          const boundaryScore = (r.x === 0 ? 1 : 0) + (r.y === 0 ? 1 : 0) +
            (r.x + w >= panelW - 1e-6 ? 1 : 0) + (r.y + h >= panelH - 1e-6 ? 1 : 0);
          const better =
            shortSide < bestShortSide ||
            (shortSide === bestShortSide && areaWaste < bestAreaWaste) ||
            (shortSide === bestShortSide && areaWaste === bestAreaWaste && boundaryScore > bestBoundaryScore);
          if (better) {
            bestShortSide = shortSide;
            bestAreaWaste = areaWaste;
            bestBoundaryScore = boundaryScore;
            bestRect = r;
            bestRotated = rot;
          }
        }
      }
    }

    if (!bestRect) return false;

    const w = bestRotated ? piece.widthMm : piece.lengthMm;
    const h = bestRotated ? piece.lengthMm : piece.widthMm;
    pieceIndex += 1;

    const placed = {
      ...piece,
      lengthMm: w,
      widthMm: h,
      rotated: bestRotated,
      x: bestRect.x,
      y: bestRect.y,
      pieceIndex
    };
    if (bestRotated) {
      placed.chantTop = piece.chantRight;
      placed.chantRight = piece.chantBottom;
      placed.chantBottom = piece.chantLeft;
      placed.chantLeft = piece.chantTop;
    } else {
      placed.chantTop = piece.chantTop;
      placed.chantRight = piece.chantRight;
      placed.chantBottom = piece.chantBottom;
      placed.chantLeft = piece.chantLeft;
    }
    placed.chantLongueur = placed.chantTop || placed.chantBottom;
    placed.chantLargeur = placed.chantLeft || placed.chantRight;
    pan.pieces.push(placed);
    pan.usedArea += w * h;

    const newFree = [];
    for (const r of pan.freeRects) {
      if (r === bestRect) {
        if (bestRect.w - w > 1e-6) {
          newFree.push({
            x: bestRect.x + w + kerf,
            y: bestRect.y,
            w: bestRect.w - w - kerf,
            h: bestRect.h
          });
        }
        if (bestRect.h - h > 1e-6) {
          newFree.push({
            x: bestRect.x,
            y: bestRect.y + h + kerf,
            w: w + kerf,
            h: bestRect.h - h - kerf
          });
        }
      } else {
        newFree.push(r);
      }
    }
    pan.freeRects = mergeFreeRects(newFree);
    return true;
  }

  function mergeFreeRects(rects) {
    const out = [];
    for (const r of rects) {
      if (r.w < 1e-6 || r.h < 1e-6) continue;
      let merged = false;
      for (const o of out) {
        if (o.x === r.x && o.w === r.w && o.y + o.h + 1e-6 >= r.y && r.y + r.h + 1e-6 >= o.y) {
          o.y = Math.min(o.y, r.y);
          o.h = Math.max(o.y + o.h, r.y + r.h) - o.y;
          merged = true;
          break;
        }
        if (o.y === r.y && o.h === r.h && o.x + o.w + 1e-6 >= r.x && r.x + r.w + 1e-6 >= o.x) {
          o.x = Math.min(o.x, r.x);
          o.w = Math.max(o.x + o.w, r.x + r.w) - o.x;
          merged = true;
          break;
        }
      }
      if (!merged) out.push({ ...r });
    }
    return out;
  }

  let currentPanel = newPanel();
  for (const piece of toPlace) {
    let placed = placePiece(currentPanel, piece);
    if (!placed) {
      currentPanel = newPanel();
      placed = placePiece(currentPanel, piece);
      if (!placed) {
        pieceIndex += 1;
        currentPanel.pieces.push({
          ...piece,
          x: 0,
          y: 0,
          lengthMm: piece.lengthMm,
          widthMm: piece.widthMm,
          rotated: false,
          pieceIndex,
          overflow: true
        });
      }
    }
  }

  const cutMap = new Map();
  panels.forEach(pan => {
    pan.pieces.forEach(p => {
      if (p.overflow) return;
      const key = `${p.name}|${p.originalLength}|${p.originalWidth}`;
      const prev = cutMap.get(key) || { name: p.name, lengthMm: p.originalLength, widthMm: p.originalWidth, qty: 0 };
      prev.qty += 1;
      cutMap.set(key, prev);
    });
  });
  cutMap.forEach(v => cutList.push(v));

  const totalPanelArea = panels.length * panelW * panelH;
  const totalUsedArea = panels.reduce((s, p) => s + p.usedArea, 0);
  const totalWaste = totalPanelArea - totalUsedArea;

  let totalBoundaryEdges = 0;
  let totalPiecesCount = 0;
  panels.forEach(pan => {
    pan.pieces.forEach(p => {
      if (p.overflow) return;
      totalPiecesCount += 1;
      totalBoundaryEdges += (p.x <= 1e-6 ? 1 : 0) + (p.y <= 1e-6 ? 1 : 0) +
        (p.x + p.lengthMm >= panelW - 1e-6 ? 1 : 0) + (p.y + p.widthMm >= panelH - 1e-6 ? 1 : 0);
    });
  });
  const totalCutSegments = totalPiecesCount > 0 ? Math.round((4 * totalPiecesCount - totalBoundaryEdges) / 2) : 0;

  return {
    panels,
    cutList,
    totalWaste,
    totalUsedArea,
    totalPanelArea,
    totalBoundaryEdges,
    totalCutSegments,
    panelLengthMm: panelW,
    panelWidthMm: panelH,
    sawKerfMm: kerf,
    wastePct: totalPanelArea > 0 ? (100 * totalWaste / totalPanelArea) : 0
  };
}

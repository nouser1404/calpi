// js/templates.js
import {
    flattenTriangleBySides,
    circleCircleIntersection,
    pickUpperPoint,
    v2,
    len2,
    sub2
  } from "./flatten.js";
  
  import { dist3, rad2deg, clamp } from "./geometry.js";
  
  export function buildTriangleTemplate2D(model, i) {
    const n = model.base.length;
    const A = model.A;
    const Vi = model.base[i];
    const Vj = model.base[(i + 1) % n];
  
    const base = dist3(Vi, Vj);
    const left = dist3(A, Vi);
    const right = dist3(A, Vj);
  
    const tri = flattenTriangleBySides(base, left, right);
    const Vi2D = tri.A;
    const Vj2D = tri.B;
    const A2D = tri.C;
  
    const apex = angleOppositeSide(base, left, right);
    const baseLeft = angleOppositeSide(right, base, left);
    const baseRight = angleOppositeSide(left, base, right);
  
    return {
      type: "triangle",
      i,
      pts: { Vi2D, Vj2D, A2D },
      lengths: { base, left, right },
      angles: {
        apexDeg: rad2deg(apex),
        baseLeftDeg: rad2deg(baseLeft),
        baseRightDeg: rad2deg(baseRight),
      }
    };
  }
  
  export function buildFrustumTemplate2D(model, i) {
    if (!model.trunc) throw new Error("Pas de tronquage actif.");
  
    const n = model.base.length;
    const Vi = model.base[i];
    const Vj = model.base[(i + 1) % n];
    const Ti = model.trunc[i];
    const Tj = model.trunc[(i + 1) % n];
  
    const baseLow = dist3(Vi, Vj);
    const baseHigh = dist3(Ti, Tj);
    const legI = dist3(Vi, Ti);
    const legJ = dist3(Vj, Tj);
    const diagVjTi = dist3(Vj, Ti);
  
    const Vi2D = v2(0, 0);
    const Vj2D = v2(baseLow, 0);
  
    const triTi = flattenTriangleBySides(baseLow, legI, diagVjTi);
    const Ti2D = triTi.C;
  
    const ints = circleCircleIntersection(Vj2D, legJ, Ti2D, baseHigh);
    const Tj2D = pickUpperPoint(ints);
    if (!Tj2D) throw new Error("Impossible de placer Tj (intersection cercles).");
  
    return {
      type: "frustum",
      i,
      pts: { Vi2D, Vj2D, Ti2D, Tj2D },
      lengths: { baseLow, baseHigh, legI, legJ }
    };
  }
  
  export function templateToSVG(template, options = {}) {
    const units = options.units ?? "mm";
    const margin = options.marginMm ?? 10;
    const stroke = options.stroke ?? "#111";
    const stroke2 = options.stroke2 ?? "#666";
    const text = options.text ?? "#111";
  
    // Nouveaux paramètres
    const annotMode = options.annotMode ?? "none"; // none|delta|bevelFace|bevelTool
    const showEdges = options.showEdges ?? true;
    const model = options.model ?? null;
  
    let pts = [];
    let segments = [];
  
    // segments: { kind, a, b, tag }
    // tag servira à savoir si c'est un "arêtier i" ou une "arête base"
    if (template.type === "triangle") {
      const { Vi2D, Vj2D, A2D } = template.pts;
      pts = [Vi2D, Vj2D, A2D];
  
      // Face i correspond à (Vi, Vj) avec Vj = i+1
      // Arêtiers concernés:
      // - A -> Vi correspond à arêtier i
      // - A -> Vj correspond à arêtier (i+1)
      segments = [
        { kind: "base", a: Vi2D, b: Vj2D, tag: { type: "baseEdge", i: template.i } },
        { kind: "aretier", a: Vj2D, b: A2D, tag: { type: "aretier", i: (template.i + 1) } },
        { kind: "aretier", a: A2D, b: Vi2D, tag: { type: "aretier", i: template.i } },
      ];
    } else {
      const { Vi2D, Vj2D, Ti2D, Tj2D } = template.pts;
      pts = [Vi2D, Vj2D, Tj2D, Ti2D];
  
      // Face i tronquée: Vi->Vj = base basse, Ti->Tj = base haute
      // Montants:
      // - Vi->Ti correspond à arêtier i
      // - Vj->Tj correspond à arêtier i+1
      segments = [
        { kind: "baseLow", a: Vi2D, b: Vj2D, tag: { type: "baseLow", i: template.i } },
        { kind: "aretier", a: Vj2D, b: Tj2D, tag: { type: "aretier", i: (template.i + 1) } },
        { kind: "baseHigh", a: Tj2D, b: Ti2D, tag: { type: "baseHigh", i: template.i } },
        { kind: "aretier", a: Ti2D, b: Vi2D, tag: { type: "aretier", i: template.i } },
      ];
    }
  
    // Bounding box
    const xs = pts.map(p => p.x);
    const ys = pts.map(p => p.y);
    const minX = Math.min(...xs) - margin;
    const maxX = Math.max(...xs) + margin;
    const minY = Math.min(...ys) - margin;
    const maxY = Math.max(...ys) + margin;
    const w = maxX - minX;
    const h = maxY - minY;
  
    const tx = -minX;
    const ty = -minY;
  
    const polyPoints = pts.map(pt => `${pt.x + tx},${pt.y + ty}`).join(" ");
  
    const title = template.type === "triangle"
      ? `Gabarit face ${template.i} (triangle)`
      : `Gabarit face ${template.i} (tronqué)`;
  
    // Cotes longues (au milieu des segments)
    const dimTexts = segments.map((s) => {
      const mid = midpoint(s.a, s.b);
      const L = len2(sub2(s.b, s.a));
      return `<text x="${mid.x + tx}" y="${mid.y + ty - 2}" font-size="4" fill="${text}" text-anchor="middle">${L.toFixed(1)} ${units}</text>`;
    }).join("\n");
  
    // 🔥 Annotations corroyage (texte + éventuellement surlignage)
    const annot = (annotMode !== "none" && model)
      ? buildCorroyageAnnotationsSVG(segments, model, annotMode, tx, ty)
      : "";
  
    // Style: surligner les arêtiers si demandé
    const strokeAretier = showEdges ? "#7c3aed" : stroke; // violet sympa
    const strokeBase = stroke;
  
    const segLines = segments.map((s) => {
      const isAretier = (s.kind === "aretier");
      const col = isAretier ? strokeAretier : strokeBase;
      const w = isAretier && showEdges ? 1.2 : 0.6;
      return `<line x1="${s.a.x + tx}" y1="${s.a.y + ty}" x2="${s.b.x + tx}" y2="${s.b.y + ty}" stroke="${col}" stroke-width="${w}" />`;
    }).join("\n");
  
    const extra = (template.type === "triangle")
      ? `<text x="10" y="12" font-size="5" fill="${text}">Angle au sommet (face): ${template.angles.apexDeg.toFixed(2)}°</text>`
      : "";
  
    const legend = annotMode !== "none"
      ? `<text x="10" y="${h - 16}" font-size="4" fill="${stroke2}">${escapeXML(labelForAnnotMode(annotMode))}</text>`
      : "";
  
    return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg"
       width="${w}${units}" height="${h}${units}"
       viewBox="0 0 ${w} ${h}">
    <title>${escapeXML(title)}</title>
  
    <rect x="0" y="0" width="${w}" height="${h}" fill="white"/>
  
    <g>
      ${segLines}
      <polygon points="${polyPoints}" fill="none" stroke="none"/>
      ${dimTexts}
      ${annot}
    </g>
  
    ${extra}
    ${legend}
    <text x="10" y="${h - 6}" font-size="4" fill="${stroke2}">${escapeXML(title)}</text>
  </svg>`;
  }
  
  function midpoint(a,b){ return { x:(a.x+b.x)/2, y:(a.y+b.y)/2 }; }
  
  function labelForAnnotMode(m){
    if (m === "delta") return "Annotations: dièdre δ sur arêtiers";
    if (m === "bevelFace") return "Annotations: biseau (δ/2) sur arêtiers";
    if (m === "bevelTool") return "Annotations: réglage outil (90° − δ/2) sur arêtiers";
    return "";
  }
  
  /**
   * Construit des textes proches des arêtiers.
   * On place le texte à proximité du milieu de l’arête, avec un petit décalage perpendiculaire.
   */
  function buildCorroyageAnnotationsSVG(segments, model, annotMode, tx, ty){
    const n = model.items.length;
  
    const texts = segments
      .filter(s => s.kind === "aretier" && s.tag?.type === "aretier")
      .map(s => {
        const idx = ((s.tag.i % n) + n) % n;
        const it = model.items[idx];
        if (!it) return "";
  
        let valRad = 0;
        let label = "";
        if (annotMode === "delta") { valRad = it.delta; label = "δ"; }
        if (annotMode === "bevelFace") { valRad = it.bevelFace; label = "δ/2"; }
        if (annotMode === "bevelTool") { valRad = it.bevelTool; label = "outil"; }
  
        const deg = (valRad * 180 / Math.PI);
        const mid = midpoint(s.a, s.b);
  
        // Décalage perpendiculaire (petit)
        const dx = s.b.x - s.a.x;
        const dy = s.b.y - s.a.y;
        const L = Math.sqrt(dx*dx + dy*dy) || 1;
        const ox = (-dy / L) * 6; // 6mm
        const oy = ( dx / L) * 6;
  
        return `<text x="${mid.x + tx + ox}" y="${mid.y + ty + oy}" font-size="4.2" fill="#111" text-anchor="middle">
          Arêtier ${idx} — ${label}: ${deg.toFixed(2)}°
        </text>`;
      })
      .join("\n");
  
    return texts;
  }
  
  
  export function downloadSVG(filename, svgText) {
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  
  function angleOppositeSide(a, b, c) {
    const cosA = clamp((b*b + c*c - a*a) / (2*b*c), -1, 1);
    return Math.acos(cosA);
  }
  
  function escapeXML(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }
  
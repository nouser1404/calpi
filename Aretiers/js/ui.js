import { rad2deg } from "./geometry.js";

export function formatDeg(r){ return `${rad2deg(r).toFixed(2)}°`; }
export function formatMm(v){ return `${v.toFixed(1)} mm`; }

export function renderSummary(el, model, {n,R,H,zCut,dx,dy}){
  el.innerHTML = `
    <span class="badge">n = ${n}</span>
    <span class="badge">R = ${formatMm(R)}</span>
    <span class="badge">H = ${formatMm(H)}</span>
    <span class="badge">D = ${formatMm(model.diameter)}</span>
    <span class="badge">arête base = ${formatMm(model.baseEdge)}</span>
    <span class="badge">dx,dy = ${formatMm(dx)}, ${formatMm(dy)}</span>
    <span class="badge">zCut = ${formatMm(zCut)}</span>
  `;
}

export function renderTable(tbody, model, showToolAngle){
  tbody.innerHTML = "";
  for(const it of model.items){
    const tr = document.createElement("tr");
    tr.dataset.index = String(it.i);
    tr.innerHTML = `
      <td>${it.i}</td>
      <td>${formatMm(it.L)}</td>
      <td>${formatDeg(it.delta)}</td>
      <td>${formatDeg(it.bevelFace)}</td>
      <td>${showToolAngle ? formatDeg(it.bevelTool) : "—"}</td>
    `;
    tbody.appendChild(tr);
  }
}

export function renderDetails(pre, params){
  pre.textContent =
`Méthode (vectorielle, robuste même en désaxé)

1) Sommets base:
   Vi = (R cos(2πi/n), R sin(2πi/n), 0)

2) Apex:
   A = (dx, dy, H)

3) Normale de la face (A, Vi, V(i+1)):
   Ni = (Vi - A) × (V(i+1) - A)

4) Dièdre sur l’arêtier A-Vi:
   Nleft  = normal(A, V(i-1), Vi)
   Nright = normal(A, Vi, V(i+1))
   δi = arccos( (Nleft·Nright) / (|Nleft||Nright|) )

5) Biseau:
   biseau par face = δi/2
   réglage outil   = 90° - δi/2

Tronquage (plan z=zCut):
   Ti = A + t (Vi - A) avec t = (zCut - Az)/(Viz - Az)

Paramètres actuels:
${JSON.stringify(params, null, 2)}
`;
}

export function vec(x,y,z){ return {x,y,z}; }
export function add(a,b){ return vec(a.x+b.x, a.y+b.y, a.z+b.z); }
export function sub(a,b){ return vec(a.x-b.x, a.y-b.y, a.z-b.z); }
export function mul(a,s){ return vec(a.x*s, a.y*s, a.z*s); }
export function dot(a,b){ return a.x*b.x + a.y*b.y + a.z*b.z; }
export function cross(a,b){
  return vec(
    a.y*b.z - a.z*b.y,
    a.z*b.x - a.x*b.z,
    a.x*b.y - a.y*b.x
  );
}
export function norm(a){ return Math.sqrt(dot(a,a)); }
export function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
export function rad2deg(r){ return r*180/Math.PI; }

export function buildBaseVertices(n, R){
  const V = [];
  for(let i=0;i<n;i++){
    const th = (2*Math.PI*i)/n;
    V.push(vec(R*Math.cos(th), R*Math.sin(th), 0));
  }
  return V;
}

export function faceNormal(A, V0, V1){
  // (V0 - A) x (V1 - A)
  return cross(sub(V0,A), sub(V1,A));
}

export function dihedralBetweenFaces(N1, N2){
  const c = clamp(dot(N1,N2)/(norm(N1)*norm(N2)), -1, 1);
  return Math.acos(c);
}

export function intersectSegmentWithZ(A, V, zCut){
  // param t where P = A + t*(V-A), on plane z=zCut
  const dz = V.z - A.z;
  if (Math.abs(dz) < 1e-9) return null;
  const t = (zCut - A.z)/dz;
  return add(A, mul(sub(V,A), t));
}

export function computeModel({n,R,H,dx,dy,zCut}){
  const A = vec(dx,dy,H);
  const base = buildBaseVertices(n,R);

  // optional truncation points
  const trunc = (zCut > 0 && zCut < H)
    ? base.map(Vi => intersectSegmentWithZ(A, Vi, zCut))
    : null;

  // compute dihedral per arêtier at Vi between faces (A,V(i-1),Vi) and (A,Vi,V(i+1))
  const items = [];
  for(let i=0;i<n;i++){
    const Vim1 = base[(i-1+n)%n];
    const Vi   = base[i];
    const Vip1 = base[(i+1)%n];

    const Nleft  = faceNormal(A, Vim1, Vi);
    const Nright = faceNormal(A, Vi, Vip1);

    const delta = dihedralBetweenFaces(Nleft, Nright);
    const L = norm(sub(A, Vi));

    items.push({
      i,
      Vi,
      L,
      delta,
      bevelFace: delta/2,
      bevelTool: (Math.PI/2) - (delta/2),
      Nleft,
      Nright
    });
  }

  const baseEdge = 2*R*Math.sin(Math.PI/n);
  return {
    A, base, trunc,
    baseEdge,
    diameter: 2*R,
    items
  };
}
// js/geometry.js (ajouts)

export function dist3(a, b){
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx*dx + dy*dy + dz*dz);
}


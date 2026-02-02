// js/flatten.js
export function v2(x, y) { return { x, y }; }
export function add2(a, b) { return v2(a.x + b.x, a.y + b.y); }
export function sub2(a, b) { return v2(a.x - b.x, a.y - b.y); }
export function mul2(a, s) { return v2(a.x * s, a.y * s); }
export function dot2(a, b) { return a.x * b.x + a.y * b.y; }
export function len2(a) { return Math.sqrt(dot2(a, a)); }
export function perp2(a) { return v2(-a.y, a.x); }

export function flattenTriangleBySides(a, b, c) {
  if (a <= 0 || b <= 0 || c <= 0) throw new Error("Triangle: côtés invalides.");
  if (b + c <= a || a + c <= b || a + b <= c) throw new Error("Triangle impossible.");

  const A = v2(0, 0);
  const B = v2(a, 0);

  const x = (b * b - c * c + a * a) / (2 * a);
  const y2 = b * b - x * x;
  const y = Math.sqrt(Math.max(0, y2));
  const C = v2(x, y);

  return { A, B, C };
}

export function circleCircleIntersection(C0, r0, C1, r1) {
  const d = len2(sub2(C1, C0));
  if (d < 1e-9) return null;
  if (d > r0 + r1 || d < Math.abs(r0 - r1)) return null;

  const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
  const h2 = r0 * r0 - a * a;
  const h = Math.sqrt(Math.max(0, h2));

  const dir = mul2(sub2(C1, C0), 1 / d);
  const P = add2(C0, mul2(dir, a));
  const per = perp2(dir);

  return {
    P1: add2(P, mul2(per, h)),
    P2: add2(P, mul2(per, -h)),
  };
}

export function pickUpperPoint(ints) {
  if (!ints) return null;
  return (ints.P1.y >= ints.P2.y) ? ints.P1 : ints.P2;
}

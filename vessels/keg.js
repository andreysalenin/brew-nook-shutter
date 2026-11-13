// KegLand 19 L ball-lock keg (KL02899): Ø214 x 629 mm, satin 304 shell, moulded black rubber
// top (two post notches + two hand holes) and rubber foot, oval PRV lid with wire bail.
// Built upright: origin bottom centre, +y up, +z front. Posts sit on the ±x axis.
export const meta = {
  id: 'keg',
  name: 'KegLand 19 L ball-lock keg',
  dims: '19 L ball lock, Ø214 × 629',
  ports: {
    gas: { pos: [-0.074, 0.5815, 0], dir: [0, 1, 0] },
    liquid: { pos: [0.074, 0.5815, 0], dir: [0, 1, 0] },
  },
};
export const defaultOptions = {};

const TAU = Math.PI * 2;
const D2R = Math.PI / 180;

// ---------- dimensions (metres) ----------
const H = 0.629;          // overall height (top of rubber ring)
const RB = 0.106;         // stainless shell radius
const RR = 0.1072;        // rubber top / foot outer radius (Ø214)
const RK = 0.022;         // head knuckle radius
const RC = 0.2;           // head crown radius
const Y_TOPK = 0.505;     // top of straight shell (start of top knuckle)
const Y_BOTK = 0.058;     // bottom of straight shell
const PHI = Math.asin((RB - RK) / (RC - RK)); // knuckle/crown tangency angle
const YC_TOP = Y_TOPK - (RC - RK) * Math.cos(PHI);  // crown centre (top head)
const YC_BOT = Y_BOTK + (RC - RK) * Math.cos(PHI);  // crown centre (bottom head)
const POST_R = 0.074;     // post distance from axis
const LID_SZ = 0.055 / 0.0432; // lid oval: 86 x 110 mm, long axis along z
const PRV = [0, -0.041];  // PRV position on the lid (x, z)

// rubber top ring
const T = {
  y0: 0.499, y1: H, rIn: 0.098, rOut: RR,
  notchAt: [90 * D2R, 270 * D2R], nHw: 18.75 * D2R * RR, nY: 0.53, nRc: 0.014, nRt: 0.006,
  winAt: [0, 180 * D2R], wHw: 30 * D2R * RR, wY0: 0.567, wY1: 0.609,
};
// rubber foot
const B = { y1: 0.058, rIn: 0.095, rOut: RR, slotAt: [0, 90 * D2R, 180 * D2R, 270 * D2R], sHw: 0.0065, sH: 0.018 };

// ---------- small vector helpers ----------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const nrm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const neg = (a) => [-a[0], -a[1], -a[2]];

// ---------- geometry accumulator ----------
const acc = () => ({ p: [], n: [], u: [], i: [] });
function toGeo(THREE, a) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(a.p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(a.n, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(a.u, 2));
  g.setIndex(a.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(a.i, 1) : new THREE.Uint16BufferAttribute(a.i, 1));
  g.computeBoundingBox(); g.computeBoundingSphere();
  g.userData.shared = true; // cached across builds; the app must not dispose it
  return g;
}
// quad P0..P3 (any winding); N = per-vertex normals or null for flat; ref = side it must face
function quad(a, P, N, ref) {
  let c = cross(sub(P[2], P[0]), sub(P[3], P[1]));
  const l = len(c); if (l < 1e-12) return;
  c = mul(c, 1 / l);
  const flip = dot(c, ref) < 0; if (flip) c = neg(c);
  const b = a.p.length / 3;
  for (let k = 0; k < 4; k++) { a.p.push(...P[k]); a.n.push(...(N ? N[k] : c)); a.u.push(0, 0); }
  if (flip) a.i.push(b, b + 2, b + 1, b, b + 3, b + 2); else a.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
}
// profile runs: arrays of [r, y, nr, ny]
const flatRuns = (pts) => pts.slice(0, -1).map((p, k) => {
  const q = pts[k + 1], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy);
  return [[p[0], p[1], dy / l, -dx / l], [q[0], q[1], dy / l, -dx / l]];
});
const smoothRun = (pts) => pts.map((p, k) => {
  let nr = 0, ny = 0;
  for (const [i0, i1] of [[k - 1, k], [k, k + 1]]) {
    if (i0 < 0 || i1 >= pts.length) continue;
    const dx = pts[i1][0] - pts[i0][0], dy = pts[i1][1] - pts[i0][1], l = Math.hypot(dx, dy);
    nr += dy / l; ny += -dx / l;
  }
  const l = Math.hypot(nr, ny) || 1; return [p[0], p[1], nr / l, ny / l];
});
// lathe (theta from +z toward +x, like THREE.LatheGeometry); o.sz scales z (oval), o.x/o.y/o.z offset
function lathe(a, runs, segs, o = {}) {
  const sz = o.sz || 1, ox = o.x || 0, oy = o.y || 0, oz = o.z || 0;
  for (const run of runs) {
    const L = run.length, b = a.p.length / 3;
    for (let j = 0; j <= segs; j++) {
      const t = (j / segs) * TAU, s = Math.sin(t), c = Math.cos(t);
      for (const [r, y, nr, ny] of run) {
        a.p.push(ox + r * s, oy + y, oz + r * c * sz);
        const n = nrm([nr * s, ny, (nr * c) / sz]); a.n.push(...n); a.u.push(j / segs, 0);
      }
    }
    for (let j = 0; j < segs; j++) for (let k = 0; k < L - 1; k++) {
      const p = b + j * L + k, q = b + (j + 1) * L + k;
      if (run[k][0] > 1e-9) a.i.push(p, q, p + 1);
      if (run[k + 1][0] > 1e-9) a.i.push(q, q + 1, p + 1);
    }
  }
}
// Thick cylindrical wall with cut-outs: solid(theta) -> list of [y0, y1] solid intervals.
// Columns between breaks; each column edge is split wherever its neighbour has a vertex (no
// T-junction cracks). bev > 0 rounds both edges of every upward-facing cap.
function wall(a, rIn, rOut, breaks, solid, bev = 0) {
  const E = 1e-7, n = breaks.length - 1;
  const P = (r, t, y) => [r * Math.sin(t), y, r * Math.cos(t)];
  const rad = (t) => [Math.sin(t), 0, Math.cos(t)];
  const mix = (u, v, wu, wv) => nrm(add(mul(u, wu), mul(v, wv)));
  const U = bev ? [rIn, rIn + bev, rOut - bev, rOut] : [rIn, rOut], last = U.length - 1;
  const cOf = (iv) => Math.min(bev, (iv[1] - iv[0]) / 2);
  const prof = (I, st) => I.map((iv) => [iv[0], iv[1] - (st === 0 || st === last ? cOf(iv) : 0)]);
  const inside = (S, y) => S.some(([p, q]) => y > p && y < q);
  const edgeL = [], edgeR = [];
  for (let j = 0; j < n; j++) { edgeL.push(solid(breaks[j] + E)); edgeR.push(solid(breaks[j + 1] - E)); }
  const splits = (y0, y1, nb, st) => {
    const v = [y0, y1];
    for (const iv of prof(nb, st)) for (const y of iv) if (y > y0 + 1e-7 && y < y1 - 1e-7) v.push(y);
    return [...new Set(v)].sort((p, q) => p - q);
  };
  const zip = (L, R, nL, nR, flip) => {
    const b = a.p.length / 3, nl = L.length, nr = R.length;
    for (const p of L) { a.p.push(...p); a.n.push(...nL); a.u.push(0, 0); }
    for (const p of R) { a.p.push(...p); a.n.push(...nR); a.u.push(0, 0); }
    const par = (S) => { const d = S[S.length - 1][1] - S[0][1] || 1; return S.map((p) => (p[1] - S[0][1]) / d); };
    const sL = par(L), sR = par(R);
    const T = (x, y, z) => (flip ? a.i.push(x, z, y) : a.i.push(x, y, z));
    let i = 0, k = 0;
    while (i < nl - 1 || k < nr - 1) {
      if (k === nr - 1 || (i < nl - 1 && sL[i + 1] <= sR[k + 1])) { T(b + i, b + nl + k, b + i + 1); i++; }
      else { T(b + i, b + nl + k, b + nl + k + 1); k++; }
    }
  };
  for (let j = 0; j < n; j++) {
    const tL = breaks[j], tR = breaks[j + 1];
    const IL = edgeL[j], IR = edgeR[j], m = Math.min(IL.length, IR.length);
    const nbL = edgeR[(j - 1 + n) % n], nbR = edgeL[(j + 1) % n];
    const nL = rad(tL), nR = rad(tR), nM = rad((tL + tR) / 2);
    for (let k = 0; k < m; k++) {
      const [aL, bL] = IL[k], [aR, bR] = IR[k], cL = cOf(IL[k]), cR = cOf(IR[k]);
      for (const st of [last, 0]) {
        const r = U[st], yl = splits(aL, bL - cL, nbL, st), yr = splits(aR, bR - cR, nbR, st);
        zip(yl.map((y) => P(r, tL, y)), yr.map((y) => P(r, tR, y)), st ? nL : neg(nL), st ? nR : neg(nR), !st);
      }
      for (let st = 0; st < last; st++) {
        quad(a, [P(U[st], tL, aL), P(U[st + 1], tL, aL), P(U[st + 1], tR, aR), P(U[st], tR, aR)], null, [0, -1, 0]);
      }
      if (!bev) { quad(a, [P(rIn, tL, bL), P(rOut, tL, bL), P(rOut, tR, bR), P(rIn, tR, bR)], null, [0, 1, 0]); continue; }
      let up = nrm(cross(sub(P(rOut, tR, bR), P(rIn, tL, bL)), sub(P(rIn, tR, bR), P(rOut, tL, bL))));
      if (up[1] < 0) up = neg(up);
      const oL = rOut - bev, iL = rIn + bev;
      quad(a, [P(rOut, tL, bL - cL), P(rOut, tR, bR - cR), P(oL, tR, bR), P(oL, tL, bL)],
        [mix(nL, up, 0.9, 0.42), mix(nR, up, 0.9, 0.42), mix(nR, up, 0.42, 0.9), mix(nL, up, 0.42, 0.9)], mix(nM, up, 1, 1));
      quad(a, [P(iL, tL, bL), P(oL, tL, bL), P(oL, tR, bR), P(iL, tR, bR)], null, up);
      quad(a, [P(rIn, tL, bL - cL), P(rIn, tR, bR - cR), P(iL, tR, bR), P(iL, tL, bL)],
        [mix(neg(nL), up, 0.9, 0.42), mix(neg(nR), up, 0.9, 0.42), mix(neg(nR), up, 0.42, 0.9), mix(neg(nL), up, 0.42, 0.9)], mix(neg(nM), up, 1, 1));
    }
  }
  // radial faces where the solid changes across a column boundary (follow the bevelled profile)
  const xor = (PA, PB) => {
    const ev = [...new Set([...PA.flat(), ...PB.flat()])].sort((p, q) => p - q), out = [];
    for (let k = 0; k < ev.length - 1; k++) {
      const u = ev[k], v = ev[k + 1]; if (v - u < 1e-7) continue;
      const mid = (u + v) / 2, inA = inside(PA, mid);
      if (inA === inside(PB, mid)) continue;
      const lst = out[out.length - 1];
      if (lst && lst[2] === inA && Math.abs(lst[1] - u) < 1e-7) lst[1] = v; else out.push([u, v, inA]);
    }
    return out;
  };
  for (let j = 0; j < n; j++) {
    const t = breaks[j], A = edgeR[(j - 1 + n) % n], Bs = edgeL[j];
    const tan = [Math.cos(t), 0, -Math.sin(t)];
    for (let st = 0; st < last; st++) {
      const S0 = xor(prof(A, st), prof(Bs, st)), S1 = xor(prof(A, st + 1), prof(Bs, st + 1));
      if (S0.length !== S1.length) continue;
      for (let k = 0; k < S0.length; k++) {
        if (S0[k][2] !== S1[k][2]) continue;
        quad(a, [P(U[st], t, S0[k][0]), P(U[st + 1], t, S1[k][0]), P(U[st + 1], t, S1[k][1]), P(U[st], t, S0[k][1])], null, S0[k][2] ? tan : neg(tan));
      }
    }
  }
}
function makeBreaks(n, extra) {
  const br = [];
  for (let j = 0; j <= n; j++) br.push((j * TAU) / n);
  for (let t of extra) { t = ((t % TAU) + TAU) % TAU; br.push(t); }
  br.sort((p, q) => p - q);
  const out = [];
  for (const t of br) if (!out.length || t - out[out.length - 1] > 1e-6) out.push(t);
  out[out.length - 1] = TAU;
  return out;
}
const angDist = (t, c) => { const d = (((t - c) % TAU) + TAU) % TAU; return d > Math.PI ? TAU - d : d; };
// tube along a polyline (parallel-transport frames)
function tube(a, pts, r, m) {
  const n = pts.length;
  const Tn = pts.map((p, k) => nrm(sub(pts[Math.min(n - 1, k + 1)], pts[Math.max(0, k - 1)])));
  let N = Math.abs(Tn[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  N = nrm(sub(N, mul(Tn[0], dot(N, Tn[0]))));
  const b = a.p.length / 3;
  for (let k = 0; k < n; k++) {
    if (k) { N = sub(N, mul(Tn[k], dot(N, Tn[k]))); N = nrm(N); }
    const Bv = cross(Tn[k], N);
    for (let s = 0; s <= m; s++) {
      const ang = (s / m) * TAU, d = add(mul(N, Math.cos(ang)), mul(Bv, Math.sin(ang)));
      a.p.push(...add(pts[k], mul(d, r))); a.n.push(...d); a.u.push(0, 0);
    }
  }
  for (let k = 0; k < n - 1; k++) for (let s = 0; s < m; s++) {
    const a0 = b + k * (m + 1) + s, a1 = a0 + m + 1;
    a.i.push(a0, a0 + 1, a1, a1, a0 + 1, a1 + 1);
  }
}
// round the interior corners of a polyline
function fillet(pts, rad, steps) {
  const out = [pts[0]];
  for (let k = 1; k < pts.length - 1; k++) {
    const p = pts[k], va = sub(pts[k - 1], p), vb = sub(pts[k + 1], p);
    const la = len(va), lb = len(vb), ua = mul(va, 1 / la), ub = mul(vb, 1 / lb);
    const ang = Math.acos(Math.max(-1, Math.min(1, dot(ua, ub))));
    if (ang > Math.PI - 0.02) { out.push(p); continue; }
    const d = Math.min(rad / Math.tan(ang / 2), la * 0.45, lb * 0.45);
    const p1 = add(p, mul(ua, d)), p2 = add(p, mul(ub, d));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, w0 = (1 - t) * (1 - t), w1 = 2 * t * (1 - t), w2 = t * t;
      out.push(add(add(mul(p1, w0), mul(p, w1)), mul(p2, w2)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
// append a THREE geometry transformed by matrix m
function addGeo(THREE, a, geo, m) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const nm = new THREE.Matrix3().getNormalMatrix(m), v = new THREE.Vector3(), b = a.p.length / 3;
  for (let k = 0; k < pos.count; k++) {
    v.fromBufferAttribute(pos, k).applyMatrix4(m); a.p.push(v.x, v.y, v.z);
    v.fromBufferAttribute(nor, k).applyMatrix3(nm).normalize(); a.n.push(v.x, v.y, v.z); a.u.push(0, 0);
  }
  if (geo.index) for (let k = 0; k < geo.index.count; k++) a.i.push(b + geo.index.getX(k));
  else for (let k = 0; k < pos.count; k++) a.i.push(b + k);
  geo.dispose();
}
function flatGeo(geo) { const g = geo.toNonIndexed(); geo.dispose(); g.computeVertexNormals(); return g; }

// ---------- the parts ----------
function shellGeo(THREE) {
  const a = acc();
  const run = [];
  // bottom crown (from centre outward), bottom knuckle, straight shell, top knuckle, top crown
  for (let k = 0; k <= 2; k++) { const b = (PHI * k) / 2; run.push([RC * Math.sin(b), YC_BOT - RC * Math.cos(b), Math.sin(b), -Math.cos(b)]); }
  for (let k = 1; k <= 3; k++) { const al = -(Math.PI / 2 - PHI) * (1 - k / 3); run.push([RB - RK + RK * Math.cos(al), Y_BOTK + RK * Math.sin(al), Math.cos(al), Math.sin(al)]); }
  for (let k = 0; k <= 4; k++) { const al = ((Math.PI / 2 - PHI) * k) / 4; run.push([RB - RK + RK * Math.cos(al), Y_TOPK + RK * Math.sin(al), Math.cos(al), Math.sin(al)]); }
  const bMin = Math.asin(0.038 / RC);
  for (let k = 1; k <= 4; k++) { const b = PHI + ((bMin - PHI) * k) / 4; run.push([RC * Math.sin(b), YC_TOP + RC * Math.cos(b), Math.sin(b), Math.cos(b)]); }
  lathe(a, [run], 64);
  return toGeo(THREE, a);
}

function rubberGeo(THREE) {
  const a = acc();
  // top ring
  const ex = [];
  for (const c of T.notchAt) for (const s of [-1, 1]) {
    for (let k = 0; k <= 4; k++) ex.push(c + (s * (T.nHw - T.nRc + T.nRc * Math.sin((k / 4) * Math.PI / 2))) / T.rOut);
    for (let k = 1; k <= 3; k++) ex.push(c + (s * (T.nHw + T.nRt - T.nRt * Math.cos((k / 3) * Math.PI / 2))) / T.rOut);
  }
  const re = (T.wY1 - T.wY0) / 2;
  for (const c of T.winAt) for (const s of [-1, 1]) for (let k = 0; k <= 4; k++) ex.push(c + (s * (T.wHw - re + re * Math.sin((k / 4) * Math.PI / 2))) / T.rOut);
  const topSolid = (t) => {
    let top = T.y1;
    for (const c of T.notchAt) {
      const d = angDist(t, c) * T.rOut;
      if (d < T.nHw) { const e = d - (T.nHw - T.nRc); top = Math.min(top, T.nY + (e > 0 ? T.nRc - Math.sqrt(Math.max(0, T.nRc * T.nRc - e * e)) : 0)); }
      else if (d < T.nHw + T.nRt) { const e = T.nHw + T.nRt - d; top = Math.min(top, T.y1 - T.nRt + Math.sqrt(Math.max(0, T.nRt * T.nRt - e * e))); }
    }
    let iv = [[T.y0, top]];
    for (const c of T.winAt) {
      const d = angDist(t, c) * T.rOut;
      if (d < T.wHw) { const ym = (T.wY0 + T.wY1) / 2, e = d - (T.wHw - re), hh = e > 0 ? Math.sqrt(Math.max(0, re * re - e * e)) : re; iv = [[T.y0, ym - hh], [ym + hh, top]]; }
    }
    return iv;
  };
  wall(a, T.rIn, T.rOut, makeBreaks(96, ex), topSolid, 0.003);
  // foot
  const exb = [];
  for (const c of B.slotAt) for (const s of [-1, 1]) for (let k = 0; k <= 4; k++) exb.push(c + (s * B.sHw * Math.sin((k / 4) * Math.PI / 2)) / B.rOut);
  // U-shaped drain slots in the bottom edge (semicircular top)
  const footSolid = (t) => {
    for (const c of B.slotAt) { const d = angDist(t, c) * B.rOut; if (d < B.sHw) return [[B.sH - B.sHw + Math.sqrt(B.sHw * B.sHw - d * d), B.y1]]; }
    return [[0, B.y1]];
  };
  wall(a, B.rIn, B.rOut, makeBreaks(64, exb), footSolid);
  return toGeo(THREE, a);
}

function steelGeo(THREE) {
  const a = acc();
  const M = (x, y, z, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
  // weld beads: circumferential (head-to-shell) seams
  for (const ys of [0.082, 0.482]) {
    lathe(a, [smoothRun([[RB - 0.0002, ys - 0.0018], [RB + 0.0006, ys], [RB - 0.0002, ys + 0.0018]])], 64);
  }
  // longitudinal seam: a narrow raised strip at the back-left
  {
    const t0 = 200 * D2R, w = 0.0018 / RB, r0 = RB - 0.0002, r1 = RB + 0.00025, y0 = B.y1, y1 = T.y0;
    const P = (r, t, y) => [r * Math.sin(t), y, r * Math.cos(t)], rd = (t) => [Math.sin(t), 0, Math.cos(t)];
    quad(a, [P(r1, t0 - w, y0), P(r1, t0 + w, y0), P(r1, t0 + w, y1), P(r1, t0 - w, y1)], [rd(t0 - w), rd(t0 + w), rd(t0 + w), rd(t0 - w)], rd(t0));
    for (const s of [-1, 1]) {
      const t = t0 + s * w, tn = mul([Math.cos(t), 0, -Math.sin(t)], s);
      quad(a, [P(r0, t, y0), P(r1, t, y0), P(r1, t, y1), P(r0, t, y1)], null, tn);
    }
  }
  // lid opening collar (pressed oval lip in the top head) and lid
  lathe(a, [smoothRun([[0.057, 0.533], [0.0556, 0.5455], [0.0522, 0.5512], [0.048, 0.5533], [0.0449, 0.5527], [0.0437, 0.5505]]), ...flatRuns([[0.0437, 0.5505], [0.0437, 0.538]])], 36, { sz: LID_SZ });
  lathe(a, [...flatRuns([[0.0432, 0.538], [0.0432, 0.5488]]), smoothRun([[0.0432, 0.5488], [0.0405, 0.5503], [0.03, 0.5509], [0, 0.5513]])], 36, { sz: LID_SZ });
  // bail: wire loop lying along the lid's long axis, pivoting in two ears near the -z end
  const yb = 0.5535, zp = -0.024;
  const bail = fillet([
    [-0.0212, 0.556, zp], [-0.016, 0.556, zp], [-0.016, yb, zp + 0.01], [-0.016, yb, 0.03], [-0.016, 0.5595, 0.046],
    [0.016, 0.5595, 0.046], [0.016, yb, 0.03], [0.016, yb, zp + 0.01], [0.016, 0.556, zp], [0.0212, 0.556, zp],
  ], 0.0045, 3);
  tube(a, bail, 0.0024, 6);
  for (const s of [-1, 1]) addGeo(THREE, a, new THREE.BoxGeometry(0.003, 0.0085, 0.011), M(s * 0.0227, 0.5545, zp));
  addGeo(THREE, a, new THREE.CylinderGeometry(0.0014, 0.0014, 0.051, 8), M(0, 0.556, zp, 0, 0, Math.PI / 2));
  addGeo(THREE, a, new THREE.BoxGeometry(0.012, 0.004, 0.012), M(0, 0.5525, zp));
  // PRV at the -z end of the lid: hex nut + stem + pull ring (grey cap is a separate mesh)
  const px = PRV[0], pz = PRV[1];
  addGeo(THREE, a, flatGeo(new THREE.CylinderGeometry(0.0062, 0.0062, 0.0034, 6)), M(px, 0.5520, pz));
  addGeo(THREE, a, new THREE.CylinderGeometry(0.0011, 0.0011, 0.003, 8), M(px, 0.5598, pz));
  {
    const R = 0.007, t = Math.asin((0.5602 - 0.5521) / (2 * R));
    const dir = [Math.cos(t), -Math.sin(t), 0];
    const ctr = add([px, 0.5602, pz], mul(dir, R));
    const ring = new THREE.TorusGeometry(R, 0.0011, 6, 20);
    const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(...dir), new THREE.Vector3(0, 0, 1), new THREE.Vector3(...cross(dir, [0, 0, 1])));
    m.setPosition(...ctr);
    addGeo(THREE, a, ring, m);
  }
  // ball-lock posts: welded boss, hex (gas hex notched), ball-lock body
  for (const [x, gas] of [[-POST_R, true], [POST_R, false]]) {
    addGeo(THREE, a, new THREE.CylinderGeometry(0.0115, 0.0115, 0.0185, 12, 1, true), M(x, 0.5355, 0));
    const hx = (h, y) => addGeo(THREE, a, flatGeo(new THREE.CylinderGeometry(0.0127, 0.0127, h, 6)), M(x, y, 0, 0, Math.PI / 6, 0));
    if (gas) {
      hx(0.0037, 0.5445 + 0.00185); hx(0.0037, 0.5545 - 0.00185);
      lathe(a, flatRuns([[0.0104, 0.5482], [0.0104, 0.5508]]), 12, { x });
    } else hx(0.010, 0.5495);
    lathe(a, flatRuns([
      [0.0092, 0.5545], [0.0092, 0.5562], [0.0085, 0.557], [0.0085, 0.5702], [0.0074, 0.5714], [0.0074, 0.5738],
      [0.0085, 0.575], [0.0085, 0.5797], [0.0079, 0.5815], [0.0044, 0.5815], [0.004, 0.5805], [0.004, 0.5788],
      [0.0029, 0.5788], [0.0029, 0.58], [0, 0.5801],
    ]), 12, { x });
  }
  return toGeo(THREE, a);
}

function prvCapGeo(THREE) {
  const a = acc();
  lathe(a, flatRuns([[0.0052, 0.5534], [0.0052, 0.5577], [0.0044, 0.5589], [0, 0.5589]]), 16, { x: PRV[0], z: PRV[1] });
  return toGeo(THREE, a);
}

const LBL = { w: 0.075, h: 0.105, y: 0.33, t: 0 };
function labelGeo(THREE) {
  const a = acc(), r = RB + 0.0005, n = 12, tw = LBL.w / r;
  const b = a.p.length / 3;
  for (let k = 0; k <= n; k++) {
    const t = LBL.t - tw / 2 + (tw * k) / n, s = Math.sin(t), c = Math.cos(t);
    for (const [y, v] of [[LBL.y - LBL.h / 2, 0], [LBL.y + LBL.h / 2, 1]]) { a.p.push(r * s, y, r * c); a.n.push(s, 0, c); a.u.push(k / n, v); }
  }
  for (let k = 0; k < n; k++) { const p = b + k * 2; a.i.push(p, p + 2, p + 1, p + 2, p + 3, p + 1); }
  return toGeo(THREE, a);
}

function drawLabel(g, w, h) {
  const rr = (x, y, W, Hh, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + W, y, x + W, y + Hh, r); g.arcTo(x + W, y + Hh, x, y + Hh, r); g.arcTo(x, y + Hh, x, y, r); g.arcTo(x, y, x + W, y, r); g.closePath(); };
  g.clearRect(0, 0, w, h);
  rr(2, 2, w - 4, h - 4, 10); g.fillStyle = '#f6f5f0'; g.fill();
  g.save(); rr(2, 2, w - 4, h - 4, 10); g.clip();
  g.fillStyle = '#f0c12e'; g.fillRect(0, 0, w, 50);
  g.fillStyle = '#e2701d'; rr(-12, 6, 136, 38, 15); g.fill();
  g.fillStyle = '#ffffff'; g.font = 'italic 700 27px Arial, Helvetica, sans-serif'; g.textBaseline = 'alphabetic'; g.fillText('KegLand', 10, 35);
  g.fillStyle = '#ffffff'; rr(134, 14, 112, 24, 12); g.fill();
  g.fillStyle = '#8b6c10'; g.font = '700 12px Arial, Helvetica, sans-serif'; g.fillText('BEVERAGE TAG', 145, 31);
  // watermark logo
  g.save(); g.translate(w * 0.5, h * 0.64); g.rotate(-0.9);
  g.strokeStyle = 'rgba(64,104,188,0.6)'; g.lineWidth = 1.8; g.font = 'italic 700 60px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.strokeText('KegLand', 0, 20);
  g.restore();
  // form
  g.strokeStyle = '#80838b'; g.lineWidth = 1.5; g.fillStyle = '#43464e'; g.font = '700 11px Arial, Helvetica, sans-serif';
  g.fillText('BEER / STYLE', 12, 68);
  g.beginPath(); g.moveTo(12, 88); g.lineTo(w - 12, 88); g.stroke();
  g.strokeRect(12, 98, w - 24, 36);
  g.beginPath(); for (const x of [88, 168]) { g.moveTo(x, 98); g.lineTo(x, 134); } g.stroke();
  g.font = '700 10px Arial, Helvetica, sans-serif'; g.fillText('OG', 17, 110); g.fillText('FG', 93, 110); g.fillText('ABV', 173, 110);
  const xm = Math.round(w * 0.42);
  g.beginPath(); g.moveTo(xm, 146); g.lineTo(xm, h - 46); g.stroke();
  g.fillText('BREWED', 14, 160); g.fillText('KEGGED', 14, 206); g.fillText('NOTES', xm + 6, 160);
  g.beginPath();
  for (let y = 180; y < h - 50; y += 23) { g.moveTo(14, y); g.lineTo(xm - 8, y); g.moveTo(xm + 8, y); g.lineTo(w - 14, y); }
  g.stroke();
  g.font = '9px Arial, Helvetica, sans-serif'; g.fillText('kegland.com.au', 14, h - 18);
  g.fillStyle = '#1d1f24'; let x = w - 86;
  for (let k = 0; k < 26; k++) { const bw = 1 + ((k * 7) % 3); g.fillRect(x, h - 38, bw, 24); x += bw + 1.5; }
  g.restore();
}

// ---------- cache (geometry + extra materials are built once per THREE instance) ----------
let CACHE = null;
function cache(THREE, ctx) {
  if (CACHE && CACHE.THREE === THREE) return CACHE;
  const tex = ctx.labelTex(256, 360, drawLabel);
  CACHE = {
    THREE,
    geo: { shell: shellGeo(THREE), rubber: rubberGeo(THREE), steel: steelGeo(THREE), prv: prvCapGeo(THREE), label: labelGeo(THREE) },
    mat: {
      prv: new THREE.MeshStandardMaterial({ color: 0xa9adb1, roughness: 0.45, metalness: 0 }),
      label: new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }),
    },
  };
  return CACHE;
}

export function build(THREE, ctx, opts = {}) {
  const C = cache(THREE, ctx), M = ctx.MAT;
  const g = new THREE.Group(); g.name = 'keg';
  const mesh = (geo, mat, name) => { const m = new THREE.Mesh(geo, mat); m.name = name; g.add(m); return m; };
  ctx.core(mesh(C.geo.shell, M.ss, 'shell'));
  mesh(C.geo.rubber, M.black, 'rubber');
  mesh(C.geo.steel, M.ss, 'fittings');
  mesh(C.geo.prv, C.mat.prv, 'prvCap');
  mesh(C.geo.label, C.mat.label, 'sticker');
  return g;
}

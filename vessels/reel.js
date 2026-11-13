// 25 m heavy-duty extension cord reel (Australian 10 A, 4 outlets), user's unit is BLUE.
// Modelled on the user's reference photo (orange version of the same moulding) and typical AU 25 m
// 4-outlet reels (Click / Ultracharge / generic W125683): Ø280 mm drum flanges, ~230 deep, ~330 wide
// incl. frame, ~4.4-4.75 kg, 25 m of 3-core 1.0 mm² heavy-duty lead (Ø~8 mm).
// Construction (from the photo): the drum is cantilevered on an axle from ONE rear upright; the base is a
// rounded-rectangle loop of black tube on the floor, the upright rises from the middle of its rear bar and
// bends forward into the ribbed carry grip, which ends in a flat moulded paddle over the front flange.
// Front flange: raised bezel around a recessed black panel with 4 AU 3-pin sockets in a (slightly
// rotated) diamond, 2 red overload/reset buttons, a black rocker switch; black text band
// "25M HEAVY DUTY EXTENSION LEAD" following the rim; small black winding knob near the rim (upper left).
// Cable: blue, like the user's reel, clear moulded AU plug hanging at the front right.
// Origin bottom centre, +y up, +z front (socket panel faces +z), metres. Drum axis along z.
export const meta = {
  id: 'reel',
  name: '25 m heavy-duty extension cord reel (blue, 4 × 10 A AU outlets)',
  dims: 'Ø280 flanges, 149 across the flange rims; frame 288 W × 232 D × 371 H (317 W incl. hanging plug); 25 m blue 10 A lead',
  color: 'blue flanges, black frame and handle, blue lead',
};
export const defaultOptions = {};

const TAU = Math.PI * 2;
const D2R = Math.PI / 180;

// ---------- dimensions (metres) ----------
const YA = 0.166;          // axle height
const RF = 0.14;           // flange radius (Ø280)
const ZI = 0.060;          // flange inner face (drum is 120 mm between flanges)
const ZO = 0.066;          // flange outer face (6 mm moulding)
const RCAB = 0.0042;       // cable radius (Ø8.4 heavy-duty 1.0 mm² 3-core)
const RL1 = 0.0995;        // first visible layer (centre radius)
const RL2 = RL1 + 0.0080;  // partial top layer
const ZM = 0.0556;         // helix z limit (centre line)
const N1 = 14, N2 = 6.5;   // turns in the two visible layers
const TH_END = 60 * D2R;   // where the free end leaves the drum
const ZU = -0.095;         // rear upright (tube centre)
const YH = 0.352;          // carry grip axis height
const TR = 0.009;          // frame tube radius (Ø18)
const BX = 0.135, BZF = 0.115; // base loop half width / front bar z
const PLUG = [0.157, 0.127, 0.05]; // top of the plug boot
const PANEL_R = 0.080, PANEL_Z = 0.064;
const SOCK_R = 0.018, SOCK_RING = 0.045;
const SOCK_ANG = [75, 165, 255, 345];
const KNOB = { r: 0.118, a: 141 * D2R };

// ---------- vector helpers ----------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const nrm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// ---------- geometry accumulator ----------
const acc = () => ({ p: [], n: [], u: [], i: [] });
function toGeo(THREE, a) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(a.p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(a.n, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(a.u, 2));
  g.setIndex(a.i);
  return g;
}
// profile runs: arrays of [r, y, nr, ny]; walk the profile with the solid on the LEFT (r right, y up)
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
// lathe about y (theta from +z toward +x); o.sz scales z (oval)
function lathe(a, runs, segs, o = {}) {
  const sz = o.sz || 1;
  for (const run of runs) {
    const L = run.length, b = a.p.length / 3;
    for (let j = 0; j <= segs; j++) {
      const t = (j / segs) * TAU, s = Math.sin(t), c = Math.cos(t);
      for (const [r, y, nr, ny] of run) {
        a.p.push(r * s, y, r * c * sz);
        a.n.push(...nrm([nr * s, ny, (nr * c) / sz])); a.u.push(j / segs, 0);
      }
    }
    for (let j = 0; j < segs; j++) for (let k = 0; k < L - 1; k++) {
      const p = b + j * L + k, q = b + (j + 1) * L + k;
      if (run[k][0] > 1e-9) a.i.push(p, q, p + 1);
      if (run[k + 1][0] > 1e-9) a.i.push(q, q + 1, p + 1);
    }
  }
}
// tube along a polyline (parallel-transport frames)
function tube(a, pts, r, m) {
  const n = pts.length;
  const Tn = pts.map((p, k) => nrm(sub(pts[Math.min(n - 1, k + 1)], pts[Math.max(0, k - 1)])));
  let N = Math.abs(Tn[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  N = nrm(sub(N, mul(Tn[0], dot(N, Tn[0]))));
  const b = a.p.length / 3;
  for (let k = 0; k < n; k++) {
    if (k) N = nrm(sub(N, mul(Tn[k], dot(N, Tn[k]))));
    const Bv = cross(Tn[k], N);
    for (let s = 0; s <= m; s++) {
      const ang = (s / m) * TAU, d = add(mul(N, Math.cos(ang)), mul(Bv, Math.sin(ang)));
      a.p.push(...add(pts[k], mul(d, r))); a.n.push(...d); a.u.push(s / m, k / n);
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
    const d = Math.min(rad / Math.tan(ang / 2), la * 0.48, lb * 0.48);
    const p1 = add(p, mul(ua, d)), p2 = add(p, mul(ub, d));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, w0 = (1 - t) * (1 - t), w1 = 2 * t * (1 - t), w2 = t * t;
      out.push(add(add(mul(p1, w0), mul(p, w1)), mul(p2, w2)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
// merge a list of BufferGeometries (indexed or not) into one indexed geometry
function merge(THREE, list) {
  let nv = 0, ni = 0;
  for (const q of list) { nv += q.attributes.position.count; ni += q.index ? q.index.count : q.attributes.position.count; }
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = new Float32Array(nv * 2);
  const I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let vo = 0, io = 0;
  for (const q of list) {
    if (!q.attributes.normal) q.computeVertexNormals();
    const at = q.attributes, c = at.position.count;
    P.set(at.position.array.subarray(0, c * 3), vo * 3);
    N.set(at.normal.array.subarray(0, c * 3), vo * 3);
    if (at.uv) U.set(at.uv.array.subarray(0, c * 2), vo * 2);
    if (q.index) { const ix = q.index.array; for (let k = 0; k < ix.length; k++) I[io++] = ix[k] + vo; }
    else for (let k = 0; k < c; k++) I[io++] = k + vo;
    vo += c; q.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  out.setIndex(new THREE.BufferAttribute(I, 1));
  out.computeBoundingBox(); out.computeBoundingSphere();
  out.userData.shared = true; // cached across builds; the app must not dispose it
  return out;
}

// ---------- textures ----------
const BLUE_CSS = '#2558bd';
function drawRing(g, w, h) {
  // ring decal: outer radius 0.128 m maps to the canvas edge
  const S = (w / 2) / 0.128, cx = w / 2, cy = h / 2;
  g.clearRect(0, 0, w, h);
  const text = '25M HEAVY DUTY EXTENSION LEAD';
  const rMid = 0.1055 * S, fs = Math.round(0.0215 * S);
  g.font = `900 ${fs}px "Arial Black", Impact, Arial, Helvetica, sans-serif`;
  const track = 0.0016 * S; // letter spacing
  const widths = [...text].map((ch) => (ch === ' ' ? fs * 0.42 : g.measureText(ch).width) + track);
  const total = widths.reduce((s, v) => s + v, 0) / rMid; // radians
  const th0 = total / 2 - 2 * D2R; // start angle (upper left), text runs clockwise, centred near 3 o'clock
  // black band behind the text
  g.strokeStyle = '#141416'; g.lineCap = 'round'; g.lineWidth = 0.0315 * S;
  g.beginPath(); g.arc(cx, cy, rMid, -(th0 + 0.035), -(th0 - total - 0.035), false); g.stroke();
  // letters, tops pointing outward
  g.fillStyle = BLUE_CSS; g.textAlign = 'center'; g.textBaseline = 'middle';
  let th = th0;
  [...text].forEach((ch, k) => {
    const c = th - widths[k] / 2 / rMid;
    g.save(); g.translate(cx + rMid * Math.cos(c), cy - rMid * Math.sin(c)); g.rotate(Math.PI / 2 - c);
    g.fillText(ch, 0, fs * 0.04); g.restore();
    th -= widths[k] / rMid;
  });
  // pictograms on the left (not suitable for wet use / unwind fully / 4 outlets)
  const icon = (a, kind) => {
    const r = 0.106 * S, x = cx + r * Math.cos(a * D2R), y = cy - r * Math.sin(a * D2R), R = 0.0085 * S;
    g.save(); g.translate(x, y); g.rotate(Math.PI / 2 - a * D2R);
    g.strokeStyle = '#141416'; g.fillStyle = '#141416'; g.lineWidth = 0.0013 * S;
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.stroke();
    if (kind === 0) { // drum with cable
      g.beginPath(); g.arc(0, 0, R * 0.55, 0, TAU); g.stroke(); g.beginPath(); g.arc(0, 0, R * 0.2, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(-R * 0.85, R * 0.85); g.lineTo(R * 0.85, -R * 0.85); g.stroke();
    } else if (kind === 1) { // rain drop crossed
      g.beginPath(); g.moveTo(0, -R * 0.6); g.quadraticCurveTo(R * 0.55, R * 0.1, 0, R * 0.55); g.quadraticCurveTo(-R * 0.55, R * 0.1, 0, -R * 0.6); g.fill();
      g.beginPath(); g.moveTo(-R * 0.85, R * 0.85); g.lineTo(R * 0.85, -R * 0.85); g.stroke();
    } else { // "4 OUTLETS"
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `900 ${Math.round(R * 1.15)}px Arial, sans-serif`; g.fillText('4', 0, R * 0.05);
      g.font = `700 ${Math.round(R * 0.32)}px Arial, sans-serif`; g.fillText('OUTLETS', 0, -R * 0.68);
    }
    g.restore();
  };
  icon(166, 0); icon(188, 1); icon(210, 2);
}
function drawPanel(g, w, h) {
  const S = (w / 2) / PANEL_R, cx = w / 2, cy = h / 2;
  g.fillStyle = '#1d1d20'; g.fillRect(0, 0, w, h);
  // faint moulding ring
  g.strokeStyle = '#26262a'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 0.075 * S, 0, TAU); g.stroke();
  const arcText = (txt, r, aMid, size) => { // clockwise along the top, tops outward
    g.font = `700 ${size}px Arial, Helvetica, sans-serif`; g.fillStyle = '#d9d9d9'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const ws = [...txt].map((ch) => g.measureText(ch).width + 0.6), tot = ws.reduce((s, v) => s + v, 0) / (r * S);
    let th = aMid + tot / 2;
    [...txt].forEach((ch, k) => {
      const c = th - ws[k] / 2 / (r * S);
      g.save(); g.translate(cx + r * S * Math.cos(c), cy - r * S * Math.sin(c)); g.rotate(Math.PI / 2 - c); g.fillText(ch, 0, 0); g.restore();
      th -= ws[k] / (r * S);
    });
  };
  arcText('DO NOT OPERATE UNLESS CORD FULLY UNWOUND', 0.0705, 90 * D2R, 11);
  arcText('MAX LOAD 10A 2400W  240V~', 0.0705, 202 * D2R, 10);
  // labels next to the reset buttons
  g.font = '700 10px Arial, sans-serif'; g.fillStyle = '#d9d9d9'; g.textAlign = 'center';
  const lab = (px, py, t1, t2) => { const x = cx + px * S, y = cy - py * S; g.fillText(t1, x, y - 6); g.fillText(t2, x, y + 6); };
  lab(0.0228, 0.0372, 'PUSH TO', 'RESET');
  lab(-0.0005, 0.0145, 'OVERLOAD', 'RESET');
  // switch marks
}
function drawSocket(g, w, h) {
  const S = (w / 2) / SOCK_R, cx = w / 2, cy = h / 2;
  g.fillStyle = '#7d8086'; g.fillRect(0, 0, w, h);
  const grd = g.createRadialGradient(cx, cy, 0, cx, cy, w / 2);
  grd.addColorStop(0, '#8a8d93'); grd.addColorStop(0.86, '#83868c'); grd.addColorStop(0.93, '#9a9da2'); grd.addColorStop(1, '#6f7278');
  g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, w / 2, 0, TAU); g.fill();
  const slot = (x, y, ang, L, W) => {
    g.save(); g.translate(cx + x * S, cy - y * S); g.rotate(ang * D2R);
    g.fillStyle = '#0c0c0d'; g.fillRect(-W * S / 2, -L * S / 2, W * S, L * S);
    g.strokeStyle = '#5d6066'; g.lineWidth = 2; g.strokeRect(-W * S / 2 - 1, -L * S / 2 - 1, W * S + 2, L * S + 2);
    g.restore();
  };
  // AS/NZS 3112: active/neutral flat pins at 30° forming "/\", earth below
  slot(0.0071, 0.0028, -30, 0.0068, 0.0020);
  slot(-0.0071, 0.0028, 30, 0.0068, 0.0020);
  slot(0, -0.0074, 0, 0.0084, 0.0020);
}

// ---------- cache ----------
let CACHE = null;
function cache(THREE, ctx) {
  if (CACHE && CACHE.THREE === THREE) return CACHE;
  const M = ctx.MAT, S = (p) => new THREE.MeshStandardMaterial(p);
  const mat = {
    blue: S({ color: 0x1a50b6, roughness: 0.42, metalness: 0 }),
    cable: S({ color: 0x2c68d8, roughness: 0.5, metalness: 0 }),
    sockSide: S({ color: 0x7d8086, roughness: 0.55, metalness: 0 }),
    sockFace: S({ map: ctx.labelTex(256, 256, drawSocket), roughness: 0.5, metalness: 0 }),
    panel: S({ map: ctx.labelTex(512, 512, drawPanel), roughness: 0.6, metalness: 0 }),
    ring: S({ map: ctx.labelTex(1024, 1024, drawRing), transparent: true, roughness: 0.45, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }),
    brass: S({ color: 0xcfae62, roughness: 0.3, metalness: 1 }),
    plug: S({ color: 0xf3f7f8, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.62, depthWrite: false }),
    brown: S({ color: 0x6b3d1e, roughness: 0.6, metalness: 0 }),
  };
  CACHE = { THREE, mat, parts: buildParts(THREE, M, mat) };
  return CACHE;
}

function buildParts(THREE, M, mat) {
  const L = new Map(); // material -> geometries
  const put = (m, geo) => { if (!L.has(m)) L.set(m, []); L.get(m).push(geo); return geo; };
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const mtx = (p, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(V3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V3(1, 1, 1));
  const latheGeo = (runs, segs, o) => { const a = acc(); lathe(a, runs, segs, o); return toGeo(THREE, a); };
  // lathe about y -> axis along +z (profile y becomes world z), centred on the axle
  const onAxle = (geo, x = 0, y = YA, z = 0) => geo.rotateX(Math.PI / 2).translate(x, y, z);

  // ---------- flanges ----------
  const front = [
    [0.075, ZI], [0.137, ZI], [0.140, ZI + 0.003], [0.140, 0.071],
  ];
  const rimF = smoothRun([[0.140, 0.071], [0.1392, 0.0732], [0.1373, 0.0743], [0.1350, 0.0745], [0.1330, 0.0736], [0.1320, 0.0718]]);
  const faceF = [[0.1320, 0.0718], [0.1314, ZO + 0.0004], [0.1300, ZO], [0.0890, ZO], [0.0874, ZO + 0.0007]];
  const bezel = smoothRun([[0.0874, ZO + 0.0007], [0.0858, 0.0705], [0.0840, 0.0718], [0.0822, 0.0716], [0.0806, 0.0700]]);
  const bezIn = [[0.0806, 0.0700], [0.0800, 0.0690], [PANEL_R, PANEL_Z - 0.002], [0.075, PANEL_Z - 0.002]];
  put(mat.blue, onAxle(latheGeo([...flatRuns(front), rimF, ...flatRuns(faceF), bezel, ...flatRuns(bezIn)], 96)));
  const back = [[0.034, -ZO], [0.1300, -ZO], [0.1314, -ZO - 0.0004], [0.1320, -0.0718]];
  const rimB = smoothRun([[0.1320, -0.0718], [0.1330, -0.0736], [0.1350, -0.0745], [0.1373, -0.0743], [0.1392, -0.0732], [0.140, -0.071]]);
  const backIn = [[0.140, -0.071], [0.140, -ZI - 0.003], [0.137, -ZI], [0.075, -ZI]];
  put(mat.blue, onAxle(latheGeo([...flatRuns(back), rimB, ...flatRuns(backIn)], 96)));
  // shallow stiffening ribs on the back face (radial)
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + 30 * D2R, rm = 0.0815;
    const g = new THREE.BoxGeometry(0.007, 0.093, 0.005).translate(0, rm, 0).rotateZ(a).translate(0, YA, -ZO - 0.0015);
    put(mat.blue, g);
  }

  // ---------- cable ----------
  {
    // packed under-layers (visible only between turns)
    put(mat.cable, onAxle(latheGeo(flatRuns([[RL1 - 0.004, -ZI], [RL1 - 0.004, ZI]]), 64)));
    const pts = [], per = 32;
    const thStart = TH_END + TAU * (N1 + N2);
    for (let k = 0; k <= N1 * per; k++) {
      const t = k / (N1 * per), th = thStart - t * N1 * TAU;
      pts.push([RL1 * Math.cos(th), YA + RL1 * Math.sin(th), -ZM + 2 * ZM * t]);
    }
    const n2 = Math.round(N2 * per), z2 = ZM - N2 * 0.0080;
    for (let k = 1; k <= n2; k++) {
      const t = k / n2, th = thStart - (N1 + t * N2) * TAU;
      const rr = RL1 + (RL2 - RL1) * Math.min(1, (k / per) / 0.5) ** 0.7;
      pts.push([rr * Math.cos(th), YA + rr * Math.sin(th), ZM + (z2 - ZM) * t]);
    }
    // free end: leaves tangentially at the top right, over the right edge, down to the plug
    const P0 = pts[pts.length - 1];
    const tg = nrm([Math.sin(TH_END), -Math.cos(TH_END), (z2 - ZM) / (N2 * TAU * RL2)]);
    const A = add(P0, mul(tg, 0.100));
    const tail = fillet([P0, A, [0.157, YA - 0.035, PLUG[2]], [0.157, PLUG[1] - 0.022, PLUG[2]]], 0.045, 10);
    const a = acc(); tube(a, [...pts, ...tail.slice(1)], RCAB, 7);
    put(mat.cable, toGeo(THREE, a));
  }

  // ---------- front panel ----------
  {
    const P = (px, py, z) => [px, YA + py, z];
    const pol = (r, deg) => [r * Math.cos(deg * D2R), r * Math.sin(deg * D2R)];
    const panel = new THREE.CircleGeometry(PANEL_R, 64).translate(0, YA, PANEL_Z);
    put(mat.panel, panel);
    for (const a of SOCK_ANG) {
      const [px, py] = pol(SOCK_RING, a);
      put(mat.sockSide, new THREE.CylinderGeometry(SOCK_R, SOCK_R + 0.0006, 0.003, 32, 1, true).rotateX(Math.PI / 2).translate(...P(px, py, PANEL_Z + 0.0015)));
      put(mat.sockFace, new THREE.CircleGeometry(SOCK_R, 32).rotateZ((a - 90) * D2R).translate(...P(px, py, PANEL_Z + 0.003)));
    }
    // overload / reset buttons: black bezel + red domed cap
    for (const [px, py] of [[0.0005, -0.001], pol(0.044, 34)]) {
      put(M.black, onAxle(latheGeo([smoothRun([[0.0078, 0], [0.0078, 0.0016], [0.0072, 0.0022], [0.0058, 0.0024]]), ...flatRuns([[0.0058, 0.0024], [0, 0.0024]])], 24), px, YA + py, PANEL_Z));
      put(M.red, onAxle(latheGeo([...flatRuns([[0.0055, 0.0022], [0.0055, 0.0042]]), smoothRun([[0.0055, 0.0042], [0.0050, 0.0054], [0.0035, 0.0061], [0, 0.0064]])], 20), px, YA + py, PANEL_Z));
    }
    // rocker switch
    {
      const [px, py] = pol(0.058, 215);
      const rot = -12 * D2R;
      put(M.rubber, new THREE.BoxGeometry(0.0175, 0.0235, 0.0034).rotateZ(rot).translate(...P(px, py, PANEL_Z + 0.0017)));
      put(M.black, new THREE.BoxGeometry(0.0118, 0.0172, 0.0040).rotateX(-0.2).rotateZ(rot).translate(...P(px, py, PANEL_Z + 0.0036)));
    }
    // screws
    for (const a of [125, 20, 268]) {
      const [px, py] = pol(0.066, a);
      put(M.ss, onAxle(latheGeo([smoothRun([[0.0032, 0], [0.0031, 0.0008], [0.0022, 0.0013], [0, 0.0015]])], 12), px, YA + py, PANEL_Z));
    }
  }

  // ---------- winding knob (front flange, upper left near the rim) ----------
  {
    const kx = KNOB.r * Math.cos(KNOB.a), ky = YA + KNOB.r * Math.sin(KNOB.a);
    put(M.black, onAxle(latheGeo([smoothRun([[0.0125, 0], [0.0125, 0.0025], [0.0105, 0.0045], [0.0092, 0.0055]]),
      ...flatRuns([[0.0092, 0.0055], [0.0090, 0.0255]]), smoothRun([[0.0090, 0.0255], [0.0085, 0.0278], [0.0068, 0.0290], [0, 0.0293]])], 24), kx, ky, ZO));
  }

  // ---------- rear hub, axle, upright bracket ----------
  {
    const hub = latheGeo([...flatRuns([[0.034, -0.001], [0.034, 0.006]]), smoothRun([[0.034, 0.006], [0.031, 0.0105], [0.024, 0.0128], [0.013, 0.0135]]), ...flatRuns([[0.013, 0.0135], [0, 0.0135]])], 40);
    put(M.black, hub.rotateX(-Math.PI / 2).translate(0, YA, -ZO));
    put(M.black, new THREE.CylinderGeometry(0.011, 0.011, -ZO - 0.012 - ZU, 20).rotateX(Math.PI / 2).translate(0, YA, (ZU - ZO - 0.012) / 2));
    const br = new THREE.BoxGeometry(0.032, 0.046, 0.026, 1, 1, 1);
    put(M.black, br.translate(0, YA, ZU));
  }

  // ---------- frame ----------
  {
    const a = acc();
    tube(a, fillet([[0, TR, ZU], [0, YH, ZU], [0, YH, 0.03]], 0.036, 10), TR, 14);
    tube(a, fillet([[0, TR, ZU], [-BX, TR, ZU], [-BX, TR, BZF], [BX, TR, BZF], [BX, TR, ZU], [0, TR, ZU]], 0.045, 8), TR, 14);
    put(M.black, toGeo(THREE, a));
    // weld collar where the upright meets the rear bar
    put(M.black, new THREE.CylinderGeometry(0.0115, 0.0125, 0.012, 16).translate(0, TR + 0.012, ZU));
  }

  // ---------- carry handle: ribbed grip + front paddle ----------
  {
    const y0 = -0.070, y1 = 0.032, ribs = [];
    const r0 = 0.0168, r1 = 0.0180, nR = 22, ya = -0.056, yb = 0.022;
    for (let k = 0; k <= nR * 2; k++) { const y = ya + ((yb - ya) * k) / (nR * 2); ribs.push([k % 2 ? r1 : r0, y]); }
    const grip = latheGeo([
      ...flatRuns([[0, y0], [0.0130, y0], [0.0150, y0 + 0.002], [0.0150, y0 + 0.010], [r0, ya]]),
      smoothRun(ribs),
      ...flatRuns([[r0, yb], [0.0186, yb + 0.003], [0.0186, y1], [0, y1]]),
    ], 20);
    put(M.rubber, grip.rotateX(Math.PI / 2).translate(0, YH, 0));
    const s = new THREE.Shape();
    s.moveTo(0.018, YH + 0.0168);
    s.lineTo(0.070, YH + 0.0165);
    s.bezierCurveTo(0.088, YH + 0.016, 0.097, YH + 0.006, 0.096, YH - 0.006);
    s.bezierCurveTo(0.094, YH - 0.022, 0.080, YH - 0.036, 0.060, YH - 0.0385);
    s.bezierCurveTo(0.045, YH - 0.040, 0.034, YH - 0.032, 0.028, YH - 0.018);
    s.lineTo(0.018, YH - 0.015);
    s.lineTo(0.018, YH + 0.0168);
    const th = 0.010;
    const pad = new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: true, bevelThickness: 0.0025, bevelSize: 0.0022, bevelSegments: 2, curveSegments: 10 });
    pad.rotateY(-Math.PI / 2).translate(th / 2, 0, 0);
    put(M.black, pad);
  }

  // ---------- clear AU plug ----------
  {
    const [x, y, z] = PLUG, sz = 0.011 / 0.016;
    const body = latheGeo([
      ...flatRuns([[0, -0.052], [0.0140, -0.052]]),
      smoothRun([[0.0140, -0.052], [0.0156, -0.0508], [0.0160, -0.0490]]),
      ...flatRuns([[0.0160, -0.0490], [0.0160, -0.0260]]),
      smoothRun([[0.0160, -0.0260], [0.0150, -0.0205], [0.0120, -0.0160], [0.0085, -0.0110], [0.0062, -0.0050], [0.0058, 0]]),
      ...flatRuns([[0.0058, 0], [0.0045, 0]]),
    ], 28, { sz });
    put(mat.plug, body.translate(x, y, z));
    // wires and terminals visible through the clear body
    put(mat.brown, new THREE.CylinderGeometry(0.0016, 0.0016, 0.018, 8).rotateZ(0.25).translate(x + 0.004, y - 0.031, z));
    put(M.blueHandle, new THREE.CylinderGeometry(0.0016, 0.0016, 0.018, 8).rotateZ(-0.25).translate(x - 0.004, y - 0.031, z));
    put(M.green, new THREE.CylinderGeometry(0.0016, 0.0016, 0.016, 8).translate(x, y - 0.030, z - 0.004));
    put(mat.brass, new THREE.BoxGeometry(0.004, 0.006, 0.004).translate(x + 0.0072, y - 0.047, z + 0.0025));
    put(mat.brass, new THREE.BoxGeometry(0.004, 0.006, 0.004).translate(x - 0.0072, y - 0.047, z + 0.0025));
    put(mat.brass, new THREE.BoxGeometry(0.004, 0.006, 0.004).translate(x, y - 0.047, z - 0.0075));
    // pins: active/neutral angled 30° ("/\"), earth on the centre line
    for (const s of [1, -1]) put(mat.brass, new THREE.BoxGeometry(0.0016, 0.0175, 0.00635).rotateY(-s * 30 * D2R).translate(x + s * 0.0072, y - 0.052 - 0.00875, z + 0.0025));
    put(mat.brass, new THREE.BoxGeometry(0.0016, 0.020, 0.0080).translate(x, y - 0.052 - 0.010, z - 0.0075));
  }

  const out = [];
  for (const [m, list] of L) out.push([m, merge(THREE, list)]);
  // ring decal (text band + pictograms) on the front flange face
  const ring = new THREE.RingGeometry(0.0865, 0.128, 128, 1).translate(0, YA, ZO + 0.0004);
  ring.userData.shared = true;
  out.push([mat.ring, ring]);
  return out;
}

export function build(THREE, ctx, opts = {}) {
  const C = cache(THREE, ctx);
  const g = new THREE.Group(); g.name = 'reel';
  for (const [m, geo] of C.parts) {
    const mesh = new THREE.Mesh(geo, m);
    if (m === C.mat.blue) { mesh.name = 'reel_flanges'; ctx.core(mesh); }
    if (m === C.mat.ring) mesh.renderOrder = 1;
    g.add(mesh);
  }
  return g;
}

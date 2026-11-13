// 6 kg food-grade CO2 cylinder as sold for homebrew in Australia (KegLand / swap-fleet style):
// painted steel cylinder Ø160 mm, ~745 mm to the top of the black screw-on carry handle / valve
// guard, green-grey body (AS 4484 carbon dioxide), brass cylinder valve with hand wheel, Type 30
// outlet and burst disc. A KegLand MK4 dual-gauge regulator is screwed onto the valve's side
// outlet by its chrome Type 30 hex nut (white nylon washer); the angled inlet stem carries the
// round chrome body out in front of the valve, rolled about the outlet axis so the big black
// 5-lobe knob (red MK4 / KegLand label) and both 2" gauges in ribbed black boots face straight
// up: cylinder gauge (0-3000 psi) toward the front, delivery gauge (0-100 psi) back-left beside
// the guard, green PRV with pull ring to the left, grey 8 mm x FFL duotight outlet angled away
// to the front-right (near horizontal, tipped 10 deg up).
// Built upright: origin bottom centre, +y up, +z front (valve outlet / regulator).
// Geometry is authored in millimetres and scaled to metres once.
export const defaultOptions = {};

const TAU = Math.PI * 2;
const D2R = Math.PI / 180;

// ---------- dimensions (mm) ----------
const R = 80;          // shell outer radius (Ø160)
const YS = 500;        // top of straight body / start of shoulder
const SB = 85;         // shoulder (semi-ellipse) height
const RN = 23;         // neck radius
const YN = 616;        // top of neck
const shoulderY = (r) => YS + SB * Math.sqrt(Math.max(0, 1 - (r / R) * (r / R)));
const YO = 642;        // valve outlet / regulator inlet axis height
const GW = 100 * D2R;  // guard front window (angle)
const GB = 562, GT = 699; // guard: bottom (sits on the shoulder), top of wall / start of rim
const guardR = (y) => 55.5 + (64 - 55.5) * (y - GB) / (GT - GB); // outer wall radius of the guard cup

// ---------- helpers ----------
function mergeGeos(THREE, geos) {
  let nv = 0, ni = 0;
  for (const g of geos) {
    if (!g.index) { const n = g.attributes.position.count, a = new Uint32Array(n); for (let i = 0; i < n; i++) a[i] = i; g.setIndex(new THREE.BufferAttribute(a, 1)); }
    if (!g.attributes.normal) g.computeVertexNormals();
    nv += g.attributes.position.count; ni += g.index.count;
  }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const g of geos) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array.subarray(0, n * 3), ov * 3);
    nor.set(g.attributes.normal.array.subarray(0, n * 3), ov * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array.subarray(0, n * 2), ov * 2);
    const ia = g.index.array; for (let i = 0; i < ia.length; i++) idx[oi + i] = ia[i] + ov;
    ov += n; oi += ia.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
const V = (THREE, a) => a.map(([r, y]) => new THREE.Vector2(r, y));
const lathe = (THREE, pts, seg, ps = 0, pl = TAU) => new THREE.LatheGeometry(V(THREE, pts), seg, ps, pl);
// flip triangle winding (and normals) of an indexed geometry
function flip(g) {
  const ia = g.index.array; for (let i = 0; i < ia.length; i += 3) { const t = ia[i + 1]; ia[i + 1] = ia[i + 2]; ia[i + 2] = t; }
  const n = g.attributes.normal.array; for (let i = 0; i < n.length; i++) n[i] = -n[i];
  return g;
}
// end caps for a partial lathe of a closed CCW profile
function latheCaps(THREE, pts, ps, pl) {
  const uniq = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
  if (uniq.length > 2 && uniq[0][0] === uniq[uniq.length - 1][0] && uniq[0][1] === uniq[uniq.length - 1][1]) uniq.pop();
  const shape = new THREE.Shape(V(THREE, uniq));
  const a = new THREE.ShapeGeometry(shape); a.rotateY(ps - Math.PI / 2);
  const b = flip(new THREE.ShapeGeometry(shape)); b.rotateY(ps + pl - Math.PI / 2);
  return [a, b];
}
// radial ribs (knurl / grip) on a y-axis lathe: radius shrinks between ribs for r > rMin
function ribs(g, n, depth, rMin) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
    if (r <= rMin) continue;
    const th = Math.atan2(x, z), s = 0.5 - 0.5 * Math.cos(n * th);
    const k = (r - depth * Math.min(1, (r - rMin) / depth) * s * s) / r;
    p.setX(i, x * k); p.setZ(i, z * k);
  }
  g.computeVertexNormals();
  return g;
}
// cylinder along an axis: 'x' | 'z' | 'y', from a to b at (u, v) cross position
function cyl(THREE, r1, r2, a, b, axis, c1, c2, seg = 16, open = false) {
  const g = new THREE.CylinderGeometry(r2, r1, Math.abs(b - a), seg, 1, open);
  const m = (a + b) / 2;
  if (axis === 'y') g.translate(c1, m, c2);
  else if (axis === 'z') { g.rotateX(Math.PI / 2); if (b < a) g.rotateX(Math.PI); g.translate(c1, c2, m); }
  else { g.rotateZ(-Math.PI / 2); if (b < a) g.rotateZ(Math.PI); g.translate(m, c1, c2); }
  return g;
}

// ---------- shell (core) ----------
function shellGeo(THREE) {
  // slightly dished base rolling into a ~14 mm corner (no foot ring on these steel cylinders)
  const p = [[0, 7], [30, 6], [52, 3.6], [64, 1.2], [70, 0], [74.5, 0.8], [77.8, 3.2], [79.6, 7.5], [R, 13], [R, YS]];
  const t1 = Math.acos(25 / R);
  for (let i = 1; i <= 12; i++) { const t = (i / 12) * t1; p.push([R * Math.cos(t), YS + SB * Math.sin(t)]); }
  // neck boss carrying the guard thread, chamfered top, valve bore
  p.push([RN, shoulderY(25) + 3.5], [RN, YN - 2], [RN - 1.5, YN], [RN - 1.5, YN], [14.5, YN], [14.5, YN - 3]);
  return lathe(THREE, p, 56);
}

// ---------- black carry handle / valve guard (screws onto the neck thread) ----------
// One closed profile (band + wall + rolled rim + floor + threaded collar) turned through the
// solid 260°, plus the band and the rim alone across the 100° front window, so the outer skin
// has no horizontal joins.
function guardGeos(THREE) {
  const yw = GB + 28;               // bottom of the front window
  const S = (r, o) => shoulderY(r) + o;
  const ro = guardR(GT);
  const rimOut = [[ro + 0.5, GT + 7], [ro + 2.8, GT + 9.5], [ro + 3.4, GT + 13], [ro + 2.2, GT + 16.2], [ro - 0.5, GT + 17.2], [ro - 2.8, GT + 15.5]];
  const lower = [ // inner wall at the window bottom -> floor -> collar -> underside -> back to the start
    [52, S(52, 4.5)], [40, S(40, 4)], [31.5, S(31.5, 3.5)], [31.5, S(31.5, 3.5)],
    [31.5, YN - 6], [30, YN - 4.5], [24.5, YN - 4.5], [23.6, YN - 6], [23.6, YN - 6],
    [23.6, S(23.6, 2.5)], [30, S(30, 1)], [44, S(44, 1)], [guardR(GB), GB - 0.5],
  ];
  const full = [[guardR(GB), GB - 0.5], [guardR(yw), yw], [ro, GT], ...rimOut, [ro - 3, GT], [guardR(yw) - 3, yw], ...lower];
  const band = [[guardR(GB), GB - 0.5], [guardR(yw), yw], [guardR(yw), yw], [guardR(yw) - 3, yw], [guardR(yw) - 3, yw], ...lower];
  const rim = [[ro, GT], ...rimOut, [ro - 3, GT], [ro - 3, GT], [ro, GT]];
  const ps = GW / 2, pl = TAU - GW;
  return [
    lathe(THREE, full, 26, ps, pl), ...latheCaps(THREE, full, ps, pl),
    lathe(THREE, band, 10, -GW / 2, GW), lathe(THREE, rim, 10, -GW / 2, GW),
  ];
}

// ---------- brass cylinder valve ----------
function valveGeos(THREE) {
  const brass = [], black = [], ss = [], pvc = [];
  pvc.push(lathe(THREE, [[14.5, YN - 0.5], [26, YN - 0.5], [26, YN - 0.5], [26, YN + 3.5], [26, YN + 3.5], [14.5, YN + 3.5]], 24)); // test ring
  brass.push(cyl(THREE, 14, 14, YN - 4, YN + 6, 'y', 0, 0, 16, true));      // stem into the neck
  const yb0 = YN + 4, yb1 = YN + 52;
  brass.push(lathe(THREE, [[0, yb0], [16, yb0], [17.5, yb0 + 2], [17.5, yb1 - 3], [16, yb1], [0, yb1]], 20)); // valve body
  brass.push(cyl(THREE, 11, 11, 8, 30, 'z', 0, YO, 18));                    // outlet spigot (Type 30, male)
  brass.push(cyl(THREE, 13, 13, 12, 18, 'z', 0, YO, 6));                    // outlet hex
  brass.push(cyl(THREE, 8.5, 8.5, -10, -24, 'x', YO + 10, 0, 14));          // burst disc boss
  const bd = cyl(THREE, 10, 10, -22, -30, 'x', 0, 0, 6); bd.rotateX(Math.PI / 6); bd.translate(0, YO + 10, 0); brass.push(bd); // burst disc hex cap
  ss.push(cyl(THREE, 3.5, 3.5, -29.9, -30.6, 'x', YO + 10, 0, 10));
  brass.push(cyl(THREE, 16.5, 16.5, yb1 - 1, yb1 + 11, 'y', 0, 0, 6));      // gland nut
  ss.push(cyl(THREE, 5, 5, yb1 + 11, yb1 + 21, 'y', 0, 0, 12));            // spindle
  const yw = yb1 + 19;
  const wheel = lathe(THREE, [[0, yw], [9, yw], [22, yw + 1], [26, yw + 3], [27, yw + 7], [27, yw + 11], [25, yw + 14.5], [9, yw + 16], [0, yw + 16.5]], 36);
  black.push(ribs(wheel, 12, 3.2, 21));
  ss.push(cyl(THREE, 6, 6, yw + 15.9, yw + 16.9, 'y', 0, 0, 12));
  return { brass, black, ss, pvc };
}

// ---------- KegLand MK4 regulator ----------
// Authored in its own frame (mm), as in the product photo looking at the dial faces:
//   X = right, Y = up (PRV), Z = toward the viewer = knob axis = dial-face normal; Z = 0 is the
//   back of the die-cast body. Inlet stem, outlet, gauge stems and PRV all lie in the port plane
//   Z = ZP. The Type 30 inlet leaves at BETA below +X (lower right), the duotight outlet at
//   OUT_A below -X (lower left), the two 2" gauges sit upper left (cylinder, 0-3000 psi) and upper
//   right (delivery, 0-100 psi), the PRV on top.
// Mounting: the Type 30 nut is coaxial with the valve's side outlet (world +z at height YO), and
// the body is rolled about that axis so the dial faces and knob point straight up (+y). Because
// the inlet lies in the dial plane, a front tilt is not possible without bending the stem.
const BETA = 32 * D2R;    // inlet stem below the body horizontal (photo: ~28-32 deg)
const OUT_A = 28 * D2R;   // duotight outlet below the body horizontal, on the left
const OUT_T = 10 * D2R;   // outlet tipped toward the knob side (end face visible in the photo)
const ZP = 12;            // port plane above the back of the body
const ZB = 102;           // world z of the body centre (nut 22..48 on the 30 mm valve spigot)
const RBD = 35.3;         // body radius (Ø~70)
const GAUGES = [[-59, 36, 0.5], [59, 36, 0]];   // local x, y, u offset into the dial atlas (right half = CO2 high)
// local -> world (mm): rows are the world axes expressed in the local frame
const REG_X = [-Math.sin(BETA), -Math.cos(BETA), 0], REG_Y = [0, 0, 1], REG_Z = [-Math.cos(BETA), Math.sin(BETA), 0];
const regT = [0, YO - ZP, ZB];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const regPt = (p) => [dot3(REG_X, p) + regT[0], dot3(REG_Y, p) + regT[1], dot3(REG_Z, p) + regT[2]];
const regDir = (d) => [dot3(REG_X, d), dot3(REG_Y, d), dot3(REG_Z, d)];
const U_IN = [Math.cos(BETA), -Math.sin(BETA), 0];
const U_OUT = [-Math.cos(OUT_A) * Math.cos(OUT_T), -Math.sin(OUT_A) * Math.cos(OUT_T), Math.sin(OUT_T)];
const OUT_END = 74.6;     // duotight mouth, along U_OUT from the port-plane centre

const r4 = (v) => +(v / 1000).toFixed(4), n3 = (v) => +v.toFixed(3);
export const meta = {
  id: 'co2',
  name: '6 kg CO2 cylinder + KegLand MK4 dual-gauge regulator',
  dims: '6 kg CO2, Ø160 × 716 (guard rim); MK4 regulator on the valve side outlet, dials + knob facing up (knob top 676 mm), projects 201 mm forward of the cylinder axis (121 mm past the shell), 92 mm to the left',
  ports: {
    // 8 mm duotight mouth on the regulator outlet (front-right, near horizontal)
    gas: { pos: regPt(U_OUT.map((c, i) => c * OUT_END + [0, 0, ZP][i])).map(r4), dir: regDir(U_OUT).map(n3) },
  },
};

function regGeos(THREE) {
  const ss = [], black = [], brass = [], green = [], pvc = [], grey = [], dial = [], hole = [], face = [], knobLbl = [], stamp = [];
  const Y = new THREE.Vector3(0, 1, 0);
  const O = [0, 0, ZP];
  // place a +y-built geometry so +y runs along d, starting at o (+ s along d)
  const orient = (g, o, d, s = 0, spin = 0) => {
    if (spin) g.rotateY(spin);
    g.translate(0, s, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, new THREE.Vector3(...d).normalize()));
    g.translate(o[0], o[1], o[2]); return g;
  };
  const rod = (r, s0, s1, o, d, seg = 16, spin = 0) => {
    let g = new THREE.CylinderGeometry(r, r, s1 - s0, seg); g.translate(0, (s0 + s1) / 2, 0);
    if (seg === 6) { g = g.toNonIndexed(); g.computeVertexNormals(); } // crisp hex flats
    return orient(g, o, d, 0, spin);
  };
  const turn = (prof, o, d, seg = 24) => orient(lathe(THREE, prof, seg), o, d);
  const alongZ = (g, x, y, z) => { g.rotateX(Math.PI / 2); g.translate(x, y, z); return g; };

  // die-cast body (chrome) with the red front label under the knob
  ss.push(alongZ(lathe(THREE, [[0, 0], [30, 0], [33, 0.8], [34.8, 2.8], [RBD, 6], [RBD, 22], [34.8, 25], [33.6, 26.6], [32.5, 27], [0, 27]], 48), 0, 0, 0));
  const fd = new THREE.CircleGeometry(32.6, 48); fd.translate(0, 0, 27.05); face.push(fd);
  black.push(alongZ(lathe(THREE, [[0, 26.9], [21, 26.9], [21, 29.5], [0, 29.5]], 32), 0, 0, 0)); // knob skirt
  // adjusting knob: five rounded lobes, recessed red KegLand label
  const kn = new THREE.Shape(), NK = 160, RL = 28.5, RV = 17.2;
  for (let i = 0; i <= NK; i++) {
    const t = (i / NK) * TAU, s = 0.5 - 0.5 * Math.cos(5 * (t - Math.PI / 2));
    const r = RL - (RL - RV) * Math.pow(s, 2.6);
    i ? kn.lineTo(r * Math.cos(t), r * Math.sin(t)) : kn.moveTo(r * Math.cos(t), r * Math.sin(t));
  }
  const knob = new THREE.ExtrudeGeometry(kn, { depth: 13, bevelEnabled: true, bevelThickness: 2.5, bevelSize: 2, bevelSegments: 3, curveSegments: 1 });
  knob.translate(0, 0, 29.5); black.push(knob);                           // Z 27 .. 45
  black.push(alongZ(lathe(THREE, [[18.2, 45], [19.6, 45], [19.6, 45.6], [18.2, 45.6]], 40), 0, 0, 0)); // label lip
  const kl = new THREE.CircleGeometry(18.4, 48); kl.translate(0, 0, 45.06); knobLbl.push(kl);

  // gauges: 2" dials in ribbed black rubber boots, faces parallel to the knob top
  for (const [gx, gy, u0] of GAUGES) {
    const boot = lathe(THREE, [
      [0, 0], [21, 0], [26.5, 1.2], [29.2, 4.5], [30, 9], [30, 23.5], [29.5, 26.2], [28.2, 27.8], [25.8, 28.4], [24.5, 27.8], [23.7, 27.3],
    ], 60);
    ribs(boot, 30, 1.5, 28.3); black.push(alongZ(boot, gx, gy, 3));
    const f = new THREE.CircleGeometry(23.8, 40);
    const uv = f.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * 0.5);
    f.translate(gx, gy, 3 + 27.25); dial.push(f);
    black.push(alongZ(new THREE.CylinderGeometry(1.7, 1.7, 1.4, 12).translate(0, 0.7, 0), gx, gy, 3 + 27.2));
    // brass stem + hex from the body rim to the back of the gauge case
    const d = [gx, gy, 0], L = Math.hypot(gx, gy);
    brass.push(rod(4.5, 30, L - 18, O, d, 14));
    brass.push(rod(6.6, 34.6, 39.6, O, d, 6, Math.PI / 6));
  }

  // Type 30 inlet: cast boss, stem, chrome hex nut, white nylon washer at the mouth
  const nut0 = ZB - 48, nut1 = ZB - 22;                                   // nut spans world z 48 .. 22
  ss.push(rod(8.2, 28, 39, O, U_IN, 20));
  ss.push(rod(5.6, 38, nut0 + 1, O, U_IN, 20));
  ss.push(rod(7.6, nut0 - 3.5, nut0, O, U_IN, 20));
  ss.push(rod(16.5, nut0 + 1, nut1 - 1, O, U_IN, 6, Math.PI / 6));        // hex 28.6 A/F, a flat facing +Z
  ss.push(turn([[11, nut0], [13.4, nut0], [14.3, nut0 + 1.1], [14.3, nut1 - 1.1], [13.4, nut1], [11.2, nut1]], O, U_IN, 30)); // turned chamfers
  // 'TYPE 30' stamped on the flat that faces the same way as the dials
  const tl = new THREE.PlaneGeometry(19, 9.5), sm = (nut0 + nut1) / 2;
  tl.rotateZ(-BETA); tl.translate(O[0] + U_IN[0] * sm, O[1] + U_IN[1] * sm, O[2] + 14.29 + 0.06); stamp.push(tl);
  pvc.push(turn([[11.2, nut1 - 0.2], [14, nut1 - 0.2], [14, nut1 + 1.2], [11.2, nut1 + 1.2]], O, U_IN, 24));

  // outlet: chrome boss + FFL nipple, grey 8 mm x FFL duotight (hex nut, neck, body, collet)
  ss.push(rod(7.4, 28, 36.5, O, U_OUT, 20));
  ss.push(rod(7.2, 35.5, 39.5, O, U_OUT, 6, Math.PI / 6));
  grey.push(rod(10, 39, 51.5, O, U_OUT, 6, Math.PI / 6));
  grey.push(turn([[6, 38.6], [9.3, 38.6], [9.9, 39.4], [9.9, 51.1], [9.3, 51.9], [6.4, 52], [6.4, 56], [7.6, 56.4], [8.6, 57.6], [8.7, 70.6], [8.1, 72], [6.6, 72.2]], O, U_OUT, 28));
  grey.push(turn([[4.1, 72], [6.7, 72], [6.7, 74.2], [6.2, OUT_END], [4.1, OUT_END]], O, U_OUT, 24)); // collet
  const hb = new THREE.CircleGeometry(4.1, 16); hb.rotateX(-Math.PI / 2); hole.push(orient(hb, O, U_OUT, OUT_END - 0.6));

  // PRV on top: chrome boss, green cap, stem with a split pull ring
  const up = [0, 1, 0];
  ss.push(rod(6.2, 30, 40, O, up, 18));
  green.push(turn([[0, 39.5], [5.6, 39.5], [6, 40.5], [6, 47], [5.2, 48.6], [2.5, 49.2], [0, 49.2]], O, up, 20));
  ss.push(rod(1.3, 48, 52, O, up, 8));
  const ring = new THREE.TorusGeometry(6.8, 0.9, 8, 28); ring.rotateY(55 * D2R);
  ring.translate(-6.8 * Math.cos(55 * D2R), 51.5, ZP + 6.8 * Math.sin(55 * D2R)); ss.push(ring);

  // to the world: nut coaxial with the valve outlet, dials and knob facing up
  const M = new THREE.Matrix4().set(...REG_X, regT[0], ...REG_Y, regT[1], ...REG_Z, regT[2], 0, 0, 0, 1);
  const all = { ss, black, brass, green, pvc, grey, dial, hole, face, knobLbl, stamp };
  for (const k in all) for (const g of all[k]) g.applyMatrix4(M);
  return all;
}

// ---------- labels (wrapped on the body) ----------
function wrap(THREE, r, y0, y1, th0, th1, segs) {
  const g = new THREE.CylinderGeometry(r, r, y1 - y0, segs, 1, true, th0, th1 - th0);
  g.translate(0, (y0 + y1) / 2, 0); return g;
}
function shoulderBand(THREE, y0, y1) {
  const g = new THREE.CylinderGeometry(1, 1, y1 - y0, 64, 2, true);
  g.translate(0, (y0 + y1) / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), x = p.getX(i), z = p.getZ(i), rr = Math.hypot(x, z);
    const ry = R * Math.sqrt(Math.max(0, 1 - ((y - YS) / SB) ** 2)) + 0.35;
    p.setX(i, (x / rr) * ry); p.setZ(i, (z / rr) * ry);
  }
  g.rotateY(Math.PI); // text seam at the back
  g.computeVertexNormals(); return g;
}
const FONT = (w, s) => `${w} ${s}px Arial, Helvetica, sans-serif`;
function drawBand(g, w, h) {
  g.fillStyle = '#f4f3ee'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1f6b3a'; g.fillRect(0, 4, w, 5); g.fillRect(0, h - 9, w, 5);
  g.textBaseline = 'middle'; g.textAlign = 'center';
  for (let k = 0; k < 2; k++) {
    const cx = w * (0.25 + 0.5 * k);
    g.fillStyle = '#18241d'; g.font = FONT(800, 36); g.fillText('CARBON DIOXIDE', cx, 42);
    g.fillStyle = '#1f6b3a'; g.font = FONT(700, 21); g.fillText('FOOD GRADE  \u00b7  6.0 kg  \u00b7  UN 1013', cx, 80);
    g.beginPath(); g.arc(cx - 205, 42, 5, 0, TAU); g.arc(cx + 205, 42, 5, 0, TAU); g.fill();
  }
}
function drawId(g, w, h) {
  g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#27313a'; g.lineWidth = 3; g.strokeRect(5, 5, w - 10, h - 10);
  g.fillStyle = '#16212b'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = FONT(800, 27); g.fillText('CARBON', w / 2, 40); g.fillText('DIOXIDE', w / 2, 68);
  g.font = FONT(700, 15); g.fillText('UN 1013  ·  CO₂  ·  FOOD GRADE', w / 2, 92);
  // Class 2.2 non-flammable, non-toxic gas diamond
  const cx = w / 2, cy = 168, s = 62;
  g.save(); g.translate(cx, cy); g.rotate(Math.PI / 4);
  g.fillStyle = '#16904a'; g.fillRect(-s / Math.SQRT2, -s / Math.SQRT2, s * Math.SQRT2, s * Math.SQRT2);
  g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.strokeRect(-s / Math.SQRT2 + 5, -s / Math.SQRT2 + 5, s * Math.SQRT2 - 10, s * Math.SQRT2 - 10);
  g.restore();
  g.fillStyle = '#fff'; g.beginPath(); // gas cylinder pictogram
  g.ellipse(cx, cy - 18, 8, 6, 0, Math.PI, 0); g.rect(cx - 8, cy - 18, 16, 30); g.fill(); g.fillRect(cx - 3, cy - 30, 6, 8);
  g.font = FONT(800, 16); g.fillText('2', cx, cy + 48);
  g.fillStyle = '#16212b'; g.font = FONT(700, 13); g.textAlign = 'left';
  const lines = ['NON-FLAMMABLE NON-TOXIC GAS', 'Contains gas under pressure;', 'may explode if heated.', 'Use upright. Secure cylinder.', 'Asphyxiant in high concentration.'];
  lines.forEach((t, i) => g.fillText(t, 16, 262 + i * 17));
  g.fillStyle = '#1f6b3a'; g.fillRect(12, 352, w - 24, 26);
  g.fillStyle = '#fff'; g.font = FONT(800, 15); g.textAlign = 'center'; g.fillText('SWAP & GO  ·  REFILL', w / 2, 370);
  g.fillStyle = '#111'; let x = 34;
  for (let k = 0; k < 44; k++) { const bw = 1 + ((k * 7 + 3) % 4); g.fillRect(x, 392, bw, 52); x += bw + 1.6; }
  g.font = FONT(400, 12); g.fillText('9 312345 060013', w / 2, 460);
  g.textAlign = 'left'; g.font = FONT(700, 12); g.fillText('NETT 6.0 kg', 16, 490); g.textAlign = 'right'; g.fillText('TARE 10.4 kg', w - 16, 490);
}
function drawStamp(g, w, h) {
  g.clearRect(0, 0, w, h); g.textBaseline = 'middle'; g.font = FONT(700, 26);
  const t = 'CO2  WC 9.0 L  TW 10.4  TP 250 BAR  AS 2030  •  05 24  •  SN 4829175';
  for (let k = 0; k < 2; k++) {
    const x = 20 + k * w / 2;
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillText(t, x - 1, h / 2 - 1);
    g.fillStyle = 'rgba(52,56,48,0.38)'; g.fillText(t, x, h / 2);
  }
}
function drawDials(g, w, h) {
  g.clearRect(0, 0, w, h);
  const dial = (cx, max, major, label, needle, red) => {
    const r = h / 2 - 2, cy = h / 2;
    g.fillStyle = '#f7f7f3'; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    const a0 = 135 * D2R, span = 270 * D2R, ang = (v) => a0 + (v / max) * span;
    g.lineWidth = 9; g.strokeStyle = '#2e8b4a'; g.beginPath(); g.arc(cx, cy, r - 18, ang(red[0]), ang(red[1])); g.stroke();
    g.strokeStyle = '#c62828'; g.beginPath(); g.arc(cx, cy, r - 18, ang(red[1]), ang(max)); g.stroke();
    g.strokeStyle = '#1a1a1a';
    for (let i = 0; i <= 50; i++) {
      const a = ang((i / 50) * max), big = i % 5 === 0;
      g.lineWidth = big ? 3 : 1.5; g.beginPath();
      g.moveTo(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8));
      g.lineTo(cx + Math.cos(a) * (r - (big ? 28 : 20)), cy + Math.sin(a) * (r - (big ? 28 : 20))); g.stroke();
    }
    g.fillStyle = '#1a1a1a'; g.font = FONT(700, 17); g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i <= 10; i += 2) { const a = ang((i / 10) * max); g.fillText(String(Math.round((i / 10) * max / major) * major), cx + Math.cos(a) * (r - 46), cy + Math.sin(a) * (r - 46)); }
    g.font = FONT(700, 16); g.fillText('PSI', cx, cy + 40); g.font = FONT(400, 12); g.fillText('kPa · bar', cx, cy + 58);
    g.fillStyle = '#c62828'; g.font = FONT(800, 14); g.fillText(label, cx, cy - 36);
    const a = ang(needle); g.strokeStyle = '#111'; g.lineWidth = 4; g.beginPath();
    g.moveTo(cx - Math.cos(a) * 14, cy - Math.sin(a) * 14); g.lineTo(cx + Math.cos(a) * (r - 22), cy + Math.sin(a) * (r - 22)); g.stroke();
    g.fillStyle = '#111'; g.beginPath(); g.arc(cx, cy, 7, 0, TAU); g.fill();
    g.strokeStyle = '#555'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r - 1.5, 0, TAU); g.stroke();
  };
  dial(h / 2, 100, 10, 'LOW', 12, [0, 60]);        // left: delivery pressure 0-100 psi, set ~12 psi
  dial(w - h / 2, 3000, 500, 'CO₂', 850, [0, 1800]); // right: cylinder 0-3000 psi, ~850 psi full
}

function drawKnobLabel(g, w, h) { // MK4 knob top: red disc, yellow MK4, KegLand oval, + <-> -
  const cx = w / 2, cy = h / 2;
  g.clearRect(0, 0, w, h); g.fillStyle = '#c41a22'; g.beginPath(); g.arc(cx, cy, w / 2, 0, TAU); g.fill();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#f6c21c'; g.font = FONT(800, 44); g.fillText('MK4', cx, cy - 70);
  g.strokeStyle = '#f6c21c'; g.lineWidth = 5; g.beginPath(); g.ellipse(cx, cy, 100, 38, 0, 0, TAU); g.stroke();
  g.font = FONT(800, 46); const kw = g.measureText('Keg').width, lw = g.measureText('Land').width, x0 = cx - (kw + lw) / 2;
  g.textAlign = 'left'; g.fillStyle = '#ffe4e0'; g.fillText('Keg', x0, cy + 2); g.fillStyle = '#f6c21c'; g.fillText('Land', x0 + kw, cy + 2);
  g.textAlign = 'center'; g.font = FONT(800, 40); g.fillText('+', cx - 62, cy + 66); g.fillText('-', cx + 62, cy + 62);
  g.lineWidth = 4; g.beginPath(); g.arc(cx, cy - 40, 110, 1.33, 1.81); g.stroke();
  for (const [a, s] of [[1.33, 1], [1.81, -1]]) { // arrow heads at both ends
    const x = cx + 110 * Math.cos(a), y = cy - 40 + 110 * Math.sin(a);
    g.beginPath(); g.moveTo(x + s * 10, y - 6); g.lineTo(x - s * 3, y + 1); g.lineTo(x + s * 8, y + 9); g.fill();
  }
}
function drawNutStamp(g, w, h) { // engraved 'TYPE 30' on the inlet nut flat
  g.clearRect(0, 0, w, h); g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = FONT(700, 58);
  g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillText('TYPE 30', w / 2 + 2, h / 2 + 3);
  g.fillStyle = 'rgba(70,58,58,0.85)'; g.fillText('TYPE 30', w / 2, h / 2);
}
function drawBodyFace(g, w, h) { // red front label of the body with yellow text round the rim
  const cx = w / 2, cy = h / 2, r = w / 2;
  g.clearRect(0, 0, w, h); g.fillStyle = '#c9c9cc'; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
  g.fillStyle = '#c01d24'; g.beginPath(); g.arc(cx, cy, r - 7, 0, TAU); g.fill();
  g.fillStyle = '#f6c21c'; g.font = FONT(800, 30); g.textAlign = 'center'; g.textBaseline = 'middle';
  const txt = 'KegLand · MK4 · Pat.Pend · KegLand · MK4 · Pat.Pend · ';
  let a = -Math.PI / 2; const rt = r - 30;
  for (const ch of txt) {
    const cw = g.measureText(ch).width; a += cw / 2 / rt;
    g.save(); g.translate(cx + rt * Math.cos(a), cy + rt * Math.sin(a)); g.rotate(a + Math.PI / 2); g.fillText(ch, 0, 0); g.restore();
    a += cw / 2 / rt + 0.01;
  }
}

// ---------- cache ----------
let CACHE = null;
function cache(THREE, ctx) {
  if (CACHE && CACHE.THREE === THREE) return CACHE;
  const S = (p) => new THREE.MeshStandardMaterial(p);
  const lbl = (tex, extra = {}) => S({ map: tex, roughness: 0.55, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, ...extra });
  const mat = {
    paint: S({ color: 0xa3a99b, roughness: 0.42, metalness: 0.15 }),   // AS 4484 green-grey (CO2)
    brass: S({ color: 0xc9a24f, roughness: 0.32, metalness: 1.0 }),
    grey: S({ color: 0x7c8187, roughness: 0.55, metalness: 0 }),        // duotight acetal grey
    face: lbl(ctx.labelTex(512, 512, drawBodyFace), { roughness: 0.6 }),
    knobLbl: lbl(ctx.labelTex(256, 256, drawKnobLabel), { roughness: 0.65 }),
    nutStamp: lbl(ctx.labelTex(256, 128, drawNutStamp), { transparent: true, depthWrite: false, roughness: 0.4, metalness: 0.6 }),
    band: lbl(ctx.labelTex(1024, 112, drawBand)),
    id: lbl(ctx.labelTex(256, 512, drawId)),
    stamp: lbl(ctx.labelTex(2048, 48, drawStamp), { transparent: true, roughness: 0.45, depthWrite: false }),
    dial: new THREE.MeshBasicMaterial({ map: ctx.labelTex(512, 256, drawDials) }),
  };
  const mm = (g) => { g.scale(0.001, 0.001, 0.001); g.userData.shared = true; return g; }; // cached: the app must not dispose
  const v = valveGeos(THREE), r = regGeos(THREE);
  const geo = {
    shell: mm(shellGeo(THREE)),
    band: mm(wrap(THREE, R + 0.35, 405, 461, -Math.PI / 2, 1.5 * Math.PI, 64)),
    id: mm(wrap(THREE, R + 0.35, 92, 192, -52 * D2R, -16 * D2R, 12)),
    stamp: mm(shoulderBand(THREE, YS + 9, YS + 21)),
    black: mm(mergeGeos(THREE, [...guardGeos(THREE), ...v.black, ...r.black])),
    brass: mm(mergeGeos(THREE, [...v.brass, ...r.brass])),
    ss: mm(mergeGeos(THREE, [...v.ss, ...r.ss])),
    pvc: mm(mergeGeos(THREE, [...v.pvc, ...r.pvc])),
    green: mm(mergeGeos(THREE, r.green)),
    grey: mm(mergeGeos(THREE, r.grey)),
    dial: mm(mergeGeos(THREE, r.dial)),
    hole: mm(mergeGeos(THREE, r.hole)),
    face: mm(mergeGeos(THREE, r.face)),
    knobLbl: mm(mergeGeos(THREE, r.knobLbl)),
    stamp: mm(mergeGeos(THREE, r.stamp)),
  };
  CACHE = { THREE, mat, geo };
  return CACHE;
}

export function build(THREE, ctx, opts = {}) {
  const { mat, geo } = cache(THREE, ctx), M = ctx.MAT;
  const g = new THREE.Group(); g.name = 'co2';
  const mesh = (gg, m, name, own) => { const o = new THREE.Mesh(gg, m); o.name = name; if (own) o.userData.ownMat = true; g.add(o); return o; };
  ctx.core(mesh(geo.shell, mat.paint, 'cylinder', true));
  mesh(geo.band, mat.band, 'labelBand', true);
  mesh(geo.id, mat.id, 'labelId', true);
  mesh(geo.stamp, mat.stamp, 'shoulderStamp', true);
  mesh(geo.black, M.black, 'guardWheelKnobBoots');
  mesh(geo.brass, mat.brass, 'brass', true);
  mesh(geo.ss, M.ss, 'chrome');
  mesh(geo.pvc, M.pvc, 'whitePlastic');
  mesh(geo.green, M.green, 'prvCap');
  mesh(geo.grey, mat.grey, 'duotight', true);
  mesh(geo.dial, mat.dial, 'gaugeFaces', true);
  mesh(geo.face, mat.face, 'regFaceLabel', true);
  mesh(geo.knobLbl, mat.knobLbl, 'knobLabel', true);
  mesh(geo.stamp, mat.nutStamp, 'type30Stamp', true);
  mesh(geo.hole, M.hole, 'outletBore');
  return g;
}

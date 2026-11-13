// Blichmann Engineering RipTide brewing pump, 1.5" tri-clamp version (BL299), as on the user's board.
// Published: 7 GPM, 21 ft head, 1/25 hp magnetic-drive (March 815-class motor), stainless head joined to
// the motor by a 3" TC clamp and rotatable 360°, inline head (inlet passage cast into the front face to the
// impeller eye, outlet radial on the opposite side), integral linear flow valve on the outlet (black knob on
// a stem parallel to the motor axis, retaining clip), corny-keg style pull-ring PRV vent with barb,
// large stable base with rubber feet that doubles as a cord wrap, power switch on the base, 10 ft cord.
// User's unit (photo 147a5554): silver finned motor sleeve between black end caps, black base; head turned
// so the inlet points to the front edge of the board (+z) and the outlet/valve to the back (-z), knob
// pointing the same way as the head (+x, toward the mash tun).
// Axes: motor axis along x, head at +x. +z = front (inlet side), y up, origin = bottom centre of the base.

const PI = Math.PI;
const X0 = 0.030;          // shift so the base footprint is centred on x = 0
const YA = 0.088;          // motor / head axis height
const OUT_ANG = { back: 0, up: 90, front: 180, down: 270 };
// port geometry in head-local coordinates (x absolute before X0, y/z relative to the axis), outlet at angle 0
const P_IN = { pos: [0.116, 0, 0.062], dir: [0, 0, 1] };
const P_OUT = { pos: [0.095, 0, -0.115], dir: [0, 0, -1] };

function portFor(p, deg) {
  const a = deg * PI / 180, c = Math.cos(a), s = Math.sin(a);
  const rot = ([x, y, z]) => [x, y * c - z * s, y * s + z * c];
  const q = rot(p.pos), d = rot(p.dir), r = (v) => +v.toFixed(4);
  return { pos: [r(q[0] + X0), r(q[1] + YA), r(q[2])], dir: d.map((v) => r(v) || 0), size: '1.5" TC' };
}

export const defaultOptions = { outlet: 'back' }; // outlet direction: 'back' | 'up' | 'front' | 'down' or degrees (0 = back, 90 = up)

export const meta = {
  id: 'riptide',
  name: 'Blichmann RipTide brewing pump (1.5" TC)',
  dims: '272 long on the motor axis (rear cap to valve knob) × 186 across the TC ports × 147 high; Ø94 motor; base 140 × 130',
  ports: { inlet: portFor(P_IN, 0), outlet: portFor(P_OUT, 0) },
};

let TEX = null;
function makeTex(ctx) {
  const fit = (g, text, maxW, size, weight = 'bold', fam = 'Arial, Helvetica, sans-serif') => { let f = size; do { g.font = `${weight} ${f}px ${fam}`; f -= 1; } while (g.measureText(text).width > maxW && f > 6); };
  return {
    logo: ctx.labelTex(512, 96, (g, w, h) => {
      g.fillStyle = '#e9e9e9'; g.textBaseline = 'middle'; g.textAlign = 'left';
      fit(g, 'BLICHMANN', 300, 50); g.fillText('BLICHMANN', 8, 34);
      fit(g, 'ENGINEERING', 300, 22, 'normal'); g.fillText('ENGINEERING', 10, 74);
      g.fillStyle = '#c9cdd1'; g.textAlign = 'right'; fit(g, 'RipTide', 180, 56, 'bold italic'); g.fillText('RipTide', w - 8, 48);
      g.fillRect(318, 18, 3, 60);
    }),
    badge: ctx.labelTex(256, 64, (g, w, h) => {
      g.fillStyle = '#dcdcdc'; g.textAlign = 'center'; g.textBaseline = 'middle';
      fit(g, 'BLICHMANN', 236, 46); g.fillText('BLICHMANN', w / 2, h / 2 + 2);
    }),
  };
}

export function build(THREE, ctx, opts = {}) {
  const o = { ...defaultOptions, ...opts };
  const { MAT } = ctx;
  if (!TEX) TEX = makeTex(ctx);
  const deg = typeof o.outlet === 'number' ? o.outlet : (OUT_ANG[o.outlet] ?? 0);
  const rad = (d) => d * PI / 180;
  const V2 = (x, y) => new THREE.Vector2(x, y);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const g = new THREE.Group();
  const SS = [], SSD = [], ALU = [], BLK = [], RUB = [], HOLE = [];

  // ---------- helpers ----------
  const arc = (cx, cy, r, a0, a1, n) => { const p = []; for (let i = 0; i <= n; i++) { const a = rad(a0 + (a1 - a0) * i / n); p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return p; };
  // lathe about +x: profile points [r, x]
  const latheX = (pts, segs, p0 = 0, pl = 2 * PI) => new THREE.LatheGeometry(pts.map(([r, x]) => V2(Math.max(r, 0), x)), segs, p0, pl).rotateZ(-PI / 2);
  // lathe about +y: profile points [r, y]
  const latheY = (pts, segs) => new THREE.LatheGeometry(pts.map(([r, y]) => V2(Math.max(r, 0), y)), segs);
  const cylX = (r, x0, x1, segs, r1 = r) => new THREE.CylinderGeometry(r1, r, x1 - x0, segs).rotateZ(-PI / 2).translate((x0 + x1) / 2, 0, 0);
  const cylY = (r, y0, y1, segs, r1 = r) => new THREE.CylinderGeometry(r1, r, y1 - y0, segs).translate(0, (y0 + y1) / 2, 0);
  const put = (arr, geom, m) => { if (m) geom.applyMatrix4(m); arr.push(geom); return geom; };
  // orient +y to dir, then place at p
  const orient = (dir, p) => new THREE.Matrix4().compose(V3(...p), new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), V3(...dir).normalize()), V3(1, 1, 1));
  const rrect = (w, d, r) => {
    const s = new THREE.Shape(), x = w / 2, y = d / 2;
    s.moveTo(-x + r, -y); s.lineTo(x - r, -y); s.quadraticCurveTo(x, -y, x, -y + r); s.lineTo(x, y - r); s.quadraticCurveTo(x, y, x - r, y);
    s.lineTo(-x + r, y); s.quadraticCurveTo(-x, y, -x, y - r); s.lineTo(-x, -y + r); s.quadraticCurveTo(-x, -y, -x + r, -y);
    return s;
  };
  // slab in the xz plane from y0 to y1, rounded corners and a small edge bevel
  const slab = (w, d, r, y0, y1, bv = 0.0012) => new THREE.ExtrudeGeometry(rrect(w - 2 * bv, d - 2 * bv, r), { depth: y1 - y0 - 2 * bv, bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelSegments: 1, curveSegments: 4 })
    .rotateX(-PI / 2).translate(0, y0 + bv, 0);
  const tubeGeo = (pts, r, rs = 12) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => V3(...p)), false, 'catmullrom', 0.2), pts.length * 6, r, rs, false);



  // =====================================================================================================
  // MOTOR (x before X0 shift): rear cap -0.110..-0.086, finned sleeve -0.086..0.010, front cap 0.010..0.036,
  // black front bracket 0.036..0.052, stainless TC adapter 0.048..0.060 (3" flange face at 0.060)
  // =====================================================================================================
  const MX = new THREE.Matrix4().makeTranslation(X0, YA, 0);
  const RM = 0.0455; // motor cap radius
  {
    // rear end cap: black, domed, with a centre boss
    const P = [[0, -0.1105], [0.012, -0.1105], ...arc(0.012, -0.1085, 0.002, -90, 0, 2).slice(1), [0.016, -0.1065], [0.030, -0.1060],
      ...arc(RM - 0.010, -0.0960, 0.010, -90, 0, 5).slice(1), [RM, -0.0880], [RM - 0.0015, -0.0866], [0.041, -0.0866], [0.041, -0.0855]];
    const rc = new THREE.Mesh(latheX(P, 40), MAT.black); rc.geometry.applyMatrix4(MX); g.add(ctx.core(rc));
    // front cap + bracket neck
    const F = [[0.041, 0.0095], [RM - 0.0015, 0.0095], [RM, 0.011], [RM, 0.030], ...arc(RM - 0.006, 0.030, 0.006, 0, 90, 4).slice(1),
      [0.034, 0.036], [0.034, 0.050], [0.036, 0.0505], [0.036, 0.052], [0.030, 0.052]];
    const fc = new THREE.Mesh(latheX(F, 40), MAT.black); fc.geometry.applyMatrix4(MX); g.add(ctx.core(fc));
    // finned aluminium sleeve: 36 longitudinal fins
    const s = new THREE.Shape(), N = 36, RT = 0.0470, RR = 0.0420;
    for (let i = 0; i < N; i++) {
      const a = 2 * PI * i / N, da = 2 * PI / N;
      const pts = [[RR, a + da * 0.02], [RT - 0.0006, a + da * 0.30], [RT, a + da * 0.36], [RT, a + da * 0.50], [RT - 0.0006, a + da * 0.56], [RR, a + da * 0.84]];
      pts.forEach(([r, t], k) => { const x = r * Math.cos(t), y = r * Math.sin(t); if (i === 0 && k === 0) s.moveTo(x, y); else s.lineTo(x, y); });
    }
    s.closePath();
    const hole = new THREE.Path(); hole.absarc(0, 0, 0.038, 0, 2 * PI, true); s.holes.push(hole);
    const fin = new THREE.ExtrudeGeometry(s, { depth: 0.096, bevelEnabled: false, curveSegments: 24 }).rotateY(PI / 2).translate(-0.086, 0, 0);
    const fm = new THREE.Mesh(fin.applyMatrix4(MX), MAT.alu); g.add(ctx.core(fm));
    // sleeve end collars (seat the fins into the caps)
    put(ALU, latheX([[0.0435, -0.0875], [0.0435, -0.0855]], 40), MX);
    put(ALU, latheX([[0.0435, 0.0095], [0.0435, 0.0115]], 40), MX);
    // through-bolt heads on the rear cap (4)
    for (let i = 0; i < 4; i++) {
      const a = rad(45 + 90 * i), y = Math.sin(a) * 0.033, z = Math.cos(a) * 0.033;
      put(SS, cylX(0.0032, -0.1092, -0.1072, 10).translate(0, y, z), MX);
    }
    // stainless TC adapter bracket: hub + 3" ferrule-style flange (Ø91), flat-head screws into the bracket
    put(SS, latheX([[0.030, 0.0505], [0.040, 0.0505], [0.040, 0.0545], [0.042, 0.0560], [0.0455, 0.0570], [0.0455, 0.0596], [0.0449, 0.0602], [0.036, 0.0602], [0.036, 0.0600]], 48), MX);
    for (let i = 0; i < 4; i++) {
      const a = rad(45 + 90 * i);
      put(SS, cylX(0.0026, 0.0505, 0.0510, 10, 0.0018).translate(0, Math.sin(a) * 0.0365, Math.cos(a) * 0.0365), MX);
    }
  }

  // =====================================================================================================
  // BASE: black, cord-wrap waist between two flanges, rubber feet, motor saddles, switch pod, cord gland
  // =====================================================================================================
  const BW = 0.140, BD = 0.130; // footprint x × z
  {
    const yF = 0.006;
    put(BLK, slab(BW, BD, 0.014, yF, yF + 0.006));                 // bottom flange
    put(BLK, slab(BW - 0.020, BD - 0.020, 0.008, yF + 0.0055, 0.0345, 0.0008)); // waist (cord wrap)
    put(BLK, slab(BW, BD, 0.014, 0.034, 0.040));                     // top flange
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      put(RUB, latheY([[0, 0], [0.0075, 0], [0.0088, 0.0012], [0.0088, yF]], 12).translate(x * (BW / 2 - 0.016), 0, z * (BD / 2 - 0.016)));
    }
    // motor saddles (two cradles under the caps, shaped to the motor)
    const sad = new THREE.Shape(), hw = 0.034, yb = 0.040 - YA, R = RM + 0.0002;
    const ya = -Math.sqrt(R * R - hw * hw);
    sad.moveTo(-hw, yb); sad.lineTo(hw, yb); sad.lineTo(hw, ya);
    for (let i = 0; i <= 12; i++) { const t = Math.asin(hw / R) * (1 - 2 * i / 12); sad.lineTo(R * Math.sin(t), -R * Math.cos(t)); }
    sad.lineTo(-hw, yb);
    for (const [x0, x1] of [[-0.098, -0.088], [0.012, 0.030]]) {
      put(BLK, new THREE.ExtrudeGeometry(sad, { depth: x1 - x0, bevelEnabled: false, curveSegments: 1 }).rotateY(PI / 2).translate(x0, 0, 0), MX);
    }
    // switch pod at the front-left of the waist, rocker under a clear boot
    const sx = -0.034, zf = BD / 2;
    put(BLK, new THREE.BoxGeometry(0.036, 0.0225, 0.012).translate(sx, 0.023, zf - 0.006));
    put(BLK, new THREE.BoxGeometry(0.028, 0.017, 0.003).translate(sx, 0.023, zf + 0.0012));     // bezel
    put(HOLE, new THREE.BoxGeometry(0.023, 0.012, 0.001).translate(sx, 0.023, zf + 0.0028));
    const rk = new THREE.BoxGeometry(0.021, 0.0105, 0.003).rotateX(rad(10)).translate(sx, 0.023, zf + 0.0034);
    put(BLK, rk);
    put(RUB, new THREE.BoxGeometry(0.002, 0.004, 0.0008).translate(sx - 0.006, 0.0255, zf + 0.0050)); // "I" mark recess
    // cord gland on the rear (-x) of the waist, short cord stub down onto the shelf
    const gx = -(BW / 2 - 0.010), gz = 0.024, gy = 0.020;
    put(BLK, new THREE.CylinderGeometry(0.0085, 0.0085, 0.006, 6).rotateZ(PI / 2).translate(gx - 0.003, gy, gz));
    put(BLK, cylX(0.0062, gx - 0.020, gx - 0.006, 12, 0.0042).translate(0, gy, gz));
    put(BLK, tubeGeo([[gx - 0.019, gy, gz], [gx - 0.027, gy - 0.003, gz], [gx - 0.033, 0.0050, gz + 0.001], [gx - 0.040, 0.0036, gz - 0.002], [gx - 0.050, 0.0036, gz - 0.004]], 0.0036, 10));
    put(BLK, new THREE.CircleGeometry(0.0036, 10).rotateY(-PI / 2).translate(gx - 0.050, 0.0036, gz - 0.004));
  }

  // =====================================================================================================
  // HEAD (built with the outlet pointing -z, then turned about the motor axis by `deg`)
  // housing flange 0.0606..0.0652, volute body 0.065..0.110, front face at 0.110
  // =====================================================================================================
  const HM = new THREE.Matrix4().makeTranslation(X0, YA, 0).multiply(new THREE.Matrix4().makeRotationX(rad(deg)));
  const HSS = [], HSSD = [], HBLK = [], HHOLE = [];
  const tc = ctx.tc, TCG = new THREE.Group(); TCG.applyMatrix4(HM); g.add(TCG);
  const tcAt = (obj, p, dir, up) => TCG.add(tc.aim(obj, V3(...p), V3(...dir), up && V3(...up)));
  const XF = 0.110, RV = 0.0440;
  {
    // cast stainless housing: 3" TC flange, cylindrical volute, rounded front edge, slightly domed face
    const P = [[0.036, 0.0606], [0.0449, 0.0606], [0.0455, 0.0612], [0.0455, 0.0640], [0.0420, 0.0652], [RV - 0.002, 0.0670], [RV, 0.0690],
      [RV, XF - 0.010], ...arc(RV - 0.010, XF - 0.010, 0.010, 0, 90, 6).slice(1), [0.020, XF + 0.0015], [0, XF + 0.002]];
    const head = new THREE.Mesh(latheX(P, 48), MAT.ssDull); head.geometry.applyMatrix4(HM); g.add(ctx.core(head));
    // gasket line between the two 3" flanges
    tcAt(tc.gasket('3', { rimOnly: true }), [0.0604, 0, 0], [1, 0, 0], [0, 1, 0]);
    // cast inlet passage on the front face: from the impeller eye (centre) out to the +z port
    const xi = P_IN.pos[0];
    put(HSSD, new THREE.SphereGeometry(0.0155, 16, 10).translate(XF + 0.002, 0, 0));
    put(HSSD, tubeGeo([[XF + 0.002, 0, 0], [XF + 0.005, 0, 0.014], [xi, 0, 0.030], [xi, 0, 0.042]], 0.0150, 16));
    // inlet 1.5" TC ferrule (reducing neck)
    tcAt(tc.ferrule('1.5', { len: P_IN.pos[2] - 0.040, open: true, reduce: 0.027 }), [xi, 0, P_IN.pos[2]], [0, 0, 1]);
    // ---- outlet with integral linear flow valve ----
    const xo = P_OUT.pos[0], zT = -0.063, rT = 0.0165, xk = 0.124; // xk = valve body front end
    put(HSSD, cylY(0.0125, 0, 0.031, 16).applyMatrix4(orient([0, 0, -1], [xo, 0, -0.030])));       // boss from volute to valve body
    // valve body: horizontal cylinder parallel to the motor axis, rounded rear end
    put(HSSD, latheX([[0, 0.074], [0.008, 0.0742], ...arc(rT - 0.006, 0.080, 0.006, -90, 0, 4), [rT, xk - 0.002], [0.0135, xk - 0.0005], [0.0135, xk]], 24).translate(0, 0, zT));
    // bonnet nut (hex) + knurled collar, stem, retaining clip, black knob
    put(HSS, new THREE.CylinderGeometry(0.0142, 0.0142, 0.0085, 6).rotateZ(-PI / 2).translate(xk + 0.0042, 0, zT));
    put(HSS, cylX(0.0110, xk + 0.0085, xk + 0.012, 20).translate(0, 0, zT));
    put(HSS, cylX(0.0038, xk + 0.012, xk + 0.016, 12).translate(0, 0, zT));
    put(HSS, new THREE.TorusGeometry(0.0062, 0.0011, 6, 16).rotateY(PI / 2).translate(xk + 0.0142, 0, zT));
    {
      const k0 = xk + 0.0155;
      const K = [[0.0040, k0], [0.0120, k0], ...arc(0.0120, k0 + 0.003, 0.003, -90, 0, 2).slice(1), [0.0158, k0 + 0.004], [0.0160, k0 + 0.006], [0.0160, k0 + 0.019],
        ...arc(0.0130, k0 + 0.019, 0.003, 0, 90, 3).slice(1), [0, k0 + 0.022]];
      put(HBLK, latheX(K, 24).translate(0, 0, zT));
      // knurl ribs on the knob
      for (let i = 0; i < 12; i++) {
        const a = 2 * PI * i / 12;
        put(HBLK, new THREE.BoxGeometry(0.012, 0.0022, 0.0022).rotateX(a).translate(k0 + 0.0125, Math.sin(a) * 0.0162, zT + Math.cos(a) * 0.0162));
      }
    }
    // outlet neck + 1.5" TC ferrule
    tcAt(tc.ferrule('1.5', { len: zT - 0.015 - P_OUT.pos[2], open: true, reduce: 0.022 }), [xo, 0, P_OUT.pos[2]], [0, 0, -1]);

    // PRV vent (corny-keg style pull ring) on the volute between outlet and top, with vent barb
    const pa = rad(40), pd = [0, Math.sin(pa), -Math.cos(pa)], pr = (r) => [0.087, pd[1] * r, pd[2] * r];
    put(HSS, new THREE.CylinderGeometry(0.0078, 0.0078, 0.008, 6).translate(0, 0.004, 0).applyMatrix4(orient(pd, pr(RV - 0.002))));
    put(HSS, cylY(0.0058, 0, 0.012, 14, 0.0052).applyMatrix4(orient(pd, pr(RV + 0.006))));
    put(HSS, cylY(0.0012, 0, 0.007, 6).applyMatrix4(orient(pd, pr(RV + 0.018))));
    put(HSS, new THREE.TorusGeometry(0.0085, 0.0013, 6, 18).rotateY(PI / 2).translate(0, 0.0085, 0).applyMatrix4(orient(pd, pr(RV + 0.024))));
    // vent barb out of the side of the PRV body (toward +x)
    put(HSS, cylX(0.0024, 0.091, 0.103, 10).applyMatrix4(new THREE.Matrix4().makeTranslation(0, pd[1] * (RV + 0.012), pd[2] * (RV + 0.012))));
    put(HSS, cylX(0.0024, 0.0985, 0.1035, 10, 0.0036).applyMatrix4(new THREE.Matrix4().makeTranslation(0, pd[1] * (RV + 0.012), pd[2] * (RV + 0.012))));

    // 3" tri-clamp (shared kit) on the motor-adapter / housing flange joint, lugs and wing nut on top
    tcAt(tc.clamp('3'), [0.0604, 0, 0], [1, 0, 0], [0, 1, 0]);
  }
  for (const [src, dst] of [[HSS, SS], [HSSD, SSD], [HBLK, BLK], [HHOLE, HOLE]]) for (const q of src) dst.push(q.applyMatrix4(HM));

  // ---------- logo decals ----------
  {
    const d = ctx.decal(TEX.logo, 0.074, 0.0139);
    d.position.set(0.021, 0.0225, BD / 2 - 0.010 + 0.0006);
    g.add(d);
  }

  // ---------- merge static parts per material ----------
  const merge = (list) => {
    let nv = 0, ni = 0;
    for (const q of list) { nv += q.attributes.position.count; ni += q.index ? q.index.count : q.attributes.position.count; }
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = new Float32Array(nv * 2);
    const I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let vo = 0, io = 0;
    for (const q of list) {
      if (!q.attributes.normal) q.computeVertexNormals();
      const a = q.attributes, c = a.position.count;
      P.set(a.position.array.subarray(0, c * 3), vo * 3);
      N.set(a.normal.array.subarray(0, c * 3), vo * 3);
      if (a.uv) U.set(a.uv.array.subarray(0, c * 2), vo * 2);
      if (q.index) { const ix = q.index.array; for (let k = 0; k < ix.length; k++) I[io++] = ix[k] + vo; }
      else for (let k = 0; k < c; k++) I[io++] = k + vo;
      vo += c; q.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(P, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    out.setIndex(new THREE.BufferAttribute(I, 1));
    return out;
  };
  for (const [list, mat] of [[SS, MAT.ss], [SSD, MAT.ssDull], [ALU, MAT.alu], [BLK, MAT.black], [RUB, MAT.rubber], [HOLE, MAT.hole]]) {
    if (list.length) g.add(new THREE.Mesh(merge(list), mat));
  }
  g.userData.ports = { inlet: portFor(P_IN, deg), outlet: portFor(P_OUT, deg) };
  return g;
}

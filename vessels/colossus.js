// KegLand "Coolossus" Gen 2.1 stainless counterflow chiller (KL22514), BrewZilla Camlok kit (KB51361):
// tube-in-tube coil, 22 mm OD coolant jacket (9 m) around a 12.7 mm OD wort line (9.5 m), coil
// Ø280 x ~280 mm, axis vertical, lying flat on its bottom turn. Both coil ends leave tangentially
// on the same side (front, +z): wort runs on through a jacket end-cap to a 1.5" TC ferrule
// (+ clamp + 1.5" TC x 1/2" camlock male adapter); coolant leaves through a 1/2" BSPT side branch
// (pointing inward, towards each other) fitted with a Hoselock-style garden hose quick connect.
// 3 mm mounting plate welded up the back. Origin = bottom centre of footprint, +z front.
export const meta = {
  id: 'colossus',
  name: 'KegLand Coolossus Gen 2.1 counterflow chiller (Camlok kit)',
  dims: 'coil Ø280 × 280 mm, 9.5 m wort / 9 m coolant, 304 SS',
};

const TAU = Math.PI * 2;
// ---------- dimensions (metres) ----------
const RT = 0.011;            // coolant jacket tube radius (22 OD)
const RW = 0.00635;          // wort tube radius (12.7 OD)
const RC = 0.140 - RT;       // coil centreline radius (coil OD 280)
const TURNS = 11.5;          // ~9 m of jacket
const Y0 = RT;               // bottom turn centre
const YT = 0.2695;           // top turn centre (coil height ~280)
const Y1 = 0.038;            // bottom lead after its small S-bend (TC clamp clears the shelf)
const ZE = 0.185;            // jacket end-cap position (local z)
const ZB = 0.165;            // coolant branch position
const ZF = 0.279;            // TC ferrule face (Williams Q&A: 16.5" TC to back)
const GK = 0.0015;           // TC gasket thickness
const CAM_L = 0.046;         // TC x camlock adapter length (face to tip)
const HOSE_TIP = 0.073;      // hose connector tip, from jacket centreline
const PLATE_T = 0.003;
const Z_TIP = ZF + GK + CAM_L;
const Z_BACK = -(RC + RT) - PLATE_T;
const DZ = -(Z_TIP + Z_BACK) / 2;  // centre the footprint in z
const r4 = (v) => Math.round(v * 10000) / 10000;

meta.ports = {
  wortIn: { pos: [r4(RC), YT, r4(Z_TIP + DZ)], dir: [0, 0, 1], type: '1/2" camlock male (on 1.5" TC), hot wort in, top' },
  wortOut: { pos: [r4(-RC), Y1, r4(Z_TIP + DZ)], dir: [0, 0, 1], type: '1/2" camlock male (on 1.5" TC), cooled wort out, bottom' },
  waterIn: { pos: [r4(-RC + HOSE_TIP), Y1, r4(ZB + DZ)], dir: [1, 0, 0], type: 'garden hose quick connect (Hoselock-style male) on 1/2" BSPT, coolant in, bottom' },
  waterOut: { pos: [r4(RC - HOSE_TIP), YT, r4(ZB + DZ)], dir: [-1, 0, 0], type: 'garden hose quick connect (Hoselock-style male) on 1/2" BSPT, coolant out, top' },
};
export const defaultOptions = {};

// module-level extra materials (created once)
let XM = null;
function extraMats(THREE) {
  if (!XM) XM = {
    hoseGrey: new THREE.MeshStandardMaterial({ color: 0x6f757b, roughness: 0.55, metalness: 0 }),
    hoseAccent: new THREE.MeshStandardMaterial({ color: 0xe0a21c, roughness: 0.5, metalness: 0 }),
  };
  return XM;
}

// ---------- geometry helpers ----------
function sweep(THREE, pts, r, rs) {
  const n = pts.length, P = [], N = [], U = [], I = [];
  const T = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    return new THREE.Vector3().subVectors(b, a).normalize();
  });
  let nrm = new THREE.Vector3(0, 1, 0);
  if (Math.abs(T[0].y) > 0.9) nrm.set(1, 0, 0);
  nrm.sub(T[0].clone().multiplyScalar(nrm.dot(T[0]))).normalize();
  const tmp = new THREE.Vector3(), q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    if (i > 0) { q.setFromUnitVectors(T[i - 1], T[i]); nrm.applyQuaternion(q).normalize(); }
    const bin = new THREE.Vector3().crossVectors(T[i], nrm).normalize();
    for (let j = 0; j <= rs; j++) {
      const a = (j / rs) * TAU;
      tmp.copy(nrm).multiplyScalar(Math.cos(a)).addScaledVector(bin, Math.sin(a));
      P.push(pts[i].x + tmp.x * r, pts[i].y + tmp.y * r, pts[i].z + tmp.z * r);
      N.push(tmp.x, tmp.y, tmp.z); U.push(i / (n - 1), j / rs);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < rs; j++) {
    const a = i * (rs + 1) + j, b = a + rs + 1;
    I.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setIndex(I);
  return g;
}
function merge(THREE, geos) {
  const P = [], N = [], U = [], I = []; let off = 0;
  for (let g of geos) {
    if (!g.index) { const c = g.attributes.position.count; g.setIndex([...Array(c).keys()]); }
    const p = g.attributes.position, nn = g.attributes.normal, uv = g.attributes.uv;
    for (let k = 0; k < p.count; k++) {
      P.push(p.getX(k), p.getY(k), p.getZ(k)); N.push(nn.getX(k), nn.getY(k), nn.getZ(k));
      U.push(uv ? uv.getX(k) : 0, uv ? uv.getY(k) : 0);
    }
    const ix = g.index.array; for (let k = 0; k < ix.length; k++) I.push(ix[k] + off);
    off += p.count; g.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setIndex(off > 65535 ? new THREE.Uint32BufferAttribute(I, 1) : new THREE.Uint16BufferAttribute(I, 1));
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

export function build(THREE, ctx, opts = {}) {
  const MAT = ctx.MAT, XMat = extraMats(THREE);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const lathe = (prof, segs, ps = 0, pl = TAU) => new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), segs, ps, pl);
  const bucket = { ss: [], ssDull: [], gasket: [], grey: [], accent: [], hole: [] };
  const tc = ctx.tc;
  // frame: local +y = axis, local +x = "up" reference (clamp bolt / grip side)
  const frame = (pos, axis, xref) => {
    const y = axis.clone().normalize();
    const x = xref.clone().sub(y.clone().multiplyScalar(xref.dot(y))).normalize();
    const z = new THREE.Vector3().crossVectors(x, y);
    const m = new THREE.Matrix4().makeBasis(x, y, z); m.setPosition(pos); return m;
  };
  const put = (key, geo, m) => { geo.applyMatrix4(m); bucket[key].push(geo); };

  // ---------- coil (core) ----------
  const TH = TURNS * TAU, NS = Math.round(TURNS * 44), coil = [];
  for (let i = 0; i <= NS; i++) {
    const t = (i / NS) * TH;
    coil.push(V3(-RC * Math.cos(t), Y0 + (YT - Y0) * (t / TH), -RC * Math.sin(t)));
  }
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const coilMesh = ctx.core(new THREE.Mesh(sweep(THREE, coil, RT, 14), MAT.ss));
  coilMesh.name = 'coil'; body.add(coilMesh);

  // ---------- leads ----------
  const sstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const leads = [
    { x: -RC, yA: Y0, yB: Y1, inward: 1 },   // bottom end: wort out, coolant in
    { x: RC, yA: YT, yB: YT, inward: -1 },   // top end: wort in, coolant out
  ];
  const leadGeos = [];
  for (const L of leads) {
    const yAt = (z) => L.yA + (L.yB - L.yA) * sstep(0.08, 0.15, z);
    // jacket lead (22 OD)
    const jp = []; for (let k = 0, nk = 26; k <= nk; k++) { const z = (k / nk) * ZE; jp.push(V3(L.x, yAt(z), z)); }
    leadGeos.push(sweep(THREE, jp, RT, 14));
    // jacket end cap reducing to the wort line
    put('ss', lathe([[RT - 0.0002, -0.004], [RT + 0.0007, -0.0028], [RT + 0.0008, -0.0012], [RT, 0.0004], [0.0102, 0.0045], [0.0080, 0.0085], [RW + 0.0003, 0.0105], [RW, 0.012]], 18), frame(V3(L.x, L.yB, ZE), V3(0, 0, 1), V3(0, 1, 0)));
    // bare wort line to the ferrule
    leadGeos.push(sweep(THREE, [V3(L.x, L.yB, ZE + 0.008), V3(L.x, L.yB, ZF - 0.028)], RW, 12));

    // ---- 1.5" TC joint (shared ctx.tc): reducing ferrule on the 12.7 wort line, gasket, single-pin
    // clamp with the lugs up (nut swung outward), and the TC flange of the camlock adapter ----
    const fm = frame(V3(L.x, L.yB, ZF), V3(0, 0, 1), V3(0, 1, 0));
    const jt = tc.aim(tc.joint('1.5', { lenA: 0.030 + GK / 2, reduceA: 2 * RW, lenB: 0.0094, flip: L.inward > 0 }), V3(L.x, L.yB, ZF + GK / 2), V3(0, 0, 1), V3(0, 1, 0));
    for (const { material, geometry } of tc.bake(jt)) bucket[material === MAT.ss ? 'ss' : material === MAT.ssDull ? 'ssDull' : 'gasket'].push(geometry);
    // camlock adapter body beyond its TC flange (1/2" camlock male)
    const a0 = GK;
    put('ss', lathe([[0.0186, a0 + 0.0084], [0.0190, a0 + 0.0092], [0.0190, a0 + 0.0095], [0.0128, a0 + 0.0150], [0.0124, a0 + 0.0210], [0.01125, a0 + 0.0222],
      [0.01125, a0 + 0.0285], [0.0100, a0 + 0.0300], [0.0094, a0 + 0.0320], [0.0100, a0 + 0.0340], [0.01125, a0 + 0.0355],
      [0.01125, a0 + 0.0425], [0.0106, a0 + CAM_L], [0.0072, a0 + CAM_L], [0.0068, a0 + CAM_L - 0.004]], 24), fm.clone());
    const hd = new THREE.CircleGeometry(0.0068, 18); hd.rotateX(-Math.PI / 2); hd.translate(0, a0 + CAM_L - 0.004, 0);
    put('hole', hd, fm.clone());

    // ---- coolant branch: 1/2" BSPT male + garden hose quick connect, pointing inward ----
    const bm = frame(V3(L.x, L.yB, ZB), V3(L.inward, 0, 0), V3(0, 1, 0));
    put('ss', lathe([[0.0105, 0.0], [0.0105, 0.0200], [0.0100, 0.0210]], 18), bm.clone());
    const th = []; for (let k = 0; k <= 8; k++) th.push([k % 2 ? 0.0106 : 0.0099, 0.0210 + k * 0.0011]);
    put('ss', lathe(th, 16), bm.clone());
    // threaded female collar (12 flats = grip), then shoulder and male click nipple
    put('grey', lathe([[0.0100, 0.0290], [0.0158, 0.0290], [0.0166, 0.0300], [0.0166, 0.0455], [0.0150, 0.0475], [0.0118, 0.0480]], 12), bm.clone());
    put('accent', lathe([[0.0118, 0.0480], [0.0120, 0.0490], [0.0120, 0.0510], [0.0105, 0.0520]], 18), bm.clone());
    put('grey', lathe([[0.0105, 0.0520], [0.0092, 0.0540], [0.0090, 0.0590], [0.0076, 0.0605], [0.0076, 0.0630], [0.0092, 0.0650],
      [0.0092, 0.0700], [0.0078, HOSE_TIP], [0.0056, HOSE_TIP], [0.0054, HOSE_TIP - 0.004]], 18), bm.clone());
    const hh = new THREE.CircleGeometry(0.0054, 16); hh.rotateX(-Math.PI / 2); hh.translate(0, HOSE_TIP - 0.004, 0);
    put('hole', hh, bm.clone());
  }
  const leadMesh = new THREE.Mesh(merge(THREE, leadGeos), MAT.ss); leadMesh.name = 'leads'; body.add(leadMesh);

  // ---------- 3 mm mounting plate up the back (Gen 2.1), three Ø4 holes ----------
  const plate = new THREE.BoxGeometry(0.040, 0.268, PLATE_T); plate.translate(0, 0.006 + 0.134, -(RC + RT) - PLATE_T / 2);
  bucket.ssDull.push(plate);
  for (const y of [0.030, 0.140, 0.250]) {
    const h = new THREE.CircleGeometry(0.002, 12); h.rotateY(Math.PI); h.translate(0, y, -(RC + RT) - PLATE_T - 0.0002);
    bucket.hole.push(h);
  }

  const mats = { ss: MAT.ss, ssDull: MAT.ssDull, gasket: tc.gasketMat, grey: XMat.hoseGrey, accent: XMat.hoseAccent, hole: MAT.hole };
  for (const k of Object.keys(bucket)) if (bucket[k].length) {
    const m = new THREE.Mesh(merge(THREE, bucket[k]), mats[k]); m.name = k; body.add(m);
  }
  body.position.z = DZ;
  return g;
}

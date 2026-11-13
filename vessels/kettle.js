// Ss Brewtech Brewmaster Edition (BME) brew kettle, 20 gal (24 gal full volume), the "2.0" version with
// the dished bottom and integrated, slotted firebox skirt. Published size: 17.7" (450 mm) dia x 26" (660 mm).
// Matched to the user's photos: three open 1.5" TC ports (valve port low in the dish through a notch in the
// skirt, thermometer port above it, tangential whirlpool inlet ~50 deg to the left), etched logo above the
// ports, side handles on curved plates at +-90 deg, lid with a black silicone grip on a stainless strap.
const R = 0.225; // shell outer radius (17.7")
const TOP = 0.66; // top of rolled rim
const SEAM = 0.18; // knuckle: dish bottom meets the shell, top edge of the firebox skirt
const BOT = 0.03; // underside of the dish at the centre
const T = 0.0012; // 1.2 mm wall
const SK = R + 0.0008; // skirt radius
const DEG = Math.PI / 180;
// ports (heights from the photos, scaled by the 660 mm body and the slot rows)
const VALVE = { y: 0.1, face: R + 0.032 }; // valve/drain port, in the dish, through the skirt notch, phi = 0
const THERMO = { y: 0.27, face: R + 0.04 }; // thermometer port, phi = 0, under the logo
const WP = { phi: -50 * DEG, al: 40 * DEG, y: 0.24, len: 0.074, back: 0.008 }; // tangential whirlpool inlet
const wpDir = () => {
  const n = [Math.sin(WP.phi), 0, Math.cos(WP.phi)], t = [Math.cos(WP.phi), 0, -Math.sin(WP.phi)];
  const d = [0, 1, 2].map((i) => t[i] * Math.cos(WP.al) + n[i] * Math.sin(WP.al));
  return { n, d };
};
const r3 = (v) => v.map((x) => Math.round(x * 1000) / 1000);
export const meta = {
  id: 'kettle',
  name: 'Ss Brewtech Brewmaster Edition kettle 20 gal (integrated firebox)',
  dims: 'Ø450 × 660 body (≈ 735 incl. lid handle)',
  ports: (() => {
    const { n, d } = wpDir(), k = WP.len - WP.back;
    return {
      valve: { pos: [0, VALVE.y, VALVE.face], dir: [0, 0, 1] },
      thermo: { pos: [0, THERMO.y, THERMO.face], dir: [0, 0, 1] },
      whirlpool: { pos: r3([n[0] * R + d[0] * k, WP.y, n[2] * R + d[2] * k]), dir: r3(d) },
    };
  })(),
};
export const defaultOptions = { lid: true };

let CACHE = null;
// merge already-placed geometries (position + normal only) into one non-indexed geometry
function merge(THREE, geos) {
  const list = geos.map((q) => (q.index ? q.toNonIndexed() : q));
  let n = 0; for (const q of list) n += q.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3);
  let o = 0;
  for (const q of list) { P.set(q.attributes.position.array, o * 3); N.set(q.attributes.normal.array, o * 3); o += q.attributes.position.count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  for (const q of geos) q.dispose();
  return out;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// skirt texture layout (u = 0 at phi = -180 deg, phi = 0 (front, valve notch) at u = 0.5)
const TW = 2048, TH = 256;
const PXMM_X = TW / (2 * Math.PI * SK * 1000), PXMM_Y = TH / (SEAM * 1000);
const SLOT_ROWS = [50, 90, 130]; // mm above floor (slot centres)
const SLOT_L = 40, SLOT_H = 7; // mm
const NOTCH_W = 62, NOTCH_BOT = 65; // mm
const colX = (k) => ((TW / 2 + (k * TW) / 18) % TW + TW) % TW;
const rowY = (h) => (SEAM * 1000 - h) * PXMM_Y;

function stadium(g, cx, cy, w, h) {
  const r = h / 2, x0 = cx - w / 2 + r, x1 = cx + w / 2 - r;
  g.beginPath();
  g.moveTo(x0, cy - r); g.lineTo(x1, cy - r);
  g.arc(x1, cy, r, -Math.PI / 2, Math.PI / 2);
  g.lineTo(x0, cy + r);
  g.arc(x0, cy, r, Math.PI / 2, Math.PI * 1.5);
  g.closePath(); g.fill();
}

function tintLayers() {
  // deterministic list of heat-tint marks shared by the colour and roughness/metalness maps
  const rnd = rng(20261111);
  const blobs = [];
  // broad washes
  for (let i = 0; i < 46; i++) {
    const h = 20 + rnd() * 105, rx = (22 + rnd() * 40) * PXMM_X;
    blobs.push({ x: rnd() * TW, y: rowY(h), rx, ry: rx * (0.45 + rnd() * 0.5), a: 0.14 + rnd() * 0.24, kind: rnd() });
  }
  // fine mottling, densest around the slot rows
  for (let i = 0; i < 360; i++) {
    const h = 8 + Math.pow(rnd(), 1.15) * 135, rx = (3 + rnd() * 10) * PXMM_X;
    blobs.push({ x: rnd() * TW, y: rowY(h), rx, ry: rx * (0.5 + rnd() * 1.0), a: (0.05 + rnd() * 0.16) * (h > 140 ? 0.5 : 1), kind: rnd() });
  }
  const streaks = [];
  for (let k = 1; k < 18; k++) for (const h of SLOT_ROWS) {
    if (rnd() < 0.3) streaks.push({ x: colX(k) + (rnd() - 0.5) * 40, y: rowY(h) + 5, len: (10 + rnd() * (h - 15)) * PXMM_Y, w: 6 + rnd() * 14, a: 0.1 + rnd() * 0.2 });
  }
  return { blobs, streaks };
}

function drawTint(g, L, mode) {
  // mode 'col': albedo; mode 'rm': G = roughness, B = metalness
  const col = mode === 'col';
  g.fillStyle = col ? '#ffffff' : 'rgb(0,92,240)';
  g.fillRect(0, 0, TW, TH);
  // palette: albedo, and (roughness, metalness) for the rm map
  const PAL = { straw: ['205,170,105', 0.38, 0.92], rust: ['132,78,36', 0.7, 0.55], brown: ['92,62,40', 0.66, 0.6], soot: ['40,35,31', 0.82, 0.38], blue: ['76,72,112', 0.4, 0.85] };
  const C = (k, a) => { const p = PAL[k]; return col ? `rgba(${p[0]},${a})` : `rgba(0,${Math.round(p[1] * 255)},${Math.round(p[2] * 255)},${a})`; };
  // straw / gold band just under the knuckle
  let gr = g.createLinearGradient(0, rowY(179), 0, rowY(120));
  gr.addColorStop(0, C('straw', 0)); gr.addColorStop(0.4, C('straw', 0.2)); gr.addColorStop(1, C('straw', 0));
  g.fillStyle = gr; g.fillRect(0, 0, TW, TH);
  // oxide band through the slot rows, soot toward the bottom edge
  gr = g.createLinearGradient(0, rowY(150), 0, rowY(20));
  gr.addColorStop(0, C('brown', 0)); gr.addColorStop(0.3, C('brown', 0.3)); gr.addColorStop(0.62, C('rust', 0.5)); gr.addColorStop(1, C('brown', 0.55));
  g.fillStyle = gr; g.fillRect(0, 0, TW, TH);
  gr = g.createLinearGradient(0, TH, 0, rowY(85));
  gr.addColorStop(0, C('soot', 0.95)); gr.addColorStop(0.25, C('soot', 0.78)); gr.addColorStop(0.6, C('soot', 0.35)); gr.addColorStop(1, C('soot', 0));
  g.fillStyle = gr; g.fillRect(0, 0, TW, TH);
  for (const b of L.blobs) {
    const rgb = b.kind < 0.42 ? 'rust' : b.kind < 0.72 ? 'brown' : b.kind < 0.94 ? 'soot' : 'blue';
    for (const dx of [-TW, 0, TW]) {
      if (b.x + dx + b.rx < 0 || b.x + dx - b.rx > TW) continue;
      g.save(); g.translate(b.x + dx, b.y); g.scale(1, b.ry / b.rx);
      const rg = g.createRadialGradient(0, 0, 0, 0, 0, b.rx);
      rg.addColorStop(0, C(rgb, b.a)); rg.addColorStop(0.6, C(rgb, b.a * 0.55)); rg.addColorStop(1, C(rgb, 0));
      g.fillStyle = rg; g.beginPath(); g.arc(0, 0, b.rx, 0, Math.PI * 2); g.fill(); g.restore();
    }
  }
  // exhaust smudges above each slot and rust drips below
  for (let k = 1; k < 18; k++) for (const h of SLOT_ROWS) {
    g.save(); g.translate(colX(k), rowY(h) - 7); g.scale(1, 0.38);
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, 44);
    rg.addColorStop(0, C('soot', 0.3)); rg.addColorStop(1, C('soot', 0));
    g.fillStyle = rg; g.beginPath(); g.arc(0, 0, 44, 0, Math.PI * 2); g.fill(); g.restore();
  }
  for (const s of L.streaks) {
    // soft vertical drip: an elongated radial falloff hanging under the slot
    g.save(); g.translate(s.x, s.y + s.len * 0.45); g.scale(1, s.len / s.w);
    const rg = g.createRadialGradient(0, -s.w * 0.3, 0, 0, 0, s.w / 2);
    rg.addColorStop(0, C('rust', s.a)); rg.addColorStop(0.6, C('rust', s.a * 0.5)); rg.addColorStop(1, C('rust', 0));
    g.fillStyle = rg; g.beginPath(); g.arc(0, 0, s.w / 2, 0, Math.PI * 2); g.fill(); g.restore();
  }
}

function drawSlots(g) {
  g.fillStyle = '#fff'; g.fillRect(0, 0, TW, TH);
  g.fillStyle = '#000';
  for (let k = 1; k < 18; k++) for (const h of SLOT_ROWS) {
    const x = colX(k), y = rowY(h);
    stadium(g, x, y, SLOT_L * PXMM_X, SLOT_H * PXMM_Y);
  }
  // U notch for the valve port (open at the top edge of the skirt)
  const x0 = TW / 2 - (NOTCH_W / 2) * PXMM_X, x1 = TW / 2 + (NOTCH_W / 2) * PXMM_X, yb = rowY(NOTCH_BOT), r = 16 * PXMM_X;
  g.beginPath(); g.moveTo(x0, -4); g.lineTo(x0, yb - r); g.arcTo(x0, yb, x0 + r, yb, r); g.lineTo(x1 - r, yb); g.arcTo(x1, yb, x1, yb - r, r); g.lineTo(x1, -4); g.closePath(); g.fill();
}

function drawLogo(g, w, h) {
  g.clearRect(0, 0, w, h);
  const ink = 'rgba(48,50,52,0.92)';
  g.strokeStyle = ink; g.lineWidth = w * 0.022;
  const m = w * 0.04;
  g.strokeRect(m, m, w - 2 * m, h - 2 * m);
  g.fillStyle = ink; g.textBaseline = 'alphabetic';
  g.font = `500 ${Math.round(h * 0.5)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  g.fillText('Ss', w * 0.15, h * 0.63);
  g.font = `400 ${Math.round(h * 0.115)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  g.fillText('brewtech', w * 0.15, h * 0.82);
}

function getCache(THREE, ctx) {
  if (CACHE) return CACHE;
  const L = tintLayers();
  const col = ctx.labelTex(TW, TH, (g) => drawTint(g, L, 'col'));
  const rm = ctx.labelTex(TW, TH, (g) => drawTint(g, L, 'rm'));
  rm.colorSpace = THREE.NoColorSpace;
  const slots = ctx.labelTex(TW, TH, (g) => drawSlots(g));
  slots.colorSpace = THREE.NoColorSpace;
  const logo = ctx.labelTex(512, 512, drawLogo);
  CACHE = {
    logo,
    skirt: new THREE.MeshStandardMaterial({ color: 0xd8dbde, map: col, roughnessMap: rm, metalnessMap: rm, roughness: 1, metalness: 1, alphaMap: slots, alphaTest: 0.5, side: THREE.FrontSide }),
    skirtIn: new THREE.MeshStandardMaterial({ color: 0x2e2925, roughness: 0.85, metalness: 0.35, alphaMap: slots, alphaTest: 0.5, side: THREE.BackSide }),
    fired: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.55, metalness: 0.75 }),
    soot: new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 1, metalness: 0 }),
  };
  return CACHE;
}

export function build(THREE, ctx, opts = {}) {
  const o = { ...defaultOptions, ...opts };
  const { MAT } = ctx;
  const C = getCache(THREE, ctx);
  const g = new THREE.Group();
  const V2 = (x, y) => new THREE.Vector2(x, y);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const add = (geo, mat, pos, rot) => { const m = new THREE.Mesh(geo, mat); if (pos) m.position.copy(pos); if (rot) m.rotation.set(...rot); g.add(m); return m; };

  // ---------- shell: outer wall, rolled rim, inside wall, inner dish ----------
  const rb = 0.0048, cx = R - T + rb, cy = TOP - rb;
  const prof = [V2(R, SEAM), V2(R, SEAM + 0.01), V2(R, cy - 0.04), V2(R, cy - 0.0034)];
  const a0 = Math.acos(-(rb - T) / rb); // lower-left where wall meets bead
  const aStart = 2 * Math.PI - a0;
  for (let i = 0; i <= 16; i++) { const a = aStart + (i / 16) * (3 * Math.PI - aStart); prof.push(V2(cx + rb * Math.cos(a), cy + rb * Math.sin(a))); }
  prof.push(V2(R - T, cy - 0.004), V2(R - T, SEAM + 0.01), V2(R - T, SEAM));
  const hI = SEAM - (BOT + 0.002), aI = R - T, rhoI = (aI * aI + hI * hI) / (2 * hI), cI = BOT + 0.002 + rhoI;
  const thI = Math.asin(aI / rhoI);
  for (let i = 1; i <= 12; i++) { const t = thI * (1 - i / 12); prof.push(V2(rhoI * Math.sin(t), cI - rhoI * Math.cos(t))); }
  g.add(ctx.core(new THREE.Mesh(new THREE.LatheGeometry(prof, 64), MAT.ss)));

  // outer face of the dish (inside the firebox, heat-coloured)
  const hO = SEAM - BOT, rhoO = (R * R + hO * hO) / (2 * hO), cO = BOT + rhoO, thO = Math.asin(R / rhoO);
  const dish = [];
  for (let i = 0; i <= 12; i++) { const t = (thO * i) / 12; dish.push(V2(rhoO * Math.sin(t), cO - rhoO * Math.cos(t))); }
  {
    const dg = new THREE.LatheGeometry(dish, 64), n = dish.length, cnt = dg.attributes.position.count;
    const cA = new THREE.Color(0x2c2724), cB = new THREE.Color(0x5a4636), cC = new THREE.Color(0xb9b4ae), tmp = new THREE.Color();
    const cols = new Float32Array(cnt * 3);
    for (let v = 0; v < cnt; v++) {
      const f = (v % n) / (n - 1); // 0 centre .. 1 knuckle
      if (f < 0.6) tmp.copy(cA).lerp(cB, f / 0.6); else tmp.copy(cB).lerp(cC, (f - 0.6) / 0.4);
      cols.set([tmp.r, tmp.g, tmp.b], v * 3);
    }
    dg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    add(dg, C.fired);
  }
  // shadowed floor inside the firebox (keeps the slots reading dark, as in the photos)
  add(new THREE.CircleGeometry(SK - 0.0015, 48), C.soot, V3(0, 0.0015, 0), [-Math.PI / 2, 0, 0]);
  const dishR = (y) => Math.sqrt(rhoO * rhoO - (cO - y) * (cO - y));

  // ---------- firebox skirt (slots + valve notch are in the alpha map) ----------
  const sk = ctx.core(add(new THREE.CylinderGeometry(SK, SK, SEAM, 96, 1, true, -Math.PI, 2 * Math.PI), C.skirt, V3(0, SEAM / 2, 0)));
  sk.userData.core = true;
  add(new THREE.CylinderGeometry(SK - 0.0012, SK - 0.0012, SEAM - 0.001, 96, 1, true, -Math.PI, 2 * Math.PI), C.skirtIn, V3(0, SEAM / 2, 0));
  // weld bead where skirt, dish and shell meet
  add(new THREE.TorusGeometry(R + 0.0004, 0.001, 6, 96), MAT.ssDull, V3(0, SEAM, 0), [Math.PI / 2, 0, 0]);

  // ---------- tri-clamp ports (shared ctx.tc ferrules, open bores) ----------
  const tc = ctx.tc;
  const port = (face, dir, len, reduce) => g.add(tc.aim(tc.ferrule('1.5', { len, open: true, reduce }), face, dir));
  // valve / drain port: low in the dish, out through the skirt notch
  { const y = VALVE.y, r0 = dishR(y) - 0.004; port(V3(0, y, VALVE.face), V3(0, 0, 1), VALVE.face - r0); }
  // thermometer port
  { const y = THERMO.y, r0 = R - 0.004; port(V3(0, y, THERMO.face), V3(0, 0, 1), THERMO.face - r0); }
  // tangential whirlpool inlet: 1/2" tube through the wall at a shallow angle, 1.5" TC flange
  {
    const w = wpDir(), n = V3(...w.n), d = V3(...w.d);
    const P = n.clone().multiplyScalar(R).setY(WP.y).addScaledVector(d, -WP.back);
    port(P.clone().addScaledVector(d, WP.len), d, WP.len, 0.0127);
  }

  // ---------- etched logo (wrapped onto the shell) ----------
  {
    const w = 0.077, h = 0.077;
    const m = ctx.decal(C.logo, w, h);
    m.geometry.dispose();
    m.geometry = new THREE.CylinderGeometry(R + 0.0003, R + 0.0003, h, 10, 1, true, -w / (2 * R), w / R);
    m.position.set(0, 0.525, 0);
    g.add(m);
  }

  // ---------- side handles: curved plate, pivot bosses, U rod, black silicone grip ----------
  const rounded = (pts, rad) => {
    const path = new THREE.CurvePath();
    let prev = pts[0];
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i], a = pts[i - 1], b = pts[i + 1];
      const r = Math.min(rad, p.distanceTo(a) / 2, p.distanceTo(b) / 2);
      const pin = p.clone().addScaledVector(a.clone().sub(p).normalize(), r);
      const pout = p.clone().addScaledVector(b.clone().sub(p).normalize(), r);
      path.add(new THREE.LineCurve3(prev, pin));
      path.add(new THREE.QuadraticBezierCurve3(pin, p, pout));
      prev = pout;
    }
    path.add(new THREE.LineCurve3(prev, pts[pts.length - 1]));
    return path;
  };
  for (const s of [-1, 1]) {
    const hg = new THREE.Group();
    hg.rotation.y = s * Math.PI / 2;
    hg.position.y = 0.575;
    g.add(hg);
    const pw = 0.15, ph = 0.045, pt = 0.0025;
    const plate = new THREE.BoxGeometry(pw, ph, pt, 16, 1, 1);
    const pos = plate.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), a = x / (R + pt / 2), rr = R + pt / 2 + z;
      pos.setXYZ(i, rr * Math.sin(a), pos.getY(i), rr * Math.cos(a));
    }
    plate.computeVertexNormals();
    hg.add(new THREE.Mesh(plate, MAT.ssDull));
    // pivot bosses + rivet heads + U rod, one stainless mesh
    const xb = 0.058, zb = Math.sqrt(R * R - xb * xb) + pt;
    const parts = [];
    for (const sx of [-1, 1]) {
      const boss = new THREE.CylinderGeometry(0.0068, 0.0068, 0.016, 14); boss.rotateX(Math.PI / 2); boss.translate(sx * xb, 0, zb + 0.0075);
      parts.push(boss);
      for (const sy of [-1, 1]) {
        const xr = sx * 0.064, zr = Math.sqrt(R * R - xr * xr) + pt;
        const rv = new THREE.SphereGeometry(0.0034, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2); rv.scale(1, 0.55, 1); rv.rotateX(Math.PI / 2); rv.translate(xr, sy * 0.0145, zr - 0.0003);
        parts.push(rv);
      }
    }
    const zg = R + 0.04;
    const rod = rounded([V3(-xb, 0, zb + 0.012), V3(-xb, 0, zg), V3(xb, 0, zg), V3(xb, 0, zb + 0.012)], 0.013);
    parts.push(new THREE.TubeGeometry(rod, 40, 0.0042, 10));
    hg.add(new THREE.Mesh(merge(THREE, parts), MAT.ss));
    const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.0115, 0.074, 6, 16), MAT.black);
    grip.rotation.z = Math.PI / 2; grip.position.set(0, 0, zg);
    hg.add(grip);
  }

  // ---------- lid: flat ring resting on the bead, shallow cone, strap handle with silicone grip ----------
  if (o.lid) {
    const y0 = TOP + 0.0003, rIn = R - 0.016, rc = 0.03, rise = 0.02;
    const lidY = (r) => (r >= rIn ? y0 + 0.0032 : r <= rc ? y0 + 0.0032 + rise : y0 + 0.0032 + rise * (rIn - r) / (rIn - rc));
    const lp = [V2(R + 0.0045, y0 + 0.0004), V2(R + 0.0058, y0 + 0.0016), V2(R + 0.0048, y0 + 0.0031), V2(R + 0.002, y0 + 0.0032), V2(rIn, y0 + 0.0032)];
    for (let i = 1; i <= 8; i++) { const r = rIn - (i / 8) * (rIn - rc); lp.push(V2(r, lidY(r))); }
    lp.push(V2(0.012, lidY(0) + 0.0003), V2(0, lidY(0) + 0.0004));
    g.add(ctx.core(new THREE.Mesh(new THREE.LatheGeometry(lp, 96), MAT.ss)));
    // handle along x
    const yTop = lidY(0) + 0.0004, gy = yTop + 0.04;
    const f0 = 0.104, f1 = 0.08;
    const strap = rounded([V3(-f0, lidY(f0) + 0.0022, 0), V3(-f1, lidY(f1) + 0.0022, 0), V3(-0.058, gy, 0), V3(0.058, gy, 0), V3(f1, lidY(f1) + 0.0022, 0), V3(f0, lidY(f0) + 0.0022, 0)], 0.012);
    const sg = new THREE.TubeGeometry(strap, 60, 0.0021, 8);
    sg.scale(1, 1, 3.4);
    add(sg, MAT.ss);
    const lg = new THREE.Mesh(new THREE.CapsuleGeometry(0.0115, 0.1, 6, 16), MAT.black);
    lg.rotation.z = Math.PI / 2; lg.position.set(0, gy, 0); lg.scale.set(1, 1, 0.92);
    g.add(lg);
    for (const sx of [-1, 1]) {
      const rv = new THREE.Mesh(new THREE.SphereGeometry(0.0042, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), MAT.ssDull);
      const fx = (f0 + f1) / 2 + 0.002;
      rv.position.set(sx * fx, lidY(fx) + 0.0035, 0);
      g.add(rv);
    }
  }
  return g;
}

// Nano Brewery 70 L hot liquor tank: a 45 x 45 cm stainless stockpot (71 L brim-full) with a rolled rim,
// two swing handles on bolted brackets, a lid with a knob, and weldless fittings on the front-left:
// a 3" dial thermometer on a tee with a vertical 3-piece ball valve under it, a camlock port near the rim
// 45 deg right of the dial (the coil inside is clustered there), a temperature probe in a compression gland
// about a third of the way up, and a low 3-piece ball valve with a barb. No hoses (ports end at their fittings).
// Fitting azimuths relative to the handle are taken from the user's photo (handle -> logo -> barb/low
// valve -> thermometer -> top camlock, sweeping from the -x handle toward the front).
// Origin: bottom centre. +y up, +z front. Handles on +-x. Option { lid: false } leaves the lid off.

const DEG = Math.PI / 180;
const R = 0.225; // shell outer radius
const H = 0.45; // top of the rolled rim
const RB = 0.0035; // rim bead radius

// Fitting layout: azimuth (deg, 0 = +z front, negative toward -x) and height of the port axis.
const P = {
  handleY: 0.37,
  therm: { a: 0, y: 0.41 }, // tee: dial thermometer in front, vertical ball valve below
  top: { a: 45, y: 0.42 }, // camlock port just under the rim, 45 deg right of the dial (facing it)
  mid: { a: 0, y: 0.125 }, // temperature probe (PT100 in a 1/2" compression gland, GX16 plug end)
  low: { a: 0, y: 0.042 }, // 3-piece ball valve with barb
  logo: { a: -90, y: 0.257, w: 0.124, h: 0.102 },
};
// lengths along each port (from the shell surface outwards)
const BULK = 0.016;
const VALVE_L = 0.064;
const BARB_L = 0.036;
const TEE_C = BULK + 0.022; // tee centre
const CAM_L = 0.010 + 0.030 + 0.016; // male adapter hex + coupler + hose tail
const STACK_L = 0.032 + VALVE_L + CAM_L; // tee centre to end of the camlock tail below the thermometer
const TOP_L = BULK + CAM_L;
const LOW_L = BULK + VALVE_L + 0.010 + BARB_L;
const MID_L = BULK + BARB_L;

const radial = (a, r, y) => [+(Math.sin(a * DEG) * r).toFixed(4), y, +(Math.cos(a * DEG) * r).toFixed(4)];
const rdir = (a) => [+Math.sin(a * DEG).toFixed(4), 0, +Math.cos(a * DEG).toFixed(4)];

export const meta = {
  id: 'hlt',
  name: 'Nano Brewery 70 L HLT',
  dims: 'Ø450 × 450 body (71 L), 500 high with lid, 600 across handles',
  ports: {
    out: { pos: radial(P.therm.a, R + TEE_C, +(P.therm.y - STACK_L).toFixed(4)), dir: [0, -1, 0] }, // valve under the thermometer
    low: { pos: radial(P.low.a, R + LOW_L, P.low.y), dir: rdir(P.low.a) },
    top: { pos: radial(P.top.a, R + TOP_L, P.top.y), dir: rdir(P.top.a) },
  },
};
export const defaultOptions = { lid: true };

/* ---------- cached textures / materials (one set per ctx) ---------- */
const CACHE = new WeakMap();
function assets(THREE, ctx) {
  let a = CACHE.get(ctx);
  if (a) return a;
  const logo = ctx.labelTex(512, 464, (g, w, h) => {
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.fillRect(4, 4, w - 8, h - 8);
    g.strokeStyle = 'rgba(28,28,30,0.55)';
    g.lineWidth = 4;
    g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = 'rgba(22,22,24,0.88)';
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.font = '300 220px "Helvetica Neue", Arial, sans-serif';
    let tw = g.measureText('NANO').width;
    g.save();
    g.translate(26, 250);
    g.scale(Math.min(1.05, (w - 52) / tw), 1);
    g.fillText('NANO', 0, 0);
    g.restore();
    g.font = '400 116px "Helvetica Neue", Arial, sans-serif';
    tw = g.measureText('Brewery').width;
    g.save();
    g.translate(46, 398);
    g.scale(Math.min(1, (w - 80) / tw), 1);
    g.fillText('Brewery', 0, 0);
    g.restore();
  });
  const dial = ctx.labelTex(256, 256, (g, w) => {
    const c = w / 2;
    g.fillStyle = '#f4f5f2';
    g.beginPath(); g.arc(c, c, 126, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#2a2a2a';
    const a0 = 135 * DEG, sweep = 270 * DEG; // 0 at lower-left, 100 at lower-right
    for (let i = 0; i <= 50; i++) {
      const a = a0 + (sweep * i) / 50, big = i % 5 === 0;
      g.lineWidth = big ? 2.4 : 1.1;
      g.beginPath();
      g.moveTo(c + Math.cos(a) * (big ? 92 : 100), c + Math.sin(a) * (big ? 92 : 100));
      g.lineTo(c + Math.cos(a) * 110, c + Math.sin(a) * 110);
      g.stroke();
    }
    g.fillStyle = '#222';
    g.font = 'bold 17px Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i <= 10; i++) {
      const a = a0 + (sweep * i) / 10;
      g.fillText(String(i * 10), c + Math.cos(a) * 76, c + Math.sin(a) * 76);
    }
    g.font = 'bold 15px Arial, sans-serif';
    g.fillText('NANO Brewery', c, c - 34);
    g.font = '13px Arial, sans-serif';
    g.fillText('°C   304SS', c, c + 40);
    // needle (about 76 °C) with a short tail
    const an = a0 + sweep * 0.76;
    g.fillStyle = '#151515';
    g.beginPath();
    g.moveTo(c + Math.cos(an) * 104, c + Math.sin(an) * 104);
    g.lineTo(c + Math.cos(an + Math.PI / 2) * 3.5, c + Math.sin(an + Math.PI / 2) * 3.5);
    g.lineTo(c - Math.cos(an) * 24 + Math.cos(an + Math.PI / 2) * 9, c - Math.sin(an) * 24 + Math.sin(an + Math.PI / 2) * 9);
    g.lineTo(c - Math.cos(an) * 24 - Math.cos(an + Math.PI / 2) * 9, c - Math.sin(an) * 24 - Math.sin(an + Math.PI / 2) * 9);
    g.lineTo(c - Math.cos(an + Math.PI / 2) * 3.5, c - Math.sin(an + Math.PI / 2) * 3.5);
    g.closePath(); g.fill();
    g.fillStyle = '#9a9c9e';
    g.beginPath(); g.arc(c, c, 6, 0, Math.PI * 2); g.fill();
  });
  const dialMat = new THREE.MeshBasicMaterial({ map: dial });
  a = { logo, dialMat };
  CACHE.set(ctx, a);
  return a;
}

/* ---------- geometry helpers ---------- */
function mergeGeoms(THREE, list) {
  let nv = 0, ni = 0;
  for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let vo = 0, io = 0;
  for (const g of list) {
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      pos[(vo + i) * 3] = p.getX(i); pos[(vo + i) * 3 + 1] = p.getY(i); pos[(vo + i) * 3 + 2] = p.getZ(i);
      nor[(vo + i) * 3] = n.getX(i); nor[(vo + i) * 3 + 1] = n.getY(i); nor[(vo + i) * 3 + 2] = n.getZ(i);
      if (u) { uv[(vo + i) * 2] = u.getX(i); uv[(vo + i) * 2 + 1] = u.getY(i); }
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.getX(i) + vo;
    else for (let i = 0; i < p.count; i++) idx[io++] = i + vo;
    vo += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

export function build(THREE, ctx, opts = {}) {
  const o = { ...defaultOptions, ...opts };
  const M = ctx.MAT;
  const A = assets(THREE, ctx);
  const V2 = (x, y) => new THREE.Vector2(x, y);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const out = new THREE.Group();
  out.name = 'hlt';
  const parts = new THREE.Group(); // everything here is merged per material at the end

  const mesh = (geom, mat, parent = parts) => { const m = new THREE.Mesh(geom, mat); parent.add(m); return m; };
  const grp = (parent = parts) => { const g = new THREE.Group(); parent.add(g); return g; };
  const arc = (pts, cx, cy, r, a0, a1, n) => { for (let i = 0; i <= n; i++) { const a = (a0 + ((a1 - a0) * i) / n) * DEG; pts.push(V2(cx + r * Math.cos(a), cy + r * Math.sin(a))); } };
  // cylinder along +z from z0 to z1
  const cz = (r0, r1, z0, z1, seg = 18, open = false) => {
    const g = new THREE.CylinderGeometry(r1, r0, z1 - z0, seg, 1, open);
    g.rotateX(Math.PI / 2); g.translate(0, 0, (z0 + z1) / 2); return g;
  };
  // hex prism (across flats af) along +z
  const hz = (af, z0, z1) => {
    const g = new THREE.CylinderGeometry(af / Math.sqrt(3), af / Math.sqrt(3), z1 - z0, 6, 1).toNonIndexed();
    g.rotateX(Math.PI / 2); g.rotateZ(Math.PI / 6); g.translate(0, 0, (z0 + z1) / 2); g.computeVertexNormals(); return g;
  };
  // lathe about +z from (r, z) points
  const lz = (pts, seg = 18) => { const g = new THREE.LatheGeometry(pts.map(([r, z]) => V2(r, z)), seg); g.rotateX(Math.PI / 2); return g; };
  const flat = (g) => { const n = g.toNonIndexed(); n.computeVertexNormals(); return n; };
  // a frame on the shell surface at azimuth a (deg), height y: local +z points radially out, +x tangential
  const port = (a, y, parent = parts) => { const g = grp(parent); g.position.set(Math.sin(a * DEG) * R, y, Math.cos(a * DEG) * R); g.rotation.y = a * DEG; return g; };

  /* ---------------- shell ---------------- */
  {
    const rc = 0.016, bx = R + 0.7 * RB, by = H - RB; // bottom corner radius, rim bead centre
    const pts = [V2(0.0001, 0), V2(R - rc, 0)];
    arc(pts, R - rc, rc, rc, -90, 0, 7);
    const wallTop = by - RB * Math.sin(Math.acos(0.7)); // where the wall meets the bead
    pts.push(V2(R, wallTop));
    arc(pts, bx, by, RB, -134, 180, 14);
    const ri = bx - RB; // inner wall radius
    pts.push(V2(ri, rc));
    arc(pts, R - rc, rc, ri - (R - rc), 0, -90, 7);
    pts.push(V2(0.0001, rc - (ri - (R - rc))));
    const shell = new THREE.Mesh(new THREE.LatheGeometry(pts, 64), M.ss);
    shell.name = 'shell';
    out.add(ctx.core(shell));
  }

  /* ---------------- lid ---------------- */
  if (o.lid) {
    const rl = 0.0026, ex = R + 0.0035, ey = H + rl; // lid edge bead sits on the pot rim
    const pts = [V2(0.0001, H + 0.0008), V2(ex - 0.004, H + 0.0008)];
    arc(pts, ex, ey, rl, -125, 160, 10);
    const brimY = ey + rl * Math.sin(160 * DEG);
    const r0 = 0.206, rise = 0.009;
    pts.push(V2(r0 + 0.006, brimY + 0.0002));
    for (let i = 0; i <= 10; i++) { const r = r0 * (1 - i / 10); pts.push(V2(Math.max(r, 0.0001), brimY + 0.0012 + rise * (1 - (r / r0) ** 2))); }
    const lid = new THREE.Mesh(new THREE.LatheGeometry(pts, 64), M.ss);
    lid.name = 'lid';
    out.add(ctx.core(lid));
    const topY = brimY + 0.0012 + rise;
    // knob
    const k = [[0.0001, 0], [0.017, 0], [0.017, 0.0018], [0.0145, 0.0042], [0.0068, 0.0058], [0.0056, 0.011], [0.0056, 0.019], [0.0095, 0.0235], [0.0128, 0.0285], [0.0132, 0.0315], [0.0118, 0.0352], [0.007, 0.0378], [0.0001, 0.0384]];
    const kg = new THREE.LatheGeometry(k.map(([r, y]) => V2(r, y)), 24);
    kg.translate(0, topY - 0.0006, 0);
    mesh(kg, M.ss);
  }

  /* ---------------- side handles (swing handles on bolted brackets) ---------------- */
  for (const s of [-1, 1]) {
    const f = port(90 * s, P.handleY);
    // bracket plate bent to the shell
    const bend = (g, rad = R) => {
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i), a = x / rad, r = rad + z;
        p.setXYZ(i, r * Math.sin(a), p.getY(i), r * Math.cos(a) - R);
      }
      g.computeVertexNormals();
      return g;
    };
    const plate = new THREE.BoxGeometry(0.142, 0.044, 0.003, 14, 1, 1);
    plate.translate(0, 0, 0.0015);
    mesh(bend(plate), M.ssDull, f);
    // dome-head bolts at the plate corners
    for (const bx of [-0.0625, 0.0625]) for (const by of [-0.0135, 0.0135]) {
      const h = new THREE.SphereGeometry(0.0043, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);
      h.rotateX(Math.PI / 2);
      const a = bx / R;
      h.rotateY(a);
      h.translate((R + 0.0028) * Math.sin(a), by, (R + 0.0028) * Math.cos(a) - R);
      mesh(h, M.ss, f);
    }
    // pivot lugs
    const pivZ = 0.017;
    for (const lx of [-0.051, 0.051]) {
      const a = lx / R, zs = (R + 0.002) * Math.cos(a) - R;
      const web = new THREE.BoxGeometry(0.007, 0.013, pivZ - zs);
      web.translate(lx, 0, (zs + pivZ) / 2);
      mesh(web, M.ssDull, f);
      const boss = new THREE.CylinderGeometry(0.0072, 0.0072, 0.009, 14);
      boss.rotateZ(Math.PI / 2);
      boss.translate(lx, 0, pivZ);
      mesh(boss, M.ssDull, f);
    }
    // U-shaped rod handle with a silicone grip, swung up 18 degrees
    const sw = grp(f);
    sw.position.set(0, 0, pivZ);
    sw.rotation.x = -32 * DEG;
    const path = new THREE.CatmullRomCurve3([
      V3(-0.057, 0, 0), V3(-0.050, 0, 0.001), V3(-0.0465, 0, 0.008), V3(-0.0465, 0, 0.030),
      V3(-0.0455, 0, 0.044), V3(-0.040, 0, 0.0515), V3(-0.030, 0, 0.054), V3(0, 0, 0.0548), V3(0.030, 0, 0.054),
      V3(0.040, 0, 0.0515), V3(0.0455, 0, 0.044), V3(0.0465, 0, 0.030), V3(0.0465, 0, 0.008), V3(0.050, 0, 0.001), V3(0.057, 0, 0),
    ], false, 'centripetal');
    mesh(new THREE.TubeGeometry(path, 56, 0.0032, 8, false), M.ss, sw);
    const grip = new THREE.CapsuleGeometry(0.0098, 0.072, 4, 14);
    grip.rotateZ(Math.PI / 2);
    grip.translate(0, 0, 0.0545);
    mesh(grip, M.black, sw);
  }

  /* ---------------- fitting builders (local +z = outwards along the fitting) ---------------- */
  // weldless bulkhead: PTFE washer, locknut, nipple
  const bulkhead = (f, white = false) => {
    mesh(cz(0.0158, 0.0158, -0.0012, 0.0016, 20), white ? M.pvc : M.rubber, f);
    mesh(hz(0.027, 0.0016, 0.0105), M.ss, f);
    mesh(hz(0.027, -0.0105, -0.0025), M.ss, f); // inner locknut (seen with the lid off)
    mesh(cz(0.0102, 0.0102, 0.0105, BULK, 16), M.ssDull, f);
  };
  // hose barb starting at z0 (with its own hex if hex = true)
  const barb = (f, z0, hex = true) => {
    let z = z0;
    if (hex) { mesh(hz(0.021, z, z + 0.009), M.ss, f); z += 0.009; }
    const L = BARB_L - (hex ? 0.009 : 0);
    const e = z + L;
    const pr = [[0.0001, z], [0.0068, z], [0.0068, z + 0.003], [0.0056, z + 0.004]];
    const nR = 3, step = (e - z - 0.006) / nR;
    for (let i = 0; i < nR; i++) { const zz = z + 0.004 + step * i; pr.push([0.0057, zz + 0.0005], [0.0077, zz + step - 0.0004], [0.0058, zz + step]); }
    pr.push([0.0056, e - 0.0005], [0.0052, e], [0.0040, e], [0.0040, e - 0.004], [0.0001, e - 0.004]);
    mesh(lz(pr, 18), M.ss, f);
    const hole = new THREE.CircleGeometry(0.0041, 16); hole.translate(0, 0, e - 0.0039);
    mesh(hole, M.hole, f);
  };
  // rounded-square prism along +z (valve flanges / body)
  const rsq = (half, rad, z0, z1) => {
    const sh = new THREE.Shape(), h = half, r = rad;
    sh.moveTo(-h + r, -h); sh.lineTo(h - r, -h); sh.quadraticCurveTo(h, -h, h, -h + r); sh.lineTo(h, h - r); sh.quadraticCurveTo(h, h, h - r, h);
    sh.lineTo(-h + r, h); sh.quadraticCurveTo(-h, h, -h, h - r); sh.lineTo(-h, -h + r); sh.quadraticCurveTo(-h, -h, -h + r, -h);
    const g = new THREE.ExtrudeGeometry(sh, { depth: z1 - z0, bevelEnabled: false, curveSegments: 3 });
    g.translate(0, 0, z0); return g;
  };
  // 3-piece 1/2" ball valve from z0 to z0 + VALVE_L, stem toward +y, lever along +z (open)
  const valve3 = (f, z0) => {
    const g = grp(f); g.position.z = z0;
    const L = VALVE_L, FL = 0.0055; // flange thickness
    for (const [a, sgn] of [[0, 1], [L, -1]]) {
      const z1 = a + sgn * 0.011, z2 = a + sgn * 0.0165;
      mesh(hz(0.024, Math.min(a, z1), Math.max(a, z1)), M.ss, g); // hex end
      mesh(cz(0.0132, 0.0132, Math.min(z1, z2), Math.max(z1, z2), 18), M.ss, g); // neck
      const z3 = z2 + sgn * FL;
      mesh(rsq(0.0166, 0.005, Math.min(z2, z3), Math.max(z2, z3)), M.ss, g); // cap flange
    }
    // centre body: barrel between the flanges, flats for the bolts
    const b0 = 0.0165 + FL, b1 = L - 0.0165 - FL;
    mesh(lz([[0.0001, b0], [0.0138, b0], [0.0152, b0 + 0.003], [0.0156, L / 2], [0.0152, b1 - 0.003], [0.0138, b1], [0.0001, b1]], 20), M.ss, g);
    // 4 bolts with nuts
    for (const bx of [-0.0128, 0.0128]) for (const by of [-0.0128, 0.0128]) {
      const rod = cz(0.0019, 0.0019, 0.0125, L - 0.0125, 8); rod.translate(bx, by, 0); mesh(rod, M.ss, g);
      for (const [n0, n1] of [[0.0125, 0.0165], [L - 0.0165, L - 0.0125]]) { const n = hz(0.0072, n0, n1); n.translate(bx, by, 0); mesh(n, M.ss, g); }
    }
    // stem boss, gland nut, lever
    const st = new THREE.Group(); g.add(st); st.position.set(0, 0, L / 2);
    mesh(new THREE.CylinderGeometry(0.0085, 0.0095, 0.006, 16).translate(0, 0.0165, 0), M.ss, st);
    const gl = new THREE.CylinderGeometry(0.0072, 0.0072, 0.007, 6).toNonIndexed(); gl.computeVertexNormals(); gl.translate(0, 0.023, 0); mesh(gl, M.ss, st);
    mesh(new THREE.CylinderGeometry(0.0032, 0.0032, 0.006, 10).translate(0, 0.0295, 0), M.ss, st);
    const lev = new THREE.BoxGeometry(0.012, 0.0028, 0.104); lev.translate(0, 0.0314, 0.044); mesh(lev, M.ss, st);
    const ln = new THREE.CylinderGeometry(0.0047, 0.0047, 0.004, 6).toNonIndexed(); ln.computeVertexNormals(); ln.translate(0, 0.0348, 0); mesh(ln, M.ss, st);
    const vg = new THREE.CapsuleGeometry(0.0036, 0.064, 3, 10); vg.rotateX(Math.PI / 2); vg.scale(2.15, 1, 1); vg.translate(0, 0.0316, 0.062); mesh(vg, M.black, st);
  };
  // camlock: male adapter hex at z0, female coupler (type C) with cam arms and ring pulls, short barb tail
  const camlock = (f, z0, roll = 0) => {
    const g = grp(f); g.position.z = z0; g.rotation.z = roll;
    mesh(hz(0.024, 0, 0.010), M.ss, g);
    const c0 = 0.010, c1 = c0 + 0.030;
    mesh(lz([[0.0001, c0], [0.0176, c0], [0.0192, c0 + 0.0018], [0.0192, c0 + 0.019], [0.0178, c0 + 0.0225], [0.0128, c0 + 0.026], [0.0112, c1], [0.0001, c1]], 20), M.ss, g);
    for (const s of [-1, 1]) {
      const lug = new THREE.BoxGeometry(0.008, 0.013, 0.012); lug.translate(s * 0.0205, 0, c0 + 0.008); mesh(lug, M.ss, g);
      const arm = new THREE.BoxGeometry(0.0035, 0.0085, 0.036); arm.translate(s * 0.0248, 0, c0 + 0.022); mesh(arm, M.ss, g);
      const ring = new THREE.TorusGeometry(0.0072, 0.0011, 6, 18); ring.rotateX(Math.PI / 2); ring.translate(s * 0.0248, 0, c0 + 0.0455); mesh(ring, M.ss, g);
    }
    // hose tail (ends at the barb; no hose)
    const tail = [[0.0001, c1], [0.0072, c1], [0.0058, c1 + 0.002]];
    for (let i = 0; i < 2; i++) { const zz = c1 + 0.002 + i * 0.006; tail.push([0.0059, zz + 0.0004], [0.0074, zz + 0.0056], [0.0059, zz + 0.006]); }
    const e = c1 + 0.016;
    tail.push([0.0055, e], [0.0042, e], [0.0042, e - 0.003], [0.0001, e - 0.003]);
    mesh(lz(tail, 16), M.ss, g);
    const hole = new THREE.CircleGeometry(0.0043, 14); hole.translate(0, 0, e - 0.0029); mesh(hole, M.hole, g);
  };

  /* ---------------- thermometer tee with the vertical ball valve ---------------- */
  {
    const f = port(P.therm.a, P.therm.y);
    bulkhead(f);
    mesh(cz(0.003, 0.003, -0.125, -0.0105, 10), M.ssDull, f); // bimetal probe inside the tank
    // cast tee: run along z, branch down
    mesh(cz(0.0142, 0.0142, BULK, BULK + 0.044, 18), M.ss, f);
    for (const z of [BULK + 0.002, BULK + 0.042]) mesh(cz(0.0158, 0.0158, z - 0.003, z + 0.003, 18), M.ss, f);
    const br = grp(f); br.position.set(0, 0, TEE_C); br.rotation.x = Math.PI / 2; // local +z = down, +y = outwards
    mesh(cz(0.0142, 0.0142, 0, 0.022, 18), M.ss, br);
    mesh(cz(0.0158, 0.0158, 0.016, 0.022, 18), M.ss, br);
    mesh(hz(0.022, 0.022, 0.032), M.ss, br);
    valve3(br, 0.032);
    camlock(br, 0.032 + VALVE_L, 0);
    // bimetal dial thermometer in the end of the tee
    const z0 = BULK + 0.044;
    mesh(hz(0.019, z0, z0 + 0.010), M.ss, f);
    mesh(cz(0.0062, 0.0062, z0 + 0.010, z0 + 0.016, 12), M.ss, f);
    mesh(cz(0.0035, 0.0035, z0 + 0.016, z0 + 0.021, 10), M.ss, f);
    const dz = z0 + 0.021; // back of the dial case
    const DR = 0.045; // bezel outer radius (3" face, wide bezel)
    mesh(lz([[0.0001, dz], [DR - 0.008, dz], [DR - 0.0035, dz + 0.004], [DR - 0.0025, dz + 0.017], [0.0001, dz + 0.017]], 40), M.ssDull, f);
    // bezel ring with rounded lip
    mesh(lz([[DR - 0.0025, dz + 0.016], [DR - 0.001, dz + 0.017], [DR, dz + 0.0205], [DR - 0.0012, dz + 0.0232], [DR - 0.0048, dz + 0.0229], [DR - 0.0056, dz + 0.0205], [DR - 0.0056, dz + 0.018]], 40), M.ss, f);
    const face = new THREE.CircleGeometry(DR - 0.0055, 40); face.translate(0, 0, dz + 0.0178);
    mesh(face, A.dialMat, f);
    const glass = new THREE.CircleGeometry(DR - 0.0055, 32); glass.translate(0, 0, dz + 0.0212);
    mesh(glass, M.clear, f);
  }

  /* ---------------- camlock port under the rim ---------------- */
  {
    const f = port(P.top.a, P.top.y);
    bulkhead(f);
    camlock(f, BULK, Math.PI / 2); // arms top and bottom so the rings hang
  }

  /* ---------------- temperature probe ---------------- */
  // PT100 probe: 1/2" BSP compression gland screwed into the bulkhead, Ø6 stainless stem through a small
  // compression nut, a stainless head and a GX16 aviation socket on the end (cable unplugged).
  // Inside, the stem reaches ~130 mm into the water.
  {
    const f = port(P.mid.a, P.mid.y);
    bulkhead(f);
    let z = BULK;
    mesh(hz(0.022, z, z + 0.010), M.ss, f); z += 0.010;                        // gland body hex
    mesh(cz(0.0072, 0.0072, z, z + 0.003, 18), M.ssDull, f); z += 0.003;       // thread showing
    mesh(flat(hz(0.016, z, z + 0.008)), M.ss, f); z += 0.008;                  // compression nut
    mesh(cz(0.0045, 0.003, z, z + 0.002, 16), M.ss, f); z += 0.002;            // nut nose
    mesh(cz(0.003, 0.003, z, z + 0.012, 14), M.ss, f); z += 0.012;             // Ø6 stem
    mesh(lz([[0.0001, z], [0.004, z], [0.0078, z + 0.004], [0.0078, z + 0.016], [0.0072, z + 0.018], [0.0001, z + 0.018]], 20), M.ss, f); z += 0.018; // head
    mesh(cz(0.0092, 0.0092, z, z + 0.011, 24), M.ssDull, f);                  // GX16 knurled coupling ring
    for (let i = 0; i < 12; i++) {                                            // knurl ribs
      const a = (i / 12) * Math.PI * 2, rib = new THREE.BoxGeometry(0.0012, 0.0012, 0.009);
      rib.translate(Math.cos(a) * 0.0094, Math.sin(a) * 0.0094, z + 0.0055); mesh(rib, M.ssDull, f);
    }
    z += 0.011;
    mesh(cz(0.0072, 0.0072, z - 0.0016, z - 0.0004, 18), M.black, f);         // insulator face, recessed
    for (const [px, py] of [[0, 0.0034], [-0.003, -0.0018], [0.003, -0.0018]]) {
      const h = new THREE.CircleGeometry(0.0007, 8); h.translate(px, py, z - 0.0003); mesh(h, M.hole, f);
    }
    mesh(cz(0.003, 0.003, -0.13, -0.0105, 12), M.ss, f);                      // stem inside the pot
  }

  /* ---------------- low 3-piece ball valve with barb ---------------- */
  {
    const f = port(P.low.a, P.low.y);
    bulkhead(f, true);
    valve3(f, BULK);
    mesh(hz(0.022, BULK + VALVE_L, BULK + VALVE_L + 0.010), M.ss, f);
    barb(f, BULK + VALVE_L + 0.010, false);
  }

  /* ---------------- merge static parts per material ---------------- */
  parts.updateMatrixWorld(true);
  const byMat = new Map();
  parts.traverse((m) => {
    if (!m.isMesh) return;
    const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    if (!byMat.has(m.material)) byMat.set(m.material, []);
    byMat.get(m.material).push(g);
    m.geometry.dispose();
  });
  for (const [mat, list] of byMat) {
    const mm = new THREE.Mesh(mergeGeoms(THREE, list), mat);
    list.forEach((g) => g.dispose());
    out.add(mm);
  }

  /* ---------------- etched NANO Brewery mark (curved to the shell) ---------------- */
  {
    const L = P.logo, d = ctx.decal(A.logo, L.w, L.h);
    const span = L.w / R;
    d.geometry.dispose();
    d.geometry = new THREE.CylinderGeometry(R + 0.0004, R + 0.0004, L.h, 16, 1, true, L.a * DEG - span / 2, span);
    d.position.y = L.y;
    out.add(d);
  }
  return out;
}

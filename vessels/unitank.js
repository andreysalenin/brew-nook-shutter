// Ss Brewtech Unitank 14 gal, version 1 (original), as the user runs it: neoprene jacket, FTSs
// controller on its tri-clamp shelf over the thermowell, blow-off cane down the right-front leg ending in a TC ball valve
// with a ball-lock gas post, sight glass + butterfly + 90° elbow on the dump, stock square legs with
// extensions, stock perforated lower shelf and four braked swivel casters.
// Units: metres. Origin: floor, centre of the footprint. +z = front, +x = right.

export const meta = {
  id: 'unitank',
  name: 'Ss Brewtech Unitank 14 gal (v1)',
  dims: 'Ø400 jacket · 1255 to gauge top · 380 sq shelf, 455 sq on casters',
  ports: { dump: { pos: [0, 0.155, 0.0555], dir: [0, 0, 1] } },
};

// legExtra: extra leg-extension length in metres (raises everything above the shelf).
export const defaultOptions = { legExtra: 0 };

const K = {}; // module-level cache: textures and decal materials, made once

function assets(THREE, ctx) {
  if (K.ok) return K;
  const font = 'Helvetica, Arial, sans-serif';
  K.logo = ctx.labelTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const c = '#efeee8';
    g.strokeStyle = c; g.lineWidth = 9; g.strokeRect(9, 9, w - 18, h - 18);
    g.fillStyle = c; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.font = `500 148px ${font}`; g.fillText('Ss', w / 2 - 6, 168);
    g.font = `500 32px ${font}`; g.fillText('304', 200, 62);
    g.font = `500 35px ${font}`; g.fillText('brewtech', w / 2, 220);
  });
  K.psi = ctx.labelTex(64, 256, (g, w, h) => {
    g.fillStyle = '#121214'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b8232a'; g.lineWidth = 2; g.strokeRect(3, 3, w - 6, h - 6);
    g.save(); g.translate(w * 0.36, 12); g.rotate(Math.PI / 2);
    g.fillStyle = '#e0262c'; g.font = `bold 24px ${font}`; g.textBaseline = 'middle';
    const t = 'DO NOT EXCEED 30 PSI'; const s = Math.min(1, (h - 24) / g.measureText(t).width);
    g.scale(s, 1); g.fillText(t, 0, 0); g.restore();
    g.fillStyle = '#d6d6d6'; g.font = `8px ${font}`; g.textBaseline = 'middle';
    for (const [x, t2] of [[0.7, 'MAX WORKING PRESSURE 30 PSI / 2 BAR'], [0.86, 'KEEP PRV FITTED']]) { g.save(); g.translate(w * x, 12); g.rotate(Math.PI / 2); g.fillText(t2, 0, 0); g.restore(); }
  });
  // FTSs controller face: the 75 x 34.5 mm panel-controller bezel on the sloped front (7.5 px/mm).
  // Smoked window with a 3-digit 7-segment LED readout (blue, as on the user's unit; the kit photo
  // shows red/purple), set / working indicator dots, and recesses for the 2 x 2 keys (geometry).
  K.lcd = ctx.labelTex(564, 260, (g, w, h) => {
    g.fillStyle = '#111113'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#2a2b30'; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = '#060608'; g.fillRect(24, 40, 318, 180); // smoked window
    g.strokeStyle = '#26272c'; g.lineWidth = 3; g.strokeRect(22, 38, 322, 184);
    // 7-segment digits: segments a..g as polygons in a 60 x 112 cell, slight italic
    const SEG = { a: [[8, 0], [52, 0], [44, 9], [16, 9]], b: [[53, 2], [53, 54], [45, 50], [45, 10]], c: [[53, 58], [53, 110], [45, 102], [45, 62]],
      d: [[8, 112], [52, 112], [44, 103], [16, 103]], e: [[7, 58], [15, 62], [15, 102], [7, 110]], f: [[7, 2], [15, 10], [15, 50], [7, 54]],
      g: [[9, 56], [16, 51], [44, 51], [51, 56], [44, 61], [16, 61]] };
    const DIG = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
    const digit = (x0, y0, ch, dp) => {
      for (const [k, poly] of Object.entries(SEG)) {
        const on = DIG[ch].includes(k);
        g.fillStyle = on ? '#4f8dff' : '#0d1020'; g.shadowColor = on ? '#2f6bff' : 'transparent'; g.shadowBlur = on ? 10 : 0;
        g.beginPath(); poly.forEach(([x, y], i) => { const X = x0 + x * 1.15 - y * 0.12, Y = y0 + y * 1.15; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath(); g.fill();
      }
      g.fillStyle = dp ? '#4f8dff' : '#0d1020'; g.shadowBlur = dp ? 10 : 0;
      g.beginPath(); g.arc(x0 + 76 - 112 * 0.14, y0 + 124, 6, 0, Math.PI * 2); g.fill();
    };
    digit(52, 64, '1', false); digit(142, 64, '8', true); digit(232, 64, '2', false);
    g.shadowBlur = 0;
    g.fillStyle = '#4f8dff'; g.beginPath(); g.arc(328, 60, 4, 0, Math.PI * 2); g.fill(); // set / working LEDs
    g.fillStyle = '#0d1020'; g.beginPath(); g.arc(328, 84, 4, 0, Math.PI * 2); g.fill();
    // key recesses (keys themselves are geometry)
    g.fillStyle = '#0a0a0b';
    for (const cx of [412, 484]) for (const cy of [94, 166]) g.fillRect(cx - 32, cy - 32, 64, 64);
    g.fillStyle = '#6d6e74'; g.font = `600 15px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('SET', 412, 48); g.fillText('RST', 484, 48);
  });
  K.jackLbl = ctx.labelTex(256, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = '#e8e8e4'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `600 30px ${font}`; g.fillText('12VDC', w / 2, h / 2 + 2);
  });
  K.portLbl = ctx.labelTex(256, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = '#e8e8e4'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `600 26px ${font}`; g.fillText('HEAT', w * 0.27, h / 2 + 2); g.fillText('PUMP', w * 0.73, h / 2 + 2);
  });
  const S = (p) => new THREE.MeshStandardMaterial(p);
  K.logoMat = S({ map: K.logo, transparent: true, roughness: 0.8, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  K.psiMat = S({ map: K.psi, roughness: 0.45, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  K.lcdMat = S({ map: K.lcd, emissiveMap: K.lcd, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.3, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const lbl = (map) => S({ map, transparent: true, roughness: 0.7, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  K.jackLblMat = lbl(K.jackLbl); K.portLblMat = lbl(K.portLbl);
  K.keyMat = S({ color: 0xd9cfb4, roughness: 0.55, metalness: 0 }); // cream controller keys
  K.ledMat = S({ color: 0x1e4dff, emissive: 0x2a5cff, emissiveIntensity: 1.2, roughness: 0.3, metalness: 0 }); // rocker LED
  K.boxMat = S({ color: 0x131315, roughness: 0.62, metalness: 0.25 }); // matte black painted sheet steel
  K.ok = true;
  return K;
}

export function build(THREE, ctx, opts = {}) {
  const o = Object.assign({}, defaultOptions, opts);
  const { MAT } = ctx;
  const A = assets(THREE, ctx);
  const V3 = THREE.Vector3;
  const v = (x, y, z) => new V3(x, y, z);
  const PI = Math.PI, SQ3 = Math.sqrt(3);
  const UP = v(0, 1, 0);

  // ---------------------------------------------------------------- geometry plumbing
  const buckets = new Map();
  const solo = [];
  const put = (mat, geo, m) => {
    if (m) geo.applyMatrix4(m);
    let b = buckets.get(mat); if (!b) buckets.set(mat, (b = []));
    b.push(geo); return geo;
  };
  const keep = (mat, geo, m, core) => {
    if (m) geo.applyMatrix4(m);
    const me = new THREE.Mesh(geo, mat);
    if (core) ctx.core(me);
    solo.push(me); return me;
  };
  // basis: local +y -> dir, local +z -> ref (made perpendicular), origin at p
  const frame = (p, dir, ref) => {
    const Y = dir.clone().normalize();
    let Z = ref ? ref.clone() : (Math.abs(Y.y) < 0.95 ? v(0, 1, 0) : v(0, 0, 1));
    Z.addScaledVector(Y, -Z.dot(Y));
    if (Z.lengthSq() < 1e-10) Z = Math.abs(Y.x) < 0.9 ? v(1, 0, 0) : v(0, 0, 1), Z.addScaledVector(Y, -Z.dot(Y));
    Z.normalize();
    const X = new V3().crossVectors(Y, Z);
    return new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(p);
  };
  const P2 = (arr) => { const out = []; for (const p of arr) { const q = new THREE.Vector2(p[0], p[1]); out.push(q); if (p[2]) out.push(q.clone()); } return out; };
  const lathe = (mat, prof, p, axis, ref, seg = 20, phi0 = 0, phiL = 2 * PI) => put(mat, new THREE.LatheGeometry(P2(prof), seg, phi0, phiL), frame(p, axis, ref));
  const cyl = (mat, a, b, r0, r1 = r0, seg = 16, open = false, ref) => {
    const d = b.clone().sub(a); const L = d.length();
    const g = new THREE.CylinderGeometry(r1, r0, L, seg, 1, open); g.translate(0, L / 2, 0);
    return put(mat, g, frame(a, d, ref));
  };
  const box = (mat, c, sx, sy, sz, ydir = UP, zdir = v(0, 0, 1)) => put(mat, new THREE.BoxGeometry(sx, sy, sz), frame(c, ydir, zdir));
  const tubeThrough = (mat, pts, r, tseg = 12, rseg = 12) => put(mat, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), tseg, r, rseg, false));
  const arcPts = (c, u, w, R, a0, a1, n) => { const out = []; for (let i = 0; i <= n; i++) { const t = a0 + (a1 - a0) * i / n; out.push(c.clone().addScaledVector(u, R * Math.cos(t)).addScaledVector(w, R * Math.sin(t))); } return out; };
  const radial = (deg) => v(Math.sin(deg * PI / 180), 0, Math.cos(deg * PI / 180));

  // ---------------------------------------------------------------- tri-clamp parts (shared ctx.tc)
  const tc = ctx.tc, TS = tc.sizes;
  const rT15 = TS['1.5'].tubeOD / 2;
  // bake a tc group (aimed in vessel space) into the material buckets
  const tcPut = (obj) => { for (const { material, geometry } of tc.bake(obj)) put(material, geometry); };
  // clamped joint: joint plane at c; ferrule A's tube runs back along -dir by lenA, B (or a cap) along
  // +dir; wing = direction of the clamp lugs (perpendicular part of it is used)
  const tcJoint = (size, c, dir, wing, o2 = {}) => tcPut(tc.aim(tc.joint(size, o2), c, dir, wing));
  // lone ferrule: flange face at `face`, tube running back along -dir by len
  const tcFerrule = (size, face, dir, len, open = false) => tcPut(tc.aim(tc.ferrule(size, { len, open }), face, dir));
  const capTop = (size) => TS[size].gap / 2 + TS[size].capT; // cap top above the joint plane
  // 1.5" butterfly valve: inlet face o, flow F, stem S, lever direction Lv (perp to S)
  // TC ends come from the joints at o / o + F*L (tcJoint lenB / lenA = 0.024); openOut adds the
  // bare outlet ferrule when nothing is clamped to it
  const butterfly = (o, F, S, Lv, lev = 0.13, openOut = false) => {
    F = F.clone().normalize(); S = S.clone().normalize(); Lv = Lv.clone().addScaledVector(S, -Lv.dot(S)).normalize();
    const L = 0.072;
    if (openOut) tcFerrule('1.5', o.clone().addScaledVector(F, L), F, 0.024, true);
    const c = o.clone().addScaledVector(F, L / 2);
    lathe(MAT.ss, [[0.0004, -0.014], [0.029, -0.014], [0.0335, -0.0105], [0.0335, -0.0008], [0.0326, 0, 1], [0.0335, 0.0008, 1], [0.0335, 0.0105], [0.029, 0.014], [0.0004, 0.014]], c, F, S, 24);
    // bolts through the body halves
    const Tb = new V3().crossVectors(F, S);
    for (const a of [0.9, 2.6, 4.3]) {
      const p = c.clone().addScaledVector(S, Math.cos(a) * 0.026).addScaledVector(Tb, Math.sin(a) * 0.026);
      cyl(MAT.ss, p.clone().addScaledVector(F, -0.0175), p.clone().addScaledVector(F, 0.0175), 0.0032, 0.0032, 6);
    }
    // stem neck, notch plate, lever with squeeze grip
    cyl(MAT.ss, c.clone().addScaledVector(S, 0.03), c.clone().addScaledVector(S, 0.05), 0.008, 0.0065, 14);
    const notchC = c.clone().addScaledVector(S, 0.047);
    const np = new THREE.CylinderGeometry(0.031, 0.031, 0.003, 10, 1, false, PI / 2, PI / 2);
    put(MAT.ss, np, frame(notchC, S, Lv.clone().negate()));
    const P = c.clone().addScaledVector(S, 0.056);
    box(MAT.ss, P.clone().addScaledVector(S, -0.002), 0.014, 0.012, 0.014, S, Lv);
    const Wd = new V3().crossVectors(Lv, S);
    box(MAT.ss, P.clone().addScaledVector(Lv, lev / 2 - 0.012), 0.016, 0.0042, lev, S, Lv);
    cyl(MAT.ss, P.clone().addScaledVector(Lv, lev - 0.013).addScaledVector(S, -0.0021), P.clone().addScaledVector(Lv, lev - 0.013).addScaledVector(S, 0.0021), 0.008, 0.008, 14);
    box(MAT.ss, P.clone().addScaledVector(Lv, lev * 0.55).addScaledVector(S, -0.0065).addScaledVector(Wd, 0.002), 0.011, 0.0035, lev * 0.62, S, Lv);
    box(MAT.ss, P.clone().addScaledVector(Lv, lev * 0.22).addScaledVector(S, -0.004), 0.008, 0.006, 0.012, S, Lv);
  };

  // ---------------------------------------------------------------- key dimensions
  const E = Math.max(0, +o.legExtra || 0);
  const RS = 0.19, TJ = 0.01, RJ = RS + TJ; // shell OD/2, neoprene, jacket OD/2
  const yP = 0.103; // top of the perforated shelf
  const yD = 0.155 + E; // dump outlet centre
  const eR = 0.038, yE = yD + eR + 0.017; // elbow centre-line radius, elbow top face
  const yS = yE + 0.072; // butterfly top face = sight glass bottom face
  const yA = yS + 0.088; // cone outlet flange face
  const y0 = yA + 0.02; // tip of the 60° cone (r = 0.019)
  const yCJ = y0 + (RS - 0.019) * SQ3; // cone / cylinder junction
  const Hc = 0.4; // straight wall
  const yDS = yCJ + Hc; // start of the dished head
  const Rc = 0.45, rk = 0.04; // torispherical head
  const yc = yDS - Math.sqrt((Rc - rk) ** 2 - (RS - rk) ** 2);
  const rT = (RS - rk) * Rc / (Rc - rk); // crown / knuckle tangent radius
  const domeY = (r) => (r <= rT ? yc + Math.sqrt(Rc * Rc - r * r) : yDS + Math.sqrt(Math.max(0, rk * rk - (r - (RS - rk)) ** 2)));
  const rCone = (y) => 0.019 + (y - y0) / SQ3;
  const yF6 = yDS + 0.08; // 6" lid joint
  const yF3 = yF6 + 0.007 + 0.018; // 3" PRV port joint
  const a = 0.165; // caster centres at (±a, ±a)
  const aL = 0.1625; // leg centres at (±aL, ±aL): legs turned 45°, outer corners flush with the shelf rim
  const yLT = yCJ + 0.11; // leg tops
  const yJ = yP + 0.22 + E; // extension / leg joint

  // ---------------------------------------------------------------- shell & jacket profiles
  const shell = []; // [r, y, nr, ny]
  {
    const kj = 0.03, tl = kj * Math.tan(PI / 12);
    const fs = [RS - tl * 0.5, yCJ - tl * (SQ3 / 2)];
    for (const t of [0, 0.035, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]) shell.push([0.019 + (fs[0] - 0.019) * t, y0 + (fs[1] - y0) * t, SQ3 / 2, -0.5]);
    const fc = [RS - kj, yCJ + tl];
    const a0 = Math.atan2(fs[1] - fc[1], fs[0] - fc[0]);
    for (let i = 1; i <= 6; i++) { const t = a0 * (1 - i / 6); shell.push([fc[0] + kj * Math.cos(t), fc[1] + kj * Math.sin(t), Math.cos(t), Math.sin(t)]); }
    for (let i = 1; i <= 4; i++) { const y = yCJ + tl + (yDS - yCJ - tl) * i / 4; shell.push([RS, y, 1, 0]); }
    const tA = Math.atan2(domeY(rT) - yDS, rT - (RS - rk));
    for (let i = 1; i <= 8; i++) { const t = tA * i / 8; shell.push([RS - rk + rk * Math.cos(t), yDS + rk * Math.sin(t), Math.cos(t), Math.sin(t)]); }
    const b0 = Math.asin(rT / Rc), b1 = Math.asin(0.0762 / Rc);
    for (let i = 1; i <= 8; i++) { const b = b0 + (b1 - b0) * i / 8; shell.push([Rc * Math.sin(b), yc + Rc * Math.cos(b), Math.sin(b), Math.cos(b)]); }
  }
  const jacketProfile = [];
  {
    const inRange = shell.filter((p) => !(p[1] < yCJ && p[0] < 0.024) && !(p[1] > yDS && p[0] < 0.105));
    const f = inRange[0], l = inRange[inRange.length - 1];
    const tan = (p, s) => [-p[3] * s, p[2] * s]; // tangent going up the profile (rotate normal)
    const t0 = tan(f, -1), t1 = tan(l, -1);
    jacketProfile.push([f[0] + f[2] * 0.0008, f[1] + f[3] * 0.0008]);
    jacketProfile.push([f[0] + f[2] * TJ * 0.5 + t0[0] * TJ * 0.45, f[1] + f[3] * TJ * 0.5 + t0[1] * TJ * 0.45]);
    for (const p of inRange) jacketProfile.push([p[0] + p[2] * TJ, p[1] + p[3] * TJ]);
    jacketProfile.push([l[0] + l[2] * TJ * 0.5 - t1[0] * TJ * 0.45, l[1] + l[3] * TJ * 0.5 - t1[1] * TJ * 0.45]);
    jacketProfile.push([l[0] + l[2] * 0.0008, l[1] + l[3] * 0.0008]);
  }
  const rJat = (y) => { let best = RJ; for (let i = 2; i < jacketProfile.length - 3; i++) { const p = jacketProfile[i], q = jacketProfile[i + 1]; if ((p[1] - y) * (q[1] - y) <= 0 && q[1] !== p[1]) { best = p[0] + (q[0] - p[0]) * (y - p[1]) / (q[1] - p[1]); break; } } return best; };

  // jacket (core)
  keep(MAT.neoprene, new THREE.LatheGeometry(P2(jacketProfile), 64), null, true);
  // visible stainless: head around the lid ferrule, cone tip below the jacket
  {
    const ring = []; for (let i = 0; i <= 6; i++) { const r = 0.118 - (0.118 - 0.0762) * i / 6; ring.push([r, domeY(r)]); }
    keep(MAT.ss, new THREE.LatheGeometry(P2(ring), 64), null, true);
    put(MAT.ss, new THREE.LatheGeometry(P2([[0.019, y0], [0.03, y0 + 0.011 * SQ3]]), 32));
  }
  // jacket seams and back zip
  for (const y of [yCJ + 0.004, yDS - 0.006]) {
    const t = new THREE.TorusGeometry(rJat(y) + 0.0004, 0.0017, 4, 72); t.rotateX(PI / 2); t.translate(0, y, 0); put(MAT.seam, t);
  }
  box(MAT.seam, v(0, (yCJ + yDS) / 2, -RJ - 0.0012), 0.014, yDS - yCJ - 0.02, 0.003);
  box(MAT.black, v(0, (yCJ + yDS) / 2, -RJ - 0.0026), 0.005, yDS - yCJ - 0.02, 0.002);
  // Ss logo, printed on the jacket (curved patch)
  {
    const w = 0.088, R = RJ + 0.0007, th = w / R;
    const g = new THREE.CylinderGeometry(R, R, w, 12, 1, true, -th / 2, th);
    g.translate(0, yCJ + 0.235, 0);
    keep(A.logoMat, g);
  }

  // ---------------------------------------------------------------- top: 6" lid, 3" PRV cap, coil ports
  // 6" lid: blank TC cap (kept as a core mesh) on the 6" head ferrule, clamp lugs at the back
  {
    const h = TS['6'].gap / 2, c6 = v(0, yF6, 0);
    tcPut(tc.aim(tc.ferrule('6', { len: yF6 - h - domeY(0.0762) + 0.004 }), v(0, yF6 - h, 0), UP));
    tcPut(tc.aim(tc.gasket('6', { rimOnly: true }), c6, UP));
    tcPut(tc.aim(tc.clamp('6'), c6, UP, radial(180)));
    for (const { material, geometry } of tc.bake(tc.aim(tc.cap('6'), v(0, yF6 + h, 0), UP))) keep(material, geometry, null, true);
  }
  const yLid = yF6 + capTop('6');
  // 3" PRV port welded in the lid, blank cap carrying the PRV
  tcJoint('3', v(0, yF3, 0), UP, radial(135), { lenA: yF3 - yLid + 0.001, cap: true, flip: true }); // nut swings back, clear of the coil port
  { // PRV
    const b = yF3 + capTop('3') - 0.0004;
    cyl(MAT.ss, v(0, b, 0), v(0, b + 0.009, 0), 0.0125, 0.0125, 6);
    cyl(MAT.ss, v(0, b + 0.009, 0), v(0, b + 0.031, 0), 0.0105, 0.0105, 18);
    lathe(MAT.ss, [[0.0105, 0], [0.0115, 0.002], [0.0115, 0.006], [0.006, 0.009], [0.0004, 0.0095]], v(0, b + 0.031, 0), UP, null, 18);
    const ringT = new THREE.TorusGeometry(0.0075, 0.0016, 6, 18); ringT.rotateY(PI / 2); ringT.translate(0, b + 0.047, 0); put(MAT.yellow, ringT);
  }
  // FTSs coil in / out through the lid, with QD plugs
  for (const sx of [-1, 1]) {
    const x0 = sx * 0.063, z0 = -0.012, yb = yLid - 0.0004, yh = yF6 + 0.042, Rb = 0.012;
    cyl(MAT.ss, v(x0, yb, z0), v(x0, yh - Rb, z0), 0.0064, 0.0064, 12);
    tubeThrough(MAT.ss, arcPts(v(x0 + sx * Rb, yh - Rb, z0), v(-sx, 0, 0), UP, Rb, 0, PI / 2, 6), 0.0064, 8, 12);
    const xe = x0 + sx * Rb;
    cyl(MAT.ss, v(xe, yh, z0), v(sx * 0.11, yh, z0), 0.0064, 0.0064, 12);
    cyl(MAT.ss, v(sx * 0.11, yh, z0), v(sx * 0.14, yh, z0), 0.0098, 0.0098, 16);
    cyl(sx > 0 ? MAT.yellow : MAT.black, v(sx * 0.119, yh, z0), v(sx * 0.126, yh, z0), 0.0108, 0.0108, 16);
    cyl(MAT.ss, v(sx * 0.14, yh, z0), v(sx * 0.158, yh, z0), 0.0055, 0.0045, 12);
  }

  // ---------------------------------------------------------------- pressure gauge (front-left of head)
  {
    const pr = 0.13, p = radial(-45).multiplyScalar(pr), yPG = yDS + 0.076;
    tcJoint('1.5', v(p.x, yPG, p.z), UP, radial(-135), { lenA: yPG - domeY(pr) + 0.004, lenB: 0.0105, flip: true }); // nut clear of the 6" clamp
    cyl(MAT.ss, v(p.x, yPG + 0.01, p.z), v(p.x, yPG + 0.019, p.z), 0.02, 0.016, 20);
    cyl(MAT.ss, v(p.x, yPG + 0.019, p.z), v(p.x, yPG + 0.034, p.z), 0.0055, 0.0055, 10);
    cyl(MAT.ss, v(p.x, yPG + 0.022, p.z), v(p.x, yPG + 0.028, p.z), 0.0085, 0.0085, 6);
    const gc = v(p.x, yPG + 0.033 + 0.03, p.z), f = v(0, 0, 1);
    lathe(MAT.ss, [[0.0004, -0.015], [0.026, -0.015, 1], [0.03, -0.012], [0.03, 0.011, 1], [0.0302, 0.0135], [0.0286, 0.0152, 1], [0.026, 0.0148]], gc, f, UP, 28);
    put(MAT.dialFace, new THREE.CircleGeometry(0.0262, 28), frame(gc.clone().addScaledVector(f, 0.0128), UP, f));
  }

  // ---------------------------------------------------------------- blow-off arm / cane (right front)
  const pB = radial(45).multiplyScalar(0.13), pC = radial(45).multiplyScalar(0.3);
  const uC = radial(45);
  const yPB = yDS + 0.08, yTopC = yDS + 0.145, Rb = 0.032, rc = 0.00635;
  const yCB = yCJ + 0.035; // cane's lower TC end
  {
    tcJoint('1.5', v(pB.x, yPB, pB.z), UP, radial(135), { lenA: yPB - domeY(0.13) + 0.004, cap: true });
    cyl(MAT.ss, v(pB.x, yPB + 0.005, pB.z), v(pB.x, yPB + 0.012, pB.z), 0.0095, 0.0085, 14);
    cyl(MAT.ss, v(pB.x, yPB + 0.012, pB.z), v(pB.x, yTopC - Rb, pB.z), rc, rc, 12);
    const c1 = v(pB.x, yTopC - Rb, pB.z).addScaledVector(uC, Rb);
    tubeThrough(MAT.ss, arcPts(c1, uC.clone().negate(), UP, Rb, 0, PI / 2, 8), rc, 10, 12);
    const c2 = v(pC.x, yTopC - Rb, pC.z).addScaledVector(uC, -Rb);
    cyl(MAT.ss, v(c1.x, yTopC, c1.z), v(c2.x, yTopC, c2.z), rc, rc, 12);
    tubeThrough(MAT.ss, arcPts(c2, UP, uC, Rb, 0, PI / 2, 8), rc, 10, 12);
    cyl(MAT.ss, v(pC.x, yCB + 0.012, pC.z), v(pC.x, yTopC - Rb, pC.z), rc, rc, 12);
    cyl(MAT.ss, v(pC.x, yCB + 0.005, pC.z), v(pC.x, yCB + 0.012, pC.z), 0.0095, 0.0085, 14);
    // cane's TC cap clamped onto the 3-piece ball valve (1.5" TC x 1/2" NPT)
    tcJoint('1.5', v(pC.x, yCB, pC.z), UP, radial(-45), { lenA: 0.012, cap: true });
    cyl(MAT.ss, v(pC.x, yCB - 0.02, pC.z), v(pC.x, yCB - 0.012, pC.z), 0.016, 0.016, 18);
    box(MAT.ss, v(pC.x, yCB - 0.033, pC.z), 0.031, 0.026, 0.031, UP, uC);
    cyl(MAT.ss, v(pC.x, yCB - 0.054, pC.z), v(pC.x, yCB - 0.046, pC.z), 0.016, 0.016, 18);
    const tC = v(uC.z, 0, -uC.x);
    for (const [s1, s2] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const q = v(pC.x, 0, pC.z).addScaledVector(uC, s1 * 0.0128).addScaledVector(tC, s2 * 0.0128);
      cyl(MAT.ss, v(q.x, yCB - 0.052, q.z), v(q.x, yCB - 0.014, q.z), 0.0021, 0.0021, 6);
    }
    const sDir = uC.clone(); // stem points outward
    const sb = v(pC.x, yCB - 0.033, pC.z);
    cyl(MAT.ss, sb.clone().addScaledVector(sDir, 0.015), sb.clone().addScaledVector(sDir, 0.026), 0.0045, 0.0045, 10);
    const lv = v(-uC.z, 0, uC.x).negate(); // lever along the front-left tangent (closed)
    const lp = sb.clone().addScaledVector(sDir, 0.027);
    box(MAT.ss, lp.clone().addScaledVector(lv, 0.026), 0.0105, 0.003, 0.064, sDir, lv);
    box(MAT.black, lp.clone().addScaledVector(lv, 0.041), 0.0145, 0.0085, 0.04, sDir, lv);
    cyl(MAT.ss, v(pC.x, yCB - 0.064, pC.z), v(pC.x, yCB - 0.054, pC.z), 0.0125, 0.0125, 6);
    // ball-lock gas post + black gas disconnect
    cyl(MAT.ss, v(pC.x, yCB - 0.076, pC.z), v(pC.x, yCB - 0.064, pC.z), 0.0108, 0.0108, 6);
    cyl(MAT.ss, v(pC.x, yCB - 0.084, pC.z), v(pC.x, yCB - 0.076, pC.z), 0.0085, 0.0085, 14);
    cyl(MAT.black, v(pC.x, yCB - 0.126, pC.z), v(pC.x, yCB - 0.082, pC.z), 0.0132, 0.0132, 18);
    cyl(MAT.black, v(pC.x, yCB - 0.099, pC.z), v(pC.x, yCB - 0.085, pC.z), 0.0148, 0.0148, 18);
    cyl(MAT.ss, v(pC.x, yCB - 0.14, pC.z), v(pC.x, yCB - 0.126, pC.z), 0.0042, 0.0042, 10);
    cyl(MAT.ss, v(pC.x, yCB - 0.137, pC.z), v(pC.x, yCB - 0.132, pC.z), 0.0042, 0.0056, 10);
    // welded blow-off arm mount: rod from the front-right leg corner to a collar on the cane
    // (legs are turned 45°, so the front-right leg's outer flat faces uC: the rod leaves it square)
    const yM = yCJ + 0.09, lc = v(aL, yM, aL).addScaledVector(uC, 0.01905);
    box(MAT.ss, lc.clone().addScaledVector(uC, 0.0018), 0.016, 0.024, 0.004, UP, uC);
    cyl(MAT.ss, lc.clone().addScaledVector(uC, 0.0035), v(pC.x, yM, pC.z).addScaledVector(uC, -0.008), 0.0042, 0.0042, 10);
    cyl(MAT.ss, v(pC.x, yM - 0.008, pC.z), v(pC.x, yM + 0.008, pC.z), 0.0098, 0.0098, 14);
  }

  // ---------------------------------------------------------------- thermowell + FTSs controller (front)
  // 1.5" TC thermowell port on the front of the shell (just above the cone): thermowell cap with the
  // controller's probe pushed into it. The FTSs tri-clamp shelf is a folded 304 tray welded on top of
  // that port's clamp (lugs at 9 o'clock, wing nut hanging down, hinge at 3 o'clock), and the
  // controller box sits on the tray between two upturned back-corner cups.
  // Sizes (estimated from the kit photo and the user's photos, scaled by the 60 mm clamp ring and the
  // standard 75 x 34.5 mm panel-controller bezel): box 88 W x 90 D x 62 H, tray 100 x 104.
  const yT = yCJ + 0.032, zT = 0.225; // joint plane of the thermowell port
  {
    const s15 = TS['1.5'];
    tcJoint('1.5', v(0, yT, zT), v(0, 0, 1), v(-1, 0.12, 0), { lenA: zT - RS + 0.006, cap: true, flip: true });
    // thermowell end proud of the cap, probe boot
    const zCap = zT + s15.gap / 2 + s15.capT;
    cyl(MAT.ss, v(0, yT, zCap - 0.0005), v(0, yT, zCap + 0.008), 0.0058, 0.0058, 12);
    cyl(MAT.black, v(0, yT, zCap + 0.008), v(0, yT, zCap + 0.0135), 0.0034, 0.0026, 10);

    // tray: 1.2 mm sheet resting on the clamp ring's crown (+ a short weld saddle)
    const tt = 0.0012, yTr = yT + s15.clampOD / 2 + 0.0006; // tray underside
    const tW = 0.1, tz0 = zT - 0.011, tz1 = tz0 + 0.104, yTT = yTr + tt;
    box(MAT.ssDull, v(0, yTr + tt / 2, (tz0 + tz1) / 2), tW, tt, tz1 - tz0);
    box(MAT.ssDull, v(0, yT + s15.clampOD / 2 - 0.0012, zT), 0.022, 0.0036, s15.clampW * 0.8);
    // back-corner cups: a side flange and a back flange folded up and flared out ~14°
    const fl = 0.24, ch = 0.022, cs = Math.sin(fl), cc = Math.cos(fl);
    for (const sx of [-1, 1]) {
      const xe = sx * tW / 2;
      box(MAT.ssDull, v(xe + sx * cs * ch / 2, yTT + cc * ch / 2 - tt / 2, tz0 + 0.017), tt, ch, 0.034, v(sx * cs, cc, 0), v(0, 0, 1));
      box(MAT.ssDull, v(sx * (tW / 2 - 0.0145), yTT + cc * ch / 2 - tt / 2, tz0 - cs * ch / 2), 0.027, ch, tt, v(0, cc, -cs), v(0, cs, cc));
    }

    // controller box: folded sheet profile (side view) extruded across its width
    const bW = 0.088, bD = 0.09, bH = 0.062, hF = 0.026, sRun = 0.03;
    const zB = tz0 + 0.005, yB = yTT; // box back face / bottom
    const prof = [[0, 0], [bD, 0], [bD, hF], [bD - sRun, bH], [0, bH]];
    const rad = [0.0012, 0.0012, 0.003, 0.004, 0.003];
    const sh = new THREE.Shape();
    prof.forEach((p, i) => {
      const pr = prof[(i + prof.length - 1) % prof.length], nx = prof[(i + 1) % prof.length];
      const d0 = Math.hypot(p[0] - pr[0], p[1] - pr[1]), d1 = Math.hypot(nx[0] - p[0], nx[1] - p[1]);
      const a = [p[0] + (pr[0] - p[0]) * rad[i] / d0, p[1] + (pr[1] - p[1]) * rad[i] / d0];
      const b = [p[0] + (nx[0] - p[0]) * rad[i] / d1, p[1] + (nx[1] - p[1]) * rad[i] / d1];
      if (i === 0) sh.moveTo(a[0], a[1]); else sh.lineTo(a[0], a[1]);
      sh.quadraticCurveTo(p[0], p[1], b[0], b[1]);
    });
    sh.closePath();
    const bg = new THREE.ExtrudeGeometry(sh, { depth: bW, bevelEnabled: false, curveSegments: 3 });
    put(K.boxMat, bg, new THREE.Matrix4().makeBasis(v(0, 0, 1), v(0, 1, 0), v(-1, 0, 0)).setPosition(bW / 2, yB, zB));
    const P = (x, zl, yl) => v(x, yB + yl, zB + zl);
    // sloped front: panel-controller bezel with the LED face and 2 x 2 keys
    const sL = Math.hypot(sRun, bH - hF);
    const uS = v(0, (bH - hF) / sL, -sRun / sL), nS = v(0, sRun / sL, (bH - hF) / sL);
    const M = P(0, bD - sRun / 2, (hF + bH) / 2);
    box(MAT.black, M.clone().addScaledVector(nS, 0.0004), 0.075, 0.0024, 0.0345, nS, uS);
    const face = M.clone().addScaledVector(nS, 0.0017);
    keep(A.lcdMat, new THREE.PlaneGeometry(0.075, 0.0345), frame(face, uS, nS));
    for (const ku of [0.0174, 0.0270]) for (const kv of [0.0046, -0.0050]) {
      box(K.keyMat, face.clone().addScaledVector(nS, 0.0008).add(v(ku, 0, 0)).addScaledVector(uS, kv), 0.0072, 0.0018, 0.0072, nS, uS);
    }
    // front band: round rocker switch (blue LED) between two small cable glands
    const zF = zB + bD, yRk = yB + hF / 2 + 0.0005;
    lathe(MAT.black, [[0.0084, -0.0003], [0.0113, -0.0003], [0.0115, 0.0012, 1], [0.0106, 0.0026, 1], [0.0088, 0.0028]], v(0, yRk, zF), v(0, 0, 1), UP, 22);
    lathe(MAT.black, [[0.0004, 0.0042], [0.0055, 0.0040, 1], [0.0084, 0.0022], [0.0084, -0.0003]], v(0, yRk, zF), v(0, -0.14, 1), UP, 18);
    cyl(K.ledMat, v(0, yRk - 0.0045, zF + 0.0034), v(0, yRk - 0.0045, zF + 0.0042), 0.0013, 0.0013, 8, false);
    for (const sx of [-1, 1]) {
      const g0 = v(sx * 0.031, yB + 0.011, zF);
      cyl(MAT.black, g0.clone().add(v(0, 0, -0.0005)), g0.clone().add(v(0, 0, 0.0035)), 0.0036, 0.0032, 10);
      cyl(MAT.hole, g0.clone().add(v(0, 0, 0.0035)), g0.clone().add(v(0, 0, 0.0037)), 0.0016, 0.0016, 8);
    }
    // sides: 12VDC jack on the right, heater + pump jacks on the left, printed labels
    const jack = (c, dir) => {
      cyl(MAT.ss, c.clone().addScaledVector(dir, -0.0004), c.clone().addScaledVector(dir, 0.0018), 0.0058, 0.0058, 6);
      cyl(MAT.ss, c.clone().addScaledVector(dir, 0.0018), c.clone().addScaledVector(dir, 0.0058), 0.0042, 0.0042, 12);
      cyl(MAT.hole, c.clone().addScaledVector(dir, 0.0058), c.clone().addScaledVector(dir, 0.006), 0.0028, 0.0028, 10);
    };
    const R = v(1, 0, 0), Lf = v(-1, 0, 0);
    jack(P(bW / 2, bD - 0.014, 0.012), R);
    keep(K.jackLblMat, new THREE.PlaneGeometry(0.022, 0.0055), frame(P(bW / 2 + 0.0004, bD - 0.014, 0.0225), UP, R));
    for (const zl of [bD - 0.016, bD - 0.038]) jack(P(-bW / 2, zl, 0.014), Lf);
    keep(K.portLblMat, new THREE.PlaneGeometry(0.044, 0.011), frame(P(-bW / 2 - 0.0004, bD - 0.027, 0.0265), UP, Lf));
    // Ss logo on the top (prints reading from behind, as in the kit photo)
    keep(A.logoMat, new THREE.PlaneGeometry(0.042, 0.042).rotateX(-PI / 2).rotateY(PI), new THREE.Matrix4().makeTranslation(0, yB + bH + 0.0004, zB + (bD - sRun) / 2));

    // probe cable: grommet high on the right side (rear), round the outside of the right cup and
    // down under the tray into the thermowell boot
    const ex = P(bW / 2, 0.034, 0.044);
    cyl(MAT.black, ex.clone().add(v(-0.0005, 0, 0)), ex.clone().add(v(0.0032, 0, 0)), 0.003, 0.0026, 10);
    const xo = tW / 2 + 0.011;
    tubeThrough(MAT.black, [
      ex.clone().add(v(0.003, 0, 0)), ex.clone().add(v(0.0095, -0.006, 0.004)), v(xo, yTT + 0.006, zB + 0.044),
      v(xo + 0.001, yTr - 0.01, zB + 0.05), v(xo - 0.008, yT + 0.005, zCap + 0.03), v(0.024, yT + 0.0005, zCap + 0.025),
      v(0.007, yT, zCap + 0.0168), v(0, yT, zCap + 0.0132),
    ], 0.0019, 40, 6);
  }

  // ---------------------------------------------------------------- cone ports: sample valve, carb stone, racking arm
  const yV = yCJ - 0.07;
  { // sample valve, front-left
    const u = radial(-32), tg = v(u.z, 0, -u.x), at = (r, dy = 0) => u.clone().multiplyScalar(r).add(v(0, yV + dy, 0));
    tcJoint('1.5', at(0.19), u, v(0, -1, 0), { lenA: 0.19 - rCone(yV) + 0.006, cap: true });
    cyl(MAT.ss, at(0.195), at(0.21), 0.008, 0.008, 14);
    cyl(MAT.ss, at(0.21), at(0.232), 0.0105, 0.0095, 16);
    cyl(MAT.ss, at(0.219, 0.008), at(0.219, 0.016), 0.0045, 0.0045, 10);
    box(MAT.blueHandle, at(0.219, 0.02).addScaledVector(tg, -0.006), 0.011, 0.022, 0.0065, v(0, 1, 0).addScaledVector(tg, -0.6), u);
    tubeThrough(MAT.ss, [at(0.231), at(0.241, -0.002), at(0.247, -0.012), at(0.248, -0.03)], 0.0042, 10, 10);
  }
  { // carbonation stone port with 3/8" ball valve, front-right
    const u = radial(32), tg = v(u.z, 0, -u.x), at = (r, dy = 0) => u.clone().multiplyScalar(r).add(v(0, yV + dy, 0));
    tcJoint('1.5', at(0.19), u, v(0, -1, 0), { lenA: 0.19 - rCone(yV) + 0.006, cap: true, flip: true });
    cyl(MAT.ss, at(0.195), at(0.206), 0.0066, 0.0066, 12);
    cyl(MAT.ss, at(0.206), at(0.228), 0.0098, 0.0098, 16);
    cyl(MAT.ss, at(0.228), at(0.236), 0.0096, 0.0096, 6);
    cyl(MAT.ss, at(0.217, 0.009), at(0.217, 0.018), 0.0045, 0.0045, 10);
    box(MAT.ss, at(0.217, 0.02).addScaledVector(tg, 0.019), 0.04, 0.0028, 0.008, UP, u);
    tubeThrough(MAT.ss, [at(0.235), at(0.246, -0.003), at(0.251, -0.016), at(0.251, -0.034)], 0.0046, 10, 10);
    cyl(MAT.ss, at(0.251, -0.027), at(0.251, -0.021), 0.0058, 0.0046, 10);
  }
  { // rotating racking arm port with butterfly valve, front
    const yR = yCJ - 0.23;
    tcJoint('1.5', v(0, yR, 0.105), v(0, 0, 1), v(-1, 0.15, 0), { lenA: 0.105 - rCone(yR) + 0.006, lenB: 0.024 });
    butterfly(v(0, yR, 0.105), v(0, 0, 1), UP, v(1, 0, -0.25), 0.14, true);
  }

  // ---------------------------------------------------------------- dump: cone outlet, sight glass, butterfly, 90° elbow
  {
    const DN = v(0, -1, 0);
    // cone outlet ferrule clamped to the sight glass's top ferrule
    tcJoint('1.5', v(0, yA, 0), DN, v(-1, 0, 0), { lenA: y0 + 0.008 - yA, lenB: 0.014 });
    // sight glass in a stainless cage
    cyl(MAT.ss, v(0, yA - 0.021, 0), v(0, yA - 0.013, 0), 0.0255, 0.0255, 20);
    cyl(MAT.ss, v(0, yS + 0.013, 0), v(0, yS + 0.021, 0), 0.0255, 0.0255, 20);
    for (const th0 of [PI / 2, 3 * PI / 2]) {
      const g = new THREE.CylinderGeometry(0.0246, 0.0246, 0.088 - 0.042, 10, 1, true, th0 - 0.95, 1.9);
      g.translate(0, (yA + yS) / 2, 0); put(MAT.ssDouble, g);
    }
    const gl = new THREE.CylinderGeometry(0.0205, 0.0205, 0.088 - 0.026, 20, 1, true); gl.translate(0, (yA + yS) / 2, 0); put(MAT.clear, gl);
    // sight glass bottom ferrule -> butterfly inlet; butterfly outlet -> 90° elbow
    tcJoint('1.5', v(0, yS, 0), DN, v(1, 0, 0.3), { lenA: 0.014, lenB: 0.024 });
    butterfly(v(0, yS, 0), v(0, -1, 0), v(-1, 0, 0), v(0, -0.6, 0.8), 0.13);
    tcJoint('1.5', v(0, yE, 0), DN, v(1, 0, -0.4), { lenA: 0.024, lenB: 0.012 });
    // elbow
    cyl(MAT.ss, v(0, yD + eR, 0), v(0, yE - 0.012, 0), rT15, rT15, 20);
    tubeThrough(MAT.ss, arcPts(v(0, yD + eR, eR), v(0, 0, -1), v(0, -1, 0), eR, 0, PI / 2, 10), rT15, 14, 20);
    tcFerrule('1.5', v(0, yD, 0.0555), v(0, 0, 1), 0.0555 - eR, true);
  }

  // ---------------------------------------------------------------- legs with extensions, labels
  const rrect = (w, rcn) => {
    const s = new THREE.Shape(), h = w / 2;
    s.moveTo(-h + rcn, -h); s.lineTo(h - rcn, -h); s.quadraticCurveTo(h, -h, h, -h + rcn);
    s.lineTo(h, h - rcn); s.quadraticCurveTo(h, h, h - rcn, h); s.lineTo(-h + rcn, h);
    s.quadraticCurveTo(-h, h, -h, h - rcn); s.lineTo(-h, -h + rcn); s.quadraticCurveTo(-h, -h, -h + rcn, -h);
    return s;
  };
  // square tube turned 45° about its own axis: a flat face looks at the vessel axis (radially inward)
  const sqTube = (mat, w, x, z, y0_, y1_) => {
    const g = new THREE.ExtrudeGeometry(rrect(w, 0.0035), { depth: y1_ - y0_, bevelEnabled: false, curveSegments: 3 });
    g.rotateX(-PI / 2); g.rotateY(PI / 4); g.translate(x, y0_, z); put(mat, g);
  };
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const x = sx * aL, z = sz * aL, dg = v(sx, 0, sz).normalize();
    sqTube(MAT.ssDull, 0.0405, x, z, yP, yJ);
    sqTube(MAT.ss, 0.0381, x, z, yJ - 0.003, yLT);
    box(MAT.hole, v(x, yJ + 0.0004, z), 0.0384, 0.0016, 0.0384, UP, dg);
    // weld tab: from the shell wall (inside the jacket) out to the leg's inner flat face
    const rIn = aL * Math.SQRT2 - 0.01905, r0 = RS + 0.0015, r1 = rIn + 0.0008;
    box(MAT.ss, v(0, yLT - 0.035, 0).addScaledVector(dg, (r0 + r1) / 2), 0.012, 0.06, r1 - r0, UP, dg);
    if (sz > 0) { // pressure label on the front-facing flat (normal points forward and toward the centre line)
      const n = v(-sx, 0, 1).normalize();
      const lbl = new THREE.PlaneGeometry(0.03, 0.11);
      keep(A.psiMat, lbl, frame(v(x, yLT - 0.07, z).addScaledVector(n, 0.01905 + 0.0006), n, v(0, -1, 0)).multiply(new THREE.Matrix4().makeRotationX(-PI / 2)));
    }
  }

  // ---------------------------------------------------------------- perforated lower shelf
  {
    const hw = 0.19, inner = 0.165;
    const pg = new THREE.PlaneGeometry(inner * 2, inner * 2); pg.rotateX(-PI / 2); pg.translate(0, yP - 0.0012, 0); put(MAT.perf, pg);
    for (const s of [-1, 1]) {
      box(MAT.ssDull, v(0, yP - 0.00125, s * (hw + inner) / 2), hw * 2, 0.0025, hw - inner);
      box(MAT.ssDull, v(s * (hw + inner) / 2, yP - 0.00125, 0), hw - inner, 0.0025, inner * 2);
      box(MAT.ssDull, v(0, yP - 0.0105, s * (hw - 0.001)), hw * 2, 0.018, 0.002);
      box(MAT.ssDull, v(s * (hw - 0.001), yP - 0.0105, 0), 0.002, 0.018, hw * 2 - 0.004);
    }
  }

  // ---------------------------------------------------------------- braked swivel casters under each leg
  const plate = (() => { const s = new THREE.Shape(); const pts = [[-0.02, 0.077], [0.022, 0.077], [0.046, 0.05], [0.044, 0.028], [0.022, 0.026], [0.006, 0.046], [-0.02, 0.068]]; s.moveTo(...pts[0]); for (const p of pts.slice(1)) s.lineTo(...p); s.closePath(); return s; })();
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const cx = sx * a, cz = sz * a, t = v(sx, 0, sz).normalize(), b = v(-t.z, 0, t.x);
    const c0 = v(cx, 0, cz);
    cyl(MAT.ss, v(cx, 0.087, cz), v(cx, yP - 0.0025, cz), 0.0095, 0.0095, 6);
    lathe(MAT.ss, [[0.0004, 0.073], [0.0215, 0.073, 1], [0.0225, 0.0765], [0.0242, 0.0795], [0.0242, 0.0855], [0.0215, 0.088, 1], [0.0004, 0.088]], c0, UP, null, 24);
    for (const s of [-1, 1]) {
      const g = new THREE.ExtrudeGeometry(plate, { depth: 0.0025, bevelEnabled: false });
      const m = new THREE.Matrix4().makeBasis(t, UP, b).setPosition(c0.clone().addScaledVector(b, s > 0 ? 0.0135 : -0.016));
      put(MAT.ssDull, g, m);
    }
    const wc = c0.clone().addScaledVector(t, 0.032).add(v(0, 0.0375, 0));
    lathe(MAT.wheel, [[0.0205, -0.0118], [0.033, -0.0118], [0.0368, -0.0085], [0.0375, -0.003], [0.0375, 0.003], [0.0368, 0.0085], [0.033, 0.0118], [0.0205, 0.0118]], wc, b, null, 24);
    cyl(MAT.ssDull, wc.clone().addScaledVector(b, -0.0122), wc.clone().addScaledVector(b, 0.0122), 0.0206, 0.0206, 18);
    cyl(MAT.ss, wc.clone().addScaledVector(b, -0.0185), wc.clone().addScaledVector(b, 0.0185), 0.004, 0.004, 8);
    cyl(MAT.ss, wc.clone().addScaledVector(b, 0.0165), wc.clone().addScaledVector(b, 0.0205), 0.0065, 0.0065, 6);
    // brake pedal
    const dn = 0.2, along = t.clone().multiplyScalar(Math.cos(dn)).add(v(0, -Math.sin(dn), 0)), py = t.clone().multiplyScalar(Math.sin(dn)).add(v(0, Math.cos(dn), 0));
    box(MAT.ssDull, c0.clone().addScaledVector(t, 0.052).add(v(0, 0.0805, 0)), 0.026, 0.0025, 0.046, py, along);
    box(MAT.ssDull, c0.clone().addScaledVector(t, 0.025).add(v(0, 0.0785, 0)), 0.024, 0.006, 0.014, UP, t);
  }

  // ---------------------------------------------------------------- merge by material
  const out = new THREE.Group();
  out.name = 'unitank';
  for (const [mat, list] of buckets) out.add(new THREE.Mesh(mergeGeos(THREE, list), mat));
  for (const m of solo) out.add(m);
  out.userData.ports = { dump: { pos: [0, +yD.toFixed(4), 0.0555], dir: [0, 0, 1] } };
  return out;
}

function mergeGeos(THREE, list) {
  let nv = 0, ni = 0;
  for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let vo = 0, io = 0;
  for (const g of list) {
    if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      pos[(vo + i) * 3] = p.getX(i); pos[(vo + i) * 3 + 1] = p.getY(i); pos[(vo + i) * 3 + 2] = p.getZ(i);
      nor[(vo + i) * 3] = n.getX(i); nor[(vo + i) * 3 + 1] = n.getY(i); nor[(vo + i) * 3 + 2] = n.getZ(i);
      if (u) { uv[(vo + i) * 2] = u.getX(i); uv[(vo + i) * 2 + 1] = u.getY(i); }
    }
    if (g.index) { const a = g.index.array; for (let i = 0; i < g.index.count; i++) idx[io + i] = a[i] + vo; io += g.index.count; }
    else { for (let i = 0; i < p.count; i++) idx[io + i] = vo + i; io += p.count; }
    vo += p.count;
    g.dispose();
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  m.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  m.setIndex(new THREE.BufferAttribute(idx, 1));
  m.computeBoundingSphere();
  return m;
}

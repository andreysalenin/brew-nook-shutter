// Ss Brewtech InfuSsion Mash Tun, 20 gal, tri-clamp version (Pure Flow valve).
// Published: Ø19.75" (502 mm) × 28" (711 mm) incl. lid; double wall, 1" foam-insulated walls and lid,
// 5° sloped floor with centre drain piped to a low side outlet, 1.5" TC Pure Flow valve, LCD thermometer
// on a thermowell, etched internal volume marks (hidden by the lid), two riveted side handles.
// The user's unit also carries the 2016-style two-tube manometer (front-left) seen in their photos.
// Layout (user's shelf): handles on ±x; thermowell front-right (34°), "DO NOT APPLY HEAT" sticker low
// front-right (47°), drain + valve at the bottom front-right (52°), manometer front-left (-30°),
// upper recirculation port with camlock on the left (-64°).

const RO = 0.2485;   // outer wall radius
const RI = 0.2235;   // inner wall radius (1" insulated wall)
const YB = 0.014;    // silicone feet height (body bottom)
const YT = 0.604;    // top of rolled rim
const TH_DRAIN = 90 * Math.PI / 180, Y_DRAIN = 0.058, L_VALVE = 0.076, N_FERRULE = 0.022;
const N_OUT = N_FERRULE + L_VALVE;

export const meta = {
  id: 'mashtun',
  name: 'Ss Brewtech InfuSsion Mash Tun 20 gal (TC, Pure Flow)',
  dims: 'Ø502 body, 601 wide over handles, 708 tall incl. lid handle',
  ports: {
    drain: {
      pos: [+(Math.sin(TH_DRAIN) * (RO + N_OUT)).toFixed(4), Y_DRAIN, +(Math.cos(TH_DRAIN) * (RO + N_OUT)).toFixed(4)],
      dir: [+Math.sin(TH_DRAIN).toFixed(4), 0, +Math.cos(TH_DRAIN).toFixed(4)],
      size: '1.5" TC',
    },
  },
};

export const defaultOptions = { thermometer: 'probe' }; // 'probe' (controller probe in the thermowell, as in the user's photo) | 'lcd' (Ss LCD thermometer in its boot, as shipped)

let TEX = null, XMAT = null;
function makeTex(ctx) {
  const fit = (g, text, maxW, size, weight = 'bold') => { let f = size; do { g.font = `${weight} ${f}px Arial, Helvetica, sans-serif`; f -= 1; } while (g.measureText(text).width > maxW && f > 6); };
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  return {
    logo: ctx.labelTex(512, 256, (g, w, h) => {
      const col = 'rgba(58,62,66,0.42)';
      g.strokeStyle = col; g.lineWidth = 9; rr(g, 24, 53, 150, 150, 26); g.stroke();
      g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
      fit(g, 'Ss', 120, 104); g.fillText('Ss', 99, 133);
      g.textAlign = 'left'; fit(g, 'BREWTECH', 300, 66); g.fillText('BREWTECH', 196, 112);
      fit(g, 'InfuSsion', 200, 38, 'normal'); g.fillText('InfuSsion', 198, 172);
    }),
    heat: ctx.labelTex(512, 288, (g, w, h) => {
      g.fillStyle = '#121212'; rr(g, 4, 4, w - 8, h - 8, 22); g.fill();
      g.fillStyle = '#f4f4f4'; g.textAlign = 'left'; g.textBaseline = 'middle';
      fit(g, 'DO NOT APPLY HEAT', 452, 56); g.fillText('DO NOT APPLY HEAT', 30, 66);
      fit(g, 'DIRECTLY TO', 320, 48); g.fillText('DIRECTLY TO', 30, 142);
      g.fillText('MASH TUN', 30, 208);
      g.strokeStyle = '#f4f4f4'; g.lineWidth = 9; g.beginPath(); g.arc(410, 200, 46, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(410, 172); g.quadraticCurveTo(436, 205, 410, 226); g.quadraticCurveTo(384, 205, 410, 172); g.fill();
      g.beginPath(); g.moveTo(378, 168); g.lineTo(442, 232); g.stroke();
    }),
    lcd: ctx.labelTex(256, 128, (g, w, h) => {
      g.fillStyle = '#a7b09a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#22261f'; g.font = 'bold 74px "Courier New", monospace'; g.textAlign = 'right'; g.textBaseline = 'middle';
      g.fillText('152.4', 214, 70); g.font = 'bold 30px Arial, sans-serif'; g.fillText('°F', 250, 46);
      g.font = '20px Arial, sans-serif'; g.textAlign = 'left'; g.fillText('TEMP', 12, 18);
    }),
    badge: ctx.labelTex(64, 64, (g, w, h) => {
      g.fillStyle = '#141414'; rr(g, 2, 2, 60, 60, 8); g.fill();
      g.fillStyle = '#eeeeee'; g.font = 'bold 34px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Ss', 32, 34);
    }),
  };
}

export function build(THREE, ctx, opts = {}) {
  const o = { ...defaultOptions, ...opts };
  const { MAT } = ctx;
  if (!TEX) TEX = makeTex(ctx);
  if (!XMAT) XMAT = { tube: new THREE.MeshStandardMaterial({ color: 0xf2f8fa, roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.62, depthWrite: false }) };
  const PI = Math.PI, rad = (d) => d * PI / 180;
  const V2 = (x, y) => new THREE.Vector2(x, y);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const g = new THREE.Group();
  const SS = [], BLK = [], RUB = [], CLR = [], HOLE = [], XTRA = new Map(); // XTRA: tri-clamp casting / gasket

  // ---------- helpers ----------
  const arc = (cx, cy, r, a0, a1, n) => { const p = []; for (let i = 0; i <= n; i++) { const a = rad(a0 + (a1 - a0) * i / n); p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return p; };
  const lathe = (pts, segs) => new THREE.LatheGeometry(pts.map(([r, y]) => V2(Math.max(r, 0), y)), segs);
  const latheZ = (pts, segs) => lathe(pts, segs).rotateX(PI / 2);               // revolve about local +z
  const cylZ = (r, z0, z1, segs, r1 = r) => new THREE.CylinderGeometry(r1, r, z1 - z0, segs).rotateX(PI / 2).translate(0, 0, (z0 + z1) / 2);
  const cylY = (r, y0, y1, segs, r1 = r) => new THREE.CylinderGeometry(r1, r, y1 - y0, segs).translate(0, (y0 + y1) / 2, 0);
  // local wall frame at angle th (0 = +z front, +90° = +x): x = tangential, y = up, z = radial out
  const frame = (th, y, r = RO) => {
    const s = Math.sin(th), c = Math.cos(th);
    return new THREE.Matrix4().makeBasis(V3(c, 0, -s), V3(0, 1, 0), V3(s, 0, c)).setPosition(s * r, y, c * r);
  };
  const put = (arr, geom, m) => { if (m) geom.applyMatrix4(m); arr.push(geom); return geom; };
  // rounded box (w × h in local x/y, depth d along +z from z0)
  const rbox = (w, h, z0, d, rad_ = 0.003) => {
    const s = new THREE.Shape(), x = w / 2 - rad_, y = h / 2 - rad_;
    s.moveTo(-x, -h / 2); s.lineTo(x, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -y); s.lineTo(w / 2, y); s.quadraticCurveTo(w / 2, h / 2, x, h / 2);
    s.lineTo(-x, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, y); s.lineTo(-w / 2, -y); s.quadraticCurveTo(-w / 2, -h / 2, -x, -h / 2);
    const b = Math.min(0.0015, rad_ * 0.6);
    return new THREE.ExtrudeGeometry(s, { depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 3 }).translate(0, 0, z0 + b);
  };
  // polyline with rounded corners -> curve whose samples are exactly the vertices
  const roundPoly = (corners, rc, nArc = 6) => {
    const P = corners.map((c) => V3(...c)), out = [P[0].clone()];
    for (let i = 1; i < P.length - 1; i++) {
      const d1 = P[i].clone().sub(P[i - 1]).normalize(), d2 = P[i + 1].clone().sub(P[i]).normalize();
      const phi = Math.acos(Math.min(1, Math.max(-1, d1.dot(d2)))), t = rc * Math.tan(phi / 2);
      const A = P[i].clone().addScaledVector(d1, -t), B = P[i].clone().addScaledVector(d2, t);
      for (let k = 0; k <= nArc; k++) { const s = k / nArc; out.push(A.clone().multiplyScalar((1 - s) * (1 - s)).addScaledVector(P[i], 2 * s * (1 - s)).addScaledVector(B, s * s)); }
    }
    out.push(P[P.length - 1].clone());
    return out;
  };
  const polyCurve = (pts) => {
    const c = new THREE.Curve(), n = pts.length - 1;
    c.getPoint = c.getPointAt = (t, tg = new THREE.Vector3()) => { const f = Math.min(Math.max(t, 0), 1) * n, i = Math.min(Math.floor(f), n - 1); return tg.copy(pts[i]).lerp(pts[i + 1], f - i); };
    c.getTangent = c.getTangentAt = (t, tg = new THREE.Vector3()) => { const i = Math.round(Math.min(Math.max(t, 0), 1) * n); return tg.subVectors(pts[Math.min(i + 1, n)], pts[Math.max(i - 1, 0)]).normalize(); };
    return c;
  };
  const tube = (pts, r, rs = 8, caps = false) => {
    const geo = new THREE.TubeGeometry(polyCurve(pts), pts.length - 1, r, rs, false);
    if (!caps) return [geo];
    const out = [geo];
    for (const [p, q] of [[pts[0], pts[1]], [pts[pts.length - 1], pts[pts.length - 2]]]) {
      const d = p.clone().sub(q).normalize();
      out.push(new THREE.CircleGeometry(r, rs).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), d)).translate(p.x, p.y, p.z));
    }
    return out;
  };
  const curvedDecal = (tex, w, h, th, y, r) => {
    const m = ctx.decal(tex, w, h), dth = w / r;
    m.geometry.dispose();
    m.geometry = new THREE.CylinderGeometry(r, r, h, Math.max(4, Math.ceil(dth / 0.045)), 1, true, th - dth / 2, dth);
    m.position.y = y;
    return m;
  };

  // ---------- body: double-wall shell, rolled rim, short inner wall (rest hidden by the lid plug) ----------
  {
    const rc = 0.016, bead = 0.0045, rb = 0.2508;
    const P = [[0, YB], [RO - rc, YB], ...arc(RO - rc, YB + rc, rc, -90, 0, 6).slice(1),
      [RO, YB + 0.12], [RO, YT - 0.2],
      ...arc(rb - bead, YT - bead, bead, -60, 90, 8),
      ...arc(RI + 0.004, YT - 0.004, 0.004, 90, 180, 4),
      [RI, YT - 0.05], [0, YT - 0.05]];
    const body = new THREE.Mesh(lathe(P, 64), MAT.ss);
    g.add(ctx.core(body));
  }
  // feet
  for (let i = 0; i < 4; i++) { const a = rad(45 + 90 * i); RUB.push(cylY(0.015, 0, YB + 0.002, 16).translate(Math.sin(a) * 0.19, 0, Math.cos(a) * 0.19)); }

  // ---------- lid: insulated, flat band + shallow dome, gasket, loop handle with silicone grip ----------
  const RL = 0.2465, yLB = YT + 0.003, yLF = YT + 0.021, yLC = YT + 0.044;
  const domeY = (r) => { const s = yLC - yLF - 0.001, rd = 0.205, Rs = (rd * rd + s * s) / (2 * s); return yLC - (Rs - Math.sqrt(Rs * Rs - r * r)); };
  {
    const P = [[0, YT - 0.022], ...arc(RI - 0.007, YT - 0.018, 0.004, -90, 0, 3), [RI - 0.003, yLB],
      ...arc(RL - 0.004, yLB + 0.004, 0.004, -90, 0, 3), [RL, yLF - 0.006],
      ...arc(RL - 0.006, yLF - 0.006, 0.006, 0, 90, 4), [0.212, yLF],
      ...arc(0.212, yLF + 0.004, 0.004, -90, -150, 2).slice(1)];
    for (let i = 0; i <= 10; i++) { const r = 0.205 * (1 - i / 10); P.push([r, domeY(r)]); }
    const lid = new THREE.Mesh(lathe(P, 64), MAT.ss);
    g.add(ctx.core(lid));
    // silicone lid gasket showing as a dark line between lid flange and rim
    RUB.push(new THREE.TorusGeometry(RL - 0.0035, 0.0017, 6, 64).rotateX(PI / 2).translate(0, YT + 0.0015, 0));
    // handle: stainless rod loop on two bosses, black silicone grip
    const yb = domeY(0.045) - 0.002, Ht = 0.698;
    for (const s of [-1, 1]) SS.push(cylY(0.0095, yb - 0.002, yb + 0.006, 16, 0.008).translate(s * 0.045, 0, 0));
    SS.push(...tube(roundPoly([[-0.045, yb, 0], [-0.045, Ht, 0], [0.045, Ht, 0], [0.045, yb, 0]], 0.016), 0.0042, 8));
    BLK.push(...tube(roundPoly([[-0.045, Ht - 0.028, 0], [-0.045, Ht, 0], [0.045, Ht, 0], [0.045, Ht - 0.028, 0]], 0.016), 0.0095, 12, true));
  }

  // ---------- side handles on ±x: riveted curved bracket, Ss badge, rod loop with silicone grip ----------
  const yH = YT - 0.085;
  for (const th of [rad(90), rad(-90)]) {
    // curved bracket plate (annular sector extruded vertically)
    const half = 0.072 / RO, s = new THREE.Shape();
    const ri = RO - 0.002, ro = RO + 0.0035, n = 10;
    for (let i = 0; i <= n; i++) { const a = -half + 2 * half * i / n; const p = [ro * Math.sin(a), -ro * Math.cos(a)]; i ? s.lineTo(...p) : s.moveTo(...p); }
    for (let i = n; i >= 0; i--) { const a = -half + 2 * half * i / n; s.lineTo(ri * Math.sin(a), -ri * Math.cos(a)); }
    const plate = new THREE.ExtrudeGeometry(s, { depth: 0.032, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0012, bevelSegments: 1, curveSegments: 4 })
      .rotateX(-PI / 2).translate(0, yH - 0.016, 0);
    { // extrude sides are flat-shaded: give the curved face true radial normals so it reads as one bent plate
      const pa = plate.attributes.position, na = plate.attributes.normal;
      for (let i = 0; i < pa.count; i++) {
        const x = pa.getX(i), z = pa.getZ(i), d = Math.hypot(x, z);
        if (Math.abs(na.getY(i)) < 0.2 && (na.getX(i) * x + na.getZ(i) * z) / d > 0.6) na.setXYZ(i, x / d, 0, z / d);
      }
    }
    SS.push(plate.rotateY(th));
    const F = frame(th, yH);
    const nP = 0.0047; // plate face
    for (const u of [-0.064, 0.064]) for (const dy of [-0.009, 0.009]) {
      put(SS, new THREE.SphereGeometry(0.0042, 10, 6, 0, PI * 2, 0, PI / 2).rotateX(PI / 2).scale(1, 1, 0.6).translate(u, dy, nP - 0.0004), F);
    }
    const tilt = new THREE.Matrix4().makeRotationX(rad(-30)), FT = F.clone().multiply(tilt);
    for (const u of [-0.052, 0.052]) put(SS, cylZ(0.0075, -0.004, 0.016, 14, 0.0065).translate(u, 0, 0), FT);
    const nOut = 0.048;
    for (const geo of tube(roundPoly([[-0.052, 0, 0.012], [-0.052, 0, nOut], [0.052, 0, nOut], [0.052, 0, 0.012]], 0.015), 0.0042, 8)) put(SS, geo, FT);
    for (const geo of tube(roundPoly([[-0.052, 0, 0.024], [-0.052, 0, nOut], [0.052, 0, nOut], [0.052, 0, 0.024]], 0.015), 0.0105, 12, true)) put(BLK, geo, FT);
    const badge = ctx.decal(TEX.badge, 0.016, 0.016);
    badge.applyMatrix4(F); badge.position.addScaledVector(V3(Math.sin(th), 0, Math.cos(th)), nP + 0.0006);
    g.add(badge);
  }

  // ---------- thermowell (front-right) with LCD thermometer in silicone boot, or controller probe ----------
  {
    const th = rad(90), y = 0.174, F = frame(th, y);
    // pressed dimple ring where the thermowell passes the double wall
    put(SS, latheZ([[0.0295, -0.0026], [0.029, 0.0004], [0.026, 0.0019], [0.019, 0.0016], [0.0135, 0.0004], [0, 0.0004]], 32), F);
    put(SS, new THREE.CylinderGeometry(0.0118, 0.0118, 0.007, 6).rotateX(PI / 2).rotateZ(PI / 6).translate(0, 0, 0.0039), F); // lock nut
    put(SS, cylZ(0.006, 0.007, 0.013, 14), F); // thermowell end
    if (o.thermometer === 'probe') {
      put(SS, new THREE.CylinderGeometry(0.0075, 0.0075, 0.007, 6).rotateX(PI / 2).translate(0, 0, 0.0165), F);
      put(SS, cylZ(0.0045, 0.02, 0.028, 12), F);
      const cab = roundPoly([[0, 0, 0.028], [0, 0, 0.036], [0, -0.03, 0.036], [0, -0.06, 0.0045], [0, -0.1718, 0.0045]], 0.012);
      for (const geo of tube(cab, 0.0022, 6, true)) put(BLK, geo, F);
    } else {
      const zb = -0.0015, fr = zb + 0.024; // boot back sits on the wall (corners touch the curved shell)
      put(BLK, rbox(0.058, 0.044, zb, 0.024, 0.009), F);
      put(HOLE, rbox(0.044, 0.024, fr - 0.0003, 0.0009, 0.002), F); // dark bezel around the LCD
      const scr = ctx.decal(TEX.lcd, 0.040, 0.020);
      scr.applyMatrix4(F); scr.position.addScaledVector(V3(Math.sin(th), 0, Math.cos(th)), fr + 0.0009);
      g.add(scr);
    }
  }

  // ---------- upper recirculation port (left side): black silicone flange, lock nut, camlock coupler ----------
  {
    const F = frame(rad(0), YT - 0.042);
    put(BLK, cylZ(0.0165, -0.003, 0.004, 24), F);
    put(SS, new THREE.CylinderGeometry(0.0125, 0.0125, 0.007, 6).rotateX(PI / 2).translate(0, 0, 0.0075), F);
    put(SS, new THREE.CylinderGeometry(0.0098, 0.0098, 0.012, 6).rotateX(PI / 2).rotateZ(PI / 6).translate(0, 0, 0.017), F);
    // female coupler (socket faces out), cam arms folded back toward the wall, male hose-barb adapter inserted
    put(SS, latheZ([[0.0082, 0.0225], [0.0128, 0.023], [0.0142, 0.025], [0.0142, 0.0425], [0.0128, 0.0445], [0.0102, 0.0448],
      [0.0102, 0.0465], [0.0118, 0.047], [0.0118, 0.0505], [0.0098, 0.051], [0.0075, 0.0525], [0.0075, 0.0565], [0.0064, 0.057],
      [0.0076, 0.0595], [0.0064, 0.06], [0.0076, 0.0625], [0.0064, 0.063], [0.0074, 0.0655], [0.0074, 0.0675], [0.0046, 0.068]], 18), F);
    for (const sg of [-1, 1]) {
      put(SS, new THREE.BoxGeometry(0.0055, 0.009, 0.007).translate(sg * 0.0158, 0, 0.0405), F);           // cam ears
      put(SS, new THREE.BoxGeometry(0.0026, 0.006, 0.026).rotateY(sg * rad(-6)).translate(sg * 0.0178, 0, 0.0305), F); // cam arms
      put(SS, new THREE.TorusGeometry(0.0058, 0.0011, 5, 14).rotateY(PI / 2).translate(sg * 0.0168, -0.006, 0.0175), F); // pull rings
    }
    put(HOLE, new THREE.CircleGeometry(0.0046, 12).translate(0, 0, 0.0681), F);
  }

  // ---------- etched logo and stickers ----------
  g.add(curvedDecal(TEX.logo, 0.13, 0.065, rad(90), 0.36, RO + 0.0004));
  g.add(curvedDecal(TEX.heat, 0.072, 0.0405, rad(112.5), 0.118, RO + 0.0004));

  // ---------- manometer (two clear tubes, shared top clip, staggered bottom taps), front-left ----------
  {
    const th = rad(67.5), F = frame(th, 0); // 22.5° off the handle / probe / valve line
    const nT = 0.021, rT = 0.0062;
    const taps = [[-0.018, 0.106], [0.018, 0.078]];
    for (const [u, yb] of taps) {
      put(BLK, rbox(0.026, 0.030, -0.002, 0.034, 0.004).translate(u, yb, 0), F);
      put(CLR, cylY(rT, yb + 0.014, YT - 0.004, 14).translate(u, 0, nT), F);
      put(HOLE, cylY(rT * 0.55, YT - 0.0046, YT - 0.0035, 10).translate(u, 0, nT), F);
    }
    put(BLK, rbox(0.066, 0.034, -0.002, 0.034, 0.005).translate(0, YT - 0.16, 0), F);
  }

  // ---------- bottom drain: 1.5" TC ferrule, clamp, Pure Flow valve with notch plate and long lever ----------
  {
    const F = frame(TH_DRAIN, Y_DRAIN);
    const z0 = N_FERRULE, z1 = N_OUT, zc = (z0 + z1) / 2;
    // vessel ferrule (welded to the outer wall) clamped to the valve's TC inlet: shared ctx.tc joint,
    // clamp lugs on top, turned so the wing nut hangs toward the front (clear of the lever)
    const tc = ctx.tc, tcPut = (obj) => { for (const { material, geometry } of tc.bake(obj)) {
      const list = material === MAT.ss ? SS : material === MAT.hole ? HOLE : (XTRA.get(material) || XTRA.set(material, []).get(material));
      put(list, geometry, F);
    } };
    tcPut(tc.aim(tc.joint('1.5', { lenA: z0 + 0.004, lenB: 0.009, flip: true }), V3(0, 0, z0), V3(0, 0, 1), V3(0, 1, 0)));
    put(SS, new THREE.TorusGeometry(0.0195, 0.0018, 6, 24).translate(0, 0, 0.0002), F); // weld bead
    // valve body: wafer body with split line between the TC ends
    put(SS, latheZ([[0.0186, z0 + 0.0085], [0.01905, z0 + 0.0094], [0.01905, zc - 0.025],
      [0.024, zc - 0.0235], [0.0298, zc - 0.0215], [0.0335, zc - 0.0182], [0.0335, zc - 0.0015], [0.0322, zc], [0.0335, zc + 0.0015],
      [0.0335, zc + 0.0182], [0.0298, zc + 0.0215], [0.024, zc + 0.0235], [0.01905, zc + 0.0245], [0.0186, zc + 0.0255]], 24), F);
    // open TC outlet (the drain port)
    tcPut(tc.aim(tc.ferrule('1.5', { len: z1 - zc - 0.024, open: true }), V3(0, 0, z1), V3(0, 0, 1)));
    // body clamp bolts (two hex nuts each side)
    for (const s of [-1, 1]) {
      put(SS, new THREE.BoxGeometry(0.012, 0.012, 0.03).translate(s * 0.031, -0.016, zc), F); // lugs
      put(SS, cylZ(0.0026, zc - 0.019, zc + 0.019, 8).translate(s * 0.033, -0.018, 0), F);
      for (const e of [-1, 1]) put(SS, new THREE.CylinderGeometry(0.0048, 0.0048, 0.0035, 6).rotateX(PI / 2).translate(s * 0.033, -0.018, zc + e * 0.0165), F);
    }
    // stem neck, notch plate, lever with squeeze trigger (lever closed = tangential, toward +x/back)
    const yS = 0.0305, yP = 0.050, yL = 0.0555;
    put(SS, cylY(0.009, yS, yP, 16).translate(0, 0, zc), F);
    const np = new THREE.Shape(), R0 = 0.041, R1 = 0.0375, a0 = -12, a1 = 102, nT = 19;
    np.moveTo(0, 0);
    for (let i = 0; i <= nT * 2; i++) {
      const a = rad(a0 + (a1 - a0) * i / (nT * 2)), r = i % 2 ? R1 : R0;
      np.lineTo(r * Math.cos(a), -r * Math.sin(a));
    }
    np.lineTo(0, 0);
    put(SS, new THREE.ExtrudeGeometry(np, { depth: 0.003, bevelEnabled: false, curveSegments: 1 }).rotateX(-PI / 2).translate(0, yP, zc), F);
    const lv = new THREE.Shape(), L = 0.155, W = 0.0105;
    lv.moveTo(-0.012, -W); lv.lineTo(L - W, -W); lv.absarc(L - W, 0, W, -PI / 2, PI / 2, false); lv.lineTo(-0.012, W); lv.absarc(-0.012, 0, W, PI / 2, PI * 1.5, false);
    put(SS, new THREE.ExtrudeGeometry(lv, { depth: 0.0035, bevelEnabled: true, bevelThickness: 0.0008, bevelSize: 0.0008, bevelSegments: 1, curveSegments: 8 })
      .rotateX(-PI / 2).translate(0, yL - 0.0016, zc), F);
    put(SS, new THREE.CylinderGeometry(0.0062, 0.0062, 0.005, 6).translate(0, yL + 0.0045, zc), F); // stem nut
    put(SS, new THREE.BoxGeometry(0.095, 0.003, 0.012).translate(0.085, yL - 0.0068, zc), F); // squeeze trigger
    put(SS, new THREE.BoxGeometry(0.008, 0.007, 0.012).translate(0.04, yL - 0.004, zc), F);   // trigger pivot block
    put(SS, new THREE.BoxGeometry(0.006, 0.006, 0.006).translate(0.039, yP + 0.003 + 0.003, zc), F); // pawl over notches
  }

  // ---------- merge static parts per material ----------
  const merge = (list) => {
    let nv = 0, ni = 0;
    for (const q of list) { nv += q.attributes.position.count; ni += q.index ? q.index.count : q.attributes.position.count; }
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = new Float32Array(nv * 2);
    const I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let vo = 0, io = 0;
    for (const q of list) {
      const a = q.attributes, c = a.position.count;
      P.set(a.position.array.subarray(0, c * 3), vo * 3);
      if (a.normal) N.set(a.normal.array.subarray(0, c * 3), vo * 3);
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
  for (const [list, mat] of [[SS, MAT.ss], [BLK, MAT.black], [RUB, MAT.rubber], [CLR, XMAT.tube], [HOLE, MAT.hole]]) {
    if (list.length) g.add(new THREE.Mesh(merge(list), mat));
  }
  for (const [mat, list] of XTRA) g.add(new THREE.Mesh(merge(list), mat));
  return g;
}

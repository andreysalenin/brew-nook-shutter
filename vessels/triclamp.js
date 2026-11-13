// Shared tri-clamp (sanitary / tri-clover) fittings: ferrule, gasket, single-pin clamp, end cap.
// Plain ES module, no imports. Usage: const tc = createTriClamp(THREE, MAT); tc.joint('1.5', {...}).
//
// Every builder returns a THREE.Group built along +z with its origin at the sealing face:
//   ferrule  : flange face at z = 0, tube running toward -z
//   gasket   : centred on z = 0 (thickness sizes[s].gap)
//   clamp    : centred on z = 0 (the joint plane), gap + lugs at local +y, wing nut hanging toward +x
//   cap      : sealing face at z = 0 facing -z, body toward +z
//   joint    : joint plane at z = 0; ferrule A face at -gap/2 (tube toward -z), gasket, clamp,
//              then ferrule B (tube toward +z) or a cap with its face at +gap/2
// Geometry is cached per size/variant on this API object and marked userData.shared = true.
//
// Dimensions (mm, from charts):
//  ferrule / gasket: ISO 2852:1993 + DIN 32676 series C + ASME BPE tables (tube OD, ID, flange OD,
//    flange rim thickness 2.85, 20° flange back taper, bead groove dia, groove depth 1.6, ferrule
//    length 21.5 / 28), Rubber Fab gasket chart (gasket ID, OD, bead dia).
//  clamp: 13MHHM single-pin heavy-duty chart (A = lip opening, B = channel bottom dia), Misumi
//    ring OD (1.5S 60, 3S 104), Dixon overall sizes; lug / nut proportions from the user's photos
//    (Ss Brewtech clamps with cross-hole wing nuts).

const MM = 0.001;
const T20 = Math.tan(20 * Math.PI / 180);

// Raw chart values in millimetres.
const TABLE = {
  '1.5': { tubeOD: 38.1, wall: 1.65, flangeOD: 50.5, rim: 2.85, beadD: 43.5, len: 21.5, gasketID: 35.3, clampLipD: 44.4, clampChanD: 53.6, clampOD: 60, clampW: 14, boltD: 7.94, seg: 16, ringSeg: 24 },
  '3': { tubeOD: 76.2, wall: 1.65, flangeOD: 91.0, rim: 2.85, beadD: 83.5, len: 28, gasketID: 73.1, clampLipD: 84.0, clampChanD: 94.2, clampOD: 104, clampW: 17, boltD: 7.94, seg: 28, ringSeg: 32 },
  '6': { tubeOD: 152.4, wall: 2.77, flangeOD: 167.0, rim: 2.85, beadD: 156.5, len: 28, gasketID: 147.2, clampLipD: 155.4, clampChanD: 170.4, clampOD: 184, clampW: 20, boltD: 9.53, seg: 48, ringSeg: 56 },
};
const GAP = 1.2;      // compressed gasket web thickness between the two flange faces (mm)
const GROOVE = 1.6;   // bead groove depth in the flange face (ISO 2852 K)

function buildSizes() {
  const out = {}, MM = (v) => Math.round(v * 1000) / 1e6; // mm -> m, rounded to 1 µm
  for (const [k, t] of Object.entries(TABLE)) {
    const rf = t.flangeOD / 2, rt = t.tubeOD / 2;
    const rise = (rf - rt) * T20;            // extra flange thickness gained by the 20° back taper
    out[k] = {
      nominal: k + '"',
      tubeOD: MM(t.tubeOD), tubeID: MM(t.tubeOD - 2 * t.wall), wall: MM(t.wall),
      flangeOD: MM(t.flangeOD), rim: MM(t.rim), taperDeg: 20,
      flangeBack: MM(t.rim + rise),          // face to where the back taper meets the tube
      beadD: MM(t.beadD), grooveDepth: MM(GROOVE), len: MM(t.len),
      gasketID: MM(t.gasketID), gasketOD: MM(t.flangeOD), gap: MM(GAP),
      clampLipD: MM(t.clampLipD), clampChanD: MM(t.clampChanD), clampOD: MM(t.clampOD), clampW: MM(t.clampW),
      boltD: MM(t.boltD), capT: MM(t.rim + rise + 0.7),
      clampStyle: 'single-pin heavy duty (13MHHM style), 2 segments, eye bolt + cross-hole wing nut',
    };
  }
  return out;
}

export function createTriClamp(THREE, MAT) {
  const sizes = buildSizes();
  const cache = new Map();
  const gasketMat = new THREE.MeshStandardMaterial({ color: 0xe9e8e2, roughness: 0.72, metalness: 0 }); // white platinum silicone
  const key = (s) => {
    const k = String(s);
    if (!TABLE[k]) throw new Error(`triclamp: unknown size ${s} (use '1.5', '3' or '6')`);
    return k;
  };
  const memo = (k, make) => {
    let g = cache.get(k);
    if (!g) { g = make(); g.userData.shared = true; g.computeBoundingSphere(); cache.set(k, g); }
    return g;
  };

  // ------------------------------------------------------------------ geometry helpers
  // revolve a profile [[r, z, smooth?], ...] (metres) about local z. Each profile edge gets its own
  // vertex rings: hard edges at corners, smooth normals where the point is flagged smooth.
  function revolve(prof, segs, th0 = 0, thL = Math.PI * 2) {
    const n = prof.length, en = [];
    for (let i = 0; i < n - 1; i++) {
      const dr = prof[i + 1][0] - prof[i][0], dz = prof[i + 1][1] - prof[i][1], l = Math.hypot(dr, dz) || 1;
      en.push([dz / l, -dr / l]);
    }
    const nAt = (i, e) => {
      if (prof[i][2] && e > 0 && i === e && en[e - 1]) { const a = en[e - 1], b = en[e]; const x = a[0] + b[0], y = a[1] + b[1], l = Math.hypot(x, y) || 1; return [x / l, y / l]; }
      if (prof[i][2] && i === e + 1 && en[e + 1]) { const a = en[e], b = en[e + 1]; const x = a[0] + b[0], y = a[1] + b[1], l = Math.hypot(x, y) || 1; return [x / l, y / l]; }
      return en[e];
    };
    const P = [], N = [], U = [], I = [];
    let v0 = 0;
    for (let e = 0; e < n - 1; e++) {
      const ends = [[e, nAt(e, e)], [e + 1, nAt(e + 1, e)]];
      for (let s = 0; s <= segs; s++) {
        const th = th0 + thL * s / segs, c = Math.cos(th), sn = Math.sin(th);
        for (const [i, nn] of ends) {
          P.push(prof[i][0] * c, prof[i][0] * sn, prof[i][1]);
          N.push(nn[0] * c, nn[0] * sn, nn[1]);
          U.push(s / segs, i / (n - 1));
        }
      }
      for (let s = 0; s < segs; s++) {
        const a = v0 + s * 2, b = a + 2, d = a + 1, cc = b + 1;
        if (prof[e][0] > 1e-7) I.push(a, b, d);
        if (prof[e + 1][0] > 1e-7) I.push(cc, d, b);
      }
      v0 += (segs + 1) * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    g.setIndex(I);
    return g;
  }
  function merge(list) {
    let nv = 0, ni = 0;
    for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = new Float32Array(nv * 2);
    const I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let vo = 0, io = 0;
    for (const g of list) {
      const c = g.attributes.position.count;
      if (!g.attributes.normal) g.computeVertexNormals();
      P.set(g.attributes.position.array.subarray(0, c * 3), vo * 3);
      N.set(g.attributes.normal.array.subarray(0, c * 3), vo * 3);
      if (g.attributes.uv) U.set(g.attributes.uv.array.subarray(0, c * 2), vo * 2);
      if (g.index) { const a = g.index.array; for (let k = 0; k < a.length; k++) I[io++] = a[k] + vo; }
      else for (let k = 0; k < c; k++) I[io++] = k + vo;
      vo += c; g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(P, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    out.setIndex(new THREE.BufferAttribute(I, 1));
    return out;
  }
  const box = (x0, x1, y0, y1, z0, z1) => new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  // cylinder along local z (or x), centre (x, y, z)
  const cylZ = (r, len, segs, x, y, z = 0, open = false) => new THREE.CylinderGeometry(r, r, len, segs, 1, open).rotateX(Math.PI / 2).translate(x, y, z);
  const cylX = (r, len, segs, x, y, z = 0, open = false) => new THREE.CylinderGeometry(r, r, len, segs, 1, open).rotateZ(-Math.PI / 2).translate(x, y, z);

  // ------------------------------------------------------------------ ferrule
  // opts: len (m, default chart length), open (bore + dark disc visible), reduce (tube OD in m for
  // a reducing ferrule, e.g. 0.0127 for a 1/2" tube on a 1.5" flange)
  function ferruleGeo(k, len, open, reduce) {
    return memo(`f|${k}|${len.toFixed(5)}|${open ? 1 : 0}|${reduce ? reduce.toFixed(5) : 0}`, () => {
      const s = sizes[k], t = TABLE[k];
      const rf = s.flangeOD / 2, rt = s.tubeOD / 2, ri = s.tubeID / 2, e = s.rim, back = s.flangeBack;
      const R = Math.min(1.5 * MM, (rf - rt) * 0.25), ch = 0.4 * MM;
      const prof = [];
      let bore = ri;
      // the tube end at -len is closed by an annulus (or a disc), so a stub never looks hollow
      if (reduce) {
        const rr = reduce / 2; bore = Math.max(rr - 1.24 * MM, rr * 0.7);
        const zc = back + R + Math.max(4 * MM, (rt - rr) * 0.6); // start of the reducing cone
        const zl = -Math.max(len, zc + 2 * MM);
        prof.push([open ? bore : 0, zl], [rr, zl], [rr, -zc], [rt, -(back + R)]);
      } else {
        prof.push([open ? ri : 0, -len], [rt, -len], [rt, -(back + R)]);
      }
      prof.push([rt + R * 0.6, -(back - R * 0.2)], [rf - ch, -e - ch * T20], [rf, -e + ch], [rf, 0]);
      if (!open) {
        prof.push([0, 0]);
      } else {
        const rg = s.beadD / 2, gw = GROOVE * MM;
        prof.push([rg + gw, 0], [rg, -s.grooveDepth, 1], [rg - gw, 0]);
        prof.push([bore + ch, 0], [bore, -ch], [bore, -Math.min(len - 0.5 * MM, 0.03)]);
      }
      return revolve(prof, t.seg);
    });
  }
  function holeGeo(k, len, reduce) {
    return memo(`h|${k}|${len.toFixed(5)}|${reduce ? reduce.toFixed(5) : 0}`, () => {
      const s = sizes[k];
      const r = reduce ? Math.max(reduce / 2 - 1.24 * MM, reduce * 0.35) : s.tubeID / 2;
      const d = Math.min(len - 0.5 * MM, 0.03);
      return new THREE.CircleGeometry(r, Math.max(12, TABLE[k].seg)).translate(0, 0, -d + 0.2 * MM);
    });
  }
  function ferrule(size, opts = {}) {
    const k = key(size), s = sizes[k];
    const len = opts.len != null ? opts.len : s.len;
    const g = new THREE.Group(); g.name = `tc-ferrule-${k}`;
    g.add(new THREE.Mesh(ferruleGeo(k, len, !!opts.open, opts.reduce || 0), MAT.ss));
    if (opts.open) g.add(new THREE.Mesh(holeGeo(k, len, opts.reduce || 0), MAT.hole));
    return g;
  }

  // ------------------------------------------------------------------ gasket
  function gasketGeo(k, rimOnly) {
    return memo(`g|${k}|${rimOnly ? 1 : 0}`, () => {
      const s = sizes[k], ro = s.gasketOD / 2, ri = s.gasketID / 2, h = s.gap / 2, rb = s.beadD / 2;
      const seg = TABLE[k].seg;
      if (rimOnly) return revolve([[ro - 0.15 * MM, -h], [ro, 0, 1], [ro - 0.15 * MM, h]], seg);
      const br = 1.5 * MM, bh = 1.4 * MM;
      return revolve([
        [ri, -h], [rb - br, -h], [rb, -h - bh, 1], [rb + br, -h], [ro - 0.2 * MM, -h], [ro, 0, 1],
        [ro - 0.2 * MM, h], [rb + br, h], [rb, h + bh, 1], [rb - br, h], [ri, h], [ri, -h],
      ], seg);
    });
  }
  function gasket(size, opts = {}) {
    const k = key(size);
    const g = new THREE.Group(); g.name = `tc-gasket-${k}`;
    g.add(new THREE.Mesh(gasketGeo(k, !!opts.rimOnly), gasketMat));
    return g;
  }

  // ------------------------------------------------------------------ end cap (blank)
  function capGeo(k) {
    return memo(`c|${k}`, () => {
      const s = sizes[k], rf = s.flangeOD / 2, rt = s.tubeOD / 2, e = s.rim, ch = 0.4 * MM;
      const top = s.capT, rTop = rt - 1 * MM, zt = (r) => e + (rf - r) * T20;
      return revolve([
        [0, 0], [rf - ch, 0], [rf, ch], [rf, e - ch], [rf - ch, zt(rf - ch)],
        [rTop + 1.2 * MM, zt(rTop + 1.2 * MM)], [rTop, top], [0, top],
      ], TABLE[k].seg);
    });
  }
  function cap(size) {
    const k = key(size);
    const g = new THREE.Group(); g.name = `tc-cap-${k}`;
    g.add(new THREE.Mesh(capGeo(k), MAT.ss));
    return g;
  }

  // ------------------------------------------------------------------ clamp
  // Local frame: z = pipe axis, joint plane z = 0. Gap at +y with two lugs: the -x lug is a clevis
  // carrying the eye-bolt pivot, the +x lug is slotted; the bolt runs along +x to a cross-hole wing
  // nut (flat paddle in the ring plane, hole along z). Single hinge knuckle set at -y.
  function clampDims(k) {
    const s = sizes[k], t = TABLE[k];
    const kk = t.boltD / 7.94;                                // hardware scale (1 for 5/16" bolt)
    const ra = s.clampLipD / 2, rb = s.clampChanD / 2, ro = s.clampOD / 2, W = s.clampW;
    const rf = s.flangeOD / 2;
    const h0 = s.rim + s.gap / 2 + 0.15 * MM;                 // channel half width at the flange rim
    const hL = h0 + (rf - ra) * T20;                          // channel half width at the lip
    const rbolt = s.boltD / 2;
    const gh = 1.5 * MM * kk, tl = 5.5 * MM * kk;             // half gap between lugs, lug thickness
    const nb = 3.5 * MM * kk, wp = 22 * MM * kk, Lp = 24 * MM * kk, tp = 5.5 * MM * kk; // nut barrel, paddle w/len/thk
    const xp0 = gh + tl + nb;
    const rB = Math.max(ro + 8 * MM * kk, Math.sqrt(ro * ro - xp0 * xp0) + 0.8 * MM * kk + wp / 2); // bolt axis radius
    const re = rbolt + 1.8 * MM * kk;                         // eye-bolt boss radius
    const rL = rB + re + 1.0 * MM * kk;                       // lug tops
    const kR = 3.6 * MM * kk;                                 // hinge knuckle radius
    return { s, t, kk, ra, rb, ro, W, h0, hL, rbolt, gh, tl, nb, wp, Lp, tp, xp0, rB, re, rL, kR };
  }
  function clampGeos(k) {
    const cast = memo(`k|${k}|cast`, () => {
      const d = clampDims(k), { ra, ro, W, hL, gh, tl, rB, re, rL, kR, rbolt } = d;
      const seg = d.t.ringSeg, half = Math.ceil(seg / 2);
      const Wl = W / 2 * 0.94, c = 0.8 * MM;
      const prof = [[ra, -hL], [ra, -Wl], [ro - c, -W / 2], [ro, -W / 2 + c, 1], [ro, W / 2 - c, 1], [ro - c, W / 2], [ra, Wl], [ra, hL]];
      const tg = Math.asin(Math.min(0.99, (gh + tl * 0.5) / ro)), th = Math.asin(0.4 * MM / ro);
      const parts = [];
      // two cast segments: B from the hinge (-90°) up to the gap (+90°) on the +x side, A mirrored
      const segA0 = Math.PI / 2 + tg, segB0 = -Math.PI / 2 + th, segL = Math.PI - th - tg;
      parts.push(revolve(prof, half, segB0, segL));
      parts.push(revolve(prof, half, segA0, segL));
      // end faces of each segment (cross-section incl. the channel that wraps the flanges)
      const rfc = d.s.flangeOD / 2 + 0.3 * MM, { rb, h0 } = d;
      const xs = [[ra, -hL], [ra, -Wl], [ro - c, -W / 2], [ro, -W / 2 + c], [ro, W / 2 - c], [ro - c, W / 2], [ra, Wl], [ra, hL], [rfc, h0], [rb, h0], [rb, -h0], [rfc, -h0]];
      const xsh = new THREE.Shape(); xsh.moveTo(xs[0][0], xs[0][1]); for (const q of xs.slice(1)) xsh.lineTo(q[0], q[1]); xsh.closePath();
      for (const [th0, end] of [[segB0, 0], [segB0 + segL, 1], [segA0, 0], [segA0 + segL, 1]]) {
        const sg = new THREE.ShapeGeometry(xsh, 1), p = sg.attributes.position, nn = sg.attributes.normal;
        const cs = Math.cos(th0), sn = Math.sin(th0), nx = end ? -sn : sn, ny = end ? cs : -cs;
        for (let i = 0; i < p.count; i++) { const r = p.getX(i), z = p.getY(i); p.setXYZ(i, r * cs, r * sn, z); nn.setXYZ(i, nx, ny, 0); }
        if (end) { const ix = sg.index.array; for (let i = 0; i < ix.length; i += 3) { const t0 = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t0; } }
        parts.push(sg);
      }
      // lugs: flared tabs extruded across the ring width; the -x lug is a clevis (cheeks above the
      // base carry the eye-bolt pivot), the +x lug is a fork (prongs either side of the bolt)
      const z1 = W / 2 * 0.98, tc = W * 0.24, slot = rbolt + 0.5 * MM, fl = tl * 0.45;
      const yOD = (x) => Math.sqrt(Math.max(0, ro * ro - x * x)), yIn = (x) => Math.sqrt(Math.max(0, ra * ra - x * x));
      const lug = (sg, yT) => {
        const x0 = gh, x1 = gh + tl, x2 = x1 + fl, sh = new THREE.Shape();
        sh.moveTo(sg * x0, yIn(x0) + 0.4 * MM);
        sh.lineTo(sg * x0, yT); sh.lineTo(sg * x1, yT); sh.lineTo(sg * x1, yOD(x1) + fl);
        sh.quadraticCurveTo(sg * x1, yOD(x1), sg * x2, yOD(x2) - 0.15 * MM);
        sh.lineTo(sg * x2, yIn(x2) + 0.5 * MM); sh.closePath();
        return new THREE.ExtrudeGeometry(sh, { depth: 2 * z1, bevelEnabled: false, curveSegments: 3 }).translate(0, 0, -z1);
      };
      const xa0 = -gh - tl, xa1 = -gh, xb0 = gh, xb1 = gh + tl;
      parts.push(lug(-1, rB));
      for (const sz of [-1, 1]) parts.push(box(xa0, xa1, rB - 0.5 * MM, rL, sz > 0 ? z1 - tc : -z1, sz > 0 ? z1 : -z1 + tc));
      parts.push(lug(1, rB - slot));
      for (const sz of [-1, 1]) parts.push(box(xb0, xb1, rB - slot - 0.1 * MM, rL, sz > 0 ? slot : -z1, sz > 0 ? z1 : -slot));
      // hinge: three knuckles on the pin (outer two on one segment, middle one on the other)
      const yk = -(ro + kR * 0.35), kl = W / 3 - 0.35 * MM;
      for (const zc of [-W / 3, 0, W / 3]) parts.push(cylZ(kR, kl, 10, 0, yk, zc));
      return merge(parts);
    });
    const hw = memo(`k|${k}|hw`, () => {
      const d = clampDims(k), { W, gh, tl, nb, wp, Lp, tp, xp0, rB, re, rbolt, kR, ro, kk } = d;
      const parts = [];
      const xA = -gh - tl / 2;
      // eye-bolt boss between the cheeks, pivot pin through the clevis
      parts.push(cylZ(re, W * 0.52, 10, xA, rB, 0, true));
      parts.push(cylZ(rbolt * 0.55, W + 1.4 * MM, 8, xA, rB));
      // bolt from the eye to the nut
      const xEnd = xp0 + 1.5 * MM * kk;
      parts.push(cylX(rbolt, xEnd - xA, 8, (xA + xEnd) / 2, rB, 0, true));
      // nut barrel against lug B
      const nb2 = nb + 4 * MM * kk;
      parts.push(cylX(rbolt * 1.45, nb2, 10, gh + tl + nb2 / 2, rB, 0));
      // cross-hole wing paddle: rounded triangle in the ring plane, hole along z
      const sh = new THREE.Shape(), rt = 7.5 * MM * kk, cr = 2.2 * MM * kk, cx = Lp - rt;
      const P0x = cr, P0y = wp / 2;
      const dx = P0x - cx, dy = P0y, dd = Math.hypot(dx, dy);
      const aT = Math.atan2(dy, dx) - Math.acos(rt / dd);
      sh.moveTo(0, -wp / 2 + cr);
      sh.quadraticCurveTo(0, -wp / 2, cr, -wp / 2);
      sh.lineTo(cx + rt * Math.cos(aT), -rt * Math.sin(aT));
      sh.absarc(cx, 0, rt, -aT, aT, false);
      sh.lineTo(cr, wp / 2);
      sh.quadraticCurveTo(0, wp / 2, 0, wp / 2 - cr);
      sh.closePath();
      const hole = new THREE.Path(); hole.absarc(cx, 0, 4.3 * MM * kk, 0, Math.PI * 2, true); sh.holes.push(hole);
      const pg = new THREE.ExtrudeGeometry(sh, { depth: tp, bevelEnabled: false, curveSegments: 4 });
      pg.translate(xp0 - 0.3 * MM, rB, -tp / 2);
      parts.push(pg);
      // hinge pin through the knuckles (heads show at both ends)
      parts.push(cylZ(kR * 0.5, W + 1.2 * MM, 8, 0, -(ro + kR * 0.35), 0));
      return merge(parts);
    });
    return { cast, hw };
  }
  function clamp(size, opts = {}) {
    const k = key(size), { cast, hw } = clampGeos(k);
    const g = new THREE.Group(); g.name = `tc-clamp-${k}`;
    // angle: roll about z; flip: clamp turned over (mirror side), so the nut hangs toward -x
    const r = new THREE.Group(); r.rotation.z = opts.angle || 0; g.add(r);
    const f = new THREE.Group(); if (opts.flip) f.rotation.y = Math.PI; r.add(f);
    f.add(new THREE.Mesh(cast, MAT.ssDull));
    f.add(new THREE.Mesh(hw, MAT.ss));
    return g;
  }

  // ------------------------------------------------------------------ joint
  // opts: lenA, lenB (ferrule lengths, m), angle (clamp roll about z), flip (clamp turned over),
  // cap (true: blank cap instead of ferrule B), openB (ferrule B bore visible), reduceA / reduceB (tube OD, m), gasket ('rim'
  // default: only the visible outer band; 'full'; false)
  function joint(size, opts = {}) {
    const k = key(size), s = sizes[k], h = s.gap / 2;
    const g = new THREE.Group(); g.name = `tc-joint-${k}`;
    const a = ferrule(k, { len: opts.lenA != null ? opts.lenA : s.len, reduce: opts.reduceA });
    a.position.z = -h; g.add(a);
    if (opts.gasket !== false) g.add(gasket(k, { rimOnly: opts.gasket !== 'full' }));
    if (opts.cap) {
      const c = cap(k); c.position.z = h; g.add(c);
    } else {
      const b = ferrule(k, { len: opts.lenB != null ? opts.lenB : s.len, open: !!opts.openB, reduce: opts.reduceB });
      b.position.z = h; b.rotation.y = Math.PI; g.add(b);
    }
    g.add(clamp(k, { angle: opts.angle || 0, flip: !!opts.flip }));
    return g;
  }

  // ------------------------------------------------------------------ placement / baking helpers
  // aim(obj, at, dir, up): local +z -> dir, local +y (clamp gap / lugs at angle 0) -> toward `up`
  // (projected perpendicular to dir); position at `at`. Without `up` it behaves like main.js aimed().
  const _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
  function aim(obj, at, dir, up) {
    _z.copy(dir).normalize();
    if (up) {
      _y.copy(up).addScaledVector(_z, -up.dot(_z));
      if (_y.lengthSq() < 1e-10) { if (Math.abs(_z.y) < 0.9) _y.set(0, 1, 0); else _y.set(1, 0, 0); _y.addScaledVector(_z, -_y.dot(_z)); }
      _y.normalize(); _x.crossVectors(_y, _z);
      _m.makeBasis(_x, _y, _z); obj.quaternion.setFromRotationMatrix(_m);
    } else {
      obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _z);
    }
    obj.position.copy(at);
    obj.updateMatrix();
    return obj;
  }
  // bake(obj): for models that merge geometry by material. Returns [{ material, geometry }] with
  // each mesh's transform relative to obj's parent applied (fresh, unshared clones).
  function bake(obj) {
    const parent = obj.parent; if (parent) parent.remove(obj);
    obj.updateMatrixWorld(true);
    const out = [];
    obj.traverse((o) => {
      if (!o.isMesh) return;
      const geometry = o.geometry.clone(); geometry.userData = {};
      geometry.applyMatrix4(o.matrixWorld);
      out.push({ material: o.material, geometry });
    });
    if (parent) parent.add(obj);
    return out;
  }

  return { sizes, ferrule, gasket, clamp, cap, joint, aim, bake, gasketMat };
}

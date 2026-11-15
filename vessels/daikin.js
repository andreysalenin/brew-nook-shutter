// Daikin RZQS125AV1 Sky Air outdoor unit (Australian Premium Inverter, 1 phase, 12.5 kW class, R410A).
// RZQS100/125/140AV1 share the tall two-fan casing: 1430 H x 940 W x 320 D, 108 kg (Daikin Australia
// ducted brochure). Same 940-wide casing family as the EU RZQG/RZQSG100-140L (1430x940x320, ivory white
// painted galvanised steel, 2 propeller fans, horizontal discharge, flare 9.52 liquid / 15.9 gas,
// 4 x M12 anchors at 620 x 345-355 mm).
// Layout modelled: two stacked fans blowing out of the FRONT (+z) behind black horizontal-bar grilles,
// fans offset to the left of the front panel; L-shaped heat exchanger on the rear and left side behind
// an ivory wire guard; solid right side with the L-shaped service cover at the front-right corner
// (handle recess, nameplate above it) and the stop valves (liquid + gas flare) in the piping recess at
// the bottom of the front-right corner; two foot rails with anchor slots; flat top plate.
// Origin bottom centre of the footprint, +y up, +z front, metres.
export const meta = {
  id: 'daikin',
  name: 'Daikin RZQS125AV1 Sky Air outdoor unit (12.5 kW, 1 phase)',
  dims: '1430 H × 940 W × 320 D mm casing (foot rails 410 deep), 108 kg; 2 × Ø~500 propeller fans; flare 9.5 liquid / 15.9 gas',
  color: 'Daikin ivory white (Munsell 5Y 7.5/1 ≈ #BEBCB1), black fan grilles',
  ports: {
    liquid: { pos: [0.335, 0.165, 0.1645], dir: [0, 0, 1], size: '3/8" flare (9.5 mm)' },
    gas: { pos: [0.405, 0.125, 0.1645], dir: [0, 0, 1], size: '5/8" flare (15.9 mm)' },
  },
};
export const defaultOptions = {};

const TAU = Math.PI * 2;

// ---------- dimensions (metres) ----------
const W = 0.94, D = 0.32, H = 1.43;
const XL = -W / 2, XR = W / 2, ZF = D / 2, ZB = -D / 2;
const FOOT_H = 0.045;              // foot rails
const FOOT_L = 0.41, FOOT_W = 0.075, FOOT_X = 0.31; // rails at the 620 mm anchor pitch
const SLOT_Z = 0.175;              // anchor slots (345-355 mm pitch)
const Y0 = FOOT_H;                 // casing bottom
const TOP_T = 0.016;               // top plate thickness incl. flange
const FAN_X = -0.055;              // fans offset left
const FAN_Y = [0.405, 1.065];      // fan centres
const R_OPEN = 0.282;              // front panel opening
const R_GR = 0.292;                // grille outer ring
const R_FAN = 0.248;               // blade tip
const COIL_T = 0.042;              // heat exchanger thickness
const SC = { z0: -0.005, y0: 0.235, y1: 0.78, xf: 0.40 }; // service cover (right side + front strip)
const PR = { x0: 0.285, x1: 0.452, y0: 0.07, y1: 0.225 }; // piping recess window (front, lower right)

// ---------- geometry helpers ----------
function mergeGeos(THREE, list) {
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
  out.userData.shared = true;
  return out;
}
const rrShape = (THREE, w, h, r, cx = 0, cy = 0) => {
  const s = new THREE.Shape(), x0 = cx - w / 2, y0 = cy - h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x0 + r, y0); s.lineTo(x0 + w - r, y0); s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
  s.lineTo(x0 + w, y0 + h - r); s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
  s.lineTo(x0 + r, y0 + h); s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
  s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
};

// ---------- textures ----------
function drawFins(g, w, h) {
  g.fillStyle = '#b4bbc0'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 2) { g.fillStyle = (x / 2) % 2 ? '#c8ced2' : '#7f878d'; g.fillRect(x, 0, 1, h); }
  // copper tube return bends showing through the fins (horizontal rows)
  g.fillStyle = 'rgba(60,64,70,0.35)';
  for (let y = 4; y < h; y += 16) g.fillRect(0, y, w, 3);
}
function drawLogo(g, w, h) {
  g.clearRect(0, 0, w, h);
  const blue = '#0b78c8';
  // the Daikin mark: a blue delta (triangle) with a lighter right flank
  const th = h * 0.82, tw = th * 1.12, x0 = h * 0.06, yb = h * 0.91;
  g.fillStyle = blue; g.beginPath(); g.moveTo(x0, yb); g.lineTo(x0 + tw, yb); g.lineTo(x0 + tw * 0.5, yb - th); g.closePath(); g.fill();
  g.fillStyle = '#5ec8f2'; g.beginPath(); g.moveTo(x0 + tw * 0.56, yb - th * 0.88); g.lineTo(x0 + tw, yb); g.lineTo(x0 + tw * 0.66, yb); g.closePath(); g.fill();
  g.fillStyle = blue; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  g.font = `italic 900 ${Math.round(h * 0.92)}px "Arial Black", Arial, Helvetica, sans-serif`;
  g.save(); g.translate(x0 + tw + h * 0.18, yb); g.scale(1.06, 1); g.fillText('DAIKIN', 0, 0); g.restore();
}
function drawPlate(g, w, h) {
  g.fillStyle = '#d4d6d8'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#6b6e72'; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8);
  g.fillStyle = '#0a83c9'; g.font = `italic 900 ${Math.round(h * 0.1)}px Arial, sans-serif`; g.fillText('DAIKIN', 14, h * 0.15);
  g.fillStyle = '#222'; g.font = `700 ${Math.round(h * 0.075)}px Arial, sans-serif`;
  g.fillText('DAIKIN INDUSTRIES, LTD.', w * 0.42, h * 0.14);
  const rows = [['MODEL', 'RZQS125AV1'], ['POWER SUPPLY', '1~ 50Hz 220-240V'], ['REFRIGERANT', 'R410A   3.4 kg'], ['RATED CAP. (C/H)', '12.5 / 14.0 kW'], ['PS HIGH / LOW', '4.0 / 1.6 MPa'], ['WEIGHT', '108 kg'], ['SERIAL No.', 'E000125']];
  g.font = `${Math.round(h * 0.068)}px Arial, sans-serif`;
  rows.forEach(([a, b], k) => {
    const y = h * (0.28 + k * 0.1);
    g.fillStyle = '#333'; g.fillText(a, 14, y); g.fillStyle = '#111'; g.font = `700 ${Math.round(h * 0.068)}px Arial, sans-serif`; g.fillText(b, w * 0.46, y); g.font = `${Math.round(h * 0.068)}px Arial, sans-serif`;
    g.fillStyle = '#9a9da0'; g.fillRect(14, y + h * 0.02, w - 28, 1);
  });
}
function drawWarn(g, w, h) {
  g.fillStyle = '#f2f0e6'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#f4c400'; g.beginPath(); g.moveTo(w * 0.15, h * 0.8); g.lineTo(w * 0.28, h * 0.2); g.lineTo(w * 0.41, h * 0.8); g.closePath(); g.fill();
  g.strokeStyle = '#111'; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#111'; g.font = `900 ${Math.round(h * 0.4)}px Arial`; g.textAlign = 'center'; g.fillText('!', w * 0.28, h * 0.74);
  g.textAlign = 'left'; g.font = `700 ${Math.round(h * 0.16)}px Arial`; g.fillText('CAUTION', w * 0.47, h * 0.38);
  g.font = `${Math.round(h * 0.11)}px Arial`; g.fillText('Disconnect power', w * 0.47, h * 0.56); g.fillText('before servicing', w * 0.47, h * 0.7);
}

// ---------- cache ----------
let CACHE = null;
function cache(THREE, ctx) {
  if (CACHE && CACHE.THREE === THREE) return CACHE;
  const S = (p) => new THREE.MeshStandardMaterial(p);
  const fins = ctx.labelTex(256, 64, drawFins);
  fins.wrapS = fins.wrapT = THREE.RepeatWrapping;
  const mat = {
    body: S({ color: 0xbebcb1, roughness: 0.42, metalness: 0.05 }),          // ivory white 5Y7.5/1
    bodyIn: S({ color: 0x6e6d68, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide }),
    grille: S({ color: 0x1b1c1e, roughness: 0.55, metalness: 0.05 }),
    fan: S({ color: 0x2a2c2f, roughness: 0.6, metalness: 0.0, side: THREE.DoubleSide }),
    fins: S({ color: 0xffffff, map: fins, roughness: 0.5, metalness: 0.3 }),
    coilEdge: S({ color: 0x55595d, roughness: 0.6, metalness: 0.4 }),
    brass: S({ color: 0xc9a25a, roughness: 0.35, metalness: 1.0 }),
    galv: S({ color: 0x9da2a6, roughness: 0.45, metalness: 0.8 }),
  };
  CACHE = { THREE, mat, tex: { logo: ctx.labelTex(1024, 160, drawLogo), plate: ctx.labelTex(512, 340, drawPlate), warn: ctx.labelTex(256, 96, drawWarn) } };
  return CACHE;
}

// ---------- build ----------
export function build(THREE, ctx, opts = {}) {
  const { mat, tex } = cache(THREE, ctx);
  const M = ctx.MAT;
  const bins = new Map();
  const put = (m, g) => { if (!bins.has(m)) bins.set(m, []); bins.get(m).push(g); };
  const box = (m, x0, x1, y0, y1, z0, z1) => {
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); put(m, g); return g;
  };
  const xform = (g, { rx = 0, ry = 0, rz = 0, at = [0, 0, 0] } = {}) => {
    if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz); g.translate(...at); return g;
  };
  const shapeOn = (m, shape, opts2) => put(m, xform(new THREE.ShapeGeometry(shape, 6), opts2));
  const cyl = (m, r0, r1, len, segs, opts2) => put(m, xform(new THREE.CylinderGeometry(r0, r1, len, segs), opts2));

  const out = new THREE.Group();
  out.name = 'daikin';

  // ===== base: two foot rails (U channel look) + bottom pan =====
  for (const sx of [-1, 1]) {
    const x = sx * FOOT_X;
    box(mat.body, x - FOOT_W / 2, x + FOOT_W / 2, 0.0, 0.004, -FOOT_L / 2, FOOT_L / 2);           // foot flange
    box(mat.body, x - FOOT_W / 2 + 0.012, x + FOOT_W / 2 - 0.012, 0.004, FOOT_H, -FOOT_L / 2 + 0.02, FOOT_L / 2 - 0.02); // web
    for (const sz of [-1, 1]) {
      // end lugs carrying the elongated anchor slots
      const z0 = sz * (FOOT_L / 2), zc = sz * SLOT_Z;
      shapeOn(M.hole, rrShape(THREE, 0.016, 0.034, 0.008), { rx: -Math.PI / 2, at: [x, 0.0042, zc] });
      box(mat.body, x - FOOT_W / 2, x + FOOT_W / 2, 0.004, 0.02, z0 - sz * 0.006, z0); // end turn-up
    }
  }
  box(mat.galv, XL + 0.01, XR - 0.01, FOOT_H - 0.004, Y0 + 0.012, ZB + 0.01, ZF - 0.01); // bottom pan
  // drain holes visible on the pan edge are hidden; skip

  // ===== casing shell =====
  const core = [];
  const bodyPut = (g) => core.push(g);
  // front panel with two fan openings and the piping recess window
  {
    const s = new THREE.Shape();
    const x0 = XL + 0.008, x1 = XR - 0.008, y0 = Y0, y1 = H - TOP_T;
    s.moveTo(x0, y0); s.lineTo(PR.x0, y0); s.lineTo(PR.x0, PR.y1 - 0.012); s.quadraticCurveTo(PR.x0, PR.y1, PR.x0 + 0.012, PR.y1);
    s.lineTo(x1, PR.y1); s.lineTo(x1, y1); s.lineTo(x0, y1); s.lineTo(x0, y0);
    for (const fy of FAN_Y) { const hpath = new THREE.Path(); hpath.absarc(FAN_X, fy, R_OPEN, 0, TAU, true); s.holes.push(hpath); }
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.0012, bevelEnabled: false, curveSegments: 40 });
    g.translate(0, 0, ZF - 0.0012); bodyPut(g);
  }
  // rounded vertical front corners (r 8 mm) and rear-right corner
  const corner = (cx, cz, a0, y0 = Y0, y1 = H - TOP_T) => {
    const g = new THREE.CylinderGeometry(0.008, 0.008, y1 - y0, 6, 1, true, a0, Math.PI / 2);
    g.translate(cx, (y0 + y1) / 2, cz); bodyPut(g);
  };
  corner(XR - 0.008, ZF - 0.008, Math.PI / 2 - Math.PI / 2, PR.y1);   // front right (above recess)
  corner(XL + 0.008, ZF - 0.008, -Math.PI / 2);                       // front left
  corner(XR - 0.008, ZB + 0.008, Math.PI / 2);                        // rear right
  // right side panel (solid), split around the service cover
  box(mat.body, XR - 0.0012, XR, Y0, H - TOP_T, ZB + 0.008, ZF - 0.008); // full side sheet (cover sits proud of it)
  // left front pillar (solid strip in front of the coil) and left rear post
  box(mat.body, XL, XL + 0.0012, Y0, H - TOP_T, ZF - COIL_T - 0.05, ZF - 0.008);
  box(mat.body, XL, XL + 0.02, Y0, H - TOP_T, ZB, ZB + 0.02);
  // rear: right compressor-compartment sheet, coil elsewhere
  box(mat.body, 0.30, XR - 0.008, Y0, H - TOP_T, ZB, ZB + 0.0012);
  // bottom and top rails of the coil faces
  box(mat.body, XL, 0.30, Y0, Y0 + 0.03, ZB, ZB + 0.0012);
  box(mat.body, XL, XL + 0.0012, Y0, Y0 + 0.03, ZB, ZF - 0.05);
  box(mat.body, XL, 0.30, H - TOP_T - 0.02, H - TOP_T, ZB, ZB + 0.0012);
  box(mat.body, XL, XL + 0.0012, H - TOP_T - 0.02, H - TOP_T, ZB, ZF - 0.05);
  // top plate with turned-down flange and slightly rounded edge
  {
    const s = rrShape(THREE, W - 0.004, D - 0.004, 0.01);
    const g = new THREE.ExtrudeGeometry(s, { depth: TOP_T - 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 4 });
    g.rotateX(-Math.PI / 2); g.translate(0, H - TOP_T + 0.002, 0);
    // after rotateX(-pi/2) the shape's y maps to -z; shape is symmetric so fine
    bodyPut(g);
  }
  for (const g of core) put('core', g);

  // inner bell mouths (venturi) behind each opening + dark fan chamber
  for (const fy of FAN_Y) {
    const pts = [];
    for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push(new THREE.Vector2(R_OPEN - 0.028 * Math.sin(t * Math.PI / 2), -t * 0.075)); }
    const g = new THREE.LatheGeometry(pts, 48);
    g.rotateX(Math.PI / 2); g.translate(FAN_X, fy, ZF - 0.0012); put(mat.bodyIn, g);
    // back of the chamber (the coil's inner face, dark)
    const d = new THREE.CircleGeometry(R_OPEN + 0.01, 40); d.translate(FAN_X, fy, ZB + COIL_T + 0.004); put(M.hole, d);
    // motor + bracket (two vertical straps from the bell mouth support)
    cyl(mat.grille, 0.065, 0.065, 0.07, 24, { rx: Math.PI / 2, at: [FAN_X, fy, -0.03] });
    box(mat.fan, FAN_X - 0.012, FAN_X + 0.012, fy - R_OPEN + 0.02, fy + R_OPEN - 0.02, -0.075, -0.068);
  }
  // chamber side walls so the openings do not look into nothing
  box(M.hole, XL + 0.02, 0.29, Y0 + 0.012, H - TOP_T - 0.002, ZB + COIL_T + 0.003, ZB + COIL_T + 0.0035);

  // ===== heat exchanger (L-shaped: rear + left side) with ivory wire guard =====
  {
    const yA = Y0 + 0.03, yB = H - TOP_T - 0.02;
    // rear face
    const rw = 0.30 - (XL + 0.02), rh = yB - yA;
    const gr = new THREE.PlaneGeometry(rw, rh); gr.rotateY(Math.PI); gr.translate((XL + 0.02 + 0.30) / 2, (yA + yB) / 2, ZB + 0.004);
    const uv = gr.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * rw * 6, uv.getY(k) * rh * 6);
    put(mat.fins, gr);
    // left face
    const lw = (ZF - 0.05) - (ZB + 0.02);
    const gl = new THREE.PlaneGeometry(lw, rh); gl.rotateY(-Math.PI / 2); gl.translate(XL + 0.004, (yA + yB) / 2, (ZF - 0.05 + ZB + 0.02) / 2);
    const uv2 = gl.attributes.uv; for (let k = 0; k < uv2.count; k++) uv2.setXY(k, uv2.getX(k) * lw * 6, uv2.getY(k) * rh * 6);
    put(mat.fins, gl);
    // coil end plates / inner faces
    box(mat.coilEdge, XL + 0.004, 0.30, yA, yB, ZB + 0.004, ZB + COIL_T);
    box(mat.coilEdge, XL + 0.004, XL + COIL_T, yA, yB, ZB + COIL_T, ZF - 0.05);
    // wire guard: horizontal wires + vertical stays (rear and left)
    const wr = 0.0012;
    for (let y = yA + 0.025; y < yB - 0.01; y += 0.05) {
      box(mat.body, XL + 0.02, 0.30, y - wr, y + wr, ZB - 0.0005, ZB + 0.0027);
      box(mat.body, XL - 0.0005, XL + 0.0027, y - wr, y + wr, ZB + 0.02, ZF - 0.05);
    }
    for (let x = XL + 0.12; x < 0.29; x += 0.13) box(mat.body, x - 0.003, x + 0.003, yA, yB, ZB - 0.0012, ZB + 0.003);
    for (const z of [-0.06, 0.04]) box(mat.body, XL - 0.0012, XL + 0.003, yA, yB, z - 0.003, z + 0.003);
  }

  // ===== fans (3-blade swept propellers) =====
  for (const fy of FAN_Y) {
    const hubR = 0.072, zc = ZF - 0.07;
    const hub = new THREE.CylinderGeometry(hubR * 0.86, hubR, 0.06, 32); hub.rotateX(Math.PI / 2); hub.translate(FAN_X, fy, zc); put(mat.fan, hub);
    const cap = new THREE.SphereGeometry(hubR * 0.86, 24, 6, 0, TAU, 0, Math.PI / 2 * 0.55); cap.rotateX(Math.PI / 2); cap.scale(1, 1, 0.35); cap.translate(FAN_X, fy, zc + 0.03); put(mat.fan, cap);
    for (let b = 0; b < 3; b++) {
      const nu = 10, nv = 8, pos = [], idx = [];
      for (let i = 0; i <= nu; i++) {
        const u = i / nu, r = hubR * 0.95 + u * (R_FAN - hubR * 0.95);
        const chord = 0.95 - 0.25 * u;            // angular chord (rad)
        const sweep = 0.55 * u * u;               // forward sweep of the blade
        for (let j = 0; j <= nv; j++) {
          const v = j / nv, th = b * TAU / 3 + sweep + (v - 0.5) * chord;
          const z = zc + (v - 0.5) * (0.07 - 0.03 * u) + 0.01 * Math.sin(v * Math.PI);
          pos.push(FAN_X + r * Math.cos(th), fy + r * Math.sin(th), z);
        }
      }
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, c = a + nv + 1; idx.push(a, c, a + 1, c, c + 1, a + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      put(mat.fan, g);
    }
  }

  // ===== front grilles: black ring + horizontal bars + vertical ribs + centre boss =====
  for (const fy of FAN_Y) {
    const zg = ZF + 0.004;
    const ring = new THREE.TorusGeometry(R_GR - 0.007, 0.0075, 6, 64); ring.scale(1, 1, 0.9); ring.translate(FAN_X, fy, zg); put(mat.grille, ring);
    const flange = new THREE.RingGeometry(R_OPEN - 0.004, R_GR, 64); flange.translate(FAN_X, fy, ZF + 0.0006); put(mat.grille, flange);
    const pitch = 0.0145, rIn = R_GR - 0.012;
    for (let dy = -rIn + pitch * 0.6; dy < rIn; dy += pitch) {
      const hl = Math.sqrt(rIn * rIn - dy * dy);
      box(mat.grille, FAN_X - hl, FAN_X + hl, fy + dy - 0.0015, fy + dy + 0.0015, zg - 0.006, zg + 0.003);
    }
    for (const dx of [-0.105, 0.105]) {
      const hl = Math.sqrt(rIn * rIn - dx * dx);
      box(mat.grille, FAN_X + dx - 0.003, FAN_X + dx + 0.003, fy - hl, fy + hl, zg - 0.008, zg + 0.0045);
    }
    box(mat.grille, FAN_X - rIn, FAN_X + rIn, fy - 0.003, fy + 0.003, zg - 0.008, zg + 0.0045);
    const boss = new THREE.CylinderGeometry(0.05, 0.052, 0.012, 32); boss.rotateX(Math.PI / 2); boss.translate(FAN_X, fy, zg); put(mat.grille, boss);
    // fixing lugs at 4 points on the ring
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + k * Math.PI / 2, x = FAN_X + Math.cos(a) * (R_GR + 0.006), y = fy + Math.sin(a) * (R_GR + 0.006);
      cyl(mat.grille, 0.011, 0.011, 0.006, 12, { rx: Math.PI / 2, at: [x, y, ZF + 0.003] });
      cyl(M.ssDull, 0.004, 0.004, 0.003, 8, { rx: Math.PI / 2, at: [x, y, ZF + 0.0072] });
    }
  }

  // ===== service cover (L-shaped, front-right corner) =====
  {
    const t = 0.0015, r = 0.008;
    box(mat.body, XR, XR + t, SC.y0, SC.y1, SC.z0, ZF - r);                 // side leaf
    box(mat.body, SC.xf, XR - r, SC.y0, SC.y1, ZF, ZF + t);                 // front leaf
    const g = new THREE.CylinderGeometry(r + t, r + t, SC.y1 - SC.y0, 6, 1, false, 0, Math.PI / 2);
    g.translate(XR - r, (SC.y0 + SC.y1) / 2, ZF - r); put(mat.body, g);
    // seam shadows around the cover
    box(M.hole, XR - 0.0002, XR + 0.0005, SC.y0 - 0.003, SC.y0, SC.z0, ZF - 0.006);
    box(M.hole, XR - 0.0002, XR + 0.0005, SC.y1, SC.y1 + 0.003, SC.z0, ZF - 0.006);
    box(M.hole, XR - 0.0002, XR + 0.0005, SC.y0, SC.y1, SC.z0 - 0.003, SC.z0);
    box(M.hole, SC.xf - 0.003, SC.xf, SC.y0, SC.y1, ZF - 0.0002, ZF + 0.0005);
    box(M.hole, SC.xf, XR - 0.006, SC.y0 - 0.003, SC.y0, ZF - 0.0002, ZF + 0.0005);
    box(M.hole, SC.xf, XR - 0.006, SC.y1, SC.y1 + 0.003, ZF - 0.0002, ZF + 0.0005);
    // handle recess in the cover (side) + fixing screw
    shapeOn(M.hole, rrShape(THREE, 0.13, 0.034, 0.016), { ry: Math.PI / 2, at: [XR + t + 0.0004, SC.y1 - 0.065, (SC.z0 + ZF) / 2] });
    shapeOn(mat.bodyIn, rrShape(THREE, 0.12, 0.012, 0.006), { ry: Math.PI / 2, at: [XR + t + 0.0007, SC.y1 - 0.074, (SC.z0 + ZF) / 2] });
    cyl(M.ssDull, 0.005, 0.005, 0.003, 10, { rz: Math.PI / 2, at: [XR + t + 0.0015, SC.y0 + 0.03, SC.z0 + 0.03] });
    cyl(M.ssDull, 0.005, 0.005, 0.003, 10, { rx: Math.PI / 2, at: [(SC.xf + XR) / 2, SC.y1 - 0.03, ZF + t + 0.0015] });
  }
  // second handle recess, upper rear of the right side
  shapeOn(M.hole, rrShape(THREE, 0.12, 0.032, 0.016), { ry: Math.PI / 2, at: [XR + 0.0004, 1.0, -0.085] });
  shapeOn(mat.bodyIn, rrShape(THREE, 0.11, 0.011, 0.005), { ry: Math.PI / 2, at: [XR + 0.0007, 0.991, -0.085] });
  // front lower-left grip recess
  shapeOn(M.hole, rrShape(THREE, 0.06, 0.03, 0.015), { ry: -Math.PI / 2, at: [XL - 0.0004, 0.62, ZF - 0.042] });

  // ===== piping recess with liquid + gas stop valves =====
  {
    const back = ZF - 0.09;
    box(mat.bodyIn, PR.x0, XR - 0.002, PR.y0 - 0.025, PR.y0, back, ZF);        // recess floor (pipe intake plate)
    box(mat.bodyIn, PR.x0, PR.x0 + 0.0012, PR.y0, PR.y1, back, ZF);             // recess left wall
    box(mat.bodyIn, PR.x0, XR - 0.002, PR.y1, PR.y1 + 0.0012, back, ZF);        // ceiling
    box(M.hole, PR.x0, XR - 0.002, PR.y0, PR.y1, back, back + 0.001);           // back
    box(mat.body, XR - 0.0012, XR, Y0, PR.y1, ZB + 0.008, ZF - 0.004);           // side sheet below the cover
    box(mat.body, XR - 0.03, XR, Y0, PR.y0 - 0.025, ZF - 0.0012, ZF);           // front lip under the recess
    // valve mounting plate
    box(mat.galv, PR.x0 + 0.01, XR - 0.012, PR.y0 + 0.01, PR.y1 - 0.01, back + 0.001, back + 0.004);
    const valve = (x, y, rPipe, nutAF) => {
      // body block, stem cap (top), service port (side), flare nut on the front
      box(mat.brass, x - 0.018, x + 0.018, y - 0.02, y + 0.02, back + 0.004, back + 0.05);
      cyl(mat.brass, 0.011, 0.011, 0.028, 16, { at: [x, y + 0.034, back + 0.027] });
      cyl(M.black, 0.0125, 0.0125, 0.012, 6, { at: [x, y + 0.052, back + 0.027] });
      cyl(mat.brass, 0.006, 0.006, 0.02, 12, { rz: Math.PI / 2, at: [x - 0.028, y, back + 0.03] });
      cyl(M.black, 0.0075, 0.0075, 0.01, 6, { rz: Math.PI / 2, at: [x - 0.041, y, back + 0.03] });
      cyl(mat.brass, rPipe + 0.003, rPipe + 0.003, 0.02, 16, { rx: Math.PI / 2, at: [x, y, back + 0.06] });
      cyl(mat.brass, nutAF / 2 / Math.cos(Math.PI / 6), nutAF / 2 / Math.cos(Math.PI / 6), 0.024, 6, { rx: Math.PI / 2, at: [x, y, back + 0.082] });
      cyl(M.hole, rPipe * 0.8, rPipe * 0.8, 0.001, 12, { rx: Math.PI / 2, at: [x, y, back + 0.0945] });
    };
    valve(meta.ports.liquid.pos[0], meta.ports.liquid.pos[1], 0.00476, 0.022);
    valve(meta.ports.gas.pos[0], meta.ports.gas.pos[1], 0.00795, 0.029);
  }

  // ===== panel seams on the front (top strip / right strip joints) =====
  box(M.hole, XL + 0.01, XR - 0.01, H - TOP_T - 0.001, H - TOP_T, ZF - 0.0003, ZF + 0.0003);

  // ===== assemble meshes =====
  for (const [m, list] of bins) {
    const mesh = new THREE.Mesh(mergeGeos(THREE, list), m === 'core' ? mat.body : m);
    if (m === 'core') { ctx.core(mesh); mesh.name = 'casing'; }
    out.add(mesh);
  }

  // ===== decals: DAIKIN logo (front, top left), nameplate + caution label (right side) =====
  const logo = ctx.decal(tex.logo, 0.23, 0.036); logo.position.set(XL + 0.145, H - TOP_T - 0.036, ZF + 0.0006); out.add(logo);
  const plate = ctx.decal(tex.plate, 0.15, 0.10); plate.rotation.y = Math.PI / 2; plate.position.set(XR + 0.0006, 0.93, 0.06); out.add(plate);
  const warn = ctx.decal(tex.warn, 0.09, 0.034); warn.rotation.y = Math.PI / 2; warn.position.set(XR + 0.0022, SC.y0 + 0.08, (SC.z0 + ZF) / 2); out.add(warn);

  out.userData.ports = meta.ports;
  return out;
}

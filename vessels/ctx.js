import { createTriClamp } from './triclamp.js';

// Shared context for vessel modules. main.js passes an object with the SAME shape and names,
// built from its own materials, so a module that works here works in the app unchanged.
export function makeCtx(THREE) {
  const S = (p) => new THREE.MeshStandardMaterial(p);
  const labelTex = (w, h, draw) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.clearRect(0, 0, w, h); draw(g, w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  };
  const perf = labelTex(128, 128, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#000'; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { g.beginPath(); g.arc(c * 32 + 16 + (r % 2) * 16, r * 32 + 16, 9, 0, Math.PI * 2); g.fill(); } });
  perf.colorSpace = THREE.NoColorSpace; perf.wrapS = perf.wrapT = THREE.RepeatWrapping; perf.repeat.set(3, 3);
  const dial = labelTex(128, 128, (g) => { g.fillStyle = '#f6f6f2'; g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 2; for (let i = 0; i <= 20; i++) { const a = (-225 + i * 13.5) * Math.PI / 180; g.beginPath(); g.moveTo(64 + Math.cos(a) * 50, 64 + Math.sin(a) * 50); g.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58); g.stroke(); } g.strokeStyle = '#c62828'; g.lineWidth = 3; g.beginPath(); g.moveTo(64, 64); g.lineTo(86, 26); g.stroke(); });
  const MAT = {
    ss: S({ color: 0xdadde0, roughness: 0.24, metalness: 1.0 }),            // polished 304 stainless
    ssDouble: S({ color: 0xd4d7da, roughness: 0.3, metalness: 1.0, side: THREE.DoubleSide }),
    ssDull: S({ color: 0xbfc2c5, roughness: 0.45, metalness: 0.9 }),        // brushed / satin stainless
    alu: S({ color: 0xc6c9cc, roughness: 0.35, metalness: 0.9 }),
    neoprene: S({ color: 0x1c1b22, roughness: 0.95, metalness: 0 }),        // Ss jacket
    black: S({ color: 0x151517, roughness: 0.55, metalness: 0.1 }),         // black plastic
    rubber: S({ color: 0x101011, roughness: 0.92, metalness: 0 }),
    rubberDouble: S({ color: 0x121213, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }),
    clear: S({ color: 0xe8f0f2, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.45 }), // sight glass / clear tube
    blueHandle: S({ color: 0x2f6fe0, roughness: 0.5, metalness: 0 }),
    red: S({ color: 0xc8302a, roughness: 0.5, metalness: 0 }),
    green: S({ color: 0x2a9a4c, roughness: 0.5, metalness: 0 }),
    yellow: S({ color: 0xe7c22b, roughness: 0.5, metalness: 0 }),
    pvc: S({ color: 0xf2f2f0, roughness: 0.6, metalness: 0 }),
    wheel: S({ color: 0x585c61, roughness: 0.6, metalness: 0.1 }),
    seam: S({ color: 0x2c2b33, roughness: 0.9, metalness: 0 }),
    hole: S({ color: 0x0a0a0a, roughness: 1, metalness: 0 }),
    perf: S({ color: 0xd6d9dc, roughness: 0.35, metalness: 0.95, alphaMap: perf, alphaTest: 0.5, side: THREE.DoubleSide }),
    dialFace: new THREE.MeshBasicMaterial({ map: dial }),
  };
  const core = (m) => { m.userData.core = true; return m; };
  const decal = (tex, w, h) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.userData.ownMat = true; return m;
  };
  const tc = createTriClamp(THREE, MAT); // shared tri-clamp fittings (see README: ctx.tc)
  return { MAT, labelTex, core, decal, tc };
}

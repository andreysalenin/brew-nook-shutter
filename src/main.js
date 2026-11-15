import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* =====================================================================
   Constants and product data
   ===================================================================== */
const STORE_KEY = 'brew-nook-shutter-v1';

// Vessel models built by the per-vessel modules in vessels/*.js (inlined at build time).
const VESSEL_MODULES = {};
/*__VESSELS__*/
const PI = Math.PI;
const mm = (v) => v / 1000;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rad = (d) => (d * PI) / 180;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Rack It (Bunnings / Visy), metres. Published: upright heights and frame depths (outside to outside), face width
// (400 kg "530W x 2136H x 45D", 1000 kg "645W x 1830H x 63D"), beam lengths over the end plates (1541, 1264),
// beam heights (50, 68), usable widths/depths, braces per shelf (4, 3), double-slotted uprights.
// Measured from the photos: slot pitch (3", 28 slots in the 2136 upright, 24 in the 1830), slot shape and columns,
// first slot height, end-plate size, hook spacing and where the top of the beam sits against its slots.
// Uprights are welded end frames of two roll-formed C posts. Each post's slotted face (`post` wide, in the front or
// back plane) has two columns of tapered slots, so the beams of two neighbouring bays can share a post: this bay
// hooks into the column on its own side and leaves the outer column free.
// Slots are numbered from the floor, slot 1 lowest. A beam's end plate has two hooks one pitch apart, so a shelf
// "at slot n" hangs in slots n−1 and n: slot 2 is the lowest shelf and `slots` the highest.
const RACK_SPECS = {
  r400: {
    key: 'green', title: 'Rack It 400 kg', size: '1541 beams · 1590 wide · 530 deep · 2136 high',
    usable: 1500, overall: 1.590, depth: 0.530, height: 2.136,
    // upright: slotted face, side flange (end-frame plane), inner return, steel (side/return/steel assumed)
    post: 0.045, side: 0.040, ret: 0.018, postT: 0.0016,
    // slots: pitch, top of slot 1 above the foot, slots per column, height, width at top and at the tip,
    // distance from the face's outer edge to the straight edge of the outer column (the other column mirrors it)
    pitch: 0.0762, slot1: 0.074, slots: 28, slotH: 0.028, slotW: 0.011, slotTip: 0.003, slotEdge: 0.016,
    // beam: height, depth (assumed), step riser from the frame face (15 = (530 − 500) / 2), step = deck thickness
    beamH: 0.050, beamD: 0.040, lip: 0.015, deckT: 0.015,
    // end plate: thickness, width on the post (= (1541 − 1500) / 2), height; plate top and top of beam relative to
    // the top of slot n; hook centres and the two round holes below the top of slot n
    plateT: 0.002, plateW: 0.0205, plateH: 0.109, plateTop: -0.001, beamTop: -0.008, hookY: 0.022, holeY: [0.047, 0.084],
    braces: 4, braceW: 0.030, braceH: 0.018,
    // ladder end frame (no diagonals): rung centre heights; only the one at ~1.5 m shows in the photos (10 mm bar)
    frame: { rungs: [0.10, 0.80, 1.50, 2.07], diag: [], bar: 0.010 },
  },
  r1000: {
    key: 'blue', title: 'Rack It 1000 kg', size: '1264 beams · 1330 wide · 645 deep · 1830 high',
    usable: 1200, overall: 1.330, depth: 0.645, height: 1.830,
    post: 0.063, side: 0.045, ret: 0.025, postT: 0.002,
    pitch: 0.0762, slot1: 0.064, slots: 24, slotH: 0.039, slotW: 0.014, slotTip: 0.004, slotEdge: 0.024,
    beamH: 0.068, beamD: 0.048, lip: 0.0225, deckT: 0.015,
    plateT: 0.0025, plateW: 0.030, plateH: 0.122, plateTop: 0.0094, beamTop: 0.0094, hookY: 0.025, holeY: [0.060, 0.077],
    braces: 3, braceW: 0.035, braceH: 0.025,
    // welded end frame, as in the photos: top rung flush with the post tops, bottom rung, and one diagonal from the
    // aisle post at 265 up to the wall post at 1120 (nothing else crosses the frame above it). `diag` is a zig-zag
    // chain of nodes [post, centre-line height], post 1 = aisle (front), 0 = wall (back): each diagonal starts at the
    // node where the previous one ended. 20 mm bars (measured)
    frame: { rungs: [0.16, 1.82], diag: [[1, 0.265], [0, 1.12]], bar: 0.020 },
  },
};
const RACK_KEYS = { green: 'r400', blue: 'r1000' };
const RACK_NAMES = { green: '400 kg rack', blue: '1000 kg rack' };
const innerW = (spec) => spec.overall - 2 * spec.post;
const ACACIA_T = 0.02;
const rackSpec = (key) => RACK_SPECS[RACK_KEYS[key]];
// Top of slot n above the foot of the upright, and the top of the beam (= top of an MDF or wire deck) for a shelf at slot n
const slotTopY = (spec, n) => spec.slot1 + (n - 1) * spec.pitch;
const levelY = (spec, n) => slotTopY(spec, n) + spec.beamTop;
const levelMM = (spec, n) => Math.round(levelY(spec, n) * 1000);
// Nearest valid shelf slot for a top-of-beam height in mm
const slotFor = (spec, hmm) => clamp(Math.round((hmm / 1000 - spec.beamTop - spec.slot1) / spec.pitch) + 1, 2, spec.slots);
// Where things stand on a shelf: an acacia board is thicker than the step, so it stands proud of the beam
const deckTopY = (spec, lv) => levelY(spec, lv.slot) + (lv.deck === 'acacia' ? ACACIA_T - spec.deckT : 0);

// Aluminium roller shutter curtains. t = slat thickness, kg = curtain mass per m².
// From the brochures: guide w = across the opening, d = front to back; boxes = [pelmet, max shutter height].
// Ozroll doesn't list slat thickness, guide size or pelmet heights in its sheet: those are estimates (est).
const SLATS = {
  oz40: { label: 'Ozroll Rollashield 40 mm curved (AR400)', short: 'Ozroll 40', pitch: 0.040, t: 0.009, kg: 4.0, guide: { w: 0.053, d: 0.022 }, est: true, maxArea: 8, manual: 'strap winder or spring assist' },
  cw42: { label: 'CW Products 42 mm double line', short: 'CW 42', pitch: 0.042, t: 0.0085, kg: 3.2, guide: { w: 0.053, d: 0.022 }, boxes: [[0.150, 1.3], [0.165, 1.7], [0.180, 2.2], [0.205, 2.6]], maxArea: 8, manual: 'spring loaded with key lock, or strap/cord winder up to 20 kg' },
  cw55: { label: 'CW Products 55 mm widespan', short: 'CW 55', pitch: 0.055, t: 0.012, kg: 4.0, guide: { w: 0.068, d: 0.025 }, boxes: [[0.180, 1.85], [0.205, 2.4], [0.230, 3.0]], maxArea: 10, manual: 'spring loaded with key lock, or steel cable winder up to 50 kg' },
  cw77: { label: 'CW Products 77 mm widespan', short: 'CW 77', pitch: 0.077, t: 0.0185, kg: 5.0, guide: { w: 0.105, d: 0.037 }, boxes: [[0.250, 2.0], [0.300, 3.0]], inclBox: true, maxArea: 15, manual: null },
};
const BOX_SIZES = [0.150, 0.165, 0.180, 0.205, 0.230, 0.250, 0.300];
function headboxFor(drop, slat) {
  if (slat.boxes) {
    const hit = slat.boxes.find(([b, h]) => (slat.inclBox ? drop + b : drop) <= h + 1e-6);
    return (hit || slat.boxes[slat.boxes.length - 1])[0];
  }
  const roll = Math.sqrt(0.07 ** 2 + (4 * slat.t * Math.max(drop, 0.5)) / PI) + 0.02;
  return BOX_SIZES.find((b) => b >= roll) ?? 0.3;
}

const MOUNTS = {
  wall: {
    letter: 'A', name: 'Posts, slab and ceiling fixed', short: 'slab + ceiling',
    blurb: 'Headbox under the ceiling, inside the roof line, so the motor stays dry. Both guides fix to 75 × 75 stainless posts that stand on base plates anchored to the slab and are cleated up into the ceiling framing, so nothing is drilled into either wall. The left post sits in the corner against the white wall step; the right post carries the dump hose pass-through. The shutter itself is completely standard.',
    pros: ['No fixings into the shared wall or the brick', 'Two matching stainless posts; the shutter company bolts to two flat faces'],
    cons: ['The four ceiling screws need solid framing above the plasterboard (add blocking if needed)', 'Base tabs sit on the wet slab: bed them on sealant'],
  },
  portal: {
    letter: 'B', name: 'Free-standing portal frame', short: 'portal frame',
    blurb: 'Two 75 × 75 posts with a header across the top, headbox under the header inside the roof line. The left post stands on a raised levelling base and is tied back through the weatherboard into the brick; the right post is the stainless dump jamb, anchored to the brick.',
    pros: ['Works even if you never find a stud or joist', 'Square and plumb regardless of the walls; easy to remove later'],
    cons: ['Base plates sit on the wet slab (lifted 50 mm so water runs under)', 'Loses about 220 mm of width and 50 mm of height'],
  },
  face: {
    letter: 'C', name: 'Posts, face-fixed frames, headbox outside', short: 'posts + outside box',
    blurb: 'One inverted-U stainless frame just inside the opening: a 50 × 50 SHS leg on the left, just clear of the white wall step, a 100 × 50 RHS leg against the brick on the right and a 50 × 25 RHS top beam, with three S-bent tabs screwed up into the ceiling joists. The legs are anchored to the slab. The shutter\'s side frames screw onto the posts\' outside faces, overlapping them by 30 mm, and the headbox sits on top of the frames above the opening, in front of the roof line, held only at its flush sides: each end cap is screwed through the side frame into the post, with no clips to the wall. Nothing is fixed into either wall. The right post carries the 1.5" pass-throughs, set off-centre toward the brick so the clamps clear the frame.',
    pros: ['Nothing into the shared wall or the brick: posts are slab and ceiling fixed', 'Full clear height: the headbox is outside', 'A standard face-fit shutter: the installer screws the frames onto two flat stainless faces', 'Manual spring drive: nothing electrical in the rain'],
    cons: ['Each post needs two screws up into solid ceiling framing (add blocking if needed)', 'The headbox is out in the rain (fine for a manual shutter)'],
  },

};

const SWATCHES = [
  ['#E4E2D5', 'Surfmist'], ['#F3F2EE', 'Pearl white'], ['#E7DCBF', 'Classic Cream'],
  ['#BEC0BB', 'Shale Grey'], ['#4C4D47', 'Woodland Grey'], ['#323233', 'Monument'], ['#2B2C2C', 'Night Sky'],
];

const KINDS = {
  unitank: { name: 'Ss Brewtech Unitank 14 gal (v1)', dims: 'Ø400 jacket · 1255 high on caster stand', floorOnly: true },
  hlt: { name: 'Nano Brewery 70 L HLT', dims: 'Ø450 × 450 body, 500 with lid' },
  mashtun: { name: 'Ss InfuSsion mash tun 20 gal', dims: 'Ø502 body, 708 tall with lid handle' },
  kettle: { name: 'Ss Brewmaster kettle 20 gal (firebox base)', dims: 'Ø450 × 660, 735 with lid' },
  g40: { name: 'KegLand Icemaster G40 glycol chiller', dims: '410 × 410 × 660, stands on S2 and passes through S3' },
  kegstack: { name: 'Corny kegs × 5, lying', dims: '19 L ball lock, Ø215 × 630' },
  kegs4: { name: 'Corny kegs × 4', dims: '19 L ball lock, Ø215 × 630' },
  co2: { name: 'CO₂ cylinder, 6 kg + KegLand MK4 regulator', dims: 'Ø160 × 716 to the guard rim' },
  pump: { name: 'Brew pump on board', dims: '320 × 260 board' },
  coil: { name: 'Immersion chiller coil', dims: 'Ø330 × 300' },
  colossus: { name: 'KegLand Coolossus G2 counterflow chiller', dims: 'Ø280 × 280 coil, camlock wort ports, garden-hose water ports' },
  riptide: { name: 'Blichmann RipTide pump', dims: '272 × 140 × 147' },
  pan: { name: 'Steam pan', dims: '530 × 325 × 150' },
  reel: { name: 'Extension reel, 25 m, blue', dims: 'Ø280 × 371 high' },
};

function defaults() {
  // Shelves by slot (see RACK_SPECS). Top of beam, 400 kg: slot 3 = 218, 18 = 1361, 23 = 1742, 28 = 2123 mm (18, 23
  // and 28 counted on the uprights in the photo); 1000 kg: slot 2 = 150, 7 = 531, 13 = 988, 24 = 1826 mm.
  const full = (id, slot, deck, extra = {}) => ({ id, slot, deck, from: 0, to: 1500, front: true, back: true, ...extra });
  const fullB = (id, slot, deck, extra = {}) => ({ id, slot, deck, from: 0, to: 1200, front: true, back: true, ...extra });
  return {
    v: 19,
    nook: { width: 1608, depth: 3130, height: 2665, fall: 50, crossFall: 10, ret: 130, retStep: 21, fenceToBrick: 1740, joists: [470, 930, 1380] },
    door: { show: true, fromBack: 520, width: 820, window: 600, windowH: 1020, hinge: 'back', opens: 'laundry' },
    drain: { show: true, offset: 185, width: 110 },
    dump: { show: true, connect: 'tankB', outside: 'spout' },
    shutter: { color: '#E4E2D5', boxColor: '#2B2C2C', open: 50, slat: 'cw55', setback: 90, motor: 'right', drive: 'spring', uFinish: 'black', inside: false, mount: 'face', frame: 'alu', partyFix: false },
    racks: {
      green: {
        x: 10, z: 5,
        levels: [
          full('g0', 2, 'none', { front: false }),
          full('g1', 18, 'acacia', { to: 500 }),
          full('g2', 23, 'mdf', { from: 500 }),
          full('g3', 28, 'mdf'),
        ],
      },
      blue: {
        z: 1400, gap: 0,
        levels: [
          fullB('b0', 2, 'wire'),
          fullB('b1', 11, 'acacia'),
          fullB('b2', 17, 'wire', { to: 550 }),
          fullB('b3', 24, 'none'),
        ],
      },
    },
    items: [
      { id: 'tankA', kind: 'unitank', show: true, on: 'floor', x: 800, z: 300, along: 0, inset: 0, rot: 0 },
      { id: 'tankB', kind: 'unitank', show: true, on: 'floor', x: 1320, z: 300, along: 0, inset: 0, rot: 0 },
      { id: 'co2a', kind: 'co2', show: true, on: 'floor', x: 1060, z: 620, along: 0, inset: 0, rot: 0 },
      { id: 'kettle', kind: 'kettle', show: true, on: 'floor', x: 290, z: 420, along: 0, inset: 0, rot: -30 },
      { id: 'g40', kind: 'g40', show: true, on: 'green:g1', x: 0, z: 0, along: 250, inset: 0, rot: 0 },
      { id: 'reel', kind: 'reel', show: true, on: 'green:g3', x: 0, z: 0, along: 130, inset: 0, rot: 0 },
      { id: 'pan', kind: 'pan', show: true, on: 'green:g3', x: 0, z: 0, along: 560, inset: 0, rot: 0 },
      { id: 'kegsTop', kind: 'kegstack', show: true, on: 'green:g3', x: 0, z: 0, along: 1150, inset: 60, rot: 0 },
      { id: 'hlt', kind: 'hlt', show: true, on: 'blue:b2', x: 0, z: 0, along: 275, inset: 0, rot: 90 },
      { id: 'mashtun', kind: 'mashtun', show: true, on: 'blue:b1', x: 0, z: 0, along: 875, inset: 0, rot: 22.5 },
      { id: 'pump', kind: 'riptide', show: true, on: 'blue:b1', x: 0, z: 0, along: 300, inset: 0, rot: 0 },
      { id: 'coil', kind: 'colossus', show: true, on: 'blue:b0', x: 0, z: 0, along: 330, inset: 0, rot: 0 },
      { id: 'kegsFloor', kind: 'kegs4', show: false, on: 'floor', x: 1000, z: 880, along: 0, inset: 0, rot: 0 },
      { id: 'co2b', kind: 'co2', show: true, on: 'floor', x: 110, z: 800, along: 0, inset: 0, rot: 0 },
    ],
    view: { hideLeft: true, hideCeiling: false, hideRight: false, dims: true, slope: true, xray: false, context: true, mountMode: false },
  };
}

/* =====================================================================
   State: load, save, hot snapshot
   ===================================================================== */
function migrate(c) {
  const d = defaults();
  if (c && typeof c === 'object' && c.v === 1) {
    // v1 -> v2: one G40 standing on an acacia board on S2 and passing through S3; no door step.
    c = JSON.parse(JSON.stringify(c));
    if (Array.isArray(c.items)) {
      c.items = c.items.filter((i) => i.kind !== 'glycol' && i.kind !== 'icemaster');
      if (!c.items.some((i) => i.kind === 'g40')) c.items.splice(4, 0, d.items.find((i) => i.kind === 'g40'));
    }
    const lv = c.racks?.green?.levels;
    if (Array.isArray(lv)) {
      const g1 = lv.find((l) => l.id === 'g1'); if (g1) Object.assign(g1, { deck: 'acacia', from: 0, to: 500 });
      const g2 = lv.find((l) => l.id === 'g2'); if (g2) Object.assign(g2, { deck: 'mdf', from: 500, to: 1500 });
    }
    if (c.door) delete c.door.step;
    c.v = 2;
  }
  if (c && typeof c === 'object' && c.v === 2) {
    // v2 -> v3: measured nook (1621 × 3130, ceiling 2575 → 2625, white wall return, fence line), door and window sizes
    c = JSON.parse(JSON.stringify(c));
    c.nook = { ...d.nook };
    c.door = { ...d.door, show: c.door?.show ?? true };
    c.drain = { ...d.drain, show: c.drain?.show ?? true };
    c.v = 3;
  }
  if (c && typeof c === 'object' && c.v === 3) {
    // v3 -> v4: option C dropped (headbox would sit in the rain), dump line added, 1000 kg rack off the brick for it
    c = JSON.parse(JSON.stringify(c));
    if (c.shutter?.mount === 'face') c.shutter.mount = 'wall';
    c.dump = { ...d.dump };
    if (c.racks?.blue && (c.racks.blue.gap ?? 0) < 70) c.racks.blue.gap = 70;
    c.v = 4;
  }
  if (c && typeof c === 'object' && c.v === 4) {
    // v4 -> v5: kegs live on the top shelf; the floor kegs are only out on transfer days
    c = JSON.parse(JSON.stringify(c));
    const k = (c.items || []).find((i) => i.id === 'kegsFloor'); if (k) k.show = false;
    c.v = 5;
  }
  if (c && typeof c === 'object' && c.v === 5) {
    // v5 -> v6: new mash tun model has a 343 mm valve lever on its right; nudge it clear of the end frame
    c = JSON.parse(JSON.stringify(c));
    const m = (c.items || []).find((i) => i.id === 'mashtun'); if (m && m.along === 880) m.along = 860;
    c.v = 6;
  }
  if (c && typeof c === 'object' && c.v === 6) {
    // v6 -> v7: new HLT has its fittings 351 mm out on the back-wall side; move it clear of the end frame
    c = JSON.parse(JSON.stringify(c));
    const m = (c.items || []).find((i) => i.id === 'hlt'); if (m && m.along === 300) m.along = 360;
    c.v = 7;
  }
  if (c && typeof c === 'object' && c.v === 7) {
    // v7 -> v8: HLT turned 90° clockwise (seen from above); dump hose goes through the dump jamb
    c = JSON.parse(JSON.stringify(c));
    const m = (c.items || []).find((i) => i.id === 'hlt'); if (m) m.rot = (((m.rot || 0) - 90 + 540) % 360) - 180;
    c.dump = { ...d.dump, ...(c.dump || {}), outside: c.dump?.outside || 'spout' };
    c.v = 8;
  }
  if (c && typeof c === 'object' && c.v === 8) {
    // v8 -> v9: HLT should have turned 90° counter-clockwise, not clockwise
    c = JSON.parse(JSON.stringify(c));
    const m = (c.items || []).find((i) => i.id === 'hlt'); if (m) m.rot = (((m.rot || 0) + 180 + 540) % 360) - 180;
    c.v = 9;
  }
  if (c && typeof c === 'object' && c.v === 9) {
    // v9 -> v10: left side becomes the post wedged into the corner (nothing fixed to the shared wall)
    c = JSON.parse(JSON.stringify(c));
    c.shutter = { ...(c.shutter || {}), partyFix: false };
    c.v = 10;
  }
  if (c && typeof c === 'object' && c.v === 10) {
    // v10 -> v11: door hinges at the fermenter (back-wall) end, opens into the laundry, handle at the HLT end
    c = JSON.parse(JSON.stringify(c));
    c.door = { ...(c.door || {}), hinge: 'back', opens: 'laundry' };
    c.v = 11;
  }
  if (c && typeof c === 'object' && c.v === 11) {
    // v11 -> v12: shelves sit on real Rack It slots (76.2 mm pitch, the beam hooks into slots n−1 and n);
    // each saved top-of-beam height becomes the nearest valid slot (2 .. top slot of the upright)
    c = JSON.parse(JSON.stringify(c));
    for (const key of ['green', 'blue']) {
      const lv = c.racks?.[key]?.levels;
      if (!Array.isArray(lv)) continue;
      for (const l of lv) {
        if (typeof l.h === 'number') l.slot = slotFor(rackSpec(key), l.h);
        delete l.h;
      }
    }
    c.v = 12;
  }
  if (c && typeof c === 'object' && c.v === 12) {
    // v12 -> v13: new default shelf layout; HLT centred on the 550 mm cut deck, mash tun centred in the 550–1200 gap
    c = JSON.parse(JSON.stringify(c));
    c.racks = JSON.parse(JSON.stringify(d.racks));
    for (const id of ['hlt', 'mashtun', 'pump']) {
      const i = (c.items || []).findIndex((t) => t.id === id);
      const def = d.items.find((t) => t.id === id);
      if (i >= 0) c.items[i] = { ...def, show: c.items[i].show }; else c.items.push(def);
    }
    c.v = 13;
  }
  if (c && typeof c === 'object' && c.v === 13) {
    // v13 -> v14: the pump is a Blichmann RipTide, the chiller a KegLand Coolossus
    c = JSON.parse(JSON.stringify(c));
    for (const it of c.items || []) { if (it.kind === 'pump') it.kind = 'riptide'; if (it.kind === 'coil') it.kind = 'colossus'; }
    c.v = 14;
  }
  if (c && typeof c === 'object' && c.v === 14) {
    // v14 -> v15: the dump hose runs under the 1000 kg rack now, so the rack goes flush to the brick
    c = JSON.parse(JSON.stringify(c));
    if (c.racks?.blue) c.racks.blue.gap = 0;
    c.v = 15;
  }
  if (c && typeof c === 'object' && c.v === 15) {
    // v15 -> v16: manual spring-balanced shutter, so option C (headbox outside, reveal-fixed) is back and the default
    c = JSON.parse(JSON.stringify(c));
    c.shutter = { ...(c.shutter || {}), drive: 'spring', mount: 'face' };
    c.v = 16;
  }
  if (c && typeof c === 'object' && c.v === 16) {
    // v16 -> v17: slats are the brochure products; the headbox gets its own colour (Night Sky)
    c = JSON.parse(JSON.stringify(c));
    const map = { s40: 'oz40', s55: 'cw55', x36: 'cw55' };
    c.shutter = { ...(c.shutter || {}), boxColor: '#2B2C2C' };
    if (map[c.shutter.slat]) c.shutter.slat = map[c.shutter.slat];
    c.v = 17;
  }
  if (c && typeof c === 'object' && c.v === 17) {
    // v17 -> v18: option C posts become one inverted-U frame, fixed to the three ceiling joists
    c = JSON.parse(JSON.stringify(c));
    c.nook = { ...(c.nook || {}), joists: [470, 930, 1380] };
    c.shutter = { ...(c.shutter || {}), uFinish: 'black' };
    c.v = 18;
  }
  if (c && typeof c === 'object' && c.v === 18) {
    // v18 -> v19: re-measured opening: 1608 / 1587 wide, level ceiling 2665 over the front-right floor,
    // floor 10 mm higher on the weatherboard side
    c = JSON.parse(JSON.stringify(c));
    c.nook = { ...(c.nook || {}), width: 1608, height: 2665, crossFall: 10, retStep: 21 };
    c.v = 19;
  }
  if (!c || typeof c !== 'object' || c.v !== 19) return d;
  const merged = { ...d, ...c };
  for (const k of ['nook', 'door', 'drain', 'dump', 'shutter', 'view']) merged[k] = { ...d[k], ...(c[k] || {}) };
  if (!MOUNTS[merged.shutter.mount]) merged.shutter.mount = 'wall';
  if (!SLATS[merged.shutter.slat]) merged.shutter.slat = 'cw55';
  merged.racks = {
    green: { ...d.racks.green, ...(c.racks?.green || {}) },
    blue: { ...d.racks.blue, ...(c.racks?.blue || {}) },
  };
  for (const key of ['green', 'blue']) {
    // keep only shelves with a usable slot (a pasted block may carry stray values)
    const spec = rackSpec(key), r = merged.racks[key];
    if (!Array.isArray(r.levels)) r.levels = d.racks[key].levels;
    r.levels = r.levels.filter((l) => l && typeof l === 'object' && Number.isFinite(+l.slot))
      .map((l) => ({ ...l, slot: clamp(Math.round(+l.slot), 2, spec.slots) }));
  }
  if (!Array.isArray(merged.items)) merged.items = d.items;
  return merged;
}
function loadSaved() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
let cfg = defaults();
let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(cfg)); } catch { /* storage unavailable */ }
  }, 400);
}

/* =====================================================================
   Helpers: geometry, textures
   ===================================================================== */
function rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
function canvasTex(w, h, draw, { repeat = true, color = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
function mesh(geo, mat, cast = true, receive = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}
function boxAt(x0, y0, z0, x1, y1, z1, mat) {
  return box(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
}
function cyl(rTop, rBot, h, mat, x = 0, y = 0, z = 0, seg = 32, open = false) {
  const m = mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open), mat);
  m.position.set(x, y, z);
  return m;
}
function cylBetween(r, a, b, mat, seg = 16, r2 = r) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = mesh(new THREE.CylinderGeometry(r2, r, len, seg), mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
  return m;
}
function tube(points, r, mat, seg = 64, radial = 10) {
  const curve = new THREE.CatmullRomCurve3(points);
  return mesh(new THREE.TubeGeometry(curve, seg, r, radial, false), mat);
}
// Extrude a 2D profile drawn in (u = +z, v = +y) along +x for `len`.
function extrudeX(draw, len, curveSegments = 6) {
  const s = new THREE.Shape();
  draw({
    moveTo: (u, v) => s.moveTo(-u, v),
    lineTo: (u, v) => s.lineTo(-u, v),
    quad: (cu, cv, u, v) => s.quadraticCurveTo(-cu, cv, -u, v),
  });
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false, curveSegments });
  g.rotateY(PI / 2);
  return g;
}
// Point on a cylinder around the y axis. a = 0 faces +z (front), positive a turns toward +x.
const rp = (a, r, y) => V(r * Math.sin(rad(a)), y, r * Math.cos(rad(a)));

function core(m) { m.userData.core = true; return m; }

// Tri-clamp fittings are built along +z, then aimed with `aimed`.
function aimed(obj, at, dir) {
  obj.position.copy(at);
  obj.quaternion.setFromUnitVectors(V(0, 0, 1), dir.clone().normalize());
  return obj;
}
// Shared tri-clamp kit (vessels/triclamp.js), created once the materials exist.
let TC = null;
function tcSize(r) { return r > 0.06 ? '6' : r > 0.03 ? '3' : '1.5'; }
// A clamp (with gasket) centred on the joint plane at the origin, axis +z.
function tcClamp(r, angle = 0) {
  const g = new THREE.Group();
  const k = tcSize(r);
  g.add(TC.gasket(k, { rimOnly: true }));
  g.add(TC.clamp(k, { angle }));
  return g;
}
// Ferrule + gasket + clamp + mating ferrule: tube from z=0 up to the joint at z=len.
function tcStub(r, len) {
  const g = new THREE.Group();
  const k = tcSize(r), s = TC.sizes[k];
  const j = TC.joint(k, { lenA: Math.max(0.006, len - s.gap / 2), lenB: s.len, openB: true });
  j.position.z = len; g.add(j);
  return g;
}
function butterfly(r) {
  const g = new THREE.Group();
  g.add(cylBetween(r + 0.007, V(0, 0, 0), V(0, 0, 0.03), MAT.ss, 20));
  g.add(cyl(0.006, 0.006, 0.02, MAT.ss, r + 0.008, 0.0, 0.015, 8));
  g.add(box(0.115, 0.007, 0.018, MAT.ss, r + 0.06, 0.012, 0.015));
  g.add(box(0.03, 0.013, 0.022, MAT.ss, r + 0.11, 0.012, 0.015));
  return g;
}

/* ---------- textures ---------- */
const TEX = {};
function makeTextures() {
  const brick = (palette, mortar, seed) => canvasTex(1024, 512, (ctx, w, h) => {
    const R = rng(seed);
    ctx.fillStyle = mortar; ctx.fillRect(0, 0, w, h);
    const cols = 4, rows = 6, bw = w / cols, ch = h / rows, j = bw * (10 / 240);
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? bw / 2 : 0;
      for (let i = -1; i <= cols; i++) {
        const x = i * bw + off, y = r * ch;
        ctx.fillStyle = palette[Math.floor(R() * palette.length)];
        ctx.fillRect(x + j / 2, y + j / 2, bw - j, ch - j);
        for (let k = 0; k < 90; k++) {
          ctx.fillStyle = R() > 0.5 ? `rgba(0,0,0,${R() * 0.09})` : `rgba(255,255,255,${R() * 0.08})`;
          ctx.fillRect(x + j / 2 + R() * (bw - j), y + j / 2 + R() * (ch - j), 2 + R() * 3, 2);
        }
        const g = ctx.createLinearGradient(0, y, 0, y + ch);
        g.addColorStop(0, 'rgba(255,255,255,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0.06)');
        ctx.fillStyle = g; ctx.fillRect(x + j / 2, y + j / 2, bw - j, ch - j);
      }
    }
  });
  // one brick for every wall: warm mid-grey picked between the shaded back wall and the sunlit side wall
  TEX.brick = brick(['#a59e93', '#aba499', '#9e978c', '#b0a99e', '#a29b90'], '#d2d0ca', 11);
  TEX.weather = canvasTex(1024, 256, (ctx, w, h) => {
    const R = rng(7);
    const n = 6, bw = w / n;
    for (let i = 0; i < n; i++) {
      const v = 30 + Math.floor(R() * 8);
      ctx.fillStyle = `rgb(${v},${v + 1},${v + 3})`;
      ctx.fillRect(i * bw, 0, bw, h);
      for (let k = 0; k < 40; k++) {
        ctx.fillStyle = `rgba(255,255,255,${0.015 + R() * 0.03})`;
        ctx.fillRect(i * bw + R() * bw, 0, 1 + R() * 2, h);
      }
      ctx.fillStyle = '#09090a'; ctx.fillRect(i * bw, 0, 7, h);
      ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(i * bw + 7, 0, 2, h);
    }
  });
  TEX.concrete = canvasTex(512, 512, (ctx, w, h) => {
    const R = rng(5);
    ctx.fillStyle = '#c3c2bd'; ctx.fillRect(0, 0, w, h);
    for (let k = 0; k < 40; k++) {
      const x = R() * w, y = R() * h, r = 30 + R() * 90;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const a = R() * 0.07;
      g.addColorStop(0, R() > 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let k = 0; k < 9000; k++) {
      ctx.fillStyle = R() > 0.5 ? `rgba(0,0,0,${R() * 0.12})` : `rgba(255,255,255,${R() * 0.12})`;
      ctx.fillRect(R() * w, R() * h, 1.5, 1.5);
    }
  });
  TEX.mdf = canvasTex(512, 256, (ctx, w, h) => {
    const R = rng(9);
    ctx.fillStyle = '#b48c62'; ctx.fillRect(0, 0, w, h);
    for (let k = 0; k < 7000; k++) {
      ctx.fillStyle = R() > 0.5 ? `rgba(80,50,20,${R() * 0.12})` : `rgba(255,230,190,${R() * 0.1})`;
      ctx.fillRect(R() * w, R() * h, 2, 1);
    }
  });
  TEX.hammer = canvasTex(128, 128, (ctx, w, h) => {
    const R = rng(3);
    ctx.fillStyle = '#2a2b2e'; ctx.fillRect(0, 0, w, h);
    for (let k = 0; k < 900; k++) {
      ctx.fillStyle = R() > 0.55 ? `rgba(160,165,175,${0.1 + R() * 0.25})` : `rgba(0,0,0,${0.2 + R() * 0.3})`;
      ctx.beginPath(); ctx.arc(R() * w, R() * h, 0.6 + R() * 1.4, 0, PI * 2); ctx.fill();
    }
  });
  TEX.hammer.repeat.set(14, 14); // rack UVs are in metres: speckle about 1–2.5 mm, as on the Rack It powder coat
  TEX.perf = canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#000';
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      ctx.beginPath(); ctx.arc(c * 32 + 16 + (r % 2) * 16, r * 32 + 16, 9, 0, PI * 2); ctx.fill();
    }
  }, { color: false });
  TEX.perf.repeat.set(3, 3);
  TEX.slots = canvasTex(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#000';
    for (let i = 0; i < 10; i++) {
      const x = i * (w / 10) + 14;
      ctx.beginPath(); ctx.roundRect(x, 26, 24, 76, 10); ctx.fill();
    }
  }, { color: false });
  TEX.slots.repeat.set(2, 1);
  TEX.fence = canvasTex(512, 256, (ctx, w, h) => {
    const R = rng(13);
    const n = 6, bw = w / n;
    ctx.fillStyle = '#3a2a1c'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) {
      const base = [150 + R() * 30, 105 + R() * 25, 65 + R() * 20].map(Math.round);
      ctx.fillStyle = `rgb(${base})`;
      ctx.fillRect(i * bw + 3, 0, bw - 6, h);
      for (let k = 0; k < 50; k++) {
        ctx.fillStyle = `rgba(${R() > 0.5 ? '60,30,10' : '230,190,140'},${0.08 + R() * 0.12})`;
        ctx.fillRect(i * bw + 3 + R() * (bw - 6), 0, 1 + R() * 2, h);
      }
    }
  });
  TEX.fan = canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#d9dbd8'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#8f9396'; ctx.lineWidth = 2.5;
    for (let r = 14; r < 126; r += 9) { ctx.beginPath(); ctx.arc(128, 128, r, 0, PI * 2); ctx.stroke(); }
    ctx.strokeStyle = '#a7abae'; ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) { const a = (i * PI) / 4; ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(128 + Math.cos(a) * 126, 128 + Math.sin(a) * 126); ctx.stroke(); }
    ctx.fillStyle = '#7d8184'; ctx.beginPath(); ctx.arc(128, 128, 16, 0, PI * 2); ctx.fill();
  }, { repeat: false });
  TEX.acacia = canvasTex(512, 512, (ctx, w, h) => {
    const R = rng(21);
    const tones = ['#8a5a33', '#a46d3e', '#6e4426', '#b5814e', '#93613a', '#7c4f2c', '#c08b58'];
    let y = 0;
    while (y < h) {
      const sh = 34 + Math.floor(R() * 26);
      let x = -Math.floor(R() * 200);
      while (x < w) {
        const len = 160 + R() * 260;
        ctx.fillStyle = tones[Math.floor(R() * tones.length)];
        ctx.fillRect(x, y, len, sh);
        for (let k = 0; k < 14; k++) {
          ctx.strokeStyle = `rgba(${R() > 0.5 ? '50,25,8' : '230,190,140'},${0.08 + R() * 0.12})`;
          ctx.lineWidth = 1 + R() * 1.5;
          const yy = y + R() * sh;
          ctx.beginPath(); ctx.moveTo(x, yy); ctx.bezierCurveTo(x + len * 0.3, yy + (R() - 0.5) * 6, x + len * 0.6, yy + (R() - 0.5) * 6, x + len, yy + (R() - 0.5) * 4); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(40,20,5,0.35)'; ctx.fillRect(x + len - 1, y, 1, sh);
        x += len;
      }
      ctx.fillStyle = 'rgba(40,20,5,0.3)'; ctx.fillRect(0, y + sh - 1, w, 1);
      y += sh;
    }
  });
  TEX.psi = labelTex(64, 200, (ctx, w, h) => {
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d42a22'; ctx.fillRect(0, 0, w, 54);
    ctx.fillStyle = '#fff'; ctx.font = '700 15px Helvetica, Arial, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('DO NOT', w / 2, 22); ctx.fillText('EXCEED', w / 2, 42);
    ctx.font = '700 22px Helvetica, Arial, sans-serif'; ctx.fillText('30 PSI', w / 2, 80);
    ctx.fillStyle = '#bbb'; for (let i = 0; i < 6; i++) ctx.fillRect(8, 98 + i * 15, w - 16 - (i % 2) * 10, 4);
  });
  TEX.g40 = labelTex(180, 220, (ctx, w, h) => {
    ctx.fillStyle = '#ecebe6'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#16181b'; ctx.font = '700 22px Helvetica, Arial, sans-serif'; ctx.fillText('ICEMASTER-G40', 10, 34);
    ctx.fillStyle = '#555'; for (let i = 0; i < 9; i++) ctx.fillRect(10, 52 + i * 17, 120 + ((i * 37) % 40), 5);
    ctx.strokeStyle = '#999'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, w - 2, h - 2);
  });
  TEX.vent = labelTex(256, 140, (ctx, w, h) => {
    ctx.fillStyle = '#eeeeea'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#9a9c98'; for (let i = 0; i < 11; i++) ctx.fillRect(18, 16 + i * 10, w - 36, 4);
  });
  TEX.dump = canvasTex(128, 128, (ctx, w, h) => {
    const R = rng(31);
    ctx.fillStyle = '#1e48c8'; ctx.fillRect(0, 0, w, h);
    for (let k = 0; k < 900; k++) { ctx.fillStyle = R() > 0.5 ? `rgba(120,170,255,${R() * 0.35})` : `rgba(5,15,60,${R() * 0.3})`; ctx.fillRect(R() * w, R() * h, 1.5, 1.5); }
    ctx.strokeStyle = 'rgba(8,20,80,0.55)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-10, h + 10); ctx.lineTo(w + 10, -10); ctx.stroke();
    ctx.strokeStyle = 'rgba(140,180,255,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-4, h + 10); ctx.lineTo(w + 16, -10); ctx.stroke();
  });
  TEX.ss = labelTex(256, 256, (ctx, w, h) => {
    ctx.strokeStyle = '#f4f4f4'; ctx.lineWidth = 10; ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.fillStyle = '#f4f4f4';
    ctx.font = '700 120px Helvetica, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('Ss', w / 2 - 6, 160);
    ctx.font = '600 26px Helvetica, Arial, sans-serif'; ctx.fillText('304', w - 54, 62);
    ctx.font = '500 34px Helvetica, Arial, sans-serif'; ctx.fillText('brewtech', w / 2, 212);
  });
  TEX.ssEtch = labelTex(256, 160, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(60,62,66,0.75)';
    ctx.font = '700 96px Helvetica, Arial, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Ss', w / 2, 100);
    ctx.font = '500 28px Helvetica, Arial, sans-serif'; ctx.fillText('brewtech', w / 2, 140);
  });
  TEX.nano = labelTex(320, 160, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(40,42,46,0.8)';
    ctx.font = '600 64px Helvetica, Arial, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('NANO', w / 2, 70);
    ctx.font = '400 48px Helvetica, Arial, sans-serif'; ctx.fillText('Brewery', w / 2, 128);
  });
  TEX.heat = labelTex(200, 110, (ctx, w, h) => {
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff'; ctx.font = '700 22px Helvetica, Arial, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('DO NOT APPLY', w / 2, 40); ctx.fillText('HEAT', w / 2, 70);
    ctx.font = '400 15px Helvetica, Arial, sans-serif'; ctx.fillText('insulated vessel', w / 2, 96);
  });
  TEX.kegLabel = labelTex(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f7f5ef'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e46b1e'; ctx.fillRect(0, 0, w, 26);
    ctx.fillStyle = '#333'; for (let i = 0; i < 5; i++) ctx.fillRect(16, 42 + i * 16, 120 + (i % 2) * 60, 5);
  });
  TEX.ftss = labelTex(128, 48, (ctx, w, h) => {
    ctx.fillStyle = '#04070d'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#4ba3ff'; ctx.font = '700 30px "IBM Plex Mono", monospace'; ctx.fillText('17.6', 10, 36);
  });
  TEX.glyDisp = labelTex(96, 40, (ctx, w, h) => {
    ctx.fillStyle = '#120404'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ff3b2f'; ctx.font = '700 26px "IBM Plex Mono", monospace'; ctx.fillText('-2.0', 8, 30);
  });
  TEX.dial = labelTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f6f6f2'; ctx.beginPath(); ctx.arc(64, 64, 62, 0, PI * 2); ctx.fill();
    ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
    for (let i = 0; i <= 20; i++) {
      const a = rad(-225 + i * 13.5);
      ctx.beginPath(); ctx.moveTo(64 + Math.cos(a) * 50, 64 + Math.sin(a) * 50); ctx.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58); ctx.stroke();
    }
    ctx.strokeStyle = '#c62828'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(64, 64); ctx.lineTo(64 + 44 * Math.cos(rad(-60)), 64 + 44 * Math.sin(rad(-60))); ctx.stroke();
  });
}
function labelTex(w, h, draw) {
  return canvasTex(w, h, (ctx) => { ctx.clearRect(0, 0, w, h); draw(ctx, w, h); }, { repeat: false });
}
function decal(tex, w, h, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.userData.ownMat = true;
  m.position.set(x, y, z);
  m.rotation.y = ry;
  return m;
}

/* ---------- materials ---------- */
const MAT = {};
function makeMaterials() {
  const S = (p) => new THREE.MeshStandardMaterial(p);
  MAT.powder = S({ color: 0xffffff, map: TEX.hammer, roughness: 0.55, metalness: 0.5 });
  MAT.ss = S({ color: 0xdadde0, roughness: 0.24, metalness: 1.0 });
  MAT.ssDouble = S({ color: 0xd4d7da, roughness: 0.3, metalness: 1.0, side: THREE.DoubleSide });
  MAT.ssDull = S({ color: 0xbfc2c5, roughness: 0.45, metalness: 0.9 });
  MAT.trim = S({ color: 0xf1f0ec, roughness: 0.6, metalness: 0 });
  MAT.coatBlack = S({ color: 0x1d1e20, roughness: 0.55, metalness: 0.1 }); // black powder coat
  MAT.alu = S({ color: 0xc6c9cc, roughness: 0.35, metalness: 0.9 });
  MAT.neoprene = S({ color: 0x1c1b22, roughness: 0.95, metalness: 0 });
  MAT.black = S({ color: 0x151517, roughness: 0.55, metalness: 0.1 });
  MAT.rubber = S({ color: 0x101011, roughness: 0.92, metalness: 0 });
  MAT.rubberDouble = S({ color: 0x121213, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  MAT.mdf = S({ color: 0xffffff, map: TEX.mdf, roughness: 0.85, metalness: 0 });
  MAT.wood = S({ color: 0x9a6a40, roughness: 0.75, metalness: 0 });
  MAT.acacia = S({ color: 0xffffff, map: TEX.acacia, roughness: 0.55, metalness: 0 });
  MAT.g40 = S({ color: 0x1b1c1f, roughness: 0.62, metalness: 0.3 });
  MAT.wheel = S({ color: 0x585c61, roughness: 0.6, metalness: 0.1 });
  MAT.seam = S({ color: 0x2c2b33, roughness: 0.9, metalness: 0 });
  MAT.hole = S({ color: 0x0a0a0a, roughness: 1, metalness: 0 });
  MAT.timber = S({ color: 0x7b5636, roughness: 0.8, metalness: 0 });
  MAT.stud = S({ color: 0xd8b98a, roughness: 0.85, metalness: 0 });
  MAT.concrete = S({ color: 0xffffff, map: TEX.concrete, roughness: 0.92, metalness: 0 });
  MAT.paving = S({ color: 0xd9d8d4, map: TEX.concrete, roughness: 0.95, metalness: 0 });
  MAT.brick = S({ color: 0xffffff, map: TEX.brick, roughness: 0.9, metalness: 0 });
  MAT.weather = S({ color: 0xffffff, map: TEX.weather, roughness: 0.7, metalness: 0.05 });
  MAT.plaster = S({ color: 0xf2f2ef, roughness: 0.95, metalness: 0 });
  MAT.render = S({ color: 0xf1f1ee, roughness: 0.9, metalness: 0 });
  MAT.doorFrame = S({ color: 0x1b1c1e, roughness: 0.45, metalness: 0.4 });
  MAT.doorLeaf = S({ color: 0x2b2d30, roughness: 0.55, metalness: 0.2 });
  MAT.glass = S({ color: 0xbcd3db, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35 });
  MAT.clear = S({ color: 0xe8f0f2, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.45 });
  MAT.co2 = S({ color: 0x9ea4a2, roughness: 0.45, metalness: 0.35 });
  MAT.greyBox = S({ color: 0x3b3e43, roughness: 0.5, metalness: 0.3 });
  MAT.grille = S({ color: 0x1d1f22, roughness: 0.6, metalness: 0.3 });
  MAT.blue = S({ color: 0x1f6fd1, roughness: 0.45, metalness: 0 });
  MAT.blueHandle = S({ color: 0x2f6fe0, roughness: 0.5, metalness: 0 });
  MAT.silicone = S({ color: 0xeadfc6, roughness: 0.6, metalness: 0 });
  MAT.hoseWhite = S({ color: 0xf1efea, roughness: 0.55, metalness: 0 });
  MAT.grate = S({ color: 0x18191b, roughness: 0.7, metalness: 0.2 });
  MAT.galv = S({ color: 0xb6babd, roughness: 0.5, metalness: 0.85 });
  MAT.pvc = S({ color: 0xf2f2f0, roughness: 0.6, metalness: 0 });
  MAT.packer = S({ color: 0x7d8186, roughness: 0.7, metalness: 0 }); // black plastic levelling packers
  MAT.red = S({ color: 0xc8302a, roughness: 0.5, metalness: 0 });
  MAT.green = S({ color: 0x2a9a4c, roughness: 0.5, metalness: 0 });
  MAT.yellow = S({ color: 0xe7c22b, roughness: 0.5, metalness: 0 });
  MAT.ac = S({ color: 0xe8e9e6, roughness: 0.6, metalness: 0.1 });
  MAT.perf = S({ color: 0xd6d9dc, roughness: 0.35, metalness: 0.95, alphaMap: TEX.perf, alphaTest: 0.5, side: THREE.DoubleSide });
  MAT.skirt = S({ color: 0x8c8780, roughness: 0.55, metalness: 0.85, alphaMap: TEX.slots, alphaTest: 0.5, side: THREE.DoubleSide });
  MAT.fence = S({ color: 0xffffff, map: TEX.fence, roughness: 0.85, metalness: 0 });
  MAT.fan = S({ map: TEX.fan, roughness: 0.7, metalness: 0 });
  MAT.light = new THREE.MeshBasicMaterial({ color: 0xfff7e8 });
  MAT.vent = S({ map: TEX.vent, roughness: 0.8, metalness: 0 });
  MAT.dumpHose = S({ color: 0xffffff, map: TEX.dump, roughness: 0.75, metalness: 0 });
  MAT.hlStruct = S({ color: 0xff6a13, emissive: 0xff6a13, emissiveIntensity: 0.3, roughness: 0.5, metalness: 0.15 });
  MAT.hlFix = S({ color: 0x00a8f0, emissive: 0x00a8f0, emissiveIntensity: 0.45, roughness: 0.4, metalness: 0.15 });
  MAT.hlShutter = S({ color: 0x8a96a3, roughness: 0.6, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false });
  MAT.screenBlue = new THREE.MeshBasicMaterial({ map: TEX.ftss });
  MAT.screenRed = new THREE.MeshBasicMaterial({ map: TEX.glyDisp });
  MAT.dialFace = new THREE.MeshBasicMaterial({ map: TEX.dial });
  MAT.arrow = new THREE.MeshBasicMaterial({ color: 0xe0601c, transparent: true, opacity: 0.88, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false });
  MAT.shutter = S({ color: 0xe4e2d5, roughness: 0.48, metalness: 0.15 });
  MAT.shutterGhost = S({ color: 0xe4e2d5, roughness: 0.48, metalness: 0.15, transparent: true, opacity: 0.18, depthWrite: false });
  MAT.headbox = S({ color: 0x2b2c2c, roughness: 0.5, metalness: 0.15 });
  MAT.headboxGhost = S({ color: 0x2b2c2c, roughness: 0.5, metalness: 0.15, transparent: true, opacity: 0.2, depthWrite: false });
  MAT.roll = S({ color: 0xd9d7ca, roughness: 0.5, metalness: 0.15 });
  MAT.dimLine = new THREE.LineBasicMaterial({ color: 0x2c3136, transparent: true, opacity: 0.85, depthTest: false });
  MAT.dimAccent = new THREE.LineBasicMaterial({ color: 0xd9571a, depthTest: false });
}

/* =====================================================================
   Scene
   ===================================================================== */
const glWrap = document.getElementById('gl');
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
glWrap.appendChild(renderer.domElement);
const labelRenderer = new CSS2DRenderer({ element: document.getElementById('labels') });

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.6;

const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 60);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.09;
controls.maxPolarAngle = PI * 0.5;
controls.minDistance = 0.04;
controls.zoomToCursor = true;
controls.addEventListener('change', () => { needsRender = true; });
controls.zoomSpeed = 1.2;
controls.maxDistance = 16;
controls.screenSpacePanning = true;

const hemi = new THREE.HemisphereLight(0xe9eef4, 0x7d776c, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3e2, 2.0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -3.6; sun.shadow.camera.right = 3.6;
sun.shadow.camera.top = 3.6; sun.shadow.camera.bottom = -3.6;
sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 16;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const downlight = new THREE.SpotLight(0xfff0dc, 14, 0, rad(68), 0.7, 2);
downlight.castShadow = true;
downlight.shadow.mapSize.set(1024, 1024);
downlight.shadow.bias = -0.0005;
scene.add(downlight, downlight.target);

const G = {
  room: new THREE.Group(), xray: new THREE.Group(), racks: new THREE.Group(),
  items: new THREE.Group(), shutter: new THREE.Group(), dims: new THREE.Group(), dump: new THREE.Group(),
};
Object.values(G).forEach((g) => scene.add(g));

let needsRender = true;
const requestRender = () => { needsRender = true; };

const dimCache = new Map();
function dimmed(m) {
  if (Array.isArray(m)) return m.map(dimmed);
  let dm = dimCache.get(m);
  if (!dm) {
    dm = m.clone();
    dm.transparent = true; dm.opacity = (m.opacity ?? 1) * 0.09; dm.depthWrite = false;
    dimCache.set(m, dm);
  }
  return dm;
}
function roleOf(o) {
  for (let q = o; q; q = q.parent) if (q.userData.role) return q.userData.role;
  return null;
}
// Mounting mode: brackets, posts and lugs in orange; bolts, screws and anchors in blue; the shutter ghosted; the rest faded
function applyHighlight() {
  const on = !!cfg.view.mountMode;
  for (const g of Object.values(G)) g.traverse((o) => {
    if (o.isCSS2DObject && g === G.dims) { o.visible = !on; return; }
    if (!o.isMesh) return;
    if (!('origMat' in o.userData)) { o.userData.origMat = o.material; o.userData.origCast = o.castShadow; }
    if (!on) { o.material = o.userData.origMat; o.castShadow = o.userData.origCast; return; }
    const r = roleOf(o);
    if (r === 'struct') { o.material = MAT.hlStruct; o.castShadow = true; }
    else if (r === 'fix') { o.material = MAT.hlFix; o.castShadow = true; }
    else if (r === 'shutter') { o.material = MAT.hlShutter; o.castShadow = false; }
    else { o.material = dimmed(o.userData.origMat); o.castShadow = false; }
  });
  G.dims.visible = !on;
  const lg = document.getElementById('mountLegend');
  if (lg) lg.hidden = !on;
  document.querySelectorAll('[data-mountmode]').forEach((b) => { if (b.type === 'checkbox') b.checked = on; else b.setAttribute('aria-pressed', String(on)); });
  requestRender();
}
function clearGroup(g) {
  g.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    if (o.userData.ownMat && o.material) {
      (Array.isArray(o.userData.origMat ?? o.material) ? (o.userData.origMat ?? o.material) : [o.userData.origMat ?? o.material]).forEach((m) => {
        const dm = dimCache.get(m); if (dm) { dm.dispose(); dimCache.delete(m); }
        m.map?.dispose(); m.dispose();
      });
    }
    if (o.isCSS2DObject && o.element.parentNode) o.element.parentNode.removeChild(o.element);
  });
  while (g.children.length) g.remove(g.children[0]);
}

/* ---------- shared dims ---------- */
const dimsM = () => ({
  W: mm(cfg.nook.width), D: mm(cfg.nook.depth), H: mm(cfg.nook.height), F: mm(cfg.nook.fall),
});
function floorY(z, x) {
  const { W, D, F } = dimsM();
  const X = (cfg.nook.crossFall || 0) / 1000;
  const cross = x === undefined ? 0 : X * (1 - clamp(x, 0, W) / W); // slab is higher on the left
  if (z <= 0) return F + cross;
  if (z >= D) return cross;
  return F * (1 - z / D) + cross;
}
// Left wall build-up (assumed): 18 mm vertical weatherboard on 35 mm battens over the 110 mm brick leaf
// of the 250 mm wall between the two units. The unit boundary runs down the middle of that wall.
const LCLAD = 0.053, LBRICK = 0.11, PARTY = 0.25;
// White wall return beyond the roof line: x0 is the fence line, x1 its face (proud of the weatherboard)
function whiteM() {
  const { W } = dimsM();
  return { x0: Math.min(W - mm(cfg.nook.fenceToBrick), -0.02), x1: mm(cfg.nook.retStep), len: mm(cfg.nook.ret) };
}
// Brick box with UVs laid out in world space: courses start at slab level in the back-right corner
// and run continuously along the back wall (u = x − W) and round the corner along the brick wall (u = z).
const BRICK_TILE_U = 0.96, BRICK_TILE_V = 0.516; // texture tile = 4 bricks (240 mm) × 6 courses (86 mm)
function brickAt(x0, y0, z0, x1, y1, z1) {
  const { W, F } = dimsM();
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const nx = Math.abs(N.getX(i)), ny = Math.abs(N.getY(i));
    if (nx > 0.5) U.setXY(i, z / BRICK_TILE_U, (y - F) / BRICK_TILE_V);
    else if (ny > 0.5) U.setXY(i, (x - W) / BRICK_TILE_U, z / BRICK_TILE_V);
    else U.setXY(i, (x - W) / BRICK_TILE_U, (y - F) / BRICK_TILE_V);
  }
  U.needsUpdate = true;
  return mesh(g, MAT.brick);
}
function texturedMat(base, rx, ry, extra = {}) {
  const m = base.clone();
  Object.assign(m, extra);
  if (m.map) { m.map = m.map.clone(); m.map.repeat.set(rx, ry); m.map.needsUpdate = true; }
  return m;
}
function ownMesh(m) { m.userData.ownMat = true; return m; }
function tip(obj, title, sub = '', extra = {}) { obj.userData.tip = { title, sub }; Object.assign(obj.userData, extra); return obj; }

/* =====================================================================
   Room: floor, walls, door, ceiling, context
   ===================================================================== */
const doorM = () => {
  const { D, H } = dimsM();
  const leaf = mm(cfg.door.width), j = 0.04;
  const z0 = clamp(mm(cfg.door.fromBack), 0, D - leaf - 0.3);
  const z1 = z0 + leaf + 2 * j;
  const fy = floorY((z0 + z1) / 2);
  const brickTop = fy + 0.09, leafBot = brickTop + 0.024, leafTop = leafBot + 2.04, headTop = Math.min(leafTop + 0.05, H - 0.05);
  const win = cfg.door.window > 0 ? { z0: z1, z1: Math.min(z1 + mm(cfg.door.window), D - 0.05), sill: headTop - mm(cfg.door.windowH || 1020) } : null;
  return { z0, z1, fy, brickTop, leafBot, leafTop, headTop, win };
};

let doorSwing = null;
// Satin stainless lever on a round rose (52 mm rose, 19 mm neck, 125 mm flat-sided lever), like a standard passage set.
const LEVER_GEO = {};
function leverHandle(xFace, dir, y, z, toward) {
  const g = new THREE.Group();
  const out = (t) => xFace + dir * t;
  g.add(cylBetween(0.026, V(out(0), y, z), V(out(0.007), y, z), MAT.ssDull, 40));
  g.add(cylBetween(0.0235, V(out(0.007), y, z), V(out(0.0095), y, z), MAT.ssDull, 40));
  g.add(cylBetween(0.0095, V(out(0.0095), y, z), V(out(0.046), y, z), MAT.ssDull, 24));
  const geo = LEVER_GEO.bar || (LEVER_GEO.bar = shared(new RoundedBoxGeometry(0.014, 0.019, 0.135, 3, 0.0055)));
  const bar = mesh(geo, MAT.ssDull);
  bar.position.set(out(0.046), y, z + toward * (0.135 / 2 - 0.0095));
  g.add(bar);
  return g;
}
function buildRoom() {
  doorSwing = null;
  clearGroup(G.room);
  clearGroup(G.xray);
  const { W, D, H, F } = dimsM();
  const v = cfg.view;
  const xray = v.xray;
  const ctx = v.context;

  // Sloped slab: high at the back wall, falling to the opening.
  const fg = new THREE.BufferGeometry();
  // a: back-left, b: back-right, c: front-right, d: front-left
  const XF = (cfg.nook.crossFall || 0) / 1000;
  fg.setAttribute('position', new THREE.Float32BufferAttribute([0, F + XF, 0, W, F, 0, W, 0, D, 0, XF, D], 3));
  fg.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, W, 0, W, D, 0, D], 2));
  fg.setIndex([0, 3, 2, 0, 2, 1]); // wound so the normal points up
  fg.computeVertexNormals();
  const floor = mesh(fg, MAT.concrete, false, true);
  tip(floor, 'Concrete slab', `Falls ${cfg.nook.fall} mm from the back wall to the opening${cfg.nook.crossFall ? `, and ${cfg.nook.crossFall} mm from the weatherboard to the brick` : ''}; the ceiling is level`);
  G.room.add(floor);
  // slab edge under the nook floor
  G.room.add(boxAt(0, -0.12, D - 0.002, W, 0, D, MAT.concrete));

  // Outside paving
  const outLen = 2.4;
  const ox0 = whiteM().x0 - 0.02;
  const outside = mesh(new THREE.PlaneGeometry(W - ox0, outLen), texturedMat(MAT.paving, W - ox0, outLen), false, true);
  ownMesh(outside);
  outside.rotation.x = -PI / 2;
  outside.position.set((W + ox0) / 2, -0.004, D + outLen / 2);
  G.room.add(outside);

  // Strip drain
  if (cfg.drain.show) {
    const zc = D + mm(cfg.drain.offset);
    const w = mm(cfg.drain.width);
    const x0 = v.hideLeft ? 0 : whiteM().x0, x1 = W;
    const g = new THREE.Group();
    g.add(boxAt(x0, -0.03, zc - w / 2, x1, 0.001, zc + w / 2, MAT.grate));
    const bars = [];
    for (let x = x0 + 0.01; x < x1 - 0.005; x += 0.018) {
      const b = new THREE.BoxGeometry(0.006, 0.004, w - 0.012);
      b.translate(x, 0.0025, zc);
      bars.push(b);
    }
    const barMesh = mesh(mergeGeometries(bars), MAT.black, false, true);
    g.add(barMesh);
    g.add(boxAt(x0, 0.0005, zc - w / 2 - 0.006, x1, 0.003, zc - w / 2, MAT.black));
    g.add(boxAt(x0, 0.0005, zc + w / 2, x1, 0.003, zc + w / 2 + 0.006, MAT.black));
    tip(g, 'Strip drain grate', `${cfg.drain.width} mm wide · centre ${cfg.drain.offset >= 0 ? cfg.drain.offset + ' mm outside' : -cfg.drain.offset + ' mm inside'} the opening line`);
    G.room.add(g);
  }

  // Back wall: tan face brick
  const back = brickAt(-0.12, -0.12, -0.23, W + 0.23, H + 0.02, 0);
  tip(back, 'Back wall', 'Face brick');
  G.room.add(back);

  // Left wall: black vertical weatherboard on battens, over the brick leaf of the 250 mm wall between the units
  if (!v.hideLeft) {
    const lw = ownMesh(boxAt(-LCLAD, -0.12, -0.23, 0, H + 0.02, D, texturedMat(MAT.weather, (D + 0.23) / 0.81, 1, xray ? { transparent: true, opacity: 0.22, depthWrite: false } : {})));
    tip(lw, 'Left wall: weatherboard cladding', 'Black vertical boards on battens over the brick of the 250 mm wall between the two units');
    G.room.add(lw);
    const leaf = brickAt(-LCLAD - LBRICK, -0.12, -0.23, -LCLAD, H + 0.02, D);
    tip(leaf, 'Brick behind the weatherboard (assumed 110 mm leaf)', `Part of the 250 mm wall between the two units. The boundary runs down its middle, about ${Math.round((PARTY / 2) * 1000)} mm in from this brick face: keep anchors to 70 mm deep and never drill through.`);
    G.room.add(leaf);
    const wr = whiteM();
    const pier = boxAt(wr.x0, -0.12, D, wr.x1, H + 0.62, D + wr.len, MAT.render);
    tip(pier, 'White wall return', `${cfg.nook.ret} mm deep, stands ${cfg.nook.retStep} mm proud of the weatherboard; ${cfg.nook.width - cfg.nook.retStep} mm to the brick`);
    G.room.add(pier);
    if (ctx) {
      const fl = 1.8 + 0.3;
      const fence = ownMesh(boxAt(wr.x0 - 0.02, -0.01, D + wr.len, wr.x0, 1.85, D + 2.4, texturedMat(MAT.fence, (fl + 0.6) / 0.6, 1)));
      fence.rotation.y = 0;
      tip(fence, 'Boundary fence');
      G.room.add(fence);
    }
  }

  // Right wall: grey face brick, continues past the opening. Laundry door: ~90 mm brick sill and a
  // 24 mm board under an 820 × 2040 leaf, 50 mm frame head, brick above; 600 × 1020 window beside it.
  const d = doorM();
  if (!v.hideRight) {
    const top = H + 0.62;
    const brickBox = (z0, z1, y0, y1) => brickAt(W, y0, z0, W + 0.23, y1, z1);
    if (cfg.door.show) {
      const win = d.win;
      const zEnd = win ? win.z1 : d.z1;
      G.room.add(brickBox(-0.23, d.z0, -0.12, top));
      G.room.add(brickBox(zEnd, D + 2.4, -0.12, top));
      G.room.add(brickBox(d.z0, zEnd, d.headTop, top));
      G.room.add(brickBox(d.z0, d.z1, -0.12, d.brickTop));
      const door = new THREE.Group();
      const fx0 = W + 0.06, fx1 = W + 0.17, j = 0.04;
      const toLaundry = cfg.door.opens !== 'nook';
      const hingeWin = cfg.door.hinge !== 'back';
      const hingeZ = hingeWin ? d.z1 - j : d.z0 + j, latchZ = hingeWin ? d.z0 + j : d.z1 - j;
      const towardHinge = Math.sign(hingeZ - latchZ);
      const lx0 = W + (toLaundry ? 0.12 : 0.07), lx1 = lx0 + 0.04;
      door.add(boxAt(fx0, d.brickTop, d.z0, fx1, d.headTop, d.z0 + j, MAT.doorFrame));
      door.add(boxAt(fx0, d.brickTop, d.z1 - j, fx1, d.headTop, d.z1 + (win ? 0.03 : 0), MAT.doorFrame));
      door.add(boxAt(fx0, d.leafTop, d.z0, fx1, d.headTop, zEnd, MAT.doorFrame));
      door.add(boxAt(W + 0.03, d.brickTop, d.z0 + j, W + 0.17, d.leafBot, d.z1 - j, MAT.timber));
      door.add(boxAt(lx0, d.leafBot, d.z0 + j, lx1, d.leafTop, d.z1 - j, MAT.doorLeaf));
      // lever handles on both faces, at the latch edge, levers pointing toward the hinges
      const hz = latchZ + towardHinge * 0.06; // 60 mm backset from the latch edge
      for (const [xf, dir] of [[lx0, -1], [lx1, 1]]) door.add(leverHandle(xf, dir, d.leafBot + 1.0, hz, towardHinge));
      // hinge knuckles on the face the door opens toward
      const kx = toLaundry ? lx1 + 0.006 : lx0 - 0.006;
      for (const hy of [0.2, 1.0, 1.8]) door.add(cyl(0.007, 0.007, 0.1, MAT.ssDull, kx, d.leafBot + hy + 0.05, hingeZ, 12));
      tip(door, 'Laundry door', `${cfg.door.width} × 2040 leaf on a 24 mm board and ~90 mm brick sill, ${cfg.door.fromBack} mm from the back wall. Hinged at the ${hingeWin ? 'window' : 'back-wall'} end, opens into the ${toLaundry ? 'laundry' : 'nook'}, handles on both sides.`);
      G.room.add(door);
      if (!toLaundry) {
        // swing arc on the nook floor
        const r = mm(cfg.door.width), pts = [];
        for (let i = 0; i <= 32; i++) {
          const ang = (Math.PI / 2) * (i / 32);
          const px = lx0 - r * Math.sin(ang), pz = hingeZ - towardHinge * r * Math.cos(ang);
          pts.push(V(px, floorY(pz) + 0.004, pz));
        }
        const arc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0x2c3136, dashSize: 0.04, gapSize: 0.03 }));
        arc.computeLineDistances();
        arc.userData.ownMat = true;
        G.room.add(arc);
        doorSwing = { cx: lx0, cz: hingeZ, r, toward: -towardHinge, leafBot: d.leafBot };
      }
      if (win) {
        G.room.add(brickBox(d.z1, zEnd, -0.12, win.sill - 0.075));
        G.room.add(brickAt(W - 0.018, win.sill - 0.075, d.z1, W + 0.1, win.sill, zEnd));
        const w = new THREE.Group();
        w.add(boxAt(fx0, win.sill, zEnd - j, fx1, d.headTop, zEnd, MAT.doorFrame));
        w.add(boxAt(fx0, win.sill, d.z1, fx1, win.sill + 0.045, zEnd, MAT.doorFrame));
        w.add(boxAt(W + 0.11, win.sill + 0.045, d.z1 + 0.03, W + 0.116, d.leafTop, zEnd - j, MAT.glass));
        tip(w, 'Laundry window', `${cfg.door.window} × ${cfg.door.windowH}, head level with the door frame`);
        G.room.add(w);
      }
    } else {
      G.room.add(brickBox(-0.23, D + 2.4, -0.12, top));
    }
    if (ctx) {
      for (const [y0, y1] of [[0.22, 0.86], [0.98, 1.62]]) {
        const ac = new THREE.Group();
        const z0 = D + 1.0, z1 = D + 1.85;
        ac.add(boxAt(W - 0.31, y0, z0, W - 0.01, y1, z1, MAT.ac));
        const grillR = 0.25;
        const gr = new THREE.Mesh(new THREE.CircleGeometry(grillR, 40), MAT.fan);
        gr.position.set(W - 0.312, (y0 + y1) / 2, z0 + 0.32);
        gr.rotation.y = -PI / 2;
        ac.add(gr);
        tip(ac, 'Air-con condenser', 'Context only');
        G.room.add(ac);
      }
    }
  }

  // Ceiling (plasterboard) + the storey above with its black clad face
  if (!v.hideCeiling) {
    const ceil = ownMesh(boxAt(0, H, 0, W, H + 0.013, D, MAT.plaster.clone()));
    if (xray) Object.assign(ceil.material, { transparent: true, opacity: 0.25, depthWrite: false });
    tip(ceil, 'Plasterboard ceiling', 'Not structural: fix through it into joists or blocking');
    G.room.add(ceil);
    const lamp = cyl(0.045, 0.045, 0.006, MAT.light, W / 2, H - 0.003, D / 2, 24);
    lamp.castShadow = false;
    G.room.add(lamp);
    const vent = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.13), MAT.vent);
    vent.rotation.x = PI / 2;
    vent.position.set(W - 0.22, H - 0.002, 0.42);
    tip(vent, 'Ceiling vent');
    G.room.add(vent);
    // the head of the opening steps down twice: an 18 × 18 trim under the plasterboard edge, then the 9 mm
    // weatherboard on the face, 7 mm below the trim (25 mm below the plasterboard)
    const zW = D + CEIL.face; // weatherboard face over the opening
    const trim = boxAt(0, H - CEIL.trim, zW - CEIL.wb - CEIL.trim, W, H, zW - CEIL.wb, MAT.trim);
    tip(trim, 'Ceiling trim', '18 × 18 mm trim along the plasterboard edge at the opening');
    G.room.add(trim);
    const lip = ownMesh(boxAt(whiteM().x1, H - CEIL.trim - CEIL.wbDrop, zW - CEIL.wb, W, H + 0.013, zW, texturedMat(MAT.weather, W / 0.81, 0.05)));
    tip(lip, 'Weatherboard edge', `9 mm weatherboard on the face over the opening, its bottom edge ${Math.round(CEIL.wbDrop * 1000)} mm below the trim (${Math.round((CEIL.trim + CEIL.wbDrop) * 1000)} mm below the plasterboard). The top of the U frame butts up under it.`);
    G.room.add(lip);
    if (!xray) {
      const upper = ownMesh(boxAt(whiteM().x0, H + 0.013, -0.23, W + 0.23, H + 0.62, D + CEIL.face, texturedMat(MAT.weather, (W + 0.35) / 0.81, 1)));
      tip(upper, 'Bulkhead / storey above', 'Black clad face over the opening');
      G.room.add(upper);
    } else {
      // Only the outer face, so the framing behind is visible
      const face = ownMesh(boxAt(whiteM().x0, H + 0.013, D - 0.02, W + 0.23, H + 0.62, D, texturedMat(MAT.weather, (W + 0.35) / 0.81, 1, { transparent: true, opacity: 0.3, depthWrite: false })));
      G.room.add(face);
    }
  }

  // Assumed construction (x-ray): battens behind the weatherboard (the brick leaf shows through), head beam, joists.
  if (xray) {
    if (!v.hideLeft) {
      for (let y = 0.3; y < H - 0.1; y += 0.6) {
        const b = boxAt(-LCLAD, y, 0, -0.018, y + 0.045, D, MAT.stud);
        tip(b, 'Cladding batten (assumed)', '35 mm battens at about 600 mm centres hold the vertical boards off the brick');
        G.xray.add(b);
      }
    }
    if (!v.hideCeiling) {
      const hb = boxAt(-0.10, H + 0.013, D - 0.2, W + 0.05, H + 0.31, D - 0.02, MAT.stud);
      tip(hb, 'Head beam / trimmer over the opening (assumed)', 'The wall above the opening must bear on something here. Best fixing point for the headbox.');
      G.xray.add(hb);
      for (const jm of cfg.nook.joists || []) {
        const x = W - jm / 1000;
        const j = boxAt(x - 0.0225, H + 0.013, 0.02, x + 0.0225, H + 0.203, D - 0.2, MAT.stud);
        tip(j, 'Ceiling joist', `Runs front to back, ${jm} mm from the brick (measured); the U frame's tabs screw into it`);
        G.xray.add(j);
      }
    }
  }

  // Lights follow the nook
  sun.position.set(W / 2 + 2.6, 5.4, D + 4.2);
  sun.target.position.set(W / 2, 0.6, D / 2);
  downlight.position.set(W / 2, H - 0.03, D / 2);
  downlight.target.position.set(W / 2, 0, D / 2);
  downlight.visible = !v.hideCeiling;
}

/* =====================================================================
   Rack It shelving
   ===================================================================== */
const geoCache = {};
function shared(g) { g.userData.shared = true; return g; }
// Box with UVs in metres (so the hammer-tone texture keeps its scale on long thin parts)
function boxGeoM(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // px nx py ny pz nz
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
  }
  return g;
}
// Merge mixed indexed / non-indexed parts into one non-indexed geometry (position, normal, uv)
function mergeNI(geos) {
  const parts = geos.map((g) => {
    const n = g.index ? g.toNonIndexed() : g.clone();
    for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
    return n;
  });
  const out = mergeGeometries(parts);
  geos.forEach((g) => g.dispose()); parts.forEach((g) => g.dispose());
  return out;
}
// Width of a slot at depth y below its top (slots narrow downward, so the hooks wedge in the narrow part)
const slotWidthAt = (spec, y) => spec.slotW - (spec.slotW - spec.slotTip) * clamp(y / spec.slotH, 0, 1);
// Straight edge of the bay-side slot column, measured from the outer edge of the slotted face
const bayCol = (spec) => spec.post - spec.slotEdge;

// Upright post, built for the back-left corner of a bay (bay toward +x and +z): roll-formed C with the slotted face
// in z ∈ [0, t] across x ∈ [0, post], the side flange in the end-frame plane (x ∈ [0, t]) and a return on the bay
// side. The other corners are mirror images (see CORNERS), so the bay-side column always faces the bay.
const POST_LIP = 0.010; // width of the stiffening lip on the side flange (the end-frame members butt onto it)
function postGeo(spec) {
  const key = 'post-' + spec.key;
  if (geoCache[key]) return geoCache[key];
  const { post: F, side: S, ret: R, postT: t, height: H } = spec;
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(F, 0); s.lineTo(F, H); s.lineTo(0, H); s.lineTo(0, 0);
  for (let n = 1; n <= spec.slots; n++) {
    const top = slotTopY(spec, n), bot = top - spec.slotH;
    // right trapezoids: straight edge toward the middle of the face, sloping outer edge, narrowing downward
    for (const [e, dir] of [[spec.slotEdge, -1], [F - spec.slotEdge, 1]]) {
      const p = new THREE.Path();
      p.moveTo(e, top); p.lineTo(e + dir * spec.slotW, top); p.lineTo(e + dir * spec.slotTip, bot); p.lineTo(e, bot); p.lineTo(e, top);
      s.holes.push(p);
    }
  }
  const face = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 1 });
  const parts = [
    face,
    boxGeoM(t, H, S).translate(t / 2, H / 2, S / 2), // side flange (end frame)
    boxGeoM(POST_LIP, H, t).translate(POST_LIP / 2, H / 2, S - t / 2), // stiffening lip on the side flange
    boxGeoM(t, H, R).translate(F - t / 2, H / 2, R / 2), // return on the bay side
  ];
  return (geoCache[key] = shared(mergeNI(parts)));
}
// Beam: closed step section, outer face flush with the end plates, deck step on the inner top edge.
// Profile u = depth from the outer face, v = height; extruded along +x for the clear width between the posts.
function beamGeo(spec) {
  const key = 'beam-' + spec.key;
  if (geoCache[key]) return geoCache[key];
  const { beamD: d, beamH: h, deckT: st } = spec;
  const r = spec.lip + spec.plateT, c = 0.002;
  const g = extrudeX((p) => {
    p.moveTo(0, c); p.lineTo(c, 0); p.lineTo(d - c, 0); p.lineTo(d, c); p.lineTo(d, h - st);
    p.lineTo(r, h - st); p.lineTo(r, h - c); p.lineTo(r - c, h); p.lineTo(c, h); p.lineTo(0, h - c); p.lineTo(0, c);
  }, innerW(spec), 1);
  return (geoCache[key] = shared(g));
}
// End plate of one beam end, in the back-left post's frame with y = 0 at the top of the beam: the plate lies on the
// slotted face over the bay-side column, and two hooks pass through slots n and n−1 and turn down behind the face.
function connGeo(spec) {
  const key = 'conn-' + spec.key;
  if (geoCache[key]) return geoCache[key];
  const { post: F, plateW: w, plateH: ph, plateT: pt, postT: t, pitch } = spec;
  const top = spec.plateTop - spec.beamTop; // plate top above the top of the beam
  const hw = Math.min(0.0035, slotWidthAt(spec, spec.hookY) - 0.001);
  const hx = bayCol(spec) + hw / 2 + 0.0004;
  // plate with rounded corners and a small edge bevel, so it reads as a separate layer on the post face
  const bv = 0.0005, rc = 0.003, x0 = F - w + bv, x1 = F - bv, y0 = top - ph + bv, y1 = top - bv;
  const s = new THREE.Shape();
  s.moveTo(x0 + rc, y0); s.lineTo(x1 - rc, y0); s.quadraticCurveTo(x1, y0, x1, y0 + rc); s.lineTo(x1, y1 - rc);
  s.quadraticCurveTo(x1, y1, x1 - rc, y1); s.lineTo(x0 + rc, y1); s.quadraticCurveTo(x0, y1, x0, y1 - rc);
  s.lineTo(x0, y0 + rc); s.quadraticCurveTo(x0, y0, x0 + rc, y0);
  const plate = new THREE.ExtrudeGeometry(s, { depth: pt - 2 * bv, bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelSegments: 1, curveSegments: 2 });
  plate.translate(0, 0, -pt + bv);
  const parts = [plate];
  for (const k of [0, 1]) {
    const y = -spec.hookY - k * pitch - spec.beamTop;
    parts.push(boxGeoM(hw, 0.009, pt + t + 0.004).translate(hx, y, (t + 0.004 - pt) / 2));
    parts.push(boxGeoM(hw, 0.009, 0.0025).translate(hx, y - 0.007, t + 0.003));
  }
  return (geoCache[key] = shared(mergeNI(parts)));
}
// Dark marks on the plate face: the two punched-out hook tabs and the two round holes (one takes the safety pin)
function connMarkGeo(spec) {
  const key = 'connMark-' + spec.key;
  if (geoCache[key]) return geoCache[key];
  const { post: F, plateW: w, plateT: pt, pitch } = spec;
  const z = -pt - 0.0002, hw = Math.min(0.0035, slotWidthAt(spec, spec.hookY) - 0.001);
  const hx = bayCol(spec) + hw / 2 + 0.0004;
  const parts = [];
  for (const k of [0, 1]) parts.push(boxGeoM(hw + 0.001, 0.011, 0.0004).translate(hx, -spec.hookY - k * pitch - spec.beamTop, z));
  for (const y of spec.holeY) {
    const c = new THREE.CylinderGeometry(0.0022, 0.0022, 0.0004, 10);
    c.rotateX(PI / 2); c.translate(F - w * 0.55, -y - spec.beamTop, z);
    parts.push(c);
  }
  return (geoCache[key] = shared(mergeNI(parts)));
}
// Shelf support brace: inverted U, ends resting on the beam steps, top flush with the step so the deck sits on it
function braceGeo(spec) {
  const key = 'brace-' + spec.key;
  if (geoCache[key]) return geoCache[key];
  const { braceW: w, braceH: bh, depth: RD, lip } = spec;
  const t = 0.0015, zi = spec.beamD - spec.plateT + 0.002;
  const parts = [boxGeoM(w, t, RD - 2 * lip - 0.002).translate(0, -t / 2, RD / 2)];
  for (const sx of [-1, 1]) parts.push(boxGeoM(t, bh, RD - 2 * zi).translate(sx * (w / 2 - t / 2), -bh / 2, RD / 2));
  return (geoCache[key] = shared(mergeNI(parts)));
}
// Welded end-frame members of the left end, in the back-left post's frame; the right end is its mirror (sx = −1).
// Every member lies in the end-frame plane, flush with the outside of the side flanges (x ∈ [0, POST_LIP], the width
// of the flange lip), and runs between the inner faces of the two posts: the lip faces at z = S (back post) and
// z = RD − S (front post). Both ends are cut plumb, so each end face sits flat on the lip face: no gap, nothing
// inside the posts. A member is the parallelogram between its two end nodes (centre-line heights on those faces),
// `bar` thick measured square to its length; angle and length follow from the nodes. Diagonals are a node chain,
// so the next diagonal starts exactly where the previous one ended, on the same post.
function frameGeo(spec) {
  const key = 'frame-' + spec.key;
  if (geoCache[key]) return geoCache[key];
  const { depth: RD, side: S } = spec;
  const { rungs, diag, bar: h } = spec.frame;
  const face = (post) => (post ? RD - S : S); // 1 = front (aisle) post, 0 = back (wall) post
  const member = (za, ya, zb, yb) => {
    const hv = (h / 2) * Math.hypot(zb - za, yb - ya) / Math.abs(zb - za); // half the plumb cut = h / 2cos(angle)
    return extrudeX((p) => {
      p.moveTo(za, ya - hv); p.lineTo(zb, yb - hv); p.lineTo(zb, yb + hv); p.lineTo(za, ya + hv); p.lineTo(za, ya - hv);
    }, POST_LIP, 1);
  };
  const parts = rungs.map((y) => member(face(0), y, face(1), y));
  for (let i = 1; i < diag.length; i++) {
    const [a, ya] = diag[i - 1], [b, yb] = diag[i];
    if (a === b) throw new Error(`${spec.title} end frame: diagonal ${i} starts and ends on the same post`);
    parts.push(member(face(a), ya, face(b), yb));
  }
  return (geoCache[key] = shared(mergeNI(parts)));
}
// Ground mounting bracket: plate under the post running in along the end frame, with an anchor hole
function footGeo(spec) {
  const key = 'foot-' + spec.key;
  if (geoCache[key]) return geoCache[key];
  const L = spec.side + 0.055;
  return (geoCache[key] = shared(boxGeoM(spec.post, 0.003, L).translate(spec.post / 2, 0.0015, L / 2)));
}
function footHoleGeo(spec) {
  const key = 'footHole-' + spec.key;
  if (geoCache[key]) return geoCache[key];
  const g = new THREE.CylinderGeometry(0.0055, 0.0055, 0.0008, 12);
  g.translate(spec.post / 2, 0.0034, spec.side + 0.028);
  return (geoCache[key] = shared(g));
}
// Wire deck sitting on the beam steps: top flush with the beams, everything within the step height `drop`
function wireDeckGeo(len, depth, drop) {
  const geos = [];
  const add = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); geos.push(g); };
  add(len, drop, 0.004, len / 2, -drop / 2, 0.002);
  add(len, drop, 0.004, len / 2, -drop / 2, depth - 0.002);
  add(0.004, drop, depth, 0.002, -drop / 2, depth / 2);
  add(0.004, drop, depth, len - 0.002, -drop / 2, depth / 2);
  const n = Math.max(2, Math.round(len / 0.05));
  for (let i = 1; i < n; i++) add(0.004, 0.004, depth - 0.004, (i * len) / n, -0.003, depth / 2);
  for (const k of [0.18, 0.5, 0.82]) add(len - 0.004, 0.0045, 0.0045, len / 2, -0.0075, depth * k);
  const m = Math.max(2, Math.round(len / 0.4));
  const ch = Math.max(0.004, drop - 0.0097);
  for (let i = 0; i < m; i++) add(0.028, ch, depth - 0.008, ((i + 0.5) * len) / m, -0.0097 - ch / 2, depth / 2);
  const out = mergeGeometries(geos);
  geos.forEach((g) => g.dispose());
  return out;
}

const rackInfo = {};
const obstacles = []; // { box: Box3, label, kind, rack, levelId, ... }

function sortedLevels(r) { return [...r.levels].sort((a, b) => a.slot - b.slot); }
function levelName(rackKey, levelId) {
  const r = cfg.racks[rackKey];
  const ls = sortedLevels(r);
  const i = ls.findIndex((l) => l.id === levelId);
  if (i < 0) return `${RACK_NAMES[rackKey]} floor`;
  return `${RACK_NAMES[rackKey]} shelf ${i + 1} (slot ${ls[i].slot}, ${levelMM(rackSpec(rackKey), ls[i].slot)} mm)`;
}

// The four posts of a bay: mirror images of the back-left one (negative scales are handled by the renderer)
const CORNERS = (RW, RD) => [
  { x: 0, z: 0, sx: 1, sz: 1, face: 'back', end: 'left' },
  { x: RW, z: 0, sx: -1, sz: 1, face: 'back', end: 'right' },
  { x: 0, z: RD, sx: 1, sz: -1, face: 'front', end: 'left' },
  { x: RW, z: RD, sx: -1, sz: -1, face: 'front', end: 'right' },
];
function atCorner(m, c, y = 0) { m.position.set(c.x, y, c.z); m.scale.set(c.sx, 1, c.sz); return m; }

function buildRacks() {
  clearGroup(G.racks);
  obstacles.length = 0;
  const { W } = dimsM();
  for (const key of ['green', 'blue']) {
    const spec = rackSpec(key);
    const r = cfg.racks[key];
    const g = new THREE.Group();
    const RW = spec.overall, RD = spec.depth, RH = spec.height, p = spec.post, pt = spec.plateT;
    // the slab falls toward the opening, so the rack stands level off its highest (back-most) feet
    // and the lower feet get packers; worldZ maps a rack-local (x, z) to world z
    let base, worldXZ;
    if (key === 'green') {
      const x = mm(r.x), z = mm(r.z);
      worldXZ = (lx, lz) => [x + lx, z + lz];
      base = floorY(z, x);
      g.position.set(x, base, z);
    } else {
      const z = mm(r.z), gap = mm(r.gap);
      worldXZ = (lx, lz) => [W - gap - lz, z + lx];
      base = floorY(z, W - gap - RD);
      g.position.set(W - gap, base, z);
      g.rotation.y = -PI / 2;
    }
    tip(g, `${spec.title} shelving`, spec.size, { rackKey: key });
    const corners = CORNERS(RW, RD);
    const P = Math.round(spec.pitch * 10000) / 10;
    // uprights with their ground brackets, end-frame members
    for (const c of corners) {
      g.add(tip(atCorner(mesh(postGeo(spec), MAT.powder), c), `${spec.title} upright`,
        `${Math.round(p * 1000)} mm face, 2 columns of ${spec.slots} slots at ${P} mm; slot 1 is ${Math.round(slotTopY(spec, 1) * 1000)} mm up`, { rackKey: key }));
      g.add(tip(atCorner(mesh(footGeo(spec), MAT.powder), c), 'Ground mounting bracket', 'Anchor to the slab (fixings not supplied)', { rackKey: key }));
      g.add(atCorner(mesh(footHoleGeo(spec), MAT.hole, false, false), c));
      // packers under this foot: from the foot down to the lowest point of the slab beneath it
      const fl = spec.side + 0.055;
      const fys = [[c.x, c.z], [c.x + c.sx * p, c.z], [c.x, c.z + c.sz * fl], [c.x + c.sx * p, c.z + c.sz * fl]].map(([a, b]) => floorY(worldXZ(a, b)[1], worldXZ(a, b)[0]));
      const top = base - Math.max(...fys), bot = base - Math.min(...fys);
      if (top > 0.0015) {
        const pk = atCorner(mesh(boxGeoM(p, bot, fl).translate(p / 2, -bot / 2, fl / 2), MAT.packer), c);
        g.add(tip(pk, 'Levelling packers', `About ${Math.round((top + bot) / 2 * 1000)} mm of plastic packers under this foot, so the rack stands level on the falling slab`, { rackKey: key }));
      }
    }
    for (const c of corners.slice(0, 2)) g.add(atCorner(mesh(frameGeo(spec), MAT.powder), { ...c, sz: 1 }));
    // levels
    const iw = innerW(spec);
    const toWorld = (bx) => { g.updateMatrixWorld(true); return bx.clone().applyMatrix4(g.matrixWorld); };
    const ls = sortedLevels(r);
    ls.forEach((lv, li) => {
      const n = lv.slot, y = levelY(spec, n), hmm = levelMM(spec, n);
      const ledge = y - spec.deckT;
      const lname = `${RACK_NAMES[key]} shelf ${li + 1} (slot ${n}, ${hmm} mm)`;
      const lgrp = new THREE.Group();
      const cut = lv.deck !== 'none' && (lv.from > 0 || lv.to < spec.usable) ? ` from ${lv.from} to ${lv.to} mm (cut)` : '';
      tip(lgrp, `${spec.title} · shelf ${li + 1} · slot ${n}`, `${hmm} mm to the top of the beam · ${{ none: 'beams only', mdf: 'MDF', wire: 'wire', acacia: 'acacia board' }[lv.deck]} deck${cut}`, { rackKey: key });
      const beam = beamGeo(spec);
      if (lv.back) {
        const b = mesh(beam, MAT.powder);
        b.position.set(p, y - spec.beamH, -pt);
        lgrp.add(b);
        obstacles.push({ kind: 'beam', rack: key, levelId: lv.id, label: `back beam of ${lname}`, box: toWorld(new THREE.Box3(V(p, y - spec.beamH, -pt), V(RW - p, y, spec.beamD - pt))) });
      }
      if (lv.front) {
        const b = mesh(beam, MAT.powder);
        b.rotation.y = PI;
        b.position.set(RW - p, y - spec.beamH, RD + pt);
        lgrp.add(b);
        obstacles.push({ kind: 'beam', rack: key, levelId: lv.id, label: `front beam of ${lname}`, box: toWorld(new THREE.Box3(V(p, y - spec.beamH, RD - spec.beamD + pt), V(RW - p, y, RD + pt))) });
      }
      // end plates: two hooks in slots n−1 and n of the bay-side column of each post
      for (const c of corners) {
        if (!(c.face === 'back' ? lv.back : lv.front)) continue;
        lgrp.add(tip(atCorner(mesh(connGeo(spec), MAT.powder), c, y), `Beam end plate · slots ${n - 1} and ${n}`,
          `Two hooks in the bay-side column of the ${c.face} ${c.end} upright; the outer column stays free for a neighbouring bay`, { rackKey: key }));
        lgrp.add(atCorner(mesh(connMarkGeo(spec), MAT.hole, false, false), c, y));
      }
      if (lv.deck !== 'none') {
        const from = clamp(mm(lv.from), 0, iw - 0.05);
        const to = clamp(mm(lv.to), from + 0.05, iw);
        const x0 = p + from, x1 = p + to;
        const dz0 = spec.lip, dz1 = RD - spec.lip;
        let top = y;
        if (lv.deck === 'mdf') {
          lgrp.add(boxAt(x0, ledge, dz0, x1, y, dz1, MAT.mdf));
        } else if (lv.deck === 'acacia') {
          top = ledge + ACACIA_T;
          lgrp.add(ownMesh(boxAt(x0, ledge, dz0, x1, top, dz1, texturedMat(MAT.acacia, (x1 - x0) / 0.5, (dz1 - dz0) / 0.5))));
        } else {
          const wd = mesh(wireDeckGeo(x1 - x0, dz1 - dz0, spec.deckT), MAT.powder);
          wd.position.set(x0, y, dz0);
          lgrp.add(wd);
        }
        obstacles.push({ kind: 'deck', rack: key, levelId: lv.id, from: lv.from, to: lv.to, label: `${lname} deck`, box: toWorld(new THREE.Box3(V(x0, ledge, dz0), V(x1, top, dz1))) });
        // support braces front-to-back under the deck, evenly spaced, left out where the deck is cut
        const zi = spec.beamD - pt;
        for (let i = 1; i <= spec.braces; i++) {
          const bx = p + (i * iw) / (spec.braces + 1);
          if (bx < x0 + 0.02 || bx > x1 - 0.02) continue;
          const br = mesh(braceGeo(spec), MAT.powder);
          br.position.set(bx, ledge, 0);
          lgrp.add(br);
          obstacles.push({ kind: 'brace', rack: key, levelId: lv.id, label: `support brace under ${lname}`, box: toWorld(new THREE.Box3(V(bx - spec.braceW / 2, ledge - spec.braceH, zi), V(bx + spec.braceW / 2, ledge, RD - zi))) });
        }
      }
      g.add(lgrp);
    });
    G.racks.add(g);
    g.updateMatrixWorld(true);
    const frame = new THREE.Box3(V(0, 0, -pt), V(RW, RH, RD + pt)).applyMatrix4(g.matrixWorld);
    rackInfo[key] = { group: g, spec, base, frame };
  }
}

/* =====================================================================
   Equipment models (origin at bottom centre, front faces +z)
   ===================================================================== */
const BUILD = {
  unitank() {
    const g = new THREE.Group();
    const R = 0.2, py = 0.12;
    // swivel castors with brake pedals
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const cx = sx * 0.2, cz = sz * 0.2;
      g.add(cylBetween(0.037, V(cx - 0.012, 0.037, cz + 0.012), V(cx + 0.012, 0.037, cz + 0.012), MAT.wheel, 24));
      g.add(cylBetween(0.014, V(cx - 0.0135, 0.037, cz + 0.012), V(cx + 0.0135, 0.037, cz + 0.012), MAT.ss, 12));
      for (const s of [-1, 1]) g.add(box(0.004, 0.06, 0.056, MAT.ss, cx + s * 0.018, 0.058, cz + 0.006));
      g.add(cyl(0.024, 0.024, 0.012, MAT.ss, cx, 0.094, cz, 20));
      g.add(box(0.066, 0.005, 0.066, MAT.ss, cx, 0.103, cz));
      const brake = box(0.026, 0.005, 0.034, MAT.ss, cx, 0.074, cz + 0.05);
      brake.rotation.x = -0.35;
      g.add(brake);
    }
    // perforated platform on a box-section frame
    g.add(box(0.47, 0.003, 0.47, MAT.perf, 0, py, 0));
    for (const s of [-1, 1]) {
      g.add(box(0.47, 0.016, 0.018, MAT.ss, 0, py - 0.009, s * 0.226));
      g.add(box(0.018, 0.016, 0.47, MAT.ss, s * 0.226, py - 0.009, 0));
    }
    // legs: square tube with an extension sleeve, foot plates and shell brackets
    const legTop = 0.875;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const lx = sx * 0.168, lz = sz * 0.168;
      g.add(box(0.05, 0.005, 0.05, MAT.ss, lx, py + 0.004, lz));
      g.add(box(0.034, legTop - py, 0.034, MAT.ss, lx, (py + legTop) / 2, lz));
      g.add(box(0.038, 0.07, 0.038, MAT.ssDull, lx, 0.39, lz));
      g.add(box(0.034, 0.012, 0.034, MAT.ss, lx, legTop + 0.006, lz));
      const br = cylBetween(0.006, V(lx, legTop - 0.02, lz), V(lx * 0.72, legTop - 0.005, lz * 0.72), MAT.ss, 8);
      g.add(br);
      if (sz > 0) g.add(decal(TEX.psi, 0.03, 0.094, lx, legTop - 0.075, lz + 0.0175));
    }
    // vessel in its neoprene jacket: cone, straight wall, shoulder
    const prof = [[0, 0.552], [0.028, 0.552], [0.034, 0.565], [R, 0.742], [R, 1.15], [R - 0.008, 1.178], [R - 0.03, 1.198], [0.15, 1.21], [0.142, 1.212]].map(([x, y]) => new THREE.Vector2(x, y));
    g.add(core(mesh(new THREE.LatheGeometry(prof, 56), MAT.neoprene)));
    for (const [y, r] of [[0.742, R + 0.001], [1.15, R + 0.001]]) {
      const seam = mesh(new THREE.TorusGeometry(r, 0.0025, 4, 56), MAT.seam);
      seam.rotation.x = PI / 2; seam.position.y = y; g.add(seam);
    }
    g.add(box(0.006, 0.4, 0.004, MAT.seam, 0, 0.95, -R - 0.001)); // zip at the back
    // top: 6" TC lid with clamp, gauge, PRV, glycol coil ports
    const top = 1.212;
    g.add(cyl(0.142, 0.142, 0.016, MAT.ss, 0, top + 0.008, 0, 40));
    g.add(aimed(tcClamp(0.14), V(0, top + 0.012, 0), V(0, 1, 0)));
    g.add(cyl(0.136, 0.136, 0.01, MAT.ss, 0, top + 0.021, 0, 40));
    g.add(cyl(0.07, 0.13, 0.014, MAT.ss, 0, top + 0.033, 0, 40));
    g.add(aimed(tcStub(0.019, 0.032), V(-0.07, top + 0.03, 0.03), V(0, 1, 0)));
    g.add(cylBetween(0.006, V(-0.07, top + 0.062, 0.03), V(-0.07, top + 0.09, 0.03), MAT.ss, 8));
    g.add(cylBetween(0.033, V(-0.07, top + 0.12, 0.018), V(-0.07, top + 0.12, 0.04), MAT.ss, 28));
    g.add(cylBetween(0.029, V(-0.07, top + 0.12, 0.0401), V(-0.07, top + 0.12, 0.041), MAT.dialFace, 28));
    g.add(aimed(tcStub(0.019, 0.032), V(0.07, top + 0.03, 0.0), V(0, 1, 0)));
    g.add(cyl(0.016, 0.016, 0.034, MAT.ss, 0.07, top + 0.08, 0, 16));
    g.add(cyl(0.017, 0.017, 0.006, MAT.yellow, 0.07, top + 0.09, 0, 16));
    for (const x of [-0.025, 0.025]) {
      g.add(cylBetween(0.0065, V(x, top + 0.04, -0.075), V(x, top + 0.095, -0.075), MAT.ss, 10));
      g.add(cyl(0.011, 0.011, 0.012, MAT.ss, x, top + 0.046, -0.075, 6));
    }
    // right-hand tee: rigid cane up to the lid, ball-lock gas post
    const tee = rp(48, 0.245, 0.665);
    g.add(aimed(tcStub(0.019, 0.05), rp(48, 0.175, 0.665), rp(48, 1, 0)));
    g.add(cylBetween(0.021, V(tee.x, 0.63, tee.z), V(tee.x, 0.7, tee.z), MAT.ss, 18));
    g.add(aimed(tcClamp(0.021), V(tee.x, 0.7, tee.z), V(0, 1, 0)));
    g.add(tube([V(tee.x, 0.7, tee.z), V(tee.x, 0.95, tee.z), V(tee.x, 1.2, tee.z), rp(46, 0.235, 1.262), rp(40, 0.17, 1.278), rp(34, 0.12, 1.26)], 0.0075, MAT.ss, 64, 10));
    const post0 = V(tee.x, 0.635, tee.z), post1 = rp(62, 0.29, 0.6);
    g.add(cylBetween(0.009, post0, post1, MAT.ss, 6));
    g.add(cylBetween(0.015, post1, rp(66, 0.33, 0.585), MAT.black, 18));
    g.add(cylBetween(0.005, rp(66, 0.33, 0.585), rp(69, 0.36, 0.575), MAT.ss, 8));
    // FTSs controller over the thermowell
    g.add(box(0.1, 0.062, 0.036, MAT.black, 0, 0.83, R + 0.012));
    g.add(decal(TEX.ftss, 0.052, 0.02, 0, 0.842, R + 0.0302));
    for (const x of [0.03, 0.041]) g.add(box(0.008, 0.008, 0.004, MAT.grille, x, 0.842, R + 0.031));
    g.add(cylBetween(0.008, V(0, 0.814, R + 0.03), V(0, 0.814, R + 0.034), MAT.grille, 16));
    g.add(aimed(tcStub(0.019, 0.03), V(0, 0.765, R - 0.004), V(0, 0, 1)));
    g.add(decal(TEX.ss, 0.088, 0.088, 0, 1.0, R + 0.004));
    // cone: sample valve, racking arm valve, carb stone port
    g.add(aimed(tcStub(0.016, 0.045), rp(-38, 0.155, 0.69), rp(-38, 1, 0)));
    g.add(cylBetween(0.012, rp(-38, 0.205, 0.69), rp(-38, 0.235, 0.69), MAT.ss, 12));
    g.add(box(0.034, 0.01, 0.012, MAT.blueHandle, ...rp(-38, 0.222, 0.705).toArray()));
    g.add(aimed(tcStub(0.022, 0.06), V(0, 0.648, 0.12), V(0, 0, 1)));
    g.add(aimed(butterfly(0.022), V(0, 0.648, 0.185), V(0, 0, 1)));
    g.add(cylBetween(0.022, V(0, 0.648, 0.215), V(0, 0.648, 0.235), MAT.ss, 18));
    g.add(aimed(tcStub(0.016, 0.04), rp(82, 0.15, 0.68), rp(82, 1, 0)));
    g.add(cylBetween(0.011, rp(82, 0.19, 0.68), rp(82, 0.215, 0.68), MAT.ss, 10));
    // dump valve, sight glass, elbow
    g.add(cyl(0.026, 0.026, 0.018, MAT.ss, 0, 0.543, 0, 20));
    g.add(aimed(tcClamp(0.026), V(0, 0.535, 0), V(0, 1, 0)));
    g.add(aimed(butterfly(0.025), V(0, 0.502, 0), V(0, 1, 0)));
    g.add(aimed(tcClamp(0.026), V(0, 0.5, 0), V(0, 1, 0)));
    g.add(cyl(0.031, 0.031, 0.01, MAT.ss, 0, 0.492, 0, 20));
    g.add(cyl(0.02, 0.02, 0.075, MAT.clear, 0, 0.45, 0, 20));
    for (let i = 0; i < 4; i++) g.add(cylBetween(0.003, rp(i * 90 + 45, 0.027, 0.413), rp(i * 90 + 45, 0.027, 0.488), MAT.ss, 6));
    g.add(cyl(0.031, 0.031, 0.01, MAT.ss, 0, 0.408, 0, 20));
    g.add(aimed(tcClamp(0.026), V(0, 0.402, 0), V(0, 1, 0)));
    g.add(tube([V(0, 0.4, 0), V(0, 0.365, 0), V(0, 0.34, 0.028), V(0, 0.335, 0.07)], 0.02, MAT.ss, 24, 16));
    const endF = cylBetween(0.026, V(0, 0.335, 0.07), V(0, 0.335, 0.08), MAT.ss, 20); g.add(endF);
    g.add(cylBetween(0.016, V(0, 0.335, 0.0795), V(0, 0.335, 0.0805), MAT.hole, 16));
    return g;
  },
  hlt() {
    const g = new THREE.Group();
    const R = 0.225, H = 0.46;
    const body = mesh(new THREE.CylinderGeometry(R, R, H, 48, 1, true), MAT.ssDouble);
    body.position.y = H / 2;
    g.add(core(body));
    g.add(core(cyl(R, R, 0.006, MAT.ss, 0, 0.003, 0, 48)));
    const rim = mesh(new THREE.TorusGeometry(R, 0.005, 8, 64), MAT.ss); rim.rotation.x = PI / 2; rim.position.y = H; g.add(rim);
    for (const s of [-1, 1]) {
      g.add(cylBetween(0.012, V(s * (R + 0.045), H - 0.06, -0.06), V(s * (R + 0.045), H - 0.06, 0.06), MAT.rubber, 12));
      for (const zz of [-0.055, 0.055]) g.add(box(0.05, 0.014, 0.012, MAT.ss, s * (R + 0.022), H - 0.06, zz));
    }
    // dial thermometer with a valve below it
    g.add(cylBetween(0.008, rp(-32, R, H - 0.06), rp(-32, R + 0.05, H - 0.06), MAT.ss, 10));
    g.add(cylBetween(0.042, rp(-32, R + 0.05, H - 0.06), rp(-32, R + 0.068, H - 0.06), MAT.ss, 28));
    g.add(cylBetween(0.038, rp(-32, R + 0.068, H - 0.06), rp(-32, R + 0.0695, H - 0.06), MAT.dialFace, 28));
    g.add(cylBetween(0.012, rp(-18, R, H - 0.13), rp(-18, R + 0.07, H - 0.13), MAT.ss, 12));
    g.add(box(0.03, 0.03, 0.03, MAT.ss, ...rp(-18, R + 0.05, H - 0.13).toArray()));
    // bottom 3-piece ball valve, mid barb with cap
    g.add(cylBetween(0.016, rp(-62, R, 0.05), rp(-62, R + 0.12, 0.05), MAT.ss, 14));
    g.add(box(0.045, 0.045, 0.045, MAT.ss, ...rp(-62, R + 0.06, 0.05).toArray()));
    const lv = box(0.012, 0.012, 0.1, MAT.ss, ...rp(-55, R + 0.07, 0.085).toArray()); lv.rotation.y = rad(-55); g.add(lv);
    g.add(cylBetween(0.011, rp(-70, R, 0.17), rp(-70, R + 0.06, 0.17), MAT.ss, 12));
    g.add(cyl(0.014, 0.014, 0.03, MAT.green, ...rp(-70, R + 0.075, 0.17).toArray(), 12));
    // right side port
    g.add(cylBetween(0.018, rp(65, R, 0.07), rp(65, R + 0.05, 0.07), MAT.ss, 14));
    // etched NANO Brewery mark
    const lbl = decal(TEX.nano, 0.15, 0.075, ...rp(-8, R + 0.003, 0.3).toArray(), rad(-8));
    g.add(lbl);
    return g;
  },
  mashtun() {
    const g = new THREE.Group();
    const R = 0.25, H = 0.584;
    g.add(core(cyl(R, R, H, MAT.ss, 0, H / 2, 0, 56)));
    const rim = mesh(new THREE.TorusGeometry(R, 0.007, 8, 64), MAT.ss); rim.rotation.x = PI / 2; rim.position.y = H; g.add(rim);
    g.add(core(cyl(R + 0.01, R + 0.01, 0.026, MAT.ss, 0, H + 0.013, 0, 56)));
    g.add(cyl(R - 0.06, R + 0.01, 0.035, MAT.ss, 0, H + 0.043, 0, 56));
    for (const s of [-1, 1]) g.add(cyl(0.01, 0.01, 0.05, MAT.ss, s * 0.07, H + 0.085, 0, 10));
    g.add(cylBetween(0.012, V(-0.085, H + 0.11, 0), V(0.085, H + 0.11, 0), MAT.black, 12));
    for (const s of [-1, 1]) {
      g.add(cylBetween(0.012, V(s * (R + 0.05), H - 0.1, -0.06), V(s * (R + 0.05), H - 0.1, 0.06), MAT.black, 12));
      for (const zz of [-0.055, 0.055]) g.add(box(0.055, 0.016, 0.014, MAT.ss, s * (R + 0.026), H - 0.1, zz));
    }
    // LCD thermometer
    g.add(box(0.07, 0.045, 0.03, MAT.black, 0, 0.17, R + 0.014));
    g.add(decal(TEX.ftss, 0.045, 0.017, 0, 0.172, R + 0.0295));
    // manometer tube
    g.add(cylBetween(0.008, rp(-42, R + 0.03, 0.05), rp(-42, R + 0.03, 0.56), MAT.clear, 10));
    for (const yy of [0.12, 0.3, 0.5]) g.add(box(0.03, 0.02, 0.03, MAT.black, ...rp(-42, R + 0.018, yy).toArray()));
    g.add(cylBetween(0.01, rp(-42, R, 0.05), rp(-42, R + 0.03, 0.05), MAT.ss, 10));
    // Pure Flow valve at the bottom front-right with a long lever
    g.add(cylBetween(0.024, rp(28, R - 0.01, 0.04), rp(28, R + 0.05, 0.04), MAT.ss, 18));
    g.add(cylBetween(0.032, rp(28, R + 0.05, 0.04), rp(28, R + 0.09, 0.04), MAT.ss, 18));
    g.add(cylBetween(0.014, rp(28, R + 0.09, 0.04), rp(28, R + 0.14, 0.04), MAT.ss, 12));
    const lever = box(0.018, 0.012, 0.2, MAT.ss, ...rp(40, R + 0.16, 0.09).toArray());
    lever.rotation.y = rad(40); lever.rotation.x = rad(-18);
    g.add(lever);
    g.add(decal(TEX.heat, 0.06, 0.033, ...rp(12, R + 0.002, 0.075).toArray(), rad(12)));
    g.add(decal(TEX.ssEtch, 0.11, 0.07, ...rp(-8, R + 0.002, 0.45).toArray(), rad(-8)));
    return g;
  },
  kettle() {
    const g = new THREE.Group();
    const R = 0.22, sk = 0.1, H = 0.52;
    const skirt = mesh(new THREE.CylinderGeometry(R + 0.006, R + 0.006, sk, 48, 1, true), MAT.skirt);
    skirt.position.y = sk / 2; g.add(skirt);
    g.add(cyl(R + 0.004, R + 0.004, 0.006, MAT.ssDull, 0, 0.003, 0, 48));
    g.add(core(cyl(R, R, H, MAT.ss, 0, sk + H / 2, 0, 56)));
    const rim = mesh(new THREE.TorusGeometry(R, 0.006, 8, 64), MAT.ss); rim.rotation.x = PI / 2; rim.position.y = sk + H; g.add(rim);
    g.add(cyl(R + 0.008, R + 0.008, 0.01, MAT.ss, 0, sk + H + 0.005, 0, 56));
    g.add(cyl(0.12, R + 0.008, 0.035, MAT.ss, 0, sk + H + 0.027, 0, 56));
    g.add(cylBetween(0.012, V(-0.06, sk + H + 0.085, 0), V(0.06, sk + H + 0.085, 0), MAT.black, 12));
    for (const s of [-1, 1]) g.add(cyl(0.008, 0.008, 0.04, MAT.ss, s * 0.05, sk + H + 0.06, 0, 8));
    for (const s of [-1, 1]) {
      g.add(cylBetween(0.012, V(s * (R + 0.045), sk + H - 0.08, -0.06), V(s * (R + 0.045), sk + H - 0.08, 0.06), MAT.black, 12));
      for (const zz of [-0.055, 0.055]) g.add(box(0.05, 0.014, 0.012, MAT.ss, s * (R + 0.022), sk + H - 0.08, zz));
    }
    for (const [a, y] of [[-40, sk + 0.06], [-40, sk + 0.17], [10, sk + 0.05]]) {
      g.add(cylBetween(0.022, rp(a, R, y), rp(a, R + 0.035, y), MAT.ss, 18));
      g.add(cylBetween(0.026, rp(a, R + 0.035, y), rp(a, R + 0.045, y), MAT.ss, 18));
    }
    g.add(decal(TEX.ssEtch, 0.12, 0.075, ...rp(-5, R + 0.002, sk + 0.42).toArray(), rad(-5)));
    return g;
  },
  g40() {
    // KegLand Icemaster G40: 410 × 410 × 660 cabinet on small castors
    const g = new THREE.Group();
    const w = 0.41, d = 0.41, hgt = 0.66, ft = 0.024;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const x = sx * 0.17, z = sz * 0.17;
      g.add(box(0.03, 0.004, 0.03, MAT.black, x, ft - 0.002, z));
      g.add(cylBetween(0.011, V(x - 0.007, 0.011, z), V(x + 0.007, 0.011, z), MAT.rubber, 14));
    }
    g.add(core(box(w, hgt, d, MAT.g40, 0, ft + hgt / 2, 0)));
    // reservoir lid line
    for (const [bw, bd, bx, bz] of [[w + 0.002, 0.004, 0, d / 2], [w + 0.002, 0.004, 0, -d / 2], [0.004, d + 0.002, w / 2, 0], [0.004, d + 0.002, -w / 2, 0]]) g.add(box(bw, 0.004, bd, MAT.grille, bx, ft + hgt - 0.012, bz));
    // pump and beer-line fittings across the top front
    const yT = ft + hgt - 0.045;
    g.add(box(0.27, 0.05, 0.006, MAT.ssDull, 0.03, yT, d / 2 + 0.003));
    for (let i = 0; i < 8; i++) {
      const x = -0.085 + i * 0.033;
      g.add(cylBetween(0.0065, V(x, yT + 0.008, d / 2 + 0.006), V(x, yT + 0.008, d / 2 + 0.024), i === 2 || i === 3 ? MAT.pvc : MAT.black, 10));
    }
    g.add(cylBetween(0.01, V(0.165, yT - 0.01, d / 2 + 0.006), V(0.165, yT - 0.01, d / 2 + 0.03), MAT.black, 12));
    g.add(cylBetween(0.01, V(0.165, yT - 0.01, d / 2 + 0.03), V(0.165, yT - 0.075, d / 2 + 0.03), MAT.black, 12));
    g.add(decal(TEX.g40, 0.085, 0.104, -0.135, ft + hgt - 0.19, d / 2 + 0.002));
    // control column: power inlet, green switch, digital controller, red switch
    const cx = -0.135, zf = d / 2;
    g.add(box(0.04, 0.03, 0.012, MAT.black, cx, ft + 0.27, zf + 0.006));
    g.add(box(0.028, 0.024, 0.012, MAT.green, cx, ft + 0.215, zf + 0.006));
    g.add(box(0.075, 0.032, 0.01, MAT.black, cx, ft + 0.155, zf + 0.005));
    g.add(decal(TEX.glyDisp, 0.05, 0.02, cx, ft + 0.155, zf + 0.0105));
    g.add(box(0.028, 0.024, 0.012, MAT.red, cx, ft + 0.09, zf + 0.006));
    // condenser vent grille
    const gx = 0.055, gy = ft + 0.16;
    g.add(box(0.26, 0.255, 0.005, MAT.greyBox, gx, gy, zf + 0.003));
    for (let r = 0; r < 11; r++) for (let c = 0; c < 5; c++) g.add(box(0.04, 0.0055, 0.002, MAT.hole, gx - 0.096 + c * 0.048, gy - 0.1 + r * 0.02, zf + 0.0062));
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(cylBetween(0.004, V(gx + sx * 0.12, gy + sy * 0.115, zf + 0.005), V(gx + sx * 0.12, gy + sy * 0.115, zf + 0.008), MAT.ss, 8));
    return g;
  },
  keg() {
    const g = new THREE.Group();
    const R = 0.108;
    g.add(core(cyl(0.112, 0.112, 0.07, MAT.rubber, 0, 0.035, 0, 32)));
    g.add(core(cyl(R, R, 0.44, MAT.ss, 0, 0.29, 0, 40)));
    const ring = mesh(new THREE.CylinderGeometry(0.112, 0.112, 0.13, 40, 1, true), MAT.rubberDouble);
    ring.position.y = 0.565; g.add(ring);
    g.add(cyl(0.05, R, 0.04, MAT.ss, 0, 0.53, 0, 32));
    const lid = cyl(0.05, 0.05, 0.012, MAT.ss, 0, 0.556, 0, 28); lid.scale.z = 0.72; g.add(lid);
    const bail = mesh(new THREE.TorusGeometry(0.028, 0.004, 6, 20, PI), MAT.ss); bail.position.set(0, 0.562, 0); g.add(bail);
    g.add(cyl(0.012, 0.012, 0.03, MAT.ssDull, -0.07, 0.565, 0, 6));
    g.add(cyl(0.012, 0.012, 0.03, MAT.ssDull, 0.07, 0.565, 0, 6));
    g.add(decal(TEX.kegLabel, 0.12, 0.07, 0, 0.32, R + 0.002));
    return g;
  },
  kegstack() {
    const g = new THREE.Group();
    const R = 0.112, rowY = Math.sqrt((2 * R) ** 2 - R ** 2);
    const spots = [[-2 * R - 0.004, R], [0, R], [2 * R + 0.004, R], [-R - 0.002, R + rowY], [R + 0.002, R + rowY]];
    for (const [x, y] of spots) {
      const k = kegModel();
      k.rotation.x = PI / 2;
      k.position.set(x, y, -0.315);
      g.add(k);
    }
    return g;
  },
  kegs4() {
    const g = new THREE.Group();
    for (const [x, z] of [[-0.116, -0.116], [0.116, -0.116], [-0.116, 0.116], [0.116, 0.116]]) {
      const k = kegModel(); k.position.set(x, 0, z); k.rotation.y = rad(x * 300 + z * 200); g.add(k);
    }
    return g;
  },
  co2() {
    const g = new THREE.Group();
    const R = 0.07;
    g.add(core(cyl(R, R, 0.46, MAT.co2, 0, 0.23, 0, 32)));
    const dome = mesh(new THREE.SphereGeometry(R, 32, 12, 0, PI * 2, 0, PI / 2), MAT.co2);
    dome.position.y = 0.46; g.add(dome);
    g.add(cyl(0.018, 0.018, 0.04, MAT.ssDull, 0, 0.545, 0, 12));
    g.add(box(0.04, 0.035, 0.035, MAT.ssDull, 0, 0.575, 0));
    g.add(cyl(0.024, 0.024, 0.012, MAT.black, 0, 0.6, 0, 16));
    g.add(cylBetween(0.026, V(0.03, 0.578, 0), V(0.06, 0.578, 0), MAT.black, 16));
    g.add(cylBetween(0.022, V(0.025, 0.6, 0.02), V(0.025, 0.6, 0.04), MAT.ssDull, 16));
    g.add(cylBetween(0.019, V(0.025, 0.6, 0.0401), V(0.025, 0.6, 0.0408), MAT.dialFace, 16));
    g.add(box(0.1, 0.06, 0.002, MAT.green, 0, 0.32, R + 0.001));
    return g;
  },
  pump() {
    const g = new THREE.Group();
    g.add(core(box(0.32, 0.018, 0.26, MAT.wood, 0, 0.009, 0)));
    g.add(box(0.13, 0.008, 0.1, MAT.black, -0.03, 0.022, 0));
    g.add(cylBetween(0.048, V(-0.13, 0.078, 0), V(0.035, 0.078, 0), MAT.black, 24));
    g.add(cylBetween(0.053, V(-0.1, 0.078, 0), V(0.0, 0.078, 0), MAT.alu, 24));
    for (let i = 0; i < 8; i++) {
      const f = box(0.1, 0.006, 0.012, MAT.alu, -0.05, 0.078, 0);
      f.rotation.x = (i * PI) / 8;
      g.add(f);
    }
    g.add(cylBetween(0.056, V(0.035, 0.078, 0), V(0.08, 0.078, 0), MAT.ss, 24));
    g.add(cylBetween(0.016, V(0.08, 0.078, 0), V(0.13, 0.078, 0), MAT.ss, 14));
    g.add(cylBetween(0.025, V(0.12, 0.078, 0), V(0.13, 0.078, 0), MAT.ss, 14));
    g.add(cylBetween(0.014, V(0.058, 0.12, 0), V(0.058, 0.18, 0), MAT.ss, 14));
    g.add(cylBetween(0.022, V(0.058, 0.17, 0), V(0.058, 0.18, 0), MAT.ss, 14));
    return g;
  },
  coil() {
    const g = new THREE.Group();
    const pts = [];
    const turns = 7, Rc = 0.15;
    for (let i = 0; i <= turns * 24; i++) {
      const t = (i / 24) * PI * 2;
      pts.push(V(Rc * Math.cos(t), 0.012 + (0.017 * i) / 24, Rc * Math.sin(t)));
    }
    const last = pts[pts.length - 1];
    pts.push(V(last.x * 0.9, last.y + 0.06, last.z * 0.9), V(last.x * 0.85, 0.3, last.z * 0.85));
    g.add(core(tube(pts, 0.0055, MAT.ss, 600, 8)));
    g.add(tube([V(Rc, 0.012, 0), V(Rc * 0.7, 0.05, 0.02), V(Rc * 0.65, 0.3, 0.02)], 0.0055, MAT.ss, 24, 8));
    return g;
  },
  pan() {
    const g = new THREE.Group();
    const L = 0.53, Wd = 0.325, H = 0.15, t = 0.002;
    g.add(box(L - 0.03, t, Wd - 0.03, MAT.ss, 0, t / 2, 0));
    g.add(core(box(L, H, t, MAT.ss, 0, H / 2, Wd / 2)));
    g.add(core(box(L, H, t, MAT.ss, 0, H / 2, -Wd / 2)));
    g.add(box(t, H, Wd, MAT.ss, L / 2, H / 2, 0));
    g.add(box(t, H, Wd, MAT.ss, -L / 2, H / 2, 0));
    g.add(box(L + 0.02, 0.004, 0.012, MAT.ss, 0, H, Wd / 2 + 0.006));
    g.add(box(L + 0.02, 0.004, 0.012, MAT.ss, 0, H, -Wd / 2 - 0.006));
    return g;
  },
  reel() {
    const g = new THREE.Group();
    const R = 0.14;
    g.add(core(cylBetween(R, V(0, R, -0.075), V(0, R, -0.063), MAT.blue, 36)));
    g.add(core(cylBetween(R, V(0, R, 0.063), V(0, R, 0.075), MAT.blue, 36)));
    g.add(cylBetween(0.095, V(0, R, -0.063), V(0, R, 0.063), MAT.blue, 30));
    g.add(box(0.07, 0.06, 0.02, MAT.black, 0, R, 0.085));
    g.add(cylBetween(0.012, V(0.06, R + 0.06, 0.075), V(0.06, R + 0.06, 0.12), MAT.black, 10));
    return g;
  },
};

let vctx = null;
function vesselBuild(kind) {
  const m = VESSEL_MODULES[kind];
  try { return m.build(THREE, vctx, m.defaultOptions || {}); } catch (e) { console.error(kind, e); return BUILD[kind] ? BUILD[kind]() : new THREE.Group(); }
}
function kegModel() { return VESSEL_MODULES.keg ? vesselBuild('keg') : BUILD.keg(); }
const itemGroups = {};
function itemWorldPlacement(it) {
  if (!it.on || it.on === 'floor') return null;
  const [rackKey, levelId] = it.on.split(':');
  return { rackKey, levelId };
}
function buildItems() {
  // items on shelves live inside the rack groups: take the old ones out too, or each rebuild leaves a copy behind
  const old = new THREE.Group();
  for (const g of Object.values(itemGroups)) if (g.parent && g.parent !== G.items) old.add(g);
  clearGroup(old);
  clearGroup(G.items);
  for (const k of Object.keys(itemGroups)) delete itemGroups[k];
  for (const it of cfg.items) {
    if (!it.show || !(BUILD[it.kind] || VESSEL_MODULES[it.kind])) continue;
    const g = VESSEL_MODULES[it.kind] ? vesselBuild(it.kind) : BUILD[it.kind]();
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    tip(g, KINDS[it.kind].name, VESSEL_MODULES[it.kind]?.meta?.dims || KINDS[it.kind].dims, { itemId: it.id });
    const pl = itemWorldPlacement(it);
    if (pl && rackInfo[pl.rackKey]) {
      const { group, spec } = rackInfo[pl.rackKey];
      const lv = cfg.racks[pl.rackKey].levels.find((l) => l.id === pl.levelId);
      const y = lv ? deckTopY(spec, lv) : 0;
      g.position.set(spec.post + clamp(mm(it.along), 0, innerW(spec)), y, spec.depth / 2 + mm(it.inset || 0));
      g.rotation.y = rad(it.rot || 0);
      group.add(g);
    } else {
      const x = mm(it.x), z = mm(it.z);
      g.position.set(x, floorY(z, x), z);
      g.rotation.y = rad(it.rot || 0);
      G.items.add(g);
    }
    itemGroups[it.id] = g;
  }
}

/* =====================================================================
   Roller shutter
   ===================================================================== */
let layout = null;
const curtain = { inst: null, bar: null, roll: null, motor: null };

function shutterLayout() {
  const { W, D, H } = dimsM();
  const s = cfg.shutter;
  const slat = SLATS[s.slat] || SLATS.cw55;
  const gp = 0.025, gd = slat.guide.d;
  const L = { mount: s.mount, W, D, H, gp, gd, slat };
  if (s.mount === 'face') {
    // the U frame's outside face is flush with the weatherboard over the opening, 14 mm in front of the corner
    // where the white wall step starts, so the left leg sits just clear of that step's reveal
    const pd = POST_C.d, ov = POST_C.overlap, fw = slat.guide.w, fd = slat.guide.d;
    const zF = D + CEIL.face, wr = whiteM();
    const lx0 = wr.x1 + 0.001, lx1 = lx0 + POST_C.left, rx0 = W - POST_C.right;
    L.zF = zF;
    L.zs = zF + fd / 2;
    L.floorS = floorY(L.zs, lx1);                // the straight bottom bar sits on the high (left) side
    L.floorR = floorY(L.zs, rx0 + POST_C.right / 2);
    L.crossGap = L.floorS - floorY(L.zs, rx0);   // wedge under the right end of the bottom bar
    L.B = headboxFor(H - L.floorS, slat);
    L.postL = { x0: lx0, x1: lx1, z0: zF - pd, z1: zF, yb: floorY(zF - pd / 2, (lx0 + lx1) / 2) };
    L.frameD = fd;
    const gl0 = lx1 - ov, gr1 = rx0 + ov;
    L.box = { x0: gl0, x1: gr1, y0: H, y1: H + L.B, z0: zF + 0.002, z1: zF + 0.002 + L.B, chamfer: 'outer' };
    L.guides = [
      { type: 'faceframe', side: 'L', x0: gl0, x1: gl0 + fw, z0: zF, z1: zF + fd, fixX: lx1 - ov / 2 },
      { type: 'faceframe', side: 'R', x0: gr1 - fw, x1: gr1, z0: zF, z1: zF + fd, fixX: rx0 + ov / 2 },
    ];
    L.clearX0 = gl0 + fw; L.clearX1 = gr1 - fw;
    // the right post is the dump post whether or not the hose is shown
    // inverted U: the top beam butts up under the weatherboard lip; the S-bent tabs rise onto the plasterboard
    const by1 = H - POST_C.rise - POST_C.tabT;
    L.uBeam = { x0: lx0, x1: W, y0: by1 - POST_C.beamH, y1: by1, z0: zF - pd, z1: zF };
    L.postL.y1 = L.uBeam.y0;
    L.dumpJamb = { y1: L.uBeam.y0, x0: rx0, x1: W, z0: zF - pd, z1: zF, xc: W - (POST_C.right - ov) / 2, outLen: fd + 0.015, rhs: true, yb: floorY(zF - pd / 2, rx0 + POST_C.right / 2) };
    L.curtainTop = H;
  } else {
    // a free-standing left post sits wedged against the white wall step, which fixes the shutter line
    L.zs = s.mount === 'wall' && s.partyFix === false ? D - DUMP_JAMB / 2 - 0.001 : D - mm(clamp(s.setback, 0, 400));
    L.floorS = floorY(L.zs);
    const B0 = headboxFor(H - L.floorS - 0.25, slat);
    const dj = !!cfg.dump?.show;
    if (s.mount === 'portal') {
      const hdr = 0.05, post = 0.075, off = 0.01;
      const rIn = dj ? DUMP_JAMB : off + post;
      L.B = headboxFor(H - L.floorS - hdr - B0, slat);
      L.post = post; L.off = off; L.hdr = hdr;
      L.box = { x0: off + post, x1: W - rIn, y0: H - hdr - L.B, y1: H - hdr, z0: L.zs + 0.035 - L.B, z1: L.zs + 0.035, chamfer: 'inner' };
      L.guides = [
        { type: 'reveal', side: 'L', x0: off + post, x1: off + post + gp, z0: L.zs - gd / 2, z1: L.zs + gd / 2 },
        { type: 'reveal', side: 'R', x0: W - rIn - gp, x1: W - rIn, z0: L.zs - gd / 2, z1: L.zs + gd / 2 },
      ];
      L.clearX0 = off + post + gp; L.clearX1 = W - rIn - gp;
      if (dj) L.dumpJamb = { y1: H - hdr };
    } else {
      const rIn = dj ? DUMP_JAMB : 0;
      const free = s.partyFix === false;
      const lIn = free ? 0.078 : 0.062;
      L.B = headboxFor(H - L.floorS - B0, slat);
      L.box = { x0: free ? lIn : 0, x1: W - rIn, y0: H - L.B, y1: H, z0: L.zs + 0.035 - L.B, z1: L.zs + 0.035, chamfer: 'inner' };
      if (free) L.leftPost = { x0: 0.003, x1: lIn }; else L.jamb = { x0: 0.012, x1: 0.062 };
      L.guides = [
        { type: 'reveal', side: 'L', x0: lIn, x1: lIn + gp, z0: L.zs - gd / 2, z1: L.zs + gd / 2 },
        { type: 'reveal', side: 'R', x0: W - rIn - gp, x1: W - rIn, z0: L.zs - gd / 2, z1: L.zs + gd / 2 },
      ];
      L.clearX0 = lIn + gp; L.clearX1 = W - rIn - gp;
      if (dj) L.dumpJamb = { y1: H };
    }
    L.curtainTop = L.box.y0;
  }
  if (L.dumpJamb) {
    const yb = L.dumpJamb.yb ?? L.floorS;
    L.dumpJamb = { x0: W - DUMP_JAMB, x1: W, z0: L.zs - DUMP_JAMB / 2, z1: L.zs + DUMP_JAMB / 2, xc: W - DUMP_JAMB / 2, outLen: 0.025, ...L.dumpJamb, yb, y0: yb + 0.008, pt: yb + DUMP_LIFT + DUMP_R };
  }
  L.spring = cfg.shutter.drive !== 'motor';
  L.barH = 0.057;
  L.cx0 = L.clearX0 - 0.018;
  L.cx1 = L.clearX1 + 0.018;
  L.hangMax = L.curtainTop - L.floorS;
  L.clearW = L.clearX1 - L.clearX0;
  L.clearH = L.hangMax;
  L.area = (L.cx1 - L.cx0) * (L.hangMax + 0.05);
  L.kg = L.area * slat.kg + 4;
  return L;
}

/* ---------- curtain winding: slats laid along an Archimedean spiral on a 70 mm octagonal tube ---------- */
function arcInv(R, a) {
  if (a <= 0) return 0;
  const c = R.k / (4 * PI);
  return (-R.r1 + Math.sqrt(R.r1 * R.r1 + 4 * c * a)) / (2 * c);
}
function tangentFrom(R, Rout) {
  // tangent from the top of the guide slot (qz, qy) onto the roll, on the side the curtain winds from
  const dz = R.qz - R.cz, dy = R.qy - R.cy, d = Math.hypot(dz, dy);
  const beta = Math.atan2(dy, dz);
  const phiT = d > Rout ? beta + R.dir * Math.acos(Rout / d) : beta;
  const tz = R.cz + Rout * Math.cos(phiT), ty = R.cy + Rout * Math.sin(phiT);
  return { phiT, tz, ty, lt: Math.hypot(tz - R.qz, ty - R.qy) };
}
function windSolve(R, h) {
  let lt = 0.1, out = null;
  for (let i = 0; i < 8; i++) {
    const W = Math.max(0, R.Ltot - h - lt);
    const psiMax = arcInv(R, W);
    const Rout = R.r1 + (R.k * psiMax) / (2 * PI);
    const t = tangentFrom(R, Rout);
    out = { W, psiMax, Rout, ...t };
    if (Math.abs(t.lt - lt) < 1e-5) break;
    lt = t.lt;
  }
  return out;
}
function makeRoll(L) {
  const t = L.slat.t, p = L.slat.pitch, b = L.box;
  const R = {
    cz: b.z0 + L.B / 2, cy: b.y0 + L.B / 2, qz: L.zs, qy: L.curtainTop,
    dir: 1, // the curtain winds with its convex (street) face outward, so the concave back sits on the roll
    rBase: 0.035, r1: 0.035 + 0.4 * t + 0.0004,
    k: t + 0.0006, // roll-tight: each wrap is one slat thickness plus a hair (curved slats sit snug on the roll)
  };
  // length: hanging drop + run up to the roll + 3/4 of a wrap left on the tube when fully closed
  const tc = tangentFrom(R, R.r1 + R.k);
  R.Ltot = Math.ceil((L.hangMax + tc.lt + 1.5 * PI * R.r1) / p) * p;
  R.N = Math.round(R.Ltot / p);
  // the full roll has to fit inside the headbox: tighten the wrap pitch if it would not
  const Rmax = L.B / 2 - 0.004 - 0.5 * t;
  for (let i = 0; i < 6; i++) {
    const w = windSolve(R, 0.01);
    if (w.Rout <= Rmax) break;
    R.k = Math.max(0.6 * t, (PI * (Rmax * Rmax - R.r1 * R.r1)) / Math.max(w.W, 0.1));
  }
  return R;
}

function slatGeo(slat, len) {
  const p = slat.pitch, t = slat.t;
  return extrudeX((s) => {
    s.moveTo(-t * 0.4, 0);
    s.lineTo(t * 0.05, 0);
    s.quad(t * 0.95, p * 0.5, t * 0.05, p - 0.0016);
    s.lineTo(-t * 0.4, p - 0.0016);
    s.quad(-t * 0.25, p * 0.5, -t * 0.4, 0);
  }, len, 8);
}

function headboxGeo(B, len, chamfer) {
  const c = B * 0.36;
  return extrudeX((s) => {
    if (chamfer === 'inner') {
      s.moveTo(c, 0); s.lineTo(B, 0); s.lineTo(B, B); s.lineTo(0, B); s.lineTo(0, c); s.lineTo(c, 0);
    } else {
      s.moveTo(0, 0); s.lineTo(B - c, 0); s.lineTo(B, c); s.lineTo(B, B); s.lineTo(0, B); s.lineTo(0, 0);
    }
  }, len, 1);
}

function frameMat() {
  return cfg.shutter.frame === 'galv' ? MAT.galv : MAT.shutter;
}

function buildShutter() {
  clearGroup(G.shutter);
  const L = (layout = shutterLayout());
  const { W, H } = dimsM();
  MAT.shutter.color.set(cfg.shutter.color);
  MAT.shutterGhost.color.set(cfg.shutter.color);
  MAT.roll.color.set(cfg.shutter.color).multiplyScalar(0.92);
  MAT.headbox.color.set(cfg.shutter.boxColor || cfg.shutter.color);
  MAT.headboxGhost.color.set(cfg.shutter.boxColor || cfg.shutter.color);
  const inside = cfg.shutter.inside;
  const grp = new THREE.Group();
  grp.userData.role = 'shutter';
  tip(grp, 'Aluminium roller shutter', `${L.slat.label} · ${Math.round(L.clearW * 1000)} × ${Math.round(L.clearH * 1000)} clear`);
  G.shutter.add(grp);

  // Headbox
  const bx = L.box;
  const hb = mesh(headboxGeo(L.B, bx.x1 - bx.x0, bx.chamfer), inside ? MAT.headboxGhost : MAT.headbox);
  hb.position.set(bx.x0, bx.y0, bx.z0);
  tip(hb, `Headbox ${Math.round(L.B * 1000)} mm`, L.spring ? 'Holds the rolled curtain on its spring-balanced axle' : `Holds the rolled curtain and the tubular motor (${cfg.shutter.motor} end)`);
  grp.add(hb);
  for (const x of [bx.x0 - 0.002, bx.x1 + 0.002]) {
    const cap = mesh(headboxGeo(L.B + 0.004, 0.004, bx.chamfer), inside ? MAT.headboxGhost : MAT.headbox);
    cap.position.set(x - 0.002, bx.y0 - 0.002, bx.z0 - 0.002);
    grp.add(cap);
  }
  // Octagonal tube, end plates and tubular motor; the curtain winds onto the tube as real slats
  L.roll = makeRoll(L);
  const rollY = L.roll.cy, rollZ = L.roll.cz;
  const axle = cylBetween(L.roll.rBase, V(bx.x0 + 0.012, rollY, rollZ), V(bx.x1 - 0.012, rollY, rollZ), MAT.galv, 8);
  tip(axle, 'Octagonal winding tube', L.spring ? '70 mm galvanised tube with torsion springs inside that balance the curtain, so it lifts by hand' : '70 mm galvanised tube; the tubular motor sits inside one end');
  grp.add(axle);
  for (const x of [bx.x0 + 0.004, bx.x1 - 0.004]) {
    const plate = cylBetween(0.045, V(x - 0.003, rollY, rollZ), V(x + 0.003, rollY, rollZ), MAT.galv, 24);
    tip(plate, L.spring ? 'Bearing / spring anchor' : 'Bearing / motor bracket', 'Bolted to the headbox end cap');
    grp.add(plate);
  }
  curtain.motor = null;
  if (!L.spring) {
    const ml = cfg.shutter.motor === 'left';
    const mx = ml ? bx.x0 + 0.012 : bx.x1 - 0.012;
    curtain.motor = cylBetween(0.022, V(mx, rollY, rollZ), V(mx + (ml ? 0.32 : -0.32), rollY, rollZ), MAT.black, 20);
    tip(curtain.motor, 'Tubular motor', 'Sits inside the winding tube; cable exits through the end cap');
    grp.add(curtain.motor);
  }

  // Guides
  const gTop = L.mount === 'face' ? H : bx.y0;
  for (const gd of L.guides) {
    const gg = new THREE.Group();
    const y0 = floorY(L.zs, (gd.x0 + gd.x1) / 2), y1 = gTop;
    const slot = L.slat.t + 0.01;
    if (gd.type === 'reveal') {
      const back = gd.side === 'L' ? [gd.x0, gd.x0 + 0.004] : [gd.x1 - 0.004, gd.x1];
      const ch = gd.side === 'L' ? [gd.x0 + 0.004, gd.x1] : [gd.x0, gd.x1 - 0.004];
      gg.add(boxAt(back[0], y0, gd.z0, back[1], y1, gd.z1, MAT.shutter));
      gg.add(boxAt(ch[0], y0, gd.z0, ch[1], y1, L.zs - slot / 2, MAT.shutter));
      gg.add(boxAt(ch[0], y0, L.zs + slot / 2, ch[1], y1, gd.z1, MAT.shutter));
      gg.add(boxAt(ch[0], y0, L.zs - slot / 2, ch[1], y1, L.zs - slot / 2 + 0.003, MAT.black));
      gg.add(boxAt(ch[0], y0, L.zs + slot / 2 - 0.003, ch[1], y1, L.zs + slot / 2, MAT.black));
    } else if (gd.type === 'faceframe') {
      // flat side frame: back flange on the post face, front cover, outer wall, slotted inner wall facing the opening
      const inner = gd.side === 'L' ? gd.x1 : gd.x0, outer = gd.side === 'L' ? gd.x0 : gd.x1, sgn = gd.side === 'L' ? 1 : -1;
      gg.add(boxAt(gd.x0, y0, gd.z0, gd.x1, y1, gd.z0 + 0.003, MAT.shutter));
      gg.add(boxAt(gd.x0, y0, gd.z1 - 0.003, gd.x1, y1, gd.z1, MAT.shutter));
      gg.add(boxAt(Math.min(outer, outer + sgn * 0.003), y0, gd.z0, Math.max(outer, outer + sgn * 0.003), y1, gd.z1, MAT.shutter));
      const i0 = Math.min(inner, inner - sgn * 0.003), i1 = Math.max(inner, inner - sgn * 0.003);
      gg.add(boxAt(i0, y0, gd.z0, i1, y1, L.zs - slot / 2, MAT.shutter));
      gg.add(boxAt(i0, y0, L.zs + slot / 2, i1, y1, gd.z1, MAT.shutter));
      const c0 = Math.min(inner - sgn * 0.003, inner - sgn * 0.022), c1 = Math.max(inner - sgn * 0.003, inner - sgn * 0.022);
      gg.add(boxAt(c0, y0, L.zs - slot / 2 - 0.003, c1, y1, L.zs - slot / 2, MAT.black));
      gg.add(boxAt(c0, y0, L.zs + slot / 2, c1, y1, L.zs + slot / 2 + 0.003, MAT.black));
    } else {
      gg.add(boxAt(gd.x0, y0, gd.z0, gd.x1, y1, gd.z0 + 0.004, MAT.shutter));
      gg.add(boxAt(gd.x0, y0, gd.z0, gd.x0 + 0.004, y1, gd.z1, MAT.shutter));
      gg.add(boxAt(gd.x0 + 0.01, y0, gd.z1 - 0.004, gd.x1, y1, gd.z1, MAT.shutter));
    }
    tip(gg, gd.type === 'faceframe' ? 'Side frame' : 'Side guide', gd.type === 'faceframe' ? `Face-fit aluminium side frame, ${Math.round((gd.x1 - gd.x0) * 1000)} × ${Math.round((gd.z1 - gd.z0) * 1000)} mm, pile-lined; its flange overlaps the post by ${Math.round(POST_C.overlap * 1000)} mm` : `Extruded aluminium, ${Math.round(L.gp * 1000)} × ${Math.round(L.gd * 1000)} mm, pile-lined`);
    grp.add(gg);
  }

  // Curtain: instanced slats + bottom bar
  const len = L.cx1 - L.cx0;
  const sg = slatGeo(L.slat, len);
  curtain.inst = new THREE.InstancedMesh(sg, MAT.shutter, L.roll.N);
  curtain.inst.castShadow = true; curtain.inst.receiveShadow = true;
  tip(curtain.inst, 'Shutter curtain', `${L.slat.label} · ≈ ${L.area.toFixed(1)} m², ${Math.round(L.kg)} kg with bottom bar`);
  grp.add(curtain.inst);
  const bar = new THREE.Group();
  const bz0 = L.zs - L.slat.t / 2 - 0.004, bz1 = L.zs + L.slat.t / 2 + 0.004;
  {
    bar.add(boxAt(L.cx0, 0.012, bz0, L.cx1, 0.057, bz1, MAT.shutter));
    bar.add(boxAt(L.cx0 + 0.004, 0, L.zs - 0.005, L.cx1 - 0.004, 0.012, L.zs + 0.005, MAT.rubber));
    tip(bar, 'Bottom bar', 'Aluminium with a rubber floor seal');
    if (L.spring) {
      const xm = (L.cx0 + L.cx1) / 2;
      // key lock: cylinder outside, thumb turn inside; bolts shoot into both guides
      const lk = new THREE.Group();
      lk.add(cylBetween(0.011, V(xm, 0.034, bz1), V(xm, 0.034, bz1 + 0.006), MAT.ss, 20));
      lk.add(boxAt(xm - 0.0012, 0.028, bz1 + 0.006, xm + 0.0012, 0.04, bz1 + 0.0065, MAT.black));
      lk.add(cylBetween(0.009, V(xm, 0.034, bz0), V(xm, 0.034, bz0 - 0.005), MAT.ss, 16));
      lk.add(boxAt(xm - 0.003, 0.024, bz0 - 0.014, xm + 0.003, 0.044, bz0 - 0.005, MAT.ss));
      for (const [x0, x1] of [[L.cx0 - 0.012, L.cx0 + 0.02], [L.cx1 - 0.02, L.cx1 + 0.012]]) lk.add(cylBetween(0.004, V(x0, 0.034, L.zs), V(x1, 0.034, L.zs), MAT.ss, 10));
      tip(lk, 'Key lock', 'Key cylinder outside, thumb turn inside; turning either shoots a bolt into each guide so the curtain can\'t be lifted');
      bar.add(lk);
      // lift handles inside and out
      for (const dx of [-0.3, 0.3]) for (const side of [1, -1]) {
        const z0 = side > 0 ? bz1 : bz0, zo = z0 + side * 0.028;
        const hd = new THREE.Group();
        for (const sx of [-0.045, 0.045]) hd.add(boxAt(xm + dx + sx - 0.005, 0.02, Math.min(z0, zo), xm + dx + sx + 0.005, 0.042, Math.max(z0, zo), MAT.black));
        hd.add(cylBetween(0.0065, V(xm + dx - 0.05, 0.031, zo - side * 0.004), V(xm + dx + 0.05, 0.031, zo - side * 0.004), MAT.black, 14));
        tip(hd, 'Lift handle', side > 0 ? 'Outside: pull down / push up' : 'Inside: pull down / push up. Fully open, the bar is about 2.4 m up, so keep a hook pole handy');
        bar.add(hd);
      }
    }
  }
  curtain.bar = bar;
  grp.add(bar);

  buildMountHardware(L, grp);
  if (L.postL) buildLeftPostC(L, grp);
  if (L.dumpJamb) buildDumpJamb(L, grp);
  // guide fixings: bolt heads sit inside the channel behind the curtain
  for (const gd of L.guides) {
    const back = gd.side === 'L' ? gd.x0 : gd.x1, inn = gd.side === 'L' ? 1 : -1;
    const into = gd.type === 'faceframe' ? (gd.side === 'L' ? 'an M6 rivnut in the 50 × 50 left post' : 'an M6 rivnut in the 100 × 50 right post') : L.dumpJamb && gd.side === 'R' ? 'an M6 rivnut in the dump post' : gd.side === 'L' ? (L.leftPost ? 'an M6 rivnut in the left post' : 'the aluminium jamb') : 'the brick';
    const ya = L.floorS + 0.1, yb = gTop - 0.1, nSeg = Math.max(1, Math.ceil((yb - ya) / 0.45 - 1e-6));
    const gys = Array.from({ length: nSeg + 1 }, (_, i) => ya + ((yb - ya) * i) / nSeg);
    L.guideFix = { n: gys.length, pitch: (yb - ya) / nSeg };
    for (const y of gys) {
      const b = new THREE.Group();
      b.userData.role = 'fix';
      if (gd.type === 'faceframe') {
        b.add(cylBetween(0.0065, V(gd.fixX, y, gd.z1), V(gd.fixX, y, gd.z1 + 0.004), MAT.shutter, 16)); // cover cap
        b.add(cylBetween(0.003, V(gd.fixX, y, gd.z1), V(gd.fixX, y, gd.z0 - 0.012), MAT.ss, 8));
      } else {
        b.add(cylBetween(0.0055, V(back + inn * 0.004, y, L.zs), V(back + inn * 0.0075, y, L.zs), MAT.ss, 12));
        b.add(cylBetween(0.003, V(back + inn * 0.004, y, L.zs), V(back - inn * 0.03, y, L.zs), MAT.ss, 8));
      }
      tip(b, gd.type === 'faceframe' ? 'Side frame fixing' : 'Guide fixing', `316 screw through the ${gd.type === 'faceframe' ? 'frame flange, under a cover cap,' : 'back of the guide'} into ${into}: 100 mm off the floor and the headbox, ${Math.round(L.guideFix.pitch * 1000)} mm apart (450 max), ${L.guideFix.n} a side. Needs a flat 30 mm strip behind it.`);
      grp.add(b);
    }
  }
  if (L.mount === 'face') {
    // the headbox is held only at its flush sides: each end cap's flange drops over the top of the side
    // frame and is screwed through it into the post. Nothing fixes it to the wall or the beam behind.
    for (const gd of L.guides) {
      const g = new THREE.Group();
      g.add(boxAt(gd.x0, H - 0.07, gd.z1, gd.x1, H, gd.z1 + 0.003, MAT.headbox));
      for (const y of [H - 0.025, H - 0.052]) {
        const sc = cylBetween(0.003, V(gd.fixX, y, gd.z1 + 0.004), V(gd.fixX, y, gd.z0 - 0.02), MAT.ss, 8);
        sc.userData.role = 'fix';
        g.add(sc);
      }
      tip(g, 'Headbox end-cap flange', 'The end cap drops 70 mm over the top of the side frame; two screws through both into the post. This is all that holds the headbox: no clips to the wall.');
      grp.add(g);
    }
  } else if (L.dumpJamb) {
    const bx2 = L.box;
    for (const fy of [0.3, 0.7]) {
      const b = new THREE.Group();
      b.userData.role = 'fix';
      const y = bx2.y0 + L.B * fy, z = (bx2.z0 + bx2.z1) / 2 + 0.03;
      b.add(cylBetween(0.0055, V(bx2.x1 - 0.004, y, z), V(bx2.x1 - 0.001, y, z), MAT.ss, 12));
      b.add(cylBetween(0.003, V(bx2.x1 - 0.004, y, z), V(bx2.x1 + 0.03, y, z), MAT.ss, 8));
      tip(b, 'Headbox end bolt', 'M6 316 bolt through the headbox end cap into a rivnut in the dump jamb');
      grp.add(b);
    }
  }

  // Motor switch inside, on the brick: centred in the strip between the end of the 1000 kg rack and the shutter
  const blueR = rackInfo.blue && rackInfo.blue.frame.max.x > W - 0.25 ? rackInfo.blue.frame : null;
  const zEndS = L.dumpJamb ? L.dumpJamb.z0 : L.zs - 0.06;
  const zSw = blueR && blueR.max.z < zEndS - 0.08 ? (blueR.max.z + zEndS) / 2 : L.zs - 0.395;
  if (!L.spring) {
    const sw = boxAt(W - 0.014, L.floorS + 1.15, zSw - 0.025, W, L.floorS + 1.24, zSw + 0.025, MAT.pvc);
    tip(sw, 'Shutter switch', 'Weatherproof (IP56) up/stop/down on an RCD-protected circuit');
    grp.add(sw);
  }

  updateCurtain();
}

// Free-standing left post wedged into the corner between the weatherboard and the 21 mm step of the white wall.
// Inside: base tab with two slab anchors and one cleat with two screws up into the ceiling framing.
// Outside: a narrower base tab (clears the step) with one anchor. Nothing is fixed into the shared wall.
function buildLeftPost(L, grp) {
  const { H } = dimsM();
  const p = L.leftPost, zs = L.zs, hz = DUMP_JAMB / 2;
  const step = cfg.nook.ret > 0 ? mm(cfg.nook.retStep) : p.x0 - 0.004;
  const fl = (z) => floorY(z);
  const post = new THREE.Group();
  post.userData.role = 'struct';
  post.add(boxAt(p.x0, fl(zs) + 0.008, zs - hz, p.x1, H, zs + hz, MAT.ssDull));
  // inside tab (and the plate under the post)
  post.add(boxAt(p.x0, fl(zs), zs - 0.09, p.x1, fl(zs) + 0.008, zs + hz, MAT.ssDull));
  // outside tab: narrower, starts just clear of the white wall step
  const ox0 = Math.max(p.x0, step + 0.004);
  post.add(boxAt(ox0, fl(zs + 0.06), zs + hz, p.x1, fl(zs + 0.06) + 0.008, zs + 0.09, MAT.ssDull));
  const anchors = [[p.x0 + 0.018, zs - 0.065], [p.x1 - 0.018, zs - 0.065], [(ox0 + p.x1) / 2, zs + 0.065]];
  for (const [x, z] of anchors) {
    const a = new THREE.Group();
    a.userData.role = 'fix';
    a.add(cyl(0.009, 0.009, 0.008, MAT.ss, x, fl(z) + 0.012, z, 6));
    a.add(cylBetween(0.005, V(x, fl(z) + 0.016, z), V(x, fl(z) - 0.08, z), MAT.ss, 8));
    tip(a, 'Slab anchor', z > zs ? 'M10 316 anchor through the outside tab, 80 mm into the slab' : 'M10 316 anchor through the inside tab, 80 mm into the slab');
    post.add(a);
  }
  // one cleat on the inside face, two screws up into the ceiling framing
  const zf = zs - hz;
  post.add(boxAt(p.x0, H - 0.07, zf - 0.004, p.x1, H, zf, MAT.ssDull));
  post.add(boxAt(p.x0, H - 0.005, zf - 0.06, p.x1, H, zf, MAT.ssDull));
  for (const x of [p.x0 + 0.02, p.x1 - 0.02]) {
    const sc = cylBetween(0.004, V(x, H - 0.008, zf - 0.04), V(x, H + 0.12, zf - 0.04), MAT.ss, 8);
    sc.userData.role = 'fix';
    tip(sc, 'Ceiling cleat screw', '14g × 100 316 screw up through the plasterboard into the head beam or new blocking');
    post.add(sc);
  }
  tip(post, 'Left post, wedged into the corner', '75 × 75 × 3 316 SHS against the weatherboard and the 21 mm step of the white wall. Inside tab with two slab anchors, narrower outside tab with one, one ceiling cleat with two screws. Nothing is fixed into the shared wall.');
  grp.add(post);
  const seal = new THREE.Group();
  seal.add(boxAt(0.0005, fl(zs) + 0.03, zs - hz + 0.005, p.x0, H - 0.08, zs + hz - 0.002, MAT.rubber));
  if (step > p.x0) seal.add(boxAt(p.x0, fl(zs) + 0.03, zs + hz, step, H - 0.08, zs + hz + 0.001, MAT.rubber));
  tip(seal, 'EPDM seal strip', 'Stuck to the post only, closing the joints against the weatherboard and the white wall step');
  grp.add(seal);
}

function buildMountHardware(L, grp) {
  const { W, H } = dimsM();
  const fm = frameMat();
  if (L.mount === 'wall' && L.leftPost) buildLeftPost(L, grp);
  if (L.mount === 'wall') {
    const j = L.jamb || { x0: 0.012, x1: 0.062 };
    if (!L.leftPost) {
    const y0 = L.floorS + 0.03, y1 = L.box.y0;
    const jamb = new THREE.Group();
    jamb.userData.role = 'struct';
    jamb.add(boxAt(j.x0, y0, L.zs - 0.025, j.x1, y1, L.zs + 0.025, MAT.shutter));
    jamb.add(boxAt(j.x0 + 0.003, y0 - 0.003, L.zs - 0.022, j.x1 - 0.003, y0, L.zs + 0.022, MAT.black));
    for (const y of [0.3, 0.95, 1.6, y1 - L.floorS - 0.25]) {
      const yy = L.floorS + y;
      jamb.add(boxAt(0, yy, L.zs - 0.03, 0.012, yy + 0.07, L.zs + 0.03, MAT.pvc));
      const scr = new THREE.Group();
      scr.userData.role = 'fix';
      const ay = yy + 0.035;
      scr.add(cylBetween(0.007, V(0, ay, L.zs), V(-LCLAD, ay, L.zs), MAT.ss, 12));
      scr.add(cylBetween(0.005, V(j.x1 - 0.002, ay, L.zs), V(-LCLAD - 0.07, ay, L.zs), MAT.ss, 10));
      scr.add(cylBetween(0.0085, V(j.x1 - 0.006, ay, L.zs), V(j.x1 - 0.001, ay, L.zs), MAT.ss, 6));
      tip(scr, 'Masonry anchor', 'M10 316 rod set 70 mm into the brick behind the weatherboard in chemical anchor, through a stainless crush tube so the boards are not squashed. Seal the hole in the cladding.');
      jamb.add(scr);
    }
    tip(jamb, 'Left jamb: 50 × 50 × 3 aluminium box section', 'Powder-coated, on PVC packers 12 mm off the weatherboard, anchored through the cladding into the brick at four heights, stops 30 mm above the slab');
    grp.add(jamb);
    }
    // headbox screws up through the plasterboard into the head beam or blocking
    for (const x of [L.box.x0 + 0.2, (L.box.x0 + L.box.x1) / 2, L.box.x1 - 0.2]) {
      const s = cylBetween(0.004, V(x, H - 0.012, L.box.z1 - 0.06), V(x, H + 0.12, L.box.z1 - 0.06), MAT.ss, 8);
      s.userData.role = 'fix';
      tip(s, 'Headbox screw', '14g × 100 316 stainless screw up into the head beam or blocking');
      grp.add(s);
    }
  } else if (L.mount === 'portal') {
    const frame = new THREE.Group();
    frame.userData.role = 'struct';
    const p = L.post, off = L.off;
    const zA = L.zs - p / 2, zB = L.zs + p / 2;
    const sb = 0.05;
    for (const [x0, x1, side] of [[off, off + p, 'L'], [W - off - p, W - off, 'R']]) {
      if (side === 'R' && L.dumpJamb) continue;
      frame.add(boxAt(x0, L.floorS + sb, zA, x1, H - L.hdr, zB, fm));
      {
      // levelling stand-off base: plate on the slab, threaded rods, top plate
      const px0 = side === 'L' ? 0.0 : W - off - p, px1 = side === 'L' ? off + p : W;
      const base = new THREE.Group();
      base.add(boxAt(px0, L.floorS, L.zs - 0.09, px1, L.floorS + 0.008, L.zs + 0.09, MAT.galv));
      base.add(boxAt(x0 - 0.0, L.floorS + sb - 0.008, L.zs - 0.07, x1, L.floorS + sb, L.zs + 0.07, MAT.galv));
      const rx = [x0 + 0.015, x1 - 0.015];
      for (const xx of rx) for (const zz of [L.zs - 0.06, L.zs + 0.06]) {
        const rod = new THREE.Group();
        rod.userData.role = 'fix';
        rod.add(cylBetween(0.006, V(xx, L.floorS + 0.008, zz), V(xx, L.floorS + sb + 0.012, zz), MAT.ss, 10));
        rod.add(cyl(0.011, 0.011, 0.008, MAT.ss, xx, L.floorS + 0.022, zz, 6));
        rod.add(cyl(0.011, 0.011, 0.008, MAT.ss, xx, L.floorS + sb + 0.006, zz, 6));
        tip(rod, 'Levelling rod', 'M12 316 threaded rod with lock nuts');
        base.add(rod);
      }
      for (const zz of [L.zs - 0.08, L.zs + 0.08]) {
        const a = new THREE.Group();
        a.userData.role = 'fix';
        a.add(cyl(0.009, 0.009, 0.01, MAT.ss, (px0 + px1) / 2, L.floorS + 0.012, zz, 6));
        a.add(cylBetween(0.005, V((px0 + px1) / 2, L.floorS + 0.008, zz), V((px0 + px1) / 2, L.floorS - 0.08, zz), MAT.ss, 8));
        tip(a, 'Slab anchor', 'M10 316 anchor into the slab');
        base.add(a);
      }
      tip(base, 'Levelling stand-off base', 'Galvanised plate on 316 stainless anchors, post lifted 50 mm on threaded rod so wash water runs underneath');
      frame.add(base);
      }
      // wall ties (none into the shared wall when the frame is free-standing on that side)
      for (const y of (side === 'L' && cfg.shutter.partyFix === false ? [] : [0.9, 1.8])) {
        const yy = L.floorS + y;
        const tx0 = side === 'L' ? -0.0 : x1, tx1 = side === 'L' ? x0 : W;
        frame.add(boxAt(tx0, yy, zB, tx1 + (side === 'L' ? 0.03 : 0), yy + 0.06, zB + 0.004, MAT.ss));
        frame.add(boxAt(side === 'L' ? 0 : W - 0.004, yy, zB - 0.02, side === 'L' ? 0.004 : W, yy + 0.06, zB + 0.004, MAT.ss));
        const an = new THREE.Group();
        an.userData.role = 'fix';
        const ay = yy + 0.03, az = zB - 0.008;
        if (side === 'L') {
          an.add(cylBetween(0.007, V(0, ay, az), V(-LCLAD, ay, az), MAT.ss, 12));
          an.add(cylBetween(0.005, V(0.008, ay, az), V(-LCLAD - 0.07, ay, az), MAT.ss, 10));
        } else {
          an.add(cylBetween(0.005, V(W - 0.008, ay, az), V(W + 0.07, ay, az), MAT.ss, 10));
        }
        tip(an, 'Tie-back anchor', side === 'L' ? 'M10 316 anchor through a crush tube in the weatherboard, 70 mm into the brick' : 'M10 316 chemical anchor, 70 mm into the brick');
        frame.add(an);
      }
    }
    frame.add(boxAt(off, H - L.hdr, zA, L.dumpJamb ? W : W - off, H, zB, fm));
    for (const x of [off + 0.04, W / 2, W - 0.2]) {
      const sc = cylBetween(0.004, V(x, H - L.hdr - 0.002, L.zs), V(x, H + 0.12, L.zs), MAT.ss, 8);
      sc.userData.role = 'fix';
      tip(sc, 'Header screw', '14g × 150 316 screw up through the header and plasterboard into the head beam or new blocking');
      frame.add(sc);
    }
    tip(frame, `Portal frame: 75 × 75 posts, 75 × 50 header`, cfg.shutter.frame === 'galv' ? 'Hot-dip galvanised steel' : 'Powder-coated aluminium to match the shutter');
    grp.add(frame);
    for (const x of [L.box.x0 + 0.15, (L.box.x0 + L.box.x1) / 2, L.box.x1 - 0.15]) {
      const hb = new THREE.Group();
      hb.userData.role = 'struct';
      hb.add(boxAt(x - 0.02, L.box.y1, zA - 0.002, x + 0.02, H - L.hdr + 0.002, L.box.z0 + 0.06, MAT.ss));
      const b = cylBetween(0.004, V(x, L.box.y1 - 0.01, (zA + L.box.z0 + 0.06) / 2), V(x, H - L.hdr + 0.02, (zA + L.box.z0 + 0.06) / 2), MAT.ss, 8);
      b.userData.role = 'fix';
      hb.add(b);
      tip(hb, 'Headbox hanger', 'Stainless bracket and M8 bolt into the header');
      grp.add(hb);
    }
  } else {
    // face fixed: brackets onto the bulkhead face
    const b = L.box;
    for (const x of [0.15, W / 2, W - 0.15]) {
      const br = new THREE.Group();
      br.add(boxAt(x - 0.025, b.y1, b.z0 - 0.002, x + 0.025, b.y1 + 0.004, b.z0 + 0.09, MAT.ss));
      br.add(boxAt(x - 0.025, b.y1 - 0.02, b.z0 - 0.004, x + 0.025, b.y1 + 0.07, b.z0, MAT.ss));
      tip(br, 'Headbox bracket', 'Screwed through the bulkhead cladding into the framing behind it');
      grp.add(br);
    }
  }
}

function updateCurtain() {
  const L = layout;
  if (!L || !curtain.inst) return;
  const p = L.slat.pitch;
  const o = clamp(cfg.shutter.open, 0, 100) / 100;
  const hang = (1 - o) * L.hangMax;
  const barH = L.barH;
  const yBot = Math.max(L.floorS, L.curtainTop - Math.max(hang, barH + 0.01));
  curtain.bar.position.y = yBot;
  // every slat of the curtain: straight up the guides, across to the roll, then wound on the spiral
  const Rl = L.roll, y0 = yBot + barH;
  const hgt = Math.max(0, L.curtainTop - y0);
  const w = windSolve(Rl, hgt);
  const P = { z: 0, y: 0 }, E = { z: 0, y: 0 };
  const at = (s, o) => {
    if (s <= hgt) { o.z = L.zs; o.y = y0 + s; return; }
    s -= hgt;
    if (s <= w.lt) { const f = w.lt > 0 ? s / w.lt : 0; o.z = L.zs + (w.tz - L.zs) * f; o.y = L.curtainTop + (w.ty - L.curtainTop) * f; return; }
    s -= w.lt;
    const psi = arcInv(Rl, Math.max(0, w.W - s));
    const phi = w.phiT + Rl.dir * (w.psiMax - psi);
    const r = Rl.r1 + (Rl.k * psi) / (2 * PI);
    o.z = Rl.cz + r * Math.cos(phi); o.y = Rl.cy + r * Math.sin(phi);
  };
  const m = new THREE.Matrix4();
  for (let i = 0; i < Rl.N; i++) {
    at(i * p, P); at((i + 1) * p, E);
    m.makeRotationX(Math.atan2(E.z - P.z, E.y - P.y));
    m.setPosition(L.cx0, P.y, P.z);
    curtain.inst.setMatrixAt(i, m);
  }
  curtain.inst.count = Rl.N;
  curtain.inst.instanceMatrix.needsUpdate = true;
  curtain.inst.computeBoundingSphere();
  const out = document.getElementById('openOut');
  if (out) out.value = `${Math.round(o * 100)}% open`;
  const range = document.getElementById('openRange');
  if (range && +range.value !== Math.round(cfg.shutter.open)) range.value = Math.round(cfg.shutter.open);
  const run = document.getElementById('runBtn');
  if (run && !anim) run.textContent = o > 0.02 ? 'Close' : 'Open';
  requestRender();
}

/* =====================================================================
   Dump line: blue 1.5" TC firm hose held in the brick-side floor corner,
   through the stainless dump jamb behind the right guide, out to the grate
   ===================================================================== */
const DUMP_R = 0.0275; // 55 mm OD, foam wrapped
const DUMP_LIFT = 0.015; // pass-through centre sits 15 mm + hose radius off the slab; the hose itself lies on the floor
const DUMP_JAMB = 0.075; // 75 × 75 316 SHS dump jamb against the brick
function dumpCentre(W) { return layout?.dumpJamb?.xc ?? W - DUMP_JAMB / 2; }
// option C posts: 50 × 50 × 3 SHS left, 100 × 50 × 3 RHS right (100 across the opening); side frames overlap them 30 mm
const CEIL = { trim: 0.018, wb: 0.009, wbDrop: 0.007, face: 0.014 }; // weatherboard face is 14 mm in front of the white wall corner // ceiling edge at the opening: trim, then weatherboard 7 mm lower
const POST_C = { left: 0.05, right: 0.1, d: 0.05, overlap: 0.03, frameW: 0.06, frameD: 0.055,
  beamH: 0.025, tabW: 0.045, tabL: 0.09, tabT: 0.003, rise: 0.022 }; // tab: 3 + 22 = 7 + 18 (weatherboard lip + trim) // top beam 50 × 25 RHS; S-bent ceiling tabs
function erf(x) { // Abramowitz & Stegun 7.1.26
  const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a));
}
function dumpPort(tankId) {
  const tg = itemGroups[tankId];
  if (!tg) return null;
  const pp = VESSEL_MODULES.unitank?.meta?.ports?.dump || { pos: [0, 0.335, 0.08], dir: [0, 0, 1] };
  tg.updateMatrixWorld(true);
  return { pos: V(...pp.pos).applyMatrix4(tg.matrixWorld), dir: V(...pp.dir).transformDirection(tg.matrixWorld) };
}
function hoseEnd(grp, face, dir, cap = false, clampIt = true, up = undefined) {
  // face = where the ferrule's sealing face sits, dir = pointing out of the hose
  const s = TC.sizes['1.5'];
  const s0 = face.clone().addScaledVector(dir, -0.066), s1 = face.clone().addScaledVector(dir, -s.len + 0.002);
  grp.add(cylBetween(DUMP_R + 0.0025, s0, s1, MAT.ssDull, 24)); // crimped hose barb collar
  grp.add(TC.aim(TC.ferrule('1.5'), face, dir));
  if (cap) grp.add(TC.aim(TC.cap('1.5'), face.clone().addScaledVector(dir, s.gap), dir));
  if (clampIt) grp.add(TC.aim(tcClamp(0.0225), face.clone().addScaledVector(dir, s.gap / 2), dir, up));
}
function hoseMat(len) {
  return texturedMat(MAT.dumpHose, Math.max(1, len / 0.05), 1);
}
function buildDump() {
  clearGroup(G.dump);
  if (!cfg.dump?.show || !layout || !layout.dumpJamb) return;
  const { W, D } = dimsM();
  const L = layout, b = L.dumpJamb;
  const xc = dumpCentre(W);
  const grp = new THREE.Group();
  tip(grp, 'Dump hose', 'Blue 1.5" tri-clamp firm hose lying on the slab: under the 1000 kg rack just inside its back legs, then swinging back to the brick and clamped to the pass-through in the dump jamb');
  const yR = (z) => floorY(z) + DUMP_R; // lying on the slab
  // line under the blue rack, just inside its back legs; without that rack, along the brick
  const zIn = b.z0 - 0.025 - TC.sizes['1.5'].gap; // hose ferrule face, one gasket off the pass-through
  const front = rackInfo.green ? rackInfo.green.frame.max.z : 0.55;
  const blue = rackInfo.blue && rackInfo.blue.frame.max.x > W - 0.25 ? rackInfo.blue : null;
  let xr = xc, zA = clamp(front + 0.42, 0.7, zIn - 0.4), zB = zA;
  if (blue) {
    const f = blue.frame, side = blue.spec.side || 0.045;
    xr = f.max.x - side - 0.01 - DUMP_R;
    zA = clamp(f.min.z - 0.12, front + 0.25, zIn - 0.5);
    zB = clamp(f.max.z, zA + 0.05, zIn - 0.3);
    L.dumpRun = { offBrick: Math.round((W - xr) * 1000) };
  } else L.dumpRun = null;
  const A = V(xr, yR(zA), zA);
  // inner end: clamped to a Unitank dump outlet, or parked on the floor in front of Unitank B
  const port = dumpPort(cfg.dump.connect === 'tankA' ? 'tankA' : 'tankB');
  const lead = [];
  let endFace, endDir, capped = false;
  if (port && cfg.dump.connect !== 'parked') {
    endFace = port.pos.clone().addScaledVector(port.dir, TC.sizes['1.5'].gap);
    endDir = port.dir.clone().negate();
    const p = endFace.clone().addScaledVector(port.dir, 0.066);
    const mid = V((p.x + xr) / 2, Math.max(yR(p.z) + 0.03, p.y * 0.45), (p.z + zA) / 2 - 0.02);
    lead.push(p, p.clone().addScaledVector(port.dir, 0.07), mid, V(xr - 0.02, yR(zA - 0.15), zA - 0.15), A);
  } else {
    const px = port ? port.pos.x : W - 0.3, pz = port ? port.pos.z + 0.24 : front + 0.1;
    endFace = V(px, yR(pz), pz);
    endDir = V(0, 0, -1);
    capped = true;
    const p = endFace.clone().addScaledVector(endDir, -0.066);
    lead.push(p, V((px + xr) / 2, yR(pz + 0.16), pz + 0.16), V(xr, yR(zA - 0.15), zA - 0.15), A);
  }
  const path = new THREE.CurvePath();
  path.add(new THREE.CatmullRomCurve3(lead, false, 'centripetal'));
  const zC = zIn - 0.066 - 0.04, C = V(xc, b.pt, zC);
  if (zB > zA + 0.01) path.add(new THREE.LineCurve3(A, V(xr, yR(zB), zB)));
  const Bp = V(xr, yR(zB), zB), k = (zC - zB) * 0.5;
  // S-bend back to the brick, rising the last 15 mm to the pass-through
  path.add(new THREE.CubicBezierCurve3(Bp, Bp.clone().add(V(0, 0, k)), C.clone().add(V(0, 0, -k)), C));
  path.add(new THREE.LineCurve3(C, V(xc, b.pt, zIn - 0.066)));
  const len = path.getLength();
  const hose = mesh(new THREE.TubeGeometry(path, Math.max(80, Math.round(len * 90)), DUMP_R, 18, false), hoseMat(len));
  hose.userData.ownMat = true;
  grp.add(hose);
  hoseEnd(grp, endFace, endDir, capped, true);
  hoseEnd(grp, V(xc, b.pt, zIn), V(0, 0, 1), false, true, LUGS_OUT);
  // outside the jamb: a stock 1.5" TC spool + KegLand 90° elbow lying flat over the drain, or a cap
  const sz = TC.sizes['1.5'];
  const zOut0 = b.z1 + (b.outLen ?? 0.025); // outside ferrule face
  const drainZ = cfg.drain.show ? D + mm(cfg.drain.offset) : zOut0 + 0.16;
  const out = new THREE.Group();
  if (cfg.dump.outside === 'cap') {
    out.add(TC.aim(TC.joint('1.5', { cap: true, lenA: 0.001 }), V(xc, b.pt, zOut0 + sz.gap / 2), V(0, 0, 1), LUGS_OUT));
    tip(out, 'Tri-clamp end cap', 'Closes the outside of the pass-through when the elbow is off');
  } else {
    // pick the stock spool that puts the elbow's bend closest to the drain centre (or none if it's that close)
    const want = drainZ - zOut0 - ELBOW_E - 2 * sz.gap;
    let spool = 0;
    for (const l of SPOOLS) if (Math.abs(l - want) < Math.abs(spool - want)) spool = l;
    let z = zOut0;
    if (spool > 0) {
      out.add(TC.aim(tcClamp(0.0225), V(xc, b.pt, z + sz.gap / 2), V(0, 0, 1), LUGS_OUT));
      const zA = z + sz.gap, zB = zA + spool;
      out.add(TC.aim(TC.ferrule('1.5', { len: sz.len }), V(xc, b.pt, zA), V(0, 0, -1)));
      out.add(cylBetween(sz.tubeOD / 2, V(xc, b.pt, zA + sz.len), V(xc, b.pt, zB - sz.len), MAT.ss, 20));
      out.add(TC.aim(TC.ferrule('1.5', { len: sz.len }), V(xc, b.pt, zB), V(0, 0, 1)));
      z = zB;
    }
    out.add(TC.aim(tcClamp(0.0225), V(xc, b.pt, z + sz.gap / 2), V(0, 0, 1), LUGS_OUT));
    const zc = z + sz.gap + ELBOW_E;
    out.add(tcElbow(V(xc, b.pt, zc), V(0, 0, -1), V(-1, 0, 0)));
    const off = Math.round((zc - drainZ) * 1000);
    const spoolTxt = spool > 0 ? `${Math.round(spool / 0.0254)}" (${Math.round(spool * 1000)} mm) 1.5" TC spool, then a` : 'A';
    tip(out, 'Outside: spool + elbow', `${spoolTxt} KegLand 1.5" TC 90° elbow (KL10634) lying flat, outlet toward the opening. Bend ${off === 0 ? 'on' : Math.abs(off) + ' mm ' + (off > 0 ? 'past' : 'short of')} the drain centre.`);
    L.dumpOut = { spool, off };
  }
  // two spare 1.5" pass-throughs above the dump line, capped both sides
  for (let i = 1; i <= PASS_SPARE; i++) {
    const y = b.pt + i * PASS_PITCH;
    const cap = new THREE.Group();
    cap.add(TC.aim(TC.joint('1.5', { cap: true, lenA: 0.001 }), V(xc, y, b.z0 - 0.025 - sz.gap / 2), V(0, 0, -1), LUGS_OUT));
    cap.add(TC.aim(TC.joint('1.5', { cap: true, lenA: 0.001 }), V(xc, y, zOut0 + sz.gap / 2), V(0, 0, 1), LUGS_OUT));
    tip(cap, 'Spare pass-through', `1.5" TC tube welded through the post, ${Math.round((y - b.pt + DUMP_LIFT + DUMP_R) * 1000)} mm above the slab, capped inside and out`);
    out.add(cap);
  }
  grp.add(out);
  G.dump.add(grp);
}
const PASS_PITCH = 0.075, PASS_SPARE = 2;      // spare pass-throughs above the dump line
const ELBOW_E = 0.057, ELBOW_R = 0.038;        // KegLand 1.5" 90° elbow: centre line to face, bend radius
const SPOOLS = [0.0508, 0.0762, 0.1016, 0.127, 0.1524, 0.2032, 0.3048]; // stock 1.5" TC spool lengths (2"–12")
const LUGS_OUT = V(-1, 0, 0);                  // pass-through clamps: lugs toward the opening so stacked clamps clear
// 1.5" TC 90° elbow. `c` = where the two centre lines meet; inlet face sits ELBOW_E back along -inDir... i.e. the
// inlet face is at c + faceA * ELBOW_E (faceA points out of the inlet), outlet face at c + faceB * ELBOW_E.
function tcElbow(c, faceA, faceB) {
  const g = new THREE.Group();
  const s = TC.sizes['1.5'], straight = ELBOW_E - ELBOW_R;
  g.add(TC.aim(TC.ferrule('1.5', { len: straight }), c.clone().addScaledVector(faceA, ELBOW_E), faceA));
  g.add(TC.aim(TC.ferrule('1.5', { len: straight, open: true }), c.clone().addScaledVector(faceB, ELBOW_E), faceB));
  // the bend: quarter arc between the two straights, centre at c + (faceA + faceB) * R
  const ac = c.clone().addScaledVector(faceA, ELBOW_R).addScaledVector(faceB, ELBOW_R);
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = (i / 12) * Math.PI / 2;
    pts.push(ac.clone().addScaledVector(faceA, -ELBOW_R * Math.cos(t)).addScaledVector(faceB, -ELBOW_R * Math.sin(t)));
  }
  // pts[0] = c + faceA*R (end of inlet straight), pts[12] = c + faceB*R (start of outlet straight)
  pts.reverse();
  g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, s.tubeOD / 2, 20, false), MAT.ss));
  return g;
}
function ferrule(grp, at, dir, len = 0.025) {
  // welded 1.5" TC ferrule: tube from `at` along dir, sealing face at the far end, no clamp
  const end = at.clone().addScaledVector(dir, len);
  grp.add(TC.aim(TC.ferrule('1.5', { len }), end, dir));
  return end;
}
// Option C left post: 50 × 50 × 3 SHS wedged into the corner (weatherboard + the white wall step), slab and ceiling only
function buildLeftPostC(L, grp) {
  const { H } = dimsM();
  const p = L.postL, fin = uFin();
  const post = new THREE.Group();
  post.userData.role = 'struct';
  const fb = p.yb ?? L.floorS;
  post.add(boxAt(p.x0, fb + 0.006, p.z0, p.x1, p.y1 ?? H, p.z1, fin));
  // 6 mm base plate: tab inside the post with two slab anchors
  post.add(boxAt(p.x0, fb, p.z0 - 0.07, p.x1 + 0.03, fb + 0.006, p.z1, fin));
  for (const [x, z] of [[p.x0 + 0.02, p.z0 - 0.035], [p.x1 + 0.012, p.z0 + 0.025]]) {
    const a = new THREE.Group();
    a.userData.role = 'fix';
    a.add(cyl(0.008, 0.008, 0.006, MAT.ss, x, fb + 0.009, z, 6));
    a.add(cylBetween(0.0045, V(x, fb + 0.012, z), V(x, fb - 0.07, z), MAT.ss, 8));
    tip(a, 'Slab anchor', 'M8 316 anchor through the base tab, 70 mm into the slab');
    post.add(a);
  }
  tip(post, 'Left leg of the U frame', `50 × 50 × 3 316 SHS just clear of the white wall step, its outside face flush with the weatherboard over the opening (14 mm in front of the corner), welded to the top beam. Slab anchors at the bottom; nothing fixed into the shared wall. M6 rivnuts down the outside face for the side frame.${cfg.shutter.uFinish === 'black' ? ' Powder-coated black.' : ''}`);
  grp.add(post);
  buildUBeam(L, grp);
}

function uFin() { return cfg.shutter.mount === 'face' && cfg.shutter.uFinish === 'black' ? MAT.coatBlack : MAT.ssDull; }

// Top of the inverted U: 50 × 25 × 3 RHS between the legs, with three S-bent tabs up to the ceiling joists
function buildUBeam(L, grp) {
  const { W, H } = dimsM();
  const b = L.uBeam, fin = uFin(), P = POST_C;
  const g = new THREE.Group();
  g.userData.role = 'struct';
  g.add(boxAt(b.x0, b.y0, b.z0, b.x1, b.y1, b.z1, fin));
  tip(g, 'Top beam of the U frame', `50 × 25 × 3 316 RHS, ${Math.round((b.x1 - b.x0) * 1000)} mm, welded across the tops of both legs, ${Math.round((H - b.y0) * 1000)} mm below the ceiling at its underside`);
  // tab profile: flat on the beam's inside top edge, then an erf-shaped S that rises onto the ceiling
  const sig = 0.016, L0 = 0.012, n = 24;
  const S = (u) => { const a = erf((-P.tabL / 2) / sig), z = erf((P.tabL / 2) / sig); return (erf((u - P.tabL / 2) / sig) - a) / (z - a); };
  const top = [], bot = [];
  for (let i = 0; i <= n; i++) {
    const u = (P.tabL * i) / n, v = P.rise * S(u);
    bot.push([u, v]); top.push([u, v + P.tabT]);
  }
  const shape = new THREE.Shape();
  shape.moveTo(bot[0][0], bot[0][1]);
  for (const [u, v] of bot.slice(1)) shape.lineTo(u, v);
  for (const [u, v] of top.reverse()) shape.lineTo(u, v);
  shape.closePath();
  for (const jm of cfg.nook.joists || []) {
    const xj = W - jm / 1000;
    if (xj - P.tabW / 2 < b.x0 || xj + P.tabW / 2 > b.x1) continue;
    const tg = new THREE.ExtrudeGeometry(shape, { depth: P.tabW, bevelEnabled: false, curveSegments: 1 });
    tg.rotateY(PI / 2);
    tg.translate(xj - P.tabW / 2, b.y1, b.z0 + L0);
    const tab = mesh(tg, fin);
    tab.userData.role = 'struct';
    tip(tab, 'Ceiling tab', `45 × 90 × 3 mm 316 tab welded on the beam's inside top edge, S-bent to rise ${Math.round(P.rise * 1000)} mm onto the ceiling under the joist ${jm} mm from the brick`);
    g.add(tab);
    for (const dx of [-0.012, 0.012]) {
      const z = b.z0 + L0 - P.tabL + 0.018;
      const sc = new THREE.Group();
      sc.userData.role = 'fix';
      sc.add(cylBetween(0.0045, V(xj + dx, H - P.tabT - 0.003, z), V(xj + dx, H - P.tabT, z), MAT.ss, 12));
      sc.add(cylBetween(0.0028, V(xj + dx, H - P.tabT, z), V(xj + dx, H + 0.09, z), MAT.ss, 8));
      tip(sc, 'Joist screw', `14g × 100 316 batten screw through the tab and plasterboard into the joist ${jm} mm from the brick`);
      g.add(sc);
    }
  }
  grp.add(g);
}

function buildDumpJamb(L, grp) {
  const j = L.dumpJamb;
  const { W, H } = dimsM();
  const post = new THREE.Group(), fin = uFin();
  post.userData.role = 'struct';
  post.add(boxAt(j.x0, j.y0, j.z0, j.x1, j.y1, j.z1, fin));
  // 8 mm base plate with a tab inside and outside the shutter line, two slab anchors in each
  const tx0 = j.rhs ? j.x0 : j.x1 - 0.105, ext = 0.06;
  post.add(boxAt(tx0, j.yb, j.z0 - ext, j.x1, j.yb + 0.008, j.rhs ? j.z1 : j.z1 + ext, fin));
  for (const z of j.rhs ? [j.z0 - 0.034] : [j.z0 - 0.034, j.z1 + 0.034]) for (const x of [tx0 + 0.015, j.x1 - 0.014]) {
    const a = new THREE.Group();
    a.userData.role = 'fix';
    a.add(cyl(0.009, 0.009, 0.008, MAT.ss, x, j.yb + 0.012, z, 6));
    a.add(cylBetween(0.005, V(x, j.yb + 0.016, z), V(x, j.yb - 0.08, z), MAT.ss, 8));
    tip(a, 'Slab anchor', `M10 316 anchor through the ${z < L.zs ? 'inside' : 'outside'} tab, 80 mm into the slab`);
    post.add(a);
  }
  // one cleat on the inside face, two screws up into the ceiling framing (the portal header ties it instead)
  if (j.brick) {
    // C: two angle cleats on the inside face, each with two masonry anchors sideways into the brick
    for (const y of [j.yb + 0.9, H - 0.45]) {
      post.add(boxAt(j.x0 + 0.02, y, j.z0 - 0.004, j.x1, y + 0.06, j.z0, fin));
      post.add(boxAt(j.x1 - 0.005, y, j.z0 - 0.065, j.x1, y + 0.06, j.z0, fin));
      for (const z of [j.z0 - 0.022, j.z0 - 0.048]) {
        const a = cylBetween(0.004, V(j.x1 - 0.008, y + 0.03, z), V(W + 0.07, y + 0.03, z), MAT.ss, 8);
        a.userData.role = 'fix';
        tip(a, 'Brick anchor', 'M8 316 masonry anchor through the cleat, 70 mm into the brick (your own wall, not the shared one)');
        post.add(a);
      }
    }
  } else if (j.y1 >= H - 0.001) {
    post.add(boxAt(j.x0, H - 0.07, j.z0 - 0.004, j.x1, H, j.z0, fin));
    post.add(boxAt(j.x0, H - 0.005, j.z0 - 0.06, j.x1, H, j.z0, fin));
    for (const x of [j.x0 + 0.02, j.x1 - 0.02]) {
      const sc = cylBetween(0.004, V(x, H - 0.008, j.z0 - 0.04), V(x, H + 0.12, j.z0 - 0.04), MAT.ss, 8);
      sc.userData.role = 'fix';
      tip(sc, 'Ceiling cleat screw', '14g × 100 316 screw up through the plasterboard into the head beam or new blocking');
      post.add(sc);
    }
  }
  // 1.5" TC pass-through at the bottom
  const pc = (z) => V(j.xc, j.pt, z);
  for (let i = 0; i <= PASS_SPARE; i++) {
    const p = (z) => pc(z).add(V(0, i * PASS_PITCH, 0));
    ferrule(post, p(j.z0), V(0, 0, -1));
    ferrule(post, p(j.z1), V(0, 0, 1), j.outLen);
  }
  tip(post, j.rhs ? 'Right post: 100 × 50 dump post' : 'Dump jamb: the one custom part', j.rhs ? `100 × 50 × 3 316 RHS against the brick, 100 across the opening. Base tab with two slab anchors, a cleat with two screws into the ceiling framing; nothing drilled into the brick. The side frame overlaps the 30 mm of its outside face nearest the opening; the three 1.5" TC pass-throughs sit centred in the other 70 mm, ${Math.round((L.W - j.xc) * 1000)} mm off the brick, with the outside ferrules long enough that the clamps sit in front of the frame.` : (j.brick ? '75 × 75 × 3 316 stainless post against the brick, on a base plate anchored to the slab and held by two cleats anchored into the brick; the right guide screws onto its face.' : '75 × 75 × 3 316 stainless post against the brick, on a base plate anchored to the slab and cleated into the ceiling framing; nothing is drilled into the brick.') + ' Three 1.5" TC pass-throughs at the bottom: the lowest carries the dump hose under the shutter line, the two above are spares, capped.');
  grp.add(post);
  const seal = boxAt(j.x1 - 0.0005, j.yb + 0.03, j.z0 + 0.005, j.x1, j.y1 - 0.08, j.z1 - 0.005, MAT.rubber);
  tip(seal, 'EPDM seal strip', 'Stuck to the post, closing the gap against the uneven brick');
  grp.add(seal);
}

/* =====================================================================
   Dimensions, labels, slope arrow
   ===================================================================== */
function label(text, cls, pos) {
  const el = document.createElement('div');
  el.className = 'dim' + (cls ? ' ' + cls : '');
  el.textContent = text;
  const o = new CSS2DObject(el);
  o.position.copy(pos);
  return o;
}
function dimLine(a, b, text, cls = '', tickAxis = V(0, 1, 0), mat = MAT.dimLine) {
  const t = tickAxis.clone().multiplyScalar(0.03);
  const pts = [a, b, a.clone().add(t), a.clone().sub(t), b.clone().add(t), b.clone().sub(t)];
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const line = new THREE.LineSegments(geo, mat);
  line.renderOrder = 10;
  G.dims.add(line);
  if (text) G.dims.add(label(text, cls, a.clone().lerp(b, 0.5)));
}
function buildDims() {
  clearGroup(G.dims);
  const { W, D, H, F } = dimsM();
  const L = layout;
  if (cfg.view.slope && F > 0) {
    const x = clamp(W * 0.36, 0.25, W - 0.3);
    const z0 = Math.min(1.15, D * 0.4), z1 = D - 0.38;
    if (z1 - z0 > 0.4) {
      const s = new THREE.Shape();
      const sw = 0.045, hw = 0.13, hl = 0.22, len = z1 - z0;
      s.moveTo(-sw, 0); s.lineTo(sw, 0); s.lineTo(sw, len - hl); s.lineTo(hw, len - hl); s.lineTo(0, len); s.lineTo(-hw, len - hl); s.lineTo(-sw, len - hl); s.lineTo(-sw, 0);
      const g = new THREE.ShapeGeometry(s);
      const pa = g.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        const sx = pa.getX(i), sy = pa.getY(i);
        const z = z0 + sy;
        pa.setXYZ(i, x + sx, floorY(z) + 0.004, z);
      }
      g.computeVertexNormals();
      const arrow = new THREE.Mesh(g, MAT.arrow);
      arrow.renderOrder = 2;
      G.dims.add(arrow);
      const ratio = Math.round(D / F);
      G.dims.add(label(`Fall ${cfg.nook.fall} mm · 1:${ratio}`, 'accent', V(x, floorY((z0 + z1) / 2) + 0.02, (z0 + z1) / 2)));
    }
  }
  if (!cfg.view.dims || !L) return;
  const zo = D + 0.32;
  dimLine(V(0, 0.005, D - 0.04), V(W, 0.005, D - 0.04), `${cfg.nook.width} weatherboard–brick`, '', V(0, 0, 1));
  dimLine(V(mm(cfg.nook.retStep), 0.005, zo), V(W, 0.005, zo), `${cfg.nook.width - cfg.nook.retStep} white wall–brick`, '', V(0, 0, 1));
  const hx = W - 0.04, hz = D + 0.3;
  dimLine(V(hx, 0, D - 0.02), V(hx, H, D - 0.02), `${cfg.nook.height} to ceiling`, '', V(1, 0, 0));
  const zc = L.zs + 0.07;
  const yc = L.floorS + 0.75;
  dimLine(V(L.clearX0, yc, zc), V(L.clearX1, yc, zc), `${Math.round(L.clearW * 1000)} clear`, 'accent', V(0, 1, 0), MAT.dimAccent);
  const vx = L.clearX0 + 0.16;
  dimLine(V(vx, L.floorS, zc), V(vx, L.curtainTop, zc), `${Math.round(L.clearH * 1000)} clear`, 'accent', V(1, 0, 0), MAT.dimAccent);
  const dx = 0.04;
  dimLine(V(dx, floorY(0) + 0.006, 0.0), V(dx, 0.006, D), `${cfg.nook.depth} covered`, 'soft', V(1, 0, 0));
  const b = L.box;
  G.dims.add(label(`Headbox ${Math.round(L.B * 1000)}`, '', V((b.x0 + b.x1) / 2, b.y0 - 0.04, b.z1 + 0.02)));
}

/* =====================================================================
   Checks: clashes, drain, headroom
   ===================================================================== */
const issues = [];
function itemCoreBox(g) {
  const b = new THREE.Box3();
  let any = false;
  g.updateMatrixWorld(true);
  g.traverse((o) => { if (o.isMesh && o.userData.core) { b.union(new THREE.Box3().setFromObject(o, true)); any = true; } });
  if (!any) b.setFromObject(g);
  return b;
}
const shrink = (b, s = 0.004) => b.clone().expandByScalar(-s);
const nameOf = (it) => KINDS[it.kind].name;

function runChecks() {
  issues.length = 0;
  const { W, D, H } = dimsM();
  const L = layout;
  const add = (sev, html) => issues.push({ sev, html });

  // Shutter zones
  const zones = [];
  const bx = L.box;
  zones.push({ label: 'the headbox', box: new THREE.Box3(V(bx.x0, bx.y0, bx.z0), V(bx.x1, bx.y1, bx.z1)) });
  zones.push({ label: 'the curtain path', box: new THREE.Box3(V(L.cx0, L.floorS, L.zs - 0.03), V(L.cx1, L.curtainTop, L.zs + 0.03)) });
  for (const gd of L.guides) zones.push({ label: 'a side guide', box: new THREE.Box3(V(gd.x0, L.floorS, gd.z0), V(gd.x1, L.curtainTop, gd.z1)) });
  if (L.mount === 'portal') {
    zones.push({ label: 'a portal post', box: new THREE.Box3(V(L.off, L.floorS, L.zs - 0.09), V(L.off + L.post, H, L.zs + 0.09)) });
    zones.push({ label: 'a portal post', box: new THREE.Box3(V(W - L.off - L.post, L.floorS, L.zs - 0.09), V(W - L.off, H, L.zs + 0.09)) });
  }
  if (L.mount === 'wall') zones.push({ label: 'the left jamb', box: new THREE.Box3(V(0, L.floorS, L.zs - 0.03), V(0.062, bx.y0, L.zs + 0.03)) });
  if (L.dumpJamb) { const j = L.dumpJamb; zones.push({ label: 'the dump jamb', box: new THREE.Box3(V(j.x0, L.floorS, j.z0 - 0.07), V(j.x1, j.y1, j.z1 + 0.03)) }); }

  const things = [];
  for (const key of ['green', 'blue']) if (rackInfo[key]) things.push({ label: `the ${RACK_NAMES[key]}`, box: rackInfo[key].frame, rack: key });
  for (const it of cfg.items) {
    const g = itemGroups[it.id];
    if (!g) continue;
    things.push({ label: nameOf(it), box: itemCoreBox(g), item: it });
  }

  let shutterClear = true;
  for (const t of things) {
    for (const z of zones) {
      if (shrink(t.box).intersectsBox(z.box)) {
        shutterClear = false;
        add('bad', `<b>${cap(t.label)}</b> is in the way of ${z.label}. Move it at least ${Math.ceil((t.box.max.z - z.box.min.z) * 100) * 10} mm back from the opening.`);
        break;
      }
    }
  }

  // Items against shelving parts
  let shelvesOk = true;
  for (const t of things) {
    if (!t.item) continue;
    const it = t.item;
    const pl = itemWorldPlacement(it);
    const tb = shrink(t.box, 0.003);
    const hits = obstacles.filter((o) => tb.intersectsBox(o.box) && !(pl && o.rack === pl.rackKey && o.levelId === pl.levelId && o.kind !== 'brace'));
    const seen = new Set();
    for (const o of hits) {
      const k = o.rack + o.levelId + o.kind;
      if (seen.has(k)) continue;
      seen.add(k);
      shelvesOk = false;
      if (o.kind === 'deck') {
        let hint = '';
        if (pl && pl.rackKey === o.rack) {
          const spec = rackInfo[o.rack].spec;
          const a0 = Math.round(it.along - halfAlong(it) - 20), a1 = Math.round(it.along + halfAlong(it) + 20);
          if (a0 > o.from) hint = ` Cut that deck back to <b>${Math.max(0, Math.floor(a0 / 10) * 10)} mm</b> from the ${o.rack === 'blue' ? 'back-wall' : 'left'} end, or move the item.`;
          else if (a1 < o.to) hint = ` Start that deck at <b>${Math.min(spec.usable, Math.ceil(a1 / 10) * 10)} mm</b>, or move the item.`;
        }
        add('bad', `<b>${cap(nameOf(it))}</b> passes through the ${o.label}.${hint}`);
      } else if (o.kind === 'brace') {
        add('warn', `<b>${cap(nameOf(it))}</b> hits a ${o.label}. Leave that brace out where the deck is cut, or move the item.`);
      } else {
        add('bad', `<b>${cap(nameOf(it))}</b> hits the ${o.label}.`);
      }
    }
  }

  // Inside the nook, clear of the step, racks clear of each other
  const room = new THREE.Box3(V(-0.002, -0.2, -0.002), V(W + 0.002, H + 0.002, D + 0.4));
  for (const t of things) {
    if (!room.containsBox(shrink(t.box, 0.006))) add('warn', `<b>${cap(t.label)}</b> pokes outside the nook walls.`);
  }
  if (rackInfo.green && rackInfo.blue && shrink(rackInfo.green.frame).intersectsBox(rackInfo.blue.frame)) add('bad', 'The two racks overlap. Move the 1000 kg rack further from the back wall.');
  // Each beam hooks into two slots (n−1 and n) of the same column, so neighbouring shelves need two slots between their numbers
  for (const key of ['green', 'blue']) {
    const ls = sortedLevels(cfg.racks[key]);
    for (let i = 1; i < ls.length; i++) {
      const d = ls[i].slot - ls[i - 1].slot;
      if (d < 2) add('bad', `Shelves ${i} and ${i + 1} of the ${RACK_NAMES[key]} are ${d === 0 ? 'on the same slot' : 'one slot apart'}: their end plates would need the same slot. Move one to slot ${ls[i - 1].slot + 2} or higher.`);
    }
  }
  if (cfg.dump?.show && L.dumpJamb) {
    const xc = dumpCentre(W);
    const xr = L.dumpRun ? W - L.dumpRun.offBrick / 1000 : xc;
    const run = new THREE.Box3(V(xr - DUMP_R, 0, 0.7), V(Math.max(xr, xc) + DUMP_R, 0.06, L.dumpJamb.z0));
    for (const t of things) if (t.item && itemWorldPlacement(t.item) === null && shrink(t.box).intersectsBox(run)) add('warn', `<b>${cap(t.label)}</b> sits on the dump hose's floor run.`);
    add('ok', 'The dump hose crosses the shutter line inside the dump jamb, outside the curtain, so the shutter is standard and closes fully with the hose connected.');
  }

  // Things in the way of the door when it opens into the nook
  if (doorSwing) {
    const ds = doorSwing;
    for (const t of things) {
      const b = t.box;
      if (b.max.y < ds.leafBot) continue;
      const nx = clamp(ds.cx, b.min.x, b.max.x), nz = clamp(ds.cz, b.min.z, b.max.z);
      const inSide = ds.toward > 0 ? b.max.z > ds.cz : b.min.z < ds.cz;
      if (inSide && b.min.x < ds.cx && Math.hypot(nx - ds.cx, nz - ds.cz) < ds.r) add('warn', `<b>${cap(t.label)}</b> is in the laundry door's swing.`);
    }
  }
  // Drain vs bottom bar
  if (cfg.drain.show) {
    const zc = D + mm(cfg.drain.offset), w = mm(cfg.drain.width);
    const g0 = zc - w / 2, g1 = zc + w / 2;
    const s0 = L.zs - 0.01, s1 = L.zs + 0.01;
    if (s1 > g0 && s0 < g1) {
      const moveIn = Math.ceil((s1 - g0) * 1000 / 5) * 5, moveOut = Math.ceil((g1 - s0) * 1000 / 5) * 5;
      if (L.mount === 'face') add('bad', `The bottom bar lands on the drain grate and won't seal. Check where the grate really is (Nook › Drain past roof line); the guides can sit anywhere in the white wall return.`);
      else add('bad', `The bottom bar lands on the drain grate and won't seal. Set the line ${cfg.shutter.setback + moveIn} mm in from the opening, or ${moveOut} mm further out.`);
    } else if (L.zs < g0) {
      add('warn', 'The grate is outside the shutter line, so wash water runs down the fall and pools against the bottom bar when the shutter is down. Hose with it raised 50 mm, or set the line outside the grate.');
    } else {
      add('ok', 'The grate is inside the shutter line, so wash-down water still reaches it with the shutter closed.');
    }
  }

  // Headroom
  const ch = Math.round(L.clearH * 1000);
  if (L.clearH < 2.04) add('warn', `Clear height under the headbox is only ${ch} mm.`);
  if (shutterClear) add('ok', `The shutter, headbox and ${L.mount === 'portal' ? 'portal frame' : L.mount === 'wall' ? 'jamb' : 'brackets'} are clear of the racks and gear.`);
  if (shelvesOk) add('ok', 'Every item fits its shelf: no gear passes through a deck, beam or brace.');
  {
    const sl = L.slat, drop = L.hangMax;
    if (sl.boxes) {
      const maxH = sl.boxes[sl.boxes.length - 1][1], need = sl.inclBox ? drop + L.B : drop;
      if (need > maxH + 1e-6) add('bad', `${sl.short} tops out at ${Math.round(maxH * 1000)} mm${sl.inclBox ? ' including the pelmet' : ''}; this opening needs ${Math.round(need * 1000)} mm.`);
    }
    if (L.area > sl.maxArea) add('bad', `The curtain is ${L.area.toFixed(1)} m²; ${sl.short} is rated to ${sl.maxArea} m².`);
    if (L.spring && !sl.manual) add('bad', `CW lists only motorised controls for the 77 mm widespan: no spring or winder option.`);
    else if (L.spring) add('ok', `${sl.short} manual options: ${sl.manual}. Curtain about ${Math.round(L.kg)} kg.`);
  }
  if (L.mount === 'face' && L.crossGap > 0.002) add('warn', `The slab falls ${cfg.nook.crossFall} mm from the weatherboard to the brick, so the straight bottom bar touches down on the left and leaves a wedge up to ${Math.round(L.crossGap * 1000)} mm high at the right. Ask for a bottom bar seal that takes that up, or set a tapered threshold strip along the shutter line.`);
  if (L.mount === 'face') {
    const j = L.dumpJamb, gR = L.guides[1];
    const clampGap = Math.round(((j.xc - 0.03) - gR.x1) * 1000);
    add('ok', `Nothing is fixed into either wall: the U frame is anchored to the slab and screwed into the three ceiling joists (${(cfg.nook.joists || []).join(', ')} mm from the brick); the headbox is held only at its flush sides, by its end caps screwed through the side frames into the posts.`);
    add(clampGap >= 3 ? 'ok' : 'bad', `Side frames overlap the posts' outside faces by ${Math.round(POST_C.overlap * 1000)} mm (30 mm needed). The tri-clamp pass-throughs sit ${Math.round((L.W - j.xc) * 1000)} mm off the brick, ${clampGap} mm clear of the right frame, with their clamps out in front of it. Frame fixings ${L.guideFix ? L.guideFix.n + ' a side, ' + Math.round(L.guideFix.pitch * 1000) + ' mm apart' : ''}, 100 mm off the floor and the headbox.`);
  } else if (cfg.shutter.partyFix === false) add('ok', L.leftPost ? 'Nothing is fixed into the shared wall: the left post sits in the corner, anchored to the slab and cleated into the ceiling framing.' : 'Nothing is fixed into the shared wall: the left side stands on the slab and is held at the top by the ceiling framing.');
  else add('info', 'The left side is anchored into the wall shared with the other unit. In the ACT that needs the owners corporation’s permission, as does the shutter itself under the default rules.');
  // Ventilation reminder
  add('info', 'With the shutter down the nook has no airflow. Never run the gas burner with it closed, and give the glycol chiller and fermenters somewhere to vent (a vented slat row or leave it 100 mm up).');
  renderIssues();
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function halfAlong(it) {
  const half = { unitank: 235, hlt: 250, mashtun: 255, kettle: 230, g40: 205, kegstack: 340, kegs4: 225, co2: 80, pump: 160, coil: 160, riptide: 151, colossus: 160, pan: 270, reel: 160 };
  return half[it.kind] ?? 200;
}

/* =====================================================================
   UI
   ===================================================================== */
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const k of kids.flat()) {
    if (k == null || k === false) continue;
    el.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
  return el;
}
const syncers = [];
function numRow(id, labelText, { min, max, step = 1, unit = 'mm', get, set }) {
  const lo = () => (typeof min === 'function' ? min() : min);
  const hi = () => (typeof max === 'function' ? max() : max);
  const range = h('input', { type: 'range', id, step });
  const num = h('input', { type: 'number', id: id + '-n', step, inputmode: 'numeric', 'aria-label': labelText });
  const sync = () => {
    const v = get();
    range.min = num.min = lo(); range.max = num.max = hi();
    range.value = v; num.value = Math.round(v * 100) / 100;
  };
  range.addEventListener('input', () => { set(+range.value); num.value = range.value; });
  num.addEventListener('change', () => { set(clamp(+num.value || 0, lo(), hi())); sync(); });
  sync();
  syncers.push(sync);
  return h('div', { class: 'row' }, h('label', { for: id }, labelText), range, h('div', { class: 'num' }, num, h('i', {}, unit)));
}
function selRow(id, labelText, options, get, set) {
  const sel = h('select', { id }, options.map(([v, t]) => h('option', { value: v }, t)));
  sel.value = get();
  sel.addEventListener('change', () => set(sel.value));
  syncers.push(() => { sel.value = get(); });
  return h('div', { class: 'row2' }, h('label', { for: id }, labelText), sel);
}
function checkbox(id, labelText, get, set) {
  const c = h('input', { type: 'checkbox', id });
  c.checked = !!get();
  c.addEventListener('change', () => set(c.checked));
  syncers.push(() => { c.checked = !!get(); });
  return h('label', { class: 'check', for: id }, c, labelText);
}
function section(id, title, sub, open, body) {
  const d = h('details', { class: 'sec', id: 'sec-' + id, open }, h('summary', {}, title, sub ? h('em', {}, sub) : null), h('div', { class: 'sec-body' }, body));
  return d;
}

let dirty = new Set();
let scheduled = false;
function schedule(...parts) {
  parts.forEach((p) => dirty.add(p));
  if (!scheduled) { scheduled = true; requestAnimationFrame(flush); }
}
function flush() {
  scheduled = false;
  const d = dirty;
  dirty = new Set();
  const heavy = ['all', 'room', 'racks', 'items', 'shutter', 'dump'].some((k) => d.has(k));
  if (d.has('all') || d.has('room')) { buildRoom(); d.add('racks'); d.add('shutter'); }
  if (d.has('racks')) { buildRacks(); d.add('items'); d.add('shutter'); }
  if (d.has('items')) buildItems();
  if (d.has('shutter')) buildShutter();
  else if (d.has('curtain')) updateCurtain();
  if (heavy || d.has('dump')) buildDump();
  if (heavy || d.has('dims')) { buildDims(); runChecks(); updateChips(); updateShutterReadout(); }
  if (heavy || d.has('dims') || d.has('dump') || d.has('mode')) applyHighlight();
  save();
  requestRender();
}

function renderIssues() {
  const box = document.getElementById('issues');
  if (!box) return;
  box.replaceChildren(...issues.map((i) => h('div', { class: 'issue ' + i.sev }, h('div', { html: i.html }))));
}

function updateChips() {
  const L = layout;
  const el = document.getElementById('chips');
  if (!el || !L) return;
  const bad = issues.filter((i) => i.sev === 'bad').length;
  const warn = issues.filter((i) => i.sev === 'warn').length;
  const ratio = cfg.nook.fall > 0 ? `1:${Math.round(cfg.nook.depth / cfg.nook.fall)}` : 'level';
  el.replaceChildren(
    h('span', { class: 'chip' }, h('b', {}, 'Opening'), h('span', {}, `${cfg.nook.width} × ${cfg.nook.height}`)),
    h('span', { class: 'chip' }, h('b', {}, 'Clear'), h('span', {}, `${Math.round(L.clearW * 1000)} × ${Math.round(L.clearH * 1000)}`)),
    h('span', { class: 'chip' }, h('b', {}, 'Headbox'), h('span', {}, `${Math.round(L.B * 1000)}`)),
    h('span', { class: 'chip minor' }, h('b', {}, 'Mount'), h('span', {}, `${MOUNTS[L.mount].letter} · ${MOUNTS[L.mount].short}`)),
    h('span', { class: 'chip minor' }, h('b', {}, 'Fall'), h('span', {}, `${cfg.nook.fall} mm · ${ratio}`)),
    h('button', {
      type: 'button', class: 'chip ' + (bad ? 'bad' : warn ? 'warn' : 'ok'),
      onclick: () => { const s = document.getElementById('sec-checks'); s.open = true; s.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); openPanelMobile(); },
    }, h('b', {}, 'Checks'), h('span', {}, bad ? `${bad} clash${bad > 1 ? 'es' : ''}` : warn ? `${warn} to review` : 'all clear')),
  );
}

function updateShutterReadout() {
  const el = document.getElementById('shutterReadout');
  const L = layout;
  if (!el || !L) return;
  el.replaceChildren(
    h('li', {}, h('b', {}, 'Curtain '), `${Math.round((L.cx1 - L.cx0) * 1000)} × ${Math.round((L.hangMax + 0.05) * 1000)} · ${L.area.toFixed(1)} m² · about ${Math.round(L.kg)} kg`),
    h('li', {}, h('b', {}, 'Headbox '), `${Math.round(L.B * 1000)} pelmet for a ${Math.round(L.hangMax * 1000)} mm drop${L.slat.boxes ? '' : ' (sized from the roll; Ozroll sheet has no table)'}`),
    h('li', {}, h('b', {}, 'Slats '), `${L.slat.label}: ${Math.round(L.slat.pitch * 1000)} mm cover, ${L.slat.t * 1000} mm thick${L.slat.est ? ' (est.)' : ''}, ${L.slat.kg} kg/m², foam filled`),
    h('li', {}, h('b', {}, 'Guides '), `${Math.round(L.slat.guide.w * 1000)} × ${Math.round(L.slat.guide.d * 1000)} mm${L.slat.est ? ' (est.)' : ''}, pile-lined`),

    h('li', {}, h('b', {}, 'Floor at the shutter line '), `${Math.round(L.floorS * 1000)} mm above the opening edge`),
  );
  const mb = document.getElementById('mountBlurb');
  if (mb) {
    const M = MOUNTS[cfg.shutter.mount];
    mb.replaceChildren(
      h('p', { class: 'blurb' }, M.blurb),
      h('ul', { class: 'spec' }, M.pros.map((p) => h('li', {}, h('b', {}, '+ '), p)), M.cons.map((c) => h('li', {}, h('b', {}, '– '), c))),
    );
  }
  const js = document.getElementById('jambSpec');
  if (js) {
    const j = L.dumpJamb;
    js.hidden = !j;
    if (j) js.replaceChildren(
      h('p', { class: 'blurb' }, h('b', {}, 'The one custom part: the dump jamb. '), j.brick ? 'A stainless fabricator makes it and you fit it before the shutter company comes. To them it is just a flat face to screw the right guide to. It stands on the slab and is held to the brick by two cleats.' : 'A stainless fabricator makes it and you fit it before the shutter company comes. To them it is just a steel post to fix the right guide and headbox to. It is fixed the same way as the left post: slab and ceiling only.'),
      h('ul', { class: 'spec' },
        h('li', {}, h('b', {}, 'Post '), `${j.rhs ? '100 × 50 × 3 mm 316 stainless RHS (100 across the opening)' : '75 × 75 × 3 mm 316 stainless SHS (square tube)'}, ${Math.round((j.y1 - j.y0) * 1000)} mm long (base plate to ${L.mount === 'portal' ? 'header' : 'ceiling'}), welded to the base plate, capped at the top`),
        h('li', {}, h('b', {}, 'Pass-throughs '), `3 × 38.1 mm 316 tube welded through at ${Math.round(PASS_PITCH * 1000)} mm centres, ${[0, 1, 2].map((i) => Math.round((j.pt - L.floorS + i * PASS_PITCH) * 1000)).join(' / ')} mm above the slab, ${Math.round((L.W - j.xc) * 1000)} mm off the brick${j.rhs ? ` (clear of the 30 mm frame overlap). Each tube ${Math.round((0.025 + (j.z1 - j.z0) + j.outLen) * 1000)} mm flange face to flange face: 25 mm proud inside, ${Math.round((j.z1 - j.z0) * 1000)} through the post, ${Math.round(j.outLen * 1000)} proud outside so the clamps sit clear in front of the ${Math.round(L.frameD * 1000)} mm deep side frame` : ''}, 1.5" tri-clamp ferrule each end`),
        h('li', {}, h('b', {}, 'Base plate '), j.rhs ? '8 mm 316, 100 × 110 mm, a tab on the inside only (the frame stands outside): 2 × M10 316 anchors into the slab, seal under it' : '8 mm 316, 105 × 195 mm, with a tab inside and outside the shutter line: 4 × M10 316 anchors into the slab, seal under it'),
        L.uBeam ? h('li', {}, h('b', {}, 'Frame '), `Inverted U, ${Math.round((L.uBeam.x1 - L.uBeam.x0) * 1000)} mm wide: this leg ${Math.round((L.uBeam.y1 - j.yb) * 1000)} mm floor to top of the U, the 50 × 50 × 3 SHS left leg ${Math.round((L.uBeam.y1 - L.postL.yb) * 1000)} mm (the slab is higher on that side), and a 50 × 25 × 3 RHS top beam butting up under the weatherboard edge, all 316, welded. Three 45 × 90 × 3 mm tabs welded on the beam's inside top edge at ${(cfg.nook.joists || []).join(' / ')} mm from the brick, S-bent to rise 20 mm onto the ceiling, 2 × 14g × 100 316 screws each into the joists. ${cfg.shutter.uFinish === 'black' ? 'Powder-coated black after welding, with the ferrules, their bores and the tube stubs masked so they stay bare.' : 'Bare 316.'}`) : null,
        L.uBeam ? null : j.brick ? h('li', {}, h('b', {}, 'Brick cleats '), '2 × 60 mm 316 angle cleats welded to the inside face, about 900 mm up and 450 mm below the ceiling, each with 2 × M8 316 masonry anchors 70 mm into the brick') : L.mount === 'portal' ? null : h('li', {}, h('b', {}, 'Top '), 'One 60 mm cleat on the inside face, 2 × 14g 316 screws up into the ceiling framing'),
        h('li', {}, h('b', {}, 'Against the brick '), j.brick ? 'Only the two cleats; an EPDM strip on the post closes the gap' : 'Nothing drilled into it: an EPDM strip on the post closes the gap'),
        h('li', {}, h('b', {}, j.rhs ? 'Frame face ' : 'Guide face '), `M6 316 rivnuts down the ${j.rhs ? 'outside face, 15 mm from the opening-side edge,' : 'opening-side face'} to suit the guide fixings: 100 mm off the floor and the headbox, ${L.guideFix ? Math.round(L.guideFix.pitch * 1000) : 450} mm apart`),
        h('li', {}, h('b', {}, 'You add '), cfg.dump.outside === 'cap' ? '5 × 1.5" TC end caps (one closes the hose line outside, four on the spares) and 6 × 1.5" TC clamps and seals (one for the hose)' : `${L.dumpOut && L.dumpOut.spool ? 'a ' + Math.round(L.dumpOut.spool / 0.0254) + '" 1.5" TC spool, ' : ''}a KegLand 1.5" TC 90° elbow (KL10634), 4 × 1.5" TC end caps for the spares, and ${(L.dumpOut && L.dumpOut.spool ? 2 : 1) + 5} × 1.5" TC clamps and seals (one for the hose)`),
      ),
      h('p', { class: 'note' }, L.mount === 'face' ? `Tell the shutter company: face-fit side frames screwed onto two stainless posts (30 mm overlap, M6 rivnuts provided), headbox outside above the opening, held only by its end caps on the side frames (no wall clips); manual ${L.spring ? 'spring-balanced with key lock' : 'drive'}. Clear width ${Math.round(L.clearW * 1000)} mm between the frames.` : `Tell the shutter company: reveal-fit, guides to the floor both sides, standard bottom bar. Clear width ${Math.round(L.clearW * 1000)} mm between ${L.leftPost ? 'a 75 × 75 post on the left, wedged into the corner (slab and ceiling fixed, not fixed to the wall)' : L.mount === 'portal' ? 'the portal frame post on the left' : 'a 50 × 50 × 3 aluminium jamb on the left (anchored through the weatherboard into brick)'} and the 75 × 75 post on the right.`),
    );
  }
  document.querySelectorAll('#mountSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === cfg.shutter.mount)));
  const fr = document.getElementById('frameRow');
  if (fr) fr.hidden = cfg.shutter.mount !== 'portal';
  const sbr = document.getElementById('setbackRow');
  if (sbr) sbr.hidden = cfg.shutter.mount === 'face' || (cfg.shutter.mount === 'wall' && cfg.shutter.partyFix === false);
  const pr = document.getElementById('partyRow');
  if (pr) pr.hidden = cfg.shutter.mount === 'face';
  const ufr = document.getElementById('finishRow');
  if (ufr) ufr.hidden = cfg.shutter.mount !== 'face';
  const mr = document.getElementById('motorRow');
  if (mr) mr.hidden = cfg.shutter.drive !== 'motor';
}

function buildPanel() {
  syncers.length = 0;
  const root = document.getElementById('sections');
  root.replaceChildren();

  // Checks
  root.append(section('checks', 'Checks', 'clashes and drainage', true, h('div', { class: 'issues', id: 'issues' })));

  // Shutter
  const sw = h('div', { class: 'swatches', role: 'group', 'aria-label': 'Shutter colour' });
  const colorIn = h('input', { type: 'color', id: 'shColor', 'aria-label': 'Custom colour' });
  const swName = h('span', { class: 'swatch-name' });
  const syncSw = () => {
    colorIn.value = cfg.shutter.color.toLowerCase();
    const hit = SWATCHES.find(([c]) => c.toLowerCase() === cfg.shutter.color.toLowerCase());
    swName.textContent = hit ? hit[1] : cfg.shutter.color.toUpperCase();
    sw.querySelectorAll('.swatch').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.c.toLowerCase() === cfg.shutter.color.toLowerCase())));
  };
  for (const [c, n] of SWATCHES) {
    sw.append(h('button', { type: 'button', class: 'swatch', style: `background:${c}`, 'data-c': c, title: n, 'aria-label': n, onclick: () => { cfg.shutter.color = c; applyColor(); syncSw(); } }));
  }
  colorIn.addEventListener('input', () => { cfg.shutter.color = colorIn.value; applyColor(); syncSw(); });
  sw.append(colorIn, swName);
  syncers.push(syncSw);
  syncSw();
  const bsw = h('div', { class: 'swatches', role: 'group', 'aria-label': 'Headbox colour' });
  const boxIn = h('input', { type: 'color', id: 'shBoxColor', 'aria-label': 'Custom headbox colour' });
  const boxName = h('span', { class: 'swatch-name' });
  const syncBox = () => {
    const c = (cfg.shutter.boxColor || cfg.shutter.color).toLowerCase();
    boxIn.value = c;
    const hit = SWATCHES.find(([x]) => x.toLowerCase() === c);
    boxName.textContent = hit ? hit[1] : c.toUpperCase();
    bsw.querySelectorAll('.swatch').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.c.toLowerCase() === c)));
  };
  for (const [c, n] of SWATCHES) {
    bsw.append(h('button', { type: 'button', class: 'swatch', style: `background:${c}`, 'data-c': c, title: n, 'aria-label': n, onclick: () => { cfg.shutter.boxColor = c; applyColor(); syncBox(); } }));
  }
  boxIn.addEventListener('input', () => { cfg.shutter.boxColor = boxIn.value; applyColor(); syncBox(); });
  bsw.append(boxIn, boxName);
  syncers.push(syncBox);
  syncBox();
  root.append(section('shutter', 'Roller shutter', 'aluminium', true, [
    h('div', { class: 'row2' }, h('label', { for: 'shColor' }, 'Slats & frames'), sw),
    h('div', { class: 'row2' }, h('label', { for: 'shBoxColor' }, 'Headbox'), bsw),
    selRow('shSlat', 'Slats', Object.entries(SLATS).map(([k, s]) => [k, s.label]), () => cfg.shutter.slat, (v) => { cfg.shutter.slat = v; schedule('shutter'); }),
    h('div', { id: 'setbackRow' }, numRow('shSetback', 'Line in from opening', { min: 0, max: 400, step: 5, get: () => cfg.shutter.setback, set: (v) => { cfg.shutter.setback = v; schedule('shutter'); } })),
    h('div', { id: 'finishRow' }, selRow('shFinish', 'U frame finish', [['black', 'Powder-coated black, ferrules masked'], ['ss', 'Bare 316 stainless']], () => cfg.shutter.uFinish, (v) => { cfg.shutter.uFinish = v; schedule('shutter'); })),
    selRow('shDrive', 'Drive', [['spring', 'Manual: spring balanced, key lock'], ['motor', 'Motorised: tubular motor + switch']], () => cfg.shutter.drive, (v) => { cfg.shutter.drive = v; schedule('shutter'); }),
    h('div', { id: 'motorRow' }, selRow('shMotor', 'Motor end', [['right', 'Right (brick side)'], ['left', 'Left (weatherboard side)']], () => cfg.shutter.motor, (v) => { cfg.shutter.motor = v; schedule('shutter'); })),
    h('div', { class: 'checks' }, checkbox('shInside', 'See inside the headbox', () => cfg.shutter.inside, (v) => { cfg.shutter.inside = v; schedule('shutter'); })),
    h('ul', { class: 'spec', id: 'shutterReadout' }),
  ]));

  // Mounting
  const seg = h('div', { class: 'seg', id: 'mountSeg', role: 'group', 'aria-label': 'Mounting option' });
  for (const [k, M] of Object.entries(MOUNTS)) {
    seg.append(h('button', { type: 'button', 'data-m': k, 'aria-pressed': String(cfg.shutter.mount === k), onclick: () => { cfg.shutter.mount = k; schedule('shutter'); } }, h('b', {}, M.letter), h('span', {}, M.name)));
  }
  root.append(section('mount', 'Mounting', 'kept off the wet slab', true, [
    seg,
    h('div', { id: 'mountBlurb' }),
    h('div', { id: 'jambSpec', class: 'sec-body', style: 'padding:0' }),
    h('div', { id: 'partyRow' }, selRow('shParty', 'Left side', [['wall', 'Anchored into the shared wall'], ['free', 'Post wedged in the corner: nothing fixed to the shared wall']], () => (cfg.shutter.partyFix === false ? 'free' : 'wall'), (v) => { cfg.shutter.partyFix = v === 'wall'; schedule('shutter'); })),
    h('div', { id: 'frameRow' }, selRow('shFrame', 'Frame finish', [['alu', 'Powder-coated aluminium'], ['galv', 'Hot-dip galvanised steel']], () => cfg.shutter.frame, (v) => { cfg.shutter.frame = v; schedule('shutter'); })),
    h('div', { class: 'checks' },
      h('label', { class: 'check', for: 'vMount' }, h('input', { type: 'checkbox', id: 'vMount', 'data-mountmode': '', onchange: (e) => { cfg.view.mountMode = e.target.checked; schedule('mode'); } }), 'Highlight the mounting hardware'),
      checkbox('vXray', 'Show what is assumed behind the cladding and ceiling', () => cfg.view.xray, (v) => { cfg.view.xray = v; schedule('room', 'shutter'); })),
    h('div', { class: 'btns' },
      h('button', { type: 'button', class: 'btn', onclick: () => goView('head') }, 'Look at the headbox'),
      h('button', { type: 'button', class: 'btn', onclick: () => goView('base') }, 'Look at the base'),
    ),
  ]));

  // Nook
  root.append(section('nook', 'Nook', 'walls, slab, door, drain', false, [
    numRow('nW', 'Weatherboard to brick', { min: 1200, max: 2600, step: 1, get: () => cfg.nook.width, set: (v) => { cfg.nook.width = v; schedule('room'); } }),
    numRow('nD', 'Covered depth', { min: 2000, max: 4500, step: 5, get: () => cfg.nook.depth, set: (v) => { cfg.nook.depth = v; schedule('room'); } }),
    numRow('nH', 'Ceiling at roof line', { min: 2100, max: 3200, step: 5, get: () => cfg.nook.height, set: (v) => { cfg.nook.height = v; schedule('room'); } }),
    numRow('nHb', 'Ceiling at back wall', { min: () => cfg.nook.height - 150, max: () => cfg.nook.height, step: 5, get: () => cfg.nook.height - cfg.nook.fall, set: (v) => { cfg.nook.fall = cfg.nook.height - v; schedule('room'); } }),
    numRow('nRet', 'White wall return', { min: 0, max: 400, step: 5, get: () => cfg.nook.ret, set: (v) => { cfg.nook.ret = v; schedule('room', 'shutter'); } }),
    numRow('nRetS', 'White wall step-in', { min: 0, max: 100, step: 1, get: () => cfg.nook.retStep, set: (v) => { cfg.nook.retStep = v; schedule('room', 'shutter'); } }),
    numRow('nXF', 'Floor higher on the left by', { min: -40, max: 40, step: 1, get: () => cfg.nook.crossFall || 0, set: (v) => { cfg.nook.crossFall = v; schedule('room'); } }),
    numRow('nFence', 'Fence to brick', { min: () => cfg.nook.width, max: () => cfg.nook.width + 600, step: 5, get: () => cfg.nook.fenceToBrick, set: (v) => { cfg.nook.fenceToBrick = v; schedule('room'); } }),
    numRow('dZ', 'Door from back', { min: 0, max: () => cfg.nook.depth - cfg.door.width - 400, step: 5, get: () => cfg.door.fromBack, set: (v) => { cfg.door.fromBack = v; schedule('room'); } }),
    numRow('dW', 'Door leaf width', { min: 620, max: 1020, step: 10, get: () => cfg.door.width, set: (v) => { cfg.door.width = v; schedule('room'); } }),
    selRow('dHinge', 'Door hinges', [['back', 'Fermenter end (back wall)'], ['window', 'Window end (HLT side)']], () => cfg.door.hinge, (v) => { cfg.door.hinge = v; schedule('room'); }),
    selRow('dOpens', 'Door opens into', [['laundry', 'The laundry'], ['nook', 'The nook']], () => cfg.door.opens, (v) => { cfg.door.opens = v; schedule('room'); }),
    numRow('dWin', 'Window width', { min: 0, max: 900, step: 10, get: () => cfg.door.window, set: (v) => { cfg.door.window = v; schedule('room'); } }),
    numRow('dWinH', 'Window height', { min: 400, max: 2000, step: 10, get: () => cfg.door.windowH, set: (v) => { cfg.door.windowH = v; schedule('room'); } }),
    numRow('drO', 'Drain past roof line', { min: -250, max: 400, step: 5, get: () => cfg.drain.offset, set: (v) => { cfg.drain.offset = v; schedule('room', 'dims'); } }),
    numRow('drW', 'Drain width', { min: 60, max: 250, step: 5, get: () => cfg.drain.width, set: (v) => { cfg.drain.width = v; schedule('room', 'dims'); } }),
    h('div', { class: 'checks' },
      checkbox('dShow', 'Laundry door', () => cfg.door.show, (v) => { cfg.door.show = v; schedule('room'); }),
      checkbox('drShow', 'Strip drain', () => cfg.drain.show, (v) => { cfg.drain.show = v; schedule('room'); }),
    ),
    h('p', { class: 'note' }, 'Covered depth runs from the back wall to where the weatherboard and roof cover stop. The drain is measured to its centre from that line: positive is outside.'),
  ]));

  // Racks
  root.append(rackSection('green'));
  root.append(rackSection('blue'));

  // Equipment
  root.append(section('items', 'Equipment', 'what sits where', false, [
    h('div', { class: 'item' },
      h('div', { class: 'item-top' }, checkbox('dumpShow', 'Blue 1.5" TC dump hose', () => cfg.dump.show, (v) => { cfg.dump.show = v; schedule('shutter', 'dump'); }), h('small', {}, 'Ø55 firm hose')),
      selRow('dumpTo', 'Inner end', [['tankB', 'Clamped to Unitank B'], ['tankA', 'Clamped to Unitank A'], ['parked', 'Capped, parked on the floor']], () => cfg.dump.connect, (v) => { cfg.dump.connect = v; schedule('dump'); }),
      selRow('dumpOut', 'Outside', [['spout', 'Spool + elbow to the drain'], ['cap', 'Capped']], () => cfg.dump.outside, (v) => { cfg.dump.outside = v; schedule('dump'); }),
    ),
    h('div', { class: 'items', id: 'itemsList' }),
  ]));
  renderItems();

  // View & save
  const ta = h('textarea', { id: 'cfgText', spellcheck: 'false', 'aria-label': 'Settings as text' });
  const toast = h('div', { class: 'toast', id: 'toast', role: 'status' });
  root.append(section('view', 'View and save', null, false, [
    h('div', { class: 'checks' },
      checkbox('vLeft', 'Hide left wall', () => cfg.view.hideLeft, (v) => { cfg.view.hideLeft = v; schedule('room'); }),
      checkbox('vRight', 'Hide right wall', () => cfg.view.hideRight, (v) => { cfg.view.hideRight = v; schedule('room'); }),
      checkbox('vCeil', 'Hide ceiling', () => cfg.view.hideCeiling, (v) => { cfg.view.hideCeiling = v; schedule('room'); }),
      checkbox('vDims', 'Dimensions', () => cfg.view.dims, (v) => { cfg.view.dims = v; schedule('dims'); }),
      checkbox('vSlope', 'Fall arrow', () => cfg.view.slope, (v) => { cfg.view.slope = v; schedule('dims'); }),
      checkbox('vCtx', 'Fence and air-con', () => cfg.view.context, (v) => { cfg.view.context = v; schedule('room'); }),
    ),
    h('p', { class: 'note' }, 'Changes are kept in this browser automatically. Copy the settings to move them to another device.'),
    h('div', { class: 'btns' },
      h('button', { type: 'button', class: 'btn', onclick: async () => {
        const txt = JSON.stringify(cfg);
        ta.value = txt;
        try { await navigator.clipboard.writeText(txt); toast.textContent = 'Settings copied.'; } catch { ta.select(); toast.textContent = 'Copy the text below.'; }
      } }, 'Copy settings'),
      h('button', { type: 'button', class: 'btn', onclick: () => {
        try { cfg = migrate(JSON.parse(ta.value)); buildPanel(); schedule('all'); toast.textContent = 'Settings loaded.'; } catch { toast.textContent = 'That text is not a valid settings block.'; }
      } }, 'Load pasted'),
      h('button', { type: 'button', class: 'btn', onclick: () => { cfg = defaults(); buildPanel(); schedule('all'); toast.textContent = 'Back to the layout from your photos.'; } }, 'Reset'),
    ),
    ta, toast,
  ]));
  updateShutterReadout();
}

function rackSection(key) {
  const spec = RACK_SPECS[RACK_KEYS[key]];
  const r = cfg.racks[key];
  const body = [];
  if (key === 'green') {
    body.push(h('p', { class: 'note' }, `${spec.title}, ${spec.size}. Against the back wall; the Unitanks roll in under it.`));
    body.push(numRow('gX', 'From left wall', { min: 0, max: () => Math.max(0, cfg.nook.width - Math.round(spec.overall * 1000)), step: 5, get: () => r.x, set: (v) => { r.x = v; schedule('racks'); } }));
    body.push(numRow('gZ', 'From back wall', { min: 0, max: 600, step: 5, get: () => r.z, set: (v) => { r.z = v; schedule('racks'); } }));
  } else {
    body.push(h('p', { class: 'note' }, `${spec.title}, ${spec.size}. Along the brick wall, past the laundry door.`));
    body.push(numRow('bZ', 'From back wall', { min: 0, max: () => cfg.nook.depth - Math.round(spec.overall * 1000), step: 5, get: () => r.z, set: (v) => { r.z = v; schedule('racks'); } }));
    body.push(numRow('bG', 'Gap to brick', { min: 0, max: 300, step: 5, get: () => r.gap, set: (v) => { r.gap = v; schedule('racks'); } }));
  }
  const list = h('div', { class: 'levels', id: 'levels-' + key });
  body.push(list);
  body.push(h('div', { class: 'btns' }, h('button', { type: 'button', class: 'btn', onclick: () => addLevel(key) }, '+ Add shelf')));
  body.push(h('p', { class: 'note' }, `Shelves hang on the slots in the uprights, ${Math.round(spec.pitch * 10000) / 10} mm apart and numbered from the floor (slot 1 is ${Math.round(slotTopY(spec, 1) * 1000)} mm up). Each beam hooks into its slot and the one below, so slot 2 is the lowest shelf, slot ${spec.slots} the highest, and the slot numbers of two shelves must differ by at least 2. Heights are to the top of the beam. Cut a deck short to let a tall vessel pass through.`));
  const sec = section('rack-' + key, key === 'green' ? 'Rack · back wall' : 'Rack · brick wall', key === 'green' ? '400 kg, 530 deep' : '1000 kg, 645 deep', false, body);
  queueMicrotask(() => renderLevels(key));
  return sec;
}

function renderLevels(key) {
  const spec = rackSpec(key);
  const r = cfg.racks[key];
  const list = document.getElementById('levels-' + key);
  if (!list) return;
  const ls = sortedLevels(r);
  const endName = key === 'blue' ? 'back-wall end' : 'left end';
  const hText = (lv) => `${levelMM(spec, lv.slot)} mm`;
  const hTitle = (lv) => `Top of the beam. Its end plates hook into slots ${lv.slot - 1} and ${lv.slot}.`;
  list.replaceChildren(...ls.map((lv, i) => {
    const pid = `${key}-${lv.id}`;
    const hEl = h('span', { class: 'slot', title: hTitle(lv) }, hText(lv));
    const deckSeg = h('div', { class: 'deck-seg', role: 'group', 'aria-label': 'Deck' }, ['mdf', 'wire', 'acacia', 'none'].map((d) =>
      h('button', { type: 'button', 'aria-pressed': String(lv.deck === d), onclick: (e) => { lv.deck = d; e.currentTarget.parentNode.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); schedule('racks'); } }, { mdf: 'MDF', wire: 'Wire', acacia: 'Acacia', none: 'None' }[d])));
    const fromIn = h('input', { type: 'number', id: pid + '-from', min: 0, max: spec.usable, step: 10, value: lv.from, 'aria-label': `Deck starts, mm from the ${endName}` });
    const toIn = h('input', { type: 'number', id: pid + '-to', min: 0, max: spec.usable, step: 10, value: lv.to, 'aria-label': `Deck ends, mm from the ${endName}` });
    const applySpan = () => {
      let a = clamp(+fromIn.value || 0, 0, spec.usable), b = clamp(+toIn.value || 0, 0, spec.usable);
      if (b - a < 50) b = Math.min(spec.usable, a + 50);
      lv.from = a; lv.to = b; fromIn.value = a; toIn.value = b; schedule('racks');
    };
    fromIn.addEventListener('change', applySpan);
    toIn.addEventListener('change', applySpan);
    return h('div', { class: 'level' },
      h('div', { class: 'level-top' }, h('span', { class: 'level-tag' }, `S${i + 1}`),
        checkbox(pid + '-front', 'Front beam', () => lv.front, (v) => { lv.front = v; schedule('racks'); }),
        checkbox(pid + '-back', 'Back beam', () => lv.back, (v) => { lv.back = v; schedule('racks'); }),
        hEl,
        h('button', { type: 'button', class: 'icon-btn', title: 'Remove shelf', 'aria-label': `Remove shelf ${i + 1}`, onclick: () => { r.levels = r.levels.filter((l) => l.id !== lv.id); renderLevels(key); renderItems(); schedule('racks'); } }, '×')),
      numRow(pid + '-slot', 'Slot', { min: 2, max: spec.slots, step: 1, unit: 'slot', get: () => lv.slot, set: (v) => { lv.slot = clamp(Math.round(v), 2, spec.slots); hEl.textContent = hText(lv); hEl.title = hTitle(lv); schedule('racks'); } }),
      h('div', { class: 'row2' }, h('label', {}, 'Deck'), deckSeg),
      h('div', { class: 'span-row' }, h('label', { for: pid + '-from' }, 'Span'), h('div', { class: 'num' }, fromIn, h('i', {}, 'mm')), h('span', { class: 'dash' }, '–'), h('div', { class: 'num' }, toIn, h('i', {}, 'mm'))),
    );
  }));
}
function addLevel(key) {
  const spec = rackSpec(key);
  const r = cfg.racks[key];
  // middle of the biggest run of free slots (slot 2 is the lowest shelf, spec.slots the highest)
  const used = [0, ...sortedLevels(r).map((l) => l.slot), spec.slots + 2];
  let best = -1, at = Math.round(spec.slots / 2);
  for (let i = 1; i < used.length; i++) if (used[i] - used[i - 1] > best) { best = used[i] - used[i - 1]; at = Math.round((used[i] + used[i - 1]) / 2); }
  r.levels.push({ id: key[0] + Math.random().toString(36).slice(2, 7), slot: clamp(at, 2, spec.slots), deck: 'mdf', from: 0, to: spec.usable, front: true, back: true });
  renderLevels(key);
  renderItems();
  schedule('racks');
}

function placeOptions() {
  const opts = [['floor', 'Floor']];
  for (const key of ['green', 'blue']) {
    sortedLevels(cfg.racks[key]).forEach((l, i) => opts.push([`${key}:${l.id}`, `${cap(RACK_NAMES[key])} · shelf ${i + 1} (slot ${l.slot}, ${levelMM(rackSpec(key), l.slot)})`]));
  }
  return opts;
}
function renderItems() {
  const list = document.getElementById('itemsList');
  if (!list) return;
  const opts = placeOptions();
  list.replaceChildren(...cfg.items.map((it) => {
    const K = KINDS[it.kind];
    const row = h('div', { class: 'item' + (it.show ? '' : ' off'), id: 'item-' + it.id });
    const top = h('div', { class: 'item-top' },
      checkbox('it-' + it.id, K.name, () => it.show, (v) => { it.show = v; row.classList.toggle('off', !v); schedule('items'); }),
      h('small', {}, K.dims));
    row.append(top);
    const pl = itemWorldPlacement(it);
    if (!K.floorOnly) {
      row.append(selRow('it-' + it.id + '-on', 'On', opts, () => (opts.some(([v]) => v === it.on) ? it.on : 'floor'), (v) => {
        const was = it.on;
        if (v === 'floor' && was !== 'floor') {
          const g = itemGroups[it.id];
          if (g) { const p = new THREE.Vector3(); g.getWorldPosition(p); it.x = Math.round(p.x * 1000); it.z = Math.round(p.z * 1000); }
        } else if (v !== 'floor' && (was === 'floor' || !was)) {
          const spec = RACK_SPECS[RACK_KEYS[v.split(':')[0]]];
          it.along = Math.round(spec.usable / 2);
        }
        it.on = v; renderItems(); schedule('items');
      }));
    }
    if (pl) {
      const spec = RACK_SPECS[RACK_KEYS[pl.rackKey]];
      row.append(numRow('it-' + it.id + '-along', 'Along', { min: 0, max: spec.usable, step: 10, get: () => it.along, set: (v) => { it.along = v; schedule('items'); } }));
      row.append(numRow('it-' + it.id + '-inset', 'Fwd/back', { min: -200, max: 200, step: 5, get: () => it.inset || 0, set: (v) => { it.inset = v; schedule('items'); } }));
    } else {
      row.append(numRow('it-' + it.id + '-x', 'Across', { min: 0, max: () => cfg.nook.width, step: 10, get: () => it.x, set: (v) => { it.x = v; schedule('items'); } }));
      row.append(numRow('it-' + it.id + '-z', 'Depth', { min: 0, max: () => cfg.nook.depth + 300, step: 10, get: () => it.z, set: (v) => { it.z = v; schedule('items'); } }));
    }
    row.append(numRow('it-' + it.id + '-rot', 'Turn', { min: -180, max: 180, step: 5, unit: '°', get: () => it.rot || 0, set: (v) => { it.rot = v; schedule('items'); } }));
    return row;
  }));
}

function applyColor() {
  MAT.headbox.color.set(cfg.shutter.boxColor || cfg.shutter.color);
  MAT.headboxGhost.color.set(cfg.shutter.boxColor || cfg.shutter.color);
  MAT.shutter.color.set(cfg.shutter.color);
  MAT.shutterGhost.color.set(cfg.shutter.color);
  MAT.roll.color.set(cfg.shutter.color).multiplyScalar(0.92);
  save();
  requestRender();
}

/* ---------- panel toggle on phones ---------- */
const panel = document.getElementById('panel');
const panelToggle = document.getElementById('panelToggle');
function openPanelMobile() {
  panel.classList.add('open');
  panelToggle.setAttribute('aria-expanded', 'true');
  panelToggle.textContent = 'Hide';
}
panelToggle.addEventListener('click', () => {
  const open = !panel.classList.contains('open');
  panel.classList.toggle('open', open);
  panelToggle.setAttribute('aria-expanded', String(open));
  panelToggle.textContent = open ? 'Hide' : 'Controls';
});

/* =====================================================================
   Camera views
   ===================================================================== */
const VIEWS = {
  overview: { label: 'Overview', get: ({ W, D }) => ({ pos: [-4.3, 3.0, D + 3.0], tgt: [W * 0.6, 0.9, D * 0.48], cut: { hideLeft: true, hideCeiling: false, hideRight: false } }) },
  outside: { label: 'Outside', get: ({ W, D }) => ({ pos: [W * 0.28, 1.8, D + 5.0], tgt: [W * 0.55, 1.4, D - 0.3], cut: { hideLeft: false, hideCeiling: false, hideRight: false } }) },
  inside: { label: 'Inside', get: ({ W, D }) => ({ pos: [W * 0.3, 1.75, 0.72], tgt: [W * 0.52, 1.45, D], cut: { hideLeft: false, hideCeiling: false, hideRight: false } }) },
  plan: { label: 'Plan', get: ({ W, D }) => ({ pos: [W / 2 + 0.25, Math.max(8, D * 2.6), D / 2 + 0.12], tgt: [W / 2 + 0.25, 0, D / 2 + 0.1], cut: { hideCeiling: true } }) },
  side: { label: 'Section', get: ({ W, D }) => ({ pos: [-4.6, 1.45, D / 2 + 0.2], tgt: [W / 2, 1.25, D / 2 + 0.2], cut: { hideLeft: true, hideCeiling: false } }) },
  head: { label: 'Headbox', hidden: true, get: ({ W, D, H }) => (cfg.shutter.mount === 'face'
    ? { pos: [W * 0.75, H - 0.55, D + 1.6], tgt: [W * 0.25, H + 0.1, D + 0.05], cut: { hideLeft: false, hideCeiling: false } }
    : { pos: [W * 0.55, H - 1.2, D - 2.0], tgt: [W * 0.2, H - 0.3, D - 0.1], cut: { hideLeft: false, hideCeiling: false } }) },
  base: { label: 'Base', hidden: true, get: ({ W, D }) => ({ pos: [W * 0.45, 0.55, D - 0.85], tgt: [0.05, 0.06, layout ? layout.zs : D], cut: { hideLeft: false } }) },
};
let tween = null;
let activeView = 'overview';
function goView(name, instant = false) {
  const V0 = VIEWS[name];
  if (!V0) return;
  const v = V0.get(dimsM());
  let changed = false;
  for (const [k, val] of Object.entries(v.cut || {})) if (cfg.view[k] !== val) { cfg.view[k] = val; changed = true; }
  if (changed) { schedule('room'); syncers.forEach((s) => s()); }
  activeView = name;
  document.querySelectorAll('#views button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === name)));
  const toTgt = V(...v.tgt);
  const toPos = V(...v.pos);
  // pull back on tall, narrow screens so the nook still fits
  const asp = camera.aspect || 1.5;
  if (asp < 1.25 && name !== 'plan') toPos.sub(toTgt).multiplyScalar(Math.pow(clamp(1.25 / asp, 1, 2.6), 0.8)).add(toTgt);
  if (instant || reduceMotion) {
    camera.position.copy(toPos); controls.target.copy(toTgt); controls.update(); requestRender();
    return;
  }
  tween = { t0: performance.now(), dur: 750, fromPos: camera.position.clone(), fromTgt: controls.target.clone(), toPos, toTgt };
}
function stepTween(now) {
  const k = clamp((now - tween.t0) / tween.dur, 0, 1);
  const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
  controls.target.lerpVectors(tween.fromTgt, tween.toTgt, e);
  if (k >= 1) tween = null;
  requestRender();
}
function buildModeButtons() {
  const bar = document.getElementById('modes');
  bar.replaceChildren(h('button', { type: 'button', 'data-mountmode': '', 'aria-pressed': String(!!cfg.view.mountMode), title: 'Fade everything except brackets, posts and fixings',
    onclick: () => { cfg.view.mountMode = !cfg.view.mountMode; schedule('mode'); } }, 'Mounting'));
}
function buildViewButtons() {
  const nav = document.getElementById('views');
  nav.replaceChildren(...Object.entries(VIEWS).filter(([, v]) => !v.hidden).map(([k, v]) =>
    h('button', { type: 'button', 'data-v': k, 'aria-pressed': String(k === activeView), onclick: () => goView(k) }, v.label)));
}
controls.addEventListener('start', () => {
  tween = null;
  activeView = null;
  document.querySelectorAll('#views button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
});

/* =====================================================================
   Shutter run animation
   ===================================================================== */
let anim = null;
function runShutter() {
  const target = cfg.shutter.open > 2 ? 0 : 100;
  if (reduceMotion) { cfg.shutter.open = target; schedule('curtain'); return; }
  const dist = Math.abs(target - cfg.shutter.open);
  anim = { from: cfg.shutter.open, to: target, t0: performance.now(), dur: Math.max(400, dist * 32) };
  document.getElementById('runBtn').textContent = 'Stop';
}
function stepAnim(now) {
  const k = clamp((now - anim.t0) / anim.dur, 0, 1);
  cfg.shutter.open = anim.from + (anim.to - anim.from) * k;
  updateCurtain();
  if (k >= 1) { anim = null; cfg.shutter.open = Math.round(cfg.shutter.open); updateCurtain(); save(); }
}

/* =====================================================================
   Hover tips and click-to-find
   ===================================================================== */
const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();
const tipEl = document.getElementById('tip');
let hoverPending = null;
let downAt = null;
function findTip(o) {
  while (o) { if (o.userData && o.userData.tip) return o; o = o.parent; }
  return null;
}
function pick(ev) {
  const rect = renderer.domElement.getBoundingClientRect();
  ptr.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  ptr.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  ray.setFromCamera(ptr, camera);
  const hits = ray.intersectObjects([G.items, G.racks, G.shutter, G.dump, G.room, G.xray], true);
  for (const hI of hits) {
    if (!hI.object.visible) continue;
    if (hI.object.material && hI.object.material.opacity < 0.3) continue;
    const t = findTip(hI.object);
    if (t) return { obj: t, x: ev.clientX - rect.left, y: ev.clientY - rect.top, point: hI.point.clone() };
  }
  return null;
}
renderer.domElement.addEventListener('pointermove', (ev) => {
  if (ev.pointerType !== 'mouse') return;
  hoverPending = ev;
});
renderer.domElement.addEventListener('pointerleave', () => { tipEl.hidden = true; });
renderer.domElement.addEventListener('pointerdown', (ev) => { downAt = { x: ev.clientX, y: ev.clientY }; tipEl.hidden = true; });
renderer.domElement.addEventListener('pointerup', (ev) => {
  if (!downAt || Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) > 5) return;
  const p = pick(ev);
  if (!p) return;
  const t = p.obj.userData;
  if (ev.pointerType !== 'mouse') showTip(p);
  if (t.itemId) {
    const sec = document.getElementById('sec-items');
    sec.open = true;
    const row = document.getElementById('item-' + t.itemId);
    if (row) {
      row.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      row.classList.add('flash');
      setTimeout(() => row.classList.remove('flash'), 1200);
    }
  } else if (t.rackKey) {
    const sec = document.getElementById('sec-rack-' + t.rackKey);
    sec.open = true;
    sec.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }
});
renderer.domElement.addEventListener('dblclick', (ev) => {
  const p = pick(ev);
  if (!p) return;
  const dir = camera.position.clone().sub(controls.target).normalize();
  const dist = Math.min(camera.position.distanceTo(controls.target), 0.9);
  const toPos = p.point.clone().addScaledVector(dir, dist);
  activeView = null;
  document.querySelectorAll('#views button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  if (reduceMotion) { camera.position.copy(toPos); controls.target.copy(p.point); controls.update(); requestRender(); return; }
  tween = { t0: performance.now(), dur: 550, fromPos: camera.position.clone(), fromTgt: controls.target.clone(), toPos, toTgt: p.point };
});
function showTip(p) {
  const t = p.obj.userData.tip;
  tipEl.replaceChildren(h('b', {}, t.title), t.sub ? h('span', {}, t.sub) : '');
  tipEl.style.left = p.x + 'px';
  tipEl.style.top = p.y + 'px';
  tipEl.hidden = false;
}

/* =====================================================================
   Boot
   ===================================================================== */
function resize() {
  const w = stage.clientWidth, hgt = stage.clientHeight;
  renderer.setSize(w, hgt, false);
  renderer.domElement.style.width = w + 'px';
  renderer.domElement.style.height = hgt + 'px';
  labelRenderer.setSize(w, hgt);
  camera.aspect = w / Math.max(1, hgt);
  camera.updateProjectionMatrix();
  requestRender();
}
new ResizeObserver(resize).observe(stage);

function loop(now) {
  requestAnimationFrame(loop);
  if (tween) stepTween(now);
  if (anim) stepAnim(now);
  const moved = controls.update();
  if (hoverPending && !tween) {
    const p = pick(hoverPending);
    hoverPending = null;
    if (p) showTip(p); else tipEl.hidden = true;
  }
  if (needsRender || moved) {
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
    needsRender = false;
  }
}

function start(data) {
  const fromHot = data && data.cfg;
  cfg = migrate(fromHot || loadSaved() || defaults());
  makeTextures();
  makeMaterials();
  TC = createTriClamp(THREE, MAT);
  vctx = { MAT, labelTex, core, tc: TC, decal: (t, w, h) => decal(t, w, h, 0, 0, 0) };
  buildPanel();
  buildViewButtons();
  buildModeButtons();
  const range = document.getElementById('openRange');
  range.value = cfg.shutter.open;
  range.addEventListener('input', () => { anim = null; cfg.shutter.open = +range.value; schedule('curtain'); });
  document.getElementById('runBtn').addEventListener('click', () => {
    if (anim) { anim = null; cfg.shutter.open = Math.round(cfg.shutter.open); updateCurtain(); save(); return; }
    runShutter();
  });
  buildRoom(); buildRacks(); buildItems(); buildShutter(); buildDump(); buildDims(); runChecks(); updateChips(); updateShutterReadout(); applyHighlight();
  resize();
  goView('overview', true);
  requestAnimationFrame(loop);
  window.__nook = { cfg: () => cfg, issues, goView, schedule, renderer, scene, camera, controls };
}

window.claude?.hot?.snapshot?.(() => ({ cfg }));
if (window.claude?.hot?.ready) window.claude.hot.ready(start);
else start(window.claude?.hot?.data ?? {});

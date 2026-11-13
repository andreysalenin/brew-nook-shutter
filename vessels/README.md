# Vessel module contract

You are rebuilding one piece of brewing equipment as a Three.js (r169) model for a 3D planner of a
home-brewery nook. The current models look "janky"; the goal is a model a brewer would recognise as
their exact unit: right proportions, right fittings in the right places, clean geometry.

## File
- Write ONE file: `/home/claude/build/vessels/<id>.js`. Plain ES module with NO `import` statements.
- Export `meta` and `build(THREE, ctx, opts = {})`. Optionally export `defaultOptions`.
- Do not edit any other file in the project. Screenshots go in `vessels/shots/` (the tool does this).

## Coordinates and units
- Metres. Origin = bottom centre of the footprint (y = 0 is where it rests on the floor or shelf).
- +y up. **+z is the FRONT** (the side the user faces: logo, controller, main valves). x is left/right.
- Return a `THREE.Group`.

## ctx
- `ctx.MAT` shared PBR materials. Use them where they fit, so everything matches the scene:
  `ss` (polished 304), `ssDouble`, `ssDull` (satin/brushed), `alu`, `neoprene` (Ss jacket),
  `black` (black plastic), `rubber`, `rubberDouble`, `clear` (sight glass, transparent),
  `blueHandle`, `red`, `green`, `yellow`, `pvc` (white plastic), `wheel` (grey PU caster wheel),
  `seam` (dark stitching), `hole` (near-black for openings), `perf` (perforated stainless sheet via
  alphaMap; repeat 3×3 over its UVs), `dialFace` (basic material, gauge/thermometer face).
- `ctx.labelTex(w, h, draw(ctx2d, w, h))` returns a CanvasTexture for logos/stickers/screens.
- `ctx.decal(tex, w, h)` returns a plane mesh (faces +z) using that texture; position it yourself.
- `ctx.core(mesh)` flags a mesh as the solid main body (shell, lid, jacket) for clash checks.
  Flag only the body, never handles, valves, clamps or hoses.
- Extra materials or textures you need: create them ONCE, lazily, at module level (cache on first
  build), never per call. No network assets, no DOM access outside ctx.labelTex, no Math.random.

## Quality bar
- Shells from `LatheGeometry` profiles (rolled rims, domed lids, cone transitions, radiused corners),
  not stacked primitive cylinders. Real proportions from published specs and the user's photos.
- Fittings look like fittings: tri-clamp ferrules with a flange lip, hinged clamp ring + wing nut,
  butterfly valves with a lever and squeeze grip, ball valves with a handle, hex nuts where present.
  Tri-clamp sizes: 1.5" ferrule flange OD 50.5 mm on 38.1 mm tube; 2" flange 64 mm; 3" 91 mm;
  4" 119 mm; 6" 167 mm.
- No floating parts, no gaps between pieces that should touch, no parts poking through shells.
- Sensible segment counts (48–64 radial for main shells, 12–24 for fittings). Merge static parts that
  share a material when it is easy (`BufferGeometry` merge by hand or keep separate, your call).
- Do not set castShadow/receiveShadow; the app does.

## Test loop
```
cd /home/claude/build && node vessels/vshot.mjs <id>                 # front threeq back top low
node vessels/vshot.mjs <id> threeq:3@0,0.5,0.15 side front:2.5@0,0.3,0.2   # zoom 3× on a point
```
It prints JSON stats (bounding box size in mm, core size, triangles, meshes) and writes
`vessels/shots/<id>_<view>.png`. Look at them with the Read tool. The floor grid is 100 mm squares.
Iterate until the shots look right from every angle. Check the stats against the real dimensions.

## Reference photos (the user's own gear)
Crop and enlarge them with python3 + PIL into /tmp, then Read the crops.
- `/mnt/user-data/uploads/4d89189a-image.png` (1104×1466): two Unitanks close up on caster stands.
- `/mnt/user-data/uploads/58d91c4e-image.png` (3072×4080): Unitanks under a shelf (x 1350–2750,
  y 1950–3950); boil kettle on the floor at left (x 1000–1550, y 2300–3600); five kegs lying on the
  top shelf (x 1900–3072, y 0–650).
- `/mnt/user-data/uploads/147a5554-image.png` (1104×1466): HLT on a wire shelf, top left
  (x 50–530, y 240–730); InfuSsion mash tun on the right (x 470–910, y 580–1110).
- `/mnt/user-data/uploads/786f8bef-image.png` (1104×1466): kegs standing on the floor (black rubber
  tops/bottoms), Unitanks behind them.
- `/mnt/user-data/uploads/c60c66e2-image.png` (3456×4608): older wide shot; rack on the right with
  the HLT and mash tun; kettle on the floor at front right.
The current (janky) version of each model is in `/home/claude/build/src/main.js` inside
`const BUILD = {` (methods `unitank`, `hlt`, `mashtun`, `kettle`, `keg`). Read it to see what to beat,
but write your own from scratch.

## Report back
Keep it short: file path, final bbox and core size in mm, triangles and meshes, `meta.ports`
if any, and anything you could not confirm about the real product.

## ctx.tc (shared tri-clamp)
`ctx.tc` is one shared tri-clamp (sanitary / tri-clover) kit, built by `vessels/triclamp.js`
(`createTriClamp(THREE, MAT)`; main.js must pass the same object as `ctx.tc`). Use it for every TC
fitting instead of home-made ferrules/clamps. Sizes: `'1.5'`, `'3'`, `'6'` (numbers work too).

Every builder returns a `THREE.Group` built along **+z**, origin at the sealing face:
- `tc.ferrule(size, { len, open, reduce })`: flange face at z = 0, tube running toward −z by `len`
  (default: chart length). `open: true` shows the bore, gasket groove and a dark hole disc (for
  unclamped ports); `reduce: 0.0127` makes a reducing ferrule on a 1/2" (12.7 mm) tube.
- `tc.gasket(size, { rimOnly })`: white silicone gasket with its bead, centred on z = 0.
- `tc.clamp(size, { angle, flip })`: single-pin 2-segment heavy-duty clamp centred on the joint
  plane z = 0. At angle 0 the lugs (eye bolt + cross-hole wing nut) are at local **+y** and the nut
  hangs toward +x; `angle` rolls it about z, `flip` turns it over so the nut hangs toward −x.
  Hinge knuckles + pin at −y. Casting is `MAT.ssDull`, bolt/pins/nut `MAT.ss`.
- `tc.cap(size)`: blank end cap, sealing face at z = 0 facing −z, body toward +z (`sizes[s].capT` thick).
- `tc.joint(size, { lenA, lenB, angle, flip, cap, openB, reduceA, reduceB, gasket })`: the joint
  plane is z = 0. Ferrule A's face sits at −gap/2 with its tube toward −z (lenA); then the gasket
  (`'rim'` by default: only the band that can show, `'full'`, or `false`), the clamp, and ferrule B
  (tube toward +z, lenB) or, with `cap: true`, a blank cap whose face is at +gap/2.
- `tc.aim(obj, at, dir, up)`: puts obj at `at`, local +z along `dir`, local +y (the clamp lugs at
  angle 0) toward `up` projected off `dir`. Without `up` it behaves like main.js `aimed()`.
- `tc.bake(obj)`: `[{ material, geometry }]` with obj's transform applied (fresh clones, safe to
  merge/dispose). Models that merge everything by material use this:
  `for (const { material, geometry } of tc.bake(tc.aim(tc.joint('1.5', {...}), p, dir, up))) put(material, geometry);`
- `tc.sizes[size]` (metres): `tubeOD, tubeID, wall, flangeOD, rim` (flange rim 2.85 mm),
  `taperDeg` (20° back taper), `flangeBack` (face to taper/tube junction), `beadD`, `grooveDepth`,
  `len`, `gasketID, gasketOD, gap` (1.2 mm compressed gasket), `clampLipD, clampChanD, clampOD,
  clampW, boltD`, `capT`. `tc.gasketMat` is the gasket material.
- Geometry is cached per size/variant and flagged `userData.shared = true` (never dispose it; the
  groups can be added to a scene directly and share their buffers).
- Budget: 1.5" ferrule 192 tris (open 400), clamp 852, full joint 1,300; 3" joint 1,748; 6" joint 2,644.

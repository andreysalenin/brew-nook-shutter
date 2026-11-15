// A3 fabrication drawing set for the option-C inverted-U frame, drawn with jsPDF in paper millimetres.
// makeFabPdf(jsPDF, D) -> jsPDF document. D comes from fabData() in main.js (all sizes in mm).
function makeFabPdf(jsPDF, D) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3', compress: true });
  const PW = 420, PH = 297;
  const INK = [24, 24, 27], CL = [110, 110, 116], ACC = [214, 88, 22], BLUE = [28, 88, 168], COAT = [52, 52, 56], SOFT = [236, 236, 238], BARE = [196, 200, 206];
  const SHEETS = ['GENERAL ARRANGEMENT', 'DETAILS: PASS-THROUGHS, BASE PLATES, CEILING TABS', 'DRILLING, RIVNUTS AND FIXINGS', 'FABRICATION AND FINISH SEQUENCE'];
  if (D.views && D.views.length) SHEETS.push('3D VIEWS (REFERENCE, NOT TO SCALE)');
  const f1 = (v) => (Math.round(v * 10) / 10).toString();
  const f0 = (v) => Math.round(v).toString();
  const black = D.finish === 'black';

  // ---------- pens, text, primitives ----------
  const pen = (w, c = INK, dash) => { doc.setLineWidth(w); doc.setDrawColor(...c); doc.setLineDashPattern(dash || [], 0); };
  const THICK = 0.5, MED = 0.35, THIN = 0.18;
  const fill = (c) => doc.setFillColor(...c);
  const txt = (s, x, y, o = {}) => {
    doc.setFont('helvetica', o.bold ? 'bold' : o.italic ? 'oblique' : 'normal');
    doc.setFontSize(o.size || 7);
    doc.setTextColor(...(o.color || INK));
    doc.text(String(s), x, y, { align: o.align || 'left', angle: o.angle || 0, baseline: o.base || 'alphabetic', maxWidth: o.maxWidth });
  };
  const ln = (x1, y1, x2, y2) => doc.line(x1, y1, x2, y2);
  const poly = (pts, closed = false, style = 'S') => {
    if (pts.length < 2) return;
    const segs = [];
    for (let i = 1; i < pts.length; i++) segs.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
    doc.lines(segs, pts[0][0], pts[0][1], [1, 1], style, closed);
  };
  const arrowHead = (x, y, dx, dy, c = INK) => {
    const L = 2.2, Wd = 0.7, nx = -dy, ny = dx;
    fill(c);
    doc.triangle(x, y, x - dx * L + nx * Wd, y - dy * L + ny * Wd, x - dx * L - nx * Wd, y - dy * L - ny * Wd, 'F');
  };
  const dot = (x, y, r = 0.5, c = INK) => { fill(c); doc.circle(x, y, r, 'F'); };
  const hatch = (x0, y0, x1, y1, sp = 1.4, c = INK) => {
    pen(0.12, c);
    const h = y1 - y0;
    for (let cc = x0 - h; cc < x1; cc += sp) {
      const t0 = Math.max(0, x0 - cc), t1 = Math.min(h, x1 - cc);
      if (t1 > t0) ln(cc + t0, y1 - t0, cc + t1, y1 - t1);
    }
  };
  const view = (px, py, s) => ({ s, X: (x) => px + x * s, Y: (y) => py - y * s });
  const vrect = (v, x0, y0, x1, y1, style = 'S') => doc.rect(v.X(Math.min(x0, x1)), v.Y(Math.max(y0, y1)), Math.abs(x1 - x0) * v.s, Math.abs(y1 - y0) * v.s, style);

  // ---------- dimensioning (AS 1100 style: closed arrowheads, text above the line, reading from below or the right) ----------
  const EXT_GAP = 1, EXT_OVER = 1.6;
  function dimH(xa, xb, yLine, ya, yb, label, o = {}) {
    pen(THIN, o.c || INK);
    if (ya != null) ln(xa, ya + Math.sign(yLine - ya) * EXT_GAP, xa, yLine + Math.sign(yLine - ya) * EXT_OVER);
    if (yb != null) ln(xb, yb + Math.sign(yLine - yb) * EXT_GAP, xb, yLine + Math.sign(yLine - yb) * EXT_OVER);
    const w = Math.abs(xb - xa), lo = Math.min(xa, xb), hi = Math.max(xa, xb);
    if (w >= 7) { ln(lo, yLine, hi, yLine); arrowHead(lo, yLine, -1, 0, o.c); arrowHead(hi, yLine, 1, 0, o.c); }
    else { ln(lo - 5, yLine, hi + 5, yLine); arrowHead(lo, yLine, 1, 0, o.c); arrowHead(hi, yLine, -1, 0, o.c); }
    const tx = o.tx != null ? o.tx : (w >= Math.max(7, String(label).length * 1.35) ? (lo + hi) / 2 : hi + 2 + String(label).length * 0.7);
    txt(label, tx, yLine - 0.9, { align: 'center', size: o.size || 7, color: o.c || INK, bold: o.bold });
  }
  function dimV(ya, yb, xLine, xa, xb, label, o = {}) {
    pen(THIN, o.c || INK);
    if (xa != null) ln(xa + Math.sign(xLine - xa) * EXT_GAP, ya, xLine + Math.sign(xLine - xa) * EXT_OVER, ya);
    if (xb != null) ln(xb + Math.sign(xLine - xb) * EXT_GAP, yb, xLine + Math.sign(xLine - xb) * EXT_OVER, yb);
    const h = Math.abs(yb - ya), lo = Math.min(ya, yb), hi = Math.max(ya, yb);
    if (h >= 7) { ln(xLine, lo, xLine, hi); arrowHead(xLine, lo, 0, -1, o.c); arrowHead(xLine, hi, 0, 1, o.c); }
    else { ln(xLine, lo - 5, xLine, hi + 5); arrowHead(xLine, lo, 0, 1, o.c); arrowHead(xLine, hi, 0, -1, o.c); }
    const ty = o.ty != null ? o.ty : (h >= Math.max(7, String(label).length * 1.35) ? (lo + hi) / 2 : lo - 2 - String(label).length * 0.7);
    txt(label, xLine - 0.9, ty, { align: 'center', angle: 90, size: o.size || 7, color: o.c || INK, bold: o.bold });
  }
  // a leader from (x,y) to a note at (tx,ty); the shoulder runs toward the text
  function leader(x, y, tx, ty, lines, o = {}) {
    pen(THIN, o.c || INK);
    const right = tx >= x;
    ln(x, y, tx + (right ? -2 : 2), ty);
    ln(tx + (right ? -2 : 2), ty, tx, ty);
    if (o.dot) dot(x, y, 0.55, o.c || INK); else arrowHead(x, y, (x - tx) / Math.hypot(x - tx, y - ty), (y - ty) / Math.hypot(x - tx, y - ty), o.c || INK);
    const L = Array.isArray(lines) ? lines : [lines];
    L.forEach((s, i) => txt(s, tx + (right ? 0.8 : -0.8), ty + 1.1 + i * 3, { align: right ? 'left' : 'right', size: o.size || 7, bold: i === 0 && o.bold, color: o.tc || INK }));
  }
  function balloon(n, x, y, px, py) {
    pen(THIN);
    ln(px, py, x, y);
    dot(px, py, 0.5);
    fill([255, 255, 255]);
    pen(MED);
    doc.circle(x, y, 3.2, 'FD');
    txt(n, x, y + 1.15, { align: 'center', size: 7.5, bold: true });
  }
  const centreLineH = (x0, x1, y) => { pen(THIN, CL, [5, 1, 1, 1]); ln(x0, y, x1, y); pen(THIN); };
  const centreLineV = (x, y0, y1) => { pen(THIN, CL, [5, 1, 1, 1]); ln(x, y0, x, y1); pen(THIN); };
  const crossMark = (x, y, r) => { centreLineH(x - r - 2, x + r + 2, y); centreLineV(x, y - r - 2, y + r + 2); };
  function viewTitle(x, y, title, scale, sub) {
    txt(title, x, y, { size: 9.5, bold: true, align: 'center' });
    pen(MED); ln(x - doc.getTextWidth(title) / 2, y + 1.2, x + doc.getTextWidth(title) / 2, y + 1.2);
    txt(`SCALE ${scale}${sub ? '  ·  ' + sub : ''}`, x, y + 4.6, { size: 6.5, align: 'center', color: CL });
  }
  function sectionMark(x, y, letter, dir) { // dir: arrow direction (dx, dy) for the viewing direction
    pen(MED); fill([255, 255, 255]); doc.circle(x, y, 2.8, 'FD');
    txt(letter, x, y + 1.1, { align: 'center', size: 7, bold: true });
    pen(THICK); ln(x + dir[0] * 2.8, y + dir[1] * 2.8, x + dir[0] * 8, y + dir[1] * 8); arrowHead(x + dir[0] * 9, y + dir[1] * 9, dir[0], dir[1]);
  }
  function weldSymbol(x, y, tx, ty, size, allRound = true, o = {}) {
    // arrow to the joint, reference line, fillet triangle below the line (arrow side), all-round circle
    pen(THIN, o.c || INK);
    ln(x, y, tx, ty);
    arrowHead(x, y, (x - tx) / Math.hypot(x - tx, y - ty), (y - ty) / Math.hypot(x - tx, y - ty), o.c || INK);
    const L = 16, dirx = tx >= x ? 1 : -1;
    ln(tx, ty, tx + dirx * L, ty);
    if (allRound) { doc.circle(tx, ty, 1.1, 'S'); }
    const fx = tx + dirx * 5;
    poly([[fx, ty], [fx, ty + 2.4], [fx + dirx * 2.4, ty]], true);
    txt(size, fx - dirx * 1.2, ty + 2.6, { size: 6.5, align: dirx > 0 ? 'right' : 'left' });
    if (o.note) txt(o.note, tx + dirx * (L + 1), ty + 1, { size: 6.5, align: dirx > 0 ? 'left' : 'right', color: o.c || INK, bold: !!o.bold });
  }

  // ---------- sheet frame and title block ----------
  function sheet(n) {
    if (n > 1) doc.addPage('a3', 'landscape');
    pen(0.7); doc.rect(10, 10, PW - 20, PH - 20);
    pen(THIN); doc.rect(7, 7, PW - 14, PH - 14);
    // zone markers
    const cols = 8, rows = 6;
    for (let i = 0; i < cols; i++) {
      const x = 10 + ((PW - 20) * (i + 0.5)) / cols;
      txt(i + 1, x, 9.3, { align: 'center', size: 6, color: CL }); txt(i + 1, x, PH - 7.7, { align: 'center', size: 6, color: CL });
      if (i) { pen(THIN); const xx = 10 + ((PW - 20) * i) / cols; ln(xx, 7, xx, 10); ln(xx, PH - 10, xx, PH - 7); }
    }
    for (let i = 0; i < rows; i++) {
      const y = 10 + ((PH - 20) * (i + 0.5)) / rows, L = 'ABCDEF'[i];
      txt(L, 8.5, y + 1, { align: 'center', size: 6, color: CL }); txt(L, PW - 8.5, y + 1, { align: 'center', size: 6, color: CL });
      if (i) { pen(THIN); const yy = 10 + ((PH - 20) * i) / rows; ln(7, yy, 10, yy); ln(PW - 10, yy, PW - 7, yy); }
    }
    // title block
    const x0 = 262, y0 = 250, x1 = PW - 10, y1 = PH - 10;
    pen(MED); fill([255, 255, 255]); doc.rect(x0, y0, x1 - x0, y1 - y0, 'FD');
    pen(THIN);
    ln(x0, y0 + 13, x1, y0 + 13); ln(x0, y0 + 25, x1, y0 + 25);
    ln(x0 + 74, y0 + 13, x0 + 74, y1); ln(x0 + 111, y0 + 13, x0 + 111, y1);
    txt('BREW NOOK  ·  ROLLER SHUTTER U-FRAME', x0 + 3, y0 + 5.3, { size: 10, bold: true });
    txt(SHEETS[n - 1], x0 + 3, y0 + 10.5, { size: 7.5, bold: true, color: ACC });
    const cell = (x, y, k, v, o = {}) => { txt(k, x + 2, y + 3.2, { size: 5.2, color: CL }); txt(v, x + 2, y + 8.6, { size: o.size || 7.5, bold: o.bold }); };
    cell(x0, y0 + 13, 'MATERIAL', '316 STAINLESS');
    cell(x0 + 37, y0 + 13, 'FINISH', black ? 'POWDER COAT BLACK' : 'BARE 316', { size: 7 });
    cell(x0 + 74, y0 + 13, 'UNITS', 'mm');
    cell(x0 + 111, y0 + 13, 'SHEET', `${n} OF ${SHEETS.length}`, { bold: true });
    cell(x0, y0 + 25, 'DRAWN', 'Brew Nook Planner');
    cell(x0 + 37, y0 + 25, 'DATE', D.date);
    cell(x0 + 74, y0 + 25, 'PROJECTION', '');
    cell(x0 + 111, y0 + 25, 'SIZE / REV', 'A3  ·  A');
    // third-angle projection symbol
    const sx = x0 + 88, sy = y0 + 31.5;
    pen(THIN); doc.circle(sx + 9, sy, 2.2); doc.circle(sx + 9, sy, 1);
    poly([[sx, sy - 2.2], [sx + 5, sy - 1], [sx + 5, sy + 1], [sx, sy + 2.2]], true);
    centreLineH(sx - 1, sx + 12.5, sy);
    pen(THIN); ln(x0 - 2, y0 - 2, x0 - 2, y0 - 2);
    // general tolerance strip above the title block
    txt('UNLESS NOTED: DIMENSIONS IN mm  ·  LINEAR ±1  ·  HOLE CENTRES ±0.5  ·  ANGLES ±0.5°  ·  BREAK SHARP EDGES', x0, y0 - 2, { size: 5.6, color: CL });
  }

  // =====================================================================================
  // SHEET 1: GENERAL ARRANGEMENT
  // =====================================================================================
  sheet(1);
  const s1 = 0.08; // 1:12.5
  const E = view(62, 246, s1);
  const Wd = D.width, top = D.top, bH = D.beam.h, pt = D.plateT;
  const yL0 = D.slabStepL; // left slab is higher by this much
  const LL = D.leftLeg, RL = D.rightLeg;
  // ceiling, slab and walls (context, thin)
  pen(THIN, CL, [2, 1]);
  ln(E.X(-120), E.Y(D.ceiling.plaster), E.X(Wd + 30), E.Y(D.ceiling.plaster));
  txt('U/S PLASTERBOARD', E.X(-122), E.Y(D.ceiling.plaster) - 1, { size: 5.5, color: CL, align: 'right' });
  ln(E.X(-120), E.Y(top), E.X(-30), E.Y(top));
  txt('U/S WEATHERBOARD LIP', E.X(-122), E.Y(top) + 2.6, { size: 5.5, color: CL, align: 'right' });
  pen(MED, CL);
  ln(E.X(-120), E.Y(yL0), E.X(Wd + 60), E.Y(0));
  txt('SLAB (FALLS ' + f1(yL0) + ' TO BRICK)', E.X(-122), E.Y(yL0) + 0.8, { size: 5.5, color: CL, align: 'right' });
  hatch(E.X(Wd), E.Y(D.ceiling.plaster), E.X(Wd) + 3, E.Y(0), 1.6, CL);
  txt('BRICK', E.X(Wd) + 4.5, E.Y(1300), { size: 5.5, color: CL, angle: 90 });
  // members
  pen(THICK);
  fill(black ? [70, 70, 74] : [210, 212, 215]);
  vrect(E, LL.x0, yL0 + pt, LL.x1, top - bH, 'S');
  vrect(E, RL.x0, pt, RL.x1, top - bH, 'S');
  vrect(E, 0, top - bH, Wd, top, 'S');
  vrect(E, D.plates.left.x0, yL0, D.plates.left.x1, yL0 + pt, 'S');
  vrect(E, D.plates.right.x0, 0, D.plates.right.x1, pt, 'S');
  // inside face of RHS walls (hidden on this view: the leg is viewed from inside, so show inner walls dashed)
  pen(THIN, INK, [1.5, 0.8]);
  ln(E.X(LL.x0 + 3), E.Y(yL0 + pt), E.X(LL.x0 + 3), E.Y(top - bH)); ln(E.X(LL.x1 - 3), E.Y(yL0 + pt), E.X(LL.x1 - 3), E.Y(top - bH));
  ln(E.X(RL.x0 + 3), E.Y(pt), E.X(RL.x0 + 3), E.Y(top - bH)); ln(E.X(RL.x1 - 3), E.Y(pt), E.X(RL.x1 - 3), E.Y(top - bH));
  // tabs seen from inside: 45 wide, rising to the plasterboard behind the beam's top edge
  pen(MED);
  for (const t of D.tabs.list) {
    vrect(E, t.x - D.tabs.w / 2, top, t.x + D.tabs.w / 2, D.ceiling.plaster, 'S');
    centreLineV(E.X(t.x), E.Y(D.ceiling.plaster) - 2, E.Y(top - bH) + 2);
  }
  // pass-throughs: inside ferrule flanges
  for (const y of D.pass.ys) { pen(MED); doc.circle(E.X(D.pass.x), E.Y(y), (D.pass.flangeOD / 2) * s1); crossMark(E.X(D.pass.x), E.Y(y), (D.pass.flangeOD / 2) * s1); }
  // dimensions
  dimH(E.X(0), E.X(Wd), E.Y(D.ceiling.plaster) - 13, E.Y(top), E.Y(top), `${f1(Wd)} OVERALL (TOP BEAM)`, { bold: true });
  // tab chain from the brick face
  {
    const yl = E.Y(D.ceiling.plaster) - 4.5;
    const xs = [...D.tabs.list.map((t) => t.x)].sort((a, b) => a - b);
    let prev = Wd;
    for (const x of xs.slice().reverse()) {
      dimH(E.X(x), E.X(prev), yl, E.Y(D.ceiling.plaster), prev === Wd ? E.Y(top) : E.Y(D.ceiling.plaster), f1(prev - x), { size: 6.5 });
      prev = x;
    }
    dimH(E.X(0), E.X(xs[0]), yl, E.Y(top), E.Y(D.ceiling.plaster), f1(xs[0]), { size: 6.5 });
    txt('CEILING TAB CENTRELINES = JOIST CENTRELINES, FROM THE BRICK FACE: ' + D.tabs.list.map((t) => t.fromBrick).join(' / '), E.X(Wd / 2), E.Y(top - bH) + 5, { size: 6, align: 'center', color: BLUE });
  }
  dimH(E.X(LL.x0), E.X(LL.x1), E.Y(900), null, null, f1(LL.w), { size: 6.5 });
  dimH(E.X(RL.x0), E.X(RL.x1), E.Y(900), null, null, f1(RL.w), { size: 6.5 });
  pen(THIN); ln(E.X(LL.x0), E.Y(900) - 1.5, E.X(LL.x0), E.Y(900) + 1.5); ln(E.X(LL.x1), E.Y(900) - 1.5, E.X(LL.x1), E.Y(900) + 1.5);
  ln(E.X(RL.x0), E.Y(900) - 1.5, E.X(RL.x0), E.Y(900) + 1.5); ln(E.X(RL.x1), E.Y(900) - 1.5, E.X(RL.x1), E.Y(900) + 1.5);
  dimV(E.Y(0), E.Y(top), E.X(Wd) + 13, E.X(Wd), E.X(Wd), `${f0(RL.height)} RIGHT LEG, SLAB TO TOP OF U`, { bold: true });
  dimV(E.Y(yL0), E.Y(top), E.X(D.plates.left.x0) - 10, E.X(LL.x0), E.X(0), `${f0(LL.height)} LEFT LEG, SLAB TO TOP OF U`, { bold: true });
  dimV(E.Y(top - bH), E.Y(top), E.X(Wd) + 6, E.X(Wd), E.X(Wd), f1(bH), { size: 6.5, ty: E.Y(top - bH) + 4.5 });
  dimV(E.Y(top), E.Y(D.ceiling.plaster), E.X(Wd) + 6, null, E.X(Wd), f1(D.ceiling.plaster - top), { size: 6.5 });
  // balloons
  balloon(1, E.X(-45), E.Y(1600), E.X(LL.x0 + 25), E.Y(1500));
  balloon(2, E.X(Wd + 35), E.Y(1700), E.X(RL.x0 + 50), E.Y(1600));
  balloon(3, E.X(820), E.Y(top - 260), E.X(820), E.Y(top - bH));
  balloon(4, E.X(-45), E.Y(250), E.X(D.plates.left.x0 + 10), E.Y(yL0 + 4));
  balloon(5, E.X(Wd + 35), E.Y(330), E.X(RL.x0 + 20), E.Y(4));
  balloon(6, E.X(D.tabs.list[0].x - 120), E.Y(top - 260), E.X(D.tabs.list[0].x - 10), E.Y(top + 12));
  balloon(7, E.X(Wd - 200), E.Y(460), E.X(D.pass.x - 6), E.Y(D.pass.ys[2]));
  sectionMark(E.X(Wd - 50), E.Y(top) - 21, 'A', [1, 0]);
  sectionMark(E.X(Wd - 50), E.Y(-90), 'A', [1, 0]);
  pen(THIN, INK, [4, 1, 1, 1]); ln(E.X(Wd - 50), E.Y(top) - 18, E.X(Wd - 50), E.Y(-90) - 3);
  viewTitle(E.X(Wd / 2), 272, 'FRONT ELEVATION, FROM OUTSIDE', '1 : 12.5', 'weatherboard left, brick right; tabs and inside ferrules behind');

  // section A-A through the right leg (side view; nook to the left, outside to the right)
  {
    const S = view(236, 246, s1);
    const ZX = (zin) => S.X(-zin); // zin: mm inward from the outside face
    pen(THICK);
    doc.rect(ZX(50), S.Y(top - bH), 50 * s1, (top - bH - pt) * s1);
    hatch(ZX(50), S.Y(top), ZX(0), S.Y(top - bH), 0.9);
    pen(THICK); doc.rect(ZX(50), S.Y(top), 50 * s1, bH * s1);
    doc.rect(ZX(110), S.Y(pt), 110 * s1, pt * s1);
    // tab profile
    pen(MED);
    const tz0 = 50 - D.tabs.weld;
    poly(D.tabs.profile.map(([u, v]) => [ZX(tz0 + u), S.Y(top + v)]));
    // pipes
    for (const y of D.pass.ys) { pen(MED); ln(ZX(50 + D.pass.inside), S.Y(y), ZX(-D.pass.outside), S.Y(y)); }
    pen(THIN, CL, [2, 1]); ln(ZX(220), S.Y(D.ceiling.plaster), ZX(-60), S.Y(D.ceiling.plaster)); ln(ZX(220), S.Y(0), ZX(-60), S.Y(0));
    dimH(ZX(50), ZX(0), S.Y(top) - 14, S.Y(top), S.Y(top), '50', { size: 6.5 });
    dimH(ZX(110), ZX(50), S.Y(-14), S.Y(0), S.Y(0), '60', { size: 6.5 });
    txt('NOOK', ZX(150), S.Y(1300), { size: 6.5, color: CL, align: 'center' });
    txt('OUTSIDE', ZX(-45), S.Y(1300), { size: 6.5, color: CL, align: 'center', angle: 90 });
    viewTitle(S.X(-20), 272, 'SECTION A–A', '1 : 12.5', 'through leg 2');
  }

  // parts list
  {
    const x0 = 262, y0 = 16, cw = [9, 70, 49, 10];
    const rows = [
      ['1', 'Left leg, 50 × 50 × 3 SHS', `${f0(LL.cut)} long`, '1'],
      ['2', 'Right leg, 100 × 50 × 3 RHS', `${f0(RL.cut)} long`, '1'],
      ['3', 'Top beam, 50 × 25 × 3 RHS', `${f1(Wd)} long`, '1'],
      ['4', 'Base plate L, 8 thk', `${f1(D.plates.left.x1 - D.plates.left.x0)} × 110, notched`, '1'],
      ['5', 'Base plate R, 8 thk', `${f1(RL.w)} × 110`, '1'],
      ['6', 'Ceiling tab, 3 thk, S-bent', `${D.tabs.w} × ${f1(D.tabs.dev)} blank`, String(D.tabs.list.length)],
      ['7', 'Pass-through tube Ø38.1 × 1.65', `${f1(D.pass.tube)} long`, '3'],
      ['8', '1.5" TC weld ferrule (21.5 long)', 'standard', '6'],
      ['9', 'M6 rivnut, 316, flanged', 'fit after coating', String(D.rivnuts.L.ys.length + D.rivnuts.R.ys.length)],
      ['10', 'M10 anchor, 316 (by installer)', '80 embed', '4'],
      ['11', '14g × 100 batten screw, 316 (inst.)', 'into joists', String(D.tabs.list.length * 2)],
    ];
    pen(MED); doc.rect(x0, y0, cw.reduce((a, b) => a + b), 7 + rows.length * 5.6);
    fill(SOFT); doc.rect(x0, y0, cw.reduce((a, b) => a + b), 7, 'F'); pen(MED); doc.rect(x0, y0, cw.reduce((a, b) => a + b), 7);
    let x = x0;
    ['ITEM', 'DESCRIPTION  (ALL 316 STAINLESS)', 'SIZE', 'QTY'].forEach((h, i) => { txt(h, x + 1.5, y0 + 4.8, { size: 6, bold: true }); x += cw[i]; });
    rows.forEach((r, ri) => {
      const yy = y0 + 7 + ri * 5.6;
      pen(THIN); ln(x0, yy, x0 + cw.reduce((a, b) => a + b), yy);
      let xx = x0;
      r.forEach((c, i) => { txt(c, xx + 1.5, yy + 4, { size: 6.5, bold: i === 0 }); xx += cw[i]; });
    });
    x = x0; pen(THIN); for (let i = 0; i < cw.length - 1; i++) { x += cw[i]; ln(x, y0, x, y0 + 7 + rows.length * 5.6); }
    txt('PARTS LIST', x0, y0 - 1.8, { size: 8, bold: true });
  }
  // general notes
  {
    const x0 = 262, y0 = 101;
    txt('GENERAL NOTES', x0, y0, { size: 8, bold: true });
    const notes = [
      `1. All members 316 stainless. Legs and beam welded into one inverted U, ${f1(Wd)} wide.`,
      `2. Heights are measured from the slab at each leg; the slab falls ${f1(yL0)} from left to right.`,
      '   Cut legs to suit: the TOP OF THE U must be level and butt the weatherboard lip.',
      '3. Top beam sits on the legs; seal-weld all round (no open ends).',
      `4. Ceiling tabs: 3 thk, ${D.tabs.l} long: ${D.tabs.weld} flat on the beam, S-bent ${D.tabs.rise} rise over ${D.tabs.s}, flat ${D.tabs.l - D.tabs.weld - D.tabs.s}. Weld to the`,
      `   beam top (${D.tabs.weld} lap, both sides + end) on the joist centrelines. See sheet 2.`,
      '5. Pass-throughs (3 off, right leg): see sheet 2 and the sequence on sheet 4.',
      '   Tubes are welded in AFTER powder coating, inside bare masked rings.',
      `6. Finish: ${black ? 'blast, stainless primer, black powder coat. Ferrules, tube stubs' : 'bare 316, pickled and passivated.'}`,
      black ? '   and bores stay bare stainless (not coated).' : '',
      '7. M6 rivnuts on the outside faces carry the shutter side frames (sheet 3).',
      '8. Seal-welded hollow sections: add vent holes if the coater asks; plug after.',
      '9. Nothing is fixed into either wall. Fixings: slab anchors and joist screws only.',
    ].filter(Boolean);
    notes.forEach((s, i) => txt(s, x0, y0 + 5 + i * 3.6, { size: 6.4 }));
  }
  // key plan: where the U sits in the nook
  {
    const x0 = 268, y0 = 162, k = 0.022;
    txt('KEY PLAN', x0 - 6, y0 - 4, { size: 8, bold: true });
    pen(THIN, CL);
    const nw = D.openingW * k, nd = 3130 * k;
    doc.rect(x0, y0, nw, nd * 0.75);
    txt('NOOK', x0 + nw / 2, y0 + nd * 0.35, { size: 6, align: 'center', color: CL });
    hatch(x0 + nw, y0, x0 + nw + 1.5, y0 + nd * 0.75 + 8, 0.8, CL);
    pen(THICK, ACC); ln(x0 + (D.openingW - Wd) * k, y0 + nd * 0.75, x0 + nw, y0 + nd * 0.75);
    txt('U-FRAME', x0 + nw + 4, y0 + nd * 0.75 + 1, { size: 6.5, bold: true, color: ACC });
    txt('BRICK', x0 + nw + 3, y0 + 8, { size: 5.5, color: CL });
    txt('WEATHERBOARD', x0 - 1.5, y0 + 20, { size: 5.5, color: CL, angle: 90 });
    txt('OPENING / SHUTTER', x0 + nw / 2, y0 + nd * 0.75 + 6, { size: 6, align: 'center', color: CL });
    txt('(not to scale)', x0 + nw / 2, y0 + nd * 0.75 + 9.5, { size: 5.5, align: 'center', color: CL });
  }

  // =====================================================================================
  // SHEET 2: DETAILS
  // =====================================================================================
  sheet(2);
  // ----- DETAIL A: right leg, outside face, bottom 300 (1:2.5) -----
  {
    const s = 0.4, A = view(52, 128, s);
    const X = (x) => A.X(x); // local: 0 = opening-side edge of the right leg, 100 = brick face
    const hTop = 250;
    pen(THICK); fill(black ? [86, 86, 90] : [225, 226, 228]);
    doc.rect(X(0), A.Y(hTop), RL.w * s, (hTop - pt) * s, 'S');
    doc.rect(X(0), A.Y(pt), RL.w * s, pt * s, 'S');
    pen(THIN, INK, [3, 1.2, 0.6, 1.2]); ln(X(0) - 2, A.Y(hTop) + 0.3, X(RL.w) + 2, A.Y(hTop) + 0.3); // break line
    // frame overlap zone
    fill([250, 228, 210]); doc.rect(X(0), A.Y(hTop), D.pass.overlap * s, (hTop - pt) * s, 'F');
    hatch(X(0), A.Y(hTop), X(D.pass.overlap), A.Y(pt), 2.2, ACC);
    pen(THICK); doc.rect(X(0), A.Y(hTop), RL.w * s, (hTop - pt) * s, 'S');
    txt('SIDE FRAME OVERLAP: KEEP FLAT', X(D.pass.overlap / 2) + 1, A.Y(hTop * 0.62), { size: 6, align: 'center', bold: true, color: ACC, angle: 90 });
    // bare rings and holes
    for (const y of D.pass.ys) {
      const cx = X(RL.w - D.pass.fromBrick), cy = A.Y(y);
      if (black) { fill([255, 255, 255]); pen(THIN, BLUE, [1.2, 0.8]); doc.circle(cx, cy, (D.pass.ring / 2) * s, 'FD'); }
      pen(THICK); fill([255, 255, 255]); doc.circle(cx, cy, (D.pass.hole / 2) * s, 'FD');
      crossMark(cx, cy, (D.pass.hole / 2) * s);
    }
    // rivnut at 100
    const rv = D.rivnuts.R.ys[0];
    pen(MED); doc.circle(X(15), A.Y(rv), 4.5 * s); crossMark(X(15), A.Y(rv), 4.5 * s);
    leader(X(15) - 1.6, A.Y(rv) + 1.6, X(0) - 8, A.Y(rv) + 10, [`Ø9 RIVNUT HOLE (M6)`, 'see sheet 3'], { size: 6 });
    // dims: x from brick face
    const cx = X(RL.w - D.pass.fromBrick);
    dimH(cx, X(RL.w), A.Y(hTop) - 6, A.Y(D.pass.ys[2]), A.Y(hTop), f1(D.pass.fromBrick), { size: 6.5 });
    dimH(X(0), X(D.pass.overlap), A.Y(hTop) - 6, A.Y(hTop), A.Y(hTop), f1(D.pass.overlap), { size: 6.5 });
    dimH(X(0), X(RL.w), A.Y(hTop) - 12, A.Y(hTop), A.Y(hTop), f1(RL.w), { size: 6.5 });
    let xl = X(RL.w) + 8;
    for (const y of D.pass.ys) { dimV(A.Y(0), A.Y(y), xl, X(RL.w), cx + 2, f1(y), { size: 6.5 }); xl += 7; }
    dimV(A.Y(D.pass.ys[0]), A.Y(D.pass.ys[1]), cx - 14, null, null, f1(D.pass.ys[1] - D.pass.ys[0]), { size: 6.5 });
    leader(cx - (D.pass.hole / 2) * s * 0.7, A.Y(D.pass.ys[2]) - (D.pass.hole / 2) * s * 0.7, X(0) - 8, A.Y(D.pass.ys[2]) - 22, [`3 × Ø${f1(D.pass.hole)} THRU BOTH WALLS`, 'for the Ø38.1 tubes'], { size: 6, bold: true });
    if (black) leader(cx - (D.pass.ring / 2) * s * 0.7, A.Y(D.pass.ys[1]) - (D.pass.ring / 2) * s * 0.7, X(0) - 8, A.Y(D.pass.ys[1]) - 10, [`Ø${D.pass.ring} BARE RING`, 'BOTH FACES,', 'MASK BEFORE', 'COATING'], { size: 6, bold: true, c: BLUE, tc: BLUE });
    pen(MED, CL); ln(X(-30), A.Y(0), X(RL.w + 30), A.Y(0)); txt('SLAB', X(-30), A.Y(0) + 3, { size: 5.5, color: CL });
    txt('BRICK SIDE', X(RL.w) - 1, A.Y(hTop) + 4, { size: 5.5, color: CL, align: 'right' });
    viewTitle(X(50) + 6, 146, 'DETAIL A: RIGHT LEG, OUTSIDE FACE', '1 : 2.5', 'viewed from outside');
  }
  // ----- SECTION B-B through the pass-throughs (1:2.5) -----
  {
    const s = 0.4, B = view(214, 128, s);
    const ZX = (zin) => B.X(-zin); // inward from the outside face to the left
    const y2 = D.pass.ys[2] + 40;
    // RHS walls (cut, hatched)
    pen(THICK);
    for (const [a, b] of [[50, 47], [3, 0]]) { doc.rect(ZX(a), B.Y(y2), 3 * s, (y2 - pt) * s); hatch(ZX(a), B.Y(y2), ZX(b), B.Y(pt), 0.8); }
    pen(THIN, INK, [3, 1.2, 0.6, 1.2]); ln(ZX(60), B.Y(y2) + 0.3, ZX(-10), B.Y(y2) + 0.3);
    // base plate with inside tab and anchor
    pen(THICK); doc.rect(ZX(110), B.Y(pt), 110 * s, pt * s); hatch(ZX(110), B.Y(pt), ZX(0), B.Y(0), 0.8);
    centreLineV(ZX(50 + D.plates.anchorZ), B.Y(pt) - 4, B.Y(0) + 8);
    pen(MED, CL, [1.2, 0.8]); doc.rect(ZX(50 + D.plates.anchorZ + 6), B.Y(0) - 0.01, 12 * s, 80 * s * 0.25);
    // tubes + ferrules
    const fl = D.pass.ferrule, flt = 2.85;
    for (const y of D.pass.ys) {
      const r = D.pass.od / 2, rf = D.pass.flangeOD / 2;
      const zin0 = 50 + D.pass.inside, zout = -D.pass.outside;
      pen(MED);
      // tube body (between ferrule tails)
      ln(ZX(zin0), B.Y(y + r), ZX(zout), B.Y(y + r)); ln(ZX(zin0), B.Y(y - r), ZX(zout), B.Y(y - r));
      // flanges
      fill([255, 255, 255]);
      for (const [zf, dir] of [[zin0, 1], [zout, -1]]) {
        doc.rect(Math.min(ZX(zf), ZX(zf - dir * flt)), B.Y(y + rf), flt * s, rf * 2 * s, 'FD');
        pen(THIN); ln(ZX(zf - dir * fl), B.Y(y + r) - 0.6, ZX(zf - dir * fl), B.Y(y - r) + 0.6); pen(MED); // ferrule-to-tube butt weld line
      }
      centreLineH(ZX(zin0) - 3, ZX(zout) + 3, B.Y(y));
    }
    // dimension the top tube
    const yt = D.pass.ys[2], rf = D.pass.flangeOD / 2;
    const yd = B.Y(y2) - 5;
    dimH(ZX(50 + D.pass.inside), ZX(50), yd, B.Y(yt + rf), B.Y(y2), f1(D.pass.inside), { size: 6.5 });
    dimH(ZX(50), ZX(0), yd, B.Y(y2), B.Y(y2), '50', { size: 6.5 });
    dimH(ZX(0), ZX(-D.pass.outside), yd, B.Y(y2), B.Y(yt + rf), f1(D.pass.outside), { size: 6.5 });
    dimH(ZX(50 + D.pass.inside), ZX(-D.pass.outside), yd - 7, yd, yd, `${f1(D.pass.total)} FLANGE FACE TO FLANGE FACE`, { size: 6.5, bold: true });
    // tube length between ferrules
    const yb = D.pass.ys[0];
    const ym1 = (D.pass.ys[0] + D.pass.ys[1]) / 2, ym2 = (D.pass.ys[1] + D.pass.ys[2]) / 2;
    dimH(ZX(50 + D.pass.inside - fl), ZX(-D.pass.outside + fl), B.Y(ym1), B.Y(yb - D.pass.od / 2), B.Y(yb - D.pass.od / 2), `${f1(D.pass.tube)} TUBE (ITEM 7)`, { size: 6.5, tx: ZX(25) });
    dimH(ZX(50 + D.pass.inside), ZX(50 + D.pass.inside - fl), B.Y(ym2), null, null, '21.5 FERRULE', { size: 6, tx: ZX(50 + D.pass.inside) - 9 });
    dimH(ZX(50), ZX(50 + D.plates.anchorZ), B.Y(0) + 6, B.Y(0), B.Y(0), f1(D.plates.anchorZ), { size: 6.5 });
    dimH(ZX(110), ZX(50), B.Y(0) + 12, B.Y(0), B.Y(0), '60', { size: 6.5 });
    dimV(B.Y(0), B.Y(pt), ZX(110) - 4, ZX(110), ZX(110), '8', { size: 6.5 });
    // frame and clamp envelopes (phantom)
    pen(THIN, ACC, [4, 1, 1, 1, 1, 1]);
    doc.rect(ZX(0), B.Y(y2), D.pass.frameD * s, (y2 - pt) * s);
    const jz = -D.pass.outside - 0.6;
    for (const y of D.pass.ys) doc.rect(ZX(jz + D.pass.clampW / 2), B.Y(y + D.pass.clampOD / 2), D.pass.clampW * s, D.pass.clampOD * s);
    txt(`SIDE FRAME, ${f1(D.pass.frameD)} DEEP (PHANTOM)`, ZX(-D.pass.frameD / 2) + 1.5, B.Y(pt) + 6.5, { size: 5.8, align: 'center', color: ACC, bold: true });
    const clr = D.pass.outside + 0.6 - D.pass.clampW / 2 - D.pass.frameD;
    dimH(ZX(-D.pass.frameD), ZX(jz + D.pass.clampW / 2), B.Y(D.pass.ys[1]) + 1.5, null, null, f1(clr), { size: 6, c: ACC });
    txt('CLAMP CLEAR OF FRAME', ZX(-D.pass.outside) + 9, B.Y(D.pass.ys[1]) + 7, { size: 5.5, color: ACC });
    // weld symbols
    weldSymbol(ZX(48.5), B.Y(D.pass.ys[2] - D.pass.od / 2 - 3), ZX(90), B.Y(ym2) + 2, '2', true, { note: 'WELD 2 (AFTER COAT)', c: BLUE, bold: true });
    weldSymbol(ZX(1.5), B.Y(D.pass.ys[1] - D.pass.od / 2), ZX(1.5) + 26, B.Y(D.pass.ys[0]) + 22, '2', true, { note: 'WELD 2 (AFTER COAT)', c: BLUE, bold: true });
    txt('NOOK', ZX(95), B.Y(y2) + 4, { size: 6, color: CL, align: 'center' });
    txt('OUTSIDE', ZX(-58), B.Y(y2) + 4, { size: 6, color: CL, align: 'center' });
    viewTitle(ZX(30), 146, 'SECTION B–B: PASS-THROUGHS', '1 : 2.5', 'through the tube centreline');
  }
  // ----- DETAIL C: base plates (plan, 1:2.5) -----
  {
    const s = 0.4;
    // left plate: local X from the plate's left edge (2 mm off the weatherboard); Z inward from the outside face
    const pl = D.plates.left, pr = D.plates.right;
    const C1 = view(40, 168, s);
    const PX = (x) => C1.X(x - pl.x0), PZ = (z) => 168 + z * s;
    pen(THICK); fill(black ? [86, 86, 90] : [225, 226, 228]);
    poly([[PX(pl.x0), PZ(pl.notchZ)], [PX(LL.x0), PZ(pl.notchZ)], [PX(LL.x0), PZ(0)], [PX(pl.x1), PZ(0)], [PX(pl.x1), PZ(110)], [PX(pl.x0), PZ(110)]], true, 'FD');
    pen(MED, INK, [1.5, 0.8]); doc.rect(PX(LL.x0), PZ(0), 50 * s, 50 * s);
    txt('LEG 1', PX(LL.x0 + 25), PZ(26), { size: 6, align: 'center' });
    for (const x of pl.holes) { pen(THICK); fill([255, 255, 255]); doc.circle(PX(x), PZ(50 + D.plates.anchorZ), 6 * s, 'FD'); crossMark(PX(x), PZ(50 + D.plates.anchorZ), 6 * s); }
    dimH(PX(pl.x0), PX(pl.x1), PZ(0) - 12, PZ(pl.notchZ), PZ(0), f1(pl.x1 - pl.x0), { size: 6.5 });
    dimH(PX(pl.x0), PX(LL.x0), PZ(0) - 5, PZ(pl.notchZ), PZ(0), f1(LL.x0 - pl.x0), { size: 6.5 });
    dimV(PZ(0), PZ(pl.notchZ), PX(pl.x0) - 5, PX(LL.x0), PX(pl.x0), f1(pl.notchZ), { size: 6.5 });
    dimV(PZ(0), PZ(110), PX(pl.x1) + 6, PX(pl.x1), PX(pl.x1), '110', { size: 6.5 });
    dimV(PZ(0), PZ(50 + D.plates.anchorZ), PX(pl.x1) + 13, PX(pl.x1), PX(pl.holes[1]) + 3, f1(50 + D.plates.anchorZ), { size: 6.5 });
    dimH(PX(pl.x0), PX(pl.holes[0]), PZ(110) + 6, PZ(110), PZ(50 + D.plates.anchorZ) + 3, f1(pl.holes[0] - pl.x0), { size: 6.5 });
    dimH(PX(pl.holes[1]), PX(pl.x1), PZ(110) + 6, PZ(50 + D.plates.anchorZ) + 3, PZ(110), f1(pl.x1 - pl.holes[1]), { size: 6.5 });
    txt('NOTCH CLEARS THE WHITE WALL STEP', PX(pl.x0) - 2, PZ(-17), { size: 5.5, color: CL });
    txt('ITEM 4: LEFT BASE PLATE, 8 THK', PX((pl.x0 + pl.x1) / 2), PZ(110) + 16, { size: 7, bold: true, align: 'center' });
    txt('2 × Ø12 FOR M10 ANCHORS', PX((pl.x0 + pl.x1) / 2), PZ(110) + 19.5, { size: 6, align: 'center' });
    txt('WEATHERBOARD', PX(pl.x0), PZ(60), { size: 5.5, color: CL, align: 'right', angle: 90 });
    // right plate
    const C2 = view(102, 168, s);
    const QX = (x) => C2.X(x - pr.x0);
    pen(THICK); fill(black ? [86, 86, 90] : [225, 226, 228]); doc.rect(QX(pr.x0), PZ(0), (pr.x1 - pr.x0) * s, 110 * s, 'FD');
    pen(MED, INK, [1.5, 0.8]); doc.rect(QX(RL.x0), PZ(0), RL.w * s, 50 * s);
    txt('LEG 2', QX(RL.x0 + 50), PZ(26), { size: 6, align: 'center' });
    for (const x of pr.holes) { pen(THICK); fill([255, 255, 255]); doc.circle(QX(x), PZ(50 + D.plates.anchorZ), 6 * s, 'FD'); crossMark(QX(x), PZ(50 + D.plates.anchorZ), 6 * s); }
    dimH(QX(pr.x0), QX(pr.x1), PZ(0) - 6, PZ(0), PZ(0), f1(pr.x1 - pr.x0), { size: 6.5 });
    dimV(PZ(0), PZ(110), QX(pr.x1) + 6, QX(pr.x1), QX(pr.x1), '110', { size: 6.5 });
    dimV(PZ(0), PZ(50 + D.plates.anchorZ), QX(pr.x1) + 13, QX(pr.x1), QX(pr.holes[1]) + 3, f1(50 + D.plates.anchorZ), { size: 6.5 });
    dimH(QX(pr.x0), QX(pr.holes[0]), PZ(110) + 6, PZ(110), PZ(50 + D.plates.anchorZ) + 3, f1(pr.holes[0] - pr.x0), { size: 6.5 });
    dimH(QX(pr.holes[1]), QX(pr.x1), PZ(110) + 6, PZ(50 + D.plates.anchorZ) + 3, PZ(110), f1(pr.x1 - pr.holes[1]), { size: 6.5 });
    txt('ITEM 5: RIGHT BASE PLATE, 8 THK', QX((pr.x0 + pr.x1) / 2), PZ(110) + 16, { size: 7, bold: true, align: 'center' });
    txt('2 × Ø12 FOR M10 ANCHORS', QX((pr.x0 + pr.x1) / 2), PZ(110) + 19.5, { size: 6, align: 'center' });
    txt('BRICK', QX(pr.x1) + 1, PZ(60), { size: 5.5, color: CL, angle: 90 });

    txt(`ALL FOUR ANCHORS ON ONE LINE, ${f1(50 + D.plates.anchorZ)} IN FROM THE OUTSIDE FACE`, 82, PZ(110) + 26, { size: 6.5, bold: true, color: BLUE, align: 'center' });
    viewTitle(82, 272, 'DETAIL C: BASE PLATES (PLAN)', '1 : 2.5', 'outside face at the top, legs dashed');
  }
  // ----- DETAIL D: ceiling tab (1:2) -----
  {
    const s = 0.4;
    const ox = 190, oy = 194; // origin: beam inside face, beam top
    const ZX = (zin) => ox - (zin - 50) * s; // NOT USED
    const TX = (u) => ox + u * s; // u: along the tab, from the beam's inside face toward the nook (to the right)
    const TY = (v) => oy - v * s;
    const py0 = 240;
    // beam section (cut), outside face to the left
    pen(THICK); doc.rect(TX(-50), TY(0), 50 * s, bH * s); hatch(TX(-50), TY(0), TX(0), TY(-bH), 0.9);
    pen(THIN); doc.rect(TX(-47), TY(-3), 44 * s, (bH - 6) * s, 'S');
    // tab profile (thickness drawn)
    const prof = D.tabs.profile.map(([u, v]) => [u - D.tabs.weld, v]);
    pen(THICK);
    poly(prof.map(([u, v]) => [TX(u), TY(v)]));
    poly(prof.map(([u, v]) => [TX(u), TY(v + D.tabs.t)]));
    ln(TX(prof[0][0]), TY(prof[0][1]), TX(prof[0][0]), TY(prof[0][1] + D.tabs.t));
    const le = prof[prof.length - 1]; ln(TX(le[0]), TY(le[1]), TX(le[0]), TY(le[1] + D.tabs.t));
    // plasterboard + joist (context)
    pen(THIN, CL); doc.rect(TX(-60), TY(D.tabs.rise + D.tabs.t + 13), 220 * s, 13 * s); hatch(TX(-60), TY(D.tabs.rise + D.tabs.t + 13), TX(160), TY(D.tabs.rise + D.tabs.t), 2.4, CL);
    txt('PLASTERBOARD 13 (JOIST ABOVE)', TX(-60), TY(D.tabs.rise + D.tabs.t + 13) - 1.5, { size: 5.5, color: CL });
    // weatherboard lip (9) and 18 x 18 trim over the beam's outer half: why the lap stops where it does
    {
      const lipU0 = -50, lipU1 = -50 + 9, trU1 = lipU1 + 18, trY0 = D.tabs.rise + D.tabs.t - 18;
      pen(THIN, CL); fill([238, 238, 236]);
      doc.rect(TX(lipU0), TY(D.tabs.rise + D.tabs.t + 13), 9 * s, (D.tabs.rise + D.tabs.t + 13) * s, 'FD');
      doc.rect(TX(lipU1), TY(D.tabs.rise + D.tabs.t), 18 * s, 18 * s, 'FD');
      txt('WB LIP 9', TX(lipU0) - 1, TY(D.tabs.rise * 0.5), { size: 5.2, color: CL, align: 'right' });
      txt('TRIM 18', TX(lipU1 + 9), TY(trY0) - 1.2, { size: 5.2, color: CL, align: 'center' });
      const tabEnd = -D.tabs.weld;
      txt(`lap ends ${f1(tabEnd - lipU1)} short of the WB lip`, TX(-50) - 12, TY(-bH) + 23, { size: 5.6, color: CL });
    }
    // screws
    for (const u of D.tabs.holes) centreLineV(TX(u - D.tabs.weld), TY(D.tabs.rise + D.tabs.t + 20), TY(D.tabs.rise - 6));
    // dims
    dimH(TX(prof[0][0]), TX(0), TY(-bH) + 12, TY(0), TY(-bH), `${f1(D.tabs.weld)} LAP`, { size: 6.5 });
    dimH(TX(prof[0][0]), TX(le[0]), TY(-bH) + 18, TY(0), TY(le[1]), `${D.tabs.l} OVERALL, AS BENT`, { size: 6.5, bold: true });
    dimH(TX(prof[0][0]), TX(prof[0][0] + D.tabs.s), TY(D.tabs.rise + D.tabs.t + 13) - 5, TY(D.tabs.t), TY(D.tabs.rise + D.tabs.t), `${D.tabs.s} S-BEND`, { size: 6.5 });

    dimV(TY(0), TY(D.tabs.rise), TX(le[0]) + 6, TX(le[0]), TX(le[0]), `${D.tabs.rise} RISE`, { size: 6.5, bold: true });
    dimV(TY(D.tabs.rise), TY(D.tabs.rise + D.tabs.t), TX(le[0]) + 13, TX(le[0]), TX(le[0]), f1(D.tabs.t), { size: 6.5 });
    dimV(TY(-bH), TY(0), TX(-50) - 5, TX(-50), TX(-50), f1(bH), { size: 6.5 });
    dimH(TX(-50), TX(0), TY(-bH) + 6, TY(-bH), TY(-bH), '50', { size: 6.5 });
    weldSymbol(TX(prof[0][0] + 1), TY(0), TX(66), TY(-bH) + 25, '3', false, { note: 'WELD 1, BOTH SIDES + END' });
    txt('3 + 22 = 7 + 18  (tab + rise = WB lip + trim)', TX(-50) - 12, TY(-bH) + 26.5, { size: 5.6, color: CL });
    // tab flat pattern (plan)
    const FX = (u) => TX(-D.tabs.weld + u);
    pen(THICK); doc.rect(FX(0), py0, D.tabs.dev * s, D.tabs.w * s);
    centreLineH(FX(0) - 3, FX(D.tabs.dev) + 3, py0 + (D.tabs.w / 2) * s);
    for (const u of D.tabs.holesFlat) { pen(THICK); fill([255, 255, 255]); doc.circle(FX(u), py0 + (D.tabs.w / 2) * s, (D.tabs.holeD / 2) * s, 'FD'); crossMark(FX(u), py0 + (D.tabs.w / 2) * s, (D.tabs.holeD / 2) * s); }
    pen(THIN, INK, [1.2, 0.8]); ln(FX(D.tabs.weld), py0, FX(D.tabs.weld), py0 + D.tabs.w * s); ln(FX(D.tabs.weld + D.tabs.s + D.tabs.excess), py0, FX(D.tabs.weld + D.tabs.s + D.tabs.excess), py0 + D.tabs.w * s);
    dimV(py0, py0 + D.tabs.w * s, FX(0) - 5, FX(0), FX(0), f1(D.tabs.w), { size: 6.5 });
    dimH(FX(0), FX(D.tabs.holesFlat[0]), py0 - 4, py0, py0 + 4, f1(D.tabs.holesFlat[0]), { size: 6.5 });
    dimH(FX(D.tabs.holesFlat[0]), FX(D.tabs.holesFlat[1]), py0 - 4, py0 + 4, py0 + 4, f1(D.tabs.holesFlat[1] - D.tabs.holesFlat[0]), { size: 6.5 });
    dimH(FX(0), FX(D.tabs.dev), py0 + D.tabs.w * s + 4, py0 + D.tabs.w * s, py0 + D.tabs.w * s, `${f1(D.tabs.dev)} BLANK`, { size: 6.5, bold: true });
    leader(FX(D.tabs.holesFlat[0]) - 1.5, py0 + (D.tabs.w / 2) * s + 1.5, FX(0) - 4, py0 + D.tabs.w * s + 3, [`2 × Ø${D.tabs.holeD} ON CL`, 'in line with the joist'], { size: 6 });
    txt('BEND ZONE (dashed)', FX(D.tabs.weld + (D.tabs.s + D.tabs.excess) / 2), py0 + D.tabs.w * s - 1.5, { size: 5.5, color: CL, align: 'center' });
    viewTitle(TX(40), 272, 'DETAIL D: CEILING TAB (ITEM 6)', '1 : 2.5', `profile and flat blank, 3 thk × ${D.tabs.list.length}; nook to the right`);
    ZX;
  }
  // ----- right column: weld legend, corner joint -----
  {
    const x0 = 268;
    txt('WELDS', x0, 22, { size: 8, bold: true });
    const W1 = [
      ['WELD 1', 'Frame: legs to base plates, beam to legs, tabs to beam.', 'Full seal fillet all round. Done BEFORE coating.'],
      ['WELD 2', 'Pass-through tubes to both walls of the right leg.', 'Fillet all round inside the bare rings. Done AFTER coating.'],
      ['WELD 3', '1.5" ferrules to the tubes (butt). Inside ferrule on the', 'bench before fitting; outside ferrule after the tube is in.'],
    ];
    W1.forEach((r, i) => {
      const y = 29 + i * 13;
      fill(i === 0 ? SOFT : [228, 238, 252]); pen(THIN); doc.rect(x0, y - 4, 140, 11.5, 'FD');
      txt(r[0], x0 + 2, y + 0.6, { size: 7.5, bold: true, color: i ? BLUE : INK });
      txt(r[1], x0 + 20, y, { size: 6.4 }); txt(r[2], x0 + 20, y + 3.8, { size: 6.4, bold: true, color: i ? BLUE : INK });
    });
    // corner joint, 1:5
    const s = 0.2, cx = 300, cy = 112;
    const K = view(cx, cy, s);
    pen(THICK); fill(black ? [86, 86, 90] : [225, 226, 228]);
    vrect(K, 0, -200, 100, 0, 'S'); vrect(K, -60, 0, 100, 25, 'S');
    pen(THIN, INK, [3, 1.2, 0.6, 1.2]); ln(K.X(-2), K.Y(-200), K.X(102), K.Y(-200)); ln(K.X(-60), K.Y(-2), K.X(-60), K.Y(27));
    dimV(K.Y(0), K.Y(25), K.X(100) + 5, K.X(100), K.X(100), '25', { size: 6 });
    weldSymbol(K.X(100), K.Y(0), K.X(100) + 14, K.Y(-40), '3', true, { note: 'WELD 1, SEAL' });
    txt('BEAM SITS ON THE LEGS, ENDS FLUSH', K.X(20), K.Y(25) - 3, { size: 6, align: 'center' });
    viewTitle(K.X(20), K.Y(-200) + 9, 'DETAIL E: TOP CORNER (RIGHT)', '1 : 5', 'left corner the same');
    // general details notes
    txt('NOTES', x0, 170, { size: 8, bold: true });
    [
      '1. Tube 38.1 OD × 1.65 wall, 316. Ferrules: standard 1.5" TC weld ferrules,',
      '   21.5 long. Flange faces square to the tube within 0.5°.',
      `2. Flange faces: ${f1(D.pass.inside)} proud inside, ${f1(D.pass.outside)} proud outside, so the outside`,
      `   clamps sit ${f1((D.pass.outside + 0.6 - D.pass.clampW / 2 - D.pass.frameD))} in front of the ${f1(D.pass.frameD)} deep shutter side frame.`,
      '3. Ferrules, tube stubs and bores stay bare stainless. No powder in the bores.',
      '4. Pickle and passivate every weld on stainless that will stay bare.',
      `5. Ceiling tabs on joist centrelines ${D.tabs.list.map((t) => t.fromBrick).join(' / ')} from the brick face.`,
      '   Two screws per tab in line along the joist, so the tab only has to land',
      '   somewhere across the 45 joist.',
    ].forEach((l, i) => txt(l, x0, 176 + i * 3.7, { size: 6.4 }));
  }

  // =====================================================================================
  // SHEET 3: DRILLING, RIVNUTS AND FIXINGS
  // =====================================================================================
  sheet(3);
  {
    const s = 0.08;
    // outside faces viewed from outside: brick (right leg) on the LEFT of the page
    const legs = [
      { title: 'LEG 2 (RIGHT, AGAINST BRICK)', w: RL.w, h: RL.height, fix: D.rivnuts.R, ox: 70, fixFromEdge: 15, edgeSide: 'right', pass: true },
      { title: 'LEG 1 (LEFT)', w: LL.w, h: LL.height, fix: D.rivnuts.L, ox: 175, fixFromEdge: 15, edgeSide: 'left', pass: false },
    ];
    for (const g of legs) {
      const V0 = view(g.ox, 250, s);
      const xEdge = g.edgeSide === 'left' ? 0 : g.w; // the opening-side edge as seen from outside
      pen(THICK); fill(black ? [86, 86, 90] : [225, 226, 228]);
      vrect(V0, 0, pt, g.w, g.h - bH, 'S');
      vrect(V0, -10, g.h - bH, g.w + 10, g.h, 'S');
      vrect(V0, -20, 0, g.w + 20, pt, 'S');
      // overlap zone
      fill([250, 228, 210]); const ox0 = g.edgeSide === 'left' ? 0 : g.w - D.pass.overlap;
      vrect(V0, ox0, pt, ox0 + D.pass.overlap, g.h - bH, 'F'); pen(THICK); vrect(V0, 0, pt, g.w, g.h - bH, 'S');
      const fx = g.edgeSide === 'left' ? g.fixFromEdge : g.w - g.fixFromEdge;
      // rivnuts
      g.fix.ys.forEach((y, i) => {
        pen(MED); fill([255, 255, 255]); doc.circle(V0.X(fx), V0.Y(y), 1.0, 'FD');
        dot(V0.X(fx), V0.Y(y), 0.25);
        // ordinate dims from the slab, on the outer side
        const xl = g.edgeSide === 'left' ? V0.X(0) - 8 : V0.X(g.w) + 8;
        pen(THIN); ln(V0.X(fx) + (g.edgeSide === 'left' ? -1.5 : 1.5), V0.Y(y), xl, V0.Y(y));
        txt(f0(y), xl + (g.edgeSide === 'left' ? -1 : 1), V0.Y(y) + 1.1, { size: 6.5, align: g.edgeSide === 'left' ? 'right' : 'left', bold: i === 0 || i === g.fix.ys.length - 1 });
      });
      const x0l = g.edgeSide === 'left' ? V0.X(0) - 8 : V0.X(g.w) + 8;
      pen(THIN); ln(x0l, V0.Y(0), V0.X(g.edgeSide === 'left' ? 0 : g.w), V0.Y(0)); txt('0', x0l + (g.edgeSide === 'left' ? -1 : 1), V0.Y(0) + 1.1, { size: 6.5, align: g.edgeSide === 'left' ? 'right' : 'left', bold: true });
      txt('SLAB', x0l + (g.edgeSide === 'left' ? -6 : 6), V0.Y(0) + 4.5, { size: 5.5, color: CL, align: 'center' });
      // pass-through holes on the right leg
      if (g.pass) for (const y of D.pass.ys) { pen(MED); doc.circle(V0.X(D.pass.fromBrick), V0.Y(y), (D.pass.hole / 2) * s); }
      dimH(V0.X(Math.min(fx, xEdge)), V0.X(Math.max(fx, xEdge)), V0.Y(g.h) - 7, V0.Y(g.h - bH), V0.Y(g.h - bH), f1(g.fixFromEdge), { size: 6.5 });
      dimH(V0.X(0), V0.X(g.w), V0.Y(g.h) - 14, V0.Y(g.h), V0.Y(g.h), f1(g.w), { size: 6.5 });
      txt(g.title, V0.X(g.w / 2), 280 - 12, { size: 8, bold: true, align: 'center' });
      txt('OUTSIDE FACE, VIEWED FROM OUTSIDE', V0.X(g.w / 2), 280 - 8, { size: 6, align: 'center', color: CL });
      txt('OPENING SIDE', V0.X(xEdge) + (g.edgeSide === 'left' ? 2 : -2), V0.Y(g.h * 0.55), { size: 5.5, color: ACC, angle: 90, align: 'center' });
    }
    txt('SCALE 1 : 12.5', 122, 280 - 3.5, { size: 6.5, align: 'center', color: CL });
    txt(`RIVNUT HEIGHTS FROM THE SLAB AT EACH LEG: ${D.rivnuts.R.ys.length} PER LEG, ~${f1(D.rivnuts.pitch)} PITCH, 100 OFF THE SLAB AND 100 BELOW THE HEADBOX (CEILING LINE)`, 122, 18, { size: 6.5, bold: true, align: 'center', maxWidth: 210 });
    txt('shaded strip = 30 side-frame overlap; rivnuts on its centreline', 122, 25.5, { size: 6, align: 'center', color: ACC });
  }
  // hole schedule
  {
    const x0 = 262, y0 = 22, cw = [12, 18, 46, 18, 54];
    const rows = [
      ['H1', `Ø${f1(D.pass.hole)}`, 'Pass-through, both walls of leg 2', '6', 'Drill before coating; mask ring'],
      ['H2', 'Ø9', 'M6 rivnut, outside faces', String(D.rivnuts.L.ys.length + D.rivnuts.R.ys.length), 'Drill before, fit after coating'],
      ['H3', 'Ø12', 'M10 anchor, base plates', '4', 'All on one line'],
      ['H4', `Ø${D.tabs.holeD}`, '14g screw, ceiling tabs', String(D.tabs.list.length * 2), 'On tab CL, in line with joist'],
    ];
    const tw = cw.reduce((a, b) => a + b);
    txt('HOLE SCHEDULE', x0, y0 - 2, { size: 8, bold: true });
    fill(SOFT); doc.rect(x0, y0, tw, 7, 'F'); pen(MED); doc.rect(x0, y0, tw, 7 + rows.length * 6);
    let x = x0;
    ['MARK', 'SIZE', 'PURPOSE', 'QTY', 'NOTE'].forEach((h, i) => { txt(h, x + 1.5, y0 + 4.8, { size: 6, bold: true }); x += cw[i]; });
    rows.forEach((r, ri) => {
      const yy = y0 + 7 + ri * 6;
      pen(THIN); ln(x0, yy, x0 + tw, yy);
      let xx = x0; r.forEach((c, i) => { txt(c, xx + 1.5, yy + 4.2, { size: 6.4, bold: i === 0 }); xx += cw[i]; });
    });
    x = x0; pen(THIN); for (let i = 0; i < cw.length - 1; i++) { x += cw[i]; ln(x, y0, x, y0 + 7 + rows.length * 6); }
  }
  // anchor line plan (1:10)
  {
    const s = 0.085, x0 = 268, y0 = 80;
    const X = (x) => x0 + (x - D.plates.left.x0) * s, Z = (z) => y0 + z * s;
    txt('FLOOR ANCHORS: PLAN (approx. 1 : 12)', x0, y0 - 8, { size: 8, bold: true });
    pen(THIN, CL, [2, 1]); ln(X(D.plates.left.x0) - 4, Z(0), X(Wd) + 4, Z(0));
    txt('OUTSIDE FACE', X(D.plates.left.x0) - 4, Z(0) - 1.5, { size: 5.5, color: CL });
    pen(MED);
    doc.rect(X(D.plates.left.x0), Z(0), (D.plates.left.x1 - D.plates.left.x0) * s, 110 * s);
    doc.rect(X(D.plates.right.x0), Z(0), (D.plates.right.x1 - D.plates.right.x0) * s, 110 * s);
    const all = [...D.plates.left.holes, ...D.plates.right.holes];
    centreLineH(X(D.plates.left.x0) - 4, X(Wd) + 4, Z(50 + D.plates.anchorZ));
    for (const x of all) { pen(MED); doc.circle(X(x), Z(50 + D.plates.anchorZ), 0.6); }
    // chain from the brick face
    let prev = Wd;
    for (const x of all.slice().sort((a, b) => b - a)) { dimH(X(x), X(prev), Z(110) + 7, Z(50 + D.plates.anchorZ), prev === Wd ? Z(0) : Z(50 + D.plates.anchorZ), f1(prev - x), { size: 6 }); prev = x; }
    txt('chain from the brick face', X(Wd), Z(110) + 11, { size: 5.5, color: CL, align: 'right' });
    txt(`Anchor centres from the brick face: ${all.map((x) => f1(Wd - x)).sort((a, b) => a - b).join(' / ')}`, x0, Z(110) + 17, { size: 6.5, bold: true });
    dimV(Z(0), Z(50 + D.plates.anchorZ), X(Wd) + 6, X(Wd), X(Wd), f1(50 + D.plates.anchorZ), { size: 6 });
  }
  // fixings summary
  {
    const x0 = 268, y0 = 128;
    txt('FIXINGS (SUPPLIED BY INSTALLER)', x0, y0, { size: 8, bold: true });
    [
      '• Slab: 4 × M10 316 anchors, 80 embed, through H3. Bed the base plates on',
      '  a bead of neutral-cure sealant so wash water cannot sit under them.',
      `• Ceiling: ${D.tabs.list.length * 2} × 14g × 100 316 batten screws through H4, up through the`,
      '  13 plasterboard into the joists (2 per tab, in line along the joist).',
      `• Shutter side frames: ${D.rivnuts.L.ys.length + D.rivnuts.R.ys.length} × M6 316 screws into the rivnuts (H2).`,
      '• Nothing is fixed into the weatherboard, the white wall or the brick.',
      '• EPDM strip between leg 2 and the brick (supplied loose).',
    ].forEach((l, i) => txt(l, x0, y0 + 6 + i * 3.8, { size: 6.4 }));
  }

  // =====================================================================================
  // SHEET 4: FABRICATION AND FINISH SEQUENCE
  // =====================================================================================
  sheet(4);
  {
    // banner
    fill(ACC); doc.rect(16, 16, 388, 15, 'F');
    txt(black ? 'ORDER MATTERS:  1 WELD THE FRAME   >>   2 POWDER COAT   >>   3 THEN WELD THE PIPES IN' : 'ORDER MATTERS:  WELD THE FRAME   >>   PASS-THROUGHS   >>   PICKLE & PASSIVATE', 210, 26, { size: 15, bold: true, color: [255, 255, 255], align: 'center' });
    const steps = black ? [
      ['1', 'CUT & FORM', ['Cut items 1–7 to the parts list.', `Form the 3 ceiling tabs: S-bend ${D.tabs.rise} rise over ${D.tabs.s}, check on a flat.`, 'Deburr all cut ends.'], INK],
      ['2', 'DRILL', ['H1: 6 × Ø39 through both walls of leg 2.', 'H2: Ø9 rivnut holes in both outside faces.', 'H3: Ø12 in base plates.  H4: Ø7 in tabs.', 'Vent holes if the coater asks.'], INK],
      ['3', 'WELD 1: THE FRAME', ['Legs to base plates; beam on the legs;', `tabs ${D.tabs.weld} flat on the beam top.`, 'Full seal welds. Check the top of the U', `is straight and the legs are ${f0(LL.height)} / ${f0(RL.height)} to the top.`], INK],
      ['4', 'MASK', ['Mask a Ø70 BARE RING around every H1 hole,', 'on both faces of leg 2 (12 rings).', 'Plug H2 holes. Leave H3 / H4 open.', 'NO PIPES FITTED YET.'], BLUE],
      ['5', 'POWDER COAT', ['Abrasive blast, stainless-compatible primer,', 'black powder coat (exterior grade).', 'Cure. Remove masking. Rings stay', 'bare stainless.'], ACC],
      ['6', 'WELD 3a: INSIDE FERRULES', ['On the bench, butt-weld one ferrule to each', `tube (item 7, ${f1(D.pass.tube)} long).`, 'Back-purge, low heat.'], BLUE],
      ['7', 'WELD 2: PIPES IN', ['Push each tube in from the INSIDE until the', `flange face is ${f1(D.pass.inside)} proud of the inside face.`, 'Fillet to BOTH walls inside the bare rings.', 'Low amps, stitch around; keep heat off the coat.'], BLUE],
      ['8', 'WELD 3b: OUTSIDE FERRULES', ['Butt-weld the outside ferrules so the flange', `faces are ${f1(D.pass.outside)} proud outside: ${f1(D.pass.total)} face to face.`, 'Faces square to the tube within 0.5°.'], BLUE],
      ['9', 'PICKLE & PASSIVATE', ['Pickling gel on the pipe welds and rings only;', 'shield the coating. Rinse well.', 'Bores clean and bright.'], INK],
      ['10', 'FIT & CHECK', [`Fit ${D.rivnuts.L.ys.length + D.rivnuts.R.ys.length} × M6 316 rivnuts (H2).`, 'Check against the HOLD POINTS below.', 'Wrap the ferrule faces for delivery.'], INK],
    ] : [
      ['1', 'CUT & FORM', ['Cut items 1–7.', 'Form the 3 ceiling tabs.'], INK],
      ['2', 'DRILL', ['H1–H4 per the hole schedule.'], INK],
      ['3', 'WELD 1: THE FRAME', ['Legs, base plates, beam, tabs.'], INK],
      ['4', 'WELD 3a: INSIDE FERRULES', ['Ferrule to each tube on the bench.'], BLUE],
      ['5', 'WELD 2: PIPES IN', ['Fillet to both walls.'], BLUE],
      ['6', 'WELD 3b: OUTSIDE FERRULES', [`${f1(D.pass.total)} face to face.`], BLUE],
      ['7', 'PICKLE & PASSIVATE', ['All welds.'], INK],
      ['8', 'FIT & CHECK', ['Rivnuts, hold points.'], INK],
    ];
    const cw = 74.5, chh = 50, gx = 3, x0 = 16, y0 = 38;
    steps.forEach((st, i) => {
      const col = i % 5, row = Math.floor(i / 5);
      const x = x0 + col * (cw + gx), y = y0 + row * (chh + 6);
      const c = st[3];
      pen(c === INK ? MED : 0.9, c); fill([255, 255, 255]); doc.rect(x, y, cw, chh, 'FD');
      fill(c); doc.rect(x, y, cw, 9, 'F');
      txt(st[0], x + 3, y + 6.7, { size: 12, bold: true, color: [255, 255, 255] });
      txt(st[1], x + 12, y + 6.4, { size: 8.5, bold: true, color: [255, 255, 255] });
      st[2].forEach((l, k) => txt(l, x + 3, y + 15 + k * 4.2, { size: 6.6, bold: k === st[2].length - 1 && c !== INK }));
      if (col < 4 && i < steps.length - 1) { pen(MED, CL); ln(x + cw + 0.3, y + chh / 2, x + cw + gx - 0.3, y + chh / 2); arrowHead(x + cw + gx, y + chh / 2, 1, 0, CL); }
    });
    // masking diagram
    if (black) {
      const cx = 45, cy = 180, s = 0.45;
      txt('STEP 4 + 7: THE BARE RING', 18, 158, { size: 8, bold: true, color: BLUE });
      pen(THICK); fill([86, 86, 90]); doc.rect(cx - 50 * s, cy - 45 * s, 100 * s, 90 * s, 'FD');
      fill([212, 216, 222]); pen(THIN, BLUE, [1.2, 0.8]); doc.circle(cx + 15 * s, cy, 35 * s, 'FD');
      fill([255, 255, 255]); pen(THICK); doc.circle(cx + 15 * s, cy, 19.5 * s, 'FD');
      crossMark(cx + 15 * s, cy, 19.5 * s);
      leader(cx + 15 * s + 29 * s, cy - 14 * s, cx + 40, cy - 16, ['Ø70 bare stainless', '(masked during coating)'], { size: 6.2, c: BLUE, tc: BLUE });
      leader(cx + 15 * s + 12 * s, cy + 12 * s, cx + 40, cy + 4, ['Ø39 hole for the tube'], { size: 6.2 });
      leader(cx + 40 * s, cy + 38 * s, cx + 40, cy + 18, [black ? 'black powder coat' : 'bare 316'], { size: 6.2 });
      txt('The pipe weld (WELD 2) sits inside the ring, so the heat never', 18, 210, { size: 6.4 });
      txt('reaches powder. Afterwards the ring and the ferrule read as one', 18, 214, { size: 6.4 });
      txt('stainless detail on the black frame.', 18, 218, { size: 6.4 });
    }
    // hold points
    {
      const x0 = 150, y0 = 158;
      txt('HOLD POINTS (CHECK AND RECORD)', x0, y0, { size: 8, bold: true });
      const hp = [
        `After WELD 1: top of the U straight within 2; legs plumb within 2 over the height; overall width ${f1(Wd)} ±2.`,
        `After WELD 1: tab centres ${D.tabs.list.map((t) => t.fromBrick).join(' / ')} from the brick face (outside of leg 2) ±2.`,
        'Before coating: all H1 rings masked on BOTH faces; NO tubes fitted; H2 plugged.',
        `After WELD 2/3: flange faces ${f1(D.pass.inside)} in / ${f1(D.pass.outside)} out ±1; faces square ±0.5°; tube centres ${f1(D.pass.fromBrick)} off the brick face.`,
        'After pickling: no scorch marks on the coat; bores clean, no weld spatter on the sealing faces.',
        'Before delivery: ferrule faces wrapped; frame wrapped where it will bear on the slab.',
      ];
      hp.forEach((l, i) => {
        pen(MED); fill([255, 255, 255]); doc.rect(x0, y0 + 4 + i * 7.5, 3.6, 3.6, 'FD');
        txt(l, x0 + 6, y0 + 7 + i * 7.5, { size: 6.5, maxWidth: 250 });
      });
    }
    // don'ts
    {
      const x0 = 150, y0 = 212;
      fill([253, 236, 226]); pen(MED, ACC); doc.rect(x0, y0, 128, 32, 'FD');
      txt('DO NOT', x0 + 3, y0 + 6, { size: 9, bold: true, color: ACC });
      ['× weld anything to the frame after coating except the pipes, inside the rings', '× let powder or primer into the tube bores or onto the ferrule faces', '× grind the coat to make room for a weld', '× put pickling gel on the powder coat'].forEach((l, i) => txt(l, x0 + 3, y0 + 12 + i * 4.6, { size: 6.5 }));
    }
  }

  // =====================================================================================
  // SHEET 5: 3D VIEWS (rendered from the model)
  // =====================================================================================
  if (D.views && D.views.length) {
    sheet(5);
    const NAMES = { 1: 'LEFT LEG', 2: 'RIGHT LEG', 3: 'TOP BEAM', 4: 'BASE PLATE L', 5: 'BASE PLATE R', 6: 'CEILING TAB', 7: 'PASS-THROUGH TUBE', 8: 'TC FERRULE', 10: 'M10 ANCHOR', 11: 'BATTEN SCREW' };
    const place = (v, x, y, w, h) => {
      const ih = Math.min(h, (w * v.h) / v.w), iw = (ih * v.w) / v.h;
      const ix = x + (w - iw) / 2, iy = y;
      doc.addImage(v.img, 'JPEG', ix, iy, iw, ih);
      pen(THIN, CL); doc.rect(ix, iy, iw, ih, 'S');
      // view letter tag
      fill([28, 28, 30]); doc.rect(ix, iy, 7, 7, 'F'); txt(v.key, ix + 3.5, iy + 5.1, { size: 9, bold: true, align: 'center', color: [255, 255, 255] });
      const cx = ix + iw / 2, cy = iy + ih / 2;
      for (const m of v.marks) {
        const px = ix + m.u * iw, py = iy + m.v * ih;
        let dx = px - cx, dy = py - cy; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
        const off = 10;
        let bx = Math.min(ix + iw - 5, Math.max(ix + 5, px + dx * off + 4 * Math.sign(dx || 1)));
        let by = Math.min(iy + ih - 5, Math.max(iy + 9, py + dy * off));
        if (m.n === 'R') {
          pen(THIN, ACC); ln(px, py, bx, by); dot(px, py, 0.5, ACC);
          fill([255, 255, 255]); pen(MED, ACC); doc.circle(bx, by, 3.2, 'FD');
          txt('R', bx, by + 1.15, { align: 'center', size: 7.5, bold: true, color: ACC }); pen(THIN, INK);
        } else balloon(m.n, bx, by, px, py);
      }
      txt(`VIEW ${v.key}: ${v.title}`, ix + iw / 2, iy + ih + 5.5, { size: 8, bold: true, align: 'center' });
      txt('NOT TO SCALE', ix + iw / 2, iy + ih + 9, { size: 5.8, align: 'center', color: CL });
      return ih;
    };
    const V = Object.fromEntries(D.views.map((v) => [v.key, v]));
    if (V.A) place(V.A, 14, 16, 100, 178);
    if (V.B) place(V.B, 118, 16, 100, 178);
    const zs = ['C', 'D', 'E', 'F'].filter((k) => V[k]);
    zs.forEach((k, i) => place(V[k], 224 + (i % 2) * 94, 16 + Math.floor(i / 2) * 98, 90, 82));
    // legend and notes
    {
      const x0 = 14, y0 = 214;
      txt('BALLOONS = PARTS LIST ITEMS (SHEET 1)', x0, y0, { size: 7.5, bold: true });
      const keys = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11];
      keys.forEach((n, i) => {
        const x = x0 + (i % 5) * 41, y = y0 + 7 + Math.floor(i / 5) * 8;
        pen(MED); fill([255, 255, 255]); doc.circle(x + 2.6, y - 1, 2.6, 'FD');
        txt(n, x + 2.6, y - 0.05, { size: 6.5, bold: true, align: 'center' });
        txt(NAMES[n], x + 6.5, y, { size: 6.2 });
      });
      { const x = x0 + 5 * 41, y = y0 + 7; pen(MED, ACC); fill([255, 255, 255]); doc.circle(x + 2.6, y - 1, 2.6, 'FD'); txt('R', x + 2.6, y - 0.05, { size: 6.5, bold: true, align: 'center', color: ACC }); txt('Ø70 BARE RING (masked for coating)', x + 6.5, y, { size: 6.2, color: ACC }); pen(THIN, INK); }
      txt('Rendered from the planner model in the finish chosen there. For orientation only: build to the dimensions on sheets 1 to 3,', x0, y0 + 27, { size: 6.2, color: CL });
      txt('in the order on sheet 4. Side frames, headbox and shutter are not shown (by the shutter company).', x0, y0 + 30.5, { size: 6.2, color: CL });
    }
  }
  return doc;
}

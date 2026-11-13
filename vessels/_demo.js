export const meta = { id: '_demo', name: 'demo', dims: '' };
export function build(THREE, ctx) {
  const g = new THREE.Group();
  const m = ctx.core(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 48), ctx.MAT.ss));
  m.position.y = 0.25; g.add(m);
  return g;
}

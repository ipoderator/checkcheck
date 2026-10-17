// Рулон кассовой ленты: бумажная намотка со скруглёнными кромками, торцы со спиралью,
// картонная втулка; по желанию — размотанный хвост-«чек». Единицы — миллиметры.
// Ось рулона — X, центр — в начале координат. Лёжа на боку: position.y = R.
import * as THREE from 'three';
import { paperTextures, endFaceTextures, cardboardTexture, receiptTextures } from './textures.js';

let paperCache = null;
function paper() {
  if (!paperCache) paperCache = paperTextures(5);
  return paperCache;
}

function repeated(tex, rx, ry) {
  const t = tex.clone();
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}

export function paperMaterial({ rx = 1, ry = 1, color = 0xf1f1ee, map = null, bumpScale = 0.9 } = {}) {
  const p = paper();
  return new THREE.MeshPhysicalMaterial({
    color,
    map: map ?? repeated(p.map, rx, ry),
    bumpMap: repeated(p.bump, rx, ry),
    bumpScale,
    roughness: 0.5,
    clearcoat: 0.12,
    clearcoatRoughness: 0.4,
  });
}

/**
 * @param {object} o
 * @param {number} o.width — ширина ленты (вдоль оси), мм
 * @param {number} o.diameter — наружный диаметр намотки, мм
 */
export function createRoll({ width, diameter, coreInner = 6, coreWall = 1.4, seed = 1, tongue = null, texSize = 2048 }) {
  const R = diameter / 2;
  const W = width;
  const f = Math.min(0.9, R * 0.03);
  const rc = coreInner + coreWall;
  const group = new THREE.Group();
  group.userData = { R, W };

  // Бумага: профиль вращения с закруглёнными кромками.
  const prof = [];
  const arc = (cx, cy, a0, a1, n) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      prof.push(new THREE.Vector2(cx + Math.cos(a) * f, cy + Math.sin(a) * f));
    }
  };
  arc(R - f, -W / 2 + f, -Math.PI / 2, 0, 8);
  arc(R - f, W / 2 - f, 0, Math.PI / 2, 8);
  const sideGeo = new THREE.LatheGeometry(prof, 256);
  sideGeo.rotateZ(-Math.PI / 2);
  const circ = Math.PI * diameter;
  const side = new THREE.Mesh(sideGeo, paperMaterial({ rx: circ / 70, ry: W / 70, bumpScale: 0.45 }));
  group.add(side);

  // Торцы: спираль намотки.
  const turns = Math.round((R - rc) * 3.2);
  for (const sgn of [1, -1]) {
    const tex = endFaceTextures({ rIn: rc, rOut: R - f, turns, seed: seed * 31 + (sgn > 0 ? 1 : 2), size: texSize });
    const capGeo = new THREE.RingGeometry(rc, R - f, 384, 4);
    capGeo.rotateY(sgn * Math.PI / 2);
    capGeo.translate(sgn * W / 2, 0, 0);
    const cap = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({
      map: tex.map, bumpMap: tex.bump, bumpScale: 1.2, roughness: 0.82, color: 0xf3f2ee,
    }));
    group.add(cap);
  }

  // Втулка: торцевые кольца из серого картона чуть утоплены, внутренняя стенка с тенью в глубине.
  const recess = 0.35;
  const board = cardboardTexture({ seed: seed * 13 + 3 });
  for (const sgn of [1, -1]) {
    const ringGeo = new THREE.RingGeometry(coreInner, rc, 128, 1);
    ringGeo.rotateY(sgn * Math.PI / 2);
    ringGeo.translate(sgn * (W / 2 - recess), 0, 0);
    group.add(new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({ map: board, roughness: 0.95, color: 0xd8d4cc })));
    const lipGeo = new THREE.CylinderGeometry(rc, rc, recess, 128, 1, true);
    lipGeo.rotateZ(-Math.PI / 2);
    lipGeo.translate(sgn * (W / 2 - recess / 2), 0, 0);
    group.add(new THREE.Mesh(lipGeo, new THREE.MeshStandardMaterial({ color: 0xe9e7e1, roughness: 0.9, side: THREE.BackSide })));
  }
  const wallGeo = new THREE.CylinderGeometry(coreInner, coreInner, W - recess * 2, 128, 1, true);
  wallGeo.rotateZ(-Math.PI / 2);
  const innerBoard = cardboardTexture({ seed: seed * 17 + 5, innerWall: true });
  innerBoard.repeat.set(2, 1);
  group.add(new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({ map: innerBoard, roughness: 0.95, side: THREE.BackSide, color: 0xd8d4cc })));

  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  if (tongue) {
    // Конец витка лежит в долях миллиметра над рулоном: мягкая тень рулона легла бы на него пятном.
    group.add(createTongue(R, W, tongue));
  }
  return group;
}

/** Полоса по дуге вокруг оси X: angle(t) в радианах, radius(t) в мм, t ∈ [0, 1]. */
function arcStrip(W, rows, angle, radius) {
  const cols = 10;
  const half = W / 2 - 0.05;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    const a = angle(t), r = radius(t);
    for (let c = 0; c < cols; c++) {
      const u = c / (cols - 1);
      pos.push(-half + u * half * 2, r * Math.sin(a), r * Math.cos(a));
      uv.push(u, t);
    }
  }
  for (let i = 0; i < rows; i++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = i * cols + c, b = (i + 1) * cols + c;
      idx.push(a, b + 1, b, a, a + 1, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Свободный конец наружного витка: кончик ленты чуть отходит от рулона —
 * видна кромка и тень под ней. angle — где кончается лента (от +Z к +Y, градусы),
 * span — длина отходящего куска (градусы), lift — насколько отходит кончик, мм.
 */
function createTongue(R, W, { angle = 0, span = 20, lift = 0.5 }) {
  const group = new THREE.Group();
  const end = THREE.MathUtils.degToRad(angle);
  const sp = THREE.MathUtils.degToRad(span);
  const lip = (t) => R + 0.05 + lift * t * t;
  const flap = new THREE.Mesh(
    arcStrip(W, 40, (t) => end - sp + sp * t, lip),
    paperMaterial({ rx: (R * sp) / 70, ry: W / 70 }),
  );
  group.add(flap);
  // Срез бумаги: узкая грань от поверхности рулона до кончика.
  const edge = new THREE.Mesh(
    arcStrip(W, 2, () => end, (t) => R + 0.02 + (lift + 0.06) * t),
    new THREE.MeshStandardMaterial({ color: 0xd9d8d3, roughness: 0.9, side: THREE.DoubleSide }),
  );
  group.add(edge);
  // Затенение под кромкой: мягкая полоска на рулоне сразу за кончиком.
  const shadeSpan = Math.max(sp * 0.18, (lift * 5) / R);
  const shadeTex = (() => {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 256;
    const g = c.getContext('2d').createLinearGradient(0, 0, 0, 256);
    // alphaMap читает яркость (зелёный канал), а не альфу холста.
    g.addColorStop(0, 'rgb(120,120,120)');
    g.addColorStop(0.3, 'rgb(40,40,40)');
    g.addColorStop(1, 'rgb(0,0,0)');
    const ctx = c.getContext('2d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c);
    t.flipY = false;
    return t;
  })();
  const shade = new THREE.Mesh(
    arcStrip(W, 24, (t) => end + shadeSpan * t, () => R + 0.02),
    new THREE.MeshBasicMaterial({ color: 0x3a3832, alphaMap: shadeTex, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  );
  shade.userData.noFit = true;
  group.add(shade);
  return group;
}

/** Кубическая кривая Безье в плоскости (z, y). */
function bezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}

/**
 * Размотанный хвост: облегает рулон, сходит с него по касательной, спадает на пол и лежит,
 * в конце чуть загибаясь вверх. Печать «чека» — на внешней стороне.
 * phi — угол схода от верхней точки вперёд, градусы; reach — где хвост касается пола (z от оси);
 * flat — длина лежащей части; curl — подъём конца, мм.
 */
export function createTail(roll, { phi = 25, wrap = 70, reach = null, flat = 180, curl = 6, seed = 11, printOffset = 10 }) {
  const { R, W } = roll.userData;
  const lift = 0.12;
  const pts = [];
  const r = R + 0.06;
  const a0 = THREE.MathUtils.degToRad(phi - wrap), a1 = THREE.MathUtils.degToRad(phi);
  for (let i = 0; i <= 60; i++) {
    const a = a0 + (a1 - a0) * (i / 60);
    pts.push([r * Math.sin(a), r * Math.cos(a)]);
  }
  const P = pts[pts.length - 1];
  const T = [Math.cos(a1), -Math.sin(a1)];
  const zG = reach ?? R * 1.9;
  const G = [zG, -R + lift];
  const drop = P[1] - G[1];
  const c1 = [P[0] + T[0] * drop * 0.55, P[1] + T[1] * drop * 0.55];
  const c2 = [G[0] - drop * 0.75, G[1]];
  for (let i = 1; i <= 160; i++) pts.push(bezier(P, c1, c2, G, i / 160));
  // Лежащая часть: лёгкая волна (только вверх от пола) и подъём конца.
  for (let i = 1; i <= 400; i++) {
    const s = (i / 400) * flat;
    const wave = 0.9 * Math.pow(Math.sin(Math.PI * s / (flat * 0.55)), 2) * (s < flat * 0.55 ? 1 : 0);
    const endT = Math.max(0, (s - flat * 0.72) / (flat * 0.28));
    pts.push([G[0] + s, G[1] + wave + curl * endT * endT]);
  }

  // Равномерная выборка по длине дуги.
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[cum.length - 1];
  const N = 700;
  const samples = [];
  let j = 0;
  for (let i = 0; i <= N; i++) {
    const s = (i / N) * L;
    while (j < cum.length - 2 && cum[j + 1] < s) j++;
    const t = (s - cum[j]) / (cum[j + 1] - cum[j] || 1);
    samples.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * t, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * t]);
  }
  // Где начинается лежащая часть — для печати.
  const flatStart = cum[60 + 160];

  const cols = 12;
  const half = W / 2 - 0.15;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    for (let c = 0; c < cols; c++) {
      const u = c / (cols - 1);
      pos.push(-half + u * half * 2, samples[i][1], samples[i][0]);
      uv.push(u, i / N);
    }
  }
  for (let i = 0; i < N; i++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = i * cols + c, b = (i + 1) * cols + c, cc = (i + 1) * cols + c + 1, d = i * cols + c + 1;
      idx.push(a, b, cc, a, cc, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  const tex = receiptTextures({ widthMm: W, lengthMm: L, printStartMm: flatStart + printOffset, seed });
  const front = new THREE.Mesh(geo, paperMaterial({ map: tex.map, rx: W / 70, ry: L / 70, bumpScale: 0.6 }));
  front.material.alphaMap = tex.alpha;
  front.material.alphaTest = 0.5;
  front.material.side = THREE.FrontSide;
  // Изнанка чуть смещена внутрь: на силуэте не мерцает сквозь лицевую сторону.
  const backGeo = geo.clone();
  const bp = backGeo.attributes.position, bn = backGeo.attributes.normal;
  for (let i = 0; i < bp.count; i++) {
    bp.setXYZ(i, bp.getX(i) - bn.getX(i) * 0.03, bp.getY(i) - bn.getY(i) * 0.03, bp.getZ(i) - bn.getZ(i) * 0.03);
  }
  const back = new THREE.Mesh(backGeo, paperMaterial({ rx: W / 70, ry: L / 70, color: 0xf4f3ef, bumpScale: 0.6 }));
  back.material.alphaMap = tex.alpha;
  back.material.alphaTest = 0.5;
  back.material.side = THREE.BackSide;
  const tail = new THREE.Group();
  tail.add(front, back);
  tail.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  tail.userData = { length: L, flatStart };
  return tail;
}

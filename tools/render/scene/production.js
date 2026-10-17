// Кадр для тёмного раздела «Производство»: предметная съёмка рулонов в тёмной студии.
// Три рулона разных форматов на тёмном полу, лента главного рулона уходит из кадра к зрителю,
// контровой свет обрисовывает кромки. Края кадра растворяются ровно в фон секции.
// Никакого цеха и станков: это студийный натюрморт, а не «фото производства».
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { Studio } from './studio.js';
import { createRoll, createTail } from './roll.js';

export const SECTION_BG = '#141517';

function noFit(obj) {
  obj.traverse((o) => { o.userData.noFit = true; });
  return obj;
}

/** Направленный свет с мягкой тенью, покрывающей сцену. */
function softKey(scene, { color, intensity, dir, center, size, softness }) {
  const light = new THREE.DirectionalLight(color, intensity);
  light.position.copy(center).addScaledVector(new THREE.Vector3(...dir).normalize(), size * 2);
  light.target.position.copy(center);
  light.castShadow = true;
  const mapSize = 2048, extent = size * 1.4;
  light.shadow.mapSize.set(mapSize, mapSize);
  const s = light.shadow.camera;
  s.left = s.bottom = -extent;
  s.right = s.top = extent;
  s.near = size * 0.2;
  s.far = size * 6;
  light.shadow.radius = softness / (extent * 2 / mapSize);
  light.shadow.blurSamples = 48;
  light.shadow.bias = -0.0004;
  light.shadow.normalBias = 0.4;
  scene.add(light, light.target);
  return light;
}

/** Мягкое пятно: радиальный спад яркости (для света на полу). */
function glowTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const v = Math.round(255 * Math.pow(1 - t, 2.2) * (1 - t * t));
    grad.addColorStop(t, `rgb(${v},${v},${v})`);
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/**
 * Растворение краёв: каждый пиксель сводится к фону секции по маске
 * (ноль у самого края, плавный подъём внутрь, мягкая виньетка). Счёт в числах с плавающей точкой
 * и одно округление: на краях остаётся ровно SECTION_BG, а ровный фон внутри не даёт ступенек.
 * feather — ширина растворения по сторонам, доли кадра: [лево, право, верх, низ].
 */
function dissolveEdges(source, { feather, edge = 0.012, vignette = 0.3 }) {
  const w = source.width, h = source.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const c = out.getContext('2d', { willReadFrequently: true });
  c.drawImage(source, 0, 0);
  const img = c.getImageData(0, 0, w, h);
  const d = img.data;
  const [br, bgG, bb] = hexRgb(SECTION_BG);
  const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const [fl, fr, ft, fb] = feather;
  const mx = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    const u = (x + 0.5) / w;
    mx[x] = smooth((u - edge) / fl) * smooth((1 - edge - u) / fr);
  }
  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h;
    const my = smooth((v - edge) / ft) * smooth((1 - edge - v) / fb);
    const dy = (v - 0.5) * 2;
    for (let x = 0; x < w; x++) {
      const dx = ((x + 0.5) / w - 0.5) * 2;
      const r = Math.min(1, Math.sqrt(dx * dx + dy * dy) / Math.SQRT2);
      const m = mx[x] * my * (1 - vignette * smooth((r - 0.35) / 0.65));
      const i = (y * w + x) * 4;
      d[i] = Math.round(br + (d[i] - br) * m);
      d[i + 1] = Math.round(bgG + (d[i + 1] - bgG) * m);
      d[i + 2] = Math.round(bb + (d[i + 2] - bb) * m);
      d[i + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
  return out.toDataURL('image/png');
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Отражение в глянцевом тёмном полу: зеркальный кадр сцены, размытый и ослабленный,
 * добавляется поверх матового пола. Фон и сам пол в отражение не попадают.
 */
const GlossShader = {
  name: 'GlossReflection',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    strength: { value: 0.2 },
    spread: { value: new THREE.Vector2(0.0012, 0.003) },
  },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float strength;
    uniform vec2 spread;
    varying vec4 vUv;
    void main() {
      vec2 uv = vUv.xy / vUv.w;
      vec3 acc = vec3(0.0);
      float total = 0.0;
      for (int i = -4; i <= 4; i++) {
        for (int j = -4; j <= 4; j++) {
          vec2 k = vec2(float(i), float(j));
          float w = exp(-dot(k, k) / 10.0);
          acc += texture2D(tDiffuse, uv + k * spread).rgb * w;
          total += w;
        }
      }
      gl_FragColor = vec4(acc / total * strength, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

function glossFloor(scene, renderer, { size, center, strength, hide }) {
  const { width, height } = renderer.getDrawingBufferSize(new THREE.Vector2());
  const mirror = new Reflector(new THREE.PlaneGeometry(size * 12, size * 12), {
    textureWidth: width, textureHeight: height, shader: GlossShader, clipBias: 0.0005,
  });
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.set(center.x, 0.03, center.z);
  mirror.material.uniforms.strength.value = strength;
  mirror.material.transparent = true;
  mirror.material.blending = THREE.AdditiveBlending;
  mirror.material.depthWrite = false;
  mirror.renderOrder = 2;
  mirror.userData.noFit = true;
  const reflect = mirror.onBeforeRender;
  mirror.onBeforeRender = function (r, sc, cam, ...rest) {
    const bg = sc.background;
    const clear = r.getClearColor(new THREE.Color());
    const alpha = r.getClearAlpha();
    const shown = hide.map((o) => o.visible);
    sc.background = null;
    r.setClearColor(0x000000, 0);
    hide.forEach((o) => { o.visible = false; });
    reflect.call(this, r, sc, cam, ...rest);
    hide.forEach((o, i) => { o.visible = shown[i]; });
    r.setClearColor(clear, alpha);
    sc.background = bg;
  };
  scene.add(mirror);
  return mirror;
}

export function productionShot({ width = 1600, height = 1200, supersample = 2 } = {}) {
  const st = new Studio({ width, height, supersample });
  const { scene, renderer } = st;
  renderer.setClearColor(SECTION_BG, 1);
  scene.background = new THREE.Color(SECTION_BG);
  scene.environmentIntensity = 0.14;

  // Главный рулон 80 × 80 на боку; лента сходит с него к зрителю и уходит за край кадра.
  const main = createRoll({ width: 80, diameter: 80, seed: 7 });
  main.position.set(0, 40, 0);
  main.rotation.y = 0.32;
  const tail = createTail(main, { phi: 30, wrap: 120, reach: 66, flat: 460, curl: 0, seed: 33, printOffset: 16 });
  main.add(noFit(tail));
  st.add(main);

  // 57 × 40 стоя, чуть позади и левее.
  const upright = createRoll({ width: 57, diameter: 40, seed: 12 });
  upright.rotation.z = Math.PI / 2;
  upright.rotation.y = 0.8;
  upright.position.set(-62, 57 / 2, -62);
  // Мягкая тень VSM оставляла у основания пятно на самой бумаге: этот рулон тени не принимает.
  upright.traverse((o) => { if (o.isMesh) o.receiveShadow = false; });
  st.add(upright);

  // 57 × 40 на боку, справа впереди, с отошедшим кончиком.
  const side = createRoll({ width: 57, diameter: 40, seed: 19, tongue: { angle: 120, span: 26, lift: 0.5 } });
  side.position.set(88, 20, 34);
  side.rotation.y = 0.75;
  st.add(side);

  st.frame({ azimuth: -24, elevation: 15, fov: 20, margin: 0.09, offset: [0, 0.08] });

  const box = new THREE.Box3().setFromPoints(st.fitPoints());
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length();

  // Пол — «ловушка света»: сам он прозрачен и показывает фон секции, на нём видны только тени,
  // мягкое пятно света за предметами и отражения. Поэтому вдали пол ровно того же цвета, что фон.
  // Размер — в пределах карты теней: за её краем пол считался бы затенённым.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(size * 2.4, size * 2.4).rotateX(-Math.PI / 2),
    new THREE.ShadowMaterial({ opacity: 0.5, transparent: true, depthWrite: false }),
  );
  floor.position.set(center.x, 0, center.z);
  floor.receiveShadow = true;
  floor.userData.noFit = true;
  scene.add(floor);
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(size * 2.6, size * 1.7).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: glowTexture(), color: new THREE.Color(0.075, 0.073, 0.07), blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false, toneMapped: false,
    }),
  );
  glow.position.set(center.x + size * 0.05, 0.01, center.z - size * 0.12);
  glow.renderOrder = 2;
  glow.userData.noFit = true;
  scene.add(glow);

  // Ключевой: большой мягкий источник слева спереди сверху, тёплый белый — освещает торцы со спиралью.
  softKey(scene, { color: 0xfffaf4, intensity: 2.8, dir: [-1.0, 1.0, 0.6], center, size, softness: 16 });
  // Контровой: сзади слева, холодный — светлые кромки по силуэтам. Его блик уходит мимо камеры,
  // поэтому лента с печатью не засвечивается.
  const rim = new THREE.DirectionalLight(0xeef3ff, 3.4);
  rim.position.copy(center).addScaledVector(new THREE.Vector3(-0.7, 0.55, -1.0).normalize(), size * 2);
  rim.target.position.copy(center);
  scene.add(rim, rim.target);
  // Слабый заполняющий справа: теневая сторона не проваливается в черноту.
  const fill = new THREE.DirectionalLight(0xe8ecf5, 0.35);
  fill.position.copy(center).addScaledVector(new THREE.Vector3(1.0, 0.3, 0.4).normalize(), size * 2);
  fill.target.position.copy(center);
  scene.add(fill, fill.target);
  st.contact({
    near: { height: 4, blur: 1.4, darkness: 2.6, opacity: 0.85 },
    far: { height: 40, blur: 7, darkness: 1.4, opacity: 0.45 },
    pad: 50,
  });
  const contactPlanes = st.contactShadows.map((c) => c.plane);
  const mirror = glossFloor(scene, renderer, { size, center, strength: 0.12, hide: [floor, glow, ...contactPlanes] });
  mirror.renderOrder = 3;
  for (const cs of st.contactShadows) cs.update(scene, [floor, glow, mirror, ...contactPlanes]);
  renderer.render(scene, st.camera);
  return dissolveEdges(st.canvas, { feather: [0.12, 0.12, 0.2, 0.16] });
}

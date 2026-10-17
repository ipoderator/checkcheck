// «Фотостудия»: рендерер с прозрачным фоном, окружение, свет, мягкие тени, кадрирование.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';

/**
 * Контактная тень: глубина сцены снизу, размытая, на прозрачной плоскости y = 0.
 * Тёмная там, где предмет близко к полу. Приём из примера three.js webgl_shadow_contact.
 */
class ContactShadow {
  constructor(renderer, { width, depth, centerX = 0, centerZ = 0, height, blur, darkness, opacity, resolution = 1024 }) {
    this.renderer = renderer;
    this.blur = blur;
    this.group = new THREE.Group();
    this.group.position.set(centerX, 0.02, centerZ);
    const res = [resolution, Math.round(resolution * depth / width)];
    this.rt = new THREE.WebGLRenderTarget(res[0], res[1], { type: THREE.HalfFloatType });
    this.rt.texture.generateMipmaps = false;
    this.rtBlur = new THREE.WebGLRenderTarget(res[0], res[1], { type: THREE.HalfFloatType });
    this.rtBlur.texture.generateMipmaps = false;
    this.texel = [1 / res[0], 1 / res[1]];

    const plane = new THREE.PlaneGeometry(width, depth).rotateX(Math.PI / 2);
    this.plane = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({
      map: this.rt.texture, opacity, transparent: true, depthWrite: false,
    }));
    this.plane.renderOrder = 1;
    this.plane.scale.y = -1;
    this.plane.userData.noFit = true;
    this.group.add(this.plane);

    this.blurPlane = new THREE.Mesh(plane);
    this.blurPlane.visible = false;
    this.group.add(this.blurPlane);

    this.camera = new THREE.OrthographicCamera(-width / 2, width / 2, depth / 2, -depth / 2, 0, height);
    this.camera.rotation.x = Math.PI / 2;
    this.group.add(this.camera);

    this.depthMaterial = new THREE.MeshDepthMaterial();
    this.depthMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.darkness = { value: darkness };
      shader.fragmentShader = `uniform float darkness;\n${shader.fragmentShader.replace(
        'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
        'gl_FragColor = vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) * darkness );',
      )}`;
    };
    this.depthMaterial.depthTest = false;
    this.depthMaterial.depthWrite = false;
    this.hBlur = new THREE.ShaderMaterial(HorizontalBlurShader);
    this.hBlur.depthTest = false;
    this.vBlur = new THREE.ShaderMaterial(VerticalBlurShader);
    this.vBlur.depthTest = false;
  }

  blurPass(amount) {
    const r = this.renderer;
    this.blurPlane.visible = true;
    this.blurPlane.material = this.hBlur;
    this.hBlur.uniforms.tDiffuse.value = this.rt.texture;
    this.hBlur.uniforms.h.value = amount * this.texel[0];
    r.setRenderTarget(this.rtBlur);
    r.render(this.blurPlane, this.camera);
    this.blurPlane.material = this.vBlur;
    this.vBlur.uniforms.tDiffuse.value = this.rtBlur.texture;
    this.vBlur.uniforms.v.value = amount * this.texel[1];
    r.setRenderTarget(this.rt);
    r.render(this.blurPlane, this.camera);
    this.blurPlane.visible = false;
  }

  update(scene, hidden) {
    const r = this.renderer;
    const visible = hidden.map((o) => o.visible);
    hidden.forEach((o) => { o.visible = false; });
    const bg = scene.background;
    scene.background = null;
    scene.overrideMaterial = this.depthMaterial;
    const clear = r.getClearAlpha();
    r.setClearAlpha(0);
    r.setRenderTarget(this.rt);
    r.clear();
    r.render(scene, this.camera);
    scene.overrideMaterial = null;
    // Несколько проходов с убывающим радиусом — гладкая гауссова тень без ступенек.
    for (const k of [1, 0.75, 0.5, 0.35, 0.25]) this.blurPass(this.blur * k);
    r.setRenderTarget(null);
    r.setClearAlpha(clear);
    scene.background = bg;
    hidden.forEach((o, i) => { o.visible = visible[i]; });
  }
}

export class Studio {
  constructor({ width, height, supersample = 2 }) {
    this.width = width;
    this.height = height;
    this.canvas = document.createElement('canvas');
    document.body.append(this.canvas);
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: true, alpha: true, preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(width * supersample, height * supersample, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
    this.scene.environmentIntensity = 0.3;
    this.scene.environmentRotation.set(0, -0.6, 0);

    this.camera = new THREE.PerspectiveCamera(24, width / height, 1, 5000);
    this.subjects = new THREE.Group();
    this.scene.add(this.subjects);
    this.helpers = [];
    this.contactShadows = [];
  }

  add(obj) {
    this.subjects.add(obj);
    return obj;
  }

  /** Точки всех мешей для кадрирования (с прореживанием). */
  fitPoints() {
    const pts = [];
    this.subjects.updateMatrixWorld(true);
    this.subjects.traverse((o) => {
      if (!o.isMesh || o.userData.noFit) return;
      const pos = o.geometry.attributes.position;
      const stride = Math.max(1, Math.floor(pos.count / 3000));
      for (let i = 0; i < pos.count; i += stride) {
        pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld));
      }
    });
    return pts;
  }

  /**
   * Ставит камеру по азимуту/высоте так, чтобы предметы заняли кадр с полями margin (доля кадра).
   * distance — зафиксировать масштаб (тогда только центрирование). offset — сдвиг центра, доли кадра.
   */
  frame({ azimuth, elevation, fov = 24, margin = 0.06, distance = null, offset = [0, 0] }) {
    const cam = this.camera;
    cam.fov = fov;
    cam.updateProjectionMatrix();
    const pts = this.fitPoints();
    const box = new THREE.Box3().setFromPoints(pts);
    const target = box.getCenter(new THREE.Vector3());
    const az = THREE.MathUtils.degToRad(azimuth), el = THREE.MathUtils.degToRad(elevation);
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    let dist = distance ?? box.getSize(new THREE.Vector3()).length() / Math.tan(THREE.MathUtils.degToRad(fov) / 2);
    const tmp = new THREE.Vector3();
    for (let it = 0; it < 12; it++) {
      cam.position.copy(target).addScaledVector(dir, dist);
      cam.lookAt(target);
      cam.updateMatrixWorld(true);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of pts) {
        tmp.copy(p).project(cam);
        minX = Math.min(minX, tmp.x); maxX = Math.max(maxX, tmp.x);
        minY = Math.min(minY, tmp.y); maxY = Math.max(maxY, tmp.y);
      }
      const halfH = dist * Math.tan(THREE.MathUtils.degToRad(fov) / 2);
      const halfW = halfH * cam.aspect;
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      const cx = (minX + maxX) / 2 - offset[0] * 2, cy = (minY + maxY) / 2 - offset[1] * 2;
      target.addScaledVector(right, cx * halfW).addScaledVector(up, cy * halfH);
      if (distance == null) {
        const s = Math.max((maxX - minX) / 2, (maxY - minY) / 2) / (1 - margin * 2);
        dist *= s;
      }
    }
    this.target = target;
    this.distance = dist;
    return dist;
  }

  /** Свет: ключевой слева сверху с мягкой тенью, контровой сзади, окружение «комнаты». */
  light({ key = [-1.0, 1.1, 0.55], keyIntensity = 2.6, rim = [0.7, 0.9, -1.0], rimIntensity = 0.7, shadowOpacity = 0.15, shadowSoftness = 9 } = {}) {
    const box = new THREE.Box3().setFromPoints(this.fitPoints());
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();

    const keyLight = new THREE.DirectionalLight(0xfffaf3, keyIntensity);
    keyLight.position.copy(center).addScaledVector(new THREE.Vector3(...key).normalize(), size * 2);
    keyLight.target.position.copy(center);
    keyLight.castShadow = true;
    // Тень покрывает весь видимый пол с запасом: края карты теней не попадают в кадр.
    const mapSize = 2048, extent = size * 3;
    keyLight.shadow.mapSize.set(mapSize, mapSize);
    const s = keyLight.shadow.camera;
    s.left = s.bottom = -extent;
    s.right = s.top = extent;
    s.near = size * 0.2;
    s.far = size * 10;
    keyLight.shadow.radius = shadowSoftness / (extent * 2 / mapSize);
    keyLight.shadow.blurSamples = 48;
    keyLight.shadow.bias = -0.0004;
    this.scene.add(keyLight, keyLight.target);

    const rimLight = new THREE.DirectionalLight(0xf2f5ff, rimIntensity);
    rimLight.position.copy(center).addScaledVector(new THREE.Vector3(...rim).normalize(), size * 2);
    rimLight.target.position.copy(center);
    this.scene.add(rimLight, rimLight.target);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size * 4, size * 4).rotateX(-Math.PI / 2),
      new THREE.ShadowMaterial({ opacity: shadowOpacity, transparent: true, depthWrite: false }),
    );
    ground.position.set(center.x, 0, center.z);
    ground.receiveShadow = true;
    ground.userData.noFit = true;
    this.scene.add(ground);
    this.helpers.push(ground);
  }

  /** Контактные тени: плотная у самого пола и широкая мягкая. */
  contact({ near = { height: 5, blur: 1.6, darkness: 2.2, opacity: 0.7 }, far = { height: 45, blur: 6, darkness: 1.3, opacity: 0.38 }, pad = 40 } = {}) {
    const box = new THREE.Box3().setFromPoints(this.fitPoints());
    const w = box.max.x - box.min.x + pad * 2, d = box.max.z - box.min.z + pad * 2;
    const cx = (box.max.x + box.min.x) / 2, cz = (box.max.z + box.min.z) / 2;
    for (const p of [near, far]) {
      const cs = new ContactShadow(this.renderer, { width: w, depth: d, centerX: cx, centerZ: cz, resolution: 1536, ...p });
      this.scene.add(cs.group);
      this.contactShadows.push(cs);
    }
  }

  render() {
    const hidden = [...this.helpers, ...this.contactShadows.map((c) => c.plane)];
    for (const cs of this.contactShadows) cs.update(this.scene, hidden);
    this.renderer.render(this.scene, this.camera);
    return this.canvas.toDataURL('image/png');
  }
}

// Кадры: что и как снимаем. Каждая функция возвращает PNG (data URL) с прозрачным фоном.
import * as THREE from 'three';
import { Studio } from './studio.js';
import { createRoll, createTail } from './roll.js';

async function loadFonts() {
  const faces = [
    new FontFace('Unbounded', 'url(/render/fonts/Unbounded-subset.ttf)', { weight: '200 900' }),
    new FontFace('Manrope', 'url(/render/fonts/Manrope-subset.ttf)', { weight: '200 800' }),
  ];
  for (const f of faces) document.fonts.add(await f.load());
}

function lying(roll) {
  roll.position.y = roll.userData.R;
  return roll;
}

function standing(roll) {
  roll.rotation.z = Math.PI / 2;
  roll.position.y = roll.userData.W / 2;
  return roll;
}

const SHOTS = {
  stack: (o) => stackShot(o),
  // Первый экран: рулон 80 × 80 на боку, хвост-«чек» сходит сверху и ложится к зрителю.
  hero({ size = 1600, supersample = 2 } = {}) {
    const st = new Studio({ width: size, height: size, supersample });
    const roll = lying(createRoll({ width: 80, diameter: 80, seed: 2 }));
    const tail = createTail(roll, { phi: 28, wrap: 150, reach: 76, flat: 128, curl: 7, seed: 21 });
    roll.add(tail);
    st.add(roll);
    st.frame({ azimuth: -30, elevation: 36, fov: 22, margin: 0.05 });
    st.light();
    st.contact();
    return st.render();
  },

  roll({ width, diameter, size = 1000, supersample = 2, distance = null } = {}) {
    const st = new Studio({ width: size, height: size, supersample });
    const roll = standing(createRoll({ width, diameter, seed: width + diameter, tongue: { angle: 2, span: 24, lift: 0.45 } }));
    st.add(roll);
    st.frame({ azimuth: -30, elevation: 28, fov: 22, margin: 0.12, distance });
    st.light();
    st.contact();
    return { image: st.render(), distance: st.distance };
  },
};

function stackShot({ width = 1600, height = 1000, supersample = 2 } = {}) {
  const st = new Studio({ width, height, supersample });
  // Пирамида рулонов 80 × 80 на боку, торцами к зрителю: 4 — 3 — 2.
  const D = 80, R = D / 2;
  let seed = 100;
  const jitter = (n) => (Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453) % 1;
  [4, 3, 2].forEach((count, row) => {
    for (let i = 0; i < count; i++) {
      seed += 1;
      const roll = createRoll({ width: 80, diameter: D, seed, texSize: 1024 });
      roll.rotation.y = Math.PI / 2;
      roll.rotateX(jitter(1) * Math.PI);
      roll.position.set((i - (count - 1) / 2) * (D + 0.4), R + row * R * Math.sqrt(3) + row * 0.2, jitter(2) * 4);
      st.add(roll);
    }
  });
  // Рядом — стопки рулонов 57 × 40 стоя.
  const towers = [[196, -6, 3], [246, 40, 2]];
  for (const [x, z, n] of towers) {
    for (let k = 0; k < n; k++) {
      seed += 1;
      const roll = standing(createRoll({ width: 57, diameter: 40, seed, texSize: 1024 }));
      roll.position.x = x + jitter(3) * 1.5;
      roll.position.z = z + jitter(4) * 1.5;
      roll.position.y = 57 / 2 + k * 57.2;
      roll.rotation.y = jitter(5) * Math.PI;
      st.add(roll);
    }
  }
  // И один 57 × 40 на боку впереди, с отошедшим кончиком.
  seed += 1;
  const front = createRoll({ width: 57, diameter: 40, seed, texSize: 1024, tongue: { angle: 150, span: 24, lift: 0.4 } });
  front.position.set(200, 20, 118);
  front.rotation.y = 0.5;
  st.add(front);
  st.frame({ azimuth: -26, elevation: 20, fov: 22, margin: 0.06 });
  st.light();
  st.contact({ pad: 60 });
  return st.render();
}

export async function renderShot(name, opts = {}) {
  await loadFonts();
  const out = SHOTS[name](opts);
  return out;
}


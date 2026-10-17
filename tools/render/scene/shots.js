// Кадры: что и как снимаем. Каждая функция возвращает PNG (data URL); фон прозрачный, кроме production.
import * as THREE from 'three';
import { Studio } from './studio.js';
import { createRoll, createTail } from './roll.js';
import { productionShot } from './production.js';

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
  // Раздел «Производство»: непрозрачный кадр на фоне секции, края растворяются в фон.
  production: (o) => productionShot(o),
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

export async function renderShot(name, opts = {}) {
  await loadFonts();
  const out = SHOTS[name](opts);
  return out;
}


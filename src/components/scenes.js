// =============================================================
// scenes.js — Ánh sáng + nền theo loại dịp (ánh sáng ảnh hưởng mạnh tới cảm giác "thật")
// key: đèn chính (đổ bóng), fill: đèn phụ làm dịu bóng, rim: đèn viền tách người khỏi nền
// =============================================================
const S = (bg, key, fill, rim, hemi, env = 0.75, exposure = 1) => ({ bg, key, fill, rim, hemi, env, exposure });

export const SCENES = {
  studio: S(['#fdeef6', '#e9e3ff', '#d6eaff'],
    { c: '#fff4ec', i: 2.4, p: [1.6, 2.6, 2.4] }, { c: '#ffd6ec', i: 0.55, p: [-2.2, 1.4, 1.4] },
    { c: '#cfe0ff', i: 1.5, p: [-0.8, 2.1, -2.6] }, { sky: '#ffffff', ground: '#e8d9ef', i: 0.55 }),
  di_bien: S(['#a9dcff', '#e4f5ff', '#f6e3bd'],
    { c: '#fff0d2', i: 3.3, p: [1.2, 3.4, 2.0] }, { c: '#bfe6ff', i: 0.7, p: [-2.2, 1.2, 1.5] },
    { c: '#fff5d9', i: 1.6, p: [-0.4, 2.4, -2.8] }, { sky: '#cdeaff', ground: '#f3dfb5', i: 0.75 }, 0.9, 1.05),
  tiec_toi: S(['#24183a', '#3b2752', '#5e3a63'],
    { c: '#ffd0a0', i: 2.3, p: [1.5, 2.3, 2.2] }, { c: '#7b6cff', i: 0.6, p: [-2.4, 1.2, 1.2] },
    { c: '#ff8fc8', i: 2.4, p: [-0.6, 2.0, -2.6] }, { sky: '#4b3b70', ground: '#24183a', i: 0.35 }, 0.45, 0.95),
  dam_cuoi: S(['#fff8fb', '#fde6ef', '#f1e4ff'],
    { c: '#fff6ee', i: 2.5, p: [1.4, 2.6, 2.4] }, { c: '#ffe3ef', i: 0.6, p: [-2.2, 1.4, 1.4] },
    { c: '#ffd1e6', i: 1.7, p: [-0.6, 2.2, -2.6] }, { sky: '#ffffff', ground: '#f4dde7', i: 0.65 }, 0.8),
  hen_ho: S(['#ffcfa8', '#ffb4c6', '#c4a3ea'],
    { c: '#ffb685', i: 2.7, p: [2.4, 1.6, 1.6] }, { c: '#a68fff', i: 0.55, p: [-2.2, 1.3, 1.3] },
    { c: '#ff8db4', i: 2.0, p: [-1.0, 1.8, -2.6] }, { sky: '#ffd9c9', ground: '#8f6fa8', i: 0.45 }, 0.6),
  di_lam: S(['#eef3f8', '#e2e9f2', '#d6dfea'],
    { c: '#ffffff', i: 2.3, p: [1.2, 2.8, 2.4] }, { c: '#e6efff', i: 0.6, p: [-2.2, 1.4, 1.4] },
    { c: '#dfe9ff', i: 1.0, p: [-0.6, 2.2, -2.6] }, { sky: '#f5f9ff', ground: '#cfd6de', i: 0.7 }, 0.85),
  cafe: S(['#f6e6d6', '#ebd3bd', '#d8b79a'],
    { c: '#ffe0bd', i: 2.4, p: [1.6, 2.4, 2.2] }, { c: '#ffd9b0', i: 0.5, p: [-2.2, 1.3, 1.3] },
    { c: '#ffcf96', i: 1.3, p: [-0.6, 2.1, -2.6] }, { sky: '#fff1e2', ground: '#b98d6c', i: 0.55 }, 0.7),
  the_thao: S(['#d4f2ff', '#eafbf0', '#c4eed1'],
    { c: '#ffffff', i: 2.9, p: [1.2, 3.2, 2.2] }, { c: '#dff6ff', i: 0.7, p: [-2.2, 1.3, 1.4] },
    { c: '#fffbe8', i: 1.2, p: [-0.6, 2.2, -2.6] }, { sky: '#e6f6ff', ground: '#c6e8c9', i: 0.8 }, 0.9, 1.05),
  du_lich: S(['#c7e7ff', '#f1f7ff', '#e6f0d4'],
    { c: '#fff3df', i: 2.9, p: [1.4, 3.0, 2.2] }, { c: '#d6ecff', i: 0.6, p: [-2.2, 1.3, 1.4] },
    { c: '#fff1d6', i: 1.4, p: [-0.6, 2.2, -2.6] }, { sky: '#dff0ff', ground: '#e3ddc4', i: 0.7 }, 0.85),
  di_hoc: S(['#fff6e6', '#f1f6ff', '#e4efff'],
    { c: '#fffaf0', i: 2.4, p: [1.4, 2.6, 2.4] }, { c: '#e9f1ff', i: 0.6, p: [-2.2, 1.4, 1.4] },
    { c: '#fff1d9', i: 1.1, p: [-0.6, 2.2, -2.6] }, { sky: '#ffffff', ground: '#e2e6ef', i: 0.65 }),
  o_nha: S(['#fff3e8', '#f7ebe5', '#eee0f0'],
    { c: '#ffe8cf', i: 2.0, p: [1.6, 2.2, 2.4] }, { c: '#ffe2ea', i: 0.6, p: [-2.2, 1.3, 1.4] },
    { c: '#ffdcc4', i: 1.0, p: [-0.6, 2.0, -2.6] }, { sky: '#fff6ee', ground: '#e6d6dc', i: 0.6 }, 0.7),
};

export const sceneFor = (loaiDipId) => SCENES[loaiDipId] || SCENES.studio;

// Neon Coast Cover Studio — rendering engine.
// Draws GTA-style multi-panel poster covers on a canvas: four layouts,
// five colour grades, three title styles, a badge ribbon, film grain and
// a vignette. No network, no fonts beyond the system stack, no Rockstar
// artwork or lettering anywhere — everything here is drawn from scratch.

export const SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
};

export const LAYOUTS = {
  quad: { label: 'Quad Grid', panels: 4 },
  hero: { label: 'Hero + Trio', panels: 4 },
  bleed: { label: 'Full Bleed', panels: 1 },
  tilted: { label: 'Tilted Snaps', panels: 3 },
};

// Each grade: a canvas filter applied to the photos, a wash gradient drawn
// over the whole cover, and the sky colour used behind tilted snapshots.
export const GRADES = {
  sunset: {
    label: 'Vice Sunset',
    filter: 'saturate(1.45) contrast(1.12) sepia(0.22) hue-rotate(-12deg)',
    wash: ['rgba(255, 94, 60, 0.20)', 'rgba(140, 40, 160, 0.28)'],
    sky: ['#ff7a3d', '#c22a7a', '#3d1a5e'],
  },
  neon: {
    label: 'Neon Nights',
    filter: 'saturate(1.85) contrast(1.16) hue-rotate(6deg)',
    wash: ['rgba(0, 229, 255, 0.14)', 'rgba(255, 0, 153, 0.24)'],
    sky: ['#0b1035', '#7a1e8f', '#ff2e88'],
  },
  golden: {
    label: 'Golden Hour',
    filter: 'saturate(1.35) contrast(1.05) sepia(0.34) brightness(1.06)',
    wash: ['rgba(255, 190, 80, 0.22)', 'rgba(200, 110, 20, 0.20)'],
    sky: ['#ffd27a', '#f08a2e', '#7a3d12'],
  },
  noir: {
    label: 'Mono Noir',
    filter: 'grayscale(1) contrast(1.28) brightness(1.06)',
    wash: ['rgba(255, 255, 255, 0.06)', 'rgba(0, 0, 0, 0.30)'],
    sky: ['#3a3a3f', '#17171a', '#000000'],
  },
  dusk: {
    label: 'Palm Dusk',
    filter: 'saturate(1.2) contrast(1.1) hue-rotate(18deg) brightness(0.95)',
    wash: ['rgba(80, 120, 255, 0.16)', 'rgba(255, 120, 90, 0.20)'],
    sky: ['#2b3a6e', '#8f4a7a', '#ff8a5c'],
  },
};

export const TITLE_STYLES = {
  block: 'Block',
  sunset: 'Sunset Gradient',
  outline: 'Outline',
};

/** How many photo panels a layout holds. */
export function panelCount(layout) {
  return (LAYOUTS[layout] ?? LAYOUTS.quad).panels;
}

/** A tiny deterministic RNG so the film grain is identical on every run. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Draws one image to cover a rectangle, honouring a zoom factor and a
 * pan offset (fractions of the rectangle, -0.5..0.5). Nothing is ever
 * stretched: the image is scaled to cover, then cropped.
 */
export function drawCoverImage(ctx, img, x, y, w, h, zoom = 1, panX = 0, panY = 0) {
  if (!img || !img.naturalWidth) return;
  const base = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const s = base * Math.max(0.2, zoom);
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  const cx = x + w / 2 + panX * w;
  const cy = y + h / 2 + panY * h;
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
}

/** Panel rectangles for a layout, in canvas pixels. White gaps included. */
export function layoutRects(layout, w, h) {
  const g = Math.max(6, Math.round(Math.min(w, h) * 0.014)); // poster gap
  const m = g; // outer margin, same as the gap
  const iw = w - m * 2;
  const ih = h - m * 2;
  if (layout === 'hero') {
    const topH = Math.round(ih * 0.60);
    const botH = ih - topH - g;
    const cw = Math.round((iw - g * 2) / 3);
    return [
      { x: m, y: m, w: iw, h: topH },
      { x: m, y: m + topH + g, w: cw, h: botH },
      { x: m + cw + g, y: m + topH + g, w: cw, h: botH },
      { x: m + cw * 2 + g * 2, y: m + topH + g, w: iw - cw * 2 - g * 2, h: botH },
    ];
  }
  if (layout === 'bleed') return [{ x: 0, y: 0, w, h }];
  if (layout === 'tilted') {
    // Three overlapping snapshots; the rects are their unrotated boxes.
    const pw = Math.round(iw * 0.52);
    const ph = Math.round(ih * 0.46);
    return [
      { x: m, y: m + Math.round(ih * 0.02), w: pw, h: ph, rot: -0.10 },
      { x: m + iw - pw, y: m + Math.round(ih * 0.06), w: pw, h: ph, rot: 0.07 },
      { x: m + Math.round((iw - pw) / 2), y: m + Math.round(ih * 0.40), w: pw, h: ph, rot: -0.02 },
    ];
  }
  // quad: 2 x 2
  const cw = Math.round((iw - g) / 2);
  const ch = Math.round((ih - g) / 2);
  return [
    { x: m, y: m, w: cw, h: ch },
    { x: m + cw + g, y: m, w: iw - cw - g, h: ch },
    { x: m, y: m + ch + g, w: cw, h: ih - ch - g },
    { x: m + cw + g, y: m + ch + g, w: iw - cw - g, h: ih - ch - g },
  ];
}

/** Fits a font size so `text` fits inside `maxWidth`, starting from `start`. */
function fitFont(ctx, text, start, maxWidth, weight = 900) {
  let size = start;
  ctx.font = `${weight} ${size}px "Arial Black", Impact, "Helvetica Neue", sans-serif`;
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size = Math.max(10, size - 2);
    ctx.font = `${weight} ${size}px "Arial Black", Impact, "Helvetica Neue", sans-serif`;
  }
  return size;
}

function drawTitle(ctx, state, w, h) {
  const text = (state.title || '').trim().toUpperCase();
  if (!text) return;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const bandH = Math.round(h * 0.26);
  const bandY = h - bandH;
  // Scrim so the lettering reads over any photo.
  const scrim = ctx.createLinearGradient(0, bandY - h * 0.06, 0, h);
  scrim.addColorStop(0, 'rgba(0, 0, 0, 0)');
  scrim.addColorStop(0.45, 'rgba(0, 0, 0, 0.55)');
  scrim.addColorStop(1, 'rgba(0, 0, 0, 0.78)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, bandY - h * 0.06, w, bandH + h * 0.06);

  const size = fitFont(ctx, text, Math.round(h * 0.105), w * 0.92);
  const ty = h - Math.round(h * 0.075);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  if (state.titleStyle === 'sunset') {
    const grad = ctx.createLinearGradient(0, ty - size, 0, ty);
    grad.addColorStop(0, '#ffe259');
    grad.addColorStop(0.5, '#ff7e5f');
    grad.addColorStop(1, '#c22a7a');
    ctx.fillStyle = grad;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = Math.max(2, size * 0.045);
    ctx.strokeText(text, w / 2, ty);
    ctx.fillText(text, w / 2, ty);
  } else if (state.titleStyle === 'outline') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillText(text, w / 2, ty);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(3, size * 0.075);
    ctx.strokeText(text, w / 2, ty);
  } else {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = size * 0.18;
    ctx.shadowOffsetY = size * 0.04;
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = Math.max(3, size * 0.09);
    ctx.strokeText(text, w / 2, ty);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, w / 2, ty);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  const sub = (state.subtitle || '').trim();
  if (sub) {
    const sSize = fitFont(ctx, sub.toUpperCase(), Math.round(h * 0.032), w * 0.86, 700);
    ctx.font = `700 ${sSize}px "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    // Letter-spaced subtitle, drawn one glyph at a time.
    const spaced = sub.toUpperCase().split('').join(' ');
    const sw = ctx.measureText(spaced).width;
    ctx.fillText(spaced, (w - sw) / 2 + sw / 2, h - Math.round(h * 0.028));
  }
}

/** A diagonal badge ribbon in the top-left corner. */
function drawBadge(ctx, state, w, h) {
  const badge = (state.badge || '').trim().toUpperCase();
  if (!badge) return;
  const fs = Math.max(14, Math.round(h * 0.024));
  ctx.save();
  ctx.font = `900 ${fs}px "Arial Black", Impact, sans-serif`;
  const tw = ctx.measureText(badge).width;
  const bw = tw + fs * 2.4;
  const bh = fs * 2.1;
  // Centre the ribbon far enough in that its rotated corners stay on-canvas:
  // a -0.14 rad rotation pushes the left edge ~bw/2 + 0.07*bh out and the
  // top edge ~0.07*bw + bh/2 out.
  const cx = Math.round(bw / 2 + bh * 0.12 + 10);
  const cy = Math.round(Math.max(h * 0.055, bw * 0.08 + bh * 0.55 + 6));
  ctx.translate(cx, cy);
  ctx.rotate(-0.14);
  ctx.fillStyle = '#ff2e88';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badge, 0, 1);
  ctx.restore();
}

/** Deterministic film grain + vignette, drawn last so they sit over all.
 *  The grain is rendered once per canvas size and cached, so live preview
 *  redraws stay fast. */
const grainCache = new Map();
function grainCanvas(w, h) {
  const key = `${w}x${h}`;
  if (grainCache.has(key)) return grainCache.get(key);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const rng = mulberry32(20261121);
  const step = Math.max(3, Math.round(Math.min(w, h) / 360));
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      g.fillStyle = rng() > 0.5 ? '#ffffff' : '#000000';
      g.fillRect(x, y, step, step);
    }
  }
  grainCache.set(key, c);
  return c;
}

function drawGrainAndVignette(ctx, w, h) {
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.drawImage(grainCanvas(w, h), 0, 0);
  ctx.restore();
  const vg = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vg.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Draws the whole cover for `state` onto `ctx` at w x h pixels.
 * state: { photos: Image[], panels: [{photo, zoom, panX, panY}],
 *   layout, grade, title, subtitle, titleStyle, badge }
 */
export function drawCover(ctx, w, h, state) {
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const rects = layoutRects(state.layout, w, h);
  const panels = state.panels ?? [];

  if (state.layout === 'tilted') {
    const sky = ctx.createLinearGradient(0, 0, w, h);
    sky.addColorStop(0, grade.sky[0]);
    sky.addColorStop(0.55, grade.sky[1]);
    sky.addColorStop(1, grade.sky[2]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = '#ffffff'; // white poster gaps and keyline
    ctx.fillRect(0, 0, w, h);
  }

  ctx.save();
  ctx.filter = grade.filter;
  rects.forEach((r, i) => {
    const p = panels[i] ?? {};
    const img = typeof p.photo === 'number' ? state.photos?.[p.photo] : null;
    ctx.save();
    if (state.layout === 'tilted') {
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate(r.rot || 0);
      ctx.translate(-cx, -cy);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = Math.round(h * 0.02);
      ctx.shadowOffsetY = Math.round(h * 0.008);
      const b = Math.max(6, Math.round(Math.min(w, h) * 0.012));
      ctx.fillRect(r.x - b, r.y - b, r.w + b * 2, r.h + b * 2);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    if (img) {
      drawCoverImage(ctx, img, r.x, r.y, r.w, r.h, p.zoom ?? 1, p.panX ?? 0, p.panY ?? 0);
    } else {
      // Empty panel: a flat grade-tinted placeholder, never a broken image.
      const ph = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
      ph.addColorStop(0, grade.sky[0]);
      ph.addColorStop(1, grade.sky[2]);
      ctx.fillStyle = ph;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = `700 ${Math.max(14, Math.round(h * 0.028))}px "Helvetica Neue", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ADD A PHOTO', r.x + r.w / 2, r.y + r.h / 2);
    }
    ctx.restore();
  });
  ctx.restore(); // grade filter off before the washes and lettering

  // Colour wash over the whole poster.
  const wash = ctx.createLinearGradient(0, 0, w, h);
  wash.addColorStop(0, grade.wash[0]);
  wash.addColorStop(1, grade.wash[1]);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);

  drawBadge(ctx, state, w, h);
  drawTitle(ctx, state, w, h);
  drawGrainAndVignette(ctx, w, h);
  return rects;
}

/** Renders `state` at an export size and returns the canvas. */
export function renderCover(state, sizeKey) {
  const [w, h] = SIZES[sizeKey] ?? SIZES['1080x1080'];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  drawCover(ctx, w, h, state);
  return canvas;
}

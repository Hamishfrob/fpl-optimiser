// Canvas drawing for the page header: a banked stand of red seats with the team name in white seats,
// and an amber dot-matrix scoreboard. Original artwork inspired by the look of a football stand; no club marks.
import { textGrid } from './dotfont.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const noise = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };

function fit(canvas, cssHeight, fixedWidth) {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const w = fixedWidth ?? (canvas.clientWidth || canvas.parentElement.clientWidth || 640); // 640 if the page isn't laid out yet (hidden tab)
  if (fixedWidth) canvas.style.width = `${fixedWidth}px`;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(cssHeight * dpr);
  canvas.style.height = `${cssHeight}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h: cssHeight };
}

/** Rows of seats. White seats spell `text`, centred. The red seats ripple slowly. */
export function drawStand(canvas, text) {
  const rowsN = 15;
  let { ctx, w, h } = fit(canvas, 132);
  let step = 10; // seat pitch in px
  const grid = textGrid(text.toUpperCase());
  while (grid.cols * step > w - 24 && step > 4) step -= 1; // shrink the seats if the name is long
  const cols = Math.ceil(w / step) + 1;
  const left = Math.round((cols - grid.cols) / 2), top = Math.round((rowsN - 7) / 2);
  let frame = 0, stopped = false;
  const paint = (t) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#12090b'); g.addColorStop(1, '#2a0d11');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const seat = step - 2;
    for (let r = 0; r < rowsN; r++) for (let c = 0; c < cols; c++) {
      const x = c * step, y = 4 + r * ((h - 8) / rowsN);
      const lit = grid.rows[r - top]?.[c - left] === '#';
      const wave = 0.5 + 0.5 * Math.sin(t / 900 + c * 0.35 + r * 0.5);
      const n = noise(c, r);
      if (lit) {
        const b = 235 + Math.round(20 * wave);
        ctx.fillStyle = `rgb(${b},${b},${b - 6})`;
      } else {
        const depth = 0.65 + 0.35 * (r / rowsN);           // rows further back are darker
        const base = 150 + n * 25 + wave * 14;
        ctx.fillStyle = `rgb(${Math.round(base * depth)},${Math.round(18 * depth)},${Math.round(26 * depth)})`;
      }
      ctx.beginPath(); ctx.roundRect(x, y, seat, Math.max(3, (h - 8) / rowsN - 2), 2); ctx.fill();
      ctx.fillStyle = lit ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.12)'; ctx.fillRect(x + 1, y, seat - 2, 1.2); // seat back highlight
    }
  };
  const loop = (t) => { if (stopped) return; paint(t); frame = requestAnimationFrame(loop); };
  if (reduced()) paint(0); else frame = requestAnimationFrame(loop);
  return () => { stopped = true; cancelAnimationFrame(frame); };
}

/** One line of amber dots, e.g. "06:18:10:54". Lit colour is passed in so the stage can change the lamp. */
export function drawBoard(canvas, text, colour) {
  const grid = textGrid(text);
  const pitch = 7, dot = 2.5;
  const { ctx, w, h } = fit(canvas, 7 * pitch + 14, grid.cols * pitch + 16);
  canvas.parentElement.style.width = `${w}px`; // the unit labels underneath follow the digits' width
  ctx.clearRect(0, 0, w, h);
  const x0 = 8, y0 = 7;
  for (let y = 0; y < 7; y++) for (let x = 0; x < grid.cols; x++) {
    const on = grid.rows[y][x] === '#';
    ctx.beginPath(); ctx.arc(x0 + x * pitch + pitch / 2, y0 + y * pitch + pitch / 2, dot, 0, Math.PI * 2);
    ctx.fillStyle = on ? colour : 'rgba(255,255,255,.07)';
    if (on) { ctx.shadowColor = colour; ctx.shadowBlur = 8; } else ctx.shadowBlur = 0;
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

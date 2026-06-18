"use client";

// Minimal, dependency-free confetti. A single shared canvas is created lazily
// on the first burst; particles are simple rotating rects under gravity, and
// the animation loop stops itself once they've all faded. Ported from the
// maintainer's prototype, scaled down a touch for the in-app accent picker.

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
};

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
const particles: Particle[] = [];
let raf = 0;

function resize() {
  if (!canvas || !ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function ensureCanvas() {
  if (canvas) return;
  canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9998;";
  document.body.appendChild(canvas);
  ctx = canvas.getContext("2d");
  resize();
  window.addEventListener("resize", resize);
}

function loop() {
  if (!ctx || !canvas) {
    raf = 0;
    return;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life++;
    p.vy += 0.16; // gravity
    p.vx *= 0.99;
    p.vy *= 0.99;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;

    const t = p.life / p.maxLife;
    if (t >= 1) {
      particles.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    ctx.restore();
  }

  raf = particles.length ? requestAnimationFrame(loop) : 0;
}

export function fireConfetti(x: number, y: number, color: string) {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  ensureCanvas();

  // Smaller burst than the prototype: fewer, slightly smaller particles, a
  // shorter arc, so it reads as a small celebratory pop from the swatch
  // rather than a full-screen cannon.
  const count = 14;
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
    const speed = 2 + Math.random() * 4;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      size: 3 + Math.random() * 3,
      life: 0,
      maxLife: 42 + Math.random() * 24,
      color,
    });
  }

  if (!raf) raf = requestAnimationFrame(loop);
}

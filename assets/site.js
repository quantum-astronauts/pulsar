// Pulsar site: starfield, header state, scroll reveals, parallax and the copy-email button.
document.documentElement.classList.add('js');
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- starfield: three depths of twinkling stars, drifting with scroll, plus the odd shooting star ----------
const sky = document.getElementById('sky');
if (sky && sky.getContext) {
  const ctx = sky.getContext('2d');
  let W = 0, H = 0, stars = [], shoot = null, nextShoot = performance.now() + 3000;
  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = sky.clientWidth; H = sky.clientHeight;
    sky.width = W * dpr; sky.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(W * H / 5200);
    stars = Array.from({ length: n }, () => {
      const z = Math.random();
      return { x: Math.random() * W, y: Math.random() * H, z, r: .4 + z * 1.3, p: Math.random() * 6.3, s: .6 + Math.random() * 1.8, warm: Math.random() < .08 };
    });
  };
  const draw = t => {
    ctx.clearRect(0, 0, W, H);
    const sc = window.scrollY;
    for (const s of stars) {
      const y = ((s.y - sc * (.04 + s.z * .16)) % H + H) % H;
      const a = calm ? .7 : .35 + .65 * (.5 + .5 * Math.sin(t / 1000 * s.s + s.p));
      ctx.globalAlpha = a * (.45 + s.z * .55);
      ctx.fillStyle = s.warm ? '#ffd2b0' : s.z > .85 ? '#cfe9ff' : '#ffffff';
      ctx.beginPath(); ctx.arc(s.x, y, s.r, 0, 6.283); ctx.fill();
    }
    if (!calm) {
      if (!shoot && t > nextShoot) shoot = { x: Math.random() * W * .7 + W * .2, y: Math.random() * H * .35, t };
      if (shoot) {
        const k = (t - shoot.t) / 900, len = 140;
        if (k > 1) { shoot = null; nextShoot = t + 5000 + Math.random() * 7000; }
        else {
          const x = shoot.x - k * 420, y = shoot.y + k * 180;
          const g = ctx.createLinearGradient(x, y, x + len, y - len * .43);
          g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(124,196,255,0)');
          ctx.globalAlpha = Math.sin(k * Math.PI); ctx.strokeStyle = g; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y - len * .43); ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
  };
  resize(); window.addEventListener('resize', resize);
  if (calm) { draw(0); window.addEventListener('scroll', () => draw(0), { passive: true }); }
  else { const loop = t => { draw(t); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
}

// ---------- header ----------
const bar = document.querySelector('.top');
const onScroll = () => bar && bar.classList.toggle('solid', window.scrollY > 24);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ---------- reveals ----------
const rises = document.querySelectorAll('.rise');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  rises.forEach(el => io.observe(el));
} else {
  rises.forEach(el => el.classList.add('in'));
}

// ---------- parallax: [data-px] layers move at a fraction of the scroll ----------
const layers = [...document.querySelectorAll('[data-px]')];
if (layers.length && !calm) {
  let ticking = false;
  const move = () => {
    ticking = false;
    for (const el of layers) {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < -200 || r.top > innerHeight + 200) continue;
      el.style.transform = `translate3d(0, ${(r.top + r.height / 2 - innerHeight / 2) * -parseFloat(el.dataset.px)}px, 0) scale(1.12)`;
    }
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(move); } }, { passive: true });
  move();
}

// ---------- tilt: [data-tilt] cards lean toward the pointer ----------
if (!calm && matchMedia('(pointer: fine)').matches) {
  document.querySelectorAll('[data-tilt]').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      el.style.transform = `perspective(900px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

// ---------- copy email ----------
document.querySelectorAll('[data-copy]').forEach(btn => btn.addEventListener('click', async () => {
  const text = btn.dataset.copy;
  try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied'; }
  catch (e) {
    const r = document.createRange(); r.selectNodeContents(document.querySelector('.mail a'));
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); btn.textContent = 'Selected';
  }
  setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
}));

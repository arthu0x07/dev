// ── PARTICLES ──────────────────────────────────
const canvas = document.getElementById('particles-canvas');
const ctx = canvas.getContext('2d');
let W, H, mouse = { x: -999, y: -999 };
const isMobile = window.innerWidth < 768;

function resize() {
   W = canvas.width = window.innerWidth;
   H = canvas.height = window.innerHeight;
}
resize(); window.addEventListener('resize', resize);
document.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

class P {
   constructor() { this.init(true); }
   init(r) {
      this.x = Math.random() * W;
      this.y = r ? Math.random() * H : -5;
      this.vx = (Math.random() - .5) * .42;
      this.vy = (Math.random() - .5) * .42;
      this.rad = Math.random() * 1.5 + .5;
      this.a = Math.random() * .3 + .08;
   }
   update() {
      this.x += this.vx; this.y += this.vy;
      const dx = this.x - mouse.x, dy = this.y - mouse.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 7744) { // 88*88
         const d = Math.sqrt(d2);
         const f = (88 - d) / 88 * .65;
         this.x += dx / d * f * 2.2; this.y += dy / d * f * 2.2;
      }
      if (this.x < -10) this.x = W + 10; if (this.x > W + 10) this.x = -10;
      if (this.y < -10) this.y = H + 10; if (this.y > H + 10) this.y = -10;
   }
   draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.rad, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,0,0,${this.a})`;
      ctx.fill();
   }
}

const ptsCount = isMobile ? 35 : 72;
const pts = Array.from({ length: ptsCount }, () => new P());
const lineDistSq = 115 * 115;
const mouseDistSq = 150 * 150;

function loop() {
   ctx.clearRect(0, 0, W, H);
   for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      p1.update(); p1.draw();
      for (let j = i + 1; j < pts.length; j++) {
         const p2 = pts[j];
         const dx = p1.x - p2.x, dy = p1.y - p2.y;
         const d2 = dx * dx + dy * dy;
         if (d2 < lineDistSq) {
            const d = Math.sqrt(d2);
            ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(0,0,0,${(1 - d / 115) * .13})`; ctx.lineWidth = .6; ctx.stroke();
         }
      }
      const mdx = p1.x - mouse.x, mdy = p1.y - mouse.y;
      const md2 = mdx * mdx + mdy * mdy;
      if (md2 < mouseDistSq) {
         const md = Math.sqrt(md2);
         ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(mouse.x, mouse.y);
         ctx.strokeStyle = `rgba(0,0,0,${(1 - md / 150) * .28})`; ctx.lineWidth = .7; ctx.stroke();
      }
   }
   requestAnimationFrame(loop);
}
loop();

// ── CURSOR ──────────────────────────────────────
const cur = document.getElementById('cursor'), ring = document.getElementById('cursor-ring');
let mx = 0, my = 0, rx = 0, ry = 0;
document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; cur.style.cssText = `left:${mx}px;top:${my}px`; });
(function ar() { rx += (mx - rx) * .12; ry += (my - ry) * .12; ring.style.cssText = `left:${rx}px;top:${ry}px`; requestAnimationFrame(ar); })();

// ── PROGRESS ────────────────────────────────────
const bar = document.getElementById('progress-bar');
let ticking = false;
window.addEventListener('scroll', () => {
   if (!ticking) {
      requestAnimationFrame(() => {
         bar.style.width = (window.scrollY / (document.body.scrollHeight - window.innerHeight) * 100) + '%';
         ticking = false;
      });
      ticking = true;
   }
}, { passive: true });

// ── REVEAL ──────────────────────────────────────
const obs = new IntersectionObserver(entries => {
   entries.forEach(e => {
      if (e.isIntersecting) {
         e.target.classList.add('visible');
         obs.unobserve(e.target);
      }
   });
}, { threshold: .1 });
document.querySelectorAll('.reveal,.stagger,.reveal-blur,.reveal-scale,.reveal-left,.reveal-right').forEach(el => obs.observe(el));

// section bars
const barObs = new IntersectionObserver(entries => {
   entries.forEach(e => {
      if (e.isIntersecting) {
         e.target.classList.add('visible');
         barObs.unobserve(e.target);
      }
   });
}, { threshold: .5 });
document.querySelectorAll('.section-bar').forEach(el => barObs.observe(el));

// timeline items (staggered)
const tlObs = new IntersectionObserver(entries => {
   entries.forEach(e => {
      if (e.isIntersecting) {
         e.target.classList.add('visible');
         tlObs.unobserve(e.target);
      }
   });
}, { threshold: .12 });
document.querySelectorAll('.tl-item').forEach((el, i) => {
   el.style.transitionDelay = `${i * 0.08}s`;
   tlObs.observe(el);
});

// ── ACTIVE NAV ──────────────────────────────────
const navLinks = document.querySelectorAll('.side-nav a');
const secObs = new IntersectionObserver(entries => {
   entries.forEach(e => {
      if (e.isIntersecting) {
         navLinks.forEach(l => l.classList.remove('active'));
         const l = document.querySelector(`.side-nav a[href="#${e.target.id}"]`);
         if (l) l.classList.add('active');
      }
   });
}, { rootMargin: '-40% 0px -50% 0px' });
['inicio', 'cases', 'experiencia', 'sobre', 'contato'].forEach(id => {
   const el = document.getElementById(id);
   if (el) secObs.observe(el);
});

// ── MOBILE NAV TAB ───────────────────────────────
const navTab = document.getElementById('nav-tab');
const sideNav = document.getElementById('side-nav');
navTab.addEventListener('click', () => {
   const open = sideNav.classList.toggle('mob-open');
   navTab.querySelector('svg path').setAttribute('d', open ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6');
   sideNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      sideNav.classList.remove('mob-open');
      navTab.querySelector('svg path').setAttribute('d', 'M9 18l6-6-6-6');
   }, { once: true }));
});

// ── TYPING ──────────────────────────────────────
const roles = [
   'front-end.web(developer)',
   'back-end.api(engineer)',
   'full-stack.dev(builder)',
   'mobile.app(developer)',
];
const typedEl = document.getElementById('typed-text');
const ghost = typedEl.cloneNode();
ghost.style.cssText = 'visibility:hidden;position:absolute;pointer-events:none;white-space:nowrap;';
ghost.textContent = roles.reduce((a, b) => a.length >= b.length ? a : b);
typedEl.parentElement.style.position = 'relative';
typedEl.parentElement.appendChild(ghost);
let ri = 0, ci = roles[0].length, del = false;
function type() {
   const t = roles[ri];
   if (!del) {
      if (ci < t.length) {
         typedEl.textContent = t.slice(0, ++ci);
         setTimeout(type, 60);
      } else {
         setTimeout(() => { del = true; type(); }, 2600);
      }
   }
   else {
      if (ci > 0) {
         typedEl.textContent = t.slice(0, --ci);
         setTimeout(type, 34);
      } else {
         del = false; ri = (ri + 1) % roles.length;
         setTimeout(type, 360);
      }
   }
}
setTimeout(type, 2600);

// ── CARD TILT ───────────────────────────────────
function tilt(sel, s) {
   document.querySelectorAll(sel).forEach(el => {
      el.addEventListener('mousemove', e => {
         const r = el.getBoundingClientRect();
         const x = (e.clientX - r.left) / r.width - .5;
         const y = (e.clientY - r.top) / r.height - .5;
         el.style.transform = `translateY(-7px) rotateY(${x * s * 2}deg) rotateX(${-y * s * 2}deg)`;
         el.style.transition = 'transform .05s';
      });
      el.addEventListener('mouseleave', () => {
         el.style.transform = ''; el.style.transition = 'transform .35s ease';
      });
   });
}
tilt('.case-card', 4);

// ── HERO PARALLAX + FADE ────────────────────────
const heroInner = document.querySelector('.hero-inner');
let heroTicking = false;
window.addEventListener('scroll', () => {
   if (!heroInner || heroTicking) return;
   requestAnimationFrame(() => {
      const sy = window.scrollY;
      heroInner.style.transform = `translateY(${sy * 0.32}px)`;
      heroInner.style.opacity = Math.max(0, 1 - sy / 400).toFixed(3);
      heroTicking = false;
   });
   heroTicking = true;
}, { passive: true });

// ── TIMELINE LINE DRAW ───────────────────────────
const lineObs = new IntersectionObserver(entries => {
   entries.forEach(e => {
      if (e.isIntersecting) {
         e.target.classList.add('line-drawn');
         lineObs.unobserve(e.target);
      }
   });
}, { threshold: 0.05 });
document.querySelectorAll('.timeline').forEach(el => lineObs.observe(el));

// ── SKILLS CASCADE ───────────────────────────────
const skillsObs = new IntersectionObserver(entries => {
   entries.forEach(e => {
      if (e.isIntersecting) {
         e.target.querySelectorAll('.skill-pill').forEach((p, i) => {
            setTimeout(() => p.classList.add('anim-in'), i * 50);
         });
         skillsObs.unobserve(e.target);
      }
   });
}, { threshold: 0.15 });
document.querySelectorAll('.skills-row').forEach(el => skillsObs.observe(el));

// ── CASE CARDS PARALLAX DEPTH ────────────────────
const casesSection = document.getElementById('cases');
const caseCards = document.querySelectorAll('.case-card');
let casesTicking = false;
window.addEventListener('scroll', () => {
   if (!casesSection || casesTicking) return;
   requestAnimationFrame(() => {
      const rect = casesSection.getBoundingClientRect();
      const progress = 1 - (rect.top / window.innerHeight);
      if (progress >= 0 && progress <= 2.2) {
         const offsets = [18, -12, 14, -10];
         caseCards.forEach((c, i) => {
            if (!c.matches(':hover')) {
               c.style.transform = `translateY(${offsets[i % offsets.length] * (1 - Math.min(progress, 1))}px)`;
            }
         });
      }
      casesTicking = false;
   });
   casesTicking = true;
}, { passive: true });

// ── SCROLL SPEED TILT ON SECTION BARS ────────────
let prevSY = 0;
let barsTicking = false;
window.addEventListener('scroll', () => {
   if (barsTicking) return;
   requestAnimationFrame(() => {
      const vel = window.scrollY - prevSY;
      prevSY = window.scrollY;
      document.querySelectorAll('.section-bar.visible').forEach(bar => {
         bar.style.transform = `scaleY(1) skewY(${Math.max(-4, Math.min(4, vel * 0.15))}deg)`;
         clearTimeout(bar._tiltTimer);
         bar._tiltTimer = setTimeout(() => { bar.style.transform = 'scaleY(1)'; }, 180);
      });
      barsTicking = false;
   });
   barsTicking = true;
}, { passive: true });

// ── TEXT SCRAMBLE ────────────────────────────────
class TextScramble {
   constructor(el) {
      this.el = el;
      this.chars = '!<>-_\\/[]{}—=+*^?#░▒▓0123456789ABCDEF';
      this.update = this.update.bind(this);
   }
   setText(newText) {
      const length = newText.length;
      const promise = new Promise(r => this.resolve = r);
      this.queue = [];
      for (let i = 0; i < length; i++) {
         const to = newText[i];
         const start = Math.floor(Math.random() * 10);
         const end = start + Math.floor(Math.random() * 16);
         this.queue.push({ to, start, end });
      }
      cancelAnimationFrame(this.frameRequest);
      this.frame = 0;
      this.update();
      return promise;
   }
   update() {
      let output = '', complete = 0;
      for (let i = 0; i < this.queue.length; i++) {
         let { to, start, end, char } = this.queue[i];
         if (this.frame >= end) {
            complete++;
            output += to;
         } else if (this.frame >= start) {
            if (!char || Math.random() < 0.28) {
               char = this.chars[Math.floor(Math.random() * this.chars.length)];
               this.queue[i].char = char;
            }
            output += `<span class="scramble-char">${char}</span>`;
         } else {
            output += to === ' ' ? ' ' : '·';
         }
      }
      this.el.innerHTML = output;
      if (complete === this.queue.length) { this.resolve(); }
      else {
         this.frameRequest = requestAnimationFrame(this.update);
         this.frame++;
      }
   }
}
const scrambleObs = new IntersectionObserver(entries => {
   entries.forEach(e => {
      if (e.isIntersecting) {
         const h2 = e.target.querySelector('h2');
         if (h2 && !h2.dataset.scrambled) {
            h2.dataset.scrambled = '1';
            const text = h2.textContent.trim();
            new TextScramble(h2).setText(text);
         }
         scrambleObs.unobserve(e.target);
      }
   });
}, { threshold: 0.4 });
document.querySelectorAll('.section-head').forEach(el => scrambleObs.observe(el));

// ── MAGNETIC EFFECT ───────────────────────────────
document.querySelectorAll('.magnetic').forEach(el => {
   let cx = 0, cy = 0, tx = 0, ty = 0, raf;
   const lerp = () => {
      cx += (tx - cx) * 0.13;
      cy += (ty - cy) * 0.13;
      el.style.transform = `translate(${cx.toFixed(2)}px, ${cy.toFixed(2)}px)`;
      if (Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05) raf = requestAnimationFrame(lerp);
   };
   el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      tx = (e.clientX - (r.left + r.width / 2)) * 0.38;
      ty = (e.clientY - (r.top + r.height / 2)) * 0.38;
      cancelAnimationFrame(raf); raf = requestAnimationFrame(lerp);
   });
   el.addEventListener('mouseleave', () => {
      tx = 0; ty = 0;
      cancelAnimationFrame(raf); raf = requestAnimationFrame(lerp);
   });
});

// ── WORD REVEAL ───────────────────────────────────
document.querySelectorAll('.reveal-words').forEach(el => {
   el.innerHTML = el.textContent.trim().split(' ').map(w =>
      `<span class="word-wrap"><span class="word">${w}</span></span>`
   ).join(' ');
   const words = el.querySelectorAll('.word');
   const wObs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
         words.forEach((w, i) => setTimeout(() => w.classList.add('in'), i * 90));
         wObs.disconnect();
      }
   }, { threshold: 0.3 });
   wObs.observe(el);
});

// ── CARD GLARE ────────────────────────────────────
document.querySelectorAll('.case-card').forEach(card => {
   const glare = document.createElement('div');
   glare.className = 'card-glare';
   card.appendChild(glare);
   card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--gx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      card.style.setProperty('--gy', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
   });
});

// ── COUNTER ANIMATION ────────────────────────────
function countUp(el, target, duration) {
   let start = 0, step = target / (duration / 16);
   const tick = () => {
      start = Math.min(start + step, target);
      el.textContent = Math.floor(start) + (start >= target ? el.dataset.suffix || '' : '');
      if (start < target) requestAnimationFrame(tick);
   };
   requestAnimationFrame(tick);
}
const counterObs = new IntersectionObserver(entries => {
   entries.forEach(e => {
      if (e.isIntersecting) {
         countUp(e.target, +e.target.dataset.count, 900);
         counterObs.unobserve(e.target);
      }
   });
}, { threshold: 0.5 });
document.querySelectorAll('[data-count]').forEach(el => counterObs.observe(el));

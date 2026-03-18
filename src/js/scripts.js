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
      if (d2 < 7744) {
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

// pause particles when tab is hidden
let particlesRunning = true;
function particleLoop() {
   if (!particlesRunning) return;
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
   requestAnimationFrame(particleLoop);
}
particleLoop();

document.addEventListener('visibilitychange', () => {
   if (document.hidden) { particlesRunning = false; }
   else { particlesRunning = true; particleLoop(); }
});

// ── CURSOR ──────────────────────────────────────
if (!isMobile) {
   const cur = document.getElementById('cursor'), ring = document.getElementById('cursor-ring');
   let mx = 0, my = 0, rx = 0, ry = 0, cursorIdle = 0;
   document.addEventListener('mousemove', e => {
      mx = e.clientX; my = e.clientY;
      cur.style.left = mx + 'px'; cur.style.top = my + 'px';
      cursorIdle = 0;
   });
   (function ar() {
      rx += (mx - rx) * .12; ry += (my - ry) * .12;
      ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
      cursorIdle++;
      if (cursorIdle < 120) requestAnimationFrame(ar);
      else { ring.style.left = mx + 'px'; ring.style.top = my + 'px'; }
   })();
   document.addEventListener('mousemove', () => {
      if (cursorIdle >= 120) { cursorIdle = 0; (function ar() { rx += (mx - rx) * .12; ry += (my - ry) * .12; ring.style.left = rx + 'px'; ring.style.top = ry + 'px'; cursorIdle++; if (cursorIdle < 120) requestAnimationFrame(ar); })(); }
   });
}

// ── SINGLE SCROLL HANDLER ───────────────────────
const bar = document.getElementById('progress-bar');
const heroInner = document.querySelector('.hero-inner');
const casesSection = document.getElementById('cases');
const caseCards = document.querySelectorAll('.case-card');
const headerEl = document.querySelector('header');
const bioPhoto = document.querySelector('.bio-photo');
const heroBadges = document.querySelectorAll('.hero-badge');

let prevSY = 0, lastScrollY2 = 0, headerHidden = false, scrollTicking = false;

window.addEventListener('scroll', () => {
   if (scrollTicking) return;
   requestAnimationFrame(() => {
      const sy = window.scrollY;
      const docH = document.body.scrollHeight - window.innerHeight;

      // progress bar
      bar.style.width = (sy / docH * 100) + '%';

      // hero parallax + fade
      if (heroInner) {
         heroInner.style.transform = `translateY(${sy * 0.32}px)`;
         heroInner.style.opacity = Math.max(0, 1 - sy / 400).toFixed(3);
      }

      // header hide/show
      const delta = sy - lastScrollY2;
      if (sy > 120 && delta > 8 && !headerHidden) {
         headerEl.classList.add('hdr-hidden'); headerHidden = true;
      } else if (delta < -5 && headerHidden) {
         headerEl.classList.remove('hdr-hidden'); headerHidden = false;
      }
      if (sy > 10) headerEl.classList.add('hdr-shadow');
      else headerEl.classList.remove('hdr-shadow');
      lastScrollY2 = sy;

      // case cards parallax depth
      if (casesSection) {
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
      }

      // section bar skew on velocity
      const vel = sy - prevSY;
      prevSY = sy;
      document.querySelectorAll('.section-bar.visible').forEach(b => {
         b.style.transform = `scaleY(1) skewY(${Math.max(-4, Math.min(4, vel * 0.15))}deg)`;
         clearTimeout(b._tiltTimer);
         b._tiltTimer = setTimeout(() => { b.style.transform = 'scaleY(1)'; }, 180);
      });

      // about photo parallax
      if (bioPhoto && !isMobile) {
         const rect = bioPhoto.getBoundingClientRect();
         const center = rect.top + rect.height / 2;
         const offset = (center - window.innerHeight / 2) * 0.06;
         bioPhoto.style.transform = `translateY(${offset}px)`;
      }

      scrollTicking = false;
   });
   scrollTicking = true;
}, { passive: true });

// ── UNIFIED INTERSECTION OBSERVER ───────────────
const revealObs = new IntersectionObserver(entries => {
   entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;

      // section bar
      if (el.classList.contains('section-bar')) {
         el.classList.add('visible');
         revealObs.unobserve(el);
         return;
      }

      // timeline items
      if (el.classList.contains('tl-item')) {
         el.classList.add('visible');
         revealObs.unobserve(el);
         return;
      }

      // skills cascade
      if (el.classList.contains('skills-row')) {
         el.querySelectorAll('.skill-pill').forEach((p, i) => {
            setTimeout(() => p.classList.add('anim-in'), i * 50);
         });
         revealObs.unobserve(el);
         return;
      }

      // timeline line draw
      if (el.classList.contains('timeline')) {
         el.classList.add('line-drawn');
         revealObs.unobserve(el);
         return;
      }

      // hero badges
      if (el.classList.contains('hero-badges')) {
         heroBadges.forEach((b, i) => {
            setTimeout(() => b.classList.add('anim-in'), 200 + i * 120);
         });
         revealObs.unobserve(el);
         return;
      }

      // case cards grid
      if (el.classList.contains('cases-grid')) {
         el.querySelectorAll('.case-card').forEach((c, i) => {
            setTimeout(() => c.classList.add('card-visible'), i * 180);
         });
         revealObs.unobserve(el);
         return;
      }

      // section head scramble
      if (el.classList.contains('section-head')) {
         const h2 = el.querySelector('h2');
         if (h2 && !h2.dataset.scrambled) {
            h2.dataset.scrambled = '1';
            new TextScramble(h2).setText(h2.textContent.trim());
         }
         revealObs.unobserve(el);
         return;
      }

      // footer
      if (el.tagName === 'FOOTER') {
         el.classList.add('visible');
         revealObs.unobserve(el);
         return;
      }

      // counter
      if (el.dataset.count) {
         countUp(el, +el.dataset.count, 900);
         revealObs.unobserve(el);
         return;
      }

      // default reveal
      el.classList.add('visible');
      revealObs.unobserve(el);
   });
}, { threshold: 0.1 });

// register all elements
document.querySelectorAll(
   '.reveal,.stagger,.reveal-blur,.reveal-scale,.reveal-left,.reveal-right,.reveal-rotate,.reveal-clip,.reveal-pop,.section-divider,' +
   '.section-bar,.tl-item,.skills-row,.timeline,.hero-badges,.cases-grid,.section-head,[data-count],footer'
).forEach((el, i) => {
   // stagger delays for timeline items
   if (el.classList.contains('tl-item')) el.style.transitionDelay = `${i * 0.08}s`;
   revealObs.observe(el);
});

// fix tl-item delay (re-index properly)
document.querySelectorAll('.tl-item').forEach((el, i) => {
   el.style.transitionDelay = `${i * 0.08}s`;
});

// timeline tags stagger
document.querySelectorAll('.tl-item').forEach(item => {
   item.querySelectorAll('.tl-tag').forEach((tag, i) => {
      tag.style.transitionDelay = `${0.3 + i * 0.06}s`;
   });
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
if (!isMobile) {
   document.querySelectorAll('.case-card').forEach(el => {
      el.addEventListener('mousemove', e => {
         const r = el.getBoundingClientRect();
         const x = (e.clientX - r.left) / r.width - .5;
         const y = (e.clientY - r.top) / r.height - .5;
         el.style.transform = `translateY(-7px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`;
         el.style.transition = 'transform .05s';
      });
      el.addEventListener('mouseleave', () => {
         el.style.transform = ''; el.style.transition = 'transform .35s ease';
      });
   });
}

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

// ── COUNTER ─────────────────────────────────────
function countUp(el, target, duration) {
   let start = 0, step = target / (duration / 16);
   const tick = () => {
      start = Math.min(start + step, target);
      el.textContent = Math.floor(start) + (start >= target ? el.dataset.suffix || '' : '');
      if (start < target) requestAnimationFrame(tick);
   };
   requestAnimationFrame(tick);
}

// ── MAGNETIC EFFECT ──────────────────────────────
if (!isMobile) {
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
}

// ── WORD REVEAL ──────────────────────────────────
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

// ── CARD GLARE ───────────────────────────────────
if (!isMobile) {
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
}

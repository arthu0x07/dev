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
      this.a = Math.random() * .2 + .4;
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
   // add text element for "view" label
   const curText = document.createElement('span');
   curText.className = 'cursor-text';
   curText.textContent = 'view';
   ring.appendChild(curText);

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

   // reactive cursor: grow on links/buttons, "view" on case cards
   function setCursorState(state) {
      cur.className = state ? 'cursor-' + state : '';
      ring.className = state ? 'cursor-' + state : '';
   }
   document.addEventListener('mouseover', e => {
      const el = e.target.closest('.case-card');
      if (el) { setCursorState('card'); return; }
      if (e.target.closest('a, button, .btn-primary, .skill-pill, .theme-toggle, .lang-toggle, .social-row a, .logo')) {
         setCursorState('hover'); return;
      }
      setCursorState(null);
   });
}

// ── NAV ACTIVE HELPER ────────────────────────────
const navLinks = document.querySelectorAll('.side-nav a');
function setActiveNav(href) {
   navLinks.forEach(l => l.classList.remove('active'));
   const match = document.querySelector(`.side-nav a[href="${href}"]`);
   if (match) match.classList.add('active');
}

// ── SINGLE SCROLL HANDLER ───────────────────────
const bar = document.getElementById('progress-bar');
const heroInner = document.querySelector('.hero-inner');
const casesSection = document.getElementById('cases');
const caseCards = document.querySelectorAll('.case-card');
const headerEl = document.querySelector('header');
const bioPhoto = document.querySelector('.bio-photo');
const heroBadges = document.querySelectorAll('.hero-badge');
const backToTop = document.getElementById('back-to-top');

let prevSY = 0, lastScrollY2 = 0, headerHidden = false, scrollTicking = false;

backToTop.addEventListener('click', () => {
   window.scrollTo({ top: 0, behavior: 'smooth' });
});

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

      // back to top
      if (sy > 600) backToTop.classList.add('visible');
      else backToTop.classList.remove('visible');

      // set "home" active when near top
      if (sy < 200) setActiveNav('#inicio');

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

      // counter (stat-number and data-count elements)
      if (el.dataset.count && !el.dataset.counted) {
         el.dataset.counted = '1';
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
   '.section-bar,.tl-item,.skills-row,.timeline,.hero-badges,.cases-grid,.section-head,[data-count],.stat-number,footer'
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

// ── ACTIVE NAV (observer) ────────────────────────
const secObs = new IntersectionObserver(entries => {
   entries.forEach(e => {
      if (e.isIntersecting) {
         navLinks.forEach(l => l.classList.remove('active'));
         const l = document.querySelector(`.side-nav a[href="#${e.target.id}"]`);
         if (l) l.classList.add('active');
      }
   });
}, { rootMargin: '-30% 0px -60% 0px' });
['inicio', 'cases', 'experiencia', 'sobre', 'contato'].forEach(id => {
   const el = document.getElementById(id);
   if (el) secObs.observe(el);
});

// fix nav clicks: show header, set active, handle #inicio
navLinks.forEach(link => {
   link.addEventListener('click', e => {
      const href = link.getAttribute('href');
      if (href === '#inicio') {
         e.preventDefault();
         window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      setActiveNav(href);
      headerEl.classList.remove('hdr-hidden');
      headerHidden = false;
   });
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
let roles = [
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

// ── TEXT SPLIT (hero subtitle) ───────────────────
const heroSub = document.querySelector('.hero-sub');
function splitText(el) {
   const text = el.textContent;
   el.dataset.original = text;
   el.innerHTML = text.split('').map(function (ch, i) {
      if (ch === ' ') return '<span class="char" style="transition-delay:' + (i * 18) + 'ms">&nbsp;</span>';
      return '<span class="char" style="transition-delay:' + (i * 18) + 'ms">' + ch + '</span>';
   }).join('');
}
if (heroSub) splitText(heroSub);

// ── LOADER + PAGE ENTRY ──────────────────────────
const loader = document.getElementById('loader');
window.addEventListener('load', () => {
   setTimeout(() => {
      loader.classList.add('done');
      document.querySelector('.page').classList.add('page-enter');
      // trigger text split animation after entry
      setTimeout(function () {
         if (heroSub) heroSub.classList.add('split-done');
      }, 350);
   }, 800);
});

// ── DARK MODE ────────────────────────────────────
const themeToggle = document.getElementById('theme-toggle');
const html = document.documentElement;
html.setAttribute('data-theme', 'dark');

themeToggle.addEventListener('click', () => {
   const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
   html.setAttribute('data-theme', next);
   localStorage.setItem('theme', next);
});

// ── CASE MODAL ───────────────────────────────────
const modalData = {
   moss: {
      tag: 'GreenTech · Fintech',
      title: 'Moss.Earth — Carbon Credit Platform',
      period: 'Jan 2021 – Nov 2021 · Montevideo, UY (Remote)',
      body: `<h3>The Challenge</h3>
<p>Build a B2B platform for carbon credit trading and token control, improving transparency in environmental transactions.</p>
<h3>What I Built</h3>
<ul>
<li>Advanced area-calculation tool integrating real-time maps and government data</li>
<li>Optimised Amazon preservation analysis workflows</li>
<li>Interactive dashboards for carbon credit tracking</li>
</ul>
<h3>Impact</h3>
<p>Significantly reduced field work time for preservation analysis — enabling faster decision-making for environmental projects.</p>`,
      stack: ['React.js', 'TypeScript', 'Maps API', 'Node.js']
   },
   sirio: {
      tag: 'HealthTech · Enterprise',
      title: 'Hospital Sírio-Libanês — Electronic Medical Record',
      period: 'Jan 2022 – Jun 2024 · São Paulo (Remote)',
      body: `<h3>The Challenge</h3>
<p>Build a complex web platform enabling doctors to schedule exams, prescribe medication and book surgeries at one of Brazil's top hospitals.</p>
<h3>What I Built</h3>
<ul>
<li>Full electronic medical record web platform</li>
<li>Mobile version using React Native</li>
<li>AI-powered voice transcription tool for surgical documentation</li>
<li>Started with university portal (Cruzeiro do Sul) using React + Gatsby</li>
</ul>
<h3>Impact</h3>
<p>Digitised critical medical workflows for a major hospital, improving doctor efficiency and patient record accuracy.</p>`,
      stack: ['React.js', 'React Native', 'TypeScript', 'Gatsby', 'GraphQL', 'Docker', 'AWS', 'Styled-components', 'Jest']
   },
   eumedico: {
      tag: 'HealthTech · SaaS',
      title: 'Eu Médico Residente — Medical Residency Platform',
      period: 'Jun 2024 – Oct 2025 · Recife (Remote)',
      body: `<h3>The Challenge</h3>
<p>Build and scale a SaaS platform for medical residency preparation, handling complex server-side logic and multiple client applications.</p>
<h3>What I Built</h3>
<ul>
<li>Server-side logic with NestJS + Clean Architecture</li>
<li>API integrations and optimised UIs across web and mobile</li>
<li>Automated test suites ensuring quality and security</li>
<li>Supported team through code reviews and pair programming</li>
</ul>
<h3>Impact</h3>
<p>Applied Clean Architecture concepts across multiple projects, improving codebase maintainability and team velocity.</p>`,
      stack: ['NestJS', 'React', 'React Native', 'Next.js', 'TypeScript', 'PostgreSQL', 'AWS', 'Prisma', 'GraphQL', 'Tailwind', 'Jest']
   },
   zig: {
      tag: 'Fintech · Payments',
      title: 'Zig / Cubos — Table Management & Payments',
      period: 'Jun 2025 – present · Remote',
      body: `<h3>The Challenge</h3>
<p>Develop and maintain a table management system used at large events and establishments, handling real-time payments at scale.</p>
<h3>What I Built</h3>
<ul>
<li>Real-time payment sessions and bill splitting flows</li>
<li>Payment gateway integration with offline-first processing</li>
<li>Monitoring and production issue resolution</li>
<li>Mentoring new team members through code reviews</li>
</ul>
<h3>Impact</h3>
<p>Guaranteed operations without connectivity through offline-first architecture, critical for large events with unreliable networks.</p>`,
      stack: ['TypeScript', 'Node.js', 'React.js', 'PostgreSQL', 'Redis', 'Docker', 'Kubernetes', 'Jest', 'GitLab']
   }
};

const overlay = document.getElementById('modal-overlay');
const modalClose = document.getElementById('modal-close');

document.querySelectorAll('.case-card[data-modal]').forEach(card => {
   card.addEventListener('click', () => {
      const key = card.dataset.modal;
      const d = modalData[key];
      if (!d) return;
      document.getElementById('modal-tag').textContent = d.tag;
      document.getElementById('modal-title').textContent = d.title;
      document.getElementById('modal-period').textContent = d.period;
      document.getElementById('modal-body').innerHTML = d.body;
      document.getElementById('modal-stack').innerHTML = d.stack.map(s => `<span>${s}</span>`).join('');
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
   });
});

function closeModal() {
   overlay.classList.remove('open');
   document.body.style.overflow = '';
}
modalClose.addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });


// ── i18n TRANSLATION SYSTEM ─────────────────────
const i18n = {
   en: {
      'nav.home': 'home', 'nav.cases': 'cases', 'nav.work': 'work', 'nav.about': 'about', 'nav.contact': 'contact',
      'header.service': 'freelance service', 'header.status': 'open to work',
      'hero.sub': 'Full-Stack Engineer · 4+ years · Rio de Janeiro → worldwide',
      'strip.label': 'Trusted by',
      'cases.title': 'clients & cases', 'cases.kicker': 'Selected work', 'cases.cta': 'View details →',
      'cases.sirio.title': 'Electronic Medical Record', 'cases.sirio.period': '2022–2024 · São Paulo (Remote)',
      'cases.eumedico.title': 'Medical Residency Platform', 'cases.eumedico.period': '2024–2025 · Recife (Remote)',
      'cases.zig.title': 'Table Management & Payments', 'cases.zig.period': '2025–present · Remote',
      'stats.years': 'Years of experience', 'stats.companies': 'Companies', 'stats.industries': 'Industries', 'stats.techs': 'Technologies',
      'exp.title': 'work experience',
      'about.title': 'about me', 'about.headline': 'Software Engineer · Full-Stack Developer',
      'about.desc': "Full-stack developer with 4+ years of professional experience shipping real products across healthtech, greentech and fintech. I'm obsessive about clean code, intuitive interfaces and performance — from robust NestJS APIs to pixel-perfect React UIs. Based in Rio de Janeiro, working remotely with teams worldwide.",
      'about.award_html': '<strong>Guardião da Performance</strong> — recognised by 1STi in Sep 2023 for excellence, consistency and technical mastery across projects.',
      'contact.heading': "Let's build something great.",
      'contact.sub': 'Open to freelance, full-time roles and interesting collabs.',
      'contact.btn': 'Send a message',
      'footer.copy_html': 'coding by <strong>me</strong> · Rio de Janeiro · 2026',
   },
   pt: {
      'nav.home': 'início', 'nav.cases': 'cases', 'nav.work': 'experiência', 'nav.about': 'sobre', 'nav.contact': 'contato',
      'header.service': 'freelance', 'header.status': 'disponível',
      'hero.sub': 'Engenheiro Full-Stack · 4+ anos · Rio de Janeiro → mundo',
      'strip.label': 'Empresas',
      'cases.title': 'clientes & cases', 'cases.kicker': 'Trabalhos selecionados', 'cases.cta': 'Ver detalhes →',
      'cases.sirio.title': 'Prontuário Eletrônico', 'cases.sirio.period': '2022–2024 · São Paulo (Remoto)',
      'cases.eumedico.title': 'Plataforma de Residência Médica', 'cases.eumedico.period': '2024–2025 · Recife (Remoto)',
      'cases.zig.title': 'Gestão de Mesas & Pagamentos', 'cases.zig.period': '2025–atual · Remoto',
      'stats.years': 'Anos de experiência', 'stats.companies': 'Empresas', 'stats.industries': 'Indústrias', 'stats.techs': 'Tecnologias',
      'exp.title': 'experiência profissional',
      'about.title': 'sobre mim', 'about.headline': 'Engenheiro de Software · Desenvolvedor Full-Stack',
      'about.desc': 'Desenvolvedor full-stack com 4+ anos de experiência profissional entregando produtos reais em healthtech, greentech e fintech. Sou obcecado por código limpo, interfaces intuitivas e performance — de APIs robustas com NestJS a interfaces pixel-perfect com React. Baseado no Rio de Janeiro, trabalhando remotamente com equipes do mundo todo.',
      'about.award_html': '<strong>Guardião da Performance</strong> — reconhecido pela 1STi em Set 2023 por excelência, consistência e domínio técnico em projetos.',
      'contact.heading': 'Vamos construir algo incrível.',
      'contact.sub': 'Aberto a freelance, vagas CLT e colaborações interessantes.',
      'contact.btn': 'Enviar mensagem',
      'footer.copy_html': 'feito por <strong>mim</strong> · Rio de Janeiro · 2026',
   }
};

const modalDataPt = {
   moss: {
      tag: 'GreenTech · Fintech',
      title: 'Moss.Earth — Plataforma de Crédito de Carbono',
      period: 'Jan 2021 – Nov 2021 · Montevidéu, UY (Remoto)',
      body: `<h3>O Desafio</h3>
<p>Construir uma plataforma B2B para negociação de créditos de carbono e controle de tokens, melhorando a transparência em transações ambientais.</p>
<h3>O que Construí</h3>
<ul>
<li>Ferramenta avançada de cálculo de área integrando mapas em tempo real e dados governamentais</li>
<li>Otimização dos fluxos de análise de preservação amazônica</li>
<li>Dashboards interativos para rastreamento de créditos de carbono</li>
</ul>
<h3>Impacto</h3>
<p>Reduziu significativamente o tempo de trabalho de campo para análise de preservação — permitindo decisões mais rápidas para projetos ambientais.</p>`,
      stack: modalData.moss.stack
   },
   sirio: {
      tag: 'HealthTech · Enterprise',
      title: 'Hospital Sírio-Libanês — Prontuário Eletrônico',
      period: 'Jan 2022 – Jun 2024 · São Paulo (Remoto)',
      body: `<h3>O Desafio</h3>
<p>Construir uma plataforma web complexa permitindo que médicos agendem exames, prescrevam medicamentos e marquem cirurgias em um dos maiores hospitais do Brasil.</p>
<h3>O que Construí</h3>
<ul>
<li>Plataforma web completa de prontuário eletrônico</li>
<li>Versão mobile usando React Native</li>
<li>Ferramenta de transcrição de voz com IA para documentação cirúrgica</li>
<li>Iniciei com portal universitário (Cruzeiro do Sul) usando React + Gatsby</li>
</ul>
<h3>Impacto</h3>
<p>Digitalizou fluxos médicos críticos para um hospital de referência, melhorando a eficiência dos médicos e a precisão dos registros.</p>`,
      stack: modalData.sirio.stack
   },
   eumedico: {
      tag: 'HealthTech · SaaS',
      title: 'Eu Médico Residente — Plataforma de Residência Médica',
      period: 'Jun 2024 – Out 2025 · Recife (Remoto)',
      body: `<h3>O Desafio</h3>
<p>Construir e escalar uma plataforma SaaS para preparação de residência médica, lidando com lógica server-side complexa e múltiplas aplicações.</p>
<h3>O que Construí</h3>
<ul>
<li>Lógica server-side com NestJS + Clean Architecture</li>
<li>Integrações de API e UIs otimizadas em web e mobile</li>
<li>Suítes de testes automatizados garantindo qualidade e segurança</li>
<li>Suporte à equipe através de code reviews e pair programming</li>
</ul>
<h3>Impacto</h3>
<p>Aplicou conceitos de Clean Architecture em múltiplos projetos, melhorando a manutenibilidade e velocidade da equipe.</p>`,
      stack: modalData.eumedico.stack
   },
   zig: {
      tag: 'Fintech · Pagamentos',
      title: 'Zig / Cubos — Gestão de Mesas & Pagamentos',
      period: 'Jun 2025 – atual · Remoto',
      body: `<h3>O Desafio</h3>
<p>Desenvolver e manter um sistema de gestão de mesas usado em grandes eventos e estabelecimentos, processando pagamentos em tempo real em escala.</p>
<h3>O que Construí</h3>
<ul>
<li>Sessões de pagamento em tempo real e fluxos de divisão de conta</li>
<li>Integração com gateway de pagamento e processamento offline-first</li>
<li>Monitoramento e resolução de incidentes em produção</li>
<li>Mentoria de novos membros da equipe através de code reviews</li>
</ul>
<h3>Impacto</h3>
<p>Garantiu operações sem conectividade através de arquitetura offline-first, crítico para grandes eventos com redes instáveis.</p>`,
      stack: modalData.zig.stack
   }
};

const rolesEn = [
   'front-end.web(developer)',
   'back-end.api(engineer)',
   'full-stack.dev(builder)',
   'mobile.app(developer)',
];
const rolesPt = [
   'front-end.web(desenvolvedor)',
   'back-end.api(engenheiro)',
   'full-stack.dev(construtor)',
   'mobile.app(desenvolvedor)',
];
const langToggle = document.getElementById('lang-toggle');
let currentLang = localStorage.getItem('lang') || 'en';

function applyLang(lang) {
   currentLang = lang;
   const t = i18n[lang];
   document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (!t[key]) return;
      if (key.endsWith('_html')) {
         el.innerHTML = t[key];
      } else {
         if (el.classList.contains('reveal-words')) {
            el.innerHTML = t[key].split(' ').map(w =>
               `<span class="word-wrap"><span class="word in">${w}</span></span>`
            ).join(' ');
         } else if (el === heroSub) {
            el.textContent = t[key];
            splitText(el);
            el.classList.add('split-done');
         } else {
            el.textContent = t[key];
         }
      }
   });
   // flag visibility is handled by CSS via [lang] attribute
   // update html lang
   document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';
   // swap typing roles
   roles.length = 0;
   roles.push(...(lang === 'en' ? rolesEn : rolesPt));
   localStorage.setItem('lang', lang);
}

langToggle.addEventListener('click', () => {
   applyLang(currentLang === 'en' ? 'pt' : 'en');
});

// apply saved lang on load
applyLang(currentLang);

// override modal open to use current lang
document.querySelectorAll('.case-card[data-modal]').forEach(card => {
   card.addEventListener('click', () => {
      const key = card.dataset.modal;
      const d = currentLang === 'pt' ? modalDataPt[key] : modalData[key];
      if (!d) return;
      document.getElementById('modal-tag').textContent = d.tag;
      document.getElementById('modal-title').textContent = d.title;
      document.getElementById('modal-period').textContent = d.period;
      document.getElementById('modal-body').innerHTML = d.body;
      document.getElementById('modal-stack').innerHTML = d.stack.map(s => `<span>${s}</span>`).join('');
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
   });
});

// ── CYBER MODE TRIGGER ──────────────────────────
let cyberInput = '';
document.addEventListener('keydown', (e) => {
   cyberInput += e.key.toLowerCase();
   if (cyberInput.endsWith('cyber')) {
      triggerCyberMode();
      cyberInput = '';
   }
   if (cyberInput.length > 10) cyberInput = cyberInput.slice(-10);
});

// ── CYBER MODE TRIGGER (Header Logo - Long Press 5s) ──
let cyberPressTimer;
const mainLogo = document.querySelector('.logo');
if (mainLogo) {
   mainLogo.style.cursor = 'pointer';
   mainLogo.style.transition = 'transform 5s linear, color 0.5s, letter-spacing 0.3s';

   const startPress = () => {
      // Start scaling very slowly over 5s
      mainLogo.style.transform = 'scale(1.2)';
      mainLogo.style.color = 'var(--gray)'; // Subtle hint from palette

      cyberPressTimer = setTimeout(() => {
         mainLogo.style.color = 'var(--black)'; // Final state
         triggerCyberMode();
         cancelPress();
      }, 5000); // 5 second hold
   };

   const cancelPress = () => {
      clearTimeout(cyberPressTimer);
      mainLogo.style.transform = 'scale(1)';
      mainLogo.style.color = '';
   };

   mainLogo.addEventListener('mousedown', startPress);
   mainLogo.addEventListener('mouseup', cancelPress);
   mainLogo.addEventListener('mouseleave', cancelPress);

   // Touch support
   mainLogo.addEventListener('touchstart', (e) => { e.preventDefault(); startPress(); });
   mainLogo.addEventListener('touchend', cancelPress);
}

// CyberMode is now exclusively triggered by a 5-second long press on the header logo.

function triggerCyberMode() {
   console.log('Triggering Cyber Mode...');
   if (window.CyberMode && (window.CyberMode.overlay || window.CyberMode.terminal)) {
      window.CyberMode.toggle();
      return;
   }
   const l = document.createElement('link');
   l.rel = 'stylesheet'; l.href = 'css/cyber.css';
   document.head.appendChild(l);

   const s = document.createElement('script');
   s.src = 'js/cyber.js';
   s.onload = () => { if (window.CyberMode) window.CyberMode.init(); };
   document.body.appendChild(s);
}

// ── PARTY MODE (existing footer logo click) ──────
(function () {
   const fLogo = document.getElementById('f-logo');
   if (!fLogo) return;
   let active = false;
   fLogo.addEventListener('click', () => {
      if (active) return;
      active = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;z-index:99998;pointer-events:none;background:linear-gradient(135deg,rgba(255,0,0,.1),rgba(255,165,0,.1),rgba(255,255,0,.1),rgba(0,128,0,.1),rgba(0,0,255,.1),rgba(75,0,130,.1),rgba(238,130,238,.1));animation:eggRainbow 3s linear infinite;mix-blend-mode:overlay;';
      document.body.appendChild(ov);
      const style = document.createElement('style');
      style.textContent = '@keyframes eggRainbow{0%{filter:hue-rotate(0deg)}100%{filter:hue-rotate(360deg)}}' +
         '#particles-canvas{filter:invert(1) hue-rotate(0deg)!important;animation:eggRainbow 2s linear infinite!important;opacity:1!important;}' +
         '.hero-title{animation:eggRainbow 1.5s linear infinite!important;}' +
         '.skill-pill{animation:eggRainbow 2s linear infinite!important; animation-delay:calc(var(--i,0)*.1s)!important;}' +
         '.case-card .case-bg{animation:eggRainbow 3s linear infinite!important;}' +
         '.logo,.f-logo{animation:eggRainbow 1s linear infinite!important;}';
      document.head.appendChild(style);
      document.querySelectorAll('.skill-pill').forEach((p, i) => p.style.setProperty('--i', i));
      setTimeout(() => { ov.remove(); style.remove(); active = false; }, 15000);
   });
})();

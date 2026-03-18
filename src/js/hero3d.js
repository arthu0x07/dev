(function () {
   if (typeof THREE === 'undefined') return;

   const canvas = document.getElementById('hero-3d');
   if (!canvas) return;

   const mobile = window.innerWidth < 768;
   const hero = canvas.closest('.hero');

   // ── RENDERER ──
   const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
   renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

   // ── SCENE & CAMERA ──
   const scene = new THREE.Scene();
   const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
   camera.position.set(0, 3.5, 4.5);
   camera.lookAt(0, -0.5, 0);

   // ── PLANE GEOMETRY ──
   const segs = mobile ? 60 : 120;
   const geo = new THREE.PlaneGeometry(8, 8, segs, segs);
   geo.rotateX(-Math.PI / 2);

   // ── SHADER MATERIAL (all animation on GPU) ──
   const mat = new THREE.ShaderMaterial({
      uniforms: {
         uTime: { value: 0 },
         uMouse: { value: new THREE.Vector2(0, 0) },
         uScroll: { value: 0 },
      },
      vertexShader: /* glsl */ `
         uniform float uTime;
         uniform vec2 uMouse;
         uniform float uScroll;
         varying float vHeight;
         varying float vDist;

         void main() {
            vec3 pos = position;

            // layered waves
            float t = uTime * 0.4;
            float wave1 = sin(pos.x * 0.8 + t) * cos(pos.z * 0.6 + t * 0.7) * 0.35;
            float wave2 = sin(pos.x * 1.6 + pos.z * 1.2 + t * 1.3) * 0.15;
            float wave3 = cos(pos.x * 2.4 - pos.z * 0.8 + t * 0.9) * 0.08;

            // mouse influence (gentle push)
            float mx = uMouse.x * 4.0;
            float mz = uMouse.y * -4.0;
            float mouseDist = length(vec2(pos.x - mx, pos.z - mz));
            float mouseWave = exp(-mouseDist * 0.5) * 0.25;

            pos.y = wave1 + wave2 + wave3 + mouseWave;

            // scroll stretches the waves slightly
            pos.y *= 1.0 + uScroll * 0.3;

            vHeight = pos.y;
            vDist = length(pos.xz);

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
         }
      `,
      fragmentShader: /* glsl */ `
         varying float vHeight;
         varying float vDist;

         void main() {
            // height-based gradient: dark valleys, lighter peaks
            float h = smoothstep(-0.3, 0.5, vHeight);

            // radial fade (edges fade out)
            float fade = 1.0 - smoothstep(2.0, 4.2, vDist);

            // base: very subtle dark lines on transparent
            vec3 color = mix(vec3(0.0), vec3(0.2), h);

            float alpha = fade * (0.07 + h * 0.1);

            gl_FragColor = vec4(color, alpha);
         }
      `,
      transparent: true,
      wireframe: true,
      depthWrite: false,
   });

   const mesh = new THREE.Mesh(geo, mat);
   scene.add(mesh);

   // ── MOUSE ──
   let mxT = 0, myT = 0;
   const mouseUni = mat.uniforms.uMouse.value;
   if (!mobile) {
      window.addEventListener('mousemove', e => {
         mxT = (e.clientX / window.innerWidth) * 2 - 1;
         myT = (e.clientY / window.innerHeight) * 2 - 1;
      });
   }

   // ── SIZING ──
   function resize() {
      const w = hero.clientWidth, h = hero.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
   }
   resize();
   new ResizeObserver(resize).observe(hero);

   // ── ANIMATION LOOP ──
   let running = true;

   function animate() {
      if (!running) return;
      requestAnimationFrame(animate);

      const rect = hero.getBoundingClientRect();
      if (rect.bottom < -50) return;

      const scrollProg = Math.max(0, Math.min(1.2, -rect.top / rect.height));

      // smooth mouse
      mouseUni.x += (mxT - mouseUni.x) * 0.03;
      mouseUni.y += (myT - mouseUni.y) * 0.03;

      // update uniforms
      mat.uniforms.uTime.value = performance.now() * 0.001;
      mat.uniforms.uScroll.value = scrollProg;

      // fade canvas on scroll
      canvas.style.opacity = Math.max(0, 1 - scrollProg * 1.2).toFixed(3);

      renderer.render(scene, camera);
   }

   animate();

   // pause/resume
   window.addEventListener('scroll', () => {
      const r = hero.getBoundingClientRect();
      if (r.bottom > 0 && !running) { running = true; animate(); }
      else if (r.bottom < -200 && running) { running = false; }
   }, { passive: true });
})();

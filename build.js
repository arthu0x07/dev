const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

async function build() {
   console.log('🚀 Starting build...');
   const start = Date.now();

   const distDir = path.join(__dirname, 'dist');
   if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);

   try {
      // 1. Minify JS
      await esbuild.build({
         entryPoints: [
            'src/js/scripts.js',
            'src/js/hero3d.js',
            'src/js/cyber.js'
         ],
         bundle: true,
         minify: true,
         sourcemap: false,
         outdir: 'dist/js',
         target: ['es2015'],
         logLevel: 'info',
      });

      // 2. Minify CSS
      await esbuild.build({
         entryPoints: [
            'src/css/styles.css',
            'src/css/cyber.css'
         ],
         bundle: true,
         minify: true,
         outdir: 'dist/css',
         logLevel: 'info',
      });

      // 3. Copy index.html to dist and update asset paths
      let indexHtml = fs.readFileSync('src/index.html', 'utf-8');
      const version = Date.now().toString().slice(-6);

      // 4. Inline Critical CSS (First 500 lines of styles.css or specific markers)
      const cssContent = fs.readFileSync('dist/css/styles.css', 'utf-8');
      // For simplicity, we'll inline the whole styles.css since it's only ~27KB (minified)
      // This removes one blocking request entirely!
      indexHtml = indexHtml.replace(/<link rel="stylesheet" href="css\/styles\.css.*?\/>/, `<style>${cssContent}</style>`);

      // 5. Update other asset paths with versioning
      indexHtml = indexHtml.replace(/src="js\/scripts\.js"/g, `src="js/scripts.js?v=${version}"`);
      indexHtml = indexHtml.replace(/href="css\/cyber\.css"/g, `href="css/cyber.css?v=${version}"`);

      fs.writeFileSync('dist/index.html', indexHtml);

      console.log(`✅ Build finished in ${Date.now() - start}ms (CSS Inlined)`);
   } catch (e) {
      console.error('❌ Build failed:', e);
      process.exit(1);
   }
}

build();

// 通用构建产物内联脚本
// 用法: node inline-build.mjs <sourceDir> <outputFile>
// 例:  node ../scripts/inline-build.mjs . ../bowling.html   (working-directory=bowling-src)
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const [srcDir, outFile] = process.argv.slice(2);
if (!srcDir || !outFile) {
  console.error('用法: node inline-build.mjs <sourceDir> <outputFile>');
  process.exit(1);
}

const distDir = join(srcDir, 'dist');
let html = readFileSync(join(distDir, 'index.html'), 'utf8');

// 内联 CSS(若有)
for (const f of readdirSync(join(distDir, 'assets')).filter((f) => f.endsWith('.css'))) {
  const css = readFileSync(join(distDir, 'assets', f), 'utf8');
  const linkRe = /<link[^>]*rel="stylesheet"[^>]*href="[^"]*"[^>]*>/;
  if (!linkRe.test(html)) throw new Error(`未找到 CSS link(${f})`);
  html = html.replace(linkRe, () => `<style>\n${css}\n</style>`);
  console.log(`  ✓ 内联 css: ${f}`);
}

// 内联所有 module script(保持顺序)
const scriptRe = /<script[^>]*type="module"[^>]*src="([^"]*)"[^>]*>\s*<\/script>/g;
let m;
let count = 0;
while ((m = scriptRe.exec(html))) {
  const fname = m[1].split('/').pop();
  const path = join(distDir, 'assets', fname);
  if (!existsSync(path)) throw new Error(`未找到 chunk: ${path}`);
  // 防 </script> 与 <!-- 截断内联
  const js = readFileSync(path, 'utf8')
    .replace(/<\/script>/g, '<\\/script>')
    .replace(/<!--/g, '<\\!--');
  html = html.replace(m[0], () => `<script type="module">\n${js}\n</script>`);
  count++;
  console.log(`  ✓ 内联 js: ${fname}`);
}
if (count === 0) throw new Error('未找到任何 module script');

if (/src="[^"]*\.js"/.test(html) || /href="[^"]*\.css"/.test(html)) {
  throw new Error('产物仍有外部 js/css 引用,内联不完整');
}

writeFileSync(outFile, html);
console.log(`✓ ${outFile} (${(html.length / 1024).toFixed(1)} KB)`);

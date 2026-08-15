// 通用 vendor 内联脚本(静态单文件项目用)
// 用法: node inline-vendor.mjs <sourceDir> <outputFile>
// 例:  node ../scripts/inline-vendor.mjs . ../stock-trading.html  (working-directory=stock-trading-src)
// 将 <script src="vendor/xxx.js"> 内联为 <script>...</script>
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const [srcDir, outFile] = process.argv.slice(2);
if (!srcDir || !outFile) {
  console.error('用法: node inline-vendor.mjs <sourceDir> <outputFile>');
  process.exit(1);
}

let html = readFileSync(join(srcDir, 'index.html'), 'utf8');
const re = /<script[^>]*src="(vendor\/[^"]+)"[^>]*>\s*<\/script>/g;
let m;
let count = 0;
while ((m = re.exec(html))) {
  const path = join(srcDir, m[1]);
  if (!existsSync(path)) throw new Error(`未找到 vendor 文件: ${path}`);
  const js = readFileSync(path, 'utf8')
    .replace(/<\/script>/g, '<\\/script>')
    .replace(/<!--/g, '<\\!--');
  html = html.replace(m[0], () => `<script>\n${js}\n</script>`);
  count++;
  console.log(`  ✓ 内联 vendor: ${m[1]}`);
}
if (count === 0) throw new Error('未找到任何 vendor script 引用');

writeFileSync(outFile, html);
console.log(`✓ ${outFile} (${(html.length / 1024).toFixed(1)} KB)`);

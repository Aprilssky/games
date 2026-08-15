# 🎳 保龄球(源码)

3D 物理保龄球游戏的 **Vite 源码**。线上运行的是构建产物 `../bowling.html`。

## 构建

```bash
npm install
npm run build        # 产物在 dist/
```

构建后把 `dist/index.html` 的 module script 内联进 HTML(见下),得到单文件 `bowling.html` 放入 games 根目录:

```bash
# 内联脚本(防 </script> 截断)
node -e "
const fs=require('fs'),re=require('path');
let html=fs.readFileSync('dist/index.html','utf8');
let js=fs.readFileSync(re.join('dist/assets',fs.readdirSync('dist/assets')[0]),'utf8')
  .replace(/<\/script>/g,'<\\\\/script>');
html=html.replace(/<script[^>]*type=\"module\"[^>]*src=\"[^\"]*\"[^>]*>\s*<\/script>/,
  '<script type=\"module\">\n'+js+'\n</script>');
fs.writeFileSync('bowling.html',html);
"
cp bowling.html ../bowling.html
```

## 技术栈

- [three.js](https://threejs.org/) — 3D 渲染
- [cannon-es](https://github.com/pmndrs/cannon-es) — 物理引擎
- [Vite](https://vitejs.dev/) — 构建工具

## 玩法

左右移动瞄准(青环=落点,红环=出界预警),按住下拉蓄力,释放投球。标准 10 局计分,第 10 局支持追加球。

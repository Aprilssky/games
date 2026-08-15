# 📈 模拟炒股(源码)

纯前端模拟炒股游戏:做多/做空、一分钟 K 线。线上运行 `../stock-trading.html`(单文件)。

## 结构

- `index.html` — 游戏本体(引用本地 `vendor/lightweight-charts.js`)
- `vendor/lightweight-charts.js` — TradingView Lightweight Charts v4.1.3(standalone,已本地化,不依赖 CDN)

## 构建产物

`../stock-trading.html` 由 `index.html` 内联 `vendor/` 中的库生成:

```bash
node ../scripts/inline-vendor.mjs . ../stock-trading.html
```

仓库根 `.github/workflows/build-games.yml` 会在本目录变更时自动重建产物。

import { defineConfig } from 'vite'

export default defineConfig({
  base: '/3d-dominoes/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        inlineDynamicImports: true,  // 单 chunk,便于内联成单文件
      },
    },
  },
})

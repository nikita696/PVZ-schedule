import { defineConfig } from 'vite';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './app'),
    },
  },
  build: {
    outDir: 'build',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('recharts')) return 'charts';
          if (id.includes('@radix-ui')) return 'radix';
          if (id.includes('@mui') || id.includes('@emotion')) return 'mui';
          if (id.includes('react-router')) return 'router';
          if (id.includes('lucide-react')) return 'icons';

          return 'vendor';
        },
      },
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
});

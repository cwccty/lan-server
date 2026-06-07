import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('react') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('@tauri-apps')) {
              return 'vendor-tauri';
            }
            if (id.includes('motion')) {
              return 'vendor-motion';
            }
            return 'vendor';
          }

          const normalizedId = id.replace(/\\/g, '/');

          if (normalizedId.includes('/src/product-ui/')) {
            if (normalizedId.endsWith('/ProductSolutionsView.tsx')) {
              return 'product-solutions-view';
            }
            if (normalizedId.endsWith('/ProductDiagnosticsView.tsx')) {
              return 'product-diagnostics-view';
            }
            if (normalizedId.endsWith('/ProductRecommendationView.tsx')) {
              return 'product-recommendation-view';
            }
            if (normalizedId.endsWith('/ProductAdvancedToolsView.tsx') || normalizedId.endsWith('/ProductNetworkView.tsx')) {
              return 'product-network-tools-view';
            }
            if (
              normalizedId.endsWith('/ProductHomeView.tsx') ||
              normalizedId.endsWith('/ProductGameScanView.tsx') ||
              normalizedId.endsWith('/ProductSettingsView.tsx') ||
              normalizedId.endsWith('/ProductTerrariaGuideView.tsx') ||
              normalizedId.endsWith('/ProductHeader.tsx') ||
              normalizedId.endsWith('/ProductSidebar.tsx')
            ) {
              return 'product-main-views';
            }
            return 'product-logic';
          }

          if (normalizedId.includes('/src/reference-adapter/')) {
            return 'reference-adapter';
          }
        }
      }
    }
  },
  server: {
    port: 1420,
    strictPort: true
  },
  envPrefix: ['VITE_', 'TAURI_']
});

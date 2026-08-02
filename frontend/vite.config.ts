import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8081,
    strictPort: false,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "react", test: /node_modules\/(react|react-dom|react-router-dom)\// },
            { name: "maps", test: /node_modules\/(leaflet|react-leaflet|@react-google-maps)\// },
            { name: "charts", test: /node_modules\/recharts\// },
            { name: "exports", test: /node_modules\/(jspdf|jspdf-autotable|docx|file-saver)\// },
            { name: "markdown", test: /node_modules\/(react-markdown|remark-gfm|rehype-highlight|rehype-sanitize)\// },
            { name: "ui", test: /node_modules\/(@radix-ui|framer-motion|lucide-react)\// },
          ],
        },
      },
    },
  },
}));

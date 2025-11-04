import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite configuration – Native Spirit Stock Checker
// Permet un lancement rapide et une build légère
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // Port par défaut (modifiable si besoin)
    open: true, // Ouvre automatiquement l'app dans le navigateur
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  preview: {
    port: 4173, // Port du mode preview
  },
});

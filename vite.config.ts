import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// Le intestazioni di sicurezza di produzione (vercel.json) vengono applicate anche a `npm run preview`,
// così da poterle provare in locale prima della pubblicazione
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf-8'));
const securityHeaders: Record<string, string> = Object.fromEntries(
  vercel.headers[0].headers.map((h: { key: string; value: string }) => [h.key, h.value])
);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Nessun file incorporato come "data:" nel CSS: la Content-Security-Policy ammette solo file del sito
  build: { assetsInlineLimit: 0 },
  preview: { headers: securityHeaders },
});

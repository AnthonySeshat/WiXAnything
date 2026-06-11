import { defineConfig } from 'astro/config';

// Minimal config. Static by default (Wix data fetched at build time).
// For request-time/SSR data, add a server adapter (e.g. @astrojs/node) and set
// `output: 'server'` — see SETUP.md.
export default defineConfig({});

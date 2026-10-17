import type { PrefValue } from "./user-js.js";

/**
 * Performance-tuning preferences catalog tailored for fast, low-overhead BiDi QA and testing.
 * Implements D1@1 (R1, R2, R3).
 *
 * Each pref entry documents its specific rationale:
 * - Deterministic settling: disables smooth scrolling, cosmetic animations and forces reduced motion.
 * - Suppress speculative network noise: disables DNS prefetch, link prefetch, speculative connect and predictor.
 * - Suppress non-essential background services: disables page thumbnail capturing, normandy pings, and ping-centre telemetry.
 */
export const PERFORMANCE_PREFS: Readonly<Record<string, PrefValue>> = {
  // Deterministic settling & CSS transitions elimination
  "general.smoothScroll": false,
  "toolkit.cosmeticAnimations.enabled": false,
  "ui.prefersReducedMotion": 1,

  // No speculative network noise that delays networkIdle detection
  "network.dns.disablePrefetch": true,
  "network.prefetch-next": false,
  "network.http.speculative-parallel-limit": 0,
  "network.predictor.enabled": false,
  "browser.urlbar.speculativeConnect.enabled": false,
  "browser.places.speculativeConnect.enabled": false,

  // Background work suppression
  "browser.pagethumbnails.capturing_disabled": true,
  "app.normandy.enabled": false,
  "browser.ping-centre.telemetry": false,
};

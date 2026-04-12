/**
 * OSCAR Service Worker
 *
 * Strategy:
 *   - App shell (JS/CSS/fonts): cache-first — fast repeat loads.
 *   - Navigation (HTML pages): network-first with offline fallback.
 *   - Supabase REST API (/rest/v1/notes, /rest/v1/meetings): stale-while-revalidate
 *     so notes are readable offline and update in the background.
 *   - AI / format API routes: network-only (AI results can't be meaningfully cached).
 *   - Everything else: network-first.
 */

const CACHE_VERSION = "oscar-v1";
const SHELL_CACHE   = `${CACHE_VERSION}-shell`;
const DATA_CACHE    = `${CACHE_VERSION}-data`;

const SHELL_ASSETS = [
  "/",
  "/notes",
  "/meetings",
  "/recording",
  "/offline",
];

// ── install ───────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Gracefully ignore failures — individual assets may not exist yet
      Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

// ── activate ──────────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("oscar-") && k !== SHELL_CACHE && k !== DATA_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests (and Supabase data GETs)
  if (request.method !== "GET") return;

  // ── Supabase notes / meetings REST: stale-while-revalidate ──────────────
  const isSupabaseData =
    url.hostname.includes("supabase") &&
    (url.pathname.includes("/rest/v1/notes") ||
      url.pathname.includes("/rest/v1/meetings"));

  if (isSupabaseData) {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
    return;
  }

  // ── AI / format API routes: network-only ────────────────────────────────
  const isAIRoute =
    url.pathname.startsWith("/api/format") ||
    url.pathname.startsWith("/api/ai") ||
    url.pathname.startsWith("/api/usage");

  if (isAIRoute) return; // let the browser handle it normally

  // ── Static app shell assets (JS, CSS, fonts, images): cache-first ───────
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff2?|ttf)$/);

  if (isStaticAsset && url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  // ── HTML navigations: network-first with offline fallback ────────────────
  if (request.headers.get("Accept")?.includes("text/html")) {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }
});

// ── strategy helpers ──────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkFetch = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });

  return cached ?? networkFetch;
}

async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Last resort: return the cached home page so the app shell loads
    const fallback = await caches.match("/");
    return (
      fallback ??
      new Response("<h1>You are offline</h1>", {
        headers: { "Content-Type": "text/html" },
      })
    );
  }
}

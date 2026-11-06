// Keeps the app working with no signal once it has loaded once.
// Pages: network first, falling back to the saved copy.
// Built files (hashed names) and fonts: saved copy first.
// Anything else, like Supabase sync, goes straight to the network.
const CACHE = "gym-tracker-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add("/")));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const save = (request, response) => {
  if (response.ok || response.type === "opaque") {
    const copy = response.clone();
    caches.open(CACHE).then((c) => c.put(request, copy));
  }
  return response;
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = /^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);

  if (request.mode === "navigate") {
    // On weak gym signal, don't wait more than 4 seconds before using the saved copy
    const network = fetch(request).then((res) => save("/", res));
    const slow = new Promise((resolve) => setTimeout(resolve, 4000)).then(() =>
      caches.match("/").then((hit) => hit || network)
    );
    event.respondWith(Promise.race([network, slow]).catch(() => caches.match("/")));
  } else if (isFont || (sameOrigin && url.pathname !== "/sw.js")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => save(request, res))
      )
    );
  }
});

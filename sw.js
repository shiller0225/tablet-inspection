// 平板檢修記錄 — service worker（離線可用）
const CACHE = "tablet-inspection-v1.5";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./exceljs.min.js",
  "./icon-192.png",
  "./icon-512.png",
  "./maskable-512.png",
  "./apple-touch-icon.png"
];
const NET_TIMEOUT = 3000; // 網路超過 3 秒沒回應就先用手機內的版本

self.addEventListener("install", e => {
  // cache:"reload" 直接向伺服器拿最新檔，避免 GitHub 的 10 分鐘快取讓手機存到舊版
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

// 只清除本 App 自己的舊快取（同網址下還有其他 App，不可動到）
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("tablet-inspection-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;

  // 頁面：網路優先（拿到新版就更新快取），超過 3 秒或離線就改用快取
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const net = fetch(req, { cache: "no-cache" }).then(res => {
        if (res.ok) cache.put("./index.html", res.clone());
        return res;
      });
      net.catch(() => {});
      const cached = await cache.match("./index.html");
      if (!cached) return net;
      const timeout = new Promise(r => setTimeout(() => r(cached), NET_TIMEOUT));
      try { return await Promise.race([net, timeout]); }
      catch { return cached; }
    })());
    return;
  }

  // 其他檔案：快取優先
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req)));
});

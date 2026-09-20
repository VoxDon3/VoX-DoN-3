/* VoX DoN 3 -- Service Worker (offline cache)
   ملاحظة: بعد أي تعديل على ملفات الهوست غيّر CACHE_NAME في هذا الملف
   حتى يتحدث الكاش على الأجهزة. وبعد الرفع انتظر ~10 دقائق حتى يتحدث السيرفر. */
var CACHE_NAME = "voxdon-cache-v2";

var PRECACHE = [
  "index.html",
  "progress.html",
  "main.css",
  "cache-status.js",
  "slopkit-bg.jpg",
  "voxbackground.jpg",
  "document/en/Ps5/index.html",

  "slopkit/poops.html",
  "slopkit/poops.js",
  "slopkit/core.js",
  "slopkit/int64.js",
  "slopkit/main.js",
  "slopkit/mem.js",
  "slopkit/rop.js",
  "slopkit/rop_slave.js",
  "slopkit/syscalls.js",
  "slopkit/vox-slopkit-ui.css",

  "offsets/9.00.js",
  "offsets/9.05.js",
  "offsets/9.20.js",
  "offsets/9.40.js",
  "offsets/9.60.js",
  "offsets/10.00.js",
  "offsets/10.01.js",
  "offsets/10.20.js",
  "offsets/10.40.js",
  "offsets/10.60.js",
  "offsets/11.00.js",
  "offsets/11.20.js",
  "offsets/11.40.js",
  "offsets/11.60.js",
  "offsets/12.00.js",

  "payloads/PLK.elf",
  "payloads/elfldr-ps5-1360.elf",
  "payloads/ftpsrv-ps5.elf",
  "payloads/gdbsrv-ps5.elf",
  "payloads/kexp_2026_05_25.bin",
  "payloads/klogsrv-ps5.elf",
  "payloads/kstuff.elf",
  "payloads/pldmgr_v0.5.0.elf",
  "payloads/shadowmountplus.elf",
  "payloads/shsrv-ps5.elf",
  "payloads/websrv-ps5.elf"
];

/* عدد الملفات المنجزة داخل الكاش (للإظهار في الصفحة) */
function cacheProgress(cache, cacheName) {
  return caches.open(cacheName).then(function (c) {
    var checks = PRECACHE.map(function (url) {
      return c.match(url).then(function (m) { return !!m; });
    });
    return Promise.all(checks).then(function (arr) {
      var done = arr.filter(function (x) { return x; }).length;
      return { done: done, total: PRECACHE.length };
    });
  });
}

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(
        PRECACHE.map(function (url) {
          return cache.add(url).catch(function () {});
        })
      );
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE_NAME; })
             .map(function (n) { return caches.delete(n); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("message", function (e) {
  var data = e.data || {};
  if (data.type === "voxdon-status") {
    cacheProgress(caches, CACHE_NAME).then(function (p) {
      if (e.source && e.source.postMessage) {
        try {
          e.source.postMessage({ type: "voxdon-status", done: p.done, total: p.total, ready: p.done === p.total });
        } catch (err) {}
      }
    });
  }
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* navigation: net أولاً (ليُحفظ الأحدث)، ولو انقطع النت سيرف من الكاش */
  if (req.mode === "navigate") {
    e.respondWith(
      caches.open(CACHE_NAME).then(function (cache) {
        return cache.match(req).then(function (cached) {
          var network = fetch(req).then(function (res) {
            if (res && res.ok) {
              cache.put(req, res.clone());
              return res;
            }
            throw new Error("net fail");
          });
          return network
            .catch(function () {
              if (cached) return cached;
              return cache.match("index.html").then(function (fallback) {
                return fallback || cache.match("progress.html");
              }).then(function (fb) {
                if (fb) return fb;
                return new Response("Offline \u2014 \u0641\u062a\u062d \u0627\u0644\u0631\u0627\u0628\u0637 \u0645\u0631\u0629 \u0648\u0627\u062d\u062f\u0629 \u0628\u0627\u0644\u0646\u062a \u0642\u0628\u0644 \u0642\u0637\u0639\u0647.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
              });
            });
        });
      })
    );
    return;
  }

  /* باقي الملفات: من الكاش أولاً، وإلا من النت مع حفظه */
  e.respondWith(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(function () {
          return new Response("", { status: 404 });
        });
      });
    })
  );
});
// v0.26: PWA 离线支持 —— 缓存名与应用版本号同步,发版时随版本号递增
var CACHE = 'wazalab-v0.27';
var CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-maskable-512.png',
  'assets/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(CORE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) {
        return k.indexOf('wazalab-') === 0 && k !== CACHE && k !== 'wazalab-cdn';
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  // 版本自检的 cache-buster 请求带查询串:SW 不拦截,走网络,不影响强制刷新机制
  if (url.search) return;
  if (url.origin !== location.origin) {
    // CDN 资源(Google Fonts / three.js):运行时缓存,命中即返,未命中走网络并回填,离线可用
    e.respondWith(
      caches.open('wazalab-cdn').then(function (c) {
        return c.match(e.request).then(function (hit) {
          var f = fetch(e.request).then(function (res) {
            if (res && res.status === 200) c.put(e.request, res.clone());
            return res;
          }).catch(function () { return hit; });
          return hit || f;
        });
      })
    );
    return;
  }
  if (e.request.mode === 'navigate' || /(^|\/)index\.html$/.test(url.pathname)) {
    // 页面:网络优先(保持版本自检的强制刷新语义),离线回退缓存
    e.respondWith(
      fetch(e.request).then(function (res) {
        var cp = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, cp); });
        return res;
      }).catch(function () {
        return caches.match(e.request).then(function (r) { return r || caches.match('index.html'); });
      })
    );
    return;
  }
  // 同站静态资源(教学插图等):缓存优先,未命中走网络并回填
  e.respondWith(
    caches.match(e.request).then(function (r) {
      return r || fetch(e.request).then(function (res) {
        if (res && res.status === 200) {
          var cp = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, cp); });
        }
        return res;
      });
    })
  );
});

/* NaTV de Sua Casa — Service Worker v3 */
const CACHE = 'natv-v3';
const PRECACHE = ['/','/index.html','/manifest.json','/robots.txt',
  '/iptv-brasil','/iptv-paraiba','/teste-iptv','/iptv-smart-tv',
  '/assets/tracking.js','/assets/whatsapp.svg','/assets/pix.svg','/assets/cartao.svg',
  '/icons/icon-192x192.png','/icons/icon-512x512.png'];

self.addEventListener('install',(e)=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',(e)=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',(e)=>{
  if(e.request.method!=='GET'||e.request.url.includes('/api/'))return;
  e.respondWith(caches.match(e.request).then(cached=>{
    if(cached)return cached;
    return fetch(e.request).then(res=>{const c=res.clone();caches.open(CACHE).then(ca=>ca.put(e.request,c)).catch(()=>{});return res;}).catch(()=>caches.match('/index.html'));
  }));
});

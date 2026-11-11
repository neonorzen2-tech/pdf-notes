/* PDF-заметки — service worker: офлайн-кэш + приём PDF через «Поделиться» */
const VERSION = 'pdfnotes-1.0';
const FILES = ["iccs/CGATS001Compat-v2-micro.icc","icon-192.png","icon-512.png","icon-maskable.png","index.html","manifest.webmanifest","pdf.min.mjs","pdf.worker.min.mjs","standard_fonts/FoxitDingbats.pfb","standard_fonts/FoxitFixed.pfb","standard_fonts/FoxitFixedBold.pfb","standard_fonts/FoxitFixedBoldItalic.pfb","standard_fonts/FoxitFixedItalic.pfb","standard_fonts/FoxitSerif.pfb","standard_fonts/FoxitSerifBold.pfb","standard_fonts/FoxitSerifBoldItalic.pfb","standard_fonts/FoxitSerifItalic.pfb","standard_fonts/FoxitSymbol.pfb","standard_fonts/LiberationSans-Bold.ttf","standard_fonts/LiberationSans-BoldItalic.ttf","standard_fonts/LiberationSans-Italic.ttf","standard_fonts/LiberationSans-Regular.ttf","wasm/jbig2.wasm","wasm/openjpeg.wasm","wasm/qcms_bg.wasm"];
const SCOPE = self.registration.scope;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(['./', ...FILES])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('pdfnotes-') && k !== VERSION && k !== 'pdfnotes-share') await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const fd = await req.formData();
        const c = await caches.open('pdfnotes-share');
        for (const k of await c.keys()) await c.delete(k);
        let i = 0;
        for (const f of fd.getAll('pdf')) {
          if (!f || typeof f === 'string') continue;
          await c.put(new Request(SCOPE + 'shared-' + (i++)), new Response(f, { headers: { 'Content-Type': 'application/pdf', 'X-Name': encodeURIComponent(f.name || 'document.pdf') } }));
        }
        return Response.redirect(SCOPE + '?shared=' + i, 303);
      } catch (err) { return Response.redirect(SCOPE, 303); }
    })());
    return;
  }
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) (await caches.open(VERSION)).put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === 'navigate') { const idx = await caches.match('./index.html'); if (idx) return idx; }
      throw err;
    }
  })());
});

const CACHE='radar-shell-v1';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.add('/offline.html')));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('radar-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')));}});
self.addEventListener('push',event=>{let data={};try{data=event.data.json()}catch{};event.waitUntil(self.registration.showNotification(data.title||'Radar',{body:data.body||'Na tvém radaru je novinka.',icon:'/logo192.png',badge:'/logo192.png',tag:data.eventKey||'radar',data:{key:data.titleKey}}));});
self.addEventListener('notificationclick',event=>{event.notification.close();const key=event.notification.data?.key;const url=key?'/title?key='+encodeURIComponent(key):'/mine';event.waitUntil(self.clients.openWindow(url));});
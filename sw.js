const CACHE='chasedex-v2-4-0';
const PREFIX='chasedex-';
const ASSETS=['./','./index.html','./styles.css','./app.js','./backend.js','./supabase-config.js','./geoapify-config.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
const FRESH_PATHS=new Set(['/','/index.html','/styles.css','/app.js','/backend.js']);

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    const old=names.filter(name=>name.startsWith(PREFIX)&&name!==CACHE);
    await Promise.all(old.map(name=>caches.delete(name)));
    await self.clients.claim();
    // V2.0.3 had no controllerchange reload listener. If an older ChaseDex
    // cache existed, refresh open app windows once so they load the newly activated release.
    if(old.length){
      const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
      await Promise.all(windows.map(client=>client.navigate(client.url).catch(()=>undefined)));
    }
  })());
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  const isFresh=event.request.mode==='navigate'||FRESH_PATHS.has(url.pathname)||[...FRESH_PATHS].some(p=>url.pathname.endsWith(p));
  if(isFresh){
    event.respondWith(fetch(event.request,{cache:'no-store'}).then(resp=>{
      if(resp&&resp.ok){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}
      return resp;
    }).catch(()=>caches.match(event.request).then(hit=>hit||caches.match('./index.html'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(resp=>{
    if(resp&&resp.ok){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}
    return resp;
  })));
});


// V2.1 — Push notifications + app badge
self.addEventListener('push',event=>{
  event.waitUntil((async()=>{
    let payload={};try{payload=event.data?.json()||{}}catch{payload={title:'ChaseDex',body:event.data?.text()||'New activity'}}
    const title=payload.title||'ChaseDex';
    const options={body:payload.body||'New collector activity',icon:'./icon-192.png',badge:'./icon-192.png',tag:payload.tag||`chasedex-${payload.notificationId||Date.now()}`,data:{url:payload.url||'./',notificationId:payload.notificationId||null},renotify:false};
    await self.registration.showNotification(title,options);
    try{if(typeof self.navigator?.setAppBadge==='function'&&Number.isFinite(Number(payload.unreadCount)))await self.navigator.setAppBadge(Number(payload.unreadCount))}catch{}
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});clients.forEach(c=>c.postMessage({type:'CHASEDEX_NOTIFICATION'}));
  })());
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const target=new URL(event.notification.data?.url||'./',self.location.origin).href;
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of clients){if('focus'in client){await client.focus();if('navigate'in client)await client.navigate(target);return}}
    if(self.clients.openWindow)return self.clients.openWindow(target);
  })());
});

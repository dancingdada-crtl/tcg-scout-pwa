import { GEOAPIFY_API_KEY } from './geoapify-config.js';
import { backendConfigured, getAuthSession, onAuthStateChange, signUpWithInvite, sendPasswordReset, validateInviteCode, createInviteCode, revokeInviteCode, signInWithPassword, updatePassword, signOut as backendSignOut, recordLogin, recordSession, loadSharedData, createReport, createStore, createProduct, saveAnalytics as backendSaveAnalytics, uploadProfileImage, updateMyProfile, updateRankingTiers, setMemberEnabled, updateStore, deleteStore, updateProduct, deleteProduct, updateReport, deleteReport, saveIndicator, deleteIndicator, setReportFeedback, createDropEvent, toggleDropWatch, permanentDeleteReport, permanentDeleteChangeLog, subscribeRealtime } from './backend.js';

const KEY='tcg-scout-v1-data';
const APP_VERSION='2.0.0';
const iso=(d=new Date())=>d.toISOString();
const uid=()=>crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2);
const esc=s=>String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[m]));
const fmtTime=s=>new Date(s).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
const fmtDate=s=>new Date(s).toLocaleDateString([], {month:'short',day:'numeric'});
const periodFor=d=>{const h=new Date(d).getHours();if(h<11)return'Morning';if(h<13)return'Noon';if(h<17)return'Afternoon';return'Evening'};
const toLocalInput=s=>{if(!s)return'';const d=new Date(s),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`};

const statusMeta={stock:{label:'Stock reported today',icon:'●',cls:'green'},empty:{label:'No stock reported today',icon:'●',cls:'red'},unsure:{label:'Missed stock reported today',icon:'●',cls:'orange'},unchecked:{label:"Hasn't been checked today",icon:'●',cls:'yellow'}};
const flagMeta={line:{label:'People lining up',icon:'👥'},possible:{label:'Possible restock',icon:'🟡'},evidence:{label:'Restock evidence',icon:'🟠'}};

function seed(){
 const stores=[
  {id:'s1',name:'Target — Riverside',chain:'Target',area:'Local',address:'Demo location — edit in Manage Stores',lat:42.6456,lng:-71.3073,active:true},
  {id:'s2',name:'Walmart — North',chain:'Walmart',area:'Local',address:'Demo location — edit in Manage Stores',lat:42.6632,lng:-71.3266,active:true},
  {id:'s3',name:'Card Corner',chain:'Local shop',area:'Downtown',address:'Demo location — edit in Manage Stores',lat:42.6334,lng:-71.3162,active:true}
 ];
 const products=[
  {id:'p1',name:'One Piece Booster Box',tcg:'One Piece',sku:'',active:true},
  {id:'p2',name:'One Piece Double Pack',tcg:'One Piece',sku:'',active:true},
  {id:'p3',name:'Pokémon ETB',tcg:'Pokémon',sku:'',active:true}
 ];
 const d=new Date();const mk=(days,h,m=0)=>{const x=new Date(d);x.setDate(x.getDate()-days);x.setHours(h,m,0,0);return x.toISOString()};
 const reports=[
  {id:uid(),storeId:'s1',status:'unsure',flags:{line:true,possible:false,evidence:false},occurredAt:mk(0,9,20),createdAt:mk(0,9,24),period:'Morning',source:'Firsthand',notes:'Small line near cards.',productId:'p1',price:null,condition:null,memberId:'m2'},
  {id:uid(),storeId:'s1',status:'stock',flags:{line:false,possible:false,evidence:false},occurredAt:mk(0,9,45),createdAt:mk(0,9,48),period:'Morning',source:'Friend',notes:'OP booster boxes on shelf.',productId:'p1',price:119.99,condition:'Sealed',memberId:'m2'},
  {id:uid(),storeId:'s1',status:'empty',flags:{line:false,possible:false,evidence:false},occurredAt:mk(0,12,15),createdAt:mk(0,12,16),period:'Noon',source:'Firsthand',notes:'Booster boxes gone.',productId:'p1',price:null,condition:null,memberId:'m3'},
  {id:uid(),storeId:'s2',status:'unsure',flags:{line:false,possible:true,evidence:false},occurredAt:mk(1,14,10),createdAt:mk(1,14,20),period:'Afternoon',source:'Phone call',notes:'Employee said cards came earlier.',productId:'p2',price:null,condition:null,memberId:'m3'},
  {id:uid(),storeId:'s3',status:'stock',flags:{line:false,possible:false,evidence:true},occurredAt:mk(2,11,45),createdAt:mk(2,12,0),period:'Noon',source:'Social media',notes:'Shop posted restock photo.',productId:'p1',price:134.99,condition:'Sealed',memberId:'m2'},
  {id:uid(),storeId:'s3',status:'stock',flags:{line:false,possible:false,evidence:false},occurredAt:mk(5,15,30),createdAt:mk(5,15,35),period:'Afternoon',source:'Firsthand',notes:'Open box discount.',productId:'p1',price:108,condition:'Unsealed',memberId:'m4'}
 ];
 return {version:1.2,stores,products,reports,members:[
  {id:'m1',name:'You',email:'admin@example.com',role:'admin',lastActive:iso(),logins:18,sessions:42,reports:6,confirmations:0,activeDays:7},
  {id:'m2',name:'Alex',email:'alex@example.com',role:'member',lastActive:mk(0,10),logins:4,sessions:19,reports:10,confirmations:2,activeDays:6},
  {id:'m3',name:'Jordan',email:'jordan@example.com',role:'member',lastActive:mk(0,8),logins:3,sessions:11,reports:7,confirmations:1,activeDays:4},
  {id:'m4',name:'Sam',email:'sam@example.com',role:'member',lastActive:mk(3,17),logins:2,sessions:5,reports:3,confirmations:0,activeDays:2}
 ],savedFilters:[{id:'f1',name:'OP Only',tcg:'One Piece',range:30,ownerId:'m1'}],settings:{periods:['Morning','Noon','Afternoon','Evening'],appName:'ChaseDex',appIcon:null,rankingTitles:[{min:0,title:'Scout'},{min:5,title:'Contributor'},{min:20,title:'Local Tracker'},{min:50,title:'Restock Hunter'}]}};
}
function migrate(d){
 if(!d||!Array.isArray(d.stores))return seed();
 d.version=1.2;
 const coords=[[42.6456,-71.3073],[42.6632,-71.3266],[42.6334,-71.3162]];
 d.stores.forEach((s,i)=>{s.address??='Add address';s.lat??=coords[i]?.[0]??42.645;s.lng??=coords[i]?.[1]??-71.315});
 d.products.forEach(p=>p.sku??='');
 d.reports=(d.reports||[]).map(r=>{
  if(r.status)return {...r,flags:{line:false,possible:false,evidence:false,...r.flags}};
  let status=r.type==='stocked'?'stock':r.type==='empty'?'empty':'unsure';
  return {...r,status,flags:{line:r.type==='line',possible:r.type==='possible',evidence:r.type==='evidence'}};
 });
 d.members?.forEach(m=>{m.confirmations??=0;m.avatar??=null});
 d.settings??={};d.settings.periods??=['Morning','Noon','Afternoon','Evening'];d.settings.appName??='ChaseDex';d.settings.appIcon??=null;d.settings.rankingTitles??=[{min:0,title:'Scout'},{min:5,title:'Contributor'},{min:20,title:'Local Tracker'},{min:50,title:'Restock Hunter'}];
 return d;
}
function load(){try{return migrate(JSON.parse(localStorage.getItem(KEY))||seed())}catch{return seed()}}
let data=load();
let state={magicSent:false,inviteStep:false,inviteCode:'',view:'home',sheet:null,selectedStore:null,activityStore:null,activityMetric:'stock',mapSort:'nearest',userLocation:null,mapMoveEnabled:false,routeSelected:[],mapStatuses:['stock','empty','unsure','unchecked'],mapIndicatorFilters:[],manageKind:'stores',editId:null,analyticsMode:'when',analytics:{metric:'stock',tcg:'All',productId:'All',storeId:'All',period:'All',range:30,groupBy:'day'},adminLogAction:'All',adminLogEntity:'All',activityRange:7,toast:null};
function save(){localStorage.setItem(KEY,JSON.stringify(data))}
let authSession=null;let appReady=false;let realtimeChannel=null;let refreshTimer=null;let loginNotice='';let pendingEmail='';let magicCooldownUntil=0;let magicCooldownTimer=null;
function localBrandIcon(sizeClass=''){return `<img class="brand-icon${sizeClass?' '+sizeClass:''}" src="./icon-192.png" alt="ChaseDex">`}
function magicCooldownSeconds(){return Math.max(0,Math.ceil((magicCooldownUntil-Date.now())/1000))}
function startMagicCooldown(seconds){
 magicCooldownUntil=Date.now()+Math.max(1,Number(seconds)||30)*1000;clearInterval(magicCooldownTimer);
 magicCooldownTimer=setInterval(()=>{if(!magicCooldownSeconds()){clearInterval(magicCooldownTimer);magicCooldownTimer=null;loginNotice='You can request another magic link now.'}render()},1000);
}
function currentMember(){return authSession?data.members.find(m=>m.id===authSession.user.id)||null:null}
function isMember(){return !!currentMember()}
function activeStores(){return data.stores.filter(x=>x.active)}
function activeProducts(){return data.products.filter(x=>x.active)}
function toast(msg){state.toast=msg;render();setTimeout(()=>{state.toast=null;render()},1800)}
function last7(){return Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));d.setHours(0,0,0,0);return d})}
function visibleReports(){return data.reports.filter(r=>!r.deletedAt)}
function reportsForStore(id){return visibleReports().filter(r=>r.storeId===id).sort((a,b)=>new Date(b.occurredAt)-new Date(a.occurredAt))}
function latestReport(id){return reportsForStore(id)[0]||null}
function todayReports(id){const now=new Date();return reportsForStore(id).filter(r=>sameDay(r.occurredAt,now))}
function todayLatestReport(id){return todayReports(id)[0]||null}
function mapStatusKey(id){const r=todayLatestReport(id);return r?.status==='stock'?'stock':r?.status==='empty'?'empty':r?.status==='unsure'?'unsure':'unchecked'}
function mapStatus(id){return statusMeta[mapStatusKey(id)]}
function latestStatus(id){return mapStatus(id)}
function activeIndicators(){return (data.indicators||[]).filter(i=>i.active)}
function indicatorById(id){return (data.indicators||[]).find(i=>i.id===id)}
function reportFlags(r){return (r?.indicatorIds||[]).map(id=>indicatorById(id)?.emoji).filter(Boolean).join(' ')}
function mapFlags(r){return reportFlags(r)}
function storeTodayIndicatorIds(id){return [...new Set(todayReports(id).flatMap(r=>r.indicatorIds||[]))]}
function storePassesMapFilters(s){return state.mapStatuses.includes(mapStatusKey(s.id))}
function haversineMiles(a,b){if(!a||!b)return null;const R=3958.7613,toRad=x=>x*Math.PI/180,dLat=toRad(Number(b.lat)-Number(a.lat)),dLng=toRad(Number(b.lng)-Number(a.lng)),lat1=toRad(Number(a.lat)),lat2=toRad(Number(b.lat));const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
function storeDistance(s){return state.userLocation?haversineMiles(state.userLocation,{lat:Number(s.lat),lng:Number(s.lng)}):null}
function sortedHomeStores(){const stores=activeStores().filter(storePassesMapFilters).slice();if(state.mapSort==='nearest'&&state.userLocation)return stores.sort((a,b)=>(storeDistance(a)??Infinity)-(storeDistance(b)??Infinity));return stores.sort((a,b)=>a.name.localeCompare(b.name))}
function selectedRouteStore(id){return state.routeSelected.includes(id)}
function routeSelectedStores(){return state.routeSelected.map(id=>data.stores.find(s=>s.id===id)).filter(Boolean)}
function toggleRouteStore(id){
 state.routeSelected=selectedRouteStore(id)?state.routeSelected.filter(x=>x!==id):[...state.routeSelected,id];
}
function requestCurrentLocation(){
 return new Promise((resolve,reject)=>{
  if(!navigator.geolocation)return reject(new Error('Location is not available on this device.'));
  navigator.geolocation.getCurrentPosition(
   p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude}),
   e=>reject(new Error(e.code===1?'Location permission was denied.':e.code===2?'Your location is unavailable.':'Could not get your current location.')),
   {enableHighAccuracy:false,timeout:10000,maximumAge:120000}
  );
 });
}
function googleRouteUrl(stores){
 if(!stores?.length)return'';
 const valid=stores.filter(s=>Number.isFinite(Number(s.lat))&&Number.isFinite(Number(s.lng)));
 if(!valid.length)return'';
 const point=s=>`${Number(s.lat)},${Number(s.lng)}`;
 if(valid.length===1)return `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(point(valid[0]))}`;
 const destination=valid[valid.length-1];
 const waypoints=valid.slice(0,-1).map(point).join('|');
 return `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(point(destination))}&waypoints=${encodeURIComponent(waypoints)}`;
}
function wazeRouteUrl(store){
 if(!store||!Number.isFinite(Number(store.lat))||!Number.isFinite(Number(store.lng)))return'';
 return `https://www.waze.com/ul?ll=${encodeURIComponent(`${Number(store.lat)},${Number(store.lng)}`)}&navigate=yes`;
}


function sameDay(a,b){return new Date(a).toDateString()===new Date(b).toDateString()}
function metricMatch(r,m){if(m==='stock'||m==='empty'||m==='unsure')return r.status===m;if(m.startsWith('indicator:'))return (r.indicatorIds||[]).includes(m.slice(10));return true}
function countMetric(storeId,date,metric){return visibleReports().filter(r=>(storeId==='All'||r.storeId===storeId)&&sameDay(r.occurredAt,date)&&metricMatch(r,metric)).length}
function appName(){return data.settings?.appName||'ChaseDex'}
function pointsFor(m){return (m.reports||0)+(m.confirmations||0)}
function rankTitle(m){const pts=pointsFor(m),levels=(data.settings?.rankingTitles||[]).slice().sort((a,b)=>Number(a.min)-Number(b.min));return (levels.filter(x=>pts>=Number(x.min)).pop()||{title:'Scout'}).title}
function avatar(m,cls='avatar'){return m?.avatar?`<img class="${cls}" src="${m.avatar}" alt="">`:`<span class="${cls} avatar-fallback">${esc((m?.name||'?').slice(0,1).toUpperCase())}</span>`}
function applyBranding(){document.title=appName();const meta=document.querySelector('meta[name="application-name"]');if(meta)meta.content=appName()}


function magicLinkSentModal(){
 if(!state.magicSent)return'';
 return `<div class="magic-modal-backdrop"><div class="magic-modal" role="dialog" aria-modal="true" aria-labelledby="magic-sent-title"><div class="magic-modal-icon">✉️</div><h2 id="magic-sent-title">Magic link sent</h2><p>Check your email and open the ChaseDex sign-in link.</p><div class="magic-first-time"><b>First time here?</b><span>After you sign in, go to <strong>Members → Edit My Profile → Account Security</strong> and create a password.</span></div><p class="tiny">ChaseDex uses a free email service, so Magic Links are limited. Use your <b>email + password</b> for future sign-ins.</p><div class="magic-modal-actions"><button class="btn wide" data-action="magic-sent-close">Got it</button><button class="btn secondary wide" data-action="magic-password-login">Go to Password Login</button></div></div></div>`;
}
function loginView(){
 if(!backendConfigured)return `<div class="login"><div class="login-card">${localBrandIcon('large')}<h1>Supabase setup needed</h1><p>ChaseDex needs your Supabase Project URL and publishable key in <b>supabase-config.js</b>.</p><div class="demo-note">Never use the service_role/secret key in this file.</div></div></div>`;
 const headline='Hunt cards. Chase trends. Know what’s next.',access='Live local data and collector-powered insights from ChaseDex.';
 if(state.inviteStep)return `<div class="login"><div class="login-card">${localBrandIcon('large')}<h1>Join ${esc(appName())}</h1><p>Enter your invite code and create your ChaseDex login.</p>${loginNotice?`<div class="login-notice">${esc(loginNotice)}</div>`:''}<div class="field"><label>Invite code</label><input id="invite-code" value="${esc(state.inviteCode)}" placeholder="CHASE-ABC123" autocomplete="one-time-code"></div><div class="field"><label>Email</label><input id="invite-email-login" type="email" value="${esc(pendingEmail)}" placeholder="you@example.com" autocomplete="email"></div><div class="field"><label>Username</label><input id="invite-username" maxlength="30" placeholder="Collector name" autocomplete="nickname"></div><div class="field"><label>Password</label><input id="invite-password" type="password" minlength="8" placeholder="At least 8 characters" autocomplete="new-password"></div><div class="field"><label>Confirm password</label><input id="invite-password-confirm" type="password" minlength="8" placeholder="Re-enter password" autocomplete="new-password"></div><button class="btn wide" data-action="invite-create-account">Create account</button><button class="btn secondary wide" data-action="invite-back">Back to sign in</button><div class="demo-note">Invite codes are single-use and expire after 7 days.</div></div></div>`;
 return `<div class="login"><div class="login-card">${data.settings?.appIcon?`<img class="brand-icon large" src="${data.settings.appIcon}" alt="ChaseDex">`:localBrandIcon('large')}<h1>${esc(appName())}</h1><p>${esc(headline)}</p>${loginNotice?`<div class="login-notice">${esc(loginNotice)}</div>`:''}<div class="field"><label>Email</label><input id="email" type="email" value="${esc(pendingEmail)}" placeholder="you@example.com" autocomplete="email"></div><div class="field"><label>Password</label><input id="password" type="password" placeholder="Your password" autocomplete="current-password"></div><button class="btn wide" data-action="password-login">Sign in</button><button class="text-action" data-action="forgot-password">Forgot password?</button><div class="login-divider"><span>first time?</span></div><button class="btn secondary wide" data-action="invite-start">I have an invite code</button><div class="demo-note">${esc(access)}</div></div></div>`;
}
function topbar(){const m=currentMember();const who=m?`${esc(m.name)} · ${m.role==='admin'?'Admin':'Member'}`:'Signed out';return `<header class="topbar"><div class="brandrow"><div class="brand">${data.settings?.appIcon?`<img class="brand-icon" src="${data.settings.appIcon}" alt="ChaseDex">`:localBrandIcon()}<div><div class="title">${esc(appName())}</div><div class="subtitle">${who}</div></div></div><div class="top-actions"><button class="pill" data-action="share-app">Share</button>${m?`<button class="pill" data-action="edit-profile">Profile</button>${m.role==='admin'?`<button class="pill" data-action="open-admin">Admin</button>`:''}`:''}<button class="pill" data-action="logout">${m?'Sign out':'Sign in'}</button></div></div></header>`}

function unreadReports(){const seen=localStorage.getItem('chasedex-last-activity-seen');if(!seen)return 0;return visibleReports().filter(r=>new Date(r.createdAt||r.occurredAt)>new Date(seen)&&r.memberId!==currentMember()?.id).length}
function nav(){const items=[['home','🗺️','Map'],['activity','▥','Activity'],['analytics','⌁','Analytics'],['drops','◉','Drops'],['products','◫','Manage']];if(isMember())items.push(['members','👥','Members']);const unread=unreadReports();return `<nav class="bottom-nav" style="grid-template-columns:repeat(${items.length},1fr)">${items.map(([v,i,l])=>`<button class="nav-btn ${state.view===v?'active':''}" data-action="nav" data-view="${v}"><span class="nav-icon">${i}${v==='activity'&&unread?`<b class="nav-badge">${unread>99?'99+':unread}</b>`:''}</span>${l}</button>`).join('')}</nav>`}

function updateNotice(){return''}
function openSheet(name){state.sheet=name;history.pushState({chasedex:true,view:state.view,sheet:name},'',location.href);render()}
function shell(){const flow=['store','report','report-detail'].includes(state.sheet);if(flow)return `${sheet()}${updateNotice()}${state.toast?`<div class="toast">${esc(state.toast)}</div>`:''}`;return `<div class="shell">${topbar()}<main>${state.view==='home'?home():state.view==='activity'?activity():state.view==='analytics'?analytics():state.view==='drops'?dropWatch():state.view==='products'?products():state.view==='members'?members():admin()}</main>${nav()}</div>${state.sheet?sheet():''}${updateNotice()}${state.toast?`<div class="toast">${esc(state.toast)}</div>`:''}`}
function reportStatusLabel(status){return status==='stock'?'Stock':status==='empty'?'No stock':status==='unsure'?'Missed stock':'Not checked'}
function home(){
 const stores=sortedHomeStores(),locNote=state.userLocation?`<div class="distance-note">Nearest first · straight-line distance. Driving distance and ETA may differ.</div>`:`<div class="distance-note">Use ◎ below the map zoom controls to locate and sort nearest → farthest.</div>`;
 const statusToggles=['stock','empty','unsure','unchecked'].map(k=>`<button class="status-filter ${k} ${state.mapStatuses.includes(k)?'active':''}" data-action="map-status-toggle" data-status="${k}"><span class="legend-dot ${statusMeta[k].cls}"></span>${k==='stock'?'Stock today':k==='empty'?'No stock today':k==='unsure'?'Missed stock':'Not checked today'}</button>`).join('');
 const indicatorToggles=activeIndicators().map(i=>`<button class="indicator-filter ${state.mapIndicatorFilters.includes(i.id)?'active':''}" data-action="map-indicator-toggle" data-id="${i.id}"><span>${esc(i.emoji)}</span>${esc(i.label)}</button>`).join('');
 const routeBar=state.routeSelected.length?`<div class="route-bar sticky-route"><b>${state.routeSelected.length} selected</b><button class="btn secondary" data-action="route-clear">Clear</button><button class="btn" data-action="route-open">Route</button></div>`:'';
 return `<section class="section"><div class="section-head"><div><h2>Map</h2><div class="tiny">Real-time store status at a glance.</div></div></div>${locNote}<div class="status-toggle-row">${statusToggles}</div>${indicatorToggles?`<div class="indicator-filter-row">${indicatorToggles}</div>`:''}<div class="map-wrap"><div id="map"></div><div class="map-left-controls"><button class="map-mini-control" data-action="map-locate" title="Locate me">◎</button><button class="map-mini-control ${state.mapMoveEnabled?'active':''}" data-action="map-move-toggle" title="${state.mapMoveEnabled?'Lock map':'Move map'}">${state.mapMoveEnabled?'🔒':'✥'}</button></div></div></section><section class="section"><div class="section-head"><h2>Stores</h2><span class="tiny">Nearest → farthest</span></div>${stores.map(store=>{const r=todayLatestReport(store.id),st=mapStatus(store.id),dist=storeDistance(store),selected=selectedRouteStore(store.id);const detail=r?`${reportStatusLabel(r.status)} · ${r.period} · ${fmtTime(r.occurredAt)} ${reportFlags(r)}`:'Hasn\'t been checked today';return `<div class="store-list-card ${selected?'route-selected':''}"><button class="store-main" data-action="map-focus-store" data-id="${store.id}"><span class="legend-dot ${st.cls}"></span><span><b>${esc(store.name)} ${storeTodayIndicatorIds(store.id).map(id=>indicatorById(id)?.emoji||'').join(' ')}</b><small>${detail}${dist!=null?` · ${dist.toFixed(dist<10?1:0)} mi`:''}</small></span></button><button class="store-view" data-action="store-quick" data-id="${store.id}">View</button><label class="route-check" title="Add to route"><input type="checkbox" data-change="route-store" data-id="${store.id}" ${selected?'checked':''}><span>Route</span></label></div>`}).join('')||'<div class="empty">No stores match these status filters.</div>'}</section>${routeBar}`;
}
function renderMap(){
 const el=document.getElementById('map');if(!el||!window.L)return;
 if(window._map){window._map.remove();window._map=null}
 const stores=sortedHomeStores();const valid=stores.filter(s=>Number.isFinite(Number(s.lat))&&Number.isFinite(Number(s.lng)));
 const center=state.userLocation?[state.userLocation.lat,state.userLocation.lng]:(valid[0]?[Number(valid[0].lat),Number(valid[0].lng)]:[42.6456,-71.315]);
 const map=L.map(el,{zoomControl:true,dragging:!!state.mapMoveEnabled,scrollWheelZoom:false,touchZoom:!!state.mapMoveEnabled,doubleClickZoom:!!state.mapMoveEnabled}).setView(center,state.userLocation?13:11);window._map=map;window._storeMarkers=new Map();
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
 const pts=[];
 valid.forEach(s=>{const st=mapStatus(s.id),ids=storeTodayIndicatorIds(s.id),emojis=ids.map(id=>indicatorById(id)?.emoji||'').join(''),highlight=!state.mapIndicatorFilters.length||state.mapIndicatorFilters.some(id=>ids.includes(id));const icon=L.divIcon({className:`chasedex-marker-wrap ${highlight?'indicator-hit':'indicator-dim'}`,html:`<div class="map-pin ${st.cls}"><span class="map-pin-dot"></span>${emojis?`<span class="pin-emoji">${emojis}</span>`:''}</div>`,iconSize:[38,46],iconAnchor:[19,42]});const marker=L.marker([Number(s.lat),Number(s.lng)],{icon,zIndexOffset:highlight?200:100}).addTo(map).bindTooltip(esc(s.name));marker.on('click',()=>{state.selectedStore=s.id;openSheet('store')});window._storeMarkers.set(s.id,marker);pts.push([Number(s.lat),Number(s.lng)])});
 if(state.userLocation){L.circleMarker([state.userLocation.lat,state.userLocation.lng],{radius:8,weight:3,fillOpacity:.9}).addTo(map).bindTooltip('Your location');pts.push([state.userLocation.lat,state.userLocation.lng])}
 if(state.focusStoreId){const s=valid.find(x=>x.id===state.focusStoreId);if(s){map.flyTo([Number(s.lat),Number(s.lng)],15,{duration:.65});setTimeout(()=>window._storeMarkers?.get(s.id)?.openTooltip(),650)}state.focusStoreId=null}else if(!state.userLocation&&pts.length>1)map.fitBounds(pts,{padding:[28,28],maxZoom:13});
 setTimeout(()=>map.invalidateSize(),80);
}
function sevenBars(storeId){
 const days=[...Array(7)].map((_,i)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-(6-i));return d});
 const metrics=[['stock','Stock'],['empty','No stock'],['unsure','Missed stock'],...activeIndicators().map(i=>[`indicator:${i.id}`,`${i.emoji} ${i.label}`])];
 return `<div class="activity-matrix"><div class="matrix-head"><span></span>${days.map(d=>`<b>${d.toLocaleDateString(undefined,{weekday:'short'}).slice(0,2)}</b>`).join('')}</div>${metrics.map(([k,l])=>`<div class="matrix-row"><span>${esc(l)}</span>${days.map(d=>{const n=countMetric(storeId,d,k);return `<i class="matrix-cell ${n?'hit':''}" title="${n} report${n===1?'':'s'}">${n||'·'}</i>`}).join('')}</div>`).join('')}</div>`;
}
function activityMatrix(storeId,range){
 const days=Number(range)||7,metrics=[['stock','Stock'],['empty','No stock'],['unsure','Missed stock'],...activeIndicators().map(i=>[`indicator:${i.id}`,`${i.emoji} ${i.label}`])];
 if(days===7){const cols=[...Array(7)].map((_,i)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-(6-i));return{label:d.toLocaleDateString(undefined,{weekday:'short'}).slice(0,2),from:new Date(d.setHours(0,0,0,0)),to:new Date(d.setHours(23,59,59,999))}});return matrixFor(cols,storeId,metrics)}
 const weeks=Math.ceil(days/7),cols=[...Array(weeks)].map((_,i)=>{const to=new Date();to.setHours(23,59,59,999);to.setDate(to.getDate()-((weeks-1-i)*7));const from=new Date(to);from.setDate(from.getDate()-6);from.setHours(0,0,0,0);return{label:`W${i+1}`,from,to}});return matrixFor(cols,storeId,metrics)
}
function matrixFor(cols,storeId,metrics){return `<div class="activity-matrix"><div class="matrix-head"><span></span>${cols.map(c=>`<b title="${fmtDate(c.from)}–${fmtDate(c.to)}">${c.label}</b>`).join('')}</div>${metrics.map(([k,l])=>`<div class="matrix-row"><span>${esc(l)}</span>${cols.map(c=>{const n=visibleReports().filter(r=>r.storeId===storeId&&new Date(r.occurredAt)>=c.from&&new Date(r.occurredAt)<=c.to&&metricMatch(r,k)).length;return `<i class="matrix-cell ${n?'hit':''}">${n||'·'}</i>`}).join('')}</div>`).join('')}</div>`}
function activity(){
 const stores=activeStores();if(!stores.length)return `<section class="section"><div class="empty">Add a store to view activity.</div></section>`;
 if(!state.activityStore||!stores.some(s=>s.id===state.activityStore))state.activityStore=localStorage.getItem('chasedex-activity-store')||stores[0].id;if(!stores.some(s=>s.id===state.activityStore))state.activityStore=stores[0].id;
 const storeId=state.activityStore,range=Number(state.activityRange)||7,cut=new Date();cut.setDate(cut.getDate()-range);const all=reportsForStore(storeId),shown=all.filter(r=>new Date(r.occurredAt)>=cut),last=all[0],store=data.stores.find(s=>s.id===storeId);
 const lastIntel=last?`<div class="card"><h3>Last Intelligence</h3><b>${reportStatusLabel(last.status)} · ${fmtDate(last.occurredAt)} · ${last.period}</b><div class="tiny">${esc(data.products.find(p=>p.id===last.productId)?.name||'No product specified')}</div></div>`:`<div class="card"><h3>Last Intelligence</h3><div class="empty">This store has never been checked.</div></div>`;
 return `<section class="section"><div class="section-head"><div><h2>Activity</h2><div class="tiny">Store history and observed signals.</div></div></div><div class="card"><div class="field"><label>Store</label><select id="activity-store" data-change="activity-store">${stores.map(x=>`<option value="${x.id}" ${storeId===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div><div class="range-row">${[7,30,60,90].map(n=>`<button class="chip ${range===n?'active':''}" data-action="activity-range" data-range="${n}">${n}D</button>`).join('')}</div><div class="store-summary"><b>${esc(store?.name||'Store')}</b><small>${shown.length} reports in ${range} days · Last checked: ${last?fmtDate(last.occurredAt):'Never'}</small></div>${activityMatrix(storeId,range)}</div>${lastIntel}<div class="section-head"><h2>Report History</h2><span class="tiny">${range}-day range</span></div>${shown.slice(0,100).map(activityRow).join('')||'<div class="empty">No reports in this range.</div>'}</section>`}
function activityRow(r){const s=data.stores.find(x=>x.id===r.storeId),p=data.products.find(x=>x.id===r.productId);const cls=r.status==='stock'?'green':r.status==='empty'?'red':'orange';return `<button class="activity-row" data-action="report-detail" data-id="${r.id}"><span class="legend-dot ${cls}"></span><span><b>${esc(s?.name||'Store')} · ${reportStatusLabel(r.status)} ${reportFlags(r)}</b><small>${fmtDate(r.occurredAt)} · ${r.period}${p?` · ${esc(p.name)}`:''}</small></span><span>›</span></button>`}
function metricLabel(m){if(m==='stock')return'Stock';if(m==='empty')return'No stock';if(m==='unsure')return'Missed stock';if(m==='price')return'Average price';if(m?.startsWith('indicator:')){const i=indicatorById(m.slice(10));return i?`${i.emoji} ${i.label}`:'Indicator'}return m||'Reports'}
function analyticsReports(){const a=state.analytics,cutoff=new Date();cutoff.setDate(cutoff.getDate()-Number(a.range||30));return visibleReports().filter(r=>{const p=data.products.find(x=>x.id===r.productId);return new Date(r.occurredAt)>=cutoff&&(a.tcg==='All'||p?.tcg===a.tcg)&&(a.productId==='All'||r.productId===a.productId)&&(a.storeId==='All'||r.storeId===a.storeId)})}
function confidenceFor(reps){const n=reps.length;if(!n)return{label:'No data',score:0};const avgAge=reps.reduce((sum,r)=>sum+Math.max(0,(Date.now()-new Date(r.occurredAt))/86400000),0)/n;const recency=Math.max(0,1-avgAge/30),score=Math.round(Math.min(100,(Math.min(n,30)/30*.7+recency*.3)*100));return{label:score>=70?'High':score>=40?'Medium':'Low',score}}
function analyticsFilterBar(){const a=state.analytics,tcgs=[...new Set(activeProducts().map(p=>p.tcg))];return `<div class="card analytics-builder"><div class="two-col"><div class="field"><label>Range</label><select id="a-range" data-change="analytics"><option value="7" ${Number(a.range)===7?'selected':''}>7 days</option><option value="30" ${Number(a.range)===30?'selected':''}>30 days</option><option value="60" ${Number(a.range)===60?'selected':''}>60 days</option><option value="90" ${Number(a.range)===90?'selected':''}>90 days</option></select></div><div class="field"><label>Store</label><select id="a-store" data-change="analytics"><option value="All">All stores</option>${activeStores().map(x=>`<option value="${x.id}" ${a.storeId===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div></div><div class="two-col"><div class="field"><label>TCG</label><select id="a-tcg" data-change="analytics"><option>All</option>${tcgs.map(x=>`<option ${a.tcg===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div><div class="field"><label>Product</label><select id="a-product" data-change="analytics"><option value="All">All products</option>${activeProducts().filter(p=>a.tcg==='All'||p.tcg===a.tcg).map(p=>`<option value="${p.id}" ${a.productId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></div></div></div>`}
function analyticsWhere(reps){const rows=activeStores().map(store=>{const rr=reps.filter(r=>r.storeId===store.id),stock=rr.filter(r=>r.status==='stock').length,missed=rr.filter(r=>r.status==='unsure').length,empty=rr.filter(r=>r.status==='empty').length,total=stock+missed+empty,periods=data.settings.periods.map(p=>[p,rr.filter(r=>r.period===p&&r.status==='stock').length]).sort((a,b)=>b[1]-a[1]),conf=confidenceFor(rr);return{store,stock,missed,empty,total,best:periods[0]?.[1]?periods[0][0]:'—',conf}}).filter(x=>x.total).sort((a,b)=>b.total-a.total||b.stock-a.stock);return `<div class="card"><h3>Store availability</h3><div class="analysis-table"><div class="analysis-row head"><span>Store</span><span>Stock</span><span>Missed</span><span>No Stock</span><span>Best</span><span>Confidence</span></div>${rows.map(x=>`<div class="analysis-row"><span><b>${esc(x.store.name)}</b><small>${x.total} observations</small></span><span>${x.stock}</span><span>${x.missed}</span><span>${x.empty}</span><span>${x.best}</span><span>${x.conf.label}</span></div>`).join('')||'<div class="empty">No matching store observations.</div>'}</div></div>${analyticsSignals(reps)}`}
function analyticsWhen(reps){const weekdays=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],periods=data.settings.periods,windows=[];for(let di=0;di<7;di++)for(const period of periods){const rr=reps.filter(r=>new Date(r.occurredAt).getDay()===di&&r.period===period),stock=rr.filter(r=>r.status==='stock').length,missed=rr.filter(r=>r.status==='unsure').length,empty=rr.filter(r=>r.status==='empty').length;windows.push({di,day:weekdays[di],period,rr,stock,missed,empty,score:stock*3+missed,conf:confidenceFor(rr)})}const ranked=windows.filter(x=>x.rr.length).sort((a,b)=>b.score-a.score||b.rr.length-a.rr.length),best=ranked[0],next=ranked[1],max=Math.max(1,...windows.map(x=>x.score));const card=(x,title)=>x?`<div class="window-card"><small>${title}</small><b>${x.day} · ${x.period}</b><span>Stock ${x.stock} · Missed ${x.missed} · No Stock ${x.empty}</span><span>${x.rr.length} observations · ${x.conf.label} confidence</span></div>`:'';return `<div class="card"><h3>Day × time intelligence</h3><div class="time-heat"><div></div>${periods.map(p=>`<b>${p.slice(0,3)}</b>`).join('')}${weekdays.map((d,di)=>`<b>${d}</b>${periods.map(p=>{const x=windows.find(w=>w.di===di&&w.period===p);return `<i style="--heat:${x.score/max}" title="${d} ${p}: Stock ${x.stock}, Missed ${x.missed}, No Stock ${x.empty}">${x.stock||x.missed||x.empty?`${x.stock}/${x.missed}/${x.empty}`:'·'}</i>`}).join('')}`).join('')}</div><div class="tiny">Cells show Stock / Missed / No Stock.</div></div><div class="best-windows">${card(best,'Best observed window')}${card(next,'Next best')}</div>${analyticsSignals(reps)}`}
function analyticsDrops(reps){const groups=new Map();for(const r of reps){if(!r.productId)continue;const a=groups.get(r.productId)||[];a.push(r);groups.set(r.productId,a)}const rows=[...groups].map(([id,rr])=>{const p=data.products.find(x=>x.id===id),stock=rr.filter(r=>r.status==='stock').length,missed=rr.filter(r=>r.status==='unsure').length,empty=rr.filter(r=>r.status==='empty').length,total=rr.filter(r=>['stock','empty','unsure'].includes(r.status)).length,prices=rr.filter(r=>r.price!=null).map(r=>Number(r.price)),avg=prices.length?prices.reduce((a,b)=>a+b,0)/prices.length:null;return{p,rr,stock,missed,empty,total,avg,stores:new Set(rr.map(r=>r.storeId)).size,conf:confidenceFor(rr)}}).sort((a,b)=>b.rr.length-a.rr.length);return `<div class="card"><h3>Product / drop intelligence</h3>${rows.map(x=>`<div class="drop-analysis"><div><b>${esc(x.p?.name||'Product')}</b><small>${esc(x.p?.tcg||'')} · ${x.rr.length} sightings · ${x.stores} stores</small></div><div><b>Stock ${x.stock} · Missed ${x.missed} · No Stock ${x.empty}</b><small>${x.total} observations${x.avg!=null?` · avg $${x.avg.toFixed(2)}`:''} · ${x.conf.label} confidence</small></div></div>`).join('')||'<div class="empty">No matching product reports.</div>'}</div>${analyticsSignals(reps)}`}
function analyticsSignals(reps){const sig=activeIndicators().map(i=>({i,n:reps.filter(r=>(r.indicatorIds||[]).includes(i.id)).length})).filter(x=>x.n);return sig.length?`<div class="card"><h3>Signals</h3><div class="signal-chips">${sig.map(x=>`<span class="chip">${esc(x.i.emoji)} ${esc(x.i.label)} · ${x.n}</span>`).join('')}</div></div>`:''}
function analytics(){const mode=['when','where','drops'].includes(state.analyticsMode)?state.analyticsMode:'when',reps=analyticsReports();const body=mode==='where'?analyticsWhere(reps):mode==='drops'?analyticsDrops(reps):analyticsWhen(reps);return `<section class="section"><div class="section-head"><div><h2>Analytics</h2><div class="tiny">When to check, where to go and what is dropping.</div></div></div><div class="analytics-modes">${[['when','When'],['where','Where'],['drops','Drops']].map(([v,l])=>`<button class="chip ${mode===v?'active':''}" data-action="analytics-mode" data-mode="${v}">${l}</button>`).join('')}</div>${analyticsFilterBar()}${body}</section>`}
function dropWatch(){const events=(data.dropEvents||[]).filter(x=>!x.deletedAt).sort((a,b)=>new Date(a.startsAt)-new Date(b.startsAt));return `<section class="section"><div class="section-head"><div><h2>Drop Watch</h2><div class="tiny">Upcoming releases, restocks and local card-shop events.</div></div><button class="pill" data-action="drop-add">＋ Add Drop</button></div>${events.map(e=>{const store=data.stores.find(s=>s.id===e.storeId),product=data.products.find(p=>p.id===e.productId),watched=(data.dropWatches||[]).some(w=>w.dropEventId===e.id&&w.memberId===currentMember()?.id);return `<div class="card drop-watch-card"><div><b>${esc(product?.name||e.title||'Drop')}</b><small>${esc(e.eventType)} · ${esc(store?.name||'Store')} · ${fmtDate(e.startsAt)} ${fmtTime(e.startsAt)}</small><small>${esc(e.sourceType)} · ${esc(e.confidence)} confidence${e.price!=null?` · $${Number(e.price).toFixed(2)}`:''}</small>${e.purchaseRules?`<small>${esc(e.purchaseRules)}</small>`:''}</div><div class="row"><button class="chip ${watched?'active':''}" data-action="drop-watch" data-id="${e.id}">${watched?'Watching':'Watch Drop'}</button><button class="chip" data-action="drop-report" data-id="${e.id}">Report Drop</button></div></div>`}).join('')||'<div class="empty">No upcoming drops yet.</div>'}</section>`}
function dropEventSheet(){return `<div class="sheet flow-sheet"><div class="sheet-card"><div class="sheet-title"><h2>Add Drop</h2><button class="close" data-action="close-sheet">×</button></div><div class="field"><label>Event type</label><select id="de-type">${['Release Day','Restock','Preorder','Lottery','Tournament','Trade Night','Special Event'].map(x=>`<option>${x}</option>`).join('')}</select></div><div class="field"><label>Store</label><select id="de-store">${activeStores().map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div><div class="field"><label>Product</label><select id="de-product"><option value="">None / general event</option>${activeProducts().map(p=>`<option value="${p.id}">${esc(p.tcg)} · ${esc(p.name)}</option>`).join('')}</select></div><div class="field"><label>Date & time</label><input id="de-start" type="datetime-local"></div><div class="two-col"><div class="field"><label>Source</label><select id="de-source">${['Store Announced','Store Confirmed','Community Reported'].map(x=>`<option>${x}</option>`).join('')}</select></div><div class="field"><label>Confidence</label><select id="de-confidence"><option>High</option><option selected>Medium</option><option>Low</option></select></div></div><div class="two-col"><div class="field"><label>Price</label><input id="de-price" inputmode="decimal"></div><div class="field"><label>Purchase rules</label><input id="de-rules" placeholder="Limit 2, membership, etc."></div></div><div class="field"><label>Notes</label><textarea id="de-notes"></textarea></div><button class="btn wide" data-action="drop-save">Save Drop</button></div></div>`}
function products(){
 if(!isMember())return `<section class="section"><div class="empty">Sign in to manage stores and products.</div></section>`;
 const kind=state.manageKind||'stores',items=kind==='stores'?data.stores.filter(x=>!x.deletedAt):data.products.filter(x=>!x.deletedAt);
 return `<section class="section"><div class="section-head"><div><h2>Manage</h2><div class="tiny">Add, modify or delete shared stores and products.</div></div><button class="pill" data-action="${kind==='stores'?'open-store-add':'open-product-add'}">＋ Add ${kind==='stores'?'store':'product'}</button></div><div class="manage-toggle"><button class="chip ${kind==='stores'?'active':''}" data-action="manage-kind" data-kind="stores">Stores</button><button class="chip ${kind==='products'?'active':''}" data-action="manage-kind" data-kind="products">Products</button></div><div class="card manage-list-card">${items.map(x=>kind==='stores'?`<button class="manage-item" data-action="edit-store" data-id="${x.id}"><span><b>${esc(x.name)}</b><small>${esc(x.address||'No address')}</small></span><span>›</span></button>`:`<button class="manage-item" data-action="edit-product" data-id="${x.id}"><span><b>${esc(x.name)}</b><small>${esc(x.tcg)}${x.sku?` · ${esc(x.sku)}`:''}</small></span><span>›</span></button>`).join('')||'<div class="empty">Nothing here yet.</div>'}</div></section>`}
function members(){const me=currentMember();if(!me)return '<div class="empty">Sign in as a member to view the member list.</div>';const ranked=data.members.slice().filter(m=>m.enabled!==false).sort((a,b)=>pointsFor(b)-pointsFor(a));const mine=(data.invites||[]).filter(i=>i.createdBy===me.id&&!i.redeemedAt&&!i.revokedAt);return `<section class="section"><div class="section-head"><div><h2>Members</h2><div class="tiny">Contribution rankings and private invites.</div></div></div><div class="card ranking-list">${ranked.map((m,i)=>`<div class="ranking-row"><div class="rank-num">${i+1}</div>${avatar(m)}<div><b>${esc(m.name)}</b><small>${esc(rankTitle(m))} · ${pointsFor(m)} points</small></div><div class="rank-stats"><b>${m.reports||0}</b><small>reports</small></div></div>`).join('')}</div><div class="card"><div class="section-head compact"><div><h3>Invite someone</h3><div class="tiny">Single-use code · expires in 7 days.</div></div></div><div class="field"><label>Invitee label <span class="optional">optional</span></label><input id="invite-label" placeholder="Mike, local group, etc."></div><button class="btn wide" data-action="create-invite">Generate invite code</button>${mine.length?`<div class="invite-list">${mine.map(i=>`<div class="invite-row"><span><b>${esc(i.code)}</b><small>${esc(i.label||'Unlabeled')} · expires ${fmtDate(i.expiresAt)}</small></span><button class="chip" data-action="copy-invite" data-code="${esc(i.code)}">Copy</button></div>`).join('')}</div>`:''}</div><div class="tiny contribution-note">Contribution score: 1 point per report + 1 point per confirmation.</div></section>`}
function admin(){
 if(currentMember()?.role!=='admin')return'<div class="empty">Admin only.</div>';
 const action=state.adminLogAction||'All',entity=state.adminLogEntity||'All';const filtered=(data.changeLog||[]).filter(l=>(action==='All'||String(l.action).toLowerCase()===({Created:'create',Updated:'update',Deleted:'delete'}[action]||action).toLowerCase())&&(entity==='All'||String(l.entity_type).toLowerCase()===entity.toLowerCase())).slice(0,20);const invites=data.invites||[],levels=data.settings?.rankingTitles||[],s=data.settings||{};
 return `<section class="section"><div class="section-head"><div><h2>Admin</h2><div class="tiny">Rankings, indicators, invites, data correction and audit.</div></div><button class="pill" data-action="export-excel">Export Excel</button></div><div class="card"><h3>Ranking titles</h3>${levels.map((x,i)=>`<div class="rank-edit-row"><div class="field"><label>Minimum points</label><input id="rank-min-${i}" inputmode="numeric" value="${Number(x.min)||0}"></div><div class="field"><label>Rank name</label><input id="rank-title-${i}" value="${esc(x.title)}"></div></div>`).join('')}<button class="btn wide" data-action="save-ranks">Save ranking titles</button></div><div class="card"><div class="section-head compact"><div><h3>Report indicators</h3><div class="tiny">Choices appear in Quick Report, Map and Activity.</div></div><button class="chip" data-action="indicator-add">＋ Add</button></div>${(data.indicators||[]).map(i=>`<div class="indicator-admin-row"><span class="indicator-emoji">${esc(i.emoji)}</span><span><b>${esc(i.label)}</b><small>${i.active?'Active':'Removed'}</small></span><button class="chip" data-action="indicator-edit" data-id="${i.id}">Edit</button></div>`).join('')}</div><div class="card"><h3>Invite history</h3>${invites.slice(0,20).map(i=>`<div class="change-row"><b>${esc(i.code)} · ${i.redeemedAt?'Redeemed':i.revokedAt?'Revoked':'Active'}</b><small>${esc(i.creatorName||'Member')} → ${esc(i.redeemedEmail||i.label||'Not redeemed')}</small><small>Created ${fmtDate(i.createdAt)}${i.redeemedAt?` · used ${fmtDate(i.redeemedAt)}`:''}</small>${!i.redeemedAt&&!i.revokedAt?`<button class="chip" data-action="revoke-invite" data-id="${i.id}">Revoke</button>`:''}</div>`).join('')||'<div class="empty">No invites yet.</div>'}</div><div class="card"><h3>Permanent Help & App Maintenance</h3><p><b>Android:</b> If an update is stuck, remove ChaseDex, open the ChaseDex site in Chrome, choose Add to Home screen / Install app, then sign in again.</p><p><b>iPhone / iPad:</b> If an update is stuck, remove ChaseDex from the Home Screen, open the ChaseDex site in Safari, tap Share → Add to Home Screen, then sign in again.</p><div class="tiny">Reinstall when an update does not appear, an old version remains cached, or ChaseDex persistently shows a blank/loading screen.</div></div><div class="card"><h3>Permanent Data Correction</h3><div class="tiny">Admin-only. Permanent report deletion removes the observation from Activity and Analytics and cannot be undone.</div>${visibleReports().slice(0,20).map(r=>`<div class="change-row"><b>${reportStatusLabel(r.status)} · ${esc(data.stores.find(s=>s.id===r.storeId)?.name||'Store')}</b><small>${fmtDate(r.occurredAt)} · ${esc(data.products.find(p=>p.id===r.productId)?.name||'No product')}</small><button class="chip danger" data-action="admin-purge-report" data-id="${r.id}">Permanently Delete</button></div>`).join('')||'<div class="empty">No reports.</div>'}</div><div class="card"><div class="section-head compact"><div><h3>Change log</h3><div class="tiny">Latest 20 matching records. Export contains the full loaded audit history.</div></div></div><div class="filter-row">${['All','Created','Updated','Deleted'].map(x=>`<button class="chip ${action===x?'active':''}" data-action="admin-log-action" data-value="${x}">${x}</button>`).join('')}</div><div class="filter-row">${['All','Store','Product','Report','Indicator'].map(x=>`<button class="chip ${entity===x?'active':''}" data-action="admin-log-entity" data-value="${x}">${x}</button>`).join('')}</div>${filtered.map(l=>`<div class="change-row"><b>${esc(l.action)} · ${esc(l.entity_type)}</b><small>${esc(l.actor_name||l.actor_id||'Unknown')} · ${fmtDate(l.changed_at)} ${fmtTime(l.changed_at)}</small><button class="chip danger" data-action="admin-purge-log" data-id="${l.id}">Delete log</button></div>`).join('')||'<div class="empty">No matching changes.</div>'}</div></section>`;
}
function sheet(){if(state.sheet==='store')return storeSheet(state.selectedStore);if(state.sheet==='report')return reportSheet(state.selectedStore);if(state.sheet==='report-detail')return reportDetailSheet(state.reportId);if(state.sheet==='report-edit')return reportEditSheet(state.editId);if(state.sheet==='store-add')return storeFormSheet();if(state.sheet==='store-edit')return storeFormSheet(state.editId);if(state.sheet==='product-add')return productFormSheet();if(state.sheet==='product-edit')return productFormSheet(state.editId);if(state.sheet==='indicator-edit')return indicatorSheet(state.editId);if(state.sheet==='profile')return profileSheet();if(state.sheet==='route')return routeSheet();if(state.sheet==='drop-add')return dropEventSheet();return''}
function storeSheet(id){const s=data.stores.find(x=>x.id===id);if(!s)return'';const r=latestReport(id),st=latestStatus(id);return `<div class="sheet flow-sheet"><div class="sheet-card"><div class="sheet-title"><div><h2>${esc(s.name)}</h2><div class="tiny">${esc(s.address||s.area)}</div></div><button class="close" data-action="close-sheet">×</button></div><div class="quick-status"><span class="status ${st.cls}">${st.label}</span>${r?`<span class="tiny">${fmtDate(r.occurredAt)} · ${r.period} · ${fmtTime(r.occurredAt)} ${reportFlags(r)}</span>`:'<span class="tiny">No recent report</span>'}</div><h3>7-day quick view</h3>${sevenBars(id)}<div class="sheet-actions">${isMember()?`<button class="btn wide" data-action="start-quick" data-id="${id}">Quick report</button>`:`<button class="btn wide" data-action="logout">Sign in to report</button>`}<button class="btn secondary wide" data-action="drive-store" data-id="${id}">🚗 Drive now</button><button class="btn secondary wide" data-action="text-store" data-id="${id}">Share / alert group</button></div></div></div>`}
function radio(name,value,label,checked){return `<label class="radio-pill"><input type="radio" name="${name}" value="${value}" ${checked?'checked':''}><span>${label}</span></label>`}
function reportSheet(storeId){const now=periodFor(new Date()),pending=(data.dropEvents||[]).find(e=>e.id===state.pendingDropEvent),tcgs=[...new Set(activeProducts().map(p=>p.tcg))],pendingProduct=data.products.find(p=>p.id===pending?.productId),defaultTcg=pendingProduct?.tcg||tcgs[0]||'',recent=[...activeProducts()].sort((a,b)=>{const ar=visibleReports().find(r=>r.productId===a.id)?.occurredAt||'',br=visibleReports().find(r=>r.productId===b.id)?.occurredAt||'';return br.localeCompare(ar)});return `<div class="sheet flow-sheet"><div class="sheet-card quick-report"><div class="sheet-title"><div><h2>Quick report</h2><div class="tiny">Fast selections first. Drop Details are optional.</div></div><button class="close" data-action="close-sheet">×</button></div><div class="field"><label>Store</label><select id="r-store">${activeStores().map(s=>`<option value="${s.id}" ${storeId===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div><div class="field"><label>Status</label><div class="radio-grid">${radio('r-status','stock','Stock',true)}${radio('r-status','empty','No stock',false)}${radio('r-status','unsure','Missed stock',false)}</div></div><div class="field"><label>Time bucket</label><div class="radio-grid four">${data.settings.periods.map(x=>radio('r-period',x,x,now===x)).join('')}</div></div><div class="field"><label>TCG <span class="optional">optional</span></label><div class="tcg-toggle">${tcgs.map((x,i)=>`<button type="button" class="chip ${x===defaultTcg?'active':''}" data-action="report-tcg" data-tcg="${esc(x)}">${esc(x)}</button>`).join('')}</div></div><div class="field"><label>Product <span class="optional">swipe left / right</span></label><input id="r-product" type="hidden" value="${pendingProduct?.id||''}"><div class="product-wheel">${recent.map(p=>`<button type="button" class="product-wheel-item ${p.tcg===defaultTcg?'':'tcg-hidden'} ${p.id===pendingProduct?.id?'active':''}" data-action="pick-product" data-id="${p.id}" data-tcg="${esc(p.tcg)}"><b>${esc(p.name)}</b><small>${esc(p.tcg)}</small></button>`).join('')}</div></div>${activeIndicators().length?`<div class="field"><label>Indicators <span class="optional">optional</span></label><div class="indicator-grid">${activeIndicators().map(i=>`<label class="indicator-choice"><input class="r-indicator" data-id="${i.id}" type="checkbox"><span><b>${esc(i.emoji)}</b>${esc(i.label)}</span></label>`).join('')}</div></div>`:''}<fieldset class="drop-details"><legend>Drop Details <span>optional</span></legend><div class="two-col compact-fields"><div class="field"><label>Price</label><input id="r-price" inputmode="decimal" placeholder="$ 0.00"></div><div class="field"><label>Condition</label><select id="r-condition"><option value="">—</option><option>Sealed</option><option>Unsealed</option><option>Damaged</option></select></div></div><div class="field"><label>Source</label><select id="r-source">${['Firsthand','Friend','Phone call','Social media','Store employee','Other'].map(x=>`<option>${x}</option>`).join('')}</select></div><div class="two-col compact-fields"><div class="field"><label>Approx. event time</label><input id="r-occurred" type="datetime-local"></div><div class="field"><label>Notes</label><input id="r-notes" placeholder="Optional note"></div></div></fieldset><button class="btn wide" data-action="submit-report">Submit quick report</button></div></div>`}
function geoapifyReady(){return GEOAPIFY_API_KEY&&GEOAPIFY_API_KEY!=='PASTE_YOUR_GEOAPIFY_API_KEY_HERE'}
let storeLookupTimer=null,storeLookupController=null;
async function lookupStores(q){
 if(!geoapifyReady()||q.trim().length<3)return [];
 storeLookupController?.abort();storeLookupController=new AbortController();
 const params=new URLSearchParams({text:q.trim(),format:'json',limit:'6',lang:'en',filter:'countrycode:us',apiKey:GEOAPIFY_API_KEY});
 const resp=await fetch('https://api.geoapify.com/v1/geocode/autocomplete?'+params,{signal:storeLookupController.signal});
 if(!resp.ok)throw new Error('Store lookup unavailable');
 const json=await resp.json();return json.results||[];
}
function storeResultName(r){const base=r.name||r.address_line1||[r.housenumber,r.street].filter(Boolean).join(' ')||'Selected location',city=r.city||r.county||'',stateName=r.state_code||r.state||'';return [base,[city,stateName].filter(Boolean).join(', ')].filter(Boolean).join(' - ')}
function storeResultAddress(r){return r.formatted||[r.address_line1,r.address_line2].filter(Boolean).join(', ')}
function showStoreSuggestions(items){const box=document.getElementById('store-suggestions');if(!box)return;if(!items.length){box.innerHTML='<div class="lookup-empty">No matches. You can enter the address and coordinates manually.</div>';box.hidden=false;return}box.innerHTML=items.map((r,i)=>`<button type="button" class="lookup-result" data-action="select-store-result" data-index="${i}"><b>${esc(storeResultName(r))}</b><small>${esc(storeResultAddress(r))}</small></button>`).join('');box.hidden=false;box._results=items}
function storeFormSheet(id=null){const s=id?data.stores.find(x=>x.id===id):null;return `<div class="sheet flow-sheet"><div class="sheet-card"><div class="sheet-title"><div><h2>${s?'Edit':'Add'} store</h2><div class="tiny">${s?'Changes are shared with all members.':'Search, verify and save.'}</div></div><button class="close" data-action="close-sheet">×</button></div>${geoapifyReady()?`<div class="field store-lookup"><label>Find store or address</label><input id="store-search" autocomplete="off" placeholder="Try Target Lowell MA"><div id="store-suggestions" class="lookup-results" hidden></div></div>`:''}<div class="field"><label>Store type</label><select id="new-store-type">${['Retail Chain','Local Card Shop','Official TCG Store','Other'].map(x=>`<option ${s?.storeType===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Name</label><input id="new-store" value="${esc(s?.name||'')}" placeholder="Store name"></div><div class="field"><label>Address</label><input id="new-address" value="${esc(s?.address||'')}" placeholder="Street, city, state"></div><div class="two-col"><div class="field"><label>Latitude</label><input id="new-lat" inputmode="decimal" value="${s?.lat??''}"></div><div class="field"><label>Longitude</label><input id="new-lng" inputmode="decimal" value="${s?.lng??''}"></div></div><div id="store-preview-wrap" class="store-preview-wrap" ${s?.lat&&s?.lng?'':'hidden'}><div id="store-preview-map"></div></div><button class="btn wide" data-action="${s?'save-store':'add-store'}" data-id="${s?.id||''}">${s?'Save changes':'Add store'}</button>${s?`<button class="btn danger wide" data-action="delete-store" data-id="${s.id}">Delete store</button>`:''}</div></div>`}
function productFormSheet(id=null){const p=id?data.products.find(x=>x.id===id):null;return `<div class="sheet flow-sheet"><div class="sheet-card"><div class="sheet-title"><h2>${p?'Edit':'Add'} product</h2><button class="close" data-action="close-sheet">×</button></div><div class="field"><label>Product name</label><input id="new-product" value="${esc(p?.name||'')}"></div><div class="field"><label>TCG</label><input id="new-tcg" value="${esc(p?.tcg||'One Piece')}"></div><div class="field"><label>Set <span class="optional">optional</span></label><input id="new-set" value="${esc(p?.setName||'')}"></div><div class="field"><label>SKU / UPC <span class="optional">optional</span></label><input id="new-sku" value="${esc(p?.sku||'')}"></div><button class="btn wide" data-action="${p?'save-product':'add-product'}" data-id="${p?.id||''}">${p?'Save changes':'Add product'}</button>${p?`<button class="btn danger wide" data-action="delete-product" data-id="${p.id}">Delete product</button>`:''}</div></div>`}
function reportEditSheet(id){const r=data.reports.find(x=>x.id===id);if(!r)return'';return `<div class="sheet flow-sheet"><div class="sheet-card"><div class="sheet-title"><div><h2>Edit report</h2><div class="tiny">Changes are shared with the group.</div></div><button class="close" data-action="close-sheet">×</button></div><div class="field"><label>Store</label><select id="er-store">${activeStores().map(s=>`<option value="${s.id}" ${r.storeId===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div><div class="field"><label>Status</label><div class="radio-grid">${radio('er-status','stock','Stock',r.status==='stock')}${radio('er-status','empty','No stock',r.status==='empty')}${radio('er-status','unsure','Missed stock',r.status==='unsure')}</div></div><div class="field"><label>Time bucket</label><select id="er-period">${data.settings.periods.map(x=>`<option ${r.period===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Indicators</label><div class="check-list">${activeIndicators().map(i=>`<label><input class="er-indicator" data-id="${i.id}" type="checkbox" ${(r.indicatorIds||[]).includes(i.id)?'checked':''}> ${esc(i.emoji)} ${esc(i.label)}</label>`).join('')}</div></div><div class="field"><label>Product</label><select id="er-product"><option value="">None</option>${activeProducts().map(p=>`<option value="${p.id}" ${r.productId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></div><div class="two-col"><div class="field"><label>Price</label><input id="er-price" inputmode="decimal" value="${r.price??''}"></div><div class="field"><label>Condition</label><select id="er-condition"><option value="">—</option>${['Sealed','Unsealed','Damaged'].map(x=>`<option ${r.condition===x?'selected':''}>${x}</option>`).join('')}</select></div></div><div class="field"><label>Source</label><select id="er-source">${['Firsthand','Friend','Phone call','Social media','Store employee','Other'].map(x=>`<option ${r.source===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Event time</label><input id="er-occurred" type="datetime-local" value="${toLocalInput(r.occurredAt)}"></div><div class="field"><label>Notes</label><textarea id="er-notes">${esc(r.notes||'')}</textarea></div><button class="btn wide" data-action="save-report" data-id="${r.id}">Save changes</button><button class="btn danger wide" data-action="delete-report" data-id="${r.id}">Delete report</button></div></div>`}
function indicatorSheet(id=null){const i=id?(data.indicators||[]).find(x=>x.id===id):null;return `<div class="sheet"><div class="sheet-card"><div class="sheet-title"><h2>${i?'Edit':'Add'} indicator</h2><button class="close" data-action="close-sheet">×</button></div><div class="field"><label>Emoji</label><input id="ind-emoji" value="${esc(i?.emoji||'📦')}" maxlength="8"></div><div class="field"><label>Label</label><input id="ind-label" value="${esc(i?.label||'')}"></div><button class="btn wide" data-action="save-indicator" data-id="${i?.id||''}">Save indicator</button>${i?`<button class="btn danger wide" data-action="delete-indicator" data-id="${i.id}">Remove from form</button>`:''}</div></div>`}
function reportDetailSheet(id){const r=data.reports.find(x=>x.id===id);if(!r)return'';const s=data.stores.find(x=>x.id===r.storeId),p=data.products.find(x=>x.id===r.productId);return `<div class="sheet flow-sheet"><div class="sheet-card"><div class="sheet-title"><div><h2>${reportStatusLabel(r.status)} ${reportFlags(r)}</h2><div class="tiny">${esc(s?.name||'Store')}</div></div><button class="close" data-action="close-sheet">×</button></div><div class="detail-grid"><span>Event time</span><b>${fmtDate(r.occurredAt)} · ${r.period} · ${fmtTime(r.occurredAt)}</b><span>Submitted</span><b>${fmtDate(r.createdAt)} · ${fmtTime(r.createdAt)}</b><span>Product</span><b>${esc(p?.name||'—')}</b><span>Source</span><b>${esc(r.source||'—')}</b><span>Price</span><b>${r.price!=null?`$${Number(r.price).toFixed(2)} ${esc(r.condition||'')}`:'—'}</b></div>${r.notes?`<div class="note-box">${esc(r.notes)}</div>`:''}<div class="row"><button class="btn" data-action="edit-report" data-id="${r.id}">Edit report</button><button class="btn secondary" data-action="share-report" data-id="${r.id}">Share</button></div></div></div>`}
let storePreviewMap=null,storePreviewMarker=null;
function renderStorePreview(lat,lng){
 const wrap=document.getElementById('store-preview-wrap'),el=document.getElementById('store-preview-map');
 lat=Number(lat);lng=Number(lng);
 if(!wrap||!el||!Number.isFinite(lat)||!Number.isFinite(lng)||!window.L)return;
 wrap.hidden=false;
 if(storePreviewMap){storePreviewMap.remove();storePreviewMap=null;storePreviewMarker=null}
 storePreviewMap=L.map(el,{zoomControl:false,attributionControl:true}).setView([lat,lng],16);
 L.control.zoom({position:'bottomright'}).addTo(storePreviewMap);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(storePreviewMap);
 storePreviewMarker=L.marker([lat,lng]).addTo(storePreviewMap);
 setTimeout(()=>storePreviewMap?.invalidateSize(),50);
}
async function ensureXLSX(){
 if(window.XLSX)return window.XLSX;
 await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.onload=resolve;s.onerror=()=>reject(new Error('Excel export library could not load. Check your internet connection.'));document.head.appendChild(s)});
 return window.XLSX;
}
async function exportAdminExcel(){
 if(currentMember()?.role!=='admin')throw new Error('Admin only.');
 const XLSX=await ensureXLSX(),wb=XLSX.utils.book_new();
 const storeName=id=>data.stores.find(s=>s.id===id)?.name||'';
 const productName=id=>data.products.find(p=>p.id===id)?.name||'';
 const memberName=id=>data.members.find(m=>m.id===id)?.name||'';
 const reports=data.reports.map(r=>({
  Report_ID:r.id,Store_ID:r.storeId,Store:storeName(r.storeId),Product_ID:r.productId||'',Product:productName(r.productId),
  Member_ID:r.memberId||'',Member:memberName(r.memberId),Status:r.status,Time_Bucket:r.period,
  Indicators:(r.indicatorIds||[]).map(id=>{const i=indicatorById(id);return i?`${i.emoji} ${i.label}`:id}).join('; '),
  Source:r.source||'',Source_Detail:r.sourceDetail||'',Price:r.price,Condition:r.condition||'',Notes:r.notes||'',
  Event_Time:r.occurredAt||'',Event_Time_Approximate:!!r.occurredApprox,Submitted_At:r.createdAt||'',Updated_At:r.updatedAt||'',
  Confirmations:r.confirmations||0,Disputes:r.disputes||0
 }));
 const stores=data.stores.map(s=>({Store_ID:s.id,Name:s.name,Chain:s.chain||'',Address:s.address||'',City:s.city||'',State:s.state||'',ZIP:s.postalCode||'',Latitude:s.lat,Longitude:s.lng,Active:s.active,Created_By:s.createdBy||'',Created_At:s.createdAt||'',Updated_At:s.updatedAt||''}));
 const products=data.products.map(p=>({Product_ID:p.id,Name:p.name,TCG:p.tcg,Set:p.setName||'',SKU:p.sku||'',UPC:p.upc||'',Active:p.active,Created_By:p.createdBy||'',Created_At:p.createdAt||'',Updated_At:p.updatedAt||''}));
 const members=data.members.map(m=>({Member_ID:m.id,Name:m.name,Username:m.username||'',Email:m.email||'',Role:m.role,Enabled:m.enabled!==false,Ranking_Title:rankTitle(m),Points:pointsFor(m),Reports:m.reports||0,Confirmations:m.confirmations||0,Active_Days:m.activeDays||0,Sessions:m.sessions||0,Logins:m.logins||0,Last_Active:m.lastActive||'',Last_Login:m.lastLogin||''}));
 const changes=(data.changeLog||[]).map(l=>({Change_ID:l.id,Entity_Type:l.entity_type,Entity_ID:l.entity_id,Action:l.action,Changed_By:l.actor_name||l.actor_id,Changed_At:l.changed_at,Before_JSON:JSON.stringify(l.before_data||{}),After_JSON:JSON.stringify(l.after_data||{})}));
 const indicators=(data.indicators||[]).map(i=>({Indicator_ID:i.id,Emoji:i.emoji,Label:i.label,Active:i.active,Sort_Order:i.sortOrder}));
 for(const [name,rows] of [['Reports',reports],['Stores',stores],['Products',products],['Members',members],['Indicators',indicators],['Change Log',changes]]){const ws=XLSX.utils.json_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,name)}
 const stamp=new Date().toISOString().slice(0,10);
 XLSX.writeFile(wb,`ChaseDex_Admin_Export_${stamp}.xlsx`);
}

function routeSheet(){
 const stores=routeSelectedStores();
 if(!stores.length)return'';
 return `<div class="sheet"><div class="sheet-card"><div class="sheet-title"><div><h2>Open route</h2><div class="tiny">${stores.length} ${stores.length===1?'store':'stores'} selected</div></div><button class="close" data-action="close-sheet">×</button></div><div class="route-summary">${stores.map((s,i)=>`<div class="route-stop"><span>${i+1}</span><div><b>${esc(s.name)}</b><small>${esc(s.address||'')}</small></div></div>`).join('')}</div><div class="distance-disclosure">Nearest sorting in ChaseDex uses straight-line distance. Your navigation app calculates the actual driving route, road distance and ETA.</div><button class="btn wide" data-action="open-google-route">Open in Google Maps</button>${stores.length===1?`<button class="btn secondary wide" data-action="open-waze-route">Open in Waze</button>`:`<div class="tiny" style="margin-top:10px">Multi-stop routing opens in Google Maps. Waze web links support one destination at a time.</div>`}</div></div>`;
}
function membersSheet(){return `<div class="sheet"><div class="sheet-card"><div class="sheet-title"><h2>Members</h2><button class="close" data-action="close-sheet">×</button></div>${data.members.map(m=>`<div class="trend-row"><div><b>${esc(m.name)}</b><div class="tiny">${esc(m.email||'')} · ${m.role}${m.enabled===false?' · Disabled':''}</div></div>${m.role==='admin'?'<span class="badge">Owner</span>':m.enabled===false?`<button class="chip" data-action="enable-member" data-id="${m.id}">Restore</button>`:`<button class="chip" data-action="remove-member" data-id="${m.id}">Disable</button>`}</div>`).join('')}<div class="field"><label>Invite by email</label><input id="invite-email" type="email" placeholder="friend@example.com"></div><button class="btn wide" data-action="invite-member">Copy invite instructions</button><div class="tiny" style="margin-top:8px">For launch, new auth users are invited from Supabase Authentication → Users. This keeps the service-role key out of the PWA.</div></div></div>`}


function profileSheet(){const m=currentMember();return `<div class="sheet"><div class="sheet-card"><div class="sheet-title"><h2>Edit my profile</h2><button class="close" data-action="close-sheet">×</button></div><div class="profile-preview">${avatar(m,'avatar large-avatar')}<div><b>${esc(m.name)}</b><small>${esc(rankTitle(m))} · ${pointsFor(m)} points</small></div></div><div class="field"><label>Username</label><input id="profile-name" value="${esc(m.name)}" maxlength="30"></div><div class="field"><label>Profile picture</label><input id="profile-avatar" type="file" accept="image/*"></div><button class="btn wide" data-action="save-profile">Save profile</button><div class="tiny" style="margin-top:8px">Profile pictures are shared through Supabase Storage.</div><div class="security-section"><h3>Account Security</h3><div class="tiny">Set or change your ChaseDex password for normal sign-in.</div><div class="field"><label>New password</label><input id="new-password" type="password" minlength="8" placeholder="At least 8 characters" autocomplete="new-password"></div><div class="field"><label>Confirm password</label><input id="confirm-password" type="password" minlength="8" placeholder="Re-enter password" autocomplete="new-password"></div><button class="btn wide" data-action="set-password">Set password</button></div><div class="security-section"><h3>Help & App Maintenance</h3><p><b>Android:</b> If ChaseDex is stuck on an old version, remove the installed app, open ChaseDex in Chrome, choose Add to Home screen / Install app, then sign in again.</p><p><b>iPhone / iPad:</b> Remove ChaseDex from the Home Screen, open ChaseDex in Safari, tap Share → Add to Home Screen, then sign in again.</p><div class="tiny">Reinstall when an update does not appear, an old version remains cached, or the app persistently shows a blank/loading screen.</div></div></div></div>`}
function readImage(file,max=320){return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>{const img=new Image();img.onload=()=>{const scale=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.82))};img.onerror=reject;img.src=fr.result};fr.onerror=reject;fr.readAsDataURL(file)})}
function driveStore(id){const s=data.stores.find(x=>x.id===id);if(!s)return;const dest=Number.isFinite(Number(s.lat))&&Number.isFinite(Number(s.lng))?`${s.lat},${s.lng}`:(s.address||s.name);location.href='https://www.google.com/maps/dir/?api=1&travelmode=driving&destination='+encodeURIComponent(dest)}

async function shareStore(storeId){const s=data.stores.find(x=>x.id===storeId),r=latestReport(storeId);const text=`ChaseDex — ${s.name}: ${r?`${(statusMeta[r.status]||statusMeta.unchecked).label} ${reportFlags(r)} · ${r.period} · ${fmtTime(r.occurredAt)}`:'Not checked recently'}.`;const url=location.href.split('#')[0]+'#store='+encodeURIComponent(storeId);if(navigator.share){try{await navigator.share({title:'ChaseDex update',text,url});return}catch{}}location.href='sms:?&body='+encodeURIComponent(`${text} ${url}`)}
async function shareReport(id){const r=data.reports.find(x=>x.id===id),s=data.stores.find(x=>x.id===r.storeId);const text=`ChaseDex — ${s?.name}: ${statusMeta[r.status]?.label||'Update'} ${reportFlags(r)} · ${r.period} · ${fmtTime(r.occurredAt)}.`;const url=location.href.split('#')[0]+'#report='+encodeURIComponent(id);if(navigator.share){try{await navigator.share({title:'ChaseDex report',text,url});return}catch{}}location.href='sms:?&body='+encodeURIComponent(`${text} ${url}`)}
function openSearch(q){window.open('https://www.google.com/search?q='+encodeURIComponent(q),'_blank','noopener')}

function loadingView(){return `<div class="login"><div class="login-card">${localBrandIcon('large')}<h1>${esc(appName())}</h1><p>Finding your next hit...</p></div></div>`}
function render(){
 document.querySelectorAll('.magic-modal-backdrop').forEach(x=>x.remove());
 const root=document.getElementById('app');
 if(!appReady){root.innerHTML=loadingView();return;}
 root.innerHTML=(currentMember())?shell():loginView();
 document.body.insertAdjacentHTML('beforeend',magicLinkSentModal());
 if(currentMember()){
  setTimeout(renderMap,0);
  if(state.sheet==='store-add'||state.sheet==='store-edit'){const lat=document.getElementById('new-lat')?.value,lng=document.getElementById('new-lng')?.value;if(lat&&lng)setTimeout(()=>renderStorePreview(lat,lng),0)}
  const sm=location.hash.match(/store=([^&]+)/);const rm=location.hash.match(/report=([^&]+)/);
  if(sm&&!state.sheet){state.selectedStore=decodeURIComponent(sm[1]);state.sheet='store';setTimeout(render,0)}else if(rm&&!state.sheet){state.reportId=decodeURIComponent(rm[1]);state.sheet='report-detail';setTimeout(render,0)}
 }
}
async function refreshShared({quiet=true}={}){
 if(!backendConfigured)return;
 try{data=await loadSharedData(authSession);data.indicators??=[];data.changeLog??=[];save();applyBranding();render();if(!quiet)toast('Updated')}catch(err){console.error(err);if(!quiet)toast(err.message||'Could not refresh')}
}
function scheduleRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refreshShared(),250)}

document.addEventListener('click',async e=>{
 const modalAction=e.target instanceof Element?e.target.closest('[data-action]')?.dataset.action:null;
 if(modalAction==='magic-sent-close'||modalAction==='magic-password-login'){state.magicSent=false;render();return}

 const el=e.target.closest('[data-action]');if(!el)return;const a=el.dataset.action;
 try{
  if(a==='invite-start'){state.inviteStep=true;loginNotice='';render();return}
  if(a==='invite-back'){state.inviteStep=false;loginNotice='';render();return}
  if(a==='forgot-password'){const email=document.getElementById('email')?.value.trim();if(!email){loginNotice='Enter your existing member email first.';render();return}await sendPasswordReset(email);pendingEmail=email;loginNotice='Password reset email sent. Open the newest email and choose a new password.';render();return}
  if(a==='invite-create-account'){const code=document.getElementById('invite-code')?.value.trim().toUpperCase(),email=document.getElementById('invite-email-login')?.value.trim(),username=document.getElementById('invite-username')?.value.trim(),pw=document.getElementById('invite-password')?.value||'',confirmPw=document.getElementById('invite-password-confirm')?.value||'';if(!code||!email||!username||!pw||!confirmPw){loginNotice='Complete all fields.';render();return}if(pw.length<8){loginNotice='Password must be at least 8 characters.';render();return}if(pw!==confirmPw){loginNotice='Passwords do not match.';render();return}await validateInviteCode(code);const result=await signUpWithInvite(email,pw,code,username);pendingEmail=email;state.inviteCode='';state.inviteStep=false;if(result.session){authSession=result.session;loginNotice='';await refreshShared({quiet:true});state.view='home'}else loginNotice='Account created. Check your email to confirm your account, then sign in.';render();return}
  if(a==='ack-update'){localStorage.setItem('chasedex-ack-version',data.settings?.appVersion||APP_VERSION);render();return}
  if(a==='password-login'){
   const email=document.getElementById('email')?.value.trim();const password=document.getElementById('password')?.value||'';
   if(!email||!password){loginNotice='Enter your email and password.';render();return}
   pendingEmail=email;loginNotice='Signing in…';render();
   try{
    const session=await signInWithPassword(email,password);
    if(!session)throw new Error('Sign-in did not return a session.');
    authSession=session;loginNotice='';await recordLogin();await refreshShared({quiet:true});state.view='home';state.sheet=null;render();
   }catch(err){console.error(err);loginNotice=String(err?.message||'Could not sign in. Check your email and password.');render()}
   return;
  }
  if(a==='logout'){
   if(authSession){await backendSignOut();authSession=null;data=seed();}
   else 
   state.view='home';state.sheet=null;history.replaceState(null,'',location.pathname+location.search);render();return;
  }
  if(a==='nav'){state.view=el.dataset.view;state.sheet=null;if(state.view==='activity')localStorage.setItem('chasedex-last-activity-seen',new Date().toISOString());history.pushState({chasedex:true,view:state.view},'',location.href);render();return}
  if(a==='store-quick'){state.selectedStore=el.dataset.id;openSheet('store');return}
  if(a==='map-focus-store'){state.focusStoreId=el.dataset.id;render();setTimeout(()=>document.getElementById('map')?.scrollIntoView({behavior:'smooth',block:'center'}),40);return}
  if(a==='quick-report'){if(!isMember())return toast('Sign in to report');state.selectedStore=el.dataset.id;state.sheetBack=null;openSheet('report');return}
  if(a==='start-quick'){if(!isMember())return toast('Sign in to report');state.selectedStore=el.dataset.id;state.sheetBack='store';openSheet('report');return}
  if(a==='close-sheet'){if(state.sheet==='report'&&state.sheetBack==='store'){state.sheet='store';state.sheetBack=null}else{state.sheet=null;state.sheetBack=null;history.replaceState(null,'',location.pathname+location.search)}render();return}
  if(a==='open-stores'){if(!isMember())return toast('Members only');state.view='products';state.sheet=null;render();return}
  if(a==='activity-metric'){state.activityMetric=el.dataset.metric;render();return}
  if(a==='open-product-add'){if(!isMember())return toast('Members only');state.sheet='product-add';render();return}
  if(a==='product-detail'){state.productId=el.dataset.id;state.sheet='product-detail';render();return}
  if(a==='report-detail'){state.reportId=el.dataset.id;state.sheet='report-detail';render();return}
  if(a==='map-status-toggle'){const k=el.dataset.status;state.mapStatuses=state.mapStatuses.includes(k)?state.mapStatuses.filter(x=>x!==k):[...state.mapStatuses,k];render();return}
  if(a==='map-indicator-toggle'){const id=el.dataset.id;state.mapIndicatorFilters=state.mapIndicatorFilters.includes(id)?state.mapIndicatorFilters.filter(x=>x!==id):[...state.mapIndicatorFilters,id];render();return}
  if(a==='map-move-toggle'){state.mapMoveEnabled=!state.mapMoveEnabled;render();return}
  if(a==='manage-kind'){state.manageKind=el.dataset.kind;render();return}
  if(a==='open-store-add'){state.sheet='store-add';state.editId=null;render();return}
  if(a==='edit-store'){state.sheet='store-edit';state.editId=el.dataset.id;render();return}
  if(a==='edit-product'){state.sheet='product-edit';state.editId=el.dataset.id;render();return}
  if(a==='edit-report'){state.sheet='report-edit';state.editId=el.dataset.id;render();return}
  if(a==='export-excel'){if(currentMember()?.role!=='admin')return toast('Admin only');await exportAdminExcel();return}
  if(a==='indicator-add'){state.sheet='indicator-edit';state.editId=null;render();return}
  if(a==='indicator-edit'){state.sheet='indicator-edit';state.editId=el.dataset.id;render();return}
  if(a==='map-locate'||a==='map-nearest'){
   try{state.userLocation=await requestCurrentLocation();state.mapSort='nearest';render()}catch(err){toast(err.message||'Could not get current location')}
   return;
  }
  if(a==='route-clear'){state.routeSelected=[];render();return}
  if(a==='route-open'){if(!state.routeSelected.length)return;state.sheet='route';render();return}
  if(a==='route-cancel'){state.routeMode=false;state.routeSelected=[];render();return}
  if(a==='route-build'){if(!state.routeSelected.length)return;state.sheet='route';render();return}
  if(a==='open-google-route'){const url=googleRouteUrl(routeSelectedStores());if(url)location.href=url;return}
  if(a==='open-waze-route'){const s=routeSelectedStores()[0],url=wazeRouteUrl(s);if(url)location.href=url;return}
  if(a==='members-manage'){if(currentMember()?.role!=='admin')return toast('Admin only');state.sheet='members-manage';render();return}
  if(a==='edit-profile'){if(!isMember())return toast('Members only');state.sheet='profile';render();return}
  if(a==='open-admin'){if(currentMember()?.role!=='admin')return toast('Admin only');state.view='admin';state.sheet=null;render();return}
  if(a==='drive-store'){driveStore(el.dataset.id);return}
  if(a==='submit-report'){
   const m=currentMember();if(!m)return toast('Sign in to report');
   const status=document.querySelector('input[name="r-status"]:checked')?.value||'unsure';
   const period=document.querySelector('input[name="r-period"]:checked')?.value||periodFor(new Date());
   const occurredRaw=document.getElementById('r-occurred')?.value;const price=parseFloat(document.getElementById('r-price')?.value);
   const r={storeId:document.getElementById('r-store').value,status,indicatorIds:[...document.querySelectorAll('.r-indicator:checked')].map(x=>x.dataset.id),flags:{},occurredAt:occurredRaw?new Date(occurredRaw).toISOString():iso(),occurredApprox:!!occurredRaw,dropEventId:state.pendingDropEvent||null,period,source:document.getElementById('r-source')?.value||'Firsthand',notes:document.getElementById('r-notes')?.value||'',productId:document.getElementById('r-product')?.value||null,price:Number.isFinite(price)?price:null,condition:document.getElementById('r-condition')?.value||null,memberId:m.id};
   await createReport(r);state.pendingDropEvent=null;state.sheet='store';state.selectedStore=r.storeId;await refreshShared();toast('Report added');return;
  }
  if(a==='text-store'){await shareStore(el.dataset.id);return}
  if(a==='share-report'){await shareReport(el.dataset.id);return}
  if(a==='report-tcg'){document.querySelectorAll('[data-action=report-tcg]').forEach(x=>x.classList.toggle('active',x===el));document.querySelectorAll('.product-wheel-item').forEach(x=>x.classList.toggle('tcg-hidden',x.dataset.tcg!==el.dataset.tcg));const h=document.getElementById('r-product');if(h)h.value='';return}
  if(a==='pick-product'){const p=data.products.find(x=>x.id===el.dataset.id),hidden=document.getElementById('r-product');if(p&&hidden){hidden.value=p.id;document.querySelectorAll('.product-wheel-item').forEach(x=>x.classList.toggle('active',x.dataset.id===p.id));el.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'})}return}
  if(a==='create-invite'){const label=document.getElementById('invite-label')?.value.trim()||'';const invite=await createInviteCode(label);await refreshShared();await navigator.clipboard?.writeText(invite.code);toast(`Invite ${invite.code} copied`);return}
  if(a==='copy-invite'){await navigator.clipboard?.writeText(el.dataset.code);toast('Invite code copied');return}
  if(a==='revoke-invite'){await revokeInviteCode(el.dataset.id);await refreshShared();toast('Invite revoked');return}
  if(a==='admin-log-action'){state.adminLogAction=el.dataset.value;render();return}
  if(a==='admin-log-entity'){state.adminLogEntity=el.dataset.value;render();return}
  if(a==='sku-lookup'){const q=document.getElementById('sku-lookup').value.trim();if(q)openSearch(q+' trading card product SKU UPC');return}
  if(a==='web-product'){const p=data.products.find(x=>x.id===el.dataset.id);if(p)openSearch(`${p.sku||''} ${p.tcg} ${p.name}`.trim());return}
  if(a==='save-store'){
   const n=document.getElementById('new-store').value.trim(),address=document.getElementById('new-address').value.trim(),lat=parseFloat(document.getElementById('new-lat').value),lng=parseFloat(document.getElementById('new-lng').value);
   if(!n||!Number.isFinite(lat)||!Number.isFinite(lng))return toast('Add name, latitude and longitude');
   await updateStore(el.dataset.id,{name:n,address,lat,lng,storeType:document.getElementById('new-store-type').value});await refreshShared();state.sheet=null;toast('Store updated');return;
  }
  if(a==='delete-store'){if(!confirm('Delete this store from ChaseDex? Existing reports remain in the history/change log.'))return;await deleteStore(el.dataset.id);await refreshShared();state.sheet=null;toast('Store deleted');return}
  if(a==='save-product'){const name=document.getElementById('new-product').value.trim(),tcg=document.getElementById('new-tcg').value.trim();if(!name||!tcg)return toast('Add product name and TCG');await updateProduct(el.dataset.id,{name,tcg,setName:document.getElementById('new-set').value.trim(),sku:document.getElementById('new-sku').value.trim()});await refreshShared();state.sheet=null;toast('Product updated');return}
  if(a==='delete-product'){if(!confirm('Delete this product from ChaseDex?'))return;await deleteProduct(el.dataset.id);await refreshShared();state.sheet=null;toast('Product deleted');return}
  if(a==='save-report'){
   const price=parseFloat(document.getElementById('er-price').value),occurred=document.getElementById('er-occurred').value;
   await updateReport(el.dataset.id,{storeId:document.getElementById('er-store').value,productId:document.getElementById('er-product').value||null,status:document.querySelector('input[name="er-status"]:checked')?.value||'empty',period:document.getElementById('er-period').value,indicatorIds:[...document.querySelectorAll('.er-indicator:checked')].map(x=>x.dataset.id),source:document.getElementById('er-source').value,notes:document.getElementById('er-notes').value,price:Number.isFinite(price)?price:null,condition:document.getElementById('er-condition').value||null,occurredAt:occurred?new Date(occurred).toISOString():iso(),occurredApprox:false});
   await refreshShared();state.sheet=null;state.view='activity';toast('Report updated');return;
  }
  if(a==='delete-report'){if(!confirm('Delete this report? Admin will still see the change in the audit log.'))return;await deleteReport(el.dataset.id);await refreshShared();state.sheet=null;state.view='activity';toast('Report deleted');return}
  if(a==='save-indicator'){const label=document.getElementById('ind-label').value.trim(),emoji=document.getElementById('ind-emoji').value.trim();if(!label||!emoji)return toast('Emoji and label are required');await saveIndicator({id:el.dataset.id||null,label,emoji,active:true});await refreshShared();state.sheet=null;toast('Indicator saved');return}
  if(a==='delete-indicator'){if(!confirm('Remove this indicator from future report forms? Historical reports keep it.'))return;await deleteIndicator(el.dataset.id);await refreshShared();state.sheet=null;toast('Indicator removed');return}
  if(a==='add-product'){
   const m=currentMember(),n=document.getElementById('new-product').value.trim(),tcg=document.getElementById('new-tcg').value,sku=document.getElementById('new-sku').value.trim();
   if(n&&m){await createProduct({name:n,tcg,sku,upc:sku},m.id);state.sheet=null;await refreshShared();toast('Product added')}return;
  }
  if(a==='select-store-result'){
   const box=document.getElementById('store-suggestions'),r=box?._results?.[Number(el.dataset.index)];if(!r)return;
   const name=document.getElementById('new-store'),address=document.getElementById('new-address'),lat=document.getElementById('new-lat'),lng=document.getElementById('new-lng'),search=document.getElementById('store-search');
   if(name)name.value=storeResultName(r);if(address)address.value=storeResultAddress(r);if(lat)lat.value=r.lat??'';if(lng)lng.value=r.lon??'';if(search)search.value=storeResultName(r);box.hidden=true;const status=document.getElementById('store-selection-status');if(status)status.textContent='✓ Location selected — verify the address and map preview before saving.';renderStorePreview(r.lat,r.lon);return;
  }
  if(a==='add-store'){
   const m=currentMember(),n=document.getElementById('new-store').value.trim(),address=document.getElementById('new-address').value.trim(),lat=parseFloat(document.getElementById('new-lat').value),lng=parseFloat(document.getElementById('new-lng').value);
   if(n&&m&&Number.isFinite(lat)&&Number.isFinite(lng)){await createStore({name:n,address,lat,lng,storeType:document.getElementById('new-store-type').value},m.id);state.manageKind='stores';state.view='products';state.sheet=null;await refreshShared();toast('Store added')}else toast('Add name, latitude and longitude');return;
  }
  if(a==='activity-range'){state.activityRange=Number(el.dataset.range)||7;render();return}
  if(a==='drop-add'){openSheet('drop-add');return}
  if(a==='drop-save'){const starts=document.getElementById('de-start').value;if(!starts)return toast('Add a date and time');const price=parseFloat(document.getElementById('de-price').value);await createDropEvent({eventType:document.getElementById('de-type').value,storeId:document.getElementById('de-store').value,productId:document.getElementById('de-product').value||null,startsAt:new Date(starts).toISOString(),sourceType:document.getElementById('de-source').value,confidence:document.getElementById('de-confidence').value,price:Number.isFinite(price)?price:null,purchaseRules:document.getElementById('de-rules').value.trim(),notes:document.getElementById('de-notes').value.trim()});state.sheet=null;await refreshShared();toast('Drop added');return}
  if(a==='drop-watch'){await toggleDropWatch(el.dataset.id,currentMember()?.id);await refreshShared();toast('Drop watch updated');return}
  if(a==='drop-report'){const ev=(data.dropEvents||[]).find(x=>x.id===el.dataset.id);if(ev){state.selectedStore=ev.storeId;state.pendingDropEvent=ev.id;openSheet('report')}return}
  if(a==='admin-purge-report'){if(currentMember()?.role!=='admin'||!confirm('Permanently delete this report and related feedback/indicator values? This cannot be undone.'))return;await permanentDeleteReport(el.dataset.id);await refreshShared();toast('Report permanently deleted');return}
  if(a==='admin-purge-log'){if(currentMember()?.role!=='admin'||!confirm('Permanently delete this change-log record?'))return;await permanentDeleteChangeLog(el.dataset.id);await refreshShared();toast('Change-log record deleted');return}
  if(a==='analytics-mode'){state.analyticsMode=el.dataset.mode;render();return}
  if(a==='save-analytics'){
   const m=currentMember();if(!m)return toast('Sign in to save Analytics');const name=prompt('Name this trend');if(name){await backendSaveAnalytics(name,state.analytics,m.id);await refreshShared();toast('Trend saved')}return;
  }
  if(a==='load-analytics'){const f=data.savedFilters.find(x=>x.id===el.dataset.id);if(f){state.analytics={...state.analytics,...f};render()}return}
  if(a==='feedback'){const m=currentMember();if(!m)return;await setReportFeedback(el.dataset.id,m.id,el.dataset.kind);await refreshShared();toast(el.dataset.kind==='confirm'?'Report confirmed':'Report disputed');return}
  if(a==='enable-member'){if(currentMember()?.role!=='admin')return;await setMemberEnabled(el.dataset.id,true);await refreshShared();toast('Member restored');return}
  if(a==='remove-member'){
   if(currentMember()?.role!=='admin')return;const member=data.members.find(m=>m.id===el.dataset.id);if(!member||member.role==='admin')return;
   if(confirm(`Disable ${member.name}'s member access?`)){await setMemberEnabled(member.id,false);await refreshShared();toast('Member disabled')}return;
  }
  if(a==='save-ranks'){
   if(currentMember()?.role!=='admin')return;const levels=data.settings.rankingTitles.map((x,i)=>({id:x.id,min:Number(document.getElementById('rank-min-'+i).value)||0,title:document.getElementById('rank-title-'+i).value.trim()||x.title})).sort((a,b)=>a.min-b.min);
   await updateRankingTiers(levels);await refreshShared();toast('Ranking titles saved');return;
  }
  if(a==='set-password'){
   const pw=document.getElementById('new-password')?.value||'', confirmPw=document.getElementById('confirm-password')?.value||'';
   if(pw.length<8){toast('Password must be at least 8 characters.');return}
   if(pw!==confirmPw){toast('Passwords do not match.');return}
   try{
    await updatePassword(pw);
    const p1=document.getElementById('new-password'),p2=document.getElementById('confirm-password');
    if(p1)p1.value='';if(p2)p2.value='';
    toast('Password updated. Use it for normal sign-in.');
   }catch(err){console.error(err);toast(String(err?.message||'Could not update password.'))}
   return;
  }
  if(a==='save-profile'){
   const m=currentMember();if(!m)return;const name=document.getElementById('profile-name').value.trim(),file=document.getElementById('profile-avatar').files[0];let avatarPath=m.avatarPath||null;
   if(file){const blob=await resizeImageBlob(file,500,0.82);avatarPath=await uploadProfileImage(m.id,blob)}
   await updateMyProfile(name,name,avatarPath);state.sheet=null;await refreshShared();toast('Profile saved');return;
  }
  if(a==='invite-member'){
   const em=document.getElementById('invite-email').value.trim();if(em){const text=`Invite ${em}: Supabase Dashboard → Authentication → Users → Add user → Send invitation.`;await navigator.clipboard?.writeText(text);toast('Invite instructions copied')}return;
  }
  if(a==='share-app'){if(navigator.share)await navigator.share({title:appName(),text:`Join my local ${appName()} group`,url:location.href});else await navigator.clipboard?.writeText(location.href).then(()=>toast('App link copied'));return}
 }catch(err){console.error(err);toast(err?.message||'Something went wrong')}
});

document.addEventListener('change',e=>{const t=e.target;if(t.dataset.change==='route-store'){toggleRouteStore(t.dataset.id);render();return}if(t.dataset.change==='activity-store'){state.activityStore=t.value;localStorage.setItem('chasedex-activity-store',t.value);render()}if(t.dataset.change==='analytics'){state.analytics={...state.analytics,tcg:document.getElementById('a-tcg').value,productId:document.getElementById('a-product').value,storeId:document.getElementById('a-store').value,range:Number(document.getElementById('a-range').value)};if(t.id==='a-tcg')state.analytics.productId='All';render()}});

document.addEventListener('input',e=>{
 if(e.target.id==='new-lat'||e.target.id==='new-lng'){const lat=document.getElementById('new-lat')?.value,lng=document.getElementById('new-lng')?.value;if(lat&&lng)renderStorePreview(lat,lng);return}
 if(e.target.id!=='store-search')return;clearTimeout(storeLookupTimer);const q=e.target.value;const box=document.getElementById('store-suggestions');if(q.trim().length<3){if(box)box.hidden=true;return}
 storeLookupTimer=setTimeout(async()=>{try{showStoreSuggestions(await lookupStores(q))}catch(err){if(err.name!=='AbortError'){console.error(err);if(box){box.innerHTML='<div class="lookup-empty">Lookup unavailable. Manual entry still works.</div>';box.hidden=false}}}},350)
});

window.addEventListener('popstate',()=>{if(state.sheet){state.sheet=null;state.sheetBack=null;render();return}if(state.view!=='home'){state.view='home';render();history.pushState({chasedex:true,view:'home'},'',location.href)}});
function resizeImageBlob(file,max=500,quality=.82){return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>{const img=new Image();img.onload=()=>{const scale=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);c.toBlob(b=>b?resolve(b):reject(new Error('Could not resize image')),'image/jpeg',quality)};img.onerror=reject;img.src=fr.result};fr.onerror=reject;fr.readAsDataURL(file)})}

async function init(){
 try{
  if(!backendConfigured){appReady=true;render();return}
  const authUrl=new URL(window.location.href);const recoveryRedirect=authUrl.searchParams.get('type')==='recovery'||new URLSearchParams(window.location.hash.replace(/^#/,'')).get('type')==='recovery';
  authSession=await getAuthSession();history.replaceState({chasedex:true,view:'home'},'',location.href);
  data=await loadSharedData(authSession);data.indicators??=[];data.changeLog??=[];data.invites??=[];save();applyBranding();if(recoveryRedirect&&authSession){state.view='home';state.sheet='profile';loginNotice='';}appReady=true;render();if(authSession){requestCurrentLocation().then(loc=>{state.userLocation=loc;state.mapSort='nearest';render()}).catch(()=>{})}
  if(authSession){await recordSession();if(!localStorage.getItem('chasedex-last-activity-seen'))localStorage.setItem('chasedex-last-activity-seen',new Date().toISOString());}
  realtimeChannel=subscribeRealtime(scheduleRefresh);
  onAuthStateChange(async(event,session)=>{
   const was=authSession;authSession=session;
   if(event==='SIGNED_IN'&&session&&(!was||was.user.id!==session.user.id))await recordLogin();
   if(event==='PASSWORD_RECOVERY'&&session){state.view='home';state.sheet='profile';toast('Create your new ChaseDex password below.');}
   if(event==='SIGNED_OUT'){data=seed();state.view='home';state.sheet=null;}
   await refreshShared();appReady=true;render();
  });
 }catch(err){console.error(err);loginNotice=err?.message||'Could not start ChaseDex';appReady=true;render();}
}
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));
applyBranding();render();init();

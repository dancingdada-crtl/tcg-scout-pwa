import { GEOAPIFY_API_KEY } from './geoapify-config.js';
import { backendConfigured, getAuthSession, onAuthStateChange, sendMagicLink, signInWithPassword, updatePassword, signOut as backendSignOut, recordLogin, recordSession, loadSharedData, createReport, createStore, createProduct, saveAnalytics as backendSaveAnalytics, uploadProfileImage, updateMyProfile, updateRankingTiers, setMemberEnabled, updateStore, deleteStore, updateProduct, deleteProduct, updateReport, deleteReport, saveIndicator, deleteIndicator, setReportFeedback, subscribeRealtime } from './backend.js';

const KEY='tcg-scout-v1-data';
const iso=(d=new Date())=>d.toISOString();
const uid=()=>crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2);
const esc=s=>String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[m]));
const fmtTime=s=>new Date(s).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
const fmtDate=s=>new Date(s).toLocaleDateString([], {month:'short',day:'numeric'});
const periodFor=d=>{const h=new Date(d).getHours();if(h<11)return'Morning';if(h<13)return'Noon';if(h<17)return'Afternoon';return'Evening'};
const toLocalInput=s=>{if(!s)return'';const d=new Date(s),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`};

const statusMeta={stock:{label:'Stock reported today',icon:'●',cls:'green'},empty:{label:'No stock reported today',icon:'●',cls:'red'},unchecked:{label:"Hasn't been checked today",icon:'●',cls:'yellow'}};
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
let state={view:'home',sheet:null,selectedStore:null,activityStore:'All',activityMetric:'stock',mapSort:'default',userLocation:null,routeMode:false,routeSelected:[],mapStatuses:['stock','empty','unchecked'],mapIndicatorFilters:[],manageKind:'stores',editId:null,analytics:{metric:'stock',tcg:'All',productId:'All',storeId:'All',period:'All',range:30,groupBy:'day'},toast:null};
function save(){localStorage.setItem(KEY,JSON.stringify(data))}
let authSession=null;let viewerMode=false;let appReady=false;let realtimeChannel=null;let refreshTimer=null;let loginNotice='';let pendingEmail='';let magicCooldownUntil=0;let magicCooldownTimer=null;
function localBrandIcon(sizeClass=''){return `<img class="brand-icon${sizeClass?' '+sizeClass:''}" src="./icon-192.png" alt="ChaseDex">`}
function magicCooldownSeconds(){return Math.max(0,Math.ceil((magicCooldownUntil-Date.now())/1000))}
function startMagicCooldown(seconds){
 magicCooldownUntil=Date.now()+Math.max(1,Number(seconds)||30)*1000;clearInterval(magicCooldownTimer);
 magicCooldownTimer=setInterval(()=>{if(!magicCooldownSeconds()){clearInterval(magicCooldownTimer);magicCooldownTimer=null;loginNotice='You can request another magic link now.'}render()},1000);
}
function currentMember(){return authSession?data.members.find(m=>m.id===authSession.user.id)||null:null}
function isMember(){return !!currentMember()}
function isViewer(){return viewerMode&&!authSession}
function activeStores(){return data.stores.filter(x=>x.active)}
function activeProducts(){return data.products.filter(x=>x.active)}
function toast(msg){state.toast=msg;render();setTimeout(()=>{state.toast=null;render()},1800)}
function last7(){return Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));d.setHours(0,0,0,0);return d})}
function visibleReports(){return data.reports.filter(r=>!r.deletedAt)}
function reportsForStore(id){return visibleReports().filter(r=>r.storeId===id).sort((a,b)=>new Date(b.occurredAt)-new Date(a.occurredAt))}
function latestReport(id){return reportsForStore(id)[0]||null}
function todayReports(id){const now=new Date();return reportsForStore(id).filter(r=>sameDay(r.occurredAt,now))}
function todayLatestReport(id){return todayReports(id)[0]||null}
function mapStatusKey(id){const r=todayLatestReport(id);return r?.status==='stock'?'stock':r?.status==='empty'?'empty':'unchecked'}
function mapStatus(id){return statusMeta[mapStatusKey(id)]}
function activeIndicators(){return (data.indicators||[]).filter(i=>i.active)}
function indicatorById(id){return (data.indicators||[]).find(i=>i.id===id)}
function reportFlags(r){return (r?.indicatorIds||[]).map(id=>indicatorById(id)?.emoji).filter(Boolean).join(' ')}
function mapFlags(r){return reportFlags(r)}
function storeTodayIndicatorIds(id){return [...new Set(todayReports(id).flatMap(r=>r.indicatorIds||[]))]}
function storePassesMapFilters(s){const statusOk=state.mapStatuses.includes(mapStatusKey(s.id));if(!statusOk)return false;if(!state.mapIndicatorFilters.length)return true;const ids=storeTodayIndicatorIds(s.id);return state.mapIndicatorFilters.every(id=>ids.includes(id))}
function haversineMiles(a,b){if(!a||!b)return null;const R=3958.7613,toRad=x=>x*Math.PI/180,dLat=toRad(Number(b.lat)-Number(a.lat)),dLng=toRad(Number(b.lng)-Number(a.lng)),lat1=toRad(Number(a.lat)),lat2=toRad(Number(b.lat));const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
function storeDistance(s){return state.userLocation?haversineMiles(state.userLocation,{lat:Number(s.lat),lng:Number(s.lng)}):null}
function sortedHomeStores(){const stores=activeStores().filter(storePassesMapFilters).slice();if(state.mapSort==='nearest'&&state.userLocation)return stores.sort((a,b)=>(storeDistance(a)??Infinity)-(storeDistance(b)??Infinity));return stores.sort((a,b)=>a.name.localeCompare(b.name))}
function selectedRouteStore(id){return state.routeSelected.includes(id)}
function routeSelectedStores(){return state.routeSelected.map(id=>data.stores.find(s=>s.id===id)).filter(Boolean)}

function sameDay(a,b){return new Date(a).toDateString()===new Date(b).toDateString()}
function metricMatch(r,m){if(m==='stock'||m==='empty')return r.status===m;if(m.startsWith('indicator:'))return (r.indicatorIds||[]).includes(m.slice(10));return true}
function countMetric(storeId,date,metric){return visibleReports().filter(r=>(storeId==='All'||r.storeId===storeId)&&sameDay(r.occurredAt,date)&&metricMatch(r,metric)).length}
function appName(){return data.settings?.appName||'ChaseDex'}
function pointsFor(m){return (m.reports||0)+(m.confirmations||0)}
function rankTitle(m){const pts=pointsFor(m),levels=(data.settings?.rankingTitles||[]).slice().sort((a,b)=>Number(a.min)-Number(b.min));return (levels.filter(x=>pts>=Number(x.min)).pop()||{title:'Scout'}).title}
function avatar(m,cls='avatar'){return m?.avatar?`<img class="${cls}" src="${m.avatar}" alt="">`:`<span class="${cls} avatar-fallback">${esc((m?.name||'?').slice(0,1).toUpperCase())}</span>`}
function applyBranding(){document.title=appName();const meta=document.querySelector('meta[name="application-name"]');if(meta)meta.content=appName()}

function loginView(){
 if(!backendConfigured)return `<div class="login"><div class="login-card">${localBrandIcon('large')}<h1>Supabase setup needed</h1><p>V1.3 is ready, but this build still needs your Supabase Project URL and publishable/anon key in <b>supabase-config.js</b>.</p><div class="demo-note">Never use the service_role/secret key in this file.</div></div></div>`;
 return `<div class="login"><div class="login-card">${data.settings?.appIcon?`<img class="brand-icon large" src="${data.settings.appIcon}" alt="ChaseDex">`:localBrandIcon('large')}<h1>${esc(appName())}</h1><p>Fast local restock, price and activity intelligence for your group.</p>${loginNotice?`<div class="login-notice">${esc(loginNotice)}</div>`:''}<div class="field"><label>Email</label><input id="email" type="email" value="${esc(pendingEmail)}" placeholder="you@example.com" autocomplete="email"></div><div class="field"><label>Password</label><input id="password" type="password" placeholder="Your password" autocomplete="current-password"></div><button class="btn wide" data-action="password-login">Sign in</button><div class="login-divider"><span>or</span></div>${(()=>{const n=magicCooldownSeconds();return `<button class="btn secondary wide" data-action="magic-login" ${n?'disabled':''}>${n?`Try magic link again in ${n}s`:'Email me a magic link'}</button>`})()}<button class="btn secondary wide" data-action="public-view">Continue as Public Viewer</button><div class="demo-note">Member signup is invite-only. Use your password for normal sign-in. Magic Link remains available for first-time access or recovery.</div></div></div>`}

function topbar(){const m=currentMember();const who=m?`${esc(m.name)} · ${m.role==='admin'?'Admin':'Member'}`:'Public Viewer';return `<header class="topbar"><div class="brandrow"><div class="brand">${data.settings?.appIcon?`<img class="brand-icon" src="${data.settings.appIcon}" alt="ChaseDex">`:localBrandIcon()}<div><div class="title">${esc(appName())}</div><div class="subtitle">${who}</div></div></div><div class="top-actions"><button class="pill" data-action="share-app">Share</button><button class="pill" data-action="logout">${m?'Sign out':'Sign in'}</button></div></div></header>`}

function nav(){const items=[['home','🗺️','Map'],['activity','▥','Activity'],['analytics','⌁','Analytics'],['products','◫','Manage']];if(isMember())items.push(['members','👥','Members']);if(currentMember()?.role==='admin')items.push(['admin','⚙','Admin']);return `<nav class="bottom-nav" style="grid-template-columns:repeat(${items.length},1fr)">${items.map(([v,i,l])=>`<button class="nav-btn ${state.view===v?'active':''}" data-action="nav" data-view="${v}"><span>${i}</span>${l}</button>`).join('')}</nav>`}

function shell(){const flow=['store','report','report-detail'].includes(state.sheet);if(flow)return `${sheet()}${state.toast?`<div class="toast">${esc(state.toast)}</div>`:''}`;return `<div class="shell">${topbar()}<main>${state.view==='home'?home():state.view==='activity'?activity():state.view==='analytics'?analytics():state.view==='products'?products():state.view==='members'?members():admin()}</main>${nav()}</div>${state.sheet?sheet():''}${state.toast?`<div class="toast">${esc(state.toast)}</div>`:''}`}

function home(){
 const stores=sortedHomeStores(),locNote=state.userLocation?`<div class="distance-note">Distances are straight-line from your current location (“as the crow flies”). Driving distance and ETA may differ.</div>`:'';
 const routeBar=state.routeMode?`<div class="route-bar"><b>${state.routeSelected.length} selected</b><button class="btn secondary" data-action="route-clear">Clear</button><button class="btn" data-action="route-open" ${state.routeSelected.length?'':'disabled'}>Route</button></div>`:'';
 const statusToggles=['stock','empty','unchecked'].map(k=>`<button class="status-filter ${k} ${state.mapStatuses.includes(k)?'active':''}" data-action="map-status-toggle" data-status="${k}"><span class="legend-dot ${statusMeta[k].cls}"></span>${k==='stock'?'Stock today':k==='empty'?'No stock today':'Not checked today'}</button>`).join('');
 const indicatorToggles=activeIndicators().map(i=>`<button class="chip ${state.mapIndicatorFilters.includes(i.id)?'active':''}" data-action="map-indicator-toggle" data-id="${i.id}">${esc(i.emoji)} ${esc(i.label)}</button>`).join('');
 return `<section class="section"><div class="section-head"><div><h2>What's near me</h2><div class="tiny">Today's status, quick reporting and routes.</div></div></div><div class="map-tools"><button class="chip ${state.mapSort==='nearest'?'active':''}" data-action="map-nearest">Nearest</button><button class="chip ${state.routeMode?'active':''}" data-action="route-mode">${state.routeMode?'Selecting route':'Select route'}</button></div>${locNote}<div class="status-toggle-row">${statusToggles}</div>${indicatorToggles?`<div class="indicator-filter-row">${indicatorToggles}</div>`:''}<div class="map-wrap"><div id="map"></div></div>${routeBar}</section><section class="section"><div class="section-head"><h2>Stores</h2><span class="tiny">${stores.length} shown</span></div>${stores.map(store=>{const r=todayLatestReport(store.id),st=mapStatus(store.id),dist=storeDistance(store),selected=selectedRouteStore(store.id);const detail=r?`${r.status==='stock'?'Stock':'No stock'} · ${r.period} · ${fmtTime(r.occurredAt)} ${reportFlags(r)}`:\"Hasn't been checked today\";return `<button class="store-list-card ${selected?'route-selected':''}" data-action="${state.routeMode?'route-toggle-store':'store-quick'}" data-id="${store.id}"><span class="legend-dot ${st.cls}"></span><span><b>${esc(store.name)} ${storeTodayIndicatorIds(store.id).map(id=>indicatorById(id)?.emoji||'').join(' ')}</b><small>${detail}${dist!=null?` · ${dist.toFixed(dist<10?1:0)} mi straight-line`:''}</small></span><span>${state.routeMode?(selected?'✓':'＋'):'›'}</span></button>`}).join('')||'<div class="empty">No stores match these filters.</div>'}</section>`}
function renderMap(){
 const el=document.getElementById('map');if(!el||!window.L)return;
 if(window._map){window._map.remove();window._map=null}
 const stores=sortedHomeStores();const map=L.map(el,{zoomControl:true}).setView([42.6456,-71.315],12);window._map=map;
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
 const pts=[];
 stores.forEach(s=>{if(!Number.isFinite(Number(s.lat))||!Number.isFinite(Number(s.lng)))return;const st=mapStatus(s.id),emojis=storeTodayIndicatorIds(s.id).map(id=>indicatorById(id)?.emoji||'').join('');const icon=L.divIcon({className:'custom-marker',html:`<div class="pin ${st.cls}">${emojis?`<span class="pin-emoji">${emojis}</span>`:''}</div>`,iconSize:[30,38],iconAnchor:[15,38]});const marker=L.marker([s.lat,s.lng],{icon}).addTo(map);marker.on('click',()=>{const fake={dataset:{id:s.id}};if(state.routeMode){state.routeSelected=selectedRouteStore(s.id)?state.routeSelected.filter(x=>x!==s.id):[...state.routeSelected,s.id];render()}else{state.selectedStore=s.id;state.sheet='store';render()}});pts.push([s.lat,s.lng])});
 if(state.userLocation){L.circleMarker([state.userLocation.lat,state.userLocation.lng],{radius:7}).addTo(map).bindTooltip('Your location');pts.push([state.userLocation.lat,state.userLocation.lng])}
 if(pts.length>1)map.fitBounds(pts,{padding:[30,30],maxZoom:14});else if(pts.length===1)map.setView(pts[0],14);
}
function activity(){
 const storeId=state.activityStore,metric=state.activityMetric;
 const metrics=[['stock','Stock'],['empty','No stock'],...activeIndicators().map(i=>[`indicator:${i.id}`,`${i.emoji} ${i.label}`])];
 return `<section class="section"><div class="section-head"><div><h2>7-day activity</h2><div class="tiny">History plus report editing.</div></div></div><div class="card"><div class="field"><label>Store</label><select id="activity-store" data-change="activity-store"><option value="All">All stores</option>${activeStores().map(s=>`<option value="${s.id}" ${storeId===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div><div class="metric-pills">${metrics.map(([k,l])=>`<button class="chip ${metric===k?'active':''}" data-action="activity-metric" data-metric="${k}">${esc(l)}</button>`).join('')}</div><div class="chart-title">${storeId==='All'?'All stores':esc(data.stores.find(s=>s.id===storeId)?.name)} · ${esc(metricLabel(metric))}</div>${sevenBars(storeId,metric)}</div><div class="section-head"><h2>Reports</h2><span class="tiny">Tap to view / edit / delete</span></div>${visibleReports().filter(r=>storeId==='All'||r.storeId===storeId).sort((a,b)=>new Date(b.occurredAt)-new Date(a.occurredAt)).slice(0,50).map(activityRow).join('')||'<div class="empty">No activity yet.</div>'}</section>`}
function activityRow(r){const s=data.stores.find(x=>x.id===r.storeId),p=data.products.find(x=>x.id===r.productId);return `<button class="activity-row" data-action="report-detail" data-id="${r.id}"><span class="legend-dot ${r.status==='stock'?'green':'red'}"></span><span><b>${esc(s?.name||'Store')} · ${r.status==='stock'?'Stock':'No stock'} ${reportFlags(r)}</b><small>${fmtDate(r.occurredAt)} · ${r.period}${p?` · ${esc(p.name)}`:''}</small></span><span>›</span></button>`}
function products(){
 if(!isMember())return `<section class="section"><div class="empty">Sign in to manage stores and products.</div></section>`;
 const kind=state.manageKind||'stores',items=kind==='stores'?data.stores.filter(x=>!x.deletedAt):data.products.filter(x=>!x.deletedAt);
 return `<section class="section"><div class="section-head"><div><h2>Manage</h2><div class="tiny">Add, modify or delete shared stores and products.</div></div><button class="pill" data-action="${kind==='stores'?'open-store-add':'open-product-add'}">＋ Add ${kind==='stores'?'store':'product'}</button></div><div class="manage-toggle"><button class="chip ${kind==='stores'?'active':''}" data-action="manage-kind" data-kind="stores">Stores</button><button class="chip ${kind==='products'?'active':''}" data-action="manage-kind" data-kind="products">Products</button></div><div class="card manage-list-card">${items.map(x=>kind==='stores'?`<button class="manage-item" data-action="edit-store" data-id="${x.id}"><span><b>${esc(x.name)}</b><small>${esc(x.address||'No address')}</small></span><span>›</span></button>`:`<button class="manage-item" data-action="edit-product" data-id="${x.id}"><span><b>${esc(x.name)}</b><small>${esc(x.tcg)}${x.sku?` · ${esc(x.sku)}`:''}</small></span><span>›</span></button>`).join('')||'<div class="empty">Nothing here yet.</div>'}</div></section>`}
function members()function members(){const me=currentMember();if(!me)return '<div class="empty">Sign in as a member to view the member list.</div>';const ranked=data.members.slice().sort((a,b)=>pointsFor(b)-pointsFor(a));return `<section class="section"><div class="section-head"><div><h2>Members</h2><div class="tiny">Contribution ranking and member profiles</div></div><button class="pill" data-action="edit-profile">Edit my profile</button></div><div class="card ranking-list">${ranked.map((m,i)=>`<div class="ranking-row"><div class="rank-num">${i+1}</div>${avatar(m)}<div><b>${esc(m.name)}</b><small>${esc(rankTitle(m))} · ${pointsFor(m)} points</small></div><div class="rank-stats"><b>${m.reports||0}</b><small>reports</small></div></div>`).join('')}</div><div class="tiny contribution-note">Contribution score: 1 point per report + 1 point per confirmation.</div></section>`}
function admin(){
 if(currentMember()?.role!=='admin')return'<div class="empty">Admin only.</div>';
 const logs=(data.changeLog||[]).slice(0,100);
 return `<section class="section"><div class="section-head"><div><h2>Admin</h2><div class="tiny">Indicators, change log and export.</div></div><button class="pill" data-action="export-excel">Export Excel</button></div><div class="card"><div class="section-head compact"><div><h3>Report indicators</h3><div class="tiny">Choices appear in Quick Report, Map filters and Activity.</div></div><button class="chip" data-action="indicator-add">＋ Add</button></div>${(data.indicators||[]).map(i=>`<div class="indicator-admin-row"><span class="indicator-emoji">${esc(i.emoji)}</span><span><b>${esc(i.label)}</b><small>${i.active?'Active':'Removed from form'}</small></span><button class="chip" data-action="indicator-edit" data-id="${i.id}">Edit</button></div>`).join('')||'<div class="empty">No indicators configured.</div>'}</div><div class="card"><div class="section-head compact"><div><h3>Change log</h3><div class="tiny">Who changed stores, products and reports.</div></div></div>${logs.map(l=>`<div class="change-row"><b>${esc(l.action)} · ${esc(l.entity_type)}</b><small>${esc(l.actor_name||l.actor_id||'Unknown')} · ${fmtDate(l.changed_at)} ${fmtTime(l.changed_at)}</small><small>Record ${esc(l.entity_id)}</small></div>`).join('')||'<div class="empty">No changes logged yet.</div>'}</div></section>`}

function sheet(){if(state.sheet==='store')return storeSheet(state.selectedStore);if(state.sheet==='report')return reportSheet(state.selectedStore);if(state.sheet==='report-detail')return reportDetailSheet(state.reportId);if(state.sheet==='report-edit')return reportEditSheet(state.editId);if(state.sheet==='store-add')return storeFormSheet();if(state.sheet==='store-edit')return storeFormSheet(state.editId);if(state.sheet==='product-add')return productFormSheet();if(state.sheet==='product-edit')return productFormSheet(state.editId);if(state.sheet==='indicator-edit')return indicatorSheet(state.editId);if(state.sheet==='profile')return profileSheet();if(state.sheet==='route')return routeSheet();return''}
function storeSheet(id){const s=data.stores.find(x=>x.id===id);if(!s)return'';const r=latestReport(id),st=latestStatus(id);return `<div class="sheet flow-sheet"><div class="sheet-card"><div class="sheet-title"><div><h2>${esc(s.name)}</h2><div class="tiny">${esc(s.address||s.area)}</div></div><button class="close" data-action="close-sheet">×</button></div><div class="quick-status"><span class="status ${st.cls}">${st.label}</span>${r?`<span class="tiny">${fmtDate(r.occurredAt)} · ${r.period} · ${fmtTime(r.occurredAt)} ${reportFlags(r)}</span>`:'<span class="tiny">No recent report</span>'}</div><h3>7-day quick view</h3>${sevenBars(id,'stock')}<div class="sheet-actions">${isMember()?`<button class="btn wide" data-action="start-quick" data-id="${id}">Quick report</button>`:`<button class="btn wide" data-action="logout">Sign in to report</button>`}<button class="btn secondary wide" data-action="drive-store" data-id="${id}">🚗 Drive now</button><button class="btn secondary wide" data-action="text-store" data-id="${id}">Share / alert group</button></div></div></div>`}
function radio(name,value,label,checked){return `<label class="radio-pill"><input type="radio" name="${name}" value="${value}" ${checked?'checked':''}><span>${label}</span></label>`}
function reportSheet(storeId){const now=periodFor(new Date());return `<div class="sheet flow-sheet"><div class="sheet-card"><div class="sheet-title"><div><h2>Quick report</h2><div class="tiny">What's on the shelf right now?</div></div><button class="close" data-action="close-sheet">×</button></div><div class="field"><label>Store</label><select id="r-store">${activeStores().map(s=>`<option value="${s.id}" ${storeId===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div><div class="field"><label>Status</label><div class="radio-grid">${radio('r-status','stock','Stock',true)}${radio('r-status','empty','No stock',false)}</div></div><div class="field"><label>Time bucket</label><div class="radio-grid four">${data.settings.periods.map(x=>radio('r-period',x,x,now===x)).join('')}</div></div>${activeIndicators().length?`<div class="field"><label>Indicators <span class="optional">optional</span></label><div class="check-list">${activeIndicators().map(i=>`<label><input class="r-indicator" data-id="${i.id}" type="checkbox"> ${esc(i.emoji)} ${esc(i.label)}</label>`).join('')}</div></div>`:''}<details class="more-details"><summary>More details</summary><div class="field"><label>Product <span class="optional">optional</span></label><select id="r-product"><option value="">None</option>${activeProducts().map(p=>`<option value="${p.id}">${esc(p.tcg)} — ${esc(p.name)}</option>`).join('')}</select></div><div class="two-col"><div class="field"><label>Price</label><input id="r-price" inputmode="decimal" placeholder="$"></div><div class="field"><label>Condition</label><select id="r-condition"><option value="">—</option><option>Sealed</option><option>Unsealed</option><option>Damaged</option></select></div></div><div class="field"><label>Source</label><select id="r-source">${['Firsthand','Friend','Phone call','Social media','Store employee','Other'].map(x=>`<option>${x}</option>`).join('')}</select></div><div class="field"><label>Approx. event time <span class="optional">optional</span></label><input id="r-occurred" type="datetime-local"></div><div class="field"><label>Notes</label><textarea id="r-notes"></textarea></div></details><button class="btn wide" data-action="submit-report">Submit quick report</button></div></div>`}
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
function storeResultName(r){return r.name||r.address_line1||[r.housenumber,r.street].filter(Boolean).join(' ')||'Selected location'}
function storeResultAddress(r){return r.formatted||[r.address_line1,r.address_line2].filter(Boolean).join(', ')}
function showStoreSuggestions(items){const box=document.getElementById('store-suggestions');if(!box)return;if(!items.length){box.innerHTML='<div class="lookup-empty">No matches. You can enter the address and coordinates manually.</div>';box.hidden=false;return}box.innerHTML=items.map((r,i)=>`<button type="button" class="lookup-result" data-action="select-store-result" data-index="${i}"><b>${esc(storeResultName(r))}</b><small>${esc(storeResultAddress(r))}</small></button>`).join('');box.hidden=false;box._results=items}
function storeFormSheet(id=null){const s=id?data.stores.find(x=>x.id===id):null;return `<div class="sheet flow-sheet"><div class="sheet-card"><div class="sheet-title"><div><h2>${s?'Edit':'Add'} store</h2><div class="tiny">${s?'Changes are shared with all members.':'Search, verify and save.'}</div></div><button class="close" data-action="close-sheet">×</button></div>${geoapifyReady()?`<div class="field store-lookup"><label>Find store or address</label><input id="store-search" autocomplete="off" placeholder="Try Target Lowell MA"><div id="store-suggestions" class="lookup-results" hidden></div></div>`:''}<div class="field"><label>Name</label><input id="new-store" value="${esc(s?.name||'')}" placeholder="Store name"></div><div class="field"><label>Address</label><input id="new-address" value="${esc(s?.address||'')}" placeholder="Street, city, state"></div><div class="two-col"><div class="field"><label>Latitude</label><input id="new-lat" inputmode="decimal" value="${s?.lat??''}"></div><div class="field"><label>Longitude</label><input id="new-lng" inputmode="decimal" value="${s?.lng??''}"></div></div><div id="store-preview-wrap" class="store-preview-wrap" ${s?.lat&&s?.lng?'':'hidden'}><div id="store-preview-map"></div></div><button class="btn wide" data-action="${s?'save-store':'add-store'}" data-id="${s?.id||''}">${s?'Save changes':'Add store'}</button>${s?`<button class="btn danger wide" data-action="delete-store" data-id="${s.id}">Delete store</button>`:''}</div></div>`}
function productFormSheet(id=null){const p=id?data.products.find(x=>x.id===id):null;return `<div class="sheet flow-sheet"><div class="sheet-card"><div class="sheet-title"><h2>${p?'Edit':'Add'} product</h2><button class="close" data-action="close-sheet">×</button></div><div class="field"><label>Product name</label><input id="new-product" value="${esc(p?.name||'')}"></div><div class="field"><label>TCG</label><input id="new-tcg" value="${esc(p?.tcg||'One Piece')}"></div><div class="field"><label>Set <span class="optional">optional</span></label><input id="new-set" value="${esc(p?.setName||'')}"></div><div class="field"><label>SKU / UPC <span class="optional">optional</span></label><input id="new-sku" value="${esc(p?.sku||'')}"></div><button class="btn wide" data-action="${p?'save-product':'add-product'}" data-id="${p?.id||''}">${p?'Save changes':'Add product'}</button>${p?`<button class="btn danger wide" data-action="delete-product" data-id="${p.id}">Delete product</button>`:''}</div></div>`}
function reportEditSheet(id){const r=data.reports.find(x=>x.id===id);if(!r)return'';return `<div class="sheet flow-sheet"><div class="sheet-card"><div class="sheet-title"><div><h2>Edit report</h2><div class="tiny">Changes are shared with the group.</div></div><button class="close" data-action="close-sheet">×</button></div><div class="field"><label>Store</label><select id="er-store">${activeStores().map(s=>`<option value="${s.id}" ${r.storeId===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div><div class="field"><label>Status</label><div class="radio-grid">${radio('er-status','stock','Stock',r.status==='stock')}${radio('er-status','empty','No stock',r.status==='empty')}</div></div><div class="field"><label>Time bucket</label><select id="er-period">${data.settings.periods.map(x=>`<option ${r.period===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Indicators</label><div class="check-list">${activeIndicators().map(i=>`<label><input class="er-indicator" data-id="${i.id}" type="checkbox" ${(r.indicatorIds||[]).includes(i.id)?'checked':''}> ${esc(i.emoji)} ${esc(i.label)}</label>`).join('')}</div></div><div class="field"><label>Product</label><select id="er-product"><option value="">None</option>${activeProducts().map(p=>`<option value="${p.id}" ${r.productId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></div><div class="two-col"><div class="field"><label>Price</label><input id="er-price" inputmode="decimal" value="${r.price??''}"></div><div class="field"><label>Condition</label><select id="er-condition"><option value="">—</option>${['Sealed','Unsealed','Damaged'].map(x=>`<option ${r.condition===x?'selected':''}>${x}</option>`).join('')}</select></div></div><div class="field"><label>Source</label><select id="er-source">${['Firsthand','Friend','Phone call','Social media','Store employee','Other'].map(x=>`<option ${r.source===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Event time</label><input id="er-occurred" type="datetime-local" value="${toLocalInput(r.occurredAt)}"></div><div class="field"><label>Notes</label><textarea id="er-notes">${esc(r.notes||'')}</textarea></div><button class="btn wide" data-action="save-report" data-id="${r.id}">Save changes</button><button class="btn danger wide" data-action="delete-report" data-id="${r.id}">Delete report</button></div></div>`}
function indicatorSheet(id=null){const i=id?(data.indicators||[]).find(x=>x.id===id):null;return `<div class="sheet"><div class="sheet-card"><div class="sheet-title"><h2>${i?'Edit':'Add'} indicator</h2><button class="close" data-action="close-sheet">×</button></div><div class="field"><label>Emoji</label><input id="ind-emoji" value="${esc(i?.emoji||'📦')}" maxlength="8"></div><div class="field"><label>Label</label><input id="ind-label" value="${esc(i?.label||'')}"></div><button class="btn wide" data-action="save-indicator" data-id="${i?.id||''}">Save indicator</button>${i?`<button class="btn danger wide" data-action="delete-indicator" data-id="${i.id}">Remove from form</button>`:''}</div></div>`}
function reportDetailSheet(id){const r=data.reports.find(x=>x.id===id);if(!r)return'';const s=data.stores.find(x=>x.id===r.storeId),p=data.products.find(x=>x.id===r.productId);return `<div class="sheet flow-sheet"><div class="sheet-card"><div class="sheet-title"><div><h2>${r.status==='stock'?'Stock':'No stock'} ${reportFlags(r)}</h2><div class="tiny">${esc(s?.name||'Store')}</div></div><button class="close" data-action="close-sheet">×</button></div><div class="detail-grid"><span>Event time</span><b>${fmtDate(r.occurredAt)} · ${r.period} · ${fmtTime(r.occurredAt)}</b><span>Submitted</span><b>${fmtDate(r.createdAt)} · ${fmtTime(r.createdAt)}</b><span>Product</span><b>${esc(p?.name||'—')}</b><span>Source</span><b>${esc(r.source||'—')}</b><span>Price</span><b>${r.price!=null?`$${Number(r.price).toFixed(2)} ${esc(r.condition||'')}`:'—'}</b></div>${r.notes?`<div class="note-box">${esc(r.notes)}</div>`:''}<div class="row"><button class="btn" data-action="edit-report" data-id="${r.id}">Edit report</button><button class="btn secondary" data-action="share-report" data-id="${r.id}">Share</button></div></div></div>`}
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


function profileSheet(){const m=currentMember();return `<div class="sheet"><div class="sheet-card"><div class="sheet-title"><h2>Edit my profile</h2><button class="close" data-action="close-sheet">×</button></div><div class="profile-preview">${avatar(m,'avatar large-avatar')}<div><b>${esc(m.name)}</b><small>${esc(rankTitle(m))} · ${pointsFor(m)} points</small></div></div><div class="field"><label>Username</label><input id="profile-name" value="${esc(m.name)}" maxlength="30"></div><div class="field"><label>Profile picture</label><input id="profile-avatar" type="file" accept="image/*"></div><button class="btn wide" data-action="save-profile">Save profile</button><div class="tiny" style="margin-top:8px">Profile pictures are shared through Supabase Storage.</div><div class="security-section"><h3>Account Security</h3><div class="tiny">Set or change your ChaseDex password for normal sign-in.</div><div class="field"><label>New password</label><input id="new-password" type="password" minlength="8" placeholder="At least 8 characters" autocomplete="new-password"></div><div class="field"><label>Confirm password</label><input id="confirm-password" type="password" minlength="8" placeholder="Re-enter password" autocomplete="new-password"></div><button class="btn wide" data-action="set-password">Set password</button></div></div></div>`}
function readImage(file,max=320){return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>{const img=new Image();img.onload=()=>{const scale=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.82))};img.onerror=reject;img.src=fr.result};fr.onerror=reject;fr.readAsDataURL(file)})}
function driveStore(id){const s=data.stores.find(x=>x.id===id);if(!s)return;const dest=Number.isFinite(Number(s.lat))&&Number.isFinite(Number(s.lng))?`${s.lat},${s.lng}`:(s.address||s.name);location.href='https://www.google.com/maps/dir/?api=1&travelmode=driving&destination='+encodeURIComponent(dest)}

async function shareStore(storeId){const s=data.stores.find(x=>x.id===storeId),r=latestReport(storeId);const text=`ChaseDex — ${s.name}: ${r?`${statusMeta[r.status].label} ${reportFlags(r)} · ${r.period} · ${fmtTime(r.occurredAt)}`:'Not checked recently'}.`;const url=location.href.split('#')[0]+'#store='+encodeURIComponent(storeId);if(navigator.share){try{await navigator.share({title:'ChaseDex update',text,url});return}catch{}}location.href='sms:?&body='+encodeURIComponent(`${text} ${url}`)}
async function shareReport(id){const r=data.reports.find(x=>x.id===id),s=data.stores.find(x=>x.id===r.storeId);const text=`ChaseDex — ${s?.name}: ${statusMeta[r.status]?.label||'Update'} ${reportFlags(r)} · ${r.period} · ${fmtTime(r.occurredAt)}.`;const url=location.href.split('#')[0]+'#report='+encodeURIComponent(id);if(navigator.share){try{await navigator.share({title:'ChaseDex report',text,url});return}catch{}}location.href='sms:?&body='+encodeURIComponent(`${text} ${url}`)}
function openSearch(q){window.open('https://www.google.com/search?q='+encodeURIComponent(q),'_blank','noopener')}

function loadingView(){return `<div class="login"><div class="login-card">${localBrandIcon('large')}<h1>${esc(appName())}</h1><p>Loading shared scout data…</p></div></div>`}
function render(){
 const root=document.getElementById('app');
 if(!appReady){root.innerHTML=loadingView();return;}
 root.innerHTML=(currentMember()||isViewer())?shell():loginView();
 if(currentMember()||isViewer()){
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
 const el=e.target.closest('[data-action]');if(!el)return;const a=el.dataset.action;
 try{
  if(a==='password-login'){
   const email=document.getElementById('email')?.value.trim();const password=document.getElementById('password')?.value||'';
   if(!email||!password){loginNotice='Enter your email and password.';render();return}
   pendingEmail=email;loginNotice='Signing in…';render();
   try{
    const session=await signInWithPassword(email,password);
    if(!session)throw new Error('Sign-in did not return a session.');
    authSession=session;viewerMode=false;loginNotice='';await recordLogin();await refreshShared({quiet:true});state.view='home';state.sheet=null;render();
   }catch(err){console.error(err);loginNotice=String(err?.message||'Could not sign in. Check your email and password.');render()}
   return;
  }
  if(a==='magic-login'){
   const email=document.getElementById('email')?.value.trim();if(!email){loginNotice='Enter your email.';render();return}
   const wait=magicCooldownSeconds();if(wait){loginNotice=`Please wait ${wait} second${wait===1?'':'s'} before requesting another magic link.`;render();return}
   pendingEmail=email;loginNotice='Sending magic link…';render();
   try{
    await sendMagicLink(email);loginNotice='Magic link sent. Open the newest email on this device.';startMagicCooldown(60);render();
   }catch(err){
    console.error(err);const msg=String(err?.message||'');const match=msg.match(/after\s+(\d+)\s+seconds?/i);const seconds=match?Number(match[1]):(err?.status===429?30:0);
    if(seconds){loginNotice=`Please wait ${seconds} second${seconds===1?'':'s'} before requesting another magic link.`;startMagicCooldown(seconds)}
    else loginNotice=msg||'Could not send magic link. Please try again.';
    render();
   }
   return;
  }
  if(a==='public-view'){viewerMode=true;state.view='home';await refreshShared();return}
  if(a==='logout'){
   if(authSession){await backendSignOut();authSession=null;viewerMode=false;data=seed();}
   else viewerMode=false;
   state.view='home';state.sheet=null;history.replaceState(null,'',location.pathname+location.search);render();return;
  }
  if(a==='nav'){state.view=el.dataset.view;state.sheet=null;history.replaceState(null,'',location.pathname+location.search);render();return}
  if(a==='store-quick'){state.selectedStore=el.dataset.id;state.sheet='store';render();return}
  if(a==='start-quick'){if(!isMember())return toast('Sign in to report');state.selectedStore=el.dataset.id;state.sheet='report';state.sheetBack='store';render();return}
  if(a==='close-sheet'){if(state.sheet==='report'&&state.sheetBack==='store'){state.sheet='store';state.sheetBack=null}else{state.sheet=null;state.sheetBack=null;history.replaceState(null,'',location.pathname+location.search)}render();return}
  if(a==='open-stores'){if(!isMember())return toast('Members only');state.view='products';state.sheet=null;render();return}
  if(a==='activity-metric'){state.activityMetric=el.dataset.metric;render();return}
  if(a==='open-product-add'){if(!isMember())return toast('Members only');state.sheet='product-add';render();return}
  if(a==='product-detail'){state.productId=el.dataset.id;state.sheet='product-detail';render();return}
  if(a==='report-detail'){state.reportId=el.dataset.id;state.sheet='report-detail';render();return}
  if(a==='map-status-toggle'){const k=el.dataset.status;state.mapStatuses=state.mapStatuses.includes(k)?state.mapStatuses.filter(x=>x!==k):[...state.mapStatuses,k];render();return}
  if(a==='map-indicator-toggle'){const id=el.dataset.id;state.mapIndicatorFilters=state.mapIndicatorFilters.includes(id)?state.mapIndicatorFilters.filter(x=>x!==id):[...state.mapIndicatorFilters,id];render();return}
  if(a==='manage-kind'){state.manageKind=el.dataset.kind;render();return}
  if(a==='open-store-add'){state.sheet='store-add';state.editId=null;render();return}
  if(a==='edit-store'){state.sheet='store-edit';state.editId=el.dataset.id;render();return}
  if(a==='edit-product'){state.sheet='product-edit';state.editId=el.dataset.id;render();return}
  if(a==='edit-report'){state.sheet='report-edit';state.editId=el.dataset.id;render();return}
  if(a==='indicator-add'){state.sheet='indicator-edit';state.editId=null;render();return}
  if(a==='indicator-edit'){state.sheet='indicator-edit';state.editId=el.dataset.id;render();return}
  if(a==='map-nearest'){
   try{state.userLocation=await requestCurrentLocation();state.mapSort='nearest';render()}catch(err){toast(err.message||'Could not get current location')}
   return;
  }
  if(a==='route-mode'){state.routeMode=!state.routeMode;if(!state.routeMode)state.routeSelected=[];render();return}
  if(a==='route-toggle-store'){toggleRouteStore(el.dataset.id);render();return}
  if(a==='route-clear'){state.routeSelected=[];render();return}
  if(a==='route-cancel'){state.routeMode=false;state.routeSelected=[];render();return}
  if(a==='route-build'){if(!state.routeSelected.length)return;state.sheet='route';render();return}
  if(a==='open-google-route'){const url=googleRouteUrl(routeSelectedStores());if(url)location.href=url;return}
  if(a==='open-waze-route'){const s=routeSelectedStores()[0],url=wazeRouteUrl(s);if(url)location.href=url;return}
  if(a==='members-manage'){if(currentMember()?.role!=='admin')return toast('Admin only');state.sheet='members-manage';render();return}
  if(a==='edit-profile'){if(!isMember())return toast('Members only');state.sheet='profile';render();return}
  if(a==='drive-store'){driveStore(el.dataset.id);return}
  if(a==='submit-report'){
   const m=currentMember();if(!m)return toast('Sign in to report');
   const status=document.querySelector('input[name="r-status"]:checked')?.value||'unsure';
   const period=document.querySelector('input[name="r-period"]:checked')?.value||periodFor(new Date());
   const occurredRaw=document.getElementById('r-occurred')?.value;const price=parseFloat(document.getElementById('r-price')?.value);
   const r={storeId:document.getElementById('r-store').value,status,indicatorIds:[...document.querySelectorAll('.r-indicator:checked')].map(x=>x.dataset.id),flags:{},occurredAt:occurredRaw?new Date(occurredRaw).toISOString():iso(),occurredApprox:!!occurredRaw,period,source:document.getElementById('r-source')?.value||'Firsthand',notes:document.getElementById('r-notes')?.value||'',productId:document.getElementById('r-product')?.value||null,price:Number.isFinite(price)?price:null,condition:document.getElementById('r-condition')?.value||null,memberId:m.id};
   await createReport(r);state.sheet='store';state.selectedStore=r.storeId;await refreshShared();toast('Report added');return;
  }
  if(a==='text-store'){await shareStore(el.dataset.id);return}
  if(a==='share-report'){await shareReport(el.dataset.id);return}
  if(a==='sku-lookup'){const q=document.getElementById('sku-lookup').value.trim();if(q)openSearch(q+' trading card product SKU UPC');return}
  if(a==='web-product'){const p=data.products.find(x=>x.id===el.dataset.id);if(p)openSearch(`${p.sku||''} ${p.tcg} ${p.name}`.trim());return}
  if(a==='save-store'){
   const n=document.getElementById('new-store').value.trim(),address=document.getElementById('new-address').value.trim(),lat=parseFloat(document.getElementById('new-lat').value),lng=parseFloat(document.getElementById('new-lng').value);
   if(!n||!Number.isFinite(lat)||!Number.isFinite(lng))return toast('Add name, latitude and longitude');
   await updateStore(el.dataset.id,{name:n,address,lat,lng});await refreshShared();state.sheet=null;toast('Store updated');return;
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
   if(name&&!name.value.trim())name.value=storeResultName(r);if(address)address.value=storeResultAddress(r);if(lat)lat.value=r.lat??'';if(lng)lng.value=r.lon??'';if(search)search.value=storeResultName(r);box.hidden=true;const status=document.getElementById('store-selection-status');if(status)status.textContent='✓ Location selected — verify the address and map preview before saving.';renderStorePreview(r.lat,r.lon);return;
  }
  if(a==='add-store'){
   const m=currentMember(),n=document.getElementById('new-store').value.trim(),address=document.getElementById('new-address').value.trim(),lat=parseFloat(document.getElementById('new-lat').value),lng=parseFloat(document.getElementById('new-lng').value);
   if(n&&m&&Number.isFinite(lat)&&Number.isFinite(lng)){await createStore({name:n,address,lat,lng},m.id);state.manageKind='stores';state.view='products';state.sheet=null;await refreshShared();toast('Store added')}else toast('Add name, latitude and longitude');return;
  }
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

document.addEventListener('change',e=>{const t=e.target;if(t.dataset.change==='activity-store'){state.activityStore=t.value;render()}if(t.dataset.change==='analytics'){state.analytics={metric:document.getElementById('a-metric').value,tcg:document.getElementById('a-tcg').value,productId:document.getElementById('a-product').value,storeId:document.getElementById('a-store').value,period:document.getElementById('a-period').value,range:Number(document.getElementById('a-range').value),groupBy:document.getElementById('a-group').value};render()}});

document.addEventListener('input',e=>{
 if(e.target.id==='new-lat'||e.target.id==='new-lng'){const lat=document.getElementById('new-lat')?.value,lng=document.getElementById('new-lng')?.value;if(lat&&lng)renderStorePreview(lat,lng);return}
 if(e.target.id!=='store-search')return;clearTimeout(storeLookupTimer);const q=e.target.value;const box=document.getElementById('store-suggestions');if(q.trim().length<3){if(box)box.hidden=true;return}
 storeLookupTimer=setTimeout(async()=>{try{showStoreSuggestions(await lookupStores(q))}catch(err){if(err.name!=='AbortError'){console.error(err);if(box){box.innerHTML='<div class="lookup-empty">Lookup unavailable. Manual entry still works.</div>';box.hidden=false}}}},350)
});

function resizeImageBlob(file,max=500,quality=.82){return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>{const img=new Image();img.onload=()=>{const scale=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);c.toBlob(b=>b?resolve(b):reject(new Error('Could not resize image')),'image/jpeg',quality)};img.onerror=reject;img.src=fr.result};fr.onerror=reject;fr.readAsDataURL(file)})}

async function init(){
 try{
  if(!backendConfigured){appReady=true;render();return}
  authSession=await getAuthSession();viewerMode=false;
  data=await loadSharedData(authSession);data.indicators??=[];data.changeLog??=[];save();applyBranding();appReady=true;render();
  if(authSession){await recordSession();}
  realtimeChannel=subscribeRealtime(scheduleRefresh);
  onAuthStateChange(async(event,session)=>{
   const was=authSession;authSession=session;viewerMode=false;
   if(event==='SIGNED_IN'&&session&&(!was||was.user.id!==session.user.id))await recordLogin();
   if(event==='SIGNED_OUT'){data=seed();state.view='home';state.sheet=null;}
   await refreshShared();appReady=true;render();
  });
 }catch(err){console.error(err);loginNotice=err?.message||'Could not start ChaseDex';appReady=true;render();}
}
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));
applyBranding();render();init();

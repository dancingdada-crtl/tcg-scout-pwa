import { GEOAPIFY_API_KEY } from './geoapify-config.js';
import { backendConfigured, getAuthSession, onAuthStateChange, sendMagicLink, signInWithPassword, signOut as backendSignOut, recordLogin, recordSession, loadSharedData, createReport, createStore, setStoreArchived, createProduct, setProductArchived, saveAnalytics as backendSaveAnalytics, uploadProfileImage, updateMyProfile, uploadBrandIcon, updateBranding, updateRankingTiers, setMemberEnabled, setReportFeedback, subscribeRealtime } from './backend.js';

const KEY='tcg-scout-v1-data';
const iso=(d=new Date())=>d.toISOString();
const uid=()=>crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2);
const esc=s=>String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[m]));
const fmtTime=s=>new Date(s).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
const fmtDate=s=>new Date(s).toLocaleDateString([], {month:'short',day:'numeric'});
const periodFor=d=>{const h=new Date(d).getHours();if(h<11)return'Morning';if(h<13)return'Noon';if(h<17)return'Afternoon';return'Evening'};
const statusMeta={stock:{label:'Stock',icon:'●',cls:'green'},empty:{label:'Empty',icon:'●',cls:'red'},unsure:{label:'Unsure',icon:'●',cls:'yellow'},unchecked:{label:'Not checked',icon:'●',cls:'gray'}};
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
let state={view:'home',sheet:null,selectedStore:null,activityStore:'All',activityMetric:'stock',analytics:{metric:'stock',tcg:'All',productId:'All',storeId:'All',period:'All',range:30,groupBy:'day'},toast:null};
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
function reportsForStore(id){return data.reports.filter(r=>r.storeId===id).sort((a,b)=>new Date(b.occurredAt)-new Date(a.occurredAt))}
function latestReport(id){return reportsForStore(id)[0]||null}
function latestStatus(id){const r=latestReport(id);return r?statusMeta[r.status]||statusMeta.unsure:statusMeta.unchecked}
function reportFlags(r){return Object.entries(r?.flags||{}).filter(([,v])=>v).map(([k])=>flagMeta[k]?.icon).filter(Boolean).join(' ')}
function sameDay(a,b){return new Date(a).toDateString()===new Date(b).toDateString()}
function metricMatch(r,m){if(['stock','empty','unsure'].includes(m))return r.status===m;if(m==='line'||m==='possible'||m==='evidence')return !!r.flags?.[m];return true}
function countMetric(storeId,date,metric){return data.reports.filter(r=>(storeId==='All'||r.storeId===storeId)&&sameDay(r.occurredAt,date)&&metricMatch(r,metric)).length}
function appName(){return data.settings?.appName||'ChaseDex'}
function pointsFor(m){return (m.reports||0)+(m.confirmations||0)}
function rankTitle(m){const pts=pointsFor(m),levels=(data.settings?.rankingTitles||[]).slice().sort((a,b)=>Number(a.min)-Number(b.min));return (levels.filter(x=>pts>=Number(x.min)).pop()||{title:'Scout'}).title}
function avatar(m,cls='avatar'){return m?.avatar?`<img class="${cls}" src="${m.avatar}" alt="">`:`<span class="${cls} avatar-fallback">${esc((m?.name||'?').slice(0,1).toUpperCase())}</span>`}
function applyBranding(){document.title=appName();const meta=document.querySelector('meta[name="application-name"]');if(meta)meta.content=appName()}

function loginView(){
 if(!backendConfigured)return `<div class="login"><div class="login-card">${localBrandIcon('large')}<h1>Supabase setup needed</h1><p>V1.3 is ready, but this build still needs your Supabase Project URL and publishable/anon key in <b>supabase-config.js</b>.</p><div class="demo-note">Never use the service_role/secret key in this file.</div></div></div>`;
 return `<div class="login"><div class="login-card">${data.settings?.appIcon?`<img class="brand-icon large" src="${data.settings.appIcon}" alt="ChaseDex">`:localBrandIcon('large')}<h1>${esc(appName())}</h1><p>Fast local restock, price and activity intelligence for your group.</p>${loginNotice?`<div class="login-notice">${esc(loginNotice)}</div>`:''}<div class="field"><label>Email</label><input id="email" type="email" value="${esc(pendingEmail)}" placeholder="you@example.com" autocomplete="email"></div><div class="field"><label>Password</label><input id="password" type="password" placeholder="Your password" autocomplete="current-password"></div><button class="btn wide" data-action="password-login">Sign in</button><div class="login-divider"><span>or</span></div>${(()=>{const n=magicCooldownSeconds();return `<button class="btn secondary wide" data-action="magic-login" ${n?'disabled':''}>${n?`Try magic link again in ${n}s`:'Email me a magic link'}</button>`})()}<button class="btn secondary wide" data-action="public-view">Continue as Public Viewer</button><div class="demo-note">Member signup is invite-only. Use your password for normal sign-in. Magic Link remains available for first-time access or recovery.</div></div></div>`}

function topbar(){const m=currentMember();const who=m?`${esc(m.name)} · ${m.role==='admin'?'Admin':'Member'}`:'Public Viewer';return `<header class="topbar"><div class="brandrow"><div class="brand">${data.settings?.appIcon?`<img class="brand-icon" src="${data.settings.appIcon}" alt="ChaseDex">`:localBrandIcon()}<div><div class="title">${esc(appName())}</div><div class="subtitle">${who}</div></div></div><div class="top-actions"><button class="pill" data-action="share-app">Share</button><button class="pill" data-action="logout">${m?'Sign out':'Sign in'}</button></div></div></header>`}

function nav(){const items=[['home','🗺️','Map'],['activity','▥','Activity'],['analytics','⌁','Analytics'],['products','◫','Products']];if(isMember())items.push(['members','👥','Members']);if(currentMember()?.role==='admin')items.push(['admin','⚙','Admin']);return `<nav class="bottom-nav" style="grid-template-columns:repeat(${items.length},1fr)">${items.map(([v,i,l])=>`<button class="nav-btn ${state.view===v?'active':''}" data-action="nav" data-view="${v}"><span>${i}</span>${l}</button>`).join('')}</nav>`}

function shell(){const flow=['store','report','report-detail'].includes(state.sheet);if(flow)return `${sheet()}${state.toast?`<div class="toast">${esc(state.toast)}</div>`:''}`;return `<div class="shell">${topbar()}<main>${state.view==='home'?home():state.view==='activity'?activity():state.view==='analytics'?analytics():state.view==='products'?products():state.view==='members'?members():admin()}</main>${nav()}</div>${state.sheet?sheet():''}${state.toast?`<div class="toast">${esc(state.toast)}</div>`:''}`}

function home(){return `<section class="section"><div class="section-head"><div><h2>Store map</h2><div class="tiny">Tap a marker for 7-day activity + quick report</div></div>${isMember()?`<button class="pill" data-action="open-stores">Manage</button>`:''}</div><div class="map-wrap"><div id="map"></div><div class="legend"><b>Legend</b>${Object.entries(statusMeta).map(([k,v])=>`<span><i class="legend-dot ${v.cls}"></i>${v.label}</span>`).join('')}<span>👥 Line</span><span>🟡 Possible restock</span><span>🟠 Evidence</span></div></div></section><section class="section"><div class="section-head"><h2>Recently updated</h2><button class="pill" data-action="nav" data-view="activity">7-day activity</button></div>${activeStores().slice().sort((a,b)=>new Date(latestReport(b.id)?.occurredAt||0)-new Date(latestReport(a.id)?.occurredAt||0)).map(store=>{const r=latestReport(store.id),st=latestStatus(store.id);return `<button class="store-list-card" data-action="store-quick" data-id="${store.id}"><span class="legend-dot ${st.cls}"></span><span><b>${esc(store.name)}</b><small>${r?`${statusMeta[r.status].label} · ${r.period} · ${fmtTime(r.occurredAt)} ${reportFlags(r)}`:'Not checked'}</small></span><span>›</span></button>`}).join('')}</section>`}
function renderMap(){if(state.view!=='home'||!document.getElementById('map'))return;if(!window.L){document.getElementById('map').innerHTML='<div class="map-fallback">Map library could not load. Store quick views below still work.</div>';return}const stores=activeStores();const valid=stores.filter(s=>Number.isFinite(Number(s.lat))&&Number.isFinite(Number(s.lng)));const center=valid.length?[valid.reduce((a,s)=>a+Number(s.lat),0)/valid.length,valid.reduce((a,s)=>a+Number(s.lng),0)/valid.length]:[42.645,-71.315];const map=L.map('map',{zoomControl:false}).setView(center,12);L.control.zoom({position:'bottomright'}).addTo(map);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);valid.forEach(s=>{const st=latestStatus(s.id),r=latestReport(s.id);const marker=L.marker([s.lat,s.lng],{icon:L.divIcon({className:'tcg-marker-wrap',html:`<button class="tcg-marker ${st.cls}" aria-label="${esc(s.name)}">${r?reportFlags(r):''}</button>`,iconSize:[34,34],iconAnchor:[17,17]})}).addTo(map);marker.on('click',()=>{state.selectedStore=s.id;state.sheet='store';render()})});if(valid.length>1){const bounds=L.latLngBounds(valid.map(s=>[s.lat,s.lng]));map.fitBounds(bounds.pad(.25),{maxZoom:13})}}

function sevenBars(storeId,metric){const vals=last7().map(d=>({d,n:countMetric(storeId,d,metric)}));const max=Math.max(1,...vals.map(x=>x.n));return `<div class="histogram">${vals.map(x=>`<div class="bar-col"><div class="bar-count">${x.n||''}</div><div class="bar" style="height:${Math.max(4,(x.n/max)*100)}%"></div><small>${x.d.toLocaleDateString('en-US',{weekday:'short'})}</small></div>`).join('')}</div>`}
function activity(){const storeId=state.activityStore;const metric=state.activityMetric;return `<section class="section"><div class="section-head"><div><h2>7-day activity</h2><div class="tiny">Select a store and signal</div></div></div><div class="card"><div class="field"><label>Store</label><select id="activity-store" data-change="activity-store"><option value="All">All stores</option>${activeStores().map(s=>`<option value="${s.id}" ${storeId===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div><div class="metric-pills">${[['stock','Stock'],['empty','Empty'],['unsure','Unsure'],['line','Line'],['possible','Possible'],['evidence','Evidence']].map(([k,l])=>`<button class="chip ${metric===k?'active':''}" data-action="activity-metric" data-metric="${k}">${l}</button>`).join('')}</div><div class="chart-title">${storeId==='All'?'All stores':esc(data.stores.find(s=>s.id===storeId)?.name)} · ${metricLabel(metric)}</div>${sevenBars(storeId,metric)}</div><div class="section-head"><h2>Latest activity</h2></div>${data.reports.filter(r=>storeId==='All'||r.storeId===storeId).sort((a,b)=>new Date(b.occurredAt)-new Date(a.occurredAt)).slice(0,12).map(activityRow).join('')||'<div class="empty">No activity yet.</div>'}</section>`}
function activityRow(r){const s=data.stores.find(x=>x.id===r.storeId),p=data.products.find(x=>x.id===r.productId);return `<button class="activity-row" data-action="report-detail" data-id="${r.id}"><span class="legend-dot ${statusMeta[r.status]?.cls||'yellow'}"></span><span><b>${esc(s?.name||'Store')} · ${statusMeta[r.status]?.label||'Unsure'} ${reportFlags(r)}</b><small>${fmtDate(r.occurredAt)} · ${r.period}${p?` · ${esc(p.name)}`:''}</small></span><span>›</span></button>`}
function metricLabel(m){return ({stock:'Stock reports',empty:'Empty reports',unsure:'Unsure reports',line:'People lining up',possible:'Possible restock',evidence:'Restock evidence'})[m]||m}

function filteredAnalytics(){const a=state.analytics;const cutoff=new Date();cutoff.setDate(cutoff.getDate()-Number(a.range));return data.reports.filter(r=>{const p=data.products.find(x=>x.id===r.productId);return new Date(r.occurredAt)>=cutoff&&(a.tcg==='All'||p?.tcg===a.tcg)&&(a.productId==='All'||r.productId===a.productId)&&(a.storeId==='All'||r.storeId===a.storeId)&&(a.period==='All'||r.period===a.period)&&(a.metric==='price'?r.price!=null:metricMatch(r,a.metric))})}
function analyticsGroups(reps){const a=state.analytics;let labels=[];if(a.groupBy==='period')labels=['Morning','Noon','Afternoon','Evening'];else if(a.groupBy==='weekday')labels=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];else labels=last7().map(d=>d.toLocaleDateString('en-US',{month:'numeric',day:'numeric'}));return labels.map(label=>{const matched=reps.filter(r=>a.groupBy==='period'?r.period===label:a.groupBy==='weekday'?new Date(r.occurredAt).toLocaleDateString('en-US',{weekday:'short'})===label:new Date(r.occurredAt).toLocaleDateString('en-US',{month:'numeric',day:'numeric'})===label);const n=a.metric==='price'?(matched.length?matched.reduce((sum,r)=>sum+Number(r.price||0),0)/matched.length:0):matched.length;return{label,n}})}
function analytics(){const a=state.analytics,reps=filteredAnalytics(),groups=analyticsGroups(reps),max=Math.max(1,...groups.map(x=>x.n));const isPrice=a.metric==='price',chart=isPrice?'Line chart':'Bar chart';const saved=data.savedFilters.filter(f=>f.ownerId===currentMember().id&&f.metric);const graph=isPrice?lineChart(groups):`<div class="analytics-bars">${groups.map(g=>`<div class="analytics-bar-row"><span>${esc(g.label)}</span><div class="track"><i style="width:${(g.n/max)*100}%"></i></div><b>${g.n}</b></div>`).join('')}</div>`;return `<section class="section"><div class="section-head"><div><h2>Analytics</h2><div class="tiny">Build and save the trend you care about</div></div></div>${saved.length?`<div class="chips saved-analytics">${saved.map(f=>`<button class="chip" data-action="load-analytics" data-id="${f.id}">${esc(f.name)}</button>`).join('')}</div>`:''}<div class="card analytics-builder"><div class="field"><label>Analyze</label><select id="a-metric" data-change="analytics"><option value="stock" ${a.metric==='stock'?'selected':''}>Stock reports</option><option value="empty" ${a.metric==='empty'?'selected':''}>Empty reports</option><option value="unsure" ${a.metric==='unsure'?'selected':''}>Unsure reports</option><option value="line" ${a.metric==='line'?'selected':''}>People lining up</option><option value="possible" ${a.metric==='possible'?'selected':''}>Possible restock</option><option value="evidence" ${a.metric==='evidence'?'selected':''}>Restock evidence</option><option value="price" ${a.metric==='price'?'selected':''}>Average observed price</option></select></div><div class="two-col"><div class="field"><label>TCG</label><select id="a-tcg" data-change="analytics"><option>All</option>${[...new Set(data.products.map(p=>p.tcg))].map(x=>`<option ${a.tcg===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div><div class="field"><label>Product</label><select id="a-product" data-change="analytics"><option value="All">All products</option>${activeProducts().filter(p=>a.tcg==='All'||p.tcg===a.tcg).map(p=>`<option value="${p.id}" ${a.productId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></div></div><div class="two-col"><div class="field"><label>Store</label><select id="a-store" data-change="analytics"><option value="All">All stores</option>${activeStores().map(s=>`<option value="${s.id}" ${a.storeId===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div><div class="field"><label>Time bucket</label><select id="a-period" data-change="analytics"><option>All</option>${data.settings.periods.map(x=>`<option ${a.period===x?'selected':''}>${x}</option>`).join('')}</select></div></div><div class="two-col"><div class="field"><label>Range</label><select id="a-range" data-change="analytics">${[7,30,90,365].map(x=>`<option value="${x}" ${Number(a.range)===x?'selected':''}>${x} days</option>`).join('')}</select></div><div class="field"><label>Group by</label><select id="a-group" data-change="analytics"><option value="day" ${a.groupBy==='day'?'selected':''}>Recent day</option><option value="weekday" ${a.groupBy==='weekday'?'selected':''}>Day of week</option><option value="period" ${a.groupBy==='period'?'selected':''}>Time bucket</option></select></div></div><div class="recommend"><b>Recommended graph:</b> ${chart}</div></div><div class="card"><div class="chart-title">${a.metric==='price'?'Average observed price':metricLabel(a.metric)} · ${reps.length} matching reports</div>${graph}<button class="btn secondary wide" data-action="save-analytics">Save this trend</button></div></section>`}
function lineChart(groups){const w=320,h=150,pad=22,max=Math.max(1,...groups.map(g=>g.n));const pts=groups.map((g,i)=>{const x=pad+(groups.length===1?0:i*(w-pad*2)/(groups.length-1));const y=h-pad-(g.n/max)*(h-pad*2);return{x,y,g}});return `<div class="line-chart"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Price trend"><polyline points="${pts.map(p=>`${p.x},${p.y}`).join(' ')}" fill="none" stroke="currentColor" stroke-width="3"/>${pts.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="4" fill="currentColor"/>`).join('')}</svg><div class="line-labels">${groups.map(g=>`<span><b>${g.n?`$${g.n.toFixed(0)}`:'—'}</b><small>${esc(g.label)}</small></span>`).join('')}</div></div>`}


function products(){return `<section class="section"><div class="section-head"><div><h2>Products</h2><div class="tiny">Products, SKU lookup and observed prices</div></div>${isMember()?`<button class="pill" data-action="open-product-add">＋ Add</button>`:''}</div><div class="card sku-card"><div class="field"><label>SKU / UPC web lookup</label><div class="inline-input"><input id="sku-lookup" inputmode="numeric" placeholder="Enter SKU or UPC"><button class="btn" data-action="sku-lookup">Search web</button></div><div class="tiny">Opens a web search in a new tab. No paid product API is used.</div></div></div>${activeProducts().map(p=>{const reps=data.reports.filter(r=>r.productId===p.id&&r.price!=null).sort((a,b)=>new Date(b.occurredAt)-new Date(a.occurredAt));const latest=reps[0];return `<button class="product-card" data-action="product-detail" data-id="${p.id}"><div><b>${esc(p.name)}</b><small>${esc(p.tcg)}${p.sku?` · SKU ${esc(p.sku)}`:''}</small></div><div class="product-price">${latest?`$${Number(latest.price).toFixed(2)}<small>${esc(latest.condition||'Observed')}</small>`:'No price'}</div></button>`}).join('')}</section>`}
function members(){const me=currentMember();if(!me)return '<div class="empty">Sign in as a member to view the member list.</div>';const ranked=data.members.slice().sort((a,b)=>pointsFor(b)-pointsFor(a));return `<section class="section"><div class="section-head"><div><h2>Members</h2><div class="tiny">Contribution ranking and member profiles</div></div><button class="pill" data-action="edit-profile">Edit my profile</button></div><div class="card ranking-list">${ranked.map((m,i)=>`<div class="ranking-row"><div class="rank-num">${i+1}</div>${avatar(m)}<div><b>${esc(m.name)}</b><small>${esc(rankTitle(m))} · ${pointsFor(m)} points</small></div><div class="rank-stats"><b>${m.reports||0}</b><small>reports</small></div></div>`).join('')}</div><div class="tiny contribution-note">Contribution score: 1 point per report + 1 point per confirmation.</div></section>`}
function admin(){const m=currentMember();if(m?.role!=='admin')return'<div class="empty">Admin only.</div>';const levels=(data.settings.rankingTitles||[]).slice().sort((a,b)=>a.min-b.min);return `<section class="section"><div class="section-head"><h2>Admin</h2><button class="pill" data-action="members-manage">Manage members</button></div><div class="card"><div class="metric-grid"><div class="metric"><b>${data.members.length}</b><span>Members</span></div><div class="metric"><b>${data.reports.length}</b><span>Reports</span></div><div class="metric"><b>${data.stores.length}</b><span>Stores</span></div></div></div><div class="card"><h3>App branding</h3><div class="field"><label>App name</label><input id="app-name" value="${esc(appName())}" maxlength="40"></div><div class="field"><label>App icon</label><input id="app-icon" type="file" accept="image/*"></div><button class="btn wide" data-action="save-branding">Save branding</button><div class="tiny" style="margin-top:8px">Updates shared in-app branding. An already-installed Android launcher name/icon may still require reinstalling the PWA.</div></div><div class="card"><h3>Contribution titles</h3>${levels.map((x,i)=>`<div class="rank-edit"><div class="field"><label>Minimum points</label><input id="rank-min-${i}" inputmode="numeric" value="${Number(x.min)}"></div><div class="field"><label>Title</label><input id="rank-title-${i}" value="${esc(x.title)}"></div></div>`).join('')}<button class="btn wide" data-action="save-ranks">Save ranking titles</button></div><div class="card"><h3>Member activity</h3>${data.members.map(x=>`<div class="member-activity"><div><b>${esc(x.name)}</b><small>${esc(x.email)} · ${esc(rankTitle(x))} · last active ${fmtDate(x.lastActive)}</small></div><div><b>${x.activeDays||0}</b><small>days</small></div><div><b>${x.sessions||0}</b><small>sessions</small></div><div><b>${x.reports||0}</b><small>reports</small></div></div>`).join('')}</div></section>`}


function sheet(){if(state.sheet==='store')return storeSheet(state.selectedStore);if(state.sheet==='report')return reportSheet(state.selectedStore);if(state.sheet==='stores')return storesSheet();if(state.sheet==='product-add')return productAddSheet();if(state.sheet==='product-detail')return productDetailSheet(state.productId);if(state.sheet==='report-detail')return reportDetailSheet(state.reportId);if(state.sheet==='members-manage')return membersSheet();if(state.sheet==='profile')return profileSheet();return''}
function storeSheet(id){const s=data.stores.find(x=>x.id===id);if(!s)return'';const r=latestReport(id),st=latestStatus(id);return `<div class="sheet flow-sheet"><div class="sheet-card"><div class="sheet-title"><div><h2>${esc(s.name)}</h2><div class="tiny">${esc(s.address||s.area)}</div></div><button class="close" data-action="close-sheet">×</button></div><div class="quick-status"><span class="status ${st.cls}">${st.label}</span>${r?`<span class="tiny">${fmtDate(r.occurredAt)} · ${r.period} · ${fmtTime(r.occurredAt)} ${reportFlags(r)}</span>`:'<span class="tiny">No recent report</span>'}</div><h3>7-day quick view</h3>${sevenBars(id,'stock')}<div class="sheet-actions">${isMember()?`<button class="btn wide" data-action="start-quick" data-id="${id}">Quick report</button>`:`<button class="btn wide" data-action="logout">Sign in to report</button>`}<button class="btn secondary wide" data-action="drive-store" data-id="${id}">🚗 Drive now</button><button class="btn secondary wide" data-action="text-store" data-id="${id}">Share / alert group</button></div></div></div>`}
function radio(name,value,label,checked){return `<label class="radio-pill"><input type="radio" name="${name}" value="${value}" ${checked?'checked':''}><span>${label}</span></label>`}
function reportSheet(storeId){const now=periodFor(new Date());return `<div class="sheet flow-sheet"><div class="sheet-card"><div class="sheet-title"><div><h2>Quick report</h2><div class="tiny">Fast first. Extra detail is optional.</div></div><button class="close" data-action="close-sheet">×</button></div><div class="field"><label>Store</label><select id="r-store">${activeStores().map(s=>`<option value="${s.id}" ${storeId===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div><div class="field"><label>Status</label><div class="radio-grid">${radio('r-status','stock','Stock',true)}${radio('r-status','empty','Empty',false)}${radio('r-status','unsure','Unsure',false)}</div></div><div class="field"><label>Time bucket</label><div class="radio-grid four">${data.settings.periods.map(x=>radio('r-period',x,x,now===x)).join('')}</div></div><div class="field"><label>Indicators <span class="optional">optional</span></label><div class="check-list"><label><input id="r-line" type="checkbox"> 👥 People lining up</label><label><input id="r-possible" type="checkbox"> 🟡 Possible restock</label><label><input id="r-evidence" type="checkbox"> 🟠 Restock evidence</label></div></div><details class="more-details"><summary>More details</summary><div class="field"><label>Product <span class="optional">optional</span></label><select id="r-product"><option value="">None</option>${activeProducts().map(p=>`<option value="${p.id}">${esc(p.tcg)} — ${esc(p.name)}</option>`).join('')}</select></div><div class="two-col"><div class="field"><label>Price</label><input id="r-price" inputmode="decimal" placeholder="$"></div><div class="field"><label>Condition</label><select id="r-condition"><option value="">—</option><option>Sealed</option><option>Unsealed</option><option>Damaged</option></select></div></div><div class="field"><label>Source</label><select id="r-source">${['Firsthand','Friend','Phone call','Social media','Store employee','Other'].map(x=>`<option>${x}</option>`).join('')}</select></div><div class="field"><label>Approx. event time <span class="optional">optional</span></label><input id="r-occurred" type="datetime-local"></div><div class="field"><label>Notes</label><textarea id="r-notes" placeholder="Friend said..., employee said..., social post..."></textarea></div></details><button class="btn wide" data-action="submit-report">Submit quick report</button></div></div>`}
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
function storesSheet(){return `<div class="sheet"><div class="sheet-card"><div class="sheet-title"><h2>Manage stores</h2><button class="close" data-action="close-sheet">×</button></div>${data.stores.map(s=>`<div class="trend-row"><div><b>${esc(s.name)}</b><div class="tiny">${esc(s.address||'No address')} · ${s.active?'Active':'Archived'}</div></div><button class="chip" data-action="toggle-store" data-id="${s.id}">${s.active?'Archive':'Restore'}</button></div>`).join('')}<h3 style="margin-top:18px">Add store</h3>${geoapifyReady()?`<div class="field store-lookup"><label>Find store or address</label><input id="store-search" autocomplete="off" placeholder="Try Target Lowell MA"><div id="store-suggestions" class="lookup-results" hidden></div><div class="tiny">Select a match to fill the address and map coordinates automatically.</div></div>`:`<div class="lookup-setup">Automatic lookup is ready to enable. Add your Geoapify key to <b>geoapify-config.js</b>. Manual entry still works below.</div>`}<div class="field"><label>Name</label><input id="new-store" placeholder="Store name"></div><div class="field"><label>Address</label><input id="new-address" placeholder="Street, city, state"></div><div class="two-col"><div class="field"><label>Latitude</label><input id="new-lat" inputmode="decimal" placeholder="Auto-filled or manual"></div><div class="field"><label>Longitude</label><input id="new-lng" inputmode="decimal" placeholder="Auto-filled or manual"></div></div><button class="btn wide" data-action="add-store">Add store</button><div class="tiny" style="margin-top:8px">Always verify the selected location before adding it. Manual correction remains available.</div></div></div>`}
function productAddSheet(){return `<div class="sheet"><div class="sheet-card"><div class="sheet-title"><h2>Add product</h2><button class="close" data-action="close-sheet">×</button></div><div class="field"><label>Product name</label><input id="new-product" placeholder="Product name"></div><div class="field"><label>TCG</label><select id="new-tcg"><option>One Piece</option><option>Pokémon</option><option>MTG</option><option>Lorcana</option><option>Sports</option></select></div><div class="field"><label>SKU / UPC <span class="optional">optional</span></label><input id="new-sku" inputmode="numeric" placeholder="SKU or UPC"></div><button class="btn wide" data-action="add-product">Add product</button></div></div>`}
function productDetailSheet(id){const p=data.products.find(x=>x.id===id);if(!p)return'';const reps=data.reports.filter(r=>r.productId===id).sort((a,b)=>new Date(b.occurredAt)-new Date(a.occurredAt));return `<div class="sheet"><div class="sheet-card"><div class="sheet-title"><div><h2>${esc(p.name)}</h2><div class="tiny">${esc(p.tcg)}${p.sku?` · SKU ${esc(p.sku)}`:''}</div></div><button class="close" data-action="close-sheet">×</button></div><div class="row"><button class="btn secondary" data-action="web-product" data-id="${p.id}">Search web</button>${isMember()?`<button class="btn secondary" data-action="toggle-product" data-id="${p.id}">${p.active?'Archive':'Restore'}</button>`:''}</div><h3 style="margin-top:18px">Observed prices</h3>${reps.filter(r=>r.price!=null).map(r=>`<div class="price-row"><span>${esc(data.stores.find(s=>s.id===r.storeId)?.name||'Store')}</span><b>$${Number(r.price).toFixed(2)}</b><span>${esc(r.condition||'—')} · ${fmtDate(r.occurredAt)}</span></div>`).join('')||'<div class="empty">No prices yet.</div>'}<h3 style="margin-top:18px">Recent sightings</h3>${reps.slice(0,8).map(activityRow).join('')||'<div class="empty">No sightings yet.</div>'}</div></div>`}
function reportDetailSheet(id){const r=data.reports.find(x=>x.id===id);if(!r)return'';const s=data.stores.find(x=>x.id===r.storeId),p=data.products.find(x=>x.id===r.productId),m=currentMember();const canFeedback=m&&r.memberId&&r.memberId!==m.id;return `<div class="sheet flow-sheet"><div class="sheet-card"><div class="sheet-title"><div><h2>${statusMeta[r.status]?.label||'Report'} ${reportFlags(r)}</h2><div class="tiny">${esc(s?.name||'Store')}</div></div><button class="close" data-action="close-sheet">×</button></div><div class="detail-grid"><span>Event time</span><b>${fmtDate(r.occurredAt)} · ${r.period} · ${fmtTime(r.occurredAt)}</b><span>Submitted</span><b>${fmtDate(r.createdAt)} · ${fmtTime(r.createdAt)}</b><span>Product</span><b>${esc(p?.name||'—')}</b><span>Source</span><b>${esc(r.source||'—')}</b><span>Price</span><b>${r.price!=null?`$${Number(r.price).toFixed(2)} ${esc(r.condition||'')}`:'—'}</b></div>${r.notes?`<div class="note-box">${esc(r.notes)}</div>`:''}${isMember()?`<div class="feedback-summary"><span>✓ ${r.confirmations||0} confirmations</span><span>⚑ ${r.disputes||0} disputes</span></div>`:''}${canFeedback?`<div class="row"><button class="btn secondary ${r.myFeedback==='confirm'?'selected':''}" data-action="feedback" data-kind="confirm" data-id="${r.id}">✓ Confirm</button><button class="btn secondary ${r.myFeedback==='dispute'?'selected':''}" data-action="feedback" data-kind="dispute" data-id="${r.id}">⚑ Dispute</button></div>`:''}<button class="btn secondary wide" data-action="share-report" data-id="${r.id}">Share report</button></div></div>`}

function membersSheet(){return `<div class="sheet"><div class="sheet-card"><div class="sheet-title"><h2>Members</h2><button class="close" data-action="close-sheet">×</button></div>${data.members.map(m=>`<div class="trend-row"><div><b>${esc(m.name)}</b><div class="tiny">${esc(m.email||'')} · ${m.role}${m.enabled===false?' · Disabled':''}</div></div>${m.role==='admin'?'<span class="badge">Owner</span>':m.enabled===false?`<button class="chip" data-action="enable-member" data-id="${m.id}">Restore</button>`:`<button class="chip" data-action="remove-member" data-id="${m.id}">Disable</button>`}</div>`).join('')}<div class="field"><label>Invite by email</label><input id="invite-email" type="email" placeholder="friend@example.com"></div><button class="btn wide" data-action="invite-member">Copy invite instructions</button><div class="tiny" style="margin-top:8px">For launch, new auth users are invited from Supabase Authentication → Users. This keeps the service-role key out of the PWA.</div></div></div>`}


function profileSheet(){const m=currentMember();return `<div class="sheet"><div class="sheet-card"><div class="sheet-title"><h2>Edit my profile</h2><button class="close" data-action="close-sheet">×</button></div><div class="profile-preview">${avatar(m,'avatar large-avatar')}<div><b>${esc(m.name)}</b><small>${esc(rankTitle(m))} · ${pointsFor(m)} points</small></div></div><div class="field"><label>Username</label><input id="profile-name" value="${esc(m.name)}" maxlength="30"></div><div class="field"><label>Profile picture</label><input id="profile-avatar" type="file" accept="image/*"></div><button class="btn wide" data-action="save-profile">Save profile</button><div class="tiny" style="margin-top:8px">Profile pictures are shared through Supabase Storage.</div></div></div>`}
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
  const sm=location.hash.match(/store=([^&]+)/);const rm=location.hash.match(/report=([^&]+)/);
  if(sm&&!state.sheet){state.selectedStore=decodeURIComponent(sm[1]);state.sheet='store';setTimeout(render,0)}else if(rm&&!state.sheet){state.reportId=decodeURIComponent(rm[1]);state.sheet='report-detail';setTimeout(render,0)}
 }
}
async function refreshShared({quiet=true}={}){
 if(!backendConfigured)return;
 try{data=await loadSharedData(authSession);save();applyBranding();render();if(!quiet)toast('Updated')}catch(err){console.error(err);if(!quiet)toast(err.message||'Could not refresh')}
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
  if(a==='open-stores'){if(!isMember())return toast('Members only');state.sheet='stores';render();return}
  if(a==='activity-metric'){state.activityMetric=el.dataset.metric;render();return}
  if(a==='open-product-add'){if(!isMember())return toast('Members only');state.sheet='product-add';render();return}
  if(a==='product-detail'){state.productId=el.dataset.id;state.sheet='product-detail';render();return}
  if(a==='report-detail'){state.reportId=el.dataset.id;state.sheet='report-detail';render();return}
  if(a==='members-manage'){if(currentMember()?.role!=='admin')return toast('Admin only');state.sheet='members-manage';render();return}
  if(a==='edit-profile'){if(!isMember())return toast('Members only');state.sheet='profile';render();return}
  if(a==='drive-store'){driveStore(el.dataset.id);return}
  if(a==='submit-report'){
   const m=currentMember();if(!m)return toast('Sign in to report');
   const status=document.querySelector('input[name="r-status"]:checked')?.value||'unsure';
   const period=document.querySelector('input[name="r-period"]:checked')?.value||periodFor(new Date());
   const occurredRaw=document.getElementById('r-occurred')?.value;const price=parseFloat(document.getElementById('r-price')?.value);
   const r={storeId:document.getElementById('r-store').value,status,flags:{line:document.getElementById('r-line').checked,possible:document.getElementById('r-possible').checked,evidence:document.getElementById('r-evidence').checked},occurredAt:occurredRaw?new Date(occurredRaw).toISOString():iso(),occurredApprox:!!occurredRaw,period,source:document.getElementById('r-source')?.value||'Firsthand',notes:document.getElementById('r-notes')?.value||'',productId:document.getElementById('r-product')?.value||null,price:Number.isFinite(price)?price:null,condition:document.getElementById('r-condition')?.value||null,memberId:m.id};
   await createReport(r);state.sheet='store';state.selectedStore=r.storeId;await refreshShared();toast('Report added');return;
  }
  if(a==='text-store'){await shareStore(el.dataset.id);return}
  if(a==='share-report'){await shareReport(el.dataset.id);return}
  if(a==='sku-lookup'){const q=document.getElementById('sku-lookup').value.trim();if(q)openSearch(q+' trading card product SKU UPC');return}
  if(a==='web-product'){const p=data.products.find(x=>x.id===el.dataset.id);if(p)openSearch(`${p.sku||''} ${p.tcg} ${p.name}`.trim());return}
  if(a==='toggle-product'){const p=data.products.find(x=>x.id===el.dataset.id);if(!p||!isMember())return;await setProductArchived(p.id,p.active);await refreshShared();toast(p.active?'Product archived':'Product restored');return}
  if(a==='toggle-store'){const s=data.stores.find(x=>x.id===el.dataset.id);if(!s||!isMember())return;await setStoreArchived(s.id,s.active);await refreshShared();toast(s.active?'Store archived':'Store restored');return}
  if(a==='add-product'){
   const m=currentMember(),n=document.getElementById('new-product').value.trim(),tcg=document.getElementById('new-tcg').value,sku=document.getElementById('new-sku').value.trim();
   if(n&&m){await createProduct({name:n,tcg,sku,upc:sku},m.id);state.sheet=null;await refreshShared();toast('Product added')}return;
  }
  if(a==='select-store-result'){
   const box=document.getElementById('store-suggestions'),r=box?._results?.[Number(el.dataset.index)];if(!r)return;
   const name=document.getElementById('new-store'),address=document.getElementById('new-address'),lat=document.getElementById('new-lat'),lng=document.getElementById('new-lng'),search=document.getElementById('store-search');
   if(name&&!name.value.trim())name.value=storeResultName(r);if(address)address.value=storeResultAddress(r);if(lat)lat.value=r.lat??'';if(lng)lng.value=r.lon??'';if(search)search.value=storeResultName(r);box.hidden=true;toast('Location selected');return;
  }
  if(a==='add-store'){
   const m=currentMember(),n=document.getElementById('new-store').value.trim(),address=document.getElementById('new-address').value.trim(),lat=parseFloat(document.getElementById('new-lat').value),lng=parseFloat(document.getElementById('new-lng').value);
   if(n&&m&&Number.isFinite(lat)&&Number.isFinite(lng)){await createStore({name:n,address,lat,lng},m.id);state.sheet=null;await refreshShared();toast('Store added')}else toast('Add name, latitude and longitude');return;
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
  if(a==='save-profile'){
   const m=currentMember();if(!m)return;const name=document.getElementById('profile-name').value.trim(),file=document.getElementById('profile-avatar').files[0];let avatarPath=m.avatarPath||null;
   if(file){const blob=await resizeImageBlob(file,500,0.82);avatarPath=await uploadProfileImage(m.id,blob)}
   await updateMyProfile(name,name,avatarPath);state.sheet=null;await refreshShared();toast('Profile saved');return;
  }
  if(a==='save-branding'){
   const m=currentMember();if(m?.role!=='admin')return;const name=document.getElementById('app-name').value.trim()||appName(),file=document.getElementById('app-icon').files[0];let iconPath=data.settings.appIconPath||null;
   if(file){const blob=await resizeImageBlob(file,512,0.84);iconPath=await uploadBrandIcon(blob)}
   await updateBranding(name,iconPath,m.id);await refreshShared();toast('Branding saved');return;
  }
  if(a==='invite-member'){
   const em=document.getElementById('invite-email').value.trim();if(em){const text=`Invite ${em}: Supabase Dashboard → Authentication → Users → Add user → Send invitation.`;await navigator.clipboard?.writeText(text);toast('Invite instructions copied')}return;
  }
  if(a==='share-app'){if(navigator.share)await navigator.share({title:appName(),text:`Join my local ${appName()} group`,url:location.href});else await navigator.clipboard?.writeText(location.href).then(()=>toast('App link copied'));return}
 }catch(err){console.error(err);toast(err?.message||'Something went wrong')}
});

document.addEventListener('change',e=>{const t=e.target;if(t.dataset.change==='activity-store'){state.activityStore=t.value;render()}if(t.dataset.change==='analytics'){state.analytics={metric:document.getElementById('a-metric').value,tcg:document.getElementById('a-tcg').value,productId:document.getElementById('a-product').value,storeId:document.getElementById('a-store').value,period:document.getElementById('a-period').value,range:Number(document.getElementById('a-range').value),groupBy:document.getElementById('a-group').value};render()}});

document.addEventListener('input',e=>{
 if(e.target.id!=='store-search')return;clearTimeout(storeLookupTimer);const q=e.target.value;const box=document.getElementById('store-suggestions');if(q.trim().length<3){if(box)box.hidden=true;return}
 storeLookupTimer=setTimeout(async()=>{try{showStoreSuggestions(await lookupStores(q))}catch(err){if(err.name!=='AbortError'){console.error(err);if(box){box.innerHTML='<div class="lookup-empty">Lookup unavailable. Manual entry still works.</div>';box.hidden=false}}}},350)
});

function resizeImageBlob(file,max=500,quality=.82){return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>{const img=new Image();img.onload=()=>{const scale=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);c.toBlob(b=>b?resolve(b):reject(new Error('Could not resize image')),'image/jpeg',quality)};img.onerror=reject;img.src=fr.result};fr.onerror=reject;fr.readAsDataURL(file)})}

async function init(){
 try{
  if(!backendConfigured){appReady=true;render();return}
  authSession=await getAuthSession();viewerMode=false;
  data=await loadSharedData(authSession);save();applyBranding();appReady=true;render();
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

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';

export const backendConfigured = /^https:\/\//.test(SUPABASE_URL) && !SUPABASE_URL.includes('PASTE_') && SUPABASE_PUBLISHABLE_KEY && !SUPABASE_PUBLISHABLE_KEY.includes('PASTE_');
export const supabase = backendConfigured ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' }
}) : null;

const sourceFromDb = v => v ? (({firsthand:'Firsthand',friend:'Friend',phone_call:'Phone call',social_media:'Social media',employee:'Store employee',other:'Other'})[v] || v) : null;
const sourceToDb = v => ({'Firsthand':'firsthand','Friend':'friend','Phone call':'phone_call','Social media':'social_media','Store employee':'employee','Other':'other'})[v] || 'other';
const conditionFromDb = v => v ? v.charAt(0).toUpperCase()+v.slice(1) : null;
const conditionToDb = v => v ? v.toLowerCase() : null;

function publicUrl(bucket, path){
  if(!path || !supabase) return null;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

const mapStore = s => ({id:s.id,name:s.name,storeType:s.store_type||'Retail Chain',chain:s.chain||'',area:[s.city,s.state].filter(Boolean).join(', ')||'',address:s.address||'',city:s.city||'',state:s.state||'',postalCode:s.postal_code||'',lat:s.latitude==null?null:Number(s.latitude),lng:s.longitude==null?null:Number(s.longitude),active:s.active!==false&&!s.deleted_at,deletedAt:s.deleted_at||null,createdBy:s.created_by||null,createdAt:s.created_at,updatedAt:s.updated_at});
const mapProduct = p => ({id:p.id,name:p.name,tcg:p.tcg,setName:p.set_name||'',sku:p.sku||p.upc||'',upc:p.upc||'',active:p.active!==false&&!p.deleted_at,deletedAt:p.deleted_at||null,createdBy:p.created_by||null,createdAt:p.created_at,updatedAt:p.updated_at});
const mapReport = r => ({id:r.id,dropEventId:r.drop_event_id||null,storeId:r.store_id,productId:r.product_id||null,memberId:r.member_id||null,status:r.status,flags:{line:!!r.people_lining_up,possible:!!r.possible_restock,evidence:!!r.restock_evidence},indicatorIds:[],period:r.time_bucket,source:sourceFromDb(r.source_type),sourceDetail:r.source_detail||'',notes:r.notes||'',price:r.price==null?null:Number(r.price),condition:conditionFromDb(r.condition),evidenceUrl:r.evidence_url||'',occurredAt:r.occurred_at,occurredApprox:!!r.occurred_at_is_approx,createdAt:r.created_at,updatedAt:r.updated_at,deletedAt:r.deleted_at||null});

async function q(promise){const {data,error}=await promise;if(error)throw error;return data||[]}

export async function getAuthSession(){
  if(!supabase) return null;

  // Supabase normally detects Magic Link tokens automatically. Handle the
  // redirect explicitly as a fallback so mobile browsers/PWAs do not render
  // the signed-out screen before the returned session has been persisted.
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  if(code){
    const {data,error}=await supabase.auth.exchangeCodeForSession(code);
    if(error) throw error;
    cleanAuthRedirectUrl();
    if(data?.session) return data.session;
  }

  const hash = new URLSearchParams(window.location.hash.replace(/^#/,''));
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  if(accessToken && refreshToken){
    const {data,error}=await supabase.auth.setSession({access_token:accessToken,refresh_token:refreshToken});
    if(error) throw error;
    cleanAuthRedirectUrl();
    if(data?.session) return data.session;
  }

  const {data,error}=await supabase.auth.getSession();
  if(error) throw error;
  if(data.session) return data.session;

  // Give the client's automatic URL/session initialization a brief chance to
  // finish before deciding that the user is signed out.
  return await new Promise(resolve=>{
    let done=false;
    const finish=session=>{if(done)return;done=true;clearTimeout(timer);subscription?.unsubscribe();resolve(session||null)};
    const {data:listener}=supabase.auth.onAuthStateChange((event,session)=>{
      if(event==='INITIAL_SESSION'||event==='SIGNED_IN') finish(session);
    });
    const subscription=listener.subscription;
    const timer=setTimeout(async()=>{
      try{const {data:latest}=await supabase.auth.getSession();finish(latest.session)}catch{finish(null)}
    },1500);
  });
}

function cleanAuthRedirectUrl(){
  const url = new URL(window.location.href);
  ['code','token','type','error','error_code','error_description'].forEach(k=>url.searchParams.delete(k));
  // Auth token fragments are not app deep links, so remove only those.
  if(/(?:^|#|&)access_token=|(?:^|#|&)refresh_token=/.test(window.location.hash)) url.hash='';
  history.replaceState(null,'',url.pathname+(url.searchParams.toString()?`?${url.searchParams}`:'')+url.hash);
}

export function onAuthStateChange(cb){
  if(!supabase) return {unsubscribe(){}};
  const {data}=supabase.auth.onAuthStateChange((event,session)=>cb(event,session));
  return data.subscription;
}

export async function sendMagicLink(email){
  if(!supabase) throw new Error('Supabase is not configured.');
  const redirectTo = location.origin + location.pathname;
  const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:redirectTo,shouldCreateUser:false}});
  if(error) throw error;
}


export async function signUpWithInvite(email,password,inviteCode,username){
  if(!supabase) throw new Error('Supabase is not configured.');
  const redirectTo=location.origin+location.pathname;
  const {data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:redirectTo,data:{invite_code:inviteCode,username}}});
  if(error) throw error;
  return {user:data?.user||null,session:data?.session||null};
}

export async function sendPasswordReset(email){
  if(!supabase) throw new Error('Supabase is not configured.');
  const redirectTo=location.origin+location.pathname;
  const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo});
  if(error) throw error;
}
export async function validateInviteCode(code){if(!supabase)throw new Error('Supabase is not configured.');const {data,error}=await supabase.rpc('validate_member_invite',{p_code:code});if(error)throw error;if(!data)throw new Error('Invite code is invalid, expired, used, or revoked.');return true;}
export async function sendInviteMagicLink(email,code){if(!supabase)throw new Error('Supabase is not configured.');const redirectTo=location.origin+location.pathname;const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:redirectTo,shouldCreateUser:true,data:{invite_code:code}}});if(error)throw error;}
export async function createInviteCode(label=''){const {data,error}=await supabase.rpc('create_member_invite',{p_label:label||null});if(error)throw error;return {id:data.id,code:data.code,label:data.invitee_label||'',createdAt:data.created_at,expiresAt:data.expires_at};}
export async function revokeInviteCode(id){const {error}=await supabase.from('member_invites').update({revoked_at:new Date().toISOString()}).eq('id',id);if(error)throw error;}
export async function updateReleaseMessage(releaseMessage){const {error}=await supabase.from('app_settings').update({release_message:releaseMessage}).eq('id',true);if(error)throw error;}

export async function signInWithPassword(email,password){
  if(!supabase) throw new Error('Supabase is not configured.');
  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  if(error) throw error;
  return data?.session||null;
}

export async function updatePassword(password){
  if(!supabase) throw new Error('Supabase is not configured.');
  const {data,error}=await supabase.auth.updateUser({password});
  if(error) throw error;
  return data?.user||null;
}

export async function signOut(){
  if(!supabase) return;
  const {error}=await supabase.auth.signOut();
  if(error) throw error;
}

export async function recordLogin(){
  if(!supabase) return;
  const {error}=await supabase.rpc('record_login');
  if(error) console.warn('record_login:',error.message);
}
export async function recordSession(){
  if(!supabase) return;
  const {error}=await supabase.rpc('record_session');
  if(error) console.warn('record_session:',error.message);
}

export async function loadSharedData(session=null){
  if(!supabase) throw new Error('Supabase is not configured.');
  const settingsRows=await q(supabase.from('app_settings').select('*').limit(1));
  const setting=settingsRows[0]||{app_name:'ChaseDex',app_icon_path:null};
  const baseSettings={periods:['Morning','Noon','Afternoon','Evening'],appName:(!setting.app_name||setting.app_name==='TCG Scout')?'ChaseDex':setting.app_name,appIcon:publicUrl('app-branding',setting.app_icon_path),appIconPath:setting.app_icon_path||null,loginHeadline:setting.login_headline||'Fast local restock, price and activity intelligence for your group.',loginAccessMessage:setting.login_access_message||'Member signup is invite-only. Use your password for normal sign-in. Magic Link remains available for first-time access or recovery.',appVersion:setting.app_version||'1.9.2',pushVapidPublicKey:setting.push_vapid_public_key||'',rankingTitles:[]};

  if(!session) return {version:1.9,stores:[],products:[],reports:[],members:[],savedFilters:[],indicators:[],invites:[],changeLog:[],dropEvents:[],dropWatches:[],settings:baseSettings};

  const profileRows=await q(supabase.from('profiles').select('*').eq('id',session.user.id).limit(1));
  const meProfile=profileRows[0];
  if(!meProfile) throw new Error('Your member profile has not been created yet.');

  const [stores,products,reports,saved,tiers,profiles,rankings,feedback,indicators,reportIndicators]=await Promise.all([
    q(supabase.from('stores').select('*').order('name')),
    q(supabase.from('products').select('*').order('name')),
    q(supabase.from('reports').select('*').order('occurred_at',{ascending:false}).limit(3000)),
    q(supabase.from('saved_analytics').select('*').eq('owner_id',session.user.id).order('created_at')),
    q(supabase.from('ranking_tiers').select('*').order('min_points')),
    q(supabase.from('profiles').select('id,username,display_name,avatar_path,role,created_at')),
    q(supabase.from('member_contribution_rankings').select('*')),
    q(supabase.from('report_feedback').select('*')),
    q(supabase.from('report_indicators_catalog').select('*').order('sort_order')),
    q(supabase.from('report_indicator_values').select('*'))
  ]);

  let adminActivity=[];
  if(meProfile.role==='admin'){
    adminActivity=await q(supabase.from('admin_member_activity').select('*'));
  }
  const profById=new Map(profiles.map(p=>[p.id,p]));
  const adminById=new Map(adminActivity.map(a=>[a.id,a]));
  const members=rankings.map(r=>{
    const p=profById.get(r.id)||{},a=adminById.get(r.id)||{};
    return {id:r.id,name:r.display_name||r.username||'Scout',username:r.username||'',email:a.email||(r.id===session.user.id?session.user.email:''),role:p.role||'member',avatarPath:r.avatar_path||null,avatar:publicUrl('profile-images',r.avatar_path),reports:Number(r.reports||0),confirmations:Number(r.confirmations||0),points:Number(r.contribution_points||0),rankingTitle:r.ranking_title||'Scout',rank:Number(r.contribution_rank||0),activeDays:Number(a.active_days||0),sessions:Number(a.session_count||0),logins:Number(a.login_count||0),lastActive:a.last_active_at||null,lastLogin:a.last_login_at||null,enabled:a.is_enabled!==false};
  });
  if(!members.some(m=>m.id===session.user.id)){
    const a=adminById.get(session.user.id)||{};
    members.push({id:session.user.id,name:meProfile.display_name||meProfile.username||'Scout',username:meProfile.username||'',email:a.email||session.user.email||'',role:meProfile.role||'member',avatarPath:meProfile.avatar_path||null,avatar:publicUrl('profile-images',meProfile.avatar_path),reports:0,confirmations:0,points:0,rankingTitle:'Scout',rank:0,activeDays:Number(a.active_days||0),sessions:Number(a.session_count||0),logins:Number(a.login_count||0),lastActive:a.last_active_at||null,lastLogin:a.last_login_at||null,enabled:a.is_enabled!==false});
  }
  if(meProfile.role==='admin'){
    for(const a of adminActivity){
      if(!members.some(m=>m.id===a.id)){const p=profById.get(a.id)||{};members.push({id:a.id,name:a.display_name||a.username||'Scout',username:a.username||'',email:a.email||'',role:p.role||'member',avatarPath:a.avatar_path||null,avatar:publicUrl('profile-images',a.avatar_path),reports:Number(a.reports||0),confirmations:Number(a.confirmations||0),points:Number(a.reports||0)+Number(a.confirmations||0),rankingTitle:'Disabled',rank:0,activeDays:Number(a.active_days||0),sessions:Number(a.session_count||0),logins:Number(a.login_count||0),lastActive:a.last_active_at||null,lastLogin:a.last_login_at||null,enabled:a.is_enabled!==false});}
    }
  }
  // Ensure current member is present even if the ranking view has not yet emitted a row.
  if(!members.some(m=>m.id===session.user.id)) members.push({id:meProfile.id,name:meProfile.display_name||meProfile.username,username:meProfile.username,email:session.user.email||'',role:meProfile.role,avatarPath:meProfile.avatar_path,avatar:publicUrl('profile-images',meProfile.avatar_path),reports:0,confirmations:0,points:0,rankingTitle:'Scout',rank:members.length+1,activeDays:0,sessions:0,logins:0,lastActive:null,enabled:true});

  baseSettings.rankingTitles=tiers.map(t=>({id:t.id,min:Number(t.min_points),title:t.title}));
  const feedbackByReport=new Map();
  for(const f of feedback){const x=feedbackByReport.get(f.report_id)||{confirmations:0,disputes:0,myFeedback:null};if(f.feedback==='confirm')x.confirmations++;else if(f.feedback==='dispute')x.disputes++;if(f.member_id===session.user.id)x.myFeedback=f.feedback;feedbackByReport.set(f.report_id,x)}
  const indicatorMap=new Map();
  for(const ri of reportIndicators){const a=indicatorMap.get(ri.report_id)||[];a.push(ri.indicator_id);indicatorMap.set(ri.report_id,a)}
  const mappedReports=reports.map(mapReport).map(r=>({...r,indicatorIds:indicatorMap.get(r.id)||[],...(feedbackByReport.get(r.id)||{confirmations:0,disputes:0,myFeedback:null})}));
  const savedFilters=saved.map(s=>({id:s.id,name:s.name,ownerId:s.owner_id,...(s.config_json||{})}));
  const mappedIndicators=indicators.map(i=>({id:i.id,label:i.label,emoji:i.emoji,active:i.active!==false,sortOrder:Number(i.sort_order||0)}));
  let changeLog=[];
  if(meProfile.role==='admin') changeLog=await q(supabase.from('chasedex_change_log').select('*').order('changed_at',{ascending:false}).limit(1000));
  const inviteRows=await q(supabase.from('member_invites').select('*').order('created_at',{ascending:false}).limit(meProfile.role==='admin'?500:50));
  const dropEvents=await q(supabase.from('drop_events').select('*').order('starts_at',{ascending:true}));
  const dropWatches=await q(supabase.from('drop_watches').select('*').eq('member_id',session.user.id));
  const memberNames=new Map(members.map(m=>[m.id,m.name]));
  const invites=inviteRows.map(i=>({id:i.id,code:i.code,label:i.invitee_label||'',createdBy:i.created_by,creatorName:memberNames.get(i.created_by)||'Member',createdAt:i.created_at,expiresAt:i.expires_at,redeemedAt:i.redeemed_at,redeemedEmail:i.redeemed_email||'',revokedAt:i.revoked_at}));
  const mappedDropEvents=dropEvents.map(e=>({id:e.id,title:e.title||'',eventType:e.event_type,storeId:e.store_id,productId:e.product_id||null,startsAt:e.starts_at,sourceType:e.source_type,confidence:e.confidence,price:e.price==null?null:Number(e.price),purchaseRules:e.purchase_rules||'',notes:e.notes||'',createdBy:e.created_by||null,createdAt:e.created_at||null,updatedAt:e.updated_at||null,deletedAt:e.deleted_at||null}));
  const mappedDropWatches=dropWatches.map(w=>({id:w.id,dropEventId:w.drop_event_id,memberId:w.member_id}));
  return {version:1.9,stores:stores.map(mapStore),products:products.map(mapProduct),reports:mappedReports,members,savedFilters,indicators:mappedIndicators,invites,changeLog,dropEvents:mappedDropEvents,dropWatches:mappedDropWatches,settings:baseSettings};
}

export async function createReport(r){
  const payload={store_id:r.storeId,product_id:r.productId||null,drop_event_id:r.dropEventId||null,member_id:r.memberId,status:r.status,time_bucket:r.period,people_lining_up:false,possible_restock:false,restock_evidence:false,source_type:sourceToDb(r.source),source_detail:r.sourceDetail||null,notes:r.notes||null,price:r.price,condition:conditionToDb(r.condition),occurred_at:r.occurredAt,occurred_at_is_approx:!!r.occurredApprox};
  const {data,error}=await supabase.from('reports').insert(payload).select().single();if(error)throw error;
  if(r.indicatorIds?.length){const {error:ie}=await supabase.from('report_indicator_values').insert(r.indicatorIds.map(indicator_id=>({report_id:data.id,indicator_id})));if(ie)throw ie}
  return {...mapReport(data),indicatorIds:r.indicatorIds||[]};
}
export async function createStore(s,userId){
  const payload={name:s.name,chain:s.chain||'Member added',address:s.address||null,city:s.city||null,state:s.state||null,postal_code:s.postalCode||null,latitude:s.lat,longitude:s.lng,store_type:s.storeType||'Retail Chain',created_by:userId};
  const {data,error}=await supabase.from('stores').insert(payload).select().single();if(error)throw error;return mapStore(data);
}
export async function setStoreArchived(id,archived){const {error}=await supabase.rpc('set_store_archived',{p_store_id:id,p_archived:archived});if(error)throw error;}
export async function createProduct(p,userId){const payload={name:p.name,tcg:p.tcg,set_name:p.setName||null,sku:p.sku||null,upc:p.upc||null,created_by:userId};const {data,error}=await supabase.from('products').insert(payload).select().single();if(error)throw error;return mapProduct(data);}
export async function setProductArchived(id,archived){const {error}=await supabase.rpc('set_product_archived',{p_product_id:id,p_archived:archived});if(error)throw error;}
export async function saveAnalytics(name,config,userId){const {data,error}=await supabase.from('saved_analytics').insert({owner_id:userId,name,config_json:config}).select().single();if(error)throw error;return {id:data.id,name:data.name,ownerId:data.owner_id,...(data.config_json||{})};}

export async function uploadProfileImage(userId,blob){
  const path=`${userId}/avatar-${Date.now()}.jpg`;
  const {error}=await supabase.storage.from('profile-images').upload(path,blob,{contentType:'image/jpeg',upsert:false,cacheControl:'3600'});
  if(error)throw error;
  return path;
}
export async function updateMyProfile(username,displayName,avatarPath){const {error}=await supabase.rpc('update_my_profile',{p_username:username,p_display_name:displayName||null,p_avatar_path:avatarPath||null});if(error)throw error;}
export async function uploadBrandIcon(blob){const path='app/app-icon.jpg';const {error}=await supabase.storage.from('app-branding').upload(path,blob,{contentType:'image/jpeg',upsert:true,cacheControl:'3600'});if(error)throw error;return path;}
export async function updateBranding(appName,appIconPath,userId){const {error}=await supabase.from('app_settings').update({app_name:appName,app_icon_path:appIconPath||null,updated_by:userId}).eq('id',true);if(error)throw error;}

export async function updateRankingTiers(levels){
  for(const l of levels){
    if(l.id){const {error}=await supabase.from('ranking_tiers').update({min_points:l.min,title:l.title}).eq('id',l.id);if(error)throw error;}
  }
}
export async function setMemberEnabled(id,enabled){const {error}=await supabase.from('profile_private').update({is_enabled:enabled}).eq('id',id);if(error)throw error;}

export async function adminUpdateStore(id,s){
  const payload={
    name:s.name, chain:s.chain||null, address:s.address||null,
    city:s.city||null, state:s.state||null, postal_code:s.postalCode||null,
    latitude:s.lat, longitude:s.lng, active:s.active!==false
  };
  const {error}=await supabase.from('stores').update(payload).eq('id',id);
  if(error)throw error;
}

export async function adminUpdateProduct(id,p){
  const payload={
    name:p.name, tcg:p.tcg, set_name:p.setName||null,
    sku:p.sku||null, upc:p.upc||null, active:p.active!==false
  };
  const {error}=await supabase.from('products').update(payload).eq('id',id);
  if(error)throw error;
}

export async function adminUpdateReport(id,r){
  const payload={
    store_id:r.storeId,
    product_id:r.productId||null,
    status:r.status,
    time_bucket:r.period,
    people_lining_up:!!r.flags?.line,
    possible_restock:!!r.flags?.possible,
    restock_evidence:!!r.flags?.evidence,
    source_type:sourceToDb(r.source),
    source_detail:r.sourceDetail||null,
    notes:r.notes||null,
    price:r.price,
    condition:conditionToDb(r.condition),
    occurred_at:r.occurredAt,
    occurred_at_is_approx:!!r.occurredApprox
  };
  const {error}=await supabase.from('reports').update(payload).eq('id',id);
  if(error)throw error;
}


export async function updateStore(id,s){
  const {error}=await supabase.from('stores').update({name:s.name,chain:s.chain||null,address:s.address||null,city:s.city||null,state:s.state||null,postal_code:s.postalCode||null,latitude:s.lat,longitude:s.lng,store_type:s.storeType||'Retail Chain',active:true}).eq('id',id);if(error)throw error;
}
export async function deleteStore(id){const {error}=await supabase.from('stores').update({deleted_at:new Date().toISOString(),active:false}).eq('id',id);if(error)throw error;}
export async function updateProduct(id,p){const {error}=await supabase.from('products').update({name:p.name,tcg:p.tcg,set_name:p.setName||null,sku:p.sku||null,upc:p.upc||null,active:true}).eq('id',id);if(error)throw error;}
export async function deleteProduct(id){const {error}=await supabase.from('products').update({deleted_at:new Date().toISOString(),active:false}).eq('id',id);if(error)throw error;}
export async function updateReport(id,r){
  const payload={store_id:r.storeId,product_id:r.productId||null,drop_event_id:r.dropEventId||null,status:r.status,time_bucket:r.period,source_type:sourceToDb(r.source),source_detail:r.sourceDetail||null,notes:r.notes||null,price:r.price,condition:conditionToDb(r.condition),occurred_at:r.occurredAt,occurred_at_is_approx:!!r.occurredApprox};
  const {error}=await supabase.from('reports').update(payload).eq('id',id);if(error)throw error;
  const {error:de}=await supabase.from('report_indicator_values').delete().eq('report_id',id);if(de)throw de;
  if(r.indicatorIds?.length){const {error:ie}=await supabase.from('report_indicator_values').insert(r.indicatorIds.map(indicator_id=>({report_id:id,indicator_id})));if(ie)throw ie}
}
export async function deleteReport(id){const {error}=await supabase.from('reports').update({deleted_at:new Date().toISOString()}).eq('id',id);if(error)throw error;}
export async function saveIndicator(i){
  if(i.id){const {error}=await supabase.from('report_indicators_catalog').update({label:i.label,emoji:i.emoji,active:i.active!==false,sort_order:i.sortOrder||0}).eq('id',i.id);if(error)throw error;return}
  const {error}=await supabase.from('report_indicators_catalog').insert({label:i.label,emoji:i.emoji,active:true,sort_order:i.sortOrder||0});if(error)throw error;
}
export async function deleteIndicator(id){const {error}=await supabase.from('report_indicators_catalog').update({active:false}).eq('id',id);if(error)throw error;}
export async function setReportFeedback(reportId,memberId,feedback){const {error}=await supabase.from('report_feedback').upsert({report_id:reportId,member_id:memberId,feedback},{onConflict:'report_id,member_id'});if(error)throw error;}

export async function createDropEvent(e){const {data,error}=await supabase.from('drop_events').insert({event_type:e.eventType,store_id:e.storeId,product_id:e.productId||null,starts_at:e.startsAt,source_type:e.sourceType,confidence:e.confidence,price:e.price,purchase_rules:e.purchaseRules||null,notes:e.notes||null,created_by:(await supabase.auth.getUser()).data.user?.id}).select().single();if(error)throw error;return data}
export async function toggleDropWatch(dropEventId,memberId){const {data,error}=await supabase.from('drop_watches').select('id').eq('drop_event_id',dropEventId).eq('member_id',memberId).maybeSingle();if(error)throw error;if(data?.id){const {error:e}=await supabase.from('drop_watches').delete().eq('id',data.id);if(e)throw e}else{const {error:e}=await supabase.from('drop_watches').insert({drop_event_id:dropEventId,member_id:memberId});if(e)throw e}}
export async function deleteDropEvent(id){const {error}=await supabase.from('drop_events').update({deleted_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id);if(error)throw error}
export async function restoreDropEvent(id){const {error}=await supabase.from('drop_events').update({deleted_at:null,updated_at:new Date().toISOString()}).eq('id',id);if(error)throw error}
export async function permanentDeleteDropEvent(id){const {error}=await supabase.rpc('admin_permanent_delete_drop_event',{p_drop_event_id:id});if(error)throw error}
export async function permanentDeleteReport(id){const {error}=await supabase.rpc('admin_permanent_delete_report',{p_report_id:id});if(error)throw error}
export async function permanentDeleteChangeLog(id){const {error}=await supabase.rpc('admin_permanent_delete_change_log',{p_log_id:id});if(error)throw error}

export async function loadNotifications(){const {data,error}=await supabase.from('notifications').select('*').order('created_at',{ascending:false}).limit(100);if(error)throw error;return (data||[]).map(n=>({id:n.id,type:n.type,title:n.title,body:n.body||'',reportId:n.report_id||null,dropEventId:n.drop_event_id||null,storeId:n.store_id||null,productId:n.product_id||null,createdAt:n.created_at,readAt:n.read_at||null}))}
export async function loadNotificationPreferences(){const {data:{user}}=await supabase.auth.getUser();if(!user)return{};const {data,error}=await supabase.from('notification_preferences').select('*').eq('member_id',user.id).maybeSingle();if(error)throw error;return data||{push_enabled:false,stock_reports:true,missed_stock:true,no_stock:false,new_drops:true,drop_updates:true,watched_drop_reminders:true}}
export async function saveNotificationPreferences(prefs){const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Sign in required');const payload={member_id:user.id,push_enabled:!!prefs.push_enabled,stock_reports:!!prefs.stock_reports,missed_stock:!!prefs.missed_stock,no_stock:!!prefs.no_stock,new_drops:!!prefs.new_drops,drop_updates:!!prefs.drop_updates,watched_drop_reminders:!!prefs.watched_drop_reminders,updated_at:new Date().toISOString()};const {error}=await supabase.from('notification_preferences').upsert(payload,{onConflict:'member_id'});if(error)throw error}
export async function savePushSubscription(sub){const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Sign in required');const {error}=await supabase.from('push_subscriptions').upsert({member_id:user.id,endpoint:sub.endpoint,p256dh:sub.keys?.p256dh,auth:sub.keys?.auth,user_agent:navigator.userAgent,updated_at:new Date().toISOString()},{onConflict:'endpoint'});if(error)throw error}
export async function deletePushSubscription(endpoint){const {error}=await supabase.from('push_subscriptions').delete().eq('endpoint',endpoint);if(error)throw error}
export async function markNotificationRead(id){const {error}=await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id);if(error)throw error}
export async function markAllNotificationsRead(){const {data:{user}}=await supabase.auth.getUser();if(!user)return;const {error}=await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('member_id',user.id).is('read_at',null);if(error)throw error}
export function subscribeNotifications(memberId,onChange){if(!supabase)return null;return supabase.channel(`chasedex-notifications-${memberId}`).on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:`member_id=eq.${memberId}`},onChange).subscribe()}

export function subscribeRealtime(onChange){
  if(!supabase) return null;
  const channel=supabase.channel('tcg-scout-live')
    .on('postgres_changes',{event:'*',schema:'public',table:'stores'},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'products'},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'reports'},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'report_feedback'},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'ranking_tiers'},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'app_settings'},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'report_indicators_catalog'},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'report_indicator_values'},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'member_invites'},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'drop_events'},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'drop_watches'},onChange)
    .subscribe();
  return channel;
}

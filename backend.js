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

const mapStore = s => ({id:s.id,name:s.name,chain:s.chain||'',area:[s.city,s.state].filter(Boolean).join(', ')||'',address:s.address||'',city:s.city||'',state:s.state||'',postalCode:s.postal_code||'',lat:s.latitude==null?null:Number(s.latitude),lng:s.longitude==null?null:Number(s.longitude),active:s.active!==false,createdBy:s.created_by||null,createdAt:s.created_at,updatedAt:s.updated_at});
const mapProduct = p => ({id:p.id,name:p.name,tcg:p.tcg,setName:p.set_name||'',sku:p.sku||p.upc||'',upc:p.upc||'',active:p.active!==false,createdBy:p.created_by||null,createdAt:p.created_at,updatedAt:p.updated_at});
const mapReport = r => ({id:r.id,storeId:r.store_id,productId:r.product_id||null,memberId:r.member_id||null,status:r.status,flags:{line:!!r.people_lining_up,possible:!!r.possible_restock,evidence:!!r.restock_evidence},period:r.time_bucket,source:sourceFromDb(r.source_type),sourceDetail:r.source_detail||'',notes:r.notes||'',price:r.price==null?null:Number(r.price),condition:conditionFromDb(r.condition),evidenceUrl:r.evidence_url||'',occurredAt:r.occurred_at,occurredApprox:!!r.occurred_at_is_approx,createdAt:r.created_at,updatedAt:r.updated_at});

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

export async function signInWithPassword(email,password){
  if(!supabase) throw new Error('Supabase is not configured.');
  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  if(error) throw error;
  return data?.session||null;
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
  const baseSettings={periods:['Morning','Noon','Afternoon','Evening'],appName:(!setting.app_name||setting.app_name==='TCG Scout')?'ChaseDex':setting.app_name,appIcon:publicUrl('app-branding',setting.app_icon_path),appIconPath:setting.app_icon_path||null,rankingTitles:[]};

  if(!session){
    const [stores,products,reports]=await Promise.all([
      q(supabase.from('public_stores').select('*')),
      q(supabase.from('public_products').select('*')),
      q(supabase.from('public_activity').select('*').order('occurred_at',{ascending:false}).limit(1500))
    ]);
    return {version:1.3,stores:stores.map(mapStore),products:products.map(mapProduct),reports:reports.map(mapReport),members:[],savedFilters:[],settings:baseSettings};
  }

  const profileRows=await q(supabase.from('profiles').select('*').eq('id',session.user.id).limit(1));
  const meProfile=profileRows[0];
  if(!meProfile) throw new Error('Your member profile has not been created yet.');

  const [stores,products,reports,saved,tiers,profiles,rankings,feedback]=await Promise.all([
    q(supabase.from('stores').select('*').order('name')),
    q(supabase.from('products').select('*').order('name')),
    q(supabase.from('reports').select('*').order('occurred_at',{ascending:false}).limit(3000)),
    q(supabase.from('saved_analytics').select('*').eq('owner_id',session.user.id).order('created_at')),
    q(supabase.from('ranking_tiers').select('*').order('min_points')),
    q(supabase.from('profiles').select('id,username,display_name,avatar_path,role,created_at')),
    q(supabase.from('member_contribution_rankings').select('*')),
    q(supabase.from('report_feedback').select('*'))
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
  const mappedReports=reports.map(mapReport).map(r=>({...r,...(feedbackByReport.get(r.id)||{confirmations:0,disputes:0,myFeedback:null})}));
  const savedFilters=saved.map(s=>({id:s.id,name:s.name,ownerId:s.owner_id,...(s.config_json||{})}));
  return {version:1.3,stores:stores.map(mapStore),products:products.map(mapProduct),reports:mappedReports,members,savedFilters,settings:baseSettings};
}

export async function createReport(r){
  const payload={store_id:r.storeId,product_id:r.productId||null,member_id:r.memberId,status:r.status,time_bucket:r.period,people_lining_up:!!r.flags?.line,possible_restock:!!r.flags?.possible,restock_evidence:!!r.flags?.evidence,source_type:sourceToDb(r.source),source_detail:r.sourceDetail||null,notes:r.notes||null,price:r.price,condition:conditionToDb(r.condition),occurred_at:r.occurredAt,occurred_at_is_approx:!!r.occurredApprox};
  const {data,error}=await supabase.from('reports').insert(payload).select().single();if(error)throw error;return mapReport(data);
}
export async function createStore(s,userId){
  const payload={name:s.name,chain:s.chain||'Member added',address:s.address||null,city:s.city||null,state:s.state||null,postal_code:s.postalCode||null,latitude:s.lat,longitude:s.lng,created_by:userId};
  const {data,error}=await supabase.from('stores').insert(payload).select().single();if(error)throw error;return mapStore(data);
}
export async function setStoreArchived(id,archived){const {error}=await supabase.rpc('set_store_archived',{p_store_id:id,p_archived:archived});if(error)throw error;}
export async function createProduct(p,userId){const payload={name:p.name,tcg:p.tcg,set_name:p.setName||null,sku:p.sku||null,upc:p.upc||null,created_by:userId};const {data,error}=await supabase.from('products').insert(payload).select().single();if(error)throw error;return mapProduct(data);}
export async function setProductArchived(id,archived){const {error}=await supabase.rpc('set_product_archived',{p_product_id:id,p_archived:archived});if(error)throw error;}
export async function saveAnalytics(name,config,userId){const {data,error}=await supabase.from('saved_analytics').insert({owner_id:userId,name,config_json:config}).select().single();if(error)throw error;return {id:data.id,name:data.name,ownerId:data.owner_id,...(data.config_json||{})};}

export async function uploadProfileImage(userId,blob){
  const path=`${userId}/avatar.jpg`;
  const {error}=await supabase.storage.from('profile-images').upload(path,blob,{contentType:'image/jpeg',upsert:true,cacheControl:'3600'});if(error)throw error;return path;
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

export async function setReportFeedback(reportId,memberId,feedback){const {error}=await supabase.from('report_feedback').upsert({report_id:reportId,member_id:memberId,feedback},{onConflict:'report_id,member_id'});if(error)throw error;}

export function subscribeRealtime(onChange){
  if(!supabase) return null;
  const channel=supabase.channel('tcg-scout-live')
    .on('postgres_changes',{event:'*',schema:'public',table:'stores'},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'products'},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'reports'},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'report_feedback'},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'ranking_tiers'},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'app_settings'},onChange)
    .subscribe();
  return channel;
}

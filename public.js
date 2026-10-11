let supa=null;
async function initSupabase(){
  if(CFG.DEMO_MODE || !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) return;
  supa=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY);
}
async function fetchCard(code){
  if(CFG.DEMO_MODE || !supa){
    const db=getDemo(); const client=db.clients.find(c=>c.code.toLowerCase()===code.toLowerCase());
    if(!client) return null;
    const movements=db.movements.filter(m=>m.client_id===client.id).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,8);
    return {client,movements};
  }
  const {data,error}=await supa.rpc('public_get_card',{p_code:code}); if(error) throw error;
  const client=Array.isArray(data)?data[0]:data; if(!client) return null;
  const mv=await supa.rpc('public_get_movements',{p_code:code,p_limit:8}); if(mv.error) throw mv.error;
  return {client:{...client,code:client.code||code},movements:mv.data||[]};
}
function movementLabel(m){
  if(m.type==='redeem') return 'Canje de puntos';
  if(m.type==='adjustment') return 'Ajuste';
  if(Number(m.redeemed_mxn)>0) return 'Compra con canje';
  return 'Compra';
}
function renderMovement(m){
  const plus=Number(m.points_delta)>=0;
  return `<div class="movement"><div class="movement-icon">${plus?'+':'−'}</div><div><div class="movement-title">${movementLabel(m)}</div><div class="movement-meta">${displayDate(m.date)} · ${m.paid!=null?money(m.paid)+' pagados':''}</div></div><div class="movement-points ${plus?'plus':'minus'}">${plus?'+':''}${num(m.points_delta)} pts</div></div>`;
}
function renderCard(client,movements){
  document.getElementById('searchView').classList.add('hidden');
  document.getElementById('cardView').classList.remove('hidden');
  document.getElementById('clientName').textContent=client.name;
  document.getElementById('clientCode').textContent=`Folio: ${client.code}`;
  document.getElementById('points').textContent=num(client.points);
  document.getElementById('pointsMoney').textContent=`Equivalen a ${money(mxnFromPoints(client.points))}`;
  document.getElementById('lastPurchase').textContent=displayDate(client.last_purchase);
  document.getElementById('expiresAt').textContent=displayDate(client.expires_at);
  const q=document.getElementById('qrcode'); q.innerHTML=''; new QRCode(q,{text:cardUrl(client.code),width:180,height:180,colorDark:'#191817',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
  document.getElementById('movements').innerHTML=movements.length?movements.map(renderMovement).join(''):'<div class="muted">Todavía no hay movimientos para mostrar.</div>';
}
async function loadCode(code){
  const status=document.getElementById('status'); status.classList.add('hidden');
  try{const data=await fetchCard(code.trim()); if(!data){status.textContent='No encontramos una tarjeta con ese folio.';status.className='status error';return;} renderCard(data.client,data.movements); history.replaceState(null,'',`?codigo=${encodeURIComponent(data.client.code)}`)}
  catch(e){console.error(e);status.textContent='No se pudo consultar la tarjeta. Revisa la configuración e inténtalo nuevamente.';status.className='status error';}
}
function showTerms(){document.getElementById('terms').classList.toggle('hidden')}
window.addEventListener('DOMContentLoaded',async()=>{
  await initSupabase();
  document.getElementById('searchBtn').addEventListener('click',()=>loadCode(document.getElementById('codeInput').value));
  document.getElementById('codeInput').addEventListener('keydown',e=>{if(e.key==='Enter')loadCode(e.target.value)});
  document.getElementById('termsBtn').addEventListener('click',showTerms);
  document.getElementById('backBtn').addEventListener('click',()=>{document.getElementById('cardView').classList.add('hidden');document.getElementById('searchView').classList.remove('hidden');history.replaceState(null,'',location.pathname)});
  const code=new URLSearchParams(location.search).get('codigo'); if(code) loadCode(code);
});

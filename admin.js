let supa=null, session=null, selectedId=null;

function copyClientLink(text, btn){
  const field=document.getElementById('clientLinkField');
  if(!field) return;
  field.value=text;
  field.focus();
  field.select();
  try{ field.setSelectionRange(0, field.value.length); }catch(_){ }

  let copied=false;
  try{ copied=document.execCommand('copy'); }catch(_){ copied=false; }
  if(copied){
    if(btn){ const old=btn.textContent; btn.textContent='¡Copiado!'; setTimeout(()=>btn.textContent=old,1600); }
    toast('Enlace copiado');
    return;
  }

  if(navigator.clipboard && window.isSecureContext){
    navigator.clipboard.writeText(text).then(()=>{
      if(btn){ const old=btn.textContent; btn.textContent='¡Copiado!'; setTimeout(()=>btn.textContent=old,1600); }
      toast('Enlace copiado');
    }).catch(()=>{
      window.prompt('Copia este enlace:', text);
    });
  }else{
    window.prompt('Copia este enlace:', text);
  }
}

async function initSupabase(){
  if(CFG.DEMO_MODE || !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) return;
  supa=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY);
}
function demoDb(){return getDemo()}
async function apiListClients(){
  if(CFG.DEMO_MODE||!supa) return demoDb().clients.slice().sort((a,b)=>a.name.localeCompare(b.name));
  const {data,error}=await supa.rpc('admin_list_clients'); if(error) throw error; return data||[];
}
async function apiMovements(clientId){
  if(CFG.DEMO_MODE||!supa) return demoDb().movements.filter(m=>m.client_id===clientId).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const {data,error}=await supa.rpc('admin_list_movements',{p_client_id:clientId,p_limit:100}); if(error) throw error; return data||[];
}
async function apiCreateClient(payload){
  if(CFG.DEMO_MODE||!supa){const db=demoDb();const c={id:'c'+Date.now(),code:makeCode(db),name:payload.name,phone:payload.phone||'',points:0,total_spent:0,last_purchase:null,expires_at:null,created_at:isoDate(new Date())};db.clients.push(c);saveDemo(db);return c;}
  const {data,error}=await supa.rpc('admin_create_client',{p_name:payload.name,p_phone:payload.phone||null});if(error)throw error;return Array.isArray(data)?data[0]:data;
}
async function apiRegisterPurchase(clientId,gross,redeemMxn,note){
  if(CFG.DEMO_MODE||!supa){
    const db=demoDb();const c=db.clients.find(x=>x.id===clientId);if(!c)throw new Error('Cliente no encontrado');
    const maxByPercent=Number(gross)*CFG.MAX_REDEMPTION_PERCENT/100;const available=mxnFromPoints(c.points);const redeem=Math.max(0,Math.min(Number(redeemMxn||0),maxByPercent,available));const paid=Math.max(0,Number(gross)-redeem);const earned=pointsFromPaid(paid);const used=pointsFromMxn(redeem);c.points=Math.round((Number(c.points)-used+earned)*100)/100;c.total_spent=Math.round((Number(c.total_spent)+paid)*100)/100;c.last_purchase=isoDate(new Date());c.expires_at=addMonths(c.last_purchase,CFG.EXPIRY_MONTHS);
    db.movements.push({id:'m'+Date.now(),client_id:c.id,date:c.last_purchase,type:redeem>0?'redeem':'purchase',gross:Number(gross),redeemed_mxn:redeem,paid,points_delta:Math.round((earned-used)*100)/100,note:note||''});saveDemo(db);return c;
  }
  const {data,error}=await supa.rpc('admin_register_purchase',{p_client_id:clientId,p_gross:Number(gross),p_redeem_mxn:Number(redeemMxn||0),p_note:note||null});if(error)throw error;return Array.isArray(data)?data[0]:data;
}
async function apiAdjust(clientId,delta,note){
  if(CFG.DEMO_MODE||!supa){const db=demoDb();const c=db.clients.find(x=>x.id===clientId);c.points=Math.max(0,Math.round((Number(c.points)+Number(delta))*100)/100);db.movements.push({id:'m'+Date.now(),client_id:c.id,date:isoDate(new Date()),type:'adjustment',gross:0,redeemed_mxn:0,paid:0,points_delta:Number(delta),note:note||'Ajuste manual'});saveDemo(db);return c;}
  const {data,error}=await supa.rpc('admin_adjust_points',{p_client_id:clientId,p_points_delta:Number(delta),p_note:note||null});if(error)throw error;return Array.isArray(data)?data[0]:data;
}
async function login(email,password){const {data,error}=await supa.auth.signInWithPassword({email,password});if(error)throw error;session=data.session;return session}
async function logout(){if(supa)await supa.auth.signOut();location.reload()}
function getSelected(clients){return clients.find(c=>c.id===selectedId)||clients[0]}
function calcStats(clients){return {count:clients.length,points:clients.reduce((s,c)=>s+Number(c.points||0),0),liability:clients.reduce((s,c)=>s+mxnFromPoints(c.points),0),spent:clients.reduce((s,c)=>s+Number(c.total_spent||0),0)}}
function renderStats(clients){const s=calcStats(clients);document.getElementById('statClients').textContent=num(s.count);document.getElementById('statPoints').textContent=num(s.points);document.getElementById('statLiability').textContent=money(s.liability);document.getElementById('statSpent').textContent=money(s.spent)}
function renderList(clients){const q=(document.getElementById('clientSearch').value||'').toLowerCase();const list=clients.filter(c=>(c.name+' '+c.code+' '+(c.phone||'')).toLowerCase().includes(q));document.getElementById('clientList').innerHTML=list.map(c=>`<button class="client-item ${c.id===selectedId?'active':''}" data-id="${c.id}"><strong>${c.name}</strong><span>${c.code} · ${num(c.points)} pts · ${money(mxnFromPoints(c.points))}</span></button>`).join('')||'<div class="muted">Sin resultados.</div>';document.querySelectorAll('.client-item').forEach(b=>b.onclick=()=>{selectedId=b.dataset.id;refresh()})}
function movementRow(m){return `<tr><td>${displayDate(m.date)}</td><td>${m.type==='adjustment'?'Ajuste':Number(m.redeemed_mxn)>0?'Compra + canje':'Compra'}</td><td>${money(m.gross||0)}</td><td>${money(m.redeemed_mxn||0)}</td><td>${money(m.paid||0)}</td><td class="${Number(m.points_delta)>=0?'plus':'minus'}">${Number(m.points_delta)>=0?'+':''}${num(m.points_delta)}</td><td>${m.note||''}</td></tr>`}
async function renderSelected(c){if(!c){document.getElementById('emptyState').classList.remove('hidden');document.getElementById('clientPanel').classList.add('hidden');return}document.getElementById('emptyState').classList.add('hidden');document.getElementById('clientPanel').classList.remove('hidden');document.getElementById('selName').textContent=c.name;document.getElementById('selMeta').textContent=`${c.code}${c.phone?' · '+c.phone:''} · vigencia ${displayDate(c.expires_at)}`;document.getElementById('selPoints').textContent=`${num(c.points)} pts`;document.getElementById('selMoney').textContent=money(mxnFromPoints(c.points));document.getElementById('purchaseClient').textContent=c.name;document.getElementById('availableRedeem').textContent=money(mxnFromPoints(c.points));const publicUrl=cardUrl(c.code);document.getElementById('clientLinkField').value=publicUrl;document.getElementById('openCardLink').href=publicUrl;document.getElementById('whatsappLink').href='https://wa.me/?text='+encodeURIComponent('Tu Tarjeta Nouvelle: '+publicUrl);document.getElementById('copyLinkBtn').onclick=(e)=>copyClientLink(publicUrl,e.currentTarget);document.getElementById('selectLinkBtn').onclick=(e)=>copyClientLink(publicUrl,e.currentTarget);const mv=await apiMovements(c.id);document.getElementById('movementTable').innerHTML=mv.map(movementRow).join('')||'<tr><td colspan="7" class="muted">Sin movimientos.</td></tr>';updatePurchasePreview(c)}
async function refresh(){const clients=await apiListClients();if(!selectedId&&clients.length)selectedId=clients[0].id;renderStats(clients);renderList(clients);await renderSelected(getSelected(clients));window.__clients=clients}
function updatePurchasePreview(c){if(!c)return;const gross=Number(document.getElementById('gross').value||0);const requested=Number(document.getElementById('redeem').value||0);const maxPct=gross*CFG.MAX_REDEMPTION_PERCENT/100;const available=mxnFromPoints(c.points);const redeem=Math.max(0,Math.min(requested,maxPct,available));const paid=Math.max(0,gross-redeem);const earned=pointsFromPaid(paid);document.getElementById('purchasePreview').innerHTML=`Máximo por regla del ${CFG.MAX_REDEMPTION_PERCENT}%: <strong>${money(maxPct)}</strong><br>Canje aplicado: <strong>${money(redeem)}</strong><br>Pago efectivo: <strong>${money(paid)}</strong><br>Puntos a generar: <strong>${num(earned)} pts (${money(mxnFromPoints(earned))})</strong>`}
function openModal(){document.getElementById('newClientModal').classList.remove('hidden')}function closeModal(){document.getElementById('newClientModal').classList.add('hidden')}
async function enterApp(){document.getElementById('loginView').classList.add('hidden');document.getElementById('appView').classList.remove('hidden');document.getElementById('modeBadge').textContent=CFG.DEMO_MODE?'Modo demo local':'Supabase conectado';await refresh()}
window.addEventListener('DOMContentLoaded',async()=>{
  await initSupabase();
  if(CFG.DEMO_MODE||!supa){document.getElementById('demoNote').classList.remove('hidden');document.getElementById('demoBtn').classList.remove('hidden');document.getElementById('loginForm').classList.add('hidden');document.getElementById('demoBtn').onclick=enterApp;} else {const {data}=await supa.auth.getSession();if(data.session){session=data.session;enterApp()} }
  document.getElementById('loginForm').onsubmit=async e=>{e.preventDefault();try{await login(document.getElementById('email').value,document.getElementById('password').value);enterApp()}catch(err){document.getElementById('loginError').textContent=err.message;document.getElementById('loginError').className='status error'}};
  document.getElementById('logoutBtn').onclick=logout;
  document.getElementById('clientSearch').oninput=()=>renderList(window.__clients||[]);
  document.getElementById('newClientBtn').onclick=openModal;document.getElementById('modalCancel').onclick=closeModal;
  document.getElementById('newClientForm').onsubmit=async e=>{e.preventDefault();try{const c=await apiCreateClient({name:document.getElementById('newName').value.trim(),phone:document.getElementById('newPhone').value.trim()});selectedId=c.id;closeModal();e.target.reset();await refresh();toast('Clienta creada')}catch(err){toast(err.message)}};
  ['gross','redeem'].forEach(id=>document.getElementById(id).oninput=()=>updatePurchasePreview((window.__clients||[]).find(c=>c.id===selectedId)));
  document.getElementById('purchaseForm').onsubmit=async e=>{e.preventDefault();const gross=Number(document.getElementById('gross').value||0);if(gross<=0)return toast('Captura un importe válido');try{await apiRegisterPurchase(selectedId,gross,Number(document.getElementById('redeem').value||0),document.getElementById('note').value.trim());e.target.reset();await refresh();toast('Compra registrada correctamente')}catch(err){toast(err.message)}};
  document.getElementById('adjustForm').onsubmit=async e=>{e.preventDefault();const delta=Number(document.getElementById('adjustDelta').value||0);if(!delta)return toast('Captura un ajuste distinto de cero');try{await apiAdjust(selectedId,delta,document.getElementById('adjustNote').value.trim());e.target.reset();await refresh();toast('Ajuste registrado')}catch(err){toast(err.message)}};
  document.getElementById('resetDemo').onclick=()=>{if(confirm('¿Reiniciar los datos de prueba?')){localStorage.removeItem(DEMO_KEY);selectedId=null;refresh();toast('Demo reiniciada')}};
});

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
  if(CFG.DEMO_MODE||!supa){const db=demoDb();const c={id:'c'+Date.now(),code:makeCode(db),public_token:'demo-'+Date.now(),name:payload.name,phone:payload.phone||'',email:payload.email||'',points:0,total_spent:0,last_purchase:null,expires_at:null,created_at:isoDate(new Date())};db.clients.push(c);saveDemo(db);return c;}
  const {data,error}=await supa.rpc('admin_create_client',{p_name:payload.name,p_phone:payload.phone||null,p_email:payload.email||null});if(error)throw error;return Array.isArray(data)?data[0]:data;
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

async function apiSetArchived(clientId, archived){
  if(CFG.DEMO_MODE||!supa){
    const db=demoDb();
    const c=db.clients.find(x=>x.id===clientId);
    if(!c) throw new Error('Clienta no encontrada');
    c.archived=!!archived;
    c.archived_at=archived?new Date().toISOString():null;
    saveDemo(db);
    return c;
  }
  const {data,error}=await supa.rpc('admin_set_client_archived',{
    p_client_id:clientId,
    p_archived:!!archived
  });
  if(error) throw error;
  return Array.isArray(data)?data[0]:data;
}

async function apiDeleteClient(clientId){
  if(CFG.DEMO_MODE||!supa){
    const db=demoDb();
    db.clients=db.clients.filter(c=>c.id!==clientId);
    db.movements=db.movements.filter(m=>m.client_id!==clientId);
    saveDemo(db);
    return true;
  }
  const {data,error}=await supa.rpc('admin_delete_client',{p_client_id:clientId});
  if(error) throw error;
  return data;
}

async function login(email,password){
  const {data,error}=await supa.auth.signInWithPassword({email,password});
  if(error) throw error;
  session=data.session;
  return session;
}

async function logout(){
  if(supa) await supa.auth.signOut();
  location.reload();
}

function archivedVisible(){
  return !!document.getElementById('showArchived')?.checked;
}

function activeClients(clients){
  return clients.filter(c=>!c.archived);
}

function visibleClients(clients){
  return clients.filter(c=>archivedVisible() || !c.archived);
}

function getSelected(clients){
  const visible=visibleClients(clients);
  return visible.find(c=>c.id===selectedId)||visible[0]||null;
}

function calcStats(clients){
  const active=activeClients(clients);
  return {
    count:active.length,
    points:active.reduce((s,c)=>s+Number(c.points||0),0),
    liability:active.reduce((s,c)=>s+mxnFromPoints(c.points),0),
    spent:clients.reduce((s,c)=>s+Number(c.total_spent||0),0)
  };
}

function renderStats(clients){
  const s=calcStats(clients);
  document.getElementById('statClients').textContent=num(s.count);
  document.getElementById('statPoints').textContent=num(s.points);
  document.getElementById('statLiability').textContent=money(s.liability);
  document.getElementById('statSpent').textContent=money(s.spent);
}

function renderList(clients){
  const q=(document.getElementById('clientSearch').value||'').toLowerCase();
  const list=visibleClients(clients).filter(c=>
    (c.name+' '+c.code+' '+(c.phone||'')+' '+(c.email||'')).toLowerCase().includes(q)
  );

  document.getElementById('clientList').innerHTML=
    list.map(c=>`<button class="client-item ${c.id===selectedId?'active':''}" data-id="${c.id}" style="${c.archived?'opacity:.72':''}">
      <strong>${c.name}${c.archived?' · Archivada':''}</strong>
      <span>${c.code} · ${num(c.points)} pts · ${money(mxnFromPoints(c.points))}</span>
    </button>`).join('') || '<div class="muted">Sin resultados.</div>';

  document.querySelectorAll('.client-item').forEach(b=>{
    b.onclick=()=>{
      selectedId=b.dataset.id;
      refresh();
    };
  });
}

function movementRow(m){
  const date=m.movement_date||m.date;
  const type=
    m.type==='expiration'?'Vencimiento':
    m.type==='adjustment'?'Ajuste':
    Number(m.redeemed_mxn)>0?'Compra + canje':'Compra';

  return `<tr>
    <td>${displayDate(date)}</td>
    <td>${type}</td>
    <td>${money(m.gross||0)}</td>
    <td>${money(m.redeemed_mxn||0)}</td>
    <td>${money(m.paid||0)}</td>
    <td class="${Number(m.points_delta)>=0?'plus':'minus'}">${Number(m.points_delta)>=0?'+':''}${num(m.points_delta)}</td>
    <td>${m.note||''}</td>
  </tr>`;
}

function setArchivedState(c){
  const archived=!!c.archived;
  const archiveBtn=document.getElementById('archiveClientBtn');
  const deleteBtn=document.getElementById('deleteClientBtn');

  archiveBtn.textContent=archived?'Restaurar clienta':'Archivar clienta';
  archiveBtn.onclick=()=>handleArchiveToggle(c);

  deleteBtn.onclick=()=>handleDeleteClient(c);

  // Bloquear operaciones de puntos/compras mientras esté archivada.
  ['purchaseForm','adjustForm'].forEach(formId=>{
    const form=document.getElementById(formId);
    form.querySelectorAll('input,button').forEach(el=>el.disabled=archived);
    form.style.opacity=archived?'.55':'1';
  });

  // El enlace público queda inhabilitado mientras esté archivada.
  ['openCardLink','whatsappLink'].forEach(id=>{
    const el=document.getElementById(id);
    el.style.pointerEvents=archived?'none':'auto';
    el.style.opacity=archived?'.45':'1';
  });
  document.getElementById('copyLinkBtn').disabled=archived;
  document.getElementById('selectLinkBtn').disabled=archived;
}

async function handleArchiveToggle(c){
  const next=!c.archived;
  const action=next?'archivar':'restaurar';

  if(!confirm(`¿Quieres ${action} a ${c.name}?`)) return;

  try{
    await apiSetArchived(c.id,next);
    if(next && !archivedVisible()) selectedId=null;
    await refresh();
    toast(next?'Clienta archivada':'Clienta restaurada');
  }catch(err){
    toast(err.message);
  }
}

async function handleDeleteClient(c){
  const ok=confirm(
    `¿Eliminar DEFINITIVAMENTE a ${c.name}?\n\n`+
    `Se borrarán también sus compras y movimientos. Esta acción no se puede deshacer.`
  );
  if(!ok) return;

  const typed=prompt(
    `Segunda confirmación:\nEscribe ELIMINAR para borrar definitivamente a ${c.name}.`
  );
  if(typed!=='ELIMINAR'){
    toast('Eliminación cancelada');
    return;
  }

  try{
    await apiDeleteClient(c.id);
    selectedId=null;
    await refresh();
    toast('Clienta eliminada definitivamente');
  }catch(err){
    toast(err.message);
  }
}

async function renderSelected(c){
  if(!c){
    document.getElementById('emptyState').classList.remove('hidden');
    document.getElementById('clientPanel').classList.add('hidden');
    return;
  }

  document.getElementById('emptyState').classList.add('hidden');
  document.getElementById('clientPanel').classList.remove('hidden');
  document.getElementById('selName').textContent=c.name;

  const meta=[c.code];
  if(c.phone) meta.push(c.phone);
  if(c.email) meta.push(c.email);
  if(c.archived) meta.push('ARCHIVADA');
  meta.push(`vigencia ${displayDate(c.expires_at)}`);
  document.getElementById('selMeta').textContent=meta.join(' · ');

  document.getElementById('selPoints').textContent=`${num(c.points)} pts`;
  document.getElementById('selMoney').textContent=money(mxnFromPoints(c.points));
  document.getElementById('availableRedeem').textContent=money(mxnFromPoints(c.points));

  const publicIdentifier=CFG.DEMO_MODE?c.code:c.public_token;
  const publicUrl=cardUrl(publicIdentifier);
  document.getElementById('clientLinkField').value=publicUrl;
  document.getElementById('openCardLink').href=publicUrl;
  document.getElementById('whatsappLink').href=
    'https://wa.me/?text='+encodeURIComponent('Tu Tarjeta Nouvelle: '+publicUrl);
  document.getElementById('copyLinkBtn').onclick=(e)=>copyClientLink(publicUrl,e.currentTarget);
  document.getElementById('selectLinkBtn').onclick=(e)=>copyClientLink(publicUrl,e.currentTarget);

  setArchivedState(c);

  const mv=await apiMovements(c.id);
  document.getElementById('movementTable').innerHTML=
    mv.map(movementRow).join('')||
    '<tr><td colspan="7" class="muted">Sin movimientos.</td></tr>';

  updatePurchasePreview(c);
}

async function refresh(){
  const clients=await apiListClients();
  const visible=visibleClients(clients);

  if(selectedId && !visible.some(c=>c.id===selectedId)) selectedId=null;
  if(!selectedId && visible.length) selectedId=visible[0].id;

  renderStats(clients);
  renderList(clients);
  await renderSelected(getSelected(clients));
  window.__clients=clients;
}

function updatePurchasePreview(c){
  if(!c) return;
  if(c.archived){
    document.getElementById('purchasePreview').innerHTML=
      '<strong>Clienta archivada.</strong> Restáurala para registrar nuevas operaciones.';
    return;
  }

  const gross=Number(document.getElementById('gross').value||0);
  const requested=Number(document.getElementById('redeem').value||0);
  const maxPct=gross*CFG.MAX_REDEMPTION_PERCENT/100;
  const available=mxnFromPoints(c.points);
  const redeem=Math.max(0,Math.min(requested,maxPct,available));
  const paid=Math.max(0,gross-redeem);
  const earned=pointsFromPaid(paid);

  document.getElementById('purchasePreview').innerHTML=
    `Máximo por regla del ${CFG.MAX_REDEMPTION_PERCENT}%: <strong>${money(maxPct)}</strong><br>`+
    `Canje aplicado: <strong>${money(redeem)}</strong><br>`+
    `Pago efectivo: <strong>${money(paid)}</strong><br>`+
    `Puntos a generar: <strong>${num(earned)} pts (${money(mxnFromPoints(earned))})</strong>`;
}

function openModal(){
  document.getElementById('newClientModal').classList.remove('hidden');
}

function closeModal(){
  document.getElementById('newClientModal').classList.add('hidden');
}

async function enterApp(){
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('appView').classList.remove('hidden');
  document.getElementById('modeBadge').textContent=
    CFG.DEMO_MODE?'Modo demo local':'Supabase conectado';

  // No mostrar controles de demo cuando Supabase está conectado.
  document.getElementById('resetDemo').classList.toggle('hidden',!CFG.DEMO_MODE);

  await refresh();
}

window.addEventListener('DOMContentLoaded',async()=>{
  await initSupabase();

  if(CFG.DEMO_MODE||!supa){
    document.getElementById('demoNote').classList.remove('hidden');
    document.getElementById('demoBtn').classList.remove('hidden');
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('demoBtn').onclick=enterApp;
  }else{
    const {data}=await supa.auth.getSession();
    if(data.session){
      session=data.session;
      enterApp();
    }
  }

  document.getElementById('loginForm').onsubmit=async e=>{
    e.preventDefault();
    try{
      await login(
        document.getElementById('email').value,
        document.getElementById('password').value
      );
      enterApp();
    }catch(err){
      document.getElementById('loginError').textContent=err.message;
      document.getElementById('loginError').className='status error';
    }
  };

  document.getElementById('logoutBtn').onclick=logout;
  document.getElementById('clientSearch').oninput=()=>renderList(window.__clients||[]);
  document.getElementById('showArchived').onchange=()=>{
    selectedId=null;
    refresh();
  };

  document.getElementById('newClientBtn').onclick=openModal;
  document.getElementById('modalCancel').onclick=closeModal;

  document.getElementById('newClientForm').onsubmit=async e=>{
    e.preventDefault();
    try{
      const c=await apiCreateClient({
        name:document.getElementById('newName').value.trim(),
        phone:document.getElementById('newPhone').value.trim(),
        email:document.getElementById('newEmail').value.trim()
      });
      selectedId=c.id;
      closeModal();
      e.target.reset();
      await refresh();
      toast('Clienta creada');
    }catch(err){
      toast(err.message);
    }
  };

  ['gross','redeem'].forEach(id=>{
    document.getElementById(id).oninput=()=>
      updatePurchasePreview((window.__clients||[]).find(c=>c.id===selectedId));
  });

  document.getElementById('purchaseForm').onsubmit=async e=>{
    e.preventDefault();
    const c=(window.__clients||[]).find(x=>x.id===selectedId);
    if(c?.archived) return toast('La clienta está archivada');

    const gross=Number(document.getElementById('gross').value||0);
    if(gross<=0) return toast('Captura un importe válido');

    try{
      await apiRegisterPurchase(
        selectedId,
        gross,
        Number(document.getElementById('redeem').value||0),
        document.getElementById('note').value.trim()
      );
      e.target.reset();
      await refresh();
      toast('Compra registrada correctamente');
    }catch(err){
      toast(err.message);
    }
  };

  document.getElementById('adjustForm').onsubmit=async e=>{
    e.preventDefault();
    const c=(window.__clients||[]).find(x=>x.id===selectedId);
    if(c?.archived) return toast('La clienta está archivada');

    const delta=Number(document.getElementById('adjustDelta').value||0);
    if(!delta) return toast('Captura un ajuste distinto de cero');

    try{
      await apiAdjust(
        selectedId,
        delta,
        document.getElementById('adjustNote').value.trim()
      );
      e.target.reset();
      await refresh();
      toast('Ajuste registrado');
    }catch(err){
      toast(err.message);
    }
  };

  document.getElementById('resetDemo').onclick=()=>{
    if(confirm('¿Reiniciar los datos de prueba?')){
      localStorage.removeItem(DEMO_KEY);
      selectedId=null;
      refresh();
      toast('Demo reiniciada');
    }
  };
});

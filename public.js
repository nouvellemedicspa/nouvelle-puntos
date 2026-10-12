let supa=null;

async function initSupabase(){
  if(CFG.DEMO_MODE || !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) return;
  supa=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY);
}

async function fetchCard(identifier){
  if(CFG.DEMO_MODE || !supa){
    const db=getDemo();
    const client=db.clients.find(c=>c.code.toLowerCase()===String(identifier).toLowerCase());
    if(!client) return null;
    const movements=db.movements
      .filter(m=>m.client_id===client.id)
      .sort((a,b)=>String(b.date).localeCompare(String(a.date)))
      .slice(0,8);
    return {client,movements};
  }

  const {data,error}=await supa.rpc('public_get_card',{p_token:String(identifier)});
  if(error) throw error;
  const client=Array.isArray(data)?data[0]:data;
  if(!client) return null;

  const mv=await supa.rpc('public_get_movements',{p_token:String(identifier),p_limit:8});
  if(mv.error) throw mv.error;
  return {client,movements:mv.data||[]};
}

function movementLabel(m){
  if(m.type==='expiration') return 'Vencimiento de puntos';
  if(m.type==='redeem') return 'Canje de puntos';
  if(m.type==='adjustment') return 'Ajuste';
  if(Number(m.redeemed_mxn)>0) return 'Compra con canje';
  return 'Compra';
}

function renderMovement(m){
  const plus=Number(m.points_delta)>=0;
  return `<div class="movement"><div class="movement-icon">${plus?'+':'−'}</div><div><div class="movement-title">${movementLabel(m)}</div><div class="movement-meta">${displayDate(m.date)} · ${m.paid!=null?money(m.paid)+' pagados':''}</div></div><div class="movement-points ${plus?'plus':'minus'}">${plus?'+':''}${num(m.points_delta)} pts</div></div>`;
}

function publicUrlFor(identifier){
  return cardUrl(identifier);
}

function renderCard(client,movements,identifier){
  document.getElementById('searchView').classList.add('hidden');
  document.getElementById('cardView').classList.remove('hidden');
  document.getElementById('clientName').textContent=client.name;
  document.getElementById('clientCode').textContent=`Folio: ${client.code}`;
  document.getElementById('points').textContent=num(client.points);
  document.getElementById('pointsMoney').textContent=`Equivalen a ${money(mxnFromPoints(client.points))}`;
  document.getElementById('lastPurchase').textContent=displayDate(client.last_purchase);
  document.getElementById('expiresAt').textContent=displayDate(client.expires_at);

  const q=document.getElementById('qrcode');
  q.innerHTML='';
  new QRCode(q,{
    text:publicUrlFor(identifier),
    width:180,
    height:180,
    colorDark:'#191817',
    colorLight:'#ffffff',
    correctLevel:QRCode.CorrectLevel.M
  });

  document.getElementById('movements').innerHTML=
    movements.length?movements.map(renderMovement).join(''):
    '<div class="muted">Todavía no hay movimientos para mostrar.</div>';
}

async function loadIdentifier(identifier){
  const status=document.getElementById('status');
  status.classList.add('hidden');

  if(!identifier){
    status.textContent=CFG.DEMO_MODE
      ? 'Ingresa un folio.'
      : 'Abre el enlace privado que Nouvelle te compartió.';
    status.className='status error';
    return;
  }

  try{
    const data=await fetchCard(identifier.trim());
    if(!data){
      status.textContent=CFG.DEMO_MODE
        ? 'No encontramos una tarjeta con ese folio.'
        : 'No encontramos una tarjeta válida con este enlace.';
      status.className='status error';
      return;
    }
    renderCard(data.client,data.movements,identifier.trim());
    const key=CFG.DEMO_MODE?'codigo':'token';
    history.replaceState(null,'',`?${key}=${encodeURIComponent(identifier.trim())}`);
  }catch(e){
    console.error(e);
    status.textContent='No se pudo consultar la tarjeta. Inténtalo nuevamente.';
    status.className='status error';
  }
}

function showTerms(){
  document.getElementById('terms').classList.toggle('hidden');
}

window.addEventListener('DOMContentLoaded',async()=>{
  await initSupabase();

  const demoNote=document.getElementById('demoSearchNote');
  const searchHelp=document.getElementById('searchHelp');
  const searchBtn=document.getElementById('searchBtn');
  const codeInput=document.getElementById('codeInput');

  if(CFG.DEMO_MODE){
    if(searchHelp) searchHelp.textContent='Ingresa tu folio Nouvelle para ver tus puntos, beneficio disponible y movimientos.';
  }else{
    if(demoNote) demoNote.classList.add('hidden');
    if(searchHelp) searchHelp.textContent='Abre el enlace privado que Nouvelle te compartió para consultar tus puntos y movimientos.';
    if(codeInput) codeInput.placeholder='Enlace privado o token';
  }

  searchBtn.addEventListener('click',()=>loadIdentifier(codeInput.value));
  codeInput.addEventListener('keydown',e=>{if(e.key==='Enter')loadIdentifier(e.target.value)});
  document.getElementById('termsBtn').addEventListener('click',showTerms);
  document.getElementById('backBtn').addEventListener('click',()=>{
    document.getElementById('cardView').classList.add('hidden');
    document.getElementById('searchView').classList.remove('hidden');
    history.replaceState(null,'',location.pathname);
  });

  const params=new URLSearchParams(location.search);
  const identifier=CFG.DEMO_MODE ? params.get('codigo') : params.get('token');
  if(identifier) loadIdentifier(identifier);
});

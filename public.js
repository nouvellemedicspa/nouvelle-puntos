// Nouvelle Puntos · public.js v15
// Consulta pública por folio + compatibilidad con enlaces privados por token.

const CFG = window.NOUVELLE_CONFIG || {};
let supa = null;

const fmtMoney = (n) =>
  (typeof money === 'function')
    ? money(n)
    : new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:2}).format(Number(n||0));

const fmtNum = (n) =>
  (typeof num === 'function')
    ? num(n)
    : new Intl.NumberFormat('es-MX',{maximumFractionDigits:2}).format(Number(n||0));

const fmtDate = (d) =>
  (typeof displayDate === 'function')
    ? displayDate(d)
    : (d ? new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(d+'T12:00:00')) : '—');

const pointsToMxn = (pts) =>
  (typeof mxnFromPoints === 'function')
    ? mxnFromPoints(pts)
    : Math.round(Number(pts||0) * Number(CFG.POINT_VALUE_MXN || 5) * 100) / 100;

function getSupabaseKey(){
  return CFG.SUPABASE_PUBLISHABLE_KEY || CFG.SUPABASE_ANON_KEY || CFG.SUPABASE_KEY || '';
}

async function initSupabase(){
  if (CFG.DEMO_MODE) return;
  const key = getSupabaseKey();
  if (!CFG.SUPABASE_URL || !key) throw new Error('Falta configuración de Supabase.');
  supa = window.supabase.createClient(CFG.SUPABASE_URL, key);
}

function normalizeCode(raw){
  let v = String(raw || '').trim().toUpperCase().replace(/\s+/g,'');
  if (!v) return '';
  if (/^\d+$/.test(v)) v = 'N-' + v.padStart(4,'0');
  if (/^N\d+$/.test(v)) v = 'N-' + v.slice(1).padStart(4,'0');
  if (/^N-\d+$/.test(v)) {
    const n = v.split('-')[1];
    v = 'N-' + n.padStart(4,'0');
  }
  return v;
}

function basePublicUrl(){
  if (CFG.PUBLIC_BASE_URL) return CFG.PUBLIC_BASE_URL.replace(/\/$/,'') + '/';
  return location.origin + location.pathname.replace(/index\.html$/,'').replace(/\/?$/,'/');
}

function publicUrlForCode(code){
  return `${basePublicUrl()}?codigo=${encodeURIComponent(code)}`;
}

function publicUrlForToken(token){
  return `${basePublicUrl()}?token=${encodeURIComponent(token)}`;
}

async function fetchByCode(rawCode){
  const code = normalizeCode(rawCode);
  if (!code) return null;

  if (CFG.DEMO_MODE || !supa){
    if (typeof getDemo !== 'function') return null;
    const db = getDemo();
    const client = db.clients.find(c => String(c.code).toUpperCase() === code);
    if (!client) return null;
    const movements = db.movements
      .filter(m => m.client_id === client.id)
      .sort((a,b) => String(b.date).localeCompare(String(a.date)))
      .slice(0,8);
    return { client, movements, mode:'code', lookup:code };
  }

  const card = await supa.rpc('public_get_card_by_code',{p_code:code});
  if (card.error) throw card.error;
  const client = Array.isArray(card.data) ? card.data[0] : card.data;
  if (!client) return null;

  const mv = await supa.rpc('public_get_movements_by_code',{p_code:code,p_limit:8});
  if (mv.error) throw mv.error;

  return {
    client:{...client,code:client.code || code},
    movements:mv.data || [],
    mode:'code',
    lookup:code
  };
}

async function fetchByToken(rawToken){
  const token = String(rawToken || '').trim();
  if (!token || CFG.DEMO_MODE || !supa) return null;

  const card = await supa.rpc('public_get_card',{p_token:token});
  if (card.error) throw card.error;
  const client = Array.isArray(card.data) ? card.data[0] : card.data;
  if (!client) return null;

  const mv = await supa.rpc('public_get_movements',{p_token:token,p_limit:8});
  if (mv.error) throw mv.error;

  return {client,movements:mv.data || [],mode:'token',lookup:token};
}

function movementLabel(m){
  if (m.type === 'redeem') return 'Canje de puntos';
  if (m.type === 'adjustment') return 'Ajuste';
  if (m.type === 'expiration') return 'Vencimiento';
  if (Number(m.redeemed_mxn) > 0) return 'Compra con canje';
  return 'Compra';
}

function renderMovement(m){
  const delta = Number(m.points_delta || 0);
  const plus = delta >= 0;
  const paidText = m.paid != null && Number(m.paid) > 0 ? `${fmtMoney(m.paid)} pagados` : '';
  const meta = [fmtDate(m.date || m.movement_date), paidText].filter(Boolean).join(' · ');
  return `<div class="movement">
    <div class="movement-icon">${plus?'+':'−'}</div>
    <div>
      <div class="movement-title">${movementLabel(m)}</div>
      <div class="movement-meta">${meta}</div>
    </div>
    <div class="movement-points ${plus?'plus':'minus'}">${plus?'+':''}${fmtNum(delta)} pts</div>
  </div>`;
}

function renderCard(client,movements,mode,lookup){
  const searchView = document.getElementById('searchView');
  const cardView = document.getElementById('cardView');
  if (searchView) searchView.classList.add('hidden');
  if (cardView) cardView.classList.remove('hidden');

  const name = document.getElementById('clientName');
  const code = document.getElementById('clientCode');
  const points = document.getElementById('points');
  const pointsMoney = document.getElementById('pointsMoney');
  const lastPurchase = document.getElementById('lastPurchase');
  const expiresAt = document.getElementById('expiresAt');

  if (name) name.textContent = client.name || 'Clienta Nouvelle';
  if (code) code.textContent = `Folio: ${client.code || '—'}`;
  if (points) points.textContent = fmtNum(client.points);
  if (pointsMoney) pointsMoney.textContent = `Equivalen a ${fmtMoney(pointsToMxn(client.points))}`;
  if (lastPurchase) lastPurchase.textContent = fmtDate(client.last_purchase);
  if (expiresAt) expiresAt.textContent = fmtDate(client.expires_at);

  const q = document.getElementById('qrcode');
  if (q && typeof QRCode !== 'undefined'){
    q.innerHTML = '';
    const qrText = mode === 'token' ? publicUrlForToken(lookup) : publicUrlForCode(client.code);
    new QRCode(q,{
      text:qrText,width:180,height:180,
      colorDark:'#191817',colorLight:'#ffffff',
      correctLevel:QRCode.CorrectLevel.M
    });
  }

  const movementsBox = document.getElementById('movements');
  if (movementsBox){
    movementsBox.innerHTML = movements.length
      ? movements.map(renderMovement).join('')
      : '<div class="muted">Todavía no hay movimientos para mostrar.</div>';
  }
}

function setStatus(message,kind='error'){
  const status = document.getElementById('status');
  if (!status) return;
  status.textContent = message;
  status.className = `status ${kind}`;
}

function clearStatus(){
  const status = document.getElementById('status');
  if (!status) return;
  status.textContent = '';
  status.classList.add('hidden');
}

async function loadCode(rawCode){
  clearStatus();
  const code = normalizeCode(rawCode);
  if (!code){
    setStatus('Escribe tu folio Nouvelle. Ejemplo: N-0250.');
    return;
  }
  try{
    const data = await fetchByCode(code);
    if (!data){
      setStatus('No encontramos una tarjeta activa con ese folio.');
      return;
    }
    renderCard(data.client,data.movements,data.mode,data.lookup);
    history.replaceState(null,'',`?codigo=${encodeURIComponent(data.client.code)}`);
  }catch(e){
    console.error(e);
    setStatus('No se pudo consultar la tarjeta. Inténtalo nuevamente.');
  }
}

async function loadToken(rawToken){
  clearStatus();
  try{
    const data = await fetchByToken(rawToken);
    if (!data){
      setStatus('No encontramos una tarjeta válida con este enlace.');
      return;
    }
    renderCard(data.client,data.movements,data.mode,data.lookup);
  }catch(e){
    console.error(e);
    setStatus('No se pudo consultar la tarjeta. Inténtalo nuevamente.');
  }
}

function showTerms(){
  const terms = document.getElementById('terms');
  if (terms) terms.classList.toggle('hidden');
}

window.addEventListener('DOMContentLoaded',async()=>{
  try{
    await initSupabase();
  }catch(e){
    console.error(e);
    setStatus('No se pudo conectar con el sistema de puntos.');
    return;
  }

  const input = document.getElementById('codeInput');
  const btn = document.getElementById('searchBtn');

  if (btn) btn.addEventListener('click',()=>loadCode(input ? input.value : ''));
  if (input) input.addEventListener('keydown',e=>{
    if (e.key === 'Enter'){
      e.preventDefault();
      loadCode(e.target.value);
    }
  });

  const termsBtn = document.getElementById('termsBtn');
  if (termsBtn) termsBtn.addEventListener('click',showTerms);

  const backBtn = document.getElementById('backBtn');
  if (backBtn) backBtn.addEventListener('click',()=>{
    const cardView = document.getElementById('cardView');
    const searchView = document.getElementById('searchView');
    if (cardView) cardView.classList.add('hidden');
    if (searchView) searchView.classList.remove('hidden');
    if (input) input.value = '';
    history.replaceState(null,'',location.pathname);
  });

  const params = new URLSearchParams(location.search);
  const token = params.get('token') || params.get('t');
  const code = params.get('codigo') || params.get('code');

  if (token){
    await loadToken(token);
  }else if (code){
    if (input) input.value = normalizeCode(code);
    await loadCode(code);
  }
});

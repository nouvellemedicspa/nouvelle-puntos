const CFG = window.NOUVELLE_CONFIG;
const DEMO_KEY = 'nouvelle_points_demo_v1';

const money = n => new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:2}).format(Number(n||0));
const num = n => new Intl.NumberFormat('es-MX',{maximumFractionDigits:2}).format(Number(n||0));
const isoDate = d => new Date(d).toISOString().slice(0,10);
const displayDate = d => d ? new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(d+'T12:00:00')) : '—';
const addMonths = (dateStr, months) => { const d=new Date((dateStr||isoDate(new Date()))+'T12:00:00'); d.setMonth(d.getMonth()+months); return isoDate(d); };
const pointsFromPaid = paid => Math.round((Number(paid||0)/100)*CFG.POINTS_PER_100*100)/100;
const mxnFromPoints = pts => Math.round(Number(pts||0)*CFG.POINT_VALUE_MXN*100)/100;
const pointsFromMxn = mxn => Math.round((Number(mxn||0)/CFG.POINT_VALUE_MXN)*100)/100;

function seedDemo(){
  const existing=localStorage.getItem(DEMO_KEY); if(existing) return JSON.parse(existing);
  const today=isoDate(new Date());
  const db={
    clients:[
      {id:'c1',code:'N-0247',name:'Mariana López',phone:'55 1234 5678',points:56,total_spent:11200,last_purchase:today,expires_at:addMonths(today,12),created_at:today},
      {id:'c2',code:'N-0248',name:'Fernanda Ruiz',phone:'55 9876 1122',points:18.5,total_spent:3700,last_purchase:today,expires_at:addMonths(today,12),created_at:today},
      {id:'c3',code:'N-0249',name:'Andrea Gómez',phone:'55 4567 8890',points:7,total_spent:1400,last_purchase:today,expires_at:addMonths(today,12),created_at:today}
    ],
    movements:[
      {id:'m1',client_id:'c1',date:today,type:'purchase',gross:3500,redeemed_mxn:0,paid:3500,points_delta:35,note:'Tratamiento'},
      {id:'m2',client_id:'c1',date:today,type:'redeem',gross:600,redeemed_mxn:100,paid:500,points_delta:-20,note:'Canje + compra'},
      {id:'m3',client_id:'c1',date:today,type:'purchase',gross:2100,redeemed_mxn:0,paid:2100,points_delta:21,note:'Servicios'}
    ]
  };
  localStorage.setItem(DEMO_KEY,JSON.stringify(db)); return db;
}
function getDemo(){return seedDemo()}
function saveDemo(db){localStorage.setItem(DEMO_KEY,JSON.stringify(db))}
function makeCode(db){
  const nums=db.clients.map(c=>Number(String(c.code).replace(/\D/g,''))).filter(Boolean);
  const next=Math.max(250,...nums)+1; return `N-${String(next).padStart(4,'0')}`;
}
function baseUrl(){
  if(CFG.PUBLIC_BASE_URL) return CFG.PUBLIC_BASE_URL.replace(/\/$/,'')+'/';
  return location.href.split('?')[0].replace(/admin\.html$/,'').replace(/index\.html$/,'');
}
function cardUrl(code){return `${baseUrl()}?codigo=${encodeURIComponent(code)}`}
function toast(msg){const t=document.getElementById('toast');if(!t)return; t.textContent=msg;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),2500)}

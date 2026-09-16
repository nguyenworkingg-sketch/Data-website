const STORAGE_KEY='investment_data_hub_v3';
const SOURCE_KEY='investment_data_sources_v1';

const seedState={
  companies:[
    {id:'pow',ticker:'POW',name:'PV Power',sector:'Điện'},
    {id:'fpt',ticker:'FPT',name:'FPT Corporation',sector:'Công nghệ thông tin'}
  ],
  metrics:[
    {id:'pow_generation',companyId:'pow',name:'Sản lượng điện',unit:'triệu kWh',group:'Vận hành',order:1,chart:'stacked-bar'},
    {id:'pow_qc',companyId:'pow',name:'Qc',unit:'triệu kWh',group:'Vận hành',order:2,chart:'stacked-bar'},
    {id:'pow_revenue',companyId:'pow',name:'Doanh thu theo nhà máy',unit:'tỷ đồng',group:'Tài chính',order:3,chart:'stacked-bar'},
    {id:'fpt_revenue',companyId:'fpt',name:'Doanh thu',unit:'tỷ đồng',group:'Tài chính',order:1,chart:'line'},
    {id:'fpt_pat',companyId:'fpt',name:'Lợi nhuận sau thuế',unit:'tỷ đồng',group:'Tài chính',order:2,chart:'line'}
  ],
  observations:[]
};

let state=loadState();
let sources=loadSources();
let activeCompanyId=state.companies[0]?.id||null;
let activeRange='all';
let dashboardChart=null;
let companyCharts=[];

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

function clone(v){return JSON.parse(JSON.stringify(v))}
function loadState(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw)return clone(seedState);
    const parsed=JSON.parse(raw);
    if(!Array.isArray(parsed.companies)||!Array.isArray(parsed.metrics)||!Array.isArray(parsed.observations))throw new Error('bad');
    return parsed;
  }catch{return clone(seedState)}
}
function loadSources(){try{return JSON.parse(localStorage.getItem(SOURCE_KEY)||'{}')}catch{return {}}}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function saveSources(){localStorage.setItem(SOURCE_KEY,JSON.stringify(sources))}
function slugify(t){return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')}
function fmtNumber(n){return n==null?'—':Number(n).toLocaleString('vi-VN',{maximumFractionDigits:2})}
function monthLabel(p){if(!p)return'—';const[y,m]=p.split('-');return `T${Number(m)}/${y}`}
function companyMetrics(id){return state.metrics.filter(m=>m.companyId===id).sort((a,b)=>(a.order||0)-(b.order||0))}
function metricRows(metricId){return state.observations.filter(o=>o.metricId===metricId).sort((a,b)=>a.period.localeCompare(b.period))}
function metricSeries(metricId){return [...new Set(metricRows(metricId).map(o=>o.series||'Tổng'))]}
function latestPeriodForCompany(id){const ids=new Set(companyMetrics(id).map(m=>m.id));return state.observations.filter(o=>ids.has(o.metricId)).map(o=>o.period).sort().at(-1)||null}

function ensureSeedEntities(){
  for(const c of seedState.companies)if(!state.companies.some(x=>x.id===c.id||x.ticker===c.ticker))state.companies.push(clone(c));
  for(const m of seedState.metrics)if(!state.metrics.some(x=>x.id===m.id))state.metrics.push(clone(m));
  saveState();
}
ensureSeedEntities();

function refreshSelectors(){
  const opts=state.companies.map(c=>`<option value="${c.id}">${c.ticker} — ${c.name}</option>`).join('');
  ['company-select','hub-company','input-company-select','metric-company-select'].forEach(id=>{
    const el=$('#'+id); if(!el)return; const old=el.value;
    el.innerHTML=opts;
    el.value=state.companies.some(c=>c.id===old)?old:(activeCompanyId||state.companies[0]?.id||'');
  });
}

function setView(name){
  $$('.view').forEach(v=>v.classList.remove('active-view'));
  $('#view-'+name)?.classList.add('active-view');
  $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  const titles={dashboard:'Tổng quan dữ liệu',company:'Dữ liệu doanh nghiệp',hub:'Google Sheets Input Hub',manual:'Nhập dữ liệu thủ công',settings:'Cấu hình hệ thống'};
  $('#page-title').textContent=titles[name]||'Data Hub';
  if(name==='dashboard')renderDashboard();
  if(name==='company')renderCompany();
  if(name==='hub')renderHub();
  if(name==='manual')renderManual();
  if(name==='settings')renderSettings();
}

function renderDashboard(){
  refreshSelectors();
  const latest=state.companies.map(c=>latestPeriodForCompany(c.id)).filter(Boolean).sort().at(-1);
  $('#summary-stats').innerHTML=[
    ['Doanh nghiệp',state.companies.length],['Chỉ tiêu',state.metrics.length],
    ['Series',new Set(state.observations.map(o=>`${o.metricId}|${o.series||'Tổng'}`)).size],['Kỳ mới nhất',latest?monthLabel(latest):'Chưa có']
  ].map(([a,b])=>`<div class="stat-card"><span>${a}</span><strong>${b}</strong></div>`).join('');

  $('#company-status-body').innerHTML=state.companies.map(c=>{
    const ms=companyMetrics(c.id), ids=new Set(ms.map(m=>m.id)), obs=state.observations.filter(o=>ids.has(o.metricId));
    const series=new Set(obs.map(o=>`${o.metricId}|${o.series||'Tổng'}`)).size, lp=latestPeriodForCompany(c.id);
    return `<tr><td><strong>${c.ticker}</strong></td><td>${c.name}</td><td>${c.sector||'—'}</td><td>${ms.length}</td><td>${series}</td><td>${lp?monthLabel(lp):'Chưa có'}</td><td>${obs.length}</td></tr>`;
  }).join('');

  const ms=companyMetrics(activeCompanyId);
  $('#dashboard-metric-select').innerHTML=ms.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');
  renderQuickChart();
}

function chartPayload(metric,range='all'){
  const rows=metricRows(metric.id), periodsAll=[...new Set(rows.map(r=>r.period))].sort();
  const periods=range==='all'?periodsAll:periodsAll.slice(-Number(range));
  const series=metricSeries(metric.id);
  const datasets=series.map(s=>({label:s,data:periods.map(p=>rows.find(r=>r.period===p&&(r.series||'Tổng')===s)?.value??null),borderWidth:2,tension:.25,pointRadius:2.5}));
  return{periods,series,datasets};
}
function resolveChartType(metric,seriesCount){
  if(metric.chart==='stacked-bar')return'bar';
  if(metric.chart==='multi-line')return'line';
  if(metric.chart==='line')return'line';
  return seriesCount>1?'bar':'line';
}
function buildChart(canvas,metric,range='all'){
  const d=chartPayload(metric,range), type=resolveChartType(metric,d.series.length), stacked=type==='bar'&&d.series.length>1;
  return new Chart(canvas,{type,data:{labels:d.periods.map(monthLabel),datasets:d.datasets},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:d.series.length>1,position:'bottom'},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${fmtNumber(c.raw)} ${metric.unit||''}`}}},scales:{x:{stacked,grid:{display:false}},y:{stacked,beginAtZero:stacked}}}});
}
function renderQuickChart(){
  const metric=state.metrics.find(m=>m.id===$('#dashboard-metric-select').value)||companyMetrics(activeCompanyId)[0];
  if(dashboardChart)dashboardChart.destroy();
  if(metric)dashboardChart=buildChart($('#dashboard-chart'),metric);
}
function renderCompany(){
  const c=state.companies.find(x=>x.id===activeCompanyId); if(!c)return;
  $('#company-title').textContent=`${c.ticker} — ${c.name}`;
  const lp=latestPeriodForCompany(c.id);
  $('#company-subtitle').textContent=`${c.sector||'Chưa phân ngành'} · ${companyMetrics(c.id).length} chỉ tiêu · Kỳ mới nhất: ${lp?monthLabel(lp):'chưa có'}`;
  companyCharts.forEach(x=>x.destroy()); companyCharts=[];
  const g=$('#charts-grid'); g.innerHTML='';
  companyMetrics(c.id).forEach(m=>{
    const series=metricSeries(m.id), card=document.createElement('div'); card.className='chart-card';
    card.innerHTML=`<div class="chart-title"><div><h3>${m.name}</h3><span>${m.group||'Chỉ tiêu'} · ${m.unit||'Không đơn vị'} · ${series.length||0} series</span></div></div><div class="chart-box"><canvas></canvas></div>`;
    g.appendChild(card); companyCharts.push(buildChart(card.querySelector('canvas'),m,activeRange));
  });
}

function renderHub(){
  refreshSelectors();
  const cid=$('#hub-company').value||activeCompanyId;
  $('#hub-company').value=cid;
  $('#sheet-csv-url').value=sources[cid]?.csvUrl||'';
}
function normalizeHeader(s){return slugify(String(s||''))}
function parsePeriod(v){
  if(v==null||v==='')return null; const s=String(v).trim();
  let m=s.match(/^(\d{4})[-\/.](\d{1,2})/); if(m)return `${m[1]}-${String(Number(m[2])).padStart(2,'0')}`;
  m=s.match(/^(\d{1,2})[-\/.](\d{4})$/); if(m)return `${m[2]}-${String(Number(m[1])).padStart(2,'0')}`;
  return null;
}
function parseNumber(v){
  if(v==null||v==='')return null; let s=String(v).trim().replace(/\s/g,'');
  if(/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s))s=s.replace(/\./g,'').replace(',','.');
  else if(/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s))s=s.replace(/,/g,'');
  else if(s.includes(',')&&!s.includes('.'))s=s.replace(',','.');
  const n=Number(s); return Number.isFinite(n)?n:null;
}
function findOrCreateMetric(companyId,name,unit=''){
  const wanted=String(name||'').trim();
  let m=state.metrics.find(x=>x.companyId===companyId&&x.name.trim().toLowerCase()===wanted.toLowerCase());
  if(!m){
    let id=`${companyId}_${slugify(wanted)}`,n=2; while(state.metrics.some(x=>x.id===id))id=`${companyId}_${slugify(wanted)}_${n++}`;
    const chart=/sản lượng|qc|doanh thu theo nhà máy/i.test(wanted)?'stacked-bar':'auto';
    m={id,companyId,name:wanted,unit,group:'Google Sheets',order:companyMetrics(companyId).length+1,chart}; state.metrics.push(m);
  }else if(unit&&!m.unit)m.unit=unit;
  return m;
}
function rowToCanonical(row,companyId){
  const keys={}; Object.keys(row).forEach(k=>keys[normalizeHeader(k)]=k);
  const period=row[keys.period]??row[keys.date]??row[keys.thang]??row[keys.month];
  const metric=row[keys.metric]??row[keys.chi_tieu]??row[keys.chitieu];
  const series=row[keys.series]??row[keys.nha_may]??row[keys.nhamay]??'Tổng';
  const value=row[keys.value]??row[keys.gia_tri]??row[keys.giatri];
  const unit=row[keys.unit]??row[keys.don_vi]??row[keys.donvi]??'';
  const p=parsePeriod(period), v=parseNumber(value);
  if(!p||!metric||v==null)return null;
  const m=findOrCreateMetric(companyId,metric,unit);
  return{companyId,metricId:m.id,metricName:m.name,series:String(series||'Tổng').trim(),period:p,value:v,unit:m.unit||unit||''};
}
function upsertObservations(rows){
  let inserted=0,updated=0;
  rows.forEach(r=>{
    const idx=state.observations.findIndex(o=>o.metricId===r.metricId&&(o.series||'Tổng')===r.series&&o.period===r.period);
    const clean={companyId:r.companyId,metricId:r.metricId,series:r.series,period:r.period,value:r.value};
    if(idx>=0){state.observations[idx]=clean;updated++}else{state.observations.push(clean);inserted++}
  });
  saveState(); return{inserted,updated};
}
async function syncSheet(){
  const cid=$('#hub-company').value, url=$('#sheet-csv-url').value.trim(), status=$('#sync-status');
  if(!url){status.textContent='Hãy dán URL CSV đã publish của Google Sheet.';return}
  status.textContent='Đang đọc Google Sheet...';
  try{
    const res=await fetch(url,{cache:'no-store'}); if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const csv=await res.text();
    const parsed=Papa.parse(csv,{header:true,skipEmptyLines:true});
    if(parsed.errors?.length&&parsed.data.length===0)throw new Error(parsed.errors[0].message);
    const canonical=parsed.data.map(r=>rowToCanonical(r,cid)).filter(Boolean);
    if(!canonical.length)throw new Error('Không tìm thấy dòng hợp lệ. Cần các cột period, metric, series, value, unit.');
    $('#sheet-preview-summary').textContent=`Đọc được ${canonical.length} điểm dữ liệu hợp lệ. Hiển thị 100 dòng đầu.`;
    $('#sheet-preview-body').innerHTML=canonical.slice(0,100).map(r=>`<tr><td>${monthLabel(r.period)}</td><td>${r.metricName}</td><td>${r.series}</td><td>${fmtNumber(r.value)}</td><td>${r.unit||'—'}</td></tr>`).join('');
    const result=upsertObservations(canonical);
    sources[cid]={csvUrl:url,lastSync:new Date().toISOString()}; saveSources();
    status.textContent=`Đồng bộ xong: ${result.inserted} điểm mới, ${result.updated} điểm cập nhật.`;
    renderDashboard();
  }catch(err){status.textContent=`Không đồng bộ được: ${err.message}`}
}
function saveSource(){
  const cid=$('#hub-company').value, url=$('#sheet-csv-url').value.trim(); sources[cid]={...(sources[cid]||{}),csvUrl:url}; saveSources();
  $('#sync-status').textContent='Đã lưu nguồn Google Sheet cho doanh nghiệp này.';
}

function years(){const y=new Date().getFullYear(),a=[];for(let i=2020;i<=y+1;i++)a.push(i);return a.reverse()}
function renderManual(){
  refreshSelectors(); const ys=$('#input-year-select'),old=ys.value; ys.innerHTML=years().map(y=>`<option>${y}</option>`).join(''); ys.value=old||String(new Date().getFullYear()); renderManualTable();
}
function renderManualTable(){
  const cid=$('#input-company-select').value||activeCompanyId,y=$('#input-year-select').value,ms=companyMetrics(cid);
  $('#input-head-row').innerHTML=`<tr><th>Chỉ tiêu</th>${Array.from({length:12},(_,i)=>`<th>T${i+1}</th>`).join('')}</tr>`;
  $('#input-body').innerHTML=ms.map(m=>`<tr><td><strong>${m.name}</strong><div class="muted">${m.unit||''}</div></td>${Array.from({length:12},(_,i)=>{const p=`${y}-${String(i+1).padStart(2,'0')}`,o=state.observations.find(o=>o.metricId===m.id&&o.period===p&&(o.series||'Tổng')==='Tổng');return `<td class="data-cell"><input data-metric="${m.id}" data-period="${p}" value="${o?.value??''}"/></td>`}).join('')}</tr>`).join('');
}
function saveManual(){
  $$('#input-body input').forEach(i=>{const v=parseNumber(i.value),idx=state.observations.findIndex(o=>o.metricId===i.dataset.metric&&o.period===i.dataset.period&&(o.series||'Tổng')==='Tổng');if(i.value.trim()===''){if(idx>=0)state.observations.splice(idx,1)}else if(v!=null){const row={companyId:state.metrics.find(m=>m.id===i.dataset.metric)?.companyId,metricId:i.dataset.metric,series:'Tổng',period:i.dataset.period,value:v};idx>=0?state.observations[idx]=row:state.observations.push(row)}});
  saveState(); $('#save-status').textContent='Đã lưu dữ liệu thủ công.'; renderDashboard();
}

function renderSettings(){
  refreshSelectors();
  $('#metric-list-body').innerHTML=state.metrics.map(m=>{const c=state.companies.find(c=>c.id===m.companyId);return `<tr><td><strong>${c?.ticker||'—'}</strong></td><td>${m.name}</td><td>${m.unit||'—'}</td><td>${m.group||'—'}</td><td>${m.chart||'auto'}</td><td>${metricSeries(m.id).join(', ')||'—'}</td></tr>`}).join('');
}
function addCompany(e){
  e.preventDefault(); const ticker=$('#new-ticker').value.trim().toUpperCase(),name=$('#new-company-name').value.trim(),sector=$('#new-sector').value.trim();
  if(!ticker||!name)return; if(state.companies.some(c=>c.ticker===ticker))return alert('Mã đã tồn tại');
  let id=slugify(ticker),n=2; while(state.companies.some(c=>c.id===id))id=`${slugify(ticker)}_${n++}`;
  state.companies.push({id,ticker,name,sector}); saveState(); e.target.reset(); activeCompanyId=id; refreshSelectors(); renderSettings();
}
function addMetric(e){
  e.preventDefault(); const companyId=$('#metric-company-select').value,name=$('#new-metric-name').value.trim(),unit=$('#new-metric-unit').value.trim(),group=$('#new-metric-group').value.trim(),chart=$('#new-metric-chart').value;
  if(!companyId||!name)return; let id=`${companyId}_${slugify(name)}`,n=2; while(state.metrics.some(m=>m.id===id))id=`${companyId}_${slugify(name)}_${n++}`;
  state.metrics.push({id,companyId,name,unit,group,chart,order:companyMetrics(companyId).length+1}); saveState(); e.target.reset(); renderSettings();
}

$$('.nav-item').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
$('#company-select').addEventListener('change',e=>{activeCompanyId=e.target.value;renderDashboard()});
$('#dashboard-metric-select').addEventListener('change',renderQuickChart);
$('#goto-hub').addEventListener('click',()=>setView('hub'));
$('#hub-company').addEventListener('change',e=>{activeCompanyId=e.target.value;renderHub()});
$('#save-source').addEventListener('click',saveSource);
$('#sync-sheet').addEventListener('click',syncSheet);
$('#input-company-select').addEventListener('change',renderManualTable);
$('#input-year-select').addEventListener('change',renderManualTable);
$('#save-data').addEventListener('click',saveManual);
$('#company-form').addEventListener('submit',addCompany);
$('#metric-form').addEventListener('submit',addMetric);
$$('.segment').forEach(b=>b.addEventListener('click',()=>{activeRange=b.dataset.range;$$('.segment').forEach(x=>x.classList.toggle('active',x===b));renderCompany()}));

refreshSelectors(); renderDashboard();
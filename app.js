const STORAGE_KEY = 'investment_data_hub_v1';

const seedState = {
  companies: [
    { id: 'fpt', ticker: 'FPT', name: 'FPT Corporation', sector: 'Công nghệ thông tin' }
  ],
  metrics: [
    { id: 'fpt_revenue', companyId: 'fpt', name: 'Doanh thu', unit: 'tỷ đồng', group: 'Tài chính', order: 1 },
    { id: 'fpt_pat', companyId: 'fpt', name: 'Lợi nhuận sau thuế', unit: 'tỷ đồng', group: 'Tài chính', order: 2 },
    { id: 'fpt_overseas_it', companyId: 'fpt', name: 'Doanh thu CNTT nước ngoài', unit: 'tỷ đồng', group: 'CNTT nước ngoài', order: 3 },
    { id: 'fpt_new_signing', companyId: 'fpt', name: 'Ký mới CNTT nước ngoài', unit: 'tỷ đồng', group: 'CNTT nước ngoài', order: 4 },
    { id: 'fpt_japan', companyId: 'fpt', name: 'Doanh thu Nhật Bản', unit: 'tỷ đồng', group: 'CNTT nước ngoài', order: 5 },
    { id: 'fpt_us', companyId: 'fpt', name: 'Doanh thu Mỹ', unit: 'tỷ đồng', group: 'CNTT nước ngoài', order: 6 },
    { id: 'fpt_education', companyId: 'fpt', name: 'Doanh thu giáo dục', unit: 'tỷ đồng', group: 'Giáo dục', order: 7 },
    { id: 'fpt_telecom', companyId: 'fpt', name: 'Doanh thu viễn thông', unit: 'tỷ đồng', group: 'Viễn thông', order: 8 }
  ],
  observations: []
};

let state = loadState();
let activeCompanyId = state.companies[0]?.id || null;
let activeRange = 'all';
let dashboardChart = null;
let companyCharts = [];

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(seedState);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.companies) || !Array.isArray(parsed.metrics) || !Array.isArray(parsed.observations)) throw new Error('invalid');
    return parsed;
  } catch {
    return structuredClone(seedState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function slugify(text) {
  return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
}

function fmtNumber(n) {
  if (n === null || n === undefined || n === '') return '—';
  return Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

function monthLabel(period) {
  const [y,m] = period.split('-');
  return `T${Number(m)}/${y}`;
}

function companyMetrics(companyId) {
  return state.metrics.filter(m => m.companyId === companyId).sort((a,b)=>(a.order||0)-(b.order||0));
}

function observationsForMetric(metricId) {
  return state.observations.filter(o => o.metricId === metricId).sort((a,b)=>a.period.localeCompare(b.period));
}

function latestPeriodForCompany(companyId) {
  const ids = new Set(companyMetrics(companyId).map(m=>m.id));
  const periods = state.observations.filter(o=>ids.has(o.metricId)).map(o=>o.period).sort();
  return periods.at(-1) || null;
}

function setView(name) {
  $$('.view').forEach(v=>v.classList.remove('active-view'));
  $(`#view-${name}`).classList.add('active-view');
  $$('.nav-item').forEach(b=>b.classList.toggle('active', b.dataset.view===name));
  const titles = { dashboard:'Tổng quan dữ liệu', company:'Dữ liệu doanh nghiệp', input:'Nhập dữ liệu', settings:'Quản lý hệ thống' };
  $('#page-title').textContent = titles[name] || 'Data Hub';
  if (name==='company') renderCompanyView();
  if (name==='input') renderInputView();
  if (name==='settings') renderSettings();
}

function refreshCompanySelectors() {
  const opts = state.companies.map(c=>`<option value="${c.id}">${c.ticker} — ${c.name}</option>`).join('');
  ['company-select','input-company-select','metric-company-select'].forEach(id=>{
    const el=$(`#${id}`); if (!el) return;
    const old=el.value;
    el.innerHTML=opts;
    el.value = state.companies.some(c=>c.id===old) ? old : (activeCompanyId || state.companies[0]?.id || '');
  });
}

function renderDashboard() {
  refreshCompanySelectors();
  const totalPoints = state.observations.length;
  const latestPeriods = state.companies.map(c=>latestPeriodForCompany(c.id)).filter(Boolean).sort();
  const latest = latestPeriods.at(-1);
  $('#summary-stats').innerHTML = [
    ['Doanh nghiệp', state.companies.length],
    ['Chỉ tiêu', state.metrics.length],
    ['Điểm dữ liệu', totalPoints],
    ['Kỳ mới nhất', latest ? monthLabel(latest) : 'Chưa có']
  ].map(([label,val])=>`<div class="stat-card"><span>${label}</span><strong>${val}</strong></div>`).join('');

  $('#company-status-body').innerHTML = state.companies.map(c=>{
    const metrics=companyMetrics(c.id); const ids=new Set(metrics.map(m=>m.id));
    const points=state.observations.filter(o=>ids.has(o.metricId)).length;
    const latestP=latestPeriodForCompany(c.id);
    return `<tr><td><strong>${c.ticker}</strong></td><td>${c.name}</td><td>${c.sector||'—'}</td><td>${metrics.length}</td><td>${latestP?monthLabel(latestP):'Chưa có'}</td><td>${points}</td></tr>`;
  }).join('');

  const metrics=companyMetrics(activeCompanyId);
  $('#dashboard-metric-select').innerHTML=metrics.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');
  renderDashboardChart();
}

function renderDashboardChart() {
  const select=$('#dashboard-metric-select');
  const metric=state.metrics.find(m=>m.id===select.value) || companyMetrics(activeCompanyId)[0];
  if (dashboardChart) { dashboardChart.destroy(); dashboardChart=null; }
  const ctx=$('#dashboard-chart');
  if (!metric) return;
  const rows=observationsForMetric(metric.id);
  dashboardChart = new Chart(ctx, {
    type:'line',
    data:{labels:rows.map(r=>monthLabel(r.period)),datasets:[{label:`${metric.name} (${metric.unit||''})`,data:rows.map(r=>r.value),borderWidth:2,tension:.25,pointRadius:3}]},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:{callbacks:{label:(c)=>`${metric.name}: ${fmtNumber(c.raw)} ${metric.unit||''}`}}},scales:{x:{grid:{display:false}},y:{beginAtZero:false}}}
  });
}

function getRangedRows(rows) {
  if (activeRange==='all') return rows;
  return rows.slice(-Number(activeRange));
}

function renderCompanyView() {
  const company=state.companies.find(c=>c.id===activeCompanyId);
  if (!company) return;
  $('#company-title').textContent=`${company.ticker} — ${company.name}`;
  const lp=latestPeriodForCompany(company.id);
  $('#company-subtitle').textContent=`${company.sector||'Chưa phân ngành'} · ${companyMetrics(company.id).length} chỉ tiêu · Kỳ mới nhất: ${lp?monthLabel(lp):'chưa có dữ liệu'}`;
  companyCharts.forEach(c=>c.destroy()); companyCharts=[];
  const grid=$('#charts-grid'); grid.innerHTML='';
  const metrics=companyMetrics(company.id);
  if (!metrics.length) { grid.innerHTML='<div class="panel"><p class="muted">Chưa có chỉ tiêu cho doanh nghiệp này.</p></div>'; return; }
  metrics.forEach(metric=>{
    const card=document.createElement('div'); card.className='chart-card';
    card.innerHTML=`<div class="chart-title"><div><h3>${metric.name}</h3><span>${metric.group||'Chỉ tiêu'} · ${metric.unit||'Không đơn vị'}</span></div></div><div class="chart-box"><canvas></canvas></div>`;
    grid.appendChild(card);
    const rows=getRangedRows(observationsForMetric(metric.id));
    const chart=new Chart(card.querySelector('canvas'),{
      type:'line',data:{labels:rows.map(r=>monthLabel(r.period)),datasets:[{data:rows.map(r=>r.value),label:metric.name,borderWidth:2,tension:.25,pointRadius:2.5,spanGaps:true}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:(c)=>`${fmtNumber(c.raw)} ${metric.unit||''}`}}},scales:{x:{grid:{display:false}},y:{beginAtZero:false}}}
    });
    companyCharts.push(chart);
  });
}

function yearsForInput() {
  const now=new Date().getFullYear();
  const years=[]; for(let y=2020;y<=now+1;y++) years.push(y); return years.reverse();
}

function renderInputView() {
  refreshCompanySelectors();
  const yearSel=$('#input-year-select');
  const old=yearSel.value;
  yearSel.innerHTML=yearsForInput().map(y=>`<option value="${y}">${y}</option>`).join('');
  yearSel.value=old || String(new Date().getFullYear());
  renderInputTable();
}

function renderInputTable() {
  const companyId=$('#input-company-select').value || activeCompanyId;
  const year=Number($('#input-year-select').value || new Date().getFullYear());
  const metrics=companyMetrics(companyId);
  $('#input-head-row').innerHTML=`<tr><th>Chỉ tiêu</th>${Array.from({length:12},(_,i)=>`<th>T${i+1}</th>`).join('')}</tr>`;
  $('#input-body').innerHTML=metrics.map(metric=>{
    const cells=Array.from({length:12},(_,i)=>{
      const period=`${year}-${String(i+1).padStart(2,'0')}`;
      const obs=state.observations.find(o=>o.metricId===metric.id && o.period===period);
      return `<td class="data-cell"><input inputmode="decimal" data-metric="${metric.id}" data-period="${period}" value="${obs?.value ?? ''}" aria-label="${metric.name} ${period}" /></td>`;
    }).join('');
    return `<tr><td><strong>${metric.name}</strong><div class="muted">${metric.unit||''}</div></td>${cells}</tr>`;
  }).join('');
  attachPasteHandling();
}

function attachPasteHandling() {
  const inputs=$$('#input-body .data-cell input');
  inputs.forEach(input=>input.addEventListener('paste', e=>{
    const text=e.clipboardData?.getData('text/plain');
    if (!text || (!text.includes('\t') && !text.includes('\n'))) return;
    e.preventDefault();
    const rows=text.trim().split(/\r?\n/).map(r=>r.split('\t'));
    const allRows=$$('#input-body tr');
    const startCell=input.closest('td');
    const startRow=input.closest('tr');
    const r0=allRows.indexOf(startRow);
    const c0=Array.from(startRow.children).indexOf(startCell)-1;
    rows.forEach((rowVals,ri)=>rowVals.forEach((val,ci)=>{
      const row=allRows[r0+ri]; if(!row) return;
      const target=row.querySelectorAll('.data-cell input')[c0+ci]; if(!target) return;
      target.value=normalizeInput(val);
    }));
  }));
}

function normalizeInput(v) {
  let s=String(v).trim().replace(/\s/g,'');
  if (!s) return '';
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s=s.replace(/\./g,'').replace(',','.');
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s=s.replace(/,/g,'');
  else if (s.includes(',') && !s.includes('.')) s=s.replace(',','.');
  const n=Number(s); return Number.isFinite(n) ? String(n) : '';
}

function saveInputData() {
  const inputs=$$('#input-body .data-cell input');
  inputs.forEach(input=>{
    const value=normalizeInput(input.value);
    const idx=state.observations.findIndex(o=>o.metricId===input.dataset.metric && o.period===input.dataset.period);
    if (value==='') {
      if (idx>=0) state.observations.splice(idx,1);
      return;
    }
    const item={metricId:input.dataset.metric,period:input.dataset.period,value:Number(value)};
    if (idx>=0) state.observations[idx]=item; else state.observations.push(item);
  });
  saveState();
  $('#save-status').textContent='Đã lưu dữ liệu. Biểu đồ đã được cập nhật.';
  setTimeout(()=>$('#save-status').textContent='',2500);
  renderDashboard();
}

function renderSettings() {
  refreshCompanySelectors();
  $('#metric-list-body').innerHTML=state.metrics.slice().sort((a,b)=>{
    const ca=state.companies.find(c=>c.id===a.companyId)?.ticker||'';
    const cb=state.companies.find(c=>c.id===b.companyId)?.ticker||'';
    return ca.localeCompare(cb)||(a.order||0)-(b.order||0);
  }).map(m=>{
    const c=state.companies.find(c=>c.id===m.companyId);
    return `<tr><td><strong>${c?.ticker||'—'}</strong></td><td>${m.name}</td><td>${m.unit||'—'}</td><td>${m.group||'—'}</td></tr>`;
  }).join('');
}

function addCompany(e) {
  e.preventDefault();
  const ticker=$('#new-ticker').value.trim().toUpperCase();
  const name=$('#new-company-name').value.trim();
  const sector=$('#new-sector').value.trim();
  if (!ticker || !name) return;
  if (state.companies.some(c=>c.ticker===ticker)) { alert('Mã doanh nghiệp đã tồn tại.'); return; }
  let id=slugify(ticker); let n=2; while(state.companies.some(c=>c.id===id)) id=`${slugify(ticker)}_${n++}`;
  state.companies.push({id,ticker,name,sector}); saveState();
  e.target.reset(); activeCompanyId=id; refreshCompanySelectors(); renderDashboard(); renderSettings();
}

function addMetric(e) {
  e.preventDefault();
  const companyId=$('#metric-company-select').value;
  const name=$('#new-metric-name').value.trim();
  const unit=$('#new-metric-unit').value.trim();
  const group=$('#new-metric-group').value.trim();
  if (!companyId || !name) return;
  const metrics=companyMetrics(companyId);
  let id=`${companyId}_${slugify(name)}`; let n=2; while(state.metrics.some(m=>m.id===id)) id=`${companyId}_${slugify(name)}_${n++}`;
  state.metrics.push({id,companyId,name,unit,group,order:metrics.length+1}); saveState();
  e.target.reset(); $('#metric-company-select').value=companyId; renderSettings(); renderDashboard();
}

function init() {
  refreshCompanySelectors();
  renderDashboard();
  renderInputView();
  renderSettings();

  $$('.nav-item').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
  $('#goto-input').addEventListener('click',()=>setView('input'));
  $('#company-select').addEventListener('change',e=>{ activeCompanyId=e.target.value; $('#input-company-select').value=activeCompanyId; renderDashboard(); if($('#view-company').classList.contains('active-view')) renderCompanyView(); });
  $('#dashboard-metric-select').addEventListener('change',renderDashboardChart);
  $('#input-company-select').addEventListener('change',e=>{ activeCompanyId=e.target.value; $('#company-select').value=activeCompanyId; renderInputTable(); });
  $('#input-year-select').addEventListener('change',renderInputTable);
  $('#save-data').addEventListener('click',saveInputData);
  $('#company-form').addEventListener('submit',addCompany);
  $('#metric-form').addEventListener('submit',addMetric);
  $$('.segment').forEach(b=>b.addEventListener('click',()=>{ $$('.segment').forEach(x=>x.classList.remove('active')); b.classList.add('active'); activeRange=b.dataset.range; renderCompanyView(); }));
}

document.addEventListener('DOMContentLoaded', init);

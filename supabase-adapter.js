// Investment Data Hub - Supabase read adapter
// Expects window.SUPABASE_CONFIG = { url, anonKey }.
// Reads raw_company_payloads and emits the same gsheet-data-ready event used by the existing parser.

(function(){
  const cfg = window.SUPABASE_CONFIG;
  if (!cfg || !cfg.url || !cfg.anonKey) return;

  async function loadFromSupabase(){
    const base = String(cfg.url).replace(/\/$/,'');
    const url = `${base}/rest/v1/raw_company_payloads?select=company_id,sheet_name,payload,synced_at&company_id=in.(pow,fpt,ree)`;
    const res = await fetch(url, {
      headers:{
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`
      },
      cache:'no-store'
    });
    if(!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    const rows = await res.json();
    const by = Object.fromEntries(rows.map(r=>[String(r.company_id).toUpperCase(),r]));
    if(!by.POW || !by.FPT || !by.REE) throw new Error('Supabase chưa có đủ POW / FPT / REE');

    window.GSHEET_RAW = {
      capturedAt: rows.map(r=>r.synced_at).filter(Boolean).sort().at(-1) || new Date().toISOString(),
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/168-EFropxivOgib3ROy_86al3H8TS5cdGZEhRY3ELPc/edit',
      source: 'supabase',
      sheets: {
        POW: by.POW.payload,
        FPT: by.FPT.payload,
        REE: by.REE.payload
      }
    };
    window.dispatchEvent(new CustomEvent('gsheet-data-ready'));
  }

  window.loadSupabaseData = loadFromSupabase;
  window.addEventListener('DOMContentLoaded',()=>{
    loadFromSupabase().catch(err=>{
      console.error('Supabase load failed',err);
      window.dispatchEvent(new CustomEvent('supabase-load-error',{detail:String(err.message||err)}));
    });
  });
})();

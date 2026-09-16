// Investment Data Hub - Google Sheets -> Supabase sync
// Store secrets in Apps Script > Project Settings > Script Properties:
// SUPABASE_URL=https://YOUR_PROJECT.supabase.co
// SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
// Never paste the service-role key into GitHub.

const DATA_TABS = ['POW', 'FPT', 'REE'];
const COMPANY_IDS = { POW: 'pow', FPT: 'fpt', REE: 'ree' };

function syncAllToSupabase() {
  const props = PropertiesService.getScriptProperties();
  const baseUrl = props.getProperty('SUPABASE_URL');
  const serviceKey = props.getProperty('SUPABASE_SERVICE_ROLE_KEY');
  if (!baseUrl || !serviceKey) throw new Error('Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong Script Properties');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const runId = startRun_(baseUrl, serviceKey);
  const rowCounts = {};

  try {
    DATA_TABS.forEach(name => {
      const sh = ss.getSheetByName(name);
      if (!sh) throw new Error(`Không tìm thấy tab ${name}`);
      const values = sh.getDataRange().getDisplayValues();
      rowCounts[name] = values.length;
      upsertPayload_(baseUrl, serviceKey, {
        company_id: COMPANY_IDS[name],
        source: 'google_sheets',
        sheet_name: name,
        payload: values,
        row_count: values.length,
        source_updated_at: new Date().toISOString(),
        synced_at: new Date().toISOString()
      });
    });
    finishRun_(baseUrl, serviceKey, runId, 'success', 'Đồng bộ thành công', rowCounts);
  } catch (err) {
    finishRun_(baseUrl, serviceKey, runId, 'error', String(err && err.message || err), rowCounts);
    throw err;
  }
}

function upsertPayload_(baseUrl, key, row) {
  const url = `${baseUrl}/rest/v1/raw_company_payloads?on_conflict=company_id`;
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    muteHttpExceptions: true,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    payload: JSON.stringify(row)
  });
  if (res.getResponseCode() >= 300) throw new Error(`Supabase upsert ${row.company_id} lỗi ${res.getResponseCode()}: ${res.getContentText()}`);
}

function startRun_(baseUrl, key) {
  const url = `${baseUrl}/rest/v1/sync_runs`;
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    muteHttpExceptions: true,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    payload: JSON.stringify({ source: 'google_sheets', status: 'running' })
  });
  if (res.getResponseCode() >= 300) throw new Error(`Không tạo được sync run: ${res.getContentText()}`);
  const body = JSON.parse(res.getContentText());
  return body[0].id;
}

function finishRun_(baseUrl, key, id, status, message, rowCounts) {
  const url = `${baseUrl}/rest/v1/sync_runs?id=eq.${encodeURIComponent(id)}`;
  UrlFetchApp.fetch(url, {
    method: 'patch',
    muteHttpExceptions: true,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    payload: JSON.stringify({
      finished_at: new Date().toISOString(),
      status,
      message,
      row_counts: rowCounts
    })
  });
}

// Run once manually after adding Script Properties.
function testSupabaseSync() {
  syncAllToSupabase();
}

// Run once to create a time-driven trigger every 5 minutes.
function installFiveMinuteTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'syncAllToSupabase')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncAllToSupabase').timeBased().everyMinutes(5).create();
}

// Optional: installable onEdit trigger. For large sheets I recommend the 5-minute timer instead.
function installOnEditTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'syncAllToSupabase')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncAllToSupabase').forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
}

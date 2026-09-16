const SPREADSHEET_ID = '168-EFropxivOgib3ROy_86al3H8TS5cdGZEhRY3ELPc';
const TABS = ['POW', 'FPT', 'REE'];

function doGet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = {};

  TABS.forEach(name => {
    const sh = ss.getSheetByName(name);
    if (!sh) throw new Error(`Không tìm thấy tab ${name}`);
    sheets[name] = sh.getDataRange().getDisplayValues();
  });

  const payload = {
    capturedAt: Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm:ss'),
    spreadsheetUrl: ss.getUrl(),
    sheets
  };

  const js = `window.GSHEET_RAW=${JSON.stringify(payload)};window.dispatchEvent(new CustomEvent('gsheet-data-ready'));`;
  return ContentService
    .createTextOutput(js)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

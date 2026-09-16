// Make Supabase the only live source used by the dashboard UI.
(function(){
  function installRefresh(){
    const old = document.getElementById('refresh-live');
    if(!old) return;
    const btn = old.cloneNode(true); // removes the old Apps Script click handler
    old.replaceWith(btn);
    btn.addEventListener('click', async ()=>{
      const state = document.getElementById('source-state');
      if(state) state.innerHTML = '<span class="dot loading"></span> Đang đọc Supabase...';
      try{
        await window.loadSupabaseData();
      }catch(err){
        console.error(err);
        if(state) state.innerHTML = '<span class="dot error"></span> Supabase tạm lỗi · đang dùng dữ liệu gần nhất';
      }
    });
  }

  function markSupabase(){
    const state = document.getElementById('source-state');
    const help = document.getElementById('live-help');
    if(state) state.innerHTML = `<span class="dot live"></span> LIVE · Supabase · ${new Date().toLocaleString('vi-VN')}`;
    if(help) help.innerHTML = '<strong>Nguồn dữ liệu:</strong> Google Sheet → Supabase tự đồng bộ mỗi 5 phút → Dashboard. Không phụ thuộc tài khoản Google hoặc thiết bị đang mở trang.';
  }

  window.addEventListener('gsheet-data-ready', markSupabase);
  window.addEventListener('supabase-load-error', ()=>{
    const state = document.getElementById('source-state');
    if(state) state.innerHTML = '<span class="dot error"></span> Supabase tạm lỗi · đang dùng snapshot';
  });

  installRefresh();
  setInterval(()=>{
    if(window.loadSupabaseData) window.loadSupabaseData().catch(()=>{});
  }, 60000);
})();

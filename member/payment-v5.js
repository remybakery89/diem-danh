/* ============================================================
 * VÒNG 5C — GIAO DIỆN THANH TOÁN
 * ============================================================ */
(function () {
  const API = 'https://script.google.com/macros/s/AKfycbw3vjfqpTIB5U8Kqij9Fa1FtR7RFA-QAreYjl0wBrVkWjGQL6QOyCdP-NtPgwi78lmdHA/exec';
  const FRAME_ID = 'memberPaymentUploadFrame';
  const MAX_BYTES = 650 * 1024;
  const MAX_SIDE = 1400;
  let payments = {};

  function esc(v) {
    return String(v ?? '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }
  function token() { return sessionStorage.getItem('memberRegistrationToken') || ''; }
  function jsonp(params) {
    return new Promise((resolve, reject) => {
      const cb = 'pay_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const script = document.createElement('script');
      const q = new URLSearchParams({...params, callback: cb});
      const timer = setTimeout(() => { cleanup(); reject(new Error('Máy chủ phản hồi quá lâu.')); }, 15000);
      function cleanup(){ clearTimeout(timer); delete window[cb]; script.remove(); }
      window[cb] = d => { cleanup(); resolve(d); };
      script.onerror = () => { cleanup(); reject(new Error('Không kết nối được máy chủ.')); };
      script.src = API + '?' + q;
      document.body.appendChild(script);
    });
  }
  function ensureFrame() {
    let frame = document.getElementById(FRAME_ID);
    if (frame) return frame;
    frame = document.createElement('iframe');
    frame.id = FRAME_ID; frame.name = FRAME_ID; frame.style.display = 'none';
    document.body.appendChild(frame); return frame;
  }
  function postPayment(maBuoi, imageData) {
    return new Promise((resolve, reject) => {
      const frame = ensureFrame();
      const form = document.createElement('form');
      form.method='POST'; form.action=API; form.target=FRAME_ID; form.style.display='none';
      [['api','registration_payment_upload'],['token',token()],['maBuoi',maBuoi],['image',imageData]].forEach(([name,value]) => {
        const input=document.createElement('input'); input.type='hidden'; input.name=name; input.value=value; form.appendChild(input);
      });
      document.body.appendChild(form);
      const timer=setTimeout(()=>{cleanup();reject(new Error('Máy chủ phản hồi quá lâu.'));},30000);
      function cleanup(){clearTimeout(timer);window.removeEventListener('message',onMessage);form.remove();}
      function onMessage(event){const d=event.data||{};if(d.type!=='registration_payment_upload')return;cleanup();resolve(d);}
      window.addEventListener('message',onMessage); form.submit();
    });
  }
  function imageDataUrl(file) {
    return new Promise((resolve,reject)=>{
      if(!file || !file.type.startsWith('image/')) return reject(new Error('Vui lòng chọn ảnh giao dịch.'));
      const reader=new FileReader();
      reader.onerror=()=>reject(new Error('Không đọc được ảnh.'));
      reader.onload=()=>{
        const img=new Image();
        img.onerror=()=>reject(new Error('Không đọc được ảnh.'));
        img.onload=()=>{
          const scale=Math.min(1,MAX_SIDE/Math.max(img.width,img.height));
          const canvas=document.createElement('canvas');
          canvas.width=Math.max(1,Math.round(img.width*scale));
          canvas.height=Math.max(1,Math.round(img.height*scale));
          canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
          let quality=.82, data='';
          for(let i=0;i<5;i++){
            data=canvas.toDataURL('image/jpeg',quality);
            if(data.length <= MAX_BYTES*1.38) break;
            quality-=.1;
          }
          resolve(data);
        };
        img.src=reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  function statusHtml(s) {
    if(s==='ĐÃ XÁC NHẬN') return '<span class="status ok">✓ ĐÃ XÁC NHẬN</span>';
    if(s==='ĐÃ GỬI') return '<span class="status warn">⏳ ĐÃ GỬI — chờ Admin xác nhận</span>';
    return '<span class="status muted">CHƯA NỘP</span>';
  }
  function render(list) {
    const old=document.getElementById('paymentCard'); if(old) old.remove();
    const active=(list||[]).filter(x=>x.trangThai==='ĐI'||x.trangThai==='DỰ BỊ');
    const card=document.createElement('div'); card.className='card'; card.id='paymentCard';
    card.innerHTML='<h2>Thanh toán</h2><p class="muted small">Chỉ gửi ảnh giao dịch sau khi đăng ký đã được duyệt ĐI hoặc DỰ BỊ.</p>'+
      (active.length?active.map(x=>{
        const p=x.payment||{}; const canUpload=p.trangThaiThanhToan!=='ĐÃ XÁC NHẬN';
        return '<div class="program" style="margin-top:10px"><h3>'+esc(x.tenBuoi||x.maBuoi)+'</h3>'+
          '<p class="muted small">'+esc(x.ngay||'')+(x.gio?' · '+esc(x.gio):'')+'</p>'+
          '<p>Đăng ký: <b>'+esc(x.trangThai)+'</b></p>'+
          '<p>Thanh toán: '+statusHtml(p.trangThaiThanhToan)+'</p>'+ 
          (p.soTienXacNhan?'<p>Admin xác nhận: <b>'+esc(p.soTienXacNhan)+'</b></p>':'')+
          (canUpload?'<input id="pay_'+esc(x.maBuoi)+'" type="file" accept="image/*" style="margin-top:8px"><button type="button" data-ma="'+esc(x.maBuoi)+'" class="payUploadBtn" style="margin-top:8px">'+(p.trangThaiThanhToan==='ĐÃ GỬI'?'Gửi lại ảnh giao dịch':'Gửi ảnh giao dịch')+'</button><div class="payMsg muted small" id="paymsg_'+esc(x.maBuoi)+'"></div>':'<p class="muted small">Thanh toán đã được Admin xác nhận.</p>')+
          '</div>';
      }).join(''):'<p class="muted">Chưa có đăng ký ĐI hoặc DỰ BỊ cần thanh toán.</p>');
    const app=document.getElementById('app'); const mine=document.getElementById('mine')?.closest('.card');
    if(app){ if(mine) app.insertBefore(card,mine); else app.appendChild(card); }
    card.querySelectorAll('.payUploadBtn').forEach(btn=>btn.onclick=()=>upload(btn.dataset.ma));
  }
  async function upload(maBuoi) {
    const input=document.getElementById('pay_'+maBuoi), msg=document.getElementById('paymsg_'+maBuoi), btn=document.querySelector('.payUploadBtn[data-ma="'+CSS.escape(maBuoi)+'"]');
    if(!input?.files?.[0]){msg.textContent='Vui lòng chọn ảnh giao dịch.';return;}
    btn.disabled=true; btn.textContent='Đang gửi...'; msg.textContent='';
    try{
      const data=await imageDataUrl(input.files[0]);
      const r=await postPayment(maBuoi,data);
      if(!r.success) throw new Error(r.message||'Không gửi được ảnh giao dịch.');
      payments[maBuoi]=r.payment||{}; msg.textContent='Đã gửi ảnh giao dịch cho Admin xác nhận.'; msg.className='payMsg ok small';
      await load();
    }catch(e){msg.textContent=e.message||'Không gửi được ảnh giao dịch.';msg.className='payMsg danger-text small';}
    finally{btn.disabled=false;input.value='';}
  }
  async function load(){
    const t=token(); if(!t)return;
    const r=await jsonp({api:'registration_v5_payment_mine',token:t});
    if(!r.success){if(r.type==='SESSION_EXPIRED'&&typeof window.logout==='function')window.logout();return;}
    const list=r.registrations||[]; payments={}; list.forEach(x=>payments[x.maBuoi]=x.payment||{}); render(list);
  }
  function hook(){
    if(typeof window.jsonp!=='function'||typeof window.refreshAll!=='function'||typeof window.loadMine!=='function'){setTimeout(hook,100);return;}
    if(window.__v5PaymentHooked)return; window.__v5PaymentHooked=true;
    load().catch(()=>{});
  }
  hook();
})();

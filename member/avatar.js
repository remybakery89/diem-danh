/* VÒNG 4 — AVATAR
 * Upload avatar qua Apps Script bằng POST + hidden iframe.
 * Tránh CORS của fetch khi gọi Apps Script từ GitHub Pages.
 */
(function () {
  const AVATAR_API = 'https://script.google.com/macros/s/AKfycbw3vjfqpTIB5U8Kqij9Fa1FtR7RFA-QAreYjl0wBrVkWjGQL6QOyCdP-NtPgwi78lmdHA/exec';
  const MAX_BYTES = 500 * 1024;
  const MAX_SIDE = 800;
  const FRAME_ID = 'memberAvatarUploadFrame';

  function avatarDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) return reject(new Error('Vui lòng chọn một ảnh.'));
      if (file.size > MAX_BYTES) return reject(new Error('Ảnh tối đa 500 KB.'));
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = () => reject(new Error('Không đọc được ảnh.'));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error('Không đọc được file ảnh.'));
      reader.readAsDataURL(file);
    });
  }

  function ensureFrame() {
    let frame = document.getElementById(FRAME_ID);
    if (frame) return frame;
    frame = document.createElement('iframe');
    frame.id = FRAME_ID;
    frame.name = FRAME_ID;
    frame.style.display = 'none';
    document.body.appendChild(frame);
    return frame;
  }

  function postAvatar(token, imageData) {
    return new Promise((resolve, reject) => {
      const frame = ensureFrame();
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = AVATAR_API;
      form.target = FRAME_ID;
      form.style.display = 'none';

      const add = (name, value) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      };
      add('api', 'member_avatar_upload');
      add('token', token);
      add('image', imageData);
      document.body.appendChild(form);

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Máy chủ phản hồi quá lâu.'));
      }, 30000);

      function cleanup() {
        clearTimeout(timeout);
        window.removeEventListener('message', onMessage);
        form.remove();
      }

      function onMessage(event) {
        const d = event.data || {};
        if (d.type !== 'member_avatar_upload') return;
        cleanup();
        resolve(d);
      }

      window.addEventListener('message', onMessage);
      frame.onload = function () {};
      form.submit();
    });
  }

  window.initAvatarUpload = function () {
    const box = document.getElementById('profileBox');
    if (!box || document.getElementById('avatarUploadInput')) return;
    const area = document.createElement('div');
    area.style.marginTop = '12px';
    area.innerHTML = '<input id="avatarUploadInput" type="file" accept="image/*" hidden><button type="button" class="secondary" id="avatarUploadBtn">Đổi ảnh đại diện</button><div id="avatarUploadMsg" class="notice hidden"></div>';
    box.appendChild(area);

    const input = document.getElementById('avatarUploadInput');
    const btn = document.getElementById('avatarUploadBtn');
    const msg = document.getElementById('avatarUploadMsg');

    btn.onclick = () => input.click();
    input.onchange = async () => {
      if (!input.files[0]) return;
      btn.disabled = true;
      btn.textContent = 'Đang tải ảnh...';
      msg.classList.add('hidden');
      try {
        const data = await avatarDataUrl(input.files[0]);
        const token = sessionStorage.getItem('memberRegistrationToken') || '';
        const r = await postAvatar(token, data);
        if (!r.success) throw new Error(r.message || 'Không lưu được avatar.');
        msg.textContent = 'Đã cập nhật ảnh đại diện.';
        msg.className = 'notice ok';
        msg.classList.remove('hidden');
        if (typeof loadProfile === 'function') await loadProfile();
      } catch (e) {
        msg.textContent = e.message || 'Không lưu được avatar.';
        msg.className = 'notice danger-text';
        msg.classList.remove('hidden');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Đổi ảnh đại diện';
        input.value = '';
      }
    };
  };
})();

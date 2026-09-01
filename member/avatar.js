/* VÒNG 4 — AVATAR
 * Upload avatar qua Apps Script bằng POST, không đi qua JSONP.
 * Backend endpoint: member_avatar_upload
 */
(function () {
  const AVATAR_API = 'https://script.google.com/macros/s/AKfycbw3vjfqpTIB5U8Kqij9Fa1FtR7RFA-QAreYjl0wBrVkWjGQL6QOyCdP-NtPgwi78lmdHA/exec';
  const MAX_BYTES = 500 * 1024;
  const MAX_SIDE = 800;

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

  function postAvatar(token, imageData) {
    return new Promise((resolve, reject) => {
      const body = new URLSearchParams({ api: 'member_avatar_upload', token: token, image: imageData });
      fetch(AVATAR_API, { method: 'POST', body: body })
        .then(r => r.json())
        .then(resolve)
        .catch(() => reject(new Error('Không kết nối được máy chủ.')));
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
      btn.disabled = true; btn.textContent = 'Đang tải ảnh...'; msg.classList.add('hidden');
      try {
        const data = await avatarDataUrl(input.files[0]);
        const r = await postAvatar(sessionStorage.getItem('memberRegistrationToken') || '', data);
        if (!r.success) throw new Error(r.message || 'Không lưu được avatar.');
        msg.textContent = 'Đã cập nhật ảnh đại diện.';
        msg.className = 'notice ok'; msg.classList.remove('hidden');
        if (typeof loadProfile === 'function') await loadProfile();
      } catch (e) {
        msg.textContent = e.message; msg.className = 'notice danger-text'; msg.classList.remove('hidden');
      } finally { btn.disabled = false; btn.textContent = 'Đổi ảnh đại diện'; input.value = ''; }
    };
  };
})();

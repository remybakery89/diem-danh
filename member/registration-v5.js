/* ============================================================
 * VÒNG 5 — GIAO DIỆN ĐĂNG KÝ
 * ============================================================ */
(function () {
  var v5Mine = [];

  function escV5(value) {
    return String(value ?? '').replace(/[&<>'\"]/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c];
    });
  }

  function getToken() {
    return sessionStorage.getItem('memberRegistrationToken') || '';
  }

  function findMine(maBuoi) {
    return v5Mine.find(function (item) {
      return String(item.maBuoi || '') === String(maBuoi || '') && item.trangThai !== 'ĐÃ HỦY';
    }) || null;
  }

  function statusClass(status) {
    if (status === 'ĐI') return 'ok';
    if (status === 'KHÔNG ĐI') return 'danger-text';
    if (status === 'DỰ BỊ' || status === 'CHỜ DUYỆT') return 'warn';
    return 'muted';
  }

  function statusButtons(maBuoi, mine, disabled) {
    if (disabled) return '<button disabled>Không thể đăng ký</button>';
    var current = mine && mine.trangThai ? mine.trangThai : '';
    var pending = current === 'CHỜ DUYỆT';
    var html = '<div class="small muted" style="margin-bottom:8px">Chọn trạng thái tham gia:</div><div class="row">';
    ['ĐI','KHÔNG ĐI','DỰ BỊ'].forEach(function (status) {
      var label = status;
      if (pending && mine.trangThaiYeuCau === status) label += ' (đang chờ)';
      html += '<button type="button" ' + (pending ? 'disabled' : '') +
        ' onclick="v5SubmitStatus(\'' + encodeURIComponent(maBuoi) + '\',\'' + encodeURIComponent(status) + '\')">' +
        escV5(label) + '</button>';
    });
    html += '</div>';
    if (mine && current !== 'CHỜ DUYỆT') {
      html += '<button type="button" class="danger" style="margin-top:10px" onclick="v5CancelRegistration(\'' + encodeURIComponent(maBuoi) + '\')">Hủy đăng ký</button>';
    }
    return html;
  }

  function renderProgramsV5(list) {
    var box = document.getElementById('programs');
    if (!box) return;
    if (!list || !list.length) { box.innerHTML = '<p class="muted">Chưa có chương trình.</p>'; return; }
    box.innerHTML = list.map(function (p) {
      var mine = findMine(p.maBuoi);
      var canSubmit = p.trangThai === 'ĐANG MỞ';
      var current = mine ? String(mine.trangThai || '') : '';
      var statusHtml = mine
        ? '<span class="status ' + statusClass(current) + '">' + escV5(current) + '</span>' +
          (mine.trangThaiYeuCau ? ' · yêu cầu: <span class="status warn">' + escV5(mine.trangThaiYeuCau) + '</span>' : '')
        : '<span class="muted">Chưa đăng ký</span>';
      return '<div class="program"><h3>' + escV5(p.tenBuoi) + '</h3>' +
        '<p>📅 ' + escV5(p.ngay) + (p.gio ? ' · ' + escV5(p.gio) : '') + '</p>' +
        (p.diaDiem ? '<p>📍 ' + escV5(p.diaDiem) + '</p>' : '') +
        '<p>' + statusHtml + (p.gioiHan ? ' · Giới hạn ' + escV5(p.gioiHan) : '') + '</p>' +
        (p.ghiChu ? '<p class="muted small">' + escV5(p.ghiChu) + '</p>' : '') +
        '<div style="margin-top:10px">' + statusButtons(p.maBuoi, mine, !canSubmit) + '</div></div>';
    }).join('');
  }

  async function loadMineV5() {
    var token = getToken();
    if (!token) return;
    var r = await window.jsonp({api:'registration_v5_mine', token:token});
    if (!r.success) {
      if (r.type === 'SESSION_EXPIRED' && typeof window.logout === 'function') window.logout();
      throw new Error(r.message || 'Không tải được đăng ký.');
    }
    v5Mine = r.registrations || [];
    var mineBox = document.getElementById('mine');
    if (!mineBox) return;
    mineBox.innerHTML = v5Mine.length ? v5Mine.map(function (x) {
      var status = x.trangThai || '';
      var text = status === 'CHỜ DUYỆT' ? '<span class="warn">⏳ Chờ Admin duyệt</span>' :
        status === 'ĐI' ? '<span class="ok">✓ ĐI</span>' :
        status === 'KHÔNG ĐI' ? '<span class="danger-text">✕ KHÔNG ĐI</span>' :
        status === 'DỰ BỊ' ? '<span class="warn">◐ DỰ BỊ</span>' : '<span class="muted">Đã hủy</span>';
      var request = x.trangThaiYeuCau ? '<p class="muted small">Yêu cầu: ' + escV5(x.trangThaiYeuCau) + '</p>' : '';
      var cancel = status !== 'ĐÃ HỦY' && status !== 'CHỜ DUYỆT' ? '<button class="danger" onclick="v5CancelRegistration(\'' + encodeURIComponent(x.maBuoi) + '\')">Hủy đăng ký</button>' : '';
      return '<div class="program"><b>' + escV5(x.tenBuoi || x.maBuoi) + '</b><p class="muted small">' + escV5(x.ngay || '') + (x.gio ? ' · ' + escV5(x.gio) : '') + '</p><p>' + text + '</p>' + request + cancel + '</div>';
    }).join('') : '<p class="muted">Bạn chưa có đăng ký nào.</p>';
  }

  async function submitStatus(encodedMaBuoi, encodedStatus) {
    var maBuoi = decodeURIComponent(encodedMaBuoi), status = decodeURIComponent(encodedStatus);
    var mine = findMine(maBuoi), isChange = !!mine && mine.trangThai !== status, reason = '';
    if (isChange || !mine) {
      reason = prompt(isChange ? 'Bạn đang thay đổi trạng thái. Vui lòng nhập lý do:' : 'Nếu đăng ký sau hạn chót, vui lòng nhập lý do (có thể bỏ trống nếu chưa tới hạn):','');
      if (reason === null) return;
    }
    try {
      var r = await window.jsonp({api:'registration_v5_submit',token:getToken(),maBuoi:maBuoi,trangThai:status,lyDo:reason || ''});
      if (!r.success) { alert(r.message || 'Không cập nhật được đăng ký.'); return; }
      alert(r.message || 'Đã cập nhật đăng ký.');
      await window.refreshAll();
    } catch (e) { alert(e.message || 'Không cập nhật được đăng ký.'); }
  }

  async function cancelV5(encodedMaBuoi) {
    var maBuoi = decodeURIComponent(encodedMaBuoi);
    if (!confirm('Bạn có chắc muốn hủy đăng ký chương trình này?')) return;
    try {
      var r = await window.jsonp({api:'registration_v5_cancel',token:getToken(),maBuoi:maBuoi});
      if (!r.success) { alert(r.message || 'Không thể hủy đăng ký.'); return; }
      alert(r.message || 'Đã hủy đăng ký.');
      await window.refreshAll();
    } catch (e) { alert(e.message || 'Không thể hủy đăng ký.'); }
  }

  function hook() {
    if (typeof window.jsonp !== 'function' || typeof window.refreshAll !== 'function' || typeof window.loadMine !== 'function' || typeof window.renderPrograms !== 'function') {
      setTimeout(hook,50); return;
    }
    if (window.__v5RegistrationHooked) return;
    window.__v5RegistrationHooked = true;
    window.loadMine = function () { return loadMineV5(); };
    window.renderPrograms = function (list) { renderProgramsV5(list); };
    window.v5SubmitStatus = submitStatus;
    window.v5CancelRegistration = cancelV5;
    window.registerProgram = function (encoded) { return submitStatus(encoded, encodeURIComponent('ĐI')); };
    window.cancelProgram = cancelV5;
  }
  hook();
})();

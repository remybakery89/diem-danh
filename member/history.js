/* ============================================================
 * VÒNG 4 — HIỂN THỊ LỊCH SỬ ĐIỂM DANH
 * Phụ thuộc vào jsonp(), token và esc() có sẵn trong index.html.
 * ============================================================ */
(function () {
  function addHistoryCard() {
    if (document.getElementById('attendanceHistoryCard')) return;
    const app = document.getElementById('app');
    const mineCard = document.getElementById('mine')?.closest('.card');
    if (!app || !mineCard) return;

    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'attendanceHistoryCard';
    card.innerHTML = '<h2>Đã tham gia</h2><div id="attendanceHistory"><p class="muted">Đang tải lịch sử...</p></div>';
    mineCard.insertAdjacentElement('afterend', card);
  }

  function renderHistory(rows) {
    const box = document.getElementById('attendanceHistory');
    if (!box) return;

    if (!rows || !rows.length) {
      box.innerHTML = '<p class="muted">Chưa có chương trình nào được ghi nhận điểm danh.</p>';
      return;
    }

    box.innerHTML = rows.map(function (x) {
      return '<div class="program">' +
        '<h3>' + esc(x.tenBuoi || x.maBuoi) + '</h3>' +
        '<p>📅 ' + esc(x.ngay || '') + (x.gio ? ' · ' + esc(x.gio) : '') + '</p>' +
        (x.diaDiem ? '<p>📍 ' + esc(x.diaDiem) + '</p>' : '') +
        '<p class="ok"><b>✓ Đã điểm danh</b></p>' +
        (x.thoiGianDiemDanh ? '<p class="muted small">Điểm danh: ' + esc(x.thoiGianDiemDanh) + '</p>' : '') +
        '</div>';
    }).join('');
  }

  async function loadHistory() {
    if (!token) return;
    addHistoryCard();
    try {
      const r = await jsonp({ api: 'registration_member_history', token: token });
      if (!r.success) {
        if (r.type === 'SESSION_EXPIRED' && typeof logout === 'function') {
          logout();
          return;
        }
        throw new Error(r.message || 'Không tải được lịch sử.');
      }
      renderHistory(r.rows || []);
    } catch (e) {
      const box = document.getElementById('attendanceHistory');
      if (box) box.innerHTML = '<p class="danger-text">' + esc(e.message) + '</p>';
    }
  }

  function start() {
    if (typeof jsonp === 'undefined' || typeof token === 'undefined') return;
    if (document.getElementById('app')?.classList.contains('hidden')) {
      setTimeout(start, 500);
      return;
    }
    loadHistory();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();

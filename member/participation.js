/* ============================================================
 * VÒNG 4 — HIỂN THỊ LỊCH SỬ THAM GIA
 * ============================================================ */
(function () {
  function escHistory(value) {
    return String(value ?? '').replace(/[&<>'\"]/g, function (c) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '\"': '&quot;'
      }[c];
    });
  }

  function renderParticipation(history) {
    const old = document.getElementById('participationCard');
    if (old) old.remove();

    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'participationCard';

    const list = Array.isArray(history) ? history : [];

    card.innerHTML = '<h2>Lịch sử tham gia</h2>' +
      (list.length
        ? list.map(function (item) {
            return '<div class="program">' +
              '<h3>' + escHistory(item.tenBuoi) + '</h3>' +
              (item.ngay ? '<p class="muted small">📅 ' + escHistory(item.ngay) + '</p>' : '') +
              '</div>';
          }).join('')
        : '<p class="muted">Chưa có chương trình nào được ghi nhận.</p>');

    const app = document.getElementById('app');
    const mineCard = document.getElementById('mine')?.closest('.card');
    if (app) {
      if (mineCard) app.insertBefore(card, mineCard);
      else app.appendChild(card);
    }
  }

  function hookProfileRender() {
    if (typeof window.renderProfile !== 'function') {
      setTimeout(hookProfileRender, 50);
      return;
    }

    if (window.__participationHooked) return;
    window.__participationHooked = true;

    const original = window.renderProfile;
    window.renderProfile = function (profile) {
      original(profile);
      renderParticipation(profile?.thamGia || []);
    };

    if (window.member) renderParticipation(window.member.thamGia || []);
  }

  hookProfileRender();
})();

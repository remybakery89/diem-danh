/* ============================================================
 * VÒNG 4 — LỊCH SỬ THAM GIA CÁ NHÂN
 *
 * Lưu nhẹ theo từng Member ID trong Script Properties.
 * Không tạo thêm Sheet và không đọc lại Diem_Danh khi mở hồ sơ.
 * Chỉ ghi sau khi điểm danh thành công.
 * "Tập hát" không được ghi vào lịch sử tham gia.
 * ============================================================ */

const V4_PARTICIPATION_PREFIX = 'V4_PARTICIPATION_';
const V4_PARTICIPATION_MAX_RESPONSE = 100;

function normalizeParticipationText_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function isExcludedParticipationProgram_(tenBuoi) {
  return normalizeParticipationText_(tenBuoi) === 'tập hát';
}

function getMemberParticipationKey_(ma) {
  return V4_PARTICIPATION_PREFIX + String(ma || '').trim().toUpperCase();
}

function recordMemberParticipation_(ma, maBuoi, tenBuoi, ngay) {
  ma = String(ma || '').trim().toUpperCase();
  maBuoi = String(maBuoi || '').trim();
  tenBuoi = String(tenBuoi || '').trim();
  ngay = String(ngay || '').trim();

  if (!/^SC\d+$/i.test(ma) || !maBuoi || !tenBuoi) return;
  if (isExcludedParticipationProgram_(tenBuoi)) return;

  const props = PropertiesService.getScriptProperties();
  const key = getMemberParticipationKey_(ma);
  let history = [];

  const raw = props.getProperty(key);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) history = parsed;
    } catch (e) {
      history = [];
    }
  }

  const exists = history.some(function(item) {
    return String(item && item.maBuoi || '').trim() === maBuoi;
  });

  if (exists) return;

  history.push({
    maBuoi: maBuoi,
    tenBuoi: tenBuoi,
    ngay: ngay
  });

  history.sort(function(a, b) {
    const da = String(a.ngay || '');
    const db = String(b.ngay || '');
    return db.localeCompare(da);
  });

  props.setProperty(key, JSON.stringify(history));
}

function getMemberParticipation_(ma) {
  ma = String(ma || '').trim().toUpperCase();
  if (!/^SC\d+$/i.test(ma)) return [];

  const raw = PropertiesService.getScriptProperties()
    .getProperty(getMemberParticipationKey_(ma));

  if (!raw) return [];

  try {
    const history = JSON.parse(raw);
    if (!Array.isArray(history)) return [];

    return history
      .filter(function(item) {
        return item && item.maBuoi && item.tenBuoi;
      })
      .filter(function(item) {
        return !isExcludedParticipationProgram_(item.tenBuoi);
      })
      .sort(function(a, b) {
        return String(b.ngay || '').localeCompare(String(a.ngay || ''));
      })
      .slice(0, V4_PARTICIPATION_MAX_RESPONSE);
  } catch (e) {
    return [];
  }
}

/* ============================================================
 * VÒNG 2B — ADMIN QUẢN LÝ CHƯƠNG TRÌNH
 *
 * Dùng trực tiếp sheet BUOI.
 * A Mã buổi
 * B Ngày
 * C Giờ
 * D Tên buổi
 * E Địa điểm
 * F Mở đăng ký
 * G (cũ) Đóng đăng ký — không còn dùng để tự động đóng
 * H Giới hạn
 * I Đối tượng
 * J Ghi chú
 * K Hạn chót đăng ký
 * L Phương tiện
 * M Điểm đón
 * ============================================================ */

const REGISTRATION_MODE_PREFIX = 'REG_MODE_';

function adminListPrograms_(password) {
  const auth = verifyAdminPassword(password);
  if (!auth.success) return auth;
  return getRegistrationPrograms_();
}

function adminSaveProgram_(password, payload) {
  const auth = verifyAdminPassword(password);
  if (!auth.success) return auth;

  if (!payload || typeof payload !== 'object') return { success: false, type: 'INVALID_DATA', message: 'Dữ liệu chương trình không hợp lệ.' };

  const tenBuoi = String(payload.tenBuoi || '').trim();
  const ngayText = String(payload.ngay || '').trim();
  const gioText = String(payload.gio || '').trim();
  if (!tenBuoi || !ngayText || !gioText) return { success: false, type: 'MISSING_FIELDS', message: 'Vui lòng nhập tên buổi, ngày và giờ.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngayText)) return { success: false, type: 'INVALID_DATE', message: 'Ngày không đúng định dạng.' };
  if (!/^\d{2}:\d{2}$/.test(gioText)) return { success: false, type: 'INVALID_TIME', message: 'Giờ không đúng định dạng.' };

  const gioiHan = String(payload.gioiHan || '').trim();
  if (gioiHan && (!/^\d+$/.test(gioiHan) || Number(gioiHan) < 1)) return { success: false, type: 'INVALID_LIMIT', message: 'Giới hạn phải là số nguyên dương.' };

  const moDangKy = String(payload.moDangKy || '').trim();
  if (moDangKy && !/^\d{2}:\d{2}$/.test(moDangKy)) return { success: false, type: 'INVALID_OPEN_TIME', message: 'Giờ mở đăng ký không hợp lệ.' };

  const hanChot = String(payload.hanChot || '').trim();
  if (hanChot && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(hanChot)) return { success: false, type: 'INVALID_DEADLINE', message: 'Hạn chót không hợp lệ.' };

  const requestedMode = String(payload.cheDoDangKy || '').trim().toUpperCase();
  if (requestedMode && ['AUTO', 'OPEN', 'CLOSED'].indexOf(requestedMode) < 0) return { success: false, type: 'INVALID_REGISTRATION_MODE', message: 'Chế độ đăng ký không hợp lệ.' };

  const phuongTien = String(payload.phuongTien || '').trim();
  if (phuongTien && ['KHÔNG ÁP DỤNG', 'XE CHUNG', 'XE RIÊNG'].indexOf(phuongTien.toUpperCase()) < 0) return { success: false, type: 'INVALID_TRANSPORT', message: 'Phương tiện không hợp lệ.' };

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_BUOI);
  if (!sheet) throw new Error('Không tìm thấy sheet BUOI.');

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const maBuoiInput = String(payload.maBuoi || '').trim();
    const data = sheet.getDataRange().getValues();
    let rowNumber = -1;
    if (maBuoiInput) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0] || '').trim() === maBuoiInput) { rowNumber = i + 1; break; }
      }
      if (rowNumber < 0) return { success: false, type: 'NOT_FOUND', message: 'Không tìm thấy mã buổi cần sửa.' };
    }

    let maBuoi = maBuoiInput;
    if (!maBuoi) {
      const stamp = Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMddHHmmss');
      maBuoi = 'CT' + stamp + Math.floor(100 + Math.random() * 900);
      rowNumber = sheet.getLastRow() + 1;
    }

    const oldClose = (maBuoiInput && rowNumber <= data.length) ? data[rowNumber - 1][6] : '';
    const values = [[
      maBuoi,
      new Date(ngayText + 'T00:00:00'),
      new Date('1899-12-30T' + gioText + ':00'),
      tenBuoi,
      String(payload.diaDiem || '').trim(),
      moDangKy ? new Date('1899-12-30T' + moDangKy + ':00') : '',
      oldClose,
      gioiHan,
      String(payload.doiTuong || '').trim(),
      String(payload.ghiChu || '').trim(),
      hanChot ? new Date(hanChot) : '',
      phuongTien,
      String(payload.diemDon || '').trim()
    ]];

    sheet.getRange(rowNumber, 1, 1, 13).setValues(values);
    sheet.getRange(rowNumber, 2).setNumberFormat('dd/MM/yyyy');
    sheet.getRange(rowNumber, 3).setNumberFormat('HH:mm');
    sheet.getRange(rowNumber, 6).setNumberFormat('HH:mm');
    sheet.getRange(rowNumber, 11).setNumberFormat('dd/MM/yyyy HH:mm');

    if (requestedMode) setRegistrationMode_(password, maBuoi, requestedMode);

    return { success: true, message: maBuoiInput ? 'Đã cập nhật chương trình.' : 'Đã tạo chương trình mới.', maBuoi: maBuoi, cheDoDangKy: getRegistrationMode_(maBuoi) };
  } finally { lock.releaseLock(); }
}

function adminGetProgram_(password, maBuoi) {
  const auth = verifyAdminPassword(password);
  if (!auth.success) return auth;
  const code = String(maBuoi || '').trim();
  if (!code) return { success: false, message: 'Thiếu mã buổi.' };

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_BUOI);
  if (!sheet) throw new Error('Không tìm thấy sheet BUOI.');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').trim() !== code) continue;
    const dateValue = data[i][1], timeValue = data[i][2], openValue = data[i][5], deadlineValue = data[i][10];
    return { success: true, program: {
      maBuoi: code,
      ngay: dateValue instanceof Date ? Utilities.formatDate(dateValue, TIMEZONE, 'yyyy-MM-dd') : String(dateValue || ''),
      gio: timeValue instanceof Date ? Utilities.formatDate(timeValue, TIMEZONE, 'HH:mm') : String(timeValue || ''),
      tenBuoi: String(data[i][3] || ''), diaDiem: String(data[i][4] || ''),
      moDangKy: openValue instanceof Date ? Utilities.formatDate(openValue, TIMEZONE, 'HH:mm') : String(openValue || ''),
      hanChot: deadlineValue instanceof Date ? Utilities.formatDate(deadlineValue, TIMEZONE, "yyyy-MM-dd'T'HH:mm") : String(deadlineValue || ''),
      gioiHan: String(data[i][7] || ''), doiTuong: String(data[i][8] || ''), ghiChu: String(data[i][9] || ''),
      phuongTien: String(data[i][11] || ''), diemDon: String(data[i][12] || ''), cheDoDangKy: getRegistrationMode_(code)
    }};
  }
  return { success: false, type: 'NOT_FOUND', message: 'Không tìm thấy chương trình.' };
}

function getRegistrationModeKey_(maBuoi) { return REGISTRATION_MODE_PREFIX + String(maBuoi || '').trim(); }
function getRegistrationMode_(maBuoi) {
  const mode = PropertiesService.getScriptProperties().getProperty(getRegistrationModeKey_(maBuoi));
  return mode === 'OPEN' || mode === 'CLOSED' ? mode : 'AUTO';
}
function setRegistrationMode_(password, maBuoi, mode) {
  const auth = verifyAdminPassword(password); if (!auth.success) return auth;
  const code = String(maBuoi || '').trim(), normalized = String(mode || '').trim().toUpperCase();
  if (!code) return { success:false, type:'INVALID_INPUT', message:'Thiếu mã buổi.' };
  if (['AUTO','OPEN','CLOSED'].indexOf(normalized)<0) return { success:false, type:'INVALID_REGISTRATION_MODE', message:'Chế độ đăng ký không hợp lệ.' };
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_BUOI);
  if (!sheet) throw new Error('Không tìm thấy sheet BUOI.');
  if (!getBuoiByMa_(sheet, code)) return { success:false, type:'NOT_FOUND', message:'Không tìm thấy chương trình.' };
  const props = PropertiesService.getScriptProperties(), key = getRegistrationModeKey_(code);
  if (normalized === 'AUTO') props.deleteProperty(key); else props.setProperty(key, normalized);
  return { success:true, maBuoi:code, cheDoDangKy:getRegistrationMode_(code) };
}
function adminSetRegistrationMode_(password, maBuoi, mode) { return setRegistrationMode_(password, maBuoi, mode); }
""
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
 * G Đóng đăng ký
 * H Giới hạn
 * I Đối tượng
 * J Ghi chú
 *
 * Không xóa BUOI để bảo toàn lịch sử DANG_KY / Diem_Danh.
 * ============================================================
 */

function adminListPrograms_(password) {
  const auth = verifyAdminPassword(password);
  if (!auth.success) return auth;
  return getRegistrationPrograms_();
}

function adminSaveProgram_(password, payload) {
  const auth = verifyAdminPassword(password);
  if (!auth.success) return auth;

  if (!payload || typeof payload !== 'object') {
    return { success: false, type: 'INVALID_DATA', message: 'Dữ liệu chương trình không hợp lệ.' };
  }

  const tenBuoi = String(payload.tenBuoi || '').trim();
  const ngayText = String(payload.ngay || '').trim();
  const gioText = String(payload.gio || '').trim();

  if (!tenBuoi || !ngayText || !gioText) {
    return { success: false, type: 'MISSING_FIELDS', message: 'Vui lòng nhập tên buổi, ngày và giờ.' };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngayText)) {
    return { success: false, type: 'INVALID_DATE', message: 'Ngày không đúng định dạng.' };
  }

  if (!/^\d{2}:\d{2}$/.test(gioText)) {
    return { success: false, type: 'INVALID_TIME', message: 'Giờ không đúng định dạng.' };
  }

  const gioiHan = String(payload.gioiHan || '').trim();
  if (gioiHan && (!/^\d+$/.test(gioiHan) || Number(gioiHan) < 1)) {
    return { success: false, type: 'INVALID_LIMIT', message: 'Giới hạn phải là số nguyên dương.' };
  }

  const moDangKy = String(payload.moDangKy || '').trim();
  const dongDangKy = String(payload.dongDangKy || '').trim();

  if (moDangKy && !/^\d{2}:\d{2}$/.test(moDangKy)) {
    return { success: false, type: 'INVALID_OPEN_TIME', message: 'Giờ mở đăng ký không hợp lệ.' };
  }
  if (dongDangKy && !/^\d{2}:\d{2}$/.test(dongDangKy)) {
    return { success: false, type: 'INVALID_CLOSE_TIME', message: 'Giờ đóng đăng ký không hợp lệ.' };
  }

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
        if (String(data[i][0] || '').trim() === maBuoiInput) {
          rowNumber = i + 1;
          break;
        }
      }
      if (rowNumber < 0) {
        return { success: false, type: 'NOT_FOUND', message: 'Không tìm thấy mã buổi cần sửa.' };
      }
    }

    let maBuoi = maBuoiInput;
    if (!maBuoi) {
      const stamp = Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMddHHmmss');
      maBuoi = 'CT' + stamp + Math.floor(100 + Math.random() * 900);
      rowNumber = sheet.getLastRow() + 1;
    }

    const values = [[
      maBuoi,
      new Date(ngayText + 'T00:00:00'),
      new Date('1899-12-30T' + gioText + ':00'),
      tenBuoi,
      String(payload.diaDiem || '').trim(),
      moDangKy ? new Date('1899-12-30T' + moDangKy + ':00') : '',
      dongDangKy ? new Date('1899-12-30T' + dongDangKy + ':00') : '',
      gioiHan,
      String(payload.doiTuong || '').trim(),
      String(payload.ghiChu || '').trim()
    ]];

    sheet.getRange(rowNumber, 1, 1, 10).setValues(values);
    sheet.getRange(rowNumber, 2).setNumberFormat('dd/MM/yyyy');
    sheet.getRange(rowNumber, 3).setNumberFormat('HH:mm');
    sheet.getRange(rowNumber, 6, 1, 2).setNumberFormat('HH:mm');

    // Chỉ thay đổi chế độ thủ công khi payload có gửi lên.
    // Chương trình cũ không có chế độ -> giữ AUTO mặc định.
    const requestedMode = String(payload.cheDoDangKy || '').trim().toUpperCase();
    if (requestedMode === 'AUTO' || requestedMode === 'OPEN' || requestedMode === 'CLOSED') {
      setRegistrationMode_(password, maBuoi, requestedMode);
    }

    return {
      success: true,
      message: maBuoiInput ? 'Đã cập nhật chương trình.' : 'Đã tạo chương trình mới.',
      maBuoi: maBuoi,
      cheDoDangKy: getRegistrationMode_(maBuoi)
    };
  } finally {
    lock.releaseLock();
  }
}

function adminGetProgram_(password, maBuoi) {
  const auth = verifyAdminPassword(password);
  if (!auth.success) return auth;

  const code = String(maBuoi || '').trim();
  if (!code) return { success: false, message: 'Thiếu mã buổi.' };

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_BUOI);
  if (!sheet) throw new Error('Không tìm thấy sheet BUOI.');

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').trim() !== code) continue;

    const dateValue = data[i][1];
    const timeValue = data[i][2];
    const openValue = data[i][5];
    const closeValue = data[i][6];

    return {
      success: true,
      program: {
        maBuoi: code,
        ngay: dateValue instanceof Date ? Utilities.formatDate(dateValue, TIMEZONE, 'yyyy-MM-dd') : String(dateValue || ''),
        gio: timeValue instanceof Date ? Utilities.formatDate(timeValue, TIMEZONE, 'HH:mm') : String(timeValue || ''),
        tenBuoi: String(data[i][3] || ''),
        diaDiem: String(data[i][4] || ''),
        moDangKy: openValue instanceof Date ? Utilities.formatDate(openValue, TIMEZONE, 'HH:mm') : String(openValue || ''),
        dongDangKy: closeValue instanceof Date ? Utilities.formatDate(closeValue, TIMEZONE, 'HH:mm') : String(closeValue || ''),
        gioiHan: String(data[i][7] || ''),
        doiTuong: String(data[i][8] || ''),
        ghiChu: String(data[i][9] || ''),
        cheDoDangKy: getRegistrationMode_(code)
      }
    };
  }

  return { success: false, type: 'NOT_FOUND', message: 'Không tìm thấy chương trình.' };
}

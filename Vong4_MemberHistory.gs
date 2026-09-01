/* ============================================================
 * VÒNG 4 — LỊCH SỬ THAM GIA / ĐIỂM DANH CỦA CA VIÊN
 *
 * Chỉ đọc dữ liệu từ Diem_Danh + BUOI.
 * Không sửa dữ liệu cũ, không thay đổi logic check-in.
 * ============================================================ */

function registrationMemberHistory_(token) {
  const member = getMemberFromRegistrationToken_(token);

  if (!member) {
    return {
      success: false,
      type: 'SESSION_EXPIRED',
      message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const attendanceSheet = ss.getSheetByName(SHEET_DIEM_DANH);
  const programSheet = ss.getSheetByName(SHEET_BUOI);

  if (!attendanceSheet || !programSheet) {
    throw new Error('Không tìm thấy sheet Diem_Danh hoặc BUOI.');
  }

  // Đọc BUOI một lần để tránh mở/đọc Sheet lặp lại cho từng bản ghi.
  const programData = programSheet.getDataRange().getValues();
  const programs = {};

  for (let i = 1; i < programData.length; i++) {
    const row = programData[i];
    const code = String(row[0] || '').trim();
    if (!code) continue;

    programs[code] = {
      maBuoi: code,
      ngay: row[1],
      gio: row[2],
      tenBuoi: String(row[3] || '').trim(),
      diaDiem: String(row[4] || '').trim()
    };
  }

  const data = attendanceSheet.getDataRange().getDisplayValues();
  const code = normalizeMemberCode_(member.ma);
  const rows = [];

  // Diem_Danh hiện tại:
  // A thời gian | B mã ca viên | C họ tên | D bè | E phương thức | F mã buổi
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const memberCode = normalizeMemberCode_(row[1]);
    const maBuoi = String(row[5] || '').trim();

    if (memberCode !== code || !maBuoi) continue;

    const program = programs[maBuoi];
    if (!program) continue;

    rows.push({
      maBuoi: maBuoi,
      tenBuoi: program.tenBuoi,
      ngay: program.ngay ? Utilities.formatDate(new Date(program.ngay), TIMEZONE, 'dd/MM/yyyy') : '',
      gio: program.gio ? formatSessionTime_(program.ngay, program.gio) : '',
      diaDiem: program.diaDiem,
      thoiGianDiemDanh: String(row[0] || '').trim(),
      phuongThucDiemDanh: String(row[4] || '').trim(),
      daDiemDanh: true
    });
  }

  // Mới nhất lên trước.
  rows.reverse();

  return {
    success: true,
    ma: code,
    hoTen: member.hoTen,
    total: rows.length,
    rows: rows
  };
}

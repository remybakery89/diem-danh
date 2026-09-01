/* ============================================================
 * VÒNG 4 — HỒ SƠ CA VIÊN
 *
 * Chỉ đọc hồ sơ của chính ca viên đang đăng nhập.
 * Không ghi/sửa dữ liệu Trang tính1.
 *
 * Trang tính1 hiện giữ nguyên A-H:
 * A mã | B họ tên | C sđt | D bè | E trạng thái |
 * F 4 số cuối | G mã quét | H Giới tính
 *
 * Các trường Vòng 4 đọc theo TÊN TIÊU ĐỀ, không khóa cứng
 * vị trí cột:
 * Ngày sinh | Ngày bổn mạng | Giáo xứ hiện tại |
 * Ngày tham gia ca đoàn | Vai trò | Avatar
 * ============================================================ */

function registrationMemberProfile_(token) {
  const memberCode = getMemberFromRegistrationToken_(token);

  if (!memberCode) {
    return {
      success: false,
      type: 'SESSION_EXPIRED',
      message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_CA_VIEN);

  if (!sheet) {
    throw new Error('Không tìm thấy sheet ca viên.');
  }

  const data = sheet.getDataRange().getDisplayValues();
  if (data.length < 2) {
    return {
      success: false,
      type: 'MEMBER_NOT_FOUND',
      message: 'Không tìm thấy ca viên.'
    };
  }

  const headers = data[0].map(function(value) {
    return String(value || '').trim().toLowerCase();
  });

  const headerIndex = {};
  headers.forEach(function(header, index) {
    if (header) headerIndex[header] = index;
  });

  let row = null;
  for (let i = 1; i < data.length; i++) {
    const code = String(data[i][0] || '').trim().toUpperCase();
    if (code === String(memberCode).trim().toUpperCase()) {
      row = data[i];
      break;
    }
  }

  if (!row) {
    return {
      success: false,
      type: 'MEMBER_NOT_FOUND',
      message: 'Không tìm thấy ca viên.'
    };
  }

  function readHeader() {
    const names = Array.prototype.slice.call(arguments);
    for (let i = 0; i < names.length; i++) {
      const index = headerIndex[String(names[i]).toLowerCase()];
      if (index !== undefined) return String(row[index] || '').trim();
    }
    return '';
  }

  return {
    success: true,
    member: {
      ma: String(row[0] || '').trim(),
      hoTen: String(row[1] || '').trim(),
      sdt: String(row[2] || '').trim(),
      be: String(row[3] || '').trim(),
      gioiTinh: String(row[7] || '').trim(),
      ngaySinh: readHeader('ngày sinh', 'ngay sinh'),
      ngayBonMang: readHeader('ngày bổn mạng', 'ngay bon mang', 'bổn mạng', 'bon mang'),
      giaoXu: readHeader('giáo xứ hiện tại', 'giao xu hien tai', 'giáo xứ', 'giao xu'),
      ngayThamGia: readHeader('ngày tham gia ca đoàn', 'ngay tham gia ca doan', 'ngày tham gia', 'ngay tham gia'),
      vaiTro: readHeader('vai trò', 'vai tro') || 'Ca viên',
      avatar: readHeader('avatar', 'ảnh avatar', 'anh avatar')
    }
  };
}

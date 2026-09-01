/* ============================================================
 * VÒNG 4 — HỒ SƠ CA VIÊN
 *
 * Chỉ đọc hồ sơ của chính ca viên đang đăng nhập.
 * Không ghi/sửa dữ liệu Trang tính1.
 * ============================================================ */

function registrationMemberProfile_(token) {
  // Hàm này trả về object member, không phải chuỗi mã.
  const member = getMemberFromRegistrationToken_(token);

  if (!member || !member.ma) {
    return {
      success: false,
      type: 'SESSION_EXPIRED',
      message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    };
  }

  const code = String(member.ma).trim().toUpperCase();
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

  // Đọc tên cột để các trường I trở đi không phụ thuộc cứng vào vị trí.
  const headers = data[0].map(function(value) {
    return String(value || '').trim().toLowerCase();
  });

  const headerIndex = {};
  headers.forEach(function(header, index) {
    if (header) headerIndex[header] = index;
  });

  let row = null;

  for (let i = 1; i < data.length; i++) {
    const rowCode = String(data[i][0] || '').trim().toUpperCase();
    const status = String(data[i][4] || '').trim().toLowerCase();

    if (rowCode === code && status === 'active') {
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
      if (index !== undefined) {
        return String(row[index] || '').trim();
      }
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
      ngayBonMang: readHeader(
        'ngày bổn mạng',
        'ngay bon mang',
        'bổn mạng',
        'bon mang'
      ),
      giaoXu: readHeader(
        'giáo xứ hiện tại',
        'giao xu hien tai',
        'giáo xứ',
        'giao xu'
      ),
      ngayThamGia: readHeader(
        'ngày tham gia ca đoàn',
        'ngay tham gia ca doan',
        'ngày tham gia',
        'ngay tham gia'
      ),
      vaiTro: readHeader('vai trò', 'vai tro') || 'Ca viên',
      avatar: readHeader('avatar', 'ảnh avatar', 'anh avatar')
    }
  };
}

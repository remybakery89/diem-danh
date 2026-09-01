/* ============================================================
 * VÒNG 4 — HỒ SƠ CA VIÊN
 *
 * API đọc hồ sơ ca viên từ Members/nguồn dữ liệu hiện tại.
 * Chỉ đọc dữ liệu; không thay đổi hồ sơ gốc.
 * Avatar sẽ bổ sung ở bước tiếp theo.
 * ============================================================ */

function registrationMemberProfile_(password, ma) {
  const auth = verifyMemberLogin_(password, ma);
  if (!auth.success) return auth;

  const memberId = String(ma || '').trim().toUpperCase();
  if (!memberId) {
    return { success: false, type: 'INVALID_INPUT', message: 'Thiếu mã ca viên.' };
  }

  const member = getMemberByCode_(memberId);
  if (!member) {
    return { success: false, type: 'MEMBER_NOT_FOUND', message: 'Không tìm thấy ca viên.' };
  }

  return {
    success: true,
    member: {
      ma: member.ma || memberId,
      hoTen: member.hoTen || '',
      ngaySinh: member.ngaySinh || '',
      ngayBonMang: member.ngayBonMang || '',
      soDienThoai: member.soDienThoai || member.sdt || '',
      giaoXu: member.giaoXu || member.giaoXuHienTai || '',
      ngayThamGia: member.ngayThamGia || member.ngayThamGiaCaDoan || '',
      be: member.be || '',
      vaiTro: member.vaiTro || 'Ca viên',
      avatar: member.avatar || ''
    }
  };
}

/* ============================================================
 * VÒNG 5C — XUẤT DANH SÁCH THANH TOÁN
 * Không xuất ảnh giao dịch.
 * ============================================================ */

function v5cExportPaymentList_(password, maBuoi, filter) {
  const auth = verifyAdminPassword(password);
  if (!auth.success) return auth;
  maBuoi = String(maBuoi || '').trim();
  filter = String(filter || 'ALL').trim().toUpperCase();
  if (!maBuoi) return { success:false, type:'INVALID_INPUT', message:'Thiếu mã chương trình.' };
  if (v5cIsPaymentRequired_(maBuoi) !== 'CÓ') return { success:false, type:'PAYMENT_NOT_REQUIRED', message:'Chương trình này không yêu cầu thanh toán.' };
  if (['ALL','CHƯA NỘP','ĐÃ GỬI','ĐÃ XÁC NHẬN'].indexOf(filter) < 0) filter = 'ALL';

  v5cEnsurePaymentStructure_();
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_DANG_KY);
  const rows = sh.getDataRange().getDisplayValues();
  const out = [];
  for (let i=1;i<rows.length;i++) {
    if (String(rows[i][1]||'').trim() !== maBuoi) continue;
    const payment = v5cPaymentData_(rows[i]);
    const status = payment.trangThaiThanhToan || 'CHƯA NỘP';
    if (filter !== 'ALL' && status !== filter) continue;
    out.push([String(rows[i][2]||'').trim(),String(rows[i][3]||'').trim(),String(rows[i][4]||'').trim(),String(rows[i][8]||'').trim(),status,payment.soTienXacNhan,payment.thoiGianXacNhan,payment.nguoiXacNhan]);
  }
  const info = v5cProgramInfo_(maBuoi);
  return {success:true,maBuoi:maBuoi,tenBuoi:info.tenBuoi,rows:out,headers:['Mã ca viên','Họ tên','Bè','Trạng thái đăng ký','Trạng thái thanh toán','Số tiền xác nhận','Thời gian xác nhận','Người xác nhận']};
}

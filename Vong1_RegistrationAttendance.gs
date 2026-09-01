/* ============================================================
 * VÒNG 1 — LIÊN KẾT ĐĂNG KÝ ↔ ĐIỂM DANH
 *
 * Không thay đổi logic checkIn / VANG hiện tại.
 * ============================================================ */

function getAdminRegistrationAttendance_(password, maBuoi) {
  const auth = verifyAdminPassword(password);
  if (!auth.success) return auth;
  maBuoi = String(maBuoi || '').trim();
  if (!maBuoi) return { success:false, type:'INVALID_INPUT', message:'Thiếu mã buổi.' };

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const buoiSheet = ss.getSheetByName(SHEET_BUOI);
  const diemDanhSheet = ss.getSheetByName(SHEET_DIEM_DANH);
  if (!buoiSheet || !diemDanhSheet) throw new Error('Không tìm thấy sheet BUOI hoặc Diem_Danh.');

  const program = getProgramByCode_(maBuoi);
  if (!program) return { success:false, type:'PROGRAM_NOT_FOUND', message:'Không tìm thấy chương trình: ' + maBuoi };

  const registrations = getRegistrationRows_(getOrCreateDangKySheet_()).filter(function(row){ return row.maBuoi === maBuoi; });
  const attendanceData = diemDanhSheet.getDataRange().getDisplayValues();
  const attendanceMap = {};
  for (let i=1;i<attendanceData.length;i++) {
    const row=attendanceData[i], ma=String(row[1]||'').trim().toUpperCase(), code=String(row[5]||'').trim();
    if (ma && code===maBuoi && !attendanceMap[ma]) attendanceMap[ma]={thoiGian:String(row[0]||'').trim(),phuongThuc:String(row[4]||'').trim()};
  }

  const rows=registrations.map(function(reg){
    const attendance=attendanceMap[reg.ma]||null;
    return {maDangKy:reg.maDangKy,maBuoi:reg.maBuoi,ma:reg.ma,hoTen:reg.hoTen,be:reg.be,thoiGianDangKy:reg.thoiGian,trangThaiDangKy:reg.trangThai,thoiGianDiemDanh:attendance?attendance.thoiGian:'',phuongThucDiemDanh:attendance?attendance.phuongThuc:'',daDiemDanh:!!attendance};
  });

  let daDangKy=0,daHuy=0,daDiemDanh=0,chuaDiemDanh=0;
  rows.forEach(function(row){
    if(row.trangThaiDangKy==='ĐÃ ĐĂNG KÝ'){daDangKy++;if(row.daDiemDanh)daDiemDanh++;else chuaDiemDanh++;}
    else if(row.trangThaiDangKy==='ĐÃ HỦY')daHuy++;
  });

  return {success:true,program:{maBuoi:program.maBuoi,tenBuoi:program.tenBuoi,ngay:Utilities.formatDate(new Date(program.ngay),TIMEZONE,'dd/MM/yyyy'),gio:program.gio?formatSessionTime_(program.ngay,program.gio):'',diaDiem:program.diaDiem||'',trangThai:getRegistrationProgramStatus_(program)},stats:{daDangKy:daDangKy,daHuy:daHuy,daDiemDanh:daDiemDanh,chuaDiemDanh:chuaDiemDanh},rows:rows};
}

function getRegistrationProgramStatus_(program) {
  const now=new Date();
  if(program.eventAt && now.getTime()>program.eventAt.getTime()) return 'ĐÃ KẾT THÚC';
  if(program.cheDoDangKy==='CLOSED') return 'ĐÃ ĐÓNG';
  if(program.moDangKy && now.getTime()<program.moDangKy.getTime()) return 'CHƯA MỞ';
  return 'ĐANG MỞ';
}

/* ============================================================
 * VÒNG 5 — QUY TRÌNH ĐĂNG KÝ
 *
 * Mục tiêu:
 * - Trạng thái chính: ĐI / KHÔNG ĐI / DỰ BỊ / CHỜ DUYỆT / ĐÃ HỦY
 * - Một dòng duy nhất cho mỗi mã buổi + mã ca viên.
 * - Đăng ký lần đầu trước hạn chót: trạng thái được xác nhận ngay.
 * - Đăng ký sau hạn chót: CHỜ DUYỆT + bắt buộc lý do.
 * - Mọi thay đổi trạng thái sau lần xác nhận đầu tiên: CHỜ DUYỆT
 *   + bắt buộc lý do + lưu lịch sử.
 * - Admin duyệt yêu cầu thành ĐI / KHÔNG ĐI / DỰ BỊ.
 * - Không xóa dữ liệu lịch sử thay đổi.
 *
 * Tương thích DANG_KY 8 cột hiện tại; các cột V5 được thêm từ I.
 * ============================================================ */

const V5_REGISTRATION_HEADERS = [
  'trạng thái hiện tại',
  'trạng thái yêu cầu',
  'lý do',
  'thời gian cập nhật',
  'người duyệt',
  'thời gian duyệt',
  'lịch sử thay đổi'
];

const V5_ALLOWED_STATUS = ['ĐI', 'KHÔNG ĐI', 'DỰ BỊ'];
const V5_PENDING_STATUS = 'CHỜ DUYỆT';
const V5_CANCELLED_STATUS = 'ĐÃ HỦY';

function v5EnsureRegistrationStructure_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_DANG_KY);
  if (!sheet) throw new Error('Không tìm thấy sheet DANG_KY.');

  const requiredLastColumn = 8 + V5_REGISTRATION_HEADERS.length;
  if (sheet.getMaxColumns() < requiredLastColumn) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), requiredLastColumn - sheet.getMaxColumns());
  }

  const headers = sheet.getRange(1, 1, 1, requiredLastColumn).getDisplayValues()[0];
  for (let i = 0; i < V5_REGISTRATION_HEADERS.length; i++) {
    const col = 9 + i;
    const expected = V5_REGISTRATION_HEADERS[i];
    if (String(headers[col - 1] || '').trim() !== expected) {
      sheet.getRange(1, col).setValue(expected);
    }
  }
  sheet.setFrozenRows(1);

  // Nâng dữ liệu cũ sang mô hình V5 mà không thay đổi 8 cột gốc.
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const rows = sheet.getRange(2, 1, lastRow - 1, requiredLastColumn).getDisplayValues();
    const statusValues = [];
    const updateValues = [];

    rows.forEach(function(row) {
      const oldStatus = String(row[6] || '').trim().toUpperCase();
      let current = String(row[8] || '').trim().toUpperCase();
      const updated = String(row[11] || '').trim();

      if (!current) {
        if (oldStatus === 'ĐÃ ĐĂNG KÝ') current = 'ĐI';
        else if (oldStatus === 'ĐÃ HỦY') current = V5_CANCELLED_STATUS;
      }

      statusValues.push([current]);
      updateValues.push([updated]);
    });

    sheet.getRange(2, 9, statusValues.length, 1).setValues(statusValues);
    sheet.getRange(2, 12, updateValues.length, 1).setValues(updateValues);
  }

  return { success: true, columns: V5_REGISTRATION_HEADERS.slice() };
}

function v5GetRegistrationContext_(maBuoi, ma) {
  const sheet = getOrCreateDangKySheet_();
  v5EnsureRegistrationStructure_();
  const rows = sheet.getDataRange().getDisplayValues();
  const targetMaBuoi = String(maBuoi || '').trim();
  const targetMa = normalizeMemberCode_(ma);

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][1] || '').trim() === targetMaBuoi &&
        normalizeMemberCode_(rows[i][2]) === targetMa) {
      return {
        sheet: sheet,
        rowNumber: i + 1,
        row: rows[i],
        currentStatus: String(rows[i][8] || '').trim().toUpperCase(),
        requestedStatus: String(rows[i][9] || '').trim().toUpperCase(),
        reason: String(rows[i][10] || '').trim(),
        historyRaw: String(rows[i][14] || '').trim()
      };
    }
  }

  return { sheet: sheet, rowNumber: 0, row: null, currentStatus: '', requestedStatus: '', reason: '', historyRaw: '' };
}

function v5ParseHistory_(raw) {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch (e) {
    return [];
  }
}

function v5AppendHistory_(ctx, entry) {
  const history = v5ParseHistory_(ctx.historyRaw);
  history.push(entry);
  ctx.sheet.getRange(ctx.rowNumber, 15).setValue(JSON.stringify(history));
}

function v5IsPastDeadline_(program, now) {
  return !!(program && program.hanChot && now.getTime() > program.hanChot.getTime());
}

function v5CanSubmit_(program, now) {
  if (!program) return false;
  now = now || new Date();
  if (program.eventAt && now.getTime() > program.eventAt.getTime()) return false;
  if (program.cheDoDangKy === 'CLOSED') return false;
  if (program.moDangKy && now.getTime() < program.moDangKy.getTime()) return false;
  return true;
}

function v5SubmitRegistration_(token, maBuoi, requestedStatus, reason) {
  const member = getMemberFromRegistrationToken_(token);
  if (!member) return { success:false, type:'SESSION_EXPIRED', message:'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' };

  const ma = normalizeMemberCode_(member.ma);
  maBuoi = String(maBuoi || '').trim();
  requestedStatus = String(requestedStatus || '').trim().toUpperCase();
  reason = String(reason || '').trim();

  if (!maBuoi || V5_ALLOWED_STATUS.indexOf(requestedStatus) < 0) {
    return { success:false, type:'INVALID_INPUT', message:'Vui lòng chọn ĐI, KHÔNG ĐI hoặc DỰ BỊ.' };
  }

  const program = getProgramByCode_(maBuoi);
  if (!program) return { success:false, type:'PROGRAM_NOT_FOUND', message:'Không tìm thấy chương trình.' };
  if (!v5CanSubmit_(program)) return { success:false, type:'REGISTRATION_CLOSED', message:'Chương trình hiện không nhận đăng ký/thay đổi.' };
  if (!memberMatchesAudience_(member, program.doiTuong)) return { success:false, type:'NOT_ELIGIBLE', message:'Bạn không thuộc đối tượng được đăng ký chương trình này.' };

  const now = new Date();
  const nowString = Utilities.formatDate(now, TIMEZONE, 'dd/MM/yyyy HH:mm:ss');
  const ctx = v5GetRegistrationContext_(maBuoi, ma);
  const isFirst = !ctx.rowNumber;
  const pastDeadline = v5IsPastDeadline_(program, now);

  if (isFirst && pastDeadline && !reason) {
    return { success:false, type:'REASON_REQUIRED', message:'Đăng ký sau hạn chót, vui lòng nhập lý do.' };
  }

  if (!isFirst && ctx.currentStatus !== V5_CANCELLED_STATUS && ctx.currentStatus !== '' && ctx.currentStatus !== requestedStatus) {
    if (!reason) return { success:false, type:'REASON_REQUIRED', message:'Thay đổi đăng ký cần có lý do.' };
  }

  let currentStatus;
  let pending = false;
  if (isFirst) {
    currentStatus = pastDeadline ? V5_PENDING_STATUS : requestedStatus;
    pending = pastDeadline;
  } else if (ctx.currentStatus === V5_CANCELLED_STATUS || !ctx.currentStatus) {
    currentStatus = pastDeadline ? V5_PENDING_STATUS : requestedStatus;
    pending = pastDeadline;
  } else if (ctx.currentStatus === requestedStatus) {
    return { success:false, type:'NO_CHANGE', message:'Trạng thái hiện tại đã là ' + requestedStatus + '.' };
  } else {
    currentStatus = V5_PENDING_STATUS;
    pending = true;
  }

  const historyEntry = {
    thoiGian: nowString,
    loai: isFirst ? 'ĐĂNG KÝ' : 'THAY ĐỔI',
    trangThaiCu: isFirst ? '' : ctx.currentStatus,
    trangThaiYeuCau: requestedStatus,
    trangThaiMoi: currentStatus,
    lyDo: reason,
    nguoi: 'CA VIÊN'
  };

  if (isFirst || ctx.currentStatus === V5_CANCELLED_STATUS || !ctx.currentStatus) {
    const maDangKy = 'DK' + Utilities.getUuid().replace(/-/g, '').substring(0, 10).toUpperCase();
    ctx.sheet.appendRow([maDangKy, maBuoi, ma, member.hoTen, member.be, nowString, 'ĐÃ ĐĂNG KÝ', reason]);
    const newRow = ctx.sheet.getLastRow();
    ctx.sheet.getRange(newRow, 9, 1, 7).setValues([[
      currentStatus,
      pending ? requestedStatus : '',
      reason,
      nowString,
      '',
      '',
      JSON.stringify([historyEntry])
    ]]);

    return {
      success:true,
      type: pending ? 'PENDING' : 'REGISTERED',
      message: pending ? 'Đăng ký đã gửi và đang chờ Admin duyệt.' : 'Đăng ký thành công.',
      maDangKy: maDangKy,
      maBuoi: maBuoi,
      ma: ma,
      hoTen: member.hoTen,
      be: member.be,
      thoiGian: nowString,
      trangThai: currentStatus,
      trangThaiYeuCau: pending ? requestedStatus : ''
    };
  }

  ctx.sheet.getRange(ctx.rowNumber, 9, 1, 6).setValues([[
    currentStatus,
    requestedStatus,
    reason,
    nowString,
    '',
    ''
  ]]);
  v5AppendHistory_(ctx, historyEntry);

  return {
    success:true,
    type:'CHANGE_PENDING',
    message:'Yêu cầu thay đổi đã gửi và đang chờ Admin duyệt.',
    maBuoi:maBuoi,
    ma:ma,
    trangThai:currentStatus,
    trangThaiYeuCau:requestedStatus
  };
}

function v5CancelRegistration_(token, maBuoi, reason) {
  const member = getMemberFromRegistrationToken_(token);
  if (!member) return { success:false, type:'SESSION_EXPIRED', message:'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' };

  maBuoi = String(maBuoi || '').trim();
  reason = String(reason || '').trim();
  const program = getProgramByCode_(maBuoi);
  if (!program) return { success:false, type:'PROGRAM_NOT_FOUND', message:'Không tìm thấy chương trình.' };
  if (!v5CanSubmit_(program)) return { success:false, type:'REGISTRATION_CLOSED', message:'Chương trình đã đóng, không thể hủy.' };

  const ctx = v5GetRegistrationContext_(maBuoi, member.ma);
  if (!ctx.rowNumber || ctx.currentStatus === V5_CANCELLED_STATUS) return { success:false, type:'NOT_REGISTERED', message:'Bạn chưa có đăng ký đang hoạt động.' };

  const nowString = Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm:ss');
  const historyEntry = {
    thoiGian: nowString,
    loai: 'HỦY',
    trangThaiCu: ctx.currentStatus,
    trangThaiYeuCau: V5_CANCELLED_STATUS,
    trangThaiMoi: V5_CANCELLED_STATUS,
    lyDo: reason,
    nguoi: 'CA VIÊN'
  };

  ctx.sheet.getRange(ctx.rowNumber, 7).setValue('ĐÃ HỦY');
  ctx.sheet.getRange(ctx.rowNumber, 9, 1, 6).setValues([[V5_CANCELLED_STATUS, '', reason, nowString, '', '']]);
  v5AppendHistory_(ctx, historyEntry);

  return { success:true, type:'CANCELLED', message:'Đã hủy đăng ký.', maBuoi:maBuoi, ma:normalizeMemberCode_(member.ma) };
}

function v5GetMyRegistrations_(token) {
  const member = getMemberFromRegistrationToken_(token);
  if (!member) return { success:false, type:'SESSION_EXPIRED', message:'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' };

  v5EnsureRegistrationStructure_();
  const sheet = getOrCreateDangKySheet_();
  const rows = sheet.getDataRange().getDisplayValues();
  const result = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (normalizeMemberCode_(row[2]) !== normalizeMemberCode_(member.ma)) continue;
    const maBuoi = String(row[1] || '').trim();
    const program = getProgramByCode_(maBuoi);
    if (!program) continue;

    result.push({
      rowNumber: i + 1,
      maDangKy: String(row[0] || '').trim(),
      maBuoi: maBuoi,
      ma: normalizeMemberCode_(row[2]),
      hoTen: String(row[3] || '').trim(),
      be: String(row[4] || '').trim(),
      thoiGian: String(row[5] || '').trim(),
      trangThaiCu: String(row[6] || '').trim(),
      trangThai: String(row[8] || '').trim() || (String(row[6] || '').trim() === 'ĐÃ ĐĂNG KÝ' ? 'ĐI' : 'ĐÃ HỦY'),
      trangThaiYeuCau: String(row[9] || '').trim(),
      lyDo: String(row[10] || '').trim(),
      thoiGianCapNhat: String(row[11] || '').trim(),
      ngay: Utilities.formatDate(new Date(program.ngay), TIMEZONE, 'dd/MM/yyyy'),
      gio: program.gio ? formatSessionTime_(program.ngay, program.gio) : '',
      tenBuoi: program.tenBuoi,
      diaDiem: program.diaDiem || '',
      hanChot: program.hanChot ? Utilities.formatDate(program.hanChot, TIMEZONE, 'dd/MM/yyyy HH:mm') : '',
      lichSu: v5ParseHistory_(String(row[14] || '').trim())
    });
  }

  return { success:true, ma:member.ma, hoTen:member.hoTen, be:member.be, registrations:result };
}

function v5GetAdminRegistrations_(password, maBuoi) {
  const auth = verifyAdminPassword(password);
  if (!auth.success) return auth;
  v5EnsureRegistrationStructure_();

  const sheet = getOrCreateDangKySheet_();
  const rows = sheet.getDataRange().getDisplayValues();
  const result = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (maBuoi && String(row[1] || '').trim() !== String(maBuoi).trim()) continue;
    result.push({
      rowNumber:i+1,
      maDangKy:String(row[0]||'').trim(),
      maBuoi:String(row[1]||'').trim(),
      ma:normalizeMemberCode_(row[2]),
      hoTen:String(row[3]||'').trim(),
      be:String(row[4]||'').trim(),
      thoiGian:String(row[5]||'').trim(),
      trangThaiCu:String(row[6]||'').trim(),
      trangThai:String(row[8]||'').trim() || (String(row[6]||'').trim()==='ĐÃ ĐĂNG KÝ'?'ĐI':'ĐÃ HỦY'),
      trangThaiYeuCau:String(row[9]||'').trim(),
      lyDo:String(row[10]||'').trim(),
      thoiGianCapNhat:String(row[11]||'').trim(),
      nguoiDuyet:String(row[12]||'').trim(),
      thoiGianDuyet:String(row[13]||'').trim(),
      lichSu:v5ParseHistory_(String(row[14]||'').trim())
    });
  }

  const stats = { di:0, khongDi:0, duBi:0, choDuyet:0, daHuy:0 };
  result.forEach(function(row){
    if(row.trangThai==='ĐI')stats.di++;
    else if(row.trangThai==='KHÔNG ĐI')stats.khongDi++;
    else if(row.trangThai==='DỰ BỊ')stats.duBi++;
    else if(row.trangThai==='CHỜ DUYỆT')stats.choDuyet++;
    else if(row.trangThai==='ĐÃ HỦY')stats.daHuy++;
  });

  return { success:true, rows:result, stats:stats };
}

function v5ApproveRegistration_(password, maDangKy, approvedStatus) {
  const auth = verifyAdminPassword(password);
  if (!auth.success) return auth;

  approvedStatus = String(approvedStatus || '').trim().toUpperCase();
  if (V5_ALLOWED_STATUS.indexOf(approvedStatus) < 0) return { success:false, type:'INVALID_STATUS', message:'Trạng thái duyệt không hợp lệ.' };

  v5EnsureRegistrationStructure_();
  const sheet = getOrCreateDangKySheet_();
  const rows = sheet.getDataRange().getDisplayValues();
  const target = String(maDangKy || '').trim();

  for (let i=1;i<rows.length;i++) {
    if (String(rows[i][0]||'').trim() !== target) continue;
    const current = String(rows[i][8]||'').trim().toUpperCase();
    const requested = String(rows[i][9]||'').trim().toUpperCase();
    if (current !== V5_PENDING_STATUS || V5_ALLOWED_STATUS.indexOf(requested)<0) {
      return { success:false, type:'NOT_PENDING', message:'Đăng ký này không có yêu cầu chờ duyệt.' };
    }

    const now = new Date();
    const nowString = Utilities.formatDate(now, TIMEZONE, 'dd/MM/yyyy HH:mm:ss');
    const oldReason = String(rows[i][10]||'').trim();
    const history = v5ParseHistory_(String(rows[i][14]||'').trim());
    history.push({
      thoiGian:nowString,
      loai:'ADMIN DUYỆT',
      trangThaiCu:V5_PENDING_STATUS,
      trangThaiYeuCau:requested,
      trangThaiMoi:approvedStatus,
      lyDo:oldReason,
      nguoi:'ADMIN'
    });

    sheet.getRange(i+1, 9, 1, 7).setValues([[
      approvedStatus,
      '',
      '',
      nowString,
      'ADMIN',
      nowString,
      JSON.stringify(history)
    ]]);
    return { success:true, type:'APPROVED', message:'Đã duyệt thành ' + approvedStatus + '.', maDangKy:target, trangThai:approvedStatus };
  }

  return { success:false, type:'NOT_FOUND', message:'Không tìm thấy mã đăng ký.' };
}

function v5SetupRegistrationWorkflow() {
  return v5EnsureRegistrationStructure_();
}

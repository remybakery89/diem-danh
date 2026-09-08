/* ============================================================
 * VÒNG 6A — LIÊN KẾT ĐĂNG KÝ ↔ ĐIỂM DANH
 *
 * Không thay đổi checkIn() hiện tại.
 * API V6 gọi v6CheckIn(), còn các luồng cũ vẫn có thể dùng checkIn().
 *
 * Quy tắc:
 * - QR vẫn là SCxxxxx.
 * - Xác định buổi hiện tại từ BUOI.
 * - Với buổi đã có luồng đăng ký V5: chỉ trạng thái ĐI mới được điểm danh.
 * - DỰ BỊ / KHÔNG ĐI / CHỜ DUYỆT / ĐÃ HỦY / chưa đăng ký: từ chối.
 * - Nếu buổi chưa có bất kỳ đăng ký nào, giữ fallback legacy để không phá
 *   cơ chế điểm danh hiện tại. Tập hát luôn giữ cơ chế cũ.
 * - Chống trùng được kiểm tra trực tiếp trên Diem_Danh trong cùng Lock.
 * ============================================================ */

const V6_STATUS_ALLOWED = 'ĐI';
const V6_LEGACY_TAP_HAT = true;

function v6CheckIn(identifier, method) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const code = normalizeMemberCode_(identifier);
    const checkinMethod = method || 'QR';

    if (!/^SC\d+$/i.test(code)) {
      return {
        success: false,
        type: 'INVALID_CODE',
        message: 'Mã QR / mã cá nhân không hợp lệ.'
      };
    }

    const member = getCachedActiveMemberByCode_(code);
    if (!member) {
      return {
        success: false,
        type: 'NOT_FOUND',
        message: 'Không tìm thấy ca viên với mã: ' + code
      };
    }

    const program = getCachedCurrentBuoi_();
    if (!program) {
      return {
        success: false,
        type: 'NO_SESSION',
        message: 'Hôm nay không có buổi điểm danh.'
      };
    }

    const registration = v6GetRegistrationStatus_(program.maBuoi, code, program.tenBuoi);

    if (!registration.allowed) {
      return {
        success: false,
        type: registration.type,
        message: registration.message,
        ma: code,
        hoTen: member.hoTen,
        be: member.be,
        maBuoi: program.maBuoi,
        tenBuoi: program.tenBuoi,
        trangThaiDangKy: registration.status || ''
      };
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_DIEM_DANH);

    if (!sheet) {
      throw new Error('Không tìm thấy sheet Diem_Danh.');
    }

    // V6 kiểm tra trực tiếp trên Sheet thay vì chỉ dựa vào cache.
    // Lock đang giữ nên hai máy quét cùng lúc không thể cùng ghi một người.
    const data = sheet.getDataRange().getDisplayValues();
    let existing = null;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowMa = normalizeMemberCode_(row[1]);
      const rowMaBuoi = String(row[5] || '').trim();

      if (rowMa === code && rowMaBuoi === String(program.maBuoi).trim()) {
        existing = {
          thoiGian: String(row[0] || '').trim(),
          phuongThuc: String(row[4] || '').trim()
        };
        break;
      }
    }

    if (existing) {
      return {
        success: false,
        type: 'DUPLICATE',
        message: member.hoTen + ' đã điểm danh rồi.',
        ma: code,
        hoTen: member.hoTen,
        be: member.be,
        maBuoi: program.maBuoi,
        tenBuoi: program.tenBuoi,
        thoiGianCu: existing.thoiGian,
        phuongThucCu: existing.phuongThuc,
        trangThaiDangKy: registration.status
      };
    }

    const now = new Date();
    const timeString = Utilities.formatDate(
      now,
      TIMEZONE,
      'dd/MM/yyyy HH:mm:ss'
    );

    sheet.appendRow([
      timeString,
      member.ma,
      member.hoTen,
      member.be,
      checkinMethod,
      program.maBuoi
    ]);

    // Đồng bộ cache hiện tại để các máy khác thấy kết quả nhanh hơn.
    const attendanceMap = getCachedAttendanceMap_(program.maBuoi);
    attendanceMap[member.ma] = {
      thoiGian: timeString,
      phuongThuc: checkinMethod
    };
    putCheckinCache_(
      getAttendanceCacheKey_(program.maBuoi),
      attendanceMap,
      CHECKIN_ATTENDANCE_CACHE_SECONDS
    );

    // Giữ lịch sử tham gia V4.
    try {
      recordMemberParticipation_(
        member.ma,
        program.maBuoi,
        program.tenBuoi,
        timeString
      );
    } catch (historyError) {
      console.error(
        'Không ghi được lịch sử tham gia: ' + historyError.message
      );
    }

    return {
      success: true,
      type: 'SUCCESS',
      message: 'Điểm danh thành công',
      ma: member.ma,
      hoTen: member.hoTen,
      be: member.be,
      maBuoi: program.maBuoi,
      tenBuoi: program.tenBuoi,
      thoiGian: timeString,
      trangThaiDangKy: registration.status,
      phuongTien: program.phuongTien || '',
      diemDon: program.diemDon || ''
    };

  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

/* ============================================================
 * KIỂM TRA ĐĂNG KÝ V6
 * ============================================================ */

function v6GetRegistrationStatus_(maBuoi, ma, tenBuoi) {
  const normalizedMa = normalizeMemberCode_(ma);
  const code = String(maBuoi || '').trim();

  // Tập hát tiếp tục dùng cơ chế điểm danh cũ, không bắt buộc đăng ký V5.
  if (V6_LEGACY_TAP_HAT && isTapHat_(tenBuoi)) {
    return {
      allowed: true,
      legacy: true,
      status: 'LEGACY'
    };
  }

  const sheet = getOrCreateDangKySheet_();
  v5EnsureRegistrationStructure_();
  const rows = sheet.getDataRange().getDisplayValues();

  let hasRegistrationForProgram = false;
  let found = null;

  for (let i = 1; i < rows.length; i++) {
    const rowMaBuoi = String(rows[i][1] || '').trim();
    if (rowMaBuoi !== code) continue;

    hasRegistrationForProgram = true;

    if (normalizeMemberCode_(rows[i][2]) === normalizedMa) {
      found = {
        currentStatus: String(rows[i][8] || '').trim().toUpperCase(),
        legacyStatus: String(rows[i][6] || '').trim().toUpperCase(),
        requestedStatus: String(rows[i][9] || '').trim().toUpperCase()
      };
      break;
    }
  }

  // Chương trình chưa được sử dụng với đăng ký V5:
  // giữ fallback để không phá các buổi cũ.
  if (!hasRegistrationForProgram) {
    return {
      allowed: true,
      legacy: true,
      status: 'LEGACY'
    };
  }

  if (!found) {
    return {
      allowed: false,
      type: 'NOT_REGISTERED',
      status: '',
      message: 'Ca viên chưa đăng ký chương trình này.'
    };
  }

  const status = found.currentStatus || (
    found.legacyStatus === 'ĐÃ ĐĂNG KÝ' ? 'ĐI' : found.legacyStatus
  );

  if (status === V6_STATUS_ALLOWED) {
    return {
      allowed: true,
      legacy: false,
      status: status
    };
  }

  return {
    allowed: false,
    type: 'REGISTRATION_NOT_ALLOWED',
    status: status || 'CHƯA XÁC ĐỊNH',
    message: 'Trạng thái đăng ký hiện tại không cho phép điểm danh: ' +
      (status || 'CHƯA XÁC ĐỊNH') + '.'
  };
}

/**
 * Kiểm tra nhanh luồng V6 mà không ghi điểm danh.
 * Dùng trong Apps Script Run để kiểm tra cấu trúc.
 */
function testV6RegistrationCheck() {
  const buoi = getCachedCurrentBuoi_();

  if (!buoi) {
    Logger.log('V6: hôm nay không có buổi.');
    return;
  }

  Logger.log(JSON.stringify({
    maBuoi: buoi.maBuoi,
    tenBuoi: buoi.tenBuoi,
    phuongTien: buoi.phuongTien || '',
    diemDon: buoi.diemDon || '',
    tapHatLegacy: isTapHat_(buoi.tenBuoi)
  }, null, 2));
}

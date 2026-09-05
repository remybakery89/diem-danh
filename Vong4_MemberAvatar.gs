/* VÒNG 4 — AVATAR
 * Nhận ảnh avatar từ member/avatar.js bằng POST + hidden iframe.
 * Không lưu ảnh vào Sheet; chỉ lưu URL ở cột Avatar (N) của Trang tính1.
 * Folder Drive: 1tZNqbRhewUACC5p5SWbnmSAkMdoIk_vX
 */

const AVATAR_FOLDER_ID = '1tZNqbRhewUACC5p5SWbnmSAkMdoIk_vX';
const AVATAR_MAX_BASE64 = 700 * 1024;

// Chạy hàm này 1 lần trong Apps Script để cấp quyền Drive cho project.
function authorizeAvatarDrive_() {
  const folder = DriveApp.getFolderById(AVATAR_FOLDER_ID);
  folder.getName();
  return 'Đã cấp quyền Drive cho Avatar.';
}

function doPost(e) {
  let result;
  try {
    const p = (e && e.parameter) || {};
    const api = String(p.api || '').trim();

    if (api === 'member_avatar_upload') {
      result = uploadMemberAvatar_(p.token, p.image);
    } else {
      result = { success: false, message: 'API không hợp lệ.' };
    }
  } catch (err) {
    result = {
      success: false,
      message: String(err && err.message || err)
    };
  }

  const payload = JSON.stringify({
    type: 'member_avatar_upload',
    success: !!result.success,
    message: result.message || '',
    avatar: result.avatar || ''
  }).replace(/</g, '\\u003c');

  return HtmlService
    .createHtmlOutput(
      '<!doctype html><html><head><meta charset="utf-8"></head><body>' +
      '<script>window.top.postMessage(' + payload + ', "*");</script>' +
      '</body></html>'
    )
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function uploadMemberAvatar_(token, imageData) {
  token = String(token || '').trim();
  imageData = String(imageData || '').trim();

  if (!token) return { success: false, message: 'Phiên đăng nhập không hợp lệ.' };
  if (!imageData) return { success: false, message: 'Chưa có ảnh.' };
  if (imageData.length > AVATAR_MAX_BASE64) {
    return { success: false, message: 'Ảnh sau khi nén vẫn quá lớn.' };
  }

  const member = getMemberFromRegistrationToken_(token);
  if (!member || !member.ma) {
    return { success: false, message: 'Không xác định được ca viên.' };
  }

  const m = imageData.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) return { success: false, message: 'Định dạng ảnh không hợp lệ.' };

  const bytes = Utilities.base64Decode(m[2]);
  if (!bytes || !bytes.length) return { success: false, message: 'Ảnh rỗng.' };
  if (bytes.length > 520 * 1024) {
    return { success: false, message: 'Ảnh sau khi nén vượt quá giới hạn 520 KB.' };
  }

  const folder = DriveApp.getFolderById(AVATAR_FOLDER_ID);
  const fileName = String(member.ma) + '_avatar.jpg';
  const blob = Utilities.newBlob(bytes, 'image/jpeg', fileName);
  const file = folder.createFile(blob);

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (sharingErr) {
    file.setTrashed(true);
    return { success: false, message: 'Không thể cấp quyền xem ảnh trên Drive.' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEET_CA_VIEN);
  if (!sh) {
    file.setTrashed(true);
    return { success: false, message: 'Không tìm thấy sheet ca viên.' };
  }

  const values = sh.getDataRange().getValues();
  if (values.length < 2) {
    file.setTrashed(true);
    return { success: false, message: 'Sheet ca viên chưa có dữ liệu.' };
  }

  const headers = values[0].map(function (v) { return String(v).trim().toLowerCase(); });
  const maCol = findAvatarHeaderIndex_(headers, ['mã ca viên', 'ma ca vien']);
  const avatarCol = findAvatarHeaderIndex_(headers, ['avatar', 'ảnh đại diện', 'anh dai dien']);

  if (maCol < 0 || avatarCol < 0) {
    file.setTrashed(true);
    return { success: false, message: 'Thiếu cột Mã ca viên hoặc Avatar.' };
  }

  let row = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][maCol]).trim().toUpperCase() === String(member.ma).trim().toUpperCase()) {
      row = i + 1;
      break;
    }
  }

  if (row < 0) {
    file.setTrashed(true);
    return { success: false, message: 'Không tìm thấy ca viên trong sheet.' };
  }

  const oldUrl = String(sh.getRange(row, avatarCol + 1).getValue() || '').trim();
  const avatarUrl = 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(file.getId()) + '&sz=w400';
  sh.getRange(row, avatarCol + 1).setValue(avatarUrl);

  trashOldAvatarFile_(oldUrl, file.getId());

  return { success: true, message: 'Đã cập nhật ảnh đại diện.', avatar: avatarUrl };
}

function findAvatarHeaderIndex_(headers, candidates) {
  for (let i = 0; i < candidates.length; i++) {
    const idx = headers.indexOf(String(candidates[i]).toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

function trashOldAvatarFile_(oldUrl, newFileId) {
  if (!oldUrl) return;
  const m = oldUrl.match(/[?&]id=([^&]+)/);
  if (!m) return;
  const oldId = decodeURIComponent(m[1]);
  if (!oldId || oldId === newFileId) return;

  try {
    const oldFile = DriveApp.getFileById(oldId);
    const parents = oldFile.getParents();
    let inAvatarFolder = false;
    while (parents.hasNext()) {
      if (parents.next().getId() === AVATAR_FOLDER_ID) {
        inAvatarFolder = true;
        break;
      }
    }
    if (inAvatarFolder) oldFile.setTrashed(true);
  } catch (err) {
    // Không để lỗi dọn ảnh cũ làm thất bại việc cập nhật avatar mới.
  }
}

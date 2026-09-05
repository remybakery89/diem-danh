/* VÒNG 4 — AVATAR
 * Upload avatar vào thư mục Drive đã chỉ định.
 * Sheet: Trang tính1, A = Mã ca viên, N = Avatar.
 * Folder Drive: 1tZNqbRhewUACC5p5SWbnmSAkMdoIk_vX
 *
 * Không lưu ảnh vào Sheet và không gọi setSharing() ở cấp file.
 */

const AVATAR_FOLDER_ID = '1tZNqbRhewUACC5p5SWbnmSAkMdoIk_vX';
const AVATAR_MAX_BASE64 = 700 * 1024;

function authorizeAvatarDrive() {
  const folder = DriveApp.getFolderById(AVATAR_FOLDER_ID);
  const testBlob = Utilities.newBlob('avatar authorization test', 'text/plain', '.avatar_permission_test.txt');
  const testFile = folder.createFile(testBlob);
  const testId = testFile.getId();
  testFile.setTrashed(true);
  return 'Đã kiểm tra quyền Drive: có thể tạo file. Test file: ' + testId;
}

function doPost(e) {
  let result;
  try {
    const p = (e && e.parameter) || {};
    if (String(p.api || '').trim() === 'member_avatar_upload') {
      result = uploadMemberAvatar_(p.token, p.image);
    } else {
      result = { success: false, message: 'API không hợp lệ.' };
    }
  } catch (err) {
    result = { success: false, message: String(err && err.message || err) };
  }

  const payload = JSON.stringify({
    type: 'member_avatar_upload',
    success: !!result.success,
    message: result.message || '',
    avatar: result.avatar || ''
  }).replace(/</g, '\\u003c');

  return HtmlService
    .createHtmlOutput('<!doctype html><html><body><script>window.top.postMessage(' + payload + ', "*");</script></body></html>')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function uploadMemberAvatar_(token, imageData) {
  token = String(token || '').trim();
  imageData = String(imageData || '').trim();
  if (!token) return { success: false, message: 'Phiên đăng nhập không hợp lệ.' };
  if (!imageData) return { success: false, message: 'Chưa có ảnh.' };
  if (imageData.length > AVATAR_MAX_BASE64) return { success: false, message: 'Ảnh sau khi nén vẫn quá lớn.' };

  const member = getMemberFromRegistrationToken_(token);
  if (!member || !member.ma) return { success: false, message: 'Không xác định được ca viên.' };

  const m = imageData.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) return { success: false, message: 'Định dạng ảnh không hợp lệ.' };
  const bytes = Utilities.base64Decode(m[2]);
  if (!bytes || !bytes.length) return { success: false, message: 'Ảnh rỗng.' };
  if (bytes.length > 520 * 1024) return { success: false, message: 'Ảnh sau khi nén vượt quá giới hạn 520 KB.' };

  const folder = DriveApp.getFolderById(AVATAR_FOLDER_ID);
  const file = folder.createFile(Utilities.newBlob(bytes, 'image/jpeg', String(member.ma) + '_avatar.jpg'));

  // Hệ thống đã xác định cố định: A = Mã ca viên, N = Avatar.
  // Không dò tên header nữa để tránh lỗi do tên/format header trong Sheet.
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEET_CA_VIEN);
  if (!sh) {
    file.setTrashed(true);
    return { success: false, message: 'Không tìm thấy sheet ca viên.' };
  }

  const lastRow = sh.getLastRow();
  if (lastRow < 2) {
    file.setTrashed(true);
    return { success: false, message: 'Sheet ca viên chưa có dữ liệu.' };
  }

  const memberCodes = sh.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  let row = -1;
  for (let i = 0; i < memberCodes.length; i++) {
    if (String(memberCodes[i][0]).trim().toUpperCase() === String(member.ma).trim().toUpperCase()) {
      row = i + 2;
      break;
    }
  }

  if (row < 0) {
    file.setTrashed(true);
    return { success: false, message: 'Không tìm thấy ca viên trong sheet.' };
  }

  const oldUrl = String(sh.getRange(row, 14).getValue() || '').trim();
  const avatarUrl = 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(file.getId()) + '&sz=w400';
  sh.getRange(row, 14).setValue(avatarUrl);

  trashOldAvatarFile_(oldUrl, file.getId());
  return { success: true, message: 'Đã cập nhật ảnh đại diện.', avatar: avatarUrl };
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
  } catch (err) {}
}

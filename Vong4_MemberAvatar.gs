/* VÒNG 4 — AVATAR + VÒNG 5C — PAYMENT UPLOAD */
const AVATAR_FOLDER_ID = '1tZNqbRhewUACC5p5SWbnmSAkMdoIk_vX';
const AVATAR_MAX_BASE64 = 700 * 1024;

function authorizeAvatarDrive() {
  const folder=DriveApp.getFolderById(AVATAR_FOLDER_ID); const testFile=folder.createFile(Utilities.newBlob('avatar authorization test','text/plain','.avatar_permission_test.txt')); const id=testFile.getId(); testFile.setTrashed(true); return 'Đã kiểm tra quyền Drive: có thể tạo file. Test file: '+id;
}

function doPost(e) {
  let result;
  let route='';
  try {
    const p=(e&&e.parameter)||{}; route=String(p.api||'').trim();
    if(route==='member_avatar_upload') result=uploadMemberAvatar_(p.token,p.image);
    else if(route==='registration_payment_upload') result=v5cUploadPayment_(p.token,p.maBuoi,p.image);
    else result={success:false,message:'API không hợp lệ.'};
  } catch(err){ result={success:false,message:String(err&&err.message||err)}; }
  const payload=JSON.stringify({
    type: route==='member_avatar_upload' ? 'member_avatar_upload' : route==='registration_payment_upload' ? 'registration_payment_upload' : 'upload',
    success:!!result.success,
    message:result.message||'',
    avatar:result.avatar||'',
    payment:result.payment||null
  }).replace(/</g,'\\u003c');
  return HtmlService.createHtmlOutput('<!doctype html><html><body><script>window.top.postMessage('+payload+', "*");</script></body></html>').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function uploadMemberAvatar_(token,imageData){
  token=String(token||'').trim(); imageData=String(imageData||'').trim();
  if(!token)return{success:false,message:'Phiên đăng nhập không hợp lệ.'}; if(!imageData)return{success:false,message:'Chưa có ảnh.'}; if(imageData.length>AVATAR_MAX_BASE64)return{success:false,message:'Ảnh sau khi nén vẫn quá lớn.'};
  const member=getMemberFromRegistrationToken_(token); if(!member||!member.ma)return{success:false,message:'Không xác định được ca viên.'};
  const m=imageData.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/); if(!m)return{success:false,message:'Định dạng ảnh không hợp lệ.'}; const bytes=Utilities.base64Decode(m[2]); if(!bytes.length||bytes.length>520*1024)return{success:false,message:'Ảnh sau khi nén vượt quá giới hạn 520 KB.'};
  const folder=DriveApp.getFolderById(AVATAR_FOLDER_ID); const file=folder.createFile(Utilities.newBlob(bytes,'image/jpeg',String(member.ma)+'_avatar.jpg'));
  const ss=SpreadsheetApp.openById(SPREADSHEET_ID),sh=ss.getSheetByName(SHEET_CA_VIEN); if(!sh){file.setTrashed(true);return{success:false,message:'Không tìm thấy sheet ca viên.'};}
  const lastRow=sh.getLastRow(); if(lastRow<2){file.setTrashed(true);return{success:false,message:'Sheet ca viên chưa có dữ liệu.'};}
  const codes=sh.getRange(2,1,lastRow-1,1).getDisplayValues(); let row=-1; for(let i=0;i<codes.length;i++)if(String(codes[i][0]).trim().toUpperCase()===String(member.ma).trim().toUpperCase()){row=i+2;break;}
  if(row<0){file.setTrashed(true);return{success:false,message:'Không tìm thấy ca viên trong sheet.'};}
  const oldUrl=String(sh.getRange(row,14).getValue()||'').trim(); const avatarUrl='https://drive.google.com/thumbnail?id='+encodeURIComponent(file.getId())+'&sz=w400'; sh.getRange(row,14).setValue(avatarUrl); trashOldAvatarFile_(oldUrl,file.getId()); return{success:true,message:'Đã cập nhật ảnh đại diện.',avatar:avatarUrl};
}
function trashOldAvatarFile_(oldUrl,newFileId){if(!oldUrl)return;const m=oldUrl.match(/[?&]id=([^&]+)/);if(!m)return;const id=decodeURIComponent(m[1]);if(!id||id===newFileId)return;try{const f=DriveApp.getFileById(id);const ps=f.getParents();while(ps.hasNext())if(ps.next().getId()===AVATAR_FOLDER_ID){f.setTrashed(true);break;}}catch(e){}}

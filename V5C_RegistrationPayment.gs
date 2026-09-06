/* ============================================================
 * VÒNG 5C — THANH TOÁN ĐĂNG KÝ
 * P: Ảnh giao dịch | Q: Số tiền xác nhận | R: Trạng thái thanh toán
 * S: Thời gian xác nhận | T: Người xác nhận
 * ============================================================ */

const V5C_PAYMENT_HEADERS = ['ảnh giao dịch','số tiền xác nhận','trạng thái thanh toán','thời gian xác nhận','người xác nhận'];
const V5C_PAYMENT_PARENT_FOLDER_ID = '1tZNqbRhewUACC5p5SWbnmSAkMdoIk_vX';
const V5C_PAYMENT_FOLDER_NAME = 'DiemDanh_PaymentImages';
const V5C_MAX_BASE64 = 900 * 1024;
const V5C_MAX_BYTES = 700 * 1024;

function v5cEnsurePaymentStructure_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEET_DANG_KY);
  if (!sh) throw new Error('Không tìm thấy sheet DANG_KY.');
  const last = 15 + V5C_PAYMENT_HEADERS.length;
  if (sh.getMaxColumns() < last) sh.insertColumnsAfter(sh.getMaxColumns(), last - sh.getMaxColumns());
  for (let i=0;i<V5C_PAYMENT_HEADERS.length;i++) {
    const col=16+i;
    if (String(sh.getRange(1,col).getDisplayValue()||'').trim() !== V5C_PAYMENT_HEADERS[i]) sh.getRange(1,col).setValue(V5C_PAYMENT_HEADERS[i]);
  }
  const lastRow=sh.getLastRow();
  if(lastRow>1){
    const values=sh.getRange(2,18,lastRow-1,1).getDisplayValues();
    for(let i=0;i<values.length;i++) if(!String(values[i][0]||'').trim()) sh.getRange(i+2,18).setValue('CHƯA NỘP');
  }
  sh.setFrozenRows(1);
  return {success:true,columns:V5C_PAYMENT_HEADERS.slice()};
}

function v5cGetPaymentFolder_(){
  const parent=DriveApp.getFolderById(V5C_PAYMENT_PARENT_FOLDER_ID);
  const found=parent.getFoldersByName(V5C_PAYMENT_FOLDER_NAME);
  return found.hasNext()?found.next():parent.createFolder(V5C_PAYMENT_FOLDER_NAME);
}

function v5cGetPaymentContext_(maBuoi, ma) {
  v5cEnsurePaymentStructure_();
  const sh=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_DANG_KY);
  const rows=sh.getDataRange().getDisplayValues();
  const target=normalizeMemberCode_(ma);
  for(let i=1;i<rows.length;i++) if(String(rows[i][1]||'').trim()===String(maBuoi||'').trim() && normalizeMemberCode_(rows[i][2])===target) return {sheet:sh,rowNumber:i+1,row:rows[i]};
  return {sheet:sh,rowNumber:0,row:null};
}

function v5cPaymentData_(row) {
  return {anhGiaoDich:String(row[15]||'').trim(),soTienXacNhan:String(row[16]||'').trim(),trangThaiThanhToan:String(row[17]||'').trim()||'CHƯA NỘP',thoiGianXacNhan:String(row[18]||'').trim(),nguoiXacNhan:String(row[19]||'').trim()};
}

function v5cProgramInfo_(maBuoi){
  try{
    const p=getProgramByCode_(maBuoi)||{};
    return {tenBuoi:String(p.tenBuoi||p.ten||maBuoi),ngay:String(p.ngay||''),gio:String(p.gio||''),diaDiem:String(p.diaDiem||p.diaDiemToChuc||'')};
  }catch(e){return {tenBuoi:String(maBuoi||''),ngay:'',gio:'',diaDiem:''};}
}

function v5cUploadPayment_(token,maBuoi,imageData) {
  const member=getMemberFromRegistrationToken_(token);
  if(!member) return {success:false,type:'SESSION_EXPIRED',message:'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'};
  maBuoi=String(maBuoi||'').trim(); imageData=String(imageData||'').trim();
  if(!maBuoi||!imageData) return {success:false,type:'INVALID_INPUT',message:'Thiếu chương trình hoặc ảnh giao dịch.'};
  if(v5cIsPaymentRequired_(maBuoi)!=='CÓ') return {success:false,type:'PAYMENT_NOT_REQUIRED',message:'Chương trình này không yêu cầu thanh toán.'};
  const ctx=v5cGetPaymentContext_(maBuoi,member.ma);
  if(!ctx.rowNumber) return {success:false,type:'NOT_REGISTERED',message:'Bạn chưa có đăng ký chương trình này.'};
  const status=String(ctx.row[8]||'').trim().toUpperCase();
  if(status!=='ĐI'&&status!=='DỰ BỊ') return {success:false,type:'PAYMENT_NOT_ALLOWED',message:'Chỉ có thể gửi thanh toán khi đăng ký đã được duyệt ĐI hoặc DỰ BỊ.'};
  if(imageData.length>V5C_MAX_BASE64) return {success:false,type:'FILE_TOO_LARGE',message:'Ảnh sau khi nén vẫn quá lớn.'};
  const m=imageData.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/);
  if(!m) return {success:false,type:'INVALID_IMAGE',message:'Định dạng ảnh không hợp lệ.'};
  const bytes=Utilities.base64Decode(m[2]);
  if(!bytes.length||bytes.length>V5C_MAX_BYTES) return {success:false,type:'FILE_TOO_LARGE',message:'Ảnh sau khi nén vượt quá giới hạn 700 KB.'};
  const folder=v5cGetPaymentFolder_();
  const file=folder.createFile(Utilities.newBlob(bytes,'image/jpeg',String(member.ma)+'_'+maBuoi+'_payment_'+Date.now()+'.jpg'));
  const url='https://drive.google.com/thumbnail?id='+encodeURIComponent(file.getId())+'&sz=w900';
  const old=String(ctx.row[15]||'').trim();
  ctx.sheet.getRange(ctx.rowNumber,16).setValue(url);
  ctx.sheet.getRange(ctx.rowNumber,18).setValue('ĐÃ GỬI');
  ctx.sheet.getRange(ctx.rowNumber,17).clearContent();
  ctx.sheet.getRange(ctx.rowNumber,19,1,2).clearContent();
  v5cTrashOldPaymentFile_(old,file.getId());
  return {success:true,type:'registration_payment_upload',message:'Đã gửi ảnh giao dịch cho Admin xác nhận.',payment:v5cPaymentData_(ctx.sheet.getRange(ctx.rowNumber,16,1,5).getDisplayValues()[0])};
}

function v5cTrashOldPaymentFile_(oldUrl,newId){
  if(!oldUrl)return; const m=oldUrl.match(/[?&]id=([^&]+)/); if(!m)return; const id=decodeURIComponent(m[1]); if(!id||id===newId)return;
  try{DriveApp.getFileById(id).setTrashed(true);}catch(e){}
}

function v5cGetMyPayments_(token){
  const member=getMemberFromRegistrationToken_(token); if(!member)return {success:false,type:'SESSION_EXPIRED',message:'Phiên đăng nhập đã hết hạn.'};
  v5cEnsurePaymentStructure_();
  const sh=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_DANG_KY); const rows=sh.getDataRange().getDisplayValues(); const result=[]; const target=normalizeMemberCode_(member.ma);
  for(let i=1;i<rows.length;i++){
    if(normalizeMemberCode_(rows[i][2])!==target)continue;
    const status=String(rows[i][8]||'').trim();
    if(status==='ĐÃ HỦY')continue;
    const maBuoi=String(rows[i][1]||'').trim();
    const yeuCauThanhToan=v5cIsPaymentRequired_(maBuoi);
    if(yeuCauThanhToan!=='CÓ')continue;
    const info=v5cProgramInfo_(maBuoi);
    result.push({maBuoi,maDangKy:String(rows[i][0]||'').trim(),tenBuoi:info.tenBuoi,ngay:info.ngay,gio:info.gio,trangThai:status,yeuCauThanhToan,payment:v5cPaymentData_(rows[i])});
  }
  return {success:true,registrations:result};
}

function v5cGetMyPayment_(token,maBuoi){
  const all=v5cGetMyPayments_(token); if(!all.success)return all;
  return {success:true,maBuoi:maBuoi,payment:(all.registrations.find(x=>x.maBuoi===String(maBuoi||''))||{}).payment||null};
}

function v5cGetAdminPayment_(password,maBuoi){
  const auth=verifyAdminPassword(password); if(!auth.success)return auth;
  const required=v5cIsPaymentRequired_(maBuoi);
  v5cEnsurePaymentStructure_(); const sh=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_DANG_KY); const rows=sh.getDataRange().getDisplayValues(); const result=[];
  for(let i=1;i<rows.length;i++) if(String(rows[i][1]||'').trim()===String(maBuoi||'').trim()) result.push({rowNumber:i+1,maDangKy:String(rows[i][0]||'').trim(),maBuoi:String(rows[i][1]||'').trim(),ma:String(rows[i][2]||'').trim(),hoTen:String(rows[i][3]||'').trim(),be:String(rows[i][4]||'').trim(),trangThai:String(rows[i][8]||'').trim(),trangThaiYeuCau:String(rows[i][9]||'').trim(),yeuCauThanhToan:required,payment:v5cPaymentData_(rows[i])});
  return {success:true,yeuCauThanhToan:required,registrations:result};
}

function v5cConfirmPayment_(password,maBuoi,ma,amount){
  const auth=verifyAdminPassword(password); if(!auth.success)return auth;
  if(v5cIsPaymentRequired_(maBuoi)!=='CÓ')return{success:false,type:'PAYMENT_NOT_REQUIRED',message:'Chương trình này không yêu cầu thanh toán.'};
  amount=String(amount??'').trim(); if(!amount)return {success:false,type:'INVALID_AMOUNT',message:'Vui lòng nhập số tiền xác nhận.'};
  if(!/^\d+(?:[.,]\d{1,2})?$/.test(amount))return{success:false,type:'INVALID_AMOUNT',message:'Số tiền xác nhận không hợp lệ.'};
  const lock=LockService.getScriptLock(); lock.waitLock(15000);
  try{
    const ctx=v5cGetPaymentContext_(maBuoi,ma); if(!ctx.rowNumber)return{success:false,type:'NOT_FOUND',message:'Không tìm thấy đăng ký.'};
    if(!String(ctx.row[15]||'').trim())return{success:false,type:'NO_IMAGE',message:'Ca viên chưa gửi ảnh giao dịch.'};
    const now=Utilities.formatDate(new Date(),TIMEZONE,'dd/MM/yyyy HH:mm:ss');
    ctx.sheet.getRange(ctx.rowNumber,17).setValue(amount); ctx.sheet.getRange(ctx.rowNumber,18).setValue('ĐÃ XÁC NHẬN'); ctx.sheet.getRange(ctx.rowNumber,19).setValue(now); ctx.sheet.getRange(ctx.rowNumber,20).setValue('ADMIN');
    return {success:true,message:'Đã xác nhận thanh toán.',payment:v5cPaymentData_(ctx.sheet.getRange(ctx.rowNumber,16,1,5).getDisplayValues()[0])};
  }finally{lock.releaseLock();}
}

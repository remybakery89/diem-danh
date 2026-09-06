/* ============================================================
 * VÒNG 5C — CẤU HÌNH YÊU CẦU THANH TOÁN CHO CHƯƠNG TRÌNH
 * N: Yêu cầu thanh toán — CÓ / KHÔNG
 * ============================================================ */

const V5C_PAYMENT_REQUIRED_COL = 14;
const V5C_PAYMENT_REQUIRED_HEADER = 'yêu cầu thanh toán';

function v5cEnsurePaymentProgramStructure_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEET_BUOI);
  if (!sh) throw new Error('Không tìm thấy sheet BUOI.');
  if (sh.getMaxColumns() < V5C_PAYMENT_REQUIRED_COL) sh.insertColumnsAfter(sh.getMaxColumns(), V5C_PAYMENT_REQUIRED_COL - sh.getMaxColumns());
  if (String(sh.getRange(1,V5C_PAYMENT_REQUIRED_COL).getDisplayValue()||'').trim() !== V5C_PAYMENT_REQUIRED_HEADER) sh.getRange(1,V5C_PAYMENT_REQUIRED_COL).setValue(V5C_PAYMENT_REQUIRED_HEADER);
  return true;
}

function v5cNormalizePaymentRequired_(value) {
  return String(value || '').trim().toUpperCase() === 'CÓ' ? 'CÓ' : 'KHÔNG';
}

function v5cIsPaymentRequired_(maBuoi) {
  v5cEnsurePaymentProgramStructure_();
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_BUOI);
  const data = sh.getDataRange().getDisplayValues();
  for (let i=1;i<data.length;i++) if (String(data[i][0]||'').trim() === String(maBuoi||'').trim()) return v5cNormalizePaymentRequired_(data[i][13]);
  return 'KHÔNG';
}

function v5cGetPaymentProgramSetting_(password, maBuoi) {
  const auth = verifyAdminPassword(password); if (!auth.success) return auth;
  const code=String(maBuoi||'').trim();
  if(!code)return{success:false,type:'INVALID_INPUT',message:'Thiếu mã chương trình.'};
  return {success:true,maBuoi:code,yeuCauThanhToan:v5cIsPaymentRequired_(code)};
}

function v5cSetPaymentProgramSetting_(password, maBuoi, required) {
  const auth = verifyAdminPassword(password); if (!auth.success) return auth;
  const code=String(maBuoi||'').trim();
  if(!code)return{success:false,type:'INVALID_INPUT',message:'Thiếu mã chương trình.'};
  v5cEnsurePaymentProgramStructure_();
  const sh=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_BUOI);
  const data=sh.getDataRange().getDisplayValues();
  for(let i=1;i<data.length;i++) if(String(data[i][0]||'').trim()===code){
    const value=v5cNormalizePaymentRequired_(required);
    sh.getRange(i+1,V5C_PAYMENT_REQUIRED_COL).setValue(value);
    return {success:true,maBuoi:code,yeuCauThanhToan:value};
  }
  return {success:false,type:'NOT_FOUND',message:'Không tìm thấy chương trình.'};
}

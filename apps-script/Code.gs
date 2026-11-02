const SPREADSHEET_ID = '1b9sz7QYLgjs-5W55oOSK_zpbWUFF96TZxCbWQcaQogU';
const RECORDS_SHEET_NAME = 'ชีต1';
const GROUPS_SHEET_NAME = 'กลุ่มสำรวจ';
const HISTORY_SHEET_NAME = 'ประวัติการเปลี่ยนแปลง';
const PHOTOS_SHEET_NAME = 'รูปภาพพรรณไม้';
const PHOTO_CHUNK_SIZE = 30000;
const MAX_PHOTO_LENGTH = 1500000;

const RECORD_HEADERS = [
  'รหัสข้อมูล', 'กลุ่มสำรวจ', 'โซนพื้นที่', 'ชื่อพรรณไม้', 'จำนวนต้น',
  'ลักษณะวิสัย', 'ละติจูด', 'ลองจิจูด', 'แสงแดด', 'สภาพดิน', 'ข้อสังเกต', 'วันเวลาสำรวจ'
];
const HISTORY_HEADERS = [
  'เวลาบันทึก', 'รายการเปลี่ยนแปลง', 'รหัสข้อมูล', 'กลุ่มสำรวจ', 'โซนพื้นที่',
  'ชื่อพรรณไม้', 'จำนวนต้น', 'ลักษณะวิสัย', 'ละติจูด', 'ลองจิจูด',
  'แสงแดด', 'สภาพดิน', 'ข้อสังเกต', 'วันเวลาสำรวจ'
];
const PHOTO_HEADERS = ['รหัสข้อมูล', 'ส่วนที่', 'จำนวนส่วน', 'ข้อมูลภาพ JPEG'];

function doGet() {
  ensureSheets_();
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('PTS Plant GIS by Mr.Thaksin')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getSnapshot() {
  const sheets = ensureSheets_();
  const photoMap = readPhotos_(sheets.photos);
  const lastRow = sheets.records.getLastRow();
  const records = lastRow < 2 ? [] : sheets.records.getRange(2, 1, lastRow - 1, RECORD_HEADERS.length)
    .getValues()
    .filter(row => row[0])
    .map(row => ({
      id: String(row[0]),
      group: String(row[1] || ''),
      zone: String(row[2] || ''),
      name: String(row[3] || ''),
      quantity: Number(row[4]) || 1,
      habit: String(row[5] || ''),
      lat: Number(row[6]),
      lng: Number(row[7]),
      sunlight: String(row[8] || ''),
      soil: String(row[9] || ''),
      notes: String(row[10] || ''),
      timestamp: String(row[11] || ''),
      photo: photoMap.get(String(row[0])) || ''
    }));

  const groupLastRow = sheets.groups.getLastRow();
  const groups = groupLastRow < 2 ? [] : sheets.groups.getRange(2, 1, groupLastRow - 1, 1)
    .getValues().flat().map(value => String(value || '').trim()).filter(Boolean);

  const initialized = PropertiesService.getScriptProperties().getProperty('PTS_SHEET_INITIALIZED') === 'true'
    || records.length > 0 || groups.length > 0;
  return { initialized, records, groups, photoRecordIds: [...photoMap.keys()] };
}

function saveSnapshot(payload) {
  if (!payload || !Array.isArray(payload.records) || !Array.isArray(payload.groups)) {
    throw new Error('รูปแบบข้อมูลสำหรับซิงก์ไม่ถูกต้อง');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheets = ensureSheets_();
    const incomingRecords = payload.records
      .filter(record => record && record.id && !String(record.id).startsWith('demo-'))
      .map(record => [
        safeText_(record.id), safeText_(record.group), safeText_(record.zone),
        safeText_(record.name), Number(record.quantity) || 1, safeText_(record.habit),
        Number(record.lat) || 0, Number(record.lng) || 0, safeText_(record.sunlight),
        safeText_(record.soil), safeText_(record.notes), safeText_(record.timestamp)
      ]);

    const previousRows = readDataRows_(sheets.records, RECORD_HEADERS.length);
    const previousRecords = new Map(previousRows.map(row => [String(row[0]), row]));
    const nextRecords = payload.clearRecords
      ? new Map()
      : new Map(previousRecords);
    incomingRecords.forEach(row => nextRecords.set(String(row[0]), row));
    const records = [...nextRecords.values()];
    const changes = [];
    records.forEach(row => {
      const before = previousRecords.get(String(row[0]));
      if (!before) changes.push(['เพิ่มพรรณไม้', ...row]);
      else if (JSON.stringify(before) !== JSON.stringify(row)) changes.push(['แก้ไขพรรณไม้', ...row]);
    });
    previousRows.forEach(row => {
      if (!nextRecords.has(String(row[0]))) changes.push(['ลบพรรณไม้', ...row]);
    });

    const oldGroups = readDataRows_(sheets.groups, 1).map(row => String(row[0] || '')).filter(Boolean);
    const nextGroups = [...new Set(payload.groups.map(group => safeText_(group).trim()).filter(Boolean))];
    nextGroups.filter(group => !oldGroups.includes(group)).forEach(group => {
      changes.push(['เพิ่มกลุ่ม', '', group, '', '', '', '', '', '', '', '', '', '', '']);
    });
    oldGroups.filter(group => !nextGroups.includes(group)).forEach(group => {
      changes.push(['ลบกลุ่ม', '', group, '', '', '', '', '', '', '', '', '', '', '']);
    });

    const photoUploads = savePhotos_(sheets.photos, Array.isArray(payload.photos) ? payload.photos : new Set(), new Set(records.map(row => String(row[0]))));
    photoUploads.forEach(id => {
      const row = nextRecords.get(id);
      if (row) changes.push(['อัปเดตรูปภาพ', ...row]);
    });

    replaceRows_(sheets.records, RECORD_HEADERS.length, records);
    replaceRows_(sheets.groups, 1, nextGroups.map(group => [group]));
    if (changes.length) {
      const timestamp = new Date();
      const startRow = sheets.history.getLastRow() + 1;
      ensureRows_(sheets.history, startRow + changes.length - 1);
      sheets.history.getRange(startRow, 1, changes.length, HISTORY_HEADERS.length)
        .setValues(changes.map(change => [timestamp, ...change]));
    }
    PropertiesService.getScriptProperties().setProperty('PTS_SHEET_INITIALIZED', 'true');
    return { ok: true, records: records.length, groups: nextGroups.length, photos: photoUploads.length, changes: changes.length };
  } finally {
    lock.releaseLock();
  }
}

function ensureSheets_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const records = spreadsheet.getSheets()[0];
  ensureHeader_(records, RECORD_HEADERS);
  const groups = getOrCreateSheet_(spreadsheet, GROUPS_SHEET_NAME, ['ชื่อกลุ่ม']);
  const history = getOrCreateSheet_(spreadsheet, HISTORY_SHEET_NAME, HISTORY_HEADERS);
  const photos = getOrCreateSheet_(spreadsheet, PHOTOS_SHEET_NAME, PHOTO_HEADERS);
  return { records, groups, history, photos };
}

function getOrCreateSheet_(spreadsheet, name, headers) {
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  ensureHeader_(sheet, headers);
  return sheet;
}

function ensureHeader_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return;
  }
  const current = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  if (current.every(value => !value)) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return;
  }
  if (headers.some((header, index) => current[index] !== header)) {
    throw new Error(`หัวตารางของชีต "${sheet.getName()}" ไม่ตรงกับรูปแบบ PTS Plant GIS`);
  }
}

function replaceRows_(sheet, columnCount, rows) {
  const oldRows = sheet.getLastRow() - 1;
  if (oldRows > 0) sheet.getRange(2, 1, oldRows, columnCount).clearContent();
  ensureRows_(sheet, rows.length + 1);
  if (rows.length > 0) sheet.getRange(2, 1, rows.length, columnCount).setValues(rows);
}

function ensureRows_(sheet, requiredRows) {
  const missingRows = requiredRows - sheet.getMaxRows();
  if (missingRows > 0) sheet.insertRowsAfter(sheet.getMaxRows(), missingRows);
}

function safeText_(value) {
  const text = String(value || '');
  return /^[=+@\-]/.test(text) ? `'${text}` : text;
}

function readDataRows_(sheet, columnCount) {
  const lastRow = sheet.getLastRow();
  return lastRow < 2 ? [] : sheet.getRange(2, 1, lastRow - 1, columnCount).getValues()
    .filter(row => row.some(value => value !== '' && value !== null));
}

function readPhotos_(sheet) {
  const grouped = new Map();
  readDataRows_(sheet, PHOTO_HEADERS.length).forEach(row => {
    const id = String(row[0] || '');
    const part = Number(row[1]);
    const total = Number(row[2]);
    if (!id || !part || !total) return;
    if (!grouped.has(id)) grouped.set(id, { total, parts: [] });
    grouped.get(id).parts[part - 1] = String(row[3] || '');
  });
  const photos = new Map();
  grouped.forEach((photo, id) => {
    if (photo.parts.length === photo.total && photo.parts.every(Boolean)) photos.set(id, photo.parts.join(''));
  });
  return photos;
}

function savePhotos_(sheet, uploads, currentRecordIds) {
  const validUploads = new Map();
  uploads.forEach(photo => {
    if (!photo || !photo.id || !currentRecordIds.has(String(photo.id))) return;
    const dataUrl = String(photo.dataUrl || '');
    if (dataUrl.length > MAX_PHOTO_LENGTH || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) {
      throw new Error(`รูปภาพของรายการ ${photo.id} ใหญ่เกินไปหรือไม่ใช่ JPEG`);
    }
    validUploads.set(String(photo.id), dataUrl);
  });

  const existing = readDataRows_(sheet, PHOTO_HEADERS.length);
  const keepRows = existing.filter(row => currentRecordIds.has(String(row[0])) && !validUploads.has(String(row[0])));
  const newRows = [];
  validUploads.forEach((dataUrl, id) => {
    const total = Math.ceil(dataUrl.length / PHOTO_CHUNK_SIZE);
    for (let index = 0; index < total; index++) {
      newRows.push([id, index + 1, total, dataUrl.slice(index * PHOTO_CHUNK_SIZE, (index + 1) * PHOTO_CHUNK_SIZE)]);
    }
  });
  replaceRows_(sheet, PHOTO_HEADERS.length, [...keepRows, ...newRows]);
  return [...validUploads.keys()];
}

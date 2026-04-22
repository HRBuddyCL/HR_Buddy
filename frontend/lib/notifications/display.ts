const STATUS_LABEL_TH: Record<string, string> = {
  NEW: "ใหม่",
  APPROVED: "อนุมัติแล้ว",
  IN_PROGRESS: "กำลังดำเนินการ",
  IN_TRANSIT: "กำลังส่ง",
  DONE: "เสร็จสิ้น",
  REJECTED: "ถูกปฏิเสธ",
  CANCELED: "ยกเลิก",
};

const TITLE_TRANSLATE_MAP: Record<string, string> = {
  "New messenger booking request": "มีคำขอเมสเซนเจอร์ใหม่",
  "Request canceled by employee": "พนักงานยกเลิกคำขอ",
  "Messenger reported a problem": "แมสเซนเจอร์รายงานปัญหา",
};

function toStatusLabel(status: string) {
  return STATUS_LABEL_TH[status] ?? status;
}

export function getDisplayNotificationTitle(title: string) {
  const fromMap = TITLE_TRANSLATE_MAP[title];
  if (fromMap) {
    return fromMap;
  }

  const requestStatusMatch = title.match(/^Request\s+(.+?)\s+is\s+([A-Z_]+)$/);
  if (requestStatusMatch) {
    const [, requestNo, status] = requestStatusMatch;
    return `คำขอ ${requestNo} อยู่ในสถานะ ${toStatusLabel(status)}`;
  }

  return title;
}

export function getDisplayNotificationMessage(message: string) {
  const requestFromMatch = message.match(/^Request\s+(.+?)\s+from\s+(.+)$/);
  if (requestFromMatch) {
    const [, requestNo, employeeName] = requestFromMatch;
    return `คำขอ ${requestNo} จาก ${employeeName}`;
  }

  const requestMessageMatch = message.match(/^Request\s+(.+?):\s*(.+)$/);
  if (requestMessageMatch) {
    const [, requestNo, detail] = requestMessageMatch;
    return `คำขอ ${requestNo}: ${detail}`;
  }

  const statusWithNoteMatch = message.match(
    /^Status changed to\s+([A-Z_]+)\.\s*Note:\s*(.+)$/,
  );
  if (statusWithNoteMatch) {
    const [, status, note] = statusWithNoteMatch;
    return `สถานะเปลี่ยนเป็น ${toStatusLabel(status)} หมายเหตุ: ${note}`;
  }

  const statusOnlyMatch = message.match(/^Status changed to\s+([A-Z_]+)\.?$/);
  if (statusOnlyMatch) {
    const [, status] = statusOnlyMatch;
    return `สถานะเปลี่ยนเป็น ${toStatusLabel(status)}`;
  }

  return message;
}

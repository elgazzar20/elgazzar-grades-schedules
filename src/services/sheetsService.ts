import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { StudentRecord } from '../data/mockDatabase';
import { StageId } from '../utils/grading';
import {
  auth,
  db,
  getAccessToken,
  handleFirestoreError,
  OperationType,
} from './googleAuth';

// المعرف الرسمي الثابت لشيت درجات الطلاب الخارجي المربوط بالموقع و Firebase
export const DEFAULT_SPREADSHEET_ID: string =
  '1zwgiuQzBFJ7WpRvfp88KaE5z-3me9tx0MB6i4WYDaiQ';
export const DEFAULT_SPREADSHEET_URL: string =
  'https://docs.google.com/spreadsheets/d/1zwgiuQzBFJ7WpRvfp88KaE5z-3me9tx0MB6i4WYDaiQ/edit?usp=sharing';

// المعرف الرسمي الثابت لشيت جدول المواعيد الخارجي المربوط بالموقع و Firebase
export const DEFAULT_SCHEDULE_SPREADSHEET_ID: string =
  '1m5y12DU0jgtBsShGVihBuzlk3pTVhKezIwGtTnV0x9A';
export const DEFAULT_SCHEDULE_SPREADSHEET_URL: string =
  'https://docs.google.com/spreadsheets/d/1m5y12DU0jgtBsShGVihBuzlk3pTVhKezIwGtTnV0x9A/edit?usp=sharing';

export interface ScheduleSession {
  groupLabel: string;
  days: string;
  time: string;
  statusNote?: string;
  extraFields?: Array<{ title: string; value: string }>;
}

export interface GradeScheduleGroup {
  gradeTitle: string;
  sessions: ScheduleSession[];
}

export type StageSchedulesMap = Record<StageId, GradeScheduleGroup[]>;

export const DEFAULT_STAGE_SCHEDULES: StageSchedulesMap = {
  primary: [
    {
      gradeTitle: 'الصف الرابع الابتدائي',
      sessions: [
        {
          groupLabel: 'المجموعة الأولى',
          days: 'السبت والثلاثاء',
          time: 'الساعة 6:00 مساءً',
          statusNote: 'متاح الحجز',
        },
        {
          groupLabel: 'المجموعة الثانية',
          days: 'الأحد والأربعاء',
          time: 'الساعة 3:00 عصراً',
          statusNote: 'متاح الحجز',
        },
      ],
    },
    {
      gradeTitle: 'الصف الخامس الابتدائي',
      sessions: [
        {
          groupLabel: 'المجموعة الأساسية',
          days: 'السبت والثلاثاء',
          time: 'الساعة 5:00 مساءً',
          statusNote: 'متاح الحجز',
        },
      ],
    },
    {
      gradeTitle: 'الصف السادس الابتدائي',
      sessions: [
        {
          groupLabel: 'المجموعة الأساسية',
          days: 'الإثنين والخميس',
          time: 'الساعة 5:00 مساءً',
          statusNote: 'متاح الحجز',
        },
      ],
    },
  ],
  prep: [
    {
      gradeTitle: 'الصف الأول الإعدادي',
      sessions: [
        {
          groupLabel: 'المجموعة الأولى',
          days: 'السبت والثلاثاء',
          time: 'الساعة 4:00 عصراً',
          statusNote: 'متاح الحجز',
        },
        {
          groupLabel: 'المجموعة الثانية',
          days: 'الإثنين والخميس',
          time: 'الساعة 4:00 عصراً',
          statusNote: 'متاح الحجز',
        },
      ],
    },
    {
      gradeTitle: 'الصف الثاني الإعدادي',
      sessions: [
        {
          groupLabel: 'المجموعة الأولى',
          days: 'السبت والثلاثاء',
          time: 'الساعة 3:00 عصراً',
          statusNote: 'متاح الحجز',
        },
      ],
    },
    {
      gradeTitle: 'الصف الثالث الإعدادي',
      sessions: [
        {
          groupLabel: 'المجموعة الأساسية',
          days: 'السبت والثلاثاء',
          time: 'الساعة 2:00 ظهراً',
          statusNote: 'متاح الحجز',
        },
      ],
    },
  ],
  secondary: [
    {
      gradeTitle: 'الصف الأول الثانوي',
      sessions: [
        {
          groupLabel: 'المجموعة الأساسية',
          days: 'الإثنين والخميس',
          time: 'الساعة 3:00 عصراً',
          statusNote: 'متاح الحجز',
        },
      ],
    },
  ],
};

const INITIAL_COMBINED_SCHEDULE_STRINGS = new Set<string>([
  'السبت والثلاثاء الساعة 6:00 مساءً',
  'الأحد والأربعاء الساعة 3:00 عصراً',
  'السبت والثلاثاء الساعة 5:00 مساءً',
  'الإثنين والخميس الساعة 5:00 مساءً',
  'السبت والثلاثاء الساعة 4:00 عصراً',
  'الإثنين والخميس الساعة 4:00 عصراً',
  'السبت والثلاثاء الساعة 3:00 عصراً',
  'السبت والثلاثاء الساعة 2:00 ظهراً',
  'الإثنين والخميس الساعة 3:00 عصراً',
]);

const GRADE_SLUG_MAP: Record<string, string> = {
  'الرابع الابتدائي': 'g4_primary',
  'الخامس الابتدائي': 'g5_primary',
  'السادس الابتدائي': 'g6_primary',
  'الأول الإعدادي': 'g1_prep',
  'الثاني الإعدادي': 'g2_prep',
  'الثالث الإعدادي': 'g3_prep',
  'الأول الثانوي': 'g1_sec',
  'الثاني الثانوي': 'g2_sec',
  'الثالث الثانوي': 'g3_sec',
};

// خريطة معرفات الأوراق (GIDs) الأساسية في شيت الدرجات لضمان قراءة CSV الخام بدون فقدان أي خانة
const KNOWN_GRADE_GIDS: Record<string, string> = {
  'الرابع الابتدائي': '1004',
  'الخامس الابتدائي': '1005',
  'السادس الابتدائي': '1006',
  'الأول الإعدادي': '0',
  'الثاني الإعدادي': '1449564186',
  'الثالث الإعدادي': '65358771',
  'الأول الثانوي': '1007',
  'الثاني الثانوي': '1008',
  'الثالث الثانوي': '1009',
};

let cachedDiscoveredGradeGids: Record<string, string> = { ...KNOWN_GRADE_GIDS };
let lastGradeGidDiscoveryTime = 0;

/**
 * تحويل الأرقام العربية/الفارسية إلى أرقام إنجليزية قياسية للمطابقة الدقيقة
 */
function normalizeDigits(input: string): string {
  return String(input || '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .trim();
}

/**
 * توحيد النص العربي للمقارنة المرنة بين أسماء الأوراق والصفوف
 */
function normalizeArabicText(input: string): string {
  return String(input || '')
    .replace(/^الصف\s+/, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * اكتشاف كافة الأوراق (Tabs) ومعرفاتها (GIDs) داخل أي ملف Google Sheet تلقائياً
 * حتى لو أضاف المعلم ورقة جديدة في الشيت
 */
export async function discoverSpreadsheetTabs(
  spreadsheetId: string
): Promise<Array<{ name: string; gid: string }>> {
  try {
    const res = await fetch(
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/htmlview?_t=${Date.now()}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return [];
    const html = await res.text();
    const matches = [
      ...html.matchAll(
        /items\.push\(\{name:\s*"([^"]+)",\s*pageUrl:\s*"[^"]+",\s*gid:\s*"(\d+)"/g
      ),
    ];
    return matches.map((m) => ({ name: m[1].trim(), gid: m[2].trim() }));
  } catch {
    return [];
  }
}

async function resolveGradeTabGid(gradeName: string): Promise<string | null> {
  const now = Date.now();
  if (now - lastGradeGidDiscoveryTime > 30000) {
    lastGradeGidDiscoveryTime = now;
    const tabs = await discoverSpreadsheetTabs(DEFAULT_SPREADSHEET_ID);
    if (tabs.length > 0) {
      const nextMap: Record<string, string> = { ...KNOWN_GRADE_GIDS };
      for (const t of tabs) {
        nextMap[t.name] = t.gid;
      }
      cachedDiscoveredGradeGids = nextMap;
    }
  }

  if (cachedDiscoveredGradeGids[gradeName]) {
    return cachedDiscoveredGradeGids[gradeName];
  }

  const targetNorm = normalizeArabicText(gradeName);
  for (const [k, gid] of Object.entries(cachedDiscoveredGradeGids)) {
    if (normalizeArabicText(k) === targetNorm) {
      return gid;
    }
  }

  return null;
}

/**
 * تحليل نص CSV إلى مصفوفة ثنائية الأبعاد بدون فقدان أي خلية أو عنوان عمود
 */
export function parseCsvToRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const nextCh = csvText[i + 1];

    if (inQuotes) {
      if (ch === '"' && nextCh === '"') {
        currentCell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentCell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (ch === '\r' && nextCh === '\n') {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += ch;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  return rows;
}

export function getStudentFirestoreDocId(gradeName: string, studentCode: string): string {
  const gradeSlug = GRADE_SLUG_MAP[gradeName] || 'grade';
  const safeCode = normalizeDigits(studentCode).replace(/[^a-zA-Z0-9_-]/g, '');
  return `${gradeSlug}_${safeCode || '0'}`;
}

export function getConfiguredSpreadsheetId(): string {
  return DEFAULT_SPREADSHEET_ID;
}

/**
 * مزامنة إعدادات الشيت الخارجي وسجل الطالب مع Firebase Firestore
 */
export async function syncStudentRecordToFirestore(student: StudentRecord): Promise<void> {
  if (!auth.currentUser || auth.currentUser.email !== 'mo7amedrabee99@gmail.com') {
    return;
  }
  const docId = getStudentFirestoreDocId(student.grade, student.id);
  const path = `students/${docId}`;
  try {
    const boundedScores = student.scores.slice(0, 50).map((s) => ({
      title: String(s.title || '').slice(0, 120),
      value: String(s.value ?? '').slice(0, 120),
    }));

    await setDoc(doc(db, 'students', docId), {
      id: String(student.id).slice(0, 64),
      name: String(student.name || 'طالب').slice(0, 200),
      grade: String(student.grade).slice(0, 120),
      group: String(student.group || '').slice(0, 200),
      note: String(student.note || '').slice(0, 1000),
      scores: boundedScores,
      updatedAt: new Date().toISOString().slice(0, 64),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Missing or insufficient permissions')
    ) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

/**
 * مطابقة كود الطالب بمرونة (يدعم الأصفار البادئة مثل 077077 والأرقام العربية)
 */
function isMatchingStudentCode(rowCodeRaw: string, targetCodeRaw: string): boolean {
  const cleanRow = normalizeDigits(rowCodeRaw);
  const cleanTarget = normalizeDigits(targetCodeRaw);
  if (!cleanRow || !cleanTarget) return false;
  if (cleanRow === cleanTarget) return true;

  // مطابقة في حال حذف الصفر البادئ تلقائياً من الشيت (مثل 077077 و 77077)
  if (/^\d+$/.test(cleanRow) && /^\d+$/.test(cleanTarget)) {
    return cleanRow.replace(/^0+/, '') === cleanTarget.replace(/^0+/, '');
  }
  return false;
}

/**
 * تحويل صفوف الجدول (2D array) إلى سجل طالب مع قراءة كافة الأعمدة والخانات الجديدة تلقائياً
 * مهما كان عدد الأعمدة المضافة في الشيت أو نوع البيانات بداخلها
 */
function parseStudentFromRows(
  rows: string[][],
  gradeName: string,
  studentCode: string
): StudentRecord | null {
  if (!rows || rows.length < 2) return null;
  const headers = (rows[0] || []).map((h) => String(h || '').trim());

  // معرفة آخر عمود يحتوي على عنوان أو بيانات في الشيت بالكامل
  let maxColsInSheet = headers.length;
  for (const r of rows) {
    if (r && r.length > maxColsInSheet) {
      maxColsInSheet = r.length;
    }
  }

  // تحديد الأعمدة الفعالة في الشيت (من العمود الخامس فصاعداً) التي لها عنوان أو بها بيانات لأي طالب
  const activeColumnIndices: number[] = [];
  for (let c = 4; c < maxColsInSheet; c++) {
    const hasHeader = Boolean(headers[c]);
    const hasAnyValueInSheet = rows.slice(1).some((r) => r && String(r[c] ?? '').trim() !== '');
    if (hasHeader || hasAnyValueInSheet) {
      activeColumnIndices.push(c);
    }
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const rowId = String(row[0] || '').trim();
    if (isMatchingStudentCode(rowId, studentCode)) {
      const scores: { title: string; value: string }[] = [];

      for (const c of activeColumnIndices) {
        const colTitle = headers[c] || `خانة إضافية (${c - 3})`;
        const cellVal =
          row[c] !== undefined && row[c] !== null ? String(row[c]).trim() : '';

        // إذا كانت الخانة لها عنوان في الشيت أو لها قيمة مسجلة للطالب نضيفها فوراً
        if (headers[c] || cellVal !== '') {
          scores.push({
            title: colTitle,
            value: cellVal,
          });
        }
      }

      return {
        id: rowId || normalizeDigits(studentCode),
        name: String(row[1] || '').trim(),
        group: String(row[2] || '').trim(),
        note: String(row[3] || '').trim(),
        grade: gradeName,
        scores,
      };
    }
  }

  return null;
}

/**
 * تحليل رد Google Visualization JSONP/JSON مع دمج عناوين الأعمدة والصف الأول
 */
function parseGvizResponse(text: string, fallbackLabels: string[] = []): string[][] {
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('Invalid gviz response');
  }
  const jsonStr = text.substring(jsonStart, jsonEnd + 1);
  const parsed = JSON.parse(jsonStr);
  if (parsed.status === 'error') {
    throw new Error('Gviz error status');
  }

  const table = parsed.table;
  if (!table || !Array.isArray(table.rows)) return [];

  const cols: string[] = (table.cols || []).map((col: { label?: string }, idx: number) =>
    String(col?.label || fallbackLabels[idx] || '').trim()
  );

  const resultRows: string[][] = [];
  const hasColumnLabels = cols.some((label) => label !== '');
  if (hasColumnLabels) {
    resultRows.push(cols);
  }

  table.rows.forEach((r: { c?: Array<{ v?: unknown; f?: string } | null> }, rIdx: number) => {
    const cells = (r.c || []).map((cell, cIdx) => {
      if (!cell) {
        // إذا كان الصف الأول هو صف العناوين وحذفه gviz بسبب نوع العمود الرقمي، نستعيده من fallbackLabels
        if (rIdx === 0 && !hasColumnLabels && fallbackLabels[cIdx]) {
          return fallbackLabels[cIdx];
        }
        return '';
      }
      if (cell.f !== undefined && cell.f !== null) return String(cell.f).trim();
      if (cell.v !== undefined && cell.v !== null) return String(cell.v).trim();
      return '';
    });
    resultRows.push(cells);
  });

  return resultRows;
}

/**
 * جلب كافة صفوف ورقة الصف الدراسي من شيت الدرجات بأعلى دقة (بدون فقدان أي عمود أو خانة جديدة)
 */
async function fetchRawGradeSheetRows(
  spreadsheetId: string,
  gradeName: string
): Promise<string[][]> {
  const timestamp = Date.now();

  // 1. الطريقة الأولى والأدق: تصدير CSV الخام عبر GID الورقة (يقرأ كل النصوص والأرقام والعناوين الجديدة 100% كما هي)
  const gid = await resolveGradeTabGid(gradeName);
  if (gid !== null) {
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}&_t=${timestamp}`;
      const res = await fetch(csvUrl, { cache: 'no-store' });
      if (res.ok) {
        const csvText = await res.text();
        if (!csvText.trim().startsWith('<!DOCTYPE html>')) {
          const rows = parseCsvToRows(csvText);
          if (rows.length > 0) return rows;
        }
      }
    } catch {
      // المتابعة إلى gviz المدمج
    }
  }

  // 2. الطريقة الثانية: دمج gviz headers=1 (لقراءة كافة عناوين الأعمدة الجديدة) مع headers=0 (لقراءة كافة الصفوف)
  try {
    const [resHeaders, resRows] = await Promise.all([
      fetch(
        `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(
          gradeName
        )}&headers=1&_t=${timestamp}`,
        { cache: 'no-store' }
      ),
      fetch(
        `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(
          gradeName
        )}&headers=0&_t=${timestamp}`,
        { cache: 'no-store' }
      ),
    ]);

    let headerLabels: string[] = [];
    if (resHeaders.ok) {
      const textH = await resHeaders.text();
      const jsonStart = textH.indexOf('{');
      const jsonEnd = textH.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const parsedH = JSON.parse(textH.substring(jsonStart, jsonEnd + 1));
        headerLabels = (parsedH?.table?.cols || []).map((c: { label?: string }) =>
          String(c?.label || '').trim()
        );
      }
    }

    if (resRows.ok) {
      const textR = await resRows.text();
      const rows = parseGvizResponse(textR, headerLabels);
      if (rows.length > 0) {
        // التأكد من دمج أي عنوان عمود من headerLabels في الصف الأول
        if (headerLabels.length > 0 && rows[0]) {
          for (let c = 0; c < Math.max(headerLabels.length, rows[0].length); c++) {
            if (!rows[0][c] && headerLabels[c]) {
              rows[0][c] = headerLabels[c];
            }
          }
        }
        return rows;
      }
    }
  } catch {
    // المتابعة إلى Google Sheets API v4
  }

  return [];
}

/**
 * البحث الحي المباشر عن الطالب من الشيت الخارجي (`1zwgiuQzBFJ7WpRvfp88KaE5z-3me9tx0MB6i4WYDaiQ`)
 * ومزامنته مع Firebase Firestore
 */
export async function fetchLiveStudentFromGoogleSheets(
  gradeName: string,
  studentCode: string
): Promise<{ handled: boolean; student: StudentRecord | null }> {
  const spreadsheetId = DEFAULT_SPREADSHEET_ID;

  // 1. القراءة الفورية المباشرة (CSV + GVIZ المدمج)
  try {
    const rows = await fetchRawGradeSheetRows(spreadsheetId, gradeName);
    if (rows.length > 0) {
      const student = parseStudentFromRows(rows, gradeName, studentCode);
      if (student) {
        await syncStudentRecordToFirestore(student);
      }
      return { handled: true, student };
    }
  } catch {
    // في حال تعذر الاتصال يجرب API v4 أو Firestore
  }

  // 2. القراءة عبر Google Sheets API v4 في حال وجود توكن مفعل
  const token = await getAccessToken();
  if (token) {
    try {
      const range = encodeURIComponent(`'${gradeName}'!A1:ZZ1000`);
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        const data = await res.json();
        const values: string[][] = Array.isArray(data.values) ? data.values : [];
        const student = parseStudentFromRows(values, gradeName, studentCode);
        if (student) {
          await syncStudentRecordToFirestore(student);
        }
        return { handled: true, student };
      }
    } catch {
      // Fall through to Firestore
    }
  }

  // 3. القراءة من Firebase Firestore في حال انقطاع اتصال جوجل شيت المؤقت
  const docId = getStudentFirestoreDocId(gradeName, studentCode);
  const studentPath = `students/${docId}`;
  try {
    const snap = await getDoc(doc(db, 'students', docId));
    if (snap.exists()) {
      const data = snap.data();
      return {
        handled: true,
        student: {
          id: String(data.id ?? studentCode.trim()),
          name: String(data.name ?? ''),
          grade: String(data.grade ?? gradeName),
          group: String(data.group ?? ''),
          note: String(data.note ?? ''),
          scores: Array.isArray(data.scores) ? data.scores : [],
        },
      };
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Missing or insufficient permissions')
    ) {
      handleFirestoreError(error, OperationType.GET, studentPath);
    }
  }

  return { handled: false, student: null };
}

/**
 * اشتراك لحظي (Real-time Subscription) لتحديث الشهادة تلقائياً بدون ريفرش
 */
export function subscribeToRealtimeStudentUpdates(
  gradeName: string,
  studentCode: string,
  onUpdate: (updatedStudent: StudentRecord) => void
): () => void {
  const docId = getStudentFirestoreDocId(gradeName, studentCode);
  const path = `students/${docId}`;

  const unsubscribeFirestore = onSnapshot(
    doc(db, 'students', docId),
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        onUpdate({
          id: String(data.id ?? studentCode.trim()),
          name: String(data.name ?? ''),
          grade: String(data.grade ?? gradeName),
          group: String(data.group ?? ''),
          note: String(data.note ?? ''),
          scores: Array.isArray(data.scores) ? data.scores : [],
        });
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );

  const pollNow = async () => {
    try {
      const res = await fetchLiveStudentFromGoogleSheets(gradeName, studentCode);
      if (res.handled && res.student) {
        onUpdate(res.student);
      }
    } catch {
      // ignore transient network errors
    }
  };

  const intervalId = window.setInterval(pollNow, 2500);
  const handleFocus = () => {
    pollNow();
  };
  window.addEventListener('focus', handleFocus);

  return () => {
    unsubscribeFirestore();
    window.clearInterval(intervalId);
    window.removeEventListener('focus', handleFocus);
  };
}

/**
 * تحديد المرحلة الدراسية تلقائياً من عمود المرحلة أو عمود الصف في شيت المواعيد
 */
function resolveScheduleStageId(stageText: string, gradeText: string): StageId | null {
  const combined = `${normalizeArabicText(stageText)} ${normalizeArabicText(gradeText)}`;
  if (combined.includes('ابتدا')) return 'primary';
  if (combined.includes('اعداد')) return 'prep';
  if (combined.includes('ثانو')) return 'secondary';
  return null;
}

/**
 * تحليل صفوف شيت المواعيد (`1m5y12DU0jgtBsShGVihBuzlk3pTVhKezIwGtTnV0x9A`)
 * مع قراءة أي خانات أو أعمدة إضافية جديدة يضيفها المعلم في الشيت تلقائياً
 */
export function parseSchedulesFromRows(rows: string[][]): StageSchedulesMap | null {
  if (!rows || rows.length === 0) return null;

  const headers = (rows[0] || []).map((c) => String(c || '').trim());
  const firstRowJoined = headers.join(' ');
  const hasHeaderRow =
    firstRowJoined.includes('المرحلة') ||
    firstRowJoined.includes('الصف') ||
    firstRowJoined.includes('المجموعة') ||
    firstRowJoined.includes('الأيام');

  const startIndex = hasHeaderRow ? 1 : 0;
  const result: StageSchedulesMap = {
    primary: [],
    prep: [],
    secondary: [],
  };

  let lastStageId: StageId | null = null;
  let lastGradeTitle = '';
  let parsedCount = 0;

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const stageRaw = String(row[0] || '').trim();
    const gradeRaw = String(row[1] || '').trim();
    const groupLabelRaw = String(row[2] || '').trim();
    const daysRaw = String(row[3] || '').trim();
    const timeRaw = String(row[4] || '').trim();
    const fullTextRaw = String(row[5] || '').trim();
    const statusNoteRaw = String(row[6] || '').trim();

    if (!stageRaw && !gradeRaw && !daysRaw && !timeRaw && !fullTextRaw) {
      continue;
    }

    const detectedStage: StageId | null =
      resolveScheduleStageId(stageRaw, gradeRaw) || lastStageId;
    if (!detectedStage) continue;
    lastStageId = detectedStage;

    const rawGradeTitle = gradeRaw || lastGradeTitle;
    if (!rawGradeTitle) continue;
    lastGradeTitle = rawGradeTitle;

    const formattedGradeTitle = rawGradeTitle.startsWith('الصف')
      ? rawGradeTitle
      : `الصف ${rawGradeTitle}`;

    let finalDays = daysRaw;
    let finalTime = timeRaw;
    const combinedDE = `${daysRaw} ${timeRaw}`.trim();

    if (!finalDays && !finalTime && fullTextRaw) {
      const hourIndex = fullTextRaw.indexOf('الساعة');
      if (hourIndex > 0) {
        finalDays = fullTextRaw.slice(0, hourIndex).trim();
        finalTime = fullTextRaw.slice(hourIndex).trim();
      } else {
        finalDays = fullTextRaw;
      }
    } else if (
      fullTextRaw &&
      fullTextRaw !== combinedDE &&
      INITIAL_COMBINED_SCHEDULE_STRINGS.has(combinedDE) &&
      !INITIAL_COMBINED_SCHEDULE_STRINGS.has(fullTextRaw)
    ) {
      const hourIndex = fullTextRaw.indexOf('الساعة');
      if (hourIndex > 0) {
        finalDays = fullTextRaw.slice(0, hourIndex).trim();
        finalTime = fullTextRaw.slice(hourIndex).trim();
      } else {
        finalDays = fullTextRaw;
        finalTime = '';
      }
    }

    if (!finalDays && !finalTime) continue;

    // تجميع أي خانات أو أعمدة إضافية جديدة من العمود السابع فصاعداً مع اسم الخانة إن وجد
    const extraNotes: string[] = [];
    const extraFields: Array<{ title: string; value: string }> = [];
    if (statusNoteRaw) extraNotes.push(statusNoteRaw);
    const maxCols = Math.max(headers.length, row.length);
    for (let c = 7; c < maxCols; c++) {
      const extraCell = String(row[c] || '').trim();
      if (extraCell) {
        const colHeader = hasHeaderRow && headers[c] ? headers[c] : `خانة إضافية (${c - 6})`;
        extraFields.push({ title: colHeader, value: extraCell });
        extraNotes.push(colHeader ? `${colHeader}: ${extraCell}` : extraCell);
      }
    }

    const stageGroups = result[detectedStage];
    let gradeGroup = stageGroups.find((g) => g.gradeTitle === formattedGradeTitle);
    if (!gradeGroup) {
      gradeGroup = {
        gradeTitle: formattedGradeTitle,
        sessions: [],
      };
      stageGroups.push(gradeGroup);
    }

    gradeGroup.sessions.push({
      groupLabel: groupLabelRaw,
      days: finalDays || fullTextRaw,
      time: finalTime,
      statusNote: statusNoteRaw || undefined,
      extraFields: extraFields.length > 0 ? extraFields : undefined,
    });

    parsedCount++;
  }

  return parsedCount > 0 ? result : null;
}

/**
 * مزامنة جدول المواعيد مع Firebase Firestore
 */
export async function syncSchedulesToFirestore(schedules: StageSchedulesMap): Promise<void> {
  if (!auth.currentUser || auth.currentUser.email !== 'mo7amedrabee99@gmail.com') {
    return;
  }
  const stages: StageId[] = ['primary', 'prep', 'secondary'];
  for (const stageId of stages) {
    const path = `schedules/${stageId}`;
    try {
      const boundedGroups = (schedules[stageId] || []).slice(0, 30).map((g) => ({
        gradeTitle: String(g.gradeTitle || '').slice(0, 120),
        sessions: (g.sessions || []).slice(0, 30).map((s) => ({
          groupLabel: String(s.groupLabel || '').slice(0, 120),
          days: String(s.days || '').slice(0, 160),
          time: String(s.time || '').slice(0, 120),
          statusNote: String(s.statusNote || '').slice(0, 300),
        })),
      }));

      await setDoc(doc(db, 'schedules', stageId), {
        stageId,
        spreadsheetId: DEFAULT_SCHEDULE_SPREADSHEET_ID,
        groups: boundedGroups,
        updatedAt: new Date().toISOString().slice(0, 64),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Missing or insufficient permissions')
      ) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }
  }
}

/**
 * جلب جدول المواعيد الحي مباشرةً من الشيت الخارجي (`1m5y12DU0jgtBsShGVihBuzlk3pTVhKezIwGtTnV0x9A`)
 * عبر CSV الخام أولاً لضمان قراءة أي عمود أو خانة جديدة فوراً
 */
export async function fetchLiveSchedulesFromGoogleSheets(): Promise<StageSchedulesMap | null> {
  const spreadsheetId = DEFAULT_SCHEDULE_SPREADSHEET_ID;
  const timestamp = Date.now();

  // 1. القراءة عبر تصدير CSV الخام (يقرأ كافة الخانات والأعمدة الجديدة بدون حذف أي نص أو رقم)
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=0&_t=${timestamp}`;
    const res = await fetch(csvUrl, { cache: 'no-store' });
    if (res.ok) {
      const csvText = await res.text();
      if (!csvText.trim().startsWith('<!DOCTYPE html>')) {
        const rows = parseCsvToRows(csvText);
        const parsed = parseSchedulesFromRows(rows);
        if (parsed) {
          await syncSchedulesToFirestore(parsed);
          return parsed;
        }
      }
    }
  } catch {
    // المتابعة إلى gviz
  }

  // 2. القراءة عبر Google Visualization endpoint كبديل
  try {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&headers=0&_t=${timestamp}`;
    const res = await fetch(gvizUrl, { cache: 'no-store' });
    if (res.ok) {
      const text = await res.text();
      const rows = parseGvizResponse(text);
      const parsed = parseSchedulesFromRows(rows);
      if (parsed) {
        await syncSchedulesToFirestore(parsed);
        return parsed;
      }
    }
  } catch {
    // المتابعة إلى API v4 أو Firestore
  }

  // 3. القراءة عبر Google Sheets API v4 في حال وجود توكن مفعل
  const token = await getAccessToken();
  if (token) {
    try {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:ZZ500`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        const data = await res.json();
        const values: string[][] = Array.isArray(data.values) ? data.values : [];
        const parsed = parseSchedulesFromRows(values);
        if (parsed) {
          await syncSchedulesToFirestore(parsed);
          return parsed;
        }
      }
    } catch {
      // Fall through to Firestore
    }
  }

  // 4. القراءة من Firebase Firestore في حال انقطاع اتصال جوجل شيت المؤقت
  try {
    const stages: StageId[] = ['primary', 'prep', 'secondary'];
    const fromFirestore: StageSchedulesMap = {
      primary: [],
      prep: [],
      secondary: [],
    };
    let foundAny = false;

    for (const stageId of stages) {
      const snap = await getDoc(doc(db, 'schedules', stageId));
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.groups)) {
          fromFirestore[stageId] = data.groups;
          foundAny = true;
        }
      }
    }

    if (foundAny) {
      return fromFirestore;
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Missing or insufficient permissions')
    ) {
      handleFirestoreError(error, OperationType.GET, 'schedules/primary');
    }
  }

  return null;
}

/**
 * اشتراك لحظي (Real-time Subscription) لجدول المواعيد
 */
export function subscribeToRealtimeScheduleUpdates(
  onUpdate: (schedules: StageSchedulesMap) => void
): () => void {
  let isMounted = true;

  const pollSheet = async () => {
    try {
      const liveSchedules = await fetchLiveSchedulesFromGoogleSheets();
      if (isMounted && liveSchedules) {
        onUpdate(liveSchedules);
      }
    } catch {
      // ignore transient network errors
    }
  };

  pollSheet();
  const intervalId = window.setInterval(pollSheet, 2500);
  const handleFocus = () => {
    pollSheet();
  };
  window.addEventListener('focus', handleFocus);

  return () => {
    isMounted = false;
    window.clearInterval(intervalId);
    window.removeEventListener('focus', handleFocus);
  };
}

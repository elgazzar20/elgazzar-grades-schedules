import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { StudentRecord } from '../data/mockDatabase';
import { StageId } from '../utils/grading';
import {
  StudentPaymentRecord,
  StudentPaymentSummary,
  applyCalendarDeadlineToPaymentSummary,
  buildStudentPaymentSummary,
  parsePaymentDashboardRows,
  parsePaymentDatabaseRows,
} from '../utils/payment';
import {
  ACADEMIC_MONTHS_ORDER,
  ARABIC_MONTH_NAMES,
  AttendanceDatabaseEntry,
  AttendanceSessionItem,
  AttendanceSessionStatus,
  MonthlyAttendanceRecord,
  StudentAttendanceData,
  buildAttendanceStatusPresentation,
  buildMonthScheduledDates,
  computeAttendanceTermInsights,
  deriveScheduleDaysLabelFromIsoDates,
  formatArabicSessionCount,
  formatIsoDateDetails,
  getAcademicYearForMonth,
  isMatchingAttendanceStudentCode,
  normalizeAttendanceArabicText,
  parseAttendanceArchiveRows,
  parseAttendanceCellStatus,
  parseAttendanceDatabaseRows,
  parseFlexibleAttendanceDateToIso,
  resolveStudentWeeklySchedule,
} from '../utils/attendance';

export { ACADEMIC_MONTHS_ORDER, ARABIC_MONTH_NAMES, formatArabicSessionCount };
export type {
  AttendanceSessionItem,
  AttendanceSessionStatus,
  MonthlyAttendanceRecord,
  StudentAttendanceData,
};
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
 * التحقق مما إذا كان اسم الورقة (Tab) في شيت الدرجات يمثل صفاً دراسياً للطلاب
 * واستبعاد أوراق التحكم مثل "شريط الإعلانات" أو "جدول المواعيد" أو "سبورة الحصص"
 */
export function isStudentGradeTabName(tabName: string): boolean {
  const norm = normalizeArabicText(tabName);
  if (!norm) return false;
  if (
    norm.includes('اعلان') ||
    norm.includes('تنبيه') ||
    norm.includes('شريط') ||
    norm.includes('عاجل') ||
    norm.includes('شرف') ||
    norm.includes('اوائل') ||
    norm.includes('تكريم') ||
    norm.includes('متفوق') ||
    norm.includes('حضور') ||
    norm.includes('غياب') ||
    norm.includes('سجل') ||
    norm.includes('ارشيف') ||
    norm.includes('دفع') ||
    norm.includes('مصاريف') ||
    norm.includes('سداد') ||
    norm.includes('قاعده') ||
    norm.includes('جدول') ||
    norm.includes('مواعيد') ||
    norm.includes('سبور') ||
    norm.includes('اعدادات') ||
    norm.includes('ارشادات')
  ) {
    return false;
  }
  return (
    norm.includes('ابتدا') ||
    norm.includes('اعداد') ||
    norm.includes('ثانو') ||
    norm.includes('صف')
  );
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

let isDiscoveringGradeTabs = false;

async function resolveGradeTabGid(gradeName: string): Promise<string | null> {
  // 1. إذا كان الصف موجوداً في القائمة المعروفة نعيده فوراً بدون انتظار
  if (cachedDiscoveredGradeGids[gradeName]) {
    return cachedDiscoveredGradeGids[gradeName];
  }

  const targetNorm = normalizeArabicText(gradeName);
  for (const [k, gid] of Object.entries(cachedDiscoveredGradeGids)) {
    if (normalizeArabicText(k) === targetNorm) {
      return gid;
    }
  }

  // 2. إذا كان صفاً جديداً تمت إضافته في الشيت، نكتشف الأوراق
  const now = Date.now();
  if (!isDiscoveringGradeTabs && now - lastGradeGidDiscoveryTime > 60000) {
    isDiscoveringGradeTabs = true;
    lastGradeGidDiscoveryTime = now;
    try {
      const tabs = await discoverSpreadsheetTabs(DEFAULT_SPREADSHEET_ID);
      if (tabs.length > 0) {
        const nextMap: Record<string, string> = { ...KNOWN_GRADE_GIDS };
        for (const t of tabs) {
          nextMap[t.name] = t.gid;
        }
        cachedDiscoveredGradeGids = nextMap;
      }
    } finally {
      isDiscoveringGradeTabs = false;
    }
  }

  if (cachedDiscoveredGradeGids[gradeName]) {
    return cachedDiscoveredGradeGids[gradeName];
  }

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
const AUTO_FILLED_DEFAULT_GROUPS = new Set<string>(
  [
    '-',
    '—',
    'غير محدد',
    'غير مسجل',
    'بدون مجموعة',
    'لا يوجد',
    'مجموعة السبت والثلاثاء - 6 مساءً',
    'مجموعة الأحد والأربعاء - 3 عصراً',
    'مجموعة السبت والثلاثاء - 5 مساءً',
    'مجموعة الاثنين والخميس - 5 مساءً',
    'مجموعة الإثنين والخميس - 5 مساءً',
    'مجموعة السبت والثلاثاء - 4 عصراً',
    'مجموعة الاثنين والخميس - 4 عصراً',
    'مجموعة الإثنين والخميس - 4 عصراً',
    'مجموعة السبت والثلاثاء - 3 عصراً',
    'مجموعة السبت والثلاثاء - 2 ظهراً',
    'مجموعة الاثنين والخميس - 3 عصراً',
    'مجموعة الإثنين والخميس - 3 عصراً',
    'مجموعة السبت والثلاثاء - 8 مساءً',
  ].map((g) => normalizeArabicText(g))
);

/**
 * تنظيف حقل المجموعة بحيث لا تظهر أي بيانات افتراضية للطالب غير المسجل له مجموعة خاصة
 */
export function cleanRecordedGroup(rawGroup: string): string {
  const trimmed = String(rawGroup || '').trim();
  if (!trimmed) return '';
  const norm = normalizeArabicText(trimmed);
  if (!norm || AUTO_FILLED_DEFAULT_GROUPS.has(norm)) {
    return '';
  }
  return trimmed;
}

function parseStudentFromRows(
  rows: string[][],
  gradeName: string,
  studentCode: string
): StudentRecord | null {
  if (!rows || rows.length < 2) return null;
  const headers = (rows[0] || []).map((h) => String(h || '').trim());

  let maxColsInSheet = headers.length;
  for (const r of rows) {
    if (r && r.length > maxColsInSheet) {
      maxColsInSheet = r.length;
    }
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const rowId = String(row[0] || '').trim();
    if (isMatchingStudentCode(rowId, studentCode)) {
      const scores: { title: string; value: string }[] = [];

      for (let c = 4; c < maxColsInSheet; c++) {
        const colTitle = headers[c] || `تقييم (${c - 3})`;
        const cellVal =
          row[c] !== undefined && row[c] !== null ? String(row[c]).trim() : '';

        // عرض الخانات المسجل بها درجة أو تقييم فعلي للطالب فقط (بدون إظهار خانات فارغة افتراضية)
        if (cellVal !== '' && cellVal !== '-') {
          scores.push({
            title: colTitle,
            value: cellVal,
          });
        }
      }

      return {
        id: rowId || normalizeDigits(studentCode),
        name: String(row[1] || '').trim(),
        group: cleanRecordedGroup(String(row[2] || '')),
        rawGroup: String(row[2] || '').trim(),
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
  studentCode: string,
  shouldSyncFirestore = true
): Promise<{ handled: boolean; student: StudentRecord | null }> {
  const spreadsheetId = DEFAULT_SPREADSHEET_ID;

  // 1. القراءة الفورية المباشرة (CSV + GVIZ المدمج)
  try {
    const rows = await fetchRawGradeSheetRows(spreadsheetId, gradeName);
    if (rows.length > 0) {
      const student = parseStudentFromRows(rows, gradeName, studentCode);
      if (student && shouldSyncFirestore) {
        syncStudentRecordToFirestore(student).catch(() => {});
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
        if (student && shouldSyncFirestore) {
          syncStudentRecordToFirestore(student).catch(() => {});
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
 * مع حماية كاملة لمنع إعادة الطالب السابق عند الضغط على "بحث عن طالب آخر"
 */
export function subscribeToRealtimeStudentUpdates(
  gradeName: string,
  studentCode: string,
  onUpdate: (updatedStudent: StudentRecord) => void
): () => void {
  let isActive = true;
  let isPolling = false;

  const pollNow = async () => {
    if (!isActive || isPolling) return;
    isPolling = true;
    try {
      const res = await fetchLiveStudentFromGoogleSheets(gradeName, studentCode, false);
      if (isActive && res.handled && res.student) {
        onUpdate(res.student);
      }
    } catch {
      // ignore transient network errors
    } finally {
      isPolling = false;
    }
  };

  const intervalId = window.setInterval(pollNow, 8000);
  const handleFocus = () => {
    if (isActive) pollNow();
  };
  window.addEventListener('focus', handleFocus);

  return () => {
    isActive = false;
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
  let isPolling = false;
  let lastSerialized = '';

  const pollSheet = async () => {
    if (!isMounted || isPolling) return;
    isPolling = true;
    try {
      const liveSchedules = await fetchLiveSchedulesFromGoogleSheets();
      if (isMounted && liveSchedules) {
        const serialized = JSON.stringify(liveSchedules);
        if (serialized !== lastSerialized) {
          lastSerialized = serialized;
          onUpdate(liveSchedules);
        }
      }
    } catch {
      // ignore transient network errors
    } finally {
      isPolling = false;
    }
  };

  pollSheet();
  const intervalId = window.setInterval(pollSheet, 10000);
  const handleFocus = () => {
    if (isMounted) pollSheet();
  };
  window.addEventListener('focus', handleFocus);

  return () => {
    isMounted = false;
    window.clearInterval(intervalId);
    window.removeEventListener('focus', handleFocus);
  };
}

// ============================================================================
// شريط الإعلانات العاجلة (Live Urgent Announcements Ticker from Google Sheets)
// ============================================================================

export const DEFAULT_ANNOUNCEMENT_GID = '514573363';
const ANNOUNCEMENTS_CACHE_KEY = 'elgazzar_live_announcements_v1';

export interface UrgentAnnouncementItem {
  id: string;
  text: string;
  targetGrade: string;
  date: string;
  status: string;
}

function isAnnouncementStatusDisabled(rawStatus: string): boolean {
  const norm = normalizeArabicText(rawStatus).toLowerCase();
  if (!norm) return false;
  const disabledKeywords = [
    'متوقف',
    'توقف',
    'مغلق',
    'مخفي',
    'اخفاء',
    'غير مفعل',
    'غير نشط',
    'ايقاف',
    'ملغي',
    'انتهي',
    'لا',
    'false',
    'off',
    'stop',
    'hide',
    'disabled',
    'inactive',
    '0',
  ];
  return disabledKeywords.some((kw) => norm === kw || norm.includes(kw));
}

function isInstructionCellText(text: string): boolean {
  const norm = normalizeArabicText(text);
  return (
    norm.includes('عدل النص في الخليه') ||
    norm.includes('ارشادات الاستخدام') ||
    norm.includes('لاخفاء الشريط')
  );
}

/**
 * تحليل صفوف ورقة "شريط الإعلانات" واستخراج التنبيهات المفعلة فقط
 */
export function parseAnnouncementsFromRows(rows: string[][]): UrgentAnnouncementItem[] {
  if (!rows || rows.length === 0) return [];

  const nonEmptyRows = rows
    .map((r) => r.map((c) => String(c ?? '').trim()))
    .filter((r) => r.some((c) => c !== ''));

  if (nonEmptyRows.length === 0) return [];

  const firstRow = nonEmptyRows[0];
  const firstRowNorm = firstRow.map((c) => normalizeArabicText(c));

  const looksLikeHeader = firstRowNorm.some(
    (c) =>
      c.includes('الحاله') ||
      c.includes('نص الاعلان') ||
      c.includes('الاعلان العاجل') ||
      c.includes('الصف المستهدف') ||
      c.includes('تاريخ النشر') ||
      c.includes('ارشادات')
  );

  let statusIdx = 0;
  let textIdx = 1;
  let gradeIdx = 2;
  let dateIdx = 3;
  let startRow = 0;

  if (looksLikeHeader) {
    startRow = 1;
    const foundStatus = firstRowNorm.findIndex(
      (c) => c.includes('الحاله') || c === 'حاله' || c.includes('تفعيل')
    );
    const foundText = firstRowNorm.findIndex(
      (c) =>
        c.includes('نص') ||
        c.includes('اعلان') ||
        c.includes('تنبيه') ||
        c.includes('رساله') ||
        c.includes('الخبر')
    );
    const foundGrade = firstRowNorm.findIndex(
      (c) => c.includes('الصف') || c.includes('المستهدف') || c.includes('المرحله')
    );
    const foundDate = firstRowNorm.findIndex(
      (c) => c.includes('تاريخ') || c.includes('اليوم') || c.includes('وقت')
    );

    if (foundStatus !== -1) statusIdx = foundStatus;
    if (foundText !== -1) textIdx = foundText;
    if (foundGrade !== -1) gradeIdx = foundGrade;
    if (foundDate !== -1) dateIdx = foundDate;
  }

  const items: UrgentAnnouncementItem[] = [];

  for (let i = startRow; i < nonEmptyRows.length; i++) {
    const row = nonEmptyRows[i];

    if (looksLikeHeader) {
      const rawStatus = row[statusIdx] ?? '';
      let rawText = row[textIdx] ?? '';
      const rawGrade = row[gradeIdx] ?? '';
      const rawDate = row[dateIdx] ?? '';

      // إذا كتب المعلم النص في الخلية الأولى مباشرة دون كلمة "مفعل"
      if (
        !rawText &&
        rawStatus &&
        rawStatus.length > 12 &&
        !isAnnouncementStatusDisabled(rawStatus) &&
        !isInstructionCellText(rawStatus)
      ) {
        rawText = rawStatus;
      }

      if (!rawText || isInstructionCellText(rawText)) continue;
      if (isAnnouncementStatusDisabled(rawStatus)) continue;

      items.push({
        id: `ann_${i}_${rawText.slice(0, 24)}`,
        text: rawText,
        targetGrade: rawGrade && !isInstructionCellText(rawGrade) ? rawGrade : '',
        date: rawDate && !isInstructionCellText(rawDate) ? rawDate : '',
        status: rawStatus || 'مفعل',
      });
    } else {
      // في حال كتب المعلم سطراً واحداً مباشراً بدون صف عناوين
      const nonInstructionCells = row.filter((c) => c && !isInstructionCellText(c));
      if (nonInstructionCells.length === 0) continue;

      const firstCell = nonInstructionCells[0];
      if (isAnnouncementStatusDisabled(firstCell)) continue;

      let textCell = '';
      let gradeCell = '';
      let dateCell = '';

      if (nonInstructionCells.length === 1) {
        textCell = firstCell;
      } else {
        const firstNorm = normalizeArabicText(firstCell);
        const firstIsStatusKeyword =
          firstNorm === 'مفعل' ||
          firstNorm === 'نشط' ||
          firstNorm === 'تفعيل' ||
          firstNorm === 'نعم' ||
          firstNorm === '1' ||
          firstNorm.toLowerCase() === 'true';

        if (firstIsStatusKeyword) {
          textCell = nonInstructionCells[1] || '';
          gradeCell = nonInstructionCells[2] || '';
          dateCell = nonInstructionCells[3] || '';
        } else {
          textCell = firstCell;
          gradeCell = nonInstructionCells[1] || '';
          dateCell = nonInstructionCells[2] || '';
        }
      }

      if (!textCell || isAnnouncementStatusDisabled(textCell)) continue;

      items.push({
        id: `ann_raw_${i}_${textCell.slice(0, 24)}`,
        text: textCell,
        targetGrade: gradeCell,
        date: dateCell,
        status: 'مفعل',
      });
    }
  }

  return items;
}

let cachedAnnouncementGid: string = DEFAULT_ANNOUNCEMENT_GID;
let lastAnnouncementTabCheck = 0;

async function resolveAnnouncementTabGid(): Promise<string> {
  const now = Date.now();
  if (now - lastAnnouncementTabCheck > 60000) {
    lastAnnouncementTabCheck = now;
    try {
      const tabs = await discoverSpreadsheetTabs(DEFAULT_SPREADSHEET_ID);
      const found = tabs.find((t) => {
        const norm = normalizeArabicText(t.name);
        return (
          norm.includes('اعلان') ||
          norm.includes('تنبيه') ||
          norm.includes('شريط') ||
          norm.includes('عاجل')
        );
      });
      if (found?.gid) {
        cachedAnnouncementGid = found.gid;
      }
    } catch {
      // keep cachedAnnouncementGid
    }
  }
  return cachedAnnouncementGid;
}

export function getCachedAnnouncements(): UrgentAnnouncementItem[] {
  try {
    const raw = localStorage.getItem(ANNOUNCEMENTS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCachedAnnouncements(items: UrgentAnnouncementItem[]): void {
  try {
    localStorage.setItem(ANNOUNCEMENTS_CACHE_KEY, JSON.stringify(items));
  } catch {
    // ignore storage quota errors
  }
}

/**
 * جلب الإعلانات العاجلة مباشرة من شيت جوجل (`شريط الإعلانات` gid=514573363)
 */
export async function fetchLiveAnnouncementsFromGoogleSheets(): Promise<
  UrgentAnnouncementItem[] | null
> {
  const spreadsheetId = DEFAULT_SPREADSHEET_ID;
  const gid = await resolveAnnouncementTabGid();
  const timestamp = Date.now();

  // 1. القراءة المباشرة عبر CSV الخام لضمان سرعة واستجابة فورية بدون كاش
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}&_t=${timestamp}`;
    const res = await fetch(csvUrl, { cache: 'no-store' });
    if (res.ok) {
      const csvText = await res.text();
      if (!csvText.trim().startsWith('<!DOCTYPE html>')) {
        const rows = parseCsvToRows(csvText);
        const items = parseAnnouncementsFromRows(rows);
        saveCachedAnnouncements(items);
        return items;
      }
    }
  } catch {
    // المتابعة إلى gviz
  }

  // 2. القراءة عبر Google Visualization endpoint كبديل
  try {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&headers=0&gid=${gid}&_t=${timestamp}`;
    const res = await fetch(gvizUrl, { cache: 'no-store' });
    if (res.ok) {
      const text = await res.text();
      const rows = parseGvizResponse(text);
      const items = parseAnnouncementsFromRows(rows);
      saveCachedAnnouncements(items);
      return items;
    }
  } catch {
    // ignore transient network errors
  }

  return null;
}

/**
 * اشتراك لحظي (Real-time Subscription) لشريط الإعلانات العاجلة
 * يحدث الشريط تلقائياً كل 5 ثوانٍ وعند التركيز على النافذة ليظهر أي تعديل أو إيقاف في الشيت فوراً
 */
export function subscribeToRealtimeAnnouncements(
  onUpdate: (items: UrgentAnnouncementItem[]) => void
): () => void {
  let isMounted = true;
  let isPolling = false;
  let lastSerialized = '';

  const cached = getCachedAnnouncements();
  if (cached.length > 0) {
    lastSerialized = JSON.stringify(cached);
    onUpdate(cached);
  }

  const pollAnnouncements = async () => {
    if (!isMounted || isPolling) return;
    isPolling = true;
    try {
      const liveItems = await fetchLiveAnnouncementsFromGoogleSheets();
      if (isMounted && liveItems !== null) {
        const serialized = JSON.stringify(liveItems);
        if (serialized !== lastSerialized) {
          lastSerialized = serialized;
          onUpdate(liveItems);
        }
      }
    } catch {
      // ignore transient network error
    } finally {
      isPolling = false;
    }
  };

  pollAnnouncements();
  const intervalId = window.setInterval(pollAnnouncements, 5000);

  const handleFocusOrVisible = () => {
    if (isMounted && document.visibilityState !== 'hidden') {
      pollAnnouncements();
    }
  };

  window.addEventListener('focus', handleFocusOrVisible);
  document.addEventListener('visibilitychange', handleFocusOrVisible);

  return () => {
    isMounted = false;
    window.clearInterval(intervalId);
    window.removeEventListener('focus', handleFocusOrVisible);
    document.removeEventListener('visibilitychange', handleFocusOrVisible);
  };
}

// ============================================================================
// لوحة الشرف التلقائية للأوائل (Live Honor Roll from Google Sheets gid=1349515247)
// ============================================================================

export const DEFAULT_HONOR_ROLL_GID = '1349515247';
const HONOR_ROLL_CACHE_KEY = 'elgazzar_live_honor_roll_v1';

export interface HonorRollStudent {
  rank: number;
  rankLabel: string;
  studentCode: string;
  studentName: string;
  grade: string;
  group: string;
  examRate: string;
  homeworkRate: string;
  attendanceRate: string;
  overallRate: string;
  overallNumeric: number;
  extraFields?: Array<{ title: string; value: string }>;
}

export interface HonorRollData {
  sheetTitle: string;
  topLimitLabel: string;
  minThresholdLabel: string;
  honoredCountLabel: string;
  students: HonorRollStudent[];
}

function cleanPercentageDisplay(raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed || trimmed === '-') return '';
  const normalized = normalizeDigits(trimmed).replace(/٫/g, '.');
  // إذا كان رقماً عشرياً بين 0 و 1 من gviz مثل "0.988" نحوله إلى نسبة مئوية
  if (!normalized.includes('%')) {
    const num = Number(normalized);
    if (!Number.isNaN(num) && num > 0 && num <= 1) {
      return `${(num * 100).toFixed(1).replace(/\.0$/, '')}%`;
    }
  }
  return normalized;
}

function parseNumericPercentage(raw: string): number {
  const cleaned = cleanPercentageDisplay(raw).replace('%', '').trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

/**
 * تحليل ورقة "لوحة الشرف" واستخراج جميع الطلاب الأوائل المعروضين في الشيت أياً كان عددهم
 */
export function parseHonorRollFromRows(rows: string[][]): HonorRollData {
  const defaultData: HonorRollData = {
    sheetTitle: 'لوحة الشرف للمتفوقين',
    topLimitLabel: '',
    minThresholdLabel: '',
    honoredCountLabel: '',
    students: [],
  };

  if (!rows || rows.length === 0) return defaultData;

  const nonEmptyRows = rows
    .map((r) => r.map((c) => String(c ?? '').trim()))
    .filter((r) => r.some((c) => c !== ''));

  if (nonEmptyRows.length === 0) return defaultData;

  let headerRowIdx = -1;
  let rankIdx = 0;
  let codeIdx = 1;
  let nameIdx = 2;
  let gradeIdx = 3;
  let groupIdx = 4;
  let examIdx = 5;
  let homeworkIdx = 6;
  let attendanceIdx = 7;
  let overallIdx = 8;

  // البحث عن صف العناوين (المركز، كود الطالب، اسم الطالب، الصف الدراسي...)
  for (let r = 0; r < Math.min(nonEmptyRows.length, 6); r++) {
    const row = nonEmptyRows[r];
    const rowNorm = row.map((c) => normalizeArabicText(c));

    // استخراج بيانات الصف التعريفي العلوي إن وجد (مثل: حالة اللوحة: مفعل | عرض أفضل: 5 | الحد الأدنى: 80%)
    if (
      rowNorm.some(
        (c) =>
          c.includes('لوحه الشرف') ||
          c.includes('حاله اللوحه') ||
          c.includes('عرض افضل') ||
          c.includes('الحد الادني') ||
          c.includes('المكرمون')
      ) &&
      !rowNorm.some((c) => c.includes('اسم الطالب') || c.includes('كود الطالب'))
    ) {
      if (row[0] && normalizeArabicText(row[0]).includes('لوحه الشرف')) {
        defaultData.sheetTitle = row[0].replace(/^🏆\s*/, '').trim();
      }
      for (let c = 0; c < row.length; c++) {
        const cellNorm = rowNorm[c];
        if (cellNorm.includes('حاله اللوحه') && row[c + 1]) {
          if (isAnnouncementStatusDisabled(row[c + 1])) {
            return defaultData;
          }
        } else if (cellNorm.includes('عرض افضل') && row[c + 1]) {
          defaultData.topLimitLabel = normalizeDigits(row[c + 1]);
        } else if (cellNorm.includes('الحد الادني') && row[c + 1]) {
          defaultData.minThresholdLabel = cleanPercentageDisplay(row[c + 1]);
        } else if (cellNorm.includes('المكرمون')) {
          defaultData.honoredCountLabel = row[c];
        }
      }
      continue;
    }

    const hasStudentNameCol = rowNorm.some(
      (c) => c.includes('اسم الطالب') || c === 'الاسم' || c.includes('الطالب')
    );
    const hasGradeOrCodeCol = rowNorm.some(
      (c) =>
        c.includes('كود') ||
        c.includes('الصف') ||
        c.includes('المركز') ||
        c.includes('المعدل')
    );

    if (hasStudentNameCol && hasGradeOrCodeCol) {
      headerRowIdx = r;
      rowNorm.forEach((col, idx) => {
        if (col.includes('المركز') || col.includes('ترتيب')) rankIdx = idx;
        else if (col.includes('كود')) codeIdx = idx;
        else if (col.includes('اسم') || col === 'الطالب') nameIdx = idx;
        else if (col.includes('الصف') || col.includes('المرحله')) gradeIdx = idx;
        else if (col.includes('المجموعه') || col.includes('مجموعه') || col.includes('ميعاد'))
          groupIdx = idx;
        else if (col.includes('امتحان') || col.includes('اختبار')) examIdx = idx;
        else if (col.includes('واجب') || col.includes('مواظبه')) homeworkIdx = idx;
        else if (col.includes('حضور') || col.includes('غياب')) attendanceIdx = idx;
        else if (col.includes('المعدل') || col.includes('العام') || col.includes('المجموع'))
          overallIdx = idx;
      });
      break;
    }
  }

  const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;
  const headerRow = headerRowIdx !== -1 ? nonEmptyRows[headerRowIdx] : [];
  const knownIndices = new Set([
    rankIdx,
    codeIdx,
    nameIdx,
    gradeIdx,
    groupIdx,
    examIdx,
    homeworkIdx,
    attendanceIdx,
    overallIdx,
  ]);

  const students: HonorRollStudent[] = [];

  for (let i = startRow; i < nonEmptyRows.length; i++) {
    const row = nonEmptyRows[i];
    const rawName = (row[nameIdx] ?? '').trim();
    const rawCode = normalizeDigits(row[codeIdx] ?? '');
    const rawRank = normalizeDigits(row[rankIdx] ?? '');

    if (!rawName) continue;
    const nameNorm = normalizeArabicText(rawName);
    if (
      nameNorm === 'اسم الطالب' ||
      nameNorm === 'الاسم' ||
      nameNorm.includes('لوحه الشرف') ||
      nameNorm.includes('لا يوجد')
    ) {
      continue;
    }

    const parsedRank = Number(rawRank.replace(/[^0-9]/g, ''));
    const rank =
      Number.isFinite(parsedRank) && parsedRank > 0 ? parsedRank : students.length + 1;

    const rawGrade = (row[gradeIdx] ?? '').trim();
    const cleanedGroup = cleanRecordedGroup(row[groupIdx] ?? '');
    const examRate = cleanPercentageDisplay(row[examIdx] ?? '');
    const homeworkRate = cleanPercentageDisplay(row[homeworkIdx] ?? '');
    const attendanceRate = cleanPercentageDisplay(row[attendanceIdx] ?? '');
    const overallRate = cleanPercentageDisplay(row[overallIdx] ?? '');
    const overallNumeric = parseNumericPercentage(
      overallRate || examRate || attendanceRate
    );

    const extraFields: Array<{ title: string; value: string }> = [];
    for (let c = 0; c < row.length; c++) {
      if (knownIndices.has(c)) continue;
      const val = (row[c] ?? '').trim();
      const title = (headerRow[c] ?? '').trim();
      if (val && val !== '-' && title) {
        extraFields.push({ title, value: val });
      }
    }

    students.push({
      rank,
      rankLabel: rawRank || String(rank),
      studentCode: rawCode,
      studentName: rawName,
      grade: rawGrade,
      group: cleanedGroup,
      examRate,
      homeworkRate,
      attendanceRate,
      overallRate,
      overallNumeric,
      extraFields: extraFields.length > 0 ? extraFields : undefined,
    });
  }

  defaultData.students = students;
  return defaultData;
}

let cachedHonorRollGid: string = DEFAULT_HONOR_ROLL_GID;
let lastHonorRollTabCheck = 0;

async function resolveHonorRollTabGid(): Promise<string> {
  const now = Date.now();
  if (now - lastHonorRollTabCheck > 60000) {
    lastHonorRollTabCheck = now;
    try {
      const tabs = await discoverSpreadsheetTabs(DEFAULT_SPREADSHEET_ID);
      const found = tabs.find((t) => {
        const norm = normalizeArabicText(t.name);
        return (
          norm.includes('شرف') ||
          norm.includes('اوائل') ||
          norm.includes('تكريم') ||
          norm.includes('متفوق')
        );
      });
      if (found?.gid) {
        cachedHonorRollGid = found.gid;
      }
    } catch {
      // keep cachedHonorRollGid
    }
  }
  return cachedHonorRollGid;
}

export function getCachedHonorRoll(): HonorRollData | null {
  try {
    const raw = localStorage.getItem(HONOR_ROLL_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.students)) {
      return parsed as HonorRollData;
    }
    return null;
  } catch {
    return null;
  }
}

function saveCachedHonorRoll(data: HonorRollData): void {
  try {
    localStorage.setItem(HONOR_ROLL_CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

/**
 * جلب بيانات لوحة الشرف مباشرة من شيت جوجل (`لوحة الشرف` gid=1349515247)
 */
export async function fetchLiveHonorRollFromGoogleSheets(): Promise<HonorRollData | null> {
  const spreadsheetId = DEFAULT_SPREADSHEET_ID;
  const gid = await resolveHonorRollTabGid();
  const timestamp = Date.now();

  // 1. القراءة المباشرة عبر CSV الخام لضمان قراءة جميع الأعمدة والنسب المئوية بدقة 100%
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}&_t=${timestamp}`;
    const res = await fetch(csvUrl, { cache: 'no-store' });
    if (res.ok) {
      const csvText = await res.text();
      if (!csvText.trim().startsWith('<!DOCTYPE html>')) {
        const rows = parseCsvToRows(csvText);
        const parsed = parseHonorRollFromRows(rows);
        saveCachedHonorRoll(parsed);
        return parsed;
      }
    }
  } catch {
    // المتابعة إلى gviz
  }

  // 2. القراءة عبر Google Visualization endpoint كبديل
  try {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&headers=0&gid=${gid}&_t=${timestamp}`;
    const res = await fetch(gvizUrl, { cache: 'no-store' });
    if (res.ok) {
      const text = await res.text();
      const rows = parseGvizResponse(text);
      const parsed = parseHonorRollFromRows(rows);
      saveCachedHonorRoll(parsed);
      return parsed;
    }
  } catch {
    // ignore transient network errors
  }

  return null;
}

/**
 * اشتراك لحظي مستمر (Real-time Subscription) للوحة الشرف
 * يحدث قائمة الأوائل والدرجات والأوسمة تلقائياً كل 6 ثوانٍ وعند التركيز على الصفحة
 */
export function subscribeToRealtimeHonorRoll(
  onUpdate: (data: HonorRollData) => void
): () => void {
  let isMounted = true;
  let isPolling = false;
  let lastSerialized = '';

  const cached = getCachedHonorRoll();
  if (cached && cached.students.length > 0) {
    lastSerialized = JSON.stringify(cached);
    onUpdate(cached);
  }

  const pollHonorRoll = async () => {
    if (!isMounted || isPolling) return;
    isPolling = true;
    try {
      const liveData = await fetchLiveHonorRollFromGoogleSheets();
      if (isMounted && liveData !== null) {
        const serialized = JSON.stringify(liveData);
        if (serialized !== lastSerialized) {
          lastSerialized = serialized;
          onUpdate(liveData);
        }
      }
    } catch {
      // ignore transient network error
    } finally {
      isPolling = false;
    }
  };

  pollHonorRoll();
  const intervalId = window.setInterval(pollHonorRoll, 6000);

  const handleFocusOrVisible = () => {
    if (isMounted && document.visibilityState !== 'hidden') {
      pollHonorRoll();
    }
  };

  window.addEventListener('focus', handleFocusOrVisible);
  document.addEventListener('visibilitychange', handleFocusOrVisible);

  return () => {
    isMounted = false;
    window.clearInterval(intervalId);
    window.removeEventListener('focus', handleFocusOrVisible);
    document.removeEventListener('visibilitychange', handleFocusOrVisible);
  };
}

// ============================================================================
// سجل الحضور والغياب الشهري للطلاب (Live Attendance: أرشيف الحضور + قاعدة بيانات الحضور)
// ============================================================================

export const DEFAULT_ATTENDANCE_GID = '213909958';
const ATTENDANCE_HISTORY_CACHE_KEY = 'elgazzar_student_attendance_history_v2';

interface CachedMonthSheetEntry {
  dates: string[];
  statuses: Array<AttendanceSessionStatus | null>;
  customDateStatuses?: Record<string, AttendanceSessionStatus>;
  lastUpdated?: string;
  updatedAt: number;
}

function loadCachedStudentAttendanceHistory(
  studentKey: string
): Record<number, CachedMonthSheetEntry> {
  try {
    const raw = localStorage.getItem(`${ATTENDANCE_HISTORY_CACHE_KEY}_${studentKey}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveCachedStudentAttendanceHistory(
  studentKey: string,
  history: Record<number, CachedMonthSheetEntry>
): void {
  try {
    localStorage.setItem(
      `${ATTENDANCE_HISTORY_CACHE_KEY}_${studentKey}`,
      JSON.stringify(history)
    );
  } catch {
    // ignore storage quota errors
  }
}

let cachedAttendanceGid: string = DEFAULT_ATTENDANCE_GID;
let lastAttendanceTabCheck = 0;

async function resolveAttendanceTabGid(): Promise<string> {
  const now = Date.now();
  if (now - lastAttendanceTabCheck > 60000) {
    lastAttendanceTabCheck = now;
    try {
      const tabs = await discoverSpreadsheetTabs(DEFAULT_SPREADSHEET_ID);
      const found = tabs.find((t) => {
        const norm = normalizeArabicText(t.name);
        return (norm.includes('حضور') || norm.includes('غياب')) && !norm.includes('قاعده');
      });
      if (found?.gid) {
        cachedAttendanceGid = found.gid;
      }
    } catch {
      // keep cachedAttendanceGid
    }
  }
  return cachedAttendanceGid;
}

async function fetchRawAttendanceSheetRows(): Promise<string[][]> {
  const spreadsheetId = DEFAULT_SPREADSHEET_ID;
  const gid = await resolveAttendanceTabGid();
  const timestamp = Date.now();

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
    // fallback to gviz
  }

  try {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&headers=0&gid=${gid}&_t=${timestamp}`;
    const res = await fetch(gvizUrl, { cache: 'no-store' });
    if (res.ok) {
      const text = await res.text();
      const rows = parseGvizResponse(text);
      if (rows.length > 0) return rows;
    }
  } catch {
    // ignore transient errors
  }

  return [];
}

async function fetchAttendanceDatabaseEntries(): Promise<AttendanceDatabaseEntry[]> {
  const spreadsheetId = DEFAULT_SPREADSHEET_ID;
  const timestamp = Date.now();

  try {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(
      'قاعدة بيانات الحضور'
    )}&_t=${timestamp}`;
    const res = await fetch(gvizUrl, { cache: 'no-store' });
    if (res.ok) {
      const text = await res.text();
      const rows = parseGvizResponse(text);
      return parseAttendanceDatabaseRows(rows);
    }
  } catch {
    // ignore transient error
  }

  return [];
}

/**
 * استخراج سجل الحضور والغياب الكامل للطالب من "أرشيف الحضور" و"قاعدة بيانات الحضور" لجميع الصفوف
 * مع حساب سلسلة الالتزام، وإجمالي الحضور التراكمي، وتاريخ آخر تحديث
 */
export async function fetchLiveStudentAttendance(
  student: StudentRecord
): Promise<StudentAttendanceData> {
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const currentMonthNumber = now.getMonth() + 1;

  const studentKey = getStudentFirestoreDocId(student.grade, student.id);
  const cachedHistory = loadCachedStudentAttendanceHistory(studentKey);

  let matchedGroupInAttendanceSheet = '';
  let sheetTodayIso = todayIso;
  let latestDbLastUpdated = '';

  const [archiveRows, databaseEntries] = await Promise.all([
    fetchRawAttendanceSheetRows(),
    fetchAttendanceDatabaseEntries(),
  ]);

  // 1. دمج سجلات "قاعدة بيانات الحضور" (تغطي جميع الصفوف والشهور المسجلة)
  const targetGradeNorm = normalizeAttendanceArabicText(student.grade);
  const matchingDbEntries = databaseEntries.filter((entry) => {
    if (!isMatchingAttendanceStudentCode(entry.studentCode, student.id)) return false;
    if (!entry.grade || !targetGradeNorm) return true;
    return normalizeAttendanceArabicText(entry.grade) === targetGradeNorm;
  });

  for (const dbEntry of matchingDbEntries) {
    const existing = cachedHistory[dbEntry.monthNumber];
    cachedHistory[dbEntry.monthNumber] = {
      dates: existing?.dates || [],
      statuses: dbEntry.statuses,
      customDateStatuses: existing?.customDateStatuses,
      lastUpdated: dbEntry.lastUpdated || existing?.lastUpdated || '',
      updatedAt: Date.now(),
    };
    if (dbEntry.lastUpdated) {
      latestDbLastUpdated = dbEntry.lastUpdated;
    }
  }

  // 2. قراءة أحدث حالة وتواريخ حصص من تبويب "أرشيف الحضور" (gid=213909958)
  if (archiveRows.length > 0) {
    const parsedArchive = parseAttendanceArchiveRows(archiveRows, now);
    sheetTodayIso = parsedArchive.sheetTodayIso || sheetTodayIso;

    const effectiveSheetMonth =
      parsedArchive.activeSheetMonth ||
      (parsedArchive.parsedIsoDates[0]
        ? Number(parsedArchive.parsedIsoDates[0].slice(5, 7))
        : currentMonthNumber);

    const matchedArchiveRow = parsedArchive.rows.find((row) =>
      isMatchingAttendanceStudentCode(row.studentCode, student.id)
    );

    if (matchedArchiveRow) {
      if (matchedArchiveRow.group) {
        matchedGroupInAttendanceSheet = matchedArchiveRow.group;
      }

      const hasAnyExplicitMark = matchedArchiveRow.statuses.some(
        (st) => st !== null && st !== 'upcoming'
      );

      if (hasAnyExplicitMark || parsedArchive.parsedIsoDates.length > 0) {
        const existing = cachedHistory[effectiveSheetMonth];
        cachedHistory[effectiveSheetMonth] = {
          dates: parsedArchive.parsedIsoDates,
          statuses: matchedArchiveRow.statuses,
          customDateStatuses: existing?.customDateStatuses,
          lastUpdated: existing?.lastUpdated || '',
          updatedAt: Date.now(),
        };
      }
    } else if (parsedArchive.parsedIsoDates.length > 0) {
      // حتى لو كان جدول الأرشيف مفتوحاً على صف آخر، نستفيد من تواريخ الحصص إن كانت نفس الشهر
      const existing = cachedHistory[effectiveSheetMonth];
      if (existing && (!existing.dates || existing.dates.length === 0)) {
        existing.dates = parsedArchive.parsedIsoDates;
      }
    }
  }

  // 3. فحص خانات شيت الصف الدراسي نفسه لأي تواريخ حضور أو غياب مسجلة مباشرة
  let gradeSheetAttendancePct: number | null = null;
  for (const scoreItem of student.scores || []) {
    const rawValStr = String(scoreItem.value ?? '');
    const titleNorm = normalizeArabicText(scoreItem.title);

    if (titleNorm.includes('نسبه الحضور') || titleNorm === 'الحضور') {
      const pctNum = parseNumericPercentage(rawValStr);
      if (pctNum > 0 && pctNum <= 100) {
        gradeSheetAttendancePct = pctNum;
      }
    }

    const combinedText = `${scoreItem.title} ${rawValStr}`;
    const customIso = parseFlexibleAttendanceDateToIso(
      combinedText,
      currentMonthNumber,
      now.getFullYear()
    );
    const customStatus =
      parseAttendanceCellStatus(rawValStr) || parseAttendanceCellStatus(scoreItem.title);
    if (customIso && customStatus && customStatus !== 'upcoming') {
      const mNum = Number(customIso.slice(5, 7));
      if (!cachedHistory[mNum]) {
        cachedHistory[mNum] = { dates: [], statuses: [], updatedAt: Date.now() };
      }
      if (!cachedHistory[mNum].customDateStatuses) {
        cachedHistory[mNum].customDateStatuses = {};
      }
      cachedHistory[mNum].customDateStatuses![customIso] = customStatus;
    }
  }

  saveCachedStudentAttendanceHistory(studentKey, cachedHistory);

  // 4. تحديد أيام حصص المجموعة الأسبوعية للطالب
  const effectiveGroupForSchedule =
    matchedGroupInAttendanceSheet || student.rawGroup || student.group || '';
  const weeklySchedule = resolveStudentWeeklySchedule(student.grade, effectiveGroupForSchedule);

  // 5. بناء سجل الحضور الشهري المنظم لكل شهر من شهور السنة الدراسية
  const monthsMap: Record<number, MonthlyAttendanceRecord> = {};

  for (const mNum of ACADEMIC_MONTHS_ORDER) {
    const year = getAcademicYearForMonth(mNum, sheetTodayIso);
    const cachedMonth = cachedHistory[mNum];

    const scheduledDates =
      cachedMonth &&
      cachedMonth.dates.length === 8 &&
      Number(cachedMonth.dates[0].slice(5, 7)) === mNum
        ? cachedMonth.dates
        : buildMonthScheduledDates(year, mNum, weeklySchedule.daysOfWeek);

    const sessions: AttendanceSessionItem[] = [];
    const customDateMap = { ...(cachedMonth?.customDateStatuses || {}) };

    const pastIndices: number[] = [];
    scheduledDates.forEach((dIso, idx) => {
      if (dIso <= sheetTodayIso) {
        pastIndices.push(idx);
      }
    });

    const hasExplicitSheetStatuses = Boolean(
      cachedMonth?.statuses?.some((st) => st !== null && st !== 'upcoming')
    );

    let impliedAbsentCountForCurrentMonth = 0;
    if (
      !hasExplicitSheetStatuses &&
      mNum === currentMonthNumber &&
      gradeSheetAttendancePct !== null &&
      gradeSheetAttendancePct < 100 &&
      pastIndices.length > 0
    ) {
      impliedAbsentCountForCurrentMonth = Math.max(
        1,
        Math.round(pastIndices.length * ((100 - gradeSheetAttendancePct) / 100))
      );
    }

    scheduledDates.forEach((isoDate, idx) => {
      const explicitStatus =
        customDateMap[isoDate] ||
        (cachedMonth?.statuses?.[idx] && cachedMonth.statuses[idx] !== 'upcoming'
          ? cachedMonth.statuses[idx]
          : null);

      delete customDateMap[isoDate];

      let finalStatus: AttendanceSessionStatus;
      let isExplicit = false;

      if (explicitStatus) {
        finalStatus = explicitStatus;
        isExplicit = true;
      } else if (isoDate > sheetTodayIso) {
        finalStatus = 'upcoming';
      } else if (impliedAbsentCountForCurrentMonth > 0) {
        if (idx >= pastIndices.length - impliedAbsentCountForCurrentMonth) {
          finalStatus = 'absent';
        } else {
          finalStatus = 'present';
        }
      } else if (hasExplicitSheetStatuses) {
        finalStatus = 'present';
      } else {
        // شهر غير مسجل له بيانات في الشيت: لا ننشئ حضور افتراضي غير مسجل
        finalStatus = 'upcoming';
      }

      const { dayNameAr, shortDate } = formatIsoDateDetails(isoDate);
      const { statusLabelAr: rawStatusLabel, fullSentenceAr } = buildAttendanceStatusPresentation(
        finalStatus,
        dayNameAr,
        shortDate
      );
      const statusLabelAr =
        finalStatus === 'upcoming' && isoDate <= sheetTodayIso && !hasExplicitSheetStatuses
          ? 'غير مسجل بعد'
          : rawStatusLabel;

      sessions.push({
        sessionIndex: idx + 1,
        sessionTitle: `الحصة ${idx + 1}`,
        isoDate,
        dayNameAr,
        shortDate,
        status: finalStatus,
        statusLabelAr,
        fullSentenceAr,
        isExplicitFromSheet: isExplicit,
      });
    });

    for (const [extraIso, extraStatus] of Object.entries(customDateMap)) {
      const { dayNameAr, shortDate } = formatIsoDateDetails(extraIso);
      const { statusLabelAr, fullSentenceAr } = buildAttendanceStatusPresentation(
        extraStatus,
        dayNameAr,
        shortDate
      );
      sessions.push({
        sessionIndex: sessions.length + 1,
        sessionTitle: `حصة إضافية`,
        isoDate: extraIso,
        dayNameAr,
        shortDate,
        status: extraStatus,
        statusLabelAr,
        fullSentenceAr,
        isExplicitFromSheet: true,
      });
    }

    sessions.sort((a, b) => a.isoDate.localeCompare(b.isoDate));
    sessions.forEach((s, idx) => {
      s.sessionIndex = idx + 1;
      if (s.sessionTitle.startsWith('الحصة')) {
        s.sessionTitle = `الحصة ${idx + 1}`;
      }
    });

    const presentCount = sessions.filter((s) => s.status === 'present').length;
    const absentCount = sessions.filter((s) => s.status === 'absent').length;
    const lateCount = sessions.filter((s) => s.status === 'late').length;
    const excusedCount = sessions.filter((s) => s.status === 'excused').length;
    const upcomingCount = sessions.filter((s) => s.status === 'upcoming').length;
    const recordedCount = presentCount + absentCount + lateCount + excusedCount;

    const attendancePercentage =
      recordedCount === 0
        ? 100
        : Math.round(((presentCount + excusedCount + lateCount * 0.75) / recordedCount) * 100);

    const commitmentBadge =
      recordedCount === 0
        ? 'لم تبدأ حصص الشهر بعد'
        : attendancePercentage >= 95
          ? 'التزام مثالي بالحضور'
          : attendancePercentage >= 85
            ? 'حضور منتظم ومتميز'
            : attendancePercentage >= 75
              ? 'حضور مقبول'
              : 'يحتاج الانتظام في الحضور';

    const monthNameAr = ARABIC_MONTH_NAMES[mNum] || `شهر ${mNum}`;
    monthsMap[mNum] = {
      monthNumber: mNum,
      monthNameAr,
      monthDisplayTitle: `شهر ${mNum} (${monthNameAr})`,
      year,
      sessions,
      presentCount,
      absentCount,
      lateCount,
      excusedCount,
      upcomingCount,
      recordedCount,
      attendancePercentage,
      commitmentBadge,
      hasSheetRecords: hasExplicitSheetStatuses,
      lastUpdated: cachedMonth?.lastUpdated || '',
    };
  }

  const insights = computeAttendanceTermInsights(monthsMap);
  const activeMonthRef = ACADEMIC_MONTHS_ORDER.includes(currentMonthNumber)
    ? currentMonthNumber
    : 11;
  const normGroupText = normalizeAttendanceArabicText(effectiveGroupForSchedule);
  const groupHasExplicitDays =
    normGroupText.includes('احد') ||
    normGroupText.includes('اربعاء') ||
    normGroupText.includes('اثنين') ||
    normGroupText.includes('خميس') ||
    normGroupText.includes('سبت') ||
    normGroupText.includes('ثلاثاء');

  const derivedFromSheetDates = groupHasExplicitDays
    ? null
    : deriveScheduleDaysLabelFromIsoDates(
        (monthsMap[activeMonthRef]?.sessions || []).map((s) => s.isoDate)
      );

  return {
    studentId: student.id,
    studentName: student.name,
    grade: student.grade,
    scheduleDaysLabel: derivedFromSheetDates || weeklySchedule.label,
    currentMonthNumber: activeMonthRef,
    availableMonths: ACADEMIC_MONTHS_ORDER,
    months: monthsMap,
    consecutivePresentStreak: insights.consecutivePresentStreak,
    totalRecordedPresent: insights.totalRecordedPresent,
    totalRecordedAbsent: insights.totalRecordedAbsent,
    totalRecordedSessions: insights.totalRecordedSessions,
    overallTermAttendancePercentage: insights.overallTermAttendancePercentage,
    lastUpdatedDate: latestDbLastUpdated,
  };
}

/**
 * اشتراك لحظي (Real-time Subscription) لسجل حضور وغياب الطالب من الشيت
 */
export function subscribeToRealtimeStudentAttendance(
  student: StudentRecord,
  onUpdate: (data: StudentAttendanceData) => void
): () => void {
  let isActive = true;
  let isPolling = false;
  let lastSerialized = '';

  const pollNow = async () => {
    if (!isActive || isPolling) return;
    isPolling = true;
    try {
      const liveData = await fetchLiveStudentAttendance(student);
      if (isActive && liveData) {
        const serialized = JSON.stringify(liveData);
        if (serialized !== lastSerialized) {
          lastSerialized = serialized;
          onUpdate(liveData);
        }
      }
    } catch {
      // ignore transient network errors
    } finally {
      isPolling = false;
    }
  };

  pollNow();
  const intervalId = window.setInterval(pollNow, 6000);
  const handleFocus = () => {
    if (isActive && document.visibilityState !== 'hidden') {
      pollNow();
    }
  };
  window.addEventListener('focus', handleFocus);
  document.addEventListener('visibilitychange', handleFocus);

  return () => {
    isActive = false;
    window.clearInterval(intervalId);
    window.removeEventListener('focus', handleFocus);
    document.removeEventListener('visibilitychange', handleFocus);
  };
}

// ============================================================================
// حالة الدفع والمصروفات الشهرية (Live Payment Status from gid=99901 & قاعدة بيانات الدفع)
// ============================================================================

export const DEFAULT_PAYMENT_GID = '99901';
const PAYMENT_CACHE_KEY_PREFIX = 'elgazzar_student_payment_v1_';

let cachedPaymentDashboardGid: string = DEFAULT_PAYMENT_GID;
let lastPaymentTabDiscovery = 0;

async function resolvePaymentDashboardGid(): Promise<string> {
  const now = Date.now();
  if (now - lastPaymentTabDiscovery > 60000) {
    lastPaymentTabDiscovery = now;
    try {
      const tabs = await discoverSpreadsheetTabs(DEFAULT_SPREADSHEET_ID);
      const found = tabs.find((t) => {
        const norm = normalizeArabicText(t.name);
        return (
          (norm.includes('دفع') || norm.includes('مصاريف') || norm.includes('سداد')) &&
          !norm.includes('قاعده')
        );
      });
      if (found?.gid) {
        cachedPaymentDashboardGid = found.gid;
      }
    } catch {
      // keep cachedPaymentDashboardGid
    }
  }
  return cachedPaymentDashboardGid;
}

function loadCachedStudentPayment(studentKey: string): StudentPaymentSummary | null {
  try {
    const raw = localStorage.getItem(`${PAYMENT_CACHE_KEY_PREFIX}${studentKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.currentMonth && parsed.previousMonth
      ? (parsed as StudentPaymentSummary)
      : null;
  } catch {
    return null;
  }
}

function saveCachedStudentPayment(
  studentKey: string,
  summary: StudentPaymentSummary | null
): void {
  try {
    if (summary) {
      localStorage.setItem(`${PAYMENT_CACHE_KEY_PREFIX}${studentKey}`, JSON.stringify(summary));
    }
  } catch {
    // ignore storage quota errors
  }
}

async function fetchPaymentDashboardRecords(): Promise<StudentPaymentRecord[]> {
  const spreadsheetId = DEFAULT_SPREADSHEET_ID;
  const gid = await resolvePaymentDashboardGid();
  const timestamp = Date.now();

  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}&_t=${timestamp}`;
    const res = await fetch(csvUrl, { cache: 'no-store' });
    if (res.ok) {
      const csvText = await res.text();
      if (!csvText.trim().startsWith('<!DOCTYPE html>')) {
        const rows = parseCsvToRows(csvText);
        return parsePaymentDashboardRows(rows);
      }
    }
  } catch {
    // fallback to gviz
  }

  try {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&headers=0&gid=${gid}&_t=${timestamp}`;
    const res = await fetch(gvizUrl, { cache: 'no-store' });
    if (res.ok) {
      const text = await res.text();
      const rows = parseGvizResponse(text);
      return parsePaymentDashboardRows(rows);
    }
  } catch {
    // ignore transient error
  }

  return [];
}

async function fetchPaymentDatabaseRecords(): Promise<StudentPaymentRecord[]> {
  const spreadsheetId = DEFAULT_SPREADSHEET_ID;
  const timestamp = Date.now();

  try {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(
      'قاعدة بيانات الدفع'
    )}&_t=${timestamp}`;
    const res = await fetch(gvizUrl, { cache: 'no-store' });
    if (res.ok) {
      const text = await res.text();
      const rows = parseGvizResponse(text);
      return parsePaymentDatabaseRows(rows);
    }
  } catch {
    // ignore transient error
  }

  return [];
}

/**
 * جلب حالة الدفع الحية للطالب من تبويب "حالة الدفع" و "قاعدة بيانات الدفع"
 * وحساب الشهر الحالي والشهر السابق تلقائياً حسب التقويم العالمي
 */
export async function fetchLiveStudentPayment(
  gradeName: string,
  studentCode: string
): Promise<StudentPaymentSummary | null> {
  const studentKey = getStudentFirestoreDocId(gradeName, studentCode);

  const [dashboardRecords, databaseRecords] = await Promise.all([
    fetchPaymentDashboardRecords(),
    fetchPaymentDatabaseRecords(),
  ]);

  const combinedRecords = [...dashboardRecords, ...databaseRecords];
  if (combinedRecords.length === 0) {
    return loadCachedStudentPayment(studentKey);
  }

  const summary = buildStudentPaymentSummary(
    combinedRecords,
    gradeName,
    studentCode,
    new Date()
  );

  if (summary) {
    saveCachedStudentPayment(studentKey, summary);
  }
  return summary;
}

/**
 * اشتراك لحظي (Real-time Subscription) لحالة الدفع الخاصة بالطالب
 * يتحدث تلقائياً كل 5 ثوانٍ وعند التركيز على الصفحة ليعكس أي تغيير في الشيت فوراً
 */
export function subscribeToRealtimeStudentPayment(
  gradeName: string,
  studentCode: string,
  onUpdate: (summary: StudentPaymentSummary | null, isLoaded: boolean) => void
): () => void {
  let isActive = true;
  let isPolling = false;
  let lastSerialized = '';

  const studentKey = getStudentFirestoreDocId(gradeName, studentCode);
  const rawCached = loadCachedStudentPayment(studentKey);
  const cached = rawCached
    ? applyCalendarDeadlineToPaymentSummary(rawCached, new Date())
    : null;
  if (cached) {
    lastSerialized = JSON.stringify(cached);
    onUpdate(cached, true);
  }

  const pollNow = async () => {
    if (!isActive || isPolling) return;
    isPolling = true;
    try {
      const liveSummary = await fetchLiveStudentPayment(gradeName, studentCode);
      if (!isActive) return;
      const evaluated = liveSummary
        ? applyCalendarDeadlineToPaymentSummary(liveSummary, new Date())
        : null;
      const serialized = JSON.stringify(evaluated);
      if (serialized !== lastSerialized || !cached) {
        lastSerialized = serialized;
        onUpdate(evaluated, true);
      }
    } catch {
      if (isActive) {
        const fallback = cached
          ? applyCalendarDeadlineToPaymentSummary(cached, new Date())
          : null;
        onUpdate(fallback, true);
      }
    } finally {
      isPolling = false;
    }
  };

  pollNow();
  const intervalId = window.setInterval(pollNow, 5000);
  const handleFocus = () => {
    if (isActive && document.visibilityState !== 'hidden') {
      pollNow();
    }
  };
  window.addEventListener('focus', handleFocus);
  document.addEventListener('visibilitychange', handleFocus);

  return () => {
    isActive = false;
    window.clearInterval(intervalId);
    window.removeEventListener('focus', handleFocus);
    document.removeEventListener('visibilitychange', handleFocus);
  };
}



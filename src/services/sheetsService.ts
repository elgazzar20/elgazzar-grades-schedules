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

export function getStudentFirestoreDocId(gradeName: string, studentCode: string): string {
  const gradeSlug = GRADE_SLUG_MAP[gradeName] || 'grade';
  const safeCode = studentCode.trim().replace(/[^a-zA-Z0-9_-]/g, '');
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
    const boundedScores = student.scores.slice(0, 30).map((s) => ({
      title: String(s.title || '').slice(0, 120),
      value: String(s.value || '').slice(0, 120),
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
 * تحويل صفوف الجدول (2D array) إلى سجل طالب مع قراءة كافة الأعمدة الإضافية (من العمود الخامس فصاعداً) تلقائياً
 */
function parseStudentFromRows(
  rows: string[][],
  gradeName: string,
  studentCode: string
): StudentRecord | null {
  if (!rows || rows.length < 2) return null;
  const headers = rows[0].map((h) => String(h || '').trim());
  const targetId = studentCode.trim();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const rowId = String(row[0] || '').trim();
    if (rowId === targetId) {
      const scores: { title: string; value: string }[] = [];
      for (let c = 4; c < headers.length; c++) {
        const colTitle = headers[c];
        const cellVal = row[c] !== undefined && row[c] !== null ? String(row[c]).trim() : '';
        if (colTitle && cellVal !== '') {
          scores.push({
            title: colTitle,
            value: cellVal,
          });
        }
      }

      return {
        id: rowId,
        name: String(row[1] || 'طالب').trim(),
        group: String(row[2] || 'المجموعة الأساسية').trim(),
        note: String(row[3] || '').trim(),
        grade: gradeName,
        scores,
      };
    }
  }

  return null;
}

/**
 * تحليل رد Google Visualization JSONP/JSON من شيت الأستاذ محمد الجزار
 * يدعم كلاً من عناوين الأعمدة في cols.label أو في الصف الأول rows[0]
 */
function parseGvizResponse(text: string): string[][] {
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

  const cols: string[] = (table.cols || []).map((col: { label?: string }) =>
    String(col?.label || '').trim()
  );

  const resultRows: string[][] = [];
  const hasColumnLabels = cols.some((label) => label !== '');
  if (hasColumnLabels) {
    resultRows.push(cols);
  }

  table.rows.forEach((r: { c?: Array<{ v?: unknown; f?: string } | null> }) => {
    const cells = (r.c || []).map((cell) => {
      if (!cell) return '';
      if (cell.f !== undefined && cell.f !== null) return String(cell.f).trim();
      if (cell.v !== undefined && cell.v !== null) return String(cell.v).trim();
      return '';
    });
    resultRows.push(cells);
  });

  return resultRows;
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

  // 1. القراءة الفورية المباشرة من شيت جوجل الخارجي (تعمل لكل الطلاب على أي دومين لحظياً)
  try {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(gradeName)}&headers=0&_t=${Date.now()}`;
    const res = await fetch(gvizUrl, { cache: 'no-store' });
    if (res.ok) {
      const text = await res.text();
      const rows = parseGvizResponse(text);
      if (rows.length > 0) {
        const student = parseStudentFromRows(rows, gradeName, studentCode);
        if (student) {
          await syncStudentRecordToFirestore(student);
        }
        return { handled: true, student };
      }
    }
  } catch {
    // في حال تعذر الاتصال بـ gviz يجرب API v4 أو Firestore
  }

  // 2. القراءة عبر Google Sheets API v4 في حال وجود توكن مفعل
  const token = await getAccessToken();
  if (token) {
    try {
      const range = encodeURIComponent(`'${gradeName}'!A1:Z500`);
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
          name: String(data.name ?? 'طالب'),
          grade: String(data.grade ?? gradeName),
          group: String(data.group ?? 'المجموعة الأساسية'),
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
 * يجمع بين:
 * 1. مستمع Firebase Firestore الفوري (onSnapshot)
 * 2. متابعة حية للشيت الخارجي (`1zwgiuQzBFJ7WpRvfp88KaE5z-3me9tx0MB6i4WYDaiQ`) كل 4 ثوانٍ
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
          name: String(data.name ?? 'طالب'),
          grade: String(data.grade ?? gradeName),
          group: String(data.group ?? 'المجموعة الأساسية'),
          note: String(data.note ?? ''),
          scores: Array.isArray(data.scores) ? data.scores : [],
        });
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );

  const intervalId = window.setInterval(async () => {
    try {
      const res = await fetchLiveStudentFromGoogleSheets(gradeName, studentCode);
      if (res.handled && res.student) {
        onUpdate(res.student);
      }
    } catch {
      // ignore transient network errors
    }
  }, 4000);

  return () => {
    unsubscribeFirestore();
    window.clearInterval(intervalId);
  };
}

/**
 * تحديد المرحلة الدراسية تلقائياً من عمود المرحلة أو عمود الصف في شيت المواعيد
 */
function resolveScheduleStageId(stageText: string, gradeText: string): StageId | null {
  const normalize = (s: string) =>
    s
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .trim();

  const combined = `${normalize(stageText)} ${normalize(gradeText)}`;
  if (combined.includes('ابتدا')) return 'primary';
  if (combined.includes('اعداد')) return 'prep';
  if (combined.includes('ثانو')) return 'secondary';
  return null;
}

/**
 * تحليل صفوف شيت المواعيد (`1m5y12DU0jgtBsShGVihBuzlk3pTVhKezIwGtTnV0x9A`)
 * وتحويلها إلى جدول منسق لكل مرحلة وصف دراسي
 */
export function parseSchedulesFromRows(rows: string[][]): StageSchedulesMap | null {
  if (!rows || rows.length === 0) return null;

  const firstRowJoined = rows[0].map((c) => String(c || '').trim()).join(' ');
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

    // تحديد الأيام والساعة بذكاء سواء عدّل المعلم عمود الأيام/الساعة أو عمود الموعد الكامل
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
      // في حال قام المعلم بتعديل عمود "الموعد الكامل (للعرض في الموقع)" مباشرةً
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

    // تجميع أي ملاحظات إضافية من العمود السابع فصاعداً
    const extraNotes: string[] = [];
    if (statusNoteRaw) extraNotes.push(statusNoteRaw);
    for (let c = 7; c < row.length; c++) {
      const extraCell = String(row[c] || '').trim();
      if (extraCell) extraNotes.push(extraCell);
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
      groupLabel: groupLabelRaw || `المجموعة ${gradeGroup.sessions.length + 1}`,
      days: finalDays || fullTextRaw,
      time: finalTime,
      statusNote: extraNotes.join(' · ') || undefined,
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
      const boundedGroups = (schedules[stageId] || []).slice(0, 20).map((g) => ({
        gradeTitle: String(g.gradeTitle || '').slice(0, 120),
        sessions: (g.sessions || []).slice(0, 20).map((s) => ({
          groupLabel: String(s.groupLabel || '').slice(0, 120),
          days: String(s.days || '').slice(0, 160),
          time: String(s.time || '').slice(0, 120),
          statusNote: String(s.statusNote || '').slice(0, 200),
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
 */
export async function fetchLiveSchedulesFromGoogleSheets(): Promise<StageSchedulesMap | null> {
  const spreadsheetId = DEFAULT_SCHEDULE_SPREADSHEET_ID;

  // 1. القراءة الفورية المباشرة عبر Google Visualization endpoint
  try {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&headers=0&_t=${Date.now()}`;
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
    // في حال تعذر الاتصال بـ gviz يجرب API v4 أو Firestore
  }

  // 2. القراءة عبر Google Sheets API v4 في حال وجود توكن مفعل
  const token = await getAccessToken();
  if (token) {
    try {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:Z200`,
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

  // 3. القراءة من Firebase Firestore في حال انقطاع اتصال جوجل شيت المؤقت
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
 * يقرأ مباشرةً من الشيت الخارجي (`1m5y12DU0jgtBsShGVihBuzlk3pTVhKezIwGtTnV0x9A`) ويحدّث المواعيد تلقائياً فور أي تعديل
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

  // جلب فوري عند فتح الموقع
  pollSheet();

  // متابعة دورية كل 4 ثوانٍ لأي تعديل في شيت المواعيد
  const intervalId = window.setInterval(pollSheet, 4000);

  return () => {
    isMounted = false;
    window.clearInterval(intervalId);
  };
}


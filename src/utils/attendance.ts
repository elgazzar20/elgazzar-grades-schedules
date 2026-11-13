export type AttendanceSessionStatus = 'present' | 'absent' | 'late' | 'excused' | 'upcoming';

export interface AttendanceSessionItem {
  sessionIndex: number;
  sessionTitle: string;
  isoDate: string;
  dayNameAr: string;
  shortDate: string;
  status: AttendanceSessionStatus;
  statusLabelAr: string;
  fullSentenceAr: string;
  isExplicitFromSheet: boolean;
}

export interface MonthlyAttendanceRecord {
  monthNumber: number;
  monthNameAr: string;
  monthDisplayTitle: string;
  year: number;
  sessions: AttendanceSessionItem[];
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  upcomingCount: number;
  recordedCount: number;
  attendancePercentage: number;
  commitmentBadge: string;
  hasSheetRecords: boolean;
  lastUpdated: string;
}

export interface StudentAttendanceData {
  studentId: string;
  studentName: string;
  grade: string;
  scheduleDaysLabel: string;
  currentMonthNumber: number;
  availableMonths: number[];
  months: Record<number, MonthlyAttendanceRecord>;
  consecutivePresentStreak: number;
  totalRecordedPresent: number;
  totalRecordedAbsent: number;
  totalRecordedSessions: number;
  overallTermAttendancePercentage: number;
  lastUpdatedDate: string;
}

export interface AttendanceDatabaseEntry {
  grade: string;
  monthNumber: number;
  studentCode: string;
  statuses: Array<AttendanceSessionStatus | null>;
  lastUpdated: string;
}

export interface ParsedAttendanceArchive {
  activeSheetMonth: number | null;
  sheetTodayIso: string;
  parsedIsoDates: string[];
  rows: Array<{
    studentCode: string;
    group: string;
    statuses: Array<AttendanceSessionStatus | null>;
  }>;
}

export const ARABIC_MONTH_NAMES: Record<number, string> = {
  1: 'يناير',
  2: 'فبراير',
  3: 'مارس',
  4: 'أبريل',
  5: 'مايو',
  6: 'يونيو',
  7: 'يوليو',
  8: 'أغسطس',
  9: 'سبتمبر',
  10: 'أكتوبر',
  11: 'نوفمبر',
  12: 'ديسمبر',
};

export const ACADEMIC_MONTHS_ORDER: number[] = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];

const ARABIC_WEEKDAY_NAMES: Record<number, string> = {
  0: 'الأحد',
  1: 'الإثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
  6: 'السبت',
};

export function normalizeAttendanceDigits(input: string): string {
  return String(input || '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .trim();
}

export function normalizeAttendanceArabicText(input: string): string {
  return String(input || '')
    .replace(/^الصف\s+/, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isMatchingAttendanceStudentCode(rowCodeRaw: string, targetCodeRaw: string): boolean {
  const cleanRow = normalizeAttendanceDigits(rowCodeRaw);
  const cleanTarget = normalizeAttendanceDigits(targetCodeRaw);
  if (!cleanRow || !cleanTarget) return false;
  if (cleanRow === cleanTarget) return true;
  if (/^\d+$/.test(cleanRow) && /^\d+$/.test(cleanTarget)) {
    return cleanRow.replace(/^0+/, '') === cleanTarget.replace(/^0+/, '');
  }
  return false;
}

export function parseArabicAttendanceMonthName(raw: string): number | null {
  const norm = normalizeAttendanceArabicText(raw);
  if (!norm) return null;
  if (norm.includes('يناير') || norm === '1' || norm.includes('شهر 1')) return 1;
  if (norm.includes('فبراير') || norm === '2' || norm.includes('شهر 2')) return 2;
  if (norm.includes('مارس') || norm === '3' || norm.includes('شهر 3')) return 3;
  if (norm.includes('ابريل') || norm === '4' || norm.includes('شهر 4')) return 4;
  if (norm.includes('مايو') || norm === '5' || norm.includes('شهر 5')) return 5;
  if (norm.includes('يونيو') || norm === '6' || norm.includes('شهر 6')) return 6;
  if (norm.includes('يوليو') || norm === '7' || norm.includes('شهر 7')) return 7;
  if (norm.includes('اغسطس') || norm === '8' || norm.includes('شهر 8')) return 8;
  if (norm.includes('سبتمبر') || norm === '9' || norm.includes('شهر 9')) return 9;
  if (norm.includes('اكتوبر') || norm === '10' || norm.includes('شهر 10')) return 10;
  if (norm.includes('نوفمبر') || norm === '11' || norm.includes('شهر 11')) return 11;
  if (norm.includes('ديسمبر') || norm === '12' || norm.includes('شهر 12')) return 12;
  return null;
}

export function parseAttendanceCellStatus(rawCell: string): AttendanceSessionStatus | null {
  const trimmed = String(rawCell || '').trim();
  if (!trimmed || trimmed === '-') return null;
  const norm = normalizeAttendanceArabicText(trimmed).toLowerCase();

  if (
    norm.includes('لم يسجل') ||
    norm.includes('لم تحن') ||
    norm.includes('قادم') ||
    norm.includes('منتظر')
  ) {
    return 'upcoming';
  }
  if (
    norm.includes('غائب') ||
    norm.includes('غاب') ||
    norm.includes('غياب') ||
    norm === '✗' ||
    norm === '✘' ||
    norm === 'x' ||
    norm === '0' ||
    norm === 'لا'
  ) {
    return 'absent';
  }
  if (norm.includes('متاخر') || norm.includes('تاخير') || norm.includes('تاخر')) {
    return 'late';
  }
  if (norm.includes('معذور') || norm.includes('بعذر') || norm.includes('عذر') || norm.includes('اذن')) {
    return 'excused';
  }
  if (
    norm.includes('حاضر') ||
    norm.includes('حضر') ||
    norm.includes('حضور') ||
    norm === '✓' ||
    norm === '✔' ||
    norm === '1' ||
    norm === 'نعم'
  ) {
    return 'present';
  }
  return null;
}

export function formatAttendanceDisplayDate(rawDate: string): string {
  const clean = normalizeAttendanceDigits(rawDate).trim();
  if (!clean || clean === '-') return '';

  const isoMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[3].padStart(2, '0')}/${isoMatch[2].padStart(2, '0')}/${isoMatch[1]}`;
  }

  const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[1].padStart(2, '0')}/${dmyMatch[2].padStart(2, '0')}/${dmyMatch[3]}`;
  }

  return clean;
}

export function parseFlexibleAttendanceDateToIso(
  rawDateStr: string,
  fallbackMonth: number,
  fallbackYear: number
): string | null {
  const clean = normalizeAttendanceDigits(rawDateStr).trim();
  if (!clean) return null;

  const isoMatch = clean.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  const dmMatch = clean.match(/(?:^|\s)(\d{1,2})[/-](\d{1,2})(?:\s|$)/);
  if (dmMatch) {
    const d = Number(dmMatch[1]);
    const m = Number(dmMatch[2]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const y = m >= 8 ? (fallbackMonth >= 8 ? fallbackYear : fallbackYear - 1) : fallbackYear;
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  return null;
}

export function formatIsoDateDetails(isoDate: string): {
  dayNameAr: string;
  shortDate: string;
  monthNumber: number;
  year: number;
} {
  const parts = isoDate.split('-').map(Number);
  const year = parts[0] || 2026;
  const monthNumber = parts[1] || 11;
  const day = parts[2] || 1;
  const dt = new Date(Date.UTC(year, monthNumber - 1, day));
  const dow = dt.getUTCDay();
  const dayNameAr = ARABIC_WEEKDAY_NAMES[dow] || 'اليوم';
  const shortDate = `${day}/${monthNumber}`;
  return { dayNameAr, shortDate, monthNumber, year };
}

export function buildAttendanceStatusPresentation(
  status: AttendanceSessionStatus,
  dayNameAr: string,
  shortDate: string
): { statusLabelAr: string; fullSentenceAr: string } {
  switch (status) {
    case 'present':
      return {
        statusLabelAr: 'حضر',
        fullSentenceAr: `حضر يوم ${dayNameAr} ${shortDate}`,
      };
    case 'absent':
      return {
        statusLabelAr: 'غاب',
        fullSentenceAr: `غاب يوم ${dayNameAr} ${shortDate}`,
      };
    case 'late':
      return {
        statusLabelAr: 'متأخر',
        fullSentenceAr: `تأخر يوم ${dayNameAr} ${shortDate}`,
      };
    case 'excused':
      return {
        statusLabelAr: 'معذور',
        fullSentenceAr: `إذن يوم ${dayNameAr} ${shortDate}`,
      };
    default:
      return {
        statusLabelAr: 'لم تحن بعد',
        fullSentenceAr: `يوم ${dayNameAr} ${shortDate}`,
      };
  }
}

export function resolveStudentWeeklySchedule(
  gradeName: string,
  groupText: string
): { label: string; daysOfWeek: [number, number] } {
  const normGroup = normalizeAttendanceArabicText(groupText);
  if (normGroup.includes('احد') || normGroup.includes('اربعاء')) {
    return { label: 'الأحد والأربعاء', daysOfWeek: [0, 3] };
  }
  if (normGroup.includes('اثنين') || normGroup.includes('خميس')) {
    return { label: 'الإثنين والخميس', daysOfWeek: [1, 4] };
  }
  if (normGroup.includes('سبت') || normGroup.includes('ثلاثاء')) {
    return { label: 'السبت والثلاثاء', daysOfWeek: [6, 2] };
  }

  const normGrade = normalizeAttendanceArabicText(gradeName);
  if (
    normGrade.includes('السادس') ||
    normGrade.includes('الاول الثانوي') ||
    normGrade.includes('الثاني الثانوي')
  ) {
    return { label: 'الإثنين والخميس', daysOfWeek: [1, 4] };
  }
  return { label: 'السبت والثلاثاء', daysOfWeek: [6, 2] };
}

/**
 * استنتاج أيام الحصص الأسبوعية الفعلية من تواريخ الحصص المسجلة بالشيت
 */
export function deriveScheduleDaysLabelFromIsoDates(isoDates: string[]): string | null {
  if (!isoDates || isoDates.length === 0) return null;
  const counts = new Map<number, number>();
  for (const iso of isoDates) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue;
    const [y, m, d] = iso.split('-').map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    counts.set(dow, (counts.get(dow) || 0) + 1);
  }
  if (counts.size === 0) return null;
  const topDays = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([dow]) => dow);

  const has = (d: number) => topDays.includes(d);
  if (has(0) && has(3)) return 'الأحد والأربعاء';
  if (has(1) && has(4)) return 'الإثنين والخميس';
  if (has(6) && has(2)) return 'السبت والثلاثاء';
  if (topDays.length === 2) {
    return `${ARABIC_WEEKDAY_NAMES[topDays[0]] || ''} و${ARABIC_WEEKDAY_NAMES[topDays[1]] || ''}`.trim();
  }
  return ARABIC_WEEKDAY_NAMES[topDays[0]] || null;
}

/**
 * تنسيق صيغة الجمع العربي لعدد الحصص بشكل سليم نحوياً
 */
export function formatArabicSessionCount(count: number, consecutive = false): string {
  const n = Math.max(0, Math.floor(count));
  if (n === 1) {
    return consecutive ? 'حصة واحدة متتالية' : 'حصة واحدة';
  }
  if (n === 2) {
    return consecutive ? 'حصتان متتاليتان' : 'حصتان';
  }
  if (n >= 3 && n <= 10) {
    return consecutive ? `${n} حصص متتالية` : `${n} حصص`;
  }
  return consecutive ? `${n} حصة متتالية` : `${n} حصة`;
}

export function getAcademicYearForMonth(monthNumber: number, referenceTodayIso: string): number {
  const refYear = Number(referenceTodayIso.slice(0, 4)) || 2026;
  const refMonth = Number(referenceTodayIso.slice(5, 7)) || 11;
  const academicStartYear = refMonth >= 8 ? refYear : refYear - 1;
  return monthNumber >= 8 ? academicStartYear : academicStartYear + 1;
}

export function buildMonthScheduledDates(
  year: number,
  monthNumber: number,
  daysOfWeek: [number, number]
): string[] {
  const dates: string[] = [];
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const dt = new Date(Date.UTC(year, monthNumber - 1, day));
    const dow = dt.getUTCDay();
    if (dow === daysOfWeek[0] || dow === daysOfWeek[1]) {
      const mm = String(monthNumber).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      dates.push(`${year}-${mm}-${dd}`);
      if (dates.length === 8) break;
    }
  }
  return dates;
}

/**
 * تحليل صفوف ورقة "قاعدة بيانات الحضور" (تضم جميع الطلاب عبر جميع الصفوف والشهور المسجلة)
 */
export function parseAttendanceDatabaseRows(rows: string[][]): AttendanceDatabaseEntry[] {
  if (!rows || rows.length < 2) return [];
  const headers = (rows[0] || []).map((h) => String(h || '').trim());

  let gradeIdx = 1;
  let monthIdx = 2;
  let codeIdx = 3;
  let lastUpdatedIdx = -1;
  const sessionCols: number[] = [];

  headers.forEach((h, idx) => {
    const norm = normalizeAttendanceArabicText(h);
    if (norm === 'الصف' || norm.includes('الصف الدراسي')) {
      gradeIdx = idx;
    } else if (norm === 'الشهر' || norm.includes('الشهر الدراسي')) {
      monthIdx = idx;
    } else if (norm.includes('كود')) {
      codeIdx = idx;
    } else if (norm.startsWith('الحصه')) {
      sessionCols.push(idx);
    } else if (norm.includes('اخر تحديث') || norm.includes('تاريخ التحديث')) {
      lastUpdatedIdx = idx;
    }
  });

  const effectiveSessionCols =
    sessionCols.length > 0 ? sessionCols : [4, 5, 6, 7, 8, 9, 10, 11];

  const entries: AttendanceDatabaseEntry[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const studentCode = normalizeAttendanceDigits(String(row[codeIdx] || ''));
    if (!studentCode) continue;

    const grade = String(row[gradeIdx] || '').trim();
    const monthNum = parseArabicAttendanceMonthName(String(row[monthIdx] || ''));
    if (!monthNum) continue;

    const statuses = effectiveSessionCols.map((cIdx) =>
      parseAttendanceCellStatus(String(row[cIdx] || ''))
    );

    entries.push({
      grade,
      monthNumber: monthNum,
      studentCode,
      statuses,
      lastUpdated:
        lastUpdatedIdx !== -1 ? formatAttendanceDisplayDate(String(row[lastUpdatedIdx] || '')) : '',
    });
  }

  return entries;
}

/**
 * تحليل صفوف تبويب "أرشيف الحضور" (gid=213909958)
 */
export function parseAttendanceArchiveRows(
  rows: string[][],
  referenceDate: Date = new Date()
): ParsedAttendanceArchive {
  const currentMonthNumber = referenceDate.getMonth() + 1;
  const defaultTodayIso = `${referenceDate.getFullYear()}-${String(currentMonthNumber).padStart(
    2,
    '0'
  )}-${String(referenceDate.getDate()).padStart(2, '0')}`;

  if (!rows || rows.length === 0) {
    return {
      activeSheetMonth: null,
      sheetTodayIso: defaultTodayIso,
      parsedIsoDates: [],
      rows: [],
    };
  }

  let activeSheetMonth: number | null = null;
  let sheetTodayIso = defaultTodayIso;

  for (let r = 0; r < Math.min(rows.length, 6); r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const cellNorm = normalizeAttendanceArabicText(row[c] || '');
      if (cellNorm.includes('الشهر الدراسي') && rows[r + 1]?.[c]) {
        activeSheetMonth = parseArabicAttendanceMonthName(rows[r + 1][c]);
      }
      if (cellNorm.includes('التاريخ') && rows[r + 1]?.[c]) {
        const parsedToday = parseFlexibleAttendanceDateToIso(
          rows[r + 1][c],
          currentMonthNumber,
          referenceDate.getFullYear()
        );
        if (parsedToday) sheetTodayIso = parsedToday;
      }
    }
  }

  let datesRow: string[] = [];
  let headerRowIdx = -1;
  let codeColIdx = 2;
  let groupColIdx = 4;
  let sessionColIndices: number[] = [5, 6, 7, 8, 9, 10, 11, 12];

  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r] || [];
    const joinedNorm = normalizeAttendanceArabicText(row.join(' '));
    if (joinedNorm.includes('تواريخ الحصص')) {
      datesRow = row;
    }
    if (
      joinedNorm.includes('كود الطالب') &&
      (joinedNorm.includes('الحصه 1') || joinedNorm.includes('اسم الطالب'))
    ) {
      headerRowIdx = r;
      const foundSessionCols: number[] = [];
      row.forEach((cell, cIdx) => {
        const cNorm = normalizeAttendanceArabicText(cell);
        if (cNorm.includes('كود')) codeColIdx = cIdx;
        else if (cNorm.includes('المجموعه') || cNorm === 'مجموعه') groupColIdx = cIdx;
        else if (
          cNorm.startsWith('الحصه') ||
          parseFlexibleAttendanceDateToIso(cell, currentMonthNumber, referenceDate.getFullYear())
        ) {
          foundSessionCols.push(cIdx);
        }
      });
      if (foundSessionCols.length > 0) {
        sessionColIndices = foundSessionCols;
      }
      break;
    }
  }

  const rawSessionDates: string[] = sessionColIndices.map((cIdx) =>
    String(datesRow[cIdx] || rows[headerRowIdx]?.[cIdx] || '').trim()
  );

  const parsedIsoDates: string[] = [];
  for (const rawD of rawSessionDates) {
    const iso = parseFlexibleAttendanceDateToIso(
      rawD,
      activeSheetMonth || currentMonthNumber,
      referenceDate.getFullYear()
    );
    if (iso) parsedIsoDates.push(iso);
  }

  const startSearchRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 9;
  const studentRows: ParsedAttendanceArchive['rows'] = [];

  for (let r = startSearchRow; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const studentCode = normalizeAttendanceDigits(String(row[codeColIdx] || ''));
    if (!studentCode) continue;
    const group = String(row[groupColIdx] || '').trim();
    const statuses = sessionColIndices.map((cIdx) =>
      parseAttendanceCellStatus(String(row[cIdx] || ''))
    );
    studentRows.push({ studentCode, group, statuses });
  }

  return {
    activeSheetMonth,
    sheetTodayIso,
    parsedIsoDates,
    rows: studentRows,
  };
}

/**
 * حساب سلسلة الالتزام المتتالية والإحصائيات التراكمية من الجلسات المسجلة فعلياً
 */
export function computeAttendanceTermInsights(monthsMap: Record<number, MonthlyAttendanceRecord>): {
  consecutivePresentStreak: number;
  totalRecordedPresent: number;
  totalRecordedAbsent: number;
  totalRecordedSessions: number;
  overallTermAttendancePercentage: number;
} {
  const orderedMonthsWithRecords = ACADEMIC_MONTHS_ORDER.map((mNum) => monthsMap[mNum]).filter(
    (m): m is MonthlyAttendanceRecord => Boolean(m && m.hasSheetRecords && m.recordedCount > 0)
  );

  let totalRecordedPresent = 0;
  let totalRecordedAbsent = 0;
  let totalRecordedSessions = 0;
  let weightedPoints = 0;

  const chronologicalRecordedSessions: AttendanceSessionItem[] = [];

  for (const monthRec of orderedMonthsWithRecords) {
    totalRecordedPresent += monthRec.presentCount;
    totalRecordedAbsent += monthRec.absentCount;
    totalRecordedSessions += monthRec.recordedCount;
    weightedPoints += monthRec.presentCount + monthRec.excusedCount + monthRec.lateCount * 0.75;

    for (const s of monthRec.sessions) {
      if (s.status !== 'upcoming') {
        chronologicalRecordedSessions.push(s);
      }
    }
  }

  let consecutivePresentStreak = 0;
  for (let i = chronologicalRecordedSessions.length - 1; i >= 0; i--) {
    const st = chronologicalRecordedSessions[i].status;
    if (st === 'present' || st === 'excused') {
      consecutivePresentStreak += 1;
    } else {
      break;
    }
  }

  const overallTermAttendancePercentage =
    totalRecordedSessions === 0
      ? 100
      : Math.round((weightedPoints / totalRecordedSessions) * 100);

  return {
    consecutivePresentStreak,
    totalRecordedPresent,
    totalRecordedAbsent,
    totalRecordedSessions,
    overallTermAttendancePercentage,
  };
}

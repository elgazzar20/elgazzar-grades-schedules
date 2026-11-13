import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACADEMIC_MONTHS_ORDER,
  MonthlyAttendanceRecord,
  computeAttendanceTermInsights,
  deriveScheduleDaysLabelFromIsoDates,
  formatArabicSessionCount,
  parseAttendanceArchiveRows,
  parseAttendanceCellStatus,
  parseAttendanceDatabaseRows,
} from './attendance';

test('parseAttendanceCellStatus handles explicit sheet tokens including لم يسجل في النظام', () => {
  assert.equal(parseAttendanceCellStatus('حاضر'), 'present');
  assert.equal(parseAttendanceCellStatus('غائب'), 'absent');
  assert.equal(parseAttendanceCellStatus('متأخر'), 'late');
  assert.equal(parseAttendanceCellStatus('معذور'), 'excused');
  assert.equal(parseAttendanceCellStatus('لم يسجل في النظام'), 'upcoming');
  assert.equal(parseAttendanceCellStatus(''), null);
});

test('parseAttendanceDatabaseRows extracts cross-grade student attendance records', () => {
  const rows = [
    [
      'المفتاح',
      'الصف',
      'الشهر',
      'كود الطالب',
      'الحصة 1',
      'الحصة 2',
      'الحصة 3',
      'الحصة 4',
      'الحصة 5',
      'الحصة 6',
      'الحصة 7',
      'الحصة 8',
      'آخر تحديث',
    ],
    [
      'الأول الإعدادي_نوفمبر_077077',
      'الأول الإعدادي',
      'نوفمبر',
      '77077',
      'حاضر',
      'غائب',
      'حاضر',
      'حاضر',
      'لم يسجل في النظام',
      'لم يسجل في النظام',
      'لم يسجل في النظام',
      'لم يسجل في النظام',
      '2026/11/13',
    ],
  ];

  const entries = parseAttendanceDatabaseRows(rows);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].grade, 'الأول الإعدادي');
  assert.equal(entries[0].monthNumber, 11);
  assert.equal(entries[0].studentCode, '77077');
  assert.equal(entries[0].statuses[0], 'present');
  assert.equal(entries[0].statuses[1], 'absent');
  assert.equal(entries[0].statuses[4], 'upcoming');
  assert.equal(entries[0].lastUpdated, '13/11/2026');
});

test('parseAttendanceArchiveRows reads active month, session dates, and student rows', () => {
  const rows = [
    ['', 'لوحة متابعة الحضور'],
    ['', 'الشهر الدراسي', '', 'التاريخ'],
    ['', 'نوفمبر', '', '2026-11-13'],
    [],
    ['', '📅 تواريخ الحصص:', '', '', '', '2026-11-02', '2026-11-05', '2026-11-09', '2026-11-12'],
    ['', 'م', 'كود الطالب', 'اسم الطالب', 'المجموعة', 'الحصة 1', 'الحصة 2', 'الحصة 3', 'الحصة 4'],
    ['', '1', '456231', 'احمد فاضل احمد', 'مجموعة السبت', 'حاضر', 'حاضر', 'حاضر', 'لم يسجل في النظام'],
  ];

  const parsed = parseAttendanceArchiveRows(rows, new Date(2026, 10, 13));
  assert.equal(parsed.activeSheetMonth, 11);
  assert.equal(parsed.sheetTodayIso, '2026-11-13');
  assert.deepEqual(parsed.parsedIsoDates, [
    '2026-11-02',
    '2026-11-05',
    '2026-11-09',
    '2026-11-12',
  ]);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].studentCode, '456231');
  assert.equal(parsed.rows[0].statuses[3], 'upcoming');
});

test('computeAttendanceTermInsights calculates streak stopping at last absence and cumulative metrics', () => {
  const monthsMap: Record<number, MonthlyAttendanceRecord> = {};
  for (const m of ACADEMIC_MONTHS_ORDER) {
    monthsMap[m] = {
      monthNumber: m,
      monthNameAr: '',
      monthDisplayTitle: '',
      year: 2026,
      sessions: [],
      presentCount: 0,
      absentCount: 0,
      lateCount: 0,
      excusedCount: 0,
      upcomingCount: 0,
      recordedCount: 0,
      attendancePercentage: 100,
      commitmentBadge: '',
      hasSheetRecords: false,
      lastUpdated: '',
    };
  }

  monthsMap[11] = {
    ...monthsMap[11],
    presentCount: 3,
    absentCount: 1,
    recordedCount: 4,
    attendancePercentage: 75,
    hasSheetRecords: true,
    sessions: [
      {
        sessionIndex: 1,
        sessionTitle: 'الحصة 1',
        isoDate: '2026-11-02',
        dayNameAr: 'الإثنين',
        shortDate: '2/11',
        status: 'present',
        statusLabelAr: 'حضر',
        fullSentenceAr: 'حضر يوم الإثنين 2/11',
        isExplicitFromSheet: true,
      },
      {
        sessionIndex: 2,
        sessionTitle: 'الحصة 2',
        isoDate: '2026-11-05',
        dayNameAr: 'الخميس',
        shortDate: '5/11',
        status: 'absent',
        statusLabelAr: 'غاب',
        fullSentenceAr: 'غاب يوم الخميس 5/11',
        isExplicitFromSheet: true,
      },
      {
        sessionIndex: 3,
        sessionTitle: 'الحصة 3',
        isoDate: '2026-11-09',
        dayNameAr: 'الإثنين',
        shortDate: '9/11',
        status: 'present',
        statusLabelAr: 'حضر',
        fullSentenceAr: 'حضر يوم الإثنين 9/11',
        isExplicitFromSheet: true,
      },
      {
        sessionIndex: 4,
        sessionTitle: 'الحصة 4',
        isoDate: '2026-11-12',
        dayNameAr: 'الخميس',
        shortDate: '12/11',
        status: 'present',
        statusLabelAr: 'حضر',
        fullSentenceAr: 'حضر يوم الخميس 12/11',
        isExplicitFromSheet: true,
      },
    ],
  };

  monthsMap[10] = {
    ...monthsMap[10],
    presentCount: 8,
    recordedCount: 8,
    hasSheetRecords: false,
  };

  const insights = computeAttendanceTermInsights(monthsMap);
  assert.equal(insights.consecutivePresentStreak, 2);
  assert.equal(insights.totalRecordedPresent, 3);
  assert.equal(insights.totalRecordedAbsent, 1);
  assert.equal(insights.totalRecordedSessions, 4);
  assert.equal(insights.overallTermAttendancePercentage, 75);
});

test('deriveScheduleDaysLabelFromIsoDates infers Mon/Thu accurately from November sheet dates', () => {
  assert.equal(
    deriveScheduleDaysLabelFromIsoDates([
      '2026-11-02',
      '2026-11-05',
      '2026-11-09',
      '2026-11-12',
    ]),
    'الإثنين والخميس'
  );
});

test('formatArabicSessionCount follows natural Arabic plural grammar', () => {
  assert.equal(formatArabicSessionCount(0), '0 حصة');
  assert.equal(formatArabicSessionCount(1, true), 'حصة واحدة متتالية');
  assert.equal(formatArabicSessionCount(2, true), 'حصتان متتاليتان');
  assert.equal(formatArabicSessionCount(4, true), '4 حصص متتالية');
  assert.equal(formatArabicSessionCount(12, false), '12 حصة');
});

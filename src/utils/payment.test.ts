import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCalendarDeadlineToPaymentSummary,
  buildStudentPaymentSummary,
  classifyPaymentStatus,
  formatPaymentDateForDisplay,
  getCurrentAndPreviousCalendarMonths,
  parsePaymentDashboardRows,
  parsePaymentDatabaseRows,
  resolveCurrentMonthAdvancePaymentStatus,
} from './payment';

test('getCurrentAndPreviousCalendarMonths resolves current and previous calendar months dynamically', () => {
  const nov = getCurrentAndPreviousCalendarMonths(new Date('2026-11-13T10:00:00Z'));
  assert.equal(nov.currentMonth, 11);
  assert.equal(nov.currentMonthNameAr, 'نوفمبر');
  assert.equal(nov.previousMonth, 10);
  assert.equal(nov.previousMonthNameAr, 'أكتوبر');

  const dec = getCurrentAndPreviousCalendarMonths(new Date('2026-12-01T10:00:00Z'));
  assert.equal(dec.currentMonth, 12);
  assert.equal(dec.currentMonthNameAr, 'ديسمبر');
  assert.equal(dec.previousMonth, 11);
  assert.equal(dec.previousMonthNameAr, 'نوفمبر');

  const jan = getCurrentAndPreviousCalendarMonths(new Date('2027-01-05T10:00:00Z'));
  assert.equal(jan.currentMonth, 1);
  assert.equal(jan.currentMonthNameAr, 'يناير');
  assert.equal(jan.previousMonth, 12);
  assert.equal(jan.previousMonthNameAr, 'ديسمبر');
});

test('classifyPaymentStatus maps all sheet statuses to accurate semantic tones and preserves text', () => {
  const paid = classifyPaymentStatus('تم الدفع');
  assert.equal(paid.tone, 'paid');
  assert.equal(paid.isPaid, true);
  assert.equal(paid.displayText, 'تم الدفع');

  const exempt = classifyPaymentStatus('إعفاء');
  assert.equal(exempt.tone, 'exempt');
  assert.equal(exempt.isPaid, true);

  const discount = classifyPaymentStatus('تخفيض');
  assert.equal(discount.tone, 'exempt');
  assert.equal(discount.isPaid, true);

  const pending = classifyPaymentStatus('لم يأتِ الموعد بعد');
  assert.equal(pending.tone, 'pending');
  assert.equal(pending.isPaid, false);

  const unpaid = classifyPaymentStatus('لم يدفع');
  assert.equal(unpaid.tone, 'unpaid');
  assert.equal(unpaid.isPaid, false);

  const late = classifyPaymentStatus('متأخر عن الدفع');
  assert.equal(late.tone, 'late');
  assert.equal(late.isPaid, false);

  const multiOverdue = classifyPaymentStatus('عليه أكثر من شهر');
  assert.equal(multiOverdue.tone, 'overdue');
  assert.equal(multiOverdue.isPaid, false);
});

test('resolveCurrentMonthAdvancePaymentStatus enforces day-2 late and day-10 unpaid rules automatically', () => {
  // Day 1: unpaid preserves pending status
  const day1 = resolveCurrentMonthAdvancePaymentStatus(
    'لم يأتِ الموعد بعد',
    new Date(2026, 10, 1, 12, 0, 0)
  );
  assert.equal(day1.displayText, 'لم يأتِ الموعد بعد');
  assert.equal(day1.tone, 'pending');

  // Days 2..9: unpaid automatically becomes "متأخر عن الدفع"
  const day2 = resolveCurrentMonthAdvancePaymentStatus(
    'لم يأتِ الموعد بعد',
    new Date(2026, 10, 2, 12, 0, 0)
  );
  assert.equal(day2.displayText, 'متأخر عن الدفع');
  assert.equal(day2.tone, 'late');

  const day9 = resolveCurrentMonthAdvancePaymentStatus(
    'لم يدفع',
    new Date(2026, 10, 9, 12, 0, 0)
  );
  assert.equal(day9.displayText, 'متأخر عن الدفع');
  assert.equal(day9.tone, 'late');

  // Day 10+: unpaid automatically becomes "لم يدفع"
  const day10 = resolveCurrentMonthAdvancePaymentStatus(
    'لم يأتِ الموعد بعد',
    new Date(2026, 10, 10, 12, 0, 0)
  );
  assert.equal(day10.displayText, 'لم يدفع');
  assert.equal(day10.tone, 'unpaid');

  const day13 = resolveCurrentMonthAdvancePaymentStatus(
    'متأخر عن الدفع',
    new Date(2026, 10, 13, 12, 0, 0)
  );
  assert.equal(day13.displayText, 'لم يدفع');
  assert.equal(day13.tone, 'unpaid');

  // Paid / exempt statuses always remain preserved on any day of the month
  const paidOnDay13 = resolveCurrentMonthAdvancePaymentStatus(
    'تم الدفع',
    new Date(2026, 10, 13, 12, 0, 0)
  );
  assert.equal(paidOnDay13.displayText, 'تم الدفع');
  assert.equal(paidOnDay13.tone, 'paid');

  const exemptOnDay13 = resolveCurrentMonthAdvancePaymentStatus(
    'إعفاء',
    new Date(2026, 10, 13, 12, 0, 0)
  );
  assert.equal(exemptOnDay13.displayText, 'إعفاء');
  assert.equal(exemptOnDay13.tone, 'exempt');
});

test('parsePaymentDatabaseRows and parsePaymentDashboardRows merge cleanly and apply advance rules', () => {
  const dbRows = [
    [
      'المفتاح',
      'الصف',
      'كود الطالب',
      'اسم الطالب',
      'أغسطس',
      'سبتمبر',
      'أكتوبر',
      'نوفمبر',
      'ديسمبر',
      'يناير',
      'فبراير',
      'مارس',
      'أبريل',
      'مايو',
      'المبلغ المدفوع',
      'تاريخ السداد',
      'آخر تحديث',
    ],
    [
      'الرابع الابتدائي_456231',
      'الرابع الابتدائي',
      '456231',
      'احمد فاضل احمد',
      'تم الدفع',
      'تم الدفع',
      'تم الدفع',
      'لم يأتِ الموعد بعد',
      'لم يأتِ الموعد بعد',
      'لم يأتِ الموعد بعد',
      'لم يأتِ الموعد بعد',
      'لم يأتِ الموعد بعد',
      'لم يأتِ الموعد بعد',
      'لم يأتِ الموعد بعد',
      '450',
      '2026-10-31',
      '2026/11/13',
    ],
    [
      'الأول الإعدادي_077077',
      'الأول الإعدادي',
      '77077',
      'احلام شريف',
      'لم يدفع',
      'لم يدفع',
      'لم يدفع',
      'متأخر عن الدفع',
      'لم يأتِ الموعد بعد',
      'لم يأتِ الموعد بعد',
      'لم يأتِ الموعد بعد',
      'لم يأتِ الموعد بعد',
      'لم يأتِ الموعد بعد',
      'لم يأتِ الموعد بعد',
      '',
      '2026-10-31',
      '2026/11/13',
    ],
  ];

  const dashRows = [
    ['', '💳 لوحة متابعة وتحصيل المصروفات وحالة الدفع'],
    ['', '🏫 الصف الدراسي', '', '👥 المجموعة المستهدفة'],
    ['', 'الرابع الابتدائي', '', 'جميع المجموعات'],
    [],
    ['', 'م', 'كود الطالب', 'اسم الطالب', 'المجموعة', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'مسدد', 'متبقي', 'المبلغ المدفوع', 'تاريخ السداد', 'الموقف المالي'],
    ['', '1', '456231', 'احمد فاضل احمد', 'مجموعة السبت', 'تم الدفع', 'تم الدفع', 'تم الدفع', 'تم الدفع', 'لم يأتِ الموعد بعد', '', '', '', '', '', '4', '0', '600 ج.م', '2026-11-13', 'خالص حتى تاريخه 🌟'],
  ];

  const dbRecords = parsePaymentDatabaseRows(dbRows);
  const dashRecords = parsePaymentDashboardRows(dashRows);
  const combined = [...dashRecords, ...dbRecords];

  // Dashboard overrides DB for 456231 on November ("تم الدفع") and date ("13/11/2026")
  const summaryPaid = buildStudentPaymentSummary(
    combined,
    'الرابع الابتدائي',
    '456231',
    new Date(2026, 10, 13, 10, 0, 0)
  );
  assert.ok(summaryPaid);
  assert.equal(summaryPaid.previousMonth.monthNameAr, 'أكتوبر');
  assert.equal(summaryPaid.previousMonth.status.tone, 'paid');
  assert.equal(summaryPaid.currentMonth.monthNameAr, 'نوفمبر');
  assert.equal(summaryPaid.currentMonth.status.displayText, 'تم الدفع');
  assert.equal(summaryPaid.currentMonth.status.tone, 'paid');
  assert.equal(summaryPaid.recordedPaymentDate, '13/11/2026');

  // Unpaid student on Day 13 -> automatically becomes "لم يدفع"
  const summaryUnpaidDay13 = buildStudentPaymentSummary(
    combined,
    'الأول الإعدادي',
    '077077',
    new Date(2026, 10, 13, 10, 0, 0)
  );
  assert.ok(summaryUnpaidDay13);
  assert.equal(summaryUnpaidDay13.previousMonth.status.tone, 'unpaid');
  assert.equal(summaryUnpaidDay13.currentMonth.status.displayText, 'لم يدفع');
  assert.equal(summaryUnpaidDay13.currentMonth.status.tone, 'unpaid');
  assert.equal(summaryUnpaidDay13.recordedPaymentDate, '');

  // Calendar re-evaluation across days (Day 1 -> Day 5 -> Day 12)
  const day1Summary = buildStudentPaymentSummary(
    dbRecords,
    'الرابع الابتدائي',
    '456231',
    new Date(2026, 10, 1, 10, 0, 0)
  )!;
  assert.equal(day1Summary.currentMonth.status.displayText, 'لم يأتِ الموعد بعد');
  const rolledToDay5 = applyCalendarDeadlineToPaymentSummary(
    day1Summary,
    new Date(2026, 10, 5, 10, 0, 0)
  );
  assert.equal(rolledToDay5.currentMonth.status.displayText, 'متأخر عن الدفع');
  const rolledToDay12 = applyCalendarDeadlineToPaymentSummary(
    rolledToDay5,
    new Date(2026, 10, 12, 10, 0, 0)
  );
  assert.equal(rolledToDay12.currentMonth.status.displayText, 'لم يدفع');
});

test('formatPaymentDateForDisplay normalizes ISO and slash dates consistently', () => {
  assert.equal(formatPaymentDateForDisplay('2026-10-31'), '31/10/2026');
  assert.equal(formatPaymentDateForDisplay('2026/11/13'), '13/11/2026');
  assert.equal(formatPaymentDateForDisplay('٢٠٢٦-١١-٥'), '05/11/2026');
});


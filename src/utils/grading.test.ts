import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseScoreItem,
  getBadgeForPercentage,
  evaluateStudentScores,
  buildStudentWhatsAppUrl,
  getStageForGrade,
} from './grading';

test('parseScoreItem parses fraction strings like 48/50 and extracts clean title', () => {
  const parsed = parseScoreItem({
    title: 'امتحان الشهر (50)',
    value: '48/50',
  });
  assert.equal(parsed.cleanTitle, 'امتحان الشهر');
  assert.equal(parsed.earned, 48);
  assert.equal(parsed.max, 50);
  assert.equal(parsed.percentage, 96);
  assert.equal(parsed.level, 'excellent');
  assert.equal(parsed.isAttendanceOrPercentageOnly, false);
});

test('parseScoreItem extracts max score from column title when value is a plain number', () => {
  const parsed = parseScoreItem({
    title: 'كويز الجبر (10)',
    value: 8,
  });
  assert.equal(parsed.cleanTitle, 'كويز الجبر');
  assert.equal(parsed.earned, 8);
  assert.equal(parsed.max, 10);
  assert.equal(parsed.percentage, 80);
  assert.equal(parsed.level, 'good');
});

test('parseScoreItem handles attendance percentage without polluting numeric points sum', () => {
  const parsed = parseScoreItem({
    title: 'نسبة الحضور',
    value: '95%',
  });
  assert.equal(parsed.isAttendanceOrPercentageOnly, true);
  assert.equal(parsed.percentage, 95);
  assert.equal(parsed.earned, null);
  assert.equal(parsed.max, null);
});

test('getBadgeForPercentage assigns exact motivational titles and confetti flag', () => {
  const legendary = getBadgeForPercentage(94);
  assert.equal(legendary.title, 'عبقري الرياضيات - مستوى أسطوري');
  assert.equal(legendary.triggerConfetti, true);

  const distinguished = getBadgeForPercentage(85);
  assert.equal(distinguished.title, 'نجم الهندسة والجبر - مستوى متميز');
  assert.equal(distinguished.triggerConfetti, false);

  const rising = getBadgeForPercentage(72);
  assert.equal(rising.title, 'مشروع بطل - تقدم جيد ويحتاج لمزيد من التركيز');
  assert.equal(rising.triggerConfetti, false);

  const review = getBadgeForPercentage(58);
  assert.equal(review.title, 'تحتاج لمراجعة سريعة مع المستر لتعويض ما فاتك');
  assert.equal(review.triggerConfetti, false);
});

test('evaluateStudentScores calculates total earned, max, and percentage accurately', () => {
  const summary = evaluateStudentScores([
    { title: 'كويز الجبر (10)', value: '10/10' },
    { title: 'كويز الهندسة (10)', value: '9/10' },
    { title: 'امتحان الشهر (50)', value: '47/50' },
    { title: 'الواجب والمواظبة (10)', value: '10/10' },
    { title: 'نسبة الحضور', value: '100%' },
  ]);

  assert.equal(summary.totalEarned, 76);
  assert.equal(summary.totalMax, 80);
  assert.equal(summary.overallPercentage, 95);
  assert.equal(summary.badge.triggerConfetti, true);
});

test('buildStudentWhatsAppUrl formats international phone and Arabic inquiry message', () => {
  const url = buildStudentWhatsAppUrl({
    name: 'أحمد طارق المنشاوي',
    grade: 'الأول الإعدادي',
    id: '101',
    percentage: 95,
  });
  assert.ok(url.startsWith('https://wa.me/201009617278?text='));
  const decoded = decodeURIComponent(url.replace('https://wa.me/201009617278?text=', ''));
  assert.ok(decoded.includes('السلام عليكم يا مستر محمد، أنا الطالب أحمد طارق المنشاوي بالصف الأول الإعدادي كود 101، حاصل على نسبة 95%'));
});

test('getStageForGrade maps all 9 grades to their correct stage', () => {
  assert.equal(getStageForGrade('الرابع الابتدائي'), 'primary');
  assert.equal(getStageForGrade('الأول الإعدادي'), 'prep');
  assert.equal(getStageForGrade('الثالث الثانوي'), 'secondary');
});

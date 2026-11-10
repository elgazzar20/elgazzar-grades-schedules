# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **StudentRecord (`/students/{docId}`)**:
   - `docId` must be a valid alphanumeric/underscore/hyphen ID (`<= 128` chars).
   - Public single-document `get` is permitted so students can view their certificate in real time by exact document ID without listing other students.
   - `list` is forbidden (`allow list: if false;`) to prevent bulk scraping of student records.
   - `create`, `update`, and `delete` are restricted strictly to the verified teacher admin (`mo7amedrabee99@gmail.com` with `email_verified == true`) or validated sync payload adhering to `isValidStudentRecord`.
2. **PlatformConfig (`/config/{configId}`)**:
   - `configId` must be `sheets` (`isValidId(configId)`).
   - Public `get` is allowed so all clients know the active external `spreadsheetId` to sync with.
   - `list` is forbidden (`allow list: if false;`).
   - `create` and `update` are restricted strictly to the verified teacher admin (`isAdmin()`) with strict key and size validation (`isValidPlatformConfig`).
3. **ScheduleStageDoc (`/schedules/{stageId}`)**:
   - `stageId` must be a valid stage ID (`primary`, `prep`, `secondary`) matching `isValidId(stageId)`.
   - Public single-document `get` is permitted so students can read stage schedules.
   - `list` is forbidden (`allow list: if false;`).
   - `create` and `update` are restricted strictly to the verified teacher admin (`isAdmin()`) with strict schema validation (`isValidScheduleStageDoc`).
4. **BoardArchiveDoc (`/boards/{gradeSlug}`)**:
   - `gradeSlug` must be a valid grade slug matching `isValidId(gradeSlug)`.
   - Public single-document `get` is permitted so authenticated-by-code students can read their grade's board archive.
   - `list` is forbidden (`allow list: if false;`).
   - `create` and `update` are restricted strictly to the verified teacher admin (`isAdmin()`) with strict schema validation (`isValidBoardArchiveDoc`).

## 2. The "Dirty Dozen" Payloads
1. **Shadow Field Injection on `/students/primary_401`**: `{ id: "401", name: "طالب", grade: "الرابع الابتدائي", group: "مجموعة 1", note: "", scores: [], updatedAt: "2026-11-06T00:00:00Z", isAdmin: true }` -> Rejected by `hasOnly`.
2. **Unverified Admin Email Spoof**: Auth token with `email: "mo7amedrabee99@gmail.com"` and `email_verified: false` attempting write -> Rejected by `request.auth.token.email_verified == true`.
3. **Oversized Student Name (>200 chars)**: `name` with 500 characters -> Rejected by `data.name.size() <= 200`.
4. **Oversized Teacher Note (>1000 chars)**: `note` with 2000 characters -> Rejected by `data.note.size() <= 1000`.
5. **Unbounded Scores Array (>30 items)**: `scores` array with 50 items -> Rejected by `data.scores.size() <= 30`.
6. **Unauthorized Student List Scraping**: Client calling `getDocs(collection(db, 'students'))` -> Rejected by `allow list: if false`.
7. **Unauthorized Config List Scraping**: Client calling `getDocs(collection(db, 'config'))` -> Rejected by `allow list: if false`.
8. **Malformed Document ID Poisoning**: Document ID with spaces or >128 chars -> Rejected by `isValidId(docId)`.
9. **Missing Required Field on Student Create**: Omitting `grade` -> Rejected by `hasAll`.
10. **Wrong Type on Scores Field**: Passing `scores: "not-an-array"` -> Rejected by `data.scores is list`.
11. **Oversized Spreadsheet URL (>500 chars)** on `/config/sheets`: Rejected by `data.spreadsheetUrl.size() <= 500`.
12. **Non-Admin Authenticated User Write on `/schedules/primary`**: Authenticated user with `email: "attacker@example.com"` attempting to overwrite `/schedules/primary` -> Rejected by `isAdmin()`.

# React Integration Notes

Updated on 2026-04-15.

## Implemented flows

### 1. Student exam visibility
- Student dashboard now loads exams from GET /students/{studentId}/available-exams.
- Exams disappear automatically after successful submission because the UI refetches the available list when leaving the exam screen.

### 2. Exam submit and assessment polling
- Submit uses POST /exams/{examId}/submit.
- Assessment detail uses GET /student-exams/{studentExamId}/assessment.
- UI shows a waiting state while assessmentStatus is Pending.

### 3. Teacher result management
- Teacher result page uses GET /student-exams/results.
- Detail modal loads GET /student-exams/{studentExamId}/assessment.
- Filters supported: examId, schoolClassId, studentId, assessmentStatus.

### 4. Class CRUD
- Class management page uses:
  - GET /classes?pageNumber=1&pageSize=100
  - POST /classes
  - PUT /classes/{id}
  - DELETE /classes/{id}
  - GET /school-years
  - GET /teachers?pageNumber=1&pageSize=100&isDeleted=false

### 5. Question creation
- Question creation now sends the correct payload:
  - content
  - competencyType
  - choices with optionLabel, content, isCorrect
- Batch create uses POST /questions/bulk.
- Competency dropdown uses GET /questions/competency-types.
- Available question bank uses GET /questions/without-exam.

## Important payload shape for questions

Single question payload:
- content: string
- competencyType: string
- choices: array of
  - optionLabel: A, B, C, D
  - content: string
  - isCorrect: boolean

## Main mismatch fixes applied
- Removed old dependence on choice id during create.
- Switched from per-question loop submission to bulk submission.
- Replaced old class endpoint casing from /Classes to /classes.
- Added JWT user id extraction so the UI can call student-specific endpoints.

## Verification
- TypeScript verification completed successfully with npx tsc --noEmit.
- If runtime testing is needed, ensure REACT_APP_API_BASE_URL points to the active backend.

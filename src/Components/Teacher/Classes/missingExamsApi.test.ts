import {
  getMissingExamsClassName,
  mapClassMissingExamsResponse,
} from './missingExamsApi';

describe('missingExamsApi', () => {
  it('maps response payload to typed class summary data', () => {
    const result = mapClassMissingExamsResponse({
      class: {
        id: 'class-1',
        name: '12A1',
      },
      totalActiveStudents: 30,
      studentsWithMissingExamsCount: 2,
      totalMissingExamAssignments: 3,
      students: [
        {
          studentId: 'student-1',
          studentName: 'Nguyễn Văn A',
          missingExamCount: 2,
          missingExams: [
            {
              studentExamId: 'se-1',
              examId: 'exam-1',
              examName: 'Kiểm tra giữa kỳ',
              start: '2026-05-01T01:00:00Z',
              end: '2026-05-01T02:00:00Z',
            },
          ],
        },
      ],
    });

    expect(result).toEqual({
      schoolClass: {
        id: 'class-1',
        name: '12A1',
      },
      totalActiveStudents: 30,
      studentsWithMissingExamsCount: 2,
      totalMissingExamAssignments: 3,
      students: [
        {
          studentId: 'student-1',
          studentName: 'Nguyễn Văn A',
          missingExamCount: 2,
          missingExams: [
            {
              studentExamId: 'se-1',
              examId: 'exam-1',
              examName: 'Kiểm tra giữa kỳ',
              start: '2026-05-01T01:00:00Z',
              end: '2026-05-01T02:00:00Z',
            },
          ],
        },
      ],
    });
  });

  it('falls back safely when class display name is missing', () => {
    expect(getMissingExamsClassName(null)).toBe('Lớp học');
    expect(getMissingExamsClassName({})).toBe('Lớp học');
    expect(getMissingExamsClassName({ name: ' 12A2 ' })).toBe('12A2');
  });
});

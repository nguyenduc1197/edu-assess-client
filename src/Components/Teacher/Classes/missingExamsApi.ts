import { fetchClient } from '../../../api/fetchClient';
import {
  ClassMissingExamsSummary,
  MissingExamAssignment,
  MissingExamsClassInfo,
  MissingExamStudent,
} from '../../../types';

const toNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const toStringValue = (value: unknown, fallback = '') => {
  return typeof value === 'string' ? value : fallback;
};

const mapClassInfo = (value: unknown): MissingExamsClassInfo | null => {
  if (!value) return null;

  if (typeof value === 'string') {
    return { name: value };
  }

  if (typeof value === 'object') {
    const classInfo = value as Record<string, unknown>;
    return {
      id: toStringValue(classInfo.id ?? classInfo.classId),
      name: toStringValue(classInfo.name ?? classInfo.className),
    };
  }

  return null;
};

const mapMissingExam = (value: unknown): MissingExamAssignment => {
  const item = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;

  return {
    studentExamId: toStringValue(item.studentExamId),
    examId: toStringValue(item.examId),
    examName: toStringValue(item.examName, 'Bài thi chưa nộp'),
    start: typeof item.start === 'string' ? item.start : null,
    end: typeof item.end === 'string' ? item.end : null,
  };
};

const mapStudent = (value: unknown): MissingExamStudent => {
  const item = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const missingExams = Array.isArray(item.missingExams) ? item.missingExams.map(mapMissingExam) : [];

  return {
    studentId: toStringValue(item.studentId),
    studentName: toStringValue(item.studentName, 'Học sinh'),
    missingExamCount: toNumber(item.missingExamCount) || missingExams.length,
    missingExams,
  };
};

export const mapClassMissingExamsResponse = (value: unknown): ClassMissingExamsSummary => {
  const payload = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const students = Array.isArray(payload.students) ? payload.students.map(mapStudent) : [];

  return {
    schoolClass: mapClassInfo(payload.class),
    totalActiveStudents: toNumber(payload.totalActiveStudents),
    studentsWithMissingExamsCount: toNumber(payload.studentsWithMissingExamsCount),
    totalMissingExamAssignments: toNumber(payload.totalMissingExamAssignments),
    students,
  };
};

export class ClassMissingExamsNotFoundError extends Error {
  constructor() {
    super('Không tìm thấy lớp.');
    this.name = 'ClassMissingExamsNotFoundError';
  }
}

export const fetchClassMissingExams = async (classId: string): Promise<ClassMissingExamsSummary> => {
  const encodedClassId = encodeURIComponent(classId);
  const response = await fetchClient(`/classes/${encodedClassId}/missing-exams`);

  if (response.status === 404) {
    throw new ClassMissingExamsNotFoundError();
  }

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  const data = await response.json();
  return mapClassMissingExamsResponse(data);
};

export const getMissingExamsClassName = (schoolClass?: MissingExamsClassInfo | null) => {
  return schoolClass?.name?.trim() || 'Lớp học';
};

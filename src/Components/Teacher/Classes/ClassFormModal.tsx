import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Class as SchoolClass, SchoolYear, Teacher } from '../../../types';

interface ClassFormModalProps {
  schoolClass?: SchoolClass | null;
  teachers: Teacher[];
  schoolYears: SchoolYear[];
  onClose: () => void;
  onSubmit: (payload: any) => Promise<void>;
}

const ClassFormModal: React.FC<ClassFormModalProps> = ({
  schoolClass,
  teachers,
  schoolYears,
  onClose,
  onSubmit,
}) => {
  const isEdit = !!schoolClass;

  const [name, setName] = useState('');
  const [homeRoomTeacherId, setHomeRoomTeacherId] = useState('');
  const [schoolYearId, setSchoolYearId] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (schoolClass) {
      setName(schoolClass.name || '');
      setHomeRoomTeacherId(schoolClass.homeRoomTeacherId || '');
      setSchoolYearId(schoolClass.schoolYearId || '');
    }
  }, [schoolClass]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Vui lòng nhập tên lớp.');
      return;
    }

    if (!homeRoomTeacherId) {
      setError('Vui lòng chọn giáo viên chủ nhiệm.');
      return;
    }

    if (!schoolYearId) {
      setError('Vui lòng chọn niên khóa.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = isEdit
        ? {
            id: schoolClass!.id,
            name: name.trim(),
            homeRoomTeacherId,
            schoolYearId,
          }
        : {
            name: name.trim(),
            homeRoomTeacherId,
            schoolYearId,
          };

      await onSubmit(payload);
    } catch {
      setError('Không thể lưu lớp học. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            {isEdit ? 'Chỉnh Sửa Lớp Học' : 'Thêm Lớp Học Mới'}
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tên Lớp</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="10A1"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Giáo Viên Chủ Nhiệm</label>
              <select
                value={homeRoomTeacherId}
                onChange={(e) => setHomeRoomTeacherId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Chọn giáo viên</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Niên Khóa</label>
              <select
                value={schoolYearId}
                onChange={(e) => setSchoolYearId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Chọn niên khóa</option>
                {schoolYears.map((schoolYear) => (
                  <option key={schoolYear.id} value={schoolYear.id}>
                    {new Date(schoolYear.start).getFullYear()} - {new Date(schoolYear.end).getFullYear()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors dark:bg-blue-700 dark:hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Đang lưu...' : isEdit ? 'Cập Nhật' : 'Thêm Lớp'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClassFormModal;

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Student, Class } from '../../../types';
import { fetchClient } from '../../../api/fetchClient';

interface StudentFormModalProps {
  student?: Student | null;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

const StudentFormModal: React.FC<StudentFormModalProps> = ({ student, onClose, onSubmit }) => {
  const isEdit = !!student;

  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [schoolClassId, setSchoolClassId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isFetchingClasses, setIsFetchingClasses] = useState(true);

  useEffect(() => {
    const fetchClasses = async () => {
      setIsFetchingClasses(true);
      try {
        const response = await fetchClient('/classes?pageNumber=1&pageSize=100');
        if (response.ok) {
          const data = await response.json();
          setClasses(Array.isArray(data) ? data : (data.items || data.data || []));
        }
      } catch (err) {
        console.error('Error fetching classes:', err);
      } finally {
        setIsFetchingClasses(false);
      }
    };
    fetchClasses();
  }, []);

  useEffect(() => {
    if (student) {
      setName(student.name);
      setDateOfBirth(student.dateOfBirth ? student.dateOfBirth.split('T')[0] : '');
      setSchoolClassId(student.schoolClassId);
    }
  }, [student]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('Vui lòng nhập họ tên'); return; }
    if (!dateOfBirth) { setError('Vui lòng nhập ngày sinh'); return; }
    if (!schoolClassId.trim()) { setError('Vui lòng nhập mã lớp học'); return; }
    if (!isEdit && !username.trim()) { setError('Vui lòng nhập tên đăng nhập'); return; }
    if (!isEdit && !password.trim()) { setError('Vui lòng nhập mật khẩu'); return; }

    setIsSubmitting(true);
    try {
      const payload = isEdit
        ? { id: student!.id, name: name.trim(), dateOfBirth: `${dateOfBirth}T00:00:00`, schoolClassId: schoolClassId.trim() }
        : { name: name.trim(), dateOfBirth: `${dateOfBirth}T00:00:00`, schoolClassId: schoolClassId.trim(), username: username.trim(), password };
      await onSubmit(payload);
    } catch {
      setError('Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            {isEdit ? 'Chỉnh Sửa Học Sinh' : 'Thêm Học Sinh Mới'}
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(100vh-200px)]">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Họ Tên</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Nguyễn Văn C"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ngày Sinh</label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={e => setDateOfBirth(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lớp Học</label>
              <select
                value={schoolClassId}
                onChange={e => setSchoolClassId(e.target.value)}
                disabled={isFetchingClasses}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">{isFetchingClasses ? 'Đang tải lớp học...' : 'Chọn lớp học'}</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {!isEdit && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tên Đăng Nhập</label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="student.c"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mật Khẩu</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </>
            )}
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
              {isSubmitting ? 'Đang lưu...' : isEdit ? 'Cập Nhật' : 'Thêm Học Sinh'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudentFormModal;

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { KeyRound, PlusCircle, Search, Trash2, Edit2, Users } from 'lucide-react';
import { User, Student, Class as SchoolClass } from '../../../types';
import Sidebar from '../../Common/Sidebar/Sidebar';
import StudentFormModal from './StudentFormModal';
import BulkStudentModal from './BulkStudentModal';
import { fetchClient } from '../../../api/fetchClient';
import { MIN_PASSWORD_LENGTH } from './constants';
import { fetchAllClasses } from './studentApi';
import { MobileBottomNav, MobileHeaderBar } from '../../Common/MobileAppChrome/MobileAppChrome';

interface StudentManagementProps {
  onLogout?: () => void;
}

const mockUser: User = {
  id: "81114DB7-EF7C-4CEC-97B1-4428AA7AADA6",
  name: `An Nguyen`,
  email: localStorage.getItem('email') || 'an.nguyen@school.edu',
  avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBaWbkVJIW-UxVbQAZVdNrwMze37EFXHpuuLhTSw7WJksMYe3RyK6MlICHa5M_rj6rAY8fmpaTsje51sF_GaYmBr15LrSN-IPsN9CSad_0QSDbvg69dUedrdiq4gN0Ev5352TfW0E_YrYXi0ugbxl2tDCdOwo84g_5dR-RxAreLeGB0Bs-5JS0tvLlFklj1uRh9wPZecX3HEGBS1Cgfm6tBuHD_pCTa6Z_JZN2Vzxo69eS-QEJjRqrhjg5yFrZfRnFYPL7VgejfRtgj"
};

const formatDisplayDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString('vi-VN') : '');

interface ResetPasswordModalProps {
  student: Student;
  isSubmitting: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (newPassword: string) => Promise<void>;
}

const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ student, isSubmitting, error, onClose, onSubmit }) => {
  const [newPassword, setNewPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError('');

    if (newPassword.trim().length < MIN_PASSWORD_LENGTH) {
      setLocalError(`Mật khẩu mới phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
      return;
    }

    await onSubmit(newPassword.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl border border-gray-200 dark:bg-gray-900 dark:border-gray-700">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Đặt Lại Mật Khẩu</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Học sinh: {student.name}</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-6 py-5">
            {(localError || error) && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
                {localError || error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mật khẩu mới</label>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={MIN_PASSWORD_LENGTH}
                placeholder={`Tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-blue-500 dark:focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800/50">
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
              {isSubmitting ? 'Đang cập nhật...' : 'Xác nhận'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const StudentManagement: React.FC<StudentManagementProps> = ({ onLogout }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'className' | 'dateCreated' | 'dateModified'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentForPasswordReset, setStudentForPasswordReset] = useState<Student | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [passwordResetError, setPasswordResetError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchClasses = useCallback(async () => {
    try {
      setClasses(await fetchAllClasses());
    } catch (classError) {
      console.error('Failed to fetch classes', classError);
      setError(classError instanceof Error ? classError.message : 'Không thể tải danh sách lớp học.');
    }
  }, []);

  const fetchStudents = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const query = new URLSearchParams({
        pageNumber: '1',
        pageSize: '100',
        isDeleted: 'false',
        sortBy,
        sortDirection,
      });
      if (selectedClassId) {
        query.set('schoolClassId', selectedClassId);
      }
      const response = await fetchClient(`/students?${query.toString()}`);

      if (response.ok) {
        const data = await response.json();
        const items = Array.isArray(data) ? data : (data.data || []);
        const mapped: Student[] = items.map((item: any) => ({
          id: item.id,
          name: item.name,
          dateOfBirth: item.dateOfBirth || '',
          schoolClassId: item.schoolClassId || '',
          schoolClassName: item.schoolClassName || item.schoolClassId || '',
          username: item.username,
          avatarUrl: item.avatarUrl || null,
          dateCreated: formatDisplayDate(item.dateCreated),
          dateModified: formatDisplayDate(item.dateModified),
        }));
        setStudents(mapped);
      } else {
        setError('Không thể tải danh sách học sinh');
      }
    } catch (err) {
      console.error('Failed to fetch students', err);
      setError('Lỗi khi tải danh sách học sinh');
    } finally {
      setIsLoading(false);
    }
  }, [selectedClassId, sortBy, sortDirection]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const filteredStudents = useMemo(() =>
    students.filter(s =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.username || '').toLowerCase().includes(searchQuery.toLowerCase())
    ), [students, searchQuery]);

  const handleSort = (column: 'name' | 'className' | 'dateCreated' | 'dateModified') => {
    if (sortBy === column) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortBy(column);
    setSortDirection('asc');
  };

  const handleOpenCreate = () => {
    setEditingStudent(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (student: Student) => {
    setEditingStudent(student);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (payload: any) => {
    const isEdit = !!editingStudent;
    const response = await fetchClient(
      isEdit ? `/students/${editingStudent!.id}` : '/students',
      {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (response.ok || response.status === 201 || response.status === 204) {
      fetchStudents();
      setIsModalOpen(false);
    } else {
      const body = await response.json().catch(() => null);
      throw new Error(body?.message || 'Lỗi không xác định');
    }
  };

  const handleOpenResetPassword = (student: Student) => {
    setStudentForPasswordReset(student);
    setPasswordResetError('');
  };

  const handleCloseResetPassword = () => {
    setStudentForPasswordReset(null);
    setPasswordResetError('');
  };

  const handleResetPassword = async (newPassword: string) => {
    if (!studentForPasswordReset) return;

    try {
      setIsResettingPassword(true);
      setPasswordResetError('');
      setSuccessMessage('');

      const response = await fetchClient(`/students/${studentForPasswordReset.id}/reset-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.message || (response.status === 404 ? 'Không tìm thấy học sinh.' : 'Không thể đặt lại mật khẩu.'));
      }

      setSuccessMessage('Mật khẩu đã được cập nhật. Vui lòng lưu lại mật khẩu mới để thông báo cho học sinh.');
      handleCloseResetPassword();
    } catch (resetError) {
      setPasswordResetError(resetError instanceof Error ? resetError.message : 'Không thể đặt lại mật khẩu.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa học sinh này không?')) return;
    try {
      const response = await fetchClient(`/students/${id}`, { method: 'DELETE' });
      if (response.ok || response.status === 204) {
        fetchStudents();
      } else {
        setError('Xóa học sinh thất bại. Vui lòng thử lại.');
      }
    } catch (err) {
      console.error('Error deleting student', err);
      setError('Đã xảy ra lỗi khi xóa học sinh.');
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col lg:flex-row group/design-root">
      <MobileHeaderBar
        title="Quản lý học sinh"
        subtitle="Quản trị tài khoản học sinh trong giao diện chạm-thao-tác dễ hơn."
        onOpenMenu={() => setIsSidebarOpen(true)}
      />

      <Sidebar user={mockUser} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} onLogout={onLogout} />
      <MobileBottomNav onOpenMenu={() => setIsSidebarOpen(true)} />

      {isModalOpen && (
          <StudentFormModal
            student={editingStudent}
            onClose={() => setIsModalOpen(false)}
            onSubmit={handleFormSubmit}
          />
        )}

      {isBulkModalOpen && (
        <BulkStudentModal
          onClose={() => setIsBulkModalOpen(false)}
          onSuccess={fetchStudents}
        />
      )}

      {studentForPasswordReset && (
        <ResetPasswordModal
          student={studentForPasswordReset}
          isSubmitting={isResettingPassword}
          error={passwordResetError}
          onClose={handleCloseResetPassword}
          onSubmit={handleResetPassword}
        />
      )}

      <main className="mobile-safe-bottom flex-1 overflow-y-auto px-4 py-8 sm:px-8 lg:h-screen lg:p-8 lg:pb-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8">

          <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-r from-white via-sky-50 to-cyan-50 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2">
                <span className="inline-flex w-fit items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                  Quản lý học sinh
                </span>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Quản Lý Học Sinh</h1>
                <p className="text-base text-gray-600 dark:text-gray-400">Tổng cộng: {students.length} học sinh đang có trong hệ thống</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsBulkModalOpen(true)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-white border border-blue-300 px-5 py-2.5 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50 transition-colors dark:bg-gray-800 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/20"
                >
                  <Users size={20} />
                  <span>Thêm Nhiều Học Sinh</span>
                </button>
                <button
                  onClick={handleOpenCreate}
                  className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 hover:from-blue-700 hover:to-cyan-700 transition-colors"
                >
                  <PlusCircle size={20} />
                  <span>Thêm Học Sinh</span>
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
              {successMessage}
            </div>
          )}

          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full max-w-xs">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Search size={20} />
              </div>
              <input
                type="text"
                placeholder="Tìm học sinh..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="block h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
              />
            </div>
            <div className="w-full max-w-xs">
              <select
                value={selectedClassId}
                onChange={(event) => setSelectedClassId(event.target.value)}
                className="block h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-primary focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-blue-500 dark:focus:ring-blue-500"
              >
                <option value="">Lọc theo lớp: Tất cả</option>
                {classes.map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>
                    {schoolClass.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-gray-500 dark:text-gray-400">Đang tải...</p>
              </div>
            ) : filteredStudents.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300"><button type="button" onClick={() => handleSort('name')} className="hover:text-gray-900 dark:hover:text-white">Họ Tên {sortBy === 'name' ? (sortDirection === 'asc' ? '^' : 'v') : '<->'}</button></th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Tên Đăng Nhập</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300"><button type="button" onClick={() => handleSort('className')} className="hover:text-gray-900 dark:hover:text-white">Lớp Học {sortBy === 'className' ? (sortDirection === 'asc' ? '^' : 'v') : '<->'}</button></th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Ngày Sinh</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">Hành Động</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map(student => (
                    <tr key={student.id} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{student.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{student.username || '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 font-mono">
                        {student.schoolClassName || student.schoolClassId || '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('vi-VN') : '—'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenEdit(student)}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors dark:text-blue-400"
                            title="Chỉnh sửa"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleOpenResetPassword(student)}
                            className="p-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors dark:text-amber-400"
                            title="Đặt lại mật khẩu"
                          >
                            <KeyRound size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(student.id)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors dark:text-red-400"
                            title="Xóa"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <p className="text-gray-500 dark:text-gray-400 mb-2">
                    {searchQuery ? 'Không tìm thấy học sinh nào' : 'Chưa có học sinh nào'}
                  </p>
                  <button onClick={handleOpenCreate} className="text-primary hover:underline text-sm font-medium dark:text-blue-400">
                    Thêm học sinh đầu tiên
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
};

export default StudentManagement;

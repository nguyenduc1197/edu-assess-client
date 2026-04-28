import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, User as UserIcon, X } from 'lucide-react';
import { Student, Class } from '../../../types';
import { fetchClient } from '../../../api/fetchClient';
import { API_BASE_URL } from '../../../config/env';
import { ALLOWED_AVATAR_TYPES, AVATAR_ACCEPT, MAX_AVATAR_SIZE, MIN_PASSWORD_LENGTH } from './constants';
import { fetchAllClasses } from './studentApi';

interface StudentFormModalProps {
  student?: Student | null;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  onAvatarUpdated?: (studentId: string, avatarUrl: string | null) => void;
}

const StudentFormModal: React.FC<StudentFormModalProps> = ({ student, onClose, onSubmit, onAvatarUpdated }) => {
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(student?.avatarUrl || null);
  const [avatarError, setAvatarError] = useState('');
  const [avatarSuccess, setAvatarSuccess] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resetFormFields = () => {
    setName('');
    setDateOfBirth('');
    setSchoolClassId('');
    setUsername('');
    setPassword('');
  };

  useEffect(() => {
    const fetchClasses = async () => {
      setIsFetchingClasses(true);
      try {
        setClasses(await fetchAllClasses());
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
      return;
    }

    resetFormFields();
  }, [student]);

  useEffect(() => {
    setAvatarUrl(student?.avatarUrl || null);
    setAvatarError('');
    setAvatarSuccess('');
  }, [student]);

  const resolvedAvatarUrl = useMemo(() => {
    if (!avatarUrl) return '';
    if (/^https?:\/\//i.test(avatarUrl)) return avatarUrl;
    return `${API_BASE_URL}${avatarUrl.startsWith('/') ? avatarUrl : `/${avatarUrl}`}`;
  }, [avatarUrl]);

  const handleAvatarClick = () => {
    if (!student || isUploadingAvatar) return;
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!student || !file) return;

    setAvatarError('');
    setAvatarSuccess('');

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setAvatarError('Chỉ chấp nhận ảnh JPEG, PNG, GIF hoặc WEBP.');
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      setAvatarError('Ảnh đại diện không được vượt quá 5MB.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsUploadingAvatar(true);
      const response = await fetchClient(`/students/${student.id}/avatar`, {
        method: 'POST',
        body: formData,
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.message || 'Cập nhật ảnh đại diện thất bại.');
      }

      const nextAvatarUrl = typeof body?.avatarUrl === 'string' ? body.avatarUrl : null;
      setAvatarUrl(nextAvatarUrl);
      setAvatarSuccess('Ảnh đại diện đã được cập nhật.');
      onAvatarUpdated?.(student.id, nextAvatarUrl);
    } catch (uploadError) {
      setAvatarError(uploadError instanceof Error ? uploadError.message : 'Không thể tải ảnh lên.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('Vui lòng nhập họ tên'); return; }
    if (!dateOfBirth) { setError('Vui lòng nhập ngày sinh'); return; }
    if (!schoolClassId.trim()) { setError('Vui lòng nhập mã lớp học'); return; }
    if (!isEdit && !username.trim()) { setError('Vui lòng nhập tên đăng nhập'); return; }
    if (!isEdit && !password.trim()) { setError('Vui lòng nhập mật khẩu'); return; }
    if (!isEdit && password.trim().length < MIN_PASSWORD_LENGTH) { setError(`Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự`); return; }

    setIsSubmitting(true);
    try {
      const payload = isEdit
        ? { id: student!.id, name: name.trim(), dateOfBirth: `${dateOfBirth}T00:00:00`, schoolClassId: schoolClassId.trim() }
        : { name: name.trim(), dateOfBirth: `${dateOfBirth}T00:00:00`, schoolClassId: schoolClassId.trim(), username: username.trim(), password };
      await onSubmit(payload);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Đã xảy ra lỗi. Vui lòng thử lại.');
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

            {isEdit && student && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Ảnh Đại Diện</label>
                <div className="flex items-center gap-4">
                  <div className="group relative h-24 w-24 overflow-hidden rounded-full border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
                    {resolvedAvatarUrl ? (
                      <img src={resolvedAvatarUrl} alt={student.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-400 dark:text-gray-500">
                        <UserIcon size={36} />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleAvatarClick}
                      disabled={isUploadingAvatar}
                      className="absolute inset-0 flex items-center justify-center bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-100"
                    >
                      <span className="flex items-center gap-2 text-xs font-semibold">
                        <Camera size={16} />
                        {isUploadingAvatar ? 'Đang tải...' : 'Thay ảnh'}
                      </span>
                    </button>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    <p>JPEG, PNG, GIF, WEBP.</p>
                    <p>Dung lượng tối đa 5MB.</p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={AVATAR_ACCEPT}
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                {avatarError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
                    {avatarError}
                  </div>
                )}
                {avatarSuccess && (
                  <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
                    {avatarSuccess}
                  </div>
                )}
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

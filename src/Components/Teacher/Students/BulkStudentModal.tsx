import React, { useState, useEffect } from 'react';
import { X, PlusCircle, Trash2 } from 'lucide-react';
import { Class } from '../../../types';
import { fetchClient } from '../../../api/fetchClient';

interface StudentRow {
  name: string;
  dateOfBirth: string;
  username: string;
  password: string;
}

interface BulkStudentModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const emptyRow = (): StudentRow => ({ name: '', dateOfBirth: '', username: '', password: '' });

const BulkStudentModal: React.FC<BulkStudentModalProps> = ({ onClose, onSuccess }) => {
  const [schoolClassId, setSchoolClassId] = useState('');
  const [rows, setRows] = useState<StudentRow[]>([emptyRow()]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isFetchingClasses, setIsFetchingClasses] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const updateRow = (index: number, field: keyof StudentRow, value: string) => {
    setRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };

  const addRow = () => setRows(prev => [...prev, emptyRow()]);

  const removeRow = (index: number) => {
    if (rows.length === 1) return;
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!schoolClassId) {
      setError('Vui lòng chọn lớp học');
      return;
    }

    const invalidRow = rows.findIndex(r => !r.name.trim());
    if (invalidRow !== -1) {
      setError(`Dòng ${invalidRow + 1}: Vui lòng nhập họ tên học sinh`);
      return;
    }

    const students = rows.map(r => ({
      name: r.name.trim(),
      dateOfBirth: r.dateOfBirth ? `${r.dateOfBirth}T00:00:00` : null,
      username: r.username.trim() || null,
      password: r.password || null,
    }));

    setIsSubmitting(true);
    try {
      const response = await fetchClient('/students/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolClassId, students }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuccessMessage(`Đã thêm ${data.count} học sinh thành công`);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        const body = await response.json().catch(() => null);
        setError(body?.message || 'Lỗi không xác định');
      }
    } catch {
      setError('Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-4xl rounded-xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex-shrink-0">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Thêm Nhiều Học Sinh</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-5 overflow-y-auto flex-1">
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

            {/* Class selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Lớp Học <span className="text-red-500">*</span>
              </label>
              <select
                value={schoolClassId}
                onChange={e => setSchoolClassId(e.target.value)}
                disabled={isFetchingClasses}
                className="w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">{isFetchingClasses ? 'Đang tải lớp học...' : 'Chọn lớp học'}</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Student rows */}
            <div className="space-y-3">
              {/* Column headers */}
              <div className="hidden sm:grid sm:grid-cols-[1fr_160px_160px_160px_40px] gap-2 px-1">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Họ Tên <span className="text-red-500">*</span>
                </span>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ngày Sinh</span>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Tên Đăng Nhập
                  <span className="ml-1 font-normal normal-case text-gray-400">(tuỳ chọn)</span>
                </span>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Mật Khẩu
                  <span className="ml-1 font-normal normal-case text-gray-400">(tuỳ chọn)</span>
                </span>
                <span />
              </div>

              {rows.map((row, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_160px_160px_160px_40px] gap-2 items-start p-3 sm:p-0 bg-gray-50 sm:bg-transparent dark:bg-gray-800/40 sm:dark:bg-transparent rounded-lg sm:rounded-none"
                >
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 sm:hidden">Họ Tên *</label>
                    <input
                      type="text"
                      value={row.name}
                      onChange={e => updateRow(index, 'name', e.target.value)}
                      placeholder="Nguyễn Văn A"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 sm:hidden">Ngày Sinh</label>
                    <input
                      type="date"
                      value={row.dateOfBirth}
                      onChange={e => updateRow(index, 'dateOfBirth', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 sm:hidden">Tên Đăng Nhập</label>
                    <input
                      type="text"
                      value={row.username}
                      onChange={e => updateRow(index, 'username', e.target.value)}
                      placeholder="luyenthi_N"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 sm:hidden">Mật Khẩu</label>
                    <input
                      type="password"
                      value={row.password}
                      onChange={e => updateRow(index, 'password', e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex sm:justify-center items-center">
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      disabled={rows.length === 1}
                      title="Xóa dòng"
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addRow}
                className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                <PlusCircle size={18} />
                Thêm dòng
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {rows.length} học sinh
            </span>
            <div className="flex gap-3">
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
                {isSubmitting ? 'Đang lưu...' : 'Thêm Tất Cả'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BulkStudentModal;

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, PlusCircle, ChevronDown, Menu, Trash2, Edit2 } from 'lucide-react';
import { User } from '../../../types';
import Sidebar from '../../Common/Sidebar/Sidebar';
import AddQuestionMenu from '../Exam/AddQuestionMenu';
import { Question } from '../../../types';
import { fetchClient } from '../../../api/fetchClient';

interface QuestionManagementProps {
  onLogout?: () => void;
}

let mockUser: User = {
  id: "81114DB7-EF7C-4CEC-97B1-4428AA7AADA6",
  name: `An Nguyen`,
  email: "an.nguyen@school.edu",
  avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBaWbkVJIW-UxVbQAZVdNrwMze37EFXHpuuLhTSw7WJksMYe3RyK6MlICHa5M_rj6rAY8fmpaTsje51sF_GaYmBr15LrSN-IPsN9CSad_0QSDbvg69dUedrdiq4gN0Ev5352TfW0E_YrYXi0ugbxl2tDCdOwo84g_5dR-RxAreLeGB0Bs-5JS0tvLlFklj1uRh9wPZecX3HEGBS1Cgfm6tBuHD_pCTa6Z_JZN2Vzxo69eS-QEJjRqrhjg5yFrZfRnFYPL7VgejfRtgj"
};

const QuestionManagement: React.FC<QuestionManagementProps> = ({ onLogout }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchQuestions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await fetchClient("/questions/without-exam?pageNumber=1&pageSize=100");

      if (response.ok) {
        const data = await response.json();
        // Handle array response directly
        const items = Array.isArray(data) ? data : (data.data || []);
        
        const mappedQuestions: Question[] = items.map((item: any) => ({
          id: item.id,
          content: item.content,
          choices: (item.choices || []).map((choice: any) => ({
            optionLabel: choice.optionLabel || choice.id,
            content: choice.content,
            isCorrect: choice.isCorrect || false
          })),
          dateCreated: new Date(item.dateCreated).toLocaleDateString("vi-VN")
        }));

        setQuestions(mappedQuestions);
      } else {
        setError('Không thể tải danh sách câu hỏi');
      }
    } catch (err) {
      console.error("Failed to fetch questions", err);
      setError('Lỗi khi tải danh sách câu hỏi');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const filteredQuestions = useMemo(() => {
    return questions.filter(q =>
      q.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [questions, searchQuery]);

  const handleAddQuestion = async (newQuestion: Question) => {
    try {
      // Call API to create single question (for backward compatibility)
      const response = await fetchClient('/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newQuestion)
      });

      if (response.ok) {
        // Refresh list
        fetchQuestions();
        setIsAddModalOpen(false);
      } else {
        setError('Thêm câu hỏi thất bại. Vui lòng thử lại.');
      }
    } catch (err) {
      console.error("Error adding question:", err);
      setError('Đã xảy ra lỗi khi thêm câu hỏi.');
    }
  };

  const handleAddQuestions = async (newQuestions: Question[]) => {
    if (newQuestions.length === 0) return;
    
    try {
      setError('');
      let successCount = 0;
      let failedCount = 0;

      // Submit each question to the API
      for (const question of newQuestions) {
        try {
          const response = await fetchClient('/questions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(question)
          });

          if (response.ok) {
            successCount++;
          } else {
            failedCount++;
            console.error(`Failed to add question: ${question.content}`);
          }
        } catch (err) {
          failedCount++;
          console.error(`Error adding question: ${question.content}`, err);
        }
      }

      // Show result message
      if (failedCount === 0) {
        // All questions added successfully
        fetchQuestions();
        setIsAddModalOpen(false);
      } else if (successCount > 0) {
        // Some questions added, some failed
        setError(`Thêm ${successCount} câu hỏi thành công, ${failedCount} câu hỏi thất bại.`);
        fetchQuestions();
        setIsAddModalOpen(false);
      } else {
        // All failed
        setError('Thêm câu hỏi thất bại. Vui lòng thử lại.');
      }
    } catch (err) {
      console.error("Error adding questions:", err);
      setError('Đã xảy ra lỗi khi thêm câu hỏi.');
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa câu hỏi này không?")) {
      try {
        const response = await fetchClient(`/questions/${id}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          fetchQuestions();
        } else {
          alert('Xóa câu hỏi thất bại. Vui lòng thử lại.');
        }
      } catch (err) {
        console.error("Error deleting question:", err);
        alert('Đã xảy ra lỗi khi xóa câu hỏi.');
      }
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col lg:flex-row group/design-root">
      
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-start px-4 py-3 bg-white border-b border-gray-200 dark:bg-background-dark dark:border-gray-800 sticky top-0 z-20 shadow-sm gap-3">
        <button 
          className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg dark:text-gray-300 dark:hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 transition-colors"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Mở menu"
        >
          <Menu size={24} />
        </button>
        <span className="font-bold text-lg text-gray-900 dark:text-white tracking-tight">
          StudentHub
        </span>
      </div>

      <Sidebar 
        user={mockUser} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        onLogout={onLogout}
      />

      {/* Add Question Modal */}
      {isAddModalOpen && (
        <AddQuestionMenu 
          onClose={() => setIsAddModalOpen(false)}
          onAddQuestion={handleAddQuestion}
          onAddQuestions={handleAddQuestions}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 px-4 py-8 sm:px-8 lg:p-8 overflow-y-auto h-screen">
        <div className="mx-auto flex max-w-7xl flex-col gap-8">
          
          {/* Page Heading */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                Quản Lý Câu Hỏi
              </h1>
              <p className="text-base text-gray-500 dark:text-gray-400">
                Tổng cộng: {questions.length} câu hỏi
              </p>
            </div>
            
            <button 
              onClick={() => setIsAddModalOpen(true)} 
              className="flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary/90 transition-colors dark:bg-blue-700 dark:hover:bg-blue-800"
            >
              <PlusCircle size={20} />
              <span>Thêm Câu Hỏi</span>
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Toolbar & Filters */}
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            
            {/* Search Input */}
            <div className="relative w-full max-w-xs">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Search size={20} />
              </div>
              <input
                type="text"
                placeholder="Tìm câu hỏi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Questions Table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-gray-500 dark:text-gray-400">Đang tải...</p>
              </div>
            ) : filteredQuestions.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Câu Hỏi
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Số Đáp Án
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Ngày Tạo
                    </th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Hành Động
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuestions.map((question) => (
                    <tr
                      key={question.id}
                      className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-xs truncate">
                        {question.content}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {question.choices?.length} đáp án
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {question.dateCreated}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors dark:text-blue-400"
                            title="Chỉnh sửa"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(question.id)}
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
                    {searchQuery ? 'Không tìm thấy câu hỏi nào' : 'Chưa có câu hỏi nào'}
                  </p>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="text-primary hover:underline text-sm font-medium dark:text-blue-400"
                  >
                    Tạo câu hỏi đầu tiên
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

export default QuestionManagement;
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, PlusCircle, ChevronDown, Menu, Trash2, Edit2 } from 'lucide-react';
import { User } from '../../../types';
import Sidebar from '../../Common/Sidebar/Sidebar';
import AddQuestionMenu from '../Exam/AddQuestionMenu';
import { Question } from '../../../types';

interface QuestionManagementProps {
  onLogout?: () => void;
}

let mockUser: User = {
  id: "81114DB7-EF7C-4CEC-97B1-4428AA7AADA6",
  name: `An Nguyen`,
  email: "an.nguyen@school.edu",
  avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBaWbkVJIW-UxVbQAZVdNrwMze37EFXHpuuLhTSw7WJksMYe3RyK6MlICHa5M_rj6rAY8fmpaTsje51sF_GaYmBr15LrSN-IPsN9CSad_0QSDbvg69dUedrdiq4gN0Ev535[...]",
};

const QuestionManagement: React.FC<QuestionManagementProps> = ({ onLogout }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([
    {
      id: '1',
      content: 'Thủ đô của Việt Nam là?',
      choices: [
        { id: 'c1', content: 'Hà Nội', isCorrect: true },
        { id: 'c2', content: 'TP HCM', isCorrect: false },
        { id: 'c3', content: 'Đà Nẵng', isCorrect: false },
        { id: 'c4', content: 'Hải Phòng', isCorrect: false }
      ]
    }
  ]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const filteredQuestions = useMemo(() => {
    return questions.filter(q =>
      q.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [questions, searchQuery]);

  const handleAddQuestion = (newQuestion: Question) => {
    setQuestions([...questions, newQuestion]);
    setIsAddModalOpen(false);
  };

  const handleDeleteQuestion = (id: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa câu hỏi này không?")) {
      setQuestions(questions.filter(q => q.id !== id));
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
            {filteredQuestions.length > 0 ? (
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
                        {new Date().toLocaleDateString('vi-VN')}
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
import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Question } from '../../../types';

interface AddQuestionMenuProps {
  onAddQuestion?: (question: Question) => void;
  onClose?: () => void;
}

const AddQuestionMenu: React.FC<AddQuestionMenuProps> = ({ onAddQuestion, onClose }) => {
  const [content, setContent] = useState('');
  const [choices, setChoices] = useState(['', '', '', '']);
  const [correctChoice, setCorrectChoice] = useState(0);
  const [error, setError] = useState('');

  const handleChoiceChange = (index: number, value: string) => {
    const newChoices = [...choices];
    newChoices[index] = value;
    setChoices(newChoices);
  };

  const handleAddChoice = () => {
    setChoices([...choices, '']);
  };

  const handleRemoveChoice = (index: number) => {
    if (choices.length > 2) {
      const newChoices = choices.filter((_, i) => i !== index);
      setChoices(newChoices);
      if (correctChoice === index) setCorrectChoice(0);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!content.trim()) {
      setError('Vui lòng nhập nội dung câu hỏi');
      return;
    }

    if (choices.some(choice => !choice.trim())) {
      setError('Vui lòng điền đầy đủ tất cả các đáp án');
      return;
    }

    const newQuestion: Question = {
      id: `q-${Date.now()}`,
      content: content.trim(),
      choices: choices.map((choice, index) => ({
        id: `c-${index}`,
        content: choice.trim(),
        isCorrect: index === correctChoice
      }))
    };

    if (onAddQuestion) {
      onAddQuestion(newQuestion);
    }

    setContent('');
    setChoices(['', '', '', '']);
    setCorrectChoice(0);
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl rounded-xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-700"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Thêm Câu Hỏi Mới</h3>
          <button
            onClick={() => {
              if (onClose) onClose();
            }}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(100vh-200px)]">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nội Dung Câu Hỏi
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Nhập câu hỏi của bạn..."
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Đáp Án
              </label>

              {choices.map((choice, index) => (
                <div key={index} className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="correct"
                    checked={correctChoice === index}
                    onChange={() => setCorrectChoice(index)}
                    className="w-4 h-4 text-green-600 cursor-pointer"
                    title="Đáp án đúng"
                  />
                  <input
                    type="text"
                    value={choice}
                    onChange={(e) => handleChoiceChange(index, e.target.value)}
                    placeholder={`Đáp án ${index + 1}`}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {choices.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveChoice(index)}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddChoice}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <Plus size={16} />
                Thêm đáp án
              </button>
            </div>
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
          <button
            type="button"
            onClick={() => {
              if (onClose) onClose();
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors dark:bg-blue-700 dark:hover:bg-blue-800"
          >
            Thêm Câu Hỏi
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddQuestionMenu;
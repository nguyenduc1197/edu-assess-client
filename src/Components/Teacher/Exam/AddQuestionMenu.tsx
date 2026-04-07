import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Question } from '../../../types';

interface AddQuestionMenuProps {
  onAddQuestion?: (question: Question) => void;
  onAddQuestions?: (questions: Question[]) => void;
  onClose?: () => void;
}

const AddQuestionMenu: React.FC<AddQuestionMenuProps> = ({ onAddQuestion, onAddQuestions, onClose }) => {
  const [content, setContent] = useState('');
  const [choices, setChoices] = useState(['', '', '', '']);
  const [correctChoice, setCorrectChoice] = useState(0);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);

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

    // Generate option labels (A, B, C, D, etc.)
    const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F'];
    
    const newQuestion: Question = {
      id: `q-${Date.now()}`,
      content: content.trim(),
      choices: choices.map((choice, index) => ({
        optionLabel: optionLabels[index] || String(index),
        content: choice.trim(),
        isCorrect: index === correctChoice
      }))
    };

    // Add question to the list
    setQuestions([...questions, newQuestion]);
    
    // Only call onAddQuestion if we're in single-question mode (no batch handler)
    // If onAddQuestions is provided, we're in batch mode - don't submit until user clicks "Xong"
    if (onAddQuestion && !onAddQuestions) {
      onAddQuestion(newQuestion);
    }

    // Reset form for next question
    setContent('');
    setChoices(['', '', '', '']);
    setCorrectChoice(0);
  };

  const handleRemoveQuestion = (index: number) => {
    const newQuestions = questions.filter((_, i) => i !== index);
    setQuestions(newQuestions);
  };

  const handleFinish = () => {
    if (questions.length === 0) {
      setError('Vui lòng thêm ít nhất một câu hỏi');
      return;
    }

    if (onAddQuestions) {
      onAddQuestions(questions);
    }

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

              {choices.map((choice, index) => {
                const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F'];
                return (
                  <div key={index} className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="correct"
                      checked={correctChoice === index}
                      onChange={() => setCorrectChoice(index)}
                      className="w-4 h-4 text-green-600 cursor-pointer"
                      title="Đáp án đúng"
                    />
                    <span className="w-8 h-8 flex items-center justify-center bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-semibold rounded text-sm">
                      {optionLabels[index] || index}
                    </span>
                    <input
                      type="text"
                      value={choice}
                      onChange={(e) => handleChoiceChange(index, e.target.value)}
                      placeholder={`Nội dung đáp án`}
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
                );
              })}

              <button
                type="button"
                onClick={handleAddChoice}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <Plus size={16} />
                Thêm đáp án
              </button>
            </div>

            <button
              type="submit"
              className="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors dark:bg-green-700 dark:hover:bg-green-800"
            >
              Thêm Câu Hỏi
            </button>
          </form>

          {/* Danh sách câu hỏi đã thêm */}
          {questions.length > 0 && (
            <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Câu hỏi đã thêm ({questions.length})
              </h4>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {questions.map((question, index) => (
                  <div
                    key={question.id}
                    className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                            Câu {index + 1}:
                          </span>{' '}
                          {question.content}
                        </p>
                        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                          {question.choices && question.choices.map((choice, cIdx) => (
                            <div key={cIdx} className="flex items-center gap-2">
                              <span
                                className={`inline-block w-4 h-4 rounded-full border ${
                                  choice.isCorrect
                                    ? 'bg-green-500 border-green-600'
                                    : 'border-gray-300 dark:border-gray-600'
                                }`}
                              ></span>
                              <span className="font-semibold text-gray-700 dark:text-gray-300" title="Tùy chọn">
                                {choice.optionLabel}:
                              </span>
                              <span>{choice.content}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(index)}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors flex-shrink-0"
                        title="Xóa câu hỏi"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
            onClick={handleFinish}
            disabled={questions.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors dark:bg-blue-700 dark:hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Xong ({questions.length})
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddQuestionMenu;
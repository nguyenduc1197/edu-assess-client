import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, Flag } from 'lucide-react';
import { AnswerState, Question } from '../../../types';

interface ExamTakingProps {
  examTitle: string;
  questions: Question[];
  answers: Record<string, AnswerState>;
  onAnswer: (questionId: string, id: string, content: string) => void;
  onReview: () => void;
  onExit: () => void;
}

const ExamTaking: React.FC<ExamTakingProps> = ({ 
  examTitle, 
  questions, 
  answers, 
  onAnswer, 
  onReview,
  onExit
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const currentQuestion = questions[currentQuestionIndex];
  const progress = Math.round((Object.keys(answers).length / questions.length) * 100);

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  if (!currentQuestion) return <div>Loading questions...</div>;

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-100">
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 dark:border-gray-800 dark:bg-background-dark">
        <div className="flex items-center gap-4">
          <button onClick={onExit} className="text-gray-500 hover:text-red-600 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
          <h1 className="text-lg font-bold">{examTitle}</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-xs text-gray-500 dark:text-gray-400">Thời gian còn lại</span>
            <span className="font-mono font-bold text-primary">45:00</span>
          </div>
          <button 
            onClick={onReview}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors"
          >
            Review & Nộp bài
          </button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Question Area */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-10">
          <div className="mx-auto max-w-3xl">
            {/* Progress Bar (Mobile) */}
            <div className="mb-6 lg:hidden">
              <div className="flex justify-between text-xs mb-1">
                 <span>Tiến độ</span>
                 <span>{progress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-800">
                <div 
                  className="h-2 rounded-full bg-primary transition-all duration-300" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="mb-8">
              <span className="text-sm font-semibold text-primary uppercase tracking-wider">
                Câu hỏi {currentQuestionIndex + 1} / {questions.length}
              </span>
              <h2 className="mt-4 text-2xl font-medium leading-relaxed">
                {currentQuestion.content}
              </h2>
            </div>

            {/* Options */}
            <div className="space-y-3">
              {currentQuestion.choices?.map((option) => {
                const isSelected = answers[currentQuestion.id]?.content === option.content;

                return (
                  <label 
                    key={option.id}
                    className={`flex cursor-pointer items-center rounded-xl border p-4 transition-all ${
                      isSelected 
                        ? 'border-primary bg-primary/5 ring-1 ring-primary dark:bg-primary/10' 
                        : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-background-dark dark:hover:bg-gray-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question-${currentQuestion.id}`}
                      value={option.content}
                      checked={isSelected}
                      onChange={() => onAnswer(currentQuestion.id, option.id, option.content)}
                      className="h-5 w-5 border-gray-300 text-primary focus:ring-primary dark:border-gray-600 dark:bg-gray-700"
                    />
                    <span className="ml-4 font-medium text-gray-700 dark:text-gray-200">
                       {option.content}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Navigation Buttons */}
            <div className="mt-10 flex items-center justify-between">
              <button
                onClick={handlePrev}
                disabled={currentQuestionIndex === 0}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-background-dark dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <ChevronLeft size={16} />
                Quay lại
              </button>
              
              <button
                onClick={handleNext}
                disabled={currentQuestionIndex === questions.length - 1}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-background-dark dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Tiếp theo
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <aside className="hidden w-80 flex-col border-l border-gray-200 bg-white dark:border-gray-800 dark:bg-background-dark lg:flex">
          <div className="p-6">
            <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">Danh sách câu hỏi</h3>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const isAnswered = !!answers[q.id];
                const isCurrent = idx === currentQuestionIndex;
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium transition-all ${
                      isCurrent
                        ? 'bg-primary text-white shadow-md'
                        : isAnswered
                        ? 'bg-blue-50 text-primary dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
          
          <div className="mt-auto border-t border-gray-200 p-6 dark:border-gray-800">
             <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full bg-primary"></div>
                   <span>Hiện tại</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full bg-blue-50 dark:bg-blue-900/30"></div>
                   <span>Đã làm</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full bg-gray-100 dark:bg-gray-800"></div>
                   <span>Chưa làm</span>
                </div>
             </div>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default ExamTaking;

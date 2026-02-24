import React from 'react';
import {  Send, Edit3 } from 'lucide-react';
import { AnswerState, Question } from '../../../types';

interface ExamReviewProps {
  questions: Question[];
  answers: Record<string, AnswerState>;
  onBackToExam: () => void;
  onSubmit: () => void;
}

const ExamReview: React.FC<ExamReviewProps> = ({ questions, answers, onBackToExam, onSubmit }) => {
  const answeredCount = Object.keys(answers).length;
  const totalCount = questions.length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Xem lại bài làm</h1>
            <p className="mt-1 text-gray-500 dark:text-gray-400">
              Vui lòng kiểm tra lại các câu trả lời trước khi nộp bài.
            </p>
          </div>
          <div className="flex gap-3">
             <button
              onClick={onBackToExam}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-background-dark dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <Edit3 size={16} />
              Làm lại / Sửa
            </button>
            <button
              onClick={onSubmit}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              <Send size={16} />
              Nộp Bài
            </button>
          </div>
        </div>

        {/* Summary Card */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-background-dark">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="flex flex-col items-center justify-center border-r border-gray-100 p-2 last:border-0 dark:border-gray-800">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">{totalCount}</span>
              <span className="text-sm text-gray-500">Tổng số câu</span>
            </div>
            <div className="flex flex-col items-center justify-center border-r border-gray-100 p-2 last:border-0 dark:border-gray-800">
              <span className="text-3xl font-bold text-primary">{answeredCount}</span>
              <span className="text-sm text-gray-500">Đã trả lời</span>
            </div>
            <div className="flex flex-col items-center justify-center p-2">
              <span className="text-3xl font-bold text-gray-400">{totalCount - answeredCount}</span>
              <span className="text-sm text-gray-500">Chưa trả lời</span>
            </div>
          </div>
        </div>

        {/* Detailed List */}
        <div className="space-y-4">
          {questions.map((q, idx) => {
            const answer = answers[q.id];
            return (
              <div 
                key={q.id} 
                className={`flex items-start justify-between rounded-lg border p-4 transition-colors ${
                  answer 
                    ? 'border-gray-200 bg-white dark:border-gray-800 dark:bg-background-dark' 
                    : 'border-yellow-200 bg-yellow-50 dark:border-yellow-900/30 dark:bg-yellow-900/10'
                }`}
              >
                <div className="flex gap-4">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-100 text-xs font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-200 line-clamp-1">{q.content}</p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {answer 
                        ? <span className="text-primary font-medium">Đã chọn: {answer.content}</span> 
                        : <span className="text-yellow-600 dark:text-yellow-500 italic">Chưa chọn đáp án</span>
                      }
                    </p>
                  </div>
                </div>
                <button 
                  onClick={onBackToExam}
                  className="shrink-0 text-sm font-medium text-primary hover:text-primary-dark hover:underline"
                >
                  Sửa
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ExamReview;

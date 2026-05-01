import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnswerState, Question } from '../../../types';

interface ExamTakingProps {
  examTitle: string;
  examEnd?: string;
  questions: Question[];
  answers: Record<string, AnswerState>;
  onAnswer: (questionId: string, id: string, content: string) => void;
  onReview: () => void;
  onExit: () => void;
}

const ExamTaking: React.FC<ExamTakingProps> = ({ 
  examTitle, 
  examEnd,
  questions, 
  answers, 
  onAnswer, 
  onReview,
  onExit
}) => {
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(() => {
    if (!examEnd) return null;
    const diff = Math.floor((new Date(examEnd).getTime() - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (remainingSeconds === null) return;
    if (remainingSeconds <= 0) return;
    const tid = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null || prev <= 1) {
          window.clearInterval(tid);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(tid);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const formatCountdown = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
  };

  const questionBlocks = useMemo(() => {
    const processedGroups = new Set<string>();

    return questions.reduce<Array<{ key: string; type: 'single' | 'group'; questions: Question[]; passageText?: string | null }>>((blocks, question) => {
      const groupKey = question.passageGroupKey?.trim();

      if (question.questionFormat === 'TrueFalse' && groupKey) {
        if (processedGroups.has(groupKey)) {
          return blocks;
        }

        const groupedQuestions = questions
          .filter((item) => item.questionFormat === 'TrueFalse' && item.passageGroupKey === groupKey)
          .sort(
            (a, b) =>
              (a.statementOrder ?? Number.MAX_SAFE_INTEGER) -
              (b.statementOrder ?? Number.MAX_SAFE_INTEGER)
          );

        blocks.push({
          key: groupKey,
          type: 'group',
          questions: groupedQuestions,
          passageText: groupedQuestions.find((item) => item.passageText)?.passageText || question.passageText,
        });

        processedGroups.add(groupKey);
        return blocks;
      }

      blocks.push({ key: question.id, type: 'single', questions: [question] });
      return blocks;
    }, []);
  }, [questions]);

  useEffect(() => {
    if (currentBlockIndex >= questionBlocks.length) {
      setCurrentBlockIndex(Math.max(questionBlocks.length - 1, 0));
    }
  }, [currentBlockIndex, questionBlocks.length]);

  const currentBlock = questionBlocks[currentBlockIndex];
  const currentQuestion = currentBlock?.questions[0];
  const progress = questions.length === 0 ? 0 : Math.round((Object.keys(answers).length / questions.length) * 100);

  const handleNext = () => {
    if (currentBlockIndex < questionBlocks.length - 1) {
      setCurrentBlockIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentBlockIndex > 0) {
      setCurrentBlockIndex((prev) => prev - 1);
    }
  };

  if (!currentQuestion || !currentBlock) return <div>Loading questions...</div>;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gray-50 text-gray-900 dark:bg-black dark:text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-background-dark sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <button onClick={onExit} className="rounded-lg p-1 text-gray-500 transition-colors hover:text-red-600">
            <span className="material-symbols-outlined">close</span>
            </button>
            <h1 className="line-clamp-1 text-base font-bold sm:text-lg">{examTitle}</h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs text-gray-500 dark:text-gray-400">Thời gian còn lại</span>
              <span className={`font-mono font-bold ${
                remainingSeconds !== null && remainingSeconds <= 300 ? 'text-red-500' : 'text-primary'
              }`}>
                {remainingSeconds !== null ? formatCountdown(remainingSeconds) : '--:--'}
              </span>
            </div>
            <div
              className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300 sm:hidden"
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="sr-only">Thời gian còn lại </span>
              {remainingSeconds !== null ? formatCountdown(remainingSeconds) : '--:--'}
            </div>
            <button
              onClick={onReview}
              className="min-h-10 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
            >
              Review & Nộp bài
            </button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Question Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10">
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
                {currentBlock.type === 'group'
                  ? `Nhóm câu ${currentBlockIndex + 1} / ${questionBlocks.length}`
                  : `Câu hỏi ${currentBlockIndex + 1} / ${questionBlocks.length}`}
              </span>

              {currentBlock.type === 'group' ? (
                <div className="mt-4 space-y-5">
                  <div>
                    <h2 className="text-2xl font-medium leading-relaxed">Đọc đoạn văn và chọn Đúng hoặc Sai cho từng mệnh đề</h2>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      Tất cả các mệnh đề liên quan đã được gộp vào cùng một trang để em dễ đối chiếu.
                    </p>
                  </div>

                  {currentBlock.passageText && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Đoạn văn chung
                      </p>
                      <p>{currentBlock.passageText}</p>
                    </div>
                  )}
                </div>
              ) : (
                <h2 className="mt-4 text-2xl font-medium leading-relaxed">
                  {currentQuestion.content}
                </h2>
              )}
            </div>

            {/* Options */}
            {currentBlock.type === 'group' ? (
              <div className="space-y-4">
                {currentBlock.questions.map((question, questionIdx) => (
                  <div key={question.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-background-dark">
                    <p className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
                      Mệnh đề {question.statementOrder ?? questionIdx + 1}: {question.content}
                    </p>
                    <div className="space-y-3">
                      {question.choices?.map((option) => {
                        const isSelected = answers[question.id]?.choiceId === option.id;

                        return (
                          <label
                            key={option.id || `${question.id}-${option.optionLabel}`}
                            className={`flex cursor-pointer items-center rounded-xl border p-4 transition-all ${
                              isSelected
                                ? 'border-primary bg-primary/5 ring-1 ring-primary dark:bg-primary/10'
                                : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-background-dark dark:hover:bg-gray-800'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`question-${question.id}`}
                              value={option.id ?? ''}
                              checked={isSelected}
                              onChange={() => onAnswer(question.id, option.id ?? '', option.content)}
                              className="h-5 w-5 border-gray-300 text-primary focus:ring-primary dark:border-gray-600 dark:bg-gray-700"
                            />
                            <span className="ml-4 font-medium text-gray-700 dark:text-gray-200">
                              {option.optionLabel && <span className="mr-2 font-bold text-primary">{option.optionLabel}.</span>}
                              {option.content}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {currentQuestion.choices?.map((option) => {
                  const isSelected = answers[currentQuestion.id]?.choiceId === option.id;

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
                        value={option.id ?? ''}
                        checked={isSelected}
                        onChange={() => onAnswer(currentQuestion.id, option.id ?? '', option.content)}
                        className="h-5 w-5 border-gray-300 text-primary focus:ring-primary dark:border-gray-600 dark:bg-gray-700"
                      />
                      <span className="ml-4 font-medium text-gray-700 dark:text-gray-200">
                        {option.optionLabel && <span className="mr-2 font-bold text-primary">{option.optionLabel}.</span>}
                        {option.content}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                onClick={handlePrev}
                disabled={currentBlockIndex === 0}
                className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-background-dark dark:text-gray-200 dark:hover:bg-gray-800 sm:w-auto"
              >
                <ChevronLeft size={16} />
                Quay lại
              </button>
              
              <button
                onClick={handleNext}
                disabled={currentBlockIndex === questionBlocks.length - 1}
                className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-background-dark dark:text-gray-200 dark:hover:bg-gray-800 sm:w-auto"
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
              {questionBlocks.map((block, idx) => {
                const isAnswered = block.questions.every((q) => !!answers[q.id]);
                const isCurrent = idx === currentBlockIndex;
                return (
                  <button
                    key={block.key}
                    onClick={() => setCurrentBlockIndex(idx)}
                    className={`flex h-10 min-w-10 items-center justify-center rounded-lg px-2 text-sm font-medium transition-all ${
                      isCurrent
                        ? 'bg-primary text-white shadow-md'
                        : isAnswered
                        ? 'bg-blue-50 text-primary dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                    }`}
                    title={block.type === 'group' ? 'Nhóm câu Đúng / Sai' : `Câu ${idx + 1}`}
                  >
                    {block.type === 'group' ? `Đ/S ${idx + 1}` : idx + 1}
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

import React, { useState, useEffect, useRef } from 'react';
import { AnswerState, Assignment, AssessmentResult, Question } from '../../../types';
import ExamReview from './ExamReview';
import ExamTaking from './ExamTaking';
import { fetchClient } from '../../../api/fetchClient';


interface ExamSessionProps {
  assignment: Assignment;
  examId: string;
  onExit: () => void;
  onSubmitted?: () => void;
}

type SessionStep = 'taking' | 'review' | 'assessing' | 'result';

const ExamSession: React.FC<ExamSessionProps> = ({ assignment, examId, onExit, onSubmitted }) => {
  const [step, setStep] = useState<SessionStep>('taking');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResult | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch questions specifically for this exam context
  // Note: Using the general questions endpoint for demo purposes as per instructions
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        setIsLoading(true);
        const response = await fetchClient(`/questions?pageNumber=1&examId=${examId}&pageSize=20`);
        
        if (response.ok) {
          const data = await response.json();
          const items = Array.isArray(data) ? data : (data.items || data.data || []);
          setQuestions(items);
        } else {
            throw new Error('API Error');
        }
      } catch (error) {
        console.warn("Failed to load exam questions, using mock data.", error);
        // Fallback mock data
        const mockQuestions: Question[] = [
            { id: 'q1', content: 'Quyền bình đẳng của công dân trong lao động được thể hiện ở việc mọi công dân đều có quyền?' },
            { id: 'q2', content: 'Nội dung nào dưới đây không phải là bình đẳng trong hôn nhân và gia đình?'},
            { id: 'q3', content: 'Hành vi nào dưới đây vi phạm quyền bình đẳng của công dân trước pháp luật?'},
            { id: 'q4', content: 'Quyền bình đẳng giữa các dân tộc được hiểu là các dân tộc trong cộng đồng dân cư Việt Nam có quyền dùng tiếng nói, chữ viết của dân tộc mình là thể hiện quyền bình đẳng về?'},
            { id: 'q5', content: 'Công dân bình đẳng về trách nhiệm pháp lí là?'}
        ];
        setQuestions(mockQuestions);
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuestions();
  }, [examId]);

  const handleAnswer = (questionId: string, choiceId: string, content: string) => {
   setAnswers(prev => ({
  ...prev,
  [questionId]: {
    content,
    choiceId,
  },
}));
  }

  const handleSubmit = async () => {
    try {
      const payload = {
        answers: Object.entries(answers).map(([questionId, value]) => ({
          questionId,
          choiceId: value.choiceId ?? null,
          essayAnswer: null,
        })),
      };

      const response = await fetchClient(`/exams/${examId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const submitData = await response.json();
        const studentExamId: string = submitData.studentExamId;
        onSubmitted?.();
        setStep('assessing');
        startPolling(studentExamId);
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(`Nộp bài thất bại: ${errorData.message || 'Lỗi không xác định'}`);
      }
    } catch (error) {
      console.error('Error submitting exam:', error);
      alert('Đã xảy ra lỗi khi nộp bài. Vui lòng thử lại.');
    }
  };

  const startPolling = (studentExamId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetchClient(`/student-exams/${studentExamId}/assessment`);
        if (res.ok) {
          const data: AssessmentResult = await res.json();
          if (data.assessmentStatus === 'Completed' || data.assessmentStatus === 'Failed') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setAssessmentResult(data);
            setStep('result');
          }
        }
      } catch {
        // keep polling; transient errors shouldn't stop us
      }
    }, 3000);
  };

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  if (step === 'taking' && isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-300">Đang tải câu hỏi...</div>;
  }

  if (step === 'review') {
    return (
      <ExamReview 
        questions={questions}
        answers={answers}
        onBackToExam={() => setStep('taking')}
        onSubmit={handleSubmit}
      />
    );
  }

  if (step === 'assessing') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 p-6">
        <div className="flex flex-col items-center gap-6 max-w-md text-center">
          <div className="h-16 w-16 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Đang đánh giá bài làm</h2>
          <p className="text-gray-500 dark:text-gray-400">
            Vui lòng chờ trong giây lát, bài làm đang được đánh giá...
          </p>
        </div>
      </div>
    );
  }

  if (step === 'result' && assessmentResult) {
    const {
      examName,
      studentName,
      score,
      assessmentStatus,
      assessmentError,
      behaviorAdjustmentScore,
      selfDevelopmentScore,
      economicSocialParticipationScore,
      overallFeedback,
    } = assessmentResult;

    const failed = assessmentStatus === 'Failed';

    const competencies = [
      { label: 'Năng lực điều chỉnh hành vi', isShown: behaviorAdjustmentScore !== null },
      { label: 'Năng lực phát triển bản thân', isShown: selfDevelopmentScore !== null },
      { label: 'Năng lực tìm hiểu và tham gia hoạt động kinh tế - xã hội', isShown: economicSocialParticipationScore !== null },
    ].filter((item) => item.isShown);

    return (
      <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950 p-4 sm:p-8">
        <div className="mx-auto w-full max-w-2xl flex flex-col gap-6">

          {/* Header */}
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{examName}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{studentName}</p>
          </div>

          {failed ? (
            <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-5 text-red-700 dark:text-red-300">
              <p className="font-semibold">Đánh giá thất bại</p>
              {assessmentError && <p className="mt-1 text-sm">{assessmentError}</p>}
            </div>
          ) : (
            <>
              {/* Score card */}
              <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 p-6 flex flex-col items-center gap-2">
                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Điểm số</span>
                <span className="text-5xl font-extrabold text-blue-700 dark:text-blue-300">{score?.toFixed(1)}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">/ 10</span>
              </div>

              {/* Overall feedback */}
              {overallFeedback && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Nhận xét chung</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{overallFeedback}</p>
                </div>
              )}

              {competencies.length > 0 && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Các năng lực được đánh giá</p>
                  <div className="flex flex-wrap gap-2">
                    {competencies.map((c) => (
                      <span
                        key={c.label}
                        className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 text-sm font-medium text-indigo-700 dark:text-indigo-300"
                      >
                        {c.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Exit button */}
          <button
            onClick={onExit}
            className="mt-2 w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors dark:bg-blue-700 dark:hover:bg-blue-800"
          >
            Về trang chủ
          </button>
        </div>
      </div>
    );
  }

  return (
    <ExamTaking
      examTitle={assignment.title}
      questions={questions}
      answers={answers}
      onAnswer={handleAnswer}
      onReview={() => setStep('review')}
      onExit={onExit}
    />
  );
};

export default ExamSession;
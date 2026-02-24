import React, { useState, useEffect } from 'react';
import { AnswerState, Assignment, Question } from '../../../types';
import ExamReview from './ExamReview';
import ExamTaking from './ExamTaking';


interface ExamSessionProps {
  assignment: Assignment;
  examId: string;
  studentId: string;
  onExit: () => void;
}

type SessionStep = 'taking' | 'review';

const ExamSession: React.FC<ExamSessionProps> = ({ assignment, examId, studentId, onExit }) => {
  const [step, setStep] = useState<SessionStep>('taking');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Fetch questions specifically for this exam context
  // Note: Using the general questions endpoint for demo purposes as per instructions
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await fetch(`http://localhost:5188/questions?pageNumber=1&examId=${examId}&pageSize=20`, {
          headers: { 'accept': '*/*' }
        });
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
  }, []);

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
        studentId: studentId,
        answers: Object.entries(answers).map(([questionId, value]) => ({
          questionId,
          choiceId: value.choiceId ?? null
        }))
      };

      const response = await fetch(`http://localhost:5188/exams/${assignment.id}/submit`, {
        method: 'POST',
        headers: {
          'accept': '*/*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert("Đã nộp bài thành công!");
        onExit();
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(`Nộp bài thất bại: ${errorData.message || 'Lỗi không xác định'}`);
      }
    } catch (error) {
      console.error("Error submitting exam:", error);
      alert("Đã xảy ra lỗi khi nộp bài. Vui lòng thử lại.");
    }
  };

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
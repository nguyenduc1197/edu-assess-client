import React, { useEffect, useState } from "react";
import axios from "axios";
import "./ExamPage.css";
import { useNavigate } from "react-router-dom";
import { Question } from "../../types";

const ExamPage: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const restoreAnswers = () => {
      const savedAnswers = sessionStorage.getItem("exam_answers");
      if (savedAnswers) setAnswers(JSON.parse(savedAnswers));
    };

    restoreAnswers();

    window.addEventListener("pageshow", restoreAnswers);
    return () => window.removeEventListener("pageshow", restoreAnswers);
  }, []);

  useEffect(() => {
    sessionStorage.setItem("exam_answers", JSON.stringify(answers));
  }, [answers]);

  const handleChange = (questionId: string, value: string) => {
    setAnswers({ ...answers, [questionId]: value });
  };

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const res = await axios.get<Question[]>(
          "http://localhost:5188/questions?pageNumber=1&pageSize=10"
        );
        setQuestions(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, []);

  const handleSubmit = () => {
    sessionStorage.setItem("exam_answers", JSON.stringify(answers));
    navigate("/review", { state: { questions, answers } });
  };

  if (loading) return <div className="loading">Đang tải đề thi...</div>;

  return (
    <div className="exam-container fade-in">
      <h1 className="exam-title">Bài Thi Online</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        {questions.map((q, i) => (
          <div key={q.id} className="question-card slide-up">
            <p className="question-text">
              <b>Câu {i + 1}:</b> {q.content}
            </p>

            <div className="choices-container">
              {q.choices?.map((c) => (
                <label key={c.id} className="choice-label hover-glow">
                  <input
                    type="radio"
                    name={`question-${q.id}`}
                    value={c.id}
                    checked={answers[q.id] === c.id}
                    onChange={() => handleChange(q.id, c.id)}
                  />
                  <span className="choice-text">{c.content}</span>
                </label>
              ))}
            </div>
          </div>
        ))}

        <div className="submit-container">
          <button type="submit" className="submit-btn pulse-btn">
            Nộp bài
          </button>
        </div>
      </form>
    </div>
  );
};

export default ExamPage;

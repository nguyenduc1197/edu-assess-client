import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../ExamPage/ExamPage";

const ReviewPage = () => {
  const { state } = useLocation();
  const navigate = useNavigate();

  const { questions, answers } = state || { questions: [], answers: {} };

  return (
    <div className="review-container fade-in">
      <h1 className="review-title">Xem Lại Bài Làm</h1>

      {questions.map((q: any, index: any) => {
        const selected = q.choices.find((c:any) => c.id === answers[q.id]);

        return (
          <div key={q.id} className="review-card slide-up">
            <p className="review-question">
              <b>Câu {index + 1}:</b> {q.content}
            </p>

            <p className="review-answer">
              <b>Đáp án bạn chọn:</b>{" "}
              <span className="highlight">
                {selected ? selected.content : "Chưa chọn"}
              </span>
            </p>
          </div>
        );
      })}

      <button className="submit-btn pulse-btn" onClick={() => navigate("/")}>
        Làm lại bài thi
      </button>
    </div>
  );
};

export default ReviewPage;
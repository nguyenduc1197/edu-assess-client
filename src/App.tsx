import './App.css';
import ExamPage from './Components/ExamPage/ExamPage';
import { BrowserRouter, Route, Router, Routes } from 'react-router-dom';
import ReviewPage from './Components/ReviewExam/ReviewExam';
import StudentDashboard from './Components/Student/Dashboard/StudentDashboard';
import TeacherDashboard from './Components/Teacher/Dashboard/TeacherDashboard';

function App() {
   return (
     <BrowserRouter>
      <Routes>
        {/* <Route path="/" element={<ExamPage />} /> */}
        <Route path="/" element={<TeacherDashboard />} />
        <Route path="/teacherdashboard" element={<TeacherDashboard />} />
        <Route path="/studentdashboard" element={<StudentDashboard />} />
        <Route path="/review" element={<ReviewPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

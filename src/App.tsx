import './App.css';
import { BrowserRouter, Navigate, Route, Router, Routes } from 'react-router-dom';
import ReviewPage from './Components/ReviewExam/ReviewExam';
import StudentDashboard from './Components/Student/Dashboard/StudentDashboard';
import TeacherDashboard from './Components/Teacher/Dashboard/TeacherDashboard';
import Login from './Components/Common/Login/Login';
import { useEffect, useState } from 'react';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
    }
    const role = localStorage.getItem('role');
    if (role && role == 'Teacher') {
      setIsTeacher(true);
    }
    else if (role && role == 'Student')
    {
      setIsTeacher(false);
    }

    setIsLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('name');
    localStorage.removeItem('role');
    setIsAuthenticated(false);
  };

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Login onLogin={(role) => {
    setIsAuthenticated(true);
    setIsTeacher(role === "Teacher");
  }} />;
  }

   return (
     <BrowserRouter>
      <Routes>
        {/* <Route path="/" element={<ExamPage />} /> */}

        {
          !isAuthenticated ?
        <Route path="/login" element={<Login onLogin={(role) => {
    setIsAuthenticated(true);
    setIsTeacher(role === "Teacher");
  }}
/>} /> 
        :        
        <>
        {
          isTeacher &&
          <> 
            <Route path="/" element={<TeacherDashboard onLogout={handleLogout} />} />
            <Route path="/teacherdashboard" element={<TeacherDashboard onLogout={handleLogout} />} />
          </>
        }
        {
         !isTeacher &&
          <>
            <Route path="/" element={<StudentDashboard onLogout={handleLogout} />} />
            <Route path="/studentdashboard" element={<StudentDashboard onLogout={handleLogout} />} />
            <Route path="/review" element={<ReviewPage />} />
          </>
        }
        <Route path="*" element={
                                  isAuthenticated 
                                  ? <Navigate to={isTeacher ? "/teacherdashboard" : "/studentdashboard"} /> 
                                  : <Navigate to="/login" />
        } 
  />
        </>
        }
      </Routes>
    </BrowserRouter>
  );
}

export default App;

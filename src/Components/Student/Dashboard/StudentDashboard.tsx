import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, PlusCircle, ChevronDown, Menu } from 'lucide-react';
import { AppView, Assignment, AssignmentStatus, LoginProps, SubjectLabel, User } from '../../../types';
import Sidebar from '../../Common/Sidebar/Sidebar';
import AssignmentTable from '../../Common/AssignmentTable/AssignmentTable';
import ExamSession from '../Exam/ExamSession';
import { API_BASE_URL } from '../../../config/env';
import { fetchClient } from '../../../api/fetchClient';

const mockUser: User = {
  id: "81114DB7-EF7C-4CEC-97B1-4428AA7AADA6",
  name: `An Nguyen`,
  email: "an.nguyen@school.edu",
  avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBaWbkVJIW-UxVbQAZVdNrwMze37EFXHpuuLhTSw7WJksMYe3RyK6MlICHa5M_rj6rAY8fmpaTsje51sF_GaYmBr15LrSN-IPsN9CSad_0QSDbvg69dUedrdiq4gN0Ev5352TfW0E_YrYXi0ugbxl2tDCdOwo84g_5dR-RxAreLeGB0Bs-5JS0tvLlFklj1uRh9wPZecX3HEGBS1Cgfm6tBuHD_pCTa6Z_JZN2Vzxo69eS-QEJjRqrhjg5yFrZfRnFYPL7VgejfRtgj"
};

const TeacherDashboard: React.FC<LoginProps> = ({ onLogout }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedExam, setSelectedExam] = useState<Assignment | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const fetchAssignments = useCallback(async () => {
    try {
      const response = await fetchClient(`/exams?pageNumber=1&pageSize=100`);
      
      if (response.ok) {
        const data = await response.json();
        // Handle array response directly as per your sample
        const items = Array.isArray(data) ? data : (data.data || []);

        const mappedAssignments: Assignment[] = items.map((item: any) => {
          const endDate = new Date(item.end);
          const startDate = new Date(item.start);
          const now = new Date();
          
          // Logic to determine status since API doesn't return it
          let status = AssignmentStatus.NEW;
          if (now > endDate) {
            status = AssignmentStatus.GRADED; // Or LATE/CLOSED depending on logic
          } else if (now >= startDate && now <= endDate) {
            status = AssignmentStatus.IN_PROGRESS;
          }

          return {
            id: item.id,
            title: item.name,
            subject: SubjectLabel.GD_KTPL, // Default subject since API doesn't return it
            deadline: item.end,
            deadlineDisplay: endDate.toLocaleString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              weekday: 'long',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            }),
            status: status,
            isOverdue: now > endDate
          };
        });
        
        setAssignments(mappedAssignments);
      }
    } catch (error) {
      console.error("Failed to fetch assignments", error);
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter(a => 
      a.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [assignments, searchQuery]);

  const handleStartExam = (assignment: Assignment) => {
    setSelectedExam(assignment);
    setCurrentView('exam-session');
    // Scroll to top when entering exam session
    window.scrollTo(0, 0);
  };

  const handleExitExam = () => {
    setSelectedExam(null);
    setCurrentView('dashboard');
    fetchAssignments(); // Refresh status on exit
  };

   // Render Exam View
  if (currentView === 'exam-session' && selectedExam) {
    return <ExamSession assignment={selectedExam} examId={selectedExam.id} studentId={mockUser.id} onExit={handleExitExam} />;
  }


  return (
    <div className="relative flex min-h-screen w-full flex-col lg:flex-row group/design-root">
      
      {/* Mobile Header (Only visible on small screens) */}
      <div className="lg:hidden flex items-center justify-start px-4 py-3 bg-white border-b border-gray-200 dark:bg-background-dark dark:border-gray-800 sticky top-0 z-20 shadow-sm gap-3">
        <button 
          className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg dark:text-gray-300 dark:hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 transition-colors"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Mở menu"
        >
            <Menu size={24} />
        </button>
        <span className="font-bold text-lg text-gray-900 dark:text-white tracking-tight">
          StudentHub
        </span>
      </div>

      <Sidebar 
        user={mockUser} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        onLogout={onLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 px-4 py-8 sm:px-8 lg:p-8 overflow-y-auto h-screen">
        <div className="mx-auto flex max-w-7xl flex-col gap-8">
          
          {/* Page Heading */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                Bài Tập Đã Giao
              </h1>
              <p className="text-base text-gray-500 dark:text-gray-400">
                Đây là danh sách các bài tập bạn đã giao
              </p>
            </div>
          
          </div>

          {/* Toolbar & Filters */}
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            
            {/* Search Input */}
            <div className="relative w-full max-w-xs">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Search size={20} />
              </div>
              <input
                type="text"
                placeholder="Tìm bài tập..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary dark:border-gray-700 dark:bg-background-dark dark:text-white dark:placeholder-gray-500 transition-colors"
              />
            </div>

            {/* Filter Chips */}
            <div className="flex flex-wrap gap-2">
              <button className="flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 transition-colors">
                <span>Tất cả trạng thái</span>
                <ChevronDown size={16} className="text-gray-500" />
              </button>
              
              <button className="flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 transition-colors">
                <span>Tất cả môn học</span>
                <ChevronDown size={16} className="text-gray-500" />
              </button>
            </div>
          </div>

          {/* Table Data */}
          <AssignmentTable assignments={filteredAssignments} 
          onStartExam={handleStartExam}/>

        </div>
      </main>
    </div>
  );
};

export default TeacherDashboard;
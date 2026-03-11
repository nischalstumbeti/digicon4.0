import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { BrandingProvider, BrandingContext } from './context/BrandingContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import TeamDashboard from './pages/TeamDashboard';
import ProblemSelection from './pages/ProblemSelection';
import FormTeam from './pages/FormTeam';
import AdminLayout from './components/AdminLayout';
import TeamLayout from './components/TeamLayout';
import AdminDashboard from './pages/AdminDashboard';
import AdminTeams from './pages/AdminTeams';
import AdminProblems from './pages/AdminProblems';
import AdminLogs from './pages/AdminLogs';
import AdminRounds from './pages/AdminRounds';
import AdminStaff from './pages/AdminStaff';
import AdminMarks from './pages/AdminMarks';
import AdminCMS from './pages/AdminCMS';

const RootRedirect = () => {
  const { user } = React.useContext(AuthContext);
  if (!user) return <Navigate to="/login" />;
  if (user.mustChangePassword) return <Navigate to="/change-password" />;
  if (user.role === 'Admin' || user.role === 'StudentCoordinator' || user.role === 'FacultyCoordinator') return <Navigate to="/admin" />;
  if (user.role === 'Student') return <Navigate to="/team/form" />;
  return <Navigate to="/team" />;
};

function App() {
  const BrandingFooter = () => {
    const { branding } = React.useContext(BrandingContext);
    const footerText = branding?.footerText || 'Designed & Developed by Web Development Division, KARE ACM SIGBED Student Chapter';
    return (
      <footer className="app-footer text-center small theme-muted py-3">
        {footerText}
      </footer>
    );
  };

  return (
    <BrandingProvider>
      <AuthProvider>
        <BrowserRouter>
          <Navbar />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/change-password" element={<ChangePassword />} />

            <Route path="/" element={<RootRedirect />} />

            {/* Student: form team first */}
            <Route element={<ProtectedRoute role="Student" />}>
              <Route path="/team/form" element={<FormTeam />} />
            </Route>

            {/* Team Routes — layout with left sidebar */}
            <Route element={<ProtectedRoute role="Team" />}>
              <Route path="/team" element={<TeamLayout />}>
                <Route index element={<TeamDashboard />} />
                <Route path="problems" element={<ProblemSelection />} />
              </Route>
            </Route>

            {/* Admin Routes — official layout with left sidebar */}
            <Route element={<ProtectedRoute role="Admin" />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="teams" element={<AdminTeams />} />
                <Route path="problems" element={<AdminProblems />} />
                <Route path="logs" element={<AdminLogs />} />
                <Route path="rounds" element={<AdminRounds />} />
                <Route path="staff" element={<AdminStaff />} />
                <Route path="marks" element={<AdminMarks />} />
                <Route path="cms" element={<AdminCMS />} />
              </Route>
            </Route>

          </Routes>
          <BrandingFooter />
        </BrowserRouter>
      </AuthProvider>
    </BrandingProvider>
  );
}

export default App;

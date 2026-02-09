import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import About from './pages/About';
import Services from './pages/Services';
import Contact from './pages/Contact';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import AdminRoute from './components/AdminRoute';
import AdminSignup from './pages/admin/Signup';
import AdminSignupCredentials from './pages/admin/SignupCredentials';
import AdminWorkerRegistration from './pages/admin/AdminWorkerRegistration';
import AdminQuestionForm from './pages/admin/AdminQuestionForm';
import PendingActions from './pages/admin/PendingActions';
import WorkerDashboard from './pages/Worker/WorkerDashboard';
import WorkerTaskDetail from './pages/Worker/WorkerTaskDetail';
import WorkerSettings from './pages/Worker/WorkerSettings';
import WorkHistory from './pages/Worker/WorkHistory';
import PMProjectManager from './pages/pm/PMProjectManager';
import WKProjectTasks from './pages/pm/WKProject_Tasks';
import PMProjects from './pages/pm/PMProjects';
import WKCreateProject from './pages/pm/WKCreateProject';
import ProjectDetail from './pages/pm/ProjectDetail';
import WKAssignWorker from './pages/pm/WKAssignWorker';
import PMSettings from './pages/pm/PMSettings';
import SkillAssessmentTest from './pages/Worker/SkillAssessmentTest';
import SkillAssessmentSummary from './pages/Worker/SkillAssessmentSummary';
import SkillAssessmentQuiz from './pages/Skill Assessment Quiz';
import ForemanDashboard from './pages/Foreman/ForemanDashboard';
import ForemanAssessment from './pages/Foreman/ForemanAssessment';
import ForemanReportSystem from './pages/Foreman/ForemanReportSystem';
import ForemanSettings from './pages/Foreman/ForemanSettings';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="about" element={<About />} />
            <Route path="services" element={<Services />} />
            <Route path="portfolio" element={<Services />} />
            <Route path="contact" element={<Contact />} />
            <Route path="login" element={<Login />} />
            <Route path="admin/signup" element={<AdminRoute><AdminSignup /></AdminRoute>} />
            <Route path="admin/signup/credentials" element={<AdminRoute><AdminSignupCredentials /></AdminRoute>} />
            <Route path="admin/worker-registration" element={<AdminRoute><AdminWorkerRegistration /></AdminRoute>} />
            <Route path="admin/question/add" element={<AdminRoute><AdminQuestionForm /></AdminRoute>} />
            <Route path="admin/question/edit/:id" element={<AdminRoute><AdminQuestionForm /></AdminRoute>} />
            <Route path="admin/pending-actions" element={<AdminRoute><PendingActions /></AdminRoute>} />
            <Route path="dashboard" element={<WorkerDashboard />} />
            <Route path="worker" element={<WorkerDashboard />} />
            <Route path="worker-settings" element={<WorkerSettings />} />
            <Route path="worker/history" element={<WorkHistory />} />
            <Route path="worker/task-detail" element={<WorkerTaskDetail />} />
            <Route path="admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="pm" element={<PMProjectManager />} />
            <Route path="projects" element={<PMProjects />} />
            <Route path="create-project" element={<WKCreateProject />} />
            <Route path="project-detail" element={<ProjectDetail />} />
            <Route path="project-tasks" element={<WKProjectTasks />} />
            <Route path="assign-worker" element={<WKAssignWorker />} />
            <Route path="pm-settings" element={<PMSettings />} />
            <Route path="foreman" element={<ForemanDashboard />} />
            <Route path="foreman-assessment" element={<ForemanAssessment />} />
            <Route path="foreman-reports" element={<ForemanReportSystem />} />
            <Route path="foreman-settings" element={<ForemanSettings />} />
            <Route path="skill-assessment" element={<SkillAssessmentTest />} />
            <Route path="skill-assessment/summary" element={<SkillAssessmentSummary />} />
            <Route path="skill-assessment/quiz" element={<SkillAssessmentQuiz />} />
            <Route path="submit-work" element={<WorkerTaskDetail />} />
            <Route path="worker-profile" element={<WorkerSettings />} />
          </Route>
        </Routes>
      </div>
    </Router>
  );
}

export default App;

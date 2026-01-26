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
import WKDashboard from './pages/WKDashboard';
import PMProjectManager from './pages/PMProjectManager';
import WKProjectTasks from './pages/WKProject_Tasks';
import WKSkillAssessmentTest from './pages/WKSkill_Assessment_Test';
import WKSkillAssessmentQuiz from './pages/WKSkill_Assessment_Quiz';
import WKWorkerProfile from './pages/WKWorkerProfile';
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
            <Route path="dashboard" element={<WKDashboard />} />
            <Route path="admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="pm" element={<PMProjectManager />} />
            <Route path="project-tasks" element={<WKProjectTasks />} />
            <Route path="skill-assessment" element={<WKSkillAssessmentTest />} />
            <Route path="skill-assessment/quiz" element={<WKSkillAssessmentQuiz />} />
            <Route path="worker-profile" element={<WKWorkerProfile />} />
          </Route>
        </Routes>
      </div>
    </Router>
  );
}

export default App;

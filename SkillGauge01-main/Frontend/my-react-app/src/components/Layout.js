import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import './Layout.css';

const Layout = () => {
  const location = useLocation();
  const hideHeaderRoutes = [
    '/dashboard',
    '/worker',
    '/worker-settings',
    '/worker/task-detail',
    '/pm',
    '/projects',
    '/create-project',
    '/project-detail',
    '/project-tasks',
    '/assign-worker',
    '/pm-settings',
    '/skill-assessment',
    '/submit-work',
    '/worker-profile',
    '/admin'
  ];
  
  const shouldHideHeader = hideHeaderRoutes.some(path => location.pathname.startsWith(path));

  return (
    <div className="layout-grid">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Kanit:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Noto+Sans+Thai:wght@100..900&family=Roboto:ital,wght@0,100..900;1,100..900&display=swap');
        body, button, input, textarea, select, h1, h2, h3, h4, h5, h6, p, span, div, a, li, label, th, td {
          font-family: 'Kanit', 'Noto Sans Thai', 'Inter', 'Roboto', sans-serif !important;
        }
      `}</style>
      {!shouldHideHeader && (
        <header className="layout-header">
          <Header />
        </header>
      )}
      
      <main className="layout-main">
        <Outlet />
      </main>
      
      {!shouldHideHeader && (
        <footer className="layout-footer">
          <Footer />
        </footer>
      )}
    </div>
  );
};

export default Layout;
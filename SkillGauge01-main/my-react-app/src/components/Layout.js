import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import './Layout.css';

const Layout = () => {
  const location = useLocation();
  const hideHeaderRoutes = [
    '/dashboard',
    '/pm',
    '/project-tasks',
    '/skill-assessment',
    '/submit-work',
    '/worker-profile',
    '/admin'
  ];
  
  const shouldHideHeader = hideHeaderRoutes.some(path => location.pathname.startsWith(path));

  return (
    <div className="layout-grid">
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
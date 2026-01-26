import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import './Layout.css';

const Layout = () => {
  return (
    <div className="layout-grid">
      <header className="layout-header">
        <Header />
      </header>
      
      <main className="layout-main">
        <Outlet />
      </main>
      
      <footer className="layout-footer">
        <Footer />
      </footer>
    </div>
  );
};

export default Layout;
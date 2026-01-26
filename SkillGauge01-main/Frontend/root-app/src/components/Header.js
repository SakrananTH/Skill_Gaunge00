import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Header.css';

const Header = () => {
  const location = useLocation();
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('ไทย');

  const isActive = (path) => {
    return location.pathname === path;
  };

  const toggleLanguageDropdown = () => {
    setShowLanguageDropdown(!showLanguageDropdown);
  };

  const selectLanguage = (language) => {
    setSelectedLanguage(language);
    setShowLanguageDropdown(false);
  };

  // ปิด dropdown เมื่อคลิกข้างนอก
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.language-selector')) {
        setShowLanguageDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <header className="header">
      <div className="container">
        <Link to="/" className="logo">
          <img src="/logo192.png" alt="Skill Gauge Logo" className="logo-img" />
          <h1>Skill Gauge</h1>
        </Link>
        
        <nav className="nav">
          <ul className="nav-list">
            <li>
              <Link 
                to="/" 
                className={`nav-link ${isActive('/') ? 'active' : ''}`}
              >
                หน้าแรก
              </Link>
            </li>
            <li>
              <Link 
                to="/services" 
                className={`nav-link ${isActive('/services') ? 'active' : ''}`}
              >
                บริการ
              </Link>
            </li>
            <li>
              <Link 
                to="/portfolio" 
                className={`nav-link ${isActive('/portfolio') ? 'active' : ''}`}
              >
                ผลงาน
              </Link>
            </li>
            <li>
              <Link 
                to="/about" 
                className={`nav-link ${isActive('/about') ? 'active' : ''}`}
              >
                เกี่ยวกับเรา
              </Link>
            </li>
            <li>
              <Link 
                to="/contact" 
                className={`nav-link ${isActive('/contact') ? 'active' : ''}`}
              >
                ติดต่อ
              </Link>
            </li>
          </ul>
        </nav>

        {/* Header Actions */}
        <div className="header-actions">
          <div className="language-selector">
            <button 
              className="language-btn" 
              onClick={toggleLanguageDropdown}
              title="เลือกภาษา"
            >
              {selectedLanguage}
              <span className="dropdown-arrow">▼</span>
            </button>
            {showLanguageDropdown && (
              <div className="language-dropdown">
                <button 
                  className="language-option"
                  onClick={() => selectLanguage('ไทย')}
                >
                  ไทย
                </button>
                <button 
                  className="language-option"
                  onClick={() => selectLanguage('English')}
                >
                  English
                </button>
                <button 
                  className="language-option"
                  onClick={() => selectLanguage('中文')}
                >
                  ลาว
                </button>
                <button 
                  className="language-option"
                  onClick={() => selectLanguage('日本語')}
                >
                  พม่า
                </button>
              </div>
            )}
          </div>
          <Link to="/login" className="sign-in-btn" role="button">
            เข้าสู่ระบบ
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button className="mobile-menu-btn">
          ☰
        </button>
      </div>
    </header>
  );
};

export default Header;
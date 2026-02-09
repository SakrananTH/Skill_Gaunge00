import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './PMTheme.css';
import LogoutModal from '../../components/LogoutModal';

const PMTopNav = ({ active = 'home', user, onLogout }) => {
  const navigate = useNavigate();

  const items = [
    { key: 'home', label: 'หน้าหลัก', path: '/pm', icon: <i className='bx bx-home'></i> },
    { key: 'projects', label: 'โครงการทั้งหมด', path: '/projects', icon: <i className='bx bx-buildings'></i> },
    { key: 'tasks', label: 'มอบหมายงาน', path: '/project-tasks', icon: <i className='bx bx-task'></i> }
  ];

  const handleNavigate = (path) => {
    navigate(path, { state: { user } });
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
      return;
    }
    setShowLogoutModal(true);
  };

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  return (
    <nav className="pm-topbar">
      <div className="pm-topbar__brand" onClick={() => handleNavigate('/pm')} role="button" tabIndex={0}>
        <img src="/logo123.png" alt="Skill Gauge" className="pm-topbar__logo" />
        <div>
          <div className="pm-topbar__title">PM Portal</div>
          <div className="pm-topbar__subtitle">Project Management Console</div>
        </div>
      </div>

      <div className="pm-topbar__nav">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`pm-nav-btn ${active === item.key ? 'active' : ''}`}
            onClick={() => handleNavigate(item.path)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className="pm-topbar__actions">
        <button 
          type="button" 
          className="pm-nav-btn" 
          onClick={() => handleNavigate('/pm-settings')} 
          style={{ width: '40px', padding: 0, justifyContent: 'center', marginRight: '5px', color: '#64748b' }}
          title="ตั้งค่าระบบ"
        >
          <i className='bx bx-cog' style={{ fontSize: '22px' }}></i>
        </button>

        <div className="pm-user-chip">
          <div>
            <div className="pm-user-role">{user?.role || 'Project Manager'}</div>
            <div className="pm-user-email">{user?.full_name || user?.name || user?.email || user?.username || '-'}</div>
          </div>
        </div>
        <button type="button" className="pm-logout" onClick={handleLogout}>
          ออกจากระบบ
        </button>
        <LogoutModal show={showLogoutModal} onClose={() => setShowLogoutModal(false)} />
      </div>
    </nav>
  );
};

export default PMTopNav;

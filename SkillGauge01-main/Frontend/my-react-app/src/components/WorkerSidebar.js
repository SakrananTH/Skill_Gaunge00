import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const WorkerSidebar = ({ user, active = 'tasks', className = '' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const navUser = user ?? location.state?.user ?? null;

  const normalizedRole = useMemo(() => {
    return (navUser?.role || 'worker').toString().toLowerCase();
  }, [navUser?.role]);

  const canTakeAssessment = normalizedRole === 'worker' || normalizedRole === 'foreman';

  const go = (path) => {
    navigate(path, { state: { user: navUser } });
  };

  const handleLogout = () => {
    // Clear any auth tokens
    try {
      window.sessionStorage?.removeItem('auth_token');
      window.sessionStorage?.removeItem('user_id');
      window.localStorage?.removeItem('auth_token');
      window.localStorage?.removeItem('user_id');
    } catch (e) {
      console.error('Logout cleanup error', e);
    }
    navigate('/login');
  };

  const items = [
    { key: 'tasks', label: 'งานที่ได้รับมอบหมาย', path: '/dashboard' },
    { key: 'skill', label: 'แบบทดสอบประเมินทักษะ', path: '/skill-assessment', disabled: !canTakeAssessment },
    { key: 'submit', label: 'ส่งงาน', path: '/submit-work' },
    { key: 'settings', label: 'ตั้งค่า', path: '/worker-profile' }
  ];

  return (
    <aside className={`dash-sidebar ${className}`}>
      <div className="brand">
        <i className='bx bx-gauge'></i> Skill Gauge
      </div>
      <nav className="menu">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`menu-item ${active === item.key ? 'active' : ''}`}
            onClick={() => go(item.path)}
            disabled={item.disabled}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          className="menu-item logout-item"
          onClick={handleLogout}
          style={{ color: '#ef4444', marginTop: '0.5rem' }} 
        >
          ออกจากระบบ
        </button>
      </nav>
    </aside>
  );
};

export default WorkerSidebar;

import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const WorkerSidebar = ({ user, active = 'tasks' }) => {
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

  const items = [
    { key: 'tasks', label: 'Tasks', path: '/dashboard' },
    { key: 'skill', label: 'Skill Assessment Test', path: '/skill-assessment', disabled: !canTakeAssessment },
    { key: 'submit', label: 'Submit work', path: '/submit-work' },
    { key: 'settings', label: 'Settings', path: '/worker-profile' }
  ];

  return (
    <aside className="dash-sidebar">
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
      </nav>
    </aside>
  );
};

export default WorkerSidebar;

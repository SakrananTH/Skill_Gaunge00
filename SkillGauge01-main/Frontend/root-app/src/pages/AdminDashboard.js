import React, { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Dashboard.css';
import { mockUser } from '../mock/mockData';
import AdminOverview from './admin/AdminOverview';
import AdminUsersTable from './admin/AdminUsersTable';
import AdminQuizBank from './admin/AdminQuizBank';
import AdminAuditLog from './admin/AdminAuditLog';
import AdminSettings from './admin/AdminSettings';

const AdminDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const navUser = location.state?.user;
  const user = navUser || { ...mockUser, role: 'admin', username: '0863125891' };

  const [tab, setTab] = useState(location.state?.initialTab || 'overview');
  const [avatar, setAvatar] = useState(null);

  useEffect(() => {
    const storedAvatar = localStorage.getItem('admin_avatar');
    if (storedAvatar) {
      setAvatar(storedAvatar);
    }
  }, []);

  return (
    <div className="admin-layout">
      <main className="dash-main">
        <div className="dash-main-content-wrapper">
          <div className="dash-topbar">
            <div className="role-pill">Admin</div>
            <div className="top-actions">
              <span className="profile">
                {avatar ? (
                  <img src={avatar} alt="Profile" className="avatar-img" />
                ) : (
                  <span className="avatar" />
                )}
                <span className="phone">{user.username}</span>
              </span>
            </div>
          </div>

          {/* Admin horizontal menu */}
          <nav className="admin-top-menu">
            <div className="menu horizontal">
              <button type="button" className={`menu-item ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
                <span className="icon"><svg  xmlns="http://www.w3.org/2000/svg" width={24} height={24} fill={"currentColor"} viewBox="0 0 24 24">{/* Boxicons v3.0.6 https://boxicons.com | License  https://docs.boxicons.com/free */}<path d="M4 2H2v19c0 .55.45 1 1 1h19v-2H4z"></path><path d="M19 18c.55 0 1-.45 1-1V5c0-.55-.45-1-1-1h-4c-.55 0-1 .45-1 1v12c0 .55.45 1 1 1zM16 6h2v10h-2zM11 18c.55 0 1-.45 1-1v-7c0-.55-.45-1-1-1H7c-.55 0-1 .45-1 1v7c0 .55.45 1 1 1zm-3-7h2v5H8z"></path></svg></span> ภาพรวมระบบ
              </button>
              <button type="button" className={`menu-item ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
                <span className="icon"><svg  xmlns="http://www.w3.org/2000/svg" width={24} height={24} fill={"currentColor"} viewBox="0 0 24 24">{/* Boxicons v3.0.6 https://boxicons.com | License  https://docs.boxicons.com/free */}<path d="m12,11c1.71,0,3-1.29,3-3s-1.29-3-3-3-3,1.29-3,3,1.29,3,3,3Zm0-4c.6,0,1,.4,1,1s-.4,1-1,1-1-.4-1-1,.4-1,1-1Z"></path><path d="m13,12h-2c-2.76,0-5,2.24-5,5v.5c0,.83.67,1.5,1.5,1.5h9c.83,0,1.5-.67,1.5-1.5v-.5c0-2.76-2.24-5-5-5Zm-5,5c0-1.65,1.35-3,3-3h2c1.65,0,3,1.35,3,3h-8Z"></path><path d="m6.5,11c.47,0,.9-.12,1.27-.33-.48-.77-.77-1.68-.77-2.67,0-.66.13-1.28.35-1.85-.26-.09-.55-.15-.85-.15-1.44,0-2.5,1.06-2.5,2.5s1.06,2.5,2.5,2.5Z"></path><path d="m6.11,12h-.61c-1.93,0-3.5,1.57-3.5,3.5v1c0,.28.22.5.5.5h1.5c0-1.96.81-3.73,2.11-5Z"></path><path d="m17.5,11c1.44,0,2.5-1.06,2.5-2.5s-1.06-2.5-2.5-2.5c-.31,0-.59.06-.85.15.22.57.35,1.19.35,1.85,0,.99-.29,1.9-.77,2.67.37.21.79.33,1.27.33Z"></path><path d="m18.5,12h-.61c1.3,1.27,2.11,3.04,2.11,5h1.5c.28,0,.5-.22.5-.5v-1c0-1.93-1.57-3.5-3.5-3.5Z"></path></svg></span> จัดการผู้ใช้งาน
              </button>
              <button type="button" className={`menu-item ${tab === 'quiz' ? 'active' : ''}`} onClick={() => setTab('quiz')}>
                <span className="icon"><svg  xmlns="http://www.w3.org/2000/svg" width={24} height={24} fill={"currentColor"} viewBox="0 0 24 24">{/* Boxicons v3.0.6 https://boxicons.com | License  https://docs.boxicons.com/free */}<path d="m12,11c1.71,0,3-1.29,3-3s-1.29-3-3-3-3,1.29-3,3,1.29,3,3,3Zm0-4c.6,0,1,.4,1,1s-.4,1-1,1-1-.4-1-1,.4-1,1-1Z"></path><path d="m13,12h-2c-2.76,0-5,2.24-5,5v.5c0,.83.67,1.5,1.5,1.5h9c.83,0,1.5-.67,1.5-1.5v-.5c0-2.76-2.24-5-5-5Zm-5,5c0-1.65,1.35-3,3-3h2c1.65,0,3,1.35,3,3h-8Z"></path><path d="m6.5,11c.47,0,.9-.12,1.27-.33-.48-.77-.77-1.68-.77-2.67,0-.66.13-1.28.35-1.85-.26-.09-.55-.15-.85-.15-1.44,0-2.5,1.06-2.5,2.5s1.06,2.5,2.5,2.5Z"></path><path d="m6.11,12h-.61c-1.93,0-3.5,1.57-3.5,3.5v1c0,.28.22.5.5.5h1.5c0-1.96.81-3.73,2.11-5Z"></path><path d="m17.5,11c1.44,0,2.5-1.06,2.5-2.5s-1.06-2.5-2.5-2.5c-.31,0-.59.06-.85.15.22.57.35,1.19.35,1.85,0,.99-.29,1.9-.77,2.67.37.21.79.33,1.27.33Z"></path><path d="m18.5,12h-.61c1.3,1.27,2.11,3.04,2.11,5h1.5c.28,0,.5-.22.5-.5v-1c0-1.93-1.57-3.5-3.5-3.5Z"></path></svg></span> จัดการคําถาม
              </button>
              <button type="button" className={`menu-item ${tab === 'audit' ? 'active' : ''}`} onClick={() => setTab('audit')}>
                <span className="icon"><svg  xmlns="http://www.w3.org/2000/svg" width={24} height={24} fill={"currentColor"} viewBox="0 0 24 24">{/* Boxicons v3.0.6 https://boxicons.com | License  https://docs.boxicons.com/free */}<path d="m12,2C6.58,2,2,6.58,2,12s4.58,10,10,10,10-4.58,10-10S17.42,2,12,2Zm0,18c-4.34,0-8-3.66-8-8S7.66,4,12,4s8,3.66,8,8-3.66,8-8,8Z"></path><path d="M13 7 11 7 11 13 17 13 17 11 13 11 13 7z"></path></svg></span> ประวัติการใช้งาน
              </button>
              <button type="button" className={`menu-item ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
                <span className="icon"><svg  xmlns="http://www.w3.org/2000/svg" width={24} height={24} fill={"currentColor"} viewBox="0 0 24 24">{/* Boxicons v3.0.6 https://boxicons.com | License  https://docs.boxicons.com/free */}<path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4m0 6c-1.08 0-2-.92-2-2s.92-2 2-2 2 .92 2 2-.92 2-2 2"></path><path d="m20.42 13.4-.51-.29c.05-.37.08-.74.08-1.11s-.03-.74-.08-1.11l.51-.29c.96-.55 1.28-1.78.73-2.73l-1-1.73a2.006 2.006 0 0 0-2.73-.73l-.53.31c-.58-.46-1.22-.83-1.9-1.11v-.6c0-1.1-.9-2-2-2h-2c-1.1 0-2 .9-2 2v.6c-.67.28-1.31.66-1.9 1.11l-.53-.31c-.96-.55-2.18-.22-2.73.73l-1 1.73c-.55.96-.22 2.18.73 2.73l.51.29c-.05.37-.08.74-.08 1.11s.03.74.08 1.11l-.51.29c-.96.55-1.28 1.78-.73 2.73l1 1.73c.55.95 1.77 1.28 2.73.73l.53-.31c.58.46 1.22.83 1.9 1.11v.6c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2v-.6a8.7 8.7 0 0 0 1.9-1.11l.53.31c.95.55 2.18.22 2.73-.73l1-1.73c.55-.96.22-2.18-.73-2.73m-2.59-2.78c.11.45.17.92.17 1.38s-.06.92-.17 1.38a1 1 0 0 0 .47 1.11l1.12.65-1 1.73-1.14-.66c-.38-.22-.87-.16-1.19.14-.68.65-1.51 1.13-2.38 1.4-.42.13-.71.52-.71.96v1.3h-2v-1.3c0-.44-.29-.83-.71-.96-.88-.27-1.7-.75-2.38-1.4a1.01 1.01 0 0 0-1.19-.15l-1.14.66-1-1.73 1.12-.65c.39-.22.58-.68.47-1.11-.11-.45-.17-.92-.17-1.38s.06-.93.17-1.38A1 1 0 0 0 5.7 9.5l-1.12-.65 1-1.73 1.14.66c.38.22.87.16 1.19-.14.68-.65 1.51-1.13 2.38-1.4.42-.13.71-.52.71-.96v-1.3h2v1.3c0 .44.29.83.71.96.88.27 1.7.75 2.38 1.4.32.31.81.36 1.19.14l1.14-.66 1 1.73-1.12.65c-.39.22-.58.68-.47 1.11Z"></path></svg></span> ตั้งค่า
              </button>
            </div>
          </nav>

          <div className="dash-content-area">
            {tab === 'overview' && <AdminOverview setTab={setTab} />}
            {tab === 'users' && <AdminUsersTable />}
            {tab === 'quiz' && <AdminQuizBank />}
            {tab === 'audit' && <AdminAuditLog />}
            {tab === 'settings' && <AdminSettings avatar={avatar} onAvatarChange={setAvatar} />}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;

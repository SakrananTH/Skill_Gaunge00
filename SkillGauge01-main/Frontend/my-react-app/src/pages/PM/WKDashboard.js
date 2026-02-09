import React, { useMemo, useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import './WKDashboard.css';
import { mockUser, mockProjects, mockSites, mockTasks } from '../../mock/mockData';

const Dashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const navUser = location.state?.user;
  const user = navUser || mockUser;

  // ฟังก์ชัน Logout สำหรับ Sidebar
  const handleLogout = () => {
    if (window.confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
      sessionStorage.clear();
      navigate('/login');
    }
  };

  // Build maps for joins
  const projectById = useMemo(() => Object.fromEntries(mockProjects.map(p => [p.id, p])) , []);

  // UI state
  const [q, setQ] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [tab, setTab] = useState('todo'); // todo | in-progress | done
  const [dueSort, setDueSort] = useState('asc'); // asc | desc

  // Derive tasks for this user
  const tasks = useMemo(() => {
    const mine = mockTasks.filter(t => !user?.username || t.assigneeUsername === user.username);
    const filtered = mine.filter(t => {
      if (projectFilter !== 'all') {
        const proj = projectById[t.siteId ? mockSites.find(s=>s.id===t.siteId)?.projectId : undefined] || t.projectId;
        if (proj !== projectFilter) return false;
      }
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (tab === 'todo' && t.status !== 'todo') return false;
      if (tab === 'in-progress' && t.status !== 'in-progress') return false;
      if (tab === 'done' && t.status !== 'done') return false;
      if (q) {
        const projName = projectById[t.projectId]?.name || '';
        const hay = `${t.title} ${projName}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
    return filtered.sort((a,b)=>{
      const da = new Date(a.dueDate).getTime();
      const db = new Date(b.dueDate).getTime();
      return dueSort === 'asc' ? da - db : db - da;
    });
  }, [user, q, projectFilter, priorityFilter, tab, dueSort, projectById]);

  const projectOptions = [{ id:'all', name:'Project' }, ...mockProjects];

  const role = (user?.role || 'Worker').toLowerCase().replace(/[_-]+/g, ' ');

  return (
    <div className="dash-layout">
      {/* Sidebar - ปรับให้เหมือน Worker/Foreman */}
      <aside className="dash-sidebar">
        <div className="sidebar-title" style={{ padding: '20px', textAlign: 'center', fontWeight: 'bold', color: '#1e293b' }}>
          PM Portal
        </div>
        <nav className="menu">
          <button 
            type="button" 
            className={`menu-item ${location.pathname === '/pm' || location.pathname === '/dashboard' ? 'active' : ''}`} 
            onClick={() => navigate('/pm', { state: { user } })}
          >
            หน้าหลัก
          </button>
          <button 
            type="button" 
            className={`menu-item ${location.pathname === '/project-tasks' ? 'active' : ''}`} 
            onClick={() => navigate('/project-tasks', { state: { user } })}
          >
            มอบหมายงาน
          </button>
          <button 
            type="button" 
            className={`menu-item ${location.pathname === '/projects' ? 'active' : ''}`} 
            onClick={() => navigate('/projects', { state: { user } })}
          >
            โครงการทั้งหมด
          </button>
          <button 
            type="button" 
            className={`menu-item ${location.pathname === '/pm-settings' ? 'active' : ''}`} 
            onClick={() => navigate('/pm-settings', { state: { user } })}
          >
            ตั้งค่า
          </button>
          <button 
            type="button" 
            className="menu-item logout-btn" 
            style={{ marginTop: '20px', color: '#ef4444', background: '#fef2f2', borderColor: '#fee2e2' }}
            onClick={handleLogout}
          >
            ออกจากระบบ
          </button>
        </nav>
      </aside>

      {/* Main area */}
      <main className="dash-main">
        {/* Top bar */}
        <div className="dash-topbar">
          <div className="role-pill">{user?.role || 'Worker'}</div>
          <div className="top-actions">
            <span className="icon"></span>
            <span className="profile">
              <span className="avatar"/>
              {user?.phone && <span className="phone" style={{marginLeft: '2rem'}}>{user.phone}</span>}
            </span>
          </div>
        </div>

        {/* Header */}
        {role === 'project manager' ? (
          <div className="dash-header">
            <h1>Dashboard</h1>
            <p className="sub">Overview for all projects</p>
          </div>
        ) : (
          <div className="dash-header">
            <h1>งานที่ได้รับมอบหมาย</h1>
            <p className="sub"></p>
          </div>
        )}

        {/* ✅ แสดงเฉพาะส่วนสถิติและตาราง (ลบก้อนดำออกแล้ว) */}
        {role === 'project manager' ? (
          <>
            {/* สถิติตัวเลข (ขยับขึ้นมาแทนที่ก้อนดำ) */}
            <div className="pm-stats" style={{ marginTop: '20px' }}>
              <div className="stat"><div className="value">12,721</div><div className="label">Number of projects</div></div>
              <div className="stat"><div className="value">721</div><div className="label">Active tasks</div></div>
              <div className="stat"><div className="value">$2,50,254</div><div className="label">Revenue</div></div>
              <div className="stat"><div className="value">12,185 hr</div><div className="label">Working Hours</div></div>
            </div>

            {/* ส่วนตัวกรอง */}
            <div className="filters" style={{ marginTop: '30px' }}>
              <div className="search">
                <span className="search-icon"></span>
                <input
                  value={q}
                  onChange={e=>setQ(e.target.value)}
                  placeholder="Search tasks..."
                />
              </div>
            </div>

            {/* ตารางงาน */}
            <div className="table" style={{ marginTop: '20px' }}>
              <div className="thead">
                <div>Task</div>
                <div>Project</div>
                <div>Due Date</div>
                <div>Priority</div>
                <div>Status</div>
              </div>
              <div className="tbody">
                {tasks.map(t => (
                  <div className="tr" key={t.id}>
                    <div className="td">{t.title}</div>
                    <div className="td link">{projectById[t.projectId]?.name || '-'}</div>
                    <div className="td">{t.dueDate}</div>
                    <div className="td">
                      <span className={`pill small p-${t.priority}`}>{cap(t.priority)}</span>
                    </div>
                    <div className="td">
                      <span className={`pill small s-${t.status}`}>{toStatus(t.status)}</span>
                    </div>
                  </div>
                ))}
                {tasks.length === 0 && (
                  <div className="empty">No tasks found.</div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* ส่วนของ Worker (ถ้ามี) โค้ดเดิมคงไว้ */}
            <div className="filters">
              <div className="search">
                <span className="search-icon"></span>
                <input
                  value={q}
                  onChange={e=>setQ(e.target.value)}
                  placeholder="Search tasks..."
                />
              </div>
            </div>
            <div className="tabs">
              <button className={`tab ${tab==='todo'?'active':''}`} onClick={()=>setTab('todo')}>สิ่งที่ต้องทำ</button>
              <button className={`tab ${tab==='in-progress'?'active':''}`} onClick={()=>setTab('in-progress')}>อยู่ระหว่างดำเนินการ</button>
              <button className={`tab ${tab==='done'?'active':''}`} onClick={()=>setTab('done')}>สมบูรณ์</button>
            </div>
            <div className="table">
               {/* ... (ตารางเดิมของ Worker) */}
            </div>
          </>
        )}

        <div className="back-home">
          <Link to="/"></Link>
        </div>
      </main>
    </div>
  );
};

function cap(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : s; }
function toStatus(s){
  if(s==='todo') return 'To Do';
  if(s==='in-progress') return 'In Progress';
  if(s==='done') return 'Done';
  return s;
}

export default Dashboard;
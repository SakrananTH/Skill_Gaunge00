import React, { useMemo, useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import './Dashboard.css';
import { mockUser, mockProjects, mockSites, mockTasks } from '../mock/mockData';

const Dashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const navUser = location.state?.user;
  const user = navUser || mockUser;

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

  const goTasks = () => {
    const path = role === 'project manager' ? '/project-tasks' : '/dashboard';
    navigate(path, { state: { user } });
  };

  return (
    <div className="dash-layout">
      {/* Sidebar */}
      <aside className="dash-sidebar">
        <nav className="menu">
          <button type="button" className="menu-item active" onClick={goTasks}>Tasks</button>
          <button
            type="button"
            className="menu-item"
            onClick={() => role === 'worker' && navigate('/skill-assessment', { state: { user } })}
            disabled={role !== 'worker'}
          >
            Skill Assessment Test
          </button>
          <button type="button" className="menu-item">Submit work</button>
          <button type="button" className="menu-item">Settings</button>
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

        {role === 'project manager' ? (
          <>
            <div className="pm-grid">
              <div className="panel dark">
                <div className="panel-title">All Projects</div>
                <div className="donut" aria-hidden="true"></div>
                <div className="donut-legend" style={{marginTop: '1rem'}}>
                  <div className="legend-item"><span className="legend-dot dot-green"></span>Complete</div>
                  <div className="legend-item"><span className="legend-dot dot-blue"></span>In Progress</div>
                  <div className="legend-item"><span className="legend-dot dot-yellow"></span>Not Start</div>
                </div>
              </div>
              <div className="panel dark">
                <div className="panel-title">Events</div>
                <div className="events">
                  {[0,1,2,3].map((i)=> (
                    <div key={i} className="event">
                      <div className="date">
                        <div className="day">{20+i}</div>
                        <div className="dow">Mon</div>
                      </div>
                      <div>
                        <div className="title">Development planning</div>
                        <div className="sub">W3 Technologies</div>
                      </div>
                      <div className="time">12.02 PM</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pm-row">
              <div className="panel dark">
                <div className="panel-title">My To Do Items</div>
                <div className="events">
                  {tasks.slice(0,4).map(t => (
                    <div className="event" key={t.id}>
                      <div className="date">
                        <div className="day">{new Date(t.dueDate).getDate()}</div>
                        <div className="dow">{new Date(t.dueDate).toLocaleString('en-US',{weekday:'short'})}</div>
                      </div>
                      <div>
                        <div className="title">{t.title}</div>
                        <div className="sub">{projectById[t.projectId]?.name || '-'}</div>
                      </div>
                      <div className="time">Due</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="panel dark">
                <div className="panel-title">Project Overview</div>
                <div style={{height:'220px', background:'rgba(255,255,255,0.05)', border:'1px solid #2a3a59', borderRadius:10}}></div>
              </div>
            </div>

            <div className="pm-stats">
              <div className="stat"><div className="value">12,721</div><div className="label">Number of projects</div></div>
              <div className="stat"><div className="value">721</div><div className="label">Active tasks</div></div>
              <div className="stat"><div className="value">$2,50,254</div><div className="label">Revenue</div></div>
              <div className="stat"><div className="value">12,185 hr</div><div className="label">Working Hours</div></div>
            </div>
          </>
        ) : (
          <>
            {/* Search + Filters */}
            <div className="filters">
              <div className="search">
                <span className="search-icon"></span>
                <input
                  value={q}
                  onChange={e=>setQ(e.target.value)}
                  placeholder="Search  tasks..."
                />
              </div>
              <div className="filter-pills">
                <select className="pill" value={projectFilter} onChange={e=>setProjectFilter(e.target.value)}>
                  {projectOptions.map(o => (
                    <option key={o.id} value={o.id === 'all' ? 'all' : o.id}>{o.name}</option>
                  ))}
                </select>
                <select className="pill" value={dueSort} onChange={e=>setDueSort(e.target.value)}>
                  <option value="asc">Due Date ↑</option>
                  <option value="desc">Due Date ↓</option>
                </select>
                <select className="pill" value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)}>
                  <option value="all">Priority</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
              <button className={`tab ${tab==='todo'?'active':''}`} onClick={()=>setTab('todo')}>สิ่งที่ต้องทำ</button>
              <button className={`tab ${tab==='in-progress'?'active':''}`} onClick={()=>setTab('in-progress')}>อยู่ระหว่างดำเนินการ</button>
              <button className={`tab ${tab==='done'?'active':''}`} onClick={()=>setTab('done')}>สมบูรณ์</button>
            </div>

            {/* Table */}
            <div className="table">
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

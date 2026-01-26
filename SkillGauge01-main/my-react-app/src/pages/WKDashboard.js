import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import './WKDashboard.css';
import { mockUser, mockProjects, mockSites } from '../mock/mockData';
import WorkerSidebar from '../components/WorkerSidebar';
import { apiRequest } from '../utils/api';

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(location.state?.user || null);

  useEffect(() => {
     if (!user) {
        // Try to recover user from session or fetch profile
        const storedId = window.sessionStorage?.getItem('user_id');
        if (storedId && !String(storedId).startsWith('u_mock')) {
             // We can fetch profile here or just use ID. 
             // Ideally we should have a context, but for now let's just proceed.
             // If we rely on apiRequest, it sends token, so accessing /api/my-tasks works.
             // We can just set a dummy user object with ID.
             setUser({ id: storedId, username: 'My User', role: 'Worker' }); 
        } else {
             // Fallback to mock only if explicitly desired, otherwise maybe redirect?
             // But the user said "Real values", so we prefer real data.
             // If no real user, maybe keep null?
             setUser(mockUser);
        }
     }
  }, [user]);

  const handleLogout = () => {
    // Clear any auth tokens
    try {
      window.sessionStorage?.removeItem('auth_token');
      window.localStorage?.removeItem('auth_token');
    } catch {}
    navigate('/login');
  };

  // UI state
  const [q, setQ] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [tab, setTab] = useState('todo'); // todo | in-progress | done
  const [dueSort, setDueSort] = useState('asc'); // asc | desc
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Data state
  const [tasksData, setTasksData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch tasks
  useEffect(() => {
    // Only fetch if we have a real user (not mock starting with u_mock, unless we want to simulate)
    // Actually, asking backend for my-tasks checks the TOKEN, not importance of client-side ID.
    setLoading(true);
    apiRequest('/api/my-tasks')
      .then(data => {
        setTasksData(data || []);
      })
      .catch(err => {
        console.warn('Failed to fetch tasks', err);
        // If error (e.g. 401), tasksData stays empty
      })
      .finally(() => setLoading(false));
  }, []);

  // Derive tasks for this user
  const tasks = useMemo(() => {
    let filtered = tasksData;

    if (projectFilter !== 'all') {
      filtered = filtered.filter(t => t.projectId === projectFilter || t.projectName === projectFilter);
    }
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(t => t.priority === priorityFilter);
    }
    if (tab === 'todo' && tab !== 'all') filtered = filtered.filter(t => t.status === 'todo');
    if (tab === 'in-progress') filtered = filtered.filter(t => t.status === 'in-progress');
    if (tab === 'done') filtered = filtered.filter(t => t.status === 'done');
    
    if (q) {
      const lowerQ = q.toLowerCase();
      filtered = filtered.filter(t => 
        (t.title || '').toLowerCase().includes(lowerQ) || 
        (t.projectName || '').toLowerCase().includes(lowerQ)
      );
    }
    
    return filtered.sort((a,b)=>{
      const da = new Date(a.dueDate || 0).getTime();
      const db = new Date(b.dueDate || 0).getTime();
      return dueSort === 'asc' ? da - db : db - da;
    });
  }, [tasksData, q, projectFilter, priorityFilter, tab, dueSort]);

  // Project options for filter - simplified to unique projects in tasks
  const projectOptions = useMemo(() => {
      const unique = new Set();
      const list = [{ id:'all', name:'Project' }];
      tasksData.forEach(t => {
          if (t.projectId && !unique.has(t.projectId)) {
              unique.add(t.projectId);
              list.push({ id: t.projectId, name: t.projectName || 'Unknown' });
          }
      });
      return list;
  }, [tasksData]);

  const role = (user?.role || 'Worker').toLowerCase().replace(/[_-]+/g, ' ');

  const summary = useMemo(() => {
    const counts = tasksData.reduce(
      (acc, task) => {
        acc.total += 1;
        if (task.status === 'todo') acc.todo += 1;
        if (task.status === 'in-progress') acc.progress += 1;
        if (task.status === 'done') acc.done += 1;
        return acc;
      },
      { total: 0, todo: 0, progress: 0, done: 0 }
    );

    const next = [...tasksData]
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .find(item => new Date(item.dueDate).getTime() >= Date.now());

    return {
      ...counts,
      next
    };
  }, [tasksData]);

  return (
    <div className="dash-layout">
      {/* Mobile Top Bar */}
      <div className="mobile-topbar">
        <div className="brand">
          <i className='bx bx-gauge'></i> Skill Gauge
        </div>
        <button className="menu-toggle" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          <i className={`bx ${isSidebarOpen ? 'bx-x' : 'bx-menu'}`}></i>
        </button>
      </div>

      <WorkerSidebar user={user} active="tasks" className={isSidebarOpen ? 'active' : ''} />

      <main className="dash-main">
        <div className="worker-container">
          <header className="worker-hero">
            <div className="worker-hero-content">
              <span className="worker-chip">{user?.role || 'worker'}</span>
              <h1>งานที่ได้รับมอบหมาย</h1>
              <p>{role === 'project manager' ? 'ภาพรวมการทำงานของทีมทั้งหมด' : 'ตรวจสอบและจัดการงานที่ต้องทำ พร้อมติดตามความคืบหน้าได้จากที่นี่'}</p>
            </div>
          </header>

          <section className="worker-summary">
            <div className="summary-card">
              <div className="card-header">
                <span className="summary-label">งานทั้งหมด</span>
                <div className="card-icon blue"><i className='bx bx-clipboard'></i></div>
              </div>
              <span className="summary-value">{summary.total}</span>
              <span className="summary-sub">รวมงานที่ได้รับมอบหมาย</span>
            </div>
            <div className="summary-card">
              <div className="card-header">
                <span className="summary-label">สิ่งที่ต้องทำ</span>
                <div className="card-icon blue"><i className='bx bx-list-check'></i></div>
              </div>
              <span className="summary-value">{summary.todo}</span>
              <span className="summary-sub">งานที่ยังไม่ได้เริ่ม</span>
            </div>
            <div className="summary-card">
              <div className="card-header">
                <span className="summary-label">กำลังดำเนินการ</span>
                <div className="card-icon blue"><i className='bx bx-user-plus'></i></div>
              </div>
              <span className="summary-value">{summary.progress}</span>
              <span className="summary-sub">งานกำลังทำอยู่</span>
            </div>
            <div className="summary-card">
              <div className="card-header">
                <span className="summary-label">งานถัดไป</span>
                <div className="card-icon blue"><i className='bx bx-minus'></i></div>
              </div>
              <span className="summary-value">{summary.next ? summary.next.title : '-'}</span>
              <span className="summary-sub">{summary.next ? `ครบกำหนด ${summary.next.dueDate}` : 'ยังไม่มีงานใกล้ครบกำหนด'}</span>
            </div>
          </section>

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
                        <div className="sub">{t.projectName || '-'}</div>
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
            <div className="worker-table-card">
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
                    <div className="td" data-label="Task">{t.title}</div>
                    <div className="td link" data-label="Project">{t.projectName || '-'}</div>
                    <div className="td" data-label="Due Date">{t.dueDate}</div>
                    <div className="td" data-label="Priority">
                      <span className={`pill small p-${t.priority}`}>{cap(t.priority)}</span>
                    </div>
                    <div className="td" data-label="Status">
                      <span className={`pill small s-${t.status}`}>{toStatus(t.status)}</span>
                    </div>
                  </div>
                ))}
                {tasks.length === 0 && (
                  <div className="empty">No tasks found.</div>
                )}
              </div>
              </div>
            </div>
          </>
          )}

          <div className="back-home">
            <Link to="/"></Link>
          </div>
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

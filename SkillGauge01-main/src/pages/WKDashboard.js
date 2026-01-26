import React, { useMemo, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import './WKDashboard.css';
import { mockUser, mockProjects, mockSites, mockTasks } from '../mock/mockData';
import WorkerSidebar from '../components/WorkerSidebar';

const Dashboard = () => {
  const location = useLocation();
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

  const summary = useMemo(() => {
    const mine = mockTasks.filter(t => !user?.username || t.assigneeUsername === user.username);
    const counts = mine.reduce(
      (acc, task) => {
        acc.total += 1;
        if (task.status === 'todo') acc.todo += 1;
        if (task.status === 'in-progress') acc.progress += 1;
        if (task.status === 'done') acc.done += 1;
        return acc;
      },
      { total: 0, todo: 0, progress: 0, done: 0 }
    );

    const next = [...mine]
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .find(item => new Date(item.dueDate).getTime() >= Date.now());

    return {
      ...counts,
      next
    };
  }, [user]);

  return (
    <div className="dash-layout">
      <WorkerSidebar user={user} active="tasks" />

      <main className="dash-main">
        <div className="worker-container">
          <header className="worker-hero">
            <div>
              <span className="worker-chip">{user?.role || 'Worker'}</span>
              <h1>งานที่ได้รับมอบหมาย</h1>
              <p>{role === 'project manager' ? 'ภาพรวมการทำงานของทีมทั้งหมด' : 'ตรวจสอบและจัดการงานที่ต้องทำ พร้อมติดตามความคืบหน้าได้จากที่นี่'}</p>
            </div>
            <div className="worker-meta">
              <div className="worker-meta__avatar" aria-hidden="true">{(user?.username || 'W').slice(0,1).toUpperCase()}</div>
              <div className="worker-meta__info">
                <span className="worker-meta__name">{user?.username || 'ไม่ระบุ'}</span>
                {user?.phone && <span className="worker-meta__contact">{user.phone}</span>}
              </div>
            </div>
          </header>

          <section className="worker-summary">
            <div className="summary-card">
              <span className="summary-label">งานทั้งหมด</span>
              <span className="summary-value">{summary.total}</span>
              <span className="summary-sub">รวมงานที่ได้รับมอบหมาย</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">สิ่งที่ต้องทำ</span>
              <span className="summary-value">{summary.todo}</span>
              <span className="summary-sub">งานที่ยังไม่ได้เริ่ม</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">กำลังดำเนินการ</span>
              <span className="summary-value">{summary.progress}</span>
              <span className="summary-sub">งานกำลังทำอยู่</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">งานถัดไป</span>
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

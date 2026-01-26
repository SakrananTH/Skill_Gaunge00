import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Dashboard.css';
import { mockUser } from '../mock/mockData';

const ProjectManager = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const navUser = location.state?.user;
  // default to a PM user if none is passed
  const user = navUser || { ...mockUser, role: 'Project Manager' };

  const API = process.env.REACT_APP_API_URL || 'http://localhost:4000';

  // Filters & pagination
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(''); // '', 'todo', 'in-progress', 'done'
  const [sort, setSort] = useState('due_date_asc');
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);

  // Data state
  const [items, setItems] = useState([]); // tasks overview
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [counts, setCounts] = useState([]); // per-project task counts

  const hasMore = items.length === Number(limit);

  // Aggregates for stat cards
  const stats = useMemo(() => {
    const toNum = (v) => (v == null ? 0 : Number(v));
    const totalProjects = counts.length;
    const sum = counts.reduce(
      (acc, c) => {
        acc.total += toNum(c.tasks_total);
        acc.todo += toNum(c.tasks_todo);
        acc.inp += toNum(c.tasks_in_progress);
        acc.done += toNum(c.tasks_done);
        return acc;
      },
      { total: 0, todo: 0, inp: 0, done: 0 }
    );
    const active = sum.todo + sum.inp;
    return { totalProjects, totalTasks: sum.total, activeTasks: active, doneTasks: sum.done };
  }, [counts]);

  const loadCounts = async () => {
    try {
      const token = sessionStorage.getItem('auth_token');
      const res = await fetch(`${API}/api/dashboard/project-task-counts`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error('failed_counts');
      const data = await res.json();
      setCounts(data);
    } catch (e) {
      // non-blocking
      console.error(e);
    }
  };

  const loadItems = async () => {
    setLoading(true);
    setErr('');
    try {
      const url = new URL('/api/dashboard/tasks-overview', API);
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('offset', String(offset));
      url.searchParams.set('sort', sort);
      if (search) url.searchParams.set('search', search);
      if (status) url.searchParams.set('status', status);
      const token = sessionStorage.getItem('auth_token');
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error('failed_items');
      const data = await res.json();
      setItems(data.items || []);
    } catch (e) {
      setErr('โหลดข้อมูลงานไม่สำเร็จ');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, sort, limit, offset]);

  return (
    <div className="dash-layout">
      <aside className="dash-sidebar">
        <nav className="menu">
          <button type="button" className="menu-item active" onClick={() => navigate('/pm', { state: { user } })}>Dashboard</button>
          <button type="button" className="menu-item" onClick={() => navigate('/project-tasks', { state: { user } })}>Tasks</button>
          <button type="button" className="menu-item">Projects</button>
          <button type="button" className="menu-item">History</button>
          <button type="button" className="menu-item">Settings</button>
        </nav>
      </aside>

      <main className="dash-main">
        <div className="dash-topbar">
          <div className="role-pill">{user?.role || 'Project Manager'}</div>
          <div className="top-actions">
            <span className="profile">
              <span className="avatar" />
              {user?.email && (
                <span className="phone" style={{ marginLeft: '2rem' }}>{user.email}</span>
              )}
            </span>
          </div>
        </div>

        <div className="pm-grid">
          <div className="panel dark">
            <div className="panel-title">Project Task Summary</div>
            <div className="donut" aria-hidden="true"></div>
            <div className="donut-legend" style={{ marginTop: '1rem' }}>
              <div className="legend-item"><span className="legend-dot dot-green"></span>Done: {stats.doneTasks}</div>
              <div className="legend-item"><span className="legend-dot dot-blue"></span>In Progress: {counts.reduce((a,c)=>a+Number(c.tasks_in_progress||0),0)}</div>
              <div className="legend-item"><span className="legend-dot dot-yellow"></span>Todo: {counts.reduce((a,c)=>a+Number(c.tasks_todo||0),0)}</div>
            </div>
          </div>
          <div className="panel dark">
            <div className="panel-title">Quick Actions</div>
            <div className="events">
              <div className="event">
                <div className="date"><div className="day">⟳</div><div className="dow">MV</div></div>
                <div>
                  <div className="title">Refresh Project Task Counts</div>
                  <div className="sub">อัปเดตตัวเลขสรุป</div>
                </div>
                <div className="time">
                  <button className="pill" onClick={async()=>{ const token = sessionStorage.getItem('auth_token'); await fetch(`${API}/api/dashboard/project-task-counts?refresh=true`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined }); loadCounts(); }}>Refresh</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pm-row">
          <div className="panel dark">
            <div className="panel-title">My To Do Items (next {Math.min(4, items.length)})</div>
            <div className="events">
              {items.slice(0,4).map((t) => (
                <div className="event" key={t.task_id}>
                  <div className="date">
                    <div className="day">{t.due_date ? new Date(t.due_date).getDate() : '-'}</div>
                    <div className="dow">{t.due_date ? new Date(t.due_date).toLocaleString('en-US', { weekday: 'short' }) : ''}</div>
                  </div>
                  <div>
                    <div className="title">{t.title}</div>
                    <div className="sub">{t.project_name || '-'}</div>
                  </div>
                  <div className="time">{t.status}</div>
                </div>
              ))}
              {items.length === 0 && <div className="empty">ไม่มีงานที่จะแสดง</div>}
            </div>
          </div>
          <div className="panel dark">
            <div className="panel-title">Project Overview</div>
            <div className="events">
              <div className="event">
                <div className="date"><div className="day">Σ</div><div className="dow">All</div></div>
                <div>
                  <div className="title">Total Tasks</div>
                  <div className="sub">รวมทุกโครงการ</div>
                </div>
                <div className="time">{stats.totalTasks}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="pm-stats">
          <div className="stat"><div className="value">{stats.totalProjects}</div><div className="label">Number of projects</div></div>
          <div className="stat"><div className="value">{stats.activeTasks}</div><div className="label">Active tasks</div></div>
          <div className="stat"><div className="value">{stats.doneTasks}</div><div className="label">Completed</div></div>
          <div className="stat"><div className="value">{stats.totalTasks}</div><div className="label">Total tasks</div></div>
        </div>

        {/* Filters */}
        <div className="filters">
          <div className="search">
            <input
              placeholder="ค้นหาชื่องาน..."
              value={search}
              onChange={(e)=>{ setOffset(0); setSearch(e.target.value); }}
            />
          </div>
          <select className="pill" value={status} onChange={(e)=>{ setOffset(0); setStatus(e.target.value); }}>
            <option value="">All Status</option>
            <option value="todo">To do</option>
            <option value="in-progress">In progress</option>
            <option value="done">Done</option>
          </select>
          <select className="pill" value={sort} onChange={(e)=>{ setOffset(0); setSort(e.target.value); }}>
            <option value="due_date_asc">Due date ↑</option>
            <option value="due_date_desc">Due date ↓</option>
          </select>
          <select className="pill" value={limit} onChange={(e)=>{ setOffset(0); setLimit(Number(e.target.value)); }}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>

        {/* Tasks table */}
        <div className="table">
          <div className="thead">
            <div>Title</div>
            <div>Project</div>
            <div>Site</div>
            <div>Assignee</div>
            <div>Due</div>
          </div>
          <div className="tbody">
            {loading && <div className="empty">กำลังโหลด...</div>}
            {!loading && items.length === 0 && <div className="empty">ไม่มีข้อมูลงาน</div>}
            {!loading && items.map((t) => (
              <div className="tr" key={t.task_id}>
                <div className="td">
                  <span className={`pill small s-${t.status?.replace(/\s/g,'-')}`}>{t.status}</span>
                  <span style={{ marginLeft: 8, fontWeight: 700 }}>{t.title}</span>
                </div>
                <div className="td">{t.project_name || '-'}</div>
                <div className="td">{t.site_name || '-'}</div>
                <div className="td">{t.assignee_name || '-'}</div>
                <div className="td">{t.due_date ? new Date(t.due_date).toLocaleDateString() : '-'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="pill" onClick={()=> setOffset(Math.max(0, offset - Number(limit)))} disabled={offset === 0}>Prev</button>
          <button className="pill" onClick={()=> setOffset(offset + Number(limit))} disabled={!hasMore}>Next</button>
        </div>
      </main>
    </div>
  );
};

export default ProjectManager;

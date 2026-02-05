import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../pm/WKDashboard.css';
import { mockUser } from '../../mock/mockData';
// ถ้าคุณใช้ axios ในโปรเจกต์ อย่าลืม import (หรือจะใช้ fetch ตามเดิมก็ได้ครับ)
// import axios from 'axios'; 

const ProjectManager = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const navUser = location.state?.user;
  const user = navUser || { ...mockUser, role: 'Project Manager' };

  // ฟังก์ชัน Logout สำหรับ Sidebar
  const handleLogout = () => {
    if (window.confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
      sessionStorage.clear();
      navigate('/login');
    }
  };

  const API = process.env.REACT_APP_API_URL || 'http://localhost:4000';

  // --- State เดิมของ Dashboard ---
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('due_date_asc');
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);

  const [items, setItems] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [counts, setCounts] = useState([]); 

  const hasMore = items.length === Number(limit);

  // --- State ใหม่สำหรับระบบ Auto Assign ---
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignments, setAssignments] = useState([]); // เก็บผลลัพธ์การจัดสรร
  const [assignMsg, setAssignMsg] = useState('');

  // --- Logic เดิม (Stats & Loading) ---
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
  }, []);

  useEffect(() => {
    loadItems();
  }, [search, status, sort, limit, offset]);

  // --- 🔥 ฟังก์ชันใหม่: รันระบบจัดสรรงาน (Auto Assign) ---
  const handleAutoAssign = async () => {
    if (!window.confirm("ยืนยันการรันระบบจัดสรรงานอัตโนมัติ? (ระบบจะคำนวณจาก Skill และ Level ของช่าง)")) return;

    setAssignLoading(true);
    setAssignments([]);
    setAssignMsg('');

    try {
      const token = sessionStorage.getItem('auth_token'); // ใช้ชื่อ token ให้ตรงกับในโปรเจกต์
      
      // ใช้ fetch ยิงไปที่ Route ใหม่ที่เราเพิ่งแก้
      const res = await fetch(`${API}/api/job-assignments/run`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      const data = await res.json();

      if (data.success) {
        setAssignments(data.data); // เก็บผลลัพธ์มาโชว์
        setAssignMsg(`✅ จัดสรรงานสำเร็จ! จับคู่ได้ทั้งหมด ${data.data.length} รายการ`);
        // โหลดข้อมูล Dashboard ใหม่ด้วยเพื่อให้ตัวเลขไม่อัปเดต
        loadCounts();
        loadItems();
      } else {
        alert(data.error || "เกิดข้อผิดพลาดในการจัดสรรงาน");
      }
    } catch (err) {
      console.error("Assignment Error:", err);
      alert("เชื่อมต่อ Server ไม่สำเร็จ");
    } finally {
      setAssignLoading(false);
    }
  };

  // Helper สำหรับแสดง Badge สวยๆ ในตารางผลลัพธ์
  const getMethodBadge = (method) => {
    if (method.includes("MIP")) return <span className="pill" style={{background: '#e1f5fe', color: '#0288d1', border: '1px solid #b3e5fc'}}>🏆 MIP Optimal</span>;
    if (method.includes("Evaluation")) return <span className="pill" style={{background: '#fff3e0', color: '#ef6c00', border: '1px solid #ffe0b2'}}>📝 รอประเมิน</span>;
    return <span className="pill" style={{background: '#f5f5f5', color: '#616161'}}>🔧 งานทั่วไป</span>;
  };

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

              {/* 🔥 เพิ่มปุ่ม Auto Assign ตรงนี้ */}
              <div className="event" style={{ marginTop: '15px', borderTop: '1px solid #444', paddingTop: '15px' }}>
                <div className="date"><div className="day" style={{color:'#2ecc71'}}>AI</div><div className="dow">Auto</div></div>
                <div>
                  <div className="title">Auto Job Assignment</div>
                  <div className="sub">จัดสรรงานอัตโนมัติตาม Skill</div>
                </div>
                <div className="time">
                  <button 
                    className="pill" 
                    style={{ background: assignLoading ? '#555' : '#27ae60', color: 'white', border: 'none' }}
                    onClick={handleAutoAssign}
                    disabled={assignLoading}
                  >
                    {assignLoading ? 'Processing...' : 'Run Auto Assign'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* 🔥 ส่วนแสดงผลลัพธ์การจัดสรรงาน (จะโชว์เมื่อกดปุ่มและได้ผลลัพธ์มา) */}
        {assignments.length > 0 && (
          <div className="pm-row" style={{marginBottom: '20px'}}>
             <div className="panel dark" style={{width: '100%'}}>
                <div className="panel-title" style={{color: '#2ecc71'}}>
                    ผลการจัดสรรงานล่าสุด ({assignments.length} รายการ)
                </div>
                <div className="sub" style={{color: '#aaa', marginBottom: '10px'}}>{assignMsg}</div>
                
                <div className="table">
                  <div className="thead">
                    <div>ช่าง (Worker)</div>
                    <div>งานที่ได้รับ (Job)</div>
                    <div>วิธีการเลือก (Method)</div>
                    <div>คะแนน (Score)</div>
                    <div>หมายเหตุ</div>
                  </div>
                  <div className="tbody">
                    {assignments.map((item, idx) => (
                      <div className="tr" key={idx}>
                        <div className="td"><strong>{item.worker_name}</strong></div>
                        <div className="td">{item.job_name}</div>
                        <div className="td">{getMethodBadge(item.method)}</div>
                        <div className="td">{item.score || '-'}</div>
                        <div className="td" style={{fontSize: '0.85em', color: '#aaa'}}>{item.note}</div>
                      </div>
                    ))}
                  </div>
                </div>
             </div>
          </div>
        )}

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
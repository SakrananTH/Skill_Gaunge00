import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './WKDashboard.css';
import './WKProject_Tasks.css';
import { mockUser } from '../mock/mockData';

const Project_Tasks = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const navUser = location.state?.user;
  const user = navUser || { ...mockUser, role: 'Project Manager' };

  const [form, setForm] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    location: '',
    wage: '',
    role: '',
    level: '',
    headcount: '',
  });

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onCreate = (e) => {
    e.preventDefault();
    // placeholder action
    alert('สร้างงานเรียบร้อย (mock)');
  };

  return (
    <div className="dash-layout">
      <aside className="dash-sidebar">
        <nav className="menu">
          <button type="button" className="menu-item" onClick={() => navigate('/pm', { state: { user } })}>Dashboard</button>
          <button type="button" className="menu-item active" onClick={() => navigate('/project-tasks', { state: { user } })}>Tasks</button>
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

        <div className="task-page">
          <header className="task-header">
            <h1>สร้างงาน</h1>
          </header>

          <div className="task-grid">
            {/* Left form */}
            <section className="task-form">
              <h2 className="section-title">รายละเอียดงาน</h2>
              <form onSubmit={onCreate}>
                <div className="field"><input className="input" placeholder="ชื่อโครงงาน" value={form.title} onChange={update('title')} /></div>
                <div className="field"><input className="input" placeholder="เช่น ทำการเทพื้นที่มีความยาว 5 เมตร และ ทำทางเดิน" value={form.description} onChange={update('description')} /></div>
                <div className="field"><input className="input" placeholder="วันที่เริ่มต้น 20/01/20xx" value={form.startDate} onChange={update('startDate')} /></div>
                <div className="field"><input className="input" placeholder="วันสิ้นสุด 20/02/20xx" value={form.endDate} onChange={update('endDate')} /></div>
                <div className="field"><input className="input" placeholder="ชื่องาน เช่น หมู่บ้าน/อาคาร/พื้นที่" value={form.location} onChange={update('location')} /></div>
                <div className="field">
                  <select className="select" value={form.wage} onChange={update('wage')}>
                    <option value="">เทพืน</option>
                    <option value="wage1">งานประเภท 1</option>
                    <option value="wage2">งานประเภท 2</option>
                  </select>
                </div>
                <div className="field">
                  <select className="select" value={form.role} onChange={update('role')}>
                    <option value="">เลือกประเภทช่าง</option>
                    <option value="structure">ช่างโครงสร้าง</option>
                    <option value="plumbing">ช่างประปา</option>
                    <option value="roofing">ช่างหลังคา</option>
                    <option value="masonry">ช่างก่ออิฐฉาบปูน</option>
                    <option value="aluminum">ช่างประตูหน้าต่างอลูมิเนียม</option>
                    <option value="ceiling">ช่างฝ้าเพดาล</option>
                    <option value="electric">ช่างไฟฟ้า</option>
                    <option value="tiling">ช่างกระเบื้อง</option>
                  </select>
                </div>
                <div className="field">
                  <select className="select" value={form.level} onChange={update('level')}>
                    <option value="">ระดับ 2</option>
                    <option value="1">ระดับ 1</option>
                    <option value="3">ระดับ 3</option>
                  </select>
                </div>
                <div className="field">
                  <select className="select" value={form.headcount} onChange={update('headcount')}>
                    <option value="">2 คน</option>
                    <option value="1">1 คน</option>
                    <option value="3">3 คน</option>
                    <option value="4">4 คน</option>
                  </select>
                </div>
                <div className="actions">
                  <button className="btn-primary" type="submit">สร้าง</button>
                </div>
              </form>
            </section>

            {/* Right workers */}
            <aside className="workers">
              <h2 className="section-title">ช่าง</h2>
              <div className="worker-card">
                <div className="avatar small" />
                <div>
                  <div className="w-name"> ไม่พบ </div>
                  <div className="w-sub"> ไม่พบ </div>
                </div>
              </div>
              <div className="worker-card">
                <div className="avatar small" />
                <div>
                  <div className="w-name"> ไม่พบ </div>
                  <div className="w-sub"> ไม่พบ </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Project_Tasks;

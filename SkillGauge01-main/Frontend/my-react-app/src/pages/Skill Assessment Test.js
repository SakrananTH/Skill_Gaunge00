import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import WorkerSidebar from '../components/WorkerSidebar';
import './Dashboard.css';
import './SkillAssessmentTest.css';
import { mockUser } from '../mock/mockData';
import { performLogout } from '../utils/logout';

const SkillAssessmentTest = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [user, setUser] = useState({ name: 'ผู้ใช้งาน', role: 'worker' });

  useEffect(() => {
    // ดึงข้อมูลผู้ใช้จาก Session Storage เพื่อความแม่นยำ
    const storedUser = sessionStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else if (location.state?.user) {
      setUser(location.state.user);
    }
  }, [location.state]);

  const startTest = () => {
    navigate('/skill-assessment/quiz', { state: { user } });
  };

  return (
    <div className="dash-layout" style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Kanit', sans-serif" }}>
      {/* ใช้ WorkerSidebar แทนการเขียนเมนูซ้ำซ้อน */}
      <WorkerSidebar user={user} active="skill" />

      <main className="dash-main" style={{ flex: 1, padding: '40px' }}>
        <div className="dash-topbar" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '30px' }}>
          <div className="role-pill" style={{ background: '#eff6ff', color: '#2563eb', padding: '8px 20px', borderRadius: '20px', fontWeight: '600' }}>
            {user?.role === 'worker' ? 'ช่าง (Worker)' : user?.role}
          </div>
        </div>

        <div className="assessment-page" style={{ maxWidth: '800px', margin: '0 auto', background: 'white', padding: '40px', borderRadius: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1e293b', marginBottom: '10px' }}>แบบประเมินทักษะฝีมือช่าง</h1>
          <p style={{ color: '#64748b', marginBottom: '30px' }}>กรุณาอ่านรายละเอียดและเงื่อนไขก่อนเริ่มทำแบบทดสอบ</p>

          <section className="ass-section" style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#334155', marginBottom: '15px' }}>📋 ภาพรวมการประเมิน</h2>
            <p className="ass-desc" style={{ color: '#475569', marginBottom: '15px' }}>แบบทดสอบนี้จะวัดความรู้ความสามารถในหมวดงานโครงสร้าง ดังนี้:</p>
            <div className="ass-categories" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <span style={pillStyle}>🏗️ งานเหล็กเสริม</span>
              <span style={pillStyle}>🧱 งานคอนกรีต</span>
              <span style={pillStyle}>🪵 งานไม้แบบ</span>
              <span style={pillStyle}>📐 ทฤษฎีงานโครงสร้าง</span>
            </div>
          </section>

          <section className="ass-section" style={{ marginBottom: '40px', padding: '20px', background: '#f0f9ff', borderRadius: '16px', border: '1px solid #e0f2fe' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0369a1', marginBottom: '10px' }}>⏱️ รูปแบบการทดสอบ</h2>
            <ul style={{ color: '#0c4a6e', paddingLeft: '20px', lineHeight: '1.8' }}>
              <li>จำนวนข้อสอบทั้งหมด: <strong>60 ข้อ</strong></li>
              <li>เวลาในการทำ: <strong>60 นาที</strong></li>
              <li>เกณฑ์การผ่าน: <strong>70% ขึ้นไป</strong></li>
            </ul>
          </section>

          <div className="ass-actions" style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
            <button 
              className="btn-secondary" 
              onClick={() => navigate('/worker')}
              style={{ padding: '12px 30px', borderRadius: '12px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: '600' }}
            >
              กลับหน้าหลัก
            </button>
            <button 
              className="btn-primary" 
              onClick={startTest}
              style={{ padding: '12px 40px', borderRadius: '12px', border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer', fontWeight: '800', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)' }}
            >
              เริ่มทำแบบทดสอบ
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

const pillStyle = {
  background: '#f1f5f9',
  color: '#475569',
  padding: '8px 16px',
  borderRadius: '20px',
  fontSize: '14px',
  fontWeight: '600',
  border: '1px solid #e2e8f0'
};

export default SkillAssessmentTest;

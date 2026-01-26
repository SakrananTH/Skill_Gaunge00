import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Dashboard.css';
import './SkillAssessmentTest.css';
import { mockUser } from '../mock/mockData';

const SkillAssessmentTest = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const navUser = location.state?.user;
  const user = navUser || { ...mockUser, role: 'worker' };

  const startTest = () => {
    navigate('/skill-assessment/quiz', { state: { user } });
  };

  return (
    <div className="dash-layout">
      <aside className="dash-sidebar">
        <nav className="menu">
          <button type="button" className="menu-item" onClick={() => navigate('/dashboard', { state: { user } })}>Tasks</button>
          <button type="button" className="menu-item active">Skill Assessment Test</button>
          <button type="button" className="menu-item">Submit work</button>
          <button type="button" className="menu-item">Settings</button>
        </nav>
      </aside>

      <main className="dash-main">
        <div className="dash-topbar">
          <div className="role-pill">{user?.role ? user.role.charAt(0).toUpperCase()+user.role.slice(1) : 'Worker'}</div>
          <div className="top-actions">
            <span className="profile">
              <span className="avatar" />
              {user?.phone && (
                <span className="phone" style={{ marginLeft: '2rem' }}>{user.phone}</span>
              )}
            </span>
          </div>
        </div>

        <div className="assessment-page">
          <h1>แบบประเมินช่างโครงสร้าง</h1>

          <section className="ass-section">
            <h2>ภารวมการประเมิน</h2>
            <p className="ass-desc">แบบทดสอบทักษะนี้จะประเมินความสามารถของคุณในด้านต่อไปนี้:</p>
            <div className="ass-categories">
              <button className="ass-pill">คอนกรีต</button>
              <button className="ass-pill">ถอดแบบ</button>
              <button className="ass-pill">โครงสร้าง</button>
              <button className="ass-pill">พื้นฐาน</button>
            </div>
          </section>

          <section className="ass-section">
            <h2>รูปแบบการทดสอบ</h2>
            <p className="ass-desc">การประเมินประกอบด้วยคำถามแบบเลือกตอบและสถานการณ์จำลองเชิงปฏิบัติ คุณจะมีเวลา 60 นาทีในการทำแบบทดสอบ</p>
          </section>

          <div className="ass-actions">
            <button className="btn-primary" onClick={startTest}>เริ่มทำแบบทดสอบ</button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SkillAssessmentTest;

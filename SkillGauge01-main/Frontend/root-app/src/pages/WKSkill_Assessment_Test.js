import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './WKDashboard.css';
import './WKSkillAssessmentTest.css';
import { mockUser } from '../mock/mockData';
import WorkerSidebar from '../components/WorkerSidebar';

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
      <WorkerSidebar user={user} active="skill" />

      <main className="dash-main">
        <div className="worker-container">
          <header className="worker-hero">
            <div>
              <span className="worker-chip">{user?.role || 'Worker'}</span>
              <h1>แบบประเมินช่างโครงสร้าง</h1>
              <p>เตรียมพร้อมก่อนเริ่มทำแบบทดสอบ โดยตรวจสอบหัวข้อการประเมินและแนวทางการทดสอบได้ที่นี่</p>
            </div>
            <div className="worker-meta">
              <div className="worker-meta__avatar" aria-hidden="true">{(user?.username || 'W').slice(0,1).toUpperCase()}</div>
              <div className="worker-meta__info">
                <span className="worker-meta__name">{user?.username || 'ไม่ระบุ'}</span>
                {user?.phone && <span className="worker-meta__contact">{user.phone}</span>}
              </div>
            </div>
          </header>

          <div className="assessment-page">
            <section className="ass-section">
              <h2>ภาพรวมการประเมิน</h2>
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
        </div>
      </main>
    </div>
  );
};

export default SkillAssessmentTest;

import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './WKDashboard.css';
import './WKSkillAssessmentTest.css';
import { mockUser } from '../mock/mockData';
import WorkerSidebar from '../components/WorkerSidebar';

const DEFAULT_ASSESSMENT_DURATION_MINUTES = 60;
const ASSESSMENT_DURATION_STORAGE_KEY = 'skillAssessmentDurationMinutes';

const SkillAssessmentTest = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const navUser = location.state?.user;
  const user = navUser || { ...mockUser, role: 'worker' };
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const durationMinutes = useMemo(() => {
    try {
      const raw = window.localStorage.getItem(ASSESSMENT_DURATION_STORAGE_KEY);
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_ASSESSMENT_DURATION_MINUTES;
  }, []);

  const startTest = () => {
    navigate('/skill-assessment/quiz', { state: { user } });
  };

  const handleCancel = () => {
    navigate('/dashboard');
  };

  const scoreStructure = [
    { 
      topic: '1. งานเหล็กเสริม (Rebar)', 
      desc: '(รวมการมัดเหล็ก, ระยะทาบ, การงอขอ, มาตรฐานเหล็ก)',
      count: '15 ข้อ',
      weight: '25%' 
    },
    { 
      topic: '2. งานคอนกรีต (Concrete)', 
      desc: '(รวมวัสดุ, การผสม, การเท, การบ่ม, การทดสอบ Slump)',
      count: '15 ข้อ',
      weight: '25%' 
    },
    { 
      topic: '3. งานไม้แบบ (Formwork)', 
      desc: '(รวมเวลาถอดแบบ, ค้ำยัน, น้ำยา, ความปลอดภัย)',
      count: '12 ข้อ',
      weight: '20%' 
    },
    { 
      topic: '4. องค์อาคาร: คาน/เสา/ฐานราก', 
      desc: '(รายละเอียดจุดต่อ, ระยะหุ้ม, ตำแหน่งหยุดเท, ความคลาดเคลื่อน)',
      count: '12 ข้อ',
      weight: '20%' 
    },
    { 
      topic: '5. การออกแบบ/ทฤษฎี (Design Theory)', 
      desc: '(ความเข้าใจพฤติกรรมโครงสร้าง, สาเหตุการวิบัติ)',
      count: '6 ข้อ',
      weight: '10%' 
    },
  ];

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

      <WorkerSidebar user={user} active="skill" className={isSidebarOpen ? 'active' : ''} />

      <main className="dash-main">
        <div className="worker-container" style={{ maxWidth: '800px' }}>
          
          <div className="assessment-card">
            <h1 className="assessment-title">ข้อตกลงและเงื่อนไขการสอบ</h1>
            
            <div className="conditions-box">
              <h3>เงื่อนไขการสอบ</h3>
              <ul>
                <li>เวลาในการทำข้อสอบ: <strong>{durationMinutes} นาที</strong></li>
                <li>จำนวนข้อสอบ: <strong>60 ข้อ</strong> (ปรนัย 4 ตัวเลือก)</li>
                <li>เกณฑ์การผ่าน: ต้องได้คะแนนรวมไม่ต่ำกว่า <strong>70%</strong></li>
                <li>ห้ามออกจากหน้าจอระหว่างทำข้อสอบเพื่อป้องกันการทุจริต</li>
              </ul>
            </div>

            <h3 className="section-title">โครงสร้างคะแนน</h3>
            <div className="score-table-container">
              <table className="score-table">
                <thead>
                  <tr>
                    <th style={{ width: '50%' }}>หัวข้อ (Category)</th>
                    <th className="text-center">จำนวนข้อ (โดยประมาณ)</th>
                    <th className="text-center">เปอร์เซ็นต์ (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {scoreStructure.map((item, index) => (
                    <tr key={index}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>{item.topic}</div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>{item.desc}</div>
                      </td>
                      <td className="text-center" style={{ verticalAlign: 'top', paddingTop: '1.2rem' }}>{item.count}</td>
                      <td className="text-center" style={{ verticalAlign: 'top', paddingTop: '1.2rem' }}><strong>{item.weight}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="assessment-actions">
              <button className="btn-cancel" onClick={handleCancel}>ยกเลิก</button>
              <button className="btn-start" onClick={startTest}>ยอมรับและเริ่มทำข้อสอบ</button>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default SkillAssessmentTest;

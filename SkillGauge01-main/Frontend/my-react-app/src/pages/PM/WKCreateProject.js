import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { mockUser } from '../../mock/mockData';
import '../pm/WKDashboard.css';
import './PMTheme.css';
import PMTopNav from './PMTopNav';

// ✅ ถ้ามึงก๊อปไปลงไฟล์ WKProject_Tasks.js ให้เปลี่ยนชื่อเป็น const WKProjectTasks = () => {
const WKCreateProject = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = { ...mockUser, role: 'Project Manager', name: 'สมชาย ใจดี' };
  const API = process.env.REACT_APP_API_URL || 'http://localhost:4000';

  // ฟังก์ชัน Logout สำหรับ Sidebar
  const handleLogout = () => {
    if (window.confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
      sessionStorage.clear();
      navigate('/login');
    }
  };

  // ✅ ฟังก์ชันเล่นเสียง Beep เมื่อเกิด Error
  const playErrorBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // ความถี่เสียง (Hz)
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime); // ระดับความดัง
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1); // เล่นนาน 0.1 วินาที
    } catch (e) { console.warn("Audio context error:", e); }
  };

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [shakeKey, setShakeKey] = useState(0);
  const [projectInfo, setProjectInfo] = useState({
    projectName: '',
    projectType: 'บ้านพักอาศัย',
    location: '',
    startDate: '',
    endDate: '',
    description: '', // ✅ เพิ่มฟิลด์รายละเอียดเพิ่มเติม
    pmName: user.name 
  });

  const handleProjectChange = (e) => {
    const { name, value } = e.target;
    setProjectInfo({ ...projectInfo, [name]: value });
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSaveProject = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!projectInfo.projectName) {
      newErrors.projectName = "กรุณาระบุชื่อโครงการหลัก";
    }

    // ✅ ตรวจสอบว่าวันที่สิ้นสุดต้องไม่มาก่อนวันที่เริ่มโครงการ
    if (projectInfo.startDate && projectInfo.endDate) {
      const start = new Date(projectInfo.startDate);
      const end = new Date(projectInfo.endDate);
      if (end < start) {
        newErrors.endDate = "วันที่สิ้นสุดโครงการต้องไม่มาก่อนวันที่เริ่มโครงการ";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setShakeKey(prev => prev + 1); // กระตุ้นการเขย่า
      playErrorBeep(); // ✅ เล่นเสียงแจ้งเตือน
      return;
    }

    setLoading(true);

    try {
      const token = sessionStorage.getItem('auth_token');
      // POST to backend
      const res = await fetch(`${API}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          project_name: projectInfo.projectName,
          project_description: projectInfo.description,
          start_date: projectInfo.startDate,
          end_date: projectInfo.endDate,
          site_address: projectInfo.location,
          // Latitude/Longitude hardcoded for now or left null
          latitude: 0, 
          longitude: 0
        })
      });

      if (res.ok) {
        sessionStorage.setItem('pm_notification', `สร้างโครงการ "${projectInfo.projectName}" สำเร็จแล้ว!`);
        setTimeout(() => {
          navigate('/projects'); 
        }, 500);
      } else {
        const errData = await res.json();
        alert(`บันทึกไม่สำเร็จ: ${errData.message || 'เกิดข้อผิดพลาด'}`);
        setLoading(false);
      }
    } catch (error) {
       console.error(error);
       alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
       setLoading(false);
    }
  };

  return (
    <div className="pm-page">
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          50% { transform: translateX(6px); }
          75% { transform: translateX(-6px); }
        }
      `}</style>
      <PMTopNav active="projects" user={user} onLogout={handleLogout} />

      <main className="pm-content">
          
          <header className="pm-hero" style={{ marginBottom: '24px' }}>
            <div>
              <h1 className="pm-hero__title">สร้างโครงการหลัก</h1>
              <p className="pm-hero__subtitle">บันทึกข้อมูลโครงการเบื้องต้นก่อน เพื่อไปกำหนดงานย่อยต่อในหน้าโครงการทั้งหมด</p>
            </div>
          </header>

          <form onSubmit={handleSaveProject}>
            <section className="pm-section">
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                
                {/* แถวที่ 1: ชื่อโครงการ และ ประเภทโครงการ */}
                <div>
                  <label style={labelStyle}>ชื่อโครงการ</label>
                  <input 
                    key={errors.projectName ? `name-err-${shakeKey}` : 'name-ok'}
                    className="input" 
                    name="projectName" 
                    placeholder="ระบุชื่อโครงการ" 
                    value={projectInfo.projectName} 
                    onChange={handleProjectChange} 
                    required 
                    style={{ ...inputStyle, border: errors.projectName ? '1px solid #ef4444' : '1px solid #cbd5e1', animation: errors.projectName ? 'shake 0.4s ease-in-out' : 'none' }} 
                  />
                  {errors.projectName && <span style={errorStyle}>{errors.projectName}</span>}
                </div>

                <div>
                  <label style={labelStyle}>ประเภทโครงการ</label>
                  <select className="select" name="projectType" value={projectInfo.projectType} onChange={handleProjectChange} style={inputStyle}>
                    <option value="บ้านพักอาศัย">บ้านพักอาศัย (Residential)</option>
                    <option value="อาคารพาณิชย์">อาคารพาณิชย์ (Commercial)</option>
                    <option value="คอนโดมิเนียม">คอนโดมิเนียม (Condominium)</option>
                    <option value="โรงงาน/คลังสินค้า">โรงงาน/คลังสินค้า (Factory)</option>
                    <option value="อื่นๆ">อื่นๆ</option>
                  </select>
                </div>

                {/* แถวที่ 2: สถานที่หน้างาน (แบบตัวใหญ่) */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>สถานที่ตั้งโครงการ (Site Location)</label>
                  <textarea className="input" name="location" placeholder="ระบุที่อยู่หรือตำแหน่งที่ตั้งโครงการ" value={projectInfo.location} onChange={handleProjectChange} required style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} />
                </div>

                {/* ✅ แถวที่ 3: รายละเอียดโครงการเพิ่มเติม (เพิ่มใหม่ตามมึงสั่ง) */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>รายละเอียดโครงการเพิ่มเติม (Description)</label>
                  <textarea className="input" name="description" placeholder="ระบุรายละเอียดอื่นๆ เช่น ข้อมูลลูกค้า, เบอร์โทรติดต่อ, หรือบันทึกช่วยจำ" value={projectInfo.description} onChange={handleProjectChange} style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }} />
                </div>

                {/* แถวที่ 4: วันเริ่ม และ วันที่สิ้นสุด */}
                <div>
                  <label style={labelStyle}>วันที่เริ่มโครงการ</label>
                  <input className="input" type="date" name="startDate" value={projectInfo.startDate} onChange={handleProjectChange} required style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>วันที่สิ้นสุด (โดยประมาณ)</label>
                  <input 
                    key={errors.endDate ? `date-err-${shakeKey}` : 'date-ok'}
                    className="input" 
                    type="date" 
                    name="endDate" 
                    value={projectInfo.endDate} 
                    onChange={handleProjectChange} 
                    required 
                    style={{ ...inputStyle, border: errors.endDate ? '1px solid #ef4444' : '1px solid #cbd5e1', animation: errors.endDate ? 'shake 0.4s ease-in-out' : 'none' }} 
                  />
                  {errors.endDate && <span style={errorStyle}>{errors.endDate}</span>}
                </div>

              </div>

              <div style={{ marginTop: '40px', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '20px' }}>
                <button 
                  type="button"
                  onClick={() => navigate('/projects')}
                  style={{ 
                    background: '#f1f5f9', 
                    color: '#475569', 
                    padding: '16px 60px', 
                    borderRadius: '50px', 
                    border: '1px solid #cbd5e1', 
                    fontWeight: 'bold', 
                    fontSize: '18px', 
                    cursor: 'pointer'
                  }}
                >
                  ยกเลิก
                </button>
                <button type="submit" disabled={loading} style={{ background: loading ? '#94a3b8' : '#10b981', color: 'white', padding: '16px 60px', borderRadius: '50px', border: 'none', fontWeight: 'bold', fontSize: '18px', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)' }}>
                  {loading ? 'กำลังบันทึก...' : 'บันทึกโครงการลง Projects ➝'}
                </button>
              </div>

            </section>
          </form>
      </main>
    </div>
  );
};

// สไตล์คุมเลเยอร์ให้คลีน
const labelStyle = { fontWeight: '700', display: 'block', marginBottom: '10px', color: '#475569', fontSize: '14px' };
const inputStyle = { width: '100%', padding: '14px 20px', borderRadius: '12px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '16px', background: '#fcfcfc', outline: 'none' };
const errorStyle = { color: '#ef4444', fontSize: '12px', marginTop: '5px', display: 'block', fontWeight: '500' };

export default WKCreateProject;
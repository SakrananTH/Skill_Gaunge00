import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import ThaiDatePicker from '../../components/ThaiDatePicker';
import '../pm/WKDashboard.css';

const WKCreateProject = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const userStr = sessionStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  // --- State for Modals ---
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState(''); // สำหรับ Error ทั่วไป

  const [loading, setLoading] = useState(false);
  const [projectInfo, setProjectInfo] = useState({
    project_name: '',
    project_type: 'บ้านพักอาศัย',
    site_location: '',
    description: '',
    start_date: '',
    end_date: ''
  });

  // --- Logic Logout ---
  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };
  const confirmLogout = () => {
    sessionStorage.clear();
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleProjectChange = (e) => {
    setProjectInfo({ ...projectInfo, [e.target.name]: e.target.value });
  };

  const handleDateChange = (name, dateValue) => {
    let formattedDate = dateValue;
    if (dateValue instanceof Date) {
        const year = dateValue.getFullYear();
        const month = String(dateValue.getMonth() + 1).padStart(2, '0');
        const day = String(dateValue.getDate()).padStart(2, '0');
        formattedDate = `${year}-${month}-${day}`;
    }
    setProjectInfo(prev => ({ ...prev, [name]: formattedDate }));
  };

  const handleSaveProject = async (e) => {
    e.preventDefault();
    if (!user) { setAlertMessage('กรุณาเข้าสู่ระบบก่อน'); return; }
    
    setLoading(true);
    try {
        const payload = { ...projectInfo, manager_id: user.id };
        const API = 'http://localhost:4000'; 
        await axios.post(`${API}/api/manageproject/add`, payload);
        
        // Show Success Modal
        setShowSuccessModal(true);
    } catch (err) {
        console.error(err);
        setAlertMessage('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
        setLoading(false);
    }
  };

  const handleSuccessClose = () => {
      setShowSuccessModal(false);
      navigate('/projects'); // กลับหน้ารายการ
  };

  // --- Styles ---
  const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' };
  const modalContentStyle = { background: 'white', padding: '25px', borderRadius: '12px', width: '350px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' };
  const btnStyle = { padding: '8px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', margin: '0 5px' };
  const labelStyle = { fontWeight: 'bold', marginBottom: '8px', display: 'block', color: '#34495e' };
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #bdc3c7', fontSize: '16px' };
  const btnSaveStyle = { background: '#27ae60', color: 'white', padding: '12px 40px', border: 'none', borderRadius: '30px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(39, 174, 96, 0.3)' };

  return (
    <div className="dash-layout">
      
      {/* === MODALS === */}
      {/* 1. Success Modal */}
      {showSuccessModal && (
        <div style={modalOverlayStyle}>
            <div style={modalContentStyle}>
                <div style={{fontSize: '40px', marginBottom: '10px'}}>🎉</div>
                <h3 style={{color: '#27ae60', margin: '0 0 10px'}}>บันทึกสำเร็จ!</h3>
                <p style={{color: '#555', marginBottom: '20px'}}>สร้างโครงการเรียบร้อยแล้ว</p>
                <button onClick={handleSuccessClose} style={{...btnStyle, background:'#27ae60', color:'white'}}>ตกลง</button>
            </div>
        </div>
      )}

      {/* 2. Logout Modal */}
      {showLogoutModal && (
        <div style={modalOverlayStyle}>
            <div style={modalContentStyle}>
                <h3 style={{color: '#e74c3c', margin: '0 0 15px'}}>ยืนยันออกจากระบบ?</h3>
                <div style={{display:'flex', justifyContent:'center'}}>
                    <button onClick={() => setShowLogoutModal(false)} style={{...btnStyle, background:'#ccc'}}>ยกเลิก</button>
                    <button onClick={confirmLogout} style={{...btnStyle, background:'#e74c3c', color:'white'}}>ยืนยัน</button>
                </div>
            </div>
        </div>
      )}

      {/* 3. General Alert (Error) */}
      {alertMessage && (
        <div style={modalOverlayStyle}>
            <div style={modalContentStyle}>
                <h3 style={{color: '#c0392b', margin: '0 0 15px'}}>แจ้งเตือน</h3>
                <p style={{color: '#555', marginBottom: '20px'}}>{alertMessage}</p>
                <button onClick={() => setAlertMessage('')} style={{...btnStyle, background:'#3498db', color:'white'}}>ตกลง</button>
            </div>
        </div>
      )}

      <aside className="dash-sidebar">
        <div className="sidebar-title" style={{ padding: '20px', textAlign: 'center', fontWeight: 'bold', color: '#1e293b' }}>
          PM Portal
        </div>
        <nav className="menu">
          <button type="button" className={`menu-item ${location.pathname === '/pm' ? 'active' : ''}`} onClick={() => navigate('/pm', { state: { user } })}>หน้าหลัก</button>
          <button type="button" className={`menu-item ${location.pathname === '/project-tasks' ? 'active' : ''}`} onClick={() => navigate('/project-tasks', { state: { user } })}>มอบหมายงาน</button>
          <button type="button" className={`menu-item ${location.pathname === '/projects' || location.pathname === '/create-project' ? 'active' : ''}`} onClick={() => navigate('/projects', { state: { user } })}>โครงการทั้งหมด</button>
          <button type="button" className={`menu-item ${location.pathname === '/pm-settings' ? 'active' : ''}`} onClick={() => navigate('/pm-settings', { state: { user } })}>ตั้งค่า</button>
          <button type="button" className="menu-item logout-btn" style={{ marginTop: '20px', color: '#ef4444', background: '#fef2f2', borderColor: '#fee2e2' }} onClick={handleLogoutClick}>ออกจากระบบ</button>
        </nav>
      </aside>

      <main className="dash-main">
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
          <h1 style={{ color: '#2c3e50', borderBottom: '2px solid #3498db', paddingBottom: '10px' }}>สร้างโครงการใหม่</h1>
          
          <form onSubmit={handleSaveProject} style={{ background: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
            
            <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>ชื่อโครงการ *</label>
                <input className="input" type="text" name="project_name" value={projectInfo.project_name} onChange={handleProjectChange} required style={inputStyle} placeholder="ระบุชื่อโครงการ" />
            </div>

            <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>ประเภทโครงการ *</label>
                <select className="input" name="project_type" value={projectInfo.project_type} onChange={handleProjectChange} style={inputStyle}>
                    <option value="บ้านพักอาศัย">บ้านพักอาศัย</option>
                    <option value="อาคารพาณิชย์">อาคารพาณิชย์</option>
                    <option value="คอนโดมิเนียม">คอนโดมิเนียม</option>
                    <option value="โรงงาน/คลังสินค้า">โรงงาน/คลังสินค้า</option>
                    <option value="อื่นๆ">อื่นๆ</option>
                </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>สถานที่ตั้งโครงการ</label>
                <textarea className="input" name="site_location" value={projectInfo.site_location} onChange={handleProjectChange} rows="3" style={inputStyle} placeholder="ระบุที่อยู่ หรือพิกัด" />
            </div>

            <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>รายละเอียดเพิ่มเติม</label>
                <textarea className="input" name="description" value={projectInfo.description} onChange={handleProjectChange} rows="4" style={inputStyle} placeholder="รายละเอียดสังเขป" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                    <label style={labelStyle}>วันที่เริ่มโครงการ</label>
                    <ThaiDatePicker 
                        value={projectInfo.start_date}
                        onChange={(val) => handleDateChange('start_date', val)}
                        placeholder="เลือกวันเริ่ม"
                        className="input" 
                    />
                </div>
                <div>
                    <label style={labelStyle}>วันที่สิ้นสุด (โดยประมาณ)</label>
                    <ThaiDatePicker 
                        value={projectInfo.end_date}
                        onChange={(val) => handleDateChange('end_date', val)}
                        placeholder="เลือกวันสิ้นสุด"
                        className="input"
                    />
                </div>
            </div>

            <div style={{ marginTop: '30px', textAlign: 'center' }}>
                <button type="submit" disabled={loading} style={btnSaveStyle}>
                  {loading ? 'กำลังบันทึก...' : 'บันทึกโครงการ'}
                </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default WKCreateProject;
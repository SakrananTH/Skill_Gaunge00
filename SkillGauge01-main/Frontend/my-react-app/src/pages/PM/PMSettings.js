import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { mockUser } from '../../mock/mockData';
import '../pm/WKDashboard.css'; // ใช้ CSS มาตรฐานของระบบ
import './PMTheme.css';
import PMTopNav from './PMTopNav';

const PMSettings = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // ดึงข้อมูลผู้ใช้จาก state หรือใช้ข้อมูลจำลอง
  const user = location.state?.user || { ...mockUser, role: 'Project Manager', name: 'สมชาย ใจดี', email: 'somchai@example.com' };

  // ฟังก์ชัน Logout สำหรับ Sidebar ให้เหมือนกับหน้าอื่นๆ
  const handleLogout = () => {
    if (window.confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
      sessionStorage.clear();
      navigate('/login');
    }
  };

  // State สำหรับจัดการการเปลี่ยนรหัสผ่าน
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handleInputChange = (e) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert("รหัสผ่านใหม่ไม่ตรงกัน");
      return;
    }
    // Logic สำหรับการบันทึกรหัสผ่านใหม่
    alert("บันทึกรหัสผ่านใหม่เรียบร้อยแล้ว");
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  return (
    <div className="pm-page">
      <PMTopNav active="settings" user={user} onLogout={handleLogout} />

      <main className="pm-content">
          <header className="pm-hero" style={{ marginBottom: '24px' }}>
            <div>
              <h1 className="pm-hero__title">การตั้งค่าบัญชี</h1>
              <p className="pm-hero__subtitle">จัดการข้อมูลส่วนตัวและรักษาความปลอดภัยของบัญชีคุณ</p>
            </div>
          </header>

          <section className="pm-section">
            
            {/* ส่วนข้อมูลส่วนตัว (แก้ไขไม่ได้ตามความต้องการ) */}
            <div style={{ marginBottom: '40px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ color: '#1e293b', marginBottom: '20px' }}>ข้อมูลส่วนตัว</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={labelStyle}>ชื่อ-นามสกุล (อ่านได้อย่างเดียว)</label>
                  <input type="text" value={user.name} readOnly style={readOnlyStyle} />
                </div>
                <div>
                  <label style={labelStyle}>อีเมล (อ่านได้อย่างเดียว)</label>
                  <input type="email" value={user.email || user.username} readOnly style={readOnlyStyle} />
                </div>
              </div>
            </div>

            {/* ส่วนที่แก้ไขได้เฉพาะรหัสผ่าน */}
            <form onSubmit={handlePasswordSubmit}>
              <h3 style={{ color: '#1e293b', marginBottom: '20px' }}>เปลี่ยนรหัสผ่าน</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={labelStyle}>รหัสผ่านปัจจุบัน</label>
                  <input 
                    type="password" 
                    name="currentPassword"
                    value={passwordData.currentPassword} 
                    onChange={handleInputChange}
                    placeholder="ระบุรหัสผ่านปัจจุบัน" 
                    required 
                    style={inputStyle} 
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <label style={labelStyle}>รหัสผ่านใหม่</label>
                    <input 
                      type="password" 
                      name="newPassword"
                      value={passwordData.newPassword} 
                      onChange={handleInputChange}
                      placeholder="ระบุรหัสผ่านใหม่" 
                      required 
                      style={inputStyle} 
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>ยืนยันรหัสผ่านใหม่</label>
                    <input 
                      type="password" 
                      name="confirmPassword"
                      value={passwordData.confirmPassword} 
                      onChange={handleInputChange}
                      placeholder="ยืนยันรหัสผ่านใหม่" 
                      required 
                      style={inputStyle} 
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '30px' }}>
                <button 
                  type="submit" 
                  style={{ 
                    background: '#2563eb', 
                    color: 'white', 
                    padding: '12px 30px', 
                    borderRadius: '10px', 
                    border: 'none', 
                    fontWeight: 'bold', 
                    cursor: 'pointer' 
                  }}
                >
                  อัปเดตรหัสผ่าน
                </button>
              </div>
            </form>

          </section>
      </main>
    </div>
  );
};

// สไตล์ประกอบเพื่อให้ดูเป็นระเบียบ
const labelStyle = { fontWeight: '700', display: 'block', marginBottom: '8px', color: '#475569', fontSize: '14px' };
const inputStyle = { width: '100%', padding: '12px 15px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '15px', outline: 'none' };
const readOnlyStyle = { ...inputStyle, background: '#f8fafc', color: '#94a3b8', border: '1px solid #e2e8f0', cursor: 'not-allowed' };

export default PMSettings;
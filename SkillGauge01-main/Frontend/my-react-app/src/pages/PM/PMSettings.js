import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { mockUser } from '../../mock/mockData';
import '../pm/WKDashboard.css'; // ใช้ CSS มาตรฐานของระบบ

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
    <div className="dash-layout">
      {/* Sidebar - ปรับโครงสร้างให้เหมือนกับ Worker/Foreman และหน้าอื่นๆ ใน pm */}
      <aside className="dash-sidebar">
        <div className="sidebar-title" style={{ padding: '20px', textAlign: 'center', fontWeight: 'bold', color: '#1e293b' }}>
          PM Portal
        </div>
        <nav className="menu">
          <button 
            type="button" 
            className="menu-item" 
            onClick={() => navigate('/pm', { state: { user } })}
          >
            หน้าหลัก
          </button>
          <button 
            type="button" 
            className="menu-item" 
            onClick={() => navigate('/project-tasks', { state: { user } })}
          >
            มอบหมายงาน
          </button>
          <button 
            type="button" 
            className="menu-item" 
            onClick={() => navigate('/projects', { state: { user } })}
          >
            โครงการทั้งหมด
          </button>
          <button 
            type="button" 
            className="menu-item active"
          >
            ตั้งค่า
          </button>
          
          {/* ปุ่มออกจากระบบสไตล์เดียวกับหน้าอื่นๆ */}
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

      <main className="dash-main" style={{ padding: '40px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <header style={{ marginBottom: '30px' }}>
            <h1 style={{ color: '#1e293b', fontSize: '28px', fontWeight: '800' }}>การตั้งค่าบัญชี</h1>
            <p style={{ color: '#64748b' }}>จัดการข้อมูลส่วนตัวและรักษาความปลอดภัยของบัญชีคุณ</p>
          </header>

          <section style={{ background: 'white', padding: '30px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            
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
        </div>
      </main>
    </div>
  );
};

// สไตล์ประกอบเพื่อให้ดูเป็นระเบียบ
const labelStyle = { fontWeight: '700', display: 'block', marginBottom: '8px', color: '#475569', fontSize: '14px' };
const inputStyle = { width: '100%', padding: '12px 15px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '15px', outline: 'none' };
const readOnlyStyle = { ...inputStyle, background: '#f8fafc', color: '#94a3b8', border: '1px solid #e2e8f0', cursor: 'not-allowed' };

export default PMSettings;
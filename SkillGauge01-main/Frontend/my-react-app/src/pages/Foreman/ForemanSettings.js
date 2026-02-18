import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../pm/WKDashboard.css';
import { apiRequest } from '../../utils/api';
import { performLogout } from '../../utils/logout';

const ForemanSettings = () => {
  const navigate = useNavigate();
  
  // ✅ ดึง user จาก sessionStorage
  const userStr = sessionStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : { name: 'Foreman User', email: 'foreman@example.com', role: 'foreman', id: 0 };

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // ✅ State Modal
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [infoModal, setInfoModal] = useState({ show: false, type: '', message: '' });

  const handleInputChange = (e) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setInfoModal({ show: true, type: 'error', message: 'รหัสผ่านใหม่ไม่ตรงกัน กรุณาระบุใหม่อีกครั้ง' });
      return;
    }
    
    try {
      await apiRequest('/api/foreman/change-password', {
        method: 'POST',
        body: {
            currentPassword: passwordData.currentPassword,
            newPassword: passwordData.newPassword
        }
        });

        setInfoModal({ show: true, type: 'success', message: 'เปลี่ยนรหัสผ่านสำเร็จ!' });
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });

    } catch (err) {
        console.error(err);
        setInfoModal({ 
            show: true, 
            type: 'error', 
        message: err?.message || "เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน" 
        });
    }
  };

  const handleLogout = () => {
    if (window.confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
        performLogout(navigate);
    }
  };

  const closeInfoModal = () => {
    setInfoModal({ ...infoModal, show: false });
  };

  // Styles Modal
  const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' };
  const modalContentStyle = { background: 'white', padding: '30px', borderRadius: '12px', width: '350px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' };
  const btnModalStyle = { padding: '10px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', margin: '0 5px', minWidth: '100px' };

  return (
    <div className="dash-window" style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: "'Kanit', sans-serif" }}>
      
      <header style={{ 
          background: 'white', 
          padding: '16px 24px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          position: 'sticky',
          top: 0,
          zIndex: 50
      }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => navigate('/foreman')}>
              <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '20px' }}>
                  <i className='bx bx-hard-hat'></i>
              </div>
              <div>
                  <h1 style={{ margin: 0, fontSize: '18px', color: '#1e293b', fontWeight: '700' }}>Foreman Portal</h1>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>ระบบประเมินทักษะช่าง</p>
              </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <button 
                  onClick={handleLogout}
                  style={{ 
                      background: '#fee2e2', color: '#ef4444', border: 'none', padding: '8px 16px', 
                      borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px',
                      display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s'
                  }}
              >
                  <i className='bx bx-log-out'></i> ออกจากระบบ
              </button>
          </div>
      </header>

      {/* === Info Modal === */}
      {infoModal.show && (
        <div style={modalOverlayStyle}>
            <div style={modalContentStyle}>
                <div style={{ fontSize: '40px', marginBottom: '15px' }}>
                    {infoModal.type === 'success' ? '✅' : '❌'}
                </div>
                <h3 style={{
                    color: infoModal.type === 'success' ? '#22c55e' : '#ef4444', 
                    margin: '0 0 15px'
                }}>
                    {infoModal.type === 'success' ? 'สำเร็จ' : 'แจ้งเตือน'}
                </h3>
                <p style={{ color: '#64748b', fontSize: '16px', marginBottom: '25px', lineHeight: '1.5' }}>
                    {infoModal.message}
                </p>
                <button 
                    onClick={closeInfoModal} 
                    style={{...btnModalStyle, background: '#3b82f6', color: 'white', width: '100%', padding: '12px'}}
                >
                    ตกลง
                </button>
            </div>
        </div>
      )}

      <main className="worker-main" style={{ flex: 1, padding: '40px 20px', width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <button onClick={() => navigate('/foreman')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
            <i className='bx bx-left-arrow-alt' style={{ fontSize: '20px' }}></i> กลับหน้าหลัก
          </button>
        </div>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <header style={{ marginBottom: '30px' }}>
            <h1 style={{ color: '#1e293b', fontSize: '28px', fontWeight: '800' }}>การตั้งค่าบัญชีโฟร์แมน</h1>
            <p style={{ color: '#64748b' }}>จัดการข้อมูลส่วนตัวและรักษาความปลอดภัยของบัญชีคุณ</p>
          </header>

          <section style={{ background: 'white', padding: '30px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            
            <div style={{ marginBottom: '40px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ color: '#1e293b', marginBottom: '20px' }}>ข้อมูลส่วนตัว</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={labelStyle}>ชื่อ-นามสกุล (อ่านได้อย่างเดียว)</label>
                  <input type="text" value={user.full_name || user.name} readOnly style={readOnlyStyle} />
                </div>
                <div>
                  <label style={labelStyle}>อีเมล (อ่านได้อย่างเดียว)</label>
                  <input type="email" value={user.email} readOnly style={readOnlyStyle} />
                </div>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit}>
              <h3 style={{ color: '#1e293b', marginBottom: '20px' }}>เปลี่ยนรหัสผ่าน</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={labelStyle}>รหัสผ่านปัจจุบัน</label>
                  <input type="password" name="currentPassword" value={passwordData.currentPassword} onChange={handleInputChange} placeholder="ระบุรหัสผ่านปัจจุบัน" required style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <label style={labelStyle}>รหัสผ่านใหม่</label>
                    <input type="password" name="newPassword" value={passwordData.newPassword} onChange={handleInputChange} placeholder="ระบุรหัสผ่านใหม่" required style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>ยืนยันรหัสผ่านใหม่</label>
                    <input type="password" name="confirmPassword" value={passwordData.confirmPassword} onChange={handleInputChange} placeholder="ยืนยันรหัสผ่านใหม่" required style={inputStyle} />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '30px' }}>
                <button type="submit" style={submitBtnStyle}>อัปเดตรหัสผ่าน</button>
              </div>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
};
const labelStyle = { fontWeight: '700', display: 'block', marginBottom: '8px', color: '#475569', fontSize: '14px' };
const inputStyle = { width: '100%', padding: '12px 15px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '15px', outline: 'none' };
const readOnlyStyle = { ...inputStyle, background: '#f8fafc', color: '#94a3b8', border: '1px solid #e2e8f0', cursor: 'not-allowed' };
const submitBtnStyle = { background: '#2563eb', color: 'white', padding: '12px 30px', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer' };

export default ForemanSettings;
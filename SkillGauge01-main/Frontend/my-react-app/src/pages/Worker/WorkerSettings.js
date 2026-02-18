import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { mockUser } from '../../mock/mockData';
import { apiRequest } from '../../utils/api';
import '../pm/WKDashboard.css';

const WorkerSettings = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const tradeLabel = (value) => {
    const key = String(value || '').toLowerCase();
    const map = {
      structure: 'ช่างโครงสร้าง',
      plumbing: 'ช่างประปา',
      roofing: 'ช่างหลังคา',
      masonry: 'ช่างก่ออิฐฉาบปูน',
      aluminum: 'ช่างประตูหน้าต่างอลูมิเนียม',
      ceiling: 'ช่างฝ้าเพดาน',
      electric: 'ช่างไฟฟ้า',
      tiling: 'ช่างกระเบื้อง'
    };
    return map[key] || value || 'ช่างทั่วไป';
  };

  const [user, setUser] = useState({ name: 'ผู้ใช้งาน', id: '', role: 'worker', email: 'worker@example.com' });
  const resolvedTrade =
    user.fullData?.employment?.tradeType ||
    user.technician_type ||
    user.trade_type ||
    user.tradeType ||
    user.technicianType;

    useEffect(() => {
        const loadData = async () => {
            // 1. Priority: Session Storage (Source of Truth)
            const storedUserStr = sessionStorage.getItem('user');
            const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;
            const storedUserId = sessionStorage.getItem('user_id');
            
            let currentUser = storedUser || (location.state?.user) || { ...mockUser, role: 'Worker', name: 'นายสมชาย ใจดี' };
            if (!currentUser?.id && storedUserId) {
              currentUser = { ...currentUser, id: storedUserId };
            }
            
            // Set initial state
            setUser(prev => ({ ...prev, ...currentUser }));

            // 2. Fetch latest profile from API if ID exists
            if (currentUser.id) {
                try {
                const numericWorkerId = currentUser.id && !Number.isNaN(Number(currentUser.id))
                  ? Number(currentUser.id)
                  : null;
                const query = numericWorkerId
                  ? `workerId=${encodeURIComponent(numericWorkerId)}`
                  : `userId=${encodeURIComponent(currentUser.id)}`;
                const data = await apiRequest(`/api/worker/profile?${query}`);
                if (data) {
                  setUser(prev => ({ ...prev, ...data }));
                }
                } catch (err) {
                    console.error('Error fetching worker profile:', err);
                }
            }
        };
        loadData();
    }, [location.state]);

  const handleLogout = () => {
    if (window.confirm("ต้องการออกจากระบบใช่หรือไม่?")) {
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
    alert("บันทึกรหัสผ่านใหม่เรียบร้อยแล้ว");
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  // State สำหรับรูปโปรไฟล์
  const [profileImage, setProfileImage] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfileImage(file);
      setPreviewImage(URL.createObjectURL(file));
    }
  };

  const handleSaveProfileImage = () => {
    alert("บันทึกรูปโปรไฟล์เรียบร้อยแล้ว");
    setProfileImage(null);
  };

  return (
    <div className="dash-window" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Kanit', sans-serif" }}>
      
      {/* Top Navigation Bar (เหมือนหน้า Dashboard) */}
      <nav style={{ 
          background: 'white', 
          padding: '15px 40px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
          position: 'sticky',
          top: 0,
          zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
             <div style={{ 
                width: '36px', height: '36px', 
               background: '#fef3c700', borderRadius: '8px', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
               color: '#5ea6e0', fontSize: '20px'
             }}>
                <img src="/logo123.png" alt="Logo" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
             </div>
             <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: '#1e293b' }}>{tradeLabel(resolvedTrade)}</h2>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <SidebarItem icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M3 13h1v7c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-7h1c.4 0 .77-.24.92-.62.15-.37.07-.8-.22-1.09l-8.99-9a.996.996 0 0 0-1.41 0l-9.01 9c-.29.29-.37.72-.22 1.09s.52.62.92.62Zm9-8.59 6 6V20H6v-9.59z"></path></svg>} label="หน้าหลัก" onClick={() => navigate('/worker')} />
          <SidebarItem icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"fill="currentColor" viewBox="0 0 24 24"><path d="M8 6h9v2H8z"></path><path d="M20 2H6C4.35 2 3 3.35 3 5v14c0 1.65 1.35 3 3 3h15v-2H6c-.55 0-1-.45-1-1s.45-1 1-1h14c.55 0 1-.45 1-1V3c0-.55-.45-1-1-1m-6 14H6c-.35 0-.69.07-1 .18V5c0-.55.45-1 1-1h13v12z"></path></svg>} label="แบบทดสอบ" onClick={() => navigate('/skill-assessment')} />
          <SidebarItem icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M20 6h-3V4c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2M9 4h6v2H9zM8 8h12v3.07l-.83.39a16.78 16.78 0 0 1-14.34 0L4 11.07V8zM4 20v-6.72c2.54 1.19 5.27 1.79 8 1.79s5.46-.6 8-1.79V20z"></path></svg>} label="ประวัติงาน" onClick={() => navigate('/worker/history')} />
          <SidebarItem active icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4m0 6c-1.08 0-2-.92-2-2s.92-2 2-2 2 .92 2 2-.92 2-2 2"></path><path d="m20.42 13.4-.51-.29c.05-.37.08-.74.08-1.11s-.03-.74-.08-1.11l.51-.29c.96-.55 1.28-1.78.73-2.73l-1-1.73a2.006 2.006 0 0 0-2.73-.73l-.53.31c-.58-.46-1.22-.83-1.9-1.11v-.6c0-1.1-.9-2-2-2h-2c-1.1 0-2 .9-2 2v.6c-.67.28-1.31.66-1.9 1.11l-.53-.31c-.96-.55-2.18-.22-2.73.73l-1 1.73c-.55.96-.22 2.18.73 2.73l.51.29c-.05.37-.08.74-.08 1.11s.03.74.08 1.11l-.51.29c-.96.55-1.28 1.78-.73 2.73l1 1.73c.55.95 1.77 1.28 2.73.73l.53-.31c.58.46 1.22.83 1.9 1.11v.6c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2v-.6a8.7 8.7 0 0 0 1.9-1.11l.53.31c.95.55 2.18.22 2.73-.73l1-1.73c.55-.96.22-2.18-.73-2.73m-2.59-2.78c.11.45.17.92.17 1.38s-.06.92-.17 1.38a1 1 0 0 0 .47 1.11l1.12.65-1 1.73-1.14-.66c-.38-.22-.87-.16-1.19.14-.68.65-1.51 1.13-2.38 1.4-.42.13-.71.52-.71.96v1.3h-2v-1.3c0-.44-.29-.83-.71-.96-.88-.27-1.7-.75-2.38-1.4a1.01 1.01 0 0 0-1.19-.15l-1.14.66-1-1.73 1.12-.65c.39-.22.58-.68.47-1.11-.11-.45-.17-.92-.17-1.38s.06-.93.17-1.38A1 1 0 0 0 5.7 9.5l-1.12-.65 1-1.73 1.14.66c.38.22.87.16 1.19-.14.68-.65 1.51-1.13 2.38-1.4.42-.13.71-.52.71-.96v-1.3h2v1.3c0 .44.29.83.71.96.88.27 1.7.75 2.38 1.4.32.31.81.36 1.19.14l1.14-.66 1 1.73-1.12.65c-.39.22-.58.68-.47 1.11Z"></path></svg>} label="ตั้งค่า" onClick={() => navigate('/worker-settings')} />
          
          <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 10px' }}></div>

          <button onClick={handleLogout} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '15px', fontWeight: '600', borderRadius: '8px', transition: 'background 0.2s' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="m20.2 4.02-10-2a.99.99 0 0 0-.83.21C9.14 2.42 9 2.7 9 3v1H4c-.55 0-1 .45-1 1v14c0 .55.45 1 1 1h5v1c0 .3.13.58.37.77.18.15.4.23.63.23.07 0 .13 0 .2-.02l10-2c.47-.09.8-.5.8-.98V5c0-.48-.34-.89-.8-.98M5 18V6h4v12zm14 .18-8 1.6V4.22l8 1.6z"></path><path d="M13 11a1 1 0 1 0 0 2 1 1 0 1 0 0-2"></path></svg>
              ออกจากระบบ
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '40px 20px', width: '100%', maxWidth: '800px', margin: '0 auto' }}>
        
        <div style={{ width: '100%' }}>
          <header style={{ marginBottom: '30px' }}>
            <h1 style={{ color: '#1e293b', fontSize: '28px', fontWeight: '800', marginBottom: '5px' }}>การตั้งค่าบัญชีคนงาน</h1>
            <p style={{ color: '#64748b', margin: 0 }}>จัดการข้อมูลส่วนตัวและรักษาความปลอดภัยของบัญชีคุณ</p>
          </header>

          <section style={{ background: 'white', padding: '40px', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
            
            <div style={{ marginBottom: '40px', paddingBottom: '30px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '30px' }}>
                <div style={{ position: 'relative', width: '100px', height: '100px' }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', border: '4px solid #f1f5f9' }}>
                        <img 
                            src={previewImage || `https://ui-avatars.com/api/?name=${user.name}&background=random&size=200`} 
                            alt="Profile" 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                    </div>
                    <label htmlFor="profile-upload" style={{ position: 'absolute', bottom: '0', right: '0', background: '#2563eb', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                        📷
                    </label>
                    <input id="profile-upload" type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                </div>
                <div>
                    <h3 style={{ color: '#1e293b', margin: '0 0 5px 0', fontSize: '18px' }}>รูปโปรไฟล์</h3>
                    <p style={{ color: '#64748b', margin: '0 0 15px 0', fontSize: '14px' }}>รองรับไฟล์ .jpg, .png ขนาดไม่เกิน 5MB</p>
                    {profileImage && (
                        <button onClick={handleSaveProfileImage} style={{ ...submitBtnStyle, padding: '8px 20px', fontSize: '14px' }}>บันทึกรูปภาพ</button>
                    )}
                </div>
            </div>

            <div style={{ marginBottom: '40px', paddingBottom: '30px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ color: '#1e293b', marginBottom: '20px', fontSize: '18px' }}>ข้อมูลส่วนตัว</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px' }}>
                <div>
                  <label style={labelStyle}>ชื่อ-นามสกุล (อ่านได้อย่างเดียว)</label>
                  <input type="text" value={user.name} readOnly style={readOnlyStyle} />
                </div>
                <div>
                  <label style={labelStyle}>อีเมล (อ่านได้อย่างเดียว)</label>
                  <input type="email" value={user.email || user.username || 'worker@example.com'} readOnly style={readOnlyStyle} />
                </div>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit}>
              <h3 style={{ color: '#1e293b', marginBottom: '20px', fontSize: '18px' }}>เปลี่ยนรหัสผ่าน</h3>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px' }}>
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

              <div style={{ marginTop: '35px' }}>
                <button type="submit" style={submitBtnStyle}>อัปเดตรหัสผ่าน</button>
              </div>
            </form>
          </section>
        </div>

      </main>
    </div>
  );
};

// Styles
const labelStyle = { fontWeight: '600', display: 'block', marginBottom: '8px', color: '#475569', fontSize: '14px' };
const inputStyle = { width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '15px', outline: 'none', transition: 'border 0.2s', backgroundColor: '#fff' };
const readOnlyStyle = { ...inputStyle, background: '#f8fafc', color: '#94a3b8', border: '1px solid #e2e8f0', cursor: 'not-allowed' };
const submitBtnStyle = { background: '#2563eb', color: 'white', padding: '14px 30px', borderRadius: '12px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' };

// Internal Component for Sidebar Item
const SidebarItem = ({ icon, label, active, onClick }) => (
    <div 
        onClick={onClick}
        style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '8px 16px', 
            borderRadius: '20px', 
            cursor: 'pointer', 
            background: active ? '#eff6ff' : 'transparent',
            color: active ? '#2563eb' : '#64748b',
            fontWeight: active ? '600' : '500',
            transition: 'all 0.2s',
            fontSize: '15px'
        }}
    >
        <span style={{ fontSize: '18px' }}>{icon}</span>
        <span>{label}</span>
    </div>
);

export default WorkerSettings;

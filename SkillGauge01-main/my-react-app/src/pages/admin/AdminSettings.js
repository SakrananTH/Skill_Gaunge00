import React, { useState, useEffect } from 'react';
import './AdminSettings.css';

const AdminSettings = ({ avatar, onAvatarChange }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [preview, setPreview] = useState(avatar);
  
  // 1. เพิ่ม State สำหรับข้อมูลส่วนตัว
  const [profile, setProfile] = useState({
    firstName: 'Admin',
    lastName: 'System',
    email: 'admin@skillgauge.com',
    phone: '081-234-5678',
    role: 'Administrator'
  });

  // เพิ่ม State สำหรับเก็บค่าเริ่มต้นเพื่อเปรียบเทียบ (Dirty Check)
  const [initialProfile, setInitialProfile] = useState({
    firstName: 'Admin',
    lastName: 'System',
    email: 'admin@skillgauge.com',
    phone: '081-234-5678',
    role: 'Administrator'
  });

  // 2. เพิ่ม State สำหรับเปลี่ยนรหัสผ่าน
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    setPreview(avatar);

    // Load profile mock
    const storedProfile = localStorage.getItem('admin_profile');
    if (storedProfile) {
      try { 
        const parsed = JSON.parse(storedProfile);
        setProfile(parsed);
        setInitialProfile(parsed);
      } catch(e) {}
    }
  }, [avatar]);

  // Effect สำหรับแจ้งเตือนเมื่อมีการเปลี่ยนแปลงข้อมูลแล้วยังไม่บันทึก (Prevent Unload)
  useEffect(() => {
    const isProfileDirty = JSON.stringify(profile) !== JSON.stringify(initialProfile) || preview !== avatar;
    const isPasswordDirty = passwordData.currentPassword !== '' || passwordData.newPassword !== '' || passwordData.confirmPassword !== '';
    const isDirty = isProfileDirty || isPasswordDirty;

    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [profile, initialProfile, preview, avatar, passwordData]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    setPreview(null);
  };

  // 3. แยกฟังก์ชันบันทึกตาม Tab
  const handleSaveProfile = (e) => {
    e.preventDefault();
    
    if (preview) {
      localStorage.setItem('admin_avatar', preview);
    } else {
      localStorage.removeItem('admin_avatar');
    }
    if (onAvatarChange) {
      onAvatarChange(preview);
    }

    localStorage.setItem('admin_profile', JSON.stringify(profile));
    setInitialProfile(profile); // อัปเดตค่าเริ่มต้นหลังบันทึกสำเร็จ
    alert('บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว');
  };

  const handleSavePassword = (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('รหัสผ่านใหม่ไม่ตรงกัน');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      alert('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }
    // Mock API call
    alert('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว');
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  return (
    <div className="admin-settings">
      <header className="admin-settings__header">
        <h2>ตั้งค่าบัญชีผู้ใช้</h2>
        <p>จัดการข้อมูลส่วนตัว และความปลอดภัยของบัญชี</p>
      </header>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
        <button 
          onClick={() => setActiveTab('profile')}
          style={{ 
            padding: '0.75rem 1rem', background: 'none', border: 'none', cursor: 'pointer', 
            borderBottom: activeTab === 'profile' ? '2px solid #3182ce' : '2px solid transparent',
            color: activeTab === 'profile' ? '#3182ce' : '#718096', fontWeight: '600'
          }}
        >
          ข้อมูลส่วนตัว
        </button>
        <button 
          onClick={() => setActiveTab('security')}
          style={{ 
            padding: '0.75rem 1rem', background: 'none', border: 'none', cursor: 'pointer', 
            borderBottom: activeTab === 'security' ? '2px solid #3182ce' : '2px solid transparent',
            color: activeTab === 'security' ? '#3182ce' : '#718096', fontWeight: '600'
          }}
        >
          ความปลอดภัย
        </button>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="settings-card">
          <h3>ข้อมูลส่วนตัว</h3>
          <form onSubmit={handleSaveProfile}>
            <div className="avatar-upload-section" style={{ marginBottom: '2rem' }}>
              <div className="avatar-preview">
                {preview ? (
                  <img src={preview} alt="Profile Preview" />
                ) : (
                  <div className="avatar-placeholder">
                    <span>No Image</span>
                  </div>
                )}
              </div>
              <div className="avatar-actions">
                <input
                  type="file"
                  id="avatar-upload"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: 'none' }}
                />
                <label htmlFor="avatar-upload" className="btn-upload">
                  เลือกรูปภาพ
                </label>
                {preview && (
                  <button type="button" className="btn-remove" onClick={handleRemoveAvatar}>
                    ลบรูปภาพ
                  </button>
                )}
              </div>
            </div>

            <div className="settings-form">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>ชื่อจริง</label>
                  <input 
                    type="text" 
                    value={profile.firstName} 
                    onChange={(e) => setProfile({...profile, firstName: e.target.value})}
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <label>นามสกุล</label>
                  <input 
                    type="text" 
                    value={profile.lastName} 
                    onChange={(e) => setProfile({...profile, lastName: e.target.value})}
                    className="form-control"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>อีเมล</label>
                <input 
                  type="email" 
                  value={profile.email} 
                  onChange={(e) => setProfile({...profile, email: e.target.value})}
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label>เบอร์โทรศัพท์</label>
                <input 
                  type="tel" 
                  value={profile.phone} 
                  onChange={(e) => setProfile({...profile, phone: e.target.value})}
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label>ตำแหน่ง</label>
                <input 
                  type="text" 
                  value={profile.role} 
                  disabled
                  className="form-control"
                  style={{ background: '#f7fafc', color: '#718096' }}
                />
              </div>
            </div>

            <div className="save-section">
              <button type="submit" className="btn-save">
                บันทึกข้อมูลส่วนตัว
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="settings-card">
          <h3>เปลี่ยนรหัสผ่าน</h3>
          <form onSubmit={handleSavePassword} className="settings-form">
            <div className="form-group">
              <label>รหัสผ่านปัจจุบัน</label>
              <input 
                type="password" 
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                className="form-control"
                required
              />
            </div>
            <div className="form-group">
              <label>รหัสผ่านใหม่</label>
              <input 
                type="password" 
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                className="form-control"
                required
                minLength={6}
              />
            </div>
            <div className="form-group">
              <label>ยืนยันรหัสผ่านใหม่</label>
              <input 
                type="password" 
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                className="form-control"
                required
              />
            </div>
            <div className="save-section">
              <button type="submit" className="btn-save">
                เปลี่ยนรหัสผ่าน
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminSettings;

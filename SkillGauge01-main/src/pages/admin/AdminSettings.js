import React, { useState, useEffect } from 'react';
import './AdminSettings.css';

const AdminSettings = ({ avatar, onAvatarChange }) => {
  const [preview, setPreview] = useState(avatar);

  useEffect(() => {
    setPreview(avatar);
  }, [avatar]);

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

  const handleSave = () => {
    if (preview) {
      localStorage.setItem('admin_avatar', preview);
    } else {
      localStorage.removeItem('admin_avatar');
    }
    if (onAvatarChange) {
      onAvatarChange(preview);
    }
    alert('บันทึกรูปโปรไฟล์เรียบร้อยแล้ว');
  };

  const handleRemove = () => {
    localStorage.removeItem('admin_avatar');
    setPreview(null);
    if (onAvatarChange) {
      onAvatarChange(null);
    }
  };

  return (
    <div className="admin-settings">
      <header className="admin-settings__header">
        <h2>ตั้งค่าบัญชีผู้ใช้</h2>
        <p>จัดการข้อมูลส่วนตัวและรูปโปรไฟล์ของคุณ</p>
      </header>

      <div className="settings-card">
        <h3>รูปโปรไฟล์</h3>
        <div className="avatar-upload-section">
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
              <button type="button" className="btn-remove" onClick={handleRemove}>
                ลบรูปภาพ
              </button>
            )}
          </div>
        </div>
        <div className="save-section">
          <button type="button" className="btn-save" onClick={handleSave}>
            บันทึกการเปลี่ยนแปลง
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;

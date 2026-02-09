import React from 'react';
import { useNavigate } from 'react-router-dom';
import { performLogout } from '../utils/logout';

const LogoutModal = ({ show, onClose, title = 'ออกจากระบบ?', message = 'คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบในขณะนี้?' }) => {
  const navigate = useNavigate();
  if (!show) return null;

  const confirm = () => {
    performLogout(navigate);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'white', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '420px', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', border: '1px solid #e2e8f0' }}>
        <div style={{ width: '64px', height: '64px', background: '#fef2f2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#ef4444' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 24 24"><path d="m20.2 4.02-10-2a.99.99 0 0 0-.83.21C9.14 2.42 9 2.7 9 3v1H4c-.55 0-1 .45-1 1v14c0 .55.45 1 1 1h5v1c0 .3.13.58.37.77.18.15.4.23.63.23.07 0 .13 0 .2-.02l10-2c.47-.09.8-.5.8-.98V5c0-.48-.34-.89-.8-.98M5 18V6h4v12zm14 .18-8 1.6V4.22l8 1.6z"></path><path d="M13 11a1 1 0 1 0 0 2 1 1 0 1 0 0-2"></path></svg>
        </div>
        <h3 style={{ fontSize: '22px', fontWeight: '800', color: '#1e293b', margin: '0 0 10px 0' }}>{title}</h3>
        <p style={{ color: '#64748b', marginBottom: '30px', fontSize: '16px' }}>{message}</p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontWeight: '700', cursor: 'pointer', fontSize: '15px' }}>
            ยกเลิก
          </button>
          <button onClick={confirm} style={{ flex: 1, padding: '14px', borderRadius: '14px', border: 'none', background: '#ef4444', color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '15px', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)' }}>
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogoutModal;

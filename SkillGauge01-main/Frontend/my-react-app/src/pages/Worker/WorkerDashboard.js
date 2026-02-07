import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../pm/WKDashboard.css';
import '../pm/WorkerResponsive.css';
import bannerImage from './WK01.png';

const WorkerDashboard = () => {
  const navigate = useNavigate();
  const apiBase = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000';

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

  const [user, setUser] = useState({ name: 'ผู้ใช้งาน', id: '', role: 'worker' });
  const [assignedTask, setAssignedTask] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [isScrolled, setIsScrolled] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const resolvedTrade = user.technician_type || user.trade_type || user.tradeType || user.technicianType;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const storedUserStr = sessionStorage.getItem('user');
    const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;
    if (storedUser) {
      setUser(prev => ({ ...prev, ...storedUser }));
    }

    const storedUserId = sessionStorage.getItem('user_id');
    const resolvedUserId = storedUser?.id ?? storedUserId;
    const numericWorkerId = resolvedUserId && !Number.isNaN(Number(resolvedUserId))
      ? Number(resolvedUserId)
      : null;
    loadProfile({ userId: resolvedUserId, workerId: numericWorkerId });
    fetchAssignedTask(numericWorkerId ? null : resolvedUserId);

    // Mock Notifications (placeholder - replace when notification API is ready)
    setNotifications([
      { id: 1, message: 'คุณได้รับงานใหม่: "เทคอนกรีตพื้น"', time: '10 นาทีที่แล้ว', read: false },
      { id: 2, message: 'ผลการประเมินทักษะของคุณออกแล้ว', time: '2 ชั่วโมงที่แล้ว', read: false },
    ]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const loadProfile = async ({ userId, workerId }) => {
    if (!userId && !workerId) return;
    try {
      const query = workerId
        ? `workerId=${encodeURIComponent(workerId)}`
        : `userId=${encodeURIComponent(userId)}`;
      const res = await fetch(`${apiBase}/api/worker/profile?${query}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && typeof data === 'object') {
        setUser(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error('Error fetching worker profile:', err);
    }
  };

  const fetchAssignedTask = async (userId) => {
    try {
      const target = userId ? `${apiBase}/api/worker/tasks?userId=${encodeURIComponent(userId)}` : `${apiBase}/api/worker/tasks`;
      const res = await fetch(target);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setAssignedTask(data[0]); 
      }
    } catch (err) {
      console.error("Error fetching tasks:", err);
    }
  };

  const handleLogout = () => {
    if (window.confirm("ต้องการออกจากระบบใช่หรือไม่?")) {
      sessionStorage.clear();
      navigate('/login');
    }
  };

  return (
    <div className="dash-window" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Kanit', sans-serif" }}>
      
      {/* Top Navigation Bar */}
      <nav style={{ 
          background: isScrolled ? 'rgba(255, 255, 255, 0.95)' : 'transparent', 
          padding: '15px 40px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          boxShadow: isScrolled ? '0 4px 20px -5px rgba(0,0,0,0.1)' : 'none',
          backdropFilter: isScrolled ? 'blur(10px)' : 'none',
          transition: 'all 0.3s ease',
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
          <SidebarItem active icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M3 13h1v7c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-7h1c.4 0 .77-.24.92-.62.15-.37.07-.8-.22-1.09l-8.99-9a.996.996 0 0 0-1.41 0l-9.01 9c-.29.29-.37.72-.22 1.09s.52.62.92.62Zm9-8.59 6 6V20H6v-9.59z"></path></svg>} label="หน้าหลัก" onClick={() => navigate('/worker')} />
          <SidebarItem icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M8 6h9v2H8z"></path><path d="M20 2H6C4.35 2 3 3.35 3 5v14c0 1.65 1.35 3 3 3h15v-2H6c-.55 0-1-.45-1-1s.45-1 1-1h14c.55 0 1-.45 1-1V3c0-.55-.45-1-1-1m-6 14H6c-.35 0-.69.07-1 .18V5c0-.55.45-1 1-1h13v12z"></path></svg>} label="แบบทดสอบ" onClick={() => navigate('/skill-assessment')} />
          <SidebarItem icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M20 6h-3V4c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2M9 4h6v2H9zM8 8h12v3.07l-.83.39a16.78 16.78 0 0 1-14.34 0L4 11.07V8zM4 20v-6.72c2.54 1.19 5.27 1.79 8 1.79s5.46-.6 8-1.79V20z"></path></svg>} label="ประวัติงาน" onClick={() => navigate('/worker/history')} />
          <SidebarItem icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4m0 6c-1.08 0-2-.92-2-2s.92-2 2-2 2 .92 2 2-.92 2-2 2"></path><path d="m20.42 13.4-.51-.29c.05-.37.08-.74.08-1.11s-.03-.74-.08-1.11l.51-.29c.96-.55 1.28-1.78.73-2.73l-1-1.73a2.006 2.006 0 0 0-2.73-.73l-.53.31c-.58-.46-1.22-.83-1.9-1.11v-.6c0-1.1-.9-2-2-2h-2c-1.1 0-2 .9-2 2v.6c-.67.28-1.31.66-1.9 1.11l-.53-.31c-.96-.55-2.18-.22-2.73.73l-1 1.73c-.55.96-.22 2.18.73 2.73l.51.29c-.05.37-.08.74-.08 1.11s.03.74.08 1.11l-.51.29c-.96.55-1.28 1.78-.73 2.73l1 1.73c.55.95 1.77 1.28 2.73.73l.53-.31c.58.46 1.22.83 1.9 1.11v.6c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2v-.6a8.7 8.7 0 0 0 1.9-1.11l.53.31c.95.55 2.18.22 2.73-.73l1-1.73c.55-.96.22-2.18-.73-2.73m-2.59-2.78c.11.45.17.92.17 1.38s-.06.92-.17 1.38a1 1 0 0 0 .47 1.11l1.12.65-1 1.73-1.14-.66c-.38-.22-.87-.16-1.19.14-.68.65-1.51 1.13-2.38 1.4-.42.13-.71.52-.71.96v1.3h-2v-1.3c0-.44-.29-.83-.71-.96-.88-.27-1.7-.75-2.38-1.4a1.01 1.01 0 0 0-1.19-.15l-1.14.66-1-1.73 1.12-.65c.39-.22.58-.68.47-1.11-.11-.45-.17-.92-.17-1.38s.06-.93.17-1.38A1 1 0 0 0 5.7 9.5l-1.12-.65 1-1.73 1.14.66c.38.22.87.16 1.19-.14.68-.65 1.51-1.13 2.38-1.4.42-.13.71-.52.71-.96v-1.3h2v1.3c0 .44.29.83.71.96.88.27 1.7.75 2.38 1.4.32.31.81.36 1.19.14l1.14-.66 1 1.73-1.12.65c-.39.22-.58.68-.47 1.11Z"></path></svg>} label="ตั้งค่า" onClick={() => navigate('/worker-settings')} />
          
          <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 10px' }}></div>

          <button onClick={handleLogout} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '15px', fontWeight: '600', borderRadius: '8px', transition: 'background 0.2s' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="m20.2 4.02-10-2a.99.99 0 0 0-.83.21C9.14 2.42 9 2.7 9 3v1H4c-.55 0-1 .45-1 1v14c0 .55.45 1 1 1h5v1c0 .3.13.58.37.77.18.15.4.23.63.23.07 0 .13 0 .2-.02l10-2c.47-.09.8-.5.8-.98V5c0-.48-.34-.89-.8-.98M5 18V6h4v12zm14 .18-8 1.6V4.22l8 1.6z"></path><path d="M13 11a1 1 0 1 0 0 2 1 1 0 1 0 0-2"></path></svg>
              ออกจากระบบ
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="worker-main" style={{ flex: 1, padding: '40px 20px', width: '100%', maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Header (Top Right) */}
        <div className="worker-header" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '20px', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#334155' }}>{user.name || 'ผู้ใช้งาน'}</span>
              <span style={{ fontSize: '12px', color: '#64748b' }}>ช่าง (Worker)</span>
            </div>
            <div style={{ position: 'relative', cursor: 'pointer' }}>
                <svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" ><path d="M19 12.59V10c0-3.22-2.18-5.93-5.14-6.74C13.57 2.52 12.85 2 12 2s-1.56.52-1.86 1.26C7.18 4.08 5 6.79 5 10v2.59L3.29 14.3a1 1 0 0 0-.29.71v2c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-2c0-.27-.11-.52-.29-.71zM19 16H5v-.59l1.71-1.71a1 1 0 0 0 .29-.71v-3c0-2.76 2.24-5 5-5s5 2.24 5 5v3c0 .27.11.52.29.71L19 15.41zM5.64 3.3 4.23 1.89A10.9 10.9 0 0 0 1 9.67h2c0-2.4.94-4.66 2.64-6.36Zm12.72 0C20.06 5 21 7.26 21 9.66h2c0-2.94-1.14-5.7-3.22-7.78l-1.41 1.41ZM12 22c1.31 0 2.41-.83 2.82-2H9.18c.41 1.17 1.51 2 2.82 2"></path></svg>
                {unreadCount > 0 && <span style={{ position: 'absolute', top: '-2px', right: '-2px', background: 'red', borderRadius: '50%', width: '8px', height: '8px' }}></span>}
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#ddd', overflow: 'hidden' }}>
                <img src={`https://ui-avatars.com/api/?name=${user.name}&background=random`} alt="user" style={{ width: '100%', height: '100%' }} />
            </div>
        </div>

        {/* Hero Banner (Blue) */}
        <div className="worker-banner" style={{ 
          background: 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)',
          borderRadius: '24px', 
          padding: '40px 60px', 
          minHeight: '200px',
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '30px',
          position: 'relative',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
          border: '1px solid #bfdbfe',
          overflow: 'hidden'
        }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
                <h1 style={{ fontSize: '36px', fontWeight: '800', color: '#1e293b', marginBottom: '5px' }}>สวัสดี" {user.name || 'ผู้ใช้งาน'} "👋</h1>
                <p style={{ fontSize: '18px', color: '#334155', margin: '0 0 15px 0', fontWeight: '500' }}>พร้อมสำหรับการทำงานในวันนี้หรือยัง?</p>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', color: '#475569', background: 'rgba(255,255,255,0.6)', padding: '10px 20px', borderRadius: '12px', width: 'fit-content', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.8)' }}>
                    <span style={{ fontSize: '15px', fontWeight: '600' }}>📅 {currentDate.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    <span style={{ width: '1px', height: '20px', background: '#94a3b8' }}></span>
                    <span style={{ fontSize: '15px', fontWeight: '600', minWidth: '80px' }}>⏰ {currentDate.toLocaleTimeString('th-TH')}</span>
                </div>
            </div>

            {/* Decorative Icon Right Side */}
            <div style={{ 
                position: 'relative', 
                width: '120px', height: '120px', 
                background: 'rgba(255, 255, 255, 0.6)', borderRadius: '50%', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.15)',
                backdropFilter: 'blur(5px)',
                transform: 'rotate(-5deg)'
            }}>
                <span style={{ fontSize: '60px' }}>🛠️</span>
                <div style={{ position: 'absolute', top: '-15px', right: '-10px', fontSize: '32px', transform: 'rotate(15deg)' }}>⚙️</div>
                <div style={{ position: 'absolute', bottom: '-5px', left: '-20px', fontSize: '32px', transform: 'rotate(-10deg)' }}>🧱</div>
            </div>
        </div>

        {/* Dashboard Grid - 3 cards row */}
        <div className="worker-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '30px' }}>
             {/* Card 1: Status */}
             <div style={{ background: 'white', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', border: '1px solid #e2e8f0' }}>
                <div style={{ width: '45px', height: '45px', background: '#fef3c7', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                    <svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24"  fill="currentColor" viewBox="0 0 24 24" ><path d="M12 2C6.58 2 2 6.58 2 12s4.58 10 10 10 10-4.58 10-10S17.42 2 12 2m0 18c-4.34 0-8-3.66-8-8s3.66-8 8-8 8 3.66 8 8-3.66 8-8 8"></path><path d="M13 7h-2v6h6v-2h-4z"></path></svg>
                </div>
                <div>
                    <h4 style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>สถานะทักษะ</h4>
                    <h3 style={{ margin: 0, fontSize: '18px', color: '#d97706' }}>รอการประเมิน</h3>
                </div>
             </div>

             {/* Card 2: Assigned Jobs */}
             <div style={{ background: 'white', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', border: '1px solid #e2e8f0' }}>
                <div style={{ width: '45px', height: '45px', background: '#e0f2fe', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M20 6h-3V4c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2M9 4h6v2H9zM4 20V8h16v12z"></path></svg>
                </div>
                <div>
                    <h4 style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>งานที่ได้รับมอบหมาย</h4>
                    <h3 style={{ margin: 0, fontSize: '18px', color: '#0284c7' }}>
                        {assignedTask && (assignedTask.status === 'accepted' || assignedTask.status === 'submitted') ? '1 งาน' : '0 งาน'}
                    </h3>
                </div>
             </div>

             {/* Card 3: Skill Test */}
             <div 
                style={{ background: 'white', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', border: '1px solid #e2e8f0', cursor: 'pointer' }}
                onClick={() => navigate('/skill-assessment')}
             >
                <div style={{ width: '45px', height: '45px', background: '#e0e7ff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M8 6h9v2H8z"></path><path d="M20 2H6C4.35 2 3 3.35 3 5v14c0 1.65 1.35 3 3 3h15v-2H6c-.55 0-1-.45-1-1s.45-1 1-1h14c.55 0 1-.45 1-1V3c0-.55-.45-1-1-1m-6 14H6c-.35 0-.69.07-1 .18V5c0-.55.45-1 1-1h13v12z"></path></svg>
                </div>
                <div>
                    <h4 style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>แบบทดสอบวัดทักษะ</h4>
                    <h3 style={{ margin: 0, fontSize: '14px', color: '#4338ca' }}>ทำแบบทดสอบเพื่อวัดระดับความรู้</h3>
                </div>
             </div>
        </div>

        {/* Bottom Section */}
        <div style={{ marginTop: '30px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b', marginBottom: '20px' }}>งานปัจจุบันของคุณ</h3>
            
            {assignedTask ? (
                <div className="worker-task-card" style={{ background: 'white', borderRadius: '20px', padding: '30px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
                            <span style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                                {assignedTask.project || 'Project Name'}
                            </span>
                            <span style={{ fontSize: '14px', color: '#64748b' }}>📅 กำหนดส่ง: {assignedTask.date || '-'}</span>
                        </div>
                        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: '0 0 10px 0' }}>{assignedTask.location || 'Task Name'}</h2>
                        <p style={{ color: '#64748b', margin: 0 }}>หัวหน้างาน: {assignedTask.foreman || '-'}</p>
                    </div>
                    <button 
                        onClick={() => navigate('/worker-task-detail', { state: { task: assignedTask } })}
                        style={{ background: '#2563eb', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)' }}
                    >
                        ดูรายละเอียด & ส่งงาน
                    </button>
                </div>
            ) : (
                <div style={{ background: '#f8fafc', borderRadius: '20px', padding: '40px', textAlign: 'center', border: '2px dashed #cbd5e1' }}>
                    <div style={{ fontSize: '40px', marginBottom: '15px' }}>📭</div>
                    <h3 style={{ color: '#64748b', margin: '0 0 5px 0' }}>ยังไม่มีงานที่ได้รับมอบหมาย</h3>
                    <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>เมื่อหัวหน้างานมอบหมายงานให้คุณ ข้อมูลจะปรากฏที่นี่</p>
                </div>
            )}
        </div>

      </main>
    </div>
  );
};

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

export default WorkerDashboard;

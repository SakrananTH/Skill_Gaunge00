import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../pm/WKDashboard.css';
import '../pm/WorkerResponsive.css';
import LogoutModal from '../../components/LogoutModal';
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
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [workerLevel, setWorkerLevel] = useState(0);
  const [workerLevelLabel, setWorkerLevelLabel] = useState('ต่ำ');
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
    fetchAssessmentSummary(numericWorkerId);
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

  const fetchAssessmentSummary = async (workerId) => {
    if (!workerId) {
      setWorkerLevel(0);
      setWorkerLevelLabel('ต่ำ');
      return;
    }
    try {
      const res = await fetch(`${apiBase}/api/worker/assessment/summary?workerId=${encodeURIComponent(workerId)}`);
      if (!res.ok) {
        setWorkerLevel(0);
        setWorkerLevelLabel('ต่ำ');
        return;
      }
      const data = await res.json();
      const summary = data?.result || null;
      const totalScore = summary?.score ?? null;
      const totalQuestions = summary?.totalQuestions ?? null;
      const passed = summary?.passed === true;
      const percent = totalQuestions ? (Number(totalScore) / Number(totalQuestions)) * 100 : null;

      if (!passed || percent === null) {
        setWorkerLevel(0);
        setWorkerLevelLabel('ต่ำ');
        return;
      }

      if (percent >= 90) {
        setWorkerLevel(3);
        setWorkerLevelLabel('สูง');
      } else if (percent >= 80) {
        setWorkerLevel(2);
        setWorkerLevelLabel('กลาง');
      } else {
        setWorkerLevel(1);
        setWorkerLevelLabel('พื้นฐาน');
      }
    } catch (err) {
      console.error('Error fetching assessment summary:', err);
      setWorkerLevel(0);
      setWorkerLevelLabel('ต่ำ');
    }
  };

  const handleLogout = () => setShowLogoutModal(true);

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
          <SidebarItem active icon={<i className='bx bx-home'></i>} label="หน้าหลัก" onClick={() => navigate('/worker')} />
          <SidebarItem icon={<i className='bx bx-book-content'></i>} label="แบบทดสอบ" onClick={() => navigate('/skill-assessment')} />
          <SidebarItem icon={<i className='bx bx-history'></i>} label="ประวัติงาน" onClick={() => navigate('/worker/history')} />
          <SidebarItem icon={<i className='bx bx-cog'></i>} label="ตั้งค่า" onClick={() => navigate('/worker-settings')} />
          
          <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 10px' }}></div>

          <button 
            onClick={handleLogout} 
            style={{ border: '1px solid #fee2e2', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '700', borderRadius: '12px', transition: 'all 0.2s' }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
              <i className='bx bx-log-out' style={{ fontSize: '20px' }}></i>
              ออกจากระบบ
          </button>
        </div>
      </nav>

      <LogoutModal show={showLogoutModal} onClose={() => setShowLogoutModal(false)} />

      {/* Main Content */}
      <main className="worker-main" style={{ flex: 1, padding: '40px 20px', width: '100%', maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Header (Top Right) */}
        <div className="worker-header" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '20px', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#334155' }}>{user.name || 'ผู้ใช้งาน'}</span>
              <span style={{ fontSize: '12px', color: '#64748b' }}>ช่าง (Worker)</span>
            </div>
            <div style={{ position: 'relative', cursor: 'pointer' }}>
                <i className='bx bx-bell' style={{ fontSize: '24px', color: '#64748b' }}></i>
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
                <h1 style={{ fontSize: '36px', fontWeight: '800', color: '#1e293b', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  สวัสดี" {user.name || 'ผู้ใช้งาน'} "
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '999px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#1e293b'
                  }}>
                    LV.{workerLevel} ({workerLevelLabel})
                  </span>
                </h1>
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
        <div className="worker-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px' }}>
             {/* Card 1: Status */}
             <div style={{ background: 'white', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', border: '1px solid #e2e8f0' }}>
                <div style={{ width: '45px', height: '45px', background: '#fef3c7', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" style={{ color: '#d97706' }}>
                    <path d="M17 14H9v2h8v3l5-4-5-4zm-2-4V8H7V5L2 9l5 4v-3z"></path>
                  </svg>
                </div>
                <div>
                    <h4 style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>สถานะทักษะ</h4>
                    <h3 style={{ margin: 0, fontSize: '18px', color: '#d97706' }}>รอการประเมิน</h3>
                </div>
             </div>

             {/* Card 2: Assigned Jobs */}
             <div 
                style={{ background: 'white', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', border: '1px solid #e2e8f0', cursor: assignedTask && assignedTask.status !== 'submitted' ? 'pointer' : 'default' }}
                onClick={() => assignedTask && assignedTask.status !== 'submitted' && navigate('/worker-task-detail', { state: { task: assignedTask } })}
             >
                <div style={{ width: '45px', height: '45px', background: '#e0f2fe', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                    <i className='bx bx-briefcase' style={{ color: '#0284c7' }}></i>
                </div>
                <div>
                    <h4 style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>งานที่ต้องทำ</h4>
                    <h3 style={{ margin: 0, fontSize: '18px', color: '#0284c7' }}>
                        {assignedTask && (assignedTask.status === 'accepted' || assignedTask.status === 'in-progress') ? '1 งาน' : '0 งาน'}
                    </h3>
                </div>
             </div>

             {/* Card 3: Pending Review */}
             <div 
                style={{ background: 'white', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', border: '1px solid #e2e8f0' }}
             >
                <div style={{ width: '45px', height: '45px', background: '#fff7ed', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" style={{ color: '#d97706' }}>
                    <path d="M19 3h-2c0-.55-.45-1-1-1H8c-.55 0-1 .45-1 1H5c-1.1 0-2 .9-2 2v15c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m0 17H5V5h2v2h10V5h2z"></path>
                    <path d="M11 14.09 8.71 11.8 7.3 13.21l3 3c.2.2.45.29.71.29s.51-.1.71-.29l5-5-1.41-1.41-4.29 4.29Z"></path>
                  </svg>
                </div>
                <div>
                    <h4 style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>รอตรวจสอบ</h4>
                    <h3 style={{ margin: 0, fontSize: '18px', color: '#d97706' }}>
                        {assignedTask && assignedTask.status === 'submitted' ? '1 งาน' : '0 งาน'}
                    </h3>
                </div>
             </div>

             {/* Card 3: Skill Test */}
             <div 
                style={{ background: 'white', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', border: '1px solid #e2e8f0', cursor: 'pointer' }}
                onClick={() => navigate('/skill-assessment')}
             >
                <div style={{ width: '45px', height: '45px', background: '#e0e7ff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                    <i className='bx bx-book-content' style={{ color: '#4338ca' }}></i>
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
                            {assignedTask.status === 'submitted' && (
                                <span style={{ background: '#fff7ed', color: '#c2410c', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #ffedd5' }}>
                                    ⏳ รอตรวจสอบ
                                </span>
                            )}
                            {assignedTask.status === 'rejected' && (
                                <span style={{ background: '#fef2f2', color: '#b91c1c', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #fecaca' }}>
                                    ❌ ต้องแก้ไข
                                </span>
                            )}
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

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../pm/WKDashboard.css'; 

const WorkerDashboard = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState({ name: 'ผู้ใช้งาน', id: '', role: 'worker' });
  const [assignedTask, setAssignedTask] = useState(null); 
  const [loadingTask, setLoadingTask] = useState(false);

  useEffect(() => {
    const storedUserStr = sessionStorage.getItem('user');
    if (storedUserStr) {
      setUser(JSON.parse(storedUserStr));
      fetchAssignedTask();
    } else {
       fetchAssignedTask();
    }
  }, []);

  const fetchAssignedTask = async () => {
    setLoadingTask(true);
    try {
      setTimeout(() => {
        setAssignedTask({
            id: 'T-1024',
            project: 'โครงการหมู่บ้านจัดสรร The Zenith',
            location: 'โซน B - งานเทคานชั้น 2',
            foreman: 'หัวหน้าวิชัย',
            date: '08/01/2026',
            status: 'pending_acceptance' // เริ่มต้นเป็นรอรับงาน
        });
        setLoadingTask(false);
      }, 500);
    } catch (err) { setLoadingTask(false); }
  };

  const handleAcceptTask = () => {
    const confirm = window.confirm("ยืนยันการรับงานนี้หรือไม่?");
    if (confirm) {
      setAssignedTask(prev => ({ ...prev, status: 'accepted' }));
    }
  };

  // ✅ ฟังก์ชันกดเพื่อไปหน้าส่งงาน (Task Detail)
  const handleGoToSubmit = () => {
    navigate('/worker/task-detail', { state: { task: assignedTask } });
  };

  const handleLogout = () => {
    if (window.confirm("ต้องการออกจากระบบใช่หรือไม่?")) {
      sessionStorage.clear();
      navigate('/login');
    }
  };

  return (
    <div className="dash-layout">
      {/* Sidebar */}
      <aside className="dash-sidebar">
        <nav className="menu">
          <div style={{ padding: '20px', textAlign: 'center', fontWeight: 'bold', color: '#1e293b' }}>
                Worker Portal
          </div>
          <button className="menu-item active" onClick={() => navigate('/worker')}>หน้าหลัก</button>
          <button className="menu-item" onClick={() => navigate('/worker/test')}>แบบทดสอบวัดทักษะ</button>
          <button className="menu-item" onClick={() => navigate('/worker-settings')}>ตั้งค่า</button>
          <button className="menu-item" onClick={handleLogout} style={{ marginTop: '20px', color: '#ef4444', borderColor: '#fee2e2', background: '#fef2f2' }}>
            ออกจากระบบ
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="dash-main">
        <div className="dash-header" style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', background: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <h1 style={{ margin: 0, fontSize: '24px' }}>สวัสดี, {user.name}</h1>
             <span className="role-pill" style={{ background: '#22c55e', color: 'white', padding: '5px 15px', borderRadius: '20px', fontSize: '14px' }}>Worker</span>
          </div>
        </div>

        <div className="dashboard-content" style={{ padding: '30px' }}>
          
          {/* ✅ ส่วน Status Cards (ที่เคยหายไป) กลับมาแล้ว */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px' }}>
            <div style={{ background: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ color: '#64748b', fontSize: '14px' }}>สถานะทักษะ</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b', marginTop: '5px' }}>รอการประเมิน</div>
            </div>
            <div style={{ background: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ color: '#64748b', fontSize: '14px' }}>งานที่ได้รับมอบหมาย</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6', marginTop: '5px' }}>
                    {assignedTask && assignedTask.status === 'accepted' ? '1 งาน' : '0 งาน'}
                </div>
            </div>
          </div>

          <h3 style={{ color: '#334155', marginBottom: '15px' }}>งานของคุณ</h3>

          {/* Task Section */}
          <div style={{ marginBottom: '40px' }}>
            {loadingTask ? (
                <div>กำลังโหลด...</div>
            ) : !assignedTask ? (
                <div style={{ padding: '40px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #e2e8f0', color: '#94a3b8' }}>
                    ไม่มีงานใหม่
                </div>
            ) : assignedTask.status === 'pending_acceptance' ? (
                /* 🔶 สถานะ: งานใหม่ รอการตอบรับ */
                <div style={{ background: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0', borderLeft: '5px solid #f59e0b', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
                        <div>
                            <span style={{ background: '#fef3c7', color: '#d97706', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>งานใหม่!</span>
                            <h3 style={{ margin: '10px 0', color: '#1e293b' }}>{assignedTask.project}</h3>
                            <p style={{ margin: '5px 0', color: '#475569' }}>📍 {assignedTask.location}</p>
                            <div style={{ fontSize: '14px', color: '#64748b', marginTop: '8px' }}>
                                โดย: {assignedTask.foreman} | วันที่: {assignedTask.date}
                            </div>
                        </div>
                        <div>
                            <button onClick={handleAcceptTask} style={{ padding: '10px 24px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)' }}>
                                รับงาน
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                /* ✅ สถานะ: รับงานแล้ว -> แสดงปุ่มไปหน้าส่งงาน */
                <div style={{ background: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #bbf7d0', borderLeft: '5px solid #22c55e', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px', alignItems: 'center' }}>
                         <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                <span style={{ fontSize: '20px' }}>✅</span>
                                <h3 style={{ margin: 0, color: '#15803d' }}>คุณได้รับงานนี้แล้ว</h3>
                            </div>
                            <p style={{ margin: 0, color: '#475569' }}>
                                โครงการ: {assignedTask.project} <br/>
                                กรุณาดำเนินการและส่งงานเมื่อเสร็จสิ้น
                            </p>
                         </div>
                         <div>
                            <button 
                                onClick={handleGoToSubmit}
                                style={{ padding: '12px 24px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(34, 197, 94, 0.3)' }}
                            >
                                ดูรายละเอียด / ส่งงาน &rarr;
                            </button>
                         </div>
                    </div>
                </div>
            )}
          </div>

          <h3 style={{ color: '#334155', marginBottom: '15px' }}>เมนู</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
             <div onClick={() => navigate('/worker/test')} style={{ background: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>📝 แบบทดสอบวัดทักษะ</h4>
                <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>ทำแบบทดสอบเพื่อวัดระดับความรู้ทางทฤษฎี</p>
             </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default WorkerDashboard;
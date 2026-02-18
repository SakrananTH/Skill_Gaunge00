import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../pm/WKDashboard.css'; 
import '../pm/PMTheme.css';
import { apiRequest } from '../../utils/api';
import { performLogout } from '../../utils/logout';

const ForemanDashboard = () => {
  const navigate = useNavigate();
  // สมมติ user จาก session หรือ mock
  const userStr = sessionStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : { name: 'Foreman', role: 'Foreman' };
  
  const [pendingWorkers, setPendingWorkers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentDate] = useState(new Date());

  // ✅ State สำหรับ Modal Logout
  // const [showLogoutModal, setShowLogoutModal] = useState(false); // ไม่ได้ใช้แล้ว เพราะจะ logout ทันที หรือใช้ confirm

  // ดึงข้อมูลจริงจาก API
  const fetchWorkers = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/api/foreman/pending-workers');
      const items = Array.isArray(res?.items) ? res.items : [];
      setPendingWorkers(items.map(item => ({
        id: item.id,
        name: item.name,
        roleName: item.roleName,
        date: item.date
      })));
    } catch (error) {
      console.error("Error fetching workers:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, []);

  // เปลี่ยน Link ไปหน้า fmtask_detail
  const handleViewDetailClick = (workerTask) => {
    navigate('/foreman-assessment', { state: { worker: workerTask } });
  };

  const handleLogout = () => {
    if (window.confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
        performLogout(navigate);
    }
  };

  const filteredWorkers = pendingWorkers.filter(worker => 
    (worker.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (worker.roleName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Internal StatCard Component (Consistent with PM)
  const StatCard = ({ icon, label, value, color, bg }) => (
    <div style={{ 
      background: 'white', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '20px', 
      border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' 
    }}>
      <div style={{ width: '56px', height: '56px', background: bg, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>
        {icon}
      </div>
      <div>
        <h4 style={{ margin: 0, fontSize: '13px', color: '#64748b', fontWeight: '500' }}>{label}</h4>
        <h3 style={{ margin: '4px 0 0', fontSize: '20px', color: color, fontWeight: '800' }}>{value}</h3>
      </div>
    </div>
  );

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
                  onClick={() => navigate('/foreman-settings')}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '22px', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.color = '#1e40af'}
                  onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}
                  title="ตั้งค่าบัญชี"
              >
                  <i className='bx bx-cog'></i>
              </button>
              <div style={{ height: '24px', width: '1px', background: '#e2e8f0' }}></div>
              <button 
                  onClick={handleLogout}
                  style={{ 
                      background: '#fee2e2', color: '#ef4444', border: 'none', padding: '8px 16px', 
                      borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px',
                      display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#fecaca'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#fee2e2'}
              >
                  <i className='bx bx-log-out'></i> ออกจากระบบ
              </button>
          </div>
      </header>

      <main className="worker-main" style={{ flex: 1, padding: '40px 20px', width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Hero Banner - Blue Tone */}
        <div style={{ 
          background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', 
          borderRadius: '24px', padding: '30px 40px', color: 'white', marginBottom: '30px',
          boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.3)', position: 'relative', overflow: 'hidden'
        }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h1 style={{ fontSize: '28px', fontWeight: '800', margin: '0 0 8px 0' }}>
              สวัสดี, คุณ{user.name} 👋
            </h1>
            <p style={{ fontSize: '16px', opacity: 0.9, margin: 0 }}>
              วันนี้มีช่างรอให้คุณประเมินทักษะทั้งหมด <strong>{pendingWorkers.length}</strong> ท่าน
            </p>
            <div style={{ marginTop: '20px', display: 'inline-flex', background: 'rgba(255,255,255,0.2)', padding: '8px 16px', borderRadius: '12px', fontSize: '14px', fontWeight: '600' }}>
              <i className='bx bx-calendar' style={{ marginRight: '8px' }}></i>
              {currentDate.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
          <i className='bx bx-hard-hat' style={{ position: 'absolute', right: '-20px', bottom: '-20px', fontSize: '180px', opacity: 0.1, transform: 'rotate(-15deg)' }}></i>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          <StatCard 
            icon={<i className='bx bx-time-five'></i>} 
            label="รอการประเมิน" 
            value={`${pendingWorkers.length} คน`} 
            color="#f59e0b" bg="#fffbeb" 
          />
          <StatCard 
            icon={<i className='bx bx-check-double'></i>} 
            label="ประเมินแล้วเดือนนี้" 
            value="28 คน" 
            color="#10b981" bg="#f0fdf4"
          />
          <StatCard 
            icon={<i className='bx bx-buildings'></i>} 
            label="โครงการที่ดูแล" 
            value="4 โครงการ" 
            color="#3b82f6" bg="#eff6ff" 
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '25px', alignItems: 'start' }}>
          <section className="dash-content" style={{ background: 'white', padding: '30px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
               <h2 style={{ margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className='bx bx-list-ul' style={{ color: '#3b82f6' }}></i> รายการช่างที่รอการประเมิน
               </h2>
               <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px', paddingLeft: '32px' }}>ช่างที่ส่งผลงานแล้ว รอการตรวจสอบภาคปฏิบัติ</p>
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ position: 'relative' }}>
                    <i className='bx bx-search' style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}></i>
                    <input 
                        type="text" 
                        placeholder="ค้นหาชื่อ หรือตำแหน่ง..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ 
                            padding: '10px 15px 10px 35px', borderRadius: '8px', border: '1px solid #cbd5e1', 
                            width: '250px', outline: 'none' 
                        }}
                    />
                </div>
                <button onClick={fetchWorkers} style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className='bx bx-refresh'></i> รีเฟรช
                </button>
            </div>
          </div>

          {loading ? (
            <div style={{padding:'40px', textAlign:'center'}}>กำลังโหลดข้อมูล...</div>
          ) : (
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '16px', color: '#64748b', fontWeight: '600' }}><i className='bx bx-user' style={{ marginRight: '8px' }}></i> ชื่อ-นามสกุล</th>
                            <th style={{ padding: '16px', color: '#64748b', fontWeight: '600' }}><i className='bx bx-briefcase' style={{ marginRight: '8px' }}></i> ตำแหน่ง/ทักษะ</th>
                            <th style={{ padding: '16px', color: '#64748b', fontWeight: '600' }}><i className='bx bx-git-commit' style={{ marginRight: '8px' }}></i> รูปแบบ</th>
                            <th style={{ padding: '16px', color: '#64748b', fontWeight: '600' }}><i className='bx bx-info-circle' style={{ marginRight: '8px' }}></i> สถานะ</th>
                            <th style={{ padding: '16px', color: '#64748b', fontWeight: '600' }}><i className='bx bx-calendar' style={{ marginRight: '8px' }}></i> วันที่ส่ง</th>
                            <th style={{ padding: '16px', color: '#64748b', fontWeight: '600', textAlign: 'right' }}><i className='bx bx-cog' style={{ marginRight: '8px' }}></i> จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredWorkers.length > 0 ? (
                            filteredWorkers.map((w) => (
                            <tr key={w.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '16px', fontWeight: 'bold', color: '#1e293b' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '32px', height: '32px', background: '#e0f2fe', borderRadius: '50%', color: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {w.name.charAt(0)}
                                            </div>
                                            {w.name}
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <span className="status-badge-modern" style={{ background: '#f1f5f9', color: '#475569' }}>
                                            {w.role_name || '-'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <span className="status-badge-modern status-badge-info">
                                            <i className='bx bx-user'></i> 1:1 Mode
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <span className="status-badge-modern status-badge-pending">
                                            <i className='bx bxs-circle' style={{ fontSize: '8px' }}></i> รอการประเมิน
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px', color: '#64748b' }}>
                                        📅 {w.date}
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'right' }}>
                                        <button 
                                            onClick={() => handleViewDetailClick(w)}
                                            style={{ 
                                                padding: '8px 16px', background: '#0f172a', color: 'white', 
                                                border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', fontSize: '13px',
                                                display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s'
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.background = '#1e293b'}
                                            onMouseOut={(e) => e.currentTarget.style.background = '#0f172a'}
                                        >
                                            <i className='bx bx-show'></i> ดูรายละเอียด
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                                    ไม่พบรายการที่รอประเมิน
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
          )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default ForemanDashboard;
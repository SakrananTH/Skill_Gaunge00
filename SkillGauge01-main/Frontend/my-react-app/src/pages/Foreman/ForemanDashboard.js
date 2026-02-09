import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../pm/WKDashboard.css'; 
import LogoutModal from '../../components/LogoutModal';

const ForemanDashboard = () => {
  const navigate = useNavigate();
  const user = { name: 'หัวหน้าวิชัย', role: 'Foreman' };
  
  const [pendingWorkers, setPendingWorkers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState(''); // ✅ เพิ่ม State สำหรับค้นหา
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const fetchWorkers = async () => {
    setLoading(true);
    try {
      // จำลองข้อมูล (Mock Data)
      setPendingWorkers([
        { id: 1, name: 'นายสมชาย ใจดี', roleName: 'ช่างก่ออิฐ', date: '2023-10-25' },
        { id: 2, name: 'นายมีชัย รักดี', roleName: 'ช่างปูน', date: '2023-10-26' },
        { id: 3, name: 'นายเอกพล คนขยัน', roleName: 'ช่างไฟฟ้า', date: '2023-10-27' },
        { id: 4, name: 'นายมานะ อดทน', roleName: 'ช่างประปา', date: '2023-10-28' },
      ]); 
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, []);

  const handleAssessClick = (worker) => {
    navigate('/foreman/assessment', { state: { worker } });
  };

  const handleLogout = () => setShowLogoutModal(true);

  // ✅ Logic กรองข้อมูลตามคำค้นหา
  const filteredWorkers = pendingWorkers.filter(worker => 
    worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    worker.roleName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="dash-layout">
      <aside className="dash-sidebar">
        <nav className="menu">
            <div style={{ padding: '20px', textAlign: 'center', fontWeight: 'bold', color: '#1e293b' }}>
                Foreman Panel
            </div>
            
            <button className="menu-item active" onClick={() => navigate('/foreman')}>Dashboard</button>
            <button className="menu-item" onClick={() => navigate('/foreman-reports')}>รายงานสรุปงาน</button>
            <button className="menu-item" onClick={() => navigate('/foreman-settings')}>ตั้งค่า</button>

            <button 
              className="menu-item" 
              onClick={handleLogout}
              style={{ marginTop: '20px', color: '#ef4444', border: '1px solid #fee2e2', background: '#fef2f2' }}
            >
              ออกจากระบบ
            </button>
        </nav>
      </aside>

      <LogoutModal show={showLogoutModal} onClose={() => setShowLogoutModal(false)} />

      <main className="dash-main">
        <header className="dash-header">
          <div className="header-info">
            <h1>สวัสดี, {user.name}</h1>
            <p>บทบาท: {user.role}</p>
          </div>
        </header>

        <section className="dash-content">
          
          {/* ✅ ส่วนหัว: หัวข้อ + ช่องค้นหา + ปุ่มอัปเดต */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
               <h2 style={{ margin: 0, color: '#1e293b' }}>รายการช่างที่รอการประเมิน</h2>
               <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>จัดการและประเมินผลงานช่างในโครงการ</p>
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
                {/* 🔍 ช่องค้นหา */}
                <input 
                    type="text" 
                    placeholder="🔍 ค้นหาชื่อ หรือตำแหน่ง..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ 
                        padding: '10px 15px', borderRadius: '8px', border: '1px solid #cbd5e1', 
                        width: '250px', outline: 'none' 
                    }}
                />
                <button onClick={fetchWorkers} style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                    อัปเดตข้อมูล
                </button>
            </div>
          </div>

          {loading ? (
            <div className="loading">กำลังโหลดข้อมูล...</div>
          ) : (
            // ✅ เปลี่ยนจาก Grid Card เป็น Table
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '16px', color: '#64748b', fontWeight: '600' }}>ชื่อ-นามสกุล</th>
                            <th style={{ padding: '16px', color: '#64748b', fontWeight: '600' }}>ตำแหน่งงาน</th>
                            <th style={{ padding: '16px', color: '#64748b', fontWeight: '600' }}>วันที่ส่งงาน</th>
                            <th style={{ padding: '16px', color: '#64748b', fontWeight: '600', textAlign: 'right' }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredWorkers.length > 0 ? (
                            filteredWorkers.map((worker) => (
                                <tr key={worker.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '16px', fontWeight: 'bold', color: '#1e293b' }}>
                                        {worker.name}
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <span style={{ background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
                                            {worker.roleName}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px', color: '#64748b' }}>
                                        📅 {worker.date}
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'right' }}>
                                        <button 
                                            onClick={() => handleAssessClick(worker)}
                                            style={{ 
                                                padding: '8px 16px', background: '#0f172a', color: 'white', 
                                                border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', fontSize: '13px' 
                                            }}
                                        >
                                            ประเมินผลงาน
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                                    ไม่พบข้อมูลที่ค้นหา
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default ForemanDashboard;
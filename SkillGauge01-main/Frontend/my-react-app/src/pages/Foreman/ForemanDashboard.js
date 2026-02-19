import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../pm/WKDashboard.css'; 
import '../pm/PMTheme.css';
import { apiRequest } from '../../utils/api';
import { performLogout } from '../../utils/logout';
import Swal from 'sweetalert2';
import LogoutModal from '../../components/LogoutModal';

const ForemanDashboard = () => {
  const navigate = useNavigate();
  const userStr = sessionStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : { name: 'Foreman', role: 'Foreman' };
  
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [pendingWorkers, setPendingWorkers] = useState([]);
  const [assessedWorkers, setAssessedWorkers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentDate] = useState(new Date());

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pendingRes, assessedRes, projectsRes] = await Promise.all([
        apiRequest('/api/foreman/pending-workers'),
        apiRequest('/api/foreman/assessed-workers'),
        apiRequest('/api/foreman/projects')
      ]);

      setPendingWorkers(Array.isArray(pendingRes?.items) ? pendingRes.items : []);
      setAssessedWorkers(Array.isArray(assessedRes?.items) ? assessedRes.items : []);
      setProjects(Array.isArray(projectsRes?.items) ? projectsRes.items : []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleViewDetailClick = (workerTask) => {
    navigate('/foreman-assessment', { state: { worker: workerTask } });
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const handleResetAssessment = async (assessmentId) => {
    const result = await Swal.fire({
      title: 'คุณแน่ใจหรือไม่?',
      text: "คุณต้องการรีเซ็ตผลการประเมินนี้ใช่หรือไม่? หลังจากรีเซ็ต ช่างจะกลับไปอยู่ในสถานะ 'รอการประเมิน'",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'ใช่, รีเซ็ตเลย!',
      cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
      try {
        setLoading(true);
        await apiRequest(`/api/foreman/assessments/${assessmentId}`, { method: 'DELETE' });
        
        await Swal.fire(
          'เรียบร้อย!',
          'รีเซ็ตผลการประเมินเรียบร้อยแล้ว',
          'success'
        );
        fetchData();
      } catch (error) {
        console.error("Error resetting assessment:", error);
        await Swal.fire(
          'เกิดข้อผิดพลาด!',
          'ไม่สามารถรีเซ็ตผลการประเมินได้',
          'error'
        );
      } finally {
        setLoading(false);
      }
    }
  };

  const filteredPending = pendingWorkers.filter(worker => 
    (worker.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||

    (worker.roleName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const assessedCountThisMonth = assessedWorkers.filter(w => {
    const d = new Date(w.date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

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
    <div className="dash-window" style={{ background: '#ffffff', minHeight: '100vh', fontFamily: "'Kanit', sans-serif" }}>

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
              <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #1e40af00 0%, #3b83f600 100%)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000000', fontSize: '40px' }}>
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
        
        {/* Hero Banner */}
        <style>
          {`
            @keyframes float { 0% { transform: translateY(0px) rotate(0deg); } 50% { transform: translateY(-10px) rotate(5deg); } 100% { transform: translateY(0px) rotate(0deg); } }
            @keyframes shine { 0% { left: -100%; opacity: 0; } 50% { opacity: 0.3; } 100% { left: 200%; opacity: 0; } }
          `}
        </style>
        <div style={{ 
          background: 'linear-gradient(135deg, #3168e7 0%, #1e293b 100%)', 
          borderRadius: '28px', padding: '40px 50px', color: 'white', marginBottom: '35px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)', position: 'relative', overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ position: 'absolute', top: 0, left: '-100%', width: '50%', height: '100%', background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent)', transform: 'skewX(-25deg)', animation: 'shine 8s infinite ease-in-out', pointerEvents: 'none' }}></div>
          <div style={{ position: 'absolute', top: '-20%', right: '-5%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)', borderRadius: '50%' }}></div>
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h1 style={{ fontSize: '32px', fontWeight: '800', margin: '0 0 12px 0', letterSpacing: '-0.5px' }}>
              สวัสดีตอนเช้า, คุณ{user.name} <span style={{ display: 'inline-block', animation: 'wave 2s infinite' }}>👋</span>
            </h1>
            <p style={{ fontSize: '18px', color: '#94a3b8', margin: 0, fontWeight: '400' }}>
              วันนี้มีช่างรอรับการประเมินทักษะทั้งหมด <strong style={{ color: '#3b82f6', fontSize: '22px' }}>{pendingWorkers.length}</strong> ท่าน
            </p>
            <div style={{ marginTop: '25px', display: 'inline-flex', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', padding: '10px 20px', borderRadius: '14px', fontSize: '14px', fontWeight: '600', color: '#e2e8f0' }}>
              <i className='bx bx-calendar' style={{ marginRight: '8px' }}></i>
              {currentDate.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
          
          {/* FM Decorative Icon Area */}
          <div style={{ 
              position: 'absolute', 
              right: '40px', 
              top: '50%', 
              transform: 'translateY(-50%)',
              width: '180px', 
              height: '140px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              zIndex: 2
          }}>
              <div style={{
                width: '100px',
                height: '100px',
                borderRadius: '24px',
                background: 'linear-gradient(135deg, #1e3a8a 0%, #172554 100%)',
                border: '1px solid #3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 20px 30px rgba(0, 0, 0, 0.3)',
                animation: 'float 6s ease-in-out infinite',
                position: 'relative',
                zIndex: 2
              }}>
                <i className='bx bx-hard-hat' style={{ fontSize: '56px', color: '#60a5fa' }}></i>
              </div>
              
              {/* Floating Elements */}
              <div style={{
                position: 'absolute',
                top: '0px',
                right: '25px',
                width: '45px',
                height: '45px',
                borderRadius: '12px',
                background: '#475569',
                border: '1px solid #64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 20px rgba(0,0,0,0.2)',
                animation: 'float 7s ease-in-out infinite 1s',
                zIndex: 3
              }}>
                <i className='bx bx-clipboard' style={{ fontSize: '24px', color: '#e2e8f0' }}></i>
              </div>

              <div style={{
                position: 'absolute',
                bottom: '5px',
                left: '25px',
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: '#334155',
                border: '1px solid #475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 20px rgba(0,0,0,0.2)',
                animation: 'float 5s ease-in-out infinite 0.5s',
                zIndex: 1
              }}>
                <i className='bx bx-check-circle' style={{ fontSize: '22px', color: '#4ade80' }}></i>
              </div>
          </div>

          <i className='bx bx-hard-hat' style={{ position: 'absolute', right: '20px', bottom: '-40px', fontSize: '220px', opacity: 0.03, transform: 'rotate(-15deg)', zIndex: 0 }}></i>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '25px', marginBottom: '35px' }}>
          <StatCard 
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="currentColor" viewBox="0 0 24 24" style={{ color: '#d97706' }}>
                <path d="M17 14H9v2h8v3l5-4-5-4zm-2-4V8H7V5L2 9l5 4v-3z"></path>
              </svg>
            } 
            label="รอการประเมิน" 
            value={`${pendingWorkers.length} คน`} 
            color="#d97706" bg="#fff7ed" 
          />
          <StatCard 
            icon={<i className='bx bx-check-circle'></i>} 
            label="ประเมินแล้วเดือนนี้" 
            value={`${assessedCountThisMonth} คน`} 
            color="#10b981" bg="#f0fdf4"
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {/* Section 1: Pending Workers */}
          <section style={{ background: 'white', padding: '32px', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                 <h2 style={{ margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '20px', fontWeight: '700' }}>
                  <div style={{ width: '36px', height: '36px', background: '#eff6ff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}><i className='bx bx-list-ul'></i></div>
                  รายการช่างที่รอการประเมิน
                 </h2>
                 <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '14px', paddingLeft: '48px' }}>ช่างที่ส่งผลงานแล้ว รอการตรวจสอบภาคปฏิบัติ</p>
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
                              width: '250px', outline: 'none', fontSize: '14px'
                          }}
                      />
                  </div>
                  <button onClick={fetchData} style={{ padding: '8px 16px', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                      <i className='bx bx-refresh'></i> รีเฟรช
                  </button>
              </div>
            </div>

            {loading ? (
              <div style={{padding:'40px', textAlign:'center'}}>กำลังโหลดข้อมูล...</div>
            ) : (
              <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                              <th style={{ padding: '16px', color: '#64748b', fontWeight: '600' }}><i className='bx bx-user' style={{ marginRight: '8px' }}></i> ชื่อ-นามสกุล</th>
                              <th style={{ padding: '16px', color: '#64748b', fontWeight: '600' }}><i className='bx bx-briefcase' style={{ marginRight: '8px' }}></i> ตำแหน่ง/ทักษะ</th>
                              <th style={{ padding: '16px', color: '#64748b', fontWeight: '600' }}><i className='bx bx-book-open' style={{ marginRight: '8px' }}></i> คะแนนสอบทฤษฎี</th>
                              <th style={{ padding: '16px', color: '#64748b', fontWeight: '600' }}><i className='bx bx-info-circle' style={{ marginRight: '8px' }}></i> สถานะ</th>
                              <th style={{ padding: '16px', color: '#64748b', fontWeight: '600' }}><i className='bx bx-calendar' style={{ marginRight: '8px' }}></i> วันที่ส่ง</th>
                              <th style={{ padding: '16px', color: '#64748b', fontWeight: '600', textAlign: 'right' }}><i className='bx bx-cog' style={{ marginRight: '8px' }}></i> จัดการ</th>
                          </tr>
                      </thead>
                      <tbody>
                          {filteredPending.length > 0 ? (
                              filteredPending.map((w) => (
                              <tr key={w.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                      <td style={{ padding: '16px', fontWeight: 'bold', color: '#1e293b' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                              <div style={{ width: '32px', height: '32px', background: '#e0f2fe', borderRadius: '50%', color: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                  {w.name?.charAt(0) || '?'}
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
                                          <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                                              {w.theory?.level && (
                                                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#4338ca', marginBottom:'2px' }}>
                                                      ระดับ {w.theory.level}
                                                  </div>
                                              )}
                                              <div style={{ background: '#eef2ff', padding: '6px 12px', borderRadius: '8px', width: 'fit-content', color: '#4338ca', fontWeight: 'bold' }}>
                                                  {w.theory?.score ? `${w.theory.score}/${w.theory.totalQuestions || '?'}` : 'ยังไม่มีคะแนน'}
                                              </div>
                                          </div>
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
                                                  padding: '8px 18px', background: '#2563eb', color: 'white', 
                                                  border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '13px',
                                                  display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s'
                                              }}
                                              onMouseOver={(e) => e.currentTarget.style.background = '#1d4ed8'}
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

          {/* Section 2: Assessed Workers */}
          <section style={{ background: 'white', padding: '32px', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <div style={{ marginBottom: '20px' }}>
               <h2 style={{ margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '20px', fontWeight: '700' }}>
                <div style={{ width: '36px', height: '36px', background: '#f0fdf4', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}><i className='bx bx-check-circle'></i></div>
                ประวัติการประเมินช่าง (Assessed Workers)
               </h2>
               <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '14px', paddingLeft: '48px' }}>รายชื่อช่างที่ได้รับการประเมินเรียบร้อยแล้ว</p>
            </div>
            
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
               <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '16px' }}>ช่าง</th>
                          <th style={{ padding: '16px' }}>ทักษะ</th>
                          <th style={{ padding: '16px', textAlign: 'center' }}>คะแนนที่ได้</th>
                          <th style={{ padding: '16px', textAlign: 'center' }}>ระดับ</th>
                          <th style={{ padding: '16px' }}>วันที่ประเมิน</th>
                          <th style={{ padding: '16px', textAlign: 'right' }}>จัดการ</th>
                      </tr>
                  </thead>
                  <tbody>
                    {assessedWorkers.length > 0 ? (
                      assessedWorkers.map((item) => {
                        let level = 'ระดับ 1';
                        let levelColor = '#166534';
                        let levelBg = '#dcfce7';

                        if (item.score < 60) {
                          level = 'ไม่ผ่าน';
                          levelColor = '#991b1b';
                          levelBg = '#fee2e2';
                        }

                        return (
                        <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '16px', fontWeight: '600' }}>{item.name}</td>
                          <td style={{ padding: '16px', color: '#64748b' }}>{item.roleName}</td>
                          <td style={{ padding: '16px', textAlign: 'center', fontWeight: 'bold' }}>
                            <span style={{ 
                                background: item.score >= 80 ? '#dcfce7' : item.score >= 50 ? '#fef9c3' : '#fee2e2',
                                color: item.score >= 80 ? '#166534' : item.score >= 50 ? '#854d0e' : '#991b1b',
                                padding: '4px 12px', borderRadius: '99px', fontSize: '14px'
                            }}>
                              {item.score}%
                            </span>
                          </td>
                          <td style={{ padding: '16px', textAlign: 'center' }}>
                              <span style={{ 
                                  background: levelBg, 
                                  color: levelColor, 
                                  padding: '4px 12px', 
                                  borderRadius: '6px', 
                                  fontWeight: '600',
                                  fontSize: '13px'
                              }}>
                                  {level}
                              </span>
                          </td>
                          <td style={{ padding: '16px', color: '#64748b', fontSize: '14px' }}>
                             {new Date(item.date).toLocaleDateString('th-TH')}
                          </td>
                          <td style={{ padding: '16px', textAlign: 'right' }}>
                              <button 
                                  onClick={() => handleResetAssessment(item.id)}
                                  style={{ 
                                      padding: '8px 16px', background: '#fee2e2', color: '#ef4444', 
                                      border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', fontSize: '13px',
                                      display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s'
                                  }}
                                  onMouseOver={(e) => e.currentTarget.style.background = '#fecaca'}
                                  onMouseOut={(e) => e.currentTarget.style.background = '#fee2e2'}
                              >
                                  <i className='bx bx-refresh'></i> รีเซ็ต
                              </button>
                          </td>
                        </tr>
                      )})
                    ) : (
                      <tr>
                          <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>ยังไม่มีประวัติการประเมิน</td>
                      </tr>
                    )}
                  </tbody>
               </table>
            </div>
          </section>


        </div>
      </main>
      <LogoutModal 
        show={showLogoutModal} 
        onClose={() => setShowLogoutModal(false)}
      />
    </div>
  );
};

export default ForemanDashboard;
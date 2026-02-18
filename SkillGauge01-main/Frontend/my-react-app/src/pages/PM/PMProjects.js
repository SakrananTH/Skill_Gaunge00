import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { mockUser } from '../../mock/mockData';
import '../pm/WKDashboard.css';
import './PMTheme.css';
import PMTopNav from './PMTopNav';
import { apiRequest } from '../../utils/api';

// Internal StatCard Component (Consistent with PMProjectManager)
const StatCard = ({ icon, label, value, color, bg, onClick, isActive }) => {
  return (
      <div 
          onClick={onClick}
          style={{ 
        background: bg,
              borderRadius: '16px', 
              padding: '24px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '24px', 
        border: '1px solid #e2e8f0', 
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', 
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              transform: isActive ? 'translateY(-2px)' : 'none'
          }}
      >
      <div style={{ width: '64px', height: '64px', background: 'white', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>
              {icon}
          </div>
          <div>
              <h4 style={{ margin: 0, fontSize: '13px', color: '#64748b', fontWeight: '500' }}>{label}</h4>
              <h3 style={{ margin: '4px 0 0', fontSize: '24px', color: color, fontWeight: '800' }}>
                  {value}
              </h3>
          </div>
      </div>
  );
};

const PMProjects = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = location.state?.user || { ...mockUser, role: 'Project Manager' };
  const currentDate = new Date();

  const handleLogout = () => {
    if (window.confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
      sessionStorage.clear();
      navigate('/login');
    }
  };

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'done'
  const [typeFilter, setTypeFilter] = useState('all');
  const [toast, setToast] = useState('');

  useEffect(() => {
    const msg = sessionStorage.getItem('pm_notification');
    if (msg) {
      setToast(msg);
      sessionStorage.removeItem('pm_notification');
      setTimeout(() => setToast(''), 4000);
    }
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/api/dashboard/project-task-counts');
      setProjects(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`ยืนยันลบโครงการ "${name}"? ข้อมูลที่เกี่ยวข้องทั้งหมดจะหายไป`)) return;

    try {
      await apiRequest(`/api/projects/${id}`, { method: 'DELETE' });
      setProjects(prev => prev.filter(p => p.project_id !== id));
      setToast(`ลบโครงการ "${name}" เรียบร้อยแล้ว`);
      setTimeout(() => setToast(''), 3000);
    } catch (e) {
      console.error(e);
      alert(`ลบรายการไม่สำเร็จ: ${e?.data?.message || 'เกิดข้อผิดพลาด'}`);
    }
  };

  const filteredProjects = projects.filter(p => {
    const matchesSearch = (p.project_name || "").toLowerCase().includes(searchTerm.toLowerCase());
    const isDone = p.tasks_total > 0 && p.tasks_done === p.tasks_total;

    const matchesStatus = statusFilter === 'active' ? !isDone : (statusFilter === 'done' ? isDone : true);
    const matchesType = typeFilter === 'all' ? true : p.project_type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => !(p.tasks_total > 0 && p.tasks_total === p.tasks_done)).length;
  const completedProjects = projects.filter(p => p.tasks_total > 0 && p.tasks_total === p.tasks_done).length;

  const formatDateShort = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if(isNaN(d.getTime())) return '-';
    const year = d.getFullYear() + 543;
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return `${d.getDate()} ${months[d.getMonth()]} ${String(year).slice(-2)}`;
  };

  const projectTypes = [
    { value: 'all', label: 'ทุกประเภท' },
    { value: 'งานโครงสร้าง', label: 'งานโครงสร้าง' },
    { value: 'งานไฟฟ้า', label: 'งานไฟฟ้า' },
    { value: 'งานประปา', label: 'งานประปา' },
    { value: 'งานหลังคา', label: 'งานหลังคา' },
    { value: 'งานกระเบื้อง', label: 'งานกระเบื้อง' },
    { value: 'งานก่ออิฐฉาบปูน', label: 'งานก่ออิฐฉาบปูน' },
    { value: 'งานประตูหน้าต่างอลูมิเนียม', label: 'งานประตูหน้าต่างอลูมิเนียม' },
    { value: 'งานฝ้าเพดาน', label: 'งานฝ้าเพดาน' },
  ];

  return (
    <div className="dash-window" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Kanit', sans-serif" }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: '30px', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: '#10b981', color: 'white', padding: '12px 24px', borderRadius: '16px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', zIndex: 2000,
          display: 'flex', alignItems: 'center', gap: '12px', fontWeight: '600',
          animation: 'toastIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}>
          <style>{`@keyframes toastIn { from { transform: translate(-50%, -40px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }`}</style>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"></path></svg>
          {toast}
        </div>
      )}
      
      <PMTopNav active="projects" user={user} onLogout={handleLogout} />

      <main className="worker-main" style={{ flex: 1, padding: '40px 20px', width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Hero Banner - consistent with PMProjectManager */}
        <div style={{ 
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', // Dark Executive Tone
          borderRadius: '24px', 
          padding: '24px 40px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '30px',
          boxShadow: '0 10px 20px -5px rgba(14, 165, 233, 0.3)', 
          border: '1px solid rgba(255,255,255,0.6)',
          position: 'relative',
          overflow: 'hidden'
        }}>
            {/* Background Decoration */}
            <div style={{ position: 'absolute', inset: 0, opacity: 0.3, background: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.8), transparent 70%)', pointerEvents: 'none' }}></div>
            <div style={{ position: 'relative', zIndex: 1 }}>
                <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', marginBottom: '8px', letterSpacing: '-0.5px', fontFamily: "'Kanit', sans-serif" }}>
                  <span style={{ color: '#f8fafc' }}>ศูนย์บริหารจัดการโครงการ</span>
                </h1>
                <p style={{ fontSize: '16px', color: '#94a3b8', margin: '0 0 16px 0', fontWeight: '500' }}>
                  ติดตามความคืบหน้า ควบคุมระยะเวลา และบริหารทรัพยากร
                </p>
                <button 
                  onClick={() => navigate('/create-project')}
                  style={{ 
                    background: 'white', color: '#0284c7', border: 'none', padding: '12px 24px', 
                    borderRadius: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '15px',
                    display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    transition: 'transform 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <i className='bx bx-plus-circle' style={{ fontSize: '20px' }}></i> สร้างโครงการใหม่
                </button>
            </div>
            
             <div style={{ position: 'relative', width: '200px', height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: '90px', filter: 'drop-shadow(0 20px 30px rgba(2, 132, 199, 0.3))', animation: 'float 6s ease-in-out infinite' }}>
                  🏗️
                </div>
            </div>
        </div>

        {/* Search & Filter Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
             <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ position: 'relative', width: '350px' }}>
                    <i className='bx bx-search' style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '20px' }}></i>
                    <input 
                    type="text" 
                    placeholder="ค้นหาชื่อโครงการ..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ 
                        width: '100%', padding: '12px 12px 12px 40px', borderRadius: '12px', 
                        border: '1px solid #e2e8f0', outline: 'none', background: 'white',
                        fontSize: '14px', color: '#1e293b', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' 
                    }}
                    />
                </div>
             </div>
             <button 
                onClick={loadProjects}
                style={{ 
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', 
                    borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white',
                    color: '#64748b', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#1e293b'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#64748b'; }}
             >
                <i className='bx bx-refresh' style={{ fontSize: '20px' }}></i> รีเฟรชข้อมูล
             </button>
        </div>

        {/* Type Filter Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'none' }}>
            {projectTypes.map((type) => (
                <button
                    key={type.value}
                    onClick={() => setTypeFilter(type.value)}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: '1px solid',
                        borderColor: typeFilter === type.value ? '#0284c7' : '#e2e8f0',
                        background: typeFilter === type.value ? '#eff6ff' : 'white',
                        color: typeFilter === type.value ? '#0284c7' : '#64748b',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.2s'
                    }}
                >
                    {type.label}
                </button>
            ))}
        </div>

        {/* Stats Grid */}
        <div className="worker-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          <StatCard 
            icon={<i className='bx bx-folder'></i>} 
            label="โครงการทั้งหมด" 
            value={totalProjects} 
            color="#3b82f6" bg="#eff6ff" 
            onClick={() => setStatusFilter('all')}
            isActive={statusFilter === 'all'}
          />
          <StatCard 
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M11 2v5h2V2zm0 15v5h2v-5zm6-6v2h5v-2zM7 13v-2H2v2zm.76 1.83L5.99 16.6l-1.77 1.76.71.71.71.71 1.76-1.77 1.77-1.77-.71-.7zm8.48 0-.7.71-.71.7 1.77 1.77 1.76 1.77.71-.71.71-.71-1.77-1.76zM5.64 4.22l-.71.71-.71.71L5.99 7.4l1.77 1.77.7-.71.71-.7L7.4 5.99z"></path></svg>}
            label="กำลังดำเนินการ" 
            value={activeProjects} 
            color="#f59e0b" bg="#fffbeb" 
            onClick={() => setStatusFilter('active')}
            isActive={statusFilter === 'active'}
          />
          <StatCard 
            icon={<i className='bx bx-check-circle'></i>} 
            label="เสร็จสิ้นแล้ว" 
            value={completedProjects} 
            color="#10b981" bg="#f0fdf4" 
            onClick={() => setStatusFilter('done')}
            isActive={statusFilter === 'done'}
          />
        </div>

        {/* Projects Table */}
        <section style={{ background: 'white', borderRadius: '16px', padding: '0px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', overflow: 'hidden' }}>
            <div className="table" style={{ border: 'none', margin: 0 }}>
              <div className="thead" style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1.8fr 1.5fr 1.2fr 0.8fr 0.8fr 1fr', 
                  background: '#f8fafc', 
                  padding: '16px 24px', 
                  borderBottom: '1px solid #e2e8f0' 
              }}>
                <div style={{ fontWeight: '600', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}><i className='bx bx-building-house'></i> ชื่อโครงการ / สถานที่</div>
                <div style={{ fontWeight: '600', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}><i className='bx bx-line-chart'></i> ความคืบหน้า</div>
                <div style={{ fontWeight: '600', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}><i className='bx bx-calendar-event'></i> ระยะเวลา</div>
                <div style={{ textAlign: 'center', fontWeight: '600', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><i className='bx bx-list-check'></i> จำนวนงาน</div>
                <div style={{ textAlign: 'center', fontWeight: '600', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><i className='bx bx-info-circle'></i> สถานะ</div>
                <div style={{ textAlign: 'center', fontWeight: '600', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><i className='bx bx-cog'></i> จัดการ</div>
              </div>
              
              <div className="tbody">
                {loading ? (
                  <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>กำลังโหลดข้อมูล...</div>
                ) : filteredProjects.length > 0 ? filteredProjects.map((p) => {
                  const percent = p.tasks_total > 0 ? Math.round((p.tasks_done / p.tasks_total) * 100) : 0;
                  const isDone = p.tasks_total > 0 && p.tasks_done === p.tasks_total;
                  
                  return (
                    <div className="tr" key={p.project_id} style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1.8fr 1.5fr 1.2fr 0.8fr 0.8fr 1fr', 
                        borderBottom: '1px solid #f1f5f9', 
                        padding: '20px 24px', 
                        alignItems: 'center',
                        transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '15px' }}>{p.project_name}</div>
                            {p.project_type && <span style={{ fontSize: '10px', background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>{p.project_type}</span>}
                        </div>
                        <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <i className='bx bx-map' style={{ color: '#94a3b8' }}></i> {p.site_address || 'ไม่ระบุสถานที่'}
                        </div>
                      </div>
                      
                      <div style={{ paddingRight: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
                            <span style={{ color: '#64748b' }}>เสร็จแล้ว {p.tasks_done}/{p.tasks_total} งาน</span>
                            <span style={{ fontWeight: '700', color: isDone ? '#10b981' : '#3b82f6' }}>{percent}%</span>
                        </div>
                        <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${percent}%`, height: '100%', background: isDone ? '#10b981' : 'linear-gradient(90deg, #3b82f6, #60a5fa)', borderRadius: '4px', transition: 'width 1s ease-in-out' }}></div>
                        </div>
                      </div>

                      <div style={{ fontSize: '13px', color: '#475569' }}>
                        <div style={{ marginBottom: '2px' }}><i className='bx bx-calendar' style={{ color: '#cbd5e1' }}></i> {formatDateShort(p.start_date)}</div>
                        <div style={{ color: '#94a3b8', fontSize: '12px' }}>ถึง {formatDateShort(p.end_date)}</div>
                      </div>

                      <div style={{ textAlign: 'center', color: '#334155', fontWeight: '600' }}>
                        {p.tasks_total}
                      </div>

                      <div style={{ textAlign: 'center' }}>
                        {isDone ? (
                           <span style={{ background: '#ecfdf5', color: '#059669', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>เสร็จสิ้น</span>
                        ) : p.tasks_total === 0 ? (
                           <span style={{ background: '#f1f5f9', color: '#94a3b8', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>ว่าง</span>
                        ) : (
                           <span style={{ background: '#eff6ff', color: '#2563eb', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>กำลังทำ</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                           <button 
                            onClick={() => navigate('/project-tasks', { state: { project: p } })}
                            title="มอบหมายงาน"
                            style={{ width: '32px', height: '32px', background: 'white', border: '1px solid #dbeafe', borderRadius: '8px', color: '#2563eb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                            onMouseOver={(e) => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#bfdbfe'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#dbeafe'; }}
                           >
                            <i className='bx bx-list-ul'></i>
                           </button>
                           <button 
                            onClick={() => navigate('/project-detail', { state: { pj_id: p.project_id, project: p, user } })}
                            title="ตั้งค่า/รายละเอียด"
                            style={{ width: '32px', height: '32px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                            onMouseOver={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#1e293b'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#475569'; }}
                           >
                            <i className='bx bx-cog'></i>
                           </button>
                           <button 
                            onClick={() => handleDelete(p.project_id, p.project_name)}
                            title="ลบโครงการ"
                            style={{ width: '32px', height: '32px', background: 'white', border: '1px solid #fee2e2', borderRadius: '8px', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                            onMouseOver={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#fecaca'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#fee2e2'; }}
                           >
                            <i className='bx bx-trash'></i>
                           </button>
                      </div>
                    </div>
                  );
                }) : (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                        <i className='bx bx-folder-open' style={{ fontSize: '48px', marginBottom: '10px', display: 'block', opacity: 0.5 }}></i>
                        ไม่พบข้อมูลโครงการ
                    </div>
                )}
              </div>
            </div>
          </section>
      </main>
    </div>
  );
};

export default PMProjects;
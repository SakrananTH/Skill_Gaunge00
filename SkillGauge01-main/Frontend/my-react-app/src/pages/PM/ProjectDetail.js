import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../pm/WKDashboard.css';
import './PMTheme.css';
import PMTopNav from './PMTopNav';
import { apiRequest } from '../../utils/api';

const ProjectDetail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // รับ ID จากการส่ง State หรือจาก URL (ถ้ามีการปรับ Router ในอนาคต)
  const pj_id = location.state?.pj_id;
  const incomingProject = location.state?.project || null;
  
  // ดึง User เพื่อใช้ใน Sidebar
  const userStr = sessionStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState('');

  // ✅ ระบบแจ้งเตือน (Toast Notification)
  useEffect(() => {
    const msg = sessionStorage.getItem('pm_notification');
    if (msg) {
      setToast(msg);
      sessionStorage.removeItem('pm_notification');
      const timer = setTimeout(() => setToast(''), 4000);
      return () => clearTimeout(timer);
    }
  }, []);

  // ฟังก์ชัน Logout
  const handleLogout = () => {
    if (window.confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
      sessionStorage.clear();
      localStorage.removeItem('token');
      navigate('/login');
    }
  };

  useEffect(() => {
    // 1. ป้องกันหน้าค้าง: ถ้าไม่มี ID ให้ดีดกลับ
    if (!pj_id) {
        alert("ไม่พบรหัสโครงการ กรุณาเลือกโครงการใหม่");
        navigate('/projects');
        return;
    }

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
              project_id: String(pj_id),
              limit: '200',
              offset: '0'
            });

            // ดึงสรุปโครงการ + งานย่อยจาก API ที่มีอยู่จริง
            const [projectsData, projectData, tasksData] = await Promise.all([
                apiRequest('/api/dashboard/project-task-counts'),
                apiRequest(`/api/projects/${pj_id}`),
                apiRequest(`/api/tasks?${params.toString()}`)
            ]);

            const projects = Array.isArray(projectsData) ? projectsData : [];
            const foundProject = projects.find(p => p.project_id === pj_id) || null;
            const resolvedProject = {
              ...(incomingProject || {}),
              ...(foundProject || {}),
              ...(projectData || {}),
              project_id: pj_id,
              project_name:
                projectData?.name ||
                foundProject?.project_name ||
                incomingProject?.project_name ||
                incomingProject?.projectName ||
                'โครงการ',
              project_type:
                projectData?.project_type ||
                foundProject?.project_type ||
                incomingProject?.project_type ||
                incomingProject?.projectType ||
                '-',
              site_address:
                projectData?.site_address ||
                incomingProject?.site_address ||
                incomingProject?.location ||
                '-',
              start_date: projectData?.start_date || incomingProject?.start_date || null,
              end_date: projectData?.end_date || incomingProject?.end_date || null,
              description: projectData?.description || incomingProject?.description || '-'
            };

            setProject(resolvedProject);
            setTasks(Array.isArray(tasksData?.items) ? tasksData.items : []);
            setLoading(false);
        } catch (err) {
            console.error("Error fetching detail:", err);
            setError("ไม่สามารถดึงข้อมูลได้");
            setLoading(false);
        }
    };

    fetchData();
  }, [pj_id, navigate]);

  const formatDate = (date) => {
      if(!date) return '-';
      const d = new Date(date);
      return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()+543}`;
  };

  // Helper สำหรับสี Priority
  const getPriorityColor = (p) => {
      switch(p) {
          case 'ชำนาญงานพิเศษ': return '#e74c3c';
          case 'ชำนาญ': return '#f39c12';
          default: return '#27ae60';
      }
  };

  if (loading) return (
    <div style={{height:'100vh', display:'flex', justifyContent:'center', alignItems:'center', background:'#f0f2f5'}}>
        <div style={{fontSize:'20px', color:'#555'}}>⏳ กำลังโหลดข้อมูล...</div>
    </div>
  );

  if (error) return <div style={{padding:'40px', textAlign:'center', color:'red'}}>{error}</div>;

    return (
        <div className="pm-page">
            {/* ✅ Toast Notification */}
            {toast && (
              <div style={{
                position: 'fixed', top: '30px', left: '50%', transform: 'translateX(-50%)',
                backgroundColor: '#10b981', color: 'white', padding: '12px 24px', borderRadius: '16px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', zIndex: 2000,
                display: 'flex', alignItems: 'center', gap: '12px', fontWeight: '600',
                animation: 'toastIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
              }}>
                <style>{`
                  @keyframes toastIn { from { transform: translate(-50%, -40px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
                `}</style>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"></path></svg>
                {toast}
              </div>
            )}
            <PMTopNav active="projects" user={user} onLogout={handleLogout} />

            <main className="pm-content">
          
          {/* Header & Back Button */}
          <div style={{ marginBottom: '20px' }}>
            <button onClick={() => navigate('/projects')} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '14px', marginBottom: '10px' }}>
                ← กลับหน้ารวมโครงการ
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ color: '#2c3e50', margin: 0 }}>{project.project_name}</h1>
                <button 
                    onClick={() => navigate('/project-tasks', { state: { project } })} 
                    style={{ background: '#e67e22', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(230, 126, 34, 0.3)' }}
                >
                    + สร้างงานย่อย (Task)
                </button>
            </div>
          </div>

          {/* Card 1: Project Overview */}
          <div className="pm-section" style={{ marginBottom: '30px' }}>
            <h3 style={{ borderBottom: '2px solid #f1f2f6', paddingBottom: '15px', marginTop: 0, color: '#34495e' }}>📌 รายละเอียดโครงการ</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                <div>
                    <p style={detailRowStyle}><span style={labelStyle}>ประเภท:</span> {project.project_type || '-'}</p>
                  <p style={detailRowStyle}><span style={labelStyle}>สถานที่:</span> {project.site_address || '-'}</p>
                </div>
                <div>
                    <p style={detailRowStyle}><span style={labelStyle}>ระยะเวลา:</span> {formatDate(project.start_date)} - {formatDate(project.end_date)}</p>
                    <p style={detailRowStyle}><span style={labelStyle}>รายละเอียด:</span> {project.description || '-'}</p>
                </div>
            </div>
          </div>

          {/* Card 2: Task List */}
          <div className="pm-section">
             <h3 style={{ borderBottom: '2px solid #f1f2f6', paddingBottom: '15px', marginTop: 0, color: '#34495e', display:'flex', justifyContent:'space-between' }}>
                📋 รายการงานย่อย (Tasks)
                <span style={{fontSize:'14px', color:'#7f8c8d', fontWeight:'normal'}}>ทั้งหมด {tasks.length} งาน</span>
             </h3>
             
             {tasks.length > 0 ? (
                 <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f8f9fa', color: '#7f8c8d', textAlign: 'left' }}>
                                <th style={{ padding: '12px' }}>ชื่องาน</th>
                                <th style={{ padding: '12px' }}>ความสำคัญ</th>
                                <th style={{ padding: '12px' }}>สถานะ</th>
                                <th style={{ padding: '12px' }}>ผู้รับผิดชอบ</th>
                                <th style={{ padding: '12px' }}>กำหนดส่ง</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tasks.map(task => (
                                <tr key={task.id} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{task.title}</td>
                                    <td style={{ padding: '12px' }}>
                                        <span style={{ color: getPriorityColor(task.priority), fontWeight: 'bold', border: `1px solid ${getPriorityColor(task.priority)}`, padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>
                                            {task.priority || '-'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px' }}>{task.status || '-'}</td>
                                    <td style={{ padding: '12px' }}>{task.assignee_name || '-'}</td>
                                    <td style={{ padding: '12px' }}>{task.due_date ? formatDate(task.due_date) : (task.assigned_at ? formatDate(task.assigned_at) : '-')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
             ) : (
                 <div style={{ textAlign: 'center', padding: '40px', color: '#999', border: '2px dashed #eee', borderRadius: '8px' }}>
                    <p style={{fontSize:'18px'}}>ยังไม่มีงานย่อยในโครงการนี้</p>
                    <button onClick={() => navigate('/project-tasks', { state: { project } })} style={{color:'#3498db', background:'none', border:'none', cursor:'pointer', textDecoration:'underline'}}>
                        สร้างงานย่อยแรกเลย
                    </button>
                 </div>
             )}
          </div>

            </main>
        </div>
    );
};

const labelStyle = { color: '#7f8c8d', fontWeight: 'bold', marginRight: '10px' };
const detailRowStyle = { marginBottom: '12px', fontSize: '15px', color: '#2c3e50' };

export default ProjectDetail;
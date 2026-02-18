import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockUser } from '../../mock/mockData';
import './Dashboard.css';
import { apiRequest } from '../../utils/api';

const TaskSummary = () => {
  const navigate = useNavigate();
  const [allProjects, setAllProjects] = useState([]);
  const user = { ...mockUser, role: 'Project Manager' };

  // ✅ ดึงข้อมูลงานทั้งหมด
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await apiRequest('/api/pm/projects');
        setAllProjects(Array.isArray(data) ? data : []);
      } catch (err) {
         console.error("Error fetching projects:", err);
      }
    };
    fetchProjects();
  }, []);

  return (
    <div className="dash-layout" style={{ background: '#f8fafc', minHeight: '100vh' }}>
      <aside className="dash-sidebar" style={{ boxShadow: '2px 0 10px rgba(0,0,0,0.05)', background: '#ffffff' }}>
        <nav className="menu">
          <button className="menu-item" onClick={() => navigate('/pm')}>Dashboard</button>
          <button className="menu-item active" style={{ background: '#3498db', color: 'white' }}>Tasks</button>
          <button className="menu-item" onClick={() => navigate('/projects')}>Projects</button>
        </nav>
      </aside>

      <main className="dash-main" style={{ width: '100%', marginLeft: 0 }}>
        <div style={{ padding: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
            <div>
              <h2 style={{ margin: 0, color: '#1e293b', fontSize: '28px', fontWeight: '800' }}>📋 ภาพรวมภารกิจและการมอบหมาย</h2>
              <p style={{ color: '#64748b', marginTop: '5px' }}>ติดตามสถานะโครงการและทีมช่างที่ได้รับมอบหมาย</p>
            </div>
            <button 
              onClick={() => navigate('/project-tasks')} 
              style={{ background: '#10b981', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '50px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)' }}
            >
              + สร้างโครงการใหม่
            </button>
          </div>

          {allProjects.length > 0 ? allProjects.map((project, pIdx) => (
            <div key={pIdx} style={{ marginBottom: '40px', background: 'white', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)', border: '1px solid #e2e8f0' }}>
              
              {/* ✅ หัวข้อโครงการหลัก และปุ่มเพิ่มงานย่อย */}
              <div style={{ background: '#1e293b', color: 'white', padding: '20px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: '20px' }}>🏢 โครงการ: {project.projectName}</strong>
                  <div style={{ fontSize: '13px', opacity: 0.8, marginTop: '4px' }}>{project.projectType} | {project.location}</div>
                </div>
                <button 
                  onClick={() => navigate('/project-tasks', { state: { project: project } })}
                  style={{ background: '#3498db', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}
                >
                  + เพิ่มงานย่อยในโครงการนี้
                </button>
              </div>

              {/* รายการงานย่อย */}
              <div style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {project.tasks && project.tasks.length > 0 ? project.tasks.map((task, tIdx) => (
                  <div key={tIdx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '18px', overflow: 'hidden' }}>
                    <div style={{ background: '#ffffff', padding: '15px 25px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#334155' }}>{tIdx + 1}. {task.taskName} ({task.taskType})</strong>
                      <span style={{ padding: '4px 12px', background: '#fef3c7', color: '#92400e', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                        เงื่อนไข: {task.milpCondition}
                      </span>
                    </div>
                    <div style={{ padding: '20px 25px', display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '30px' }}>
                      <div>
                        <h4 style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase' }}>รายละเอียดงาน:</h4>
                        <p style={{ fontSize: '14px', color: '#475569', lineHeight: '1.6' }}>{task.taskDetail}</p>
                      </div>
                      <div>
                        <h4 style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '12px', textTransform: 'uppercase' }}>ทีมช่างปฏิบัติการ ({task.assigned_workers?.length} คน):</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          {task.assigned_workers?.map((w, i) => (
                            <div key={i} style={{ padding: '12px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                              <span style={{ fontSize: '13px', color: '#1e293b' }}><strong>{w.name}</strong></span>
                              <span style={{ color: '#3498db', fontWeight: 'bold', fontSize: '12px' }}>Lv.{w.level}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: '18px' }}>
                    <p>ยังไม่มีงานย่อยถูกมอบหมายในโครงการนี้</p>
                    <button 
                      onClick={() => navigate('/project-tasks', { state: { project: project } })}
                      style={{ color: '#3498db', background: 'none', border: 'none', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      คลิกเพื่อเพิ่มงานย่อยแรก
                    </button>
                  </div>
                )}
              </div>
            </div>
          )) : (
            <div style={{ textAlign: 'center', padding: '100px', background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
              <p style={{ fontSize: '18px', color: '#94a3b8' }}>ยังไม่พบข้อมูลโครงการในระบบ</p>
              <button onClick={() => navigate('/project-tasks')} style={{ marginTop: '20px', color: '#3498db', fontWeight: 'bold', cursor: 'pointer', background: 'none', border: 'none' }}>เริ่มสร้างโครงการแรก ➝</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default TaskSummary;
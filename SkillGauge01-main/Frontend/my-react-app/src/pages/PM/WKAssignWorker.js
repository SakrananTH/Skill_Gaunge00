import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { mockUser } from '../../mock/mockData';
import '../pm/WKDashboard.css';
import './PMTheme.css';
import PMTopNav from './PMTopNav';
import { apiRequest } from '../../utils/api';
import { performLogout } from '../../utils/logout';

const WKAssignWorker = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const { job, user: navUser, selectedWorker: workerFromState, mode } = location.state || { job: {}, user: {} };
  const user = navUser || { ...mockUser, role: 'Project Manager' };

  // ฟังก์ชัน Logout สำหรับ Sidebar
  const handleLogout = () => {
    if (window.confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
      performLogout(navigate);
    }
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const workerCategoryToTaskType = {
    'ช่างโครงสร้าง': 'งานโครงสร้าง',
    'ช่างไฟฟ้า': 'งานไฟฟ้า',
    'ช่างประปา': 'งานประปา',
    'ช่างหลังคา': 'งานหลังคา',
    'ช่างกระเบื้อง': 'งานกระเบื้อง',
    'ช่างก่ออิฐฉาบปูน': 'งานก่ออิฐฉาบปูน',
    'ช่างประตูหน้าต่างอลูมิเนียม': 'งานประตูหน้าต่างอลูมิเนียม',
    'ช่างฝ้าเพดาน': 'งานฝ้าเพดาน'
  };

  const resolveTaskType = (value) => workerCategoryToTaskType[value] || value;

  // ✅ ถ้าส่งช่างมาจากหน้า Dashboard ให้เลือกอัตโนมัติ
  useEffect(() => {
    if (workerFromState) {
      setSelectedWorkers([workerFromState]);
    }
  }, [workerFromState]);

  useEffect(() => {
    const loadWorkers = async () => {
      setLoadingWorkers(true);
      try {
        const data = await apiRequest('/api/admin/workers');
        const items = Array.isArray(data?.items) ? data.items : data;
        const mapped = (Array.isArray(items) ? items : []).map(w => {
          const scoreValue = w?.assessmentTotalScore ?? w?.score ?? w?.exam_score ?? null;
          const totalQuestionsValue = w?.assessmentTotalQuestions ?? w?.total_questions ?? null;
          const theoryPercent = totalQuestionsValue > 0
            ? (scoreValue / totalQuestionsValue) * 100
            : null;

          let levelValue = '-';
          if (theoryPercent != null) {
            if (theoryPercent >= 90) levelValue = 3;
            else if (theoryPercent >= 80) levelValue = 2;
            else if (theoryPercent >= 60) levelValue = 1;
            else levelValue = 0;
          }

          const skillLabel = w?.category || w?.skill || w?.trade_type || '';
          const taskType = resolveTaskType(skillLabel);

          return {
            id: w?.id ?? w?.worker_id,
            name: w?.name || w?.full_name || 'ไม่ระบุ',
            skill_type: taskType,
            age: w?.age ?? '-',
            experience_years: w?.experience_years ?? '-',
            level: levelValue
          };
        });
        setWorkers(mapped);
      } catch (error) {
        console.error(error);
        setWorkers([]);
      } finally {
        setLoadingWorkers(false);
      }
    };

    loadWorkers();
  }, []);

  // ✅ จำนวนช่างที่ต้องการจาก Step 2
  const requiredCount = parseInt(job.requiredWorkers) || 1;
  const requiredLevel = parseInt(job.requiredLevel) || 1;

  // ✅ กรองช่างตามประเภทงาน และระดับฝีมือที่ต้องการ
  const filteredWorkers = workers.filter(w => {
    const isMatchType = w.skill_type === job.taskType;
    const isMatchLevel = (w.level === 3 || w.level >= requiredLevel); // Lv.3 ทำได้ทุกงาน, หรือ Level ตรงตามที่ขอ
    const isMatchSearch = w.name.toLowerCase().includes(searchTerm.toLowerCase());
    return isMatchType && isMatchLevel && isMatchSearch;
  });

  const toggleSelectWorker = (worker) => {
    if (mode === 'assessment' && workerFromState) return; // ล็อคไว้ถ้าเป็นการประเมินรายคน

    const isAlreadySelected = selectedWorkers.find(w => w.id === worker.id);
    if (isAlreadySelected) {
      setSelectedWorkers(selectedWorkers.filter(w => w.id !== worker.id));
    } else {
      if (selectedWorkers.length < requiredCount) {
        setSelectedWorkers([...selectedWorkers, worker]);
      } else {
        alert(`คุณระบุไว้ว่าต้องการช่างแค่ ${requiredCount} คน`);
      }
    }
  };

  const handleConfirmAssignment = async () => {
    if (selectedWorkers.length < requiredCount) {
      alert(`กรุณาเลือกช่างให้ครบ ${requiredCount} คน`);
      return;
    }
    if (!job.project_id) {
      alert('ไม่พบรหัสโครงการ กรุณาเลือกโครงการใหม่');
      return;
    }
    const priorityMap = {
      'ทั่วไป': 'medium',
      'เร่งด่วน': 'high',
      'วิกฤต': 'high'
    };

    const payload = {
      title: job.taskName,
      project_id: job.project_id,
      priority: priorityMap[job.milpCondition] || 'medium',
      status: 'todo',
      worker_ids: selectedWorkers.map(w => w.id),
      assignment_type: mode === 'assessment' ? 'practical_assessment' : 'general',
      description: job.taskDetail,
      category: job.taskType,
      required_level: parseInt(job.requiredLevel) || 1,
      required_workers: parseInt(job.requiredWorkers) || 1
    };

    try {
      await apiRequest('/api/tasks', {
        method: 'POST',
        body: payload
      });

      setToast(`มอบหมายงาน "${job.taskName}" สำเร็จ!`);
      sessionStorage.setItem('pm_notification', `มอบหมายงาน "${job.taskName}" ให้ช่าง ${selectedWorkers.length} คน เรียบร้อยแล้ว!`);
      setTimeout(() => {
        navigate('/projects');
      }, 1200);
    } catch (error) {
      console.error(error);
      setToast(`❌ มอบหมายงานไม่สำเร็จ: ${error?.data?.message || 'เกิดข้อผิดพลาด'}`);
    }
  };

  const colName = { flex: 2 };
  const colSkill = { flex: 1.5 };
  const colInfo = { flex: 1.5 };
  const colLevel = { flex: 1 };
  const colAction = { flex: 1.2, textAlign: 'center' };

  return (
    <div className="pm-page">
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: '30px', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: toast.includes('❌') ? '#ef4444' : '#10b981', color: 'white', padding: '12px 24px', borderRadius: '16px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', zIndex: 2000,
          display: 'flex', alignItems: 'center', gap: '12px', fontWeight: '600',
          animation: 'toastIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}>
          <style>{`@keyframes toastIn { from { transform: translate(-50%, -40px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }`}</style>
          {!toast.includes('❌') && <i className='bx bx-check-circle' style={{ fontSize: '20px' }}></i>}
          {toast}
        </div>
      )}

      <PMTopNav active="projects" user={user} onLogout={handleLogout} />

      <main className="pm-content">
        <div className="pm-section" style={{ position: 'relative', minHeight: '80vh', background: 'white', padding: '40px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
            
            {/* ✅ ปุ่มย้อนกลับไปแก้ไขรายละเอียดงาน */}
            <div style={{ marginBottom: '15px' }}>
              <button 
                onClick={() => navigate('/project-tasks', { state: { project: job, user } })} 
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '500' }}
              >
                ← ย้อนกลับไปแก้ไขรายละเอียดงาน
              </button>
            </div>
            
            <header style={{ 
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', 
              color: 'white', 
              padding: '30px 40px', 
              borderRadius: '20px', 
              marginBottom: '30px',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
            }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>
                <i className='bx bx-user-plus' style={{ marginRight: '10px' }}></i>
                เลือกช่างสำหรับ: {job.taskName}
              </h2>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginTop: '15px', flexWrap: 'wrap' }}>
                <div style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', fontSize: '14px' }}>
                    <i className='bx bx-wrench'></i> หมวด: <strong>{job.taskType}</strong>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', fontSize: '14px' }}>
                    <i className='bx bx-trending-up'></i> ขั้นต่ำ: <strong>Lv.{requiredLevel}</strong>
                </div>
                <div style={{ 
                  background: selectedWorkers.length === requiredCount ? '#10b981' : '#f59e0b', 
                  color: 'white', 
                  padding: '6px 16px', 
                  borderRadius: '12px', 
                  fontSize: '14px', 
                  fontWeight: '700',
                  transition: 'all 0.3s'
                }}>
                    <i className='bx bx-group'></i> เลือกแล้ว: {selectedWorkers.length} / {requiredCount} คน
                </div>
              </div>
            </header>

            <div style={{ position: 'relative', marginBottom: '25px' }}>
              <i className='bx bx-search' style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '20px' }}></i>
              <input 
                type="text" 
                placeholder="ค้นหาชื่อช่าง..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '14px 14px 14px 45px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '15px', background: '#f8fafc' }}
              />
            </div>

            {loadingWorkers && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>กำลังโหลดรายชื่อช่าง...</div>
            )}

            <div className="table" style={{ border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', marginBottom: '100px' }}>
              <div className="thead" style={{ display: 'flex', background: '#f8fafc', padding: '18px 24px', fontWeight: '700', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '14px' }}>
                <div style={colName}>ชื่อช่าง</div>
                <div style={colSkill}>ทักษะ</div>
                <div style={colInfo}>อายุ/ประสบการณ์</div>
                <div style={colLevel}>ระดับ</div>
                <div style={colAction}>เลือกช่าง</div>
              </div>
              <div className="tbody" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                {filteredWorkers.length > 0 ? filteredWorkers.map(w => {
                  const isSelected = selectedWorkers.find(sw => sw.id === w.id);
                  return (
                    <div key={w.id} style={{ 
                      display: 'flex', 
                      padding: '18px 24px', 
                      borderBottom: '1px solid #f1f5f9', 
                      alignItems: 'center',
                      background: isSelected ? '#f0fdf4' : 'transparent',
                      transition: 'background 0.2s'
                    }}>
                      <div style={colName}><div style={{ fontWeight: '700', color: '#1e293b' }}>{w.name}</div></div>
                      <div style={colSkill}><span style={{ fontSize: '13px', color: '#64748b', background: '#f1f5f9', padding: '4px 10px', borderRadius: '8px' }}>{w.skill_type}</span></div>
                      <div style={colInfo}><span style={{ color: '#475569', fontSize: '14px' }}>{w.age} ปี / {w.experience_years} ปี</span></div>
                      <div style={colLevel}>
                        <span style={{ 
                          fontWeight: '800', 
                          color: w.level >= 3 ? '#10b981' : (w.level >= 2 ? '#3b82f6' : '#f59e0b') 
                        }}>Lv. {w.level}</span>
                      </div>
                      <div style={colAction}>
                        <button 
                          onClick={() => toggleSelectWorker(w)}
                          style={{ 
                            background: isSelected ? '#ef4444' : (selectedWorkers.length >= requiredCount ? '#f1f5f9' : '#10b981'), 
                            color: isSelected || selectedWorkers.length < requiredCount ? 'white' : '#bdc3c7', 
                            border: 'none', padding: '8px 20px', borderRadius: '20px', cursor: 'pointer' 
                          }}
                        >
                          {isSelected ? 'ยกเลิก' : 'เลือกคนนี้'}
                        </button>
                      </div>
                    </div>
                  );
                }) : (
                  <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                    <i className='bx bx-user-x' style={{ fontSize: '48px', opacity: 0.5 }}></i>
                    <p>ไม่พบรายชื่อช่างที่ตรงตามเงื่อนไข</p>
                  </div>
                )}
              </div>
            </div>

            {/* ✅ ย้ายปุ่มยืนยันมาไว้ล่างขวาสุดของ Panel */}
            <div style={{ position: 'absolute', bottom: '30px', right: '30px', display: 'flex', gap: '15px' }}>
              <button 
                onClick={() => navigate('/project-tasks', { state: { project: job, user } })}
                style={{ 
                  background: '#f1f5f9', 
                  color: '#475569', 
                  padding: '12px 30px', 
                  borderRadius: '16px', 
                  border: '1px solid #cbd5e1', 
                  fontWeight: '700', 
                  fontSize: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#e2e8f0'}
                onMouseOut={(e) => e.currentTarget.style.background = '#f1f5f9'}
              >
                ย้อนกลับ
              </button>
              <button 
                onClick={handleConfirmAssignment} 
                style={{ 
                  background: selectedWorkers.length === requiredCount ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#cbd5e1', 
                  color: 'white', 
                  padding: '12px 40px', 
                  borderRadius: '16px', 
                  border: 'none', 
                  fontWeight: '700', 
                  fontSize: '16px',
                  cursor: selectedWorkers.length === requiredCount ? 'pointer' : 'not-allowed',
                  boxShadow: selectedWorkers.length === requiredCount ? '0 8px 15px rgba(16, 185, 129, 0.25)' : 'none',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                ยืนยันการมอบหมายงาน <i className='bx bx-check-double' style={{ fontSize: '22px' }}></i>
              </button>
            </div>

        </div>
      </main>
    </div>
  );
};

export default WKAssignWorker;
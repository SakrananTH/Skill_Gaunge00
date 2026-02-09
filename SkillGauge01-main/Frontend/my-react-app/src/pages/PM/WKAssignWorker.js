import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { mockUser } from '../../mock/mockData';
import '../pm/WKDashboard.css';
import './PMTheme.css';
import PMTopNav from './PMTopNav';

const WKAssignWorker = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const { job, user: navUser, selectedWorker: workerFromState, mode } = location.state || { job: {}, user: {} };
  const user = navUser || { ...mockUser, role: 'Project Manager' };
  const API = process.env.REACT_APP_API_URL || 'http://localhost:4000';

  // ฟังก์ชัน Logout สำหรับ Sidebar
  const handleLogout = () => {
    if (window.confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
      sessionStorage.clear();
      navigate('/login');
    }
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);

  const workerCategoryToTaskType = {
    'ช่างโครงสร้าง': 'งานโครงสร้าง',
    'ช่างไฟฟ้า': 'งานไฟฟ้า',
    'ช่างประปา': 'งานประปา',
    'ช่างหลังคา': 'งานหลังคา',
    'ช่างกระเบื้อง': 'งานกระเบื้อง',
    'ช่างก่ออิฐฉาบปูน': 'งานก่ออิฐฉาบปูน'
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
        const token = sessionStorage.getItem('auth_token');
        const res = await fetch(`${API}/api/admin/workers`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        });
        if (res.ok) {
          const data = await res.json();
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
        } else {
          setWorkers([]);
        }
      } catch (error) {
        console.error(error);
        setWorkers([]);
      } finally {
        setLoadingWorkers(false);
      }
    };

    loadWorkers();
  }, [API]);

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
      const token = sessionStorage.getItem('auth_token');
      const res = await fetch(`${API}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        alert(`มอบหมายงานไม่สำเร็จ: ${errorData.message || 'เกิดข้อผิดพลาด'}`);
        return;
      }

      sessionStorage.setItem('pm_notification', `มอบหมายงาน "${job.taskName}" ให้ช่าง ${selectedWorkers.length} คน เรียบร้อยแล้ว!`);
      navigate('/projects');
    } catch (error) {
      console.error(error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const colName = { flex: 2 };
  const colSkill = { flex: 1.5 };
  const colInfo = { flex: 1.5 };
  const colLevel = { flex: 1 };
  const colAction = { flex: 1.2, textAlign: 'center' };

  return (
    <div className="pm-page">
      <PMTopNav active="tasks" user={user} onLogout={handleLogout} />

      <main className="pm-content">
        <div className="pm-section" style={{ position: 'relative', minHeight: '80vh' }}>
            
            {/* ✅ ปุ่มย้อนกลับไปแก้ไขรายละเอียดงาน */}
            <div style={{ marginBottom: '15px' }}>
              <button 
                onClick={() => navigate('/project-tasks', { state: { project: job, user } })} 
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '500' }}
              >
                ← ย้อนกลับไปแก้ไขรายละเอียดงาน
              </button>
            </div>
            
            <header style={{ marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>เลือกช่างสำหรับ: {job.taskName}</h2>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginTop: '10px' }}>
                <span className="pill" style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }}>
                    หมวด: {job.taskType}
                </span>
                <span className="pill" style={{ background: '#f3e8ff', color: '#7e22ce', border: '1px solid #d8b4fe' }}>
                    ขั้นต่ำ: Lv.{requiredLevel}
                </span>
                <span style={{ color: selectedWorkers.length >= requiredCount ? '#16a34a' : '#d97706', fontWeight: 'bold' }}>
                    สถานะการเลือก: {selectedWorkers.length} / {requiredCount} คน
                </span>
              </div>
            </header>

            <input 
              type="text" 
              placeholder="🔍 ค้นหาชื่อช่าง..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '20px' }}
            />

            {loadingWorkers && (
              <div style={{ marginBottom: '15px', color: '#64748b', fontSize: '14px' }}>
                กำลังโหลดรายชื่อช่าง...
              </div>
            )}

            <div className="table" style={{ border: '1px solid #eee', borderRadius: '10px', overflow: 'hidden', marginBottom: '80px' }}>
              <div className="thead" style={{ display: 'flex', background: '#f8f9fa', padding: '15px', fontWeight: 'bold', borderBottom: '2px solid #eee' }}>
                <div style={colName}>ชื่อช่าง</div>
                <div style={colSkill}>ทักษะ</div>
                <div style={colInfo}>อายุ/ประสบการณ์</div>
                <div style={colLevel}>ระดับ</div>
                <div style={colAction}>เลือกช่าง</div>
              </div>
              <div className="tbody" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                {filteredWorkers.map(w => {
                  const isSelected = selectedWorkers.find(sw => sw.id === w.id);
                  return (
                    <div key={w.id} style={{ display: 'flex', padding: '15px', borderBottom: '1px solid #f1f1f1', alignItems: 'center' }}>
                      <div style={colName}><strong>{w.name}</strong></div>
                      <div style={colSkill}>{w.skill_type}</div>
                      <div style={colInfo}>{w.age} ปี / {w.experience_years} ปี</div>
                      <div style={colLevel}>Lv. {w.level}</div>
                      <div style={colAction}>
                        <button 
                          onClick={() => toggleSelectWorker(w)}
                          style={{ 
                            background: isSelected ? '#e74c3c' : (selectedWorkers.length >= requiredCount ? '#ecf0f1' : '#27ae60'), 
                            color: isSelected || selectedWorkers.length < requiredCount ? 'white' : '#bdc3c7', 
                            border: 'none', padding: '8px 20px', borderRadius: '20px', cursor: 'pointer' 
                          }}
                        >
                          {isSelected ? 'ยกเลิก' : 'เลือกคนนี้'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ✅ ย้ายปุ่มยืนยันมาไว้ล่างขวาสุดของ Panel */}
            <div style={{ position: 'absolute', bottom: '30px', right: '30px', display: 'flex', gap: '15px' }}>
              <button 
                onClick={() => navigate('/project-tasks', { state: { project: job, user } })}
                style={{ 
                  background: '#f1f5f9', 
                  color: '#475569', 
                  padding: '15px 30px', 
                  borderRadius: '30px', 
                  border: '1px solid #cbd5e1', 
                  fontWeight: 'bold', 
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
                  background: selectedWorkers.length === requiredCount ? '#27ae60' : '#bdc3c7', 
                  color: 'white', 
                  padding: '15px 40px', 
                  borderRadius: '30px', 
                  border: 'none', 
                  fontWeight: 'bold', 
                  fontSize: '16px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                  transition: 'all 0.3s'
                }}
              >
                ยืนยันการมอบหมายงาน ➝
              </button>
            </div>

        </div>
      </main>
    </div>
  );
};

export default WKAssignWorker;
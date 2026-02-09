import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { mockUser } from '../../mock/mockData';
import '../pm/WKDashboard.css';
import './PMTheme.css';
import PMTopNav from './PMTopNav';

const WKProjectTasks = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // ✅ จุดสำคัญ: รับข้อมูลโครงการที่ส่งมาจากหน้า Projects (TaskSummary)
  const { project: incomingProject, selectedWorker, mode } = location.state || {};
  const user = location.state?.user || { ...mockUser, role: 'Project Manager', name: 'สมชาย ใจดี' };
  const API = process.env.REACT_APP_API_URL || 'http://localhost:4000';
  const [availableCounts, setAvailableCounts] = useState({});
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [errors, setErrors] = useState({});
  const [shakeKey, setShakeKey] = useState(0);

  const workerCategoryToTaskType = {
    'ช่างโครงสร้าง': 'งานโครงสร้าง',
    'ช่างไฟฟ้า': 'งานไฟฟ้า',
    'ช่างประปา': 'งานประปา',
    'ช่างหลังคา': 'งานหลังคา',
    'ช่างกระเบื้อง': 'งานกระเบื้อง',
    'ช่างก่ออิฐฉาบปูน': 'งานก่ออิฐฉาบปูน'
  };

  const resolveTaskType = (value) => workerCategoryToTaskType[value] || value;
  
  // ✅ ฟังก์ชันเล่นเสียง Beep เมื่อเกิด Error
  const playErrorBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) { console.warn("Audio context error:", e); }
  };

  // ฟังก์ชัน Logout สำหรับ Sidebar
  const handleLogout = () => {
    if (window.confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
      sessionStorage.clear();
      navigate('/login');
    }
  };

  // ✅ ข้อมูลงานย่อย (ล้างค่าว่างเสมอเพื่อรอรับงานใหม่)

  const [taskForm, setTaskForm] = useState({
    taskName: mode === 'assessment' ? `แบบฝึกภาคปฏิบัติ: ${selectedWorker?.name || ''}` : (incomingProject?.taskName || ''),
    taskType: resolveTaskType(selectedWorker?.skill) || incomingProject?.taskType || 'งานโครงสร้าง',
    milpCondition: incomingProject?.milpCondition || 'ทั่วไป',
    requiredWorkers: mode === 'assessment' ? '1' : (incomingProject?.requiredWorkers || '1'),
    requiredLevel: incomingProject?.requiredLevel || '1', // ✅ เพิ่ม Field ระดับฝีมือ
    taskDetail: mode === 'assessment' ? `งานทดสอบทักษะภาคปฏิบัติสำหรับ ${selectedWorker?.name} เพื่อประเมินระดับฝีมือ` : (incomingProject?.taskDetail || ''),         
  });

  const [availableWorkerList, setAvailableWorkerList] = useState([]); // ✅ เก็บรายชื่อช่างทั้งหมดเพื่อนำมาคำนวณจำนวนว่าง

  // ✅ ดึงข้อมูลจำนวนช่างที่ว่างแยกตามประเภทงาน
  useEffect(() => {
    const fetchAvailableWorkers = async () => {
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
          
          // ✅ Normalize Worker Data และคำนวณ Level
          const processedWorkers = (Array.isArray(items) ? items : []).map(w => {
            const scoreValue = w?.assessmentTotalScore ?? w?.score ?? w?.exam_score ?? null;
            const totalQuestionsValue = w?.assessmentTotalQuestions ?? w?.total_questions ?? null;
            const theoryPercent = totalQuestionsValue > 0 ? (scoreValue / totalQuestionsValue) * 100 : 0;
            
            let level = 0;
            if (theoryPercent >= 90) level = 3;
            else if (theoryPercent >= 80) level = 2;
            else if (theoryPercent >= 60) level = 1;

            const foremanPercent = w?.foremanAssessmentPercent ?? null;
            const hasForemanAssessment = w?.foremanAssessed === true || w?.foremanAssessmentTotalScore != null || foremanPercent != null;
            
            let status = 'ยังไม่ได้ทำข้อสอบ';
            if (hasForemanAssessment) status = 'ประเมินแล้ว';
            else if (scoreValue != null || w?.assessmentPassed === true || theoryPercent >= 60) status = 'รอการประเมิน';

            return {
              ...w,
              skillType: resolveTaskType(w?.category || w?.skill || w?.trade_type || ''),
              level,
              status
            };
          });

          setAvailableWorkerList(processedWorkers.filter(w => w.status === 'รอการประเมิน')); // เก็บเฉพาะคนที่พร้อมรับงาน (รอประเมินภาคปฏิบัติ)
        }
      } catch (e) { console.error(e); }
    };
    fetchAvailableWorkers();
  }, []);

  // ✅ คำนวณจำนวนช่างที่ว่าง ตามประเภทและระดับที่เลือก
  const availableCount = availableWorkerList.filter(w => 
    w.skillType === taskForm.taskType && w.level >= parseInt(taskForm.requiredLevel)
  ).length;

  // ✅ ดึงรายชื่อโครงการทั้งหมด (กรณีต้องเลือกโครงการใหม่เพื่อประเมิน)
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const token = sessionStorage.getItem('auth_token');
        const res = await fetch(`${API}/api/dashboard/project-task-counts`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        });
        if (res.ok) {
          const data = await res.json();
          setProjects(Array.isArray(data) ? data : []);
          const incomingProjectId = incomingProject?.project_id || incomingProject?.id || incomingProject?.pj_id;
          const incomingProjectName = incomingProject?.project_name || incomingProject?.projectName || incomingProject?.name;
          if (incomingProjectId) {
            setSelectedProjectId(incomingProjectId);
          } else if (incomingProjectName) {
            const match = (Array.isArray(data) ? data : []).find(p => p.project_name === incomingProjectName);
            setSelectedProjectId(match?.project_id || '');
          }
        } else {
          setProjects([]);
        }
      } catch (error) {
        console.error(error);
        setProjects([]);
      }
    };
    loadProjects();
  }, [incomingProject]);

  // ดักฟัง: ถ้าไม่มีข้อมูลโครงการส่งมาให้ดีดกลับหน้าลิสต์โครงการทันที (กันคนกดเข้าหน้าตรงๆ)
  useEffect(() => {
    if (!incomingProject && mode !== 'assessment') {
      alert("กรุณาเลือกโครงการก่อนเพิ่มงานย่อย");
      navigate('/projects');
    }
  }, [incomingProject, mode, navigate]);

  const handleTaskChange = (e) => {
    const { name, value } = e.target;
    setTaskForm({ ...taskForm, [name]: value });
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmitToAssign = (e) => {
    e.preventDefault();
    const newErrors = {};
    
    // ✅ ตรวจสอบจำนวนช่างที่ต้องการเทียบกับช่างที่ว่างอยู่
    const available = availableCount;
    const requested = parseInt(taskForm.requiredWorkers);

    if (requested > available) {
      newErrors.requiredWorkers = `มีช่างสาย "${taskForm.taskType}" (Lv.${taskForm.requiredLevel}+) ว่างเพียง ${available} คน`;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setShakeKey(prev => prev + 1); // กระตุ้นการเขย่า
      playErrorBeep(); // ✅ เล่นเสียงแจ้งเตือน
      return;
    }

    const finalProject = incomingProject || projects.find(p => p.project_id === selectedProjectId || p.project_name === selectedProjectId);
    if (!finalProject) { alert('กรุณาเลือกโครงการที่ต้องการมอบหมายงาน'); return; }

    const projectPayload = {
      project_id: finalProject.project_id || finalProject.id || finalProject.pj_id || selectedProjectId,
      project_name: finalProject.project_name || finalProject.projectName || finalProject.name || ''
    };

    // ✅ ส่งข้อมูล "โครงการเดิม" + "งานย่อยใหม่" ไปหน้าเลือกช่าง
    navigate('/assign-worker', { 
      state: { 
        job: { ...finalProject, ...projectPayload, ...taskForm }, 
        user,
        selectedWorker,
        mode
      } 
    });
  };

  return (
    <div className="pm-page">
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          50% { transform: translateX(6px); }
          75% { transform: translateX(-6px); }
        }
      `}</style>
      <PMTopNav active="tasks" user={user} onLogout={handleLogout} />

      <main className="pm-content">
          {/* ✅ ปุ่มย้อนกลับด้านบน */}
          <div style={{ marginBottom: '15px' }}>
            <button 
              onClick={() => navigate(-1)} 
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '500' }}
            >
              ← ย้อนกลับ
            </button>
          </div>

          {/* ✅ เลเยอร์หัวข้อ: แสดงชื่อโครงการที่กำลังเพิ่มงานให้ (สีน้ำเงินเข้ม) */}
          <header style={{ marginBottom: '30px' }}>
            <div style={{ background: '#1e293b', color: 'white', padding: '25px 35px', borderRadius: '20px', boxShadow: '0 10px 15px rgba(0,0,0,0.1)' }}>
              {mode === 'assessment' ? (
                <>
                  <h2 style={{ margin: 0, fontSize: '24px' }}>🎯 มอบหมายงานประเมินภาคปฏิบัติ</h2>
                  <p style={{ opacity: 0.8, marginTop: '8px', fontSize: '14px' }}>สำหรับช่าง: {selectedWorker?.name} ({selectedWorker?.skill})</p>
                  <div style={{ marginTop: '15px' }}>
                    <label style={{ fontSize: '13px', display: 'block', marginBottom: '5px' }}>เลือกโครงการที่จะใช้ประเมิน:</label>
                    <select 
                      value={selectedProjectId} 
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      style={{ padding: '8px', borderRadius: '8px', width: '100%', maxWidth: '400px', color: '#1e293b' }}
                    >
                      <option value="">-- เลือกโครงการ --</option>
                      {projects.map((p) => <option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <h2 style={{ margin: 0, fontSize: '24px' }}>🏗️ เพิ่มภารกิจย่อยในโครงการ: {incomingProject?.project_name || incomingProject?.projectName}</h2>
                  <p style={{ opacity: 0.8, marginTop: '8px', fontSize: '14px' }}>
                    ประเภท: {incomingProject?.projectType} | สถานที่: {incomingProject?.location || incomingProject?.locationDetail}
                  </p>
                </>
              )}
            </div>
          </header>

          <form onSubmit={handleSubmitToAssign}>
            {/* ✅ เลเยอร์ฟอร์ม: สีขาวมนๆ พร้อม Shadow นุ่มๆ */}
            <section className="pm-section">
              <h3 style={{ color: '#1e293b', marginBottom: '25px', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>รายละเอียดภารกิจใหม่</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                
                {/* ✅ แถวที่ 1: ชื่อภารกิจ และ ประเภทงานช่าง (อยู่คู่กัน) */}
                <div>
                  <label style={labelStyle}>ชื่องานย่อย</label>
                  <input 
                    className="input" 
                    name="taskName" 
                    placeholder="เช่น งานเดินสายไฟห้องน้ำ" 
                    value={taskForm.taskName} 
                    onChange={handleTaskChange} 
                    required 
                    style={inputStyle} 
                  />
                </div>

                <div>
                  <label style={labelStyle}>ประเภทสายงานช่าง</label>
                  <select className="select" name="taskType" value={taskForm.taskType} onChange={handleTaskChange} style={inputStyle}>
                    <option value="งานโครงสร้าง">งานโครงสร้าง</option>
                    <option value="งานไฟฟ้า">งานไฟฟ้า</option>
                    <option value="งานประปา">งานประปา</option>
                    <option value="งานสี">งานสี</option>
                    <option value="งานกระเบื้อง">งานกระเบื้อง</option>
                    <option value="งานหลังคา">งานหลังคา</option>
                  </select>
                </div>

                {/* ✅ แถวที่ 2: เงื่อนไขงาน และ จำนวนช่าง */}
                <div>
                  <label style={labelStyle}>เงื่อนไขงาน (Priority)</label>
                  <select className="select" name="milpCondition" value={taskForm.milpCondition} onChange={handleTaskChange} style={inputStyle}>
                    <option value="ทั่วไป">ทั่วไป (Normal)</option>
                    <option value="เร่งด่วน">เร่งด่วน (Urgent)</option>
                    <option value="วิกฤต">วิกฤต (Critical)</option>
                  </select>
                </div>

                <div>
                   <label style={labelStyle}>ระดับฝีมือขั้นต่ำ (Required Lv.)</label>
                   <select className="select" name="requiredLevel" value={taskForm.requiredLevel} onChange={handleTaskChange} style={inputStyle}>
                     <option value="1">Lv.1 (พื้นฐาน)</option>
                     <option value="2">Lv.2 (ชำนาญการ)</option>
                     <option value="3">Lv.3 (เชี่ยวชาญ)</option>
                   </select>
                </div>

                <div>
                  <label style={labelStyle}>
                    จำนวนช่างที่ต้องการ (คน) 
                    <span style={{ color: '#0284c7', marginLeft: '10px', fontWeight: 'normal', fontSize: '13px' }}>
                      (ว่างอยู่: {availableCount} คน)
                    </span>
                  </label>
                  <input 
                    key={errors.requiredWorkers ? `workers-err-${shakeKey}` : 'workers-ok'}
                    type="number" 
                    className="input" 
                    name="requiredWorkers" 
                    value={taskForm.requiredWorkers} 
                    onChange={handleTaskChange} 
                    min="1" 
                    required 
                    style={{ ...inputStyle, border: errors.requiredWorkers ? '1px solid #ef4444' : '1px solid #cbd5e1', animation: errors.requiredWorkers ? 'shake 0.4s ease-in-out' : 'none' }} 
                  />
                  {errors.requiredWorkers && <span style={errorStyle}>{errors.requiredWorkers}</span>}
                </div>

                {/* ✅ แถวที่ 3: รายละเอียดงานย่อย (Textarea ตัวใหญ่) */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>รายละเอียดและคำสั่งงานปฏิบัติ</label>
                  <textarea 
                    className="input" 
                    name="taskDetail" 
                    placeholder="ระบุรายละเอียดงานที่ต้องการให้ช่างปฏิบัติอย่างละเอียด..." 
                    value={taskForm.taskDetail} 
                    onChange={handleTaskChange} 
                    required 
                    style={{ ...inputStyle, minHeight: '150px', resize: 'vertical' }} 
                  />
                </div>

              </div>

              {/* ปุ่มดำเนินการ - ปรับให้มีปุ่มยกเลิกคู่กับปุ่มบันทึก */}
              <div style={{ marginTop: '40px', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '20px' }}>
                <button 
                  type="button"
                  onClick={() => navigate(-1)}
                  style={{ 
                    background: '#f1f5f9', 
                    color: '#475569', 
                    padding: '16px 60px', 
                    borderRadius: '50px', 
                    border: '1px solid #cbd5e1', 
                    fontWeight: 'bold', 
                    fontSize: '18px', 
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#e2e8f0'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#f1f5f9'}
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" 
                  style={{ 
                    background: '#e67e22', 
                    color: 'white', 
                    padding: '16px 60px', 
                    borderRadius: '50px', 
                    border: 'none', 
                    fontWeight: 'bold', 
                    fontSize: '18px', 
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(230, 126, 34, 0.2)',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#d35400'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#e67e22'}
                >
                  บันทึกภารกิจและไปเลือกช่าง ➝
                </button>
              </div>

            </section>
          </form>
      </main>
    </div>
  );
};

// สไตล์คุมเลเยอร์
const labelStyle = { 
  fontWeight: '700', 
  display: 'block', 
  marginBottom: '10px', 
  color: '#475569', 
  fontSize: '14px' 
};

const inputStyle = { 
  width: '100%', 
  padding: '14px 20px', 
  borderRadius: '12px', 
  border: '1px solid #cbd5e1', 
  boxSizing: 'border-box',
  fontSize: '16px',
  background: '#fcfcfc',
  outline: 'none'
};
const errorStyle = { color: '#ef4444', fontSize: '12px', marginTop: '5px', display: 'block', fontWeight: '500' };

export default WKProjectTasks;
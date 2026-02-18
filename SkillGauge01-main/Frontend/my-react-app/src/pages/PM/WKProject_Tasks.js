import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { mockUser } from '../../mock/mockData';
import '../pm/WKDashboard.css';
import './PMTheme.css';
import './WKProject_Tasks.css';
import PMTopNav from './PMTopNav';
import { apiRequest } from '../../utils/api';
import { performLogout } from '../../utils/logout';

const WKProjectTasks = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // ✅ จุดสำคัญ: รับข้อมูลโครงการที่ส่งมาจากหน้า Projects (TaskSummary)
  const { project: incomingProject, selectedWorker, mode } = location.state || {};
  const user = location.state?.user || { ...mockUser, role: 'ผู้จัดการโครงการ', name: 'สมชาย ใจดี' };
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
    'ช่างก่ออิฐฉาบปูน': 'งานก่ออิฐฉาบปูน',
    'ช่างประตูหน้าต่างอลูมิเนียม': 'งานประตูหน้าต่างอลูมิเนียม',
    'ช่างฝ้าเพดาน': 'งานฝ้าเพดาน'
  };

  const resolveTaskType = (value) => workerCategoryToTaskType[value] || value;
  const resolveProjectTaskType = (project) => {
    const candidate = project?.project_type || project?.taskType || project?.trade_type || '';
    return resolveTaskType(candidate) || 'งานโครงสร้าง';
  };
  
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
      performLogout(navigate);
    }
  };

  // ✅ ข้อมูลงานย่อย (ล้างค่าว่างเสมอเพื่อรอรับงานใหม่)

  const [taskForm, setTaskForm] = useState({
    taskName: mode === 'assessment' ? `แบบฝึกภาคปฏิบัติ: ${selectedWorker?.name || ''}` : (incomingProject?.taskName || ''),
    taskType: resolveTaskType(selectedWorker?.skill) || resolveProjectTaskType(incomingProject),
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
        const data = await apiRequest('/api/admin/workers');
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
        const data = await apiRequest('/api/dashboard/project-task-counts');
        setProjects(Array.isArray(data) ? data : []);
        const incomingProjectId = incomingProject?.project_id || incomingProject?.id || incomingProject?.pj_id;
        const incomingProjectName = incomingProject?.project_name || incomingProject?.projectName || incomingProject?.name;
        if (incomingProjectId) {
          setSelectedProjectId(incomingProjectId);
        } else if (incomingProjectName) {
          const match = (Array.isArray(data) ? data : []).find(p => p.project_name === incomingProjectName);
          setSelectedProjectId(match?.project_id || '');
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
      newErrors.requiredWorkers = `มีช่างสาย "${taskForm.taskType}" (ระดับ ${taskForm.requiredLevel}+) ว่างเพียง ${available} คน`;
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
      <PMTopNav active="projects" user={user} onLogout={handleLogout} />

      <main className="pm-content">
          {/* ✅ ปุ่มย้อนกลับด้านบน */}
          <div className="back-button-container">
            <button 
              onClick={() => navigate(-1)} 
              className="back-button"
            >
              <i className='bx bx-left-arrow-alt' style={{ fontSize: '18px' }}></i> ย้อนกลับ
            </button>
          </div>

          {/* ✅ เลเยอร์หัวข้อ */}
          <header className={`task-header animate-slide-up ${mode === 'assessment' ? 'exam-mode' : 'normal-mode'}`}>
              <div className="header-bg-icon">
                {mode === 'assessment' ? <i className='bx bx-id-card'></i> : <i className='bx bx-briefcase-alt-2'></i>}
              </div>
              
              <div className="header-content-wrapper">
                {mode === 'assessment' ? (
                  <>
                    <div className="header-left">
                      <div className="status-badge">
                        <i className='bx bx-id-card'></i> โหมดการประเมิน
                      </div>
                      <h2 className="header-title">
                        มอบหมายงานประเมินภาคปฏิบัติ
                      </h2>
                      <p className="header-subtitle">
                        ผู้รับการประเมิน: <span className="highlight-name">{selectedWorker?.name}</span>
                        <span className="worker-skill-badge">• {selectedWorker?.skill}</span>
                      </p>
                    </div>
                    
                    <div className="header-right">
                      <div className="project-select-box">
                        <label className="project-select-label">
                          <i className='bx bx-building-house'></i> เลือกโครงการที่จะใช้ประเมิน:
                        </label>
                        <select 
                          value={selectedProjectId} 
                          onChange={(e) => setSelectedProjectId(e.target.value)}
                          className="header-select"
                        >
                          <option value="">-- เลือกโครงการ --</option>
                          {projects.map((p) => <option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
                        </select>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="header-left">
                      <div className="status-badge">
                        <i className='bx bx-briefcase-alt-2'></i> งานใหม่
                      </div>
                      <h2 className="header-title">
                        เพิ่มภารกิจย่อยในโครงการ
                      </h2>
                      <h3 className="header-subtitle project-name">{incomingProject?.project_name || incomingProject?.projectName}</h3>
                    </div>
                    <div className="header-right">
                      <div className="project-info-tags">
                        <div className="info-tag">
                          <i className='bx bx-category'></i> {incomingProject?.projectType}
                        </div>
                        <div className="info-tag">
                          <i className='bx bx-map'></i> {incomingProject?.location || incomingProject?.locationDetail}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
          </header>

          <form onSubmit={handleSubmitToAssign} className="animate-slide-up animate-delay-1">
            {/* ✅ เลเยอร์ฟอร์ม: Modern Card */}
            <section className="modern-card">
              <div className="form-header">
                <h3 className="form-title">
                  <i className='bx bx-edit-alt' style={{ color: '#3b82f6', fontSize: '24px' }}></i>
                  รายละเอียดภารกิจ
                </h3>
                <span className="form-subtitle">กรุณาระบุข้อมูลงานให้ชัดเจนเพื่อให้ผู้รับงานเข้าใจวัตถุประสงค์</span>
              </div>
              
              <div className="form-grid">
                
                {/* ✅ แถวที่ 1 */}
                <div>
                  <label className="form-label">
                    <i className='bx bx-task' style={{ color: '#3b82f6' }}></i> ชื่องานย่อย <span className="required-mark">*</span>
                  </label>
                  <input 
                    className="modern-input" 
                    name="taskName" 
                    placeholder="ระบุชื่องาน เช่น เดินสายไฟห้องน้ำชั้น 1" 
                    value={taskForm.taskName} 
                    onChange={handleTaskChange} 
                    required 
                  />
                </div>

                <div>
                  <label className="form-label">
                    <i className='bx bx-wrench' style={{ color: '#f59e0b' }}></i> ประเภทสายงานช่าง
                  </label>
                  <div style={{ position: 'relative' }}>
                    <select className="modern-input custom-select" name="taskType" value={taskForm.taskType} onChange={handleTaskChange}>
                      <option value="งานโครงสร้าง">งานโครงสร้าง</option>
                      <option value="งานไฟฟ้า">งานไฟฟ้า</option>
                      <option value="งานประปา">งานประปา</option>
                      <option value="งานกระเบื้อง">งานกระเบื้อง</option>
                      <option value="งานหลังคา">งานหลังคา</option>
                      <option value="งานก่ออิฐฉาบปูน">งานก่ออิฐฉาบปูน</option>
                      <option value="งานประตูหน้าต่างอลูมิเนียม">งานประตูหน้าต่างอลูมิเนียม</option>
                      <option value="งานฝ้าเพดาน">งานฝ้าเพดาน</option>
                    </select>
                  </div>
                </div>

                {/* ✅ แถวที่ 2 */}
                <div className="col-span-2">
                  <label className="form-label">
                    <i className='bx bx-error-circle' style={{ color: '#ef4444' }}></i> ความเร่งด่วน
                  </label>
                  <div className="priority-options">
                    {['ทั่วไป', 'เร่งด่วน', 'วิกฤต'].map((cond) => (
                      <label key={cond} className={`priority-label ${taskForm.milpCondition === cond ? `active ${cond}` : ''}`}>
                        <input 
                          type="radio" 
                          name="milpCondition" 
                          value={cond} 
                          checked={taskForm.milpCondition === cond} 
                          onChange={handleTaskChange} 
                          style={{ display: 'none' }}
                        />
                        {cond}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="col-span-2 form-sub-grid">
                   <div>
                      <label className="form-label">
                        <i className='bx bx-medal' style={{ color: '#8b5cf6' }}></i> ระดับฝีมือขั้นต่ำ
                      </label>
                      <select className="modern-input custom-select" name="requiredLevel" value={taskForm.requiredLevel} onChange={handleTaskChange}>
                        <option value="1">ระดับ 1 (พื้นฐาน)</option>
                        <option value="2">ระดับ 2 (ชำนาญการ)</option>
                        <option value="3">ระดับ 3 (เชี่ยวชาญ)</option>
                      </select>
                   </div>
                   
                   <div>
                      <label className="form-label">
                        <i className='bx bx-group' style={{ color: '#10b981' }}></i> จำนวนที่ต้องการ
                        {mode !== 'assessment' && (
                          <span className="available-badge">
                            ว่าง {availableCount}
                          </span>
                        )}
                      </label>
                      <input 
                        key={errors.requiredWorkers ? `workers-err-${shakeKey}` : 'workers-ok'}
                        type="number" 
                        className={`modern-input ${errors.requiredWorkers ? 'input-error' : ''} ${mode === 'assessment' ? 'disabled' : ''}`}
                        name="requiredWorkers" 
                        value={taskForm.requiredWorkers} 
                        onChange={handleTaskChange} 
                        min="1" 
                        required 
                        disabled={mode === 'assessment'}
                      />
                      {errors.requiredWorkers && <span className="error-msg"><i className='bx bx-info-circle'></i> {errors.requiredWorkers}</span>}
                   </div>
                </div>

                {/* ✅ แถวที่ 3 */}
                <div className="col-span-2">
                  <label className="form-label">
                    <i className='bx bx-detail' style={{ color: '#64748b' }}></i> รายละเอียดและคำสั่งงาน
                  </label>
                  <textarea 
                    className="modern-input textarea-input" 
                    name="taskDetail" 
                    placeholder="อธิบายรายละเอียดของงาน สิ่งที่ต้องทำ และมาตรฐานที่คาดหวัง..." 
                    value={taskForm.taskDetail} 
                    onChange={handleTaskChange} 
                    required 
                  />
                  <div className="char-count">
                    {taskForm.taskDetail.length} ตัวอักษร
                  </div>
                </div>

              </div>

              {/* ปุ่มดำเนินการ */}
              <div className="button-group">
                <button 
                  type="button"
                  className="action-button cancel-button"
                  onClick={() => navigate(-1)}
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" 
                  className={`action-button submit-button ${mode === 'assessment' ? 'assessment-btn' : 'normal-btn'}`}
                >
                  <span>{mode === 'assessment' ? 'เริ่มการประเมิน' : 'บันทึกและเลือกช่าง'}</span>
                  <i className='bx bx-right-arrow-alt' style={{ fontSize: '20px' }}></i>
                </button>
              </div>

            </section>
          </form>
      </main>
    </div>
  );
};

export default WKProjectTasks;
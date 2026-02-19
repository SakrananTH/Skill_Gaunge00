import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../pm/WKDashboard.css';
import '../pm/WorkerResponsive.css';
import './PMTheme.css';
import PMTopNav from './PMTopNav';
import { mockUser } from '../../mock/mockData';
import { apiRequest } from '../../utils/api';

const TestingIcon = () => (
  <i className='bx bx-user-check'></i>
);

const LEVEL_META = {
  0: { label: 'ต่ำ', color: '#ef4444' },
  1: { label: 'พื้นฐาน', color: '#f59e0b' },
  2: { label: 'กลาง', color: '#38bdf8' },
  3: { label: 'สูง', color: '#22c55e' }
};

const ProjectManager = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const navUser = location.state?.user;
  const storedUser = (() => {
    try {
      const raw = sessionStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();
  const user = navUser || storedUser || { ...mockUser, role: 'Project Manager' };
  const [currentUser, setCurrentUser] = useState(user);

  const [counts, setCounts] = useState([]); 
  const [workers, setWorkers] = useState([]);
  const [allWorkers, setAllWorkers] = useState([]);
  const [workerLoading, setWorkerLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [animateChart, setAnimateChart] = useState(false);
  const [apiError, setApiError] = useState({ workers: '', counts: '' });
  const [trainingWorkerCount, setTrainingWorkerCount] = useState(0);
  const [trainingWorkerIds, setTrainingWorkerIds] = useState([]);

  const practicalAssignedWorkerIdSet = useMemo(() => {
    return new Set(
      (Array.isArray(trainingWorkerIds) ? trainingWorkerIds : [])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
    );
  }, [trainingWorkerIds]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setCurrentUser(user);
  }, [user]);

  const stats = useMemo(() => {
    const toNum = (v) => (v == null ? 0 : Number(v));
    return {
      totalProjects: counts.length,
      totalTasks: counts.reduce((acc, c) => acc + toNum(c.tasks_total), 0),
      activeTasks: counts.reduce((acc, c) => acc + (toNum(c.tasks_todo) + toNum(c.tasks_in_progress)), 0),
      doneTasks: counts.reduce((acc, c) => acc + toNum(c.tasks_done), 0)
    };
  }, [counts]);

  // ✅ คำนวณสถิติสัดส่วนพนักงาน (Permanent vs Probation)
  const statusStats = useMemo(() => {
    const total = allWorkers.length;
    const permanent = allWorkers.filter(w => w.status === "ประเมินแล้ว").length;
    const probation = total - permanent;
    return { total, permanent, probation };
  }, [allWorkers]);

  const passedWorkerCount = useMemo(() => {
    return allWorkers.filter(w => w.status === 'ประเมินแล้ว').length;
  }, [allWorkers]);

  const theoryReadyForPracticalCount = useMemo(() => {
    return allWorkers.filter((worker) => worker.theory_completed && worker.status !== 'ประเมินแล้ว').length;
  }, [allWorkers]);

  const practicalAssignedCount = useMemo(() => {
    return allWorkers.filter((worker) => {
      if (!worker.theory_completed || worker.status === 'ประเมินแล้ว') return false;
      const workerId = Number(worker.id);
      return Number.isFinite(workerId) && practicalAssignedWorkerIdSet.has(workerId);
    }).length;
  }, [allWorkers, practicalAssignedWorkerIdSet]);

  const notTestedPracticalCount = useMemo(() => {
    const value = theoryReadyForPracticalCount - practicalAssignedCount;
    return value > 0 ? value : 0;
  }, [theoryReadyForPracticalCount, practicalAssignedCount]);

  // ✅ คำนวณสถิติจำนวนช่างแยกตามทักษะ (จากรายชื่อช่างที่โหลดมา)
  const workerSkillStats = useMemo(() => {
    const stats = {};
    allWorkers.forEach(w => {
      const skill = w.skill || 'ไม่ระบุ';
      stats[skill] = (stats[skill] || 0) + 1;
    });
    return Object.entries(stats).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [allWorkers]);

  const workerLevelStats = useMemo(() => {
    const counts = new Map();
    allWorkers.forEach(worker => {
      const skill = worker.skill || 'ไม่ระบุ';
      // ✅ กรองคนที่ยังไม่มีระดับ (Level -1) ออกจากกราฟ
      if (worker.level_no === null) return;
      
      const levelNo = Number.isFinite(worker.level_no) ? worker.level_no : 0;
      const key = `${skill}||${levelNo}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([key, count]) => {
        const [skill, levelStr] = key.split('||');
        const levelNo = Number(levelStr);
        const meta = LEVEL_META[levelNo] || LEVEL_META[0];
        return {
          name: `${skill} LV.${levelNo} (${meta.label})`,
          count,
          color: meta.color,
          levelNo
        };
      })
      .sort((a, b) => b.count - a.count || a.levelNo - b.levelNo);
  }, [allWorkers]);

  const mapWorkerForDashboard = (item) => {
    const scoreValue = item?.assessmentTotalScore ?? item?.score ?? item?.exam_score ?? null;
    const totalQuestionsValue = item?.assessmentTotalQuestions ?? item?.total_questions ?? null;
    const foremanPercent = item?.foremanAssessmentPercent ?? null;
    const assessedRoundLevel = Number(item?.assessmentRoundLevel);
    const hasForemanAssessment =
      item?.foremanAssessed === true ||
      item?.foremanAssessmentTotalScore != null ||
      foremanPercent != null;
    
    const theoryPercent = totalQuestionsValue > 0
      ? (scoreValue / totalQuestionsValue) * 100
      : null;

    let status = 'ยังไม่ได้ทำข้อสอบ';
    // ✅ Default เป็น 0: ยังไม่สอบ/ยังไม่ครบผลรวม ให้แสดง LV.0 (ต่ำ)
    let level_no = 0;
    let level_label = 'ต่ำ';

    const scorePercent = theoryPercent != null
      ? Number(theoryPercent)
      : foremanPercent != null
        ? Number(foremanPercent)
        : null;

    const hasTheoryAttempt = scorePercent != null;
    const hasFinalResult = item?.assessmentPassed === true || item?.assessmentPassed === false;
    const hasFinalPass = item?.assessmentPassed === true;
    const isFailed = item?.assessmentPassed === false;

    if (hasTheoryAttempt) {
      status = hasFinalPass ? 'ประเมินแล้ว' : isFailed ? 'ไม่ผ่านเกณฑ์' : 'รอการประเมิน';
      if (!hasFinalResult || isFailed) {
        level_no = 0;
        level_label = 'ต่ำ';
      } else if (hasFinalPass) {
        if (Number.isFinite(assessedRoundLevel) && assessedRoundLevel >= 1) {
          level_no = Math.min(3, Math.max(1, assessedRoundLevel));
          level_label = LEVEL_META[level_no]?.label || 'พื้นฐาน';
        } else {
          level_no = 1;
          level_label = 'พื้นฐาน';
        }
      }
    } else if (hasForemanAssessment) {
      status = 'ประเมินแล้ว';
      level_no = 1;
      level_label = 'พื้นฐาน';
    }

    return {
      id: item?.id ?? item?.worker_id ?? '-',
      name: item?.name || item?.full_name || 'ไม่ระบุ',
      skill: item?.category || item?.level || item?.trade_type || 'ไม่ระบุ',
      role: item?.role || item?.role_code || '',
      exam_score: scoreValue,
      exam_total: totalQuestionsValue,
      theory_completed: hasTheoryAttempt,
      status,
      level_no,
      level_label,
      isPassed: hasFinalPass || status === 'ประเมินแล้ว',
      isFailed
    };
  };

  const isWorkerRole = (roleValue) => {
    const roleText = String(roleValue || '').toLowerCase();
    if (!roleText) return true;
    if (roleText.includes('ผู้จัดการ') || roleText.includes('project_manager') || roleText.includes('pm')) return false;
    if (roleText.includes('หัวหน้าช่าง') || roleText.includes('foreman') || roleText.includes('fm')) return false;
    return true;
  };

  // ✅ ดึงข้อมูลและกรองคนที่มีระดับแล้วออก
  const loadWorkers = async () => {
    setWorkerLoading(true);
    try {
      const data = await apiRequest('/api/admin/workers');
      const items = Array.isArray(data?.items) ? data.items : data;
      const mapped = (Array.isArray(items) ? items : [])
        .map(mapWorkerForDashboard)
        .filter(w => isWorkerRole(w.role));
      setAllWorkers(mapped);
      setApiError(prev => ({ ...prev, workers: '' }));
      // 🎯 แสดงเฉพาะคนที่ยังไม่มีระดับ (รอประเมิน / ยังไม่ทำข้อสอบ) และยังไม่รู้ผล (ไม่เอาคนที่สอบตกแล้ว)
      setWorkers(mapped.filter(w => w.status !== "ประเมินแล้ว" && w.status !== "ไม่ผ่านเกณฑ์"));
    } catch (e) { 
      console.error(e); 
      setApiError(prev => ({ ...prev, workers: 'เชื่อมต่อข้อมูลช่างไม่สำเร็จ (Network Error)' }));
      setWorkers([]);
    } finally { 
      setWorkerLoading(false); 
    }
  };

  const loadCounts = async () => {
    try {
      const data = await apiRequest('/api/dashboard/project-task-counts');
      setCounts(Array.isArray(data) ? data : []);
      setApiError(prev => ({ ...prev, counts: '' }));
    } catch (e) { 
      console.error(e); 
      setApiError(prev => ({ ...prev, counts: 'เชื่อมต่อข้อมูลโครงการไม่สำเร็จ (Network Error)' }));
    }
  };

  const loadTrainingAssignments = async () => {
    try {
      const data = await apiRequest('/api/dashboard/practical-testing-count');
      const workerIds = Array.isArray(data?.worker_ids)
        ? data.worker_ids.map((value) => Number(value)).filter((value) => Number.isFinite(value))
        : [];
      setTrainingWorkerIds(workerIds);
      setTrainingWorkerCount(workerIds.length || Number(data?.count ?? 0));
    } catch (error) {
      console.error(error);
      setTrainingWorkerCount(0);
      setTrainingWorkerIds([]);
    }
  };

  useEffect(() => {
    loadCounts();
    loadWorkers();
    loadTrainingAssignments();
  }, []);

  useEffect(() => {
    if (!workerLoading) {
      const timer = setTimeout(() => setAnimateChart(true), 100);
      return () => clearTimeout(timer);
    } else {
      setAnimateChart(false);
    }
  }, [workerLoading]);

  const getWorkerStatusBadge = (status) => {
    switch (status) {
      case "รอการประเมิน":
        return <span className="pill small" style={{background: '#e3f2fd', color: '#1976d2', border: '1px solid #bbdefb'}}>รอประเมิน (ภาคปฏิบัติ)</span>;
      case "ยังไม่ได้ทำข้อสอบ":
        return <span className="pill small" style={{background: '#ffebee', color: '#c62828', border: '1px solid #ffcdd2'}}>รอสอบ (ภาคทฤษฎี)</span>;
      default:
        return null;
    }
  };

  return (
    <div className="dash-window" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#ffffff', fontFamily: "'Kanit', sans-serif" }}>
      <PMTopNav active="home" user={currentUser} />

      <main className="worker-main" style={{ flex: 1, padding: '40px 20px', width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
        {(apiError.workers || apiError.counts) && (
          <div style={{
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            color: '#9f1239',
            padding: '12px 16px',
            borderRadius: '12px',
            marginBottom: '20px',
            fontWeight: '600'
          }}>
            <div>⚠️ ไม่สามารถดึงข้อมูลบางส่วนได้</div>
            <div style={{ fontSize: '13px', marginTop: '4px', color: '#be123c' }}>
              {apiError.workers && <span>{apiError.workers}</span>}
              {apiError.workers && apiError.counts && <span> • </span>}
              {apiError.counts && <span>{apiError.counts}</span>}
            </div>
          </div>
        )}
        
        {/* Executive Hero Banner - WK Style adapted for PM */}
        <style>
          {`
            @keyframes float { 0% { transform: translateY(0px) rotate(-5deg); } 50% { transform: translateY(-15px) rotate(5deg); } 100% { transform: translateY(0px) rotate(-5deg); } }
            @keyframes wave { 0% { transform: rotate(0deg); } 20% { transform: rotate(14deg); } 40% { transform: rotate(-8deg); } 60% { transform: rotate(14deg); } 80% { transform: rotate(-4deg); } 100% { transform: rotate(10deg); } }
            @keyframes blob { 0% { transform: translate(0, 0) scale(1); } 33% { transform: translate(30px, -50px) scale(1.1); } 66% { transform: translate(-20px, 20px) scale(0.9); } 100% { transform: translate(0, 0) scale(1); } }
            @keyframes shine { 0% { left: -100%; opacity: 0; } 50% { opacity: 0.5; } 100% { left: 200%; opacity: 0; } }
          `}
        </style>
        <div style={{ 
          background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
          borderRadius: '24px', 
          padding: '24px 40px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '24px',
          boxShadow: '0 12px 24px -6px rgba(0, 0, 0, 0.45)',
          border: '1px solid #374151',
          position: 'relative',
          overflow: 'hidden'
        }}>
            {/* Background Decoration */}
            <div style={{ position: 'absolute', inset: 0, opacity: 0.28, background: 'radial-gradient(circle at 20% 50%, rgba(148,163,184,0.35), transparent 70%)', pointerEvents: 'none' }}></div>
            <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(71,85,105,0.35) 0%, rgba(255,255,255,0) 70%)', borderRadius: '50%', pointerEvents: 'none', animation: 'blob 15s infinite alternate ease-in-out' }}></div>
            <div style={{ position: 'absolute', bottom: '-30%', left: '30%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(100,116,139,0.25) 0%, rgba(255,255,255,0) 70%)', borderRadius: '50%', pointerEvents: 'none', animation: 'blob 20s infinite alternate-reverse ease-in-out' }}></div>
            <div style={{ position: 'absolute', top: 0, left: '-100%', width: '50%', height: '100%', background: 'linear-gradient(to right, transparent, rgba(148,163,184,0.2), transparent)', transform: 'skewX(-25deg)', animation: 'shine 8s infinite ease-in-out', pointerEvents: 'none' }}></div>

            <div style={{ position: 'relative', zIndex: 1 }}>
                <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#f9fafb', marginBottom: '8px', letterSpacing: '-0.5px', fontFamily: "'Kanit', sans-serif" }}>
                  สวัสดี <span style={{ color: '#e2e8f0' }}>&quot;{currentUser.full_name || currentUser.name || 'ผู้จัดการ'}&quot;</span> <span style={{ display: 'inline-block', animation: 'wave 2.5s infinite', transformOrigin: '70% 70%' }}>👋</span>
                </h1>
                <p style={{ fontSize: '16px', color: '#cbd5e1', margin: '0 0 16px 0', fontWeight: '500' }}>
                  พร้อมสำหรับการบริหารโครงการในวันนี้หรือยัง?
                </p>
                
                <div style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  background: 'rgba(15, 23, 42, 0.75)', 
                  padding: '10px 20px', 
                  borderRadius: '14px', 
                  boxShadow: '0 4px 15px rgba(0,0,0,0.25)',
                  border: '1px solid #475569',
                  backdropFilter: 'blur(5px)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0', fontWeight: '600', fontSize: '14px' }}>
                      <span style={{ fontSize: '18px' }}>📅</span> 
                      {currentDate.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                    <div style={{ height: '18px', width: '2px', background: '#64748b' }}></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fda4af', fontWeight: '700', fontSize: '14px' }}>
                      <span style={{ fontSize: '18px' }}>⏰</span> 
                      {currentDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                </div>
            </div>
            
            {/* PM Icon Area */}
            <div style={{ position: 'relative', width: '200px', height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                  width: '96px',
                  height: '96px',
                  borderRadius: '24px',
                  background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
                  border: '1px solid #64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 20px 30px rgba(2, 6, 23, 0.45)',
                  animation: 'float 6s ease-in-out infinite',
                  zIndex: 2
                }}>
                  <i className='bx bxs-dashboard' style={{ fontSize: '52px', color: '#93c5fd' }}></i>
                </div>
                <div style={{
                  position: 'absolute',
                  bottom: '6px',
                  right: '18px',
                  width: '50px',
                  height: '50px',
                  borderRadius: '14px',
                  background: '#0f172a',
                  border: '1px solid #475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: 'rotate(12deg)',
                  zIndex: 1
                }}>
                  <i className='bx bx-folder' style={{ fontSize: '28px', color: '#fbbf24' }}></i>
                </div>
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  left: '8px',
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: '#1e293b',
                  border: '1px solid #475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: 'rotate(-14deg)',
                  zIndex: 0
                }}>
                  <i className='bx bx-group' style={{ fontSize: '24px', color: '#34d399' }}></i>
                </div>
            </div>
        </div>

        {/* Stats Grid - WK Style Cards */}
        <div className="worker-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          <StatCard 
            icon={<span><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24"  fill="currentColor" viewBox="0 0 24 24" ><path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5m0-8c1.65 0 3 1.35 3 3s-1.35 3-3 3-3-1.35-3-3 1.35-3 3-3M4 22h16c.55 0 1-.45 1-1v-1c0-3.86-3.14-7-7-7h-4c-3.86 0-7 3.14-7 7v1c0 .55.45 1 1 1m6-7h4c2.76 0 5 2.24 5 5H5c0-2.76 2.24-5 5-5"></path></svg></span>} 
            label="จำนวนช่างทั้งหมด" 
            value={`${statusStats.total} คน`} 
            color="#cf2424" 
            bg="#fef2f2" 
            subLabel="รวมจำนวนช่างทั้งหมดในระบบ"
          />
          <StatCard 
            icon={<span><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24"  fill="currentColor" viewBox="0 0 24 24" ><path d="M5 2H4v2h1v1c0 2.46 1.32 4.77 3.43 6.02.35.21.57.55.57.9v.16c0 .35-.21.69-.57.9A7.01 7.01 0 0 0 5 19v1H4v2h16v-2h-1v-1c0-2.46-1.32-4.77-3.43-6.02-.36-.21-.57-.55-.57-.9v-.16c0-.35.21-.69.57-.9A7.01 7.01 0 0 0 19 5V4h1V2zm12 3c0 1.76-.94 3.41-2.45 4.3-.97.57-1.55 1.55-1.55 2.62v.16c0 1.07.58 2.05 1.55 2.62 1.51.89 2.45 2.54 2.45 4.3v1H7v-1c0-1.76.94-3.41 2.45-4.3.97-.57 1.55-1.55 1.55-2.62v-.16c0-1.07-.58-2.05-1.55-2.62A5.01 5.01 0 0 1 7 5V4h10z"></path></svg></span>} 
            label="ยังไม่ได้ทดสอบภาคปฏิบัติ" 
            value={`${notTestedPracticalCount} คน`} 
            color="#f59e0b" 
            bg="#fffbeb" 
            subLabel="ควรมอบหมายการสอบ"
          />
          <StatCard 
            icon={<span><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24"  fill="currentColor" viewBox="0 0 24 24" ><path d="M21 15c0-.61-.06-1.22-.18-1.81-.12-.58-.29-1.15-.52-1.69a10 10 0 0 0-.83-1.53c-.32-.48-.69-.93-1.1-1.33-.41-.41-.86-.78-1.33-1.1-.48-.32-1-.6-1.53-.83-.16-.07-.34-.12-.5-.18V5.01c0-.55-.45-1-1-1h-4c-.55 0-1 .45-1 1v1.52c-.17.06-.34.11-.5.18-.53.23-1.05.51-1.53.83s-.92.69-1.33 1.1-.78.86-1.1 1.33c-.32.48-.6 1-.83 1.53-.23.54-.41 1.11-.53 1.69-.12.59-.18 1.2-.18 1.81v3h-1v2h20v-2h-1v-3ZM5 15c0-.47.05-.95.14-1.41.09-.45.23-.89.41-1.31s.39-.81.64-1.19a7.1 7.1 0 0 1 1.9-1.9c.29-.2.6-.36.91-.51V15h2V6h2v9h2V8.68c.32.15.62.32.91.51.37.25.72.54 1.04.86s.6.66.85 1.04c.25.37.47.77.65 1.19s.32.86.41 1.31c.09.46.14.94.14 1.41v3H5z"></path></svg></span>} 
            label="กำลังทดสอบภาคปฏิบัติ" 
            value={`${practicalAssignedCount} คน`} 
            color="#3b82f6" 
            bg="#eff6ff" 
            subLabel="อยู่ระหว่างทดสอบ"
          />
          <StatCard 
            icon={<span><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24"  fill="currentColor" viewBox="0 0 24 24" ><path d="M9 15.59 4.71 11.3 3.3 12.71l5 5c.2.2.45.29.71.29s.51-.1.71-.29l11-11-1.41-1.41L9.02 15.59Z"></path></svg></span>} 
            label="ผ่านเกณฑ์ภาคปฏิบัติ" 
            value={`${passedWorkerCount} คน`} 
            color="#10b981" 
            bg="#f0fdf4" 
            subLabel="พร้อมทำงาน"
          />
        </div>

        <div className="pm-charts-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '25px', marginBottom: '30px' }}>
          {/* ✅ กราฟสรุปจำนวนช่างแยกตามสาขาทักษะ (สไตล์ Admin) */}
          <section style={{ background: 'white', borderRadius: '16px', padding: '30px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '22px' }}><i className='bx bx-bar-chart-alt-2'></i></span> จำนวนพนักงานแยกตามทักษะ
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {workerLevelStats.map((item, idx) => {
                const maxCount = Math.max(...workerLevelStats.map(s => s.count), 1);
                const effectiveScaleMax = Math.max(maxCount, 10);
                const width = (item.count / effectiveScaleMax) * 100;
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ width: '140px', fontSize: '14px', color: '#475569', fontWeight: '600', textAlign: 'right' }}>{item.name}</div>
                    <div style={{ flex: 1, height: '12px', background: '#f1f5f9', borderRadius: '20px', overflow: 'hidden' }}>
                      <div style={{ width: `${animateChart ? width : 0}%`, height: '100%', background: item.color, borderRadius: '20px', transition: 'width 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)' }}></div>
                    </div>
                    <div style={{ width: '50px', fontSize: '14px', color: '#1e293b', fontWeight: '700' }}>{item.count}</div>
                  </div>
                );
              })}
              {workerLevelStats.length === 0 && !workerLoading && (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>ไม่มีข้อมูลช่าง</div>
              )}
            </div>
          </section>

          {/* ✅ สัดส่วนพนักงาน (Donut Chart สไตล์ Admin) */}
          <section style={{ background: 'white', borderRadius: '16px', padding: '30px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '22px' }}><i className='bx bx-doughnut-chart'></i></span> สัดส่วนพนักงาน
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: '160px', height: '160px', marginBottom: '20px' }}>
                <svg width="160" height="160" viewBox="0 0 160 160">
                  <circle cx="80" cy="80" r="65" fill="none" stroke="#f1f5f9" strokeWidth="15" />
                  {/* Permanent Segment */}
                  <circle 
                    cx="80" cy="80" r="65" fill="none" stroke="#10b981" strokeWidth="15"
                    strokeDasharray={`${animateChart ? (2 * Math.PI * 65 * (statusStats.permanent / (statusStats.total || 1))) : 0} ${2 * Math.PI * 65}`}
                    strokeDashoffset="0"
                    transform="rotate(-90 80 80)"
                    style={{ transition: 'stroke-dasharray 1s ease-out' }}
                  />
                  {/* Probation Segment */}
                  <circle 
                    cx="80" cy="80" r="65" fill="none" stroke="#f59e0b" strokeWidth="15"
                    strokeDasharray={`${animateChart ? (2 * Math.PI * 65 * (statusStats.probation / (statusStats.total || 1))) : 0} ${2 * Math.PI * 65}`}
                    strokeDashoffset="0"
                    transform={`rotate(${-90 + (360 * (statusStats.permanent / (statusStats.total || 1)))} 80 80)`}
                    style={{ transition: 'stroke-dasharray 1s ease-out' }}
                  />
                </svg>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                  <span style={{ fontSize: '24px', fontWeight: '800', color: '#1e293b', display: 'block' }}>{statusStats.total}</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>ทั้งหมด</span>
                </div>
              </div>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }}></span>
                    <span style={{ color: '#475569' }}>ประเมินแล้ว (พนักงานประจำ)</span>
                  </div>
                  <span style={{ fontWeight: '700', color: '#1e293b' }}>{statusStats.permanent} คน</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }}></span>
                    <span style={{ color: '#475569' }}>รอประเมิน/สอบ (ทดลองงาน)</span>
                  </div>
                  <span style={{ fontWeight: '700', color: '#1e293b' }}>{statusStats.probation} คน</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ✅ ตารางจัดการช่างที่ต้องมอบหมายงานเพื่อไปประเมิน */}
        <section style={{ background: 'white', borderRadius: '16px', padding: '30px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: 0 }}>รายชื่อช่างรอรับงาน (เพื่อประเมินหน้างานโดย Foreman)</h3>
            <button className="pill" onClick={loadWorkers} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}>รีเฟรชข้อมูล</button>
          </div>
          
          <div className="table" style={{ border: 'none', marginTop: '10px' }}>
            <div className="thead" style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.8fr 1.2fr 1fr 1fr 1.4fr 1.2fr', background: '#f8fafc', borderRadius: '12px', padding: '12px 0', alignItems: 'center' }}>
              <div style={{ paddingLeft: '24px', fontWeight: '600', color: '#475569' }}>ชื่อช่าง</div>
              <div style={{ textAlign: 'center', fontWeight: '600', color: '#475569' }}>รหัสช่าง</div>
              <div style={{ textAlign: 'center', fontWeight: '600', color: '#475569' }}>สาขาทักษะ</div>
              <div style={{ textAlign: 'center', fontWeight: '600', color: '#475569' }}>คะแนนสอบ</div>
              <div style={{ textAlign: 'center', fontWeight: '600', color: '#475569' }}>ผลสอบทฤษฎี</div>
              <div style={{ textAlign: 'center', fontWeight: '600', color: '#475569' }}>สถานะปัจจุบัน</div>
              <div style={{ textAlign: 'center', fontWeight: '600', color: '#475569' }}>การจัดการ</div>
            </div>
            <div className="tbody">
              {workerLoading ? <div className="empty" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>กำลังโหลด...</div> : 
                workers.map((w) => {
                  const workerId = Number(w.id);
                  const isPracticalAssigned = Number.isFinite(workerId) && practicalAssignedWorkerIdSet.has(workerId);
                  return (
                  <div className="tr" key={w.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.8fr 1.2fr 1fr 1fr 1.4fr 1.2fr', borderBottom: '1px solid #f1f5f9', padding: '16px 0', alignItems: 'center', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                    <div className="td" style={{ paddingLeft: '24px' }}><div style={{ fontWeight: '600', color: '#1e293b' }}>{w.name}</div></div>
                    <div className="td" style={{ textAlign: 'center', color: '#64748b' }}>{w.id ?? '-'}</div>
                    <div className="td" style={{ textAlign: 'center', color: '#475569' }}>{w.skill}</div>
                    <div className="td" style={{ textAlign: 'center', color: '#64748b' }}>{w.exam_score == null ? '-' : `${w.exam_score}/${w.exam_total || 60}`}</div>
                    <div className="td" style={{ textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
                      {w.theory_completed ? (
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '700',
                          background: '#ecfdf5',
                          color: '#059669'
                        }}>
                          สอบแล้ว
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '700',
                          background: '#fff7ed',
                          color: '#c2410c'
                        }}>
                          ยังไม่ได้สอบ
                        </span>
                      )}
                    </div>
                    <div className="td" style={{ display: 'flex', justifyContent: 'center' }}>
                      {w.status === 'รอการประเมิน' && isPracticalAssigned ? (
                        <span className="pill small" style={{background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe'}}>มอบหมายงานแล้ว</span>
                      ) : getWorkerStatusBadge(w.status)}
                    </div>
                    <div className="td" style={{ paddingRight: '24px', display: 'flex', justifyContent: 'center' }}>
                      {w.status === "รอการประเมิน" && !isPracticalAssigned ? (
                        <button 
                          onClick={() => navigate('/project-tasks', { state: { selectedWorker: w, mode: 'assessment' } })}
                          style={{ background: '#2563eb', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', transition: 'all 0.2s' }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#1d4ed8'}
                          onMouseOut={(e) => e.currentTarget.style.background = '#2563eb'}
                        >
                          มอบหมายงานประเมิน
                        </button>
                      ) : w.status === 'รอการประเมิน' && isPracticalAssigned ? (
                        <button
                          onClick={() => navigate('/projects')}
                          style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}
                          title="ดูงานที่มอบหมายและประวัติการทำงาน"
                        >
                          ดูงานที่มอบหมาย
                        </button>
                      ) : (
                        <button 
                          onClick={() => alert(`ส่งแจ้งเตือนให้ ${w.name} เข้าทำแบบทดสอบทฤษฎีเรียบร้อยแล้ว`)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', color: '#b91c1c', fontWeight: 'bold', fontSize: '11px', padding: '6px 12px', background: '#fff1f2', borderRadius: '8px', border: '1px solid #fecaca', cursor: 'pointer', width: '100%', transition: 'all 0.2s' }}
                          onMouseOver={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = '#fff1f2'; }}
                          title="คลิกเพื่อส่งแจ้งเตือนให้ช่าง"
                        >
                          <i className='bx bx-bell-ring'></i> แจ้งเตือนให้สอบ
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })
              }
              {workers.length === 0 && !workerLoading && <div className="empty">ไม่มีช่างที่รอการประเมินในขณะนี้</div>}
            </div>
          </div>
        </section>

        {/* ✅ Section: Assessment History (Passed & Failed) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '30px' }}>
          
          {/* Passed Workers */}
          <section style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#166534', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className='bx bx-check-circle'></i> ประวัติช่างที่ผ่านการประเมิน
            </h3>
            <div className="table" style={{ border: 'none' }}>
              <div className="thead" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr', background: '#f0fdf4', borderRadius: '12px', padding: '10px 0', fontSize: '13px' }}>
                <div style={{ paddingLeft: '16px', fontWeight: '600', color: '#166534' }}>ชื่อช่าง</div>
                <div style={{ textAlign: 'center', fontWeight: '600', color: '#166534' }}>ทักษะ</div>
                <div style={{ textAlign: 'center', fontWeight: '600', color: '#166534' }}>คะแนนสอบ</div>
                <div style={{ textAlign: 'center', fontWeight: '600', color: '#166534' }}>ระดับ</div>
                <div style={{ textAlign: 'center', fontWeight: '600', color: '#166534' }}>สถานะ</div>
              </div>
              <div className="tbody" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {allWorkers.filter(w => w.status === 'ประเมินแล้ว').length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '13px' }}>ไม่มีข้อมูล</div>
                ) : (
                  allWorkers.filter(w => w.status === 'ประเมินแล้ว').map(w => (
                    <div className="tr" key={w.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr', borderBottom: '1px solid #f0fdf4', padding: '12px 0', fontSize: '13px', alignItems: 'center' }}>
                      <div className="td" style={{ paddingLeft: '16px', fontWeight: '500', color: '#1e293b' }}>{w.name}</div>
                      <div className="td" style={{ textAlign: 'center', color: '#64748b' }}>{w.skill}</div>
                      <div className="td" style={{ textAlign: 'center', fontWeight: '600', color: '#1e293b' }}>{w.exam_score != null ? `${w.exam_score}/${w.exam_total || '-'}` : '-'}</div>
                      <div className="td" style={{ textAlign: 'center' }}>
                        <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>LV.{w.level_no}</span>
                      </div>
                      <div className="td" style={{ textAlign: 'center' }}>
                        <span style={{ color: '#16a34a', fontWeight: '600', fontSize: '12px' }}>ผ่าน</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* Failed Workers */}
          <section style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#b91c1c', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className='bx bx-x-circle'></i> ประวัติช่างที่ไม่ผ่านการประเมิน
            </h3>
            <div className="table" style={{ border: 'none' }}>
              <div className="thead" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', background: '#fef2f2', borderRadius: '12px', padding: '10px 0', fontSize: '13px' }}>
                <div style={{ paddingLeft: '16px', fontWeight: '600', color: '#b91c1c' }}>ชื่อช่าง</div>
                <div style={{ textAlign: 'center', fontWeight: '600', color: '#b91c1c' }}>ทักษะ</div>
                <div style={{ textAlign: 'center', fontWeight: '600', color: '#b91c1c' }}>คะแนนสอบ</div>
                <div style={{ textAlign: 'center', fontWeight: '600', color: '#b91c1c' }}>ผลการเมิน</div>
              </div>
              <div className="tbody" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {allWorkers.filter(w => w.status === 'ไม่ผ่านเกณฑ์').length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '13px' }}>ไม่มีข้อมูล</div>
                ) : (
                  allWorkers.filter(w => w.status === 'ไม่ผ่านเกณฑ์').map(w => (
                    <div className="tr" key={w.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', borderBottom: '1px solid #fef2f2', padding: '12px 0', fontSize: '13px', alignItems: 'center' }}>
                      <div className="td" style={{ paddingLeft: '16px', fontWeight: '500', color: '#1e293b' }}>{w.name}</div>
                      <div className="td" style={{ textAlign: 'center', color: '#64748b' }}>{w.skill}</div>
                      <div className="td" style={{ textAlign: 'center', fontWeight: '600', color: '#1e293b' }}>{w.exam_score != null ? `${w.exam_score}/${w.exam_total || '-'}` : '-'}</div>
                      <div className="td" style={{ textAlign: 'center' }}>
                        <span style={{ background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>ไม่ผ่าน</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
};

// Internal Component for Stat Card - WK Style
const StatCard = ({ icon, label, value, color, bg }) => {
    const [displayValue, setDisplayValue] = useState(0);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        // แยกตัวเลขออกจากหน่วย (เช่น "10 คน" -> 10)
        const numericValue = parseInt(String(value).replace(/,/g, '')) || 0;
        let start = 0;
        const duration = 1000; // ระยะเวลา 1 วินาที
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // ใช้ Easing function (Ease-out) เพื่อให้ตอนจบดูนุ่มนวล
            const easeOutQuad = (t) => t * (2 - t);
            const currentNumber = Math.floor(easeOutQuad(progress) * numericValue);

            setDisplayValue(currentNumber);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }, [value]);

    const unit = String(value).replace(/[0-9,]/g, '').trim();

    return (
        <div 
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{ 
                background: 'white', borderRadius: '16px', padding: '24px', display: 'flex', alignItems: 'center', gap: '24px', border: '1px solid #f1f5f9', boxShadow: isHovered ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : '0 1px 3px 0 rgba(0, 0, 0, 0.1)', transition: 'all 0.3s ease', transform: isHovered ? 'translateY(-4px)' : 'translateY(0)', cursor: 'default' 
            }}
        >
            <div style={{ width: '64px', height: '64px', background: bg, borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>
                {icon}
            </div>
            <div>
                <h4 style={{ margin: 0, fontSize: '13px', color: '#64748b', fontWeight: '500' }}>{label}</h4>
                <h3 style={{ margin: '4px 0 0', fontSize: '20px', color: color, fontWeight: '800' }}>
                    {displayValue.toLocaleString()} {unit}
                </h3>
            </div>
        </div>
    );
};

export default ProjectManager;
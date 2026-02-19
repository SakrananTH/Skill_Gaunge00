import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../pm/WKDashboard.css';
import { apiRequest, API_BASE_URL } from '../../utils/api';
import { performLogout } from '../../utils/logout';
import Swal from 'sweetalert2';
import LogoutModal from '../../components/LogoutModal';

const ForemanAssessment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const worker = location.state?.worker;
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const displayWorker = worker || { 
    name: 'ตัวอย่าง ชื่อช่าง', 
    roleName: 'ช่างทั่วไป', 
    id: 999 
  };
  const [latestWorkerData, setLatestWorkerData] = useState(null);
  const submittedWork = latestWorkerData?.submission || displayWorker?.submission || null;
  const displayTaskTitle = latestWorkerData?.taskTitle || displayWorker?.taskTitle || '-';
  const submittedPhotoPath = submittedWork?.photo ? String(submittedWork.photo) : '';
  const submittedPhotoUrl = submittedPhotoPath.startsWith('/uploads/')
    ? `${API_BASE_URL}${submittedPhotoPath}`
    : (submittedPhotoPath.startsWith('http://') || submittedPhotoPath.startsWith('https://') ? submittedPhotoPath : null);

  const criteriaData = {
    "A. ความเข้าใจงาน & ความพร้อม": { icon: 'bx-brain', items: [
      { id: "a1", text: "1. เข้าใจแบบ งานสั่ง หรือคำอธิบายงานได้ถูกต้อง" },
      { id: "a2", text: "2. การวัดและการคำนวณ (Correct measurements)" },
      { id: "a3", text: "3. การใช้เครื่องมือถูกต้องเหมาะสม" }
    ]},
    "B. วิธีการทำงาน": { icon: 'bx-wrench', items: [
      { id: "b1", text: "4. การปฏิบัติงานตามขั้นตอนและวิธีการที่ถูกต้อง" },
      { id: "b2", text: "5. ปฏิบัติตามขั้นตอนความปลอดภัยในการทำงาน" }
    ]},
    "C. คุณภาพและความถูกต้องของงาน": { icon: 'bx-check-shield', items: [
      { id: "c1", text: "6. ตำแหน่ง ระดับ แนว และมุมของงานถูกต้องตามที่กำหนด" },
      { id: "c2", text: "7. งานทำตามแบบและข้อกำหนดที่ได้รับ" },
      { id: "c3", text: "8. ความแข็งแรงและความคงทนของงาน" },
      { id: "c4", text: "9. ความเรียบร้อยและความละเอียดของงาน" }
    ]},
    "D. ประสิทธิภาพในการทำงาน": { icon: 'bx-timer', items: [
      { id: "d1", text: "10. ทำงานได้ทันตามเวลาที่กำหนดและทำงานต่อเนื่อง" },
      { id: "d2", text: "11. บริหารเวลาและลำดับงานได้เหมาะสม" },
      { id: "d3", text: "12. ทำงานร่วมกับผู้อื่นได้ดี ไม่เป็นอุปสรรคต่อทีม" }
    ]},
    "E. ความปลอดภัยเชิงพฤติกรรม": { icon: 'bx-shield-quarter', items: [
      { id: "e1", text: "13. หลีกเลี่ยงพฤติกรรมเสี่ยงและแจ้งเมื่อพบความเสี่ยง" },
      { id: "e2", text: "14. ใช้อุปกรณ์ป้องกันส่วนบุคคลครบถ้วนและถูกต้อง" }
    ]},
    "F. ความรับผิดชอบและทัศนคติ": { icon: 'bx-smile', items: [
      { id: "f1", text: "15. ตรงต่อเวลาและพร้อมทำงาน" },
      { id: "f2", text: "16. รับผิดชอบต่องานที่ได้รับมอบหมายจนแล้วเสร็จ" },
      { id: "f3", text: "17. แก้ไขปัญหาที่เกิดขึ้นได้ ไม่หลีกเลี่ยงความรับผิดชอบ" },
      { id: "f4", text: "18. ปฏิบัติตามคำสั่งและข้อตกลงของผู้ควบคุมงาน" }
    ]}
  };

  const [evaluations, setEvaluations] = useState({});
  const [comment, setComment] = useState('');
  const [totalScore, setTotalScore] = useState(0);
  const [grade, setGrade] = useState('-');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // State สำหรับ Modal ยืนยันก่อนส่ง
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // ✅ State สำหรับ Modal แสดงผลลัพธ์ (Result)
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultData, setResultData] = useState(null);

  // Wizard State
  const sectionKeys = Object.keys(criteriaData);
  const [currentStep, setCurrentStep] = useState(0);

  const allQuestions = Object.values(criteriaData).flatMap((section) => section.items);
  const progress = allQuestions.length > 0
    ? (Object.keys(evaluations).length / allQuestions.length) * 100
    : 0;

  useEffect(() => {
    const values = Object.values(evaluations);
    if (values.length === 0) return;
    
    const sum = values.reduce((acc, cur) => acc + cur, 0);
    const maxScore = 18 * 4; // 72
    const percent = (sum / maxScore) * 100;

    setTotalScore(sum);
    
    if (percent >= 80) setGrade('A (ดีเยี่ยม)');
    else if (percent >= 70) setGrade('B (ดี)');
    else if (percent >= 60) setGrade('C (พอใช้)');
    else setGrade('D (ต้องปรับปรุง)');

  }, [evaluations]);

  useEffect(() => {
    const loadLatestSubmission = async () => {
      const workerId = Number(displayWorker?.id);
      const taskId = displayWorker?.taskId ? String(displayWorker.taskId) : null;
      if (!Number.isFinite(workerId)) return;

      try {
        const response = await apiRequest('/api/foreman/pending-workers');
        const pendingItems = Array.isArray(response?.items) ? response.items : [];
        const matched = pendingItems.find((item) => {
          const sameWorker = Number(item?.id) === workerId;
          const sameTask = taskId ? String(item?.taskId || '') === taskId : true;
          return sameWorker && sameTask;
        }) || pendingItems.find((item) => Number(item?.id) === workerId);

        if (matched) setLatestWorkerData(matched);
      } catch (error) {
        console.error('Load latest worker submission failed:', error);
      }
    };

    loadLatestSubmission();
  }, [displayWorker?.id, displayWorker?.taskId]);

  const handleRatingChange = (id, value) => {
    setEvaluations(prev => ({ ...prev, [id]: value }));
  };

  const isSectionComplete = (sectionKey) => {
    const items = criteriaData[sectionKey].items;
    return items.every(item => evaluations[item.id] !== undefined);
  };

  const handleNext = (e) => {
    // Prevent default form behavior just in case
    e && e.preventDefault();
    
    // Simply move to next step without validation
    if (currentStep < sectionKeys.length - 1) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePreSubmit = (e) => {
    e.preventDefault();
    const questions = Object.values(criteriaData).flatMap((section) => section.items);
    
    // Check missing items
    const missingItems = questions.filter(q => evaluations[q.id] === undefined);

    if (missingItems.length > 0) {
        Swal.fire({
            icon: 'warning',
            title: 'ยังประเมินไม่ครบ',
            html: `กรุณาตรวจสอบและประเมินให้ครบทุกข้อ <br/>(ขาดอีก ${missingItems.length} ข้อ)<br/>`,
            confirmButtonColor: '#3085d6',
            confirmButtonText: 'ตกลง'
        });
        return;
    }
    setShowConfirmModal(true);
  };

  const submitToApi = async () => {
    setShowConfirmModal(false);
    setIsSubmitting(true);

    try {
      const questions = Object.values(criteriaData).flatMap((section) => section.items);
      const maxScore = questions.length * 4;
      const percent = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
      const scoreMap = Object.fromEntries(Object.entries(evaluations).map(([key, value]) => [key, Number(value)]));

      await apiRequest('/api/foreman/assessments', {
        method: 'POST',
        body: {
          worker_id: Number(displayWorker.id),
          criteria: scoreMap,
          comment: comment || null,
          total_score: Number(totalScore),
          max_score: Number(maxScore),
          percent: Number(percent.toFixed(2)),
          grade: String(grade || '-')
        }
      });

      const rawTheoryScore = Number(latestWorkerData?.theory?.score);
      const rawTheoryTotal = Number(latestWorkerData?.theory?.totalQuestions);
      const hasTheory = Number.isFinite(rawTheoryScore)
        && Number.isFinite(rawTheoryTotal)
        && rawTheoryTotal > 0;

      setResultData({
        theoryScore: hasTheory ? `${rawTheoryScore}/${rawTheoryTotal}` : '-',
        practicalScore: `${percent.toFixed(2)}%`,
        totalScore: totalScore,
        isPass: percent >= 60,
        targetLevel: percent >= 60 ? 1 : '-'
      });
      setShowResultModal(true);

    } catch (err) {
        console.error("Submit Error:", err);
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: err?.message || "เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์",
        confirmButtonColor: '#d33',
        confirmButtonText: 'ปิด'
      });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    setShowResultModal(false);
    navigate('/foreman'); // กลับหน้า Dashboard
  };

  // Styles
  const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(3px)' };
  const modalContentStyle = { background: 'white', padding: '30px', borderRadius: '16px', width: '380px', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' };
  const btnModalStyle = { padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', margin: '0 5px', minWidth: '100px' };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  return (
    <div className="dash-window" style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: "'Kanit', sans-serif" }}>
      <style>
        {`
          @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          .animate-slide-up { animation: slideUp 0.4s ease forwards; }
        `}
      </style>
      
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
              <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '20px' }}>
                  <i className='bx bx-hard-hat'></i>
              </div>
              <div>
                  <h1 style={{ margin: 0, fontSize: '18px', color: '#1e293b', fontWeight: '700' }}>Foreman Portal</h1>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>ระบบประเมินทักษะช่าง</p>
              </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <button onClick={() => navigate('/foreman-settings')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '22px' }} title="ตั้งค่า"><i className='bx bx-cog'></i></button>
              <button onClick={handleLogout} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>ออกจากระบบ</button>
          </div>
      </header>
      
      {/* 1. Modal ยืนยันการส่ง */}
      {showConfirmModal && (
        <div style={modalOverlayStyle}>
            <div style={modalContentStyle}>
                <div style={{ fontSize: '40px', marginBottom: '15px' }}>📋</div>
                <h3 style={{color: '#1e293b', margin: '0 0 25px'}}>ยืนยันผลการประเมิน</h3>
                <div style={{display:'flex', justifyContent:'center', gap: '15px'}}>
                    <button onClick={() => setShowConfirmModal(false)} style={{...btnModalStyle, background:'#e2e8f0', color:'#475569'}}>ยกเลิก</button>
                    <button onClick={submitToApi} style={{...btnModalStyle, background:'#22c55e', color:'white'}}>ยืนยัน</button>
                </div>
            </div>
        </div>
      )}

      {/* 2. ✅ Modal แสดงผลลัพธ์ (ตามที่ขอ) */}
      {showResultModal && resultData && (
        <div style={modalOverlayStyle}>
            <div style={{...modalContentStyle, width: '450px', padding: '40px', border: resultData.isPass ? '4px solid #22c55e' : '4px solid #ef4444'}}>
                
                <h1 style={{ margin: '0 0 20px 0', fontSize: '32px', color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: '15px' }}>
                    ผลการประเมิน
                </h1>

                <div style={{ textAlign: 'left', fontSize: '20px', lineHeight: '1.8', color: '#334155', marginBottom: '25px' }}>
                    <div><strong>นาย:</strong> {displayWorker.name}</div>
                    <div><strong>ช่าง:</strong> {displayWorker.roleName}</div>
                    <div style={{ marginTop: '15px', borderTop: '1px dashed #cbd5e1', paddingTop: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>คะแนนภาคทฤษฎี</span>
                          <span>{resultData.theoryScore === '-' ? '-' : `${resultData.theoryScore} คะแนน`}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>คะแนนภาคปฏิบัติ</span>
                          <span>{resultData.practicalScore}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2563eb', fontWeight: 'bold', fontSize: '22px', marginTop: '10px' }}>
                            <span>คะแนนรวม</span>
                            <span>{resultData.totalScore} คะแนน</span>
                        </div>
                    </div>
                </div>

                <div style={{ background: resultData.isPass ? '#dcfce7' : '#fee2e2', padding: '15px', borderRadius: '12px', marginBottom: '25px' }}>
                    <div style={{ fontSize: '18px', color: '#475569', marginBottom: '5px' }}>ผลการประเมินระดับ</div>
                    <div style={{ fontSize: '36px', fontWeight: 'bold', color: resultData.isPass ? '#166534' : '#991b1b' }}>
                        {resultData.isPass ? `ระดับ ${resultData.targetLevel || 1}` : 'ไม่ผ่าน'}
                    </div>
                </div>

                <button 
                    onClick={handleFinish} 
                    style={{...btnModalStyle, width: '100%', background: '#0f172a', color: 'white', fontSize: '20px', padding: '15px'}}
                >
                    ตกลง
                </button>
            </div>
        </div>
      )}

      
      <main className="worker-main" style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 20px' }}>
        
        <div style={{ marginBottom: '24px' }}>
          <button 
            onClick={() => navigate(-1)} 
            style={{ 
              background: 'white', 
              border: '1px solid #e2e8f0', 
              color: '#475569', 
              cursor: 'pointer', 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '8px', 
              fontWeight: '600',
              padding: '10px 20px',
              borderRadius: '30px',
              fontSize: '14px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateX(-3px)';
              e.currentTarget.style.color = '#2563eb';
              e.currentTarget.style.borderColor = '#2563eb';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateX(0)';
              e.currentTarget.style.color = '#475569';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            <i className='bx bx-arrow-back' style={{ fontSize: '18px' }}></i> ย้อนกลับ
          </button>
        </div>

        <section className="dash-content" style={{ paddingBottom: '50px' }}>
          {/* Header Card คะแนน Realtime */}
          <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', padding: '30px', borderRadius: '20px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>
             <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <div style={{ width: '50px', height: '50px', background: '#3b82f6', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontSize: '20px', fontWeight: 'bold' }}>
                    {displayWorker.name.charAt(0)}
                </div>
                <div>
                    <h3 style={{ margin: 0, color: 'white' }}>{displayWorker.name}</h3>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '4px' }}>
                        <span style={{ color: '#94a3b8', fontSize: '14px' }}>ตำแหน่ง: {displayWorker.roleName}</span>
                        <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>1:1 Assessment Mode</span>
                    </div>
                </div>
             </div>
             <div style={{ textAlign: 'right' }}>
                 <div style={{ fontSize: '12px', color: '#94a3b8' }}>คะแนนรวมปัจจุบัน</div>
                 <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>{totalScore} <span style={{ fontSize: '16px', color: '#94a3b8' }}>/ 72</span></div>
                 <div style={{ fontSize: '14px', fontWeight: '600', color: grade.includes('A') ? '#10b981' : grade.includes('D') ? '#ef4444' : '#f59e0b' }}>
                    เกรด: {grade}
                 </div>
             </div>
          </div>

          {submittedWork && (
            <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px 24px', marginBottom: '24px', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)' }}>
              <h3 style={{ margin: '0 0 14px', color: '#1e293b', fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className='bx bx-task' style={{ color: '#2563eb', fontSize: '20px' }}></i>
                รายละเอียดงานที่ช่างส่ง
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '12px' }}>
                <div>
                  <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>งาน</div>
                  <div style={{ color: '#0f172a', fontWeight: 600 }}>{displayTaskTitle}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>วันที่ส่ง</div>
                  <div style={{ color: '#0f172a', fontWeight: 600 }}>
                    {submittedWork?.submittedAt ? new Date(submittedWork.submittedAt).toLocaleString('th-TH') : '-'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>รูปภาพผลงาน</div>
                  <div style={{ color: '#0f172a', fontWeight: 600 }}>{submittedWork?.photo || '-'}</div>
                </div>
              </div>
              {submittedPhotoUrl && (
                <div style={{ marginBottom: '12px' }}>
                  <img
                    src={submittedPhotoUrl}
                    alt="ผลงานที่ช่างส่ง"
                    style={{ maxWidth: '100%', maxHeight: '260px', borderRadius: '12px', border: '1px solid #e2e8f0', objectFit: 'contain', background: '#f8fafc' }}
                  />
                </div>
              )}
              <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>รายละเอียดจากช่าง</div>
                <div style={{ color: '#334155', lineHeight: 1.55 }}>{submittedWork?.description || '-'}</div>
              </div>
            </div>
          )}

          {/* Stepper Indicator */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '35px', position: 'relative', padding: '0 10px' }}>
              <div style={{ position: 'absolute', top: '20px', left: '40px', right: '40px', height: '2px', background: '#e2e8f0', zIndex: 0 }}></div>
              {sectionKeys.map((key, index) => (
                  <div 
                    key={key} 
                    style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: index <= currentStep ? 'pointer' : 'not-allowed' }} 
                    onClick={() => index <= currentStep && setCurrentStep(index)}
                  >
                      <div style={{ 
                          width: '40px', height: '40px', borderRadius: '50%', 
                          background: index === currentStep ? '#2563eb' : (index < currentStep ? '#10b981' : 'white'),
                          color: index <= currentStep ? 'white' : '#64748b',
                          border: '2px solid',
                          borderColor: index === currentStep ? '#2563eb' : (index < currentStep ? '#10b981' : '#e2e8f0'),
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold',
                          transition: 'all 0.3s',
                          boxShadow: index === currentStep ? '0 0 0 4px rgba(37, 99, 235, 0.1)' : 'none'
                      }}>
                          {index < currentStep ? <i className='bx bx-check'></i> : index + 1}
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: index === currentStep ? '#2563eb' : '#64748b' }}>{key.split('.')[0]}</span>
                  </div>
              ))}
          </div>

          {/* Progress Bar */}
          <div style={{ background: 'white', padding: '15px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', marginBottom: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#475569' }}>
              <span>ความคืบหน้าภาพรวม</span>
              <span>{Object.keys(evaluations).length} / {allQuestions.length} ข้อ</span>
            </div>
            <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: '#3b82f6', transition: 'width 0.3s ease' }}></div>
            </div>
          </div>

          <form onSubmit={handlePreSubmit}>
            {/* Render only current section */}
            {(() => {
                const sectionTitle = sectionKeys[currentStep];
                const section = criteriaData[sectionTitle];
                return (
                  <div key={sectionTitle} className="animate-slide-up" style={{ background: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', marginBottom: '25px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                      <div style={{ background: '#f8fafc', padding: '20px 25px', borderBottom: '1px solid #e2e8f0', fontWeight: '800', color: '#1e293b', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '36px', height: '36px', background: '#eff6ff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                          <i className={`bx ${section.icon}`}></i>
                        </div>
                        {sectionTitle}
                      </div>
                      <div style={{ padding: '10px 25px' }}>
                          {section.items.map((item, index) => (
                              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0', borderBottom: index !== section.items.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                  <div style={{ flex: 1, paddingRight: '30px', color: '#334155', fontSize: '15px', fontWeight: '500', lineHeight: '1.5' }}>{item.text}</div>
                                  <div style={{ display: 'flex', gap: '10px' }}>
                                      {[1, 2, 3, 4].map((score) => (
                                          <button key={score} type="button" onClick={() => handleRatingChange(item.id, score)}
                                              style={{
                                                  width: '42px', height: '42px', borderRadius: '10px', border: '2px solid',
                                                  borderColor: evaluations[item.id] === score ? '#2563eb' : '#e2e8f0',
                                                  background: evaluations[item.id] === score ? '#eff6ff' : 'white',
                                                  color: evaluations[item.id] === score ? '#2563eb' : '#64748b',
                                                  fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s',
                                                  fontSize: '16px'
                                              }}
                                              onMouseOver={(e) => { if(evaluations[item.id] !== score) e.currentTarget.style.borderColor = '#cbd5e1'; }}
                                              onMouseOut={(e) => { if(evaluations[item.id] !== score) e.currentTarget.style.borderColor = '#e2e8f0'; }}
                                          >{score}</button>
                                      ))}
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
                );
            })()}

            {currentStep === sectionKeys.length - 1 && (
              <div className="animate-slide-up" style={{ background: 'white', padding: '25px', borderRadius: '20px', border: '1px solid #e2e8f0', marginBottom: '25px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                  <label style={{ display: 'block', marginBottom: '12px', fontWeight: '700', color: '#1e293b', fontSize: '16px' }}>
                    <i className='bx bx-comment-detail' style={{ marginRight: '8px', color: '#3b82f6' }}></i>
                    ความคิดเห็นเพิ่มเติม
                  </label>
                  <textarea rows="4" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="ระบุข้อเสนอแนะหรือจุดที่ควรปรับปรุงของช่าง..." style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', transition: 'border-color 0.2s' }} onFocus={(e) => e.target.style.borderColor = '#3b82f6'} onBlur={(e) => e.target.style.borderColor = '#cbd5e1'} />
              </div>
            )}

            {/* Navigation Buttons */}
            <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                {currentStep > 0 && (
                    <button 
                      type="button" 
                      onClick={handleBack} 
                      style={{ flex: 1, padding: '16px', background: 'white', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                    >
                        ย้อนกลับ
                    </button>
                )}
                {currentStep < sectionKeys.length - 1 ? (
                    <button 
                      type="button" 
                      onClick={(e) => { e.preventDefault(); handleNext(e); }} 
                      style={{ flex: 2, padding: '16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)', transition: 'all 0.2s' }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#1d4ed8'}
                      onMouseOut={(e) => e.currentTarget.style.background = '#2563eb'}
                    >
                        ขั้นตอนถัดไป <i className='bx bx-right-arrow-alt' style={{ marginLeft: '8px' }}></i>
                    </button>
                ) : (
                    <button 
                      type="submit" 
                      disabled={isSubmitting} 
                      style={{ flex: 2, padding: '16px', background: isSubmitting ? '#94a3b8' : '#22c55e', color: 'white', border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(34, 197, 94, 0.2)', transition: 'all 0.2s' }}
                      onMouseOver={(e) => { if(!isSubmitting) e.currentTarget.style.background = '#16a34a'; }}
                      onMouseOut={(e) => { if(!isSubmitting) e.currentTarget.style.background = '#22c55e'; }}
                    >
                        {isSubmitting ? 'กำลังบันทึกข้อมูล...' : '✅ ยืนยันผลการประเมิน'}
                    </button>
                )}
            </div>
          </form>
        </section>
      </main>
    
      <LogoutModal show={showLogoutModal} onClose={() => setShowLogoutModal(false)} />
  </div>
  );
};

export default ForemanAssessment;
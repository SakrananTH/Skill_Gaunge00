import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../pm/WKDashboard.css';
import { apiRequest } from '../../utils/api';
import { performLogout } from '../../utils/logout';

const ForemanAssessment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const worker = location.state?.worker;

  const displayWorker = worker || { 
    name: 'ตัวอย่าง ชื่อช่าง', 
    roleName: 'ช่างทั่วไป', 
    id: 999 
  };

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

  const handleRatingChange = (id, value) => {
    setEvaluations(prev => ({ ...prev, [id]: value }));
  };

  const handlePreSubmit = (e) => {
    e.preventDefault();
    const questions = Object.values(criteriaData).flatMap((section) => section.items);
    
    if (Object.keys(evaluations).length < questions.length) {
        alert(`กรุณาประเมินให้ครบทุกข้อ (${Object.keys(evaluations).length}/${questions.length})`);
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

      setResultData({
        theoryScore: '-',
        practicalScore: `${percent.toFixed(2)}%`,
        totalScore: totalScore,
        isPass: percent >= 60,
        targetLevel: percent >= 60 ? 1 : '-'
      });
      setShowResultModal(true);

    } catch (err) {
        console.error("Submit Error:", err);
      alert(err?.message || "เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์");
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
    if (window.confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
        performLogout(navigate);
    }
  };

  return (
    <div className="dash-window" style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: "'Kanit', sans-serif" }}>
      
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
                            <span>{resultData.theoryScore} คะแนน</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>คะแนนภาคปฏิบัติ</span>
                            <span>{resultData.practicalScore} คะแนน</span>
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
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
            <i className='bx bx-left-arrow-alt' style={{ fontSize: '20px' }}></i> ย้อนกลับ
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
                    <h3 style={{ margin: 0, color: '#1e293b' }}>{displayWorker.name}</h3>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '4px' }}>
                        <span style={{ color: '#64748b', fontSize: '14px' }}>ตำแหน่ง: {displayWorker.roleName}</span>
                        <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>1:1 Assessment Mode</span>
                    </div>
                </div>
             </div>
             <div style={{ textAlign: 'right' }}>
                 <div style={{ fontSize: '12px', color: '#64748b' }}>คะแนนรวมปัจจุบัน</div>
                 <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>{totalScore} <span style={{ fontSize: '16px', color: '#94a3b8' }}>/ 72</span></div>
                 <div style={{ fontSize: '14px', fontWeight: '600', color: grade.includes('A') ? '#10b981' : grade.includes('D') ? '#ef4444' : '#f59e0b' }}>
                    เกรด: {grade}
                 </div>
             </div>
          </div>

        {/* Progress Bar */}
        <div style={{ position: 'sticky', top: '20px', zIndex: 40, background: 'white', padding: '15px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#475569' }}>
            <span>ความคืบหน้าการประเมิน</span>
            <span>{Object.keys(evaluations).length} / {allQuestions.length} ข้อ</span>
          </div>
          <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: '#3b82f6', transition: 'width 0.3s ease' }}></div>
          </div>
        </div>

          <form onSubmit={handlePreSubmit}>
            {Object.entries(criteriaData).map(([sectionTitle, section]) => (
                <div key={sectionTitle} style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px', overflow: 'hidden' }}>
                    <div style={{ background: '#f8fafc', padding: '15px 20px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold', color: '#334155', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <i className={`bx ${section.icon}`} style={{ color: '#3b82f6', fontSize: '20px' }}></i>
                      {sectionTitle}
                    </div>
                    <div style={{ padding: '0 20px' }}>
                        {section.items.map((item, index) => (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: index !== section.items.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                <div style={{ flex: 1, paddingRight: '20px', color: '#1e293b', fontSize: '14px' }}>{item.text}</div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {[1, 2, 3, 4].map((score) => (
                                        <button key={score} type="button" onClick={() => handleRatingChange(item.id, score)}
                                            style={{
                                                width: '36px', height: '36px', borderRadius: '8px', border: '1px solid',
                                                borderColor: evaluations[item.id] === score ? '#3b82f6' : '#cbd5e1',
                                                background: evaluations[item.id] === score ? '#eff6ff' : 'white',
                                                color: evaluations[item.id] === score ? '#3b82f6' : '#64748b',
                                                fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s'
                                            }}
                                        >{score}</button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            <div style={{ background: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600', color: '#334155' }}>ความคิดเห็นเพิ่มเติม</label>
                <textarea rows="4" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="ระบุข้อเสนอแนะ..." style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px' }} />
            </div>

            <button type="submit" disabled={isSubmitting} style={{ width: '100%', padding: '16px', background: isSubmitting ? '#94a3b8' : '#22c55e', color: 'white', border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
                {isSubmitting ? 'กำลังบันทึกข้อมูล...' : '✅ ยืนยันผลการประเมิน'}
            </button>
          </form>
        </section>
      </main>
    
  </div>
  );
};

export default ForemanAssessment;
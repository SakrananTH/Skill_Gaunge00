import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../pm/WKDashboard.css';

const ForemanAssessment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const worker = location.state?.worker;

  const displayWorker = worker || { 
    name: 'ตัวอย่าง ชื่อช่าง', 
    roleName: 'ช่างทั่วไป', 
    id: 999 
  };

  // ✅ หัวข้อการประเมินใหม่ตามไฟล์ PDF (หมวด A-F)
  const criteriaData = {
    "A. ความเข้าใจงาน & ความพร้อม": [
      { id: "a1", text: "1. เข้าใจแบบ งานสั่ง หรือคำอธิบายงานได้ถูกต้อง" },
      { id: "a2", text: "2. การวัดและการคำนวณ (Correct measurements)" },
      { id: "a3", text: "3. การใช้เครื่องมือถูกต้องเหมาะสม" }
    ],
    "B. วิธีการทำงาน": [
      { id: "b1", text: "4. การปฏิบัติงานตามขั้นตอนและวิธีการที่ถูกต้อง" },
      { id: "b2", text: "5. ปฏิบัติตามขั้นตอนความปลอดภัยในการทำงาน" }
    ],
    "C. คุณภาพและความถูกต้องของงาน": [
      { id: "c1", text: "6. ตำแหน่ง ระดับ แนว และมุมของงานถูกต้องตามที่กำหนด" },
      { id: "c2", text: "7. งานทำตามแบบและข้อกำหนดที่ได้รับ" },
      { id: "c3", text: "8. ความแข็งแรงและความคงทนของงาน" },
      { id: "c4", text: "9. ความเรียบร้อยและความละเอียดของงาน" }
    ],
    "D. ประสิทธิภาพในการทำงาน": [
      { id: "d1", text: "10. ทำงานได้ทันตามเวลาที่กำหนดและทำงานต่อเนื่อง" },
      { id: "d2", text: "11. บริหารเวลาและลำดับงานได้เหมาะสม" },
      { id: "d3", text: "12. ทำงานร่วมกับผู้อื่นได้ดี ไม่เป็นอุปสรรคต่อทีม" }
    ],
    "E. ความปลอดภัยเชิงพฤติกรรม": [
      { id: "e1", text: "13. หลีกเลี่ยงพฤติกรรมเสี่ยงและแจ้งเมื่อพบความเสี่ยง" },
      { id: "e2", text: "14. ใช้อุปกรณ์ป้องกันส่วนบุคคลครบถ้วนและถูกต้อง" }
    ],
    "F. ความรับผิดชอบและทัศนคติ": [
      { id: "f1", text: "15. ตรงต่อเวลาและพร้อมทำงาน" },
      { id: "f2", text: "16. รับผิดชอบต่องานที่ได้รับมอบหมายจนแล้วเสร็จ" },
      { id: "f3", text: "17. แก้ไขปัญหาที่เกิดขึ้นได้ ไม่หลีกเลี่ยงความรับผิดชอบ" },
      { id: "f4", text: "18. ปฏิบัติตามคำสั่งและข้อตกลงของผู้ควบคุมงาน" }
    ]
  };

  const [evaluations, setEvaluations] = useState({});
  const [comment, setComment] = useState('');
  const [totalScore, setTotalScore] = useState(0);
  const [grade, setGrade] = useState('-');

  useEffect(() => {
    const values = Object.values(evaluations);
    if (values.length === 0) return;
    
    const sum = values.reduce((acc, cur) => acc + cur, 0);
    // คะแนนเต็มใหม่คือ 18 ข้อ x 4 คะแนน = 72
    const maxScore = 18 * 4; 
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

  const handleSubmit = (e) => {
    e.preventDefault();
    const allQuestions = Object.values(criteriaData).flat();
    if (Object.keys(evaluations).length < allQuestions.length) {
        alert(`กรุณาประเมินให้ครบทุกข้อ (${Object.keys(evaluations).length}/${allQuestions.length})`);
        return;
    }
    alert(`บันทึกเรียบร้อย!\nช่าง: ${displayWorker.name}\nคะแนนรวม: ${totalScore} (${grade})`);
    navigate('/foreman');
  };

  return (
    <div className="dash-layout">
      <aside className="dash-sidebar">
        <nav className="menu">
            <div style={{ padding: '20px', textAlign: 'center', fontWeight: 'bold', color: '#1e293b' }}>
                Foreman Panel
            </div>
            <button className="menu-item" onClick={() => navigate('/foreman')}>Dashboard</button>
            <button className="menu-item active">ประเมินผลงาน</button>
            <button className="menu-item" onClick={() => navigate('/foreman-settings')}>ตั้งค่า</button>
            <button className="menu-item" onClick={() => navigate('/foreman')} style={{ marginTop: 'auto', background: '#f1f5f9', color: '#64748b' }}>
                &larr; ย้อนกลับ
            </button>
        </nav>
      </aside>

      <main className="dash-main">
        <header className="dash-header">
           <div className="header-info">
             <h1>แบบประเมินผลงานช่าง (On-site Assessment)</h1>
             <p>โครงการ: The Zenith (โซน B)</p>
           </div>
        </header>

        <section className="dash-content" style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '50px' }}>
          
          <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
             <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <div style={{ width: '50px', height: '50px', background: '#3b82f6', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontSize: '20px', fontWeight: 'bold' }}>
                    {displayWorker.name.charAt(0)}
                </div>
                <div>
                    <h3 style={{ margin: 0, color: '#1e293b' }}>{displayWorker.name}</h3>
                    <span style={{ color: '#64748b', fontSize: '14px' }}>ตำแหน่ง: {displayWorker.roleName}</span>
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

          <form onSubmit={handleSubmit}>
            {Object.entries(criteriaData).map(([sectionTitle, items]) => (
                <div key={sectionTitle} style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px', overflow: 'hidden' }}>
                    <div style={{ background: '#f8fafc', padding: '15px 20px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold', color: '#334155', fontSize: '16px' }}>
                        {sectionTitle}
                    </div>
                    <div style={{ padding: '0 20px' }}>
                        {items.map((item, index) => (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: index !== items.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                <div style={{ flex: 1, paddingRight: '20px', color: '#1e293b', fontSize: '14px' }}>
                                    {item.text}
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {[1, 2, 3, 4].map((score) => (
                                        <button
                                            key={score}
                                            type="button"
                                            onClick={() => handleRatingChange(item.id, score)}
                                            style={{
                                                width: '36px', height: '36px', borderRadius: '8px', border: '1px solid',
                                                borderColor: evaluations[item.id] === score ? '#3b82f6' : '#cbd5e1',
                                                background: evaluations[item.id] === score ? '#eff6ff' : 'white',
                                                color: evaluations[item.id] === score ? '#3b82f6' : '#64748b',
                                                fontWeight: 'bold', cursor: 'pointer'
                                            }}
                                        >
                                            {score}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            <div style={{ background: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600', color: '#334155' }}>ความคิดเห็นเพิ่มเติม</label>
                <textarea 
                    rows="4"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="ระบุข้อเสนอแนะ..."
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                />
            </div>

            <button type="submit" style={{ width: '100%', padding: '16px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>
                ✅ ยืนยันผลการประเมิน
            </button>
          </form>
        </section>
      </main>
    </div>
  );
};

export default ForemanAssessment;
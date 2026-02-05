import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
// import { API_BASE_URL } from '../../utils/api'; 

const SkillAssessmentTest = () => {
  const navigate = useNavigate();
  
  // State หลัก
  const [step, setStep] = useState('intro'); 
  const [questions, setQuestions] = useState([]); 
  
  // Config เริ่มต้น
  const [examConfig, setExamConfig] = useState({ 
      duration_minutes: 60, 
      total_questions: 60,
      cat_rebar_percent: 25, cat_concrete_percent: 25, cat_formwork_percent: 20,
      cat_element_percent: 20, cat_theory_percent: 10,
      level_1_percent: 40, level_2_percent: 40, level_3_percent: 20
  }); 

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0); 
  
  // State สำหรับ Modal (ป็อปอัพ)
  const [warningModal, setWarningModal] = useState({ show: false, message: '' }); // แจ้งเตือน (ปุ่ม OK)
  const [showConfirmModal, setShowConfirmModal] = useState(false); // ยืนยันส่ง (ปุ่ม ยืนยัน/ยกเลิก)

  const timerRef = useRef(null); 
  const questionsPerPage = 15; 

  // --- Logic การดึงข้อมูล (เหมือนเดิม) ---
  useEffect(() => {
    const fetchExamData = async () => {
        setLoading(true);
        try {
          const API = 'http://localhost:4000'; 
          const token = localStorage.getItem('token');
          const res = await fetch(`${API}/api/skillAssessment/test`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!res.ok) throw new Error('Failed to fetch exam data');
          const data = await res.json();
          if (data) {
            if (data.questions) {
                const transformedQuestions = data.questions.map(q => ({
                    id: q.id,
                    text: q.question_text,
                    choices: [q.choice_a, q.choice_b, q.choice_c, q.choice_d]
                }));
                setQuestions(transformedQuestions);
            }
            if (data.exam_config) {
                setExamConfig(data.exam_config);
                setTimeLeft(data.exam_config.duration_minutes * 60);
            }
          }
        } catch (err) {
          console.error("Error fetching data:", err);
          setError("ไม่สามารถดึงข้อมูลข้อสอบได้");
        } finally {
          setLoading(false);
        }
    };
    fetchExamData();
  }, []);

  // --- Timer Logic (เหมือนเดิม) ---
  useEffect(() => {
    if (step === 'test' && timeLeft > 0) {
        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    handleTimeoutSubmit(); 
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [step]); 

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleAnswer = (qId, choiceIndex) => {
    setAnswers(prev => ({ ...prev, [qId]: choiceIndex }));
  };

  // --- Helper เปิด Modal แจ้งเตือน ---
  const showWarning = (msg) => {
    setWarningModal({ show: true, message: msg });
  };

  // --- Navigation & Validation ---
  const jumpToQuestion = (qId) => {
    const qIndex = questions.findIndex(q => q.id === qId);
    const targetPage = Math.ceil((qIndex + 1) / questionsPerPage);

    if (targetPage <= currentPage) {
        setCurrentPage(targetPage);
        scrollToQuestion(qId);
        return;
    }

    const indexOfLastQ = currentPage * questionsPerPage;
    const indexOfFirstQ = indexOfLastQ - questionsPerPage;
    const currentQIds = questions.slice(indexOfFirstQ, indexOfLastQ).map(q => q.id);
    const unanswered = currentQIds.filter(id => answers[id] === undefined);

    if (unanswered.length > 0) {
        showWarning(`กรุณาทำข้อสอบในหน้านี้ให้ครบทุกข้อก่อน (${unanswered.length} ข้อที่เหลือ)`);
        return;
    }
    if (targetPage > currentPage + 1) {
        showWarning(`กรุณาทำข้อสอบเรียงตามลำดับหน้า`);
        return;
    }
    setCurrentPage(targetPage);
    scrollToQuestion(qId);
  };

  const scrollToQuestion = (qId) => {
    setTimeout(() => {
        const element = document.getElementById(`q-${qId}`);
        if(element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }

  const handleNextPage = () => {
    const indexOfLastQ = currentPage * questionsPerPage;
    const indexOfFirstQ = indexOfLastQ - questionsPerPage;
    const currentQIds = questions.slice(indexOfFirstQ, indexOfLastQ).map(q => q.id);
    const unanswered = currentQIds.filter(id => answers[id] === undefined);

    if (unanswered.length > 0) {
        showWarning(`กรุณาทำข้อสอบในหน้านี้ให้ครบทุกข้อก่อน (${unanswered.length} ข้อที่เหลือ)`);
        return;
    }
    setCurrentPage(prev => prev + 1);
    window.scrollTo(0, 0);
  };

  const handleTimeoutSubmit = async () => {
    showWarning("หมดเวลาสอบ! ระบบจะส่งคำตอบของคุณโดยอัตโนมัติ");
    await submitToBackend();
  };

  // --- Logic การกดปุ่มส่ง (เปลี่ยนจาก window.confirm เป็น showConfirmModal) ---
  const handlePreSubmit = () => {
    const unansweredCount = questions.length - Object.keys(answers).length;
    if (unansweredCount > 0) {
        showWarning(`คุณยังทำข้อสอบไม่ครบ ${unansweredCount} ข้อ`);
        return;
    }
    setShowConfirmModal(true); // เปิด Modal ยืนยัน
  };

  // ฟังก์ชันยิง API (ใช้ร่วมกัน)
  const submitToBackend = async () => {
    setShowConfirmModal(false); // ปิด Modal (ถ้าเปิดอยู่)
    try {
        const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : {};
        const token = localStorage.getItem('token');
        const choiceMap = ['A', 'B', 'C', 'D'];
        const formattedAnswers = {};
        Object.keys(answers).forEach(qId => {
            formattedAnswers[qId] = choiceMap[answers[qId]];
        });

        const API = 'http://localhost:4000';
        const res = await fetch(`${API}/api/skillAssessment/submit`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              user_id: user.id,
              answers: formattedAnswers
            })
        });
        if (!res.ok) throw new Error('submit failed');
        setStep('review'); 
        window.scrollTo(0, 0);
    } catch (err) {
        console.error("Error submitting:", err);
        setStep('review');
    }
  };

  // --- Styles สำหรับ Modal ---
  const modalOverlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
    display: 'flex', justifyContent: 'center', alignItems: 'center'
  };
  const modalContentStyle = {
    background: 'white', padding: '30px', borderRadius: '8px', 
    width: '90%', maxWidth: '400px', textAlign: 'center', 
    boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
  };
  const btnStyle = {
    padding: '10px 20px', borderRadius: '4px', border: 'none', 
    cursor: 'pointer', fontSize: '16px', margin: '0 10px'
  };

  // --- Step 1: Intro ---
  if (step === 'intro') {
    return (
      <div style={{ minHeight: '100vh', background: '#f4f6f9', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', fontFamily: 'sans-serif' }}>
        <div style={{ background: 'white', maxWidth: '800px', width: '100%', padding: '40px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', borderTop: '5px solid #2c3e50' }}>
          
          <h2 style={{ color: '#2c3e50', textAlign: 'center', marginBottom: '30px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
            ข้อตกลงและเงื่อนไขการสอบ
          </h2>
          
          <div style={{ marginBottom: '25px', padding: '20px', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #e9ecef' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#34495e', fontSize: '18px' }}>เงื่อนไขการสอบ</h3>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#555', lineHeight: '1.8' }}>
              <li>เวลาในการทำข้อสอบ: <strong>{examConfig.duration_minutes} นาที</strong></li>
              <li>จำนวนข้อสอบ: <strong>{examConfig.total_questions} ข้อ</strong> (ทำทีละหน้า)</li>
              <li>ต้องทำครบทุกข้อในหน้าปัจจุบันจึงจะเปลี่ยนหน้าได้</li>
              <li>เมื่อหมดเวลา ระบบจะส่งคำตอบอัตโนมัติ (ข้อที่ทำไม่ทันจะได้ 0 คะแนน)</li>
            </ul>
          </div>

          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '30px' }}>
              {/* ตารางที่ 1: โครงสร้างเนื้อหา */}
              <div style={{ flex: 1, minWidth: '300px' }}>
                <h3 style={{ fontSize: '18px', color: '#34495e', marginBottom: '10px' }}>โครงสร้างเนื้อหา</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                        <tr style={{ background: '#f1f2f6', color: '#555' }}>
                            <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ddd' }}>หัวข้อการประเมิน</th>
                            <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>น้ำหนัก</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td style={{ padding: '8px', border: '1px solid #ddd' }}>1. งานเหล็กเสริม (Rebar)</td><td style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>{examConfig.cat_rebar_percent}%</td></tr>
                        <tr><td style={{ padding: '8px', border: '1px solid #ddd' }}>2. งานคอนกรีต (Concrete)</td><td style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>{examConfig.cat_concrete_percent}%</td></tr>
                        <tr><td style={{ padding: '8px', border: '1px solid #ddd' }}>3. งานไม้แบบ (Formwork)</td><td style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>{examConfig.cat_formwork_percent}%</td></tr>
                        <tr><td style={{ padding: '8px', border: '1px solid #ddd' }}>4. องค์อาคาร (คาน/เสา/ฐานราก)</td><td style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>{examConfig.cat_element_percent}%</td></tr>
                        <tr><td style={{ padding: '8px', border: '1px solid #ddd' }}>5. การออกแบบ/ทฤษฎี</td><td style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>{examConfig.cat_theory_percent}%</td></tr>
                    </tbody>
                </table>
              </div>
              {/* ตารางที่ 2: โครงสร้างระดับ */}
              <div style={{ flex: 1, minWidth: '250px' }}>
                <h3 style={{ fontSize: '18px', color: '#34495e', marginBottom: '10px' }}>โครงสร้างระดับความยาก</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                        <tr style={{ background: '#f1f2f6', color: '#555' }}>
                            <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ddd' }}>ระดับ</th>
                            <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>น้ำหนัก</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td style={{ padding: '8px', border: '1px solid #ddd' }}>ระดับ 1 (พื้นฐาน)</td><td style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>{examConfig.level_1_percent}%</td></tr>
                        <tr><td style={{ padding: '8px', border: '1px solid #ddd' }}>ระดับ 2 (ปานกลาง)</td><td style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>{examConfig.level_2_percent}%</td></tr>
                        <tr><td style={{ padding: '8px', border: '1px solid #ddd' }}>ระดับ 3 (ยาก)</td><td style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>{examConfig.level_3_percent}%</td></tr>
                    </tbody>
                </table>
              </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => navigate('/worker')} style={{ flex: 1, padding: '12px', background: 'white', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}>ยกเลิก</button>
            <button onClick={() => setStep('test')} style={{ flex: 2, padding: '12px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>เริ่มทำข้อสอบ</button>
          </div>
        </div>
      </div>
    );
  }

  // --- Step 3: Review ---
  if (step === 'review') {
    return (
       <div style={{ minHeight: '100vh', background: '#f4f6f9', padding: '50px 20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <div style={{ background: 'white', maxWidth: '600px', margin: '0 auto', padding: '40px', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
             <h2 style={{ color: '#27ae60', margin: '0 0 15px 0' }}>ส่งคำตอบเรียบร้อยแล้ว</h2>
             <p style={{ fontSize: '18px', color: '#555', margin: '10px 0' }}>โปรดรอการประเมินถัดไป</p>
             <p style={{ fontSize: '16px', color: '#777', marginTop: '5px' }}>จาก Foreman</p>
             <div style={{ marginTop: '40px' }}>
                <button onClick={() => navigate('/worker')} style={{ padding: '12px 30px', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}>กลับหน้าหลัก</button>
             </div>
          </div>
       </div>
    );
  }

  // --- Step 2: Test ---
  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>กำลังโหลด...</div>;
  if (error) return <div style={{ padding: '50px', textAlign: 'center', color: 'red' }}>{error}</div>;

  const indexOfLastQ = currentPage * questionsPerPage;
  const indexOfFirstQ = indexOfLastQ - questionsPerPage;
  const currentQuestions = questions.slice(indexOfFirstQ, indexOfLastQ);
  const totalPages = Math.ceil(questions.length / questionsPerPage);
  const timerColor = timeLeft < 300 ? '#e74c3c' : '#2c3e50';

  return (
    <div style={{ backgroundColor: '#f0f2f5', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', position: 'relative' }}>
       
       {/* === MODAL 1: Warning (แจ้งเตือน) === */}
       {warningModal.show && (
         <div style={modalOverlayStyle}>
           <div style={modalContentStyle}>
             <h3 style={{ margin: '0 0 15px 0', color: '#e74c3c' }}>แจ้งเตือน</h3>
             <p style={{ fontSize: '16px', color: '#555', marginBottom: '20px' }}>{warningModal.message}</p>
             <button 
                onClick={() => setWarningModal({ show: false, message: '' })}
                style={{ ...btnStyle, background: '#3498db', color: 'white' }}
             >
                ตกลง
             </button>
           </div>
         </div>
       )}

       {/* === MODAL 2: Confirm (ยืนยันส่ง) === */}
       {showConfirmModal && (
         <div style={modalOverlayStyle}>
           <div style={modalContentStyle}>
             <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>ยืนยันการส่งคำตอบ?</h3>
             <p style={{ fontSize: '14px', color: '#777', marginBottom: '20px' }}>เมื่อส่งแล้วจะไม่สามารถแก้ไขได้อีก</p>
             <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button 
                    onClick={() => setShowConfirmModal(false)}
                    style={{ ...btnStyle, background: '#95a5a6', color: 'white' }}
                >
                    ยกเลิก
                </button>
                <button 
                    onClick={submitToBackend}
                    style={{ ...btnStyle, background: '#27ae60', color: 'white' }}
                >
                    ยืนยัน
                </button>
             </div>
           </div>
         </div>
       )}

       <header style={{ background: '#fff', height: '60px', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', position: 'sticky', top: 0, zIndex: 100 }}>
            <h3 style={{ margin: 0, color: '#2c3e50' }}>แบบทดสอบวัดทักษะ</h3>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: timerColor, background: '#f8f9fa', padding: '5px 15px', borderRadius: '4px', border: `1px solid ${timerColor}` }}>
                เวลาที่เหลือ: {formatTime(timeLeft)}
            </div>
            <span style={{ fontSize: '14px', background: '#e3f2fd', color: '#1565c0', padding: '5px 12px', borderRadius: '20px', fontWeight: 'bold' }}>
                หน้า {currentPage} / {totalPages}
            </span>
       </header>

       <div style={{ maxWidth: '1100px', margin: '20px auto', width: '100%', padding: '0 20px', display: 'flex', gap: '25px', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
                {currentQuestions.map((q, index) => {
                    const displayNum = indexOfFirstQ + index + 1;
                    return (
                        <div key={q.id} id={`q-${q.id}`} style={{ background: 'white', padding: '25px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '15px', color: '#333', fontSize: '16px', lineHeight: '1.5' }}>{displayNum}. {q.text}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {q.choices.map((choice, cIdx) => (
                                    <label key={cIdx} style={{ display: 'flex', alignItems: 'center', padding: '12px 15px', border: answers[q.id] === cIdx ? '1px solid #3498db' : '1px solid #eee', borderRadius: '6px', cursor: 'pointer', background: answers[q.id] === cIdx ? '#f0f9ff' : 'white', transition: 'all 0.2s' }}>
                                        <input type="radio" name={`q-${q.id}`} checked={answers[q.id] === cIdx} onChange={() => handleAnswer(q.id, cIdx)} style={{ marginRight: '12px', accentColor: '#3498db' }} />
                                        <span style={{ color: answers[q.id] === cIdx ? '#2980b9' : '#555' }}>{choice}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    );
                })}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', marginBottom: '60px' }}>
                  <button disabled={currentPage === 1} onClick={() => { setCurrentPage(p => p - 1); window.scrollTo(0,0); }} style={{ padding: '12px 25px', background: currentPage === 1 ? '#eee' : 'white', color: currentPage === 1 ? '#aaa' : '#555', border: '1px solid #ccc', borderRadius: '4px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>&lt; ย้อนกลับ</button>
                  {currentPage < totalPages ? (
                    <button onClick={handleNextPage} style={{ padding: '12px 30px', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(52, 152, 219, 0.2)' }}>ถัดไป &gt;</button>
                  ) : (
                    <button onClick={handlePreSubmit} style={{ padding: '12px 30px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(39, 174, 96, 0.2)' }}>ส่งคำตอบ</button>
                  )}
                </div>
              </div>

              <div style={{ width: '320px', background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', position: 'sticky', top: '80px' }}>
                <h4 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>รายการคำถาม</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                  {questions.map((q, index) => {
                    const isAnswered = answers[q.id] !== undefined;
                    const pageOfQ = Math.ceil((index + 1) / questionsPerPage);
                    const isCurrentPage = pageOfQ === currentPage;
                    return (
                      <button key={q.id} onClick={() => jumpToQuestion(q.id)} style={{ width: '100%', aspectRatio: '1/1', display: 'flex', alignItems: 'center', justifyContent: 'center', border: isCurrentPage ? '2px solid #3498db' : (isAnswered ? '1px solid #2ecc71' : '1px solid #ddd'), borderRadius: '4px', background: isAnswered ? '#eafaf1' : 'white', color: isAnswered ? '#27ae60' : '#555', fontSize: '12px', fontWeight: isCurrentPage ? 'bold' : 'normal', cursor: 'pointer' }}>{index + 1}</button>
                    );
                  })}
                </div>
                <div style={{ marginTop: '15px', fontSize: '12px', textAlign: 'center', color: '#666' }}>ทำไปแล้ว {Object.keys(answers).length} / {questions.length} ข้อ</div>
            </div>
       </div>
    </div>
  );
};

export default SkillAssessmentTest;
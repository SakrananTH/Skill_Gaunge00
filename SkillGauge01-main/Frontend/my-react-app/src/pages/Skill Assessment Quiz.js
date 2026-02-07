import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import WorkerSidebar from '../components/WorkerSidebar';
import './Dashboard.css';
import './SkillAssessmentQuiz.css';
import { mockUser } from '../mock/mockData';
import { performLogout } from '../utils/logout';

const SkillAssessmentQuiz = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const apiBase = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000';

  const [user, setUser] = useState({ name: 'ผู้ใช้งาน', role: 'worker', id: '' });
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // { qid: choiceIndex }
  const [sessionId, setSessionId] = useState(null);
  const [timeLeft, setTimeLeft] = useState(3600); // ตั้งเวลาไว้ที่ 60 นาที (3600 วินาที)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // ดึงข้อมูลผู้ใช้จาก Session Storage
    const storedUser = sessionStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else if (location.state?.user) {
      setUser(location.state.user);
    }

    // ดึงข้อสอบจาก API
    const fetchQuestions = async () => {
      try {
        const res = await fetch(`${apiBase}/api/questions/structural?difficulty_level=1`);
        if (!res.ok) throw new Error('Failed to fetch questions');
        const data = await res.json();
        
        if (data.questions && Array.isArray(data.questions)) {
          setQuestions(data.questions);
          setSessionId(data.sessionId);
        } else {
          throw new Error('Invalid data format');
        }
      } catch (err) {
        console.error(err);
        setError('ไม่สามารถโหลดข้อมูลข้อสอบได้');
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [apiBase, location.state]);

  const handleSubmit = useCallback(async () => {
    if (loading) return;

    // ส่งคำตอบไปยัง API
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/worker/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id || 1,
          answers: answers,
          sessionId: sessionId
        })
      });

      if (res.ok) {
        const resultData = await res.json();
        // นำทางไปยังหน้าแสดงผลคะแนน (Result Page) พร้อมส่งข้อมูลคะแนนไปด้วย
        navigate('/skill-assessment/result', { state: { user, result: resultData } });
      } else {
        alert('เกิดข้อผิดพลาดในการส่งคำตอบ');
      }
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setLoading(false);
    }
  }, [apiBase, user, answers, sessionId, navigate, loading]);

  // ใช้ Ref เพื่อให้ Timer เรียกใช้ handleSubmit ล่าสุดได้โดยไม่ต้อง restart timer เมื่อ answers เปลี่ยน
  const submitRef = useRef(handleSubmit);
  useEffect(() => {
    submitRef.current = handleSubmit;
  }, [handleSubmit]);

  useEffect(() => {
    if (loading || questions.length === 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          submitRef.current(); // ส่งคำตอบอัตโนมัติเมื่อหมดเวลา
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, questions.length]);

  const q = questions[idx] || {};
  const total = questions.length;
  const percent = Math.round(((idx) / total) * 100);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleChoice = (choiceIndex) => {
    setAnswers((a) => ({ ...a, [q.id]: choiceIndex }));
  };

  const prev = () => setIdx((i) => Math.max(0, i - 1));
  const next = async () => {
    if (idx < total - 1) return setIdx(idx + 1);
    await handleSubmit();
  };

  if (loading) return <div className="dash-layout"><main className="dash-main" style={{ padding: '40px', textAlign: 'center' }}>กำลังโหลดข้อสอบ...</main></div>;
  if (error) return <div className="dash-layout"><main className="dash-main" style={{ padding: '40px', textAlign: 'center', color: 'red' }}>{error}</main></div>;

  return (
    <div className="dash-layout" style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Kanit', sans-serif" }}>
      <WorkerSidebar user={user} active="skill" />

      <main className="dash-main" style={{ flex: 1, padding: isMobile ? '20px 15px' : '40px', width: '100%', boxSizing: 'border-box' }}>
        <div className="dash-topbar" style={{ display: 'flex', justifyContent: isMobile ? 'center' : 'flex-end', flexWrap: 'wrap', gap: '10px', marginBottom: '20px', position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '10px 0' }}>
          <div className="timer-pill" style={{ background: timeLeft < 300 ? '#fef2f2' : '#f0f9ff', color: timeLeft < 300 ? '#ef4444' : '#0369a1', padding: '8px 16px', borderRadius: '20px', fontWeight: '700', border: '1px solid currentColor', fontSize: isMobile ? '14px' : '16px' }}>
            ⏱️ เวลาคงเหลือ: {formatTime(timeLeft)}
          </div>
          <div className="role-pill" style={{ background: '#eff6ff', color: '#2563eb', padding: '8px 16px', borderRadius: '20px', fontWeight: '600', fontSize: isMobile ? '14px' : '16px' }}>
            {user?.role === 'worker' ? 'ช่าง (Worker)' : user?.role}
          </div>
        </div>

        <div className="quiz-page" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="progress" style={{ position: 'sticky', top: isMobile ? '50px' : '60px', zIndex: 9, background: '#f8fafc', paddingBottom: '10px' }}>
            <div className="bar" style={{ width: `${percent}%` }} />
            <div className="pct">{percent}%</div>
          </div>

          <h1 style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '800', color: '#1e293b', marginBottom: '10px' }}>คำถามที่ {idx + 1} จาก {total}</h1>
          <p className="question" style={{ fontSize: isMobile ? '16px' : '18px', lineHeight: '1.6', marginBottom: '25px' }}>{q.text}</p>

          <div className="choices" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {q.choices && q.choices.map((c, i) => (
              <label
                key={i}
                className={`choice ${answers[q.id] === i ? 'selected' : ''}`}
                role="radio"
                aria-checked={answers[q.id] === i}
                tabIndex={0}
                onClick={() => toggleChoice(i)}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleChoice(i); }
                }}
              >
                <input
                  type="radio"
                  name={q.id}
                  checked={answers[q.id] === i}
                  readOnly
                />
                <span className="bullet" />
                <span className="text">{c}</span>
              </label>
            ))}
          </div>

          <div className="nav-actions" style={{ display: 'flex', gap: '15px', marginTop: '40px', flexDirection: isMobile ? 'column-reverse' : 'row' }}>
            <button className="btn-secondary" onClick={prev} disabled={idx === 0} style={{ flex: 1, padding: '12px' }}>ก่อนหน้า</button>
            <button className="btn-primary" onClick={next} style={{ flex: 2, padding: '12px' }}>{idx === total - 1 ? 'ส่งคำตอบ' : 'ต่อไป'}</button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SkillAssessmentQuiz;

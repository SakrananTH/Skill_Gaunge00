import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
// import { API_BASE_URL } from '../../utils/api'; 

const SkillAssessmentTest = () => {
  const navigate = useNavigate();

  const tradeLabel = (value) => {
    const key = String(value || '').toLowerCase();
    const map = {
      structure: 'ช่างโครงสร้าง',
      plumbing: 'ช่างประปา',
      roofing: 'ช่างหลังคา',
      masonry: 'ช่างก่ออิฐฉาบปูน',
      aluminum: 'ช่างประตูหน้าต่างอลูมิเนียม',
      ceiling: 'ช่างฝ้าเพดาน',
      electric: 'ช่างไฟฟ้า',
      tiling: 'ช่างกระเบื้อง'
    };
    return map[key] || value || 'ช่างทั่วไป';
  };
  
  // State หลัก
  const [step, setStep] = useState('intro'); 
  const [questions, setQuestions] = useState([]); 
  const [user, setUser] = useState({ name: 'ผู้ใช้งาน', id: '', role: 'worker' });
  const [isScrolled, setIsScrolled] = useState(false);
  const resolvedTrade = user.technician_type || user.trade_type || user.tradeType || user.technicianType;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const storedUserStr = sessionStorage.getItem('user');
    const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;
    if (storedUser) {
      setUser(prev => ({ ...prev, ...storedUser }));
    }
    const storedUserId = sessionStorage.getItem('user_id');
    const resolvedUserId = storedUser?.id ?? storedUserId;
    const numericWorkerId = resolvedUserId && !Number.isNaN(Number(resolvedUserId))
      ? Number(resolvedUserId)
      : null;
    if (!resolvedUserId && !numericWorkerId) return;
    const apiBase = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000';
    const loadProfile = async ({ userId, workerId }) => {
      if (!userId && !workerId) return;
      try {
        const query = workerId
          ? `workerId=${encodeURIComponent(workerId)}`
          : `userId=${encodeURIComponent(userId)}`;
        const res = await fetch(`${apiBase}/api/worker/profile?${query}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data && typeof data === 'object') {
          setUser(prev => ({ ...prev, ...data }));
        }
      } catch (err) {
        console.error('Error fetching worker profile:', err);
      }
    };
    loadProfile({ userId: resolvedUserId, workerId: numericWorkerId });
  }, []);

  
  // Config เริ่มต้น
  const [examConfig, setExamConfig] = useState({ 
      duration_minutes: 60, 
      total_questions: 60,
      cat_rebar_percent: 25, cat_concrete_percent: 25, cat_formwork_percent: 20, cat_element_percent: 20, cat_theory_percent: 10
  }); 

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeQuestionId, setActiveQuestionId] = useState(null);
  const [selectedQuestionNumber, setSelectedQuestionNumber] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [hasCompleted, setHasCompleted] = useState(false);
  
  // Load answers from sessionStorage on mount
  const [answers, setAnswers] = useState(() => {
    const saved = sessionStorage.getItem('assessment_answers');
    return saved ? JSON.parse(saved) : {};
  });

  const [timeLeft, setTimeLeft] = useState(0); 
  const [pendingScrollId, setPendingScrollId] = useState(null);
  
  // State สำหรับ Modal (ป็อปอัพ)
  const [warningModal, setWarningModal] = useState({ show: false, message: '' }); // แจ้งเตือน (ปุ่ม OK)
  const [showConfirmModal, setShowConfirmModal] = useState(false); // ยืนยันส่ง (ปุ่ม ยืนยัน/ยกเลิก)

  const timerRef = useRef(null); 
  const questionListRef = useRef(null);
  const questionsScrollRef = useRef(null);
  const suppressObserverUntilRef = useRef(0);
  const pinnedQuestionIdRef = useRef(null);
  const pinnedClearTimerRef = useRef(null);
  const questionsPerPage = 10;

  const getWorkerIdentity = () => {
    const storedUserStr = sessionStorage.getItem('user');
    const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;
    const storedUserId = sessionStorage.getItem('user_id');
    const resolvedUserId = storedUser?.id ?? storedUserId;
    const numericWorkerId = resolvedUserId && !Number.isNaN(Number(resolvedUserId))
      ? Number(resolvedUserId)
      : null;
    return { resolvedUserId, numericWorkerId };
  };

  const buildFallbackBreakdown = (scoreValue, totalValue) => {
    const totalScore = Number(scoreValue) || 0;
    const totalQuestions = Number(totalValue) || 0;
    const overallPct = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;
    const categories = [
      { label: 'งานเหล็กเสริม', weight: examConfig.cat_rebar_percent },
      { label: 'งานคอนกรีต', weight: examConfig.cat_concrete_percent },
      { label: 'งานไม้แบบ', weight: examConfig.cat_formwork_percent },
      { label: 'องค์อาคาร', weight: examConfig.cat_element_percent },
      { label: 'ทฤษฎีโครงสร้าง', weight: examConfig.cat_theory_percent }
    ];
    return categories.map((item) => ({
      label: item.label,
      percentage: Math.round(overallPct * (Number(item.weight) || 0) / 100)
    }));
  };

  useEffect(() => {
    const fetchSummary = async () => {
      const apiBase = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000';
      const { resolvedUserId, numericWorkerId } = getWorkerIdentity();
      const workerId = numericWorkerId ?? (resolvedUserId ? Number(resolvedUserId) : null);
      if (!workerId) return;
      try {
        const res = await fetch(`${apiBase}/api/worker/assessment/summary?workerId=${workerId}`);
        if (res.status === 404) return;
        if (!res.ok) throw new Error('summary fetch failed');
        const data = await res.json();
        if (data?.result) {
          setTestResult(data.result);
          setHasCompleted(true);
          navigate('/skill-assessment/summary');
        }
      } catch (err) {
        console.error('Summary fetch failed:', err);
      }
    };
    fetchSummary();
  }, []);

  // Sync answers to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('assessment_answers', JSON.stringify(answers));
  }, [answers]);

  // --- Logic การดึงข้อมูล ---
  useEffect(() => {
    const fetchExamData = async () => {
        setLoading(true);
        const apiBase = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000';
        const { resolvedUserId, numericWorkerId } = getWorkerIdentity();
        const sessionId = sessionStorage.getItem('assessment_session_id') || '';
        try {
          // Explicitly fetch LV1 (set_no=1)
          const params = new URLSearchParams({ set_no: '1' });
          if (sessionId) params.set('sessionId', sessionId);
          if (numericWorkerId) params.set('workerId', String(numericWorkerId));
          if (!numericWorkerId && resolvedUserId) params.set('userId', String(resolvedUserId));
          const res = await fetch(`${apiBase}/api/questions/structural?${params.toString()}`);
          if (!res.ok) throw new Error('Failed to fetch exam data');
          const data = await res.json();
          // Backend returns { questions: [...] } wrapped in object with pagination
          const qList = data.questions || data; 

          if (data?.round) {
            const round = data.round;
            const quotas = round.subcategoryQuotas || {};
            const pct = (key) => Number(quotas?.[key]?.pct) || 0;
            setExamConfig(prev => ({
              ...prev,
              duration_minutes: Number(round.durationMinutes) || prev.duration_minutes,
              total_questions: Number(round.questionCount) || prev.total_questions,
              cat_rebar_percent: pct('rebar') || prev.cat_rebar_percent,
              cat_concrete_percent: pct('concrete') || prev.cat_concrete_percent,
              cat_formwork_percent: pct('formwork') || prev.cat_formwork_percent,
              cat_element_percent: pct('tools') || prev.cat_element_percent,
              cat_theory_percent: pct('theory') || prev.cat_theory_percent
            }));
          }
          
          if (Array.isArray(qList)) {
            const transformedQuestions = qList.map(q => ({
                id: q.id,
                text: q.text || q.question, // Backend uses 'text', Frontend mock used 'question'
                choices: q.choices || q.options || [] // Backend uses 'choices'
            }));
            setQuestions(transformedQuestions);
            
            // Set simple mock config based on question count
            const totalQuestions = Number(data?.total) || transformedQuestions.length;
            setExamConfig(prev => ({ ...prev, total_questions: totalQuestions }));

            // Timer Persistence Logic
            const duration = (Number(data?.round?.durationMinutes) || 60) * 60;
            const startTime = sessionStorage.getItem('assessment_start_time');
            if (startTime) {
              const elapsed = Math.floor((Date.now() - Number(startTime)) / 1000);
              setTimeLeft(Math.max(0, duration - elapsed));
            } else {
              setTimeLeft(duration);
            }
          }
          if (data?.sessionId) {
            sessionStorage.setItem('assessment_session_id', data.sessionId);
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
    if (step === 'test') {
        if (!sessionStorage.getItem('assessment_start_time')) {
          sessionStorage.setItem('assessment_start_time', Date.now().toString());
        }

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

  useEffect(() => {
    if (!questions.length) return;
    const startIndex = (currentPage - 1) * questionsPerPage;
    const initial = questions[startIndex];
    if (initial) {
      setActiveQuestionId(String(initial.id));
    }
    setSelectedQuestionNumber(null);
  }, [currentPage, questions]);

  useEffect(() => {
    if (!questions.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < suppressObserverUntilRef.current) return;
        const visible = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          const nextId = visible[0].target.getAttribute('data-qid');
          const pinnedId = pinnedQuestionIdRef.current;
          if (pinnedId && nextId !== pinnedId) return;
          if (pinnedId && nextId === pinnedId) {
            pinnedQuestionIdRef.current = null;
          }
          if (nextId) setActiveQuestionId(String(nextId));
        }
      },
      {
        root: questionsScrollRef.current || null,
        rootMargin: '-40% 0px -45% 0px',
        threshold: [0.1, 0.25, 0.5, 0.75]
      }
    );

    const startIndex = (currentPage - 1) * questionsPerPage;
    const endIndex = startIndex + questionsPerPage;
    questions.slice(startIndex, endIndex).forEach(q => {
      const el = document.getElementById(`q-${q.id}`);
      if (el) {
        el.setAttribute('data-qid', String(q.id));
        observer.observe(el);
      }
    });

    return () => observer.disconnect();
  }, [questions, currentPage]);

  useEffect(() => {
    if (!activeQuestionId || !questionListRef.current) return;
    const activeBtn = questionListRef.current.querySelector(`button[data-qid="${activeQuestionId}"]`);
    if (activeBtn) {
      activeBtn.scrollIntoView({ block: 'nearest' });
    }
  }, [activeQuestionId]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleAnswer = (qId, choiceIndex) => {
    setAnswers(prev => {
      if (prev[qId] === choiceIndex) {
        const next = { ...prev };
        delete next[qId];
        return next;
      }
      return { ...prev, [qId]: choiceIndex };
    });
  };

  // --- Helper เปิด Modal แจ้งเตือน ---
  const showWarning = (msg) => {
    setWarningModal({ show: true, message: msg });
  };

  // --- Navigation & Validation ---
  const jumpToQuestion = (qId, qNumber) => {
    const qIndex = questions.findIndex(q => String(q.id) === String(qId));
    if (qIndex >= 0) {
      setCurrentPage(Math.floor(qIndex / questionsPerPage) + 1);
    }
    setActiveQuestionId(String(qId));
    if (typeof qNumber === 'number') {
      setSelectedQuestionNumber(qNumber);
    }
    suppressObserverUntilRef.current = Date.now() + 800;
    pinnedQuestionIdRef.current = String(qId);
    if (pinnedClearTimerRef.current) {
      clearTimeout(pinnedClearTimerRef.current);
    }
    pinnedClearTimerRef.current = setTimeout(() => {
      if (pinnedQuestionIdRef.current === String(qId)) {
        pinnedQuestionIdRef.current = null;
      }
    }, 2000);
    setPendingScrollId(String(qId));
  };

  const scrollToQuestion = (qId) => {
    const attemptScroll = () => {
      const element = document.getElementById(`q-${qId}`);
      if (!element) return;
      const container = questionsScrollRef.current;
      if (!container) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const targetTop = elementRect.top - containerRect.top + container.scrollTop - 16;
      container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
    };
    requestAnimationFrame(() => requestAnimationFrame(attemptScroll));
  };

  useEffect(() => {
    if (!pendingScrollId) return;
    scrollToQuestion(pendingScrollId);
    setPendingScrollId(null);
  }, [pendingScrollId, currentPage, questions]);


  const handlePreSubmit = () => {
    if (hasCompleted) {
      showWarning('คุณได้ทำแบบประเมินแล้ว ระบบจะแสดงผลสรุปทักษะ');
      navigate('/skill-assessment/summary');
      return;
    }
    const unansweredCount = questions.length - Object.keys(answers).length;
    if (unansweredCount > 0) {
        showWarning(`คุณยังทำข้อสอบไม่ครบ ${unansweredCount} ข้อ`);
        return;
    }
    setShowConfirmModal(true); // เปิด Modal ยืนยัน
  };

  const handleTimeoutSubmit = async () => {
    showWarning("หมดเวลาสอบ! ระบบจะส่งคำตอบของคุณโดยอัตโนมัติ");
    await submitToBackend();
  };

  // ฟังก์ชันยิง API
  const submitToBackend = async () => {
    setShowConfirmModal(false); 
    try {
        if (hasCompleted) {
          showWarning('คุณได้ทำแบบประเมินแล้ว ระบบจะไม่รับคำตอบซ้ำ');
          navigate('/skill-assessment/summary');
          return;
        }
        const apiBase = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000';
        const { resolvedUserId, numericWorkerId } = getWorkerIdentity();
        const sessionId = sessionStorage.getItem('assessment_session_id') || '';
        if (!sessionId) {
          showWarning('ไม่พบข้อมูลรอบการสอบ');
          return;
        }
        const res = await fetch(`${apiBase}/api/worker/score`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId: numericWorkerId ?? resolvedUserId,
              sessionId,
              answers: answers
            })
        });
        let resultData = null;
        let rawErrorText = '';
        const cloneForText = res.clone();
        try {
          resultData = await res.json();
        } catch (parseErr) {
          resultData = null;
        }
        if (!res.ok && !resultData) {
          try {
            rawErrorText = (await cloneForText.text()) || '';
          } catch (textErr) {
            rawErrorText = '';
          }
        }

        if (!res.ok) {
          if (resultData?.message === 'already_completed' && resultData?.result) {
            setTestResult(resultData.result);
            setHasCompleted(true);
            navigate('/skill-assessment/summary');
            return;
          }
          const serverMessage = resultData?.message ? ` (${resultData.message})` : '';
          const statusInfo = res.status ? ` [${res.status}]` : '';
          const rawInfo = rawErrorText ? ` ${rawErrorText}` : '';
          showWarning(`ส่งคำตอบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง${statusInfo}${serverMessage}${rawInfo}`);
          return;
        }

        const resultPayload = resultData?.result
          ? resultData.result
          : {
              ...resultData,
              totalQuestions: resultData?.totalQuestions ?? questions.length,
              finishedAt: new Date().toISOString()
            };
        setTestResult(resultPayload);
        setHasCompleted(true);
        
        // Clear session data after successful submission
        sessionStorage.removeItem('assessment_answers');
        sessionStorage.removeItem('assessment_start_time');
        sessionStorage.removeItem('assessment_session_id');

        navigate('/skill-assessment/summary');
        window.scrollTo(0, 0);
    } catch (err) {
        console.error("Error submitting:", err);
        setStep('review'); // Keep legacy review as fallback
    }
  };

  const handleLogout = () => {
    if (window.confirm("ต้องการออกจากระบบใช่หรือไม่?")) {
      sessionStorage.clear();
      navigate('/login');
    }
  };

  // --- Styles สำหรับ Modal ---
  const modalOverlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000,
    display: 'flex', justifyContent: 'center', alignItems: 'center'
  };
  const modalContentStyle = {
    background: 'white', padding: '30px', borderRadius: '16px', 
    width: '90%', maxWidth: '450px', textAlign: 'center', 
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)'
  };
  const btnStyle = {
    padding: '10px 24px', borderRadius: '10px', border: 'none', 
    cursor: 'pointer', fontSize: '15px', margin: '0 8px', fontWeight: '600', transition: 'transform 0.1s'
  };

  // --- Step 1: Intro ---
  if (step === 'intro') {
    const startAssessment = () => {
      if (hasCompleted) {
        showWarning('คุณได้ทำแบบประเมินแล้ว ระบบจะแสดงผลสรุปทักษะ');
        navigate('/skill-assessment/summary');
        return;
      }
      setStep('test');
    };
    return (
      <div className="dash-window" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Kanit', sans-serif" }}>
        
        {/* Top Navigation Bar */}
        <nav style={{ 
            background: isScrolled ? 'rgba(255, 255, 255, 0.95)' : 'white', 
            padding: '15px 40px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            boxShadow: isScrolled ? '0 4px 20px -5px rgba(0,0,0,0.1)' : '0 4px 6px -1px rgba(0,0,0,0.05)',
            backdropFilter: isScrolled ? 'blur(10px)' : 'none',
            transition: 'all 0.3s ease',
            position: 'sticky',
            top: 0,
            zIndex: 50
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ 
                width: '36px', height: '36px', 
                background: '#fef3c700', borderRadius: '8px', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#5ea6e0', fontSize: '20px'
              }}>
                  <img src="/logo123.png" alt="Logo" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
               </div>
               <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: '#1e293b' }}>{tradeLabel(resolvedTrade)}</h2>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <SidebarItem icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M3 13h1v7c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-7h1c.4 0 .77-.24.92-.62.15-.37.07-.8-.22-1.09l-8.99-9a.996.996 0 0 0-1.41 0l-9.01 9c-.29.29-.37.72-.22 1.09s.52.62.92.62Zm9-8.59 6 6V20H6v-9.59z"></path></svg>} label="หน้าหลัก" onClick={() => navigate('/worker')} />
            <SidebarItem active icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M8 6h9v2H8z"></path><path d="M20 2H6C4.35 2 3 3.35 3 5v14c0 1.65 1.35 3 3 3h15v-2H6c-.55 0-1-.45-1-1s.45-1 1-1h14c.55 0 1-.45 1-1V3c0-.55-.45-1-1-1m-6 14H6c-.35 0-.69.07-1 .18V5c0-.55.45-1 1-1h13v12z"></path></svg>} label="แบบทดสอบ" onClick={() => navigate('/skill-assessment')} />
            <SidebarItem icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M20 6h-3V4c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2M9 4h6v2H9zM8 8h12v3.07l-.83.39a16.78 16.78 0 0 1-14.34 0L4 11.07V8zM4 20v-6.72c2.54 1.19 5.27 1.79 8 1.79s5.46-.6 8-1.79V20z"></path></svg>} label="ประวัติงาน" onClick={() => navigate('/worker/history')} />
            <SidebarItem icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4m0 6c-1.08 0-2-.92-2-2s.92-2 2-2 2 .92 2 2-.92 2-2 2"></path><path d="m20.42 13.4-.51-.29c.05-.37.08-.74.08-1.11s-.03-.74-.08-1.11l.51-.29c.96-.55 1.28-1.78.73-2.73l-1-1.73a2.006 2.006 0 0 0-2.73-.73l-.53.31c-.58-.46-1.22-.83-1.9-1.11v-.6c0-1.1-.9-2-2-2h-2c-1.1 0-2 .9-2 2v.6c-.67.28-1.31.66-1.9 1.11l-.53-.31c-.96-.55-2.18-.22-2.73.73l-1 1.73c-.55.96-.22 2.18.73 2.73l.51.29c-.05.37-.08.74-.08 1.11s.03.74.08 1.11l-.51.29c-.96.55-1.28 1.78-.73 2.73l1 1.73c.55.95 1.77 1.28 2.73.73l.53-.31c.58.46 1.22.83 1.9 1.11v.6c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2v-.6a8.7 8.7 0 0 0 1.9-1.11l.53.31c.95.55 2.18.22 2.73-.73l1-1.73c.55-.96.22-2.18-.73-2.73m-2.59-2.78c.11.45.17.92.17 1.38s-.06.92-.17 1.38a1 1 0 0 0 .47 1.11l1.12.65-1 1.73-1.14-.66c-.38-.22-.87-.16-1.19.14-.68.65-1.51 1.13-2.38 1.4-.42.13-.71.52-.71.96v1.3h-2v-1.3c0-.44-.29-.83-.71-.96-.88-.27-1.7-.75-2.38-1.4a1.01 1.01 0 0 0-1.19-.15l-1.14.66-1-1.73 1.12-.65c.39-.22.58-.68.47-1.11-.11-.45-.17-.92-.17-1.38s.06-.93.17-1.38A1 1 0 0 0 5.7 9.5l-1.12-.65 1-1.73 1.14.66c.38.22.87.16 1.19-.14.68-.65 1.51-1.13 2.38-1.4.42-.13.71-.52.71-.96v-1.3h2v1.3c0 .44.29.83.71.96.88.27 1.7.75 2.38 1.4.32.31.81.36 1.19.14l1.14-.66 1 1.73-1.12.65c-.39.22-.58.68-.47 1.11Z"></path></svg>} label="ตั้งค่า" onClick={() => navigate('/worker-settings')} />
            
            <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 10px' }}></div>

            <button onClick={handleLogout} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '15px', fontWeight: '600', borderRadius: '8px', transition: 'background 0.2s' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="m20.2 4.02-10-2a.99.99 0 0 0-.83.21C9.14 2.42 9 2.7 9 3v1H4c-.55 0-1 .45-1 1v14c0 .55.45 1 1 1h5v1c0 .3.13.58.37.77.18.15.4.23.63.23.07 0 .13 0 .2-.02l10-2c.47-.09.8-.5.8-.98V5c0-.48-.34-.89-.8-.98M5 18V6h4v12zm14 .18-8 1.6V4.22l8 1.6z"></path><path d="M13 11a1 1 0 1 0 0 2 1 1 0 1 0 0-2"></path></svg>
                ออกจากระบบ
            </button>
          </div>
        </nav>

        <main style={{ flex: 1, padding: '40px 20px', width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ background: 'white', maxWidth: '900px', width: '100%', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden', border: '1px solid #e2e8f0', margin: '0 auto' }}>
            
            <div style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', padding: '40px', color: 'white', textAlign: 'center' }}>
               <h2 style={{ margin: 0, fontSize: '28px', fontWeight: '800' }}>ข้อตกลงและเงื่อนไขการสอบ</h2>
               <p style={{ margin: '10px 0 0', opacity: 0.9, fontSize: '18px' }}>โปรดอ่านรายละเอียดก่อนเริ่มทำแบบทดสอบ</p>
            </div>
            
            <div style={{ padding: '40px' }}>
              <div style={{ marginBottom: '30px', padding: '25px', background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                  <h3 style={{ margin: '0 0 15px 0', color: '#1e40af', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      📋 เงื่อนไขการสอบ
                  </h3>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: '#334155', lineHeight: '1.8' }}>
                    <li>เวลาในการทำข้อสอบ: <strong>{examConfig.duration_minutes} นาที</strong></li>
                    <li>จำนวนข้อสอบ: <strong>{examConfig.total_questions} ข้อ</strong> (ทำทีละหน้า)</li>
                    <li>ต้องทำครบทุกข้อในหน้าปัจจุบันจึงจะเปลี่ยนหน้าได้</li>
                    <li>เมื่อหมดเวลา ระบบจะส่งคำตอบอัตโนมัติ (ข้อที่ทำไม่ทันจะได้ 0 คะแนน)</li>
                  </ul>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '40px' }}>
                  {/* ตารางที่ 1: โครงสร้างเนื้อหา */}
                  <div style={{ flex: 1, maxWidth: '600px' }}>
                    <h3 style={{ fontSize: '16px', color: '#1e293b', marginBottom: '15px', fontWeight: '700' }}>โครงสร้างเนื้อหา</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', color: '#64748b' }}>
                                <th style={{ padding: '12px 15px', textAlign: 'left', fontWeight: '600' }}>หัวข้อการประเมิน</th>
                                <th style={{ padding: '12px 15px', textAlign: 'center', fontWeight: '600' }}>น้ำหนัก</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                              { icon: '🏗️', text: '1. งานเหล็กเสริม (Rebar)', val: examConfig.cat_rebar_percent },
                              { icon: '🧱', text: '2. งานคอนกรีต (Concrete)', val: examConfig.cat_concrete_percent },
                              { icon: '🪵', text: '3. งานไม้แบบ (Formwork)', val: examConfig.cat_formwork_percent },
                              { icon: '🏛️', text: '4. องค์อาคาร (คาน/เสา/ฐานราก)', val: examConfig.cat_element_percent },
                              { icon: '📐', text: '5. การออกแบบ/ทฤษฎี', val: examConfig.cat_theory_percent }
                            ].map((item, idx) => (
                              <tr key={idx} style={{ borderTop: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '10px 15px', color: '#334155' }}>
                                      <span style={{ marginRight: '10px' }}>{item.icon}</span>
                                      {item.text}
                                  </td>
                                  <td style={{ padding: '10px 15px', textAlign: 'center', color: '#64748b' }}>{item.val}%</td>
                              </tr>
                            ))}
                        </tbody>
                    </table>
                  </div>
              </div>

              <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                <button onClick={() => navigate('/worker')} style={{ padding: '12px 30px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '10px', cursor: 'pointer', color: '#64748b', fontWeight: '600', fontSize: '16px', transition: 'background 0.2s' }}>ยกเลิก</button>
                <button onClick={startAssessment} style={{ padding: '12px 40px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)', transition: 'transform 0.2s' }}>เริ่มทำข้อสอบ</button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // --- Step 3: Review ---
  if (step === 'review') {
    const scoreValue = testResult?.score ?? testResult?.totalScore ?? 0;
    const totalValue = testResult?.totalQuestions ?? questions.length;
    const breakdownItems = Array.isArray(testResult?.breakdown) && testResult.breakdown.length
      ? testResult.breakdown
      : buildFallbackBreakdown(scoreValue, totalValue);
    return (
       <div className="dash-window" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Kanit', sans-serif" }}>
          
          {/* Top Navigation Bar */}
          <nav style={{ 
              background: 'white', 
              padding: '15px 40px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              position: 'sticky',
              top: 0,
              zIndex: 50
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ 
                    width: '36px', height: '36px', 
                    background: '#fef3c700', borderRadius: '8px', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#5ea6e0', fontSize: '20px'
                  }}>
                      <img src="/logo123.png" alt="Logo" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                 </div>
                 <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: '#1e293b' }}>{tradeLabel(resolvedTrade)}</h2>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <SidebarItem icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M3 13h1v7c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-7h1c.4 0 .77-.24.92-.62.15-.37.07-.8-.22-1.09l-8.99-9a.996.996 0 0 0-1.41 0l-9.01 9c-.29.29-.37.72-.22 1.09s.52.62.92.62Zm9-8.59 6 6V20H6v-9.59z"></path></svg>} label="หน้าหลัก" onClick={() => navigate('/worker')} />
              <SidebarItem active icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M8 6h9v2H8z"></path><path d="M20 2H6C4.35 2 3 3.35 3 5v14c0 1.65 1.35 3 3 3h15v-2H6c-.55 0-1-.45-1-1s.45-1 1-1h14c.55 0 1-.45 1-1V3c0-.55-.45-1-1-1m-6 14H6c-.35 0-.69.07-1 .18V5c0-.55.45-1 1-1h13v12z"></path></svg>} label="แบบทดสอบ" onClick={() => navigate('/skill-assessment')} />
              <SidebarItem icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M20 6h-3V4c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2M9 4h6v2H9zM8 8h12v3.07l-.83.39a16.78 16.78 0 0 1-14.34 0L4 11.07V8zM4 20v-6.72c2.54 1.19 5.27 1.79 8 1.79s5.46-.6 8-1.79V20z"></path></svg>} label="ประวัติงาน" onClick={() => navigate('/worker/history')} />
              <SidebarItem icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4m0 6c-1.08 0-2-.92-2-2s.92-2 2-2 2 .92 2 2-.92 2-2 2"></path><path d="m20.42 13.4-.51-.29c.05-.37.08-.74.08-1.11s-.03-.74-.08-1.11l.51-.29c.96-.55 1.28-1.78.73-2.73l-1-1.73a2.006 2.006 0 0 0-2.73-.73l-.53.31c-.58-.46-1.22-.83-1.9-1.11v-.6c0-1.1-.9-2-2-2h-2c-1.1 0-2 .9-2 2v.6c-.67.28-1.31.66-1.9 1.11l-.53-.31c-.96-.55-2.18-.22-2.73.73l-1 1.73c-.55.96-.22 2.18.73 2.73l.51.29c-.05.37-.08.74-.08 1.11s.03.74.08 1.11l-.51.29c-.96.55-1.28 1.78-.73 2.73l1 1.73c.55.95 1.77 1.28 2.73.73l.53-.31c.58.46 1.22.83 1.9 1.11v.6c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2v-.6a8.7 8.7 0 0 0 1.9-1.11l.53.31c.95.55 2.18.22 2.73-.73l1-1.73c.55-.96.22-2.18-.73-2.73m-2.59-2.78c.11.45.17.92.17 1.38s-.06.92-.17 1.38a1 1 0 0 0 .47 1.11l1.12.65-1 1.73-1.14-.66c-.38-.22-.87-.16-1.19.14-.68.65-1.51 1.13-2.38 1.4-.42.13-.71.52-.71.96v1.3h-2v-1.3c0-.44-.29-.83-.71-.96-.88-.27-1.7-.75-2.38-1.4a1.01 1.01 0 0 0-1.19-.15l-1.14.66-1-1.73 1.12-.65c.39-.22.58-.68.47-1.11-.11-.45-.17-.92-.17-1.38s.06-.93.17-1.38A1 1 0 0 0 5.7 9.5l-1.12-.65 1-1.73 1.14.66c.38.22.87.16 1.19-.14.68-.65 1.51-1.13 2.38-1.4.42-.13.71-.52.71-.96v-1.3h2v1.3c0 .44.29.83.71.96.88.27 1.7.75 2.38 1.4.32.31.81.36 1.19.14l1.14-.66 1 1.73-1.12.65c-.39.22-.58.68-.47 1.11Z"></path></svg>} label="ตั้งค่า" onClick={() => navigate('/worker-settings')} />
              
              <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 10px' }}></div>

              <button onClick={handleLogout} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '15px', fontWeight: '600', borderRadius: '8px', transition: 'background 0.2s' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="m20.2 4.02-10-2a.99.99 0 0 0-.83.21C9.14 2.42 9 2.7 9 3v1H4c-.55 0-1 .45-1 1v14c0 .55.45 1 1 1h5v1c0 .3.13.58.37.77.18.15.4.23.63.23.07 0 .13 0 .2-.02l10-2c.47-.09.8-.5.8-.98V5c0-.48-.34-.89-.8-.98M5 18V6h4v12zm14 .18-8 1.6V4.22l8 1.6z"></path><path d="M13 11a1 1 0 1 0 0 2 1 1 0 1 0 0-2"></path></svg>
                  ออกจากระบบ
              </button>
            </div>
          </nav>

          <main style={{ flex: 1, padding: '60px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'white', maxWidth: '600px', width: '100%', padding: '40px', borderRadius: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', textAlign: 'center' }}>
             <div style={{ width: '70px', height: '70px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#166534', fontSize: '32px' }}>✓</div>
             <h2 style={{ color: '#1e293b', margin: '0 0 5px 0', fontSize: '24px' }}>การประเมินเสร็จสิ้น</h2>
             
             {testResult ? (
               <div style={{ marginTop: '25px' }}>
                 <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', marginBottom: '25px' }}>
                    <div style={{ fontSize: '14px', color: '#64748b' }}>คะแนนรวมของคุณ</div>
                    <div style={{ fontSize: '42px', fontWeight: '800', color: '#2563eb' }}>{testResult.score} / {questions.length}</div>
                 </div>

                 <h3 style={{ fontSize: '16px', textAlign: 'left', marginBottom: '15px', color: '#1e293b' }}>📊 วิเคราะห์ความถนัดแยกตามหมวดหมู่</h3>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {breakdownItems.map((item, idx) => (
                      <div key={idx}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '5px' }}>
                          <span style={{ color: '#475569', fontWeight: '600' }}>{item.label}</span>
                          <span style={{ color: '#2563eb' }}>{item.percentage}%</span>
                        </div>
                        <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${item.percentage}%`, 
                            height: '100%', 
                            background: item.percentage >= 70 ? '#10b981' : (item.percentage >= 50 ? '#f59e0b' : '#ef4444'),
                            transition: 'width 1s ease-in-out'
                          }} />
                        </div>
                      </div>
                    ))}
                 </div>
                 
                 <p style={{ fontSize: '14px', color: '#64748b', marginTop: '25px', lineHeight: '1.5' }}>
                    *คะแนนนี้เป็นผลเบื้องต้น หัวหน้างานจะพิจารณาผลการทดสอบร่วมกับประวัติการทำงานของคุณอีกครั้ง
                 </p>
               </div>
             ) : (
               <p style={{ fontSize: '16px', color: '#64748b', margin: '20px 0 30px 0' }}>ระบบได้บันทึกคำตอบของคุณแล้ว โปรดรอผลการประเมินอย่างเป็นทางการ</p>
             )}

             <div style={{ marginTop: '30px' }}>
                <button onClick={() => navigate('/worker')} style={{ padding: '12px 30px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '16px', fontWeight: '600', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)' }}>กลับหน้าหลัก</button>
             </div>
            </div>
          </main>
       </div>
    );
  }

  // --- Step 2: Test ---
  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>กำลังโหลด...</div>;
  if (error) return <div style={{ padding: '50px', textAlign: 'center', color: 'red' }}>{error}</div>;

  const indexOfLastQ = currentPage * questionsPerPage;
  const indexOfFirstQ = indexOfLastQ - questionsPerPage;
  const currentQuestions = questions.slice(indexOfFirstQ, indexOfLastQ);
  const totalPages = Math.max(1, Math.ceil(questions.length / questionsPerPage));
  const activeIndex = activeQuestionId
    ? Math.max(1, questions.findIndex(q => String(q.id) === String(activeQuestionId)) + 1)
    : 1;
  const timerColor = timeLeft < 300 ? '#ef4444' : '#10b981';

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Kanit', sans-serif", position: 'relative' }}>
       
       {/* === MODAL 1: Warning (แจ้งเตือน) === */}
       {warningModal.show && (
         <div style={modalOverlayStyle}>
           <div style={modalContentStyle}>
             <h3 style={{ margin: '0 0 15px 0', color: '#ef4444', fontSize: '20px' }}>แจ้งเตือน</h3>
             <p style={{ fontSize: '16px', color: '#475569', marginBottom: '25px', lineHeight: '1.5' }}>{warningModal.message}</p>
             <button 
                onClick={() => setWarningModal({ show: false, message: '' })}
                style={{ ...btnStyle, background: '#3b82f6', color: 'white' }}
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
             <h3 style={{ margin: '0 0 10px 0', color: '#1e293b', fontSize: '22px' }}>ยืนยันการส่งคำตอบ?</h3>
             <p style={{ fontSize: '15px', color: '#64748b', marginBottom: '30px' }}>เมื่อส่งแล้วจะไม่สามารถแก้ไขได้อีก</p>
             <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button 
                    onClick={() => setShowConfirmModal(false)}
                    style={{ ...btnStyle, background: '#f1f5f9', color: '#475569' }}
                >
                    ยกเลิก
                </button>
                <button 
                    onClick={submitToBackend}
                    style={{ ...btnStyle, background: '#10b981', color: 'white', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.3)' }}
                >
                    ยืนยัน
                </button>
             </div>
           </div>
         </div>
       )}

       <header style={{ background: '#fff', height: '70px', padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 100 }}>
            <h3 style={{ margin: 0, color: '#1e293b', fontSize: '18px', fontWeight: '700' }}><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24"  fill="currentColor" viewBox="0 0 24 24" ><path d="m19.94 7.68-.03-.09a.8.8 0 0 0-.2-.29l-5-5c-.09-.09-.19-.15-.29-.2l-.09-.03a.8.8 0 0 0-.26-.05c-.02 0-.04-.01-.06-.01H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-12s-.01-.04-.01-.06c0-.09-.02-.17-.05-.26ZM6 20V4h7v4c0 .55.45 1 1 1h4v11z"></path><path d="M8 11h8v2H8zm0 4h8v2H8zm0-8h3v2H8z"></path></svg> แบบทดสอบวัดทักษะ</h3>
            <div style={{ fontSize: '20px', fontWeight: '800', color: timerColor, background: timeLeft < 300 ? '#fef2f2' : '#f0fdf4', padding: '8px 20px', borderRadius: '30px', border: `1px solid ${timeLeft < 300 ? '#fecaca' : '#bbf7d0'}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>⏱</span> {formatTime(timeLeft)}
            </div>
            <span style={{ fontSize: '14px', background: '#f1f5f9', color: '#475569', padding: '6px 16px', borderRadius: '20px', fontWeight: '600' }}>
              หน้า {currentPage} / {totalPages}
            </span>
       </header>

        <div style={{ maxWidth: '1100px', margin: '30px auto', width: '100%', padding: '0 20px', display: 'flex', gap: '25px', alignItems: 'stretch', height: 'calc(100vh - 110px)', minHeight: 0 }}>
          <div ref={questionsScrollRef} style={{ flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                {currentQuestions.map((q, index) => {
                  const displayNum = indexOfFirstQ + index + 1;
                    return (
                        <div key={q.id} id={`q-${q.id}`} style={{ background: 'white', padding: '30px', borderRadius: '16px', marginBottom: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontWeight: '700', marginBottom: '20px', color: '#1e293b', fontSize: '18px', lineHeight: '1.6' }}>
                                <span style={{ color: '#2563eb', marginRight: '8px' }}>{displayNum}.</span> {q.text}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {q.choices.map((choice, cIdx) => (
                                    <label key={cIdx} style={{ display: 'flex', alignItems: 'center', padding: '15px 20px', border: answers[q.id] === cIdx ? '2px solid #2563eb' : '1px solid #e2e8f0', borderRadius: '12px', cursor: 'pointer', background: answers[q.id] === cIdx ? '#eff6ff' : 'white', transition: 'all 0.2s' }}>
                                        <input type="radio" name={`q-${q.id}`} checked={answers[q.id] === cIdx} onChange={() => handleAnswer(q.id, cIdx)} style={{ marginRight: '15px', accentColor: '#2563eb', width: '18px', height: '18px' }} />
                                        <span style={{ color: answers[q.id] === cIdx ? '#1e40af' : '#475569', fontSize: '16px', fontWeight: answers[q.id] === cIdx ? '600' : '400' }}>{choice}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    );
                })}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', marginBottom: '60px' }}>
                  <button disabled={currentPage === 1} onClick={() => { setCurrentPage(p => p - 1); questionsScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ padding: '12px 25px', background: currentPage === 1 ? '#f1f5f9' : 'white', color: currentPage === 1 ? '#94a3b8' : '#475569', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: '600' }}>&lt; ย้อนกลับ</button>
                  {currentPage < totalPages ? (
                    <button onClick={() => { setCurrentPage(p => p + 1); questionsScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ padding: '12px 35px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(59, 130, 246, 0.3)' }}>ถัดไป &gt;</button>
                  ) : (
                    <button onClick={handlePreSubmit} style={{ padding: '12px 40px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(37, 99, 235, 0.4)', fontSize: '16px' }}>ส่งคำตอบ</button>
                  )}
                </div>
              </div>

              <div style={{ width: '320px', background: 'white', padding: '25px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', alignSelf: 'flex-start' }}>
                <h4 style={{ margin: '0 0 20px 0', color: '#1e293b', fontSize: '16px', fontWeight: '700' }}>รายการคำถาม</h4>
                <div ref={questionListRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                  {questions.map((q, index) => {
                    const isAnswered = answers[q.id] !== undefined;
                    const isActive = String(q.id) === String(activeQuestionId);
                    const isSelected = selectedQuestionNumber
                      ? index + 1 === selectedQuestionNumber
                      : index + 1 === activeIndex;
                    return (
                      <button key={q.id} data-qid={String(q.id)} onClick={() => jumpToQuestion(q.id, index + 1)} style={{ width: '100%', aspectRatio: '1/1', display: 'flex', alignItems: 'center', justifyContent: 'center', border: isSelected ? '2px solid #94a3b8' : (isAnswered ? '1px solid #2563eb' : '1px solid #e2e8f0'), borderRadius: '8px', background: isSelected ? '#e2e8f0' : (isAnswered ? '#2563eb' : 'white'), color: isAnswered ? 'white' : (isSelected ? '#334155' : '#64748b'), fontSize: '14px', fontWeight: isSelected || isAnswered ? 'bold' : 'normal', cursor: 'pointer', transition: 'all 0.1s' }}>{index + 1}</button>
                    );
                  })}
                </div>
                <div style={{ marginTop: '20px', fontSize: '14px', textAlign: 'center', color: '#64748b', background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
                    ทำไปแล้ว <strong style={{ color: '#2563eb' }}>{Object.keys(answers).length}</strong> / {questions.length} ข้อ
                </div>
            </div>
       </div>
    </div>
  );
};

// Internal Component for Sidebar Item
const SidebarItem = ({ icon, label, active, onClick }) => (
    <div 
        onClick={onClick}
        style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '8px 16px', 
            borderRadius: '20px', 
            cursor: 'pointer', 
            background: active ? '#eff6ff' : 'transparent',
            color: active ? '#2563eb' : '#64748b',
            fontWeight: active ? '600' : '500',
            transition: 'all 0.2s',
            fontSize: '15px'
        }}
    >
        <span style={{ fontSize: '18px' }}>{icon}</span>
        <span>{label}</span>
    </div>
);

export default SkillAssessmentTest;
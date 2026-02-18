import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import './SkillAssessmentTest.css';
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
  const resolvedTrade =
    user.fullData?.employment?.tradeType ||
    user.technician_type ||
    user.trade_type ||
    user.tradeType ||
    user.technicianType;

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
    const loadProfile = async ({ userId, workerId }) => {
      if (!userId && !workerId) return;
      try {
        const query = workerId
          ? `workerId=${encodeURIComponent(workerId)}`
          : `userId=${encodeURIComponent(userId)}`;
        const data = await apiRequest(`/api/worker/profile?${query}`);
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
      passing_score: null,
      cat_rebar_percent: 25, cat_concrete_percent: 25, cat_formwork_percent: 20, cat_element_percent: 20, cat_theory_percent: 10
  }); 
    const [roundMeta, setRoundMeta] = useState({ levelLabel: 'LV.1', passingScorePct: null, scoreWeights: { exam: 70, practical: 30 } });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeQuestionId, setActiveQuestionId] = useState(null);
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

  const resolveLevelLabel = (round) => {
    const setNo = round?.set_no ?? round?.setNo ?? null;
    if (setNo !== null && setNo !== undefined) {
      const numeric = Number(setNo);
      if (Number.isFinite(numeric)) return `LV.${numeric}`;
    }
    const title = String(round?.title || '').toUpperCase();
    const titleMatch = title.match(/LV\.?\s*(\d+)/);
    if (titleMatch && titleMatch[1]) return `LV.${titleMatch[1]}`;
    return 'LV.1';
  };

  const resolveScoreWeights = (round) => {
    const rawExam = Number(round?.criteria?.scoreWeights?.exam);
    const rawPractical = Number(round?.criteria?.scoreWeights?.practical);
    let exam = Number.isFinite(rawExam) ? Math.max(0, Math.min(100, rawExam)) : 70;
    let practical = Number.isFinite(rawPractical) ? Math.max(0, Math.min(100, rawPractical)) : 30;
    if (exam + practical !== 100) {
      practical = Math.max(0, 100 - exam);
    }
    return { exam, practical };
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
      const { resolvedUserId, numericWorkerId } = getWorkerIdentity();
      const workerId = numericWorkerId ?? (resolvedUserId ? Number(resolvedUserId) : null);
      if (!workerId) return;
      try {
        const data = await apiRequest(`/api/worker/assessment/summary?workerId=${workerId}`);
        if (!data) return;
        if (data?.result) {
          setTestResult(data.result);
          setHasCompleted(true);
          navigate('/skill-assessment/summary', { state: { result: data.result } });
        }
      } catch (err) {
        console.error('Summary fetch failed:', err);
      }
    };
    fetchSummary();
  }, []);

  useEffect(() => {
    const fetchRoundMeta = async () => {
      const { resolvedUserId, numericWorkerId } = getWorkerIdentity();
      const workerId = numericWorkerId ?? (resolvedUserId ? Number(resolvedUserId) : null);
      const categoryParam = 'structure';
      try {
        const data = await apiRequest(`/api/assessments/rounds/active?category=${encodeURIComponent(categoryParam)}`);
        const round = data?.round || (Array.isArray(data?.items) ? data.items[0] : null);
        if (round) {
          const passingScorePct = round.passing_score ?? round.passingScore ?? null;
          setRoundMeta({
            levelLabel: resolveLevelLabel(round),
            passingScorePct: passingScorePct === null || passingScorePct === undefined ? null : Number(passingScorePct),
            scoreWeights: resolveScoreWeights(round)
          });
          return;
        }
      } catch (err) {
        console.warn('Active round fetch failed:', err);
      }

      try {
        const params = new URLSearchParams();
        if (workerId) params.set('workerId', String(workerId));
        params.set('category', categoryParam);
        const data = await apiRequest(`/api/worker/assessments/rounds?${params.toString()}`);
        const rounds = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
        const round = rounds.find(item => String(item?.category || '').toLowerCase() === 'structure') || rounds[0] || null;
        if (!round) return;
        const passingScorePct = round.passing_score ?? round.passingScore ?? null;
        setRoundMeta({
          levelLabel: resolveLevelLabel(round),
          passingScorePct: passingScorePct === null || passingScorePct === undefined ? null : Number(passingScorePct),
          scoreWeights: resolveScoreWeights(round)
        });
      } catch (err) {
        console.warn('Worker rounds fetch failed:', err);
      }
    };

    fetchRoundMeta();
  }, []);

  // Sync answers to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('assessment_answers', JSON.stringify(answers));
  }, [answers]);

  // --- Logic การดึงข้อมูล ---
  useEffect(() => {
    const fetchExamData = async () => {
        setLoading(true);
        const { resolvedUserId, numericWorkerId } = getWorkerIdentity();
        const currentWorkerId = numericWorkerId ?? (Number.isFinite(Number(resolvedUserId)) ? Number(resolvedUserId) : null);
        const currentIdentityKey = resolvedUserId ? String(resolvedUserId) : '';
        const storedSessionWorkerId = sessionStorage.getItem('assessment_worker_id');
        const storedIdentityKey = sessionStorage.getItem('assessment_identity_key');
        let sessionId = sessionStorage.getItem('assessment_session_id') || '';
        const shouldClearStaleSession = Boolean(sessionId) && (
          (!storedIdentityKey || storedIdentityKey !== currentIdentityKey) ||
          (storedSessionWorkerId && currentWorkerId && Number(storedSessionWorkerId) !== Number(currentWorkerId))
        );
        if (shouldClearStaleSession) {
          sessionStorage.removeItem('assessment_session_id');
          sessionStorage.removeItem('assessment_start_time');
          sessionStorage.removeItem('assessment_answers');
          sessionStorage.removeItem('assessment_worker_id');
          sessionStorage.removeItem('assessment_identity_key');
          sessionId = '';
        }
        try {
          // Explicitly fetch LV1 (set_no=1)
          const params = new URLSearchParams({ set_no: '1' });
          if (sessionId) params.set('sessionId', sessionId);
          if (numericWorkerId) params.set('workerId', String(numericWorkerId));
          if (!numericWorkerId && resolvedUserId) params.set('userId', String(resolvedUserId));
          const data = await apiRequest(`/api/questions/structural?${params.toString()}`);
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
              passing_score: round.passing_score ?? round.passingScore ?? prev.passing_score,
              cat_rebar_percent: pct('rebar') || prev.cat_rebar_percent,
              cat_concrete_percent: pct('concrete') || prev.cat_concrete_percent,
              cat_formwork_percent: pct('formwork') || prev.cat_formwork_percent,
              cat_element_percent: pct('tools') || prev.cat_element_percent,
              cat_theory_percent: pct('theory') || prev.cat_theory_percent
            }));
            const passingScorePct = round.passing_score ?? round.passingScore ?? null;
            setRoundMeta({
              levelLabel: resolveLevelLabel(round),
              passingScorePct: passingScorePct === null || passingScorePct === undefined ? null : Number(passingScorePct),
              scoreWeights: resolveScoreWeights(round)
            });
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
            if (currentWorkerId) {
              sessionStorage.setItem('assessment_worker_id', String(currentWorkerId));
            }
            if (currentIdentityKey) {
              sessionStorage.setItem('assessment_identity_key', currentIdentityKey);
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
  }, [currentPage, questions]);

  useEffect(() => {
    if (!questions.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < suppressObserverUntilRef.current) return;
        
        // กรองเฉพาะ element ที่แสดงผลใน viewport
        const visible = entries.filter(entry => entry.isIntersecting);
        
        if (visible.length > 0) {
           // เรียงลำดับตามพื้นที่ที่แสดงผล (intersectionRatio) จากมากไปน้อย
           visible.sort((a, b) => {
              if (Math.abs(b.intersectionRatio - a.intersectionRatio) > 0.05) {
                  return b.intersectionRatio - a.intersectionRatio;
              }
              // ถ้า ratio ใกล้เคียงกัน ให้เลือกอันที่อยู่ด้านบนกว่า (ค่า top น้อยกว่า)
              return a.boundingClientRect.top - b.boundingClientRect.top;
           });

          const topVisible = visible[0];
          const nextId = topVisible.target.getAttribute('data-qid');
          
          const pinnedId = pinnedQuestionIdRef.current;
          // If a specific question is pinned (user clicked), don't change selection unless truly necessary
          if (pinnedId && nextId !== pinnedId) return;
          if (pinnedId && nextId === pinnedId) {
            pinnedQuestionIdRef.current = null;
          }
          if (nextId) setActiveQuestionId(String(nextId));
        }
      },
      {
        root: questionsScrollRef.current || null,
        rootMargin: '0px 0px -85% 0px', 
        threshold: [0, 0.1, 0.5, 1.0] 
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
      const targetPage = Math.floor(qIndex / questionsPerPage) + 1;
      if (targetPage !== currentPage) {
        setCurrentPage(targetPage);
      }
    }
    setActiveQuestionId(String(qId));
    suppressObserverUntilRef.current = Date.now() + 2000; 
    pinnedQuestionIdRef.current = String(qId);
    if (pinnedClearTimerRef.current) {
      clearTimeout(pinnedClearTimerRef.current);
    }
    pinnedClearTimerRef.current = setTimeout(() => {
      if (pinnedQuestionIdRef.current === String(qId)) {
        pinnedQuestionIdRef.current = null;
      }
    }, 2500);
    setPendingScrollId(String(qId));
  };

  const scrollToQuestion = (qId) => {
    const element = document.getElementById(`q-${qId}`);
    if (!element) return false;

    const container = questionsScrollRef.current;
    if (!container) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return true;
    }

    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const targetScroll = container.scrollTop + (elementRect.top - containerRect.top) - 20;
    container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
    return true;
  };

  useEffect(() => {
    if (!pendingScrollId) return;
    // Add a slight delay to ensure DOM is ready after page switch
    const timer = setTimeout(() => {
        const success = scrollToQuestion(pendingScrollId);
        if (success) {
          setPendingScrollId(null);
        }
    }, 100);
    return () => clearTimeout(timer);
  }, [pendingScrollId, currentPage, questions]);

  const handlePreSubmit = () => {
    if (hasCompleted) {
      showWarning('คุณได้ทำแบบประเมินแล้ว ระบบจะแสดงผลสรุปทักษะ');
      navigate('/skill-assessment/summary', { state: { result: testResult } });
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
          navigate('/skill-assessment/summary', { state: { result: testResult } });
          return;
        }
        const { resolvedUserId, numericWorkerId } = getWorkerIdentity();
        if (!numericWorkerId) {
          showWarning('ไม่พบรหัสช่างสำหรับส่งคำตอบ กรุณาออกและเข้าสู่ระบบใหม่');
          return;
        }
        const sessionId = sessionStorage.getItem('assessment_session_id') || '';
        if (!sessionId) {
          showWarning('ไม่พบข้อมูลรอบการสอบ');
          return;
        }
        let resultData = null;
        try {
          resultData = await apiRequest('/api/worker/score', {
            method: 'POST',
            body: {
              userId: numericWorkerId,
              sessionId,
              answers: answers
            }
          });
        } catch (err) {
          if (err?.data?.message === 'already_completed' && err?.data?.result) {
            setTestResult(err.data.result);
            setHasCompleted(true);
            navigate('/skill-assessment/summary', { state: { result: err.data.result } });
            return;
          }
          const serverMessage = err?.data?.message ? ` (${err.data.message})` : '';
          const statusInfo = err?.status ? ` [${err.status}]` : '';
          showWarning(`ส่งคำตอบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง${statusInfo}${serverMessage}`);
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
        sessionStorage.removeItem('assessment_worker_id');
        sessionStorage.removeItem('assessment_identity_key');

        navigate('/skill-assessment/summary', { state: { result: resultPayload } });
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

  // --- Step 1: Intro ---
  if (step === 'intro') {
    const startAssessment = () => {
      if (hasCompleted) {
        showWarning('คุณได้ทำแบบประเมินแล้ว ระบบจะแสดงผลสรุปทักษะ');
        navigate('/skill-assessment/summary', { state: { result: testResult } });
        return;
      }
      setStep('test');
    };
    return (
      <div className="skill-assessment-container">
        
        {/* Top Navigation Bar */}
        <nav className={`assessment-nav ${isScrolled ? 'scrolled' : ''}`}>
          <div className="nav-brand">
              <div className="nav-logo-box">
                  <img src="/logo123.png" alt="Logo" className="nav-logo-img" />
               </div>
               <h2 className="nav-title">{tradeLabel(resolvedTrade)}</h2>
          </div>
          
          <div className="nav-menu">
            <SidebarItem icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M3 13h1v7c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-7h1c.4 0 .77-.24.92-.62.15-.37.07-.8-.22-1.09l-8.99-9a.996.996 0 0 0-1.41 0l-9.01 9c-.29.29-.37.72-.22 1.09s.52.62.92.62Zm9-8.59 6 6V20H6v-9.59z"></path></svg>} label="หน้าหลัก" onClick={() => navigate('/worker')} />
            <SidebarItem active icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M8 6h9v2H8z"></path><path d="M20 2H6C4.35 2 3 3.35 3 5v14c0 1.65 1.35 3 3 3h15v-2H6c-.55 0-1-.45-1-1s.45-1 1-1h14c.55 0 1-.45 1-1V3c0-.55-.45-1-1-1m-6 14H6c-.35 0-.69.07-1 .18V5c0-.55.45-1 1-1h13v12z"></path></svg>} label="แบบทดสอบ" onClick={() => navigate('/skill-assessment')} />
            <SidebarItem icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M20 6h-3V4c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2M9 4h6v2H9zM8 8h12v3.07l-.83.39a16.78 16.78 0 0 1-14.34 0L4 11.07V8zM4 20v-6.72c2.54 1.19 5.27 1.79 8 1.79s5.46-.6 8-1.79V20z"></path></svg>} label="ประวัติงาน" onClick={() => navigate('/worker/history')} />
            <SidebarItem icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4m0 6c-1.08 0-2-.92-2-2s.92-2 2-2 2 .92 2 2-.92 2-2 2"></path><path d="m20.42 13.4-.51-.29c.05-.37.08-.74.08-1.11s-.03-.74-.08-1.11l.51-.29c.96-.55 1.28-1.78.73-2.73l-1-1.73a2.006 2.006 0 0 0-2.73-.73l-.53.31c-.58-.46-1.22-.83-1.9-1.11v-.6c0-1.1-.9-2-2-2h-2c-1.1 0-2 .9-2 2v.6c-.67.28-1.31.66-1.9 1.11l-.53-.31c-.96-.55-2.18-.22-2.73.73l-1 1.73c-.55.96-.22 2.18.73 2.73l.51.29c-.05.37-.08.74-.08 1.11s.03.74.08 1.11l-.51.29c-.96.55-1.28 1.78-.73 2.73l1 1.73c.55.95 1.77 1.28 2.73.73l.53-.31c.58.46 1.22.83 1.9 1.11v.6c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2v-.6a8.7 8.7 0 0 0 1.9-1.11l.53.31c.95.55 2.18.22 2.73-.73l1-1.73c.55-.96.22-2.18-.73-2.73m-2.59-2.78c.11.45.17.92.17 1.38s-.06.92-.17 1.38a1 1 0 0 0 .47 1.11l1.12.65-1 1.73-1.14-.66c-.38-.22-.87-.16-1.19.14-.68.65-1.51 1.13-2.38 1.4-.42.13-.71.52-.71.96v1.3h-2v-1.3c0-.44-.29-.83-.71-.96-.88-.27-1.7-.75-2.38-1.4a1.01 1.01 0 0 0-1.19-.15l-1.14.66-1-1.73 1.12-.65c.39-.22.58-.68.47-1.11-.11-.45-.17-.92-.17-1.38s.06-.93.17-1.38A1 1 0 0 0 5.7 9.5l-1.12-.65 1-1.73 1.14.66c.38.22.87.16 1.19-.14.68-.65 1.51-1.13 2.38-1.4.42-.13.71-.52.71-.96v-1.3h2v1.3c0 .44.29.83.71.96.88.27 1.7.75 2.38 1.4.32.31.81.36 1.19.14l1.14-.66 1 1.73-1.12.65c-.39.22-.58.68-.47 1.11Z"></path></svg>} label="ตั้งค่า" onClick={() => navigate('/worker-settings')} />
            
            <div className="nav-divider"></div>

            <button onClick={handleLogout} className="logout-btn">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="m20.2 4.02-10-2a.99.99 0 0 0-.83.21C9.14 2.42 9 2.7 9 3v1H4c-.55 0-1 .45-1 1v14c0 .55.45 1 1 1h5v1c0 .3.13.58.37.77.18.15.4.23.63.23.07 0 .13 0 .2-.02l10-2c.47-.09.8-.5.8-.98V5c0-.48-.34-.89-.8-.98M5 18V6h4v12zm14 .18-8 1.6V4.22l8 1.6z"></path><path d="M13 11a1 1 0 1 0 0 2 1 1 0 1 0 0-2"></path></svg>
                ออกจากระบบ
            </button>
          </div>
        </nav>

        <main className="main-content">
          <div className="intro-card">
            
            <div className="intro-header">
               <h2>ข้อตกลงและเงื่อนไขการสอบ</h2>
               <p>โปรดอ่านรายละเอียดก่อนเริ่มทำแบบทดสอบ</p>
            </div>
            
            <div className="intro-body">
              <div className="conditions-box">
                  <h3 className="conditions-title">
                      📋 เงื่อนไขการสอบ
                  </h3>
                  <ul className="conditions-list">
                    <li>เวลาในการทำข้อสอบ: <strong>{examConfig.duration_minutes} นาที</strong></li>
                    <li>จำนวนข้อสอบ: <strong>{examConfig.total_questions} ข้อ</strong> (ทำทีละหน้า)</li>
                    <li>ระดับข้อสอบ: <strong>{roundMeta.levelLabel}</strong></li>
                    <li>การเก็บคะแนน: <strong>ภาคทฤษฎี {roundMeta.scoreWeights?.exam ?? 70}% + ภาคปฏิบัติ {roundMeta.scoreWeights?.practical ?? 30}%</strong></li>
                    <li>เกณฑ์ผ่าน: <strong>{Number.isFinite(roundMeta.passingScorePct) ? `${roundMeta.passingScorePct}%` : (Number.isFinite(examConfig.passing_score) ? `${examConfig.passing_score}%` : '70%')}</strong></li>
                    <li>ต้องทำครบทุกข้อในหน้าปัจจุบันจึงจะเปลี่ยนหน้าได้</li>
                    <li>เมื่อหมดเวลา ระบบจะส่งคำตอบอัตโนมัติ (ข้อที่ทำไม่ทันจะได้ 0 คะแนน)</li>
                  </ul>
              </div>

              <div className="structure-table-container">
                  {/* ตารางที่ 1: โครงสร้างเนื้อหา */}
                  <div className="structure-content">
                    <h3 className="structure-title">โครงสร้างเนื้อหา</h3>
                    <table className="structure-table">
                        <thead>
                          <tr>
                            <th>หัวข้อการประเมิน</th>
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
                                <tr key={idx}>
                                  <td>
                                    <span className="table-icon">{item.icon}</span>
                                    {item.text}
                                  </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                  </div>
              </div>

              <div className="action-buttons">
                <button onClick={() => navigate('/worker')} className="btn-cancel">ยกเลิก</button>
                <button onClick={startAssessment} className="btn-start">เริ่มทำข้อสอบ</button>
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
       <div className="skill-assessment-container">
          
          {/* Top Navigation Bar */}
          <nav className="assessment-nav">
            <div className="nav-brand">
                  <div className="nav-logo-box">
                      <img src="/logo123.png" alt="Logo" className="nav-logo-img" />
                 </div>
                 <h2 className="nav-title">{tradeLabel(resolvedTrade)}</h2>
            </div>
            
            <div className="nav-menu">
              <SidebarItem icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M3 13h1v7c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-7h1c.4 0 .77-.24.92-.62.15-.37.07-.8-.22-1.09l-8.99-9a.996.996 0 0 0-1.41 0l-9.01 9c-.29.29-.37.72-.22 1.09s.52.62.92.62Zm9-8.59 6 6V20H6v-9.59z"></path></svg>} label="หน้าหลัก" onClick={() => navigate('/worker')} />
              <SidebarItem active icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M8 6h9v2H8z"></path><path d="M20 2H6C4.35 2 3 3.35 3 5v14c0 1.65 1.35 3 3 3h15v-2H6c-.55 0-1-.45-1-1s.45-1 1-1h14c.55 0 1-.45 1-1V3c0-.55-.45-1-1-1m-6 14H6c-.35 0-.69.07-1 .18V5c0-.55.45-1 1-1h13v12z"></path></svg>} label="แบบทดสอบ" onClick={() => navigate('/skill-assessment')} />
              <SidebarItem icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M20 6h-3V4c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2M9 4h6v2H9zM8 8h12v3.07l-.83.39a16.78 16.78 0 0 1-14.34 0L4 11.07V8zM4 20v-6.72c2.54 1.19 5.27 1.79 8 1.79s5.46-.6 8-1.79V20z"></path></svg>} label="ประวัติงาน" onClick={() => navigate('/worker/history')} />
              <SidebarItem icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4m0 6c-1.08 0-2-.92-2-2s.92-2 2-2 2 .92 2 2-.92 2-2 2"></path><path d="m20.42 13.4-.51-.29c.05-.37.08-.74.08-1.11s-.03-.74-.08-1.11l.51-.29c.96-.55 1.28-1.78.73-2.73l-1-1.73a2.006 2.006 0 0 0-2.73-.73l-.53.31c-.58-.46-1.22-.83-1.9-1.11v-.6c0-1.1-.9-2-2-2h-2c-1.1 0-2 .9-2 2v.6c-.67.28-1.31.66-1.9 1.11l-.53-.31c-.96-.55-2.18-.22-2.73.73l-1 1.73c-.55.96-.22 2.18.73 2.73l.51.29c-.05.37-.08.74-.08 1.11s.03.74.08 1.11l-.51.29c-.96.55-1.28 1.78-.73 2.73l1 1.73c.55.95 1.77 1.28 2.73.73l.53-.31c.58.46 1.22.83 1.9 1.11v.6c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2v-.6a8.7 8.7 0 0 0 1.9-1.11l.53.31c.95.55 2.18.22 2.73-.73l1-1.73c.55-.96.22-2.18-.73-2.73m-2.59-2.78c.11.45.17.92.17 1.38s-.06.92-.17 1.38a1 1 0 0 0 .47 1.11l1.12.65-1 1.73-1.14-.66c-.38-.22-.87-.16-1.19.14-.68.65-1.51 1.13-2.38 1.4-.42.13-.71.52-.71.96v1.3h-2v-1.3c0-.44-.29-.83-.71-.96-.88-.27-1.7-.75-2.38-1.4a1.01 1.01 0 0 0-1.19-.15l-1.14.66-1-1.73 1.12-.65c.39-.22.58-.68.47-1.11-.11-.45-.17-.92-.17-1.38s.06-.93.17-1.38A1 1 0 0 0 5.7 9.5l-1.12-.65 1-1.73 1.14.66c.38.22.87.16 1.19-.14.68-.65 1.51-1.13 2.38-1.4.42-.13.71-.52.71-.96v-1.3h2v1.3c0 .44.29.83.71.96.88.27 1.7.75 2.38 1.4.32.31.81.36 1.19.14l1.14-.66 1 1.73-1.12.65c-.39.22-.58.68-.47 1.11Z"></path></svg>} label="ตั้งค่า" onClick={() => navigate('/worker-settings')} />
              
              <div className="nav-divider"></div>

              <button onClick={handleLogout} className="logout-btn">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="m20.2 4.02-10-2a.99.99 0 0 0-.83.21C9.14 2.42 9 2.7 9 3v1H4c-.55 0-1 .45-1 1v14c0 .55.45 1 1 1h5v1c0 .3.13.58.37.77.18.15.4.23.63.23.07 0 .13 0 .2-.02l10-2c.47-.09.8-.5.8-.98V5c0-.48-.34-.89-.8-.98M5 18V6h4v12zm14 .18-8 1.6V4.22l8 1.6z"></path><path d="M13 11a1 1 0 1 0 0 2 1 1 0 1 0 0-2"></path></svg>
                  ออกจากระบบ
              </button>
            </div>
          </nav>

          <main className="review-main">
            <div className="review-card">
             <div className="success-icon">✓</div>
             <h2 className="review-title">การประเมินเสร็จสิ้น</h2>
             
             {testResult ? (
               <div className="review-result-container">
                 <div className="score-box">
                    <div className="score-label">คะแนนรวมของคุณ</div>
                    <div className="score-value">{testResult.score} / {questions.length}</div>
                 </div>

                 <h3 className="breakdown-title">📊 วิเคราะห์ความถนัดแยกตามหมวดหมู่</h3>
                 <div className="breakdown-section">
                    {breakdownItems.map((item, idx) => (
                      <div key={idx} className="breakdown-item">
                        <div className="breakdown-header">
                          <span className="breakdown-label">{item.label}</span>
                          <span className="breakdown-percent">{item.percentage}%</span>
                        </div>
                        <div className="breakdown-bar-bg">
                          <div 
                            className={`breakdown-bar-fill ${item.percentage >= 70 ? 'high' : (item.percentage >= 50 ? 'mid' : 'low')}`} 
                            style={{ width: `${item.percentage}%` }} 
                          />
                        </div>
                      </div>
                    ))}
                 </div>
                 
                 <p className="review-footer-text">
                    *คะแนนนี้เป็นผลเบื้องต้น หัวหน้างานจะพิจารณาผลการทดสอบร่วมกับประวัติการทำงานของคุณอีกครั้ง
                 </p>
               </div>
             ) : (
               <p className="review-processing-text">ระบบได้บันทึกคำตอบของคุณแล้ว โปรดรอผลการประเมินอย่างเป็นทางการ</p>
             )}

             <div className="review-actions">
                <button onClick={() => navigate('/worker')} className="btn-home">กลับหน้าหลัก</button>
             </div>
            </div>
          </main>
       </div>
    );
  }

  // --- Step 2: Test ---
  if (loading) return <div className="loading-screen">กำลังโหลด...</div>;
  if (error) return <div className="error-screen">{error}</div>;

  const indexOfLastQ = currentPage * questionsPerPage;
  const indexOfFirstQ = indexOfLastQ - questionsPerPage;
  const currentQuestions = questions.slice(indexOfFirstQ, indexOfLastQ);
  const totalPages = Math.max(1, Math.ceil(questions.length / questionsPerPage));
  const timerClass = timeLeft < 300 ? 'timer-critical' : 'timer-normal';

  return (
    <div className="test-page-container">
       
       {/* === MODAL 1: Warning (แจ้งเตือน) === */}
       {warningModal.show && (
         <div className="modal-overlay">
           <div className="modal-content">
             <h3 className="modal-title warning">แจ้งเตือน</h3>
             <p className="modal-body">{warningModal.message}</p>
             <button 
                onClick={() => setWarningModal({ show: false, message: '' })}
                className="btn-modal btn-confirm"
             >
                ตกลง
             </button>
           </div>
         </div>
       )}

       {/* === MODAL 2: Confirm (ยืนยันส่ง) === */}
       {showConfirmModal && (
         <div className="modal-overlay">
           <div className="modal-content">
             <h3 className="modal-title">ยืนยันการส่งคำตอบ?</h3>
             <p className="modal-body">เมื่อส่งแล้วจะไม่สามารถแก้ไขได้อีก</p>
             <div className="modal-actions">
                <button 
                    onClick={() => setShowConfirmModal(false)}
                    className="btn-modal btn-cancel"
                >
                    ยกเลิก
                </button>
                <button 
                    onClick={submitToBackend}
                    className="btn-modal btn-submit"
                >
                    ยืนยัน
                </button>
             </div>
           </div>
         </div>
       )}

       <header className="test-header">
            <h3 className="test-header-title">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="m19.94 7.68-.03-.09a.8.8 0 0 0-.2-.29l-5-5c-.09-.09-.19-.15-.29-.2l-.09-.03a.8.8 0 0 0-.26-.05c-.02 0-.04-.01-.06-.01H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-12s-.01-.04-.01-.06c0-.09-.02-.17-.05-.26ZM6 20V4h7v4c0 .55.45 1 1 1h4v11z"></path><path d="M8 11h8v2H8zm0 4h8v2H8zm0-8h3v2H8z"></path></svg> 
              แบบทดสอบวัดทักษะ
            </h3>
            <div className={`timer-badge ${timerClass}`}>
                <span>⏱</span> {formatTime(timeLeft)}
            </div>
            <span className="page-indicator">
              หน้า {currentPage} / {totalPages}
            </span>
       </header>

        <div className="test-layout">
          <div ref={questionsScrollRef} className="questions-column">
                {currentQuestions.map((q, index) => {
                  const displayNum = indexOfFirstQ + index + 1;
                  const isAnswered = answers[q.id] !== undefined;
                    return (
                        <div key={q.id} id={`q-${q.id}`} className="question-card">
                            <div className="question-text">
                                <span className="question-number">{displayNum}.</span> {q.text}
                            </div>
                            <div className="choices-list">
                                {q.choices.map((choice, cIdx) => {
                                    const isSelected = answers[q.id] === cIdx;
                                    return (
                                        <label key={cIdx} className={`choice-item ${isSelected ? 'selected' : ''}`}>
                                            <input 
                                              type="radio" 
                                              name={`q-${q.id}`} 
                                              checked={isSelected} 
                                              onChange={() => handleAnswer(q.id, cIdx)} 
                                              className="choice-radio" 
                                            />
                                            <span className={`choice-text ${isSelected ? 'selected' : ''}`}>{choice}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
                <div className="pagination-controls">
                  <button 
                    disabled={currentPage === 1} 
                    onClick={() => { setCurrentPage(p => p - 1); questionsScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                    className="btn-nav btn-prev"
                  >
                    &lt; ย้อนกลับ
                  </button>
                  
                  {currentPage < totalPages ? (
                    <button 
                      onClick={() => { setCurrentPage(p => p + 1); questionsScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                      className="btn-nav btn-next"
                    >
                      ถัดไป &gt;
                    </button>
                  ) : (
                    <button 
                      onClick={handlePreSubmit} 
                      className="btn-nav btn-finish"
                    >
                      ส่งคำตอบ
                    </button>
                  )}
                </div>
              </div>

              <div className="sidebar-column">
                <h4 className="sidebar-title">รายการคำถาม</h4>
                <div className="sidebar-grid" ref={questionListRef}>
                  {questions.map((q, index) => {
                    const isAnswered = answers[q.id] !== undefined;
                    const isSelected = String(q.id) === String(activeQuestionId);
                    
                    let btnClass = 'grid-item';
                    if (isSelected) btnClass += ' active';
                    else if (isAnswered) btnClass += ' answered';

                    return (
                      <button 
                        key={q.id} 
                        data-qid={String(q.id)} 
                        onClick={() => jumpToQuestion(q.id, index + 1)} 
                        className={btnClass}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
                <div className="sidebar-summary">
                    ทำไปแล้ว <strong>{Object.keys(answers).length}</strong> / {questions.length} ข้อ
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
        className={`sidebar-item ${active ? 'active' : ''}`}
    >
        <span className="sidebar-icon">{icon}</span>
        <span className="sidebar-label">{label}</span>
    </div>
);

export default SkillAssessmentTest;
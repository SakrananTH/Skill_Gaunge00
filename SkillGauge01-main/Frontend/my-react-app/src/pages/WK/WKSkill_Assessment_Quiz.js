import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './WKDashboard.css';
import './WKSkillAssessmentQuiz.css';
import { mockUser } from '../mock/mockData';
import WorkerSidebar from '../components/WorkerSidebar';
import { apiRequest } from '../utils/api';

const DEFAULT_ASSESSMENT_DURATION_MINUTES = 60;
const ASSESSMENT_DURATION_STORAGE_KEY = 'skillAssessmentDurationMinutes';

const SkillAssessmentQuiz = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const navUser = location.state?.user;
  const user = useMemo(() => navUser || { ...mockUser, role: 'worker' }, [navUser]);

  const userId = useMemo(() => {
    const fromUser = user?.id;
    if (fromUser) return String(fromUser);
    try {
      const stored = window.sessionStorage?.getItem('user_id') || window.localStorage?.getItem('user_id');
      return stored ? String(stored) : '';
    } catch {
      return '';
    }
  }, [user?.id]);

  const testDurationSeconds = useMemo(() => {
    try {
      const raw = window.localStorage.getItem(ASSESSMENT_DURATION_STORAGE_KEY);
      const minutes = Number(raw);
      if (Number.isFinite(minutes) && minutes > 0) {
        return Math.round(minutes * 60);
      }
    } catch {
      // ignore
    }
    return DEFAULT_ASSESSMENT_DURATION_MINUTES * 60;
  }, []);

  const storageKeyBase = `skillAssessment:${user?.id || user?.username || 'anonymous'}`;
  const endTimeStorageKey = `${storageKeyBase}:endTimeMs`;
  const questionSetStorageKey = `${storageKeyBase}:questionSet`;

  const [questions, setQuestions] = useState([]); // [{ id, text, options: [{id,text}] }]
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // { [questionId]: optionId }

  const [endTimeMs, setEndTimeMs] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(testDurationSeconds);
  const [isLocked, setIsLocked] = useState(false);
  const hasSubmittedRef = useRef(false);

  const total = questions.length;
  const q = total > 0 ? questions[idx] : null;
  const percent = Math.round(((idx) / total) * 100);

  const formatRemaining = (seconds) => {
    const safe = Math.max(0, seconds);
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const answeredCount = useMemo(() => {
    let count = 0;
    for (const question of questions) {
      if (answers[question.id]) count += 1;
    }
    return count;
  }, [answers, questions]);

  const isComplete = total > 0 && answeredCount === total;

  const finalizeAndExit = useCallback(async (reason) => {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    setIsLocked(true);

    const payload = {
      user_id: userId,
      answers: questions
        .map((question) => {
          const optionId = answers[question.id];
          return optionId ? { question_id: question.id, option_id: optionId } : null;
        })
        .filter(Boolean)
    };

    try {
      const result = await apiRequest('/api/assessments', { method: 'POST', body: payload });
      const summary = result?.summary;
      const correct = summary?.correct ?? 0;
      const totalQuestions = summary?.total_questions ?? payload.answers.length;
      const score = summary?.score;
      const passed = summary?.passed;

      if (reason === 'timeout') {
        alert(`หมดเวลาแล้ว\nระบบจะคิดคะแนนตามข้อที่ตอบถูกเท่านั้น\nคะแนน: ${correct}/${totalQuestions}${typeof score === 'number' ? ` (${score}%)` : ''}${passed === true ? '\nผล: ผ่าน' : passed === false ? '\nผล: ไม่ผ่าน' : ''}`);
      } else {
        alert(`ส่งคำตอบแล้ว\nคะแนน: ${correct}/${totalQuestions}${typeof score === 'number' ? ` (${score}%)` : ''}${passed === true ? '\nผล: ผ่าน' : passed === false ? '\nผล: ไม่ผ่าน' : ''}`);
      }
    } catch (error) {
      console.error(error);
      if (reason === 'timeout') {
        alert('หมดเวลาแล้ว\nแต่บันทึกผลไม่สำเร็จ กรุณาลองใหม่');
      } else {
        alert('บันทึกผลไม่สำเร็จ กรุณาลองใหม่');
      }
    } finally {
      try {
        localStorage.removeItem(endTimeStorageKey);
        localStorage.removeItem(questionSetStorageKey);
      } catch {
        // ignore
      }
      navigate('/dashboard', { state: { user } });
    }
  }, [answers, endTimeStorageKey, navigate, questionSetStorageKey, questions, user, userId]);

  useEffect(() => {
    // Ensure idx stays within range after loading questions
    if (idx > 0 && idx >= total) {
      setIdx(0);
    }
  }, [idx, total]);

  useEffect(() => {
    let cancelled = false;

    const loadFromStorage = () => {
      try {
        const raw = localStorage.getItem(questionSetStorageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.questions)) return null;
        return parsed.questions;
      } catch {
        return null;
      }
    };

    const persistToStorage = (items) => {
      try {
        localStorage.setItem(questionSetStorageKey, JSON.stringify({
          savedAt: Date.now(),
          questions: items
        }));
      } catch {
        // ignore
      }
    };

    const fetchQuestions = async () => {
      setLoadingQuestions(true);
      setLoadError('');

      const cached = loadFromStorage();
      if (cached && cached.length > 0) {
        if (!cancelled) {
          setQuestions(cached);
          setLoadingQuestions(false);
        }
        return;
      }

      try {
        const data = await apiRequest('/api/assessments/rounds/active');
        const items = Array.isArray(data?.questions) ? data.questions : [];
        if (!cancelled) {
          setQuestions(items);
          persistToStorage(items);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setQuestions([]);
          setLoadError('โหลดข้อสอบไม่สำเร็จ');
        }
      } finally {
        if (!cancelled) setLoadingQuestions(false);
      }
    };

    fetchQuestions();
    return () => { cancelled = true; };
  }, [questionSetStorageKey]);

  useEffect(() => {
    let stored = null;
    try {
      stored = localStorage.getItem(endTimeStorageKey);
    } catch {
      stored = null;
    }

    const parsed = stored ? Number(stored) : NaN;
    const now = Date.now();
    const initialEnd = Number.isFinite(parsed) && parsed > now ? parsed : now + (testDurationSeconds * 1000);

    setEndTimeMs(initialEnd);
    try {
      localStorage.setItem(endTimeStorageKey, String(initialEnd));
    } catch {
      // ignore
    }
  }, [endTimeStorageKey, testDurationSeconds]);

  useEffect(() => {
    if (!endTimeMs) return;

    const tick = () => {
      const left = Math.ceil((endTimeMs - Date.now()) / 1000);
      setRemainingSeconds(Math.max(0, left));
    };

    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endTimeMs]);

  useEffect(() => {
    if (remainingSeconds <= 0) {
      finalizeAndExit('timeout');
    }
  }, [finalizeAndExit, remainingSeconds]);

  const toggleChoice = (choiceIndex) => {
    if (isLocked) return;
    if (!q) return;
    const option = q.options?.[choiceIndex];
    if (!option?.id) return;

    setAnswers((a) => {
      const current = a[q.id];
      if (current === option.id) {
        const { [q.id]: _omit, ...rest } = a;
        return rest; // deselect
      }
      return { ...a, [q.id]: option.id };
    });
  };

  const prev = () => {
    if (isLocked) return;
    setIdx((i) => Math.max(0, i - 1));
  };
  const next = () => {
    if (isLocked) return;
    if (idx < total - 1) return setIdx(idx + 1);
    // Submit is handled by the sidebar button (and requires all answered)
  };

  return (
    <div className="dash-layout">
      <WorkerSidebar user={user} active="skill" />

      <main className="dash-main">
        <div className="worker-container">
          <header className="worker-hero">
            <div>
              <span className="worker-chip">{user?.role || 'Worker'}</span>
              <h1>ทำแบบทดสอบ</h1>
            </div>
          </header>

          <div className="quiz-page">
            <div className="quiz-topbar">
              <div className={`timer ${remainingSeconds <= 5 * 60 ? 'danger' : ''}`}>
                เวลาที่เหลือ: <strong>{formatRemaining(remainingSeconds)}</strong>
              </div>
            </div>

            {loadingQuestions ? (
              <div className="quiz-loading">กำลังโหลดข้อสอบ...</div>
            ) : loadError ? (
              <div className="quiz-loading quiz-error">{loadError}</div>
            ) : total === 0 ? (
              <div className="quiz-loading quiz-error">ไม่พบข้อสอบในคลังข้อสอบ</div>
            ) : (
              <div className="quiz-layout">
                <section className="quiz-main">
                  <div className="progress">
                    <div className="bar" style={{ width: `${Number.isFinite(percent) ? percent : 0}%` }} />
                    <div className="pct">{Number.isFinite(percent) ? percent : 0}%</div>
                  </div>

                  <h1>คำถามที่ {idx + 1} จาก {total}</h1>
                  <p className="question">{q?.text}</p>

                  <div className="choices">
                    {(q?.options || []).map((opt, i) => (
                      <label
                        key={opt.id}
                        className={`choice ${answers[q.id] === opt.id ? 'selected' : ''}`}
                        role="radio"
                        aria-checked={answers[q.id] === opt.id}
                        tabIndex={0}
                        onClick={() => toggleChoice(i)}
                        onKeyDown={(e) => {
                          if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleChoice(i); }
                        }}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          checked={answers[q.id] === opt.id}
                          readOnly
                        />
                        <span className="bullet" />
                        <span className="text">{opt.text}</span>
                      </label>
                    ))}
                  </div>

                  <div className="nav-actions">
                    <button className="btn-secondary" onClick={prev} disabled={idx === 0 || isLocked}>ก่อนหน้า</button>
                    <button className="btn-secondary" onClick={next} disabled={idx === total - 1 || isLocked}>ต่อไป</button>
                  </div>
                </section>

                <aside className="quiz-sidebar" aria-label="นำทางข้อสอบ">
                  <div className="quiz-sidebar__title">ข้อ</div>
                  <div className="quiz-nav-grid">
                    {questions.map((qq, i) => {
                      const isActive = i === idx;
                      const isAnswered = Boolean(answers[qq.id]);
                      return (
                        <button
                          key={qq.id}
                          type="button"
                          className={`qnav-btn ${isActive ? 'active' : ''} ${isAnswered ? 'done' : ''}`}
                          onClick={() => !isLocked && setIdx(i)}
                          disabled={isLocked}
                          aria-current={isActive ? 'true' : undefined}
                          aria-label={`ข้อที่ ${i + 1}${isAnswered ? ' (ตอบแล้ว)' : ''}`}
                        >
                          {i + 1}
                        </button>
                      );
                    })}
                  </div>
                  <div className="quiz-sidebar__footer">
                    <div className="quiz-answered">ตอบแล้ว {answeredCount}/{total}</div>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => finalizeAndExit('manual')}
                      disabled={isLocked || !isComplete}
                    >
                      ส่งข้อสอบ
                    </button>
                    {!isComplete && <div className="submit-hint">ต้องตอบให้ครบทุกข้อก่อนส่งข้อสอบ</div>}
                  </div>
                </aside>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default SkillAssessmentQuiz;

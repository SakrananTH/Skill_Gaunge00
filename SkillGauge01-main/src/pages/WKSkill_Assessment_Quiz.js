import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './WKDashboard.css';
import './WKSkillAssessmentQuiz.css';
import { mockUser } from '../mock/mockData';
import WorkerSidebar from '../components/WorkerSidebar';

const sampleQuestions = [
  {
    id: 'q1',
    text: 'หน้าที่หลักของผนังรับน้ำหนักในอาคารคืออะไร',
    choices: [
      'เพื่อรองรับน้ำหนักของโครงสร้างด้านบน',
      'เพื่อให้มีฉนวนกันความร้อนต่อการเปลี่ยนแปลงของอุณหภูมิ',
      'เพื่อทำหน้าที่เป็นฉากกั้นระหว่างห้อง',
      'เพื่อเพิ่มความสวยงามให้กับอาคาร',
    ],
    answer: 0,
  },
  {
    id: 'q2',
    text: 'ก่อนเทคอนกรีตต้องตรวจสอบสิ่งใดเป็นอันดับแรก',
    choices: [
      'ความพร้อมของเหล็กเสริมและแบบหล่อ',
      'สีของคอนกรีต',
      'จำนวนแรงงานในไซต์งาน',
      'ระดับเสียงรบกวนบริเวณหน้างาน',
    ],
    answer: 0,
  },
  {
    id: 'q3',
    text: 'อุปกรณ์ป้องกันส่วนบุคคล (PPE) ข้อใดสำคัญที่สุดสำหรับงานเจียรเหล็ก',
    choices: [
      'แว่นตานิรภัยและหน้ากากป้องกันสะเก็ด',
      'รองเท้าแตะ',
      'หมวกแก๊ป',
      'ถุงมือผ้าอย่างเดียว',
    ],
    answer: 0,
  },
];

const SkillAssessmentQuiz = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const navUser = location.state?.user;
  const user = navUser || { ...mockUser, role: 'worker' };

  const questions = useMemo(() => sampleQuestions, []);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // { qid: choiceIndex }

  const q = questions[idx];
  const total = questions.length;
  const percent = Math.round(((idx) / total) * 100);

  const toggleChoice = (choiceIndex) => {
    setAnswers((a) => {
      const current = a[q.id];
      if (current === choiceIndex) {
        const { [q.id]: _omit, ...rest } = a;
        return rest; // deselect
      }
      return { ...a, [q.id]: choiceIndex };
    });
  };

  const prev = () => setIdx((i) => Math.max(0, i - 1));
  const next = () => {
    if (idx < total - 1) return setIdx(idx + 1);
    // submit mock
    const correct = questions.reduce((acc, qq) => acc + (answers[qq.id] === qq.answer ? 1 : 0), 0);
    alert(`ส่งคำตอบแล้ว\nคะแนน (ชั่วคราว): ${correct}/${total}`);
    navigate('/dashboard', { state: { user } });
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
              <p>ตอบคำถามให้ครบทุกข้อ จากนั้นกดส่งคำตอบเพื่อบันทึกผลการประเมินของคุณ</p>
            </div>
            <div className="worker-meta">
              <div className="worker-meta__avatar" aria-hidden="true">{(user?.username || 'W').slice(0,1).toUpperCase()}</div>
              <div className="worker-meta__info">
                <span className="worker-meta__name">{user?.username || 'ไม่ระบุ'}</span>
                {user?.phone && <span className="worker-meta__contact">{user.phone}</span>}
              </div>
            </div>
          </header>

          <div className="quiz-page">
            <div className="progress">
              <div className="bar" style={{ width: `${percent}%` }} />
              <div className="pct">{percent}%</div>
            </div>

            <h1>คำถามที่ {idx + 1} จาก {total}</h1>
            <p className="question">{q.text}</p>

            <div className="choices">
              {q.choices.map((c, i) => (
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

            <div className="nav-actions">
              <button className="btn-secondary" onClick={prev} disabled={idx === 0}>ก่อนหน้า</button>
              <button className="btn-primary" onClick={next}>{idx === total - 1 ? 'ส่งคำตอบ' : 'ต่อไป'}</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SkillAssessmentQuiz;

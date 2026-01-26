import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './AdminQuestionForm.css';
import { apiRequest } from '../../utils/api';

const CATEGORY_OPTIONS = [
  { value: 'structure', label: '1.โครงสร้าง' },
  { value: 'plumbing', label: '2.ประปา' },
  { value: 'roofing', label: '3.หลังคา' },
  { value: 'masonry', label: '4.ก่ออิฐฉาบปูน' },
  { value: 'aluminum', label: '5.ประตูหน้าต่างอลูมิเนียม' },
  { value: 'ceiling', label: '6.ฝ้าเพดาล' },
  { value: 'electric', label: '7.ไฟฟ้า' },
  { value: 'tiling', label: '8.กระเบื้อง' }
];

const CATEGORY_LABELS = CATEGORY_OPTIONS.reduce((accumulator, option) => {
  accumulator[option.value] = option.label;
  return accumulator;
}, {});

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'ระดับที่ 1' },
  { value: 'medium', label: 'ระดับที่ 2' },
  { value: 'hard', label: 'ระดับที่ 3' }
];

const QUESTION_ERROR_MESSAGES = {
  'Invalid input': 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่',
  'At least one option must be correct': 'ต้องมีคำตอบที่ถูกต้องอย่างน้อย 1 ข้อ',
  'No fields to update': 'ไม่มีข้อมูลให้บันทึก',
  not_found: 'ไม่พบคำถามในระบบ',
  'invalid id': 'รหัสคำถามไม่ถูกต้อง',
  'Server error': 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์',
  forbidden: 'คุณไม่มีสิทธิ์ทำรายการนี้'
};

const MIN_OPTIONS = 2;
const DEFAULT_OPTION_COUNT = 4;
const MAX_OPTIONS = 6;

const createEmptyOption = () => ({ text: '', isCorrect: false });

const createInitialForm = (categoryValue = null) => {
  const resolvedCategory = categoryValue && CATEGORY_LABELS[categoryValue]
    ? categoryValue
    : CATEGORY_OPTIONS[0].value;
  return {
    text: '',
    category: resolvedCategory,
    difficulty: DIFFICULTY_OPTIONS[0].value,
    options: Array.from({ length: DEFAULT_OPTION_COUNT }, () => createEmptyOption())
  };
};

const toFriendlyApiMessage = (error, fallback = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง') => {
  const messageKey = error?.data?.message || error?.message;
  if (messageKey && QUESTION_ERROR_MESSAGES[messageKey]) {
    return QUESTION_ERROR_MESSAGES[messageKey];
  }
  if (error?.status === 401 || error?.status === 403) {
    return 'คุณไม่มีสิทธิ์หรือเซสชันหมดอายุ';
  }
  return fallback;
};

const AdminQuestionForm = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const editingQuestion = location.state?.question;
  const selectedCategory = location.state?.category || CATEGORY_OPTIONS[0].value;

  const [form, setForm] = useState(() => {
    if (editingQuestion) {
      return {
        text: editingQuestion.text || '',
        category: editingQuestion.category || selectedCategory,
        difficulty: editingQuestion.difficulty || DIFFICULTY_OPTIONS[0].value,
        options: Array.isArray(editingQuestion.options) && editingQuestion.options.length
          ? editingQuestion.options.map(opt => ({
              text: opt.text || '',
              isCorrect: Boolean(opt.isCorrect ?? opt.is_correct)
            }))
          : Array.from({ length: DEFAULT_OPTION_COUNT }, () => createEmptyOption())
      };
    }
    return createInitialForm(selectedCategory);
  });

  const [savingQuestion, setSavingQuestion] = useState(false);
  const [questionError, setQuestionError] = useState('');
  const [questionMessage, setQuestionMessage] = useState('');
  const navigateTimeoutRef = useRef(null);

  const goToQuizBank = useCallback(() => {
    navigate('/admin', { replace: true, state: { initialTab: 'quiz' } });
  }, [navigate]);

  const handleAddOption = () => {
    if (form.options.length >= MAX_OPTIONS) {
      setQuestionError(`เพิ่มตัวเลือกได้ไม่เกิน ${MAX_OPTIONS} ข้อ`);
      return;
    }
    setQuestionError('');
    setForm(prev => ({
      ...prev,
      options: [...prev.options, createEmptyOption()]
    }));
  };

  const handleRemoveOption = (index) => {
    if (form.options.length <= MIN_OPTIONS) {
      setQuestionError(`ต้องมีตัวเลือกอย่างน้อย ${MIN_OPTIONS} ข้อ`);
      return;
    }
    setQuestionError('');
    setForm(prev => ({
      ...prev,
      options: prev.options.filter((_, optionIndex) => optionIndex !== index)
    }));
  };

  useEffect(() => () => {
    if (navigateTimeoutRef.current) {
      clearTimeout(navigateTimeoutRef.current);
    }
  }, []);

  const pageTitle = editingQuestion ? 'แก้ไขคำถาม' : 'เพิ่มคำถามใหม่';
  const pageSubtitle = editingQuestion
    ? 'ปรับปรุงรายละเอียดคำถามเพื่อให้เหมาะกับการประเมิน'
    : 'สร้างคำถามใหม่เพื่อเติมคลังข้อสอบของกิจกรรมนี้';
  const categoryLabel = CATEGORY_LABELS[form.category]?.replace(/^\d+\.\s*/, '') || 'ไม่ระบุหมวดหมู่';
  const difficultyLabel = DIFFICULTY_OPTIONS.find(option => option.value === form.difficulty)?.label || '-';
  const optionLimitReached = form.options.length >= MAX_OPTIONS;
  const remainingOptionSlots = Math.max(0, MAX_OPTIONS - form.options.length);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setQuestionError('');
    setQuestionMessage('');

    if (!form.text.trim()) {
      setQuestionError('กรุณาใส่คำถาม');
      return;
    }

    const sanitizedOptions = form.options
      .map(option => ({
        text: option.text.trim(),
        is_correct: option.text.trim().length > 0 && option.isCorrect
      }))
      .filter(option => option.text.length > 0);

    if (sanitizedOptions.length < MIN_OPTIONS) {
      setQuestionError(`กรุณาใส่ตัวเลือกอย่างน้อย ${MIN_OPTIONS} ข้อ`);
      return;
    }

    const hasCorrectAnswer = sanitizedOptions.some(option => option.is_correct);
    if (!hasCorrectAnswer) {
      setQuestionError('กรุณาเลือกคำตอบที่ถูกต้องอย่างน้อย 1 ข้อ');
      return;
    }

    const payload = {
      text: form.text.trim(),
      category: form.category,
      difficulty: form.difficulty,
      options: sanitizedOptions
    };

    setSavingQuestion(true);
    try {
      if (editingQuestion?.id) {
        await apiRequest(`/api/admin/questions/${editingQuestion.id}`, { method: 'PUT', body: payload });
        setQuestionMessage('บันทึกการแก้ไขเรียบร้อย');
      } else {
        await apiRequest('/api/admin/questions', { method: 'POST', body: payload });
        setQuestionMessage('เพิ่มคำถามเรียบร้อย');
      }

      if (navigateTimeoutRef.current) {
        clearTimeout(navigateTimeoutRef.current);
      }
      navigateTimeoutRef.current = setTimeout(() => {
        goToQuizBank();
      }, 900);
    } catch (error) {
      console.error('Failed to save question', error);
      setQuestionError(toFriendlyApiMessage(error, editingQuestion?.id ? 'ไม่สามารถบันทึกการแก้ไขได้' : 'ไม่สามารถเพิ่มคำถามได้'));
    } finally {
      setSavingQuestion(false);
    }
  };

  const handleCancel = () => {
    if (navigateTimeoutRef.current) {
      clearTimeout(navigateTimeoutRef.current);
    }
    goToQuizBank();
  };

  return (
    <div className="admin-question-form">
      <div className="aqf-content">
        <header className="aqf-header">
          <button type="button" className="aqf-button aqf-button--ghost" onClick={handleCancel}>
            ← กลับ
          </button>
          <div className="aqf-heading">
            <h1>{pageTitle}</h1>
            <p>{pageSubtitle}</p>
            <div className="aqf-meta">
              <span className="aqf-tag">หมวด: {categoryLabel}</span>
              <span className="aqf-tag">ระดับความยาก: {difficultyLabel}</span>
              <span className="aqf-tag aqf-tag--muted">ตัวเลือก {form.options.length}/{MAX_OPTIONS}</span>
            </div>
          </div>
        </header>

        {(questionError || questionMessage) && (
          <div className="aqf-feedback">
            {questionError && <div className="aqf-alert aqf-alert--error">{questionError}</div>}
            {questionMessage && <div className="aqf-alert aqf-alert--success">{questionMessage}</div>}
          </div>
        )}

        <section className="aqf-card">
          <form onSubmit={handleSubmit} className="aqf-form">
            <div className="aqf-section">
              <h2 className="aqf-section-title">รายละเอียดคำถาม</h2>
              <div className="aqf-field">
                <label htmlFor="question-text">คำถาม *</label>
                <textarea
                  id="question-text"
                  className="aqf-control aqf-control--textarea"
                  value={form.text}
                  onChange={(event) => setForm({ ...form, text: event.target.value })}
                  placeholder="พิมพ์คำถามหรือสถานการณ์ที่ต้องการประเมิน"
                  required
                />
                <p className="aqf-hint">คำถามที่ชัดเจนช่วยให้ผู้สอบเข้าใจโจทย์ได้ดีขึ้น</p>
              </div>
            </div>

            <div className="aqf-section">
              <h2 className="aqf-section-title">การจัดหมวดหมู่</h2>
              <div className="aqf-grid">
                <div className="aqf-field">
                  <label htmlFor="question-category">หมวดหมู่ *</label>
                  <select
                    id="question-category"
                    className="aqf-control aqf-control--half"
                    value={form.category}
                    onChange={(event) => setForm({ ...form, category: event.target.value })}
                  >
                    {CATEGORY_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="aqf-field">
                  <label htmlFor="question-difficulty">ระดับความยาก *</label>
                  <select
                    id="question-difficulty"
                    className="aqf-control aqf-control--half"
                    value={form.difficulty}
                    onChange={(event) => setForm({ ...form, difficulty: event.target.value })}
                  >
                    {DIFFICULTY_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <p className="aqf-hint">เลือกความยากให้เหมาะสมกับทักษะที่ต้องการวัด</p>
                </div>
              </div>
            </div>

            <div className="aqf-section">
              <div className="aqf-section-header">
                <h2 className="aqf-section-title">ตัวเลือกคำตอบ</h2>
                <span className="aqf-caption">
                  {optionLimitReached
                    ? `ครบจำนวนสูงสุด ${MAX_OPTIONS} ตัวเลือกแล้ว`
                    : `เพิ่มได้อีก ${remainingOptionSlots} ตัวเลือก`}
                </span>
              </div>
              <div className="aqf-option-list">
                {form.options.map((option, index) => (
                  <div key={index} className="aqf-option-row">
                    <label className="aqf-check">
                      <input
                        type="checkbox"
                        checked={option.isCorrect}
                        onChange={(event) => {
                          const next = [...form.options];
                          next[index].isCorrect = event.target.checked;
                          setForm({ ...form, options: next });
                        }}
                      />
                      <span>คำตอบที่ถูก</span>
                    </label>
                    <input
                      type="text"
                      className="aqf-control"
                      value={option.text}
                      onChange={(event) => {
                        const next = [...form.options];
                        next[index].text = event.target.value;
                        setForm({ ...form, options: next });
                      }}
                      placeholder={`ตัวเลือกที่ ${index + 1}`}
                    />
                    {form.options.length > MIN_OPTIONS && (
                      <button
                        type="button"
                        className="aqf-icon-button"
                        onClick={() => handleRemoveOption(index)}
                        aria-label={`ลบตัวเลือกที่ ${index + 1}`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="aqf-inline-actions">
                <button
                  type="button"
                  className="aqf-button aqf-button--neutral"
                  onClick={handleAddOption}
                  disabled={optionLimitReached}
                >
                  + เพิ่มตัวเลือก
                </button>
              </div>
            </div>

            <div className="aqf-actions">
              <button type="submit" className="aqf-button aqf-button--primary" disabled={savingQuestion}>
                {savingQuestion ? 'กำลังบันทึก...' : editingQuestion ? 'บันทึกการแก้ไข' : 'บันทึกคำถามใหม่'}
              </button>
              <button type="button" className="aqf-button aqf-button--ghost" onClick={handleCancel}>
                ยกเลิก
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default AdminQuestionForm;

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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

const DEFAULT_SUBCATEGORY_OPTIONS = {
  structure: [
    { value: 'rebar', label: '1. งานเหล็กเสริม (Rebar)' },
    { value: 'concrete', label: '2. งานคอนกรีต (Concrete)' },
    { value: 'formwork', label: '3. งานไม้แบบ (Formwork)' },
    { value: 'tools', label: '4. องค์อาคาร: คาน/เสา/ฐานราก' },
    { value: 'theory', label: '5. ทฤษฎีแบบ/พฤติ (Design Theory)' }
  ],
  plumbing: [],
  roofing: [],
  masonry: [],
  aluminum: [],
  ceiling: [],
  electric: [],
  tiling: []
};

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

const createInitialForm = (categoryValue = null, subcategoryOptions = DEFAULT_SUBCATEGORY_OPTIONS) => {
  const resolvedCategory = categoryValue && CATEGORY_LABELS[categoryValue]
    ? categoryValue
    : CATEGORY_OPTIONS[0].value;
  const subcategories = subcategoryOptions[resolvedCategory] || [];
  return {
    text: '',
    category: resolvedCategory,
    subcategory: subcategories.length > 0 ? subcategories[0].value : '',
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
  const { id } = useParams();
  const [editingQuestion, setEditingQuestion] = useState(location.state?.question || null);
  const selectedCategory = location.state?.category || CATEGORY_OPTIONS[0].value;
  const [isLoading, setIsLoading] = useState(false);

  const [subcategoryOptions, setSubcategoryOptions] = useState(DEFAULT_SUBCATEGORY_OPTIONS);

  useEffect(() => {
    const storedOptions = localStorage.getItem('admin_subcategory_options');
    if (storedOptions) {
      try {
        setSubcategoryOptions(JSON.parse(storedOptions));
      } catch (e) { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (!editingQuestion && id) {
      const fetchQuestion = async () => {
        setIsLoading(true);
        try {
          let data;
          // ตรวจสอบว่าเป็นคำถาม Structural หรือไม่ (ID ขึ้นต้นด้วย struct_)
          if (id.startsWith('struct_')) {
            const realId = id.replace('struct_', '');
            const rawData = await apiRequest(`/api/question-structural/${realId}`); // สมมติ Endpoint นี้
            
            // แปลงข้อมูล Structural เป็นฟอร์แมตของฟอร์ม
            data = {
              id: id,
              text: rawData.question_text,
              category: 'structure',
              subcategory: rawData.skill_type, // อาจต้องมีการ Map ค่าให้ตรงกับ Dropdown หากจำเป็น
              difficulty: rawData.difficulty_level === 1 ? 'easy' : rawData.difficulty_level === 2 ? 'medium' : 'hard',
              options: [
                { text: rawData.choice_a || '', isCorrect: rawData.answer === 'A' },
                { text: rawData.choice_b || '', isCorrect: rawData.answer === 'B' },
                { text: rawData.choice_c || '', isCorrect: rawData.answer === 'C' },
                { text: rawData.choice_d || '', isCorrect: rawData.answer === 'D' }
              ],
              _source: 'question_Structural',
              _originalId: rawData.id
            };
          } else {
            data = await apiRequest(`/api/admin/questions/${id}`);
          }
          setEditingQuestion(data);
          
          // Update form state after fetching
          const category = data.category || selectedCategory;
          const subcategories = DEFAULT_SUBCATEGORY_OPTIONS[category] || [];
          setForm({
            text: data.text || '',
            category: category,
            subcategory: data.subcategory || (subcategories.length > 0 ? subcategories[0].value : ''),
            difficulty: data.difficulty || DIFFICULTY_OPTIONS[0].value,
            options: Array.isArray(data.options) && data.options.length
              ? data.options.map(opt => ({
                  text: opt.text || '',
                  isCorrect: Boolean(opt.isCorrect ?? opt.is_correct)
                }))
              : Array.from({ length: DEFAULT_OPTION_COUNT }, () => createEmptyOption())
          });
        } catch (error) {
          console.error('Failed to fetch question details', error);
          setQuestionError('ไม่สามารถโหลดข้อมูลคำถามได้ หรือคำถามอาจถูกลบไปแล้ว');
        } finally {
          setIsLoading(false);
        }
      };
      fetchQuestion();
    }
  }, [id, editingQuestion, selectedCategory]);

  const [form, setForm] = useState(() => {
    if (editingQuestion) {
      const category = editingQuestion.category || selectedCategory;
      const subcategories = DEFAULT_SUBCATEGORY_OPTIONS[category] || [];
      return {
        text: editingQuestion.text || '',
        category: category,
        subcategory: editingQuestion.subcategory || (subcategories.length > 0 ? subcategories[0].value : ''),
        difficulty: editingQuestion.difficulty || DIFFICULTY_OPTIONS[0].value,
        options: Array.isArray(editingQuestion.options) && editingQuestion.options.length
          ? editingQuestion.options.map(opt => ({
              text: opt.text || '',
              isCorrect: Boolean(opt.isCorrect ?? opt.is_correct)
            }))
          : Array.from({ length: DEFAULT_OPTION_COUNT }, () => createEmptyOption())
      };
    }
    return createInitialForm(selectedCategory, DEFAULT_SUBCATEGORY_OPTIONS);
  });

  useEffect(() => {
    if (editingQuestion && !form.text && !isLoading) {
       const category = editingQuestion.category || selectedCategory;
       const subcategories = DEFAULT_SUBCATEGORY_OPTIONS[category] || [];
       setForm({
        text: editingQuestion.text || '',
        category: category,
        subcategory: editingQuestion.subcategory || (subcategories.length > 0 ? subcategories[0].value : ''),
        difficulty: editingQuestion.difficulty || DIFFICULTY_OPTIONS[0].value,
        options: Array.isArray(editingQuestion.options) && editingQuestion.options.length
          ? editingQuestion.options.map(opt => ({
              text: opt.text || '',
              isCorrect: Boolean(opt.isCorrect ?? opt.is_correct)
            }))
          : Array.from({ length: DEFAULT_OPTION_COUNT }, () => createEmptyOption())
      });
    } else if (!editingQuestion && !form.subcategory && subcategoryOptions[form.category]?.length > 0) {
       setForm(prev => ({
         ...prev,
         subcategory: subcategoryOptions[prev.category][0].value
       }));
    }
  }, [subcategoryOptions, editingQuestion, form.category, form.subcategory, isLoading, form.text, selectedCategory]);

  const [savingQuestion, setSavingQuestion] = useState(false);
  const [questionError, setQuestionError] = useState('');
  const [questionMessage, setQuestionMessage] = useState('');
  const navigateTimeoutRef = useRef(null);

  const goToQuizBank = useCallback(() => {
    navigate('/admin', { replace: true, state: { initialTab: 'quiz' } });
  }, [navigate]);

  const handleAddOption = useCallback(() => {
    if (form.options.length >= MAX_OPTIONS) {
      setQuestionError(`เพิ่มตัวเลือกได้ไม่เกิน ${MAX_OPTIONS} ข้อ`);
      return;
    }
    setQuestionError('');
    setForm(prev => ({
      ...prev,
      options: [...prev.options, createEmptyOption()]
    }));
  }, [form.options.length]);

  const handleRemoveOption = useCallback((index) => {
    if (form.options.length <= MIN_OPTIONS) {
      setQuestionError(`ต้องมีตัวเลือกอย่างน้อย ${MIN_OPTIONS} ข้อ`);
      return;
    }
    setQuestionError('');
    setForm(prev => ({
      ...prev,
      options: prev.options.filter((_, optionIndex) => optionIndex !== index)
    }));
  }, [form.options.length]);

  useEffect(() => () => {
    if (navigateTimeoutRef.current) {
      clearTimeout(navigateTimeoutRef.current);
    }
  }, []);

  const pageTitle = useMemo(() => editingQuestion ? 'แก้ไขคำถาม' : 'เพิ่มคำถามใหม่', [editingQuestion]);
  
  const pageSubtitle = useMemo(() => editingQuestion
    ? 'ปรับปรุงรายละเอียดคำถามเพื่อให้เหมาะกับการประเมิน'
    : 'สร้างคำถามใหม่เพื่อเติมคลังข้อสอบของกิจกรรมนี้', [editingQuestion]);

  const categoryLabel = useMemo(() => 
    CATEGORY_LABELS[form.category]?.replace(/^\d+\.\s*/, '') || 'ไม่ระบุหมวดหมู่', 
    [form.category]
  );

  const difficultyLabel = useMemo(() => 
    DIFFICULTY_OPTIONS.find(option => option.value === form.difficulty)?.label || '-', 
    [form.difficulty]
  );

  const optionLimitReached = form.options.length >= MAX_OPTIONS;
  const remainingOptionSlots = Math.max(0, MAX_OPTIONS - form.options.length);

  const handleSubmit = useCallback(async (event) => {
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
      subcategory: form.subcategory && form.subcategory.trim() ? form.subcategory.trim() : null,
      difficulty: form.difficulty,
      options: sanitizedOptions
    };

    console.log('Sending payload:', payload); // Debug log

    setSavingQuestion(true);
    try {
      if (editingQuestion?.id) {
        // ตรวจสอบว่าเป็นคำถาม Structural หรือไม่ เพื่อยิง API ให้ถูกตัว
        if (editingQuestion._source === 'question_Structural' || String(editingQuestion.id).startsWith('struct_')) {
          const realId = editingQuestion._originalId || String(editingQuestion.id).replace('struct_', '');
          
          // หาคำตอบที่ถูกเพื่อแปลงกลับเป็น A, B, C, D
          const correctIndex = sanitizedOptions.findIndex(opt => opt.is_correct);
          const answerChar = ['A', 'B', 'C', 'D'][correctIndex] || 'A';

          const structPayload = {
            question_text: form.text.trim(),
            skill_type: form.subcategory, 
            difficulty_level: form.difficulty === 'easy' ? 1 : form.difficulty === 'medium' ? 2 : 3,
            choice_a: sanitizedOptions[0]?.text || '',
            choice_b: sanitizedOptions[1]?.text || '',
            choice_c: sanitizedOptions[2]?.text || '',
            choice_d: sanitizedOptions[3]?.text || '',
            answer: answerChar
          };
          await apiRequest(`/api/question-structural/${realId}`, { method: 'PUT', body: structPayload });
        } else {
          await apiRequest(`/api/admin/questions/${editingQuestion.id}`, { method: 'PUT', body: payload });
        }
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
  }, [form, editingQuestion, goToQuizBank]);

  const handleCancel = useCallback(() => {
    if (navigateTimeoutRef.current) {
      clearTimeout(navigateTimeoutRef.current);
    }
    goToQuizBank();
  }, [goToQuizBank]);

  if (isLoading) {
    return <div className="admin-question-form"><div className="aqf-content" style={{textAlign:'center', padding:'2rem'}}>กำลังโหลดข้อมูล...</div></div>;
  }

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
              <h2 className="aqf-section-title">การจัดหมวดหมู่</h2>
              <div className="aqf-grid">
                <div className="aqf-field">
                  <label htmlFor="question-category">ประเภทช่าง *</label>
                  <select
                    id="question-category"
                    className="aqf-control aqf-control--third"
                    value={form.category}
                    disabled
                  >
                    {CATEGORY_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                
                {subcategoryOptions[form.category] && subcategoryOptions[form.category].length > 0 && (
                  <div className="aqf-field">
                    <label htmlFor="question-subcategory">หมวดหมู่ *</label>
                    <select
                      id="question-subcategory"
                      className="aqf-control aqf-control--third"
                      value={form.subcategory}
                      onChange={(event) => setForm({ ...form, subcategory: event.target.value })}
                    >
                      <option value="">เลือกหมวดหมู่</option>
                      {subcategoryOptions[form.category].map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div className="aqf-field">
                  <label htmlFor="question-difficulty">ระดับความยาก *</label>
                  <select
                    id="question-difficulty"
                    className="aqf-control aqf-control--third"
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
                        type="radio"
                        name="correct-answer"
                        checked={option.isCorrect}
                        onChange={() => {
                          const next = form.options.map((opt, i) => ({
                            ...opt,
                            isCorrect: i === index
                          }));
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
        </section>      </div>
    </div>
  );
};

export default AdminQuestionForm;

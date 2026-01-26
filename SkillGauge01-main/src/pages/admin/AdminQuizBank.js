import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../Dashboard.css';
import './AdminQuizBank.css';
import { apiRequest } from '../../utils/api';

const ASSESSMENT_QUESTION_COUNT = 60;
const ROUND_NEW_VALUE = '__new__';
const STORAGE_KEYS = {
  roundId: 'quizBankSelectedRoundId',
  category: 'quizBankSelectedCategory'
};
const TABLE_FILTER_ALL = 'all';

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

const CATEGORY_BUTTON_OPTIONS = CATEGORY_OPTIONS;

const CATEGORY_LABELS = CATEGORY_OPTIONS.reduce((accumulator, option) => {
  accumulator[option.value] = option.label;
  return accumulator;
}, {});

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'ระดับที่ 1' },
  { value: 'medium', label: 'ระดับที่ 2' },
  { value: 'hard', label: 'ระดับที่ 3' }
];

const DIFFICULTY_LABELS = DIFFICULTY_OPTIONS.reduce((accumulator, option) => {
  accumulator[option.value] = option.label;
  return accumulator;
}, {});

const QUESTION_ERROR_MESSAGES = {
  'Invalid input': 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่',
  'At least one option must be correct': 'ต้องมีคำตอบที่ถูกต้องอย่างน้อย 1 ข้อ',
  'No fields to update': 'ไม่มีข้อมูลให้บันทึก',
  not_found: 'ไม่พบคำถามในระบบ',
  'invalid id': 'รหัสคำถามไม่ถูกต้อง',
  'Server error': 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์',
  forbidden: 'คุณไม่มีสิทธิ์ทำรายการนี้'
};

const GENERIC_ERROR_MESSAGES = {
  ...QUESTION_ERROR_MESSAGES,
  invalid_title: 'กรุณาระบุชื่อกิจกรรมให้ถูกต้อง',
  invalid_id: 'รหัสไม่ถูกต้อง',
  not_found: 'ไม่พบข้อมูลในระบบ'
};

const QUESTIONS_FETCH_LIMIT = 200;
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
  if (messageKey && GENERIC_ERROR_MESSAGES[messageKey]) {
    return GENERIC_ERROR_MESSAGES[messageKey];
  }
  if (error?.status === 401 || error?.status === 403) {
    return 'คุณไม่มีสิทธิ์หรือเซสชันหมดอายุ';
  }
  return fallback;
};

const AdminQuizBank = () => {
  const navigate = useNavigate();
  const storedCategory = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEYS.category) : null;
  const initialCategory = storedCategory && CATEGORY_LABELS[storedCategory] ? storedCategory : CATEGORY_OPTIONS[0].value;
  const storedRoundId = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEYS.roundId) : null;

  const categorySelectSeqRef = useRef(0);

  const [questions, setQuestions] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState('');
  const [rounds, setRounds] = useState([]);
  const [roundsLoading, setRoundsLoading] = useState(false);
  const [roundsInitialized, setRoundsInitialized] = useState(false);
  const [roundsError, setRoundsError] = useState('');
  const [selectedRoundId, setSelectedRoundId] = useState(storedRoundId || ROUND_NEW_VALUE);
  const [questionError, setQuestionError] = useState('');
  const [questionMessage, setQuestionMessage] = useState('');
  const [deletingQuestionId, setDeletingQuestionId] = useState(null);
  const [roundForm, setRoundForm] = useState({
    category: initialCategory
  });
  const [roundSelectionTouched, setRoundSelectionTouched] = useState(Boolean(storedRoundId));
  const [roundSaving, setRoundSaving] = useState(false);
  const [roundError, setRoundError] = useState('');
  const [roundMessage, setRoundMessage] = useState('');
  const [tableCategoryFilter, setTableCategoryFilter] = useState(TABLE_FILTER_ALL);
  const [tableDifficultyFilter, setTableDifficultyFilter] = useState(TABLE_FILTER_ALL);

  const loadQuestions = useCallback(async () => {
    setQuestionsLoading(true);
    setQuestionsError('');
    try {
      const response = await apiRequest(`/api/admin/questions?limit=${QUESTIONS_FETCH_LIMIT}`);
      const items = Array.isArray(response?.items) ? response.items : [];
      setQuestions(items);
    } catch (error) {
      console.error('Failed to load assessment questions', error);
      setQuestions([]);
      setQuestionsError(toFriendlyApiMessage(error, 'ไม่สามารถโหลดชุดคำถามได้'));
    } finally {
      setQuestionsLoading(false);
    }
  }, []);

  const loadRounds = useCallback(async (preferredId, options = {}) => {
    const { keepSelection = false } = options;
    setRoundsLoading(true);
    setRoundsError('');
    try {
      const response = await apiRequest('/api/admin/assessments/rounds');
      const items = Array.isArray(response?.items) ? response.items : [];
      setRounds(items);

      if (!keepSelection) {
        let nextSelection = ROUND_NEW_VALUE;
        if (preferredId && items.some(item => item.id === preferredId)) {
          nextSelection = preferredId;
        } else if (selectedRoundId && selectedRoundId !== ROUND_NEW_VALUE && items.some(item => item.id === selectedRoundId)) {
          nextSelection = selectedRoundId;
        } else if (!selectedRoundId && items.length) {
          nextSelection = items[0].id;
        }

        setSelectedRoundId(nextSelection);
      }
      return items;
    } catch (error) {
      console.error('Failed to load assessment rounds', error);
      setRounds([]);
      if (!keepSelection) {
        setSelectedRoundId(ROUND_NEW_VALUE);
      }
      setRoundsError(toFriendlyApiMessage(error, 'ไม่สามารถโหลดกิจกรรมข้อสอบได้'));
      return [];
    } finally {
      setRoundsLoading(false);
      setRoundsInitialized(true);
    }
  }, [selectedRoundId]);

  useEffect(() => {
    loadQuestions();
    loadQuestions();
  }, [loadQuestions]);

  useEffect(() => {
    const storedRoundId = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEYS.roundId) : null;
    loadRounds(storedRoundId, { keepSelection: categorySelectSeqRef.current > 0 });
  }, [loadRounds]);



  useEffect(() => {
    if (!selectedRoundId || selectedRoundId === ROUND_NEW_VALUE) {
      return;
    }

    const matched = rounds.find(round => round.id === selectedRoundId);
    if (matched) {
      setRoundForm(prev => ({
        ...prev,
        category: matched.category || CATEGORY_OPTIONS[0].value
      }));
    }
  }, [selectedRoundId, rounds]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (selectedRoundId && selectedRoundId !== ROUND_NEW_VALUE) {
      window.localStorage.setItem(STORAGE_KEYS.roundId, selectedRoundId);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.roundId);
    }
  }, [selectedRoundId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (roundForm.category) {
      window.localStorage.setItem(STORAGE_KEYS.category, roundForm.category);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.category);
    }
  }, [roundForm.category]);



  const handleEdit = (question) => {
    navigate('/admin/question/edit/' + question.id, { 
      state: { question, category: roundForm.category } 
    });
  };



  const handleDelete = async (questionId) => {
    setQuestionError('');
    setQuestionMessage('');
    if (!window.confirm('ต้องการลบคำถามนี้?')) {
      return;
    }
    setDeletingQuestionId(questionId);
    try {
      await apiRequest(`/api/admin/questions/${questionId}`, { method: 'DELETE' });
      setQuestions(prev => prev.filter(question => question.id !== questionId));
      setQuestionsError('');
      setQuestionMessage('ลบคำถามเรียบร้อย');
      loadQuestions();
    } catch (error) {
      console.error('Failed to delete question', error);
      setQuestionError(error?.message || 'ไม่สามารถลบคำถามได้');
    } finally {
      setDeletingQuestionId(null);
    }
  };



  const getCategoryDisplayName = useCallback((categoryValue) => {
    const label = CATEGORY_LABELS[categoryValue] || '';
    return label.replace(/^\d+\.\s*/, '') || categoryValue;
  }, []);

  const buildUniqueRoundTitle = useCallback((categoryValue, ignoreRoundId = null) => {
    const baseName = getCategoryDisplayName(categoryValue);
    const normalizedBase = baseName.trim() || categoryValue;
    const takenTitles = new Set(
      rounds
        .filter(round => !ignoreRoundId || round.id !== ignoreRoundId)
        .map(round => (round.title || '').trim().toLowerCase())
        .filter(Boolean)
    );

    if (!normalizedBase) {
      return categoryValue;
    }

    let attempt = normalizedBase;
    let suffix = 1;
    while (takenTitles.has(attempt.toLowerCase())) {
      suffix += 1;
      attempt = `${normalizedBase} (${suffix})`;
    }
    return attempt;
  }, [getCategoryDisplayName, rounds]);

  const createRoundForCategory = useCallback(async (categoryValue, selectionSeq = null) => {
    const expectedSeq = selectionSeq ?? categorySelectSeqRef.current;
    const payload = {
      category: categoryValue,
      title: buildUniqueRoundTitle(categoryValue),
      description: '',
      questionCount: ASSESSMENT_QUESTION_COUNT,
      startAt: null,
      endAt: null,
      frequencyMonths: null
    };

    setRoundSaving(true);
    try {
      const created = await apiRequest('/api/admin/assessments/rounds', { method: 'POST', body: payload });
      const createdId = created?.id;
      if (expectedSeq !== categorySelectSeqRef.current) {
        return;
      }
      await loadRounds(createdId, { keepSelection: true });
      if (expectedSeq !== categorySelectSeqRef.current) {
        return;
      }
      if (createdId) {
        setSelectedRoundId(createdId);
      }
      setRoundMessage('สร้างกิจกรรมข้อสอบเรียบร้อย');
      setQuestionMessage('');
      setQuestionError('');
    } catch (error) {
      console.error('Failed to save assessment round', error);
      setRoundError(toFriendlyApiMessage(error, 'ไม่สามารถบันทึกกิจกรรมข้อสอบได้'));
    } finally {
      setRoundSaving(false);
    }
  }, [buildUniqueRoundTitle, loadRounds]);

  const handleRoundCategorySelect = useCallback(async (value) => {
    const selectionSeq = (categorySelectSeqRef.current += 1);

    setRoundMessage('');
    setRoundError('');
    setQuestionMessage('');
    setQuestionError('');
    setRoundSelectionTouched(true);

    setRoundForm(prev => ({
      ...prev,
      category: value
    }));

    let availableRounds = rounds;
    if (!roundsInitialized) {
      availableRounds = await loadRounds(undefined, { keepSelection: true });
      if (selectionSeq !== categorySelectSeqRef.current) {
        return;
      }
    }

    const matchedRound = availableRounds.find(round => round.category === value);
    if (matchedRound) {
      setSelectedRoundId(matchedRound.id);
    } else {
      setSelectedRoundId(ROUND_NEW_VALUE);
    }


    if (!matchedRound && !roundSaving) {
      await createRoundForCategory(value, selectionSeq);
    }
  }, [rounds, roundsInitialized, roundsLoading, roundSaving, createRoundForCategory, loadRounds]);

  const handleRoundSubmit = async (event) => {
    event.preventDefault();
    setRoundError('');
    setRoundMessage('');

    if (!roundForm.category) {
      setRoundError('กรุณาเลือกประเภทช่าง');
      return;
    }

    const existingTitle = selectedRound?.title?.trim();
    const resolvedTitle = selectedRoundId !== ROUND_NEW_VALUE && existingTitle
      ? existingTitle
      : buildUniqueRoundTitle(roundForm.category, selectedRound?.id ?? null);

    const payload = {
      category: roundForm.category,
      title: resolvedTitle,
      description: '',
      questionCount: ASSESSMENT_QUESTION_COUNT,
      startAt: null,
      endAt: null,
      frequencyMonths: null
    };

    setRoundSaving(true);
    try {
      if (selectedRoundId && selectedRoundId !== ROUND_NEW_VALUE) {
        await apiRequest(`/api/admin/assessments/rounds/${selectedRoundId}`, { method: 'PUT', body: payload });
        await loadRounds(selectedRoundId);
        setRoundMessage('บันทึกกิจกรรมข้อสอบเรียบร้อย');
      } else {
        await createRoundForCategory(roundForm.category);
      }
    } catch (error) {
      console.error('Failed to save assessment round', error);
      setRoundError(toFriendlyApiMessage(error, 'ไม่สามารถบันทึกกิจกรรมข้อสอบได้'));
    } finally {
      setRoundSaving(false);
    }
  };

  const selectedRound = useMemo(() => {
    if (!selectedRoundId || selectedRoundId === ROUND_NEW_VALUE) {
      return null;
    }
    return rounds.find(round => round.id === selectedRoundId) || null;
  }, [selectedRoundId, rounds]);

  const selectedCategory = roundForm.category || selectedRound?.category;

  const questionsForSelectedCategory = useMemo(() => {
    if (!selectedCategory) {
      return [];
    }
    return questions.filter(question => question.category === selectedCategory);
  }, [questions, selectedCategory]);

  useEffect(() => {
    setTableCategoryFilter(TABLE_FILTER_ALL);
    setTableDifficultyFilter(TABLE_FILTER_ALL);
  }, [selectedCategory]);

  const displayedQuestions = useMemo(() => {
    let filtered = questionsForSelectedCategory;

    if (tableCategoryFilter !== TABLE_FILTER_ALL) {
      filtered = filtered.filter(question => question.category === tableCategoryFilter);
    }

    if (tableDifficultyFilter !== TABLE_FILTER_ALL) {
      filtered = filtered.filter(question => question.difficulty === tableDifficultyFilter);
    }

    return filtered.slice(0, ASSESSMENT_QUESTION_COUNT);
  }, [questionsForSelectedCategory, tableCategoryFilter, tableDifficultyFilter]);

  const missingQuestionCount = Math.max(0, ASSESSMENT_QUESTION_COUNT - questionsForSelectedCategory.length);

  const activeCategoryValue = roundForm.category || selectedRound?.category;
  const roundDisplayTitle = (selectedRound?.title || '').trim();
  const roundDisplayTitleNormalized = roundDisplayTitle.replace(/\s*\(\d+\)\s*$/, '').trim();
  const roundDisplayCategoryLabel = activeCategoryValue && CATEGORY_LABELS[activeCategoryValue]
    ? CATEGORY_LABELS[activeCategoryValue]
    : '';
  const roundDisplayCategory = roundDisplayCategoryLabel
    ? roundDisplayCategoryLabel.replace(/^\d+\.\s*/, '')
    : '';
  const summaryCategoryLabel = roundForm.category && CATEGORY_LABELS[roundForm.category]
    ? CATEGORY_LABELS[roundForm.category].replace(/^\d+\.\s*/, '')
    : '';
  const roundHeadingBase = roundDisplayTitleNormalized || roundDisplayCategory || 'ข้อสอบ';
  const roundHeadingSuffix = `${ASSESSMENT_QUESTION_COUNT} ข้อ`;

  const handleStartCreate = useCallback(() => {
    navigate('/admin/question/add', { 
      state: { category: roundForm.category || selectedCategory } 
    });
  }, [navigate, roundForm.category, selectedCategory]);

  return (
    <div className="admin-quiz-bank">
      <div className="quiz-content">
        <div className="quiz-header">
          <h2>คลังข้อสอบ</h2>
        </div>

        <div className="quiz-form-card quiz-round-card">
          <h3>จัดการข้อสอบ</h3>
          <form onSubmit={handleRoundSubmit} className="quiz-form quiz-form--round">
            <div className="form-grid form-grid--round">
              <div className="form-group form-group--compact">
                <label>ประเภทช่าง</label>
                <div className="category-button-group" role="group" aria-label="ประเภทช่าง">
                  {CATEGORY_BUTTON_OPTIONS.map(option => {
                    const isActive = roundForm.category === option.value;
                    const isDisabled = roundsLoading || roundSaving;
                    return (
                      <button
                        type="button"
                        key={option.value}
                        className={`category-button${isActive ? ' is-active' : ''}`}
                        onClick={() => handleRoundCategorySelect(option.value)}
                        aria-pressed={isActive}
                        aria-disabled={isDisabled}
                        disabled={isDisabled}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {roundForm.category && (
                <div className="form-group form-group--wide">
                  <div className="round-summary">
                    <span>
                      {roundSelectionTouched
                        ? summaryCategoryLabel
                          ? `กิจกรรมที่เลือก: ${summaryCategoryLabel}`
                          : 'ยังไม่ได้เลือกกิจกรรม'
                        : 'ยังไม่ได้เลือกกิจกรรม'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {roundForm.category && (
              <>
                {roundsLoading && <div className="form-feedback">กำลังโหลดกิจกรรมข้อสอบ...</div>}
                {roundSelectionTouched && roundsError && <div className="form-feedback error">{roundsError}</div>}
                {roundSelectionTouched && roundError && <div className="form-feedback error">{roundError}</div>}
                {roundMessage && <div className="form-feedback success">{roundMessage}</div>}

                <div className="form-actions" aria-hidden="true" />
              </>
            )}
          </form>
        </div>

        {roundForm.category && (
          <div className="quiz-form-card quiz-table-card">
            <div className="quiz-table-header">
              <div>
                <h3>
                  {roundHeadingBase} ({roundHeadingSuffix})
                </h3>
                <p className="quiz-table-subtitle">
                  {selectedRound ? 'รายการคำถามสำหรับกิจกรรมที่เลือก' : 'รายการคำถามทั้งหมดในคลัง'}
                </p>
              </div>
              <div className="quiz-table-action-box">
                <button type="button" className="pill primary" onClick={handleStartCreate}>
                  + เพิ่มคำถามใหม่
                </button>
              </div>
            </div>

            <div className="quiz-table-controls">
              {(questionError || questionMessage) && (
                <div className="quiz-table-feedback">
                  {questionError && <div className="form-feedback error">{questionError}</div>}
                  {questionMessage && <div className="form-feedback success">{questionMessage}</div>}
                </div>
              )}
              <div className="quiz-table-filters">
                <div className="filter-control">
                  <label htmlFor="table-difficulty-filter">ระดับความยาก</label>
                  <select
                    id="table-difficulty-filter"
                    value={tableDifficultyFilter}
                    onChange={(event) => setTableDifficultyFilter(event.target.value)}
                  >
                    <option value={TABLE_FILTER_ALL}>ทุกระดับ</option>
                    {DIFFICULTY_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {questionsLoading && (
              <div className="empty-state table-state">กำลังโหลดข้อมูล...</div>
            )}

            {!questionsLoading && questionsError && displayedQuestions.length === 0 && (
              <div className="empty-state table-state">{questionsError}</div>
            )}

            {!questionsLoading && (questionsError ? displayedQuestions.length > 0 : true) && (
              <div className="quiz-table-wrapper">
                {questionsError && displayedQuestions.length > 0 && (
                  <div className="form-feedback error" role="alert">{questionsError}</div>
                )}
                <table className="quiz-table">
                  <thead>
                    <tr>
                      <th>ลำดับ</th>
                      <th>ระดับ</th>
                      <th>คำถาม</th>
                      <th>ตัวเลือก</th>
                      <th>คำตอบที่ถูก</th>
                      <th>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedQuestions.map((question, index) => {
                      const options = Array.isArray(question.options) ? question.options : [];
                      const correctOptions = options.filter(option => Boolean(option?.isCorrect ?? option?.is_correct));
                      const correctText = correctOptions.length
                        ? correctOptions.map(option => option.text).join(', ')
                        : '-';
                      const difficultyLabel = DIFFICULTY_LABELS[question.difficulty] || '-';
                      return (
                        <tr key={question.id}>
                          <td>{index + 1}</td>
                          <td>{difficultyLabel}</td>
                          <td className="table-question">{question.text}</td>
                          <td>{options.length}</td>
                          <td className="table-answer">{correctText}</td>
                          <td>
                            <div className="table-actions">
                              <button type="button" className="btn-icon" onClick={() => handleEdit(question)} title="แก้ไข" aria-label="แก้ไขคำถาม">
                                <i className="bx bx-edit" />
                              </button>
                              <button
                                type="button"
                                className={`btn-icon${deletingQuestionId === question.id ? ' is-busy' : ''}`}
                                onClick={() => handleDelete(question.id)}
                                title={deletingQuestionId === question.id ? 'กำลังลบ...' : 'ลบ'}
                                aria-label={deletingQuestionId === question.id ? 'กำลังลบคำถาม' : 'ลบคำถาม'}
                                disabled={deletingQuestionId === question.id}
                              >
                                <i className="bx bx-trash-alt" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {displayedQuestions.length === 0 && (
                      <tr>
                        <td colSpan="6" className="table-empty">
                          <div className="empty-icon" aria-hidden="true">
                            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="#BFC7DE" strokeWidth="1.5"/>
                              <path d="M3 9h18" stroke="#BFC7DE" strokeWidth="1.5"/>
                              <circle cx="8" cy="12" r="2" stroke="#BFC7DE" strokeWidth="1.5"/>
                              <path d="M11 15c-1.2-1-2.8-1-4 0" stroke="#BFC7DE" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                          </div>
                          <div>ยังไม่มีข้อสอบในคลัง</div>
                          <div className="table-empty-sub">เพิ่มคำถามใหม่หรือเลือกกิจกรรมเพื่อเริ่มต้น</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {missingQuestionCount > 0 && (
                  <div className="table-footnote warning">
                    ต้องการเพิ่มอีก {missingQuestionCount} ข้อเพื่อให้ครบ {ASSESSMENT_QUESTION_COUNT} ข้อ
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminQuizBank;

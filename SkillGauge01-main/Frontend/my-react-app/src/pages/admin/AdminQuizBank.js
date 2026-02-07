import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../Dashboard.css';
import './AdminQuizBank.css';
import { apiRequest } from '../../utils/api';

const ASSESSMENT_QUESTION_COUNT = 60;
const DEFAULT_ASSESSMENT_DURATION_MINUTES = 60;
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

const toLocalISOString = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - offset);
  return localDate.toISOString().slice(0, 16);
};

const AdminQuizBank = () => {
  const navigate = useNavigate();
  const storedCategory = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEYS.category) : null;
  const initialCategory = storedCategory && CATEGORY_LABELS[storedCategory] ? storedCategory : CATEGORY_OPTIONS[0].value;
  const storedRoundId = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEYS.roundId) : null;

  const [subcategoryOptions, setSubcategoryOptions] = useState(DEFAULT_SUBCATEGORY_OPTIONS);

  useEffect(() => {
    const storedOptions = localStorage.getItem('admin_subcategory_options');
    if (storedOptions) {
      try {
        setSubcategoryOptions(JSON.parse(storedOptions));
      } catch (e) { /* ignore */ }
    }
  }, []);

  const [quotaPresets, setQuotaPresets] = useState({});
  const [selectedPresetName, setSelectedPresetName] = useState('');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSimulationModal, setShowSimulationModal] = useState(false);
  const [simulationResult, setSimulationResult] = useState({ success: true, message: '', details: [] });
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // เพิ่ม Debounce Effect เพื่อลดการคำนวณ Filter ขณะพิมพ์
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const stored = localStorage.getItem('admin_quota_presets');
    if (stored) {
      try {
        setQuotaPresets(JSON.parse(stored));
      } catch (e) { /* ignore */ }
    }
  }, []);

  const categorySelectSeqRef = useRef(0);

  const [questions, setQuestions] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState('');
  const [rounds, setRounds] = useState([]);
  const [roundsLoading, setRoundsLoading] = useState(false);
  const [roundsInitialized, setRoundsInitialized] = useState(false);
  const [roundsError, setRoundsError] = useState('');
  const [selectedRoundId, setSelectedRoundId] = useState(storedRoundId || ROUND_NEW_VALUE);
  const selectedRoundIdRef = useRef(selectedRoundId);
  useEffect(() => { selectedRoundIdRef.current = selectedRoundId; }, [selectedRoundId]);
  const [questionError, setQuestionError] = useState('');
  const [questionMessage, setQuestionMessage] = useState('');
  const [deletingQuestionId, setDeletingQuestionId] = useState(null);
  const [roundForm, setRoundForm] = useState({
    category: initialCategory,
    description: '',
    questionCount: ASSESSMENT_QUESTION_COUNT,
    passingScore: 60, // Default 60%
    durationMinutes: DEFAULT_ASSESSMENT_DURATION_MINUTES,
    showScore: true,
    showAnswers: false,
    showBreakdown: true,
    targetLevel: '',
    subcategoryQuotas: {},
    criteria: { level1: 60, level2: 70, level3: 80 },
    difficultyWeights: { easy: 0, medium: 0, hard: 0 }
  });
  const [roundSelectionTouched, setRoundSelectionTouched] = useState(Boolean(storedRoundId));
  const [roundSaving, setRoundSaving] = useState(false);
  const [roundError, setRoundError] = useState('');
  const [roundMessage, setRoundMessage] = useState('');
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [tableCategoryFilter, setTableCategoryFilter] = useState(TABLE_FILTER_ALL);
  const [tableDifficultyFilter, setTableDifficultyFilter] = useState(TABLE_FILTER_ALL);
  const [tableSubcategoryFilter, setTableSubcategoryFilter] = useState(TABLE_FILTER_ALL);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 7;
  
  // เปอร์เซ็นต์แบบรายหมวดหมู่ (จะเก็บเป็นฟิลด์ใน subcategoryQuotas[<sub>].pct)

  const [structuralQuestions, setStructuralQuestions] = useState([]);

  const loadQuestions = useCallback(async () => {
    setQuestionsLoading(true);
    setQuestionsError('');
    try {
      // โหลดคำถามปกติ
      const response = await apiRequest(`/api/admin/questions?limit=${QUESTIONS_FETCH_LIMIT}`);
      const items = Array.isArray(response?.items) ? response.items : [];
      setQuestions(items);

      // โหลดคำถามโครงสร้าง
      try {
        const structResponse = await apiRequest('/api/question-structural/all');
        const structItems = Array.isArray(structResponse) ? structResponse : [];
        
        console.log('Loaded structural questions:', structItems.length); // Debug log
        
        // แปลงข้อมูลจาก question_Structural ให้เป็นรูปแบบเดียวกับ questions
        const converted = structItems.map(item => {
          // Map skill_type text to internal value
          let mappedSubcategory = item.skill_type;
          if (item.skill_type && subcategoryOptions.structure) {
            const found = subcategoryOptions.structure.find(opt => {
              const skillStr = String(item.skill_type).trim();
              const label = opt.label.trim();

              // Check for exact match, containment, or specific keywords for problematic categories
              if (label === skillStr || label.includes(skillStr) || skillStr.includes(label)) return true;
              if (opt.value === 'rebar' && (skillStr.includes('เหล็ก') || skillStr.toLowerCase().includes('rebar'))) return true;
              if (opt.value === 'concrete' && (skillStr.includes('คอนกรีต') || skillStr.toLowerCase().includes('concrete'))) return true;
              if (opt.value === 'formwork' && (skillStr.includes('ไม้แบบ') || skillStr.toLowerCase().includes('formwork'))) return true;
              if (opt.value === 'tools' && (skillStr.includes('องค์ความรู้') || skillStr.includes('เครื่องมือ') || skillStr.includes('คุณภาพ') || skillStr.includes('คาม') || skillStr.includes('องค์อาคาร') || skillStr.includes('คาน') || skillStr.includes('เสา') || skillStr.includes('ฐานราก'))) return true;
              if (opt.value === 'theory' && (skillStr.includes('ทฤษฎี') || skillStr.includes('Design') || skillStr.includes('พฤติ'))) return true;
              return false;
            });
            if (found) {
              mappedSubcategory = found.value;
            }
          }

          return {
            id: `struct_${item.id}`,
            text: item.question_text,
            category: 'structure',
            subcategory: mappedSubcategory || null,
            difficulty: item.difficulty_level === 1 ? 'easy' : item.difficulty_level === 2 ? 'medium' : 'hard',
            options: [
              { text: item.choice_a, isCorrect: item.answer === 'A', is_correct: item.answer === 'A' },
              { text: item.choice_b, isCorrect: item.answer === 'B', is_correct: item.answer === 'B' },
              { text: item.choice_c, isCorrect: item.answer === 'C', is_correct: item.answer === 'C' },
              { text: item.choice_d, isCorrect: item.answer === 'D', is_correct: item.answer === 'D' }
            ],
            _originalId: item.id,
            _source: 'question_Structural',
            createdAt: item.created_at,
            updatedAt: item.updated_at
          };
        });
        
        console.log('Converted structural questions:', converted.length); // Debug log
        setStructuralQuestions(converted);
      } catch (structError) {
        console.error('Failed to load structural questions', structError);
        setStructuralQuestions([]);
      }
    } catch (error) {
      console.error('Failed to load assessment questions', error);
      setQuestions([]);
      setQuestionsError(toFriendlyApiMessage(error, 'ไม่สามารถโหลดชุดคำถามได้'));
    } finally {
      setQuestionsLoading(false);
    }
  }, [subcategoryOptions]);

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
        const currentId = selectedRoundIdRef.current;
        if (preferredId && items.some(item => item.id === preferredId)) {
          nextSelection = preferredId;
        } else if (currentId && currentId !== ROUND_NEW_VALUE && items.some(item => item.id === currentId)) {
          nextSelection = currentId;
        } else if (!currentId && items.length) {
            // Prefer active rounds, then latest updated
          const sorted = [...items].sort((a, b) => {
            if (a.active !== b.active) return (b.active ? 1 : 0) - (a.active ? 1 : 0);
            return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
          });
          nextSelection = sorted[0].id; // Select the best candidate
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
  }, []);

  const handleRefresh = useCallback(() => {
    setQuestionsLoading(true);
    loadQuestions();
    if (selectedRoundId && selectedRoundId !== ROUND_NEW_VALUE) {
      loadRounds(selectedRoundId);
    } else {
      loadRounds(undefined, { keepSelection: true });
    }
  }, [loadQuestions, loadRounds, selectedRoundId]);

  useEffect(() => {
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
      const matchedWeights = matched.difficultyWeights || { easy: 40, medium: 40, hard: 20 };
      const matchedTargetLevel = matchedWeights.easy === 100 && matchedWeights.medium === 0 && matchedWeights.hard === 0
        ? 'easy'
        : matchedWeights.medium === 100 && matchedWeights.easy === 0 && matchedWeights.hard === 0
          ? 'medium'
          : matchedWeights.hard === 100 && matchedWeights.easy === 0 && matchedWeights.medium === 0
            ? 'hard'
            : (matchedWeights.easy === 0 && matchedWeights.medium === 0 && matchedWeights.hard === 0) ? '' : 'all';
      setRoundForm(prev => ({
        ...prev,
        category: matched.category || CATEGORY_OPTIONS[0].value,
        description: matched.description || '',
        frequencyMonths: matched.frequencyMonths || '',
        questionCount: matched.questionCount || ASSESSMENT_QUESTION_COUNT,
        passingScore: matched.passingScore || 60,
        durationMinutes: matched.durationMinutes || DEFAULT_ASSESSMENT_DURATION_MINUTES,
        showScore: matched.showScore ?? true,
        showAnswers: matched.showAnswers ?? false,
        showBreakdown: matched.showBreakdown ?? true,
        subcategoryQuotas: matched.subcategoryQuotas || {},
        criteria: matched.criteria || { level1: 60, level2: 70, level3: 80 },
        targetLevel: matchedTargetLevel,
        difficultyWeights: matchedWeights
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



  const handleEdit = useCallback((question) => {
    navigate('/admin/question/edit/' + question.id, { 
      state: { question, category: roundForm.category } 
    });
  }, [navigate, roundForm.category]);

  const handleDuplicate = async (question) => {
    if (!window.confirm('ต้องการคัดลอกคำถามนี้ใช่หรือไม่?')) return;
    
    try {
      const payload = {
        text: `${question.text} (คัดลอก)`,
        category: question.category,
        subcategory: question.subcategory,
        difficulty: question.difficulty,
        options: question.options.map(o => ({
          text: o.text,
          is_correct: Boolean(o.isCorrect || o.is_correct)
        }))
      };

      await apiRequest('/api/admin/questions', { method: 'POST', body: payload });
      setQuestionMessage('คัดลอกคำถามเรียบร้อย');
      loadQuestions();
    } catch (error) {
      console.error('Failed to duplicate', error);
      setQuestionError('ไม่สามารถคัดลอกคำถามได้');
    }
  };

  const handleImportClick = () => {
    document.getElementById('import-csv-input').click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      const lines = text.split(/\r\n|\n/);
      const newQuestions = [];
      
      const parseCSVLine = (str) => {
        const arr = [];
        let quote = false;
        let col = '';
        for (let i = 0; i < str.length; i++) {
            const c = str[i];
            if (c === '"') { 
                if (i + 1 < str.length && str[i+1] === '"') {
                    col += '"';
                    i++;
                } else {
                    quote = !quote; 
                }
                continue; 
            }
            if (c === ',' && !quote) { arr.push(col); col = ''; continue; }
            col += c;
        }
        arr.push(col);
        return arr.map(s => s.trim());
      };

      let startIndex = 0;
      if (lines.length > 0 && (lines[0].includes('Question') || lines[0].includes('คำถาม') || lines[0].includes('question'))) {
        startIndex = 1;
      }

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = parseCSVLine(line);
        if (parts.length < 6) continue;

        const qText = parts[0];
        const opts = parts.slice(1, 5).filter(o => o);
        const correctStr = parts[5];
        const diffStr = parts[6] || '';
        const subStr = parts[7] || '';

        if (!qText || opts.length < 2 || !correctStr) continue;

        const options = opts.map(text => ({ text, is_correct: false }));
        
        let correctIndex = -1;
        if (/^[abcd]$/i.test(correctStr)) {
            correctIndex = correctStr.toLowerCase().charCodeAt(0) - 97;
        } else if (/^[1-4]$/.test(correctStr)) {
            correctIndex = parseInt(correctStr) - 1;
        }

        if (correctIndex >= 0 && correctIndex < options.length) {
            options[correctIndex].is_correct = true;
        } else {
             const matchIdx = options.findIndex(o => o.text.toLowerCase() === correctStr.toLowerCase());
             if (matchIdx !== -1) options[matchIdx].is_correct = true;
             else continue;
        }

        let difficulty = 'easy';
        if (diffStr) {
            const d = diffStr.toLowerCase();
            if (d === '2' || d === 'medium' || d === 'กลาง') difficulty = 'medium';
            if (d === '3' || d === 'hard' || d === 'ยาก') difficulty = 'hard';
        }

        newQuestions.push({
            text: qText,
            category: roundForm.category,
            subcategory: subStr || null,
            difficulty,
            options
        });
      }

      if (newQuestions.length === 0) {
          alert('ไม่พบข้อมูลที่ถูกต้องในไฟล์ CSV\nรูปแบบ: คำถาม, ตัวเลือก1, ตัวเลือก2, ตัวเลือก3, ตัวเลือก4, คำตอบถูก(1-4), ความยาก(1-3), หมวดหมู่ย่อย');
          event.target.value = '';
          return;
      }

      if (!window.confirm(`พบคำถาม ${newQuestions.length} ข้อ ต้องการนำเข้าหรือไม่?`)) {
          event.target.value = '';
          return;
      }

      setQuestionsLoading(true);
      let successCount = 0;
      for (const q of newQuestions) {
          try {
              await apiRequest('/api/admin/questions', { method: 'POST', body: q });
              successCount++;
          } catch (err) {
              console.error('Import error:', err);
          }
      }
      setQuestionsLoading(false);
      alert(`นำเข้าสำเร็จ ${successCount} จาก ${newQuestions.length} ข้อ`);
      loadQuestions();
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleDelete = useCallback(async (questionId) => {
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
  }, [loadQuestions]);



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
      passingScore: 60,
      durationMinutes: DEFAULT_ASSESSMENT_DURATION_MINUTES,
      showScore: true,
      showAnswers: false,
      showBreakdown: true,
      subcategoryQuotas: {},
      frequencyMonths: null,
      criteria: { level1: 60, level2: 70, level3: 80 },
      difficultyWeights: { easy: 0, medium: 0, hard: 0 }
    };

    setRoundSaving(true);
    try {
      const response = await apiRequest('/api/admin/assessments/rounds', { method: 'POST', body: payload });
      const createdId = response?.data?.id;
      if (expectedSeq !== categorySelectSeqRef.current) {
        return;
      }
      await loadRounds(createdId, { keepSelection: true });
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
    setAttemptedSubmit(false);
    setRoundSelectionTouched(true);

    setRoundForm(prev => ({
      ...prev,
      category: value,
      description: '',
      frequencyMonths: '',
      questionCount: ASSESSMENT_QUESTION_COUNT,
      passingScore: 60,
      durationMinutes: DEFAULT_ASSESSMENT_DURATION_MINUTES,
      showScore: true,
      showAnswers: false,
      showBreakdown: true,
      targetLevel: '',
      subcategoryQuotas: {},
      criteria: { level1: 60, level2: 70, level3: 80 },
      difficultyWeights: { easy: 0, medium: 0, hard: 0 }
    }));

    let availableRounds = rounds;
    if (!roundsInitialized) {
      availableRounds = await loadRounds(undefined, { keepSelection: true });
      if (selectionSeq !== categorySelectSeqRef.current) {
        return;
      }
    }

    const matchedRound = availableRounds
      .filter(round => round.category === value)
      .sort((a, b) => {
         // Prefer active
         if (a.active !== b.active) return (b.active ? 1 : 0) - (a.active ? 1 : 0);
         // Then latest updated
         return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
      })[0];

    if (matchedRound) {
      setSelectedRoundId(matchedRound.id);
    } else {
      setSelectedRoundId(ROUND_NEW_VALUE);
    }


    if (!matchedRound && !roundSaving) {
      await createRoundForCategory(value, selectionSeq);
    }
  }, [rounds, roundsInitialized, roundsLoading, roundSaving, createRoundForCategory, loadRounds]);

  const handleSavePreset = () => {
    const name = prompt('ตั้งชื่อสูตรการสุ่ม (เช่น เน้นข้อง่าย):');
    if (!name || !name.trim()) return;
    
    const category = roundForm.category;
    const newPreset = { name: name.trim(), quotas: roundForm.subcategoryQuotas };
    
    setQuotaPresets(prev => {
      const catPresets = prev[category] || [];
      const existingIdx = catPresets.findIndex(p => p.name === newPreset.name);
      let nextCatPresets;
      if (existingIdx >= 0) {
        if (!window.confirm(`ชื่อสูตร "${newPreset.name}" มีอยู่แล้ว ต้องการบันทึกทับหรือไม่?`)) return prev;
        nextCatPresets = [...catPresets];
        nextCatPresets[existingIdx] = newPreset;
      } else {
        nextCatPresets = [...catPresets, newPreset];
      }
      
      const nextState = { ...prev, [category]: nextCatPresets };
      localStorage.setItem('admin_quota_presets', JSON.stringify(nextState));
      return nextState;
    });
    setSelectedPresetName(name.trim());
  };

  const handleLoadPreset = () => {
    const category = roundForm.category;
    const preset = (quotaPresets[category] || []).find(p => p.name === selectedPresetName);
    if (!preset || !preset.quotas) return;

    let newTotal = 0;
    Object.values(preset.quotas).forEach(q => {
       if (typeof q === 'object') {
         newTotal += (q.easy || 0) + (q.medium || 0) + (q.hard || 0);
       } else if (typeof q === 'number') {
         newTotal += q;
       }
    });

    setRoundForm(prev => ({
      ...prev,
      subcategoryQuotas: preset.quotas,
      questionCount: newTotal > 0 ? newTotal : prev.questionCount
    }));
  };

  const handleDeletePreset = (name) => {
    if (!window.confirm(`ต้องการลบสูตร "${name}" หรือไม่?`)) return;
    const category = roundForm.category;
    setQuotaPresets(prev => {
      const catPresets = prev[category] || [];
      const nextCatPresets = catPresets.filter(p => p.name !== name);
      const nextState = { ...prev, [category]: nextCatPresets };
      localStorage.setItem('admin_quota_presets', JSON.stringify(nextState));
      return nextState;
    });
    if (selectedPresetName === name) setSelectedPresetName('');
  };

  const handleRoundSubmit = async (event) => {
    event.preventDefault();
    setAttemptedSubmit(true);
    setRoundError('');
    setRoundMessage('');

    if (!roundForm.category) {
      setRoundError('กรุณาเลือกประเภทช่าง');
      return;
    }

    // ตรวจสอบยอดรวม Target % ของทุกหมวดหมู่ย่อย ต้องเท่ากับ 100% (เฉพาะถ้ามีหมวดหมู่ย่อย)
    if (subcategoryOptions[roundForm.category] && subcategoryOptions[roundForm.category].length > 0) {
      const currentTotalTargetPct = subcategoryOptions[roundForm.category].reduce((sum, opt) => {
        const q = roundForm.subcategoryQuotas[opt.value] || {};
        return sum + Number(q.pct || 0);
      }, 0);

      if (currentTotalTargetPct !== 100) {
        setRoundError(`ผลรวมเปอร์เซ็นต์เป้าหมายของทุกหมวดหมู่ย่อยต้องเท่ากับ 100% (ปัจจุบัน ${currentTotalTargetPct}%)`);
        return;
      }
    }

    const cLevel1 = Number(roundForm.criteria?.level1 || 60);
    const cLevel2 = Number(roundForm.criteria?.level2 || 70);
    const cLevel3 = Number(roundForm.criteria?.level3 || 80);

    if (cLevel1 < 0 || cLevel2 < 0 || cLevel3 < 0) {
      setRoundError('เกณฑ์คะแนนต้องไม่เป็นค่าติดลบ');
      return;
    }

    if (cLevel1 > 100 || cLevel2 > 100 || cLevel3 > 100) {
      setRoundError('เกณฑ์คะแนนต้องไม่เกิน 100%');
      return;
    }

    if (cLevel1 >= cLevel2) {
      setRoundError('เกณฑ์ระดับ 1 ต้องน้อยกว่าระดับ 2');
      return;
    }
    if (cLevel2 >= cLevel3) {
      setRoundError('เกณฑ์ระดับ 2 ต้องน้อยกว่าระดับ 3');
      return;
    }

    const difficultyWeights = resolvedDifficultyWeights;
    const diffEasy = Number(difficultyWeights.easy || 0);
    const diffMedium = Number(difficultyWeights.medium || 0);
    const diffHard = Number(difficultyWeights.hard || 0);
    const diffTotal = diffEasy + diffMedium + diffHard;
    if (diffEasy < 0 || diffMedium < 0 || diffHard < 0) {
      setRoundError('สัดส่วนระดับความยากต้องไม่เป็นค่าติดลบ');
      return;
    }
    if (diffTotal !== 100) {
      setRoundError(`ผลรวมโครงสร้างระดับความยากต้องเท่ากับ 100% (ปัจจุบัน ${diffTotal}%)`);
      return;
    }

    let finalQuestionCount = Number(roundForm.questionCount);
    let calculatedTotal = 0;
    const quotas = roundForm.subcategoryQuotas || {};
    Object.values(quotas).forEach(q => {
      if (typeof q === 'object') {
        calculatedTotal += (q.easy || 0) + (q.medium || 0) + (q.hard || 0);
      }
    });

    if (calculatedTotal > 0 && calculatedTotal !== finalQuestionCount) {
       if (!window.confirm(`ยอดรวมข้อสอบที่เลือก (${calculatedTotal} ข้อ) ไม่ตรงกับจำนวนที่ตั้งเป้าไว้ (${finalQuestionCount} ข้อ)\n\nต้องการปรับจำนวนเป้าหมายเป็น ${calculatedTotal} ข้อ และบันทึกหรือไม่?`)) {
         return;
       }
       finalQuestionCount = calculatedTotal;
    }

    const existingTitle = selectedRound?.title?.trim();
    const resolvedTitle = selectedRoundId !== ROUND_NEW_VALUE && existingTitle
      ? existingTitle
      : buildUniqueRoundTitle(roundForm.category, selectedRound?.id ?? null);

    const normalizedSubcategoryQuotas = (subcategoryOptions[roundForm.category] || []).reduce((acc, option) => {
      const q = roundForm.subcategoryQuotas?.[option.value] || {};
      const pct = q.pct === '' || q.pct === undefined || q.pct === null ? 0 : Number(q.pct);
      if (!Number.isFinite(pct) || pct <= 0) {
        return acc;
      }
      const count = Math.round((pct / 100) * finalQuestionCount);
      acc[option.value] = { ...q, pct, count };
      return acc;
    }, {});

    const payload = {
      category: roundForm.category,
      title: resolvedTitle,
      description: roundForm.description ? roundForm.description.trim() : '',
      questionCount: finalQuestionCount,
      frequencyMonths: roundForm.frequencyMonths ? Number(roundForm.frequencyMonths) : null,
      passingScore: Number(roundForm.passingScore || 60),
      durationMinutes: Number(roundForm.durationMinutes),
      showScore: roundForm.showScore,
      showAnswers: roundForm.showAnswers,
      showBreakdown: roundForm.showBreakdown,
      subcategoryQuotas: normalizedSubcategoryQuotas,
      difficultyWeights: resolvedDifficultyWeights,
      criteria: {
        level1: Number(roundForm.passingScore || 60),
        level2: Number(roundForm.criteria?.level2 || 70),
        level3: Number(roundForm.criteria?.level3 || 80)
      }
    };

    setRoundSaving(true);
    try {
      if (selectedRoundId && selectedRoundId !== ROUND_NEW_VALUE) {
        await apiRequest(`/api/admin/assessments/rounds/${selectedRoundId}`, { method: 'PUT', body: payload });
        await loadRounds(selectedRoundId, { keepSelection: true });
        setRoundMessage('บันทึกกิจกรรมข้อสอบเรียบร้อย');
      } else {
        const created = await apiRequest('/api/admin/assessments/rounds', { method: 'POST', body: payload });
        const createdId = created?.id || created?.data?.id || null;
        await loadRounds(createdId || undefined, { keepSelection: true });
        if (createdId) {
          setSelectedRoundId(createdId);
        }
        setRoundMessage('บันทึกกิจกรรมข้อสอบเรียบร้อย');
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

  const resolvedHistory = useMemo(() => {
    if (!selectedRound?.history) {
      return [];
    }
    if (Array.isArray(selectedRound.history)) {
      return selectedRound.history;
    }
    if (typeof selectedRound.history === 'string') {
      try {
        const parsed = JSON.parse(selectedRound.history);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }, [selectedRound]);

  const formatHistoryValue = (value) => {
    if (value === undefined || value === null || value === '') {
      return '-';
    }
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return '[object]';
      }
    }
    return String(value);
  };

  const selectedCategory = roundForm.category || selectedRound?.category;

  const questionsForSelectedCategory = useMemo(() => {
    if (!selectedCategory) {
      return [];
    }
    
    // ถ้าเป็นหมวดโครงสร้าง ให้ใช้ข้อมูลจาก question_Structural
    if (selectedCategory === 'structure') {
      const localStructureQuestions = questions.filter(q => q.category === 'structure');
      return [...structuralQuestions, ...localStructureQuestions];
    }
    
    return questions.filter(question => question.category === selectedCategory);
  }, [questions, structuralQuestions, selectedCategory]);

  const availabilityQuestions = useMemo(() => {
    if (!selectedCategory) {
      return [];
    }
    if (roundForm.targetLevel && roundForm.targetLevel !== 'all') {
      return questionsForSelectedCategory.filter(q => q.difficulty === roundForm.targetLevel);
    }
    return questionsForSelectedCategory;
  }, [questionsForSelectedCategory, roundForm.targetLevel, selectedCategory]);

  const currentSubcategoryStats = useMemo(() => {
    const stats = {};
    const options = subcategoryOptions[roundForm.category] || [];
    options.forEach(opt => {
      const subQuestions = availabilityQuestions.filter(q => q.subcategory === opt.value);
      stats[opt.value] = {
        total: subQuestions.length,
        easy: subQuestions.filter(q => q.difficulty === 'easy').length,
        medium: subQuestions.filter(q => q.difficulty === 'medium').length,
        hard: subQuestions.filter(q => q.difficulty === 'hard').length
      };
    });
    return stats;
  }, [availabilityQuestions, subcategoryOptions, roundForm.category]);

  const categoryStats = useMemo(() => {
    const total = availabilityQuestions.length;
    const easy = availabilityQuestions.filter(q => q.difficulty === 'easy').length;
    const medium = availabilityQuestions.filter(q => q.difficulty === 'medium').length;
    const hard = availabilityQuestions.filter(q => q.difficulty === 'hard').length;
    return { total, easy, medium, hard };
  }, [availabilityQuestions]);

  // Handler สำหรับเปลี่ยนเปอร์เซ็นต์ของหมวดหมู่ย่อย (target percent)
  const handleSubcategoryPctChange = useCallback((subKey, rawVal) => {
    const targetTotal = Number(roundForm.questionCount) || 0;
    const available = currentSubcategoryStats[subKey]?.total ?? 0;
    const otherTotal = (subcategoryOptions[roundForm.category] || []).reduce((sum, opt) => {
      if (opt.value === subKey) return sum;
      const q = roundForm.subcategoryQuotas?.[opt.value] || {};
      return sum + Number(q.pct || 0);
    }, 0);
    const remainingPct = Math.max(0, 100 - otherTotal);
    const maxPct = targetTotal > 0
      ? Math.min(remainingPct, Math.floor((available / targetTotal) * 100))
      : remainingPct;
    const pct = rawVal === '' ? '' : Math.max(0, Math.min(maxPct, Number(rawVal)));
    setRoundForm(prev => {
      const next = { ...(prev.subcategoryQuotas || {}) };
      const existing = (typeof next[subKey] === 'object') ? { ...next[subKey] } : {};
      existing.pct = pct;
      next[subKey] = existing;
      return { ...prev, subcategoryQuotas: next };
    });
  }, [currentSubcategoryStats, roundForm.questionCount, roundForm.subcategoryQuotas, roundForm.category, subcategoryOptions]);

  const handleAutoFill = useCallback(() => {
    const targetTotal = roundForm.questionCount;
    let currentTotal = 0;
    const newQuotas = JSON.parse(JSON.stringify(roundForm.subcategoryQuotas || {}));
    const options = subcategoryOptions[roundForm.category] || [];
    
    options.forEach(opt => {
      if (!newQuotas[opt.value] || typeof newQuotas[opt.value] !== 'object') {
        newQuotas[opt.value] = { easy: 0, medium: 0, hard: 0 };
      }
      currentTotal += (newQuotas[opt.value].easy || 0) + (newQuotas[opt.value].medium || 0) + (newQuotas[opt.value].hard || 0);
    });

    let needed = targetTotal - currentTotal;
    if (needed <= 0) return;

    const availableSlots = [];
    options.forEach(opt => {
      const stats = currentSubcategoryStats[opt.value] || { easy: 0, medium: 0, hard: 0 };
      ['easy', 'medium', 'hard'].forEach(diff => {
        const current = newQuotas[opt.value][diff] || 0;
        const max = stats[diff] || 0;
        if (current < max) {
          availableSlots.push({ sub: opt.value, diff, remaining: max - current });
        }
      });
    });

    if (availableSlots.length === 0) return;

    let idx = 0;
    while (needed > 0 && availableSlots.length > 0) {
      const slot = availableSlots[idx % availableSlots.length];
      if (slot.remaining > 0) {
        newQuotas[slot.sub][slot.diff]++;
        slot.remaining--;
        needed--;
        if (slot.remaining === 0) {
           availableSlots.splice(idx % availableSlots.length, 1);
           if (availableSlots.length === 0) break;
           continue;
        }
      }
      idx++;
    }
    
    setRoundForm(prev => ({ ...prev, subcategoryQuotas: newQuotas }));
  }, [roundForm.questionCount, roundForm.subcategoryQuotas, roundForm.category, subcategoryOptions, currentSubcategoryStats]);

  useEffect(() => {
    setTableCategoryFilter(TABLE_FILTER_ALL);
    setTableSubcategoryFilter(TABLE_FILTER_ALL);
    setTableDifficultyFilter(TABLE_FILTER_ALL);
    setCurrentPage(1);
  }, [selectedCategory]);

  useEffect(() => {
    if (roundForm.targetLevel && roundForm.targetLevel !== 'all') {
      setTableDifficultyFilter(roundForm.targetLevel);
    }
  }, [roundForm.targetLevel]);

  useEffect(() => {
    setCurrentPage(1);
  }, [tableCategoryFilter, tableSubcategoryFilter, tableDifficultyFilter]);

  const displayedQuestions = useMemo(() => {
    let filtered = questionsForSelectedCategory;

    // เปลี่ยนมาใช้ debouncedSearchTerm แทน searchTerm
    if (debouncedSearchTerm.trim()) {
      const lower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(question => 
        (question.text || '').toLowerCase().includes(lower)
      );
    }

    if (tableCategoryFilter !== TABLE_FILTER_ALL) {
      filtered = filtered.filter(question => question.category === tableCategoryFilter);
    }

    if (tableSubcategoryFilter !== TABLE_FILTER_ALL) {
      filtered = filtered.filter(question => question.subcategory === tableSubcategoryFilter);
    }

    if (tableDifficultyFilter !== TABLE_FILTER_ALL) {
      filtered = filtered.filter(question => question.difficulty === tableDifficultyFilter);
    }

    return filtered;
  }, [questionsForSelectedCategory, tableCategoryFilter, tableSubcategoryFilter, tableDifficultyFilter, debouncedSearchTerm]);

  const totalPages = Math.ceil(displayedQuestions.length / ITEMS_PER_PAGE);
  const paginatedQuestions = displayedQuestions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const missingQuestionCount = Math.max(0, roundForm.questionCount - questionsForSelectedCategory.length);

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
  const roundHeadingSuffix = `${questionsForSelectedCategory.length} ข้อ`;

  const handleStartCreate = useCallback(() => {
    navigate('/admin/question/add', { 
      state: { category: roundForm.category || selectedCategory } 
    });
  }, [navigate, roundForm.category, selectedCategory]);

  const handleSimulateRound = useCallback(() => {
    const targetCount = Number(roundForm.questionCount);
    const quotas = roundForm.subcategoryQuotas || {};
    const useSub = subcategoryOptions[roundForm.category] && subcategoryOptions[roundForm.category].length > 0;
    const isSingleLevel = roundForm.targetLevel && roundForm.targetLevel !== 'all';
    
    // Constraints
    const constraints = [];
    let isPossible = true;
    let totalSelected = 0;

    // Filter Pool Logic
    const pool = questionsForSelectedCategory.filter(q => {
      // Basic Level Filter
      if (isSingleLevel && q.difficulty !== roundForm.targetLevel) return false;
      return true;
    });

    if (useSub) {
      // Check per subcategory
      Object.entries(quotas).forEach(([subKey, quota]) => {
        let reqCount = 0;
        if (typeof quota === 'number') {
          reqCount = quota;
        } else if (quota && typeof quota === 'object') {
          if (Number.isFinite(Number(quota.count))) {
            reqCount = Number(quota.count);
          } else if (Number.isFinite(Number(quota.pct))) {
            reqCount = Math.round(targetCount * (Number(quota.pct) / 100));
          }
        }
        if (reqCount > 0) {
          // Find candidates in this subcategory (Case insensitive match or exact match depending on data)
          // Data uses 'subcategory' field.
          const subCandidates = pool.filter(q => q.subcategory === subKey);
          
          if (subCandidates.length < reqCount) {
             isPossible = false;
             constraints.push({
               type: 'error',
               msg: `หมวด ${getCategoryDisplayName(subKey) || subKey}: ต้องการ ${reqCount} ข้อ แต่มีในคลัง (ที่ตรงเงื่อนไข) ${subCandidates.length} ข้อ`
             });
          } else {
             constraints.push({
               type: 'success',
               msg: `หมวด ${getCategoryDisplayName(subKey) || subKey}: ต้องการ ${reqCount} ข้อ, พบ ${subCandidates.length} ข้อ (เพียงพอ)`
             });
             totalSelected += reqCount;
          }
        }
      });
      
      // Check if sum matches target
      if (totalSelected !== targetCount) {
        // This might happen if auto-fill logic isn't perfect, but we just report structure consistency
        // But simulation cares about availability.
      }
      
    } else {
      // No subcategory logic, just check total and diff weights
      if (pool.length < targetCount) {
        isPossible = false;
        constraints.push({
           type: 'error',
           msg: `จำนวนข้อรวม: ต้องการ ${targetCount} ข้อ แต่มีในคลัง (ที่ตรงเงื่อนไข) ${pool.length} ข้อ`
        });
      } else {
        constraints.push({
           type: 'success',
           msg: `จำนวนข้อรวม: ต้องการ ${targetCount} ข้อ, พบ ${pool.length} ข้อ (เพียงพอ)`
        });
      }
      
      // Check basic difficulty distribution if 'all'
      if (!isSingleLevel) {
         const weights = roundForm.difficultyWeights || { easy: 0, medium: 0, hard: 0 };
         ['easy', 'medium', 'hard'].forEach(diff => {
            const req = Math.round(targetCount * (weights[diff] / 100));
            if (req > 0) {
               const have = pool.filter(q => q.difficulty === diff).length;
               if (have < req) {
                 isPossible = false;
                 constraints.push({
                    type: 'error',
                    msg: `ระดับ ${DIFFICULTY_LABELS[diff]}: ต้องการประมาณ ${req} ข้อ แต่มี ${have} ข้อ`
                 });
               }
            }
         });
      }
    }

    setSimulationResult({
      success: isPossible,
      message: isPossible ? 'สามารถจัดชุดข้อสอบได้ครบตามจำนวน' : 'ไม่สามารถจัดชุดข้อสอบได้ตามเงื่อนไข',
      details: constraints
    });
    setShowSimulationModal(true);
  }, [roundForm, questionsForSelectedCategory, subcategoryOptions, getCategoryDisplayName]);

  const criteriaL1 = Number(roundForm.criteria?.level1 ?? 0);
  const criteriaL2 = Number(roundForm.criteria?.level2 ?? 0);
  const criteriaL3 = Number(roundForm.criteria?.level3 ?? 0);
  const isL1Error = roundError && (criteriaL1 < 0 || criteriaL1 > 100 || criteriaL1 >= criteriaL2);
  const isL2Error = roundError && (criteriaL2 < 0 || criteriaL2 > 100 || criteriaL1 >= criteriaL2 || criteriaL2 >= criteriaL3);
  const isL3Error = roundError && (criteriaL3 < 0 || criteriaL3 > 100 || criteriaL2 >= criteriaL3);
  const isSingleLevel = roundForm.targetLevel && roundForm.targetLevel !== 'all';
  const resolvedDifficultyWeights = isSingleLevel
    ? {
        easy: roundForm.targetLevel === 'easy' ? 100 : 0,
        medium: roundForm.targetLevel === 'medium' ? 100 : 0,
        hard: roundForm.targetLevel === 'hard' ? 100 : 0
      }
    : (roundForm.difficultyWeights || { easy: 0, medium: 0, hard: 0 });

  return (
    <div className="admin-quiz-bank">
      <div className="quiz-content">
        <div className="quiz-header">
          <h2>จัดการคำถาม</h2>
        </div>

        <div className="quiz-form-card quiz-round-card">
          <h3>โครงสร้างข้อสอบ</h3>
          <form onSubmit={handleRoundSubmit} className="quiz-form quiz-form--round">
            <div className="form-grid form-grid--round">
              <div className="form-group">
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

              <div className="form-grid form-grid--inner" style={{ marginTop: '1.5rem' }}>
                
                {/* Section 1: General Settings */}
                <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #edf2f7' }}>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#2d3748', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <i className='bx bx-slider-alt'></i> การตั้งค่าทั่วไป
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label htmlFor="round-frequency" style={{ fontSize: '0.9rem', fontWeight: 600 }}>ความถี่การสอบ (เดือน)</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          id="round-frequency"
                          type="number"
                          min="0"
                          value={roundForm.frequencyMonths || ''}
                          onChange={(e) => setRoundForm({ ...roundForm, frequencyMonths: e.target.value === '' ? '' : Number(e.target.value) })}
                          placeholder="เช่น 6 เดือน"
                          style={{ padding: '0.6rem', borderRadius: '6px', border: (attemptedSubmit && (roundForm.frequencyMonths === '' || roundForm.frequencyMonths === null || roundForm.frequencyMonths === undefined)) ? '1px solid #e53e3e' : '1px solid #cbd5e0', width: '100%', fontSize: '0.95rem' }}
                        />
                      </div>
                      {(attemptedSubmit && (roundForm.frequencyMonths === '' || roundForm.frequencyMonths === null || roundForm.frequencyMonths === undefined)) && (
                        <div style={{ fontSize: '0.8rem', color: '#e53e3e', marginTop: '2px' }}>กรุณาระบุความถี่</div>
                      )}
                      <div style={{ fontSize: '0.8rem', color: '#718096', marginTop: '4px' }}>ระยะเวลาเว้นช่วงก่อนสอบครั้งถัดไป</div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label htmlFor="round-passing-score" style={{ fontSize: '0.9rem', fontWeight: 600 }}>เกณฑ์ผ่าน (%)</label>
                      <input
                        id="round-passing-score"
                        type="number"
                        min="0"
                        max="100"
                        value={roundForm.passingScore}
                        onChange={(e) => setRoundForm({ ...roundForm, passingScore: Number(e.target.value) })}
                        style={{ padding: '0.6rem', borderRadius: '6px', border: (attemptedSubmit && (roundForm.passingScore === '' || roundForm.passingScore === null)) ? '1px solid #e53e3e' : '1px solid #cbd5e0', width: '100%', fontSize: '0.95rem' }}
                      />
                      {(attemptedSubmit && (roundForm.passingScore === '' || roundForm.passingScore === null)) && (
                        <div style={{ fontSize: '0.8rem', color: '#e53e3e', marginTop: '4px' }}>กรุณาระบุเกณฑ์ผ่าน</div>
                      )}
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label htmlFor="round-question-count" style={{ fontSize: '0.9rem', fontWeight: 600 }}>จำนวนข้อสอบ (ข้อ)</label>
                      <input
                        id="round-question-count"
                        type="number"
                        min={1}
                        value={roundForm.questionCount}
                        onChange={(e) => setRoundForm({ ...roundForm, questionCount: Number(e.target.value) })}
                        style={{ padding: '0.6rem', borderRadius: '6px', border: (attemptedSubmit && !roundForm.questionCount) ? '1px solid #e53e3e' : '1px solid #cbd5e0', width: '100%', fontSize: '0.95rem' }}
                      />
                      {(attemptedSubmit && !roundForm.questionCount) && (
                        <div style={{ fontSize: '0.8rem', color: '#e53e3e', marginTop: '4px' }}>กรุณาระบุจำนวนข้อสอบ</div>
                      )}
                      <div style={{ fontSize: '0.8rem', color: '#718096', marginTop: '4px' }}>
                        มีในคลัง: <span style={{fontWeight: 600, color: '#2b6cb0'}}>{categoryStats.total}</span> (ง่าย {categoryStats.easy}, กลาง {categoryStats.medium}, ยาก {categoryStats.hard})
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label htmlFor="round-duration" style={{ fontSize: '0.9rem', fontWeight: 600 }}>เวลาทำข้อสอบ (นาที)</label>
                      <input
                        id="round-duration"
                        type="number"
                        min={1}
                        value={roundForm.durationMinutes}
                        onChange={(e) => setRoundForm({ ...roundForm, durationMinutes: Number(e.target.value) })}
                        style={{ padding: '0.6rem', borderRadius: '6px', border: (attemptedSubmit && !roundForm.durationMinutes) ? '1px solid #e53e3e' : '1px solid #cbd5e0', width: '100%', fontSize: '0.95rem' }}
                      />
                      {(attemptedSubmit && !roundForm.durationMinutes) && (
                        <div style={{ fontSize: '0.8rem', color: '#e53e3e', marginTop: '4px' }}>กรุณาระบุเวลาสอบ</div>
                      )}
                    </div>
                    <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                      <label htmlFor="round-description" style={{ fontSize: '0.9rem', fontWeight: 600 }}>รายละเอียดเพิ่มเติม</label>
                      <textarea
                        id="round-description"
                        rows={3}
                        value={roundForm.description || ''}
                        onChange={(e) => setRoundForm({ ...roundForm, description: e.target.value })}
                        placeholder="ระบุรายละเอียดหรือหมายเหตุเพิ่มเติม"
                        style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e0', width: '100%', fontSize: '0.95rem', resize: 'vertical' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Exam Conditions */}
                <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#2d3748', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <i className='bx bx-layer'></i>เงื่อนไขความยากง่าย
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                    
                    {/* Level Selector */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="level-selector__label" style={{ fontSize: '0.9rem', fontWeight: 600 }}>เลือกชุดข้อสอบตามระดับ</label>
                      <div className="level-selector__options" role="group" aria-label="เลือกชุดข้อสอบตามระดับ" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', border: (attemptedSubmit && !roundForm.targetLevel) ? '1px solid #e53e3e' : 'none', padding: (attemptedSubmit && !roundForm.targetLevel) ? '0.5rem' : '0', borderRadius: '6px' }}>
                        {[
                          { value: 'easy', label: 'ระดับ 1 (พื้นฐาน)' },
                          { value: 'medium', label: 'ระดับ 2 (ปานกลาง)' },
                          { value: 'hard', label: 'ระดับ 3 (ยาก)' }
                        ].map(level => (
                          <button
                            key={level.value}
                            type="button"
                            className={`level-option${roundForm.targetLevel === level.value ? ' is-active' : ''}`}
                            onClick={() => setRoundForm(prev => ({
                              ...prev,
                              targetLevel: level.value,
                              difficultyWeights: level.value === 'all'
                                ? (prev.difficultyWeights || { easy: 40, medium: 40, hard: 20 })
                                : {
                                    easy: level.value === 'easy' ? 100 : 0,
                                    medium: level.value === 'medium' ? 100 : 0,
                                    hard: level.value === 'hard' ? 100 : 0
                                  }
                            }))}
                            aria-pressed={roundForm.targetLevel === level.value}
                            style={{
                              padding: '0.5rem 1rem',
                              borderRadius: '20px',
                              border: roundForm.targetLevel === level.value ? '1px solid #3182ce' : '1px solid #e2e8f0',
                              background: roundForm.targetLevel === level.value ? '#ebf8ff' : '#fff',
                              color: roundForm.targetLevel === level.value ? '#2b6cb0' : '#4a5568',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              transition: 'all 0.2s'
                            }}
                          >
                            {level.label}
                          </button>
                        ))}
                      </div>
                      {(attemptedSubmit && !roundForm.targetLevel) && (
                        <div style={{ fontSize: '0.8rem', color: '#e53e3e', marginTop: '4px' }}>กรุณาเลือกระดับความยาก</div>
                      )}
                      <div className="level-selector__hint" style={{ fontSize: '0.8rem', color: '#718096', marginTop: '0.5rem' }}>
                        เลือกระดับเฉพาะเจาะจง ตาม Level Selector ด้านบน                      </div>
                    </div>

                    {/* Difficulty Weights */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <label style={{ marginBottom: 0, fontWeight: 600, fontSize: '0.9rem' }}>โครงสร้างน้ำหนักความยาก (%)</label>
                      </div>
                      
                      <div style={{ padding: '1rem', background: '#ebf8ff', borderRadius: '6px', border: (attemptedSubmit && (resolvedDifficultyWeights.easy + resolvedDifficultyWeights.medium + resolvedDifficultyWeights.hard !== 100)) ? '1px solid #e53e3e' : '1px solid #bee3f8', color: '#2c5282', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <i className='bx bx-info-circle' style={{ fontSize: '1.5rem' }}></i>
                        <div>
                          <div style={{ fontWeight: 600 }}>โหมดสอบเลื่อนระดับ {roundForm.targetLevel === 'easy' ? '1' : roundForm.targetLevel === 'medium' ? '2' : '3'}</div>
                          <div style={{ fontSize: '0.9rem' }}>
                            ระบบจะสุ่มเฉพาะข้อสอบ<strong>{DIFFICULTY_LABELS[roundForm.targetLevel] || 'ระดับที่เลือก'}</strong>เท่านั้น (100%)
                          </div>
                        </div>
                      </div>
                      {(attemptedSubmit && (resolvedDifficultyWeights.easy + resolvedDifficultyWeights.medium + resolvedDifficultyWeights.hard !== 100)) && (
                        <div style={{ fontSize: '0.8rem', color: '#e53e3e', marginTop: '4px' }}>ผลรวมน้ำหนักต้องเท่ากับ 100%</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 3: Subcategory Quotas */}
                {subcategoryOptions[roundForm.category] && subcategoryOptions[roundForm.category].length > 0 && (
                  <div style={{ gridColumn: '1 / -1', background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                      <h4 style={{ margin: 0, fontSize: '1rem', color: '#2d3748', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <i className='bx bx-pie-chart-alt-2'></i> สัดส่วนข้อสอบรายหมวดหมู่ย่อย
                      </h4>
                      
                      {/* Preset Controls */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {quotaPresets[roundForm.category] && quotaPresets[roundForm.category].length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <select 
                              value={selectedPresetName} 
                              onChange={(e) => setSelectedPresetName(e.target.value)}
                              style={{ padding: '0.25rem', borderRadius: '4px', border: '1px solid #dddddd00', fontSize: '0.8rem' }}
                            >
                              <option value="">-- เลือกสูตร --</option>
                              {quotaPresets[roundForm.category].map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                            </select>
                            <button type="button" className="pill secondary" onClick={handleLoadPreset} disabled={!selectedPresetName} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', height: 'auto', minWidth: 'auto' }}>
                              ใช้สูตร
                            </button>
                            <button type="button" className="btn-icon" onClick={() => handleDeletePreset(selectedPresetName)} disabled={!selectedPresetName} title="ลบสูตร" style={{ width: '28px', height: '28px', minWidth: 'auto', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                              <i className='bx bx-trash'></i>
                            </button>
                          </div>
                        )}
                        <button type="button" className="pill secondary" onClick={handleSavePreset} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', height: 'auto', minWidth: 'auto' }}>
                          <i className='bx bx-save'></i> บันทึกสูตร
                        </button>
                      </div>
                    </div>
                    
                    {categoryStats.total === 0 ? (
                      <div style={{ padding: '2rem', background: '#f9fafb00', borderRadius: '8px', border: '1px dashed #e2e8f000', color: '#00000000', textAlign: 'center', fontSize: '0.9rem' }}>
                        <i className='bx bx-info-circle' style={{ marginRight: '0.5rem', verticalAlign: 'middle', fontSize: '1.2em' }}></i>
                        ยังไม่มีข้อสอบในคลังสำหรับหมวดหมู่นี้ กรุณาเพิ่มข้อสอบก่อนกำหนดสัดส่วน
                      </div>
                    ) : (
                      <div style={{ background: 'transparent', padding: '1rem', borderRadius: '8px', border: '1px solid #edf2f700' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#4a5568', fontSize: '0.9rem' }}>
                          <i className='bx bx-bulb'></i>
                          <span>กำหนดเปอร์เซ็นต์เป้าหมายของแต่ละหมวดหมู่ย่อย ผลรวมต้องเท่ากับ 100%</span>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                          {subcategoryOptions[roundForm.category].map(option => {
                            const stats = currentSubcategoryStats[option.value] || { total: 0, easy: 0, medium: 0, hard: 0 };
                            if (stats.total === 0) return null;
                            const quota = roundForm.subcategoryQuotas[option.value] || {};
                            const safeQuota = typeof quota === 'number' ? {} : quota;

                            return (
                              <div key={option.value} style={{ background: '#fff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#2d3748', lineHeight: 1.4 }}>{option.label}</span>
                                  <span style={{ fontSize: '0.75rem', background: '#edf2f7', padding: '2px 6px', borderRadius: '4px', color: '#4a5568', whiteSpace: 'nowrap' }}>{stats.total} ข้อ</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <label style={{ fontSize: '0.85rem', color: '#718096' }}>เป้าหมาย (%)</label>
                                    {(safeQuota && safeQuota.pct !== undefined && safeQuota.pct !== '') && (
                                      <span style={{ fontSize: '0.8rem', color: '#3182ce', fontWeight: 'bold' }}>
                                        ≈ {Math.round((Number(safeQuota.pct) / 100) * roundForm.questionCount)} ข้อ
                                      </span>
                                    )}
                                  </div>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={(safeQuota && typeof safeQuota === 'object') ? (safeQuota.pct ?? '') : ''}
                                    onChange={(e) => handleSubcategoryPctChange(option.value, e.target.value)}
                                    style={{ width: '80px', padding: '0.3rem', border: '1px solid #cbd5e0', borderRadius: '4px', textAlign: 'right' }}
                                  />
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#718096' }}>
                                  สูงสุด {roundForm.questionCount ? Math.min(100, Math.floor((stats.total / roundForm.questionCount) * 100)) : 100}% (มี {stats.total} ข้อ)
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'transparent', borderRadius: '6px', border: '1px solid #e2e8f000', display: 'flex', justifyContent: 'flex-end' }}>
                          {(() => {
                            const currentTotalPct = subcategoryOptions[roundForm.category].reduce((sum, opt) => {
                              const q = roundForm.subcategoryQuotas[opt.value] || {};
                              return sum + Number(q.pct || 0);
                            }, 0);
                            const isTotalMismatch = currentTotalPct !== 100;
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                                <span style={{ color: '#4a5568' }}>รวมทุกหมวดหมู่:</span>
                                <strong style={{ color: isTotalMismatch ? '#e53e3e' : '#38a169', fontSize: '1.1rem' }}>{currentTotalPct}%</strong>
                                {isTotalMismatch && <span style={{ color: '#e53e3e', fontSize: '0.85rem' }}>(ต้องรวมได้ 100%)</span>}
                                {!isTotalMismatch && <span style={{ color: '#38a169', fontSize: '0.85rem', display: 'flex', alignItems: 'center' }}><i className='bx bx-check-circle'></i> ครบถ้วน</span>}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gridColumn: '1 / -1' }}>
                <div style={{ fontSize: '0.85rem', color: '#718096' }}>
                  {selectedRoundId !== ROUND_NEW_VALUE && selectedRound && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className='bx bx-history'></i>
                      <span>แก้ไขล่าสุด: {selectedRound.updatedAt ? new Date(selectedRound.updatedAt).toLocaleString('th-TH') : '-'} {selectedRound.updatedBy ? `โดย ${selectedRound.updatedBy}` : ''}</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', marginLeft: 'auto', marginRight: '2rem' }}>
                  {selectedRoundId !== ROUND_NEW_VALUE && (
                    <button 
                      type="button" 
                      className="pill secondary"
                      onClick={() => setShowHistoryModal(true)}
                    >
                      <i className='bx bx-history'></i> ประวัติการตั้งค่า
                    </button>
                  )}
                  <button 
                    type="button" 
                    className="pill secondary"
                    onClick={handleSimulateRound}
                    title="ตรวจสอบว่ามีข้อสอบเพียงพอหรือไม่"
                  >
                    <i className='bx bx-check-shield'></i> ตรวจสอบจำนวนข้อ
                  </button>
                  <button type="submit" className="pill primary" disabled={roundSaving} style={{ minWidth: '160px', justifyContent: 'center' }}>
                    {roundSaving ? 'กำลังบันทึก...' : 'บันทึกโครงสร้างข้อสอบ'}
                  </button>
                </div>
              </div>

              {(roundMessage || roundError) && (
                <div className="form-feedback-stack" style={{ marginTop: '1rem' }}>
                  {roundError && <div className="form-feedback error">{roundError}</div>}
                  {roundMessage && <div className="form-feedback success">{roundMessage}</div>}
                </div>
              )}
            </div>
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
                <button type="button" className="pill secondary" onClick={handleRefresh} style={{ marginRight: '0.5rem' }} disabled={questionsLoading}>
                  <i className='bx bx-refresh' style={{ marginRight: '4px' }}></i> รีเฟรช
                </button>
                <input
                  type="file"
                  id="import-csv-input"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <button type="button" className="pill secondary" onClick={handleImportClick} style={{ marginRight: '0.5rem' }}>
                  <i className='bx bx-import' style={{ marginRight: '4px' }}></i> นำเข้า CSV
                </button>
                <button type="button" className="pill primary" onClick={handleStartCreate}>
                  + เพิ่มคำถามใหม่
                </button>
              </div>
            </div>

            <div className="quiz-table-controls">
              <div className="table-filters" style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ flex: 1, minWidth: '200px', width: 'auto', marginBottom: 0 }}>
                  <label htmlFor="table-search" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666' }}>ค้นหา</label>
                  <div style={{ position: 'relative' }}>
                    <i className='bx bx-search' style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#999' }}></i>
                    <input
                      id="table-search"
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="ค้นหาคำถาม..."
                      style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 2.2rem', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                  </div>
                </div>

                {subcategoryOptions[roundForm.category] && subcategoryOptions[roundForm.category].length > 0 && (
                  <div className="form-group" style={{ minWidth: '200px', width: 'auto', marginBottom: 0 }}>
                    <label htmlFor="table-subcategory-filter" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666' }}>กรองตามหมวดหมู่</label>
                    <select
                      id="table-subcategory-filter"
                      value={tableSubcategoryFilter}
                      onChange={(event) => setTableSubcategoryFilter(event.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                    >
                      <option value={TABLE_FILTER_ALL}>ทุกหมวดหมู่</option>
                      {subcategoryOptions[roundForm.category].map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group" style={{ minWidth: '150px', width: 'auto', marginBottom: 0 }}>
                  <label htmlFor="table-difficulty-filter" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666' }}>กรองตามระดับความยาก</label>
                  <select
                    id="table-difficulty-filter"
                    value={tableDifficultyFilter}
                    onChange={(event) => setTableDifficultyFilter(event.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                  >
                    <option value={TABLE_FILTER_ALL}>ทุกระดับ</option>
                    {DIFFICULTY_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {(questionError || questionMessage) && (
                <div className="quiz-table-feedback">
                  {questionError && <div className="form-feedback error">{questionError}</div>}
                  {questionMessage && <div className="form-feedback success">{questionMessage}</div>}
                </div>
              )}
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
                      {subcategoryOptions[roundForm.category] && subcategoryOptions[roundForm.category].length > 0 && (
                        <th>หมวดหมู่</th>
                      )}
                      <th>ระดับ</th>
                      <th>คำถาม</th>
                      <th>ตัวเลือก</th>
                      <th>คำตอบที่ถูก</th>
                      <th>แก้ไขล่าสุด</th>
                      <th>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedQuestions.map((question, index) => {
                      const options = Array.isArray(question.options) ? question.options : [];
                      const correctOptions = options.filter(option => Boolean(option?.isCorrect ?? option?.is_correct));
                      
                      // แสดงคำตอบที่ถูกต้อง
                      let correctText = '-';
                      if (question._source === 'question_Structural' && options.length > 0) {
                        // สำหรับ question_Structural แสดงตัวอักษร A, B, C, D
                        const correctIndex = options.findIndex(opt => opt.isCorrect || opt.is_correct);
                        if (correctIndex >= 0) {
                          correctText = String.fromCharCode(65 + correctIndex); // 65 = 'A'
                        }
                      } else if (correctOptions.length > 0) {
                        correctText = correctOptions.map(option => option.text).join(', ');
                      }
                      
                      const isExternal = question._source === 'question_Structural';
                      const difficultyLabel = DIFFICULTY_LABELS[question.difficulty] || '-';
                      const subcategoryLabel = question.subcategory && subcategoryOptions[roundForm.category]
                        ? subcategoryOptions[roundForm.category].find(opt => opt.value === question.subcategory)?.label || question.subcategory
                        : 'ไม่ระบุหมวดหมู่';
                      return (
                        <tr key={question.id} style={isExternal ? { backgroundColor: '#f8fafc' } : {}}>
                          <td>{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                          {subcategoryOptions[roundForm.category] && subcategoryOptions[roundForm.category].length > 0 && (
                            <td>
                              {subcategoryLabel}
                              {isExternal && <span style={{ fontSize: '0.7em', backgroundColor: '#edf2f7', padding: '2px 4px', borderRadius: '4px', marginLeft: '4px', color: '#718096' }}>API</span>}
                            </td>
                          )}
                          <td>{difficultyLabel}</td>
                          <td className="table-question">{question.text}</td>
                          <td>{options.length > 0 ? `${options.length} ตัวเลือก` : '-'}</td>
                          <td className="table-answer">{correctText}</td>
                          <td style={{ fontSize: '0.85rem', color: '#718096', whiteSpace: 'nowrap' }}>
                            {question.updatedAt || question.createdAt 
                              ? new Date(question.updatedAt || question.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
                              : '-'}
                          </td>
                          <td>
                            <div className="table-actions">
                              <button 
                                type="button" 
                                className="btn-icon" 
                                onClick={() => handleEdit(question)} 
                                title="แก้ไข" 
                                aria-label="แก้ไขคำถาม"
                                // เปิดให้แก้ไขได้แล้ว
                              >
                                <i className="bx bx-edit" style={{ color: isExternal ? '#cbd5e0' : '#3b82f6' }} />
                              </button>
                              <button type="button" className="btn-icon" onClick={() => handleDuplicate(question)} title="คัดลอก" aria-label="คัดลอกคำถาม">
                                <i className="bx bx-copy" style={{ color: '#805ad5' }} />
                              </button>
                              <button
                                type="button"
                                className={`btn-icon${deletingQuestionId === question.id ? ' is-busy' : ''}`}
                                onClick={() => handleDelete(question.id)}
                                title={isExternal ? "ไม่สามารถลบคำถามจากระบบภายนอกได้" : (deletingQuestionId === question.id ? 'กำลังลบ...' : 'ลบ')}
                                aria-label={deletingQuestionId === question.id ? 'กำลังลบคำถาม' : 'ลบคำถาม'}
                                disabled={deletingQuestionId === question.id || isExternal}
                                style={isExternal ? { opacity: 0.3, cursor: 'not-allowed' } : {}}
                              >
                                <i className="bx bx-trash-alt" style={isExternal ? { color: '#cbd5e0' } : {}} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {displayedQuestions.length === 0 && (
                      <tr>
                        <td colSpan={subcategoryOptions[roundForm.category] && subcategoryOptions[roundForm.category].length > 0 ? "8" : "7"} className="table-empty">
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
                {totalPages > 1 && (
                  <div className="pagination-controls">
                    <button
                      type="button"
                      className="pagination-btn"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      &lt;
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        type="button"
                        className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="pagination-btn"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    >
                      &gt;
                    </button>
                  </div>
                )}
                {missingQuestionCount > 0 && (
                  <div className="table-footnote warning">
                    ต้องการเพิ่มอีก {missingQuestionCount} ข้อเพื่อให้ครบ {roundForm.questionCount} ข้อ
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {showSimulationModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}>
            <div style={{
              background: 'white', padding: '1.5rem', borderRadius: '8px', width: '90%', maxWidth: '500px',
              maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#2d3748', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {simulationResult.success ? <i className='bx bx-check-circle' style={{color: 'green'}}></i> : <i className='bx bx-x-circle' style={{color: 'red'}}></i>}
                  ผลการจำลองสุ่มข้อสอบ
                </h3>
                <button onClick={() => setShowSimulationModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1, color: '#718096' }}>&times;</button>
              </div>
              
              <div style={{ padding: '1rem', background: simulationResult.success ? '#f0fff4' : '#fff5f5', borderRadius: '6px', marginBottom: '1rem', border: `1px solid ${simulationResult.success ? '#c6f6d5' : '#fed7d7'}` }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: simulationResult.success ? '#2f855a' : '#c53030' }}>
                  {simulationResult.message}
                </h4>
                <div style={{ fontSize: '0.9rem', color: '#4a5568' }}>
                  เป้าหมายทั้งหมด: <strong>{roundForm.questionCount}</strong> ข้อ
                </div>
              </div>

              <div style={{ fontSize: '0.9rem' }}>
                <h5 style={{ margin: '0 0 0.5rem 0', color: '#2d3748' }}>รายละเอียด:</h5>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {simulationResult.details.map((detail, idx) => (
                    <li key={idx} style={{ 
                      padding: '0.5rem', 
                      borderBottom: '1px solid #eee', 
                      color: detail.type === 'error' ? '#c53030' : '#2f855a',
                      display: 'flex',
                      alignItems: 'start',
                      gap: '0.5rem'
                    }}>
                      <i className={`bx ${detail.type === 'error' ? 'bx-x' : 'bx-check'}`} style={{ marginTop: '3px' }}></i>
                      <span>{detail.msg}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
                <button type="button" className="pill secondary" onClick={() => setShowSimulationModal(false)}>ปิด</button>
              </div>
            </div>
          </div>
        )}

        {showHistoryModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}>
            <div style={{
              background: 'white', padding: '1.5rem', borderRadius: '8px', width: '90%', maxWidth: '500px',
              maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#2d3748' }}>ประวัติการแก้ไข</h3>
                <button onClick={() => setShowHistoryModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1, color: '#718096' }}>&times;</button>
              </div>
              
              {resolvedHistory.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {resolvedHistory.map((log, idx) => (
                    <li key={idx} style={{ padding: '0.75rem 0', borderBottom: '1px solid #eee', fontSize: '0.9rem' }}>
                      <div style={{ fontWeight: 600, color: '#2d3748' }}>{log.action || 'แก้ไขข้อมูล'}</div>
                      {Array.isArray(log.changes) && log.changes.length > 0 && (
                        <div style={{ marginTop: '0.4rem', color: '#4a5568' }}>
                          {log.changes.map((change, changeIdx) => (
                            <div key={changeIdx} style={{ fontSize: '0.82rem' }}>
                              <strong>{change.field}</strong>: {formatHistoryValue(change.from)} → {formatHistoryValue(change.to)}
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#718096', marginTop: '0.25rem', fontSize: '0.8rem' }}>
                        <span>{new Date(log.timestamp).toLocaleString('th-TH')}</span>
                        <span>โดย {log.user}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ textAlign: 'center', color: '#718096', padding: '2rem 0', background: '#f7fafc', borderRadius: '6px' }}>
                  ไม่พบประวัติการแก้ไขเพิ่มเติม
                </div>
              )}
              
              <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
                <button type="button" className="pill secondary" onClick={() => setShowHistoryModal(false)}>ปิด</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminQuizBank;

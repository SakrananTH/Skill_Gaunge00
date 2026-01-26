import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './AdminWorkerRegistration.css';
import ThaiDatePicker from '../../components/ThaiDatePicker';
import { apiRequest } from '../../utils/api';

const provinceOptions = [];

const tradeOptions = [
  { value: 'structure', label: 'ช่างโครงสร้าง' },
  { value: 'plumbing', label: 'ช่างประปา' },
  { value: 'roofing', label: 'ช่างหลังคา' },
  { value: 'masonry', label: 'ช่างก่ออิฐฉาบปูน' },
  { value: 'aluminum', label: 'ช่างประตูหน้าต่างอลูมิเนียม' },
  { value: 'ceiling', label: 'ช่างฝ้าเพดาล' },
  { value: 'electric', label: 'ช่างไฟฟ้า' },
  { value: 'tiling', label: 'ช่างกระเบื้อง' }
];

const roleOptions = [
  { value: 'pm', label: 'ผู้จัดการโครงการ (PM)' },
  { value: 'fm', label: 'หัวหน้าช่าง (FM)' },
  { value: 'worker', label: 'ช่าง (WK)' }
];

const RANDOM_PASSWORD_LENGTH = 12;
const UPPERCASE_SET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWERCASE_SET = 'abcdefghijkmnopqrstuvwxyz';
const DIGIT_SET = '23456789';
const SYMBOL_SET = '!@#$%^&*';
const MIN_PHONE_LENGTH = 10;
const MAX_PHONE_LENGTH = 10;

const buildRandomPassword = (length = RANDOM_PASSWORD_LENGTH) => {
  const pickFrom = source => source[Math.floor(Math.random() * source.length)];
  const baseSets = [UPPERCASE_SET, LOWERCASE_SET, DIGIT_SET, SYMBOL_SET];
  const merged = baseSets.join('');
  const characters = baseSets.map(pickFrom);

  while (characters.length < length) {
    characters.push(pickFrom(merged));
  }

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }

  return characters.join('');
};

const STEP_FLOW = [
  {
    key: 'personal',
    title: '1) ข้อมูลส่วนตัว ตำแหน่งงาน และที่อยู่',
    label: 'ข้อมูลส่วนตัว/ตำแหน่ง/ที่อยู่',
    description: 'กรอกข้อมูลประจำตัว รายละเอียดตำแหน่ง ที่อยู่ และข้อมูลบัตรในหน้าเดียว'
  },
  {
    key: 'credentials',
    title: '2) สร้างบัญชีเข้าสู่ระบบ',
    label: 'สร้างบัญชีเข้าสู่ระบบ',
    description: 'สร้างอีเมลและรหัสผ่านสำหรับเข้าสู่ระบบ'
  },
  {
    key: 'review',
    title: '3) ตรวจสอบและยืนยันข้อมูล',
    label: 'ตรวจสอบข้อมูล',
    description: 'ตรวจสอบความถูกต้องของข้อมูลทั้งหมดก่อนบันทึก'
  }
];

const STEP_INDEX_BY_KEY = STEP_FLOW.reduce((accumulator, step, index) => {
  accumulator[step.key] = index;
  return accumulator;
}, {});

const STEP_FIELD_PATHS = {
  personal: [
    ['personal', 'nationalId'],
    ['personal', 'fullName'],
    ['personal', 'birthDate'],
    ['employment', 'role'],
    ['employment', 'tradeType'],
    ['address', 'phone'],
    ['address', 'addressOnId'],
    ['address', 'province'],
    ['address', 'district'],
    ['address', 'subdistrict'],
    ['address', 'postalCode'],
    ['address', 'currentAddress'],
    ['identity', 'issueDate'],
    ['identity', 'expiryDate']
  ],
  credentials: [
    ['credentials', 'email'],
    ['credentials', 'password']
  ],
  review: []
};

const IMPORTANT_FIELD_PATHS = {
  personal: [
    ['personal', 'nationalId'],
    ['personal', 'fullName'],
    ['personal', 'birthDate'],
    ['employment', 'role'],
    ['employment', 'tradeType'],
    ['address', 'phone'],
    ['address', 'addressOnId'],
    ['address', 'currentAddress'],
    ['identity', 'issueDate'],
    ['identity', 'expiryDate']
  ],
  credentials: [
    ['credentials', 'email'],
    ['credentials', 'password']
  ]
};

const REQUIRED_FIELD_MESSAGES = {
  'personal.nationalId': 'กรุณากรอกเลขบัตรประชาชน',
  'personal.fullName': 'กรุณากรอกชื่อ-นามสกุล',
  'personal.birthDate': 'กรุณาระบุวันเกิด',
  'employment.role': 'กรุณาเลือกตำแหน่ง',
  'employment.tradeType': 'กรุณาเลือกประเภทช่าง',
  'address.province': 'กรุณาระบุจังหวัด',
  'address.district': 'กรุณาระบุอำเภอ',
  'address.subdistrict': 'กรุณาระบุตำบล',
  'address.postalCode': 'กรุณาระบุรหัสไปรษณีย์',
  'address.phone': 'กรุณากรอกเบอร์โทรศัพท์',
  'address.addressOnId': 'กรุณากรอกที่อยู่ตามบัตรประชาชน',
  'address.currentAddress': 'กรุณากรอกที่อยู่ปัจจุบัน',
  'identity.issueDate': 'กรุณาระบุวันออกบัตร',
  'identity.expiryDate': 'กรุณาระบุวันหมดอายุบัตร'
};

const serverErrorMessages = {
  duplicate_email: 'อีเมลนี้ถูกใช้งานแล้ว',
  duplicate_national_id: 'เลขบัตรประชาชนนี้ถูกใช้งานแล้ว',
  invalid_email: 'รูปแบบอีเมลไม่ถูกต้อง',
  password_required: 'กรุณากำหนดรหัสผ่านให้ครบถ้วน',
  invalid_phone: 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง',
  invalid_national_id_length: 'เลขบัตรประชาชนต้องมี 13 หลัก',
  workers_table_missing_id: 'ตาราง workers ไม่มีคอลัมน์ id กรุณาตรวจสอบฐานข้อมูล',
  worker_accounts_table_missing_columns: 'ตารางบัญชีผู้ใช้ยังไม่พร้อมใช้งาน'
};

const getValueByPath = (obj, path) => path.reduce((value, key) => {
  if (value === null || value === undefined) {
    return undefined;
  }
  return value[key];
}, obj);

const isFilledValue = (value) => {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return Boolean(value);
};

const formatDate = (value) => {
  if (!value) {
    return 'ไม่ระบุ';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  try {
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch (error) {
    return date.toISOString().split('T')[0];
  }
};

const formatThaiDateForInput = (isoDate) => {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const [y, m, d] = parts;
  const thYear = parseInt(y, 10) + 543;
  return `${d}/${m}/${thYear}`;
};

const buildInitialFormState = () => ({
  personal: {
    nationalId: '',
    fullName: '',
    birthDate: ''
  },
  identity: {
    issueDate: '',
    expiryDate: ''
  },
  address: {
    phone: '',
    addressOnId: '',
    province: '',
    district: '',
    subdistrict: '',
    postalCode: '',
    currentAddress: ''
  },
  employment: {
    role: '',
    tradeType: '',
    experienceYears: ''
  },
  credentials: {
    email: '',
    password: ''
  }
});

const AdminWorkerRegistration = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const editingWorker = location.state?.editWorker || null;
  const editingWorkerId = editingWorker?.id;
  const isEditing = Boolean(editingWorkerId);
  const viewOnlyFlag = Boolean(location.state?.viewOnly);
  const [form, setForm] = useState(buildInitialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState(null);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [addressLookupField, setAddressLookupField] = useState(null);
  const [addressLookupLoading, setAddressLookupLoading] = useState(false);
  const addressLookupDebounceRef = useRef(null);
  const addressLookupAbortRef = useRef(null);
  const addressBlurTimeoutRef = useRef(null);

  // Date picker refs
  const birthDateRef = useRef(null);
  const issueDateRef = useRef(null);
  const expiryDateRef = useRef(null);

  const openDatePicker = (ref) => {
    if (ref.current) {
      if (typeof ref.current.showPicker === 'function') {
        ref.current.showPicker();
      } else {
        ref.current.focus();
      }
    }
  };

  const handleGeneratePassword = () => {
    const generated = buildRandomPassword();
    setForm(prev => ({
      ...prev,
      credentials: {
        ...prev.credentials,
        password: generated
      }
    }));
    setErrors(prev => {
      if (!prev.password) {
        return prev;
      }
      const next = { ...prev };
      delete next.password;
      return next;
    });
  };

  useEffect(() => {
    if (editingWorker) {
      const { fullData } = editingWorker;
      if (fullData) {
        const fallbackEmail = editingWorker.email;
        const credentialData = fullData.credentials || {};
        const existingPassword = credentialData.passwordHash || credentialData.password || '';

        setForm(prev => ({
          personal: { ...prev.personal, ...(fullData.personal || {}) },
          identity: { ...prev.identity, ...(fullData.identity || {}) },
          address: { ...prev.address, ...(fullData.address || {}) },
          employment: { ...prev.employment, ...(fullData.employment || {}) },
          credentials: {
            ...prev.credentials,
            email:
              credentialData.email ||
              fallbackEmail ||
              prev.credentials.email,
            password: existingPassword
          }
        }));
      }
    }
    if (viewOnlyFlag) {
      setIsViewOnly(true);
    }
  }, [editingWorker, viewOnlyFlag]);

  const age = useMemo(() => {
    if (!form.personal.birthDate) {
      return '';
    }
    const birth = new Date(form.personal.birthDate);
    if (Number.isNaN(birth.getTime())) {
      return '';
    }
    const today = new Date();
    let calculated = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      calculated -= 1;
    }
    return calculated >= 0 ? calculated : '';
  }, [form.personal.birthDate]);

  const currentStepConfig = STEP_FLOW[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === STEP_FLOW.length - 1;

  const selectedRoleLabel = useMemo(() => {
    return roleOptions.find(option => option.value === form.employment.role)?.label || 'ไม่ระบุ';
  }, [form.employment.role]);

  const selectedTradeLabel = useMemo(() => {
    if (form.employment.role !== 'worker') {
      return 'ไม่จำเป็นสำหรับตำแหน่งนี้';
    }
    return tradeOptions.find(option => option.value === form.employment.tradeType)?.label || 'ไม่ระบุ';
  }, [form.employment.role, form.employment.tradeType]);

  const reviewSections = useMemo(() => {
    const formatExperience = () => {
      if (!form.employment.experienceYears && form.employment.experienceYears !== 0) {
        return 'ไม่ระบุ';
      }
      const years = Number(form.employment.experienceYears);
      if (Number.isNaN(years)) {
        return `${form.employment.experienceYears}`;
      }
      return `${years} ปี`;
    };

    return [
      {
        key: 'personal',
        title: 'ข้อมูลส่วนตัว',
        stepIndex: STEP_INDEX_BY_KEY.personal,
        items: [
          { label: 'ชื่อ-นามสกุล', value: form.personal.fullName?.trim() || 'ไม่ระบุ' },
          { label: 'เลขบัตรประชาชน', value: form.personal.nationalId?.trim() || 'ไม่ระบุ' },
          { label: 'วันเกิด', value: formatDate(form.personal.birthDate) },
          { label: 'อายุ', value: age ? `${age} ปี` : 'ไม่ระบุ' }
        ]
      },
      {
        key: 'employment',
        title: 'ข้อมูลตำแหน่งงาน',
        stepIndex: STEP_INDEX_BY_KEY.personal,
        items: [
          { label: 'ตำแหน่ง', value: selectedRoleLabel },
          { label: 'ประเภทช่าง', value: selectedTradeLabel },
          { label: 'ประสบการณ์', value: formatExperience() }
        ]
      },
      {
        key: 'address',
        title: 'ข้อมูลที่อยู่',
        stepIndex: STEP_INDEX_BY_KEY.personal,
        items: [
          { label: 'เบอร์โทรศัพท์', value: form.address.phone?.trim() || 'ไม่ระบุ' },
          { label: 'ที่อยู่ตามบัตรประชาชน', value: form.address.addressOnId?.trim() || 'ไม่ระบุ' },
          { label: 'จังหวัด', value: form.address.province?.trim() || 'ไม่ระบุ' },
          { label: 'อำเภอ', value: form.address.district?.trim() || 'ไม่ระบุ' },
          { label: 'ตำบล', value: form.address.subdistrict?.trim() || 'ไม่ระบุ' },
          { label: 'รหัสไปรษณีย์', value: form.address.postalCode?.trim() || 'ไม่ระบุ' },
          { label: 'ที่อยู่ปัจจุบัน', value: form.address.currentAddress?.trim() || 'ไม่ระบุ' }
        ]
      },
      {
        key: 'identity',
        title: 'ข้อมูลบัตรประชาชน',
        stepIndex: STEP_INDEX_BY_KEY.personal,
        items: [
          { label: 'วันออกบัตร', value: formatDate(form.identity.issueDate) },
          { label: 'วันหมดอายุบัตร', value: formatDate(form.identity.expiryDate) }
        ]
      },
      {
        key: 'account',
        title: 'บัญชีเข้าสู่ระบบ',
        stepIndex: STEP_INDEX_BY_KEY.credentials,
        items: [
          { label: 'อีเมลเข้าสู่ระบบ', value: form.credentials.email.trim() || 'ไม่ระบุ' },
          {
            label: 'รหัสผ่าน',
            value: form.credentials.password
              ? 'ตั้งรหัสผ่านเรียบร้อย'
              : 'ยังไม่กำหนด'
          }
        ]
      }
    ];
  }, [form.personal.fullName, form.personal.nationalId, form.personal.birthDate, age, selectedRoleLabel, selectedTradeLabel, form.employment.experienceYears, form.address.addressOnId, form.address.province, form.address.district, form.address.subdistrict, form.address.postalCode, form.address.currentAddress, form.identity.issueDate, form.identity.expiryDate, form.credentials.email, form.credentials.password]);

  const isFieldRequired = (path) => {
    if (path[0] === 'employment' && path[1] === 'tradeType') {
      return form.employment.role === 'worker';
    }
    return true;
  };

  const progressInfo = useMemo(() => {
    let totalImportantFields = 0;
    let filledImportantFields = 0;

    const sections = STEP_FLOW.map((step, index) => {
      const candidatePaths = IMPORTANT_FIELD_PATHS[step.key] || STEP_FIELD_PATHS[step.key] || [];
      const relevantPaths = candidatePaths.filter(isFieldRequired);
      const totalFields = relevantPaths.length;
      const filledCount = relevantPaths.reduce((count, path) => {
        const value = getValueByPath(form, path);
        return isFilledValue(value) ? count + 1 : count;
      }, 0);

      let progress = totalFields > 0 ? filledCount / totalFields : 0;
      const includeInTotals = step.key !== 'review' && totalFields > 0;

      if (step.key === 'review') {
        progress = index <= currentStep ? 1 : 0;
      }

      if (includeInTotals) {
        totalImportantFields += totalFields;
        filledImportantFields += filledCount;
      }

      return {
        key: step.key,
        label: step.label,
        completed: progress === 1,
        progress,
        percent: Math.round(progress * 100),
        isActive: index === currentStep,
        filledCount,
        totalFields
      };
    });

    const totalPercent = totalImportantFields > 0
      ? Math.round((filledImportantFields / totalImportantFields) * 100)
      : 0;

    return {
      sections,
      totalPercent
    };
  }, [form, currentStep]);

  const { sections: progressSections, totalPercent: progressPercent } = progressInfo;

  const updateField = (section, key, value) => {
    setForm(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  const getErrorKey = (section, key) => `${section}.${key}`;

  const getMissingRequiredFieldPaths = (stepKey) => {
    const paths = (STEP_FIELD_PATHS[stepKey] || []).filter(isFieldRequired);
    return paths.filter(path => {
      const value = getValueByPath(form, path);
      return !isFilledValue(value);
    });
  };

  const clearAddressErrors = (keys) => {
    if (!Array.isArray(keys) || keys.length === 0) {
      return;
    }
    setErrors(prev => {
      const next = { ...prev };
      keys.forEach((key) => {
        const errorKey = getErrorKey('address', key);
        if (next[errorKey]) {
          delete next[errorKey];
        }
      });
      return next;
    });
  };

  const cancelAddressBlurTimeout = () => {
    if (addressBlurTimeoutRef.current) {
      clearTimeout(addressBlurTimeoutRef.current);
      addressBlurTimeoutRef.current = null;
    }
  };

  const clearAddressLookup = (shouldAbort = false) => {
    if (shouldAbort && addressLookupAbortRef.current) {
      addressLookupAbortRef.current.abort();
      addressLookupAbortRef.current = null;
    }
    if (addressLookupDebounceRef.current) {
      clearTimeout(addressLookupDebounceRef.current);
      addressLookupDebounceRef.current = null;
    }
    setAddressSuggestions([]);
    setAddressLookupLoading(false);
    setAddressLookupField(null);
  };

  const handleAddressFieldBlur = () => {
    cancelAddressBlurTimeout();
    addressBlurTimeoutRef.current = setTimeout(() => {
      clearAddressLookup(true);
    }, 160);
  };

  const scheduleAddressLookup = (field, rawValue) => {
    const value = (rawValue || '').trim();
    cancelAddressBlurTimeout();
    if (addressLookupDebounceRef.current) {
      clearTimeout(addressLookupDebounceRef.current);
      addressLookupDebounceRef.current = null;
    }

    if (value.length < 1) {
      if (field === addressLookupField) {
        setAddressSuggestions([]);
        setAddressLookupLoading(false);
      }
      return;
    }

    addressLookupDebounceRef.current = setTimeout(async () => {
      if (addressLookupAbortRef.current) {
        addressLookupAbortRef.current.abort();
      }
      const controller = new AbortController();
      addressLookupAbortRef.current = controller;
      setAddressLookupLoading(true);
      setAddressLookupField(field);

      try {
        const params = new URLSearchParams();
        params.set('limit', '12');
        params.set('query', value);

        const provinceFilter = field === 'province' ? '' : form.address.province;
        const districtFilter = field === 'district' ? '' : form.address.district;
        const subdistrictFilter = field === 'subdistrict' ? '' : form.address.subdistrict;

        if (provinceFilter) {
          params.set('province', provinceFilter);
        }
        if (districtFilter) {
          params.set('district', districtFilter);
        }
        if (subdistrictFilter && field !== 'subdistrict') {
          params.set('subdistrict', subdistrictFilter);
        }
        params.set('field', field);

        const response = await apiRequest(`/api/lookups/addresses?${params.toString()}`, {
          signal: controller.signal
        });

        const results = Array.isArray(response?.results) ? response.results : [];
        setAddressSuggestions(results);
        setAddressLookupLoading(false);
      } catch (error) {
        if (error.name === 'AbortError') {
          return;
        }
        console.error('Address lookup failed:', error);
        setAddressSuggestions([]);
        setAddressLookupLoading(false);
      }
    }, 220);
  };

  const handleAddressFieldFocus = (field) => {
    cancelAddressBlurTimeout();
    setAddressLookupField(field);
    const currentValue = form.address[field] || '';
    if (currentValue.trim().length >= 2) {
      scheduleAddressLookup(field, currentValue);
    }
  };

  const handleAddressSuggestionSelect = (suggestion) => {
    if (!suggestion) {
      return;
    }
    cancelAddressBlurTimeout();
    clearAddressLookup(true);

    setForm(prev => ({
      ...prev,
      address: {
        ...prev.address,
        province: suggestion.province || '',
        district: suggestion.district || '',
        subdistrict: suggestion.subdistrict || '',
        postalCode: suggestion.zipcode || ''
      }
    }));

    clearAddressErrors(['province', 'district', 'subdistrict', 'postalCode']);
  };

  const validateCredentials = () => {
    const emailValue = form.credentials.email.trim();
    const passwordValue = form.credentials.password;
    const validationErrors = {};

    if (!emailValue) {
      validationErrors.email = 'กรุณากรอกอีเมลสำหรับเข้าสู่ระบบ';
    } else if (!/^\S+@\S+\.\S+$/.test(emailValue)) {
      validationErrors.email = 'รูปแบบอีเมลไม่ถูกต้อง';
    }

    const requirePassword = !isEditing || Boolean(passwordValue);

    if (requirePassword) {
      if (!passwordValue) {
        validationErrors.password = 'กรุณากำหนดรหัสผ่าน';
      } else if (passwordValue.length < 8) {
        validationErrors.password = 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
      }
    }

    return {
      errors: validationErrors,
      values: {
        email: emailValue,
        password: requirePassword ? passwordValue : undefined
      },
      requirePassword
    };
  };

  const handleInputChange = (section, key) => (event) => {
    let { value } = event.target;
    if (section === 'personal' && key === 'nationalId') {
      value = value.replace(/\D/g, '').slice(0, 13);
    }
    if (section === 'employment' && key === 'role') {
      const nextRole = value;
      setForm(prev => ({
        ...prev,
        employment: {
          ...prev.employment,
          role: nextRole,
          tradeType: nextRole === 'worker' ? prev.employment.tradeType : ''
        }
      }));
      setErrors(prev => {
        const next = { ...prev };
        const roleErrorKey = getErrorKey('employment', 'role');
        const tradeErrorKey = getErrorKey('employment', 'tradeType');
        if (next[roleErrorKey]) {
          delete next[roleErrorKey];
        }
        if (nextRole !== 'worker' && next[tradeErrorKey]) {
          delete next[tradeErrorKey];
        }
        return next;
      });
      return;
    }
    if (section === 'address') {
      if (key === 'postalCode') {
        value = value.replace(/\D/g, '').slice(0, 5);
      }

      if (key === 'phone') {
        value = value.replace(/\D/g, '').slice(0, MAX_PHONE_LENGTH);
        updateField(section, key, value);
        const phoneErrorKey = getErrorKey('address', 'phone');
        setErrors(prev => {
          const next = { ...prev };
          if (value.length === 0) {
            next[phoneErrorKey] = REQUIRED_FIELD_MESSAGES[phoneErrorKey];
          } else if (value.length < MIN_PHONE_LENGTH) {
            next[phoneErrorKey] = `เบอร์โทรศัพท์ต้องมี ${MIN_PHONE_LENGTH} หลัก`;
          } else if (next[phoneErrorKey]) {
            delete next[phoneErrorKey];
          }
          return next;
        });
        return;
      }

      if (key === 'province') {
        setForm(prev => ({
          ...prev,
          address: {
            ...prev.address,
            province: value,
            district: '',
            subdistrict: '',
            postalCode: ''
          }
        }));
        clearAddressErrors(['province', 'district', 'subdistrict', 'postalCode']);
        scheduleAddressLookup('province', value);
        return;
      }

      if (key === 'district') {
        setForm(prev => ({
          ...prev,
          address: {
            ...prev.address,
            district: value,
            subdistrict: '',
            postalCode: ''
          }
        }));
        clearAddressErrors(['district', 'subdistrict', 'postalCode']);
        scheduleAddressLookup('district', value);
        return;
      }

      if (key === 'subdistrict') {
        setForm(prev => ({
          ...prev,
          address: {
            ...prev.address,
            subdistrict: value,
            postalCode: ''
          }
        }));
        clearAddressErrors(['subdistrict', 'postalCode']);
        scheduleAddressLookup('subdistrict', value);
        return;
      }

      if (key === 'postalCode') {
        updateField(section, key, value);
        clearAddressErrors(['postalCode']);
        return;
      }
    }
    updateField(section, key, value);

    if (section === 'personal' && key === 'nationalId') {
      const nationalIdKey = getErrorKey('personal', 'nationalId');
      const hasValue = value.length > 0;
      const isComplete = value.length === 13;
      setErrors(prev => {
        const next = { ...prev };
        if (!hasValue) {
          next[nationalIdKey] = REQUIRED_FIELD_MESSAGES[nationalIdKey];
        } else if (!isComplete) {
          next[nationalIdKey] = 'เลขบัตรประชาชนต้องมี 13 หลัก';
        } else if (next[nationalIdKey]) {
          delete next[nationalIdKey];
        }
        return next;
      });
      return;
    }

    const errorKey = section === 'credentials' ? key : getErrorKey(section, key);
    if (errors[errorKey]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[errorKey];
        return next;
      });
    }
  };

  const resetForm = () => {
    setForm(buildInitialFormState());
    setFeedback('');
    setFeedbackType(null);
    setCurrentStep(0);
    setErrors({});
    clearAddressLookup(true);
  };

  const handleBack = () => {
    navigate('/admin');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFeedback('');
    setFeedbackType(null);
    const { errors: credentialErrors, values } = validateCredentials();

    if (Object.keys(credentialErrors).length > 0) {
      setErrors(credentialErrors);
      const credentialStepIndex = STEP_INDEX_BY_KEY.credentials;
      if (credentialStepIndex !== undefined) {
        setCurrentStep(credentialStepIndex);
      }
      return;
    }

    setErrors({});

    if (!/^\d{13}$/.test(form.personal.nationalId || '')) {
      setFeedback('เลขบัตรประชาชนต้องมี 13 หลัก');
      setFeedbackType('error');
      return;
    }

    if (values.email !== form.credentials.email) {
      setForm(prev => ({
        ...prev,
        credentials: {
          ...prev.credentials,
          email: values.email
        }
      }));
    }

    const payload = {
      personal: {
        ...form.personal,
        age
      },
      identity: { ...form.identity },
      address: { ...form.address },
      employment: { ...form.employment },
      credentials: {
        email: values.email
      }
    };

    if (values.password) {
      payload.credentials.password = values.password;
    }

    const endpoint = isEditing ? `/api/admin/workers/${editingWorkerId}` : '/api/admin/workers';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      setSubmitting(true);
      await apiRequest(endpoint, { method, body: payload });
      setFeedback(isEditing ? 'อัปเดตข้อมูลสำเร็จ!' : 'บันทึกข้อมูลสำเร็จ!');
      setFeedbackType('success');
      setSubmitting(false);
      setTimeout(() => {
        navigate('/admin', { state: { initialTab: 'users', refreshWorkers: true } });
      }, 900);
    } catch (error) {
      const messageKey = error?.data?.message;
      const friendlyMessage = messageKey && serverErrorMessages[messageKey];
      setFeedback(friendlyMessage || error.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      setFeedbackType('error');
      setSubmitting(false);
    }
  };

  const ensureStepsComplete = (targetIndex) => {
    const result = { valid: true, focusIndex: undefined, credentialValues: undefined };
    const collectedErrors = {};

    for (let index = 0; index <= targetIndex; index += 1) {
      const step = STEP_FLOW[index];
      if (!step || step.key === 'review') {
        continue;
      }

      if (step.key === 'credentials') {
        const { errors: credentialErrors, values } = validateCredentials();
        if (Object.keys(credentialErrors).length > 0) {
          setErrors(prev => ({ ...prev, ...credentialErrors }));
          setFeedback('กรุณากรอกข้อมูลบัญชีผู้ใช้ให้ครบถ้วน');
          setFeedbackType('error');
          result.valid = false;
          result.focusIndex = index;
          return result;
        }
        setErrors(prev => {
          const next = { ...prev };
          ['email', 'password'].forEach(key => {
            if (!credentialErrors[key] && next[key]) {
              delete next[key];
            }
          });
          return next;
        });
        result.credentialValues = values;
        continue;
      }

      const missingPaths = getMissingRequiredFieldPaths(step.key);
      if (missingPaths.length > 0) {
        missingPaths.forEach(path => {
          const key = getErrorKey(path[0], path[1]);
          const message = REQUIRED_FIELD_MESSAGES[key] || 'กรุณากรอกข้อมูลให้ครบถ้วน';
          collectedErrors[key] = message;
        });
        setFeedback(`กรุณากรอกข้อมูลให้ครบถ้วนในขั้น "${step.title}"`);
        setFeedbackType('error');
        result.valid = false;
        if (result.focusIndex === undefined) {
          result.focusIndex = index;
        }
      }

      if (step.key === 'personal') {
        const nationalIdValue = form.personal.nationalId || '';
        if (nationalIdValue.length > 0 && nationalIdValue.length !== 13) {
          const nationalIdKey = getErrorKey('personal', 'nationalId');
          collectedErrors[nationalIdKey] = 'เลขบัตรประชาชนต้องมี 13 หลัก';
          setFeedback('กรุณากรอกเลขบัตรประชาชนให้ครบ 13 หลัก');
          setFeedbackType('error');
          result.valid = false;
          if (result.focusIndex === undefined) {
            result.focusIndex = index;
          }
        }

        const phoneValue = (form.address.phone || '').trim();
        if (phoneValue.length > 0 && phoneValue.length < MIN_PHONE_LENGTH) {
          const phoneKey = getErrorKey('address', 'phone');
          collectedErrors[phoneKey] = `เบอร์โทรศัพท์ต้องมี ${MIN_PHONE_LENGTH} หลัก`;
          setFeedback('กรุณากรอกเบอร์โทรศัพท์ให้ครบถ้วน');
          setFeedbackType('error');
          result.valid = false;
          if (result.focusIndex === undefined) {
            result.focusIndex = index;
          }
        }
      }
    }

    if (!result.valid) {
      setErrors(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(key => {
          if (key.includes('.')) {
            delete next[key];
          }
        });
        return { ...next, ...collectedErrors };
      });
      return result;
    }
    setErrors(prev => {
      const hasSectionErrors = Object.keys(prev).some(key => key.includes('.'));
      if (!hasSectionErrors) {
        return prev;
      }
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        if (key.includes('.')) {
          delete next[key];
        }
      });
      return next;
    });
    setFeedback('');
    setFeedbackType(null);
    return result;
  };

  const handleNextStep = () => {
    const nextStepIndex = Math.min(currentStep + 1, STEP_FLOW.length - 1);

    if (isViewOnly) {
      setCurrentStep(nextStepIndex);
      return;
    }

    const validationTargetIndex = Math.max(currentStep, 0);
    const validationResult = ensureStepsComplete(validationTargetIndex);
    if (!validationResult.valid) {
      if (typeof validationResult.focusIndex === 'number') {
        setCurrentStep(validationResult.focusIndex);
      }
      return;
    }

    if (
      validationResult.credentialValues &&
      validationResult.credentialValues.email !== form.credentials.email
    ) {
      setForm(prev => ({
        ...prev,
        credentials: {
          ...prev.credentials,
          email: validationResult.credentialValues.email
        }
      }));
    }

    setCurrentStep(nextStepIndex);
  };

  const handlePreviousStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleStepSelect = (stepIndex) => {
    const clampedTarget = Math.min(Math.max(stepIndex, 0), STEP_FLOW.length - 1);

    if (clampedTarget === currentStep) {
      return;
    }

    if (isViewOnly) {
      setCurrentStep(clampedTarget);
      return;
    }

    const movingForward = clampedTarget > currentStep;
    if (movingForward) {
      const validationTargetIndex = clampedTarget - 1;
      const validationResult = ensureStepsComplete(validationTargetIndex);
      if (!validationResult.valid) {
        if (typeof validationResult.focusIndex === 'number') {
          setCurrentStep(validationResult.focusIndex);
        }
        return;
      }

      if (
        validationResult.credentialValues &&
        validationResult.credentialValues.email !== form.credentials.email
      ) {
        setForm(prev => ({
          ...prev,
          credentials: {
            ...prev.credentials,
            email: validationResult.credentialValues.email
          }
        }));
      }
    }

    setCurrentStep(clampedTarget);
  };

  const handleStepKeyDown = (event, stepIndex) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleStepSelect(stepIndex);
    }
  };

  const showTradeTypeSelect = form.employment.role === 'worker';

  const renderStepFields = () => {
    switch (currentStepConfig.key) {
      case 'personal':
        return (
          <div className="field-stack">
            <section className="field-section">
              <h3 className="field-section-title">ข้อมูลส่วนตัว</h3>
              <div className="field-grid two-columns">
                <div className="field">
                  <label>เลขบัตรประชาชน*</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={13}
                    value={form.personal.nationalId}
                    onChange={handleInputChange('personal', 'nationalId')}
                    placeholder="x-xxxx-xxxxx-xx-x"
                    className={errors[getErrorKey('personal', 'nationalId')] ? 'error' : ''}
                  />
                  {errors[getErrorKey('personal', 'nationalId')] && (
                    <span className="error-message">{errors[getErrorKey('personal', 'nationalId')]}</span>
                  )}
                </div>
                <div className="field">
                  <label>ชื่อ-นามสกุล*</label>
                  <input
                    type="text"
                    value={form.personal.fullName}
                    onChange={handleInputChange('personal', 'fullName')}
                    placeholder="ชื่อและนามสกุล"
                    className={errors[getErrorKey('personal', 'fullName')] ? 'error' : ''}
                  />
                  {errors[getErrorKey('personal', 'fullName')] && (
                    <span className="error-message">{errors[getErrorKey('personal', 'fullName')]}</span>
                  )}
                </div>
                <div className="field">
                  <label>วันเกิด*</label>
                  <ThaiDatePicker
                    value={form.personal.birthDate}
                    onChange={(isoDate) => updateField('personal', 'birthDate', isoDate)}
                    className={errors[getErrorKey('personal', 'birthDate')] ? 'error' : ''}
                  />
                  {errors[getErrorKey('personal', 'birthDate')] && (
                    <span className="error-message">{errors[getErrorKey('personal', 'birthDate')]}</span>
                  )}
                </div>
                <div className="field">
                  <label>อายุ (คำนวณอัตโนมัติ)</label>
                  <input type="text" value={age === '' ? '' : String(age)} readOnly placeholder="--" />
                </div>
              </div>
            </section>

            <section className="field-section">
              <h3 className="field-section-title">ข้อมูลตำแหน่งงาน</h3>
              <div className="field-grid two-columns">
                <div className="field">
                  <label>Role*</label>
                  <select
                    value={form.employment.role}
                    onChange={handleInputChange('employment', 'role')}
                    className={errors[getErrorKey('employment', 'role')] ? 'error' : ''}
                  >
                    <option value="">เลือก Role</option>
                    {roleOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {errors[getErrorKey('employment', 'role')] && (
                    <span className="error-message">{errors[getErrorKey('employment', 'role')]}</span>
                  )}
                </div>
                {showTradeTypeSelect && (
                  <div className="field">
                    <label>ประเภทช่าง*</label>
                    <select
                      value={form.employment.tradeType}
                      onChange={handleInputChange('employment', 'tradeType')}
                      className={errors[getErrorKey('employment', 'tradeType')] ? 'error' : ''}
                    >
                      <option value="">เลือกประเภทช่าง</option>
                      {tradeOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {errors[getErrorKey('employment', 'tradeType')] && (
                      <span className="error-message">{errors[getErrorKey('employment', 'tradeType')]}</span>
                    )}
                  </div>
                )}
                <div className="field">
                  <label>ประสบการณ์ (ปี)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.employment.experienceYears}
                    onChange={handleInputChange('employment', 'experienceYears')}
                    placeholder="เช่น 5"
                  />
                </div>
              </div>
            </section>

            <section className="field-section">
              <h3 className="field-section-title">ข้อมูลที่อยู่</h3>
              <div className="field-grid one-column">
                <div className="field">
                  <label>เบอร์โทรศัพท์*</label>
                  <input
                    type="text"
                    inputMode="tel"
                    maxLength={10}
                    value={form.address.phone}
                    onChange={handleInputChange('address', 'phone')}
                    placeholder="0xx-xxx-xxxx"
                    className={errors[getErrorKey('address', 'phone')] ? 'error' : ''}
                  />
                  {errors[getErrorKey('address', 'phone')] && (
                    <span className="error-message">{errors[getErrorKey('address', 'phone')]}</span>
                  )}
                </div>
                <div className="field">
                  <label>ที่อยู่ตามบัตรประชาชน*</label>
                  <textarea
                    data-field-id="addressOnId"
                    value={form.address.addressOnId}
                    onChange={handleInputChange('address', 'addressOnId')}
                    rows={3}
                    placeholder="บ้านเลขที่ หมู่ ซอย ถนน"
                    className={errors[getErrorKey('address', 'addressOnId')] ? 'error' : ''}
                  />
                  {errors[getErrorKey('address', 'addressOnId')] && (
                    <span className="error-message">{errors[getErrorKey('address', 'addressOnId')]}</span>
                  )}
                </div>
              </div>

              <div className="field-grid two-columns address-compact-grid">
                <div className="field suggestion-field">
                  <label>จังหวัด</label>
                  <input
                    type="text"
                    value={form.address.province}
                    onChange={handleInputChange('address', 'province')}
                    onFocus={() => handleAddressFieldFocus('province')}
                    onBlur={handleAddressFieldBlur}
                    placeholder="จังหวัด"
                    className={errors[getErrorKey('address', 'province')] ? 'error' : ''}
                    aria-autocomplete="list"
                    aria-expanded={Boolean(
                      addressLookupField === 'province' && (addressLookupLoading || addressSuggestions.length > 0)
                    )}
                  />
                  {errors[getErrorKey('address', 'province')] && (
                    <span className="error-message">{errors[getErrorKey('address', 'province')]}</span>
                  )}
                  {addressLookupField === 'province' && (
                    <div className="address-suggestion-panel" role="listbox" aria-label="ตัวเลือกจังหวัด">
                      {addressLookupLoading && (
                        <div className="address-suggestion-status">กำลังค้นหา...</div>
                      )}
                      {!addressLookupLoading && addressSuggestions.length === 0 ? (
                        <div className="address-suggestion-status">ไม่พบข้อมูลที่ตรงกัน</div>
                      ) : (
                        <ul>
                          {addressSuggestions.map((suggestion, index) => (
                            <li
                              key={`${suggestion.province}-${suggestion.district}-${suggestion.subdistrict}-${suggestion.zipcode}-${index}`}
                              className="address-suggestion-item"
                              role="option"
                              onMouseDown={event => {
                                event.preventDefault();
                                handleAddressSuggestionSelect(suggestion);
                              }}
                            >
                              <span className="address-suggestion-subdistrict">{suggestion.subdistrict}</span>
                              <span className="address-suggestion-district">{suggestion.district}</span>
                              <span className="address-suggestion-province">{suggestion.province}</span>
                              <span className="address-suggestion-zipcode">{suggestion.zipcode}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
                <div className="field suggestion-field">
                  <label>อำเภอ</label>
                  <input
                    type="text"
                    value={form.address.district}
                    onChange={handleInputChange('address', 'district')}
                    onFocus={() => handleAddressFieldFocus('district')}
                    onBlur={handleAddressFieldBlur}
                    placeholder="อำเภอ"
                    className={errors[getErrorKey('address', 'district')] ? 'error' : ''}
                    aria-autocomplete="list"
                    aria-expanded={Boolean(
                      addressLookupField === 'district' && (addressLookupLoading || addressSuggestions.length > 0)
                    )}
                  />
                  {errors[getErrorKey('address', 'district')] && (
                    <span className="error-message">{errors[getErrorKey('address', 'district')]}</span>
                  )}
                  {addressLookupField === 'district' && (
                    <div className="address-suggestion-panel" role="listbox" aria-label="ตัวเลือกอำเภอ">
                      {addressLookupLoading && (
                        <div className="address-suggestion-status">กำลังค้นหา...</div>
                      )}
                      {!addressLookupLoading && addressSuggestions.length === 0 ? (
                        <div className="address-suggestion-status">ไม่พบข้อมูลที่ตรงกัน</div>
                      ) : (
                        <ul>
                          {addressSuggestions.map((suggestion, index) => (
                            <li
                              key={`${suggestion.province}-${suggestion.district}-${suggestion.subdistrict}-${suggestion.zipcode}-${index}`}
                              className="address-suggestion-item"
                              role="option"
                              onMouseDown={event => {
                                event.preventDefault();
                                handleAddressSuggestionSelect(suggestion);
                              }}
                            >
                              <span className="address-suggestion-subdistrict">{suggestion.subdistrict}</span>
                              <span className="address-suggestion-district">{suggestion.district}</span>
                              <span className="address-suggestion-province">{suggestion.province}</span>
                              <span className="address-suggestion-zipcode">{suggestion.zipcode}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
                <div className="field suggestion-field">
                  <label>ตำบล</label>
                  <input
                    type="text"
                    value={form.address.subdistrict}
                    onChange={handleInputChange('address', 'subdistrict')}
                    onFocus={() => handleAddressFieldFocus('subdistrict')}
                    onBlur={handleAddressFieldBlur}
                    placeholder="ตำบล"
                    className={errors[getErrorKey('address', 'subdistrict')] ? 'error' : ''}
                    aria-autocomplete="list"
                    aria-expanded={Boolean(
                      addressLookupField === 'subdistrict' && (addressLookupLoading || addressSuggestions.length > 0)
                    )}
                  />
                  {errors[getErrorKey('address', 'subdistrict')] && (
                    <span className="error-message">{errors[getErrorKey('address', 'subdistrict')]}</span>
                  )}
                  {addressLookupField === 'subdistrict' && (
                    <div className="address-suggestion-panel" role="listbox" aria-label="ตัวเลือกตำบล">
                      {addressLookupLoading && (
                        <div className="address-suggestion-status">กำลังค้นหา...</div>
                      )}
                      {!addressLookupLoading && addressSuggestions.length === 0 ? (
                        <div className="address-suggestion-status">ไม่พบข้อมูลที่ตรงกัน</div>
                      ) : (
                        <ul>
                          {addressSuggestions.map((suggestion, index) => (
                            <li
                              key={`${suggestion.province}-${suggestion.district}-${suggestion.subdistrict}-${suggestion.zipcode}-${index}`}
                              className="address-suggestion-item"
                              role="option"
                              onMouseDown={event => {
                                event.preventDefault();
                                handleAddressSuggestionSelect(suggestion);
                              }}
                            >
                              <span className="address-suggestion-subdistrict">{suggestion.subdistrict}</span>
                              <span className="address-suggestion-district">{suggestion.district}</span>
                              <span className="address-suggestion-province">{suggestion.province}</span>
                              <span className="address-suggestion-zipcode">{suggestion.zipcode}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
                <div className="field">
                  <label>รหัสไปรษณีย์</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    value={form.address.postalCode}
                    onChange={handleInputChange('address', 'postalCode')}
                    placeholder="xxxxx"
                    className={errors[getErrorKey('address', 'postalCode')] ? 'error' : ''}
                  />
                  {errors[getErrorKey('address', 'postalCode')] && (
                    <span className="error-message">{errors[getErrorKey('address', 'postalCode')]}</span>
                  )}
                </div>
              </div>

              <div className="field-grid one-column">
                <div className="field">
                  <label>ที่อยู่ปัจจุบัน*</label>
                  <textarea
                    data-field-id="currentAddress"
                    value={form.address.currentAddress}
                    onChange={handleInputChange('address', 'currentAddress')}
                    rows={3}
                    placeholder="รายละเอียดที่อยู่ปัจจุบัน"
                    className={errors[getErrorKey('address', 'currentAddress')] ? 'error' : ''}
                  />
                  {errors[getErrorKey('address', 'currentAddress')] && (
                    <span className="error-message">{errors[getErrorKey('address', 'currentAddress')]}</span>
                  )}
                </div>
              </div>
            </section>

            <section className="field-section">
              <h3 className="field-section-title">ข้อมูลบัตรประชาชน</h3>
              <div className="field-grid two-columns">
                <div className="field">
                  <label>วันออกบัตร*</label>
                  <ThaiDatePicker
                    value={form.identity.issueDate}
                    onChange={(isoDate) => updateField('identity', 'issueDate', isoDate)}
                    className={errors[getErrorKey('identity', 'issueDate')] ? 'error' : ''}
                  />
                  {errors[getErrorKey('identity', 'issueDate')] && (
                    <span className="error-message">{errors[getErrorKey('identity', 'issueDate')]}</span>
                  )}
                </div>
                <div className="field">
                  <label>วันหมดอายุบัตร*</label>
                  <ThaiDatePicker
                    value={form.identity.expiryDate}
                    onChange={(isoDate) => updateField('identity', 'expiryDate', isoDate)}
                    className={errors[getErrorKey('identity', 'expiryDate')] ? 'error' : ''}
                  />
                  {errors[getErrorKey('identity', 'expiryDate')] && (
                    <span className="error-message">{errors[getErrorKey('identity', 'expiryDate')]}</span>
                  )}
                </div>
              </div>
            </section>
          </div>
        );
      case 'credentials':
        return (
          <div className="account-step">
            <section className="account-note">
              <h3>ขั้นตอนนี้ทำอะไร?</h3>
              <p>
                เราจะสร้างบัญชีเข้าสู่ระบบโดยใช้อีเมลและรหัสผ่านสำหรับพนักงาน ผู้ใช้งานสามารถเปลี่ยนรหัสผ่านได้ภายหลัง
                เพื่อความปลอดภัย กรุณากำหนดรหัสผ่านอย่างน้อย 8 ตัวอักษร และผสมตัวเลขหรืออักขระพิเศษ
              </p>
            </section>

            <div className="account-form">
              <div className="field-grid one-column credentials-grid">
                <div className="field">
                  <label>อีเมลสำหรับเข้าสู่ระบบ</label>
                  <input
                    data-field-id="accountEmail"
                    type="email"
                    value={form.credentials.email}
                    onChange={handleInputChange('credentials', 'email')}
                    placeholder="example@mail.com"
                    className={errors.email ? 'error' : ''}
                  />
                  {errors.email && <span className="error-message">{errors.email}</span>}
                  <span className="help-text">หากไม่มีอีเมลบริษัท ให้สร้างอีเมลชั่วคราวสำหรับเข้าระบบ</span>
                </div>
                <div className="field">
                  <label>รหัสผ่าน</label>
                  <div className="password-input has-generator">
                    <input
                      type="text"
                      value={form.credentials.password}
                      onChange={handleInputChange('credentials', 'password')}
                      placeholder="********"
                      className={errors.password ? 'error' : ''}
                    />
                    <button
                      type="button"
                      className="generate-password-btn"
                      onClick={handleGeneratePassword}
                      aria-label="สุ่มรหัสผ่าน"
                    >
                      สุ่ม
                    </button>
                  </div>
                  {errors.password && <span className="error-message">{errors.password}</span>}
                  <span className="help-text">รหัสผ่านอย่างน้อย 8 ตัวอักษร แนะนำให้ผสมตัวเลขและอักขระพิเศษ</span>
                </div>
              </div>
            </div>
          </div>
        );
      case 'review':
        return (
          <div className="review-step">
            <section className="review-intro">
              <h3>ตรวจสอบข้อมูลก่อนยืนยัน</h3>
              <p>ตรวจสอบรายละเอียดทุกส่วนให้ถูกต้อง หากข้อมูลใดไม่ถูกต้องสามารถกดปุ่มแก้ไขเพื่อกลับไปแก้ในขั้นตอนก่อนหน้า</p>
            </section>

            <div className="review-grid">
              <div className="review-unified-card">
                <div className="review-unified-header">
                  <div className="review-unified-heading">
                    <h4>ข้อมูลการสมัครทั้งหมด</h4>
                    <p>ทบทวนรายละเอียดก่อนยืนยัน ระบบสามารถย้อนกลับไปแก้ไขได้ทุกขั้นตอน</p>
                  </div>
                  {!isViewOnly && (
                    <button
                      type="button"
                      className="review-unified-edit"
                      onClick={() => handleStepSelect(0)}
                    >
                      แก้ไข
                    </button>
                  )}
                </div>
                <div className="review-unified-sections">
                  {reviewSections.map(section => (
                    <div key={section.key} className="review-section">
                      <h5 className="review-section-title">{section.title}</h5>
                      <dl className="review-list">
                        {section.items.map(item => (
                          <div key={`${section.key}-${item.label}`} className="review-list-row">
                            <dt>{item.label}</dt>
                            <dd>{item.value || 'ไม่ระบุ'}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="registration-page">
      <div className="registration-wrapper">
        <div className="registration-nav">
          <button type="button" onClick={handleBack}>กลับหน้าแดชบอร์ด</button>
        </div>
        <header className="registration-header">
          <h1>แบบฟอร์มลงทะเบียนพนักงาน</h1>
          <p>เก็บข้อมูลสำคัญสำหรับ HR, การจัดทีม และความปลอดภัยในการทำงาน</p>
        </header>

        {feedback && (
          <div
            className={`registration-feedback${feedbackType ? ` ${feedbackType}` : ''}`}
            role="status"
          >
            {feedback}
          </div>
        )}

        <div className="registration-content">
          <form onSubmit={handleSubmit}>
            <section className="registration-section">
              <div className="section-header">
                <h2>{currentStepConfig.title}</h2>
                <p>{currentStepConfig.description}</p>
              </div>
              {renderStepFields()}
            </section>

            <div className="registration-actions">
              <div className="wizard-nav-buttons">
                {!isFirstStep && (
                  <button type="button" className="secondary" onClick={handlePreviousStep}>
                    ย้อนกลับ
                  </button>
                )}
                {!isLastStep && (
                  <button type="button" className="primary" onClick={handleNextStep}>
                    ไปหน้าถัดไป
                  </button>
                )}
                {isLastStep && !isViewOnly && (
                  <button type="submit" className="primary" disabled={submitting}>
                    {submitting
                      ? 'กำลังบันทึก...'
                      : (isEditing ? 'อัปเดตข้อมูล' : 'บันทึกข้อมูลเบื้องต้น')}
                  </button>
                )}
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  isViewOnly
                    ? navigate('/admin', { state: { initialTab: 'users' } })
                    : resetForm()
                }
                disabled={submitting}
              >
                {isViewOnly ? 'ย้อนกลับ' : 'ล้างฟอร์ม'}
              </button>
            </div>
          </form>

          <aside className="registration-progress-card">
            <div className="progress-card-header">
              <h3>ความคืบหน้าการสมัคร</h3>
              <span>{progressPercent}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <ul className="progress-step-list">
              {progressSections.map((section, index) => {
                const stepClassNames = [
                  'progress-step',
                  section.completed ? 'completed' : '',
                  !section.completed && section.progress > 0 ? 'in-progress' : '',
                  section.isActive ? 'active' : ''
                ]
                  .filter(Boolean)
                  .join(' ');
                let statusLabel;
                if (section.key === 'review') {
                  if (section.completed) {
                    statusLabel = 'พร้อมยืนยัน';
                  } else if (section.isActive) {
                    statusLabel = 'กำลังตรวจสอบ';
                  } else {
                    statusLabel = 'รอตรวจสอบ';
                  }
                } else {
                  statusLabel = section.completed
                    ? 'ครบถ้วน'
                    : section.isActive
                      ? 'กำลังกรอก'
                      : `${section.percent}%`;
                }
                return (
                  <li
                    key={`${section.label}-${index}`}
                    className={stepClassNames}
                    role="button"
                    tabIndex={0}
                    aria-current={section.isActive ? 'step' : undefined}
                    onClick={() => handleStepSelect(index)}
                    onKeyDown={(event) => handleStepKeyDown(event, index)}
                  >
                    <span className="step-dot" aria-hidden="true" />
                    <div className="step-content">
                      <span className="step-label">{section.label}</span>
                      <span className="step-status">{statusLabel}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default AdminWorkerRegistration;

import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiRequest } from '../utils/api';
import './WKWorkerProfile.css';

const emptyProfile = {
  personal: {
    nationalId: '',
    fullName: '',
    birthDate: '',
    age: ''
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
    role: 'worker',
    tradeType: 'structure',
    experienceYears: ''
  },
  credentials: {
    email: '',
    password: '',
    confirmPassword: ''
  }
};

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
  { value: 'worker', label: 'ช่างภาคสนาม' },
  { value: 'foreman', label: 'หัวหน้าช่าง (FM)' },
  { value: 'project_manager', label: 'ผู้จัดการโครงการ (PM)' }
];

function normalizeProfile(payload) {
  if (!payload || typeof payload !== 'object') {
    return JSON.parse(JSON.stringify(emptyProfile));
  }
  const normalized = JSON.parse(JSON.stringify(emptyProfile));
  for (const section of Object.keys(normalized)) {
    normalized[section] = { ...normalized[section], ...(payload[section] || {}) };
  }
  if (!normalized.employment.role) normalized.employment.role = 'worker';
  if (!normalized.employment.tradeType) normalized.employment.tradeType = 'structure';
  return normalized;
}

const formatNationalId = value => {
  const digits = (value || '').replace(/[^0-9]/g, '').slice(0, 13);
  const segmentSizes = [1, 4, 5, 2, 1];
  const parts = [];
  let cursor = 0;

  for (const size of segmentSizes) {
    if (cursor >= digits.length) break;
    const nextCursor = Math.min(cursor + size, digits.length);
    parts.push(digits.slice(cursor, nextCursor));
    cursor = nextCursor;
  }

  const formatted = parts.join('-');
  return { formatted, raw: digits };
};

const WorkerProfile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(normalizeProfile());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [workerMeta, setWorkerMeta] = useState({ id: null, name: '', role: '', status: '', category: '', startDate: '' });
  const [revealPassword, setRevealPassword] = useState(false);
  const [revealConfirm, setRevealConfirm] = useState(false);

  const stateUser = location.state?.user;

  const workerId = useMemo(() => {
    if (stateUser?.id) return stateUser.id;
    try {
      const cached = window.sessionStorage?.getItem('user_id') || window.localStorage?.getItem('user_id');
      if (!cached) return null;
      const numeric = Number.parseInt(cached, 10);
      return Number.isNaN(numeric) ? cached : numeric;
    } catch {
      return null;
    }
  }, [stateUser?.id]);

  useEffect(() => {
    const storedRole = (() => {
      try {
        return window.sessionStorage?.getItem('role') || window.localStorage?.getItem('role') || '';
      } catch {
        return '';
      }
    })();
    if (storedRole && storedRole !== 'worker') {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (!workerId) {
      setError('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    setError('');

    apiRequest(`/api/admin/workers/${workerId}`)
      .then(data => {
        if (!alive) return;
        const normalized = normalizeProfile(data?.fullData);
        setProfile(normalized);
        setWorkerMeta({
          id: data?.id ?? workerId,
          name: data?.name || normalized.personal.fullName || '',
          role: data?.role || 'ช่าง',
          status: data?.status || 'active',
          category: data?.category || '',
          startDate: data?.startDate || ''
        });
        try {
          window.sessionStorage?.setItem('worker_profile', 'true');
        } catch {}
      })
      .catch(err => {
        if (!alive) return;
        console.error(err);
        setError('ไม่สามารถดึงข้อมูลโปรไฟล์ได้');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [workerId]);

  const updateSection = (section, field, value) => {
    setProfile(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const nationalIdDisplay = useMemo(
    () => formatNationalId(profile.personal.nationalId).formatted,
    [profile.personal.nationalId]
  );

  const handleNationalIdChange = event => {
    const { raw } = formatNationalId(event.target.value);
    updateSection('personal', 'nationalId', raw);
  };

  const handleSubmit = async event => {
    event.preventDefault();
    if (!workerId) {
      setError('ไม่พบข้อมูลผู้ใช้');
      return;
    }

    const payload = JSON.parse(JSON.stringify(profile));

    if (payload.credentials.password && payload.credentials.password !== payload.credentials.confirmPassword) {
      setError('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    if (!/^\d{13}$/.test(payload.personal.nationalId || '')) {
      setError('กรุณากรอกเลขบัตรประชาชนให้ครบ 13 หลัก');
      return;
    }

    if (!/^0\d{9}$/.test(payload.address.phone || '')) {
      setError('กรุณากรอกเบอร์โทรศัพท์ 10 หลักขึ้นต้นด้วย 0');
      return;
    }

    if (!payload.credentials.email) {
      setError('กรุณากรอกอีเมล');
      return;
    }

    if (!payload.personal.fullName) {
      setError('กรุณากรอกชื่อ-นามสกุล');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    const requestBody = {
      ...payload,
      credentials: {
        email: payload.credentials.email,
        password: payload.credentials.password ? payload.credentials.password : undefined
      }
    };

    try {
      const updated = await apiRequest(`/api/admin/workers/${workerId}`, {
        method: 'PUT',
        body: requestBody
      });
      const normalized = normalizeProfile(updated?.fullData);
      setProfile(normalized);
      setWorkerMeta(meta => ({
        ...meta,
        name: updated?.name || normalized.personal.fullName || meta.name,
        category: updated?.category || meta.category,
        role: updated?.role || meta.role
      }));
      setSuccess('บันทึกข้อมูลเรียบร้อยแล้ว');
    } catch (err) {
      console.error(err);
      setError(err?.data?.message === 'duplicate_email' ? 'อีเมลนี้ถูกใช้งานแล้ว' : 'ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="wk-profile-page">
        <div className="wk-card wk-card--center">กำลังโหลดข้อมูล...</div>
      </div>
    );
  }

  if (error && !profile.personal.fullName) {
    return (
      <div className="wk-profile-page">
        <div className="wk-card wk-card--center wk-card--error">{error}</div>
      </div>
    );
  }

  return (
    <div className="wk-profile-page">
      <header className="wk-profile-hero">
        <div className="wk-avatar" aria-hidden="true">{(workerMeta.name || 'W').slice(0, 1).toUpperCase()}</div>
        <div>
          <h1>{workerMeta.name || 'โปรไฟล์ช่าง'}</h1>
          <p>{workerMeta.role}{workerMeta.category ? ` • ${workerMeta.category}` : ''}</p>
          {workerMeta.startDate && <span className="wk-badge">เริ่มงาน {workerMeta.startDate}</span>}
        </div>
      </header>

      <div className="wk-layout">
        <section className="wk-column">
          <div className="wk-card">
            <div className="wk-card__title">ข้อมูลส่วนตัว</div>
            <div className="wk-grid">
              <label className="wk-field">
                <span>เลขบัตรประชาชน</span>
                <input
                  type="text"
                  value={nationalIdDisplay}
                  onChange={handleNationalIdChange}
                  maxLength={17}
                  placeholder="0-0000-00000-00-0"
                  readOnly
                />
              </label>
              <label className="wk-field">
                <span>ชื่อ-นามสกุล</span>
                <input
                  type="text"
                  value={profile.personal.fullName}
                  onChange={e => updateSection('personal', 'fullName', e.target.value)}
                  placeholder="ชื่อ-นามสกุล"
                  readOnly
                />
              </label>
              <label className="wk-field">
                <span>วันเกิด</span>
                <input
                  type="date"
                  value={profile.personal.birthDate || ''}
                  onChange={e => updateSection('personal', 'birthDate', e.target.value)}
                  disabled
                />
              </label>
              <label className="wk-field">
                <span>อายุ (ปี)</span>
                <input
                  type="number"
                  min="0"
                  value={profile.personal.age || ''}
                  onChange={e => updateSection('personal', 'age', e.target.value)}
                  placeholder="อายุ"
                  readOnly
                />
              </label>
            </div>
          </div>

          <div className="wk-card">
            <div className="wk-card__title">ข้อมูลติดต่อ</div>
            <div className="wk-grid">
              <label className="wk-field">
                <span>เบอร์โทรศัพท์</span>
                <input
                  type="tel"
                  value={profile.address.phone}
                  onChange={e => updateSection('address', 'phone', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                  placeholder="0XXXXXXXXX"
                  maxLength={10}
                  readOnly
                />
              </label>
              <label className="wk-field">
                <span>อีเมล</span>
                <input
                  type="email"
                  value={profile.credentials.email}
                  onChange={e => updateSection('credentials', 'email', e.target.value)}
                  placeholder="name@example.com"
                  readOnly
                />
              </label>
              <label className="wk-field wk-field--wide">
                <span>ที่อยู่ตามบัตรประชาชน</span>
                <textarea
                  value={profile.address.addressOnId}
                  onChange={e => updateSection('address', 'addressOnId', e.target.value)}
                  placeholder="เลขที่ หมู่บ้าน ถนน"
                  rows={2}
                  readOnly
                />
              </label>
              <label className="wk-field">
                <span>จังหวัด</span>
                <input
                  type="text"
                  value={profile.address.province}
                  onChange={e => updateSection('address', 'province', e.target.value)}
                  readOnly
                />
              </label>
              <label className="wk-field">
                <span>อำเภอ/เขต</span>
                <input
                  type="text"
                  value={profile.address.district}
                  onChange={e => updateSection('address', 'district', e.target.value)}
                  readOnly
                />
              </label>
              <label className="wk-field">
                <span>ตำบล/แขวง</span>
                <input
                  type="text"
                  value={profile.address.subdistrict}
                  onChange={e => updateSection('address', 'subdistrict', e.target.value)}
                  readOnly
                />
              </label>
              <label className="wk-field">
                <span>รหัสไปรษณีย์</span>
                <input
                  type="text"
                  value={profile.address.postalCode}
                  onChange={e => updateSection('address', 'postalCode', e.target.value.replace(/[^0-9]/g, '').slice(0, 5))}
                  maxLength={5}
                  readOnly
                />
              </label>
              <label className="wk-field wk-field--wide">
                <span>ที่อยู่อาศัยปัจจุบัน</span>
                <textarea
                  value={profile.address.currentAddress}
                  onChange={e => updateSection('address', 'currentAddress', e.target.value)}
                  placeholder="ที่อยู่อาศัยปัจจุบัน"
                  rows={2}
                  readOnly
                />
              </label>
            </div>
          </div>
        </section>

        <section className="wk-column">
          <div className="wk-card">
            <div className="wk-card__title">ข้อมูลงานและประสบการณ์</div>
            <div className="wk-grid">
              <label className="wk-field">
                <span>ตำแหน่ง</span>
                <select
                  value={profile.employment.role}
                  onChange={e => updateSection('employment', 'role', e.target.value)}
                  disabled
                >
                  {roleOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="wk-field">
                <span>ประเภทงาน</span>
                <select
                  value={profile.employment.tradeType}
                  onChange={e => updateSection('employment', 'tradeType', e.target.value)}
                  disabled
                >
                  {tradeOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="wk-field">
                <span>ประสบการณ์ (ปี)</span>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={profile.employment.experienceYears || ''}
                  onChange={e => updateSection('employment', 'experienceYears', e.target.value)}
                  placeholder="จำนวนปีประสบการณ์"
                  readOnly
                />
              </label>
              <label className="wk-field">
                <span>สถานะ</span>
                <input type="text" value={workerMeta.status} readOnly />
              </label>
            </div>
          </div>

          <div className="wk-card">
            <div className="wk-card__title">เอกสารยืนยันตัวตน</div>
            <div className="wk-grid">
              <label className="wk-field">
                <span>วันออกบัตร</span>
                <input
                  type="date"
                  value={profile.identity.issueDate || ''}
                  onChange={e => updateSection('identity', 'issueDate', e.target.value)}
                  disabled
                />
              </label>
              <label className="wk-field">
                <span>วันหมดอายุบัตร</span>
                <input
                  type="date"
                  value={profile.identity.expiryDate || ''}
                  onChange={e => updateSection('identity', 'expiryDate', e.target.value)}
                  disabled
                />
              </label>
            </div>
          </div>

          <div className="wk-card">
            <div className="wk-card__title">การตั้งค่าบัญชี</div>
            <div className="wk-grid">
              <label className="wk-field">
                <span>รหัสผ่านใหม่</span>
                <div className="wk-password-field">
                  <input
                    type={revealPassword ? 'text' : 'password'}
                    value={profile.credentials.password}
                    onChange={e => updateSection('credentials', 'password', e.target.value)}
                    placeholder="ปล่อยว่างหากไม่ต้องการเปลี่ยน"
                  />
                  <button
                    type="button"
                    className="wk-password-toggle"
                    aria-label={revealPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    onClick={() => setRevealPassword(show => !show)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      {revealPassword ? (
                        <>
                          <path d="M13.12 2.88 2.88 13.12" />
                          <path d="M3.28 5.54C1.91 6.69 1 8 1 8s2.73 4.5 7 4.5a6.66 6.66 0 0 0 2.33-.4" />
                          <path d="M12.69 9.34c.83-.82 1.31-1.34 1.31-1.34S11.27 3.5 7 3.5a6.46 6.46 0 0 0-1.74.24" />
                          <path d="M6.53 6.53A1.5 1.5 0 0 0 9 9" />
                        </>
                      ) : (
                        <>
                          <path d="M1 8s2.73-4.5 7-4.5S15 8 15 8s-2.73 4.5-7 4.5S1 8 1 8Z" />
                          <circle cx="8" cy="8" r="2.5" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
              </label>
              <label className="wk-field">
                <span>ยืนยันรหัสผ่าน</span>
                <div className="wk-password-field">
                  <input
                    type={revealConfirm ? 'text' : 'password'}
                    value={profile.credentials.confirmPassword}
                    onChange={e => updateSection('credentials', 'confirmPassword', e.target.value)}
                  />
                  <button
                    type="button"
                    className="wk-password-toggle"
                    aria-label={revealConfirm ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    onClick={() => setRevealConfirm(show => !show)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      {revealConfirm ? (
                        <>
                          <path d="M13.12 2.88 2.88 13.12" />
                          <path d="M3.28 5.54C1.91 6.69 1 8 1 8s2.73 4.5 7 4.5a6.66 6.66 0 0 0 2.33-.4" />
                          <path d="M12.69 9.34c.83-.82 1.31-1.34 1.31-1.34S11.27 3.5 7 3.5a6.46 6.46 0 0 0-1.74.24" />
                          <path d="M6.53 6.53A1.5 1.5 0 0 0 9 9" />
                        </>
                      ) : (
                        <>
                          <path d="M1 8s2.73-4.5 7-4.5S15 8 15 8s-2.73 4.5-7 4.5S1 8 1 8Z" />
                          <circle cx="8" cy="8" r="2.5" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
              </label>
            </div>
          </div>

          <form className="wk-actions" onSubmit={handleSubmit}>
            {error && <div className="wk-alert wk-alert--error">{error}</div>}
            {success && <div className="wk-alert wk-alert--success">{success}</div>}
            <div className="wk-actions__buttons">
              <button type="button" className="wk-btn wk-btn--ghost" onClick={() => navigate('/dashboard')}>ย้อนกลับ</button>
              <button type="submit" className="wk-btn" disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}</button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default WorkerProfile;

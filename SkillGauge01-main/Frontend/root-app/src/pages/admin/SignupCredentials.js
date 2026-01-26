import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Signup.css';
import './AdminSignupCredentials.css';

const AdminSignupCredentials = () => {
  const navigate = useNavigate();
  const [profileDraft, setProfileDraft] = useState(null);
  const [form, setForm] = useState({
    email: '',
    password: '',
  });
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categoryLabel = useMemo(() => {
    if (!profileDraft?.category) return 'ไม่ระบุ';
    const map = {
      structure: 'ช่างโครงสร้าง',
      plumbing: 'ช่างประปา',
      roofing: 'ช่างหลังคา',
      masonry: 'ช่างก่ออิฐฉาบปูน',
      aluminum: 'ช่างประตูหน้าต่างอลูมิเนียม',
      ceiling: 'ช่างฝ้าเพดาล',
      electric: 'ช่างไฟฟ้า',
      tiling: 'ช่างกระเบื้อง'
    };
    return map[profileDraft.category] || profileDraft.category;
  }, [profileDraft]);

  const summary = useMemo(() => {
    if (!profileDraft) return null;
    const fullName = `${profileDraft.name || ''} ${profileDraft.surname || ''}`.trim();
    const roleMap = {
      admin: 'ผู้ดูแลระบบ (Adm)',
      pm: 'ผู้จัดการโครงการ (PM)',
      fm: 'ผู้จัดการภาคสนาม (FM)'
    };
    return {
      role: roleMap[profileDraft.role] || profileDraft.role || 'ไม่ระบุ',
      fullName: fullName || 'ไม่ระบุ',
      phone: profileDraft.phoneNumber || 'ไม่ระบุ',
      province: profileDraft.province || 'ไม่ระบุ',
      category: categoryLabel,
    };
  }, [profileDraft, categoryLabel]);

  useEffect(() => {
    const draft = sessionStorage.getItem('signup_profile');
    if (!draft) {
      navigate('/admin/signup');
      return;
    }
    try {
      const parsed = JSON.parse(draft);
      setProfileDraft(parsed);
      const makeDefaultEmail = (name) => {
        const base = String(name || '').trim().replace(/\s+/g, '');
        return base ? `${base}@gmail.com`.toLowerCase() : '';
      };
      setForm(prev => ({ ...prev, email: parsed.email || makeDefaultEmail(parsed.name) }));
    } catch {
      navigate('/admin/signup');
    }
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) {
      newErrors.email = 'รูปแบบอีเมลไม่ถูกต้อง';
    }

    if (!form.password) newErrors.password = 'กรุณากรอกรหัสผ่าน';
    else if (form.password.length < 8) newErrors.password = 'รหัสผ่านอย่างน้อย 8 ตัวอักษร';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    if (!profileDraft) return;
    if (!profileDraft.phoneNumber) {
      setErrors({ email: 'ไม่พบเบอร์โทรจากขั้นตอนก่อนหน้า' });
      return;
    }

    setIsSubmitting(true);
    try {
      const fullName = `${profileDraft.skill || ''}${profileDraft.name || ''} ${profileDraft.surname || ''}`.trim();
      const phone = profileDraft.phoneNumber;

      const res = await fetch('http://localhost:4000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          phone,
          email: form.email || '',
          password: form.password,
        }),
      });

      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        setErrors({ email: data.message || 'ข้อมูลนี้ถูกใช้งานแล้ว' });
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrors({ email: data.message || 'สมัครสมาชิกไม่สำเร็จ' });
        return;
      }

      await res.json().catch(() => ({}));

      const finalProfile = {
        ...profileDraft,
        email: form.email || '',
      };
      sessionStorage.setItem('worker_profile', JSON.stringify(finalProfile));
      sessionStorage.removeItem('signup_profile');

      try {
        sessionStorage.setItem('login_prefill_username', phone);
        sessionStorage.setItem('login_message', 'สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ');
        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('role');
        sessionStorage.removeItem('user_id');
      } catch {}

      navigate('/login');
    } catch {
      setErrors({ email: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="profile-page admin-cred-page">
      <div className="profile-container admin-cred-container">
        <header className="admin-cred-header">
          <h2>สร้างบัญชีเข้าสู่ระบบ</h2>
          <p>ตั้งค่าบัญชีผู้ใช้งานสำหรับพนักงาน เพื่อให้เข้าถึงระบบ Skill Gauge ได้อย่างปลอดภัย</p>
        </header>

        {summary && (
          <section className="admin-cred-summary">
            <div className="admin-cred-summary__title">ตรวจสอบข้อมูลจากขั้นตอนก่อนหน้า</div>
            <div className="admin-cred-summary__grid">
              <div>
                <span className="admin-cred-summary__label">ตำแหน่ง</span>
                <span className="admin-cred-summary__value" style={{ color: '#2b6cb0', fontWeight: 'bold' }}>{summary.role}</span>
              </div>
              <div>
                <span className="admin-cred-summary__label">ชื่อ-นามสกุล</span>
                <span className="admin-cred-summary__value">{summary.fullName}</span>
              </div>
              <div>
                <span className="admin-cred-summary__label">เบอร์โทรศัพท์</span>
                <span className="admin-cred-summary__value">{summary.phone}</span>
              </div>
              <div>
                <span className="admin-cred-summary__label">หมวดหมู่ช่าง</span>
                <span className="admin-cred-summary__value">{summary.category}</span>
              </div>
              <div>
                <span className="admin-cred-summary__label">จังหวัดหลักที่ทำงาน</span>
                <span className="admin-cred-summary__value">{summary.province}</span>
              </div>
            </div>
            <Link to="/admin/signup" className="admin-cred-edit-link">กลับไปแก้ไขข้อมูลส่วนตัว</Link>
          </section>
        )}

        <section className="admin-cred-note">
          <h3>ขั้นตอนนี้ทำอะไร?</h3>
          <p>
            เราจะสร้างบัญชีเข้าสู่ระบบโดยใช้อีเมลและรหัสผ่านสำหรับพนักงาน ผู้ใช้งานสามารถเปลี่ยนรหัสผ่านได้ภายหลัง
            เพื่อความปลอดภัย กรุณากำหนดรหัสผ่านอย่างน้อย 8 ตัวอักษร และผสมตัวเลขหรืออักษรพิเศษ
          </p>
        </section>

        <form onSubmit={handleSubmit} className="admin-cred-form">
          <div className="form-group admin-cred-field">
            <label>อีเมลสำหรับเข้าสู่ระบบ</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="example@mail.com"
              className={errors.email ? 'error' : ''}
            />
            {errors.email && <span className="error-message">{errors.email}</span>}
            <span className="admin-cred-hint">หากพนักงานไม่มีอีเมล ให้กำหนดอีเมล Workplace ชั่วคราวหรือของบริษัท</span>
          </div>
          <div className="form-group admin-cred-field">
            <label>รหัสผ่าน</label>
            <div className="password-input-wrapper">
              <input
                type={showPass ? 'text' : 'password'}
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="********"
                className={errors.password ? 'error' : ''}
              />
              <button type="button" className="eye-toggle" onClick={() => setShowPass(s => !s)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-eye-fill" viewBox="0 0 16 16">
                  <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0"/>
                  <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8m8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7"/>
                </svg>
              </button>
            </div>
            {errors.password && <span className="error-message">{errors.password}</span>}
            <span className="admin-cred-hint">อย่างน้อย 8 ตัวอักษร แนะนำให้ผสมตัวเลขและอักขระพิเศษ</span>
          </div>

          {errors.submit && <div className="error-message submit-error">{errors.submit}</div>}

          <div className="admin-cred-actions">
            <button type="submit" className="submit-btn" disabled={isSubmitting}>
              {isSubmitting ? 'กำลังสร้างบัญชี...' : 'ยืนยันและสร้างบัญชี'}
            </button>
            <Link to="/admin/signup" className="admin-cred-secondary-link">ย้อนกลับไปแก้ไขข้อมูล</Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminSignupCredentials;

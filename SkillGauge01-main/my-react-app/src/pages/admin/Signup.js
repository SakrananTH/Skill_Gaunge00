import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminSignup.css';

const AdminSignup = () => {
  const navigate = useNavigate();

  const formatThaiId = (v) => {
    const d = (v || '').replace(/\D/g, '').slice(0, 13);
    const parts = [];
    if (d.length > 0) parts.push(d.slice(0, 1));
    if (d.length > 1) parts.push(d.slice(1, 5));
    if (d.length > 5) parts.push(d.slice(5, 10));
    if (d.length > 10) parts.push(d.slice(10, 12));
    if (d.length > 12) parts.push(d.slice(12, 13));
    return parts.join('-');
  };

  const formatPhone = (v) => {
    const d = (v || '').replace(/\D/g, '').slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  };

  const [formData, setFormData] = useState({
    role: '',
    skill: '',
    fullName: '',
    idCard: '',
    phoneNumber: '',
    address: '',
    addressDetails: '',
    birthDate: '',
    province: '',
    category: '',
    PostalCode: '',
    district: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    let next = value;
    if (name === 'idCard') next = formatThaiId(value);
    if (name === 'phoneNumber') next = formatPhone(value);
    setFormData(prev => ({
      ...prev,
      [name]: next
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const hiddenDateRef = useRef(null);

  const formatThaiDateDisplay = (isoDate) => {
    if (!isoDate) return '';
    // isoDate expected YYYY-MM-DD
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    const [y, m, d] = parts;
    const buddhistYearFull = Number(y) + 543; // e.g. 2025 -> 2568
    const buddhistYearTwo = String(buddhistYearFull).slice(-2); // last two digits
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${buddhistYearTwo}`;
  };

  const openDatePicker = () => {
    const el = hiddenDateRef.current;
    if (!el) return;
    // Prefer the showPicker API if available
    if (typeof el.showPicker === 'function') {
      el.showPicker();
    } else {
      el.focus();
      // some browsers will open the native picker on focus
    }
  };

  const onHiddenDateChange = (e) => {
    const iso = e.target.value; // YYYY-MM-DD
    setFormData(prev => ({ ...prev, birthDate: iso }));
    if (errors.birthDate) setErrors(prev => ({ ...prev, birthDate: '' }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.role) newErrors.role = 'กรุณาเลือกตำแหน่ง';
    if (!formData.skill) newErrors.skill = 'กรุณาเลือกคำนำหน้า';
    if (!formData.fullName.trim()) newErrors.fullName = 'กรุณากรอกชื่อ-นามสกุล';
    
    if (!formData.idCard.trim()) newErrors.idCard = 'กรุณากรอกเลขบัตรประชาชน';
    else if (!/^\d{13}$/.test(formData.idCard.replace(/\D/g, ''))) {
      newErrors.idCard = 'เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก';
    }
    
    const phoneDigits = (formData.phoneNumber || '').replace(/\D/g, '');
    if (!phoneDigits) newErrors.phoneNumber = 'กรุณากรอกเบอร์โทรศัพท์';
    else if (!(phoneDigits.length === 9 || phoneDigits.length === 10)) {
      newErrors.phoneNumber = 'กรุณากรอกเบอร์ 9-10 หลัก';
    }
    
    if (!formData.birthDate) {
      newErrors.birthDate = 'กรุณาระบุวันเกิด';
    }
    
    if (!formData.address.trim()) newErrors.address = 'กรุณากรอกที่อยู่';
    if (!formData.district.trim()) newErrors.district = 'กรุณากรอกอำเภอ/เขต';
    if (!formData.addressDetails.trim()) newErrors.addressDetails = 'กรุณากรอกตำบล/แขวง';
    if (!formData.province.trim()) newErrors.province = 'กรุณากรอกจังหวัด';
    if (!formData.category) newErrors.category = 'กรุณาเลือกหมวดหมู่';
    if (!formData.PostalCode || !formData.PostalCode.trim()) newErrors.PostalCode = 'กรุณากรอกรหัสไปรษณีย์';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const onRegister = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      const sanitizedPhone = formData.phoneNumber.replace(/\D/g, '');

      // Split fullName into name and surname
      const nameParts = formData.fullName.trim().split(/\s+/);
      const name = nameParts[0] || '';
      const surname = nameParts.slice(1).join(' ') || '';

      const profileDraft = {
        role: formData.role,
        skill: formData.skill,
        name: name,
        surname: surname,
        idCard: formData.idCard,
        phoneNumber: sanitizedPhone,
        address: formData.address,
        addressDetails: formData.addressDetails,
        province: formData.province,
        district: formData.district,
        category: formData.category,
        birthDate: formData.birthDate,
        PostalCode: formData.PostalCode || ''
      };
      sessionStorage.setItem('signup_profile', JSON.stringify(profileDraft));

      navigate('/admin/signup/credentials');
    } finally {
      setSubmitting(false);
    }
  };

  const goToDashboard = () => navigate('/admin');
  const goToWorkerRegistration = () => navigate('/admin/worker-registration');

  return (
    <div className="admin-signup-page">
      <div className="admin-signup-container">
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <button 
            type="button" 
            onClick={goToDashboard}
            style={{ background: 'none', border: 'none', color: '#718096', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            ← กลับหน้าแดชบอร์ด
          </button>
          <button 
            type="button" 
            onClick={goToWorkerRegistration}
            style={{ background: 'none', border: 'none', color: '#4299e1', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600' }}
          >
            ไปหน้าลงทะเบียนพนักงาน →
          </button>
        </div>

        <div className="admin-signup-header">
          <h2>ลงทะเบียนบุคลากร (Staff Registration)</h2>
          <p>กรุณากรอกข้อมูลส่วนตัวให้ครบถ้วน</p>
        </div>

        <form onSubmit={onRegister} className="admin-signup-form">
          
          {/* Row 1: Role, Prefix, Full Name */}
          <div className="col-span-12 role-category-row">
            <div className="form-field role-field">
              <label>ตำแหน่ง (Role)</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className={errors.role ? 'error' : ''}
              >
                <option value="">เลือกตำแหน่ง</option>
                <option value="pm">ผู้จัดการโครงการ (PM)</option>
                <option value="fm">หัวหน้าช่าง (FM)</option>
                <option value="worker">ช่าง (WK)</option>
              </select>
              {errors.role && <span className="error-message">{errors.role}</span>}
            </div>
            <div className="form-field category-field">
              <label>หมวดหมู่ความเชี่ยวชาญ</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className={errors.category ? 'error' : ''}
              >
                <option value="">เลือกหมวดหมู่</option>
                <option value="structure">1.โครงสร้าง</option>
                <option value="plumbing">2.ประปา</option>
                <option value="roofing">3.หลังคา</option>
                <option value="masonry">4.ก่ออิฐฉาบปูน</option>
                <option value="aluminum">5.ประตูหน้าต่างอลูมิเนียม</option>
                <option value="ceiling">6.ฝ้าเพดาล</option>
                <option value="electric">7.ไฟฟ้า</option>
                <option value="tiling">8.กระเบื้อง</option>
              </select>
              {errors.category && <span className="error-message">{errors.category}</span>}
            </div>
          </div>

          <div className="col-span-12 identity-row">
            <div className="form-field prefix-field">
              <label>คำนำหน้า</label>
              <select
                name="skill"
                value={formData.skill}
                onChange={handleChange}
                className={errors.skill ? 'error' : ''}
              >
                <option value="">เลือก</option>
                <option value="นาย">นาย</option>
                <option value="นาง">นาง</option>
                <option value="นางสาว">นางสาว</option>
              </select>
              {errors.skill && <span className="error-message">{errors.skill}</span>}
            </div>

            <div className="form-field name-field">
              <label>ชื่อ-นามสกุล</label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="กรอกชื่อและนามสกุล"
                className={errors.fullName ? 'error' : ''}
              />
              {errors.fullName && <span className="error-message">{errors.fullName}</span>}
            </div>

            <div className="form-field birthdate-field">
              <label>วันเดือนปีเกิด</label>
              <input
                type="text"
                readOnly
                placeholder="DD/MM/YY (พ.ศ.)"
                value={formatThaiDateDisplay(formData.birthDate)}
                onClick={openDatePicker}
                className={errors.birthDate ? 'error' : ''}
              />
              <input
                type="date"
                ref={hiddenDateRef}
                style={{ display: 'none' }}
                value={formData.birthDate}
                onChange={onHiddenDateChange}
              />
              {errors.birthDate && <span className="error-message">{errors.birthDate}</span>}
            </div>
          </div>

          {/* Row 2: ID Card, Phone, Category */}
          <div className="form-field col-span-6 id-card-field">
            <label>เลขบัตรประชาชน</label>
            <input
              type="text"
              name="idCard"
              value={formData.idCard}
              onChange={handleChange}
              placeholder="x-xxxx-xxxxx-xx-x"
              maxLength="17"
              className={errors.idCard ? 'error' : ''}
            />
            {errors.idCard && <span className="error-message">{errors.idCard}</span>}
          </div>

          <div className="form-field col-span-12 phone-field">
            <label>เบอร์โทรศัพท์</label>
            <input
              type="text"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              placeholder="08x-xxx-xxxx"
              maxLength="13"
              className={errors.phoneNumber ? 'error' : ''}
            />
            {errors.phoneNumber && <span className="error-message">{errors.phoneNumber}</span>}
          </div>
          {/* Row 3: Address */}
          <div className="form-field col-span-12 address-field left-align">
            <label>ที่อยู่ปัจจุบัน</label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="บ้านเลขที่ หมู่ ถนน ซอย..."
              rows="2"
              className={errors.address ? 'error' : ''}
            ></textarea>
            {errors.address && <span className="error-message">{errors.address}</span>}
          </div>

          <div className="form-field col-span-3">
            <label>จังหวัด</label>
            <input
              type="text"
              name="province"
              value={formData.province}
              onChange={handleChange}
              placeholder="ระบุจังหวัด"
              className={errors.province ? 'error' : ''}
            />
            {errors.province && <span className="error-message">{errors.province}</span>}
          </div>
          
          <div className="form-field col-span-3">
            <label>อําเภอ</label>
            <input
              type="text"
              name="district"
              value={formData.district}
              onChange={handleChange}
              placeholder="ระบุอําเภอ"
              className={errors.district ? 'error' : ''}
            />
            {errors.district && <span className="error-message">{errors.district}</span>}
          </div>

          {/* Row 4: Location Details */}
          <div className="form-field col-span-3">
            <label>ตำบล/แขวง</label>
            <input
              type="text"
              name="addressDetails"
              value={formData.addressDetails}
              onChange={handleChange}
              placeholder="ระบุตำบลและอำเภอ"
              className={errors.addressDetails ? 'error' : ''}
            />
            {errors.addressDetails && <span className="error-message">{errors.addressDetails}</span>}
          </div>
          <div className="form-field col-span-3">
            <label>รหัสไปรษณีย์</label>
            <input
              type="text"
              name="PostalCode"
              value={formData.PostalCode}
              onChange={handleChange}
              placeholder="xxxxx"
              className={errors.PostalCode ? 'error' : ''}
            />
            {errors.PostalCode && <span className="error-message">{errors.PostalCode}</span>}
          </div>

          <div className="admin-signup-actions">
            <button type="submit" className="btn-submit" disabled={submitting}>
              {submitting ? 'กำลังบันทึก...' : 'ถัดไป: สร้างบัญชีผู้ใช้ →'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default AdminSignup;

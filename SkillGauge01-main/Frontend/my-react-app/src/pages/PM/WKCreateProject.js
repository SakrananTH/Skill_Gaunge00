import React, { useEffect, useState, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockUser } from '../../mock/mockData';
import '../pm/WKDashboard.css';
import './PMTheme.css';
import PMTopNav from './PMTopNav';
import { apiRequest } from '../../utils/api';
import { performLogout } from '../../utils/logout';
import Swal from 'sweetalert2';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { th } from 'date-fns/locale';

// ✅ ถ้ามึงก๊อปไปลงไฟล์ WKProject_Tasks.js ให้เปลี่ยนชื่อเป็น const WKProjectTasks = () => {
const WKCreateProject = () => {
  const navigate = useNavigate();
  const user = { ...mockUser, role: 'Project Manager', name: 'สมชาย ใจดี' };

  // ฟังก์ชัน Logout สำหรับ Sidebar
  const handleLogout = () => {
    Swal.fire({
      title: 'ยืนยันออกจากระบบ?',
      text: "คุณต้องการออกจากระบบใช่หรือไม่?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'ใช่, ออกจากระบบ',
      cancelButtonText: 'ยกเลิก'
    }).then((result) => {
      if (result.isConfirmed) {
        performLogout(navigate);
      }
    });
  };

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [foremen, setForemen] = useState([]);
  const [projectInfo, setProjectInfo] = useState({
    projectName: '',
    projectType: 'งานโครงสร้าง',
    location: '',
    startDate: null,
    endDate: null,
    description: '', // ✅ เพิ่มฟิลด์รายละเอียดเพิ่มเติม
    examCommitteeForemanId: '',
    pmName: user.name 
  });

  useEffect(() => {
    let isMounted = true;

    const loadForemen = async () => {
      try {
        const data = await apiRequest('/api/admin/workers');
        const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
        const filtered = items.filter((item) => {
          const roleCode = String(item?.fullData?.employment?.role || '').toLowerCase();
          const roleLabel = String(item?.role || '').toLowerCase();
          return roleCode === 'foreman' || roleCode === 'fm' || roleLabel.includes('หัวหน้างาน');
        }).map((item) => ({
          id: item?.id,
          name: item?.name || item?.full_name || item?.email || `FM-${item?.id}`
        }));

        if (isMounted) {
          setForemen(filtered);
        }
      } catch (error) {
        console.error('โหลดรายชื่อ FM ไม่สำเร็จ:', error);
        if (isMounted) setForemen([]);
      }
    };

    loadForemen();
    return () => { isMounted = false; };
  }, []);

  const handleProjectChange = (e) => {
    const { name, value } = e.target;
    setProjectInfo(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleDateChange = (date, field) => {
    setProjectInfo(prev => ({ ...prev, [field]: date }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSaveProject = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!projectInfo.projectName) {
      newErrors.projectName = "กรุณาระบุชื่อโครงการหลัก";
    }

    // ✅ ตรวจสอบว่าวันที่สิ้นสุดต้องไม่มาก่อนวันที่เริ่มโครงการ
    if (projectInfo.startDate && projectInfo.endDate) {
      if (projectInfo.endDate < projectInfo.startDate) {
        newErrors.endDate = "วันที่สิ้นสุดโครงการต้องไม่มาก่อนวันที่เริ่มโครงการ";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      Swal.fire({
        icon: 'error',
        title: 'ข้อมูลไม่ถูกต้อง',
        text: 'กรุณาตรวจสอบข้อมูลที่กรอกและลองใหม่อีกครั้ง',
        confirmButtonColor: '#d33'
      });
      return;
    }

    setLoading(true);

    try {
      // Format dates to YYYY-MM-DD for backend
      const formatDate = (date) => {
        if (!date) return null;
        const d = new Date(date);
        let month = '' + (d.getMonth() + 1);
        let day = '' + d.getDate();
        const year = d.getFullYear();

        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;

        return [year, month, day].join('-');
      };

      const selectedForeman = foremen.find((item) => String(item.id) === String(projectInfo.examCommitteeForemanId));
      const combinedDescription = [
        projectInfo.description?.trim(),
        selectedForeman ? `กรรมการสอบ (FM): ${selectedForeman.name}` : ''
      ].filter(Boolean).join('\n');

      await apiRequest('/api/projects', {
        method: 'POST',
        body: {
          project_name: projectInfo.projectName,
          project_type: projectInfo.projectType,
          project_description: combinedDescription || null,
          start_date: formatDate(projectInfo.startDate),
          end_date: formatDate(projectInfo.endDate),
          site_address: projectInfo.location,
          // Latitude/Longitude hardcoded for now or left null
          latitude: 0,
          longitude: 0 // Default coordinates
        }
      });

      Swal.fire({
        icon: 'success',
        title: 'บันทึกสำเร็จ!',
        text: `สร้างโครงการ "${projectInfo.projectName}" เรียบร้อยแล้ว`,
        timer: 2000,
        showConfirmButton: false
      }).then(() => {
        navigate('/projects');
      });

    } catch (error) {
      console.error(error);

      if (error?.status === 401) {
        await Swal.fire({
          icon: 'warning',
          title: 'เซสชันหมดอายุ',
          text: error?.data?.message || 'กรุณาเข้าสู่ระบบใหม่',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'ตกลง'
        });
        performLogout(navigate);
        return;
      }

      Swal.fire({
        icon: 'error',
        title: 'บันทึกไม่สำเร็จ',
        text: error?.data?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์',
        confirmButtonColor: '#d33'
      });
    } finally {
        setLoading(false);
    }
  };

  // Custom Input for DatePicker to match style
  const CustomDateInput = forwardRef(({ value, onClick, placeholder, style, className }, ref) => (
    <div className="date-input-container" style={{ position: 'relative', width: '100%' }}>
        <input
            onClick={onClick}
            ref={ref}
            value={value}
            placeholder={placeholder}
            readOnly
            className={className}
            style={{ ...style, cursor: 'pointer', paddingRight: '40px' }}
        />
        <i 
            className='bx bx-calendar' 
            style={{
                position: 'absolute',
                right: '15px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#64748b',
                pointerEvents: 'none',
                fontSize: '20px'
            }}
        ></i>
    </div>
  ));

  return (
    <div className="pm-page">
      <PMTopNav active="projects" user={user} onLogout={handleLogout} />

      <main className="pm-content">
          <header className="pm-hero" style={{ marginBottom: '24px' }}>
            <div>
              <h1 className="pm-hero__title">สร้างโครงการหลัก</h1>
              <p className="pm-hero__subtitle">บันทึกข้อมูลโครงการเบื้องต้นก่อน เพื่อไปกำหนดงานย่อยต่อในหน้าโครงการทั้งหมด</p>
            </div>
          </header>

          <form onSubmit={handleSaveProject}>
            <section className="pm-section">
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                
                {/* แถวที่ 1: ชื่อโครงการ และ ประเภทโครงการ */}
                <div>
                  <label style={labelStyle}>ชื่อโครงการ</label>
                  <input 
                    className="input" 
                    name="projectName" 
                    placeholder="ระบุชื่อโครงการ" 
                    value={projectInfo.projectName} 
                    onChange={handleProjectChange} 
                    required 
                    style={{ ...inputStyle, border: errors.projectName ? '1px solid #ef4444' : '1px solid #cbd5e1' }} 
                  />
                  {errors.projectName && <span style={errorStyle}>{errors.projectName}</span>}
                </div>

                <div>
                  <label style={labelStyle}>ประเภทช่างของโครงการ</label>
                  <select className="select" name="projectType" value={projectInfo.projectType} onChange={handleProjectChange} style={inputStyle}>
                    <option value="งานโครงสร้าง">งานโครงสร้าง</option>
                    <option value="งานไฟฟ้า">งานไฟฟ้า</option>
                    <option value="งานประปา">งานประปา</option>
                    <option value="งานหลังคา">งานหลังคา</option>
                    <option value="งานกระเบื้อง">งานกระเบื้อง</option>
                    <option value="งานก่ออิฐฉาบปูน">งานก่ออิฐฉาบปูน</option>
                    <option value="งานประตูหน้าต่างอลูมิเนียม">งานประตูหน้าต่างอลูมิเนียม</option>
                    <option value="งานฝ้าเพดาน">งานฝ้าเพดาน</option>
                  </select>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>กรรมการสอบ (FM)</label>
                  <select
                    className="select"
                    name="examCommitteeForemanId"
                    value={projectInfo.examCommitteeForemanId}
                    onChange={handleProjectChange}
                    style={inputStyle}
                  >
                    <option value="">-- เลือกหัวหน้างาน (FM) --</option>
                    {foremen.map((fm) => (
                      <option key={fm.id} value={fm.id}>{fm.name}</option>
                    ))}
                  </select>
                </div>

                {/* แถวที่ 2: สถานที่หน้างาน (แบบตัวใหญ่) */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>สถานที่ตั้งโครงการ (Site Location)</label>
                  <textarea className="input" name="location" placeholder="ระบุที่อยู่หรือตำแหน่งที่ตั้งโครงการ" value={projectInfo.location} onChange={handleProjectChange} required style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} />
                </div>

                {/* ✅ แถวที่ 3: รายละเอียดโครงการเพิ่มเติม (เพิ่มใหม่ตามมึงสั่ง) */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>รายละเอียดโครงการเพิ่มเติม (Description)</label>
                  <textarea className="input" name="description" placeholder="ระบุรายละเอียดอื่นๆ เช่น ข้อมูลลูกค้า, เบอร์โทรติดต่อ, หรือบันทึกช่วยจำ" value={projectInfo.description} onChange={handleProjectChange} style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }} />
                </div>

                {/* แถวที่ 4: วันเริ่ม และ วันที่สิ้นสุด */}
                <div>
                  <label style={labelStyle}>วันที่เริ่มโครงการ</label>
                  <div className="custom-datepicker-wrapper">
                    <DatePicker
                        selected={projectInfo.startDate}
                        onChange={(date) => handleDateChange(date, 'startDate')}
                        dateFormat="dd/MM/yyyy"
                        locale={th}
                        placeholderText="วัน/เดือน/ปี"
                        customInput={<CustomDateInput style={inputStyle} className="input" />}
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>วันที่สิ้นสุด (โดยประมาณ)</label>
                  <div className="custom-datepicker-wrapper">
                    <DatePicker
                        selected={projectInfo.endDate}
                        onChange={(date) => handleDateChange(date, 'endDate')}
                        dateFormat="dd/MM/yyyy"
                        locale={th}
                        placeholderText="วัน/เดือน/ปี"
                        minDate={projectInfo.startDate}
                        customInput={
                            <CustomDateInput 
                                style={{ 
                                    ...inputStyle, 
                                    border: errors.endDate ? '1px solid #ef4444' : '1px solid #cbd5e1'
                                }}
                                className="input" 
                            />
                        }
                    />
                  </div>
                  {errors.endDate && <span style={errorStyle}>{errors.endDate}</span>}
                </div>

              </div>

              <div style={{ marginTop: '40px', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '20px' }}>
                <button 
                  type="button"
                  onClick={() => navigate('/projects')}
                  style={{ 
                    background: '#f1f5f9', 
                    color: '#475569', 
                    padding: '16px 60px', 
                    borderRadius: '50px', 
                    border: '1px solid #cbd5e1', 
                    fontWeight: 'bold', 
                    fontSize: '18px', 
                    cursor: 'pointer'
                  }}
                >
                  ยกเลิก
                </button>
                <button type="submit" disabled={loading} style={{ background: loading ? '#94a3b8' : '#105fb9', color: 'white', padding: '16px 60px', borderRadius: '50px', border: 'none', fontWeight: 'bold', fontSize: '18px', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)' }}>
                  {loading ? 'กำลังบันทึก...' : 'บันทึกโครงการลง Projects ➝'}
                </button>
              </div>

            </section>
          </form>
      </main>
      <style>{`
        .react-datepicker-wrapper {
            width: 100%;
        }
        .react-datepicker {
            font-family: 'Kanit', sans-serif !important;
            border-radius: 12px !important;
            border: 1px solid #cbd5e1 !important;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important;
        }
        .react-datepicker__header {
            background-color: #f8fafc !important;
            border-bottom: 1px solid #e2e8f0 !important;
            border-top-left-radius: 12px !important;
            border-top-right-radius: 12px !important;
        }
        .react-datepicker__day--selected, .react-datepicker__day--keyboard-selected {
            background-color: #10b981 !important;
            border-radius: 50% !important;
            font-weight: bold;
        }
        .react-datepicker__day:hover {
            border-radius: 50% !important;
            background-color: #e2e8f0 !important;
        }
        .react-datepicker__current-month, .react-datepicker-time__header, .react-datepicker-year-header {
            color: #1e293b !important;
            font-weight: 700 !important;
        }
        .react-datepicker__day-name {
            color: #64748b !important;
            font-weight: 600 !important;
        }
        .date-input-container:hover input {
            border-color: #10b981 !important;
        }
      `}</style>
    </div>
  );
};

// สไตล์คุมเลเยอร์ให้คลีน
const labelStyle = { fontWeight: '700', display: 'block', marginBottom: '10px', color: '#475569', fontSize: '14px' };
const inputStyle = { width: '100%', padding: '14px 20px', borderRadius: '12px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '16px', background: '#fcfcfc', outline: 'none' };
const errorStyle = { color: '#ef4444', fontSize: '12px', marginTop: '5px', display: 'block', fontWeight: '500' };

export default WKCreateProject;
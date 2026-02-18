import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../pm/WKDashboard.css'; 
import { mockProjects } from '../../mock/mockData'; // ดึง Mock Data สำรองไว้

const ForemanReportSystem = () => {
  const navigate = useNavigate();

  // State เก็บรายชื่อโครงการที่จะแสดงใน Dropdown
  const [projectList, setProjectList] = useState([]);

  // State เก็บข้อมูลฟอร์มรายงาน
  const [reportData, setReportData] = useState({
    date: new Date().toISOString().split('T')[0], // วันที่ปัจจุบัน
    reportType: 'Daily', // ค่าเริ่มต้นเป็น รายวัน
    projectId: '', 
    projectName: '',
    workDone: '',
    problems: '',
    attachment: null
  });

  // ✅ 1. โหลดรายชื่อโครงการ (จาก LocalStorage ที่ PM สร้าง หรือ Mock)
  useEffect(() => {
    try {
      const localJobs = JSON.parse(localStorage.getItem('mock_jobs') || '[]');
      
      let projectsToUse = [];
      if (localJobs.length > 0) {
        projectsToUse = localJobs;
      } else {
        projectsToUse = mockProjects;
      }

      setProjectList(projectsToUse);

      // ตั้งค่าเริ่มต้นให้เลือกโครงการแรกอัตโนมัติ (ถ้ามี)
      if (projectsToUse.length > 0) {
        const firstProj = projectsToUse[0];
        setReportData(prev => ({
            ...prev,
            projectId: firstProj.id,
            projectName: firstProj.projectName || firstProj.name
        }));
      }
    } catch (error) {
      console.error("Error loading projects:", error);
      setProjectList(mockProjects);
    }
  }, []);

  // ฟังก์ชันจัดการการเปลี่ยนค่าในฟอร์ม
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // ถ้าเปลี่ยนโครงการ ต้องอัปเดตชื่อโครงการให้ตรงกับ ID ด้วย
    if (name === 'projectId') {
        const selectedProj = projectList.find(p => String(p.id) === String(value));
        setReportData(prev => ({ 
            ...prev, 
            projectId: value,
            projectName: selectedProj ? (selectedProj.projectName || selectedProj.name) : value
        }));
    } else {
        setReportData(prev => ({ ...prev, [name]: value }));
    }
  };

  // ฟังก์ชันจัดการไฟล์แนบ
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      // เก็บแค่ชื่อไฟล์เพื่อจำลองการทำงาน (ของจริงต้องอัปโหลดไป Server)
      setReportData(prev => ({ ...prev, attachment: e.target.files[0].name }));
    }
  };

  // ✅ 2. ฟังก์ชันกดส่งรายงาน (บันทึกลง LocalStorage)
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // ดึงประวัติรายงานเก่าออกมา
    const existingReports = JSON.parse(localStorage.getItem('foreman_reports') || '[]');
    
    // สร้างออบเจ็กต์รายงานใหม่
    const newReport = {
        ...reportData,
        id: Date.now(), // สร้าง ID ไม่ซ้ำ
        timestamp: new Date().toLocaleString() // เวลาที่กดส่ง
    };

    // เพิ่มลงในรายการและบันทึกกลับ
    existingReports.push(newReport);
    localStorage.setItem('foreman_reports', JSON.stringify(existingReports));

    // แจ้งเตือนและกลับหน้าหลัก
    alert(`✅ บันทึกรายงาน "${reportData.reportType}" เรียบร้อยแล้ว!`);
    navigate('/foreman'); 
  };

  return (
    <div className="dash-window" style={{ background: '#f8fafc', minHeight: '100vh' }}>
      <main className="worker-main" style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
        
        <header style={{ marginBottom: '30px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1e293b', margin: '0 0 8px 0' }}>ระบบรายงานผลการปฏิบัติงาน</h1>
          <p style={{ color: '#64748b', margin: 0 }}>บันทึกความคืบหน้า ปัญหา และส่งมอบงานประจำงวด</p>
        </header>

        <section className="dash-content" style={{ paddingBottom: '50px' }}>
          
          <form onSubmit={handleSubmit} style={{ background: 'white', padding: '30px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            
            {/* ส่วนที่ 1: ข้อมูลทั่วไป */}
            <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '20px', color: '#334155' }}>
                1. ข้อมูลทั่วไป (General Info)
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>วันที่รายงาน</label>
                    <input 
                        type="date" 
                        name="date"
                        value={reportData.date}
                        onChange={handleChange}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                        required
                    />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>ประเภทรายงาน</label>
                    <select 
                        name="reportType"
                        value={reportData.reportType}
                        onChange={handleChange}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    >
                        <option value="Daily">รายงานประจำวัน (Daily)</option>
                        <option value="Weekly">รายงานประจำสัปดาห์ (Weekly)</option>
                        <option value="Monthly">รายงานประจำเดือน (Monthly)</option>
                    </select>
                </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>โครงการ</label>
                <select 
                    name="projectId"
                    value={reportData.projectId}
                    onChange={handleChange}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    required
                >
                    <option value="" disabled>-- เลือกโครงการ --</option>
                    {projectList.map((proj, index) => (
                        <option key={index} value={proj.id}>
                            {proj.projectName || proj.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* ส่วนที่ 2: รายละเอียดงาน */}
            <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '20px', marginTop: '30px', color: '#334155' }}>
                2. รายละเอียดการทำงาน (Work Details)
            </h3>

            <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>งานที่ทำเสร็จ / ความคืบหน้า (Work Done)</label>
                <textarea 
                    name="workDone"
                    rows="5"
                    placeholder="- ระบุเนื้องานที่ดำเนินการแล้วเสร็จ...&#10;- ความคืบหน้าของงานเทียบกับแผน..."
                    value={reportData.workDone}
                    onChange={handleChange}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                    required
                />
            </div>

            <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>ปัญหา/อุปสรรค (Issues Found)</label>
                <textarea 
                    name="problems"
                    rows="3"
                    placeholder="- ระบุปัญหาที่พบ (ถ้ามี)..."
                    value={reportData.problems}
                    onChange={handleChange}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff1f2', borderColor: '#fecdd3' }}
                />
            </div>

            {/* ส่วนที่ 3: แนบไฟล์ */}
            <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '20px', marginTop: '30px', color: '#334155' }}>
                3. เอกสารแนบ (Attachments)
            </h3>

            <div style={{ marginBottom: '30px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>แนบไฟล์เอกสาร / รูปภาพหน้างาน</label>
                <div style={{ border: '2px dashed #cbd5e1', padding: '20px', borderRadius: '8px', textAlign: 'center', background: '#f8fafc', position: 'relative' }}>
                    <input 
                        type="file" 
                        onChange={handleFileChange}
                        style={{ opacity: 0, position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                    />
                    <div style={{ color: '#64748b' }}>
                        {reportData.attachment ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '24px' }}>📄</span>
                                <span style={{ color: '#0284c7', fontWeight: 'bold' }}>{reportData.attachment}</span>
                            </div>
                        ) : (
                            <>
                                <span style={{ fontSize: '24px', display: 'block', marginBottom: '5px' }}>📎</span>
                                คลิกเพื่อแนบไฟล์ (PDF, Excel, JPG, PNG)
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ปุ่มกด */}
            <div style={{ display: 'flex', gap: '15px' }}>
                <button 
                    type="button" 
                    onClick={() => navigate('/foreman')}
                    style={{ flex: 1, padding: '14px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                    ยกเลิก
                </button>
                <button 
                    type="submit" 
                    style={{ flex: 2, padding: '14px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.4)' }}
                >
                    ส่งรายงาน
                </button>
            </div>

          </form>
        </section>
      </main>
    </div>
  );
};

export default ForemanReportSystem;
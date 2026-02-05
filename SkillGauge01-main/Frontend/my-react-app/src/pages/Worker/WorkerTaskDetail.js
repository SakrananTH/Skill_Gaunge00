import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../pm/WKDashboard.css';

const WorkerTaskDetail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // รับข้อมูลงานที่ส่งมาจากหน้า Dashboard
  const task = location.state?.task;

  // State สำหรับฟอร์มส่งงาน
  const [submission, setSubmission] = useState({
    description: '',
    photo: null
  });

  // ถ้าไม่มีข้อมูลงาน (เช่น พิมพ์ URL เข้ามาเอง) ให้เด้งกลับ
  if (!task) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h3>ไม่พบข้อมูลงาน</h3>
        <button onClick={() => navigate('/worker')} style={{ padding: '10px 20px', cursor: 'pointer' }}>
            กลับหน้าหลัก
        </button>
      </div>
    );
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSubmission({ ...submission, photo: e.target.files[0].name });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // บันทึกข้อมูลลง LocalStorage (จำลองการส่งเข้า Server)
    const existingSubmissions = JSON.parse(localStorage.getItem('worker_submissions') || '[]');
    const newSubmission = {
        taskId: task.id,
        project: task.project,
        workerName: 'คุณสมชาย (User)', // จริงๆ ต้องดึงจาก Session
        ...submission,
        status: 'Pending Review',
        submittedAt: new Date().toLocaleString()
    };
    
    existingSubmissions.push(newSubmission);
    localStorage.setItem('worker_submissions', JSON.stringify(existingSubmissions));

    alert("✅ ส่งงานเรียบร้อยแล้ว! หัวหน้างานจะทำการตรวจสอบต่อไป");
    navigate('/worker');
  };

  return (
    <div className="dash-layout">
      {/* Sidebar (ย่อ) */}
      <aside className="dash-sidebar">
        <nav className="menu">
            <div style={{ padding: '20px', textAlign: 'center', fontWeight: 'bold', color: '#1e293b' }}>Worker Portal</div>
            <button className="menu-item" onClick={() => navigate('/worker')}>&larr; กลับหน้าหลัก</button>
        </nav>
      </aside>

      <main className="dash-main">
        <header className="dash-header">
            <div className="header-info">
                <h1>รายละเอียดงาน: {task.id}</h1>
                <p>โครงการ: {task.project}</p>
            </div>
        </header>

        <section className="dash-content" style={{ maxWidth: '800px', margin: '0 auto' }}>
            
            {/* 1. ส่วนแสดงรายละเอียดงาน */}
            <div style={{ background: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <h2 style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '15px', color: '#334155' }}>
                    📋 ข้อมูลงานที่ได้รับมอบหมาย
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                        <strong style={{ display: 'block', color: '#64748b', fontSize: '14px' }}>ชื่องาน / ตำแหน่ง</strong>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>{task.location}</div>
                    </div>
                    <div>
                        <strong style={{ display: 'block', color: '#64748b', fontSize: '14px' }}>หัวหน้างานผู้สั่ง</strong>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>{task.foreman}</div>
                    </div>
                    <div>
                        <strong style={{ display: 'block', color: '#64748b', fontSize: '14px' }}>วันที่กำหนด</strong>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>{task.date}</div>
                    </div>
                    <div>
                        <strong style={{ display: 'block', color: '#64748b', fontSize: '14px' }}>สถานะปัจจุบัน</strong>
                        <span style={{ background: '#fef3c7', color: '#d97706', padding: '4px 10px', borderRadius: '12px', fontSize: '14px', fontWeight: 'bold' }}>
                            {task.status === 'accepted' ? 'กำลังดำเนินการ' : 'รอการส่งงาน'}
                        </span>
                    </div>
                </div>
                <div style={{ marginTop: '20px', padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                    <strong style={{ color: '#475569' }}>รายละเอียดเพิ่มเติม:</strong>
                    <p style={{ margin: '5px 0 0', color: '#64748b' }}>
                        กรุณาดำเนินการตามแบบแปลนฉบับล่าสุด (Rev.03) และถ่ายรูปหน้างานหลังทำเสร็จอย่างน้อย 3 มุม
                    </p>
                </div>
            </div>

            {/* 2. ฟอร์มส่งงาน */}
            <div style={{ background: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0', borderTop: '4px solid #22c55e' }}>
                <h2 style={{ marginBottom: '20px', color: '#166534' }}>🚀 ส่งมอบงาน (Submit Work)</h2>
                


                    <div style={{ marginBottom: '30px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>แนบรูปภาพผลงาน (Photo Evidence)</label>
                        <div style={{ border: '2px dashed #cbd5e1', padding: '20px', borderRadius: '8px', textAlign: 'center', background: '#f8fafc', position: 'relative' }}>
                            <input 
                                type="file" 
                                accept="image/*"
                                onChange={handleFileChange}
                                style={{ opacity: 0, position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                            />
                            <div style={{ color: '#64748b' }}>
                                {submission.photo ? (
                                    <div style={{ color: '#0284c7', fontWeight: 'bold' }}>📷 {submission.photo}</div>
                                ) : (
                                    <><span>📷</span> คลิกเพื่ออัปโหลดรูปภาพ</>
                                )}
                            </div>
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        style={{ width: '100%', padding: '14px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '10px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(34, 197, 94, 0.3)' }}
                    >
                        ยืนยันส่งงาน
                    </button>
                
            </div>

        </section>
      </main>
    </div>
  );
};

export default WorkerTaskDetail;
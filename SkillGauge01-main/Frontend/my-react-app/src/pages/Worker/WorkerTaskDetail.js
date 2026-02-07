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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Call API to submit task
    try {
        const res = await fetch(`http://localhost:4000/api/worker/tasks/${task.id}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                description: submission.description,
                photo: submission.photo,
                submittedAt: new Date().toISOString()
            })
        });

        if (res.ok) {
            alert("✅ ส่งงานเรียบร้อยแล้ว! หัวหน้างานจะทำการตรวจสอบต่อไป");
            navigate('/worker');
        } else {
            alert("เกิดข้อผิดพลาดในการส่งงาน");
        }
    } catch (err) {
        console.error("Submit Error:", err);
        alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    }
  };

  // Helper function: กำหนดสีและข้อความตามสถานะงาน
  const getStatusUI = (status) => {
    switch (status) {
        case 'submitted':
            return { label: '⏳ รอตรวจสอบ (Pending Review)', bg: '#fff7ed', color: '#c2410c', border: '#ffedd5' };
        case 'approved':
        case 'completed':
            return { label: '✅ ผ่านแล้ว (Approved)', bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' };
        case 'rejected':
            return { label: '❌ ต้องแก้ไข (Rejected)', bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' };
        default:
            return { label: '⚙️ กำลังดำเนินการ (In Progress)', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
    }
  };

  const statusUI = getStatusUI(task.status);

  // ตรวจสอบสถานะเพื่อปิดการแก้ไข (Read Only) เมื่อส่งงานแล้ว หรือ ผ่านแล้ว
  const isReadOnly = ['submitted', 'approved', 'completed'].includes(task.status);

  return (
    <div className="dash-layout" style={{ background: '#f8fafc' }}>
      {/* Sidebar (ย่อ) */}
      <aside className="dash-sidebar">
        <nav className="menu">
            <div style={{ padding: '30px 20px', textAlign: 'center', fontWeight: '800', fontSize: '20px', color: '#10b981', letterSpacing: '1px' }}>WORKER PORTAL</div>
            <button className="menu-item" onClick={() => navigate('/worker')}>&larr; กลับหน้าหลัก</button>
            <button className="menu-item" onClick={() => navigate('/assessment-history')}>📜 ประวัติการสอบ</button>
            <button className="menu-item" onClick={() => navigate('/work-history')}>📅 ประวัติงาน</button>
        </nav>
      </aside>

      <main className="dash-main">
        <header className="dash-header" style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '20px 40px' }}>
            <div className="header-info">
                <h1 style={{ fontSize: '24px', color: '#1e293b', margin: 0 }}>รายละเอียดงาน: {task.id}</h1>
                <p style={{ color: '#64748b', margin: '5px 0 0' }}>โครงการ: {task.project}</p>
            </div>
        </header>

        <section className="dash-content" style={{ maxWidth: '900px', margin: '30px auto', padding: '0 20px' }}>
            
            {/* 1. ส่วนแสดงรายละเอียดงาน */}
            <div style={{ background: 'white', padding: '30px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '30px', border: '1px solid #e2e8f0' }}>
                <h2 style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '15px', marginBottom: '20px', color: '#334155', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24"  fill="currentColor" viewBox="0 0 24 24" ><path d="M20 6h-3V4c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2M9 4h6v2H9zM4 20V8h16v12z"></path></svg>
                    ข้อมูลงานที่ได้รับมอบหมาย
                </h2> 
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '25px' }}>
                    <div>
                        <strong style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '4px', textTransform: 'uppercase' }}>ชื่องาน / ตำแหน่ง</strong>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>{task.location}</div>
                    </div>
                    <div>
                        <strong style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '4px', textTransform: 'uppercase' }}>หัวหน้างานผู้สั่ง</strong>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>{task.foreman}</div>
                    </div>
                    <div>
                        <strong style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '4px', textTransform: 'uppercase' }}>วันที่กำหนด</strong>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>{task.date}</div>
                    </div>
                    <div>
                        <strong style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '4px', textTransform: 'uppercase' }}>สถานะปัจจุบัน</strong>
                        <div style={{ 
                            background: statusUI.bg, color: statusUI.color, border: `1px solid ${statusUI.border}`,
                            padding: '6px 16px', borderRadius: '30px', 
                            fontSize: '14px', fontWeight: 'bold', display: 'inline-block'
                        }}>
                            {statusUI.label}
                        </div>
                    </div>
                </div>
                <div style={{ marginTop: '25px', padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    <strong style={{ color: '#475569', display: 'block', marginBottom: '8px' }}>รายละเอียดเพิ่มเติม:</strong>
                    <p style={{ margin: 0, color: '#64748b', lineHeight: '1.6' }}>
                        {task.description_detail || "กรุณาดำเนินการตามแบบแปลนฉบับล่าสุด และถ่ายรูปหน้างานหลังทำเสร็จอย่างน้อย 3 มุม"}
                    </p>
                </div>
            </div>

            {/* ส่วนแสดง Comment กรณีงานถูกตีกลับ */}
            {task.status === 'rejected' && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '20px', marginBottom: '30px', color: '#b91c1c' }}>
                    <strong style={{ display: 'block', marginBottom: '8px', fontSize: '16px' }}>❌ งานถูกตีกลับ (สิ่งที่ต้องแก้ไข):</strong>
                    <p style={{ margin: 0 }}>{task.comment || task.feedback || "กรุณาตรวจสอบรายละเอียดและส่งงานใหม่อีกครั้ง"}</p>
                </div>
            )}

            {/* 2. ฟอร์มส่งงาน */}
            <form onSubmit={handleSubmit} style={{ background: 'white', padding: '30px', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
                <h2 style={{ marginBottom: '25px', color: '#10b981', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    🚀 ส่งมอบงาน (Submit Work)
                </h2>
                
                <div style={{ marginBottom: '25px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>รายละเอียดการทำงาน (Description)</label>
                    <textarea
                        rows="5"
                        value={submission.description}
                        onChange={(e) => setSubmission({ ...submission, description: e.target.value })}
                        placeholder="ระบุรายละเอียดสิ่งที่ทำ หรือปัญหาที่พบ..."
                        disabled={isReadOnly}
                        style={{ width: '100%', padding: '15px', border: '1px solid #cbd5e1', borderRadius: '10px', outline: 'none', fontSize: '15px', transition: 'border-color 0.2s', background: isReadOnly ? '#f1f5f9' : 'white' }}
                        required
                    />
                </div>

                <div style={{ marginBottom: '35px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>แนบรูปภาพผลงาน (Photo Evidence)</label>
                    <div style={{ border: '2px dashed #cbd5e1', padding: '40px', borderRadius: '12px', textAlign: 'center', background: isReadOnly ? '#f1f5f9' : '#f8fafc', position: 'relative', cursor: isReadOnly ? 'not-allowed' : 'pointer', transition: 'background 0.2s', opacity: isReadOnly ? 0.7 : 1 }}>
                        <input 
                            type="file" 
                            accept="image/*"
                            onChange={handleFileChange}
                            disabled={isReadOnly}
                            style={{ opacity: 0, position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: isReadOnly ? 'not-allowed' : 'pointer' }}
                        />
                        <div style={{ color: '#64748b' }}>
                            {submission.photo ? (
                                <div style={{ color: '#0284c7', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '32px' }}>📷</span>
                                    {submission.photo}
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '32px', opacity: 0.5 }}>📷</span>
                                    <span>คลิกเพื่ออัปโหลดรูปภาพ</span>
                                    <span style={{ fontSize: '12px', opacity: 0.7 }}>(รองรับ .jpg, .png)</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <button 
                    type="submit" 
                    disabled={isReadOnly}
                    style={{ width: '100%', padding: '16px', background: isReadOnly ? '#94a3b8' : '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: isReadOnly ? 'not-allowed' : 'pointer', boxShadow: isReadOnly ? 'none' : '0 4px 10px rgba(16, 185, 129, 0.3)', transition: 'transform 0.1s' }}
                >
                    {isReadOnly ? (task.status === 'submitted' ? '⏳ รอการตรวจสอบ' : '✅ งานเสร็จสิ้นแล้ว') : '🚀 ยืนยันส่งงาน'}
                </button>
                
            </form>

        </section>
      </main>
    </div>
  );
};

export default WorkerTaskDetail;
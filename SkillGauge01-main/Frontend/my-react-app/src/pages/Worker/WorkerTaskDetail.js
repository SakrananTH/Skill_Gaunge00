import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../pm/WKDashboard.css';
import { apiRequest } from '../../utils/api';
import Swal from 'sweetalert2';

const WorkerTaskDetail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // รับข้อมูลงานที่ส่งมาจากหน้า Dashboard
    const incomingTask = location.state?.task;
    const [task, setTask] = useState(incomingTask || null);
    const [loadingTask, setLoadingTask] = useState(Boolean(incomingTask?.id));

  // State สำหรับฟอร์มส่งงาน
  const [submission, setSubmission] = useState({
    description: '',
    photo: null
  });
  const [previewUrl, setPreviewUrl] = useState(null);
    const [allowResubmitEdit, setAllowResubmitEdit] = useState(false);

    useEffect(() => {
        const loadTask = async () => {
            const taskId = incomingTask?.id;
            if (!taskId) {
                setLoadingTask(false);
                setTask(null);
                return;
            }

            setLoadingTask(true);
            try {
                const items = await apiRequest('/api/worker/tasks');
                const found = Array.isArray(items)
                    ? items.find((item) => String(item.id) === String(taskId))
                    : null;
                setTask(found || incomingTask);
            } catch (error) {
                console.error('Load task detail error:', error);
                setTask(incomingTask);
            } finally {
                setLoadingTask(false);
            }
        };

        loadTask();
    }, [incomingTask]);

    if (loadingTask) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <h3>กำลังโหลดข้อมูลงาน...</h3>
            </div>
        );
    }

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
      const file = e.target.files[0];
            setSubmission({ ...submission, photo: file });
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
        const isResubmit = task.status === 'submitted' || allowResubmitEdit;
    
    const result = await Swal.fire({
            title: isResubmit ? 'ยืนยันการรีส่งงาน?' : 'ยืนยันการส่งงาน?',
            text: isResubmit
                ? 'ระบบจะอัปเดตผลงานล่าสุดแทนข้อมูลเดิมของคุณ'
                : 'คุณตรวจสอบความถูกต้องของรายละเอียดและรูปภาพเรียบร้อยแล้วใช่หรือไม่?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#64748b',
            confirmButtonText: isResubmit ? 'ใช่, รีส่งงาน' : 'ใช่, ยืนยันส่งงาน',
      cancelButtonText: 'ยกเลิก'
    });

    if (!result.isConfirmed) return;

    // Call API to submit task
    try {
        const formData = new FormData();
        formData.append('description', submission.description || '');
        formData.append('submittedAt', new Date().toISOString());
        if (submission.photo) {
          formData.append('photo', submission.photo);
        }

        await apiRequest(`/api/worker/tasks/${task.id}/submit`, {
            method: 'POST',
            body: formData
        });

        await Swal.fire({
          icon: 'success',
                    title: isResubmit ? 'รีส่งงานสำเร็จ!' : 'ส่งงานสำเร็จ!',
                    text: isResubmit
                        ? 'ผลงานล่าสุดถูกอัปเดตเรียบร้อยแล้ว'
                        : 'หัวหน้างานจะทำการตรวจสอบต่อไป',
                    timer: 2200,
                    showConfirmButton: false,
                    background: '#0f172a',
                    color: '#ffffff',
                    iconColor: '#22c55e'
        });

                setAllowResubmitEdit(false);
        navigate('/worker');
    } catch (err) {
        console.error("Submit Error:", err);
        if (err?.data?.message === 'state_not_submittable') {
            Swal.fire({
              icon: 'warning',
              title: 'ไม่สามารถส่งงานได้',
              text: 'กรุณากดรับงานหรือเริ่มงานก่อนส่งงาน',
              confirmButtonColor: '#2563eb'
            });
            return;
        }
        Swal.fire({
          icon: 'error',
          title: 'เกิดข้อผิดพลาด',
          text: err?.data?.message || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้",
          confirmButtonColor: '#ef4444'
        });
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
    const isSubmittedTask = task.status === 'submitted';

  // ตรวจสอบสถานะเพื่อปิดการแก้ไข (Read Only) เมื่อส่งงานแล้ว หรือ ผ่านแล้ว
    const isReadOnly = ['approved', 'completed'].includes(task.status) || (isSubmittedTask && !allowResubmitEdit);

    const handleEnableResubmit = async () => {
        const result = await Swal.fire({
            title: 'รีส่งงานใหม่',
            html: '<div style="font-size:14px;line-height:1.6">คุณสามารถแก้ไขรายละเอียดหรือเปลี่ยนรูปภาพ แล้วกด <b>ยืนยันส่งงาน</b> อีกครั้งได้ทันที</div>',
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: 'เริ่มแก้ไขและรีส่ง',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#0ea5e9',
            cancelButtonColor: '#64748b',
            background: '#f8fafc'
        });

        if (!result.isConfirmed) return;

        setAllowResubmitEdit(true);
        await Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'เปิดโหมดรีส่งงานแล้ว',
            text: 'แก้ไขข้อมูลให้เรียบร้อยแล้วกด “ยืนยันส่งงาน”',
            showConfirmButton: false,
            timer: 2200,
            timerProgressBar: true,
            background: '#0f172a',
            color: '#ffffff'
        });
    };

  return (
    <div className="dash-layout" style={{ display: 'block', background: '#f8fafc', minHeight: '100vh' }}>

      <main className="dash-main" style={{ marginLeft: 0, width: '100%', padding: '20px 0' }}>
                <section className="dash-content" style={{ maxWidth: '900px', margin: '14px auto 24px', padding: '0 20px' }}>
                        <header style={{ 
                            background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)', 
                            borderRadius: '20px', 
                            padding: '30px 40px', 
                            color: 'white', 
                            marginBottom: '24px',
                            boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.2)',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <div style={{ position: 'relative', zIndex: 1 }}>
                                <h1 style={{ fontSize: '26px', fontWeight: '800', margin: 0 }}>รายละเอียดงาน: {task.id}</h1>
                                <p style={{ fontSize: '16px', opacity: 0.9, margin: '8px 0 0' }}>
                                    <i className='bx bx-buildings' style={{ marginRight: '8px' }}></i>
                                    โครงการ: {task.project}
                                </p>
                            </div>
                            <i className='bx bx-task' style={{ position: 'absolute', right: '-20px', bottom: '-20px', fontSize: '150px', opacity: 0.1, transform: 'rotate(-15deg)' }}></i>
                        </header>
            
            {/* 1. ส่วนแสดงรายละเอียดงาน */}
            <div style={{ background: 'white', padding: '30px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '30px', border: '1px solid #e2e8f0' }}>
                <h2 style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '15px', marginBottom: '20px', color: '#334155', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <i className='bx bx-info-circle' style={{ color: '#3b82f6', fontSize: '24px' }}></i>
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
                <h2 style={{ marginBottom: '25px', color: '#2563eb', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <i className='bx bx-rocket' style={{ fontSize: '24px' }}></i> ส่งมอบงาน (Submit Work)
                </h2>

                {isSubmittedTask && !allowResubmitEdit && (
                    <div style={{ marginBottom: '20px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                        <div style={{ color: '#1e3a8a', fontSize: '14px', fontWeight: '600' }}>
                            งานนี้ส่งแล้ว หากต้องการแก้ไขให้กด “รีส่งงานใหม่”
                        </div>
                        <button
                            type="button"
                            onClick={handleEnableResubmit}
                            style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 10px rgba(37,99,235,0.25)' }}
                        >
                            รีส่งงานใหม่
                        </button>
                    </div>
                )}
                
                <div style={{ marginBottom: '25px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>รายละเอียดการทำงาน (Description)</label>
                    <textarea
                        rows="5"
                        value={submission.description}
                        onChange={(e) => setSubmission({ ...submission, description: e.target.value })}
                        placeholder="ระบุรายละเอียดสิ่งที่ทำ หรือปัญหาที่พบ..."
                        disabled={isReadOnly}
                        style={{ width: '100%', padding: '15px', border: '1.5px solid #e2e8f0', borderRadius: '12px', outline: 'none', fontSize: '15px', transition: 'all 0.2s', background: isReadOnly ? '#f8fafc' : 'white' }}
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
                            {previewUrl ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                    <img 
                                        src={previewUrl} 
                                        alt="Preview" 
                                        style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '2px solid #fff' }} 
                                    />
                                    <span style={{ color: '#2563eb', fontWeight: 'bold', fontSize: '14px' }}>{submission.photo?.name || '-'}</span>
                                    {!isReadOnly && (
                                        <button 
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPreviewUrl(null);
                                                setSubmission({ ...submission, photo: null });
                                            }}
                                            style={{ background: '#ef4444', color: 'white', border: 'none', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', marginTop: '5px' }}
                                        >
                                            ลบรูปภาพ
                                        </button>
                                    )}
                                </div>
                            ) : submission.photo ? (
                                <div style={{ color: '#2563eb', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                    <i className='bx bx-image-add' style={{ fontSize: '40px' }}></i>
                                    {submission.photo?.name || '-'}
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                    <i className='bx bx-cloud-upload' style={{ fontSize: '40px', opacity: 0.5 }}></i>
                                    <span>คลิกเพื่ออัปโหลดรูปภาพ</span>
                                    <span style={{ fontSize: '12px', opacity: 0.7 }}>(รองรับ .jpg, .png)</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
                    <button 
                        type="button"
                        onClick={() => navigate('/worker')}
                        style={{ flex: 1, padding: '16px', background: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                    >
                        &larr; กลับหน้าหลัก
                    </button>
                    <button 
                        type="submit" 
                        disabled={isReadOnly}
                        style={{ flex: 2, padding: '16px', background: isReadOnly ? '#94a3b8' : 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: isReadOnly ? 'not-allowed' : 'pointer', boxShadow: isReadOnly ? 'none' : '0 4px 15px rgba(37, 99, 235, 0.3)', transition: 'all 0.3s ease' }}
                    >
                        {isReadOnly ? (task.status === 'submitted' ? '⏳ รอการตรวจสอบ' : '✅ งานเสร็จสิ้นแล้ว') : (isSubmittedTask ? 'ยืนยันรีส่งงาน' : 'ยืนยันส่งงาน')}
                    </button>
                </div>
                
            </form>

        </section>
      </main>
    </div>
  );
};

export default WorkerTaskDetail;
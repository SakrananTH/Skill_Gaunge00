import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../pm/WKDashboard.css';

const WKProjectTasks = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // รับข้อมูล Project ที่ส่งมาจากหน้า Detail
  const incomingProject = location.state?.project;
  
  // ดึง User จาก Session
  const userStr = sessionStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  // ฟังก์ชัน Logout
  const handleLogout = () => {
    if (window.confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
      sessionStorage.clear();
      localStorage.removeItem('token');
      navigate('/login');
    }
  };

  const [taskForm, setTaskForm] = useState({
    taskName: '',
    technicianType: 'ช่างโครงสร้าง', // Default
    priority: 'ทั่วไป', // Default
    requiredWorkers: '1',
    taskDetail: '',         
  });

  // ป้องกันเข้าหน้าตรงๆ โดยไม่มี Project
  useEffect(() => {
    if (!incomingProject) {
      alert("ไม่พบข้อมูลโครงการ กรุณาเลือกโครงการก่อน");
      navigate('/projects');
    }
  }, [incomingProject, navigate]);

  const handleTaskChange = (e) => {
    setTaskForm({ ...taskForm, [e.target.name]: e.target.value });
  };

  const handleSaveTask = async (e) => {
    e.preventDefault();
    try {
        const API = 'http://localhost:4000'; // ตรวจสอบ Port
        const payload = {
            pj_id: incomingProject.pj_id,
            task_name: taskForm.taskName,
            technician_type: taskForm.technicianType,
            priority: taskForm.priority,
            required_workers: parseInt(taskForm.requiredWorkers),
            description: taskForm.taskDetail
        };

        // 1. ยิง API สร้าง Task
        const res = await fetch(`${API}/api/manageprojecttask/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('create task failed');
        const data = await res.json();
        const pj_t_id = data?.pj_t_id;

        // 2. ไปหน้าเลือกช่าง (WKAssignWorker) พร้อมส่งข้อมูลจำเป็นไป
        // ต้องแน่ใจว่า Route ของหน้า Assign คือ /assign-worker (หรือตามที่คุณตั้งใน App.js)
        navigate('/assign-worker', { 
            state: { 
                taskId: pj_t_id, 
                taskData: payload,
                projectName: incomingProject.project_name
            } 
        });

    } catch (err) {
        console.error("Error creating task:", err);
        alert('เกิดข้อผิดพลาดในการบันทึกงานย่อย');
    }
  };

  if (!incomingProject) return null; // ป้องกันการ Render ระหว่าง Redirect

  // Styles
  const labelStyle = { fontWeight: 'bold', marginBottom: '8px', display: 'block', color: '#2c3e50' };
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #bdc3c7', fontSize: '16px' };
  const btnStyle = { background: '#e67e22', color: 'white', padding: '12px 40px', border: 'none', borderRadius: '30px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(230, 126, 34, 0.3)' };

  return (
    <div className="dash-layout">
      {/* Sidebar เต็มรูปแบบ */}
      <aside className="dash-sidebar">
        <div className="sidebar-title" style={{ padding: '20px', textAlign: 'center', fontWeight: 'bold', color: '#1e293b' }}>
          PM Portal
        </div>
        <nav className="menu">
          <button type="button" className="menu-item" onClick={() => navigate('/pm', { state: { user } })}>หน้าหลัก</button>
          <button type="button" className="menu-item active" onClick={() => navigate('/project-tasks', { state: { user } })}>มอบหมายงาน</button>
          <button type="button" className="menu-item" onClick={() => navigate('/projects', { state: { user } })}>โครงการทั้งหมด</button>
          <button type="button" className="menu-item" onClick={() => navigate('/pm-settings', { state: { user } })}>ตั้งค่า</button>
          <button type="button" className="menu-item logout-btn" style={{ marginTop: '20px', color: '#ef4444', background: '#fef2f2', borderColor: '#fee2e2' }} onClick={handleLogout}>ออกจากระบบ</button>
        </nav>
      </aside>

      <main className="dash-main">
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
          
           {/* Header & Back */}
           <div style={{ marginBottom: '20px' }}>
            <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '14px', marginBottom: '10px' }}>
                ← ย้อนกลับ
            </button>
            <h1 style={{ color: '#2c3e50', margin: '0 0 10px 0' }}>กำหนดงานย่อย (Task Definition)</h1>
            <div style={{ background: '#eef2f7', padding: '15px', borderRadius: '8px', color: '#2c3e50' }}>
                โครงการ: <strong>{incomingProject.project_name}</strong>
            </div>
          </div>
          
          <form onSubmit={handleSaveTask} style={{ background: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
            
            <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>ชื่องานย่อย *</label>
                <input 
                    className="input" 
                    name="taskName" 
                    value={taskForm.taskName} 
                    onChange={handleTaskChange} 
                    required 
                    style={inputStyle} 
                    placeholder="เช่น เทปูนชั้น 1, เดินสายไฟห้องนอน"
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                    <label style={labelStyle}>ประเภทสายงานช่าง *</label>
                    <select className="input" name="technicianType" value={taskForm.technicianType} onChange={handleTaskChange} style={inputStyle}>
                        <option value="ช่างโครงสร้าง">ช่างโครงสร้าง</option>
                        <option value="ช่างไฟฟ้า">ช่างไฟฟ้า</option>
                        <option value="ช่างประปา">ช่างประปา</option>
                        <option value="ช่างก่ออิฐฉาบปูน">ช่างก่ออิฐฉาบปูน</option>
                        <option value="ช่างประตู-หน้าต่าง">ช่างประตู-หน้าต่าง</option>
                        <option value="ช่างฝ้าเพดาน">ช่างฝ้าเพดาน</option>
                        <option value="ช่างหลังคา">ช่างหลังคา</option>
                        <option value="ช่างกระเบื้อง">ช่างกระเบื้อง</option>
                    </select>
                </div>
                <div>
                    <label style={labelStyle}>เงื่อนไขความชำนาญ (Priority) *</label>
                    <select className="input" name="priority" value={taskForm.priority} onChange={handleTaskChange} style={inputStyle}>
                        <option value="ทั่วไป">ทั่วไป (ระดับพื้นฐานขึ้นไป)</option>
                        <option value="ชำนาญ">ชำนาญ (ระดับ 1 ขึ้นไป)</option>
                        <option value="ชำนาญงานพิเศษ">ชำนาญงานพิเศษ (ระดับ 2 ขึ้นไป)</option>
                    </select>
                </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>จำนวนช่างที่ต้องการ (คน) *</label>
                <input 
                    className="input" 
                    type="number" 
                    name="requiredWorkers" 
                    value={taskForm.requiredWorkers} 
                    onChange={handleTaskChange} 
                    min="1" 
                    required
                    style={inputStyle} 
                />
            </div>

            <div style={{ marginBottom: '30px' }}>
                <label style={labelStyle}>รายละเอียดและคำสั่งงาน</label>
                <textarea 
                    className="input" 
                    name="taskDetail" 
                    value={taskForm.taskDetail} 
                    onChange={handleTaskChange} 
                    rows="4" 
                    style={inputStyle} 
                    placeholder="รายละเอียดเพิ่มเติมสำหรับช่าง..."
                />
            </div>

            <div style={{ textAlign: 'center' }}>
                <button type="submit" style={btnStyle}>บันทึกภารกิจและไปเลือกช่าง ➝</button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default WKProjectTasks;
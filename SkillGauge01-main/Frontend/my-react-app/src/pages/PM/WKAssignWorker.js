import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from 'axios';
import '../pm/WKDashboard.css';

const WKAssignWorker = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // รับข้อมูลจากหน้า WKProjectTasks
  const { taskId, taskData, projectName } = location.state || {};
  
  // ดึง User จาก Session (ใช้สำหรับ Sidebar)
  const userStr = sessionStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  const [workers, setWorkers] = useState([]);
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API = 'http://localhost:4000'; // ตรวจสอบ Port ให้ตรงกับ Backend

  // ฟังก์ชัน Logout
  const handleLogout = () => {
    if (window.confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
      sessionStorage.clear();
      localStorage.removeItem('token');
      navigate('/login');
    }
  };

  useEffect(() => {
    // ป้องกันเข้าหน้าตรงๆ หรือข้อมูลไม่มา
    if (!taskId || !taskData) { 
        alert("ไม่พบข้อมูลงานย่อย กรุณาทำรายการใหม่");
        navigate('/projects'); 
        return; 
    }

    // ดึงรายชื่อช่างที่ระบบจัดลำดับให้
    const fetchWorkers = async () => {
        try {
            const res = await axios.post(`${API}/api/manageprojecttask/recommend`, {
                technician_type: taskData.technician_type,
                priority: taskData.priority
            });
            setWorkers(res.data);
            setLoading(false);
        } catch (err) {
            console.error("Error fetching workers:", err);
            setError("ไม่สามารถดึงข้อมูลช่างได้");
            setLoading(false);
        }
    };
    fetchWorkers();
  }, [taskId, taskData, navigate]);

  const handleSelectWorker = (userId) => {
    if (selectedWorkers.includes(userId)) {
        // ถ้าเลือกอยู่แล้ว ให้เอาออก
        setSelectedWorkers(prev => prev.filter(id => id !== userId));
    } else {
        // ถ้ายังไม่เลือก เช็คว่าครบจำนวนหรือยัง
        if (selectedWorkers.length >= taskData.required_workers) {
            alert(`เลือกครบจำนวนที่ต้องการแล้ว (${taskData.required_workers} คน)`);
            return;
        }
        // เพิ่มเข้า list
        setSelectedWorkers(prev => [...prev, userId]);
    }
  };

  const handleConfirmAssignment = async () => {
    if (selectedWorkers.length === 0) {
        alert("กรุณาเลือกช่างอย่างน้อย 1 คน");
        return;
    }
    
    // ยิง API บันทึกการมอบหมาย
    try {
        await axios.post(`${API}/api/manageprojecttask/assign`, {
            pj_t_id: taskId,
            user_ids: selectedWorkers
        });
        
        alert("มอบหมายงานสำเร็จ!");
        // กลับไปหน้า Detail ของ Project นั้น
        navigate('/project-detail', { state: { pj_id: taskData.pj_id } });
    } catch (err) {
        console.error(err);
        alert("เกิดข้อผิดพลาดในการมอบหมายงาน");
    }
  };

  // Helper แปลง Level เป็น Text
  const getLevelText = (lvl) => {
      if (lvl === 0) return "รอการประเมิน";
      return `ระดับ ${lvl}`;
  };

  // Helper สี Badge ของ Level
  const getLevelBadgeStyle = (lvl) => {
      if (lvl === 0) return { background: '#f8d7da', color: '#721c24' }; // สีแดงอ่อน
      if (lvl === 3) return { background: '#d1e7dd', color: '#0f5132' }; // สีเขียวเข้ม (Expert)
      return { background: '#fff3cd', color: '#856404' }; // สีเหลือง (1-2)
  };

  if (loading) return <div style={{padding:'50px', textAlign:'center'}}>กำลังประมวลผลและค้นหาช่าง...</div>;

  return (
    <div className="dash-layout">
      {/* Sidebar */}
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
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
          <h1 style={{ color: '#2c3e50', borderBottom: '2px solid #3498db', paddingBottom: '10px' }}>เลือกช่างเข้าปฏิบัติงาน (Assign Workers)</h1>
          
          {/* ส่วนแสดงข้อมูลงาน */}
          <div style={{ background: '#eef2f7', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
             <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                 <div>
                    <p style={{margin:'5px 0'}}><strong>โครงการ:</strong> {projectName}</p>
                    <p style={{margin:'5px 0'}}><strong>งานย่อย:</strong> {taskData?.task_name}</p>
                 </div>
                 <div>
                    <p style={{margin:'5px 0'}}><strong>ประเภทช่าง:</strong> {taskData?.technician_type}</p>
                    <p style={{margin:'5px 0'}}><strong>เงื่อนไขความชำนาญ:</strong> {taskData?.priority}</p>
                 </div>
             </div>
             <hr style={{margin:'15px 0', borderTop:'1px solid #ddd'}}/>
             <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                 <div style={{fontSize:'16px'}}>
                    สถานะการเลือก: <strong>{selectedWorkers.length}</strong> / <span style={{color:'#e74c3c'}}>{taskData?.required_workers}</span> คน
                 </div>
                 <div style={{color: '#27ae60', fontWeight:'bold', fontSize:'14px'}}>
                    * ระบบได้จัดลำดับช่างที่ตรงกับความต้องการให้แล้วตามลำดับ
                 </div>
             </div>
          </div>

          {/* ตารางรายชื่อช่าง */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: '#f8f9fa', color: '#7f8c8d', textAlign: 'left' }}>
                        <th style={{ padding: '15px' }}>ลำดับแนะนำ</th>
                        <th style={{ padding: '15px' }}>ชื่อช่าง</th>
                        <th style={{ padding: '15px' }}>อายุ / ประสบการณ์</th>
                        <th style={{ padding: '15px' }}>ระดับทักษะ</th>
                        <th style={{ padding: '15px', textAlign: 'center' }}>เลือก</th>
                    </tr>
                </thead>
                <tbody>
                    {error ? (
                        <tr><td colSpan="5" style={{padding:'20px', textAlign:'center', color:'red'}}>{error}</td></tr>
                    ) : workers.length > 0 ? (
                        workers.map((w, index) => {
                            const isSelected = selectedWorkers.includes(w.id);
                            const badgeStyle = getLevelBadgeStyle(w.skill_level);
                            return (
                                <tr key={w.id} style={{ borderBottom: '1px solid #eee', background: isSelected ? '#f0f9ff' : 'white' }}>
                                    <td style={{ padding: '15px', fontWeight: 'bold', color:'#2c3e50' }}>#{index + 1}</td>
                                    <td style={{ padding: '15px', fontWeight:'500' }}>{w.full_name}</td>
                                    <td style={{ padding: '15px', color:'#555' }}>{w.age} ปี / {w.experience_years} ปี</td>
                                    <td style={{ padding: '15px' }}>
                                        <span style={{ ...badgeStyle, padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight:'bold', border:`1px solid ${badgeStyle.color}` }}>
                                            {getLevelText(w.skill_level)}
                                        </span>
                                    </td>
                                    <td style={{ padding: '15px', textAlign: 'center' }}>
                                        <button 
                                            onClick={() => handleSelectWorker(w.id)}
                                            style={{
                                                background: isSelected ? '#e74c3c' : '#3498db',
                                                color: 'white', 
                                                border: 'none', 
                                                padding: '8px 20px', 
                                                borderRadius: '20px', 
                                                cursor: 'pointer',
                                                fontWeight: 'bold',
                                                boxShadow: isSelected ? 'none' : '0 2px 5px rgba(52, 152, 219, 0.3)'
                                            }}
                                        >
                                            {isSelected ? 'ยกเลิก' : 'เลือก'}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })
                    ) : (
                        <tr>
                            <td colSpan="5" style={{padding:'40px', textAlign:'center', color:'#999'}}>
                                ⚠️ ไม่พบช่างที่มีคุณสมบัติตรงตามเงื่อนไขในระบบ
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
          </div>

          <div style={{ marginTop: '30px', textAlign: 'right' }}>
             <button 
                onClick={handleConfirmAssignment}
                disabled={selectedWorkers.length === 0}
                style={{ 
                    background: selectedWorkers.length === 0 ? '#95a5a6' : '#27ae60', 
                    color: 'white', 
                    padding: '15px 50px', 
                    border: 'none', 
                    borderRadius: '30px', 
                    fontSize: '18px', 
                    fontWeight: 'bold', 
                    cursor: selectedWorkers.length === 0 ? 'not-allowed' : 'pointer',
                    boxShadow: selectedWorkers.length === 0 ? 'none' : '0 4px 10px rgba(39, 174, 96, 0.3)'
                }}
             >
                ยืนยันการมอบหมายงาน ➝
             </button>
          </div>

        </div>
      </main>
    </div>
  );
};

export default WKAssignWorker;
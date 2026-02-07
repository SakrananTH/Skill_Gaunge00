import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend 
} from 'recharts';
import './ForemanDashboard.css';

const ForemanDashboard = () => {
  const navigate = useNavigate();
  const [selectedWorkers, setSelectedWorkers] = useState([1, 2]); // ID ของช่างที่เลือกมาเทียบ

  // Mock Data: ข้อมูลช่างและคะแนนทักษะ
  const workers = [
    { id: 1, name: 'นายสมชาย ใจดี', role: 'ช่างโครงสร้าง', totalScore: 85, skills: { rebar: 90, concrete: 80, formwork: 85, element: 70, theory: 95 } },
    { id: 2, name: 'นายวิชัย สายลุย', role: 'ช่างโครงสร้าง', totalScore: 72, skills: { rebar: 60, concrete: 85, formwork: 70, element: 80, theory: 65 } },
    { id: 3, name: 'นายมานะ ขยันทำ', role: 'ช่างทั่วไป', totalScore: 65, skills: { rebar: 50, concrete: 60, formwork: 75, element: 65, theory: 55 } },
  ];

  // แปลงข้อมูลสำหรับ Radar Chart
  const radarData = [
    { subject: 'งานเหล็ก', fullMark: 100 },
    { subject: 'งานคอนกรีต', fullMark: 100 },
    { subject: 'งานไม้แบบ', fullMark: 100 },
    { subject: 'องค์อาคาร', fullMark: 100 },
    { subject: 'ทฤษฎี', fullMark: 100 },
  ].map(item => {
    const keyMap = { 'งานเหล็ก': 'rebar', 'งานคอนกรีต': 'concrete', 'งานไม้แบบ': 'formwork', 'องค์อาคาร': 'element', 'ทฤษฎี': 'theory' };
    const key = keyMap[item.subject];
    const newItem = { ...item };
    selectedWorkers.forEach(id => {
      const worker = workers.find(w => w.id === id);
      if (worker) newItem[worker.name] = worker.skills[key];
    });
    return newItem;
  });

  const handleWorkerToggle = (id) => {
    if (selectedWorkers.includes(id)) {
      if (selectedWorkers.length > 1) setSelectedWorkers(selectedWorkers.filter(item => item !== id));
    } else {
      if (selectedWorkers.length < 3) setSelectedWorkers([...selectedWorkers, id]);
    }
  };

  return (
    <div className="foreman-dash">
      <header className="f-header">
        <div className="f-brand">
          <img src="/logo123.png" alt="Logo" />
          <h1>Foreman Console</h1>
        </div>
        <div className="f-user">
          <span>หัวหน้างาน: <strong>คุณวิศรุต (Foreman)</strong></span>
          <button onClick={() => navigate('/login')} className="f-logout">ออกจากระบบ</button>
        </div>
      </header>

      <main className="f-content">
        <div className="f-grid">
          
          {/* ส่วนที่ 1: กราฟเปรียบเทียบทักษะ (Radar Chart) */}
          <section className="f-card radar-section">
            <div className="card-header">
              <h3>📊 เปรียบเทียบสมรรถนะรายบุคคล</h3>
              <p>แสดงจุดแข็ง-จุดอ่อนแยกตามหมวดหมู่ (เลือกได้สูงสุด 3 คน)</p>
            </div>
            <div className="worker-selector">
              {workers.map(w => (
                <button 
                  key={w.id} 
                  className={`select-btn ${selectedWorkers.includes(w.id) ? 'active' : ''}`}
                  onClick={() => handleWorkerToggle(w.id)}
                >
                  {w.name}
                </button>
              ))}
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 14 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                  {selectedWorkers.map((id, index) => {
                    const worker = workers.find(w => w.id === id);
                    const colors = ['#2563eb', '#10b981', '#f59e0b'];
                    return (
                      <Radar
                        key={id}
                        name={worker.name}
                        dataKey={worker.name}
                        stroke={colors[index]}
                        fill={colors[index]}
                        fillOpacity={0.3}
                      />
                    );
                  })}
                  <Tooltip />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* ส่วนที่ 2: ภาพรวมคะแนนทั้งหมด (Bar Chart) */}
          <section className="f-card bar-section">
            <div className="card-header">
              <h3>🏆 อันดับคะแนนรวม</h3>
              <p>ภาพรวมคะแนนทดสอบวัดทักษะของช่างทั้งหมดในทีม</p>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={workers}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="totalScore" name="คะแนนรวม (%)" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* ส่วนที่ 3: ตารางข้อมูลช่าง */}
          <section className="f-card table-section">
            <div className="card-header">
              <h3>📋 รายชื่อและสถานะการประเมิน</h3>
            </div>
            <table className="f-table">
              <thead>
                <tr>
                  <th>ชื่อ-นามสกุล</th>
                  <th>ประเภทช่าง</th>
                  <th>คะแนนรวม</th>
                  <th>สถานะ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {workers.map(w => (
                  <tr key={w.id}>
                    <td><strong>{w.name}</strong></td>
                    <td>{w.role}</td>
                    <td><span className="score-badge">{w.totalScore}%</span></td>
                    <td><span className={`status-pill ${w.totalScore >= 70 ? 'pass' : 'pending'}`}>
                      {w.totalScore >= 70 ? 'ผ่านเกณฑ์' : 'รอพัฒนา'}
                    </span></td>
                    <td><button className="view-btn">ดูรายละเอียด</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

        </div>
      </main>
    </div>
  );
};

export default ForemanDashboard;
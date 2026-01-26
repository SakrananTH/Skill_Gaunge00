import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import './WKDashboard.css';
import './WKSubmitWork.css';
import WorkerSidebar from '../components/WorkerSidebar';
import { mockUser } from '../mock/mockData';

const defaultForm = {
  title: '',
  description: '',
  progress: 'on-track',
  attachments: [],
  note: ''
};

const WKSubmitWork = () => {
  const location = useLocation();
  const navUser = location.state?.user;
  const user = navUser || mockUser;
  const [form, setForm] = useState(defaultForm);
  const [files, setFiles] = useState([]);
  const [submitted, setSubmitted] = useState(false);

  const updateField = (key) => (event) => {
    const value = key === 'attachments' ? event.target.files : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
    if (key === 'attachments') {
      const fileList = Array.from(event.target.files || []);
      setFiles(fileList.map((file) => ({ name: file.name, size: file.size })));
    }
  };

  const onSubmit = (event) => {
    event.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      alert('ส่งรายงานความคืบหน้าเรียบร้อยแล้ว (mock)');
      setSubmitted(false);
      setForm(defaultForm);
      setFiles([]);
    }, 350);
  };

  return (
    <div className="dash-layout">
      <WorkerSidebar user={user} active="submit" />

      <main className="dash-main">
        <div className="worker-container">
          <header className="worker-hero">
            <div>
              <span className="worker-chip">{user?.role || 'Worker'}</span>
              <h1>ส่งรายงานงานที่ทำ</h1>
              <p>แนบรายละเอียดงาน ภาพถ่าย และหมายเหตุเพื่อให้หัวหน้างานตรวจสอบความคืบหน้าได้อย่างรวดเร็ว</p>
            </div>
            <div className="worker-meta">
              <div className="worker-meta__avatar" aria-hidden="true">{(user?.username || 'W').slice(0,1).toUpperCase()}</div>
              <div className="worker-meta__info">
                <span className="worker-meta__name">{user?.username || 'ไม่ระบุ'}</span>
                {user?.phone && <span className="worker-meta__contact">{user.phone}</span>}
              </div>
            </div>
          </header>

          <section className="submit-card">
            <form className="submit-form" onSubmit={onSubmit}>
              <div className="submit-grid">
                <label className="submit-field">
                  <span>ชื่องาน</span>
                  <input
                    type="text"
                    placeholder="ระบุชื่อหรือลักษณะงาน"
                    value={form.title}
                    onChange={updateField('title')}
                    required
                  />
                </label>
                <label className="submit-field">
                  <span>สถานะงาน</span>
                  <select value={form.progress} onChange={updateField('progress')}>
                    <option value="on-track">กำลังดำเนินการ</option>
                    <option value="completed">เสร็จสิ้น</option>
                    <option value="blocked">พบปัญหา</option>
                  </select>
                </label>
              </div>

              <label className="submit-field">
                <span>รายละเอียดงาน</span>
                <textarea
                  rows={4}
                  placeholder="สรุปงานที่ทำ ความคืบหน้า หรือปัญหาที่พบ"
                  value={form.description}
                  onChange={updateField('description')}
                  required
                />
              </label>

              <label className="submit-field">
                <span>ไฟล์แนบ</span>
                <div className="upload-box">
                  <input
                    id="wk-upload"
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={updateField('attachments')}
                  />
                  <label htmlFor="wk-upload" className="upload-trigger">เลือกไฟล์หรือวางไฟล์ที่นี่</label>
                  {files.length > 0 && (
                    <ul className="file-list">
                      {files.map((file, index) => (
                        <li key={`${file.name}-${index}`}>
                          <span>{file.name}</span>
                          <small>{Math.round(file.size / 1024)} KB</small>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </label>

              <label className="submit-field">
                <span>หมายเหตุเพิ่มเติม</span>
                <textarea
                  rows={3}
                  placeholder="แจ้งรายละเอียดที่ต้องการให้หัวหน้างานทราบ"
                  value={form.note}
                  onChange={updateField('note')}
                />
              </label>

              <div className="submit-actions">
                <button type="submit" className="wk-btn" disabled={submitted}>
                  {submitted ? 'กำลังส่งข้อมูล...' : 'บันทึกและส่งงาน'}
                </button>
              </div>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
};

export default WKSubmitWork;

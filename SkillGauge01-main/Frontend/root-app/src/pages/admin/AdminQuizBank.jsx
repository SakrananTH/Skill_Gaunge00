import React from 'react';
import { mockQuestions } from '../../mock/mockData';

const AdminQuizBank = () => {
  return (
    <div className="panel" style={{ marginTop: '1rem' }}>
      <h2 className="panel-title">Quiz Bank</h2>
      <div className="filters">
        <div className="filter-pills">
          <select className="pill" defaultValue="">
            <option value="">All categories</option>
            <option value="structure">Structure</option>
            <option value="plumbing">Plumbing</option>
            <option value="roofing">Roofing</option>
            <option value="masonry">Masonry</option>
            <option value="aluminum">Aluminum</option>
            <option value="ceiling">Ceiling</option>
            <option value="electric">Electric</option>
            <option value="tiling">Tiling</option>
          </select>
          <select className="pill" defaultValue="">
            <option value="">Difficulty</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>
      <div className="table" role="table" aria-label="Questions table">
        <div className="thead" role="row">
          <div>คำถาม</div>
          <div>หมวด</div>
          <div>ความยาก</div>
          <div>เวอร์ชัน</div>
          <div>สถานะ</div>
        </div>
        <div className="tbody">
          {mockQuestions.map(q => (
            <div className="tr" role="row" key={q.id}>
              <div className="td">{q.text}</div>
              <div className="td">{q.category}</div>
              <div className="td">{q.difficulty}</div>
              <div className="td">{q.version}</div>
              <div className="td">{q.active ? 'active' : 'inactive'}</div>
            </div>
          ))}
          {mockQuestions.length === 0 && <div className="empty">ยังไม่มีคำถาม</div>}
        </div>
      </div>
    </div>
  );
};

export default AdminQuizBank;

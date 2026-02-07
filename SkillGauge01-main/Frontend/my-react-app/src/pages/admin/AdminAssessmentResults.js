import React, { useEffect, useMemo, useState } from 'react';
import '../Dashboard.css';
import './AdminAssessmentResults.css';
import { apiRequest } from '../../utils/api';

const fetchAssessmentResults = async ({ page, limit, search, category, passed }) => {
  const params = new URLSearchParams();
  params.append('page', page);
  params.append('limit', limit);
  if (search) params.append('search', search);
  if (category && category !== 'all') params.append('category', category);
  if (passed && passed !== 'all') params.append('passed', passed);

  const response = await apiRequest(`/api/admin/assessment-results?${params.toString()}`);
  return {
    items: Array.isArray(response?.items) ? response.items : [],
    total: Number(response?.total) || 0
  };
};

const AdminAssessmentResults = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [passed, setPassed] = useState('all');

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  useEffect(() => {
    const loadResults = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchAssessmentResults({ page, limit, search, category, passed });
        setResults(data.items);
        setTotal(data.total);
      } catch (err) {
        console.error('Fetch assessment results error:', err);
        const status = err?.status ? ` [${err.status}]` : '';
        const message = err?.message ? ` ${err.message}` : '';
        setError(`ไม่สามารถโหลดผลการประเมินได้${status}${message}`.trim());
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    loadResults();
  }, [page, limit, search, category, passed]);

  useEffect(() => {
    setPage(1);
  }, [search, category, passed, limit]);

  return (
    <div className="admin-assessment-results">
      <div className="admin-assessment-header">
        <div>
          <h2>ผลการประเมินทักษะ</h2>
          <p>รายการผลประเมินจากแบบทดสอบของช่างทั้งหมด</p>
        </div>
      </div>

      <div className="admin-assessment-filters">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ค้นหาชื่อช่าง / อีเมล / รหัส"
        />
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="all">ทุกหมวด</option>
          <option value="structure">โครงสร้าง</option>
          <option value="plumbing">ประปา</option>
          <option value="roofing">หลังคา</option>
          <option value="masonry">ก่ออิฐฉาบปูน</option>
          <option value="aluminum">อลูมิเนียม</option>
          <option value="ceiling">ฝ้าเพดาน</option>
          <option value="electric">ไฟฟ้า</option>
          <option value="tiling">กระเบื้อง</option>
        </select>
        <select value={passed} onChange={(event) => setPassed(event.target.value)}>
          <option value="all">ทุกสถานะ</option>
          <option value="1">ผ่านเกณฑ์</option>
          <option value="0">ไม่ผ่าน</option>
        </select>
        <select value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
          <option value={10}>10 รายการ</option>
          <option value={20}>20 รายการ</option>
          <option value={50}>50 รายการ</option>
        </select>
      </div>

      {loading && <div className="admin-assessment-message">กำลังโหลดข้อมูล...</div>}
      {!loading && error && <div className="admin-assessment-message error">{error}</div>}

      {!loading && !error && (
        <div className="admin-assessment-table-wrapper">
          <table className="admin-assessment-table">
            <thead>
              <tr>
                <th>รหัสช่าง</th>
                <th>ชื่อช่าง</th>
                <th>อีเมล</th>
                <th>หมวด</th>
                <th>คะแนน</th>
                <th>สถานะ</th>
                <th>เวลาสอบ</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-assessment-empty">ยังไม่มีผลการประเมิน</td>
                </tr>
              ) : (
                results.map((item) => {
                  const totalQuestions = Number(item.total_questions) || 0;
                  const score = Number(item.total_score) || 0;
                  const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
                  const finishedAt = item.finished_at ? new Date(item.finished_at).toLocaleString('th-TH') : '-';

                  return (
                    <tr key={item.id}>
                      <td>{item.worker_id}</td>
                      <td>{item.worker_name || '-'}</td>
                      <td>{item.worker_email || '-'}</td>
                      <td>{item.category || '-'}</td>
                      <td>
                        <div className="score-pill">
                          {score}/{totalQuestions} ({percentage}%)
                        </div>
                      </td>
                      <td>
                        <span className={`status-pill ${item.passed ? 'passed' : 'failed'}`}>
                          {item.passed ? 'ผ่าน' : 'ไม่ผ่าน'}
                        </span>
                      </td>
                      <td>{finishedAt}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="admin-assessment-pagination">
        <button type="button" onClick={() => setPage(prev => Math.max(1, prev - 1))} disabled={page <= 1}>
          ก่อนหน้า
        </button>
        <span>หน้า {page} / {totalPages}</span>
        <button type="button" onClick={() => setPage(prev => Math.min(totalPages, prev + 1))} disabled={page >= totalPages}>
          ถัดไป
        </button>
      </div>
    </div>
  );
};

export default AdminAssessmentResults;

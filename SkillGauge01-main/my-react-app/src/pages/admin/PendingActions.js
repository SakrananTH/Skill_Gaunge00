import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './PendingActions.css';
import { apiRequest } from '../../utils/api';

const PendingActions = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'quizzes';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [pendingQuizzes, setPendingQuizzes] = useState([]);
  const [expiringAssessments, setExpiringAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPendingData();
  }, []);

  const loadPendingData = async () => {
    try {
      setLoading(true);
      setError('');

      // ดึงข้อมูลแบบทดสอบรอการอนุมัติ
      try {
        const quizzesResponse = await apiRequest('/api/admin/quizzes?status=pending');
        const quizzes = Array.isArray(quizzesResponse?.items) 
          ? quizzesResponse.items 
          : Array.isArray(quizzesResponse) 
          ? quizzesResponse 
          : [];
        setPendingQuizzes(quizzes);
      } catch (err) {
        console.warn('Failed to fetch pending quizzes', err);
        setPendingQuizzes([]);
      }

      // ดึงข้อมูลการประเมินที่ใกล้หมดอายุ
      try {
        const assessmentsResponse = await apiRequest('/api/admin/assessments/expiring');
        const assessments = Array.isArray(assessmentsResponse?.items) 
          ? assessmentsResponse.items 
          : Array.isArray(assessmentsResponse) 
          ? assessmentsResponse 
          : [];
        setExpiringAssessments(assessments);
      } catch (err) {
        console.warn('Failed to fetch expiring assessments', err);
        setExpiringAssessments([]);
      }

    } catch (err) {
      console.error('Failed to load pending actions data', err);
      setError('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveQuiz = async (quizId) => {
    try {
      await apiRequest(`/api/admin/quizzes/${quizId}/approve`, {
        method: 'POST'
      });
      alert('อนุมัติแบบทดสอบเรียบร้อยแล้ว');
      loadPendingData();
    } catch (err) {
      console.error('Failed to approve quiz', err);
      alert('ไม่สามารถอนุมัติแบบทดสอบได้: ' + (err.message || 'Unknown error'));
    }
  };

  const handleRejectQuiz = async (quizId) => {
    try {
      await apiRequest(`/api/admin/quizzes/${quizId}/reject`, {
        method: 'POST'
      });
      alert('ปฏิเสธแบบทดสอบเรียบร้อยแล้ว');
      loadPendingData();
    } catch (err) {
      console.error('Failed to reject quiz', err);
      alert('ไม่สามารถปฏิเสธแบบทดสอบได้: ' + (err.message || 'Unknown error'));
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('th-TH', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getDaysUntilExpiry = (expiryDate) => {
    if (!expiryDate) return null;
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffTime = expiry - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="pending-actions-page">
      <header className="page-header">
        <div className="header-content">
          <button className="back-btn" onClick={() => navigate('/admin/overview')}>
            ← กลับ
          </button>
          <div>
            <h1>สิ่งที่ต้องดำเนินการ (Pending Actions)</h1>
            <p>จัดการแบบทดสอบและการประเมินที่รอดำเนินการ</p>
          </div>
        </div>
      </header>

      <div className="tabs-container">
        <button 
          className={`tab-btn ${activeTab === 'quizzes' ? 'active' : ''}`}
          onClick={() => setActiveTab('quizzes')}
        >
          <span className="tab-icon">📝</span>
          แบบทดสอบรอการอนุมัติ
          {pendingQuizzes.length > 0 && (
            <span className="badge">{pendingQuizzes.length}</span>
          )}
        </button>
        <button 
          className={`tab-btn ${activeTab === 'assessments' ? 'active' : ''}`}
          onClick={() => setActiveTab('assessments')}
        >
          <span className="tab-icon">⏰</span>
          การประเมินที่ใกล้หมดอายุ
          {expiringAssessments.length > 0 && (
            <span className="badge warning">{expiringAssessments.length}</span>
          )}
        </button>
      </div>

      <div className="tab-content">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>กำลังโหลดข้อมูล...</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <span className="error-icon">⚠️</span>
            <p>{error}</p>
            <button className="retry-btn" onClick={loadPendingData}>ลองอีกครั้ง</button>
          </div>
        ) : (
          <>
            {/* Tab: แบบทดสอบรอการอนุมัติ */}
            {activeTab === 'quizzes' && (
              <div className="quizzes-section">
                {pendingQuizzes.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">✅</span>
                    <p>ไม่มีแบบทดสอบรอการอนุมัติ</p>
                  </div>
                ) : (
                  <div className="items-grid">
                    {pendingQuizzes.map((quiz) => (
                      <div key={quiz.id} className="quiz-card">
                        <div className="card-header">
                          <h3>{quiz.title || quiz.name || 'ไม่ระบุชื่อ'}</h3>
                          <span className="status-badge pending">รอการอนุมัติ</span>
                        </div>
                        <div className="card-body">
                          <div className="info-row">
                            <span className="label">ผู้สร้าง:</span>
                            <span className="value">{quiz.createdBy || quiz.author || '-'}</span>
                          </div>
                          <div className="info-row">
                            <span className="label">วันที่สร้าง:</span>
                            <span className="value">{formatDate(quiz.createdAt)}</span>
                          </div>
                          <div className="info-row">
                            <span className="label">จำนวนคำถาม:</span>
                            <span className="value">{quiz.questionCount || quiz.questions?.length || 0} ข้อ</span>
                          </div>
                          {quiz.category && (
                            <div className="info-row">
                              <span className="label">หมวดหมู่:</span>
                              <span className="value">{quiz.category}</span>
                            </div>
                          )}
                        </div>
                        <div className="card-actions">
                          <button 
                            className="btn btn-view"
                            onClick={() => navigate(`/admin/quiz-bank/${quiz.id}`)}
                          >
                            ดูรายละเอียด
                          </button>
                          <button 
                            className="btn btn-approve"
                            onClick={() => handleApproveQuiz(quiz.id)}
                          >
                            ✓ อนุมัติ
                          </button>
                          <button 
                            className="btn btn-reject"
                            onClick={() => handleRejectQuiz(quiz.id)}
                          >
                            ✕ ปฏิเสธ
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: การประเมินที่ใกล้หมดอายุ */}
            {activeTab === 'assessments' && (
              <div className="assessments-section">
                {expiringAssessments.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">📅</span>
                    <p>ไม่มีการประเมินที่ใกล้หมดอายุ</p>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="assessments-table">
                      <thead>
                        <tr>
                          <th>ชื่อการประเมิน</th>
                          <th>พนักงาน</th>
                          <th>วันที่เริ่ม</th>
                          <th>วันหมดอายุ</th>
                          <th>เหลือเวลา</th>
                          <th>สถานะ</th>
                          <th>การดำเนินการ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expiringAssessments.map((assessment) => {
                          const daysLeft = getDaysUntilExpiry(assessment.expiryDate || assessment.endDate);
                          const isUrgent = daysLeft !== null && daysLeft <= 3;
                          const isExpired = daysLeft !== null && daysLeft < 0;

                          return (
                            <tr key={assessment.id} className={isUrgent ? 'urgent' : ''}>
                              <td>
                                <strong>{assessment.title || assessment.name || 'ไม่ระบุ'}</strong>
                              </td>
                              <td>{assessment.workerName || assessment.employeeName || '-'}</td>
                              <td>{formatDate(assessment.startDate || assessment.createdAt)}</td>
                              <td>{formatDate(assessment.expiryDate || assessment.endDate)}</td>
                              <td>
                                {daysLeft === null ? (
                                  '-'
                                ) : isExpired ? (
                                  <span className="days-expired">หมดอายุแล้ว</span>
                                ) : (
                                  <span className={isUrgent ? 'days-urgent' : 'days-normal'}>
                                    {daysLeft} วัน
                                  </span>
                                )}
                              </td>
                              <td>
                                <span className={`status-badge ${assessment.status || 'pending'}`}>
                                  {assessment.status === 'in_progress' ? 'กำลังดำเนินการ' : 
                                   assessment.status === 'completed' ? 'เสร็จสิ้น' : 
                                   assessment.status === 'pending' ? 'รอดำเนินการ' : 
                                   assessment.status || '-'}
                                </span>
                              </td>
                              <td>
                                <button 
                                  className="btn btn-small btn-view"
                                  onClick={() => navigate(`/admin/assessments/${assessment.id}`)}
                                >
                                  ดูรายละเอียด
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PendingActions;

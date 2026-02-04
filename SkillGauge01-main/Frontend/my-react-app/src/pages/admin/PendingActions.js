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

  return (
    <div className="pending-actions-page">
      <header className="page-header">
        <div className="header-content">
          <button className="back-btn" onClick={() => navigate('/admin', { state: { initialTab: 'overview' } })}>
            ← กลับ
          </button>
          <div>
            <h1>สิ่งที่ต้องดำเนินการ (Pending Actions)</h1>
            <p>ตรวจสอบและอนุมัติแบบทดสอบออนไลน์</p>
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
            {(activeTab === 'quizzes' || activeTab === 'assessments') && (
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
                            onClick={() => navigate('/admin', { state: { initialTab: 'quiz' } })}
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
          </>
        )}
      </div>
    </div>
  );
};

export default PendingActions;

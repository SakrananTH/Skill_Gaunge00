import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';

const WorkerPracticalResult = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [practicalResult, setPracticalResult] = useState({ hasResult: false, result: null, practicalWeight: 30 });

  useEffect(() => {
    const storedUserStr = sessionStorage.getItem('user');
    const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;
    const storedUserId = sessionStorage.getItem('user_id');
    const resolvedUserId = storedUser?.id ?? storedUserId;
    const numericWorkerId = resolvedUserId && !Number.isNaN(Number(resolvedUserId))
      ? Number(resolvedUserId)
      : null;

    const fetchResult = async () => {
      if (!numericWorkerId) {
        setError('ไม่พบข้อมูลผู้ใช้งาน');
        setLoading(false);
        return;
      }
      try {
        const data = await apiRequest(`/api/worker/practical-result?workerId=${encodeURIComponent(numericWorkerId)}`);
        if (data && typeof data === 'object') {
          setPracticalResult({
            hasResult: Boolean(data.hasResult),
            result: data.result || null,
            practicalWeight: Number.isFinite(Number(data.practicalWeight)) ? Number(data.practicalWeight) : 30
          });
          setError('');
        } else {
          setPracticalResult({ hasResult: false, result: null, practicalWeight: 30 });
        }
      } catch (err) {
        console.error('Error fetching practical result:', err);
        setError('ไม่สามารถดึงผลภาคปฏิบัติได้');
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, []);

  const formatPercent = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '-';
    const fixed = numeric.toFixed(2);
    return fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed;
  };

  const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="dash-window" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Kanit', sans-serif" }}>
      <nav style={{
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '15px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 20px -5px rgba(0,0,0,0.1)',
        backdropFilter: 'blur(10px)',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px',
            background: '#fef3c700', borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#5ea6e0', fontSize: '20px'
          }}>
            <img src="/logo123.png" alt="Logo" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: '#1e293b' }}>ผลภาคปฏิบัติ</h2>
        </div>
        <button
          onClick={() => navigate('/worker')}
          style={{ border: '1px solid #e2e8f0', background: 'white', color: '#475569', cursor: 'pointer', padding: '8px 20px', fontSize: '14px', fontWeight: '600', borderRadius: '10px' }}
        >
          <i className='bx bx-home-alt' style={{ marginRight: '6px' }}></i> กลับหน้าหลัก
        </button>
      </nav>

      <main style={{ flex: 1, padding: '40px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
        <div style={{ background: 'white', maxWidth: '680px', width: '100%', padding: '40px', borderRadius: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0', textAlign: 'center' }}>
          {loading && <p style={{ fontSize: '16px', color: '#64748b', margin: 0 }}>กำลังโหลดผลภาคปฏิบัติ...</p>}

          {!loading && error && (
            <>
              <h2 style={{ color: '#1e293b', margin: '0 0 10px 0', fontSize: '22px' }}>{error}</h2>
              <div style={{ marginTop: '24px' }}>
                <button onClick={() => navigate('/worker')} style={{ padding: '12px 30px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '16px', fontWeight: '600' }}>
                  กลับหน้าหลัก
                </button>
              </div>
            </>
          )}

          {!loading && !error && (
            <>
              {!practicalResult?.hasResult || !practicalResult?.result ? (
                <div style={{ textAlign: 'center', padding: '20px 10px' }}>
                  <div style={{
                    width: '150px', height: '150px', borderRadius: '50%',
                    border: '10px solid #fef3c7',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto',
                    color: '#92400e', fontWeight: '900', fontSize: '44px'
                  }}>
                    -
                  </div>
                  <div style={{
                    marginTop: '12px',
                    display: 'inline-block',
                    padding: '8px 20px',
                    borderRadius: '20px',
                    background: '#f59e0b',
                    color: 'white',
                    fontWeight: '800',
                    fontSize: '14px'
                  }}>
                    ผลภาคปฏิบัติ
                  </div>
                  <p style={{ margin: '18px 0 0 0', color: '#64748b', fontSize: '14px' }}>ยังไม่มีผลการประเมินภาคปฏิบัติ</p>
                </div>
              ) : (
                <>
                  <div style={{ position: 'relative', marginBottom: '36px', textAlign: 'center' }}>
                    <div style={{
                      width: '180px', height: '180px', borderRadius: '50%',
                      border: '10px solid #cffafe',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto', background: 'white', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)'
                    }}>
                      <div style={{ fontSize: '52px', fontWeight: '900', color: '#0e7490', lineHeight: 1 }}>
                        {formatPercent(practicalResult.result.practicalPercent)}%
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px', fontWeight: '600' }}>
                        คะแนนภาคปฏิบัติ
                      </div>
                    </div>
                    <div style={{
                      position: 'absolute', bottom: '-12px', left: '50%', transform: 'translateX(-50%)',
                      background: '#06b6d4', color: 'white',
                      padding: '8px 24px', borderRadius: '20px', fontWeight: '800', fontSize: '15px',
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', whiteSpace: 'nowrap'
                    }}>
                      ผลภาคปฏิบัติ
                    </div>
                  </div>

                  <div style={{ textAlign: 'left', marginBottom: '10px' }}>
                    <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b', marginBottom: '8px' }}>สรุปผลภาคปฏิบัติ</h3>
                    <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
                      คิดเป็นสัดส่วนภาคปฏิบัติ: <strong>{formatPercent(practicalResult.result.weightedContributionPercent)} / {formatPercent(practicalResult.practicalWeight)}%</strong>
                    </p>
                  </div>

                  <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px' }}>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>ผู้ประเมิน</div>
                      <div style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>{practicalResult.result.assessorName || 'ไม่ระบุ'}</div>
                    </div>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px' }}>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>วันที่ประเมิน</div>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>{formatDateTime(practicalResult.result.assessedAt)}</div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default WorkerPracticalResult;

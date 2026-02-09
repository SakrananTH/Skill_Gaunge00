import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SkillAssessmentSummary = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState({ name: 'ผู้ใช้งาน', id: '', role: 'worker' });
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const tradeLabel = (value) => {
    const key = String(value || '').toLowerCase();
    const map = {
      structure: 'ช่างโครงสร้าง',
      plumbing: 'ช่างประปา',
      roofing: 'ช่างหลังคา',
      masonry: 'ช่างก่ออิฐฉาบปูน',
      aluminum: 'ช่างประตูหน้าต่างอลูมิเนียม',
      ceiling: 'ช่างฝ้าเพดาน',
      electric: 'ช่างไฟฟ้า',
      tiling: 'ช่างกระเบื้อง'
    };
    return map[key] || value || 'ช่างทั่วไป';
  };

  const getCategoryLabel = (value) => {
    const key = String(value || '').toLowerCase();
    const map = {
      rebar: 'งานเหล็กเสริม',
      concrete: 'งานคอนกรีต',
      formwork: 'งานไม้แบบ',
      element: 'องค์อาคาร',
      theory: 'ทฤษฎีโครงสร้าง',
      structure: 'โครงสร้าง'
    };
    return map[key] || value || '-';
  };

  const getWorkerIdentity = () => {
    const storedUserStr = sessionStorage.getItem('user');
    const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;
    const storedUserId = sessionStorage.getItem('user_id');
    const resolvedUserId = storedUser?.id ?? storedUserId;
    const numericWorkerId = resolvedUserId && !Number.isNaN(Number(resolvedUserId))
      ? Number(resolvedUserId)
      : null;
    return { resolvedUserId, numericWorkerId };
  };

  const resolvedTrade = user.technician_type || user.trade_type || user.tradeType || user.technicianType;

  useEffect(() => {
    const storedUserStr = sessionStorage.getItem('user');
    const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;
    if (storedUser) {
      setUser(prev => ({ ...prev, ...storedUser }));
    }
    const { resolvedUserId, numericWorkerId } = getWorkerIdentity();
    if (!resolvedUserId && !numericWorkerId) return;
    const apiBase = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000';
    const loadProfile = async ({ userId, workerId }) => {
      if (!userId && !workerId) return;
      try {
        const query = workerId
          ? `workerId=${encodeURIComponent(workerId)}`
          : `userId=${encodeURIComponent(userId)}`;
        const res = await fetch(`${apiBase}/api/worker/profile?${query}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data && typeof data === 'object') {
          setUser(prev => ({ ...prev, ...data }));
        }
      } catch (err) {
        console.error('Error fetching worker profile:', err);
      }
    };
    loadProfile({ userId: resolvedUserId, workerId: numericWorkerId });
  }, []);

  useEffect(() => {
    const fetchSummary = async () => {
      const apiBase = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000';
      const { resolvedUserId, numericWorkerId } = getWorkerIdentity();
      const workerId = numericWorkerId ?? (resolvedUserId ? Number(resolvedUserId) : null);
      if (!workerId) {
        setError('ไม่พบข้อมูลผู้ใช้งาน');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${apiBase}/api/worker/assessment/summary?workerId=${workerId}`, { credentials: 'include' });
        if (res.status === 404) {
          setSummary(null);
          setError('ยังไม่มีผลการประเมิน');
          setLoading(false);
          return;
        }
        if (!res.ok) throw new Error('summary fetch failed');
        const data = await res.json();
        setSummary(data?.result || null);
      } catch (err) {
        console.error('Summary fetch failed:', err);
        setError('ไม่สามารถดึงผลสรุปได้');
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, []);

  const scoreValue = summary?.score ?? summary?.totalScore ?? 0;
  const totalValue = summary?.totalQuestions ?? 0;
  const breakdownItems = Array.isArray(summary?.breakdown) ? summary.breakdown : [];
  const overallPct = totalValue > 0 ? Math.round((scoreValue / totalValue) * 100) : 0;
  const passingScorePct = Number.isFinite(Number(summary?.passingScorePct))
    ? Number(summary.passingScorePct)
    : 70;
  const requiredCorrect = Number.isFinite(Number(summary?.requiredCorrect))
    ? Number(summary.requiredCorrect)
    : (totalValue > 0 ? Math.ceil(totalValue * (passingScorePct / 100)) : 0);
  const strongestItem = breakdownItems.reduce((best, item) => {
    if (!best) return item;
    return (item.percentage ?? 0) > (best.percentage ?? 0) ? item : best;
  }, null);

  return (
    <div className="dash-window" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Kanit', sans-serif" }}>
      <nav style={{
        background: 'white',
        padding: '15px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
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
          <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: '#1e293b' }}>{tradeLabel(resolvedTrade)}</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => navigate('/worker')} style={{ border: 'none', background: 'transparent', color: '#2563eb', cursor: 'pointer', padding: '8px 12px', fontSize: '15px', fontWeight: '600' }}>
            กลับหน้าหลัก
          </button>
        </div>
      </nav>

      <main style={{ flex: 1, padding: '60px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'white', maxWidth: '640px', width: '100%', padding: '40px', borderRadius: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', textAlign: 'center' }}>
          {loading && (
            <p style={{ fontSize: '16px', color: '#64748b', margin: 0 }}>กำลังโหลดผลสรุป...</p>
          )}

          {!loading && error && !summary && (
            <>
              <h2 style={{ color: '#1e293b', margin: '0 0 10px 0', fontSize: '22px' }}>{error}</h2>
              <p style={{ fontSize: '14px', color: '#64748b', marginTop: '10px' }}>คุณสามารถเริ่มทำแบบประเมินได้ที่หน้าแบบทดสอบ</p>
              <div style={{ marginTop: '24px' }}>
                <button onClick={() => navigate('/skill-assessment')} style={{ padding: '12px 30px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '16px', fontWeight: '600', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)' }}>
                  ไปหน้าแบบทดสอบ
                </button>
              </div>
            </>
          )}

          {!loading && summary && (
            <>
              <div style={{ width: '70px', height: '70px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#166534', fontSize: '32px' }}>✓</div>
              <h2 style={{ color: '#1e293b', margin: '0 0 5px 0', fontSize: '24px' }}>การประเมินเสร็จสิ้น</h2>
              <p style={{ fontSize: '14px', color: '#64748b', marginTop: '6px' }}>ผลการประเมินของคุณถูกบันทึกเรียบร้อยแล้ว</p>

              <div style={{ marginTop: '25px' }}>
                <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '14px', color: '#64748b' }}>คะแนนรวมของคุณ</div>
                  <div style={{ fontSize: '42px', fontWeight: '800', color: '#2563eb' }}>{scoreValue} / {totalValue}</div>
                  <div style={{ fontSize: '14px', color: '#94a3b8' }}>คิดเป็น {overallPct}%</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '10px' }}>
                  <span style={{ padding: '6px 12px', borderRadius: '999px', background: summary.passed ? '#dcfce7' : '#fee2e2', color: summary.passed ? '#166534' : '#b91c1c', fontWeight: '600', fontSize: '14px' }}>
                    {summary.passed ? 'ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์'}
                  </span>
                  {summary.category && (
                    <span style={{ padding: '6px 12px', borderRadius: '999px', background: '#e2e8f0', color: '#334155', fontWeight: '600', fontSize: '14px' }}>
                      หมวด {summary.category}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '18px' }}>
                  เกณฑ์ผ่าน: {passingScorePct}% (ต้องได้อย่างน้อย {requiredCorrect} จาก {totalValue} ข้อ)
                </div>

                {strongestItem && (
                  <div style={{ marginBottom: '18px', fontSize: '14px', color: '#0f172a' }}>
                    เด่นด้าน: <strong>{getCategoryLabel(strongestItem.label)}</strong> ({strongestItem.percentage ?? 0}%)
                  </div>
                )}

                <h3 style={{ fontSize: '16px', textAlign: 'left', marginBottom: '15px', color: '#1e293b' }}>📊 วิเคราะห์ความถนัดแยกตามหมวดหมู่</h3>
                {breakdownItems.length === 0 ? (
                  <p style={{ fontSize: '14px', color: '#64748b', margin: '10px 0 20px 0' }}>ยังไม่มีข้อมูลแยกหมวดหมู่</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {breakdownItems.map((item, idx) => (
                      <div key={`${item.label || 'cat'}-${idx}`}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '5px' }}>
                          <span style={{ color: '#475569', fontWeight: '600' }}>{getCategoryLabel(item.label)}</span>
                          <span style={{ color: '#2563eb' }}>{item.percentage ?? 0}%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px', color: '#94a3b8' }}>
                          <span>ได้ {item.correct ?? 0} จาก {item.total ?? 0} ข้อ</span>
                          <span>เก่งด้านนี้ {item.percentage ?? 0}%</span>
                        </div>
                        <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${item.percentage ?? 0}%`,
                              height: '100%',
                              background: (item.percentage ?? 0) >= 70 ? '#10b981' : ((item.percentage ?? 0) >= 50 ? '#f59e0b' : '#ef4444'),
                              transition: 'width 1s ease-in-out'
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p style={{ fontSize: '14px', color: '#64748b', marginTop: '25px', lineHeight: '1.5' }}>
                  *คะแนนนี้เป็นผลเบื้องต้น หัวหน้างานจะพิจารณาผลการทดสอบร่วมกับประวัติการทำงานของคุณอีกครั้ง
                </p>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default SkillAssessmentSummary;

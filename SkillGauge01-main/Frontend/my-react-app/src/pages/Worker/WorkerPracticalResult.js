import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';

const PRACTICAL_CRITERIA_SECTIONS = [
  {
    title: 'A. ความเข้าใจงาน & ความพร้อม',
    items: [
      { id: 'a1', text: 'เข้าใจแบบ งานสั่ง หรือคำอธิบายงานได้ถูกต้อง' },
      { id: 'a2', text: 'การวัดและการคำนวณ (Correct measurements)' },
      { id: 'a3', text: 'การใช้เครื่องมือถูกต้องเหมาะสม' }
    ]
  },
  {
    title: 'B. วิธีการทำงาน',
    items: [
      { id: 'b1', text: 'การปฏิบัติงานตามขั้นตอนและวิธีการที่ถูกต้อง' },
      { id: 'b2', text: 'ปฏิบัติตามขั้นตอนความปลอดภัยในการทำงาน' }
    ]
  },
  {
    title: 'C. คุณภาพและความถูกต้องของงาน',
    items: [
      { id: 'c1', text: 'ตำแหน่ง ระดับ แนว และมุมของงานถูกต้องตามที่กำหนด' },
      { id: 'c2', text: 'งานทำตามแบบและข้อกำหนดที่ได้รับ' },
      { id: 'c3', text: 'ความแข็งแรงและความคงทนของงาน' },
      { id: 'c4', text: 'ความเรียบร้อยและความละเอียดของงาน' }
    ]
  },
  {
    title: 'D. ประสิทธิภาพในการทำงาน',
    items: [
      { id: 'd1', text: 'ทำงานได้ทันตามเวลาที่กำหนดและทำงานต่อเนื่อง' },
      { id: 'd2', text: 'บริหารเวลาและลำดับงานได้เหมาะสม' },
      { id: 'd3', text: 'ทำงานร่วมกับผู้อื่นได้ดี ไม่เป็นอุปสรรคต่อทีม' }
    ]
  },
  {
    title: 'E. ความปลอดภัยเชิงพฤติกรรม',
    items: [
      { id: 'e1', text: 'หลีกเลี่ยงพฤติกรรมเสี่ยงและแจ้งเมื่อพบความเสี่ยง' },
      { id: 'e2', text: 'ใช้อุปกรณ์ป้องกันส่วนบุคคลครบถ้วนและถูกต้อง' }
    ]
  },
  {
    title: 'F. ความรับผิดชอบและทัศนคติ',
    items: [
      { id: 'f1', text: 'ตรงต่อเวลาและพร้อมทำงาน' },
      { id: 'f2', text: 'รับผิดชอบต่องานที่ได้รับมอบหมายจนแล้วเสร็จ' },
      { id: 'f3', text: 'แก้ไขปัญหาที่เกิดขึ้นได้ ไม่หลีกเลี่ยงความรับผิดชอบ' },
      { id: 'f4', text: 'ปฏิบัติตามคำสั่งและข้อตกลงของผู้ควบคุมงาน' }
    ]
  }
];

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

  const getSectionScoreRows = (criteriaScores) => {
    const source = criteriaScores && typeof criteriaScores === 'object' ? criteriaScores : {};
    return PRACTICAL_CRITERIA_SECTIONS.map((section) => {
      const items = section.items.map((item) => {
        const rawScore = source[item.id];
        const score = Number(rawScore);
        const hasScore = Number.isFinite(score);
        return {
          id: item.id,
          text: item.text,
          score: hasScore ? score : null
        };
      });
      const sectionTotal = items.reduce((sum, item) => sum + (item.score ?? 0), 0);
      const sectionMax = items.length * 4;
      const hasAnyScore = items.some((item) => item.score !== null);
      return {
        title: section.title,
        items,
        sectionTotal,
        sectionMax,
        hasAnyScore
      };
    }).filter((section) => section.hasAnyScore);
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

                  {practicalResult.result.comment && (
                    <div style={{ marginTop: '16px', textAlign: 'left', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px' }}>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>ความเห็นจากผู้ประเมิน</div>
                      <div style={{ fontSize: '14px', color: '#1e293b', lineHeight: 1.5 }}>{practicalResult.result.comment}</div>
                    </div>
                  )}

                  <div style={{ marginTop: '22px', textAlign: 'left' }}>
                    <h4 style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b', margin: '0 0 10px 0' }}>ประวัติคะแนนรายหัวข้อ</h4>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 12px 0' }}>แสดงคะแนนแต่ละหัวข้อจากการประเมินครั้งล่าสุด (เต็ม 4 คะแนน/ข้อ)</p>

                    {getSectionScoreRows(practicalResult.result.criteriaScores).length === 0 ? (
                      <div style={{ fontSize: '14px', color: '#64748b', padding: '12px', border: '1px dashed #cbd5e1', borderRadius: '10px', background: '#f8fafc' }}>
                        ไม่พบข้อมูลคะแนนรายหัวข้อ
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gap: '12px' }}>
                        {getSectionScoreRows(practicalResult.result.criteriaScores).map((section) => (
                          <div key={section.title} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                            <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '14px' }}>{section.title}</div>
                              <div style={{ fontWeight: '700', color: '#0f766e', fontSize: '13px' }}>{section.sectionTotal}/{section.sectionMax}</div>
                            </div>
                            <div style={{ padding: '8px 12px' }}>
                              {section.items.map((item) => (
                                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                                  <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.4 }}>{item.text}</div>
                                  <div style={{ minWidth: '52px', textAlign: 'right', fontWeight: '700', color: item.score === null ? '#94a3b8' : '#0f766e' }}>
                                    {item.score === null ? '-' : `${item.score}/4`}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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

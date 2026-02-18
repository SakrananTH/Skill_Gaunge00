import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiRequest } from '../../utils/api';

const SkillAssessmentSummary = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState({ name: 'ผู้ใช้งาน', id: '', role: 'worker' });
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDetails, setShowDetails] = useState(false);

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

  const resolvedTrade =
    user.fullData?.employment?.tradeType ||
    user.technician_type ||
    user.trade_type ||
    user.tradeType ||
    user.technicianType;

  useEffect(() => {
    const storedUserStr = sessionStorage.getItem('user');
    const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;
    if (storedUser) {
      setUser(prev => ({ ...prev, ...storedUser }));
    }
    const { resolvedUserId, numericWorkerId } = getWorkerIdentity();
    if (!resolvedUserId && !numericWorkerId) return;
    const loadProfile = async ({ userId, workerId }) => {
      if (!userId && !workerId) return;
      try {
        const query = workerId
          ? `workerId=${encodeURIComponent(workerId)}`
          : `userId=${encodeURIComponent(userId)}`;
        const data = await apiRequest(`/api/worker/profile?${query}`);
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
    if (location.state?.result) {
      const passedResult = location.state.result.result || location.state.result;
      setSummary(passedResult);
    }

    const fetchSummary = async () => {
      const { resolvedUserId, numericWorkerId } = getWorkerIdentity();
      const workerId = numericWorkerId ?? (resolvedUserId ? Number(resolvedUserId) : null);
      if (!workerId) {
        setError('ไม่พบข้อมูลผู้ใช้งาน');
        setLoading(false);
        return;
      }
      try {
        const data = await apiRequest(`/api/worker/assessment/summary?workerId=${workerId}`);
        if (!data) {
          if (!location.state?.result) {
            setSummary(null);
          }
          setError('ยังไม่มีผลการประเมิน');
          setLoading(false);
          return;
        }
        if (data?.result) {
          setSummary(data.result);
          setError('');
        }
      } catch (err) {
        console.error('Summary fetch failed:', err);
        if (!location.state?.result) {
          setError('ไม่สามารถดึงผลสรุปได้');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [location.state]);

  const rawScoreValue = Number(summary?.score ?? summary?.totalScore ?? 0);
  const rawTotalValue = Number(summary?.totalQuestions ?? 0);
  const details = Array.isArray(summary?.details) ? summary.details : [];
  const wrongAnswers = Array.isArray(summary?.wrongAnswers)
    ? summary.wrongAnswers
    : details.filter(item => item?.isCorrect === false);
  const roundQuestionCount = Number(summary?.roundQuestionCount ?? 0);
  const totalValue = roundQuestionCount > 0
    ? roundQuestionCount
    : (details.length > 0 ? details.length : rawTotalValue);
  const scoreValue = (wrongAnswers.length > 0 && totalValue > 0)
    ? Math.max(0, totalValue - wrongAnswers.length)
    : (details.length > 0
        ? details.filter(item => item?.isCorrect === true).length
        : rawScoreValue);
  const breakdownItems = Array.isArray(summary?.breakdown) ? summary.breakdown : [];
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
  const shouldShowScoreDetails = totalValue > 0;
  const shouldShowCategoryAnalysis = Boolean(summary?.passed);
  const isResultReady = summary?.resultReady === false
    ? false
    : (summary?.practicalCompleted === false ? false : (summary?.passed !== null && summary?.passed !== undefined));
  const examWeight = Number.isFinite(Number(summary?.scoreWeights?.exam))
    ? Number(summary.scoreWeights.exam)
    : 70;
  const practicalWeight = Number.isFinite(Number(summary?.scoreWeights?.practical))
    ? Number(summary.scoreWeights.practical)
    : 30;
  const hasCombinedPercent = summary?.combinedPercent !== null && summary?.combinedPercent !== undefined && summary?.combinedPercent !== '';
  const hasTheoryPercent = summary?.theoryPercent !== null && summary?.theoryPercent !== undefined && summary?.theoryPercent !== '';
  const hasPracticalPercent = summary?.practicalPercent !== null && summary?.practicalPercent !== undefined && summary?.practicalPercent !== '';
  const combinedPercentValue = hasCombinedPercent ? Number(summary?.combinedPercent) : NaN;
  const theoryPercentValue = hasTheoryPercent
    ? Number(summary?.theoryPercent)
    : (totalValue > 0 ? (Number(scoreValue) / Number(totalValue)) * 100 : 0);
  const practicalPercentValue = hasPracticalPercent ? Number(summary?.practicalPercent) : 0;
  const theoryWeightedScore = Number.isFinite(theoryPercentValue)
    ? (theoryPercentValue * examWeight) / 100
    : 0;
  const practicalWeightedScore = Number.isFinite(practicalPercentValue)
    ? (practicalPercentValue * practicalWeight) / 100
    : 0;
  const displayWeightedScore = isResultReady
    ? (Number.isFinite(combinedPercentValue) ? combinedPercentValue : (theoryWeightedScore + practicalWeightedScore))
    : theoryWeightedScore;
  const formatScore = (value) => Number(value || 0).toFixed(2);
  const overallScoreLabel = Number.isFinite(displayWeightedScore)
    ? formatScore(displayWeightedScore)
    : '0.00';
  const theoryWeightedLabel = formatScore(theoryWeightedScore);
  const practicalWeightedLabel = hasPracticalPercent ? formatScore(practicalWeightedScore) : '-';
  const statusVariant = !isResultReady ? 'pending' : (summary?.passed ? 'passed' : 'failed');
  const statusText = statusVariant === 'passed'
    ? 'ผ่านเกณฑ์การประเมิน'
    : (statusVariant === 'failed' ? 'ไม่ผ่านเกณฑ์การประเมิน' : 'คะแนนสอบ');
  const statusPalette = statusVariant === 'passed'
    ? { ring: '#dcfce7', text: '#166534', badge: '#10b981' }
    : (statusVariant === 'failed'
      ? { ring: '#fee2e2', text: '#b91c1c', badge: '#ef4444' }
      : { ring: '#fef3c7', text: '#92400e', badge: '#f59e0b' });

  const resolveAnswerLabel = (item, type) => {
    const textKey = type === 'selected' ? 'selectedText' : 'correctText';
    const answerKey = type === 'selected' ? 'selectedAnswer' : 'correctAnswer';
    const indexKey = type === 'selected' ? 'selectedIndex' : 'correctIndex';

    const textValue = item?.[textKey];
    if (textValue !== null && textValue !== undefined && String(textValue).trim() !== '') {
      return String(textValue);
    }

    const answerValue = item?.[answerKey];
    if (answerValue !== null && answerValue !== undefined && String(answerValue).trim() !== '') {
      return String(answerValue).toUpperCase();
    }

    const rawIndexValue = item?.[indexKey];
    const hasIndexValue = rawIndexValue !== null && rawIndexValue !== undefined && rawIndexValue !== '';
    const indexValue = hasIndexValue ? Number(rawIndexValue) : NaN;
    if (Number.isFinite(indexValue) && indexValue >= 0) {
      return String.fromCharCode(65 + Math.trunc(indexValue));
    }

    return type === 'selected' ? 'ไม่ได้ตอบ' : '-';
  };

  const questionNoById = new Map(
    details
      .map((item, index) => {
        const id = String(item?.questionId ?? '').trim();
        const rawNo = Number(item?.questionNo);
        const number = Number.isFinite(rawNo) && rawNo > 0 ? Math.trunc(rawNo) : index + 1;
        return [id, number];
      })
      .filter(([id]) => Boolean(id))
  );

  const resolveQuestionNo = (item, fallbackIndex) => {
    const rawNo = Number(item?.questionNo);
    if (Number.isFinite(rawNo) && rawNo > 0) return Math.trunc(rawNo);
    const key = String(item?.questionId ?? '').trim();
    if (key && questionNoById.has(key)) return questionNoById.get(key);
    return fallbackIndex + 1;
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
          <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: '#1e293b' }}>{tradeLabel(resolvedTrade)}</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            onClick={() => navigate('/worker')} 
            style={{ border: '1px solid #e2e8f0', background: 'white', color: '#475569', cursor: 'pointer', padding: '8px 20px', fontSize: '14px', fontWeight: '600', borderRadius: '10px', transition: 'all 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
            onMouseOut={(e) => e.currentTarget.style.background = 'white'}
          >
            <i className='bx bx-home-alt' style={{ marginRight: '6px' }}></i> กลับหน้าหลัก
          </button>
        </div>
      </nav>

      <main style={{ flex: 1, padding: '40px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
        <div style={{ background: 'white', maxWidth: '680px', width: '100%', padding: '40px', borderRadius: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0', textAlign: 'center' }}>
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
              <div style={{ position: 'relative', marginBottom: '40px' }}>
                <div style={{ 
                  width: '180px', height: '180px', borderRadius: '50%', 
                  border: `10px solid ${statusPalette.ring}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto', background: 'white', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ fontSize: '54px', fontWeight: '900', color: statusPalette.text, lineHeight: 1 }}>{overallScoreLabel}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', fontWeight: '600' }}>คะแนนถ่วงน้ำหนัก</div>
                  {shouldShowScoreDetails && (
                    <div style={{ fontSize: '14px', color: '#64748b', marginTop: '6px', fontWeight: '600' }}>{scoreValue} / {totalValue} คะแนน</div>
                  )}
                </div>
                <div style={{ 
                  position: 'absolute', bottom: '-12px', left: '50%', transform: 'translateX(-50%)',
                  background: statusPalette.badge, color: 'white',
                  padding: '8px 24px', borderRadius: '20px', fontWeight: '800', fontSize: '15px',
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', whiteSpace: 'nowrap'
                }}>
                  {statusText}
                </div>
              </div>

              <div style={{ textAlign: 'left', marginBottom: '30px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b', marginBottom: '8px' }}>สรุปผลการทดสอบ</h3>
                <p style={{ fontSize: '15px', color: '#64748b', margin: 0 }}>
                  ระดับความยาก: <strong>{summary.category || 'ทั่วไป'}</strong> | 
                  เกณฑ์ผ่าน: <strong>{passingScorePct}%</strong>
                </p>
                {shouldShowScoreDetails && (
                  <p style={{ fontSize: '14px', color: '#64748b', margin: '6px 0 0 0' }}>
                    คิดตามสัดส่วน: ทฤษฎี <strong>{theoryWeightedLabel} / {examWeight}</strong> + ปฏิบัติ <strong>{practicalWeightedLabel} / {practicalWeight}</strong>
                  </p>
                )}
                {!isResultReady && (
                  <p style={{ fontSize: '14px', color: '#92400e', margin: '6px 0 0 0' }}>
                    ระบบยังไม่ตัดสินผลผ่าน/ไม่ผ่าน จนกว่าจะมีคะแนนภาคปฏิบัติครบ
                  </p>
                )}
              </div>

              <div style={{ marginTop: '20px' }}>
                {shouldShowCategoryAnalysis && (
                  <>
                    <h3 style={{ fontSize: '17px', fontWeight: '700', textAlign: 'left', marginBottom: '15px', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className='bx bx-bar-chart-alt-2' style={{ color: '#2563eb', fontSize: '22px' }}></i> วิเคราะห์ความถนัดแยกตามหมวดหมู่
                    </h3>
                    {breakdownItems.length === 0 ? (
                      <p style={{ fontSize: '14px', color: '#64748b', margin: '10px 0 20px 0' }}>ยังไม่มีข้อมูลแยกหมวดหมู่</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {breakdownItems.map((item, idx) => (
                          <div key={`${item.label || 'cat'}-${idx}`} style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                              <span style={{ color: '#1e293b', fontWeight: '700', fontSize: '15px' }}>{getCategoryLabel(item.label)}</span>
                              <span style={{ color: '#2563eb', fontWeight: '800' }}>{item.percentage ?? 0}%</span>
                            </div>
                            <div style={{ height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${item.percentage ?? 0}%`,
                                  height: '100%',
                                  background: (item.percentage ?? 0) >= 70 ? '#10b981' : ((item.percentage ?? 0) >= 50 ? '#f59e0b' : '#ef4444'),
                                  transition: 'width 1s ease-in-out',
                                  borderRadius: '5px'
                                }}
                              />
                            </div>
                            <div style={{ marginTop: '8px', fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>
                              ตอบถูก {item.correct ?? 0} จาก {item.total ?? 0} ข้อ
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {details.length > 0 && (
                  <div style={{ marginTop: '30px' }}>
                    <button 
                      onClick={() => setShowDetails(!showDetails)}
                      style={{ 
                        background: 'none', border: 'none', color: '#2563eb', 
                        fontSize: '15px', fontWeight: '600', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '5px', padding: 0
                      }}
                    >
                      {showDetails ? 'ซ่อนรายละเอียดคำตอบ' : 'ดูรายละเอียดคำตอบ'} 
                      <i className={`bx bx-chevron-${showDetails ? 'up' : 'down'}`}></i>
                    </button>
                    
                    {showDetails && (
                      <div style={{ marginTop: '15px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))', gap: '10px' }}>
                        {details.map((d, i) => (
                          (() => {
                            const questionNo = resolveQuestionNo(d, i);
                            return (
                          <div 
                            key={i}
                            title={`ข้อ ${questionNo}: ${d.isCorrect ? 'ถูก' : 'ผิด'}`}
                            style={{
                              aspectRatio: '1',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              borderRadius: '8px',
                              background: d.isCorrect ? '#dcfce7' : '#fee2e2',
                              color: d.isCorrect ? '#166534' : '#b91c1c',
                              fontWeight: '700', fontSize: '14px',
                              border: d.isCorrect ? '1px solid #bbf7d0' : '1px solid #fecaca',
                              cursor: 'help'
                            }}
                          >
                            {questionNo}
                          </div>
                            );
                          })()
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {wrongAnswers.length > 0 && (
                  <div style={{ marginTop: '24px', textAlign: 'left' }}>
                    <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#991b1b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className='bx bx-error-circle' style={{ fontSize: '20px' }}></i>
                      ข้อที่ตอบผิด ({wrongAnswers.length} ข้อ)
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {wrongAnswers.map((item, idx) => {
                        const hasQuestionText = Boolean(item?.questionText);
                        const questionNo = resolveQuestionNo(item, idx);
                        return (
                          <div
                            key={`${item?.questionId || 'wrong'}-${idx}`}
                            style={{
                              background: '#fff7f7',
                              border: '1px solid #fecaca',
                              borderRadius: '12px',
                              padding: '12px 14px'
                            }}
                          >
                            <div style={{ fontSize: '13px', fontWeight: '700', color: '#b91c1c', marginBottom: hasQuestionText ? '6px' : 0 }}>
                              ข้อ {questionNo}
                            </div>
                            {hasQuestionText && (
                              <div style={{ fontSize: '14px', color: '#1f2937', marginBottom: '8px' }}>
                                {item.questionText}
                              </div>
                            )}
                            <div style={{ fontSize: '13px', color: '#6b7280', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                              <span>คำตอบของคุณ: <strong style={{ color: '#b91c1c' }}>{resolveAnswerLabel(item, 'selected')}</strong></span>
                              <span>คำตอบที่ถูก: <strong style={{ color: '#166534' }}>{resolveAnswerLabel(item, 'correct')}</strong></span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: '40px', paddingTop: '30px', borderTop: '1px solid #f1f5f9', textAlign: 'left' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '15px' }}>ขั้นตอนต่อไป</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div onClick={() => navigate('/worker/history')} style={{ padding: '15px', background: '#eff6ff', borderRadius: '16px', border: '1px solid #dbeafe', cursor: 'pointer', transition: 'transform 0.2s' }}>
                      <div style={{ fontSize: '24px', marginBottom: '8px' }}>📅</div>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: '#1e40af' }}>ดูประวัติงาน</div>
                      <div style={{ fontSize: '12px', color: '#60a5fa' }}>ตรวจสอบงานที่ได้รับมอบหมาย</div>
                    </div>
                    <div onClick={() => navigate('/worker-settings')} style={{ padding: '15px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'transform 0.2s' }}>
                      <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚙️</div>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: '#475569' }}>ตั้งค่าบัญชี</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>จัดการข้อมูลส่วนตัวของคุณ</div>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '30px', padding: '15px', background: '#fffbeb', borderRadius: '12px', border: '1px solid #fef3c7', fontSize: '13px', color: '#92400e', lineHeight: '1.6' }}>
                  <i className='bx bx-info-circle' style={{ marginRight: '5px' }}></i>
                  คะแนนนี้เป็นผลเบื้องต้น หัวหน้างานจะพิจารณาผลการทดสอบร่วมกับประวัติการทำงานจริงของคุณอีกครั้งเพื่อปรับระดับทักษะ (Level)
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default SkillAssessmentSummary;

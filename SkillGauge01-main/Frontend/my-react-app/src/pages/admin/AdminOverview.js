import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminOverview.css';
import { apiRequest } from '../../utils/api';

import StatCard from './components/StatCard';
import SkillDistributionChart from './components/SkillDistributionChart';
import RecentActivityList from './components/RecentActivityList';

const BRANCH_OPTIONS = [
  { value: 'structure', label: 'ช่างโครงสร้าง' },
  { value: 'plumbing', label: 'ช่างประปา' },
  { value: 'roofing', label: 'ช่างหลังคา' },
  { value: 'masonry', label: 'ช่างก่ออิฐฉาบปูน' },
  { value: 'aluminum', label: 'ช่างประตูหน้าต่างอลูมิเนียม' },
  { value: 'ceiling', label: 'ช่างฝ้าเพดาล' },
  { value: 'electric', label: 'ช่างไฟฟ้า' },
  { value: 'tiling', label: 'ช่างกระเบื้อง' }
];

// กำหนดชุดสีพาสเทล (Pastel Palette)
const PASTEL_COLORS = {
  high: { bg: '#86efac', text: '#1f2937' }, // Green 300 (Expert)
  mid:  { bg: '#fcd34d', text: '#1f2937' }, // Amber 300 (Intermediate)
  low:  { bg: '#fca5a5', text: '#1f2937' }  // Red 300 (Beginner)
};

const AdminOverview = () => {
  const navigate = useNavigate();

  // 1. ปรับ KPI เป็น Action-driven
  const [stats, setStats] = useState([
    { id: 'failed', label: 'ยังไม่ผ่านเกณฑ์', value: 0, unit: 'คน', color: 'red', insight: 'ต้องพัฒนาเร่งด่วน', filterSkill: 'failed' },
    { id: 'none', label: 'ยังไม่ได้ทดสอบ', value: 0, unit: 'คน', color: 'orange', insight: 'ควรมอบหมายการสอบ', filterSkill: 'none' },
    { id: 'passed', label: 'ผ่านเกณฑ์แล้ว', value: 0, unit: 'คน', color: 'green', insight: 'พร้อมทำงาน', filterSkill: 'passed' },
    { id: 'avg', label: 'ค่าเฉลี่ยทักษะองค์กร', value: 0, unit: '/ 100', color: 'blue', insight: 'ภาพรวม', filterSkill: 'all' },
  ]);

  const [pendingActions, setPendingActions] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [skillDistribution, setSkillDistribution] = useState([]);
  const [skillGapData, setSkillGapData] = useState([]);
  const [branchStats, setBranchStats] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [statusStats, setStatusStats] = useState({ probation: 0, permanent: 0, total: 0 });
  const [branchAverageScores, setBranchAverageScores] = useState([]);
  const [notEvaluatedStats, setNotEvaluatedStats] = useState([]);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // For refresh
  const [refreshKey, setRefreshKey] = useState(0);

  // Tooltip helper
  const [tooltip, setTooltip] = useState({ show: false, text: '', x: 0, y: 0 });

  useEffect(() => {
    let active = true;

    const loadOverview = async () => {
      try {
        setLoading(true);
        setError('');

        const queryParams = selectedBranch !== 'all' ? `?category=${selectedBranch}` : '';

        // Parallel Data Fetching
        const [
          workersRes, 
          statsRes, 
          gapRes, 
          pendingQuizRes, 
          expiringRes, 
          distRes, 
          logsRes
        ] = await Promise.allSettled([
          apiRequest(`/api/admin/workers${queryParams}`),
          apiRequest(`/api/admin/dashboard/stats${queryParams}`),
          apiRequest(`/api/admin/dashboard/skill-gap${queryParams}`),
          apiRequest('/api/admin/quizzes?status=pending'),
          apiRequest('/api/admin/assessments/expiring'),
          apiRequest(`/api/admin/dashboard/skill-distribution${queryParams}`),
          apiRequest('/api/admin/audit-logs?limit=5')
        ]);

        if (!active) {
          return;
        }

        // --- 1. Process Workers Data ---
        const workersData = workersRes.status === 'fulfilled' ? workersRes.value : [];
        const items = Array.isArray(workersData?.items) ? workersData.items : (Array.isArray(workersData) ? workersData : []);

        // กรองข้อมูลฝั่ง Client-side เพิ่มเติมเพื่อให้แน่ใจว่าแสดงผลถูกต้อง (กรณี API ไม่รองรับ Filter)
        const filteredItems = selectedBranch !== 'all' 
          ? items.filter(w => w.category === selectedBranch)
          : items;

        const totalWorkers = filteredItems.length;
        const pendingWorkers = filteredItems.filter(worker => worker.status === 'probation').length;
        
        setStatusStats({
          probation: pendingWorkers,
          permanent: totalWorkers - pendingWorkers,
          total: totalWorkers
        });
        
        // --- 2. Process Skill Gap ---
        if (gapRes.status === 'fulfilled') {
          const gapData = gapRes.value;
          setSkillGapData(Array.isArray(gapData) ? gapData : []);
        }

        // --- 3. Calculate KPI Stats ---
        // 1. ยังไม่ผ่านเกณฑ์: คนที่มีคะแนน < 60 (และมีคะแนนแล้ว)
        // 2. ยังไม่ได้ทดสอบ: คนที่ไม่มีคะแนน (score === undefined/null)
        // 3. ผ่านเกณฑ์แล้ว: คนที่มีคะแนน >= 60
        const failed = filteredItems.filter(w => w.score !== undefined && w.score !== null && w.score < 60).length;
        const none = filteredItems.filter(w => w.score === undefined || w.score === null).length;
        const passed = filteredItems.filter(w => w.score !== undefined && w.score !== null && w.score >= 60).length;
        // 4. ค่าเฉลี่ยทักษะองค์กร: คำนวณเฉพาะจากพนักงานที่ได้รับการประเมินแล้วเท่านั้น
        const evaluatedWorkersForAvg = filteredItems.filter(w => w.score !== undefined && w.score !== null);
        const avgScore = evaluatedWorkersForAvg.length > 0
          ? Math.round(evaluatedWorkersForAvg.reduce((sum, w) => sum + Number(w.score), 0) / evaluatedWorkersForAvg.length)
          : 0;

        setStats([
          {
            id: 'failed',
            label: 'ยังไม่ผ่านเกณฑ์',
            value: failed,
            unit: 'คน',
            color: 'red',
            insight: 'ต้องพัฒนาเร่งด่วน',
            filterSkill: 'failed',
          },
          {
            id: 'none',
            label: 'ยังไม่ได้ทดสอบ',
            value: none,
            unit: 'คน',
            color: 'orange',
            insight: 'ควรมอบหมายการสอบ',
            filterSkill: 'none',
          },
          {
            id: 'passed',
            label: 'ผ่านเกณฑ์แล้ว',
            value: passed,
            unit: 'คน',
            color: 'green',
            insight: 'พร้อมทำงาน',
            filterSkill: 'passed',
          },
          {
            id: 'avg',
            label: 'ค่าเฉลี่ยทักษะองค์กร',
            value: avgScore,
            unit: '/ 100',
            color: 'blue',
            insight: 'ภาพรวม',
            filterSkill: 'all',
          },
        ]);

        // --- 4. Pending Actions ---
        const actions = [];
        if (pendingWorkers > 0) {
          actions.push({ id: 'p1', title: 'ตรวจสอบเอกสารพนักงานใหม่', count: pendingWorkers, type: 'urgent', link: '/admin', state: { initialTab: 'users', filterStatus: 'probation' } });
        }

        // เพิ่ม Action: มอบหมายแบบทดสอบ (สำหรับคนที่ยังไม่ได้สอบ)
        if (none > 0) {
          actions.push({ 
            id: 'p_assess', title: 'มอบหมายแบบทดสอบ', count: none, type: 'warning', 
            link: '/admin', state: { initialTab: 'users', filterSkill: 'none' },
            insight: 'พนักงานยังไม่มีคะแนนประเมิน'
          });
        }
        
        if (pendingQuizRes.status === 'fulfilled') {
          const pendingQuizzesResponse = pendingQuizRes.value;
          const pendingQuizzes = Array.isArray(pendingQuizzesResponse?.items) 
            ? pendingQuizzesResponse.items 
            : Array.isArray(pendingQuizzesResponse) 
            ? pendingQuizzesResponse 
            : [];
          
          if (pendingQuizzes.length > 0) {
            actions.push({ 
              id: 'p2', 
              title: 'แบบทดสอบรอการอนุมัติ', 
              count: pendingQuizzes.length, 
              type: 'warning', 
              link: '/admin/pending-actions?tab=quizzes',
              details: pendingQuizzes
            });
          }
        }

        if (expiringRes.status === 'fulfilled') {
          const expiringAssessmentsResponse = expiringRes.value;
          const expiringAssessments = Array.isArray(expiringAssessmentsResponse?.items) 
            ? expiringAssessmentsResponse.items 
            : Array.isArray(expiringAssessmentsResponse) 
            ? expiringAssessmentsResponse 
            : [];
          
          if (expiringAssessments.length > 0) {
            actions.push({ 
              id: 'p3', 
              title: 'การประเมินที่ใกล้หมดอายุ', 
              count: expiringAssessments.length, 
              type: 'info', 
              link: '/admin/pending-actions?tab=assessments',
              details: expiringAssessments
            });
          }
        }

        setPendingActions(actions);

        // --- 5. Skill Distribution ---
        if (distRes.status === 'fulfilled') {
          const distributionData = distRes.value;
          
          if (Array.isArray(distributionData) && distributionData.length > 0) {
            // Override colors with pastel palette
            const coloredData = distributionData.map(item => {
              let color = PASTEL_COLORS.mid.bg;
              let filterKey = 'medium';
              if (item.level.includes('Expert') || item.level.includes('สูง')) color = PASTEL_COLORS.high.bg;
              if (item.level.includes('Beginner') || item.level.includes('ต่ำ')) color = PASTEL_COLORS.low.bg;
              
              if (item.level.includes('Expert') || item.level.includes('สูง')) filterKey = 'high';
              if (item.level.includes('Beginner') || item.level.includes('ต่ำ')) filterKey = 'low';

              return { ...item, color, filterKey };
            });
            setSkillDistribution(coloredData);
          } else {
            // Fallback: คำนวณจากข้อมูลพนักงานจริง (Real Data Consistency)
            let high = 0, mid = 0, low = 0;
            filteredItems.forEach(w => {
                const rawScore = w.score !== undefined ? w.score : w.evaluation_score;
                if (rawScore !== undefined && rawScore !== null) {
                    const score = Number(rawScore);
                    if (score >= 80) high++;
                    else if (score >= 60) mid++;
                    else low++;
                }
            });
            const total = (high + mid + low) || 1;
            setSkillDistribution([
              { name: 'ระดับ 3 (สูง)', value: high, percentage: Math.round((high/total)*100), color: PASTEL_COLORS.high.bg, filterKey: 'high' },
              { name: 'ระดับ 2 (กลาง)', value: mid, percentage: Math.round((mid/total)*100), color: PASTEL_COLORS.mid.bg, filterKey: 'medium' },
              { name: 'ระดับ 1 (ต่ำ)', value: low, percentage: Math.round((low/total)*100), color: PASTEL_COLORS.low.bg, filterKey: 'low' },
            ]);
          }
        } else {
          setSkillDistribution([]); // แสดงว่างดีกว่าแสดงข้อมูลปลอม
        }

        // --- 6. Branch Stats Calculation ---
        // Initialize branchMap with all 8 branches to ensure they appear even with 0 workers
        const branchMap = {};
        BRANCH_OPTIONS.forEach(opt => {
          branchMap[opt.label] = { name: opt.label, value: opt.value, total: 0, levels: { high: 0, mid: 0, low: 0 } };
        });
        // เพิ่มหมวดอื่นๆ เพื่อเก็บตกข้อมูลที่ไม่อยู่ใน 8 สาขาหลัก
        branchMap['อื่นๆ'] = { name: 'อื่นๆ', value: 'other', total: 0, levels: { high: 0, mid: 0, low: 0 } };

        const labelMap = BRANCH_OPTIONS.reduce((acc, curr) => ({ ...acc, [curr.value]: curr.label }), {});

        const branchScoreMap = {};
        const notEvaluatedMap = {};

        filteredItems.forEach(w => {
          let label = labelMap[w.category];
          if (!label) {
             // ถ้าไม่ตรงกับสาขาหลัก ให้ลงหมวดอื่นๆ
             label = 'อื่นๆ';
          }

          branchMap[label].total++;
          
          // ตรวจสอบคะแนนจริง (ไม่รวมคนที่ยังไม่มีคะแนน)
          const rawScore = w.score !== undefined ? w.score : w.evaluation_score;
          const hasScore = rawScore !== undefined && rawScore !== null;
          const score = hasScore ? Number(rawScore) : 0;

          // 1. จัดกลุ่มระดับทักษะ (รวมคนที่ไม่มีคะแนนเป็น Beginner/ต่ำ ไปก่อนตาม Logic เดิม)
          if (score >= 80) branchMap[label].levels.high++;
          else if (score >= 60) branchMap[label].levels.mid++;
          else branchMap[label].levels.low++;

          // 2. คำนวณคะแนนเฉลี่ย (เฉพาะคนที่มีคะแนน)
          if (hasScore) {
            if (!branchScoreMap[label]) branchScoreMap[label] = { sum: 0, count: 0 };
            branchScoreMap[label].sum += score;
            branchScoreMap[label].count++;
          } else {
            // 3. นับคนที่ยังไม่ได้รับการประเมิน
            if (!notEvaluatedMap[label]) notEvaluatedMap[label] = 0;
            notEvaluatedMap[label]++;
          }
        });
        // กรองสาขาที่มี 0 คนออก (Show only non-zero) ตาม Requirement ข้อ 4
        setBranchStats(Object.values(branchMap).filter(b => b.total > 0).sort((a, b) => b.total - a.total));

        // เตรียมข้อมูลกราฟคะแนนเฉลี่ย
        const avgScores = Object.keys(branchScoreMap).map(label => ({
            name: label,
            avg: Math.round(branchScoreMap[label].sum / branchScoreMap[label].count),
            count: branchScoreMap[label].count
        })).sort((a, b) => b.avg - a.avg);
        setBranchAverageScores(avgScores);

        // เตรียมข้อมูลคนรอประเมิน
        const notEval = Object.keys(notEvaluatedMap).map(label => ({
            name: label,
            count: notEvaluatedMap[label]
        })).sort((a, b) => b.count - a.count);
        setNotEvaluatedStats(notEval);

        // --- 7. Recent Activity ---
        const toDate = value => {
          if (!value) return null;
          const date = new Date(value);
          return Number.isNaN(date.getTime()) ? null : date;
        };

        const formatTimeAgo = date => {
          if (!(date instanceof Date)) {
            return 'เมื่อสักครู่';
          }
          const diffMs = Date.now() - date.getTime();
          if (diffMs <= 0) {
            return 'เมื่อสักครู่';
          }
          const minutes = Math.floor(diffMs / 60000);
          const hours = Math.floor(minutes / 60);
          const days = Math.floor(hours / 24);

          if (days > 0) {
            return `${days} วันที่แล้ว`;
          }
          if (hours > 0) {
            return `${hours} ชั่วโมงที่แล้ว`;
          }
          if (minutes > 0) {
            return `${minutes} นาทีที่แล้ว`;
          }
          return 'เมื่อสักครู่';
        };

        if (logsRes.status === 'fulfilled') {
          const logsResponse = logsRes.value;
          const logs = Array.isArray(logsResponse?.items) ? logsResponse.items : (Array.isArray(logsResponse) ? logsResponse : []);
          
          const mappedActivities = logs.map(log => ({
            id: log.id,
            user: log.user || log.username || 'System',
            action: log.action,
            type: log.action.toLowerCase().includes('login') ? 'login' : log.action.toLowerCase().includes('quiz') ? 'quiz' : 'system',
            time: formatTimeAgo(toDate(log.timestamp || log.created_at))
          }));
          setRecentActivities(mappedActivities);
        }

      } catch (error) {
        if (!active) {
          return;
        }
        console.error('Failed to load overview data', error);
        setError(error?.message || 'ไม่สามารถโหลดข้อมูลกิจกรรมได้');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadOverview();

    return () => {
      active = false;
    };
  }, [selectedBranch, refreshKey]);

  // Helper for Skill Donut Chart
  const totalEvaluated = skillDistribution.reduce((sum, item) => sum + (item.value || item.count || 0), 0);

  return (
    <div className="admin-overview">
      {/* Loading Indicator */}
      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(255,255,255,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '2rem', color: '#3182ce' }}>⏳ กำลังโหลดข้อมูล...</div>
        </div>
      )}
      {/* Error Message */}
      {error && (
        <div style={{ background: '#fed7d7', color: '#c53030', padding: '1rem', borderRadius: '8px', margin: '1rem 0', textAlign: 'center', fontWeight: 'bold' }}>
          {error}
        </div>
      )}
      <header className="admin-welcome-section">
        <div className="welcome-text">
          <h2>ภาพรวมระบบ</h2>
          <p>สรุปสถานะและข้อมูลสำคัญของระบบ Skill Gauge</p>
        </div>
        <div className="date-display">
          {new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
        {/* Quick Links */}
        <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
          <button onClick={() => setRefreshKey(k => k + 1)} style={{ background: '#3182ce', color: 'white', border: 'none', borderRadius: '6px', padding: '0.5rem 1rem', cursor: 'pointer' }}>🔄 รีเฟรชข้อมูล</button>
        </div>
      </header>

      {/* Filter Section */}
      <div className="filter-section" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <div className="branch-select-wrapper">
          <label htmlFor="branch-filter" className="branch-select-label">เลือกสาขา:</label>
          <select 
            id="branch-filter"
            value={selectedBranch} 
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="branch-select"
          >
            <option value="all">ทั้งหมด</option>
            {BRANCH_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 1. & 2. KPI Cards พร้อม Insight */}
      <div className="admin-stats-grid">
        {stats.map((stat, index) => (
          <div style={{ position: 'relative' }} key={index}>
            <StatCard 
              stat={stat}
              onClick={() => navigate('/admin', { state: { initialTab: 'users', filterSkill: stat.filterSkill, filterCategory: selectedBranch } })}
              onMouseEnter={e => setTooltip({ show: true, text: stat.insight, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setTooltip({ show: false, text: '', x: 0, y: 0 })}
            />
            {/* Tooltip */}
            {tooltip.show && tooltip.text === stat.insight && (
              <div style={{ position: 'fixed', top: tooltip.y + 10, left: tooltip.x + 10, background: '#2d3748', color: 'white', padding: '0.5rem 1rem', borderRadius: '6px', zIndex: 9999, fontSize: '0.9rem', pointerEvents: 'none' }}>{tooltip.text}</div>
            )}
          </div>
        ))}
      </div>

      <div className="overview-grid">
        {/* Left Column: Main Stats & Analysis */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <section className="overview-section" style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            {/* กราฟคะแนนเฉลี่ยรายสาขา (Average Score by Branch) */}
            <div>
              <h4 style={{ fontSize: '1rem', marginBottom: '1rem' }}>คะแนนเฉลี่ยรายสาขา</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {branchAverageScores.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#718096', padding: '1rem' }}>ยังไม่มีข้อมูลคะแนนสอบ</div>
                ) : (
                  branchAverageScores.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.9rem' }}>
                      <div style={{ width: '140px', fontWeight: '500', color: '#2d3748', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.name}
                      </div>
                      <div style={{ flex: 1, background: '#edf2f7', borderRadius: '4px', height: '20px', overflow: 'hidden', position: 'relative' }}>
                        <div style={{ 
                          width: `${item.avg}%`, 
                          height: '100%', 
                          background: item.avg >= 80 ? '#48bb78' : item.avg >= 60 ? '#ecc94b' : '#f56565',
                          borderRadius: '4px',
                          transition: 'width 0.5s ease'
                        }}></div>
                      </div>
                      <div style={{ width: '80px', textAlign: 'right', fontWeight: '600', color: '#2d3748' }}>
                        {item.avg} <span style={{ fontSize: '0.75rem', color: '#718096', fontWeight: 'normal' }}>/ 100</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            {/* รายการพนักงานรอการประเมิน (Pending Evaluation) */}
            {notEvaluatedStats.length > 0 && (
              <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #edf2f7' }}>
                <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#000000' }}>รอการประเมิน (ยังไม่ได้ทำแบบทดสอบ)</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                  {notEvaluatedStats.map((item, idx) => (
                    <div key={idx} style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e6cf03', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#e6cf03', fontWeight: '500', fontSize: '0.9rem' }}>{item.name}</span>
                      <span style={{ background: '#e6cf03', color: 'white', padding: '0.1rem 0.5rem', borderRadius: '99px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                        {item.count} คน
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
        {/* Right Column Wrapper */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Donut Chart: สัดส่วนพนักงาน */}
          <section className="overview-section" style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div className="section-header" style={{ marginBottom: '1.5rem' }}>
              <h3>สัดส่วนพนักงาน</h3>
              <span style={{ color: '#718096', fontSize: '0.9rem' }}>สถานะการจ้างงาน</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Donut Chart */}
              <div style={{ 
                width: '180px', height: '180px', borderRadius: '50%', 
                background: `conic-gradient(#48bb78 0% ${(statusStats.permanent/statusStats.total)*100}%, #ecc94b ${(statusStats.permanent/statusStats.total)*100}% 100%)`,
                position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem',
                cursor: 'pointer' 
              }} onClick={() => navigate('/admin', { state: { initialTab: 'users' } })} title="คลิกเพื่อดูรายชื่อพนักงานทั้งหมด">
                <div style={{ width: '140px', height: '140px', background: 'white', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                  <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2d3748', lineHeight: 1 }}>{statusStats.total}</span>
                  <span style={{ fontSize: '0.85rem', color: '#718096' }}>คนทั้งหมด</span>
                </div>
              </div>
              {/* Legend */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div 
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', cursor: 'pointer' }}
                  onClick={() => navigate('/admin', { state: { initialTab: 'users', filterStatus: 'permanent' } })}
                  title="คลิกเพื่อดูรายชื่อพนักงานที่ผ่านโปร"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#48bb78' }}></span>
                    <span style={{ color: '#4a5568' }}>พนักงานประจำ</span>
                  </div>
                  <div style={{ fontWeight: '600', color: '#2d3748' }}>
                    {statusStats.permanent} <span style={{ color: '#718096', fontWeight: '400', fontSize: '0.8rem' }}>({statusStats.total ? Math.round((statusStats.permanent/statusStats.total)*100) : 0}%)</span>
                  </div>
                </div>
                <div 
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', cursor: 'pointer' }}
                  onClick={() => navigate('/admin', { state: { initialTab: 'users', filterStatus: 'probation' } })}
                  title="คลิกเพื่อดูรายชื่อพนักงานทดลองงาน"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ecc94b' }}></span>
                    <span style={{ color: '#4a5568' }}>ทดลองงาน</span>
                  </div>
                  <div style={{ fontWeight: '600', color: '#2d3748' }}>
                    {statusStats.probation} <span style={{ color: '#718096', fontWeight: '400', fontSize: '0.8rem' }}>({statusStats.total ? Math.round((statusStats.probation/statusStats.total)*100) : 0}%)</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
          {/* Donut Chart: สัดส่วนระดับทักษะ */}
          <section className="overview-section" style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div className="section-header" style={{ marginBottom: '1.5rem' }}>
              <h3>สัดส่วนระดับทักษะ</h3>
              <span style={{ color: '#718096', fontSize: '0.9rem' }}>แบ่งตามผลการประเมิน</span>
            </div>
            <SkillDistributionChart 
              data={skillDistribution} 
              total={totalEvaluated}
              onFilter={(key) => navigate('/admin', { state: { initialTab: 'users', filterSkill: key, filterCategory: selectedBranch } })}
            />
          </section>
          {/* Pending Actions (Moved to Right Column) */}
          <section className="overview-section" style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div className="pending-actions-header">
              <h3>สิ่งที่ต้องดำเนินการ</h3>
              {pendingActions.length > 0 && (
                <button onClick={() => navigate('/admin/pending-actions')} className="btn-view-all">
                  ดูทั้งหมด
                </button>
              )}
            </div>
            <div className="pending-actions-list">
              {pendingActions.length === 0 ? (
                <div className="empty-pending" style={{ color: '#38a169', textAlign: 'center', padding: '1rem' }}>
                  ✅ ไม่มีรายการค้าง
                </div>
              ) : (
                pendingActions.map(action => (
                  <div key={action.id} 
                    onClick={() => navigate(action.link, { state: action.state })}
                    className={`pending-action-item ${action.type}`}
                  >
                    <div className="action-info">
                      <span className="action-icon">
                        {action.type === 'urgent' ? '🚨' : action.type === 'warning' ? '⚠️' : 'ℹ️'}
                      </span>
                      <span className="action-title">{action.title}</span>
                    </div>
                    <span className={`action-count ${action.type}`}>
                      {action.count}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
          {/* 3. กิจกรรมล่าสุด (History) */}
          <RecentActivityList 
            activities={recentActivities}
            loading={loading}
            error={error}
            onViewAll={() => navigate('/admin/audit-log')}
          />
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;

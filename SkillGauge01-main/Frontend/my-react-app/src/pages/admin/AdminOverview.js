import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminOverview.css';
import { apiRequest } from '../../utils/api';

import StatCard from './components/StatCard';
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

// ✅ ย้าย Lookup Map ออกมาข้างนอกเพื่อไม่ต้องสร้างใหม่ทุกครั้งที่ Render
const NORMALIZED_BRANCH_MAP = BRANCH_OPTIONS.reduce((acc, opt) => {
  acc[opt.value] = opt.label;
  acc[opt.value.toLowerCase()] = opt.label;
  acc[opt.label] = opt.label;
  return acc;
}, {});

// กำหนดชุดสีพาสเทล (Pastel Palette)
const PASTEL_COLORS = {
  level0: { bg: '#fca5a5', text: '#1f2937' }, // Red 300 (Fail)
  level1: { bg: '#fcd34d', text: '#1f2937' }, // Amber 300 (Basic)
  level2: { bg: '#93c5fd', text: '#1f2937' }, // Blue 300 (Intermediate)
  level3: { bg: '#86efac', text: '#1f2937' }  // Green 300 (High)
};

// Inline SVG icon components (use currentColor so CSS controls color)
const WarningIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M11 9h2v6h-2zm0 8h2v2h-2z"></path>
    <path d="M12.87 2.51c-.35-.63-1.4-.63-1.75 0l-9.99 18c-.17.31-.17.69.01.99.18.31.51.49.86.49h20c.35 0 .68-.19.86-.49a1 1 0 0 0 .01-.99zM3.7 20 12 5.06 20.3 20z"></path>
  </svg>
);

const PendingIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z"></path>
    <path d="M13 7h-2v6h6v-2h-4z"></path>
  </svg>
);

const PassedIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z"></path>
    <path d="M9.999 13.587 7.7 11.292l-1.412 1.416 3.713 3.705 7.294-7.295-1.414-1.414z"></path>
  </svg>
);

const TestingIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2a2 2 0 1 0 0 4 2 2 0 1 0 0-4M4 9h5v13h2v-7h2v7h2V9h5V7H4z"></path>
  </svg>
);

const AdminOverview = ({ setTab }) => {
  const navigate = useNavigate();

  // 1. ปรับ KPI เป็น Action-driven
  const [stats, setStats] = useState([
    { id: 'failed', label: 'ยังไม่ผ่านเกณฑ์', value: 0, unit: 'คน', color: 'red', insight: 'ต้องพัฒนาเร่งด่วน', filterSkill: 'failed', icon: <WarningIcon /> },
    { id: 'none', label: 'ยังไม่ได้ทดสอบ', value: 0, unit: 'คน', color: 'orange', insight: 'ควรมอบหมายการสอบ', filterSkill: 'none', icon: <PendingIcon /> },
    { id: 'passed', label: 'ผ่านเกณฑ์แล้ว', value: 0, unit: 'คน', color: 'green', insight: 'พร้อมทำงาน', filterSkill: 'passed', icon: <PassedIcon /> },
    { id: 'avg', label: 'กำลังทดสอบภาคปฏิบัติ', value: 0, unit: 'คน', color: 'blue', insight: 'มอบหมายงานปฏิบัติแล้ว', filterSkill: 'all', filterStatus: 'probation', icon: <TestingIcon /> },
  ]);

  const [pendingActions, setPendingActions] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [branchStats, setBranchStats] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [statusStats, setStatusStats] = useState({ probation: 0, permanent: 0, total: 0 });
  const [notEvaluatedStats, setNotEvaluatedStats] = useState([]);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // For refresh
  const [refreshKey, setRefreshKey] = useState(0);
  const [animateChart, setAnimateChart] = useState(false);

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
          pendingQuizRes, 
          logsRes,
          practicalTestingRes
        ] = await Promise.allSettled([
          apiRequest(`/api/admin/workers${queryParams}`),
          apiRequest('/api/admin/quizzes?status=pending'),
          apiRequest('/api/admin/audit-logs?page=1&limit=5'),
          apiRequest('/api/dashboard/practical-testing-count')
        ]);

        if (!active) {
          return;
        }

        // ✅ ตรวจสอบว่า API หลักทำงานได้หรือไม่
        if (workersRes.status === 'rejected') {
          throw new Error('ไม่สามารถเชื่อมต่อข้อมูลพนักงานได้ กรุณาตรวจสอบการเชื่อมต่อเซิร์ฟเวอร์');
        }

        // --- 1. Process Workers Data ---
        const workersData = workersRes.status === 'fulfilled' ? workersRes.value : [];
        const items = Array.isArray(workersData?.items) ? workersData.items : (Array.isArray(workersData) ? workersData : []);

        // กรองข้อมูลฝั่ง Client-side เพิ่มเติมเพื่อให้แน่ใจว่าแสดงผลถูกต้อง (กรณี API ไม่รองรับ Filter)
        const normalizeRole = (role) => String(role || '').trim().toLowerCase();
        const isWorkerRole = (role, category) => {
          const key = normalizeRole(role);
          if (!key && category) return true;
          if (key.includes('หัวหน้า') || key.includes('foreman') || key === 'fm' || key.includes('(fm)')) return false;
          if (key.includes('ผู้จัดการ') || key.includes('project_manager') || key === 'pm' || key.includes('(pm)')) return false;
          if (key.includes('worker') || key === 'wk' || key.includes('(wk)')) return true;
          if (key.includes('ช่าง')) return true;
          return false;
        };

        const roleFilteredItems = items.filter(w => isWorkerRole(w.role, w.category));
        const filteredItems = selectedBranch !== 'all'
          ? roleFilteredItems.filter(w => w.category === selectedBranch)
          : roleFilteredItems;

        const totalWorkers = filteredItems.length;
        const probationWorkers = filteredItems.filter(worker => worker.status === 'probation' || worker.status === 'active');
        const pendingWorkers = probationWorkers.length;
        
        // 🎯 ดึงข้อมูลการทดสอบภาคปฏิบัติจาก API เดียวกับหน้า PM
        const practicalTestingData = practicalTestingRes.status === 'fulfilled' ? practicalTestingRes.value : { count: 0 };
        const practicalCount = Number(practicalTestingData?.count ?? 0);
        
        setStatusStats({
          probation: pendingWorkers,
          permanent: totalWorkers - pendingWorkers,
          total: totalWorkers
        });
        
        // --- 2. Calculate KPI Stats ---
        // 1. ยังไม่ผ่านเกณฑ์: คนที่มีคะแนน < 60 (และมีคะแนนแล้ว)
        // 2. ยังไม่ได้ทดสอบ: คนที่ไม่มีคะแนน (score === undefined/null)
        // 3. ผ่านเกณฑ์แล้ว: คนที่มีคะแนน >= 60
        const failed = filteredItems.filter(w =>
          w.assessmentPassed === false ||
          (w.assessmentPassed === null || w.assessmentPassed === undefined) && w.score !== undefined && w.score !== null && Number(w.score) < 60
        ).length;
        const none = filteredItems.filter(w =>
          (w.assessmentPassed === null || w.assessmentPassed === undefined) && (w.score === undefined || w.score === null)
        ).length;
        const passed = filteredItems.filter(w =>
          w.assessmentPassed === true ||
          (w.assessmentPassed === null || w.assessmentPassed === undefined) && w.score !== undefined && w.score !== null && Number(w.score) >= 60
        ).length;

        setStats([
          {
            id: 'failed',
            label: 'ยังไม่ผ่านเกณฑ์',
            value: failed,
            unit: 'คน',
            color: 'red',
            insight: 'ต้องพัฒนาเร่งด่วน',
            filterSkill: 'failed',
            icon: <WarningIcon />
          },
          {
            id: 'none',
            label: 'ยังไม่ได้ทดสอบ',
            value: none,
            unit: 'คน',
            color: 'orange',
            insight: 'ควรมอบหมายการสอบ',
            filterSkill: 'none',
            icon: <PendingIcon />
          },
          {
            id: 'passed',
            label: 'ผ่านเกณฑ์แล้ว',
            value: passed,
            unit: 'คน',
            color: 'green',
            insight: 'พร้อมทำงาน',
            filterSkill: 'passed',
            icon: <PassedIcon />
          },
          {
            id: 'avg',
            label: 'กำลังทดสอบภาคปฏิบัติ',
            value: practicalCount,
            unit: 'คน',
            color: 'blue',
            insight: 'มอบหมายงานปฏิบัติแล้ว',
            filterSkill: 'all',
            filterStatus: 'probation',
            icon: <TestingIcon />
          },
        ]);

        // --- 3. Pending Actions ---
        const actions = [];
        if (pendingWorkers > 0) {
          actions.push({ id: 'p1', title: 'ตรวจสอบเอกสารพนักงานใหม่', count: pendingWorkers, type: 'urgent', link: '/admin', state: { initialTab: 'users', filterStatus: 'probation' } });
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

        setPendingActions(actions);

        // --- 4. Branch Stats Calculation ---
        // Initialize branchMap with all 8 branches to ensure they appear even with 0 workers
        const branchMap = {};
        BRANCH_OPTIONS.forEach(opt => {
          branchMap[opt.label] = {
            name: opt.label,
            value: opt.value,
            total: 0,
            levels: { level0: 0, level1: 0, level2: 0, level3: 0 }
          };
        });
        // เพิ่มหมวดอื่นๆ เพื่อเก็บตกข้อมูลที่ไม่อยู่ใน 8 สาขาหลัก
        branchMap['อื่นๆ'] = { name: 'อื่นๆ', value: 'other', total: 0, levels: { level0: 0, level1: 0, level2: 0, level3: 0 } };
        
        const branchScoreMap = {};
        const notEvaluatedMap = {};

        filteredItems.forEach(w => {
          const rawCat = (w.category || '').trim();
          let label = NORMALIZED_BRANCH_MAP[rawCat] || NORMALIZED_BRANCH_MAP[rawCat.toLowerCase()];

          if (!label || !branchMap[label]) {
             // ถ้าไม่ตรงกับสาขาหลัก หรือไม่มีใน map ให้ลงหมวดอื่นๆ
             label = 'อื่นๆ';
          }

          branchMap[label].total++;
          
          // ตรวจสอบคะแนนจริง (ไม่รวมคนที่ยังไม่มีคะแนน)
          const totalScore = w.assessmentTotalScore ?? null;
          const totalQuestions = w.assessmentTotalQuestions ?? null;
          const rawScore = w.score !== undefined ? w.score : w.evaluation_score;
          const scorePercent = totalScore !== null && totalQuestions
            ? (Number(totalScore) / Number(totalQuestions)) * 100
            : (rawScore !== undefined && rawScore !== null ? Number(rawScore) : null);
          const hasScore = scorePercent !== null && scorePercent !== undefined;

          // 1. จัดกลุ่มระดับทักษะ (นับเฉพาะคนที่มีคะแนนเท่านั้น)
          if (hasScore) {
            const isPassed = w.assessmentPassed === true
              ? true
              : w.assessmentPassed === false
                ? false
                : scorePercent >= 60;

            if (!isPassed) {
              branchMap[label].levels.level0++;
            } else {
              const assessedLevel = Number(w.assessmentRoundLevel);
              if (assessedLevel >= 3) {
                branchMap[label].levels.level3++;
              } else if (assessedLevel === 2) {
                branchMap[label].levels.level2++;
              } else {
                branchMap[label].levels.level1++;
              }
            }
          }

          // 2. คำนวณคะแนนเฉลี่ย (เฉพาะคนที่มีคะแนน)
          if (hasScore) {
            if (!branchScoreMap[label]) branchScoreMap[label] = { sum: 0, count: 0 };
            branchScoreMap[label].sum += scorePercent;
            branchScoreMap[label].count++;
          } else {
            // 3. นับคนที่ยังไม่ได้รับการประเมิน
            if (!notEvaluatedMap[label]) notEvaluatedMap[label] = 0;
            notEvaluatedMap[label]++;
          }
        });
        // แสดงครบทั้ง 8 สาขาหลักเสมอ (แม้มี 0 คน)
        setBranchStats(
          Object.values(branchMap)
            .filter(b => b.value !== 'other')
            .sort((a, b) => b.total - a.total)
        );

        // เตรียมข้อมูลกราฟคะแนนเฉลี่ย
        // เตรียมข้อมูลคนรอประเมิน
        const notEval = Object.keys(notEvaluatedMap).map(label => ({
          name: label,
          value: branchMap[label]?.value || 'other',
          count: notEvaluatedMap[label]
        })).sort((a, b) => b.count - a.count);
        setNotEvaluatedStats(notEval);

        // --- 6. Recent Activity ---
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
          
          const mappedActivities = logs.map(log => {
            const action = log.action ? String(log.action) : 'System Action';
            return {
              id: log.id,
              user: log.user || log.username || 'System',
              action: action,
              type: action.toLowerCase().includes('login') ? 'login' : action.toLowerCase().includes('quiz') ? 'quiz' : 'system',
              time: formatTimeAgo(toDate(log.timestamp || log.created_at))
            };
          });

          if (mappedActivities.length > 0) {
            setRecentActivities(mappedActivities);
          } else {
            const fallback = filteredItems
              .filter(item => item.startDate)
              .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
              .slice(0, 5)
              .map(item => ({
                id: item.id,
                user: item.name || 'System',
                action: 'ลงทะเบียนพนักงานใหม่',
                type: 'system',
                time: formatTimeAgo(toDate(item.startDate))
              }));
            setRecentActivities(fallback);
          }
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

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setAnimateChart(true), 100);
      return () => clearTimeout(timer);
    } else {
      setAnimateChart(false);
    }
  }, [loading]);

  return (
    <div className="admin-overview">
      {/* Loading Indicator */}
      {loading && (
        <div className="admin-loading-overlay">
          <div className="admin-loading-text">⏳ กำลังโหลดข้อมูล...</div>
        </div>
      )}
      {/* Error Message */}
      {error && (
        <div className="admin-error-message">
          {error}
        </div>
      )}
      <header className="admin-welcome-section">
        <div className="welcome-text">
          <h2>Dashboard</h2>
          <p>สรุปสถานะและข้อมูลสำคัญของระบบ Skill Gauge</p>
        </div>
        <div className="date-display">
          {new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
        
      </header>
      {/* 1. & 2. KPI Cards พร้อม Insight */}
      <div className="admin-stats-grid">
        {stats.map((stat, index) => (
          <div className="stat-card-wrapper" key={index}>
            <StatCard 
              stat={stat}
              onClick={() => navigate('/admin', { 
                state: { 
                  initialTab: 'users', 
                  filterSkill: stat.filterSkill, 
                  filterStatus: stat.filterStatus, 
                  filterCategory: selectedBranch 
                } 
              })}
              onMouseEnter={e => setTooltip({ show: true, text: stat.insight, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setTooltip({ show: false, text: '', x: 0, y: 0 })}
            />
            {/* Tooltip */}
            {tooltip.show && tooltip.text === stat.insight && (
              <div className="branch-tooltip" style={{ top: tooltip.y + 10, left: tooltip.x + 10 }}>{tooltip.text}</div>
            )}
          </div>
        ))}
      </div>

      <div className="overview-grid">
        {/* Left Column: Main Stats & Analysis */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* New Section: Stacked Bar Chart for Branch Skills */}
          <section className="overview-section branch-section">
            <div className="section-header branch-section-header">
              <h3>จำนวนพนักงานแยกตามทักษะ</h3>
              <span className="branch-section-subtitle">แบ่งตามสาขาและระดับ</span>
            </div>
            
            {branchStats.length === 0 ? (
               <div className="branch-empty-state">ไม่มีข้อมูล</div>
            ) : (
              <div className="branch-list">
                {branchStats.map((branch, idx) => {
                  const maxTotal = Math.max(...branchStats.map(b => b.total));
                  const barWidthPercent = maxTotal > 0 ? (branch.total / maxTotal) * 100 : 0;
                  
                  return (
                    <div 
                      key={idx}
                      onClick={() => navigate('/admin', { state: { initialTab: 'users', filterCategory: branch.value } })}
                      className="branch-item"
                      title={`คลิกเพื่อดูรายชื่อพนักงานสาขา ${branch.name}`}
                    >
                      <div className="branch-item-header">
                        <span>{branch.name}</span>
                        <span>{branch.total} คน</span>
                      </div>
                      <div className="branch-bar-container">
                         <div className="branch-bar-animated" style={{ 
                           width: `${animateChart ? barWidthPercent : 0}%`, 
                           transitionDelay: `${idx * 0.1}s`
                         }}>
                            {branch.levels.level0 > 0 && <div style={{ width: `${(branch.levels.level0 / branch.total) * 100}%`, background: PASTEL_COLORS.level0.bg }} title={`ระดับ 0 (ต่ำ): ${branch.levels.level0} คน`} />}
                            {branch.levels.level1 > 0 && <div style={{ width: `${(branch.levels.level1 / branch.total) * 100}%`, background: PASTEL_COLORS.level1.bg }} title={`ระดับ 1 (พื้นฐาน): ${branch.levels.level1} คน`} />}
                            {branch.levels.level2 > 0 && <div style={{ width: `${(branch.levels.level2 / branch.total) * 100}%`, background: PASTEL_COLORS.level2.bg }} title={`ระดับ 2 (กลาง): ${branch.levels.level2} คน`} />}
                            {branch.levels.level3 > 0 && <div style={{ width: `${(branch.levels.level3 / branch.total) * 100}%`, background: PASTEL_COLORS.level3.bg }} title={`ระดับ 3 (สูง): ${branch.levels.level3} คน`} />}
                         </div>
                      </div>
                    </div>
                  );
                })}
                
                <div className="branch-legend">
                    <div className="branch-legend-item"><span className="branch-legend-dot" style={{ background: PASTEL_COLORS.level0.bg }}></span> ระดับ 0 (ต่ำ)</div>
                    <div className="branch-legend-item"><span className="branch-legend-dot" style={{ background: PASTEL_COLORS.level1.bg }}></span> ระดับ 1 (พื้นฐาน)</div>
                    <div className="branch-legend-item"><span className="branch-legend-dot" style={{ background: PASTEL_COLORS.level2.bg }}></span> ระดับ 2 (กลาง)</div>
                    <div className="branch-legend-item"><span className="branch-legend-dot" style={{ background: PASTEL_COLORS.level3.bg }}></span> ระดับ 3 (สูง)</div>
                </div>
              </div>
            )}
          </section>

          <section className="overview-section" style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            {/* รายการพนักงานรอการประเมิน (Pending Evaluation) */}
            {notEvaluatedStats.length > 0 && (
              <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #edf2f7' }}>
                <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#000000' }}>รอการประเมิน (ยังไม่ได้ทำแบบทดสอบ)</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                  {notEvaluatedStats.map((item, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => navigate('/admin', { state: { initialTab: 'users', filterSkill: 'none', filterCategory: item.value } })}
                      style={{ 
                        background: '#ffffff', 
                        padding: '0.75rem', 
                        borderRadius: '8px', 
                        border: '1px solid #e6cf03', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 6px rgba(230, 207, 3, 0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
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
              {/* Donut Chart (SVG) */}
              <div 
                style={{ position: 'relative', width: '180px', height: '180px', marginBottom: '1.5rem', cursor: 'pointer' }}
                onClick={() => navigate('/admin', { state: { initialTab: 'users' } })} 
                title="คลิกเพื่อดูรายชื่อพนักงานทั้งหมด"
              >
                <svg width="180" height="180" viewBox="0 0 180 180">
                  {/* Background Circle */}
                  <circle cx="90" cy="90" r="70" fill="none" stroke="#edf2f7" strokeWidth="20" />
                  
                  {/* Permanent Segment (Green) */}
                  <circle 
                    cx="90" cy="90" r="70" fill="none" stroke="#48bb78" strokeWidth="20"
                    strokeDasharray={`${animateChart ? (2 * Math.PI * 70 * (statusStats.permanent / (statusStats.total || 1))) : 0} ${2 * Math.PI * 70}`}
                    strokeDashoffset="0"
                    transform="rotate(-90 90 90)"
                    style={{ transition: 'stroke-dasharray 1s ease-out' }}
                  />
                  
                  {/* Probation Segment (Yellow) */}
                  <circle 
                    cx="90" cy="90" r="70" fill="none" stroke="#ecc94b" strokeWidth="20"
                    strokeDasharray={`${animateChart ? (2 * Math.PI * 70 * (statusStats.probation / (statusStats.total || 1))) : 0} ${2 * Math.PI * 70}`}
                    strokeDashoffset="0"
                    transform={`rotate(${-90 + (360 * (statusStats.permanent / (statusStats.total || 1)))} 90 90)`}
                    style={{ transition: 'stroke-dasharray 1s ease-out' }}
                  />
                </svg>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2d3748', lineHeight: 1, display: 'block' }}>{statusStats.total}</span>
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
                  ยังไม่มีการแจ้งเตือน
                </div>
              ) : (
                pendingActions.map(action => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => navigate(action.link, { state: action.state })}
                    className={`pending-action-item ${action.type}`}
                    style={{ width: '100%', textAlign: 'left' }}
                  >
                    <div className="action-info">
                      <span className="action-icon">
                        {action.type === 'urgent' ? '' : action.type === 'warning' ? '⚠️' : 'ℹ️'}
                      </span>
                      <span className="action-title">{action.title}</span>
                    </div>
                    <span className={`action-count ${action.type}`}>
                      {action.count}
                    </span>
                  </button>
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

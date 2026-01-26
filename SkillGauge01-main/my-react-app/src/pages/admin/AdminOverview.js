import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminOverview.css';
import { apiRequest } from '../../utils/api';

const BRANCH_OPTIONS = [
  { value: 'structure', label: 'ช่างโครงสร้าง' },
  { value: 'plumbing', label: 'ช่างประปา' },
  { value: 'roofing', label: 'ช่างหลังคา' },
  { value: 'masonry', label: 'ช่างก่ออิฐฉาบปูน' },
  { value: 'aluminum', label: 'ช่างอลูมิเนียม' },
  { value: 'ceiling', label: 'ช่างฝ้าเพดาล' },
  { value: 'electric', label: 'ช่างไฟฟ้า' },
  { value: 'tiling', label: 'ช่างกระเบื้อง' },
  { value: 'WELDER', label: 'ช่างเชื่อม' },
  { value: 'LANDSCAPER', label: 'ช่างภูมิทัศน์' },
  { value: 'CARPENTER', label: 'ช่างไม้' },
  { value: 'TILER', label: 'ช่างกระเบื้อง' },
  { value: 'HVAC_TECH', label: 'ช่างระบบปรับอากาศ' },
  { value: 'ELECTRICIAN', label: 'ช่างไฟฟ้า' },
  { value: 'MASON', label: 'ช่างก่ออิฐ' },
  { value: 'steel', label: 'ช่างเหล็ก' }
];

// กำหนดชุดสีพาสเทล (Pastel Palette)
const PASTEL_COLORS = {
  high: { bg: '#86efac', text: '#1f2937' }, // Green 300 (Expert)
  mid:  { bg: '#fcd34d', text: '#1f2937' }, // Amber 300 (Intermediate)
  low:  { bg: '#fca5a5', text: '#1f2937' }  // Red 300 (Beginner)
};

const AdminOverview = () => {
  const navigate = useNavigate();

  // 1. ปรับ KPI ให้สะท้อน "คุณค่าหลัก" (Skill & Performance)
  const [stats, setStats] = useState([
    { label: 'ดัชนีทักษะรวม', value: 0, unit: '/ 100', change: '-', trend: 'neutral', color: 'blue', insight: 'กำลังประมวลผล...' },
    { label: 'ความพร้อมบุคลากร', value: 0, unit: '%', change: '-', trend: 'neutral', color: 'green', insight: 'กำลังประมวลผล...' },
    { label: 'พนักงานที่ต้องพัฒนา', value: 0, unit: 'คน', change: '-', trend: 'neutral', color: 'red', insight: 'กำลังประมวลผล...' },
    { label: 'ทักษะที่ควรเร่งเสริม', value: '-', unit: '', change: '', trend: 'neutral', color: 'orange', insight: 'กำลังประมวลผล...' },
  ]);

  const [pendingActions, setPendingActions] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [skillDistribution, setSkillDistribution] = useState([]);
  const [skillGapData, setSkillGapData] = useState([]);
  const [branchStats, setBranchStats] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [activitiesError, setActivitiesError] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [statusStats, setStatusStats] = useState({ probation: 0, permanent: 0, total: 0 });
  const [branchAverageScores, setBranchAverageScores] = useState([]);
  const [notEvaluatedStats, setNotEvaluatedStats] = useState([]);

  useEffect(() => {
    let active = true;

    const loadOverview = async () => {
      try {
        setActivitiesLoading(true);
        setActivitiesError('');

        const queryParams = selectedBranch !== 'all' ? `?category=${selectedBranch}` : '';

        const response = await apiRequest(`/api/admin/workers${queryParams}`);
        const items = Array.isArray(response?.items)
          ? response.items
          : Array.isArray(response)
            ? response
            : [];

        console.log('📊 [AdminOverview] Workers Data:', { totalWorkers: items.length, items });

        if (!active) {
          return;
        }

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
        
        // --- ดึงข้อมูล KPI จาก API ---
        let kpiData = {
          avgScore: 0,
          passRate: 0,
          belowThreshold: 0,
          weakestSkill: '-',
          trend: { avgScore: '-', passRate: '-', belowThreshold: '-' }
        };

        try {
          const statsResponse = await apiRequest(`/api/admin/dashboard/stats${queryParams}`);
          console.log('📈 [AdminOverview] Dashboard Stats API Response:', statsResponse);
          if (statsResponse) {
            kpiData = {
              avgScore: statsResponse.avgScore || 0,
              passRate: statsResponse.passRate || 0,
              belowThreshold: statsResponse.belowThreshold || 0,
              weakestSkill: statsResponse.weakestSkill || '-',
              trend: statsResponse.trend || { avgScore: '-', passRate: '-', belowThreshold: '-' }
            };
            console.log('✅ [AdminOverview] KPI Data from API:', kpiData);
          }
        } catch (err) {
          console.warn('⚠️ [AdminOverview] Failed to fetch dashboard stats, using fallback', err);
          // Fallback กรณี API ยังไม่พร้อม
          kpiData.avgScore = totalWorkers > 0 ? 72 : 0;
        }

        // --- ดึงข้อมูล Skill Gap Analysis จาก API ใหม่ ---
        try {
          const gapData = await apiRequest(`/api/admin/dashboard/skill-gap${queryParams}`);
          console.log('🎯 [AdminOverview] Skill Gap API Response:', gapData);
          setSkillGapData(Array.isArray(gapData) ? gapData : []);
        } catch (err) {
          console.warn('⚠️ [AdminOverview] Failed to fetch skill gap data', err);
        }

        setStats([
          { 
            label: 'ดัชนีทักษะรวม', value: kpiData.avgScore, unit: '/ 100', 
            change: kpiData.trend.avgScore, trend: kpiData.trend.avgScore.includes('+') ? 'up' : 'down', color: 'blue', 
            insight: 'คะแนนเฉลี่ยภาพรวมองค์กร' 
          },
          { 
            label: 'ความพร้อมบุคลากร', value: kpiData.passRate, unit: '%', 
            change: kpiData.trend.passRate, trend: kpiData.trend.passRate.includes('+') ? 'up' : 'down', color: 'green', 
            insight: 'สัดส่วนผู้ผ่านเกณฑ์มาตรฐาน' 
          },
          { 
            label: 'พนักงานที่ต้องพัฒนา', value: kpiData.belowThreshold, unit: 'คน', 
            change: kpiData.trend.belowThreshold, trend: kpiData.trend.belowThreshold.includes('-') ? 'up' : 'down', color: 'red', 
            insight: 'กลุ่มเป้าหมายสำหรับการอบรม' 
          },
          { 
            label: 'ทักษะที่ควรเร่งเสริม', value: kpiData.weakestSkill, unit: '', 
            change: 'Priority', trend: 'neutral', color: 'orange', 
            insight: 'หมวดหมู่ที่มีคะแนนเฉลี่ยต่ำสุด' 
          },
        ]);

        // --- 3. สร้างรายการสิ่งที่ต้องดำเนินการ (Pending Actions) ---
        const actions = [];
        if (pendingWorkers > 0) {
          actions.push({ id: 'p1', title: 'ตรวจสอบเอกสารพนักงานใหม่', count: pendingWorkers, type: 'urgent', link: '/admin', state: { initialTab: 'users' } });
        }
        
        // ดึงข้อมูลแบบทดสอบรอการอนุมัติ
        try {
          const pendingQuizzesResponse = await apiRequest('/api/admin/quizzes?status=pending');
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
        } catch (err) {
          console.warn('Failed to fetch pending quizzes', err);
        }

        // ดึงข้อมูลการประเมินที่ใกล้หมดอายุ
        try {
          const expiringAssessmentsResponse = await apiRequest('/api/admin/assessments/expiring');
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
        } catch (err) {
          console.warn('Failed to fetch expiring assessments', err);
        }

        setPendingActions(actions);

        // --- 4. ดึงข้อมูล Skill Distribution จาก API ---
        try {
          const distributionData = await apiRequest(`/api/admin/dashboard/skill-distribution${queryParams}`);
          console.log('📊 [AdminOverview] Skill Distribution API Response:', distributionData);
          
          if (Array.isArray(distributionData) && distributionData.length > 0) {
            // Override colors with pastel palette
            const coloredData = distributionData.map(item => {
              let color = PASTEL_COLORS.mid.bg;
              if (item.level.includes('Expert') || item.level.includes('สูง')) color = PASTEL_COLORS.high.bg;
              if (item.level.includes('Beginner') || item.level.includes('ต่ำ')) color = PASTEL_COLORS.low.bg;
              return { ...item, color };
            });
            setSkillDistribution(coloredData);
            console.log('✅ [AdminOverview] Skill Distribution (from API):', distributionData);
          } else {
            // Fallback: คำนวณจากข้อมูลพนักงานจริง (Real Data Consistency)
            let high = 0, mid = 0, low = 0;
            filteredItems.forEach(w => {
                const score = w.score !== undefined ? w.score : (w.evaluation_score || 0);
                if (score >= 80) high++;
                else if (score >= 60) mid++;
                else low++;
            });
            const total = filteredItems.length || 1;
            setSkillDistribution([
              { level: 'สูง', count: high, percentage: Math.round((high/total)*100), color: PASTEL_COLORS.high.bg },
              { level: 'กลาง', count: mid, percentage: Math.round((mid/total)*100), color: PASTEL_COLORS.mid.bg },
              { level: 'ต่ำ', count: low, percentage: Math.round((low/total)*100), color: PASTEL_COLORS.low.bg },
            ]);
          }
        } catch (err) {
          console.warn('⚠️ [AdminOverview] Failed to fetch skill distribution, using fallback', err);
          setSkillDistribution([]); // แสดงว่างดีกว่าแสดงข้อมูลปลอม
        }

        // --- 5. คำนวณสถิติแยกตามสาขา (Branch Stats) ---
        const branchMap = {};
        const labelMap = {
            'other': 'อื่นๆ',
            ...BRANCH_OPTIONS.reduce((acc, curr) => ({ ...acc, [curr.value]: curr.label }), {}),
            'PLUMBER': 'ช่างประปา',
            'PAINTER': 'ช่างทาสี'
        };

        const branchScoreMap = {};
        const notEvaluatedMap = {};

        filteredItems.forEach(w => {
          const rawCat = w.category || 'other';
          const label = labelMap[rawCat] || (rawCat === 'other' ? 'อื่นๆ' : rawCat);
          
          if (!branchMap[label]) {
            branchMap[label] = { name: label, total: 0, levels: { high: 0, mid: 0, low: 0 } };
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
        setBranchStats(Object.values(branchMap).sort((a, b) => b.total - a.total));

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

        // --- จัดการ Recent Activity ---
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

        // ดึงข้อมูล Audit Log ล่าสุดจาก API แทนการสร้างเอง
        try {
          const logsResponse = await apiRequest('/api/admin/audit-logs?limit=5');
          console.log('📝 [AdminOverview] Audit Logs API Response:', logsResponse);
          const logs = Array.isArray(logsResponse?.items) ? logsResponse.items : (Array.isArray(logsResponse) ? logsResponse : []);
          
          const mappedActivities = logs.map(log => ({
            id: log.id,
            user: log.user || log.username || 'System',
            action: log.action,
            type: log.action.toLowerCase().includes('login') ? 'login' : log.action.toLowerCase().includes('quiz') ? 'quiz' : 'system',
            time: formatTimeAgo(toDate(log.timestamp || log.created_at))
          }));
          console.log('✅ [AdminOverview] Recent Activities (from API):', mappedActivities);
          setRecentActivities(mappedActivities);
        } catch (logErr) {
          console.warn('⚠️ [AdminOverview] Failed to fetch audit logs', logErr);
          setRecentActivities([]); 
        }
      } catch (error) {
        if (!active) {
          return;
        }
        console.error('Failed to load overview data', error);
        setActivitiesError(error?.message || 'ไม่สามารถโหลดข้อมูลกิจกรรมได้');
      } finally {
        if (active) {
          setActivitiesLoading(false);
        }
      }
    };

    loadOverview();

    return () => {
      active = false;
    };
  }, [selectedBranch]);

  return (
    <div className="admin-overview">
      <header className="admin-welcome-section">
        <div className="welcome-text">
          <h2>ภาพรวมระบบ</h2>
          <p>สรุปสถานะและข้อมูลสำคัญของระบบ Skill Gauge</p>
        </div>
        <div className="date-display">
          {new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </header>

      {/* Filter Section */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', padding: '0.5rem 1rem', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <label htmlFor="branch-filter" style={{ fontSize: '0.9rem', color: '#4a5568', fontWeight: '500' }}>เลือกสาขา:</label>
          <select 
            id="branch-filter"
            value={selectedBranch} 
            onChange={(e) => setSelectedBranch(e.target.value)}
            style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '0.25rem 0.5rem', fontSize: '0.9rem', color: '#2d3748', outline: 'none' }}
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
          <div key={index} className={`stat-card stat-card--${stat.color}`}>
            <div className="stat-icon-wrapper">
              {/* Simple icons based on color/context */}
              {stat.color === 'blue' && <span className="stat-icon"><svg  xmlns="http://www.w3.org/2000/svg" width={24} height={24} fill={"currentColor"} viewBox="0 0 24 24">{/* Boxicons v3.0.6 https://boxicons.com | License  https://docs.boxicons.com/free */}<path d="m10,13h-2c-2.76,0-5,2.24-5,5v1c0,.55.45,1,1,1h10c.55,0,1-.45,1-1v-1c0-2.76-2.24-5-5-5Zm-5,5c0-1.65,1.35-3,3-3h2c1.65,0,3,1.35,3,3H5Z"></path><path d="m12.73,6.51c-.08-.22-.19-.42-.3-.62,0,0,0,0,0-.01-.69-1.14-1.93-1.89-3.42-1.89-2.28,0-4,1.72-4,4s1.72,4,4,4c1.49,0,2.73-.74,3.42-1.89,0,0,0,0,0-.01.12-.2.22-.4.3-.62.02-.06.03-.12.05-.18.06-.17.11-.34.15-.52.05-.25.07-.51.07-.78s-.03-.53-.07-.78c-.03-.18-.09-.35-.15-.52-.02-.06-.03-.12-.05-.18Zm-3.73,3.49c-1.18,0-2-.82-2-2s.82-2,2-2,2,.82,2,2-.82,2-2,2Z"></path><path d="m15,10c-.11,0-.22-.01-.33-.03-.22.66-.56,1.27-.98,1.81.41.13.84.22,1.31.22,2.28,0,4-1.72,4-4s-1.72-4-4-4c-.47,0-.9.09-1.31.22.43.53.76,1.14.98,1.81.11-.01.21-.03.33-.03,1.18,0,2,.82,2,2s-.82,2-2,2Z"></path><path d="m16,13h-1.11c.6.58,1.08,1.27,1.44,2.03,1.5.17,2.67,1.43,2.67,2.97h-2v1c0,.35-.07.69-.18,1h3.18c.55,0,1-.45,1-1v-1c0-2.76-2.24-5-5-5Z"></path></svg></span>}
              {stat.color === 'orange' && <span className="stat-icon"><svg  xmlns="http://www.w3.org/2000/svg" width={24} height={24} fill={"currentColor"} viewBox="0 0 24 24">{/* Boxicons v3.0.6 https://boxicons.com | License  https://docs.boxicons.com/free */}<path d="m19,3H5c-1.1,0-2,.9-2,2v14c0,1.1.9,2,2,2h14c1.1,0,2-.9,2-2V5c0-1.1-.9-2-2-2ZM5,19V5h14v14s-14,0-14,0Z"></path><path d="M8.5 10.5A1.5 1.5 0 1 0 8.5 13.5 1.5 1.5 0 1 0 8.5 10.5z"></path><path d="M11 11H17V13H11z"></path><path d="M7 7H17V9H7z"></path><path d="M7 15H17V17H7z"></path></svg></span>}
              {stat.color === 'green' && <span className="stat-icon"><svg  xmlns="http://www.w3.org/2000/svg" width={24} height={24} fill={"currentColor"} viewBox="0 0 24 24">{/* Boxicons v3.0.6 https://boxicons.com | License  https://docs.boxicons.com/free */}<path d="M2 20H22V22H2z"></path><path d="m18,8h-4c-.55,0-1,.45-1,1v8c0,.55.45,1,1,1h4c.55,0,1-.45,1-1v-8c0-.55-.45-1-1-1Zm-1,8h-2v-6h2v6Z"></path><path d="m10,2h-4c-.55,0-1,.45-1,1v14c0,.55.45,1,1,1h4c.55,0,1-.45,1-1V3c0-.55-.45-1-1-1Zm-1,14h-2V4h2v12Z"></path></svg></span>}
              {stat.color === 'purple' && <span className="stat-icon"><svg  xmlns="http://www.w3.org/2000/svg" width={24} height={24} fill={"currentColor"} viewBox="0 0 24 24">{/* Boxicons v3.0.6 https://boxicons.com | License  https://docs.boxicons.com/free */}<path d="M4 8c0 2.28 1.72 4 4 4s4-1.72 4-4-1.72-4-4-4-4 1.72-4 4m6 0c0 1.18-.82 2-2 2s-2-.82-2-2 .82-2 2-2 2 .82 2 2M3 20h10c.55 0 1-.45 1-1v-1c0-2.76-2.24-5-5-5H7c-2.76 0-5 2.24-5 5v1c0 .55.45 1 1 1m4-5h2c1.65 0 3 1.35 3 3H4c0-1.65 1.35-3 3-3M12.29 11.71l3 3c.2.2.45.29.71.29s.51-.1.71-.29l5-5L20.3 8.3l-4.29 4.29-2.29-2.29-1.41 1.41Z"></path></svg></span>}
            </div>
            <div className="stat-card__content">
              <span className="stat-card__label">{stat.label}</span>
              <div className="stat-card__value-group">
                <span className="stat-card__value">{stat.value}</span>
                <span className="stat-card__unit">{stat.unit}</span>
              </div>
              {/* Insight Text */}
              <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: '#718096', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {stat.trend === 'up' && <span style={{ color: '#48bb78' }}>▲ {stat.change}</span>}
                {stat.trend === 'down' && <span style={{ color: '#f56565' }}>▼ {stat.change}</span>}
                <span>{stat.insight}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-content-grid" style={{ display: 'grid', gridTemplateColumns: '7fr 3fr', gap: '1.5rem', marginTop: '2rem', alignItems: 'start' }}>
        
        {/* Left Column: Main Stats & Analysis */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <section className="overview-section" style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <div className="section-header" style={{ marginBottom: '1.5rem' }}>
            <h3>การกระจายระดับทักษะ</h3>
            <p style={{ color: '#718096', fontSize: '0.9rem' }}>ภาพรวมความสามารถของพนักงานทั้งองค์กร</p>
          </div>
          
          <div className="skill-chart-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {skillDistribution.map((item, idx) => (
              <div key={idx} className="skill-bar-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
                  <span>{item.level}</span>
                  <span>{item.count} คน ({item.percentage}%)</span>
                </div>
                <div style={{ width: '100%', height: '12px', background: '#edf2f7', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ width: `${item.percentage}%`, height: '100%', background: item.color, borderRadius: '6px', transition: 'width 1s ease-in-out' }}></div>
                </div>
              </div>
            ))}
          </div>

          {/* กราฟแสดงจำนวนช่างแยกตามสาขาและระดับ (Branch & Level Visualization) */}
          <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #edf2f7' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ fontSize: '1rem', margin: 0 }}>จำนวนช่างแยกตามสาขาและระดับทักษะ</h4>
              <button 
                onClick={() => {
                  if (branchStats.length === 0) return;
                  const headers = ['สาขา', 'จำนวนรวม', 'สูง', 'กลาง', 'ต่ำ'];
                  const rows = branchStats.map(b => [`"${b.name}"`, b.total, b.levels.high, b.levels.mid, b.levels.low]);
                  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.setAttribute('download', `branch_stats_${new Date().toISOString().slice(0,10)}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                disabled={branchStats.length === 0}
                style={{ fontSize: '0.85rem', padding: '0.25rem 0.75rem', borderRadius: '4px', border: '1px solid #cbd5e0', background: 'white', color: '#4a5568', cursor: 'pointer' }}
              >
                Export CSV
              </button>
            </div>
            <div className="branch-stats-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {branchStats.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#718096', padding: '1rem' }}>ไม่พบข้อมูลพนักงาน</div>
              ) : (
                branchStats.map((branch, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => navigate('/admin', { state: { initialTab: 'users', filterCategory: branch.name } })}
                    title={`คลิกเพื่อดูรายชื่อ${branch.name}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.9rem', cursor: 'pointer' }}
                  >
                    <div style={{ width: '140px', fontWeight: '500', color: '#2d3748', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {branch.name}
                    </div>
                    <div 
                      style={{ flex: 1, height: '24px', background: '#edf2f7', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}
                      title={`${branch.name}\nรวมทั้งหมด: ${branch.total} คน\n\n🟢 สูง: ${branch.levels.high} คน\n🟡 กลาง: ${branch.levels.mid} คน\n🔴 ต่ำ: ${branch.levels.low} คน`}
                    >
                      {branch.levels.high > 0 && (
                        <div style={{ 
                          width: `${(branch.levels.high / branch.total) * 100}%`, 
                          background: PASTEL_COLORS.high.bg, 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: PASTEL_COLORS.high.text, fontSize: '0.75rem', fontWeight: '600' 
                        }}>
                          {branch.levels.high}
                        </div>
                      )}
                      {branch.levels.mid > 0 && (
                        <div style={{ 
                          width: `${(branch.levels.mid / branch.total) * 100}%`, 
                          background: PASTEL_COLORS.mid.bg, 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: PASTEL_COLORS.mid.text, fontSize: '0.75rem', fontWeight: '600' 
                        }}>
                          {branch.levels.mid}
                        </div>
                      )}
                      {branch.levels.low > 0 && (
                        <div style={{ 
                          width: `${(branch.levels.low / branch.total) * 100}%`, 
                          background: PASTEL_COLORS.low.bg, 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: PASTEL_COLORS.low.text, fontSize: '0.75rem', fontWeight: '600' 
                        }}>
                          {branch.levels.low}
                        </div>
                      )}
                    </div>
                    <div style={{ width: '60px', textAlign: 'right', color: '#4a5568', fontWeight: '600' }}>
                      {branch.total} คน
                    </div>
                  </div>
                ))
              )}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '0.5rem', fontSize: '0.8rem', color: '#718096' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 10, height: 10, background: PASTEL_COLORS.high.bg, borderRadius: '2px' }}></span> สูง</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 10, height: 10, background: PASTEL_COLORS.mid.bg, borderRadius: '2px' }}></span> กลาง</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 10, height: 10, background: PASTEL_COLORS.low.bg, borderRadius: '2px' }}></span> ต่ำ</div>
              </div>
            </div>
          </div>

          {/* กราฟคะแนนเฉลี่ยรายสาขา (Average Score by Branch) */}
          <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #edf2f7' }}>
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
              <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#e53e3e' }}>พนักงานที่รอการประเมิน (ยังไม่มีคะแนน)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                {notEvaluatedStats.map((item, idx) => (
                  <div key={idx} style={{ background: '#fff5f5', padding: '0.75rem', borderRadius: '8px', border: '1px solid #fed7d7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#c53030', fontWeight: '500', fontSize: '0.9rem' }}>{item.name}</span>
                    <span style={{ background: '#c53030', color: 'white', padding: '0.1rem 0.5rem', borderRadius: '99px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      {item.count} คน
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ตาราง Skill Gap Analysis */}
          <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #edf2f7' }}>
            <h4 style={{ fontSize: '1rem', marginBottom: '1rem' }}>วิเคราะห์ช่องว่างทักษะ</h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: '#f7fafc', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem', borderBottom: '2px solid #e2e8f0', color: '#4a5568' }}>แผนก</th>
                    <th style={{ padding: '0.75rem', borderBottom: '2px solid #e2e8f0', textAlign: 'center', color: '#4a5568' }}>พนักงาน</th>
                    <th style={{ padding: '0.75rem', borderBottom: '2px solid #e2e8f0', textAlign: 'center', color: '#4a5568' }}>คะแนนเฉลี่ย</th>
                    <th style={{ padding: '0.75rem', borderBottom: '2px solid #e2e8f0', textAlign: 'center', color: '#4a5568' }}>Gap</th>
                    <th style={{ padding: '0.75rem', borderBottom: '2px solid #e2e8f0', color: '#4a5568' }}>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {skillGapData.length === 0 ? (
                    <tr><td colSpan="5" style={{ padding: '1rem', textAlign: 'center', color: '#718096' }}>ไม่พบข้อมูล</td></tr>
                  ) : (
                    skillGapData.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #edf2f7' }}>
                        <td style={{ padding: '0.75rem', color: '#2d3748', fontWeight: '500' }}>{item.department_name}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'center', color: '#4a5568' }}>{item.total_workers}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'center', color: '#4a5568' }}>{item.current_avg_score}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 'bold', color: item.skill_gap > 0 ? '#e53e3e' : '#38a169' }}>
                          {item.skill_gap > 0 ? `-${item.skill_gap}` : `+${Math.abs(item.skill_gap)}`}
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <span style={{
                            padding: '0.25rem 0.75rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 'bold',
                            background: item.priority_status === 'Critical' ? '#fed7d7' : item.priority_status === 'High' ? '#feebc8' : '#c6f6d5',
                            color: item.priority_status === 'Critical' ? '#c53030' : item.priority_status === 'High' ? '#c05621' : '#2f855a'
                          }}>
                            {item.priority_status === 'Critical' ? 'วิกฤต' : item.priority_status === 'High' ? 'สูง' : item.priority_status === 'Medium' ? 'กลาง' : item.priority_status === 'Low' ? 'ต่ำ' : item.priority_status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        </div>

        {/* Right Column Wrapper */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Donut Chart: สัดส่วนพนักงาน */}
          <section className="overview-section" style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div className="section-header" style={{ marginBottom: '1.5rem' }}>
              <h3>สัดส่วนพนักงาน</h3>
              <p style={{ color: '#718096', fontSize: '0.9rem' }}>สถานะการจ้างงาน</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Donut Chart */}
              <div style={{ 
                width: '180px', height: '180px', borderRadius: '50%', 
                background: `conic-gradient(#48bb78 0% ${(statusStats.permanent/statusStats.total)*100}%, #ecc94b ${(statusStats.permanent/statusStats.total)*100}% 100%)`,
                position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem',
                cursor: 'pointer'
              }} onClick={() => navigate('/admin', { state: { initialTab: 'users' } })}>
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

          {/* Pending Actions (Moved to Right Column) */}
          <section className="overview-section" style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>สิ่งที่ต้องดำเนินการ</h3>
              {pendingActions.length > 0 && (
                <button onClick={() => navigate('/admin/pending-actions')} style={{ background: 'none', border: 'none', color: '#4299e1', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}>
                  ดูทั้งหมด
                </button>
              )}
            </div>
            <div className="pending-actions-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {pendingActions.length === 0 ? (
                <div style={{ color: '#718096', fontStyle: 'italic', padding: '1rem', textAlign: 'center', background: '#f7fafc', borderRadius: '8px', fontSize: '0.9rem' }}>
                  ✅ ไม่มีรายการค้าง
                </div>
              ) : (
                pendingActions.map(action => (
                  <div key={action.id} 
                    onClick={() => navigate(action.link, { state: action.state })}
                    style={{ 
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                      padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '8px', 
                      borderLeft: `4px solid ${action.type === 'urgent' ? '#f56565' : action.type === 'warning' ? '#ed8936' : '#4299e1'}`,
                      cursor: 'pointer', transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateX(2px)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateX(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.2rem' }}>
                        {action.type === 'urgent' ? '🚨' : action.type === 'warning' ? '⚠️' : 'ℹ️'}
                      </span>
                      <span style={{ fontWeight: '500', color: '#2d3748', fontSize: '0.9rem' }}>{action.title}</span>
                    </div>
                    <span style={{ 
                      background: action.type === 'urgent' ? '#fff5f5' : action.type === 'warning' ? '#fef5e7' : '#ebf8ff', 
                      color: action.type === 'urgent' ? '#c53030' : action.type === 'warning' ? '#c77b00' : '#2b6cb0',
                      padding: '0.15rem 0.5rem', borderRadius: '99px', fontSize: '0.8rem', fontWeight: 'bold'
                    }}>
                      {action.count}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* 3. กิจกรรมล่าสุด (History) */}
          <section className="overview-section activity-section">
            <div className="section-header">
              <h3>ประวัติกิจกรรม</h3>
              <button className="view-all-btn" onClick={() => navigate('/admin/audit-log')}>ดูทั้งหมด</button>
            </div>
            <div className="activity-list">
              {activitiesLoading ? (
                <div className="empty-state">กำลังโหลดข้อมูล...</div>
              ) : activitiesError ? (
                <div className="empty-state">{activitiesError}</div>
              ) : recentActivities.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">📭</span>
                  <p>ยังไม่มีกิจกรรมล่าสุด</p>
                </div>
              ) : (
                recentActivities.map(activity => (
                  <div key={activity.id} className="activity-item">
                    <div className={`activity-icon type--${activity.type}`}>
                      {activity.type === 'register' && <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2M5 19V5h14v14z"></path><path d="M7 7h10v2H7zM7 11h10v2H7zM7 15h10v2H7z"></path></svg>}
                      {activity.type === 'quiz' && '✅'}
                      {activity.type === 'system' && '⚙️'}
                      {activity.type === 'login' && '🔑'}
                    </div>
                    <div className="activity-info">
                      <span className="activity-action" style={{ fontSize: '0.9rem', fontWeight: '600' }}>{activity.action}</span>
                      <span className="activity-user" style={{ fontSize: '0.8rem', color: '#718096' }}>โดย {activity.user}</span>
                    </div>
                    <span className="activity-time">{activity.time}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;

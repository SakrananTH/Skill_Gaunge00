import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminOverview.css';
import { apiRequest } from '../../utils/api';

const AdminOverview = ({ setTab }) => {
  const navigate = useNavigate();

  const [stats, setStats] = useState([
    { label: 'พนักงานทั้งหมด', value: 0, unit: 'คน', change: '-', trend: 'neutral', color: 'blue' },
    { label: 'รอตรวจสอบเอกสาร', value: 0, unit: 'รายการ', change: '-', trend: 'neutral', color: 'orange' },
    { label: 'แบบทดสอบที่ทำวันนี้', value: 0, unit: 'ครั้ง', change: '-', trend: 'neutral', color: 'green' },
    { label: 'ผู้ใช้งาน Active', value: 0, unit: 'คน', change: '-', trend: 'neutral', color: 'purple' },
  ]);

  const [recentActivities, setRecentActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [activitiesError, setActivitiesError] = useState('');

  useEffect(() => {
    let active = true;

    const loadOverview = async () => {
      try {
        setActivitiesLoading(true);
        setActivitiesError('');

        const response = await apiRequest('/api/admin/workers');
        const items = Array.isArray(response?.items)
          ? response.items
          : Array.isArray(response)
            ? response
            : [];

        if (!active) {
          return;
        }

        const totalWorkers = items.length;
        const pendingWorkers = items.filter(worker => worker.status === 'probation').length;
        const activeWorkers = items.filter(worker => worker.status === 'active').length;

        setStats([
          { label: 'พนักงานทั้งหมด', value: totalWorkers, unit: 'คน', change: '-', trend: 'neutral', color: 'blue' },
          { label: 'รอตรวจสอบเอกสาร', value: pendingWorkers, unit: 'รายการ', change: '-', trend: 'neutral', color: 'orange' },
          { label: 'แบบทดสอบที่ทำวันนี้', value: 0, unit: 'ครั้ง', change: '-', trend: 'neutral', color: 'green' },
          { label: 'ผู้ใช้งาน Active', value: activeWorkers, unit: 'คน', change: '-', trend: 'neutral', color: 'purple' },
        ]);

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

        const activities = items
          .map(worker => {
            const timestamps = [
              worker.fullData?.meta?.createdAt,
              worker.fullData?.meta?.updatedAt,
              worker.startDate,
              worker.fullData?.meta?.lastUpdated
            ].filter(Boolean);
            const parsedDate = timestamps.length ? toDate(timestamps[0]) : null;
            return {
              id: worker.id,
              user: worker.name || 'ไม่ระบุ',
              action: 'ลงทะเบียนพนักงานใหม่',
              type: 'register',
              date: parsedDate || null
            };
          })
          .sort((a, b) => {
            const timeA = a.date ? a.date.getTime() : 0;
            const timeB = b.date ? b.date.getTime() : 0;
            return timeB - timeA;
          })
          .slice(0, 5)
          .map(activity => ({
            ...activity,
            time: formatTimeAgo(activity.date)
          }));

        setRecentActivities(activities);
      } catch (error) {
        if (!active) {
          return;
        }
        console.error('Failed to load overview data', error);
        setActivitiesError(error?.message || 'ไม่สามารถโหลดข้อมูลกิจกรรมได้');
        setRecentActivities([]);
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
  }, []);

  return (
    <div className="admin-overview">
      <header className="admin-welcome-section">
        <div className="welcome-text">
          <h2>ภาพรวมระบบ (System Overview)</h2>
          <p>สรุปสถานะและข้อมูลสำคัญของระบบ Skill Gauge</p>
        </div>
        <div className="date-display">
          {new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </header>

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
            </div>
          </div>
        ))}
      </div>

      <div className="admin-content-grid">
        <section className="overview-section activity-section">
          <div className="section-header">
            <h3>กิจกรรมล่าสุด (Recent Activities)</h3>
            <button className="view-all-btn">ดูทั้งหมด</button>
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
                    <span className="activity-user">{activity.user}</span>
                    <span className="activity-action">{activity.action}</span>
                  </div>
                  <span className="activity-time">{activity.time}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="overview-section quick-actions-section">
          <div className="section-header">
            <h3>เมนูลัด (Quick Actions)</h3>
          </div>
          <div className="quick-actions-grid">
            <button className="quick-action-card" onClick={() => setTab('users')}>
              <div className="action-icon-circle blue">
                <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2A2 2 0 1 0 12 6 2 2 0 1 0 12 2z"></path><path d="M4 9 9 9 9 22 11 22 11 15 13 15 13 22 15 22 15 9 20 9 20 7 4 7 4 9z"></path></svg>
              </div>
              <span className="action-label">จัดการผู้ใช้งาน</span>
              <span className="action-desc">ค้นหา/แก้ไขข้อมูล</span>
            </button>
            <button className="quick-action-card" onClick={() => navigate('/admin/worker-registration')}>
              <div className="action-icon-circle green">
                <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} fill="currentColor" viewBox="0 0 24 24"><path d="m19,3H5c-1.1,0-2,.9-2,2v14c0,1.1.9,2,2,2h14c1.1,0,2-.9,2-2V5c0-1.1-.9-2-2-2ZM5,19V5h14v14s-14,0-14,0Z"></path><path d="M8.5 10.5A1.5 1.5 0 1 0 8.5 13.5 1.5 1.5 0 1 0 8.5 10.5z"></path><path d="M11 11H17V13H11z"></path><path d="M7 7H17V9H7z"></path><path d="M7 15H17V17H7z"></path></svg>
              </div>
              <span className="action-label">ลงทะเบียนพนักงาน</span>
              <span className="action-desc">เพิ่มพนักงานใหม่</span>
            </button>
            <button className="quick-action-card" onClick={() => setTab('quiz')}>
              <div className="action-icon-circle orange">
                <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} fill="currentColor" viewBox="0 0 24 24"><path d="M8 6h9v2H8z"></path><path d="M20 2H6C4.35 2 3 3.35 3 5v14c0 1.65 1.35 3 3 3h15v-2H6c-.55 0-1-.45-1-1s.45-1 1-1h14c.55 0 1-.45 1-1V3c0-.55-.45-1-1-1m-6 14H6c-.35 0-.69.07-1 .18V5c0-.55.45-1 1-1h13v12z"></path></svg>
              </div>
              <span className="action-label">เพิ่มข้อสอบใหม่</span>
              <span className="action-desc">สร้างชุดข้อสอบ</span>
            </button>
            <button className="quick-action-card" onClick={() => navigate('/admin/signup')}>
              <div className="action-icon-circle purple">
                <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5m0-8c1.65 0 3 1.35 3 3s-1.35 3-3 3-3-1.35-3-3 1.35-3 3-3M4 22h16c.55 0 1-.45 1-1v-1c0-3.86-3.14-7-7-7h-4c-3.86 0-7 3.14-7 7v1c0 .55.45 1 1 1m6-7h4c2.76 0 5 2.24 5 5H5c0-2.76 2.24-5 5-5"></path></svg>
              </div>
              <span className="action-label">สร้างบัญชี Login</span>
              <span className="action-desc">สำหรับ Admin/HR</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminOverview;

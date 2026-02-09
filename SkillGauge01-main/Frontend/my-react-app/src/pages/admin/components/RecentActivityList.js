import React from 'react';
import './RecentActivityList.css';

const RecentActivityList = ({ activities, loading, error, onViewAll }) => {
  return (
    <section className="overview-section" style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
      <div className="recent-activity-header">
        <div>
          <h3 className="recent-activity-title">กิจกรรมล่าสุด</h3>
          <span className="recent-activity-subtitle">ประวัติการใช้งานระบบ</span>
        </div>
        {onViewAll && (
          <button 
            onClick={onViewAll}
            className="recent-activity-view-all"
          >
            ดูทั้งหมด
          </button>
        )}
      </div>

      <div className="activity-list">
        {loading ? (
          <div className="recent-activity-status">
            กำลังโหลดข้อมูล...
          </div>
        ) : error ? (
          <div className="recent-activity-error">
            {error}
          </div>
        ) : (!activities || activities.length === 0) ? (
          <div className="recent-activity-empty">
            <div className="recent-activity-empty-icon">📝</div>
            <div>ไม่มีกิจกรรมล่าสุด</div>
          </div>
        ) : (
          <ul className="recent-activity-list">
            {activities.map((activity, index) => (
              <li key={activity.id || index} className="activity-item">
                <div 
                  className="activity-icon"
                  style={{ 
                    background: activity.type === 'login' ? '#e6fffa' : activity.type === 'quiz' ? '#ebf8ff' : '#f7fafc',
                    color: activity.type === 'login' ? '#319795' : activity.type === 'quiz' ? '#3182ce' : '#718096'
                  }}
                >
                  {activity.type === 'login' ? <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M8 21c2.76 0 5-2.24 5-5 0-1.02-.31-1.96-.83-2.75l3.33-3.33 1.79 1.79 1.41-1.41-1.79-1.79L18 7.42l2.29 2.29L21.7 8.3l-2.29-2.29 1.29-1.29-1.41-1.41-8.54 8.54c-.79-.52-1.74-.83-2.75-.83-2.76 0-5 2.24-5 5s2.24 5 5 5Zm0-8c1.65 0 3 1.35 3 3s-1.35 3-3 3-3-1.35-3-3 1.35-3 3-3"></path></svg> : activity.type === 'quiz' ? '📝' : <svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24"  fill="currentColor" viewBox="0 0 24 24" ><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2M5 19V5h14v14z"></path><path d="M8.5 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 1 0 0-3m2.5.5h6v2h-6zM7 7h10v2H7zm0 8h10v2H7z"></path></svg>}
                </div>
                <div className="activity-content">
                  <div className="activity-text">
                    {activity.user} <span className="activity-action">{activity.action}</span>
                  </div>
                  <div className="activity-time">{activity.time}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default RecentActivityList;
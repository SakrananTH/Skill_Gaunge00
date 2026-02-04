import React from 'react';

const RecentActivityList = ({ activities, loading, error, onViewAll }) => {
  return (
    <section className="overview-section" style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
      <div className="section-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#2d3748' }}>กิจกรรมล่าสุด</h3>
          <span style={{ color: '#718096', fontSize: '0.85rem' }}>ประวัติการใช้งานระบบ</span>
        </div>
        {onViewAll && (
          <button 
            onClick={onViewAll}
            style={{ background: 'none', border: 'none', color: '#3182ce', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}
          >
            ดูทั้งหมด
          </button>
        )}
      </div>

      <div className="activity-list">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#718096', fontSize: '0.9rem' }}>
            กำลังโหลดข้อมูล...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: '#e53e3e', fontSize: '0.9rem', background: '#fff5f5', borderRadius: '8px' }}>
            {error}
          </div>
        ) : (!activities || activities.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#a0aec0' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.5 }}>📝</div>
            <div style={{ fontSize: '0.9rem' }}>ไม่มีกิจกรรมล่าสุด</div>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {activities.map((activity, index) => (
              <li key={activity.id || index} style={{ 
                display: 'flex', 
                gap: '1rem', 
                padding: '0.75rem 0', 
                borderBottom: index !== activities.length - 1 ? '1px solid #edf2f7' : 'none' 
              }}>
                <div style={{ 
                  width: '36px', height: '36px', borderRadius: '50%', 
                  background: activity.type === 'login' ? '#e6fffa' : activity.type === 'quiz' ? '#ebf8ff' : '#f7fafc',
                  color: activity.type === 'login' ? '#319795' : activity.type === 'quiz' ? '#3182ce' : '#718096',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  fontSize: '1.2rem'
                }}>
                  {activity.type === 'login' ? '🔑' : activity.type === 'quiz' ? '📝' : '⚙️'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.9rem', color: '#2d3748', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {activity.user} <span style={{ fontWeight: 'normal', color: '#4a5568' }}>{activity.action}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#a0aec0', marginTop: '2px' }}>{activity.time}</div>
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
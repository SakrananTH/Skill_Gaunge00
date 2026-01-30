import React from 'react';

const RecentActivityList = ({ activities, loading, error, onViewAll }) => {
    return (
        <section className="overview-section activity-section" style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0 }}>กิจกรรมล่าสุด (History)</h3>
                <button
                    onClick={onViewAll}
                    className="view-all-btn"
                    style={{ background: 'none', border: 'none', color: '#4299e1', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}
                >
                    ดูทั้งหมด
                </button>
            </div>
            <div className="activity-list">
                {loading ? (
                    <div className="empty-state" style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>กำลังโหลดข้อมูล...</div>
                ) : error ? (
                    <div className="empty-state" style={{ textAlign: 'center', padding: '2rem', color: '#f56565' }}>{error}</div>
                ) : activities.length === 0 ? (
                    <div className="empty-state" style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
                        <span className="empty-icon" style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>📭</span>
                        <p style={{ margin: 0 }}>ยังไม่มีกิจกรรมล่าสุด</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {activities.map(activity => (
                            <div key={activity.id} className="activity-item" style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f7fafc' }}>
                                <div className={`activity-icon type--${activity.type}`} style={{
                                    width: '36px', height: '36px', borderRadius: '50%', background: '#edf2f7',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem'
                                }}>
                                    {activity.type === 'register' && '📝'}
                                    {activity.type === 'quiz' && '✅'}
                                    {activity.type === 'system' && '⚙️'}
                                    {activity.type === 'login' && '🔑'}
                                    {!['register', 'quiz', 'system', 'login'].includes(activity.type) && '🔔'}
                                </div>
                                <div className="activity-info" style={{ flex: 1 }}>
                                    <div className="activity-user" style={{ fontWeight: '600', fontSize: '0.9rem', color: '#2d3748' }}>{activity.user}</div>
                                    <div className="activity-action" style={{ fontSize: '0.85rem', color: '#718096' }}>{activity.action}</div>
                                </div>
                                <span className="activity-time" style={{ fontSize: '0.75rem', color: '#a0aec0', whiteSpace: 'nowrap' }}>{activity.time}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
};

export default RecentActivityList;

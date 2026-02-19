import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import LogoutModal from '../../components/LogoutModal';

const WorkHistory = () => {
    const navigate = useNavigate();

    const [history, setHistory] = useState([]);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState({ name: 'ผู้ใช้งาน', id: '', role: 'worker' });
    const [isScrolled, setIsScrolled] = useState(false);
    const resolvedTrade =
        user.fullData?.employment?.tradeType ||
        user.technician_type ||
        user.trade_type ||
        user.tradeType ||
        user.technicianType;

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

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const storedUserStr = sessionStorage.getItem('user');
        const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;
        if (storedUser) {
            setUser(prev => ({ ...prev, ...storedUser }));
        }
        const storedUserId = sessionStorage.getItem('user_id');
        const resolvedUserId = storedUser?.id ?? storedUserId;
        if (!resolvedUserId) return;
        const numericWorkerId = resolvedUserId && !Number.isNaN(Number(resolvedUserId))
            ? Number(resolvedUserId)
            : null;

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

        const loadHistory = async () => {
            setLoading(true);
            try {
                    const data = await apiRequest(`/api/worker/history?userId=${encodeURIComponent(resolvedUserId)}`);
                if (Array.isArray(data)) {
                    setHistory(data);
                }
            } catch (err) {
                console.error('Error fetching work history:', err);
            } finally {
                setLoading(false);
            }
        };

        loadHistory();
    }, []);

    const handleLogout = () => {
        setShowLogoutModal(true);
    };

    return (
        <div className="dash-window" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Kanit', sans-serif" }}>
            
            {/* Top Navigation Bar */}
            <nav style={{ 
                background: isScrolled ? 'rgba(255, 255, 255, 0.95)' : 'white', 
                padding: '15px 40px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                boxShadow: isScrolled ? '0 4px 20px -5px rgba(0,0,0,0.1)' : '0 4px 6px -1px rgba(0,0,0,0.05)',
                backdropFilter: isScrolled ? 'blur(10px)' : 'none',
                transition: 'all 0.3s ease',
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
                    <SidebarItem icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M3 13h1v7c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-7h1c.4 0 .77-.24.92-.62.15-.37.07-.8-.22-1.09l-8.99-9a.996.996 0 0 0-1.41 0l-9.01 9c-.29.29-.37.72-.22 1.09s.52.62.92.62Zm9-8.59 6 6V20H6v-9.59z"></path></svg>} label="หน้าหลัก" onClick={() => navigate('/worker')} />
                    <SidebarItem icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M8 6h9v2H8z"></path><path d="M20 2H6C4.35 2 3 3.35 3 5v14c0 1.65 1.35 3 3 3h15v-2H6c-.55 0-1-.45-1-1s.45-1 1-1h14c.55 0 1-.45 1-1V3c0-.55-.45-1-1-1m-6 14H6c-.35 0-.69.07-1 .18V5c0-.55.45-1 1-1h13v12z"></path></svg>} label="แบบทดสอบ" onClick={() => navigate('/skill-assessment')} />
                    <SidebarItem active icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M20 6h-3V4c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2M9 4h6v2H9zM8 8h12v3.07l-.83.39a16.78 16.78 0 0 1-14.34 0L4 11.07V8zM4 20v-6.72c2.54 1.19 5.27 1.79 8 1.79s5.46-.6 8-1.79V20z"></path></svg>} label="ประวัติงาน" onClick={() => navigate('/worker/history')} />
                    <SidebarItem icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4m0 6c-1.08 0-2-.92-2-2s.92-2 2-2 2 .92 2 2-.92 2-2 2"></path><path d="m20.42 13.4-.51-.29c.05-.37.08-.74.08-1.11s-.03-.74-.08-1.11l.51-.29c.96-.55 1.28-1.78.73-2.73l-1-1.73a2.006 2.006 0 0 0-2.73-.73l-.53.31c-.58-.46-1.22-.83-1.9-1.11v-.6c0-1.1-.9-2-2-2h-2c-1.1 0-2 .9-2 2v.6c-.67.28-1.31.66-1.9 1.11l-.53-.31c-.96-.55-2.18-.22-2.73.73l-1 1.73c-.55.96-.22 2.18.73 2.73l.51.29c-.05.37-.08.74-.08 1.11s.03.74.08 1.11l-.51.29c-.96.55-1.28 1.78-.73 2.73l1 1.73c.55.95 1.77 1.28 2.73.73l.53-.31c.58.46 1.22.83 1.9 1.11v.6c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2v-.6a8.7 8.7 0 0 0 1.9-1.11l.53.31c.95.55 2.18.22 2.73-.73l1-1.73c.55-.96.22-2.18-.73-2.73m-2.59-2.78c.11.45.17.92.17 1.38s-.06.92-.17 1.38a1 1 0 0 0 .47 1.11l1.12.65-1 1.73-1.14-.66c-.38-.22-.87-.16-1.19.14-.68.65-1.51 1.13-2.38 1.4-.42.13-.71.52-.71.96v1.3h-2v-1.3c0-.44-.29-.83-.71-.96-.88-.27-1.7-.75-2.38-1.4a1.01 1.01 0 0 0-1.19-.15l-1.14.66-1-1.73 1.12-.65c.39-.22.58-.68.47-1.11-.11-.45-.17-.92-.17-1.38s.06-.93.17-1.38A1 1 0 0 0 5.7 9.5l-1.12-.65 1-1.73 1.14.66c.38.22.87.16 1.19-.14.68-.65 1.51-1.13 2.38-1.4.42-.13.71-.52.71-.96v-1.3h2v1.3c0 .44.29.83.71.96.88.27 1.7.75 2.38 1.4.32.31.81.36 1.19.14l1.14-.66 1 1.73-1.12.65c-.39.22-.58.68-.47 1.11Z"></path></svg>} label="ตั้งค่า" onClick={() => navigate('/worker-settings')} />
                    
                    <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 10px' }}></div>

                    <button onClick={handleLogout} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '15px', fontWeight: '600', borderRadius: '8px', transition: 'background 0.2s' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="m20.2 4.02-10-2a.99.99 0 0 0-.83.21C9.14 2.42 9 2.7 9 3v1H4c-.55 0-1 .45-1 1v14c0 .55.45 1 1 1h5v1c0 .3.13.58.37.77.18.15.4.23.63.23.07 0 .13 0 .2-.02l10-2c.47-.09.8-.5.8-.98V5c0-.48-.34-.89-.8-.98M5 18V6h4v12zm14 .18-8 1.6V4.22l8 1.6z"></path><path d="M13 11a1 1 0 1 0 0 2 1 1 0 1 0 0-2"></path></svg>
                        ออกจากระบบ
                    </button>
                </div>
            </nav>

            {/* Main Content */}
            <main style={{ flex: 1, padding: '40px 20px', width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
                <div style={{ marginBottom: '30px' }}>
                    <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e293b', marginTop: '10px' }}>ประวัติงานที่ผ่านมา</h1>
                    <p style={{ color: '#64748b', margin: 0 }}>ตรวจสอบรายการงานที่คุณได้ดำเนินการเสร็จสิ้นแล้ว</p>
                </div>

                <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>กำลังโหลดข้อมูล...</div>
                    ) : history.length > 0 ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ background: '#f8fafc' }}>
                                <tr>
                                    <th style={{ padding: '15px 20px', textAlign: 'left', color: '#475569', fontWeight: '600' }}>ชื่องาน</th>
                                    <th style={{ padding: '15px 20px', textAlign: 'left', color: '#475569', fontWeight: '600' }}>สถานที่</th>
                                    <th style={{ padding: '15px 20px', textAlign: 'left', color: '#475569', fontWeight: '600' }}>วันที่</th>
                                    <th style={{ padding: '15px 20px', textAlign: 'center', color: '#475569', fontWeight: '600' }}>สถานะ</th>
                                    <th style={{ padding: '15px 20px', textAlign: 'center', color: '#475569', fontWeight: '600' }}>ดูงาน</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((item, index) => (
                                    <tr key={item.id} style={{ borderBottom: index !== history.length - 1 ? '1px solid #f1f5f9' : 'none', transition: 'background 0.2s' }}>
                                        <td style={{ padding: '20px', fontWeight: '500', color: '#334155' }}>{item.project}</td>
                                        <td style={{ padding: '20px', color: '#64748b' }}>{item.location}</td>
                                        <td style={{ padding: '20px', color: '#64748b' }}>{item.date}</td>
                                        <td style={{ padding: '20px', textAlign: 'center' }}>
                                            <span style={{ padding: '6px 12px', background: '#dcfce7', color: '#166534', borderRadius: '20px', fontSize: '14px', fontWeight: '600' }}>
                                                {item.status === 'submitted' ? 'ส่งงานแล้ว' : 'เสร็จสิ้น'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '20px', textAlign: 'center' }}>
                                            <button
                                                onClick={() => navigate('/worker/task-detail', {
                                                    state: {
                                                        task: {
                                                            id: item.id,
                                                            project: item.project,
                                                            location: item.location,
                                                            date: item.date,
                                                            status: item.status
                                                        }
                                                    }
                                                })}
                                                style={{
                                                    border: '1px solid #bfdbfe',
                                                    background: '#eff6ff',
                                                    color: '#1d4ed8',
                                                    borderRadius: '10px',
                                                    padding: '7px 12px',
                                                    fontSize: '13px',
                                                    fontWeight: '600',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                ดูงาน
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div style={{ padding: '60px 40px', textAlign: 'center', color: '#94a3b8' }}>
                            <div style={{ fontSize: '40px', marginBottom: '15px' }}>📂</div>
                            <p style={{ margin: 0 }}>ไม่มีประวัติงานในขณะนี้</p>
                        </div>
                    )}
                </div>
            </main>
            <LogoutModal show={showLogoutModal} onClose={() => setShowLogoutModal(false)} />
        </div>
    );
};

// Internal Component for Sidebar Item
const SidebarItem = ({ icon, label, active, onClick }) => (
    <div 
        onClick={onClick}
        style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '8px 16px', 
            borderRadius: '20px', 
            cursor: 'pointer', 
            background: active ? '#eff6ff' : 'transparent',
            color: active ? '#2563eb' : '#64748b',
            fontWeight: active ? '600' : '500',
            transition: 'all 0.2s',
            fontSize: '15px'
        }}
    >
        <span style={{ fontSize: '18px' }}>{icon}</span>
        <span>{label}</span>
    </div>
);

export default WorkHistory;

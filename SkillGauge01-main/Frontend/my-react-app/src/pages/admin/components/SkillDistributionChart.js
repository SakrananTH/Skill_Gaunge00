import React from 'react';

const SkillDistributionChart = ({ data, total, onFilter }) => {
    if (!data || data.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
                ไม่มีข้อมูลการประเมิน
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
                width: '180px', height: '180px', borderRadius: '50%',
                background: `conic-gradient(${data.map((item, idx) => {
                    const prevValues = data.slice(0, idx).reduce((sum, d) => sum + (d.value || 0), 0);
                    const start = (prevValues / total) * 100;
                    const end = ((prevValues + (item.value || 0)) / total) * 100;
                    return `${item.color} ${start}% ${end}%`;
                }).join(', ')})`,
                position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
                <div style={{ width: '130px', height: '130px', background: 'white', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                    <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#2d3748', lineHeight: 1 }}>{total}</span>
                    <span style={{ fontSize: '0.8rem', color: '#718096' }}>คนประเมินแล้ว</span>
                </div>
            </div>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {data.map((item, idx) => (
                    <div
                        key={idx}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', transition: 'background 0.2s' }}
                        onClick={() => onFilter(item.filterKey)}
                        onMouseOver={(e) => e.currentTarget.style.background = '#f7fafc'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: item.color }}></span>
                            <span style={{ color: '#4a5568' }}>{item.name}</span>
                        </div>
                        <div style={{ fontWeight: '600', color: '#2d3748' }}>
                            {item.value} <span style={{ color: '#718096', fontWeight: '400', fontSize: '0.8rem' }}>({item.percentage}%)</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SkillDistributionChart;

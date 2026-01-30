import React from 'react';

const BranchStatsTable = ({ branchStats, onBranchClick, onExport }) => {
    return (
        <div className="branch-stats-container">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <button onClick={onExport} className="btn-export" style={{ padding: '0.5rem 1rem', background: '#edf2f7', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                    📤 ส่งออกข้อมูล CSV
                </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #edf2f7', textAlign: 'left' }}>
                            <th style={{ padding: '0.75rem' }}>สาขา</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center' }}>ทั้งหมด</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center' }}>ระดับสูง</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center' }}>ระดับกลาง</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center' }}>ระดับต่ำ</th>
                            <th style={{ padding: '0.75rem' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {branchStats.map((branch, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #edf2f7' }}>
                                <td style={{ padding: '0.75rem', fontWeight: '500' }}>{branch.name}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>{branch.total}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                    <span style={{ background: '#86efac', padding: '0.1rem 0.5rem', borderRadius: '99px', fontSize: '0.8rem' }}>{branch.levels.high}</span>
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                    <span style={{ background: '#fcd34d', padding: '0.1rem 0.5rem', borderRadius: '99px', fontSize: '0.8rem' }}>{branch.levels.mid}</span>
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                    <span style={{ background: '#fca5a5', padding: '0.1rem 0.5rem', borderRadius: '99px', fontSize: '0.8rem' }}>{branch.levels.low}</span>
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                    <button
                                        onClick={() => onBranchClick(branch.value)}
                                        style={{ background: 'none', border: 'none', color: '#4299e1', cursor: 'pointer', fontSize: '0.85rem' }}
                                    >
                                        ดูรายละเอียด
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default BranchStatsTable;

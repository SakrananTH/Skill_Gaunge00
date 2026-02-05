import React from 'react';
import './SkillDistributionChart.css';

const SkillDistributionChart = ({ data, total, onFilter }) => {
    if (!data || data.length === 0 || total === 0) {
        return (
            <div className="skill-chart-empty">
                ไม่มีข้อมูลการประเมิน
            </div>
        );
    }

    return (
        <div className="skill-chart-container">
            <div className="skill-chart-donut-outer" style={{
                background: `conic-gradient(${data.map((item, idx) => {
                    const prevValues = data.slice(0, idx).reduce((sum, d) => sum + (d.value || 0), 0);
                    const start = (prevValues / total) * 100;
                    const end = ((prevValues + (item.value || 0)) / total) * 100;
                    return `${item.color} ${start}% ${end}%`;
                }).join(', ')})`
            }}>
                <div className="skill-chart-donut-inner">
                    <span className="skill-chart-total">{total}</span>
                    <span className="skill-chart-caption">คนประเมินแล้ว</span>
                </div>
            </div>

            <div className="skill-chart-legend">
                {data.map((item, idx) => (
                    <div
                        key={idx}
                        className="skill-chart-legend-item"
                        onClick={() => onFilter(item.filterKey)}
                    >
                        <div className="skill-chart-legend-left">
                            <span className="skill-chart-dot" style={{ background: item.color }}></span>
                            <span className="skill-chart-legend-name">{item.name}</span>
                        </div>
                        <div className="skill-chart-legend-value">
                            {item.value} <span className="skill-chart-legend-percent">({item.percentage}%)</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SkillDistributionChart;

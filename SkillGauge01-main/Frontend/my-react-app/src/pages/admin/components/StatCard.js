import React from 'react';

const StatCard = ({ stat, onClick }) => {
    return (
        <div
            className={`stat-card stat-card--${stat.color}`}
            onClick={onClick}
            style={{ cursor: 'pointer' }}
        >
            <div className="stat-icon-wrapper">
                <span className="stat-icon">
                    {stat.color === 'red' && '🚨'}
                    {stat.color === 'orange' && '⚠️'}
                    {stat.color === 'green' && '✅'}
                    {stat.color === 'blue' && '📊'}
                </span>
            </div>
            <div className="stat-card__content">
                <span className="stat-card__label">{stat.label}</span>
                <div className="stat-card__value-group">
                    <span className="stat-card__value">{stat.value}</span>
                    <span className="stat-card__unit">{stat.unit}</span>
                </div>
                {stat.insight && (
                    <div className="stat-card__insight" style={{ fontSize: '0.75rem', marginTop: '4px', opacity: 0.8 }}>
                        {stat.insight}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatCard;

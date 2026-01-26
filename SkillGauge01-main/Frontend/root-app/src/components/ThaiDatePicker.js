import React, { useState, useEffect, useRef } from 'react';
import './ThaiDatePicker.css';

const MONTH_NAMES = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const ThaiDatePicker = ({ value, onChange, placeholder = "วัน/เดือน/ปี (พ.ศ.)", className = "", id }) => {
    const [showCalendar, setShowCalendar] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date()); // For navigation
    const [selectedDate, setSelectedDate] = useState(null);

    const containerRef = useRef(null);

    useEffect(() => {
        if (value) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                setSelectedDate(date);
                setCurrentDate(date);
            }
        }
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setShowCalendar(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const handleYearChange = (e) => {
        // Input is B.E., convert to A.D. for state
        const beYear = parseInt(e.target.value, 10);
        if (!isNaN(beYear)) {
            setCurrentDate(new Date(beYear - 543, currentDate.getMonth(), 1));
        }
    };

    const handleDateClick = (day) => {
        const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        // Adjust for timezone offset issue by setting time to noon or keeping local
        // Simple way: YYYY-MM-DD string
        const year = newDate.getFullYear();
        const month = String(newDate.getMonth() + 1).padStart(2, '0');
        const dateDay = String(day).padStart(2, '0');
        const isoDate = `${year}-${month}-${dateDay}`;

        setSelectedDate(newDate);
        onChange(isoDate);
        setShowCalendar(false);
    };

    const formatDisplay = (date) => {
        if (!date) return '';
        const d = date.getDate();
        const m = MONTH_NAMES[date.getMonth()];
        const y = date.getFullYear() + 543;
        return `${d} ${m} ${y}`;
    };

    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);

        // Thai year for header
        const thaiYear = year + 543;

        const days = [];
        // Empty slots for previous month
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="tdp-day empty"></div>);
        }

        // Days
        for (let i = 1; i <= daysInMonth; i++) {
            const isSelected = selectedDate &&
                selectedDate.getDate() === i &&
                selectedDate.getMonth() === month &&
                selectedDate.getFullYear() === year;

            const isToday = new Date().getDate() === i &&
                new Date().getMonth() === month &&
                new Date().getFullYear() === year;

            days.push(
                <div
                    key={i}
                    className={`tdp-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                    onClick={() => handleDateClick(i)}
                >
                    {i}
                </div>
            );
        }

        return (
            <div className="tdp-calendar">
                <div className="tdp-header">
                    <button type="button" onClick={handlePrevMonth}>&lt;</button>
                    <div className="tdp-controls">
                        <select
                            value={month}
                            onChange={(e) => setCurrentDate(new Date(year, parseInt(e.target.value), 1))}
                            className="tdp-select"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {MONTH_NAMES.map((m, idx) => (
                                <option key={m} value={idx}>{m}</option>
                            ))}
                        </select>
                        <select
                            value={thaiYear}
                            onChange={(e) => setCurrentDate(new Date(parseInt(e.target.value) - 543, month, 1))}
                            className="tdp-select"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {Array.from({ length: 120 }, (_, i) => {
                                const y = new Date().getFullYear() - 100 + i + 543;
                                return <option key={y} value={y}>{y}</option>;
                            })}
                        </select>
                    </div>
                    <button type="button" onClick={handleNextMonth}>&gt;</button>
                </div>
                <div className="tdp-weekdays">
                    <div>อา</div>
                    <div>จ</div>
                    <div>อ</div>
                    <div>พ</div>
                    <div>พฤ</div>
                    <div>ศ</div>
                    <div>ส</div>
                </div>
                <div className="tdp-body">
                    {days}
                </div>
            </div>
        );
    };

    return (
        <div className={`thai-date-picker ${className}`} ref={containerRef}>
            <input
                id={id}
                type="text"
                readOnly
                value={formatDisplay(selectedDate)}
                placeholder={placeholder}
                onClick={() => setShowCalendar(true)}
                className="tdp-input"
            />
            {showCalendar && renderCalendar()}
        </div>
    );
};

export default ThaiDatePicker;

import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/Card';
import './Home.css';

const Home = () => {
  // Simple carousel images served from public/images
  const images = [
    '/S2.png',
    '/P2.png',
    '/F2.png',
  ];

  const Carousel = () => {
    const [index, setIndex] = useState(0);
    const timerRef = useRef(null);
    const intervalMs = 2500; // 2.5s

    const next = () => setIndex((prev) => (prev + 1) % images.length);
    const goTo = (i) => setIndex(i % images.length);

    useEffect(() => {
      timerRef.current = setInterval(next, intervalMs);
      return () => clearInterval(timerRef.current);
    }, []);

    const pause = () => timerRef.current && clearInterval(timerRef.current);
    const resume = () => {
      timerRef.current = setInterval(next, intervalMs);
    };

    return (
      <div className="carousel" onMouseEnter={pause} onMouseLeave={resume}>
        <div
          className="carousel-track"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {images.map((src, i) => (
            <div className="carousel-slide" key={i} aria-hidden={i !== index}>
              <img
                src={src}
                alt={`ภาพสไลด์ที่ ${i + 1}`}
                onError={(e) => {
                  const img = e.currentTarget;
                  if (!img.dataset.fallback) {
                    img.src = 'https://picsum.photos/1600/520?blur=3';
                    img.dataset.fallback = 'true';
                  }
                }}
              />
            </div>
          ))}
        </div>
        <div className="carousel-indicators" role="tablist" aria-label="ตัวบ่งชี้สไลด์">
          {images.map((_, i) => (
            <button
              key={i}
              className={`dot ${i === index ? 'active' : ''}`}
              role="tab"
              aria-label={`ไปยังสไลด์ที่ ${i + 1}`}
              aria-selected={i === index}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      </div>
    );
  };
  const services = [
    {
      title: "",
      description: ""
    },
    {
      title: "",
      description: ""
    },
    {
      title: "",
      description: ""
    }
  ];
};

export default Home;
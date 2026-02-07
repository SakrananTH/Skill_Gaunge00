import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Login.css';
import { chooseRole } from '../utils/auth';
import { API_BASE_URL } from '../utils/api';

const Login = () => {
  const navigate = useNavigate();
  // Start with no role selected; user can toggle selection on/off
  const [role, setRole] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const ADMIN_USERNAME = '0863125891';
  const ADMIN_PASSWORD = '0863503381';
  const ADMIN_EMAIL = 'admin@example.com';

  useEffect(() => {
    try {
      const pre = sessionStorage.getItem('login_prefill_username');
      if (pre) {
        setUsername(pre);
        sessionStorage.removeItem('login_prefill_username');
      }
      const msg = sessionStorage.getItem('login_message');
      if (msg) {
        setInfo(msg);
        sessionStorage.removeItem('login_message');
      }
    } catch {}
  }, []);

  const toggleRole = (target) => {
    setRole((prev) => (prev === target ? '' : target));
  };

  const API = API_BASE_URL || process.env.REACT_APP_API_URL || '';

  const onLogin = async () => {
    setError(''); // Clear previous errors
    
    if (!username || !password) {
      setError('กรุณากรอกเบอร์โทรศัพท์ (Admin) หรืออีเมล และรหัสผ่าน');
      return;
    }
    
    const trimmedUsername = username.trim();

    // NOTE: Do not bypass on the client. Always authenticate via the API so we receive a valid JWT.

    try {
      const loginUrl = API ? `${API}/api/auth/login` : '/api/auth/login';
      const res = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: trimmedUsername, password }),
      });
      if (!res.ok) {
        setError('Username หรือ Password ไม่ถูกต้อง');
        return;
      }
      const data = await res.json();
      const { token, user } = data;
      // Persist token and identity
      try {
        sessionStorage.setItem('auth_token', token);
        if (user?.id) sessionStorage.setItem('user_id', user.id);
        if (user?.email) sessionStorage.setItem('user_email', user.email);
      } catch {}

      // Pick role: prefer selected role if present in server roles; else first role; else worker
      const serverRoles = Array.isArray(user?.roles) ? user.roles : [];

      if (role === 'admin' && !serverRoles.includes('admin')) {
        setError('บัญชีนี้ไม่ใช่ผู้ดูแลระบบ');
        return;
      }

      const chosenRole = chooseRole(role, serverRoles);
      try { sessionStorage.setItem('role', chosenRole); } catch {}

      // Check if worker profile is completed
      const hasProfile = sessionStorage.getItem('worker_profile');
      const navUser = { username: user?.phone || username, role: chosenRole };
      
      if (chosenRole === 'admin') {
        navigate('/admin', { state: { user: navUser, source: 'login' } });
      } else if (chosenRole === 'project_manager') {
        navigate('/pm', { state: { user: navUser, source: 'login' } });
      } else if (chosenRole === 'worker') {
        navigate('/worker-settings', { state: { user: navUser, source: 'login' } });
      } else {
        navigate('/dashboard', { state: { user: navUser, source: 'login' } });
      }
    } catch (e) {
      console.error(e);
      setError('เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
    }
  };

  return (
    <div className="login-screen">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Kanit:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Noto+Sans+Thai:wght@100..900&family=Roboto:ital,wght@0,100..900;1,100..900&display=swap');
        body, button, input, textarea, select, h1, h2, h3, h4, h5, h6, p, span, div, a, li, label {
          font-family: 'Kanit', 'Noto Sans Thai', 'Inter', 'Roboto', sans-serif !important;
        }
      `}</style>
      <div className="login-page">
        <div>
          <h1 className="login-header"></h1>

          <div className="login-card">
            {info && (
              <div className="login-message-info">
                {info}
              </div>
            )}
            {error && (
              <div className="login-message-error">
                {error}
              </div>
            )}
            <div className="login-row">
              <label className="login-label">Username / Email</label>
              <input className="login-input" placeholder="อีเมล ตัวอย่าง: sakranan@gmail.com" value={username} onChange={e=>setUsername(e.target.value)} />
            </div>
            <div className="login-row">
              <label className="login-label">Password</label>
              <div className="input-with-eye">
                <input className="login-input" type={showPass ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} />
                  <button
                    type="button"
                    className={`eye-btn ${showPass ? 'is-show' : 'is-hide'}`}
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                    onClick={()=>setShowPass(s=>!s)}
                  >
                    {/* Bootstrap eye SVG (inline), uses currentColor */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eye-fill" viewBox="0 0 16 16">
                      <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0"/>
                      <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8m8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7"/>
                    </svg>
                  </button>
              </div>
            </div>
            <div className="login-links">
              <Link to="#">Forgot password</Link>
            </div>
            <button className="login-submit" type="button" onClick={onLogin}>Login</button>
            <div className="login-footer-link">
              ต้องการบัญชีใหม่? กรุณาติดต่อผู้ดูแลระบบเพื่อสร้างบัญชีให้คุณ
            </div>
          </div>
        </div>
        <div className="login-logo-side">
          <img src="/logo123.png" alt="Logo" />
        </div>
      </div>
    </div>
  );
};

export default Login;

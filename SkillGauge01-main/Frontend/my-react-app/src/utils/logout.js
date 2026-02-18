export function performLogout(navigate) {
  try {
    sessionStorage.removeItem('login_prefill_username');
    sessionStorage.removeItem('login_message');
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('user_id');
    sessionStorage.removeItem('user_email');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('worker_profile');
    sessionStorage.removeItem('assessment_answers');
    sessionStorage.removeItem('assessment_start_time');
    sessionStorage.removeItem('assessment_session_id');
    sessionStorage.removeItem('assessment_worker_id');
    sessionStorage.removeItem('assessment_identity_key');
    sessionStorage.removeItem('foreman_id');
  } catch {
    // ignore
  }

  try {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('token');
  } catch {
    // ignore
  }

  try {
    navigate('/login', { replace: true, state: { source: 'logout' } });
    setTimeout(() => {
      try {
        if (window.location.pathname !== '/login') {
          window.location.replace('/login');
        }
      } catch {
        // ignore
      }
    }, 50);
    return;
  } catch {
    // ignore
  }

  try {
    window.location.assign('/login');
  } catch {
    // ignore
  }
}

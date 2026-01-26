export function performLogout(navigate) {
  try {
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('user_id');
    sessionStorage.removeItem('user_email');
    sessionStorage.removeItem('worker_profile');
  } catch {
    // ignore
  }

  // NOTE: Keep localStorage items (like avatars) unless you explicitly want to clear them.
  try {
    navigate('/login', { replace: true, state: { source: 'logout' } });
  } catch {
    // ignore
  }
}

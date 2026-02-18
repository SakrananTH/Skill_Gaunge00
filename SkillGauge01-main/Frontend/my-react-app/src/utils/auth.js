function normalizeRole(role) {
  const value = String(role || '').trim().toLowerCase();
  if (value === 'pm' || value === 'project_manager') return 'project_manager';
  if (value === 'fm' || value === 'foreman') return 'foreman';
  if (value === 'wk' || value === 'worker') return 'worker';
  if (value === 'admin') return 'admin';
  return value;
}

export function chooseRole(selectedRole, serverRoles) {
  const roles = Array.isArray(serverRoles)
    ? serverRoles.map(normalizeRole).filter(Boolean)
    : [];
  const normalizedSelectedRole = normalizeRole(selectedRole);
  if (normalizedSelectedRole && roles.includes(normalizedSelectedRole)) return normalizedSelectedRole;

  // If no explicit role is selected, choose a sensible default.
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('project_manager')) return 'project_manager';
  if (roles.includes('foreman')) return 'foreman';
  if (roles.includes('worker')) return 'worker';

  if (roles.length > 0) return roles[0];
  return 'worker';
}

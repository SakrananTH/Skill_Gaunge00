export function chooseRole(selectedRole, serverRoles) {
  const roles = Array.isArray(serverRoles) ? serverRoles : [];
  if (selectedRole && roles.includes(selectedRole)) return selectedRole;

  // If no explicit role is selected, choose a sensible default.
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('project_manager')) return 'project_manager';
  if (roles.includes('foreman')) return 'foreman';
  if (roles.includes('worker')) return 'worker';

  if (roles.length > 0) return roles[0];
  return 'worker';
}

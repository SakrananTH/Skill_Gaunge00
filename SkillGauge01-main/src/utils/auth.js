export function chooseRole(selectedRole, serverRoles) {
  const roles = Array.isArray(serverRoles) ? serverRoles : [];
  if (selectedRole && roles.includes(selectedRole)) return selectedRole;
  if (roles.length > 0) return roles[0];
  return 'worker';
}

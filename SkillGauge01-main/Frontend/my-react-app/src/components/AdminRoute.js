import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const AdminRoute = ({ children }) => {
  const location = useLocation();
  const stateRole = location.state?.user?.role;
  const storedRole = typeof window !== 'undefined' ? sessionStorage.getItem('role') : null;
  const isAdmin = stateRole === 'admin' || storedRole === 'admin';

  if (!isAdmin) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
};

export default AdminRoute;

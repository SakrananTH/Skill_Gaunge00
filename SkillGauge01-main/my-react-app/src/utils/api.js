const inferLocalApiBase = () => {
  if (typeof window === 'undefined') return '';
  const { protocol, hostname, port } = window.location;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  if (!isLocalhost) return '';
  const devPorts = new Set(['3000', '3001', '3002', '3003']);
  const apiPort = port && !devPorts.has(port) ? port : '4000';
  return `${protocol}//${hostname}:${apiPort}`;
};

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || inferLocalApiBase();

function getAuthToken() {
  if (typeof window === 'undefined') return null;
  try {
    const token = window.sessionStorage?.getItem('auth_token') || window.localStorage?.getItem('auth_token');
    return token || null;
  } catch {
    return null;
  }
}

function isFormData(body) {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

export async function apiRequest(path, options = {}) {
  const { method = 'GET', body, headers, ...rest } = options;
  const requestHeaders = new Headers(headers || {});
  const config = {
    method,
    credentials: options.credentials ?? 'include',
    ...rest
  };

  // Attach bearer token automatically (used by admin endpoints).
  if (!requestHeaders.has('Authorization')) {
    const token = getAuthToken();
    if (token) {
      requestHeaders.set('Authorization', `Bearer ${token}`);
    }
  }

  if (body !== undefined) {
    if (isFormData(body) || body instanceof Blob) {
      config.body = body;
    } else if (typeof body === 'string') {
      if (!requestHeaders.has('Content-Type')) {
        requestHeaders.set('Content-Type', 'application/json');
      }
      config.body = body;
    } else {
      requestHeaders.set('Content-Type', requestHeaders.get('Content-Type') || 'application/json');
      config.body = JSON.stringify(body);
    }
  }

  if ([...requestHeaders.keys()].length > 0) {
    config.headers = requestHeaders;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, config);
  const contentType = response.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => null);
  } else {
    data = await response.text().catch(() => null);
  }

  if (!response.ok) {
    const error = new Error(data && data.message ? data.message : response.statusText);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export { API_BASE_URL };

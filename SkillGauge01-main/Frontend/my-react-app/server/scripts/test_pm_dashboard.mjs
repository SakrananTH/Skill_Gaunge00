const base = 'http://localhost:4000';

async function login(phone, password) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  return res.json();
}

async function call(endpoint, token) {
  const res = await fetch(`${base}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(endpoint, 'status', res.status);
  console.log(endpoint, 'body', await res.text());
}

async function main() {
  try {
    const phone = process.env.TEST_PHONE || '+66810009992';
    const password = process.env.TEST_PASSWORD || 'S3cret@123';
    const { token } = await login(phone, password);
    await call('/api/dashboard/tasks-overview?limit=5', token);
    await call('/api/dashboard/project-task-counts', token);
  } catch (e) {
    console.error('test failed:', e.message);
    process.exit(2);
  }
}

main();

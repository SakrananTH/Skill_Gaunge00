const base = 'http://localhost:4000';

async function main() {
  const body = {
    phone: process.env.TEST_PHONE || '+66810009992',
    password: process.env.TEST_PASSWORD || 'S3cret@123',
  };
  try {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    console.log('status', res.status);
    const text = await res.text();
    console.log('body', text);
  } catch (e) {
    console.error('login request failed:', e.message);
    process.exit(2);
  }
}

main();

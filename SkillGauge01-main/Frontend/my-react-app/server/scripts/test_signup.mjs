const url = 'http://localhost:4000/api/auth/signup';
const body = {
  full_name: 'คุณทดสอบ B',
  phone: '+66810009992',
  email: 'testb992@example.com',
  password: 'S3cret@123',
  role: 'worker'
};

async function main() {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Body:', text);
  } catch (e) {
    console.error('Request failed:', e.message);
    process.exit(2);
  }
}

main();

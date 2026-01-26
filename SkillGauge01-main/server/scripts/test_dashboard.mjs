const base = 'http://localhost:4000';

async function run(name, fn) {
  try {
    console.log(`\n=== ${name} ===`);
    await fn();
  } catch (e) {
    console.error(name, 'failed:', e.message);
  }
}

await run('tasks-overview', async () => {
  const url = new URL('/api/dashboard/tasks-overview', base);
  url.searchParams.set('limit', '5');
  url.searchParams.set('sort', 'due_date_asc');
  const res = await fetch(url);
  console.log('status', res.status);
  console.log('body', await res.text());
});

await run('project-task-counts', async () => {
  const url = new URL('/api/dashboard/project-task-counts', base);
  const res = await fetch(url);
  console.log('status', res.status);
  console.log('body', await res.text());
});

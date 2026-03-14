const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:3000';

async function request(pathname) {
  const response = await fetch(`${BASE_URL}${pathname}`);
  return response;
}

function parseDashboardAssets() {
  const dashboardIndexPath = path.join(__dirname, '..', 'public', 'dashboard', 'index.html');

  if (!fs.existsSync(dashboardIndexPath)) {
    return { jsAsset: null, cssAsset: null };
  }

  const html = fs.readFileSync(dashboardIndexPath, 'utf8');
  const jsMatch = html.match(/assets\/(index-[^"']+\.js)/);
  const cssMatch = html.match(/assets\/(index-[^"']+\.css)/);

  return {
    jsAsset: jsMatch ? `/dashboard/assets/${jsMatch[1]}` : null,
    cssAsset: cssMatch ? `/dashboard/assets/${cssMatch[1]}` : null,
  };
}

async function assertStatus(pathname, expectedStatus) {
  const response = await request(pathname);
  if (response.status !== expectedStatus) {
    throw new Error(`${pathname} expected ${expectedStatus}, got ${response.status}`);
  }
  console.log(`PASS ${pathname} => ${response.status}`);
}

async function run() {
  console.log(`Running smoke tests against ${BASE_URL}`);

  await assertStatus('/api/health', 200);

  const healthRes = await request('/api/health');
  const healthJson = await healthRes.json();
  if (healthJson.status !== 'ok') {
    throw new Error(`/api/health payload status expected ok, got ${healthJson.status}`);
  }
  console.log('PASS /api/health payload status is ok');

  const routes = ['/', '/student.html', '/advisor.html', '/hod.html', '/principal.html', '/admin.html', '/dashboard'];
  for (const route of routes) {
    await assertStatus(route, 200);
  }

  await assertStatus('/api/leaves', 401);

  const { jsAsset, cssAsset } = parseDashboardAssets();
  if (!jsAsset || !cssAsset) {
    throw new Error('Dashboard assets not found. Run npm run build:dashboard first.');
  }

  await assertStatus(jsAsset, 200);
  await assertStatus(cssAsset, 200);

  console.log('All smoke tests passed.');
}

run().catch((error) => {
  console.error(`Smoke tests failed: ${error.message}`);
  process.exit(1);
});

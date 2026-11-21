const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const speakeasy = require('speakeasy');
const { app } = require('../server');
const User = require('../models/User');

describe('Full 2FA End-to-End Integration Flow', () => {
  let server;
  let baseUrl;
  const cookieMap = new Map();
  const testEmail = `test2fa_${Date.now()}@example.com`;
  const testPassword = 'Password123';
  let userSecretBase32 = '';
  let savedRecoveryCodes = [];

  // Helper function to extract CSRF token from HTML
  function extractCsrfToken(html) {
    const match = html.match(/name="_csrf"\s+value="([a-f0-9]+)"/i);
    return match ? match[1] : '';
  }

  // Helper request wrapper with cookie jar
  async function makeRequest(path, options = {}) {
    const headers = options.headers || {};
    const cookieHeader = Array.from(cookieMap.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');

    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
      redirect: 'manual', // do not auto-follow redirects so we can inspect status and cookies
    });

    // Update cookie map
    const setCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
    for (const cookieStr of setCookies) {
      const parts = cookieStr.split(';')[0].trim();
      const eqIdx = parts.indexOf('=');
      if (eqIdx !== -1) {
        const name = parts.slice(0, eqIdx);
        const value = parts.slice(eqIdx + 1);
        cookieMap.set(name, value);
      }
    }

    const bodyText = await response.text();
    return {
      status: response.status,
      headers: response.headers,
      text: bodyText,
      location: response.headers.get('location'),
    };
  }

  before(async () => {
    // Start test server on ephemeral port
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    // Cleanup created test user
    await User.deleteOne({ email: testEmail });
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
  });

  it('1. GET / should return 200 OK', async () => {
    const res = await makeRequest('/');
    assert.strictEqual(res.status, 200);
    assert.ok(res.text.includes('Production-Grade Two-Factor Authentication'));
  });

  it('1b. GET /info and /how-it-works should render 2FA architecture, packages, and guide', async () => {
    const resInfo = await makeRequest('/info');
    assert.strictEqual(resInfo.status, 200);
    assert.ok(resInfo.text.includes('How Two-Factor Authentication Works'));
    assert.ok(resInfo.text.includes('speakeasy'));
    assert.ok(resInfo.text.includes('AES-256-GCM'));

    const resWorks = await makeRequest('/how-it-works');
    assert.strictEqual(resWorks.status, 200);
    assert.ok(resWorks.text.includes('Packages &amp; Libraries Used'));
  });

  it('2. GET /auth/register should provide CSRF token', async () => {
    const res = await makeRequest('/auth/register');
    assert.strictEqual(res.status, 200);
    const token = extractCsrfToken(res.text);
    assert.ok(token, 'CSRF token must exist on registration form');
  });

  it('3. POST /auth/register with invalid data should display flash error immediately', async () => {
    const getRes = await makeRequest('/auth/register');
    const csrfToken = extractCsrfToken(getRes.text);

    const body = new URLSearchParams({
      _csrf: csrfToken,
      name: 'A', // invalid name: too short
      email: 'invalid-email',
      password: 'weak',
      confirmPassword: 'mismatch',
    });

    const res = await makeRequest('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    assert.strictEqual(res.status, 400);
    assert.ok(
      res.text.includes('Full name must be at least 2 characters'),
      'Rendered response must contain flash error immediately'
    );
  });

  it('4. POST /auth/register with valid credentials creates user', async () => {
    const getRes = await makeRequest('/auth/register');
    const csrfToken = extractCsrfToken(getRes.text);

    const body = new URLSearchParams({
      _csrf: csrfToken,
      name: 'Integration User',
      email: testEmail,
      password: testPassword,
      confirmPassword: testPassword,
    });

    const res = await makeRequest('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    assert.strictEqual(res.status, 302);
    assert.strictEqual(res.location, '/auth/login');

    // Follow redirect to login page
    const loginPage = await makeRequest('/auth/login');
    assert.strictEqual(loginPage.status, 200);
    assert.ok(loginPage.text.includes('Registration successful'));
  });

  it('5. POST /auth/login logs user into Dashboard (when 2FA is disabled)', async () => {
    const getRes = await makeRequest('/auth/login');
    const csrfToken = extractCsrfToken(getRes.text);

    const body = new URLSearchParams({
      _csrf: csrfToken,
      email: testEmail,
      password: testPassword,
    });

    const res = await makeRequest('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    assert.strictEqual(res.status, 302);
    assert.strictEqual(res.location, '/dashboard');

    const dashRes = await makeRequest('/dashboard');
    assert.strictEqual(dashRes.status, 200);
    assert.ok(dashRes.text.includes('Integration User'));
    assert.ok(dashRes.text.includes('2FA Disabled'));
  });

  it('6. GET /2fa/setup initializes temporary secret and displays QR code', async () => {
    const res = await makeRequest('/2fa/setup');
    assert.strictEqual(res.status, 200);
    assert.ok(res.text.includes('data:image/png;base64,'));

    // Extract secret key from setup view
    const secretMatch = res.text.match(/id="secretKeyText"[^>]*>([A-Z0-9]+)</i);
    assert.ok(secretMatch, 'Secret key must be present in setup HTML');
    userSecretBase32 = secretMatch[1];
    assert.strictEqual(userSecretBase32.length, 32);
  });

  it('7. POST /2fa/verify-setup with invalid OTP code fails', async () => {
    const getRes = await makeRequest('/2fa/setup');
    const csrfToken = extractCsrfToken(getRes.text);

    const body = new URLSearchParams({
      _csrf: csrfToken,
      token: '000000',
    });

    const res = await makeRequest('/2fa/verify-setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    assert.strictEqual(res.status, 302);
    assert.strictEqual(res.location, '/2fa/setup');

    // Confirm that following redirect retains the same secret key!
    const setupPageAgain = await makeRequest('/2fa/setup');
    const secretMatchAgain = setupPageAgain.text.match(/id="secretKeyText"[^>]*>([A-Z0-9]+)</i);
    assert.strictEqual(secretMatchAgain[1], userSecretBase32, 'Temporary secret must be preserved across invalid attempts');
  });

  it('8. POST /2fa/verify-setup with valid OTP enables 2FA and generates Recovery Codes', async () => {
    const getRes = await makeRequest('/2fa/setup');
    const csrfToken = extractCsrfToken(getRes.text);

    const validOtp = speakeasy.totp({
      secret: userSecretBase32,
      encoding: 'base32',
    });

    const body = new URLSearchParams({
      _csrf: csrfToken,
      token: validOtp,
    });

    const res = await makeRequest('/2fa/verify-setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    assert.strictEqual(res.status, 302);
    assert.strictEqual(res.location, '/2fa/recovery-codes');

    // Follow redirect to recovery codes view
    const codesRes = await makeRequest('/2fa/recovery-codes');
    assert.strictEqual(codesRes.status, 200);
    assert.ok(codesRes.text.includes('Your Emergency Recovery Codes'));

    // Extract all generated recovery codes
    const codeMatches = [...codesRes.text.matchAll(/data-code="([2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4})"/g)];
    assert.strictEqual(codeMatches.length, 10);
    savedRecoveryCodes = codeMatches.map((m) => m[1]);

    // Acknowledge recovery codes
    const confirmCsrf = extractCsrfToken(codesRes.text);
    const confirmRes = await makeRequest('/2fa/confirm-recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ _csrf: confirmCsrf }).toString(),
    });
    assert.strictEqual(confirmRes.status, 302);
    assert.strictEqual(confirmRes.location, '/dashboard');
  });

  it('9. POST /auth/logout logs user out', async () => {
    const dashRes = await makeRequest('/dashboard');
    const csrfToken = extractCsrfToken(dashRes.text);

    const res = await makeRequest('/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ _csrf: csrfToken }).toString(),
    });

    assert.strictEqual(res.status, 302);
    assert.strictEqual(res.location, '/auth/login');
  });

  it('10. POST /auth/login with 2FA enabled redirects to /2fa/verify', async () => {
    const loginGet = await makeRequest('/auth/login');
    const csrfToken = extractCsrfToken(loginGet.text);

    const body = new URLSearchParams({
      _csrf: csrfToken,
      email: testEmail,
      password: testPassword,
    });

    const res = await makeRequest('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    assert.strictEqual(res.status, 302);
    assert.strictEqual(res.location, '/2fa/verify');

    // Check verify page
    const verifyPage = await makeRequest('/2fa/verify');
    assert.strictEqual(verifyPage.status, 200);
    assert.ok(verifyPage.text.includes(testEmail));
  });

  it('11. Direct access to /dashboard is blocked while in pending 2FA state', async () => {
    const dashRes = await makeRequest('/dashboard');
    assert.strictEqual(dashRes.status, 302);
    assert.strictEqual(dashRes.location, '/2fa/verify');
  });

  it('12. POST /2fa/verify-login with valid OTP grants dashboard access', async () => {
    const verifyGet = await makeRequest('/2fa/verify');
    const csrfToken = extractCsrfToken(verifyGet.text);

    const validOtp = speakeasy.totp({
      secret: userSecretBase32,
      encoding: 'base32',
    });

    const res = await makeRequest('/2fa/verify-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ _csrf: csrfToken, token: validOtp }).toString(),
    });

    assert.strictEqual(res.status, 302);
    assert.strictEqual(res.location, '/dashboard');

    const dashRes = await makeRequest('/dashboard');
    assert.strictEqual(dashRes.status, 200);
    assert.ok(dashRes.text.includes('2FA Protected'));
    assert.ok(dashRes.text.includes('of 10 codes remaining'));
    assert.ok(dashRes.text.includes('>10</span>'));
  });

  it('13. Authenticate with an Emergency Recovery Code (without hyphen & lowercase)', async () => {
    // Logout first
    const dashRes = await makeRequest('/dashboard');
    const logoutCsrf = extractCsrfToken(dashRes.text);
    await makeRequest('/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ _csrf: logoutCsrf }).toString(),
    });

    // Login with credentials
    const loginGet = await makeRequest('/auth/login');
    const loginCsrf = extractCsrfToken(loginGet.text);
    await makeRequest('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        _csrf: loginCsrf,
        email: testEmail,
        password: testPassword,
      }).toString(),
    });

    // Verify with recovery code #1, typed without dash in lowercase
    const verifyGet = await makeRequest('/2fa/verify');
    const verifyCsrf = extractCsrfToken(verifyGet.text);
    const unformattedCode = savedRecoveryCodes[0].replace('-', '').toLowerCase();

    const recoveryRes = await makeRequest('/2fa/verify-recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        _csrf: verifyCsrf,
        recoveryCode: unformattedCode,
      }).toString(),
    });

    assert.strictEqual(recoveryRes.status, 302);
    assert.strictEqual(recoveryRes.location, '/dashboard');

    const dashAfterRecovery = await makeRequest('/dashboard');
    assert.strictEqual(dashAfterRecovery.status, 200);
    assert.ok(dashAfterRecovery.text.includes('of 10 codes remaining'));
    assert.ok(dashAfterRecovery.text.includes('>9</span>'));
  });

  it('14. Used recovery code cannot be reused', async () => {
    // Logout
    const dashRes = await makeRequest('/dashboard');
    const logoutCsrf = extractCsrfToken(dashRes.text);
    await makeRequest('/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ _csrf: logoutCsrf }).toString(),
    });

    // Login credentials
    const loginGet = await makeRequest('/auth/login');
    const loginCsrf = extractCsrfToken(loginGet.text);
    await makeRequest('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        _csrf: loginCsrf,
        email: testEmail,
        password: testPassword,
      }).toString(),
    });

    // Try re-using the first recovery code (which was consumed in previous test)
    const verifyGet = await makeRequest('/2fa/verify');
    const verifyCsrf = extractCsrfToken(verifyGet.text);

    const reusedRes = await makeRequest('/2fa/verify-recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        _csrf: verifyCsrf,
        recoveryCode: savedRecoveryCodes[0],
      }).toString(),
    });

    assert.strictEqual(reusedRes.status, 302);
    assert.strictEqual(reusedRes.location, '/2fa/verify');
  });

  it('15. Disable 2FA with password and Recovery Code', async () => {
    // Authenticate using second recovery code
    const verifyGet = await makeRequest('/2fa/verify');
    const verifyCsrf = extractCsrfToken(verifyGet.text);

    await makeRequest('/2fa/verify-recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        _csrf: verifyCsrf,
        recoveryCode: savedRecoveryCodes[1],
      }).toString(),
    });

    // Go to disable 2FA
    const disableGet = await makeRequest('/2fa/disable');
    assert.strictEqual(disableGet.status, 200);
    const disableCsrf = extractCsrfToken(disableGet.text);

    // Disable 2FA using 3rd recovery code
    const disableRes = await makeRequest('/2fa/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        _csrf: disableCsrf,
        password: testPassword,
        token: savedRecoveryCodes[2],
      }).toString(),
    });

    assert.strictEqual(disableRes.status, 302);
    assert.strictEqual(disableRes.location, '/dashboard');

    const dashRes = await makeRequest('/dashboard');
    assert.strictEqual(dashRes.status, 200);
    assert.ok(dashRes.text.includes('2FA Disabled'));
  });
});

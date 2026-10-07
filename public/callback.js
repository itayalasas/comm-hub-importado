// Script de /callback, separado del HTML para que la Content-Security-Policy
// no tenga que permitir scripts inline.
const fullUrl = window.location.href;

console.log('=== CALLBACK HTML HANDLER ===');
console.log('Full URL:', fullUrl);
console.log('URL length:', fullUrl.length);

let token = null;
let code = null;
let error = null;

if (window.location.hash) {
  console.log('Hash present:', window.location.hash);
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  token = hashParams.get('token');
  code = hashParams.get('code');
  error = hashParams.get('error');

  console.log('Hash params - Token:', token ? 'YES' : 'NO');
  console.log('Hash params - Code:', code ? 'YES' : 'NO');
  console.log('Hash params - Error:', error ? 'YES' : 'NO');
}

if (!token && !code && !error && window.location.search) {
  console.log('Search present:', window.location.search);
  const urlObj = new URL(fullUrl);
  token = urlObj.searchParams.get('token');
  code = urlObj.searchParams.get('code');
  error = urlObj.searchParams.get('error');

  console.log('Query params - Token:', token ? 'YES' : 'NO');
  console.log('Query params - Code:', code ? 'YES' : 'NO');
  console.log('Query params - Error:', error ? 'YES' : 'NO');
}

if (error) {
  console.error('Error found:', error);
  window.location.href = '/login';
} else if (code || token) {
  const authValue = code || token;
  console.log('Auth value found:', authValue);
  console.log('Storing in sessionStorage and redirecting...');

  sessionStorage.setItem('authCallback', JSON.stringify({
    token: token,
    code: code,
    timestamp: Date.now()
  }));

  console.log('Redirecting to /auth-processing');
  window.location.href = '/auth-processing';
} else {
  console.error('No token, code, or error found in URL');
  console.log('Hash:', window.location.hash);
  console.log('Search:', window.location.search);
  setTimeout(() => {
    console.log('Redirecting to login...');
    window.location.href = '/login';
  }, 2000);
}

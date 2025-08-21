// Advanced cryptographic utilities for secure authentication
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt = 'gts_enterprise_salt_2024_secure';
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export function generateSecureUserId() {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substr(2, 12);
  const cryptoRandom = crypto.getRandomValues(new Uint8Array(4));
  const cryptoHex = Array.from(cryptoRandom).map(b => b.toString(16).padStart(2, '0')).join('');
  return `gts_${timestamp}_${randomPart}_${cryptoHex}`;
}

export function validatePassword(password) {
  const minLength = 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  
  return {
    isValid: password.length >= minLength && hasUpper && hasLower && hasNumber && hasSpecial,
    score: [password.length >= minLength, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length,
    checks: {
      length: password.length >= minLength,
      upper: hasUpper,
      lower: hasLower,
      number: hasNumber,
      special: hasSpecial
    }
  };
}

export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateUsername(username) {
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
}
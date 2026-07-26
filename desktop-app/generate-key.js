/**
 * Run this to generate a license key:
 * node generate-key.js
 * 
 * It prints a valid key you can give to a customer.
 */

const crypto = require('crypto');

// CHANGE THIS to match what's in src/main/license.ts
const LICENSE_SECRET = 'TG-PRIISMA-2026-GUARDIAN-SECRET-KEY';

function generateLicenseKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segment = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  
  const payload = `TG-${segment()}-${segment()}-${segment()}`;
  const checksum = crypto.createHmac('sha256', LICENSE_SECRET)
    .update(payload)
    .digest('hex')
    .substring(0, 8)
    .toUpperCase();
  
  return `${payload}-${checksum}`;
}

// Generate and print
const key = generateLicenseKey();
console.log('\n  License Key: ' + key + '\n');

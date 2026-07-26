import crypto from 'crypto';
import os from 'os';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

// Secret key for signing — CHANGE THIS to your own secret before shipping
const LICENSE_SECRET = 'TG-PRIISMA-2026-GUARDIAN-SECRET-KEY';

/**
 * Generate a machine fingerprint based on hardware
 */
function getMachineId(): string {
  const cpus = os.cpus();
  const hostname = os.hostname();
  const platform = os.platform();
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'unknown';
  const raw = `${hostname}-${platform}-${cpuModel}-${os.totalmem()}`;
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 16);
}

/**
 * Validate a license key
 * Format: TG-XXXX-XXXX-XXXX-XXXX
 * The key contains a signature that can be verified with the secret
 */
function validateKey(key: string): boolean {
  if (!key || !key.startsWith('TG-')) return false;
  const parts = key.split('-');
  if (parts.length !== 5) return false;
  
  // Last part is the checksum, first 4 parts are the payload
  const payload = parts.slice(0, 4).join('-');
  const checksum = parts[4];
  
  // Verify checksum
  const expected = crypto.createHmac('sha256', LICENSE_SECRET)
    .update(payload)
    .digest('hex')
    .substring(0, 8)
    .toUpperCase();
  
  return checksum === expected;
}

/**
 * Generate a license key (for you to use — run this to create keys for customers)
 */
export function generateLicenseKey(): string {
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

/**
 * Get the license file path
 */
function getLicenseFilePath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'license.json');
}

/**
 * Check if the app is activated
 */
export function isActivated(): boolean {
  try {
    const licensePath = getLicenseFilePath();
    if (!fs.existsSync(licensePath)) return false;
    
    const data = JSON.parse(fs.readFileSync(licensePath, 'utf-8'));
    if (!data.key || !data.machineId) return false;
    
    // Verify key is valid
    if (!validateKey(data.key)) return false;
    
    // Verify machine matches
    if (data.machineId !== getMachineId()) return false;
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Activate with a license key
 */
export function activate(key: string): { success: boolean; error?: string } {
  // Validate key format and signature
  if (!validateKey(key)) {
    return { success: false, error: 'Invalid license key' };
  }
  
  // Save with machine ID
  const licenseData = {
    key,
    machineId: getMachineId(),
    activatedAt: new Date().toISOString(),
  };
  
  try {
    const licensePath = getLicenseFilePath();
    fs.writeFileSync(licensePath, JSON.stringify(licenseData, null, 2));
    return { success: true };
  } catch (e: any) {
    return { success: false, error: 'Failed to save license: ' + e.message };
  }
}

/**
 * Deactivate (remove license)
 */
export function deactivate(): void {
  try {
    const licensePath = getLicenseFilePath();
    if (fs.existsSync(licensePath)) fs.unlinkSync(licensePath);
  } catch {}
}

/**
 * Get current license info
 */
export function getLicenseInfo(): { key: string; machineId: string; activatedAt: string } | null {
  try {
    const licensePath = getLicenseFilePath();
    if (!fs.existsSync(licensePath)) return null;
    return JSON.parse(fs.readFileSync(licensePath, 'utf-8'));
  } catch {
    return null;
  }
}

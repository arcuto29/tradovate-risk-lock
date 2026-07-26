import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

const HOSTS_PATH = 'C:\\Windows\\System32\\drivers\\etc\\hosts';
const HOSTS_MARKER_START = '# --- TRADING GUARDIAN BLOCK START ---';
const HOSTS_MARKER_END = '# --- TRADING GUARDIAN BLOCK END ---';

export interface Platform {
  id: string;
  name: string;
  processes: string[];   // e.g. ['TopstepX.exe']
  domains: string[];     // e.g. ['topstepx.com']
  builtIn: boolean;
  enabled: boolean;      // whether to block this platform
}

// Built-in platforms that come with the app
export const BUILT_IN_PLATFORMS: Platform[] = [
  { id: 'topstepx', name: 'TopstepX', processes: ['TopstepX.exe'], domains: ['topstepx.com', 'www.topstepx.com', 'app.topstepx.com'], builtIn: true, enabled: true },
  { id: 'tradovate', name: 'Tradovate', processes: ['Tradovate.exe'], domains: ['trader.tradovate.com', 'www.tradovate.com'], builtIn: true, enabled: true },
  { id: 'tradesea', name: 'Tradesea', processes: ['Tradesea.exe'], domains: ['app.tradesea.ai', 'tradesea.ai'], builtIn: true, enabled: true },
  { id: 'tradingview', name: 'TradingView', processes: [], domains: ['www.tradingview.com', 'tradingview.com'], builtIn: true, enabled: true },
  { id: 'ninjatrader', name: 'NinjaTrader', processes: ['NinjaTrader.exe', 'NinjaTrader64.exe'], domains: ['ninjatrader.com'], builtIn: true, enabled: true },
  { id: 'metatrader', name: 'MetaTrader', processes: ['terminal.exe', 'terminal64.exe', 'metatrader.exe'], domains: ['metatrader.com'], builtIn: true, enabled: true },
  { id: 'thinkorswim', name: 'thinkorswim', processes: ['thinkorswim.exe'], domains: ['trade.thinkorswim.com'], builtIn: true, enabled: false },
  { id: 'quantower', name: 'Quantower', processes: ['Quantower.exe'], domains: ['quantower.com'], builtIn: true, enabled: false },
  { id: 'sierrachart', name: 'Sierra Chart', processes: ['SierraChart.exe'], domains: ['sierrachart.com'], builtIn: true, enabled: false },
  { id: 'rithmic', name: 'Rithmic R|Trader', processes: ['RTrader.exe', 'RTraderPro.exe'], domains: ['rithmic.com'], builtIn: true, enabled: false },
  { id: 'bookmap', name: 'Bookmap', processes: ['Bookmap.exe'], domains: ['bookmap.com'], builtIn: true, enabled: false },
  { id: 'atas', name: 'ATAS', processes: ['ATAS.exe'], domains: ['atas.net'], builtIn: true, enabled: false },
  { id: 'motivewave', name: 'MotiveWave', processes: ['MotiveWave.exe'], domains: ['motivewave.com'], builtIn: true, enabled: false },
  { id: 'ctrader', name: 'cTrader', processes: ['cTrader.exe'], domains: ['ctrader.com'], builtIn: true, enabled: false },
  { id: 'ibkr', name: 'Interactive Brokers TWS', processes: ['tws.exe', 'javaw.exe'], domains: ['interactivebrokers.com', 'ibkr.com'], builtIn: true, enabled: false },
  { id: 'projectx', name: 'ProjectX', processes: ['ProjectX.exe'], domains: ['projectx.com'], builtIn: true, enabled: false },
];

export class PlatformBlocker {
  private platforms: Platform[] = [];
  private killInterval: NodeJS.Timeout | null = null;
  private active: boolean = false;

  constructor() {
    this.platforms = [...BUILT_IN_PLATFORMS];
  }

  loadCustomPlatforms(custom: Platform[]): void {
    // Merge custom with built-in
    this.platforms = [...BUILT_IN_PLATFORMS, ...custom];
  }

  updatePlatformEnabled(id: string, enabled: boolean): void {
    const p = this.platforms.find(pl => pl.id === id);
    if (p) p.enabled = enabled;
  }

  getPlatforms(): Platform[] {
    return this.platforms;
  }

  getEnabledPlatforms(): Platform[] {
    return this.platforms.filter(p => p.enabled);
  }

  activate(): void {
    if (this.active) return;
    this.active = true;

    // Block hosts file
    this.blockHosts();

    // Kill processes immediately
    this.killProcesses();

    // Keep killing every 5 seconds
    this.killInterval = setInterval(() => {
      this.killProcesses();
    }, 5000);
  }

  deactivate(): void {
    this.active = false;
    if (this.killInterval) {
      clearInterval(this.killInterval);
      this.killInterval = null;
    }
    // Unblock hosts file
    this.unblockHosts();
  }

  isActive(): boolean {
    return this.active;
  }

  private killProcesses(): void {
    const enabled = this.getEnabledPlatforms();
    enabled.forEach(platform => {
      platform.processes.forEach(proc => {
        exec(`taskkill /F /IM "${proc}" /T`, () => {});
      });
    });

    // Also close browser tabs for blocked domains
    this.closeBrowserTabs();
  }

  private closeBrowserTabs(): void {
    // Close Chrome tabs matching blocked domains
    const enabled = this.getEnabledPlatforms();
    const domains = enabled.flatMap(p => p.domains);
    if (domains.length === 0) return;

    // Use PowerShell to close browser tabs by window title
    // This is a best-effort approach
    domains.forEach(domain => {
      const shortName = domain.replace('www.', '').replace('app.', '').split('.')[0];
      // Close Chrome windows with matching title
      exec(`powershell -Command "Get-Process chrome -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowTitle -like '*${shortName}*'} | ForEach-Object { $_.CloseMainWindow() }"`, () => {});
    });
  }

  private blockHosts(): void {
    try {
      const enabled = this.getEnabledPlatforms();
      const domains = enabled.flatMap(p => p.domains);
      if (domains.length === 0) return;

      let hostsContent = '';
      if (fs.existsSync(HOSTS_PATH)) {
        hostsContent = fs.readFileSync(HOSTS_PATH, 'utf-8');
      }

      // Remove existing block if any
      hostsContent = this.removeExistingBlock(hostsContent);

      // Add new block
      const blockEntries = domains.map(d => `127.0.0.1 ${d}`).join('\n');
      const blockSection = `\n${HOSTS_MARKER_START}\n${blockEntries}\n${HOSTS_MARKER_END}\n`;

      hostsContent += blockSection;
      fs.writeFileSync(HOSTS_PATH, hostsContent, 'utf-8');
    } catch (e) {
      // Hosts file requires admin - this might fail
      console.log('[PlatformBlocker] Could not edit hosts file (need admin):', e);
    }
  }

  private unblockHosts(): void {
    try {
      if (!fs.existsSync(HOSTS_PATH)) return;
      let hostsContent = fs.readFileSync(HOSTS_PATH, 'utf-8');
      hostsContent = this.removeExistingBlock(hostsContent);
      fs.writeFileSync(HOSTS_PATH, hostsContent, 'utf-8');
    } catch (e) {
      console.log('[PlatformBlocker] Could not edit hosts file (need admin):', e);
    }
  }

  private removeExistingBlock(content: string): string {
    const startIdx = content.indexOf(HOSTS_MARKER_START);
    const endIdx = content.indexOf(HOSTS_MARKER_END);
    if (startIdx === -1 || endIdx === -1) return content;
    return content.substring(0, startIdx) + content.substring(endIdx + HOSTS_MARKER_END.length);
  }
}

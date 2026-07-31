import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';

const IS_MAC = process.platform === 'darwin';
const IS_WIN = process.platform === 'win32';

const HOSTS_PATH = IS_WIN
  ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
  : '/etc/hosts';

const HOSTS_MARKER_START = '# --- TRADING GUARDIAN BLOCK START ---';
const HOSTS_MARKER_END = '# --- TRADING GUARDIAN BLOCK END ---';

export interface Platform {
  id: string;
  name: string;
  processes: string[];       // Windows: ['TopstepX.exe'], Mac: ['TopstepX']
  macProcesses: string[];   // macOS-specific process names
  domains: string[];
  builtIn: boolean;
  enabled: boolean;
}

// Built-in platforms
export const BUILT_IN_PLATFORMS: Platform[] = [
  { id: 'topstepx', name: 'TopstepX', processes: ['TopstepX.exe'], macProcesses: ['TopstepX'], domains: ['topstepx.com', 'www.topstepx.com', 'app.topstepx.com'], builtIn: true, enabled: true },
  { id: 'tradovate', name: 'Tradovate', processes: ['Tradovate.exe'], macProcesses: ['Tradovate'], domains: ['trader.tradovate.com', 'www.tradovate.com'], builtIn: true, enabled: true },
  { id: 'tradesea', name: 'Tradesea', processes: ['Tradesea.exe'], macProcesses: ['Tradesea'], domains: ['app.tradesea.ai', 'tradesea.ai'], builtIn: true, enabled: true },
  { id: 'tradingview', name: 'TradingView', processes: [], macProcesses: [], domains: ['www.tradingview.com', 'tradingview.com'], builtIn: true, enabled: true },
  { id: 'ninjatrader', name: 'NinjaTrader', processes: ['NinjaTrader.exe', 'NinjaTrader64.exe'], macProcesses: ['NinjaTrader'], domains: ['ninjatrader.com'], builtIn: true, enabled: true },
  { id: 'metatrader', name: 'MetaTrader', processes: ['terminal.exe', 'terminal64.exe', 'metatrader.exe'], macProcesses: ['MetaTrader', 'MetaTrader 5'], domains: ['metatrader.com'], builtIn: true, enabled: true },
  { id: 'thinkorswim', name: 'thinkorswim', processes: ['thinkorswim.exe'], macProcesses: ['thinkorswim'], domains: ['trade.thinkorswim.com'], builtIn: true, enabled: false },
  { id: 'quantower', name: 'Quantower', processes: ['Quantower.exe'], macProcesses: ['Quantower'], domains: ['quantower.com'], builtIn: true, enabled: false },
  { id: 'sierrachart', name: 'Sierra Chart', processes: ['SierraChart.exe'], macProcesses: ['Sierra Chart'], domains: ['sierrachart.com'], builtIn: true, enabled: false },
  { id: 'rithmic', name: 'Rithmic R|Trader', processes: ['RTrader.exe', 'RTraderPro.exe'], macProcesses: ['RTrader'], domains: ['rithmic.com'], builtIn: true, enabled: false },
  { id: 'bookmap', name: 'Bookmap', processes: ['Bookmap.exe'], macProcesses: ['Bookmap'], domains: ['bookmap.com'], builtIn: true, enabled: false },
  { id: 'atas', name: 'ATAS', processes: ['ATAS.exe'], macProcesses: ['ATAS'], domains: ['atas.net'], builtIn: true, enabled: false },
  { id: 'motivewave', name: 'MotiveWave', processes: ['MotiveWave.exe'], macProcesses: ['MotiveWave'], domains: ['motivewave.com'], builtIn: true, enabled: false },
  { id: 'ctrader', name: 'cTrader', processes: ['cTrader.exe'], macProcesses: ['cTrader'], domains: ['ctrader.com'], builtIn: true, enabled: false },
  { id: 'ibkr', name: 'Interactive Brokers TWS', processes: ['tws.exe', 'javaw.exe'], macProcesses: ['Trader Workstation', 'tws'], domains: ['interactivebrokers.com', 'ibkr.com'], builtIn: true, enabled: false },
  { id: 'projectx', name: 'ProjectX', processes: ['ProjectX.exe'], macProcesses: ['ProjectX'], domains: ['projectx.com'], builtIn: true, enabled: false },
  { id: 'redline', name: 'Redline Funding', processes: [], macProcesses: [], domains: ['redlinefuturesfunding.com', 'www.redlinefuturesfunding.com'], builtIn: true, enabled: false },
  { id: 'apex', name: 'Apex Trader Funding', processes: [], macProcesses: [], domains: ['apextraderfunding.com', 'app.apextraderfunding.com'], builtIn: true, enabled: false },
  { id: 'takeprofittrader', name: 'Take Profit Trader', processes: [], macProcesses: [], domains: ['takeprofittrader.com', 'app.takeprofittrader.com'], builtIn: true, enabled: false },
];

export class PlatformBlocker {
  private platforms: Platform[] = [];
  private killInterval: NodeJS.Timeout | null = null;
  private active: boolean = false;

  constructor() {
    this.platforms = [...BUILT_IN_PLATFORMS];
  }

  loadCustomPlatforms(custom: Platform[]): void {
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

    this.blockHosts();
    this.killProcesses();

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
    this.unblockHosts();
  }

  isActive(): boolean {
    return this.active;
  }

  private killProcesses(): void {
    const enabled = this.getEnabledPlatforms();

    if (IS_WIN) {
      // Windows: taskkill
      enabled.forEach(platform => {
        platform.processes.forEach(proc => {
          exec(`taskkill /F /IM "${proc}" /T`, () => {});
        });
      });
      this.closeBrowserTabsWindows();
    } else if (IS_MAC) {
      // macOS: pkill / killall
      enabled.forEach(platform => {
        platform.macProcesses.forEach(proc => {
          exec(`pkill -f "${proc}"`, () => {});
          exec(`killall "${proc}" 2>/dev/null`, () => {});
        });
      });
      this.closeBrowserTabsMac();
    }
  }

  private closeBrowserTabsWindows(): void {
    // Don't kill the browser - only block sites via hosts file
    // Killing chrome.exe would close ALL tabs (email, youtube, etc)
    // Hosts file blocking is sufficient for websites
  }

  private closeBrowserTabsMac(): void {
    // Don't kill browsers - only block sites via hosts file
    // Killing Safari/Chrome would close ALL tabs
    // Hosts file blocking is sufficient for websites
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

      hostsContent = this.removeExistingBlock(hostsContent);

      const blockEntries = domains.map(d => `127.0.0.1 ${d}`).join('\n');
      const blockSection = `\n${HOSTS_MARKER_START}\n${blockEntries}\n${HOSTS_MARKER_END}\n`;

      hostsContent += blockSection;

      if (IS_MAC) {
        // macOS: need sudo to write hosts, use temp file + osascript for admin prompt
        const tempPath = '/tmp/trading-guardian-hosts';
        fs.writeFileSync(tempPath, hostsContent, 'utf-8');
        exec(`osascript -e 'do shell script "cp ${tempPath} /etc/hosts" with administrator privileges'`, () => {
          // Flush DNS cache on macOS
          exec('dscacheutil -flushcache && sudo killall -HUP mDNSResponder', () => {});
        });
      } else {
        fs.writeFileSync(HOSTS_PATH, hostsContent, 'utf-8');
        // Flush DNS cache on Windows
        exec('ipconfig /flushdns', () => {});
      }
    } catch (e) {
      console.log('[PlatformBlocker] Could not edit hosts file:', e);
    }
  }

  private unblockHosts(): void {
    try {
      if (!fs.existsSync(HOSTS_PATH)) return;
      let hostsContent = fs.readFileSync(HOSTS_PATH, 'utf-8');
      hostsContent = this.removeExistingBlock(hostsContent);

      if (IS_MAC) {
        const tempPath = '/tmp/trading-guardian-hosts';
        fs.writeFileSync(tempPath, hostsContent, 'utf-8');
        exec(`osascript -e 'do shell script "cp ${tempPath} /etc/hosts" with administrator privileges'`, () => {
          exec('dscacheutil -flushcache && sudo killall -HUP mDNSResponder', () => {});
        });
      } else {
        fs.writeFileSync(HOSTS_PATH, hostsContent, 'utf-8');
        exec('ipconfig /flushdns', () => {});
      }
    } catch (e) {
      console.log('[PlatformBlocker] Could not edit hosts file:', e);
    }
  }

  private removeExistingBlock(content: string): string {
    const startIdx = content.indexOf(HOSTS_MARKER_START);
    const endIdx = content.indexOf(HOSTS_MARKER_END);
    if (startIdx === -1 || endIdx === -1) return content;
    return content.substring(0, startIdx) + content.substring(endIdx + HOSTS_MARKER_END.length);
  }
}

// Single source of truth for module metadata (Constitution §4).
// If numbering changes, change it here and in the Constitution — nowhere else.
export interface ModuleInfo {
  number: string;
  name: string;
  route: string;
  navLabel: string;
  built: boolean;
}

export const MODULES: readonly ModuleInfo[] = [
  { number: '01', name: 'Dashboard', route: '/dashboard', navLabel: 'Home', built: true },
  { number: '02', name: 'Discovery', route: '/discovery', navLabel: 'Discovery', built: false },
  { number: '03', name: 'Verification', route: '/verification', navLabel: 'Verification', built: false },
  { number: '04', name: 'Ranking/Fit', route: '/ranking', navLabel: 'Ranking', built: false },
  { number: '05', name: 'Editorial Selection', route: '/selection', navLabel: 'Selection', built: false },
  { number: '06', name: 'Story Research', route: '/research', navLabel: 'Research', built: false },
  { number: '07', name: 'Script Engine', route: '/scripts', navLabel: 'Scripts', built: false },
  { number: '08', name: 'Visual Research', route: '/visuals', navLabel: 'Visuals', built: false },
  { number: '09', name: 'Distribution/Analytics', route: '/analytics', navLabel: 'Analytics', built: false },
] as const;

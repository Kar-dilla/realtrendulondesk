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

// ---------------------------------------------------------------------------
// Sidebar navigation (P01). The app shell reads this, not MODULES.
// Routes are unchanged; only the labels differ (CONTRACT.md §3).
// /verification and /selection are reached from story cards, not the sidebar.
// ---------------------------------------------------------------------------

/** Names of lucide-react icons. components/ui/Nav.tsx maps each name to its icon. */
export type NavIconName =
  | 'LayoutDashboard'
  | 'Newspaper'
  | 'TrendingUp'
  | 'FlaskConical'
  | 'Clapperboard'
  | 'Image'
  | 'Send'
  | 'Gauge'
  | 'Scale'
  | 'Settings';

export interface NavItem {
  label: string;
  route: string;
  icon: NavIconName;
}

export interface NavSection {
  group: string;
  items: readonly NavItem[];
}

export const NAV_SECTIONS: readonly NavSection[] = [
  {
    group: 'NEWSROOM',
    items: [
      { label: 'Dashboard', route: '/dashboard', icon: 'LayoutDashboard' },
      { label: "Today's News", route: '/discovery', icon: 'Newspaper' },
      { label: 'Top Stories', route: '/ranking', icon: 'TrendingUp' },
      { label: 'Deep Research', route: '/research', icon: 'FlaskConical' },
      { label: 'Script Studio', route: '/scripts', icon: 'Clapperboard' },
      { label: 'Media Assets', route: '/visuals', icon: 'Image' },
    ],
  },
  {
    group: 'RESULTS',
    items: [
      { label: 'Published Stories', route: '/published', icon: 'Send' },
      { label: 'Performance', route: '/analytics', icon: 'Gauge' },
    ],
  },
  {
    group: 'CONFIGURE',
    items: [
      { label: 'Editorial Standards', route: '/standards', icon: 'Scale' },
      { label: 'Settings', route: '/settings', icon: 'Settings' },
    ],
  },
];

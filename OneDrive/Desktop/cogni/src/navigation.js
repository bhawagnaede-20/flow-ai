import { AlertTriangle, LayoutDashboard, Leaf, Map, Siren } from 'lucide-react';

/** Central navigation registry — sidebar, mobile drawer and header all read from here. */
export const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    shortLabel: 'Home',
    title: 'Dashboard',
    description: 'Network overview, KPIs and recent incidents',
    icon: LayoutDashboard,
  },
  {
    id: 'map',
    label: 'Traffic Map',
    shortLabel: 'Map',
    title: 'Traffic Map',
    description: 'Corridor congestion visualised on the map',
    icon: Map,
  },
  {
    id: 'missions',
    label: 'Emergency Missions',
    shortLabel: 'Missions',
    title: 'Emergency Missions',
    description: 'Green-corridor dispatches for ambulances, fire and police',
    icon: Siren,
  },
  {
    id: 'incidents',
    label: 'Incident Management',
    shortLabel: 'Incidents',
    title: 'Incident Management',
    description: 'Report, acknowledge and resolve road incidents',
    icon: AlertTriangle,
  },
  {
    id: 'impact',
    label: 'Environmental Impact',
    shortLabel: 'Impact',
    title: 'Environmental Impact',
    description: 'Estimated emissions and fuel savings from signal optimisation',
    icon: Leaf,
  },
];

export const DEFAULT_PAGE = 'dashboard';

export const findNavItem = (id) => NAV_ITEMS.find((item) => item.id === id) ?? NAV_ITEMS[0];

import { useEffect, useState } from 'react';
import Sidebar from './components/layout/Sidebar.jsx';
import AppHeader from './components/layout/AppHeader.jsx';
import { DemoStateProvider } from './state/demoState.jsx';
import { DEFAULT_PAGE, findNavItem } from './navigation.js';
import DashboardPage from './pages/DashboardPage.jsx';
import TrafficMapPage from './pages/TrafficMapPage.jsx';
import MissionsPage from './pages/MissionsPage.jsx';
import IncidentsPage from './pages/IncidentsPage.jsx';
import ImpactPage from './pages/ImpactPage.jsx';
import { SimulatedBadge } from './components/ui/SimulatedBadge.jsx';

const PAGES = {
  dashboard: DashboardPage,
  map: TrafficMapPage,
  missions: MissionsPage,
  incidents: IncidentsPage,
  impact: ImpactPage,
};

function Shell() {
  const [activePage, setActivePage] = useState(DEFAULT_PAGE);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const item = findNavItem(activePage);
    document.title = `${item.title} · FLOW AI — Smarter Traffic. Safer Journeys.`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activePage]);

  const Page = PAGES[activePage] ?? DashboardPage;

  return (
    <div className="min-h-screen">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-h-screen flex-col lg:pl-64">
        <AppHeader activePage={activePage} onOpenMobile={() => setMobileOpen(true)} />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Page onNavigate={setActivePage} />
        </main>

        <footer className="border-t border-white/[0.06] px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-2 text-[11px] text-slate-500 sm:flex-row sm:items-center">
            <p>
              <span className="font-semibold text-slate-400">FLOW AI</span> — Smarter Traffic. Safer Journeys.
              Hackathon prototype frontend.
            </p>
            <div className="flex items-center gap-2">
              <SimulatedBadge />
              <span>Not live data · no backend connected</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <DemoStateProvider>
      <Shell />
    </DemoStateProvider>
  );
}

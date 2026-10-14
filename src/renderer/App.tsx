import { lazy, Suspense, useEffect, useLayoutEffect, useRef } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ROUTES } from '@shared/constants';
import { on } from './lib/ipc';
import { useSettings } from './stores/settings';
import { useLaunch } from './stores/launch';
import { useLogs } from './stores/logs';
import { toast } from './stores/toasts';
import { useLiveInvalidation } from './hooks/queries';
import { TitleBar } from './components/shell/TitleBar';
import { IconRail } from './components/shell/IconRail';
import { FriendsDrawer } from './components/shell/FriendsDrawer';
import { CommandPalette } from './components/shell/CommandPalette';
import { AddAccountModal } from './components/shell/AccountMenu';
import { NewProfileModal } from './components/NewProfileModal';
import { LaunchToast } from './components/LaunchToast';
import { ToastHost } from './components/ui/overlay';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Spinner } from './components/ui/core';
import Home from './pages/Home';

// Home is eager (first paint); everything else is code-split and preloaded when the app is idle.
const pages = {
  library: () => import('./pages/Library'),
  instance: () => import('./pages/Profile'),
  browse: () => import('./pages/Browse'),
  boost: () => import('./pages/Boost'),
  wardrobe: () => import('./pages/Wardrobe'),
  friends: () => import('./pages/Friends'),
  servers: () => import('./pages/Servers'),
  screenshots: () => import('./pages/Screenshots'),
  console: () => import('./pages/Console'),
  settings: () => import('./pages/Settings'),
};
const Library = lazy(pages.library);
const Profile = lazy(pages.instance);
const Browse = lazy(pages.browse);
const Boost = lazy(pages.boost);
const Wardrobe = lazy(pages.wardrobe);
const Friends = lazy(pages.friends);
const Servers = lazy(pages.servers);
const Screenshots = lazy(pages.screenshots);
const Console = lazy(pages.console);
const Settings = lazy(pages.settings);
const Showcase = import.meta.env.DEV ? lazy(() => import('./pages/Showcase')) : null;

function PageFallback() {
  return (
    <div className="h-full grid place-items-center">
      <Spinner />
    </div>
  );
}

/** Keeps scroll position per route. */
function ScrollArea({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const positions = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = positions.current.get(pathname) ?? 0;
    const save = () => positions.current.set(pathname, el.scrollTop);
    el.addEventListener('scroll', save, { passive: true });
    return () => el.removeEventListener('scroll', save);
  }, [pathname]);
  return (
    <div ref={ref} className="flex-1 min-w-0 overflow-y-auto relative" id="main-scroll">
      {children}
    </div>
  );
}

export function App() {
  const qc = useQueryClient();
  const loaded = useSettings((s) => s.loaded);
  const location = useLocation();
  useLiveInvalidation(qc);

  useEffect(() => {
    void (async () => {
      await useSettings.getState().init();
      await useLaunch.getState().init();
      await useLogs.getState().init(useSettings.getState().settings.maxLogLines);
    })();
    const off = on('app:notice', (n) => toast[n.level === 'error' ? 'error' : n.level === 'warn' ? 'warn' : 'info'](n.message, n.detail));
    const idle = window.requestIdleCallback?.(() => Object.values(pages).forEach((p) => void p()), { timeout: 3000 });
    return () => {
      off();
      if (idle) window.cancelIdleCallback?.(idle);
    };
  }, []);

  // Toast launch outcomes once, wherever the user is.
  useEffect(() => {
    let prev = useLaunch.getState().states;
    return useLaunch.subscribe((s) => {
      for (const st of Object.values(s.states)) {
        const before = prev[st.instanceId];
        if (before?.status === st.status) continue;
        if (st.status === 'crashed' && st.crash) toast.error(st.crash.title, st.crash.detail);
      }
      prev = s.states;
    });
  }, []);

  if (!loaded) return <div className="h-full bg-bg0" />;
  return (
    <div className="h-full flex flex-col" data-testid="app-shell">
      <TitleBar />
      <div className="flex-1 flex min-h-0 relative">
        <IconRail />
        <ScrollArea>
          <ErrorBoundary inline key={location.pathname}>
            <Suspense fallback={<PageFallback />}>
              <div className="animate-page h-full" key={location.pathname}>
                <Routes>
                  <Route path={ROUTES.home} element={<Home />} />
                  <Route path={ROUTES.library} element={<Library />} />
                  <Route path={ROUTES.instance} element={<Profile />} />
                  <Route path={ROUTES.browse} element={<Browse />} />
                  <Route path={ROUTES.boost} element={<Boost />} />
                  <Route path={ROUTES.wardrobe} element={<Wardrobe />} />
                  <Route path={ROUTES.friends} element={<Friends />} />
                  <Route path={ROUTES.servers} element={<Servers />} />
                  <Route path={ROUTES.screenshots} element={<Screenshots />} />
                  <Route path={ROUTES.console} element={<Console />} />
                  <Route path={ROUTES.settings} element={<Settings />} />
                  {Showcase && <Route path={ROUTES.showcase} element={<Showcase />} />}
                  <Route path="*" element={<Home />} />
                </Routes>
              </div>
            </Suspense>
          </ErrorBoundary>
        </ScrollArea>
        <FriendsDrawer />
      </div>
      <LaunchToast />
      <ToastHost />
      <CommandPalette />
      <NewProfileModal />
      <AddAccountModal />
    </div>
  );
}

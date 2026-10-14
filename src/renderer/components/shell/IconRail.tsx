import { NavLink } from 'react-router-dom';
import { Camera, Gauge, Home, LayoutGrid, Package, Server, Settings, Shirt, SquareTerminal, Users, type LucideIcon } from 'lucide-react';
import { ROUTES } from '@shared/constants';
import { cn } from '../../lib/util';
import { useLaunch } from '../../stores/launch';
import { Tooltip } from '../ui/core';
import { AccountMenu } from './AccountMenu';

const NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: ROUTES.home, label: 'Home', icon: Home },
  { to: ROUTES.library, label: 'Library', icon: LayoutGrid },
  { to: ROUTES.browse, label: 'Browse', icon: Package },
  { to: ROUTES.boost, label: 'Boost', icon: Gauge },
  { to: ROUTES.wardrobe, label: 'Wardrobe', icon: Shirt },
  { to: ROUTES.friends, label: 'Friends', icon: Users },
  { to: ROUTES.servers, label: 'Servers', icon: Server },
  { to: ROUTES.screenshots, label: 'Screenshots', icon: Camera },
  { to: ROUTES.console, label: 'Console', icon: SquareTerminal },
];

function RailLink({ to, label, icon: Icon, badge }: { to: string; label: string; icon: LucideIcon; badge?: boolean }) {
  return (
    <Tooltip label={label}>
      <NavLink
        to={to}
        end={to === '/'}
        aria-label={label}
        className={({ isActive }) =>
          cn(
            'relative w-12 h-11 grid place-items-center rounded-md transition duration-1',
            isActive ? 'bg-bg3 text-accent-hi' : 'text-t3 hover:text-t1 hover:bg-bg2',
          )
        }
      >
        {({ isActive }) => (
          <>
            {isActive && <span className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r bg-accent" />}
            <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
            {badge && <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-success ring-2 ring-bg1" />}
          </>
        )}
      </NavLink>
    </Tooltip>
  );
}

export function IconRail() {
  const running = useLaunch((s) => Object.values(s.states).some((x) => x.status === 'running'));
  const crashed = useLaunch((s) => Object.values(s.states).some((x) => x.status === 'crashed'));
  return (
    <nav aria-label="Main" className="w-[72px] shrink-0 bg-bg1 border-r border-line flex flex-col items-center py-3 gap-1 relative z-30">
      {NAV.map((n) => (
        <RailLink key={n.to} {...n} badge={(n.to === ROUTES.console && (running || crashed)) || undefined} />
      ))}
      <div className="flex-1" />
      <RailLink to={ROUTES.settings} label="Settings" icon={Settings} />
      <div className="h-px w-8 bg-line my-2" />
      <AccountMenu />
    </nav>
  );
}

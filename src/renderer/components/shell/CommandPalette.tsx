/** Ctrl/Cmd+K palette: jump to profiles, pages, settings and actions. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, FolderOpen, Gamepad2, Navigation, Play, Plus, Search, Settings2, UserPlus } from 'lucide-react';
import { call } from '../../lib/ipc';
import { useInstances } from '../../hooks/queries';
import { useUi } from '../../stores/ui';
import { useSettings } from '../../stores/settings';
import { attempt } from '../../stores/toasts';
import { cn } from '../../lib/util';
import { Kbd } from '../ui/core';

interface Cmd {
  id: string;
  label: string;
  group: string;
  icon: typeof Search;
  run: () => void;
  keywords?: string;
}

export function CommandPalette() {
  const open = useUi((s) => s.palette);
  const setUi = useUi((s) => s.set);
  const navigate = useNavigate();
  const { data: instances = [] } = useInstances();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setUi({ palette: !useUi.getState().palette });
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [setUi]);
  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
      setTimeout(() => input.current?.focus(), 0);
    }
  }, [open]);

  const close = () => setUi({ palette: false });
  const cmds = useMemo<Cmd[]>(() => {
    const go = (to: string) => () => navigate(to);
    const pages: [string, string][] = [['Home', '/'], ['Library', '/library'], ['Browse mods & modpacks', '/browse'], ['Boost', '/boost'], ['Wardrobe', '/wardrobe'], ['Friends', '/friends'], ['Servers', '/servers'], ['Screenshots', '/screenshots'], ['Console', '/console'], ['Settings', '/settings']];
    const settings: [string, string][] = [['Appearance', 'appearance'], ['Java & memory', 'java'], ['Accounts', 'accounts'], ['Downloads', 'downloads'], ['Advanced', 'advanced'], ['About & updates', 'about']];
    return [
      ...instances.flatMap((i) => [
        { id: `play-${i.id}`, label: `Play ${i.name}`, group: 'Profiles', icon: Play, keywords: `${i.version} ${i.loader}`, run: () => void attempt(() => call('launch:start', i.id), 'Could not launch') },
        { id: `open-${i.id}`, label: `Open ${i.name}`, group: 'Profiles', icon: Gamepad2, keywords: `${i.version} ${i.loader}`, run: go(`/instance/${i.id}`) },
      ]),
      ...pages.map(([label, to]) => ({ id: `page-${to}`, label, group: 'Go to', icon: Navigation, run: go(to) })),
      ...settings.map(([label, tab]) => ({ id: `set-${tab}`, label: `Settings: ${label}`, group: 'Settings', icon: Settings2, run: go(`/settings?tab=${tab}`) })),
      { id: 'new-profile', label: 'New profile', group: 'Actions', icon: Plus, run: () => setUi({ newProfile: true }) },
      { id: 'add-account', label: 'Add account', group: 'Actions', icon: UserPlus, run: () => setUi({ addAccount: true }) },
      { id: 'import', label: 'Import .mrpack modpack', group: 'Actions', icon: FolderOpen, run: () => void attempt(() => call('instances:import-mrpack'), 'Import failed') },
      { id: 'friends', label: 'Toggle friends panel', group: 'Actions', icon: Navigation, run: () => void useSettings.getState().patch({ friendsDrawerOpen: !useSettings.getState().settings.friendsDrawerOpen }) },
    ];
  }, [instances, navigate, setUi]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return cmds.slice(0, 40);
    const terms = s.split(/\s+/);
    return cmds.filter((c) => terms.every((t) => `${c.label} ${c.keywords ?? ''} ${c.group}`.toLowerCase().includes(t))).slice(0, 40);
  }, [q, cmds]);

  if (!open) return null;
  const run = (c?: Cmd) => {
    if (!c) return;
    close();
    c.run();
  };
  let lastGroup = '';
  return (
    <div className="fixed inset-0 z-[65] flex justify-center pt-[12vh]" onClick={close}>
      <div className="absolute inset-0 bg-black/50 animate-fade" />
      <div role="dialog" aria-label="Command palette" className="relative w-[600px] max-h-[60vh] surface-raised flex flex-col animate-pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 h-12 border-b border-line">
          <Search className="w-4 h-4 text-t3" />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setIdx((i) => Math.min(results.length - 1, i + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setIdx((i) => Math.max(0, i - 1));
              } else if (e.key === 'Enter') run(results[idx]);
              else if (e.key === 'Escape') close();
            }}
            placeholder="Type a command or search…"
            className="flex-1 bg-transparent outline-none text-sm text-t1 placeholder:text-t3"
            aria-label="Search commands"
          />
          <Kbd>Esc</Kbd>
        </div>
        <div className="overflow-y-auto p-2" role="listbox">
          {results.length === 0 && <div className="p-6 text-center text-sm text-t3">No matches</div>}
          {results.map((c, i) => {
            const header = c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            return (
              <div key={c.id}>
                {header && <div className="label px-2 pt-2 pb-1">{header}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === idx}
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => run(c)}
                  className={cn('w-full flex items-center gap-3 h-9 px-2.5 rounded-md text-sm text-left', i === idx ? 'bg-bg4 text-t1' : 'text-t2')}
                >
                  <c.icon className="w-4 h-4 shrink-0 opacity-80" />
                  <span className="flex-1 truncate">{c.label}</span>
                  {i === idx && <CornerDownLeft className="w-3.5 h-3.5 text-t3" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

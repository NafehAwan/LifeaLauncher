import { Component, type ReactNode } from 'react';
import { AlertOctagon } from 'lucide-react';

export class ErrorBoundary extends Component<{ children: ReactNode; inline?: boolean }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('UI crashed', error);
  }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const report = `${error.message}\n\n${error.stack ?? ''}`;
    return (
      <div className={this.props.inline ? 'p-8' : 'h-full grid place-items-center p-8 bg-bg0'}>
        <div className="max-w-lg surface-raised p-6" role="alert">
          <div className="flex items-center gap-3">
            <AlertOctagon className="w-6 h-6 text-danger" />
            <h1 className="text-lg font-semibold">Something broke</h1>
          </div>
          <p className="text-sm text-t2 mt-2">This part of LifeaLauncher hit an unexpected error. Your profiles and worlds are safe.</p>
          <pre className="mt-4 max-h-48 overflow-auto rounded-md bg-bg1 border border-line p-3 text-2xs text-t2 font-mono selectable whitespace-pre-wrap">{error.message}</pre>
          <div className="flex gap-2 mt-4">
            <button type="button" className="h-9 px-4 rounded-md bg-accent text-white text-sm font-semibold" onClick={() => (this.props.inline ? this.setState({ error: null }) : location.reload())}>
              {this.props.inline ? 'Try again' : 'Reload'}
            </button>
            <button type="button" className="h-9 px-4 rounded-md border border-line-strong text-sm font-semibold" onClick={() => void navigator.clipboard.writeText(report)}>
              Copy report
            </button>
          </div>
        </div>
      </div>
    );
  }
}

/** Shown instead of an empty UI when the preload bridge failed to load (bug P0-3 can never fail silently again). */
export function MissingBridge() {
  console.error('window.lifea is missing — preload did not load');
  return (
    <div className="h-full grid place-items-center p-8 bg-bg0" data-testid="missing-bridge">
      <div className="max-w-lg surface-raised p-6" role="alert">
        <h1 className="text-lg font-semibold">LifeaLauncher could not start</h1>
        <p className="text-sm text-t2 mt-2">
          The secure bridge between the window and the launcher did not load. Reinstalling usually fixes this. If it keeps happening, send the log from
          <code className="mx-1 text-t1">%APPDATA%/LifeaLauncher/logs/main.log</code>.
        </p>
      </div>
    </div>
  );
}

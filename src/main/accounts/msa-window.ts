/** Interactive Microsoft sign-in in a popup window (auth code + PKCE). */
import { BrowserWindow, session } from 'electron';
import { randomBytes } from 'node:crypto';
import { authorizeUrl, exchangeCode, minecraftLogin, MSA, msaClientId, pkcePair, type MinecraftSession, type MsaTokens } from './msa';

export async function interactiveMicrosoftLogin(parent?: BrowserWindow): Promise<{ tokens: MsaTokens; session: MinecraftSession }> {
  const clientId = msaClientId();
  if (!clientId) throw new Error('Microsoft login is unavailable. Use an offline account for now.');
  const { verifier, challenge } = pkcePair();
  const state = randomBytes(16).toString('hex');
  const code = await new Promise<string>((resolve, reject) => {
    const win = new BrowserWindow({
      width: 520,
      height: 680,
      parent,
      modal: !!parent,
      title: 'Sign in with Microsoft',
      backgroundColor: '#0b0607',
      autoHideMenuBar: true,
      webPreferences: { session: session.fromPartition('msa-login'), sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    let settled = false;
    const check = (url: string) => {
      let redirected: URL;
      try {
        redirected = new URL(url);
      } catch {
        return false;
      }
      if (redirected.origin !== MSA.redirect) return false;
      settled = true;
      win.close();
      if (redirected.searchParams.get('state') !== state) reject(new Error('Sign-in was interrupted (state mismatch).'));
      else if (redirected.searchParams.get('code')) resolve(redirected.searchParams.get('code')!);
      else reject(new Error(redirected.searchParams.get('error_description') ?? 'Sign-in was cancelled.'));
      return true;
    };
    win.webContents.on('will-redirect', (e, url) => {
      if (check(url)) e.preventDefault();
    });
    win.webContents.on('will-navigate', (e, url) => {
      if (check(url)) e.preventDefault();
    });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.on('closed', () => {
      if (!settled) reject(new Error('Sign-in window was closed.'));
    });
    void win.loadURL(authorizeUrl(clientId, challenge, state));
  });
  const tokens = await exchangeCode(clientId, code, verifier);
  const mc = await minecraftLogin(tokens.accessToken);
  return { tokens, session: mc };
}

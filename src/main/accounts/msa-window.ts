/** Interactive Microsoft sign-in in a popup window (auth code + PKCE). */
import { BrowserWindow, session } from 'electron';
import { randomBytes } from 'node:crypto';
import { authorizeUrl, exchangeCode, minecraftLogin, MSA, msaClientId, pkcePair, type MinecraftSession, type MsaTokens } from './msa';

export async function interactiveMicrosoftLogin(parent?: BrowserWindow): Promise<{ tokens: MsaTokens; session: MinecraftSession }> {
  const clientId = msaClientId();
  if (!clientId) throw new Error('Microsoft login is not configured in this build (LIFEA_MSA_CLIENT_ID). Use an offline account for now.');
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
      if (!url.startsWith(MSA.redirect)) return false;
      const u = new URL(url);
      settled = true;
      win.close();
      if (u.searchParams.get('state') !== state) reject(new Error('Sign-in was interrupted (state mismatch).'));
      else if (u.searchParams.get('code')) resolve(u.searchParams.get('code')!);
      else reject(new Error(u.searchParams.get('error_description') ?? 'Sign-in was cancelled.'));
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

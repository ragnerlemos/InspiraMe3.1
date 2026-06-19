
import { Capacitor } from '@capacitor/core';

export const getApiUrl = (path: string) => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
  // Se for nativo, SEMPRE usamos o baseUrl (URL do servidor Cloud Run)
  // Se for web, usamos caminhos relativos para o mesmo domínio
  if (Capacitor.isNativePlatform() && baseUrl) {
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${cleanBase}${cleanPath}`;
  }
  return path;
};

export async function fetchWithBase(path: string, options?: RequestInit) {
  const url = getApiUrl(path);
  return fetch(url, options);
}

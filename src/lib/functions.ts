import { configManager } from './config';

export function functionsFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const base = configManager.functionsBaseUrl;
  const apiKey = configManager.apiKey;

  return fetch(`${base}/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      ...options.headers,
    },
  });
}

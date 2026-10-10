import { useEffect, useState } from 'react';

export interface Route {
  parts: string[];
  query: URLSearchParams;
  raw: string;
}

function parse(): Route {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  return {
    parts: path.split('/').filter(Boolean),
    query: new URLSearchParams(qs ?? ''),
    raw
  };
}

export function useRoute(): Route {
  const [r, setR] = useState<Route>(parse);
  useEffect(() => {
    const on = () => setR(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

export function go(path: string, replace = false) {
  const target = `#${path}`;
  if (replace) location.replace(target);
  else location.hash = path;
}

export function back(fallback = '/') {
  if (history.length > 1) history.back();
  else go(fallback);
}

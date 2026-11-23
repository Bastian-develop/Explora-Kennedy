const getUrl = (value: string): URL | null => {
  try {
    const url = new URL(value.trim());
    return ['http:', 'https:'].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
};

export const getVideoEmbedUrl = (value: string): string | null => {
  const url = getUrl(value);
  if (!url) return null;
  const host = url.hostname.replace(/^www\./, '').toLowerCase();

  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(host)) {
    const parts = url.pathname.split('/').filter(Boolean);
    const id = url.searchParams.get('v')
      || (['embed', 'shorts', 'live'].includes(parts[0]) ? parts[1] : null);
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = url.pathname.split('/').filter(Boolean).at(-1);
    return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
  }
  return null;
};

export const getPodcastEmbedUrl = (value: string): string | null => {
  const url = getUrl(value);
  if (!url) return null;
  const host = url.hostname.replace(/^www\./, '').toLowerCase();

  if (host === 'open.spotify.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    const typeIndex = parts.findIndex(part => ['episode', 'show'].includes(part));
    if (typeIndex >= 0 && parts[typeIndex + 1]) {
      return `https://open.spotify.com/embed/${parts[typeIndex]}/${parts[typeIndex + 1]}`;
    }
  }
  if (host === 'soundcloud.com' || host === 'm.soundcloud.com') {
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url.toString())}&visual=false`;
  }
  return getVideoEmbedUrl(value);
};

export const isDirectMediaFile = (value: string, kind: 'audio' | 'video'): boolean => {
  const url = getUrl(value);
  if (!url) return false;
  const path = url.pathname.toLowerCase();
  return kind === 'audio'
    ? /\.(mp3|m4a|aac|wav|ogg|opus|flac)$/.test(path)
    : /\.(mp4|m4v|webm|ogv|mov)$/.test(path);
};

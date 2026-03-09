const MESSENGER_LINK_TOKEN_PATTERN = /(\/messenger\/link\/)([^/?#]+)/gi;

export function redactUrlForLogs(url: string | null | undefined) {
  if (!url) {
    return '';
  }

  return url.replace(MESSENGER_LINK_TOKEN_PATTERN, '$1[redacted]');
}

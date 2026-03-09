import { redactUrlForLogs } from './url-redaction.util';

describe('redactUrlForLogs', () => {
  it('redacts messenger token in plain link path', () => {
    expect(redactUrlForLogs('/messenger/link/abc123')).toBe(
      '/messenger/link/[redacted]',
    );
  });

  it('redacts messenger token when link has suffix route', () => {
    expect(redactUrlForLogs('/messenger/link/abc123/status')).toBe(
      '/messenger/link/[redacted]/status',
    );
  });

  it('preserves query string while redacting token', () => {
    expect(redactUrlForLogs('/messenger/link/abc123?foo=bar')).toBe(
      '/messenger/link/[redacted]?foo=bar',
    );
  });

  it('returns empty string for nullish input', () => {
    expect(redactUrlForLogs(undefined)).toBe('');
    expect(redactUrlForLogs(null)).toBe('');
  });
});

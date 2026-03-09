import {
  createLocalMockPresignSignature,
  verifyLocalMockPresignSignature,
} from './local-mock-presign-signature.util';

describe('local-mock-presign-signature util', () => {
  const secret = 'local-mock-secret-1234567890';
  const baseInput = {
    action: 'upload' as const,
    storageKey: 'requests/req-1/file.pdf',
    expiresAtIso: '2030-01-01T00:10:00.000Z',
    secret,
  };

  it('creates deterministic signature', () => {
    const first = createLocalMockPresignSignature(baseInput);
    const second = createLocalMockPresignSignature(baseInput);

    expect(first).toBe(second);
  });

  it('verifies valid signature', () => {
    const signature = createLocalMockPresignSignature(baseInput);

    expect(
      verifyLocalMockPresignSignature({
        ...baseInput,
        signature,
      }),
    ).toBe(true);
  });

  it('rejects invalid signature', () => {
    expect(
      verifyLocalMockPresignSignature({
        ...baseInput,
        signature: 'deadbeef',
      }),
    ).toBe(false);
  });
});

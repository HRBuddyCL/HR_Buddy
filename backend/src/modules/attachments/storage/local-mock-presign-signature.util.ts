import { createHmac, timingSafeEqual } from 'crypto';

export type LocalMockPresignAction = 'upload' | 'download';

type LocalMockPresignSignatureInput = {
  action: LocalMockPresignAction;
  storageKey: string;
  expiresAtIso: string;
  secret: string;
};

export function createLocalMockPresignSignature(
  input: LocalMockPresignSignatureInput,
) {
  const payload = `${input.action}\n${input.storageKey}\n${input.expiresAtIso}`;

  return createHmac('sha256', input.secret).update(payload).digest('hex');
}

export function verifyLocalMockPresignSignature(
  input: LocalMockPresignSignatureInput & { signature: string },
) {
  const expected = createLocalMockPresignSignature(input);

  return safeHexEqual(expected, input.signature);
}

function safeHexEqual(expectedHex: string, actualHex: string) {
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = Buffer.from(actualHex, 'hex');

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

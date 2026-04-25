import { createHmac, timingSafeEqual } from 'crypto';

export type PublicUploadSessionTokenPayload = {
  requestId: string;
  exp: number;
};

export function signPublicUploadSessionToken(
  payload: PublicUploadSessionTokenPayload,
  secret: string,
): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url',
  );
  const signature = createSignature(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

export function verifyPublicUploadSessionToken(
  token: string,
  secret: string,
): PublicUploadSessionTokenPayload | null {
  const parts = token.split('.');

  if (parts.length !== 2) {
    return null;
  }

  const [encodedPayload, signature] = parts;
  const expectedSignature = createSignature(encodedPayload, secret);

  const actualBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (actualBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const raw = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as Partial<PublicUploadSessionTokenPayload>;

    if (typeof raw.requestId !== 'string' || typeof raw.exp !== 'number') {
      return null;
    }

    return raw as PublicUploadSessionTokenPayload;
  } catch {
    return null;
  }
}

function createSignature(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

import { LocalMockAttachmentStorageService } from './local-mock-attachment-storage.service';

describe('LocalMockAttachmentStorageService', () => {
  let service: LocalMockAttachmentStorageService;

  beforeEach(() => {
    service = new LocalMockAttachmentStorageService();
  });

  it('stores and returns object metadata', () => {
    service.putObject({
      storageKey: 'requests/req-1/file.pdf',
      content: Buffer.from('hello'),
      contentType: 'application/pdf',
    });

    expect(
      service.getObjectMetadata({
        storageKey: 'requests/req-1/file.pdf',
      }),
    ).toEqual({
      contentType: 'application/pdf',
      contentLength: 5,
    });
  });

  it('returns null metadata when object does not exist', () => {
    expect(
      service.getObjectMetadata({
        storageKey: 'requests/req-1/missing.pdf',
      }),
    ).toBeNull();
  });

  it('evicts oldest object when object capacity is exceeded', () => {
    for (let i = 0; i < 301; i += 1) {
      service.putObject({
        storageKey: `requests/req-1/file-${i}.pdf`,
        content: Buffer.from('x'),
        contentType: 'application/pdf',
      });
    }

    expect(
      service.getObjectMetadata({
        storageKey: 'requests/req-1/file-0.pdf',
      }),
    ).toBeNull();

    expect(
      service.getObjectMetadata({
        storageKey: 'requests/req-1/file-300.pdf',
      }),
    ).toEqual({
      contentType: 'application/pdf',
      contentLength: 1,
    });
  });
});

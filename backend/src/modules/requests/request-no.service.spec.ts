import { RequestNoService } from './request-no.service';

describe('RequestNoService', () => {
  const tx = {
    $queryRaw: jest.fn(),
  };

  let service: RequestNoService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RequestNoService();
  });

  it('builds first request number of UTC date', async () => {
    tx.$queryRaw.mockResolvedValue([{ seq: 1 }]);

    const requestNo = await service.next(
      tx as never,
      new Date('2026-03-08T00:10:00.000Z'),
    );

    expect(requestNo).toBe('HRB-20260308-0001');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('pads higher sequence values', async () => {
    tx.$queryRaw.mockResolvedValue([{ seq: 42 }]);

    const requestNo = await service.next(
      tx as never,
      new Date('2026-12-31T23:59:59.000Z'),
    );

    expect(requestNo).toBe('HRB-20261231-0042');
  });

  it('falls back to sequence 1 when query returns empty', async () => {
    tx.$queryRaw.mockResolvedValue([]);

    const requestNo = await service.next(
      tx as never,
      new Date('2026-01-01T00:00:00.000Z'),
    );

    expect(requestNo).toBe('HRB-20260101-0001');
  });
});

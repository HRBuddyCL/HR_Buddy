import { BadRequestException } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';

describe('MaintenanceService PDPA flows', () => {
  const now = new Date('2026-03-08T10:00:00.000Z');

  const tx = {
    request: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    operator: {
      findUnique: jest.fn(),
    },
    address: {
      updateMany: jest.fn(),
    },
    notification: {
      updateMany: jest.fn(),
    },
    requestActivityLog: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    employeeAccessSession: {
      deleteMany: jest.fn(),
    },
    otpSession: {
      deleteMany: jest.fn(),
    },
  };

  const prisma = {
    $transaction: jest.fn(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: typeof tx) => Promise<unknown>)(tx);
      }

      return Promise.resolve(arg);
    }),
  };

  const configValues: Record<string, unknown> = {
    'pdpa.anonymizeMinClosedDays': 30,
  };

  const config = {
    get: jest.fn((key: string) => configValues[key]),
  };

  let service: MaintenanceService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    jest.clearAllMocks();

    tx.operator.findUnique.mockResolvedValue({ id: 'op-1', isActive: true });
    tx.request.update.mockResolvedValue({ id: 'req-1' });
    tx.address.updateMany.mockResolvedValue({ count: 1 });
    tx.notification.updateMany.mockResolvedValue({ count: 2 });
    tx.requestActivityLog.create.mockResolvedValue({ id: 'log-1' });
    tx.requestActivityLog.updateMany.mockResolvedValue({ count: 0 });
    tx.employeeAccessSession.deleteMany.mockResolvedValue({ count: 0 });
    tx.otpSession.deleteMany.mockResolvedValue({ count: 0 });

    service = new MaintenanceService(prisma as never, config as never);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('anonymizes a single eligible request with address and audit log', async () => {
    tx.request.findUnique.mockResolvedValue({
      id: 'req-1',
      requestNo: 'HRB-20260308-REQ1',
      status: 'DONE',
      closedAt: new Date('2026-01-01T00:00:00.000Z'),
      messengerBookingDetail: {
        senderAddressId: 'addr-1',
        receiverAddressId: 'addr-2',
      },
      documentRequestDetail: {
        deliveryAddressId: null,
      },
    });

    const result = await service.anonymizeRequestData('req-1', {
      operatorId: 'op-1',
      reason: '  remove   pii  ',
    });

    expect(tx.request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'req-1' },
        data: expect.objectContaining({
          employeeName: 'REDACTED',
          phone: 'REDACTED',
        }),
      }),
    );

    expect(tx.requestActivityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          operatorId: 'op-1',
          note: 'PDPA_ANONYMIZED: remove pii',
        }),
      }),
    );

    expect(result.id).toBe('req-1');
    expect(result.masked.addressCount).toBe(1);
    expect(result.masked.employeeNotificationCount).toBe(2);
  });

  it('rejects subject anonymization when any request is not eligible', async () => {
    tx.request.findMany.mockResolvedValue([
      {
        id: 'req-1',
        requestNo: 'HRB-20260308-REQ1',
        status: 'DONE',
        closedAt: new Date('2026-01-01T00:00:00.000Z'),
        messengerBookingDetail: null,
        documentRequestDetail: null,
      },
      {
        id: 'req-2',
        requestNo: 'HRB-20260308-REQ2',
        status: 'NEW',
        closedAt: null,
        messengerBookingDetail: null,
        documentRequestDetail: null,
      },
    ]);

    let thrown: unknown;

    try {
      await service.anonymizeSubjectData({
        operatorId: 'op-1',
        phone: '+66811111111',
        email: 'employee@cl.local',
        reason: 'Employee PDPA request',
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(BadRequestException);
    expect((thrown as BadRequestException).getResponse()).toMatchObject({
      code: 'PDPA_SUBJECT_CONTAINS_INELIGIBLE_REQUESTS',
      requestNos: ['HRB-20260308-REQ2'],
    });
    expect(tx.request.update).not.toHaveBeenCalled();
  });

  it('anonymizes eligible subject requests and purges OTP/session data', async () => {
    tx.request.findMany.mockResolvedValue([
      {
        id: 'req-1',
        requestNo: 'HRB-20260308-REQ1',
        status: 'DONE',
        closedAt: new Date('2026-01-01T00:00:00.000Z'),
        messengerBookingDetail: {
          senderAddressId: 'addr-1',
          receiverAddressId: 'addr-2',
        },
        documentRequestDetail: null,
      },
      {
        id: 'req-2',
        requestNo: 'HRB-20260308-REQ2',
        status: 'CANCELED',
        closedAt: new Date('2026-01-01T00:00:00.000Z'),
        messengerBookingDetail: null,
        documentRequestDetail: {
          deliveryAddressId: 'addr-3',
        },
      },
    ]);

    tx.address.updateMany.mockResolvedValue({ count: 1 });
    tx.notification.updateMany.mockImplementation(async (args: any) => {
      if (args?.where?.requestId) {
        return { count: 1 };
      }

      return { count: 3 };
    });
    tx.requestActivityLog.updateMany.mockResolvedValue({ count: 4 });
    tx.employeeAccessSession.deleteMany.mockResolvedValue({ count: 2 });
    tx.otpSession.deleteMany.mockResolvedValue({ count: 1 });

    const result = await service.anonymizeSubjectData({
      operatorId: 'op-1',
      phone: ' +66811111111 ',
      email: 'Employee@CL.Local ',
      reason: '  Employee   PDPA request  ',
    });

    expect(result.requests.count).toBe(2);
    expect(result.masked.requestIdentityCount).toBe(2);
    expect(result.masked.addressCount).toBe(2);
    expect(result.masked.requestNotificationCount).toBe(2);
    expect(result.masked.employeeNotificationCount).toBe(3);
    expect(result.deleted.employeeSessions).toBe(2);
    expect(result.deleted.otpSessions).toBe(1);

    expect(tx.employeeAccessSession.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          phone: '+66811111111',
          email: 'employee@cl.local',
        },
      }),
    );

    expect(tx.requestActivityLog.create).toHaveBeenCalledTimes(2);
  });
});

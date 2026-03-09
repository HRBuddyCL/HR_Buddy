import { BadRequestException } from '@nestjs/common';
import { AuthOtpService } from './auth-otp.service';

describe('AuthOtpService.sendOtp hardening', () => {
  const now = new Date('2026-03-08T10:00:00.000Z');

  const prisma = {
    otpSession: {
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    employeeAccessSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const configValues: Record<string, unknown> = {
    otpHashSecret: 'very-strong-dev-secret',
    'otp.codeTtlMinutes': 5,
    'otp.sessionTtlMinutes': 30,
    'otp.maxAttempts': 5,
    'otp.sendCooldownSeconds': 60,
    'otp.maxSendPerHour': 6,
  };

  const config = {
    get: jest.fn((key: string) => configValues[key]),
  };

  const sendOtpMock = jest.fn();

  const otpDeliveryService = {
    getProvider: jest.fn(() => ({ sendOtp: sendOtpMock })),
    isConsoleProvider: jest.fn(() => true),
  };

  let service: AuthOtpService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    jest.clearAllMocks();

    prisma.otpSession.findFirst.mockResolvedValue(null);
    prisma.otpSession.count.mockResolvedValue(0);
    prisma.otpSession.create.mockResolvedValue({ id: 'otp-1' });
    prisma.otpSession.delete.mockResolvedValue({ id: 'otp-1' });
    sendOtpMock.mockResolvedValue(undefined);

    service = new AuthOtpService(
      prisma as never,
      config as never,
      otpDeliveryService as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects sendOtp while cooldown is active', async () => {
    prisma.otpSession.findFirst.mockResolvedValue({
      createdAt: new Date('2026-03-08T09:59:45.000Z'),
    });

    await expect(
      service.sendOtp({ phone: '+66811111111', email: 'employee@cl.local' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.otpSession.create).not.toHaveBeenCalled();
    expect(sendOtpMock).not.toHaveBeenCalled();
  });

  it('rejects sendOtp when hourly limit is reached', async () => {
    prisma.otpSession.count.mockResolvedValue(6);

    await expect(
      service.sendOtp({ phone: '+66811111111', email: 'employee@cl.local' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.otpSession.create).not.toHaveBeenCalled();
    expect(sendOtpMock).not.toHaveBeenCalled();
  });

  it('deletes OTP session when delivery fails', async () => {
    sendOtpMock.mockRejectedValueOnce(new Error('delivery failed'));

    await expect(
      service.sendOtp({ phone: '+66811111111', email: 'employee@cl.local' }),
    ).rejects.toThrow('delivery failed');

    expect(prisma.otpSession.create).toHaveBeenCalledTimes(1);
    expect(prisma.otpSession.delete).toHaveBeenCalledWith({
      where: { id: 'otp-1' },
    });
  });
  it('creates OTP session and sends OTP when limits are not exceeded', async () => {
    const result = await service.sendOtp({
      phone: '+66811111111',
      email: 'employee@cl.local',
    });

    expect(prisma.otpSession.create).toHaveBeenCalledTimes(1);
    expect(sendOtpMock).toHaveBeenCalledTimes(1);
    expect(result).toHaveProperty('expiresAt');
    expect(result).toHaveProperty('devOtp');
  });
});

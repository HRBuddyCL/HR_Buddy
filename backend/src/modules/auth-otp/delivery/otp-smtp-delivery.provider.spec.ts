import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { OtpSmtpDeliveryProvider } from './otp-smtp-delivery.provider';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('OtpSmtpDeliveryProvider', () => {
  const payload = {
    phone: '+66811111111',
    email: 'employee@cl.local',
    otpCode: '123456',
    expiresAt: new Date('2030-01-01T00:05:00.000Z'),
  };

  const configValues: Record<string, unknown> = {
    'otp.smtp.host': 'smtp.gmail.com',
    'otp.smtp.port': 465,
    'otp.smtp.secure': true,
    'otp.smtp.username': 'sender@gmail.com',
    'otp.smtp.appPassword': 'abcdefghijklmnop',
    'otp.smtp.fromEmail': 'sender@gmail.com',
    'otp.smtp.timeoutMs': 8000,
  };

  const config = {
    get: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;

  const createTransportMock = nodemailer.createTransport as jest.MockedFunction<
    typeof nodemailer.createTransport
  >;

  let provider: OtpSmtpDeliveryProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    (config.get as jest.Mock).mockImplementation(
      (key: string) => configValues[key],
    );
    provider = new OtpSmtpDeliveryProvider(config);
  });

  it('throws when smtp credentials are incomplete', async () => {
    (config.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'otp.smtp.appPassword') {
        return '';
      }

      return configValues[key];
    });

    await expect(provider.sendOtp(payload)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('sends otp email using nodemailer transport', async () => {
    const sendMail = jest
      .fn<Promise<unknown>, [nodemailer.SendMailOptions]>()
      .mockResolvedValue({ messageId: 'test-message-id' });
    const transporter = { sendMail } as unknown as nodemailer.Transporter;

    createTransportMock.mockReturnValue(transporter);

    await provider.sendOtp(payload);

    expect(createTransportMock).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'sender@gmail.com',
        to: payload.email,
        subject: 'Your HR-Buddy OTP Code',
      }),
    );
  });
});

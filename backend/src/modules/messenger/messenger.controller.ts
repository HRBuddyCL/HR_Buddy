import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  Post,
} from '@nestjs/common';
import { RateLimitPolicy } from '../../common/security/rate-limit.decorator';
import { MessengerService } from './messenger.service';
import { MessengerStatusUpdateDto } from './dto/messenger-status-update.dto';
import { MessengerProblemReportDto } from './dto/messenger-problem-report.dto';
import { MessengerPickupEventDto } from './dto/messenger-pickup-event.dto';

@RateLimitPolicy('messengerLink')
@Controller('messenger')
export class MessengerController {
  constructor(private readonly messengerService: MessengerService) {}

  @Get('link')
  getByToken(
    @Headers('authorization') authorization?: string,
    @Headers('x-messenger-token') headerToken?: string,
  ) {
    return this.messengerService.getByToken(
      this.extractToken(authorization, headerToken),
    );
  }

  @Patch('link/status')
  updateStatus(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-messenger-token') headerToken: string | undefined,
    @Body() dto: MessengerStatusUpdateDto,
  ) {
    return this.messengerService.updateStatus(
      this.extractToken(authorization, headerToken),
      dto,
    );
  }

  @Post('link/report-problem')
  reportProblem(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-messenger-token') headerToken: string | undefined,
    @Body() dto: MessengerProblemReportDto,
  ) {
    return this.messengerService.reportProblem(
      this.extractToken(authorization, headerToken),
      dto,
    );
  }

  @Post('link/pickup-event')
  pickupEvent(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-messenger-token') headerToken: string | undefined,
    @Body() dto: MessengerPickupEventDto,
  ) {
    return this.messengerService.pickupEvent(
      this.extractToken(authorization, headerToken),
      dto,
    );
  }

  private extractToken(authorization?: string, headerToken?: string) {
    const fromHeader = headerToken?.trim();

    if (fromHeader) {
      return fromHeader;
    }

    const fromAuthorization = this.extractBearerToken(authorization);

    if (fromAuthorization) {
      return fromAuthorization;
    }

    throw new BadRequestException({
      code: 'MESSENGER_TOKEN_REQUIRED',
      message:
        'Messenger token is required via Authorization Bearer token or x-messenger-token header',
    });
  }

  private extractBearerToken(authorization?: string) {
    if (!authorization) {
      return null;
    }

    if (!authorization.startsWith('Bearer ')) {
      return null;
    }

    const token = authorization.slice('Bearer '.length).trim();
    return token || null;
  }
}

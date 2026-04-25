import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { RateLimitPolicy } from '../../common/security/rate-limit.decorator';
import { CompleteAttachmentUploadDto } from '../attachments/dto/complete-attachment-upload.dto';
import { CreateAttachmentDto } from '../attachments/dto/create-attachment.dto';
import { CreateAttachmentUploadTicketDto } from '../attachments/dto/create-attachment-upload-ticket.dto';
import { AttachmentDownloadUrlQueryDto } from '../attachments/dto/attachment-download-url.query.dto';
import { AttachmentsService } from '../attachments/attachments.service';
import { EmployeeSession } from '../auth-otp/employee-session.decorator';
import { EmployeeSessionGuard } from '../auth-otp/employee-session.guard';
import type { EmployeeSessionPrincipal } from '../auth-otp/employee-session.types';
import { AuthOtpService } from '../auth-otp/auth-otp.service';
import { CancelRequestDto } from './dto/cancel-request.dto';
import { CreateBuildingRequestDto } from './dto/create-building-request.dto';
import { CreateDocumentRequestDto } from './dto/create-document-request.dto';
import { CreateMessengerRequestDto } from './dto/create-messenger-request.dto';
import { CreateVehicleRequestDto } from './dto/create-vehicle-request.dto';
import { MyRequestsQueryDto } from './dto/my-requests.query.dto';
import { RequestsService } from './requests.service';

@Controller('requests')
export class RequestsController {
  constructor(
    private readonly requestsService: RequestsService,
    private readonly attachmentsService: AttachmentsService,
    private readonly authOtpService: AuthOtpService,
  ) {}

  @RateLimitPolicy('requestCreate')
  @Post('building')
  createBuilding(@Body() dto: CreateBuildingRequestDto) {
    return this.requestsService.createBuilding(dto);
  }

  @RateLimitPolicy('requestCreate')
  @Post('vehicle')
  createVehicle(@Body() dto: CreateVehicleRequestDto) {
    return this.requestsService.createVehicle(dto);
  }

  @RateLimitPolicy('requestCreate')
  @Post('messenger')
  createMessenger(@Body() dto: CreateMessengerRequestDto) {
    return this.requestsService.createMessenger(dto);
  }

  @RateLimitPolicy('requestCreate')
  @Post('document')
  createDocument(@Body() dto: CreateDocumentRequestDto) {
    return this.requestsService.createDocument(dto);
  }

  @Post(':id/attachments/presign')
  async presignAttachment(
    @Param('id') id: string,
    @Body() dto: CreateAttachmentUploadTicketDto,
    @Req() request: EmployeeRequestContext,
  ) {
    if (dto.uploadSessionToken) {
      return this.attachmentsService.issuePublicUploadTicket(
        id,
        dto.uploadSessionToken,
        dto,
      );
    }

    const session = await this.resolveEmployeeSession(request);
    return this.attachmentsService.issueEmployeeUploadTicket(
      id,
      session.phone,
      dto,
    );
  }

  @Post(':id/attachments/complete')
  async completeAttachment(
    @Param('id') id: string,
    @Body() dto: CompleteAttachmentUploadDto,
    @Req() request: EmployeeRequestContext,
  ) {
    if (dto.uploadSessionToken) {
      return this.attachmentsService.completePublicUpload(
        id,
        dto.uploadSessionToken,
        dto,
      );
    }

    const session = await this.resolveEmployeeSession(request);
    return this.attachmentsService.completeEmployeeUpload(
      id,
      session.phone,
      dto,
    );
  }

  @UseGuards(EmployeeSessionGuard)
  @Get(':id/attachments/:attachmentId/download-url')
  downloadAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Query() query: AttachmentDownloadUrlQueryDto,
    @EmployeeSession() session: EmployeeSessionPrincipal,
  ) {
    return this.attachmentsService.getEmployeeDownloadUrl(
      id,
      attachmentId,
      session.phone,
      query.mode,
    );
  }

  @UseGuards(EmployeeSessionGuard)
  @Post(':id/attachments')
  addAttachment(
    @Param('id') id: string,
    @Body() dto: CreateAttachmentDto,
    @EmployeeSession() session: EmployeeSessionPrincipal,
  ) {
    return this.attachmentsService.addEmployeeAttachment(
      id,
      session.phone,
      dto,
    );
  }

  @UseGuards(EmployeeSessionGuard)
  @Patch(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelRequestDto,
    @EmployeeSession() session: EmployeeSessionPrincipal,
  ) {
    return this.requestsService.cancelRequest(id, session.phone, dto.reason);
  }

  @UseGuards(EmployeeSessionGuard)
  @Get('my')
  myRequests(
    @EmployeeSession() session: EmployeeSessionPrincipal,
    @Query() q: MyRequestsQueryDto,
  ) {
    return this.requestsService.getMyRequests(session.phone, q);
  }

  @UseGuards(EmployeeSessionGuard)
  @Get(':id')
  detail(
    @Param('id') id: string,
    @EmployeeSession() session: EmployeeSessionPrincipal,
  ) {
    return this.requestsService.getRequestDetail(id, session.phone);
  }

  private async resolveEmployeeSession(
    request: EmployeeRequestContext,
  ): Promise<EmployeeSessionPrincipal> {
    const token = this.extractSessionToken(
      request.headers?.authorization,
      request.headers?.['x-employee-session-token'],
    );

    if (!token) {
      throw new UnauthorizedException({
        code: 'SESSION_TOKEN_REQUIRED',
        message: 'Missing session token',
      });
    }

    const session = await this.authOtpService.validateSessionToken(token);
    if (!session) {
      throw new UnauthorizedException({
        code: 'INVALID_OR_EXPIRED_SESSION',
        message: 'Invalid or expired session token',
      });
    }

    return {
      sessionId: session.id,
      phone: session.phone,
      email: session.email,
      expiresAt: session.expiresAt,
    };
  }

  private extractSessionToken(
    authorization?: string,
    headerToken?: string | string[],
  ): string | null {
    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.slice('Bearer '.length).trim();
      return token.length > 0 ? token : null;
    }

    if (typeof headerToken === 'string') {
      const token = headerToken.trim();
      return token.length > 0 ? token : null;
    }

    return null;
  }
}

type EmployeeRequestContext = {
  headers?: {
    authorization?: string;
    'x-employee-session-token'?: string | string[];
  };
};

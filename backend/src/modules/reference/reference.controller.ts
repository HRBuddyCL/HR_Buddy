import { Controller, Get, Query } from '@nestjs/common';
import { ReferenceService } from './reference.service';
import { ReferenceListQueryDto } from './dto/reference-list.query.dto';

@Controller('reference')
export class ReferenceController {
  constructor(private readonly referenceService: ReferenceService) {}

  @Get('departments')
  departments(@Query() q: ReferenceListQueryDto) {
    return this.referenceService.getDepartments(q);
  }

  @Get('problem-categories')
  problemCategories(@Query() q: ReferenceListQueryDto) {
    return this.referenceService.getProblemCategories(q);
  }

  @Get('vehicle-issue-categories')
  vehicleIssueCategories(@Query() q: ReferenceListQueryDto) {
    return this.referenceService.getVehicleIssueCategories(q);
  }

  @Get('operators')
  operators(@Query() q: ReferenceListQueryDto) {
    return this.referenceService.getOperators(q);
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReferenceListQueryDto } from './dto/reference-list.query.dto';

@Injectable()
export class ReferenceService {
  constructor(private readonly prisma: PrismaService) {}

  private buildActiveFilter(isActive?: boolean): { isActive?: boolean } {
    if (isActive === undefined) {
      return {};
    }

    return { isActive };
  }

  async getDepartments(q: ReferenceListQueryDto) {
    const where: Prisma.DepartmentWhereInput = {
      ...this.buildActiveFilter(q.isActive),
      ...(q.q
        ? {
            name: {
              contains: q.q,
              mode: 'insensitive',
            },
          }
        : {}),
    };

    const items = await this.prisma.department.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });

    return { items };
  }

  async getProblemCategories(q: ReferenceListQueryDto) {
    const where: Prisma.ProblemCategoryWhereInput = {
      ...this.buildActiveFilter(q.isActive),
      ...(q.q
        ? {
            name: {
              contains: q.q,
              mode: 'insensitive',
            },
          }
        : {}),
    };

    const items = await this.prisma.problemCategory.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        helperText: true,
        isActive: true,
      },
    });

    return { items };
  }

  async getVehicleIssueCategories(q: ReferenceListQueryDto) {
    const where: Prisma.VehicleIssueCategoryWhereInput = {
      ...this.buildActiveFilter(q.isActive),
      ...(q.q
        ? {
            name: {
              contains: q.q,
              mode: 'insensitive',
            },
          }
        : {}),
    };

    const items = await this.prisma.vehicleIssueCategory.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });

    return { items };
  }

  async getOperators(q: ReferenceListQueryDto) {
    const where: Prisma.OperatorWhereInput = {
      ...this.buildActiveFilter(q.isActive),
      ...(q.q
        ? {
            displayName: {
              contains: q.q,
              mode: 'insensitive',
            },
          }
        : {}),
    };

    const items = await this.prisma.operator.findMany({
      where,
      orderBy: { displayName: 'asc' },
      select: {
        id: true,
        displayName: true,
        isActive: true,
      },
    });

    return { items };
  }
}

import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { MyRequestsQueryDto } from './my-requests.query.dto';

describe('MyRequestsQueryDto', () => {
  it('transforms numeric pagination fields', () => {
    const dto = plainToInstance(MyRequestsQueryDto, {
      page: '2',
      limit: '25',
      sortBy: 'createdAt',
      sortOrder: 'asc',
      q: 'HRB-2026',
    });

    const errors = validateSync(dto);

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(25);
  });

  it('rejects unknown sortBy field', () => {
    const dto = plainToInstance(MyRequestsQueryDto, {
      sortBy: 'updatedAt',
    });

    const errors = validateSync(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});

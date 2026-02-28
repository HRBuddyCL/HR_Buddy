import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { GeoService } from './geo.service';

@Controller('geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get('provinces')
  provinces() {
    return this.geo.getProvinces();
  }

  @Get('districts')
  districts(@Query('province') province: string) {
    if (!province) throw new BadRequestException('province is required');
    return this.geo.getDistricts(province);
  }

  @Get('subdistricts')
  subdistricts(
    @Query('province') province: string,
    @Query('district') district: string,
  ) {
    if (!province) throw new BadRequestException('province is required');
    if (!district) throw new BadRequestException('district is required');
    return this.geo.getSubdistricts(province, district);
  }

  @Get('postal-code')
  postalCode(
    @Query('province') province: string,
    @Query('district') district: string,
    @Query('subdistrict') subdistrict: string,
  ) {
    if (!province) throw new BadRequestException('province is required');
    if (!district) throw new BadRequestException('district is required');
    if (!subdistrict) throw new BadRequestException('subdistrict is required');

    return {
      postalCode: this.geo.getPostalCode(province, district, subdistrict),
    };
  }
}

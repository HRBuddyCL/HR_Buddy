import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildGeoIndex,
  geoAddressKey,
  normalizeGeoName,
  type GeoIndex,
} from './geo.indexer';
import { GeoCompiled } from './geo.types';

@Injectable()
export class GeoService {
  private readonly data: GeoCompiled;
  private readonly index: GeoIndex;

  constructor() {
    const filePath = path.join(
      process.cwd(),
      'src',
      'data',
      'geo',
      'compiled',
      'geo.compiled.json',
    );

    if (!fs.existsSync(filePath)) {
      throw new Error(
        `Geo dataset not found: ${filePath}\nRun: npx ts-node scripts/compile-geo.ts`,
      );
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    this.data = JSON.parse(raw) as GeoCompiled;
    this.index = buildGeoIndex(this.data);
  }

  getProvinces() {
    return [...this.index.provinces];
  }

  getDistricts(provinceName: string) {
    const provinceKey = normalizeGeoName(provinceName);
    return [...(this.index.districtsByProvince.get(provinceKey) ?? [])];
  }

  getSubdistricts(provinceName: string, districtName: string) {
    const provinceKey = normalizeGeoName(provinceName);
    const districtKey = normalizeGeoName(districtName);

    return [
      ...(this.index.subdistrictsByProvinceDistrict.get(
        geoAddressKey(provinceKey, districtKey),
      ) ?? []),
    ];
  }

  getPostalCode(
    provinceName: string,
    districtName: string,
    subdistrictName: string,
  ) {
    const provinceKey = normalizeGeoName(provinceName);
    const districtKey = normalizeGeoName(districtName);
    const subdistrictKey = normalizeGeoName(subdistrictName);

    return (
      this.index.postalCodeByAddress.get(
        geoAddressKey(provinceKey, districtKey, subdistrictKey),
      ) ?? null
    );
  }
}

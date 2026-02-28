import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { GeoCompiled } from './geo.types';

@Injectable()
export class GeoService {
  private readonly data: GeoCompiled;

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
  }

  getProvinces() {
    // ส่งชื่อจังหวัด + code (มีประโยชน์เวลา cache ฝั่ง FE)
    return this.data.provinces.map((p) => ({ name: p.name, code: p.code }));
  }

  getDistricts(provinceName: string) {
    const p = this.data.provinces.find((x) => x.name === provinceName);
    if (!p) return [];
    return p.districts.map((d) => ({ name: d.name, code: d.code }));
  }

  getSubdistricts(provinceName: string, districtName: string) {
    const p = this.data.provinces.find((x) => x.name === provinceName);
    const d = p?.districts.find((x) => x.name === districtName);
    if (!d) return [];
    return d.subdistricts.map((s) => ({ name: s.name, code: s.code }));
  }

  getPostalCode(
    provinceName: string,
    districtName: string,
    subdistrictName: string,
  ) {
    const p = this.data.provinces.find((x) => x.name === provinceName);
    const d = p?.districts.find((x) => x.name === districtName);
    const s = d?.subdistricts.find((x) => x.name === subdistrictName);
    return s?.postalCode ?? null;
  }
}

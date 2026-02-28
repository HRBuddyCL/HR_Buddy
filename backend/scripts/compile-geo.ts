import * as fs from 'fs';
import * as path from 'path';

const RAW_DIR = path.join(process.cwd(), 'src', 'data', 'geo', 'raw');
const OUT_FILE = path.join(
  process.cwd(),
  'src',
  'data',
  'geo',
  'compiled',
  'geo.compiled.json',
);

type ProvinceRaw = {
  provinceCode: string | number;
  provinceNameTh: string;
  provinceNameEn?: string;
};

type DistrictRaw = {
  provinceCode: string | number;
  districtCode: string | number;
  districtNameTh: string;
  districtNameEn?: string;
  // บางชุดมี postalCode ระดับอำเภอ แต่เราไม่ใช้เป็น source of truth
  postalCode?: string | number;
};

type SubdistrictRaw = {
  provinceCode: string | number;
  districtCode: string | number;
  subdistrictCode: string | number;
  subdistrictNameTh: string;
  subdistrictNameEn?: string;
  postalCode: string | number;
};

type Compiled = {
  provinces: Array<{
    name: string;
    code: string;
    districts: Array<{
      name: string;
      code: string;
      subdistricts: Array<{
        name: string;
        code: string;
        postalCode: string;
      }>;
    }>;
  }>;
};

function readJson<T>(fileName: string): T {
  const p = path.join(RAW_DIR, fileName);
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
}

function norm(s: string) {
  return s.trim().replace(/\s+/g, ' ');
}

function toCode(v: string | number) {
  return String(v).trim();
}

function sortTh(a: string, b: string) {
  return a.localeCompare(b, 'th');
}

function main() {
  const provinces = readJson<ProvinceRaw[]>('provinces.json');
  const districts = readJson<DistrictRaw[]>('districts.json');
  const subdistricts = readJson<SubdistrictRaw[]>('subdistricts.json');

  // Map: provinceCode -> districts
  const districtByProv = new Map<string, DistrictRaw[]>();
  for (const d of districts) {
    const pCode = toCode(d.provinceCode);
    if (!districtByProv.has(pCode)) districtByProv.set(pCode, []);
    districtByProv.get(pCode)!.push(d);
  }

  // Map: provinceCode|districtCode -> subdistricts
  const subByDist = new Map<string, SubdistrictRaw[]>();
  for (const s of subdistricts) {
    const key = `${toCode(s.provinceCode)}|${toCode(s.districtCode)}`;
    if (!subByDist.has(key)) subByDist.set(key, []);
    subByDist.get(key)!.push(s);
  }

  const compiled: Compiled = {
    provinces: provinces
      .map((p) => {
        const pCode = toCode(p.provinceCode);
        const dList = (districtByProv.get(pCode) ?? [])
          .map((d) => {
            const dCode = toCode(d.districtCode);
            const key = `${pCode}|${dCode}`;
            const sList = (subByDist.get(key) ?? [])
              .map((s) => ({
                name: norm(s.subdistrictNameTh),
                code: toCode(s.subdistrictCode),
                postalCode: toCode(s.postalCode),
              }))
              .sort((a, b) => sortTh(a.name, b.name));

            return {
              name: norm(d.districtNameTh),
              code: dCode,
              subdistricts: sList,
            };
          })
          .sort((a, b) => sortTh(a.name, b.name));

        return {
          name: norm(p.provinceNameTh),
          code: pCode,
          districts: dList,
        };
      })
      .sort((a, b) => sortTh(a.name, b.name)),
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(compiled, null, 2), 'utf-8');
  console.log('✅ Geo compiled ->', OUT_FILE);
}

main();

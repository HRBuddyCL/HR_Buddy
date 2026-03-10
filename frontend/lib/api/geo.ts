import { apiFetch } from "@/lib/api/client";

type GeoNameCode = {
  name: string;
  code: string;
};

type GeoListResponse = Array<string | GeoNameCode>;

function normalizeGeoList(items: GeoListResponse): string[] {
  return items
    .map((item) => (typeof item === "string" ? item : item.name))
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

export async function getGeoProvinces() {
  const result = await apiFetch<GeoListResponse>("/geo/provinces", {
    method: "GET",
  });

  return normalizeGeoList(result);
}

export async function getGeoDistricts(province: string) {
  const result = await apiFetch<GeoListResponse>("/geo/districts", {
    method: "GET",
    query: { province },
  });

  return normalizeGeoList(result);
}

export async function getGeoSubdistricts(province: string, district: string) {
  const result = await apiFetch<GeoListResponse>("/geo/subdistricts", {
    method: "GET",
    query: { province, district },
  });

  return normalizeGeoList(result);
}

export async function getGeoPostalCode(
  province: string,
  district: string,
  subdistrict: string,
) {
  return apiFetch<{ postalCode: string | null }>("/geo/postal-code", {
    method: "GET",
    query: { province, district, subdistrict },
  });
}

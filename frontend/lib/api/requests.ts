import { apiFetch } from "@/lib/api/client";

export type BuildingUrgency = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
export type BuildingSide = "FRONT" | "BACK";

export type CreateBuildingRequestPayload = {
  employeeName: string;
  departmentId: string;
  phone: string;
  urgency: BuildingUrgency;
  building: BuildingSide;
  floor: number;
  locationDetail: string;
  problemCategoryId: string;
  problemCategoryOther?: string;
  description: string;
  additionalDetails?: string;
};

export type CreateRequestResponse = {
  id: string;
  requestNo: string;
  status: string;
};

export async function createBuildingRequest(payload: CreateBuildingRequestPayload) {
  return apiFetch<CreateRequestResponse>("/requests/building", {
    method: "POST",
    body: payload,
  });
}

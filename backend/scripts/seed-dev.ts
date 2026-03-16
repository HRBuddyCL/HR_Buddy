/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */

import 'dotenv/config';
import { Pool } from 'pg';
import crypto from 'node:crypto';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is missing in backend/.env');
}

const pool = new Pool({ connectionString: DATABASE_URL });

function uuid() {
  return crypto.randomUUID();
}

function requestNo(prefix: string, n: number) {
  return `${prefix}-${String(n).padStart(4, '0')}`;
}

async function q<T = any>(text: string, params: any[] = []) {
  const res = await pool.query<T>(text, params);
  return res;
}

async function upsertOperator(displayName: string) {
  const res = await q<{ id: string }>(
    `
    INSERT INTO operators (id, display_name, is_active, created_at)
    VALUES ($1, $2, true, now())
    ON CONFLICT (display_name)
    DO UPDATE SET is_active = true
    RETURNING id;
    `,
    [uuid(), displayName],
  );
  return res.rows[0].id;
}

/**
 * sla_policies: ตอนนี้ยังไม่มี unique composite จึง upsert แบบ SQL ตรง ๆ ไม่ได้
 * ใช้ INSERT ... WHERE NOT EXISTS แทน (รันซ้ำไม่เพิ่มแถว)
 */
async function ensureSlaPolicy(p: {
  requestType: 'BUILDING' | 'VEHICLE' | 'MESSENGER' | 'DOCUMENT';
  urgency: 'NORMAL' | 'HIGH' | 'CRITICAL';
  startWithinMinutes: number;
  resolveWithinMinutes: number;
  yellowThresholdPercent: number;
}) {
  await q(
    `
    INSERT INTO sla_policies (
      id, request_type, urgency,
      start_within_minutes, resolve_within_minutes, yellow_threshold_percent,
      is_active
    )
    SELECT $1, $2::"RequestType", $3::"Urgency", $4, $5, $6, true
    WHERE NOT EXISTS (
      SELECT 1 FROM sla_policies
      WHERE request_type = $2::"RequestType"
        AND urgency = $3::"Urgency"
        AND is_active = true
    );
    `,
    [
      uuid(),
      p.requestType,
      p.urgency,
      p.startWithinMinutes,
      p.resolveWithinMinutes,
      p.yellowThresholdPercent,
    ],
  );
}

/**
 * Upsert request by request_no, returns id + created_at
 */
async function upsertRequest(base: {
  requestNo: string;
  type: 'BUILDING' | 'VEHICLE' | 'MESSENGER' | 'DOCUMENT';
  status:
    | 'NEW'
    | 'APPROVED'
    | 'IN_PROGRESS'
    | 'IN_TRANSIT'
    | 'DONE'
    | 'REJECTED'
    | 'CANCELED';
  urgency: 'NORMAL' | 'HIGH' | 'CRITICAL';
  employeeName: string;
  departmentId: string;
  phone: string;
}) {
  const res = await q<{ id: string; created_at: Date }>(
    `
    INSERT INTO requests (
      id, request_no, type, status, urgency,
      employee_name, department_id, phone,
      created_at, updated_at, latest_activity_at
    )
    VALUES (
      $1, $2,
      $3::"RequestType",
      $4::"RequestStatus",
      $5::"Urgency",
      $6, $7, $8,
      now(), now(), now()
    )
    ON CONFLICT (request_no)
    DO UPDATE SET
      updated_at = now(),
      latest_activity_at = now()
    RETURNING id, created_at;
    `,
    [
      uuid(),
      base.requestNo,
      base.type,
      base.status,
      base.urgency,
      base.employeeName,
      base.departmentId,
      base.phone,
    ],
  );

  return { id: res.rows[0].id, createdAt: new Date(res.rows[0].created_at) };
}

async function wipeDevRequestChildren(requestId: string) {
  // ล้างลูกเฉพาะที่ dev seed สร้างใหม่ให้เสมอ
  await q(`DELETE FROM request_sla WHERE request_id = $1;`, [requestId]);
  await q(`DELETE FROM request_activity_logs WHERE request_id = $1;`, [
    requestId,
  ]);
  await q(`DELETE FROM request_attachments WHERE request_id = $1;`, [
    requestId,
  ]);

  // details (1:1)
  await q(`DELETE FROM building_repair_details WHERE request_id = $1;`, [
    requestId,
  ]);
  await q(`DELETE FROM vehicle_repair_details WHERE request_id = $1;`, [
    requestId,
  ]);
  await q(`DELETE FROM messenger_booking_details WHERE request_id = $1;`, [
    requestId,
  ]);
  await q(`DELETE FROM document_request_details WHERE request_id = $1;`, [
    requestId,
  ]);

  // magic_links/notifications ถ้าเธอเคย seed ก็ล้างไปด้วยกัน (ไม่จำเป็นแต่ชัวร์)
  await q(`DELETE FROM magic_links WHERE request_id = $1;`, [requestId]);
  await q(`DELETE FROM notifications WHERE request_id = $1;`, [requestId]);
}

async function upsertRequestSla(
  requestId: string,
  slaStartAt: Date,
  resolveMinutes: number,
) {
  const slaDueAt = new Date(slaStartAt.getTime() + resolveMinutes * 60_000);
  await q(
    `
    INSERT INTO request_sla (request_id, sla_start_at, sla_due_at, sla_status, last_calculated_at)
    VALUES ($1, $2, $3, $4::"SlaStatus", now())
    ON CONFLICT (request_id)
    DO UPDATE SET
      sla_start_at = EXCLUDED.sla_start_at,
      sla_due_at = EXCLUDED.sla_due_at,
      sla_status = EXCLUDED.sla_status,
      last_calculated_at = now();
    `,
    [requestId, slaStartAt, slaDueAt, 'ON_TRACK'],
  );
}

async function getResolveMinutes(type: any, urgency: any) {
  const res = await q<{ resolve_within_minutes: number }>(
    `
    SELECT resolve_within_minutes
    FROM sla_policies
    WHERE request_type = $1::"RequestType"
      AND urgency = $2::"Urgency"
      AND is_active = true
    LIMIT 1;
    `,
    [type, urgency],
  );
  return res.rows[0]?.resolve_within_minutes ?? 1440;
}

async function createAddress(data: {
  name: string;
  phone: string;
  province: string;
  district: string;
  subdistrict: string;
  postalCode: string;
  houseNo: string;
  soi?: string | null;
  road?: string | null;
  extra?: string | null;
}) {
  const res = await q<{ id: string }>(
    `
    INSERT INTO addresses (
      id, name, phone,
      province, district, subdistrict, postal_code,
      house_no, soi, road, extra,
      created_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
    RETURNING id;
    `,
    [
      uuid(),
      data.name,
      data.phone,
      data.province,
      data.district,
      data.subdistrict,
      data.postalCode,
      data.houseNo,
      data.soi ?? null,
      data.road ?? null,
      data.extra ?? null,
    ],
  );
  return res.rows[0].id;
}

async function main() {
  // ทำให้เป็น transaction เดียว จะได้ไม่ค้างครึ่ง ๆ กลาง ๆ
  await q('BEGIN;');

  try {
    // 1) operators (dev)
    const opAdminId = await upsertOperator('HR-Admin');
    await upsertOperator('HR-A');
    await upsertOperator('HR-B');

    // 2) sla_policies (dev example)
    const samplePolicies = [
      {
        requestType: 'BUILDING',
        urgency: 'NORMAL',
        startWithinMinutes: 240,
        resolveWithinMinutes: 2880,
        yellowThresholdPercent: 80,
      },
      {
        requestType: 'BUILDING',
        urgency: 'HIGH',
        startWithinMinutes: 60,
        resolveWithinMinutes: 1440,
        yellowThresholdPercent: 80,
      },
      {
        requestType: 'BUILDING',
        urgency: 'CRITICAL',
        startWithinMinutes: 15,
        resolveWithinMinutes: 240,
        yellowThresholdPercent: 80,
      },

      {
        requestType: 'VEHICLE',
        urgency: 'NORMAL',
        startWithinMinutes: 240,
        resolveWithinMinutes: 4320,
        yellowThresholdPercent: 80,
      },
      {
        requestType: 'VEHICLE',
        urgency: 'HIGH',
        startWithinMinutes: 60,
        resolveWithinMinutes: 1440,
        yellowThresholdPercent: 80,
      },
      {
        requestType: 'VEHICLE',
        urgency: 'CRITICAL',
        startWithinMinutes: 15,
        resolveWithinMinutes: 360,
        yellowThresholdPercent: 80,
      },

      {
        requestType: 'MESSENGER',
        urgency: 'NORMAL',
        startWithinMinutes: 60,
        resolveWithinMinutes: 480,
        yellowThresholdPercent: 80,
      },
      {
        requestType: 'MESSENGER',
        urgency: 'HIGH',
        startWithinMinutes: 30,
        resolveWithinMinutes: 240,
        yellowThresholdPercent: 80,
      },
      {
        requestType: 'MESSENGER',
        urgency: 'CRITICAL',
        startWithinMinutes: 15,
        resolveWithinMinutes: 120,
        yellowThresholdPercent: 80,
      },

      {
        requestType: 'DOCUMENT',
        urgency: 'NORMAL',
        startWithinMinutes: 240,
        resolveWithinMinutes: 4320,
        yellowThresholdPercent: 80,
      },
      {
        requestType: 'DOCUMENT',
        urgency: 'HIGH',
        startWithinMinutes: 60,
        resolveWithinMinutes: 2880,
        yellowThresholdPercent: 80,
      },
      {
        requestType: 'DOCUMENT',
        urgency: 'CRITICAL',
        startWithinMinutes: 30,
        resolveWithinMinutes: 1440,
        yellowThresholdPercent: 80,
      },
    ] as const;

    for (const p of samplePolicies) await ensureSlaPolicy(p);

    // 3) Base reference IDs (จาก migration stable id)
    const deptIT = 'dept_it';
    const deptHR = 'dept_hr';
    const deptPC = 'dept_project_control';

    const pcAir = 'pc_air';
    const vicEngine = 'vic_engine';

    // === BUILDING request ===
    {
      const no = requestNo('B', 1);
      const r = await upsertRequest({
        requestNo: no,
        type: 'BUILDING',
        status: 'NEW',
        urgency: 'NORMAL',
        employeeName: 'ทดสอบ อาคาร',
        departmentId: deptIT,
        phone: '0990000001',
      });

      await wipeDevRequestChildren(r.id);

      await q(
        `
        INSERT INTO building_repair_details (
          request_id, building, floor, location_detail,
          problem_category_id, problem_category_other,
          description, additional_details
        )
        VALUES ($1, $2::"BuildingSide", $3, $4, $5, NULL, $6, NULL);
        `,
        [r.id, 'FRONT', 2, 'ห้อง IT', pcAir, 'แอร์ไม่เย็น'],
      );

      await q(
        `
        INSERT INTO request_activity_logs (
          id, request_id, action, from_status, to_status, note,
          actor_role, operator_id, actor_display_name, created_at
        )
        VALUES ($1,$2,$3::"ActivityAction",NULL,NULL,$4,$5::"ActorRole",NULL,NULL,now());
        `,
        [uuid(), r.id, 'CREATE', 'สร้างคำขอ', 'EMPLOYEE'],
      );

      const resolveMin = await getResolveMinutes('BUILDING', 'NORMAL');
      await upsertRequestSla(r.id, r.createdAt, resolveMin);
    }

    // === VEHICLE request ===
    {
      const no = requestNo('V', 1);
      const r = await upsertRequest({
        requestNo: no,
        type: 'VEHICLE',
        status: 'APPROVED',
        urgency: 'HIGH',
        employeeName: 'ทดสอบ รถ',
        departmentId: deptPC,
        phone: '0990000002',
      });

      await wipeDevRequestChildren(r.id);

      await q(
        `
        INSERT INTO vehicle_repair_details (
          request_id, vehicle_plate,
          issue_category_id, issue_category_other,
          symptom, additional_details
        )
        VALUES ($1,$2,$3,NULL,$4,NULL);
        `,
        [r.id, 'กข-1234', vicEngine, 'สตาร์ทติดยาก'],
      );

      // CREATE log
      await q(
        `
        INSERT INTO request_activity_logs (id, request_id, action, note, actor_role, created_at)
        VALUES ($1,$2,$3::"ActivityAction",$4,$5::"ActorRole",now());
        `,
        [uuid(), r.id, 'CREATE', 'สร้างคำขอ', 'EMPLOYEE'],
      );

      // APPROVE log (ADMIN ต้องมี operator_id)
      await q(
        `
        INSERT INTO request_activity_logs (
          id, request_id, action, from_status, to_status, note,
          actor_role, operator_id, created_at
        )
        VALUES ($1,$2,$3::"ActivityAction",$4::"RequestStatus",$5::"RequestStatus",$6,$7::"ActorRole",$8,now());
        `,
        [
          uuid(),
          r.id,
          'APPROVE',
          'NEW',
          'APPROVED',
          'อนุมัติ',
          'ADMIN',
          opAdminId,
        ],
      );

      const resolveMin = await getResolveMinutes('VEHICLE', 'HIGH');
      await upsertRequestSla(r.id, r.createdAt, resolveMin);
    }

    // === MESSENGER request ===
    {
      const no = requestNo('M', 1);
      const r = await upsertRequest({
        requestNo: no,
        type: 'MESSENGER',
        status: 'NEW',
        urgency: 'NORMAL',
        employeeName: 'ทดสอบ Messenger',
        departmentId: deptHR,
        phone: '0990000005',
      });

      await wipeDevRequestChildren(r.id);

      const senderId = await createAddress({
        name: 'ผู้ส่ง',
        phone: '0990000003',
        province: 'กรุงเทพมหานคร',
        district: 'จอมทอง',
        subdistrict: 'บางขุนเทียน',
        postalCode: '10150',
        houseNo: '42/4',
        road: 'วุฒากาศ',
      });

      const receiverId = await createAddress({
        name: 'ผู้รับ',
        phone: '0990000004',
        province: 'กรุงเทพมหานคร',
        district: 'จอมทอง',
        subdistrict: 'บางมด',
        postalCode: '10150',
        houseNo: '99',
        soi: 'ซอย 1',
      });

      await q(
        `
        INSERT INTO messenger_booking_details (
          request_id, pickup_datetime,
          item_type, item_description,
          outside_bkk_metro,
          delivery_service, delivery_service_other,
          sender_address_id, receiver_address_id
        )
        VALUES (
          $1,
          now() + interval '2 hours',
          $2::"ItemType",
          $3,
          false,
          NULL,
          NULL,
          $4,
          $5
        );
        `,
        [r.id, 'DOCUMENT', 'เอกสารทดสอบ', senderId, receiverId],
      );

      await q(
        `
        INSERT INTO request_activity_logs (id, request_id, action, note, actor_role, created_at)
        VALUES ($1,$2,$3::"ActivityAction",$4,$5::"ActorRole",now());
        `,
        [uuid(), r.id, 'CREATE', 'สร้างคำขอ', 'EMPLOYEE'],
      );

      const resolveMin = await getResolveMinutes('MESSENGER', 'NORMAL');
      await upsertRequestSla(r.id, r.createdAt, resolveMin);
    }

    // === DOCUMENT request (DIGITAL + attachment) ===
    {
      const no = requestNo('D', 1);
      const r = await upsertRequest({
        requestNo: no,
        type: 'DOCUMENT',
        status: 'APPROVED',
        urgency: 'NORMAL',
        employeeName: 'ทดสอบ เอกสาร',
        departmentId: deptHR,
        phone: '0990000006',
      });

      await wipeDevRequestChildren(r.id);

      // logs
      await q(
        `
        INSERT INTO request_activity_logs (id, request_id, action, note, actor_role, created_at)
        VALUES ($1,$2,$3::"ActivityAction",$4,$5::"ActorRole",now());
        `,
        [uuid(), r.id, 'CREATE', 'สร้างคำขอ', 'EMPLOYEE'],
      );
      await q(
        `
        INSERT INTO request_activity_logs (
          id, request_id, action, from_status, to_status, note,
          actor_role, operator_id, created_at
        )
        VALUES ($1,$2,$3::"ActivityAction",$4::"RequestStatus",$5::"RequestStatus",$6,$7::"ActorRole",$8,now());
        `,
        [
          uuid(),
          r.id,
          'APPROVE',
          'NEW',
          'APPROVED',
          'อนุมัติ',
          'ADMIN',
          opAdminId,
        ],
      );

      // attachment (ADMIN upload)
      const attachmentId = uuid();
      await q(
        `
        INSERT INTO request_attachments (
          id, request_id,
          file_kind, file_name, mime_type, file_size,
          storage_key, public_url, uploaded_by_role, created_at
        )
        VALUES ($1,$2,$3::"FileKind",$4,$5,$6,$7,NULL,$8::"UploadedByRole",now());
        `,
        [
          attachmentId,
          r.id,
          'DOCUMENT',
          'หนังสือรับรอง.pdf',
          'application/pdf',
          123456,
          'dev/mock/หนังสือรับรอง.pdf',
          'ADMIN',
        ],
      );

      await q(
        `
        INSERT INTO document_request_details (
          request_id,
          site_name_raw, site_name_normalized,
          document_description, purpose, needed_date,
          delivery_method, note,
          delivery_address_id,
          digital_file_attachment_id,
          pickup_note
        )
        VALUES (
          $1,
          $2, $3,
          $4, $5, now() + interval '7 days',
          $6::"DeliveryMethod", NULL,
          NULL,
          $7,
          NULL
        );
        `,
        [
          r.id,
          'ไซต์งาน A',
          'ไซต์งาน A',
          'หนังสือรับรองการทำงาน',
          'ยื่นธนาคาร',
          'DIGITAL',
          attachmentId,
        ],
      );

      const resolveMin = await getResolveMinutes('DOCUMENT', 'NORMAL');
      await upsertRequestSla(r.id, r.createdAt, resolveMin);
    }

    await q('COMMIT;');
    console.log(
      '✅ Dev seed done (operators, sla_policies, 4 sample requests).',
    );
  } catch (err) {
    await q('ROLLBACK;');
    throw err;
  }
}

main()
  .catch((e) => {
    console.error('❌ Dev seed failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

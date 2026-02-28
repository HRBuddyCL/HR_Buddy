-- Reference Data Seed (Base)
-- Idempotent via ON CONFLICT (name)
-- Uses stable string IDs (no extensions required)

-- 1) departments
INSERT INTO departments (id, name, "isActive")
VALUES
  ('dept_procurement', 'ฝ่ายจัดซื้อ', true),
  ('dept_accounting', 'ฝ่ายบัญชี', true),
  ('dept_design', 'ฝ่ายแบบ', true),
  ('dept_bidding', 'ฝ่ายประมูลงาน', true),
  ('dept_hr', 'ฝ่ายบุคคล', true),
  ('dept_bs', 'ฝ่าย BS', true),
  ('dept_it', 'ฝ่าย IT', true),
  ('dept_safety', 'ฝ่าย Safety', true),
  ('dept_od', 'ฝ่าย OD', true),
  ('dept_rd', 'ฝ่าย R&D', true),
  ('dept_exec_secretary', 'ฝ่ายเลขาผู้บริหาร', true),
  ('dept_admin', 'ฝ่ายบริหาร', true),
  ('dept_project_control', 'ฝ่าย Project control', true),
  ('dept_other', 'อื่นๆ', true)
ON CONFLICT (name) DO UPDATE
SET "isActive" = EXCLUDED."isActive";

-- 2) problem_categories
INSERT INTO problem_categories (id, name, helper_text, is_active)
VALUES
  ('pc_air', 'แอร์', 'ระบุอาการและจำนวน', true),
  ('pc_electric', 'ไฟฟ้า', 'ระบุประเภทอุปกรณ์ อาการ และจำนวน', true),
  ('pc_plumbing', 'ประปา', 'ระบุอาการ', true),
  ('pc_network', 'อินเทอร์เน็ต/เครือข่าย', 'ระบุอาการ', true),
  ('pc_door_lock', 'ประตู/กุญแจ/ลูกบิด', 'ระบุอาการ', true),
  ('pc_cleaning', 'ความสะอาด/ขยะ', NULL, true),
  ('pc_other', 'อื่น ๆ', NULL, true)
ON CONFLICT (name) DO UPDATE
SET helper_text = EXCLUDED.helper_text,
    is_active   = EXCLUDED.is_active;

-- 3) vehicle_issue_categories
INSERT INTO vehicle_issue_categories (id, name, is_active)
VALUES
  ('vic_engine', 'เครื่องยนต์', true),
  ('vic_brake', 'เบรก', true),
  ('vic_tire_wheel', 'ยาง/ล้อ', true),
  ('vic_battery', 'แบตเตอรี่', true),
  ('vic_electrical', 'ไฟ/ระบบไฟฟ้า', true),
  ('vic_car_ac', 'แอร์รถ', true),
  ('vic_leak', 'ของเหลว/น้ำมันรั่ว', true),
  ('vic_checkup', 'เช็คสภาพรถ', true),
  ('vic_insurance', 'ต่อ พ.ร.บ', true),
  ('vic_other', 'อื่นๆ', true)
ON CONFLICT (name) DO UPDATE
SET is_active = EXCLUDED.is_active;
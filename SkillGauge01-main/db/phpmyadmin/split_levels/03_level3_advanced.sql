-- ===============================================================================
-- SkillGauge - STEP 3: ข้อมูลข้อสอบ Level 3 (Run Last)
-- ===============================================================================

INSERT INTO question_Structural (question_text, choice_a, choice_b, choice_c, choice_d, answer, set_no) VALUES
('ความเสียหายแบบใดในโครงสร้างคอนกรีตเสริมเหล็กที่อันตรายที่สุด?', 'การวิบัติแบบเปราะ (Brittle Failure)', 'การวิบัติแบบเหนียว', 'รอยร้าวขนาดเล็ก', 'สีหลุดล่อน', 'a', 3),
('การทำ Post-Tensioning คืออะไร?', 'ดึงลวดก่อนเทคอนกรีต', 'ดึงลวดหลังเทคอนกรีตแข็งตัวแล้ว', 'ไม่ใช้ลวดสลิง', 'ใช้เหล็กเส้นธรรมดา', 'b', 3),
('วิธีการตรวจสอบความสมบูรณ์ของเสาเข็มเจาะที่นิยมใช้คือ?', 'Slump Test', 'Seismic Integrity Test', 'Plate Bearing Test', 'Field Density Test', 'b', 3),
('ข้อกำหนดเรื่องระยะหุ้ม (Covering) สำหรับโครงสร้างที่สัมผัสกับดินตลอดเวลาคือเท่าใด?', '5 ซม.', '7.5 ซม.', '2.5 ซม.', '10 ซม.', 'b', 3),
('เสาเข็มแบบใดรับแรงแบกทาน (Friction) เป็นหลัก?', 'เสาเข็มตอก', 'เสาเข็มเจาะระบบแห้ง', 'เสาเข็มสั้น (Micro Pile) ในชั้นดินกรุงเทพฯ', 'เสาเข็มเจาะระบบเปียก', 'c', 3),
('ในงานอาคารสูง Wind Load มีผลกระทบต่อส่วนใดมากที่สุด?', 'ฐานราก', 'เสาเข็ม', 'การให้ตัวด้านข้าง (Drift)', 'พื้นอาคาร', 'c', 3),
('การเสริมเหล็กกันร้าว (Temperature Steel) มีหน้าที่อะไร?', 'รับแรงดึงหลัก', 'ป้องกันการแตกร้าวจากการเปลี่ยนแปลงอุณหภูมิ', 'รับแรงเฉือน', 'เพิ่มความสวยงาม', 'b', 3),
('การทดสอบกำลังอัดคอนกรีตแบบ nDT (Non-Destructive Testing) คือวิธีใด?', 'Coring', 'Swiss Hammer Test', 'Slump Test', 'Tensile Test', 'b', 3),
('Carbonation ในคอนกรีตส่งผลเสียอย่างไร?', 'ทำให้เหล็กเสริมเป็นสนิมง่ายขึ้น', 'ทำให้คอนกรีตแข็งขึ้นมาก', 'ทำให้สีเปลี่ยน', 'ไม่มีผลเสีย', 'a', 3),
('ระบบพื้น Post-tension แบบ Bonded ต่างจาก Unbonded อย่างไร?', 'มีการอัดน้ำปูนเข้าไปในท่อร้อยลวด', 'ใช้ลวดเคลือบพลาสติก', 'ใช้แรงตึงน้อยกว่า', 'ไม่ต้องใช้สมอ', 'a', 3);

-- Generate Mock Data for Level 3 (to reach 60 items)
INSERT INTO question_Structural (question_text, choice_a, choice_b, choice_c, choice_d, answer, set_no)
SELECT CONCAT(question_text, ' (Duplicated Lv3)'), choice_a, choice_b, choice_c, choice_d, answer, set_no
FROM question_Structural
CROSS JOIN (SELECT 1 AS n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) numbers
WHERE set_no = 3 AND question_text NOT LIKE '%Duplicate%';

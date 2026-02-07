-- ===============================================================================
-- SkillGauge - ข้อสอบ Structural (สำหรับการทดสอบระบบเดิม)
-- แก้ไข: เพิ่ม DROP TABLE เพื่อแก้ปัญหา Column 'set_no' หาย
-- ===============================================================================

DROP TABLE IF EXISTS question_Structural;

CREATE TABLE question_Structural (
  id INT AUTO_INCREMENT PRIMARY KEY,
  question_text TEXT NOT NULL,
  choice_a VARCHAR(255) NOT NULL,
  choice_b VARCHAR(255) NOT NULL,
  choice_c VARCHAR(255) NOT NULL,
  choice_d VARCHAR(255) NOT NULL,
  answer CHAR(1) NOT NULL, -- 'a', 'b', 'c', 'd'
  set_no INT NOT NULL DEFAULT 1, -- 1=Level 1, 2=Level 2, etc.
  category VARCHAR(100) DEFAULT 'Structure'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Data for Set 1 (Level 1)
INSERT INTO question_Structural (question_text, choice_a, choice_b, choice_c, choice_d, answer, set_no) VALUES
('ข้อใดคือหน้าที่หลักของเหล็กเสริมในคอนกรีต?', 'รับแรงดึง', 'รับแรงอัด', 'เพิ่มน้ำหนัก', 'ลดความร้อน', 'a', 1),
('ส่วนผสมของคอนกรีตประกอบด้วยอะไรบ้าง?', 'ปูน ทราย หิน น้ำ', 'ปูน ทราย ดิน น้ำ', 'ปูน หิน ดิน ทราย', 'ปูน น้ำยา ดิน น้ำ', 'a', 1),
('ระยะงุ้มงอของเหล็กเสริม (Hook) มาตรฐานคือเท่าใด?', '4d', '6d', '10d', '12d', 'b', 1),
('การบ่มคอนกรีตควรทำอย่างน้อยกี่วัน?', '3 วัน', '7 วัน', '14 วัน', '28 วัน', 'b', 1),
('Covering ของเสาเข็มควรมีระยะหุ้มคอนกรีตไม่น้อยกว่าเท่าใด?', '3 ซม.', '5 ซม.', '7.5 ซม.', '10 ซม.', 'c', 1),
('เหล็ก SD40 หมายถึงอะไร?', 'เหล็กเส้นกลม SR24', 'เหล็กข้ออ้อย รับแรงดึง 4,000 ksc', 'เหล็กข้ออ้อย รับแรงดึง 3,000 ksc', 'เหล็กเส้นกลม รับแรงดึง 4,000 ksc', 'b', 1),
('Slump Test ใช้ทดสอบอะไร?', 'ความแข็งแรง', 'ความสามารถในการเทได้ (Workability)', 'ปริมาณอากาศ', 'กำลังอัด', 'b', 1),
('แบบหล่อคอนกรีตที่ดีควรมีคุณสมบัติอย่างไร?', 'แข็งแรง ไม่รั่วซึม', 'ราคาถูก', 'ทำจากไม้เท่านั้น', 'ถอดง่ายโดยไม่ต้องทาน้ำยา', 'a', 1),
('นั่งร้าน (Scaffolding) ต้องรับน้ำหนักได้อย่างน้อยกี่เท่าของน้ำหนักบรรทุกใช้งาน?', '1 เท่า', '2 เท่า', '4 เท่า', '10 เท่า', 'c', 1),
('ข้อใดไม่ใช่รอยต่อคอนกรีต (Joint)?', 'Construction Joint', 'Expansion Joint', 'Contraction Joint', 'Correction Joint', 'd', 1);

-- เพิ่มข้อมูลจำลอง (Duplicate) เพื่อให้ครบจำนวน
INSERT INTO question_Structural (question_text, choice_a, choice_b, choice_c, choice_d, answer, set_no)
SELECT CONCAT(question_text, ' (Set ', n, ')'), choice_a, choice_b, choice_c, choice_d, answer, set_no
FROM question_Structural
CROSS JOIN (SELECT 1 AS n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) numbers
WHERE set_no = 1;

-- Seed Data for Set 2 (Level 2 - Intermediate)
INSERT INTO question_Structural (question_text, choice_a, choice_b, choice_c, choice_d, answer, set_no) VALUES
('คอนกรีตอัดแรง (Prestressed Concrete) มีจุดเด่นคืออะไร?', 'รับแรงดึงได้ดีขึ้น', 'ไม่ต้องใช้เหล็ก', 'ราคาถูกกว่าปกติ', 'แห้งช้ากว่าปกติ', 'a', 2),
('การต่อทาบเหล็กเสริม (Splice) ในเสา ควรทำที่ตำแหน่งใด?', 'กลางต้นเสา', 'โคนเสา', 'ปลายเสา', 'ห้ามต่อทาบเลย', 'a', 2),
('ค่า fc\' (Compressive Strength) ของคอนกรีต ทดสอบที่อายุกี่วัน?', '7 วัน', '14 วัน', '28 วัน', '90 วัน', 'c', 2),
('ดินชนิดใดเหมาะสำหรับการทำฐานรากแผ่ (Spread Footing) มากที่สุด?', 'ดินเหนียวอ่อนมาก', 'ทรายหลวม', 'ดินดานแข็ง', 'ดินถมใหม่', 'c', 2),
('การถอดแบบท้องคาน (Beam Soffit) ควรถอดเมื่อคอนกรีตมีอายุอย่างน้อยกี่วัน (สำหรับช่วงคานยาวปกติ)?', '3 วัน', '7 วัน', '14 วัน', '21 วัน', 'c', 2),
('เหล็กปลอก (Stirrup) ในคานมีหน้าที่หลักคืออะไร?', 'รับแรงอัด', 'รับแรงเฉือน', 'รับแรงบิด', 'รับแรงดึง', 'b', 2),
('อัตราส่วนน้ำต่อปูนซีเมนต์ (W/C Ratio) ที่สูงเกินไปจะมีผลอย่างไร?', 'กำลังอัดลดลง', 'กำลังอัดเพิ่มขึ้น', 'คอนกรีตแน่นขึ้น', 'แห้งเร็วขึ้น', 'a', 2),
('การเทคอนกรีตในที่สูงเกิน 1.5 เมตร ควรใช้อุปกรณ์ใดช่วย?', 'รางเท (Chute) หรือท่อผ้าใบ', 'เทลงไปตรงๆ', 'ใช้รถเครนยกเท', 'ไม่มีข้อกำหนด', 'a', 2),
('รอยร้าวที่เกิดจากการหดตัว (Shrinkage Crack) มักเกิดในช่วงใด?', 'ขณะคอนกรีตยังเหลว', 'เมื่อคอนกรีตเริ่มแข็งตัวใหม่ๆ', 'หลังจากใช้งานไป 10 ปี', 'เมื่อรับน้ำหนักเกิน', 'b', 2),
('มาตรฐานเหล็กเส้นข้ออ้อย SD40 ต้องมีจุดคลาก (Yield Strength) ไม่น้อยกว่าเท่าใด?', '2,400 ksc', '3,000 ksc', '4,000 ksc', '5,000 ksc', 'c', 2);

-- จำลองข้อมูล Level 2 ให้ครบ 60 ข้อ
INSERT INTO question_Structural (question_text, choice_a, choice_b, choice_c, choice_d, answer, set_no)
SELECT CONCAT(question_text, ' (Set ', n, ')'), choice_a, choice_b, choice_c, choice_d, answer, set_no
FROM question_Structural
CROSS JOIN (SELECT 1 AS n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) numbers
WHERE set_no = 2 AND id > (SELECT MAX(id) FROM question_Structural WHERE set_no = 1);

-- Seed Data for Set 3 (Level 3 - Advanced)
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

-- จำลองข้อมูล Level 3 ให้ครบ 60 ข้อ
INSERT INTO question_Structural (question_text, choice_a, choice_b, choice_c, choice_d, answer, set_no)
SELECT CONCAT(question_text, ' (Set ', n, ')'), choice_a, choice_b, choice_c, choice_d, answer, set_no
FROM question_Structural
CROSS JOIN (SELECT 1 AS n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) numbers
WHERE set_no = 3 AND id > (SELECT MAX(id) FROM question_Structural WHERE set_no = 2);

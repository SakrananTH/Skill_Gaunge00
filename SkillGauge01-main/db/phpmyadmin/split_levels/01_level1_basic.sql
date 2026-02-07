-- ===============================================================================
-- SkillGauge - STEP 1: ข้อมูลข้อสอบ Level 1 (Run Second)
-- ===============================================================================

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

-- Generate Mock Data for Level 1 (to reach 60 items)
INSERT INTO question_Structural (question_text, choice_a, choice_b, choice_c, choice_d, answer, set_no)
SELECT CONCAT(question_text, ' (Duplicated Lv1)'), choice_a, choice_b, choice_c, choice_d, answer, set_no
FROM question_Structural
CROSS JOIN (SELECT 1 AS n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) numbers
WHERE set_no = 1 AND question_text NOT LIKE '%Duplicate%';

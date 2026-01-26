CREATE OR REPLACE VIEW v_skill_gap_analysis AS
SELECT
    -- ชื่อแผนก (ภาษาไทย)
    CASE 
        WHEN w.trade_type = 'structure' THEN 'งานโครงสร้าง'
        WHEN w.trade_type = 'plumbing' THEN 'งานประปา'
        WHEN w.trade_type = 'roofing' THEN 'งานหลังคา'
        WHEN w.trade_type = 'electric' THEN 'งานไฟฟ้า'
        WHEN w.trade_type = 'masonry' THEN 'งานก่ออิฐฉาบปูน'
        WHEN w.trade_type = 'aluminum' THEN 'งานอลูมิเนียม'
        WHEN w.trade_type = 'ceiling' THEN 'งานฝ้าเพดาน'
        WHEN w.trade_type = 'tiling' THEN 'งานกระเบื้อง'
        ELSE w.trade_type
    END AS department_name,

    w.trade_type AS category_code,

    -- จำนวนพนักงานทั้งหมดในแผนก
    COUNT(DISTINCT w.id) AS total_workers,

    -- ค่า Skill เฉลี่ย (รวมคนที่ยังไม่สอบ = 0)
    ROUND(AVG(COALESCE(ar.score, 0)), 2) AS current_avg_score,

    -- เป้าหมาย
    75 AS target_score,

    -- Skill Gap
    ROUND(75 - AVG(COALESCE(ar.score, 0)), 2) AS skill_gap,

    -- ระดับความเร่งด่วน
    CASE
        WHEN (75 - AVG(COALESCE(ar.score, 0))) >= 20 THEN 'Critical'
        WHEN (75 - AVG(COALESCE(ar.score, 0))) >= 10 THEN 'High'
        WHEN (75 - AVG(COALESCE(ar.score, 0))) > 0 THEN 'Moderate'
        ELSE 'On Track'
    END AS priority_status

FROM dbuser w

LEFT JOIN worker_accounts wa
    ON w.id = wa.worker_id

-- ผลประเมินล่าสุดต่อคน
LEFT JOIN (
    SELECT user_id, score
    FROM (
        SELECT 
            user_id,
            score,
            ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS rn
        FROM assessment_results
    ) x
    WHERE rn = 1
) ar
    ON w.id = ar.user_id

WHERE 
    w.role_code = 'worker'
    AND (wa.status = 'active' OR wa.status IS NULL)

GROUP BY 
    w.trade_type;

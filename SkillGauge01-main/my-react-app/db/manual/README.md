# db/manual

Manual SQL workspace for ad-hoc queries or temporary scripts.

Important:
- Files in this folder are NOT executed automatically by Docker Postgres.
- Use idempotent SQL when possible (CREATE IF NOT EXISTS, INSERT ... ON CONFLICT DO NOTHING) to avoid duplicate data.
- Wrap destructive scripts in explicit transactions if needed (BEGIN; ... COMMIT;), and review them carefully.

How to run a manual SQL script

Option A) From your host (psql installed):

```powershell
# Replace the path to the SQL file as needed
psql -h localhost -p 5432 -U skillgauge -d skillgauge -f \
  "c:\\Users\\sakra\\OneDrive\\เดสก์ท็อป\\Jsapps\\my-react-app\\db\\manual\\SkillGauge.session.sql"
```

Option B) Using Docker (no psql on host):

```powershell
# Copy the script into the running DB container, then execute it
docker cp "c:\\Users\\sakra\\OneDrive\\เดสก์ท็อป\\Jsapps\\my-react-app\\db\\manual\\SkillGauge.session.sql" skillgauge-db:/tmp/manual.sql

docker exec -it skillgauge-db psql -U skillgauge -d skillgauge -f /tmp/manual.sql
```

Notes:
- The running DB container name (from docker-compose) is `skillgauge-db`.
- Default credentials: user `skillgauge`, db `skillgauge`, password `skillgauge`.
- Keep sensitive data out of version control.

Prebuilt utilities in this folder

- views.sql
  - v_tasks_overview: รวม task + project + site + assignee ใช้สำหรับแดชบอร์ด/รายงาน
  - get_user_roles(user_id): คืนค่า roles ของผู้ใช้เป็น array text[]
  - mv_project_task_counts: materialized view รวมจำนวนงานต่อโครงการ (todo/in-progress/done)
    - หลังสร้างครั้งแรก ให้สั่ง Refresh ก่อนใช้งานจริง
      - REFRESH MATERIALIZED VIEW CONCURRENTLY mv_project_task_counts;
    - ถ้าแก้ definition ให้ DROP แล้ว CREATE ใหม่ (มีตัวอย่างคอมเมนต์ไว้ในไฟล์)

Quick run for views.sql via Docker (Windows PowerShell)

```powershell
# สร้าง/อัปเดต view, function, mv
$path = "c:\\Users\\sakra\\OneDrive\\เดสก์ท็อป\\Jsapps\\my-react-app\\db\\manual\\views.sql"
docker cp $path skillgauge-db:/tmp/views.sql
docker exec -it skillgauge-db psql -U skillgauge -d skillgauge -f /tmp/views.sql

# รีเฟรชตัวเลขใน materialized view
docker exec -it skillgauge-db psql -U skillgauge -d skillgauge -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_project_task_counts;"
```

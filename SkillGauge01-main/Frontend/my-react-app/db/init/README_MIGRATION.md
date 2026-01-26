# Database Migration Guide - Adding Subcategory Support

## Overview
This migration adds subcategory support to the questions table, allowing for better organization of questions within main categories.

## Files Changed
1. `05_add_subcategory.sql` - New migration file

## Migration Steps

### 1. Backup Your Database (IMPORTANT!)
```bash
# Backup the entire database
mysqldump -u root -p admin-worker-registration > backup_before_subcategory_$(date +%Y%m%d).sql
```

### 2. Run the Migration

#### Option A: Using MySQL Command Line
```bash
mysql -u root -p admin-worker-registration < db/init/05_add_subcategory.sql
```

#### Option B: Using Docker (if using docker-compose)
```bash
# Copy the SQL file into the container
docker cp db/init/05_add_subcategory.sql mysql:/tmp/

# Execute the SQL file
docker exec -i mysql mysql -u root -prootpassword admin-worker-registration < /tmp/05_add_subcategory.sql
```

#### Option C: Using MySQL Workbench or phpMyAdmin
1. Open the SQL file `05_add_subcategory.sql`
2. Copy the entire content
3. Paste and execute in your MySQL client

### 3. Verify the Migration

```sql
-- Check if subcategory column was added
DESCRIBE questions;

-- Check if subcategories table was created
SELECT * FROM subcategories;

-- Verify subcategories for structure category
SELECT * FROM subcategories WHERE category = 'structure';
```

Expected results:
- `questions` table should have a new `subcategory` column (VARCHAR(100), nullable)
- `subcategories` table should exist with 5 entries for 'structure' category
- New index `idx_questions_subcategory` should exist
- New composite index `idx_questions_category_subcategory` should exist

## What Changed

### New Table: `subcategories`
Stores metadata about subcategories:
- `category` - Parent category (structure, plumbing, etc.)
- `key` - Unique identifier (rebar, concrete, formwork, etc.)
- `label` - Display name in Thai
- `description` - Optional description
- `question_count` - Target number of questions
- `percentage` - Percentage of total questions
- `display_order` - Sort order
- `active` - Enable/disable flag

### Modified Table: `questions`
Added columns:
- `subcategory` (VARCHAR(100), nullable) - Stores the subcategory key

### Initial Data
5 subcategories added for "structure" category:
1. งานเหล็กเสริม (Rebar) - 15 ข้อ (25%)
2. งานคอนกรีต (Concrete) - 15 ข้อ (25%)
3. งานไม้แบบ (Formwork) - 12 ข้อ (20%)
4. องค์ความรู้/คาม/เครื่องมือ/คุณภาพ - 12 ข้อ (20%)
5. ทฤษฎีแบบ/พฤติ (Design Theory) - 6 ข้อ (10%)

## Backend API Changes

The following API endpoints now support `subcategory`:

### POST /api/admin/questions
Request body now accepts:
```json
{
  "text": "Question text",
  "category": "structure",
  "subcategory": "rebar",
  "difficulty": "easy",
  "options": [...]
}
```

### PUT /api/admin/questions/:id
Update body now accepts:
```json
{
  "subcategory": "concrete"
}
```

### GET /api/admin/questions
Response now includes:
```json
{
  "items": [
    {
      "id": "...",
      "text": "...",
      "category": "structure",
      "subcategory": "rebar",
      ...
    }
  ]
}
```

## Frontend Changes

1. **AdminQuestionForm.js**
   - Added subcategory dropdown (shown conditionally based on category)
   - Subcategory is saved when creating/editing questions

2. **AdminQuizBank.js**
   - Added subcategory filter dropdown
   - Added subcategory column in questions table
   - Displays subcategory label for each question

## Rollback Instructions

If you need to rollback this migration:

```sql
-- Remove the subcategory column from questions table
ALTER TABLE questions 
DROP INDEX idx_questions_category_subcategory,
DROP INDEX idx_questions_subcategory,
DROP COLUMN subcategory;

-- Drop the subcategories table
DROP TABLE IF NOT EXISTS subcategories;
```

## Adding More Subcategories

To add subcategories for other categories (plumbing, roofing, etc.):

```sql
INSERT INTO subcategories (category, `key`, label, description, question_count, percentage, display_order, active) VALUES
('plumbing', 'pipes', 'งานท่อ', 'การติดตั้งและซ่อมแซมท่อ', 20, 33.33, 1, 1),
('plumbing', 'fixtures', 'งานสุขภัณฑ์', 'การติดตั้งอุปกรณ์สุขภัณฑ์', 20, 33.33, 2, 1),
('plumbing', 'drainage', 'งานระบายน้ำ', 'ระบบระบายน้ำและท่อระบายน้ำ', 20, 33.34, 3, 1);
```

## Troubleshooting

### Error: Column 'subcategory' already exists
The migration has already been run. Check if the column exists:
```sql
DESCRIBE questions;
```

### Error: Duplicate entry for key 'uq_subcategories_category_key'
The subcategories have already been inserted. Check existing data:
```sql
SELECT * FROM subcategories WHERE category = 'structure';
```

### Questions not showing subcategory
Existing questions will have NULL subcategory until manually updated. To update:
```sql
UPDATE questions 
SET subcategory = 'rebar' 
WHERE category = 'structure' AND subcategory IS NULL 
LIMIT 15;
```

## Support
If you encounter any issues during migration, please:
1. Check the error messages carefully
2. Verify database user permissions
3. Ensure the database is not in read-only mode
4. Consult the backup before making any destructive changes

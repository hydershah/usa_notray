-- Reset all text tags to default 200x40 dimensions
UPDATE document_tags 
SET width = 200, height = 40, updated_at = NOW()
WHERE tag_type = 'T' AND (width != 200 OR height != 40);

-- Show updated text tags
SELECT id, tag_type, width, height, x_position, y_position, page_number 
FROM document_tags 
WHERE tag_type = 'T' 
ORDER BY id DESC 
LIMIT 10;

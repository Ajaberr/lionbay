-- Check if the message column exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 
             FROM information_schema.columns 
             WHERE table_name='messages' AND column_name='message') THEN
    -- Rename the column if it exists
    ALTER TABLE messages RENAME COLUMN message TO content;
    RAISE NOTICE 'Column renamed from message to content';
  ELSIF EXISTS (SELECT 1
                FROM information_schema.columns
                WHERE table_name='messages' AND column_name='content') THEN
    RAISE NOTICE 'Column content already exists, no changes needed';
  ELSE
    RAISE NOTICE 'Neither message nor content column found in messages table';
  END IF;
END $$; 
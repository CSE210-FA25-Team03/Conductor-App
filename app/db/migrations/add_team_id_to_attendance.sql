-- Migration: Add team_id to attendance_sessions and update type constraint
-- Run this migration to support team meeting attendance codes
-- This migration is safe to run on databases created from updated schema files (it will skip if already applied)

-- Suppress NOTICE messages for cleaner output
SET client_min_messages TO WARNING;

-- Only proceed if the attendance_sessions table exists
DO $$
BEGIN
    -- Check if table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance_sessions') THEN
        -- Add team_id column if it doesn't exist
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'attendance_sessions' 
            AND column_name = 'team_id'
        ) THEN
            ALTER TABLE attendance_sessions 
            ADD COLUMN team_id uuid REFERENCES teams(id) ON DELETE SET NULL;
        END IF;

        -- Update type constraint to include 'team_meeting' if needed
        -- Drop existing constraint if it exists
        IF EXISTS (
            SELECT FROM information_schema.table_constraints 
            WHERE table_schema = 'public'
            AND table_name = 'attendance_sessions' 
            AND constraint_name = 'attendance_sessions_type_check'
        ) THEN
            ALTER TABLE attendance_sessions 
            DROP CONSTRAINT attendance_sessions_type_check;
        END IF;

        -- Add updated constraint with team_meeting
        ALTER TABLE attendance_sessions 
        ADD CONSTRAINT attendance_sessions_type_check 
        CHECK (type IN ('class','group_meeting','office_hours','class_meeting','team_meeting','code_created'));
    END IF;
END $$;


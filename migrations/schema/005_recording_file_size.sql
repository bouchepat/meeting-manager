-- Migration: 005_recording_file_size
-- Description: Add recordingFileSize column to meetings table
-- Created: 2025-11-30
-- Author: System

USE meeting_manager;

-- Add recordingFileSize column (idempotent via procedure)
DROP PROCEDURE IF EXISTS add_recording_file_size_column;
DELIMITER //
CREATE PROCEDURE add_recording_file_size_column()
BEGIN
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'meeting_manager'
        AND TABLE_NAME = 'meetings'
        AND COLUMN_NAME = 'recordingFileSize'
    ) THEN
        ALTER TABLE meetings ADD COLUMN recordingFileSize BIGINT NULL AFTER recordingDuration;
    END IF;
END //
DELIMITER ;
CALL add_recording_file_size_column();
DROP PROCEDURE IF EXISTS add_recording_file_size_column;

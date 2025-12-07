-- Migration: 004_user_settings
-- Description: Add user settings columns to users table
-- Created: 2025-11-29
-- Author: System

USE meeting_manager;

-- Add settings columns to users table (idempotent via procedure)
DROP PROCEDURE IF EXISTS add_user_settings_columns;
DELIMITER //
CREATE PROCEDURE add_user_settings_columns()
BEGIN
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'meeting_manager' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'enableTranscription') THEN
        ALTER TABLE users ADD COLUMN enableTranscription BOOLEAN DEFAULT TRUE AFTER firebaseUid;
    END IF;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'meeting_manager' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'autoSaveRecordings') THEN
        ALTER TABLE users ADD COLUMN autoSaveRecordings BOOLEAN DEFAULT TRUE AFTER enableTranscription;
    END IF;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'meeting_manager' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'notificationsEnabled') THEN
        ALTER TABLE users ADD COLUMN notificationsEnabled BOOLEAN DEFAULT TRUE AFTER autoSaveRecordings;
    END IF;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'meeting_manager' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'theme') THEN
        ALTER TABLE users ADD COLUMN theme VARCHAR(10) DEFAULT 'dark' AFTER notificationsEnabled;
    END IF;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'meeting_manager' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'audioQuality') THEN
        ALTER TABLE users ADD COLUMN audioQuality VARCHAR(10) DEFAULT 'high' AFTER theme;
    END IF;
END //
DELIMITER ;
CALL add_user_settings_columns();
DROP PROCEDURE IF EXISTS add_user_settings_columns;

-- Update existing users with default settings
UPDATE users SET
    enableTranscription = TRUE,
    autoSaveRecordings = TRUE,
    notificationsEnabled = TRUE,
    theme = 'dark',
    audioQuality = 'high'
WHERE enableTranscription IS NULL;

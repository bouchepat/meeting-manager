-- Migration: 002_transcript_segments
-- Description: Add transcript_segments table for real-time transcription with speaker diarization
-- Created: 2025-11-29
-- Author: System

USE meeting_manager;

-- Transcript Segments Table
-- Stores individual transcript segments with speaker identification
CREATE TABLE IF NOT EXISTS transcript_segments (
    id VARCHAR(36) PRIMARY KEY,
    meetingId VARCHAR(36) NOT NULL,
    speakerTag INT NOT NULL DEFAULT 1,
    speakerName VARCHAR(255),
    transcript TEXT NOT NULL,
    confidence FLOAT,
    startTime FLOAT NOT NULL,
    endTime FLOAT NOT NULL,
    isFinal BOOLEAN DEFAULT FALSE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (meetingId) REFERENCES meetings(id) ON DELETE CASCADE,
    INDEX idx_meetingId (meetingId),
    INDEX idx_speakerTag (speakerTag),
    INDEX idx_startTime (startTime),
    INDEX idx_isFinal (isFinal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add transcriptUrl column to meetings table (idempotent via procedure)
DROP PROCEDURE IF EXISTS add_transcriptUrl_column;
DELIMITER //
CREATE PROCEDURE add_transcriptUrl_column()
BEGIN
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'meeting_manager'
        AND TABLE_NAME = 'meetings'
        AND COLUMN_NAME = 'transcriptUrl'
    ) THEN
        ALTER TABLE meetings ADD COLUMN transcriptUrl VARCHAR(512) AFTER recordingUrl;
    END IF;
END //
DELIMITER ;
CALL add_transcriptUrl_column();
DROP PROCEDURE IF EXISTS add_transcriptUrl_column;

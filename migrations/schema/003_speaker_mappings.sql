-- Migration: 003_speaker_mappings
-- Description: Add speaker_mappings table for voice enrollment
-- Created: 2025-11-29
-- Author: System

USE meeting_manager;

-- Speaker Mappings Table
-- Stores the mapping between speaker tags and identified names
CREATE TABLE IF NOT EXISTS speaker_mappings (
    id VARCHAR(36) PRIMARY KEY,
    meetingId VARCHAR(36) NOT NULL,
    speakerTag INT NOT NULL,
    speakerName VARCHAR(255) NOT NULL,
    enrolledAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meetingId) REFERENCES meetings(id) ON DELETE CASCADE,
    UNIQUE KEY unique_meeting_speaker (meetingId, speakerTag),
    INDEX idx_meetingId (meetingId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

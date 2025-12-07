-- Migration: 001_initial_schema
-- Description: Initial database schema for Meeting Manager
-- Created: 2025-11-26
-- Author: System

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS meeting_manager;
USE meeting_manager;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    displayName VARCHAR(255) NOT NULL,
    photoURL VARCHAR(512),
    firebaseUid VARCHAR(255) NOT NULL UNIQUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_firebaseUid (firebaseUid),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Meetings Table
CREATE TABLE IF NOT EXISTS meetings (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status ENUM('recording', 'processing', 'completed', 'failed') DEFAULT 'recording',
    recordingUrl VARCHAR(512),
    recordingDuration INT,
    startedAt TIMESTAMP NULL,
    endedAt TIMESTAMP NULL,
    creatorId VARCHAR(36) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (creatorId) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_creatorId (creatorId),
    INDEX idx_status (status),
    INDEX idx_createdAt (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Guests Table
CREATE TABLE IF NOT EXISTS guests (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    role VARCHAR(100),
    isAiDetected BOOLEAN DEFAULT FALSE,
    meetingId VARCHAR(36) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meetingId) REFERENCES meetings(id) ON DELETE CASCADE,
    INDEX idx_meetingId (meetingId),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status ENUM('todo', 'in_progress', 'done') DEFAULT 'todo',
    priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
    dueDate TIMESTAMP NULL,
    isAiGenerated BOOLEAN DEFAULT FALSE,
    meetingId VARCHAR(36) NOT NULL,
    assigneeId VARCHAR(36),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (meetingId) REFERENCES meetings(id) ON DELETE CASCADE,
    FOREIGN KEY (assigneeId) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_meetingId (meetingId),
    INDEX idx_assigneeId (assigneeId),
    INDEX idx_status (status),
    INDEX idx_priority (priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Meeting Summaries Table
CREATE TABLE IF NOT EXISTS meeting_summaries (
    id VARCHAR(36) PRIMARY KEY,
    summary TEXT NOT NULL,
    keyPoints JSON,
    decisions JSON,
    actionItems JSON,
    isAiGenerated BOOLEAN DEFAULT TRUE,
    meetingId VARCHAR(36) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meetingId) REFERENCES meetings(id) ON DELETE CASCADE,
    INDEX idx_meetingId (meetingId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

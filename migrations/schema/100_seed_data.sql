-- Seed Data: 001_seed_data
-- Description: Initial seed data for development and testing
-- Created: 2025-11-26
-- Author: System

USE meeting_manager;

-- Insert a test user
INSERT INTO users (id, email, displayName, firebaseUid, createdAt, updatedAt) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'test@example.com', 'Test User', 'test-firebase-uid-123', NOW(), NOW())
ON DUPLICATE KEY UPDATE displayName = displayName;

-- Insert sample meetings
INSERT INTO meetings (id, title, description, status, recordingDuration, startedAt, endedAt, creatorId, createdAt, updatedAt) VALUES
(UUID(), 'Q1 Planning Meeting', 'Quarterly planning and budget review for Q1 2025', 'completed', 3600, DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_SUB(NOW(), INTERVAL 7 DAY) + INTERVAL 1 HOUR, '550e8400-e29b-41d4-a716-446655440000', DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_SUB(NOW(), INTERVAL 7 DAY)),
(UUID(), 'Team Standup', 'Daily standup meeting with engineering team', 'completed', 900, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY) + INTERVAL 15 MINUTE, '550e8400-e29b-41d4-a716-446655440000', DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY)),
(UUID(), 'Product Roadmap Discussion', 'Review and prioritize features for upcoming sprint', 'completed', 2700, DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY) + INTERVAL 45 MINUTE, '550e8400-e29b-41d4-a716-446655440000', DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY)),
(UUID(), 'Client Feedback Session', 'Gathering feedback from key stakeholders', 'completed', 4500, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY) + INTERVAL 75 MINUTE, '550e8400-e29b-41d4-a716-446655440000', DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY)),
(UUID(), 'Sprint Retrospective', 'Team retrospective for sprint 23', 'completed', 3000, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY) + INTERVAL 50 MINUTE, '550e8400-e29b-41d4-a716-446655440000', DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)),
(UUID(), 'Architecture Review', 'Review proposed architecture changes for microservices', 'processing', NULL, NOW(), NULL, '550e8400-e29b-41d4-a716-446655440000', NOW(), NOW());

-- Drop and Recreate All Tables
-- WARNING: This will DELETE ALL DATA in the database!
-- Use this only for development or when you need a fresh start

USE meeting_manager;

-- Disable foreign key checks to allow dropping tables
SET FOREIGN_KEY_CHECKS = 0;

-- Drop all tables in reverse order of dependencies
DROP TABLE IF EXISTS meeting_summaries;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS guests;
DROP TABLE IF EXISTS meetings;
DROP TABLE IF EXISTS users;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Recreate all tables from initial schema
SOURCE ./migrations/schema/001_initial_schema.sql;

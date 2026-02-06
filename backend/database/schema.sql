-- Create the database if it doesn't exist
CREATE DATABASE IF NOT EXISTS bcc_voip_directory;
-- Use the created database
USE bcc_voip_directory;
-- Admins Table
CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name_surname VARCHAR(100) NOT NULL,
  username VARCHAR(100),
  password VARCHAR(255),
  department VARCHAR(100),
  section VARCHAR(100),
  office_number VARCHAR(100),
  designation VARCHAR(100),
  station VARCHAR(100),
  role ENUM('admin', 'user') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Extensions Table
CREATE TABLE IF NOT EXISTS extensions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  extension_number VARCHAR(10),
  ip_address VARCHAR(45),
  mac_address VARCHAR(50),
  phone_model VARCHAR(100),
  status ENUM('Online', 'Offline') DEFAULT 'Offline',
  sip_status ENUM('Registered', 'Unregistered', 'Unknown') DEFAULT 'Unknown',
  sip_port_open TINYINT(1) DEFAULT NULL,
  sip_last_checked DATETIME DEFAULT NULL,
  last_seen DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
-- Departments Table
CREATE TABLE IF NOT EXISTS departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Sections Table
CREATE TABLE IF NOT EXISTS sections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Stations Table
CREATE TABLE IF NOT EXISTS stations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  details TEXT,
  user_name VARCHAR(100) DEFAULT 'System',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Ping Logs Table
CREATE TABLE IF NOT EXISTS ping_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  extension_id INT NOT NULL,
  ping_time DATETIME NOT NULL,
  result ENUM('Success', 'Failed') NOT NULL,
  FOREIGN KEY (extension_id) REFERENCES extensions(id) ON DELETE CASCADE
);
-- Insert the default admin user
-- The password is 'bccit'
INSERT IGNORE INTO admins (username, password)
VALUES ('admin', 'bccit');
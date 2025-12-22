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
  department VARCHAR(100),
  office_number VARCHAR(20),
  designation VARCHAR(100),
  station VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- NOTE: If you're migrating an existing DB, run:
-- ALTER TABLE users ADD COLUMN designation VARCHAR(100);
-- ALTER TABLE users ADD COLUMN station VARCHAR(100);

-- Extensions Table
CREATE TABLE IF NOT EXISTS extensions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  extension_number VARCHAR(10) NOT NULL UNIQUE,
  ip_address VARCHAR(45) NOT NULL UNIQUE,
  mac_address VARCHAR(50),
  phone_model VARCHAR(100),
  status ENUM('Online', 'Offline') DEFAULT 'Offline',
  last_seen DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- NOTE: If you're migrating an existing DB, run:
-- ALTER TABLE extensions ADD COLUMN mac_address VARCHAR(50);
-- ALTER TABLE extensions ADD COLUMN phone_model VARCHAR(100);

-- Ping Logs Table (Optional but recommended)
CREATE TABLE IF NOT EXISTS ping_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  extension_id INT NOT NULL,
  ping_time DATETIME NOT NULL,
  result ENUM('Success', 'Failed') NOT NULL,
  FOREIGN KEY (extension_id) REFERENCES extensions(id) ON DELETE CASCADE
);

-- Insert the default admin user
-- The password is 'bccit' and will be hashed by the application upon first login or seeding.
-- For now, we insert a plain text version that the backend will need to handle.
INSERT INTO admins (username, password)
VALUES ('admin', 'bccit');

-- Note: For production, the password should be pre-hashed.
-- Example with a pre-hashed password for 'bccit' (using bcrypt, for example):
-- INSERT INTO admins (username, password) VALUES ('admin', '$2b$10$YourHashedPasswordHere');

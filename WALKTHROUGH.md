# VOIP Directory & Extension Monitoring System - Walkthrough

Welcome to the technical walkthrough of the **VOIP Directory**. This document provides an overview of the system's features, the technology stack, and how the core functionalities were implemented.

---

## 1. Project Overview

The VOIP Directory is a real-time monitoring and management system designed to track the status of IP phones across a network. It provides IT administrators with a centralized dashboard to see who is online, who is offline, and detailed logs of system activity.

## 2. Key Features

### 📊 Real-Time Dashboard

The dashboard is the heart of the application. It provides:

- **Live Status Monitoring**: Automatically refreshes every 5 seconds to show if a phone is `Online` (reachable) or `Offline`.
- **Search & Filter**: Quickly find users by name, IP, extension, or department.
- **Dynamic Sorting**: Click any column header to sort the table.
- **Relative Timestamps**: "Last Seen" times are shown in human-readable formats (e.g., "5 mins ago").
- **CSV Export**: Download the current filtered view of phones as a CSV file for external reporting.

### 🛡️ Admin Panel

A secure area for managing the system's data:

- **User Management**: Add, edit, or delete VOIP users. Users are linked to specific extensions and IP addresses.
- **Phone Monitoring**: A dedicated view to see all monitored hardware at a glance.
- **Activity Logging**: Every administrative action (adding/editing/deleting) is automatically recorded.

### 📋 Activity Logs (Audit Trail)

A specialized page that tracks:

- **User Actions**: Who modified what and when.
- **Visual Cues**: Color-coded borders indicate the type of action (Green for Adds, Blue for Updates, Red for Deletions).
- **History**: Keeps a chronological record of changes for accountability.

### ⚙️ Settings (Management)

A centralized location to manage the organizational structure:

- **Departments & Stations**: Create and manage unique departments (e.g., IT, Finance) and physical stations. These are then available as dropdown options when creating users, ensuring data consistency.

### 📈 Advanced Reporting

The reporting engine allows for historical downtime analysis:

- **Daily Reports**: See all failures for a specific date.
- **Range Reports**: Analyze stability over a custom date range.
- **Multiple Formats**: Export reports directly to **PDF** (custom layouts using `pdfkit`) or **Excel** (using `xlsx`).

### 🔔 Toast Notifications

Replaced intrusive browser alerts with streamlined, premium "Toast" notifications. These provide non-intrusive feedback for successful actions (like "User Saved") or errors.

---

## 3. Technical Architecture

### Frontend (Modern React)

- **Framework**: Built with **React** and **Vite** for blazing-fast development and performance.
- **Styling**: A custom design system using **Vanilla CSS**. No bulky frameworks like Tailwind were used, allowing for a lightweight and highly tailored "BCC Blue/Red" theme.
- **State Management**: Uses **React Context API** (e.g., `ToastContext`) for global application states.
- **HTTP Client**: **Axios** handles all communication with the backend.

### Backend (Node.js & Express)

- **Runtime**: **Node.js** with the **Express** framework.
- **Database**: **MySQL** stores all user data, extension details, ping logs, and activity records.
- **Monitoring Service**: A background service that runs a continuous loop, pinging every registered IP address using the ICMP protocol.
- **Reports Generation**: Uses `pdfkit` for generating dynamic PDF documents and `xlsx` for Excel workbooks on the server-side.

---

## 4. How the "Magic" Works

### The Monitoring Cycle

The backend doesn't wait for a user to refresh. A dedicated service (`monitoringService.js`) initializes on server start. It performs the following steps every 60 seconds:

1. Fetches all registered IP addresses from the database.
2. Pings each address.
3. If a ping fails, it marks the status as "Offline" and creates a record in the `ping_logs` table.
4. If it succeeds, it marks it as "Online" and updates the `last_seen` timestamp.

### Capturing Activity

We implemented a custom `logActivity` helper. Every time an admin interacts with the API (to Add, Update, or Delete), the backend simultaneously writes to the `activity_logs` table. This is decoupled from the main process to ensure the UI remains fast.

### Responsive UI Cleanup

The UI was recently refined to remove clutter:

- **Smaller Footprint**: Removed bulky stats cards in favor of a dense, data-rich table view.
- **Icon-Free Design**: Cleaned up the interface by removing emoji icons, creating a more professional and streamlined look.
- **Port Management**: The system is configured to run on port `5001` (backend) to avoid conflicts with other system services.

---

## 5. Development Summary

This project represents a full-stack solution focusing on **Reliability**, **Auditability**, and **User Experience**. By combining real-time background processing with a clean, modern frontend, the BCC VOIP Directory provides a robust tool for extension management.

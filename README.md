# VOIP Directory & Extension Monitoring System

A comprehensive web-based application designed to manage, directory, and monitor VOIP hardware and user extension status in real-time.

## 🚀 Key Features

- **Real-time Monitoring**: Automatically tracks the online/offline status of IP phones using ICMP monitoring.
- **Dynamic Directory**: Searchable directory of users, extensions, departments, and stations.
- **Admin Dashboard**: Full CRUD (Create, Read, Update, Delete) operations for managing VOIP users.
- **Bulk Import**: Support for importing user data from CSV and Excel (.xlsx, .xls) files.
- **Report Generation**: Generate detailed PDF reports of extensions, hardware, and system activity.
- **Activity Logging**: Tracks all administrative changes for auditing purposes.
- **Role-Based Access**: Secure login with separate permissions for Administrators and standard Users.
- **Data Cleanup**: Built-in tools for merging duplicates and maintaining data integrity.

## 🛠️ Technology Stack

### Frontend

- **React.js (Vite)**: Modern, high-performance UI framework.
- **Bootstrap 5**: Responsive design and layout.
- **React Router**: Client-side navigation.
- **Axios**: Promised-based HTTP client for API interaction.
- **XLSX**: Support for parsing and generating spreadsheet files.
- **jsPDF**: Client-side PDF generation.

### Backend

- **Node.js & Express**: High-speed JavaScript runtime and web framework.
- **MySQL**: Relational database for persistent storage.
- **Ping**: ICMP monitoring for hardware status.
- **Multer**: Middleware for handling multipart/form-data (file uploads).
- **PDFKit**: Professional-grade PDF generation on the server.
- **dotenv**: Environment variable management.

## 📂 Project Structure

```text
├── frontend/             # React Application
│   ├── src/
│   │   ├── components/   # UI Components (Pages, Shared, Layout)
│   │   ├── api/          # Axios configuration
│   │   ├── context/      # Auth and UI context providers
│   │   └── assets/       # Styles and static assets
├── backend/              # Node.js Express API
│   ├── controllers/      # Route logic
│   ├── routes/           # API Endpoints
│   ├── services/         # Monitoring, cleanup, and business logic
│   ├── database/         # SQL schema and migration scripts
│   └── public/           # Static files and uploads
└── IIS_DEPLOYMENT.md     # Production hosting guide
```

## ⚙️ Core Services

1. **Monitoring Service**: A background process that periodically pings IP addresses registered to users to update their "Online/Offline" status.
2. **Cleanup Task**: An automated service that manages historical data and system maintenance.
3. **Authentication**: Secure JWT-based (or session-based) authentication for administrative access.

## 📝 License

This project is licensed under the ISC License.

# VOIP Directory - Windows Server IIS Deployment Guide

This document provides a step-by-step guide for hosting the **VOIP Directory** (React Frontend + Node.js Backend) on a Windows Server using **Internet Information Services (IIS)**.

---

## 1. Prerequisites

Before starting, ensure the following are installed on the Windows Server:

1. **Node.js (LTS)**: To run the backend server.
2. **MySQL Server**: To host the database.
3. **IIS (Internet Information Services)**: With "Web Management Tools" and "World Wide Web Services" enabled.
4. **IIS URL Rewrite Module**: [Download here](https://www.iis.net/downloads/microsoft/url-rewrite). (Required for React routing and Reverse Proxy).
5. **Application Request Routing (ARR) 3.0**: [Download here](https://www.iis.net/downloads/microsoft/application-request-routing). (Required for Reverse Proxying to Node).

---

## 2. Database Setup

1. Open **MySQL Workbench** or your preferred SQL tool.
2. Execute the schema located at `backend/database/schema.sql`.
3. Create a dedicated database user for the application (optional but recommended).

---

## 3. Backend Preparation

1. **Dependency Installation**:

    ```powershell
    cd C:\path-to-your-project\backend
    npm install --production
    ```

2. **Environment Variables**:
    Create a `.env` file in the `backend` folder:

    ```env
    PORT=5001
    DB_HOST=localhost
    DB_USER=your_db_user
    DB_PASSWORD=your_db_password
    DB_NAME=bcc_voip_directory
    ```

3. **Process Management (PM2)**:
    To ensure the Node.js server starts on boot and restarts if it crashes:

    ```powershell
    npm install pm2 -g
    pm2 start server.js --name voip-backend
    pm2 save
    ```

    *Note: Use `pm2-windows-service` to run PM2 as a Windows service.*

---

## 4. Frontend Preparation

1. **Dependency Installation**:

    ```powershell
    cd C:\path-to-your-project\frontend
    npm install
    ```

2. **Production Build**:

    ```powershell
    npm run build
    ```

    This will generate a `dist` folder.
3. **Add `web.config`**:
    Create a `web.config` file inside the `frontend/dist` directory (or `frontend/public` before building) to handle Single Page Application (SPA) routing:

    ```xml
    <?xml version="1.0" encoding="UTF-8"?>
    <configuration>
      <system.webServer>
        <rewrite>
          <rules>
            <rule name="React Routes" stopProcessing="true">
              <match url=".*" />
              <conditions logicalGrouping="MatchAll">
                <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
                <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
                <add input="{REQUEST_URI}" pattern="^/(api)" negate="true" />
              </conditions>
              <action type="Rewrite" url="/" />
            </rule>
          </rules>
        </rewrite>
      </system.webServer>
    </configuration>
    ```

---

## 5. IIS Configuration

### A. Enable Proxying (ARR)

1. Open **IIS Manager**.
2. Select the server node in the left pane.
3. Double-click **Application Request Routing Cache**.
4. In the right pane, click **Server Proxy Settings**.
5. Check **Enable proxy** and click **Apply**.

### B. Create the Website

1. Right-click **Sites** -> **Add Website**.
2. **Site name**: `VOIP-Directory`
3. **Physical path**: `C:\path-to-your-project\frontend\dist`
4. **Binding**: Set your desired port or hostname.

### C. Configure Reverse Proxy (API)

1. Under your new site, double-click **URL Rewrite**.
2. Click **Add Rule(s)...** -> **Blank Rule**.
3. **Name**: `API Proxy`
4. **Pattern**: `api/(.*)`
5. **Action Type**: `Rewrite`
6. **Rewrite URL**: `http://localhost:5001/api/{R:1}`
7. Click **Apply**.

---

## 6. Verification

- **Frontend**: Navigate to `http://your-server-address/`. The UI should load.
- **Backend**: Navigate to `http://your-server-address/api/users`. You should see JSON data.
- **Routing**: Navigate to a sub-path like `/admin` and refresh the page. It should reload correctly.

---

## Troubleshooting

- **502.3 Bad Gateway**: Usually means the Node.js backend is not running or the reverse proxy URL is incorrect.
- **404 on Refresh**: Ensure the `web.config` is present in the `dist` folder.
- **CORS Issues**: Ensure the backend `server.js` is configured to allow the IIS site's origin.

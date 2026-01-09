# VOIP Directory Setup Guide

## Prerequisites

Before running the application on a new computer, ensure you have:

1. **Node.js** (v14 or higher)
2. **MySQL Server** installed and running
3. **Git** (optional, for cloning)

## Database Setup

### Step 1: Create the Database

Connect to MySQL and run the schema:

```bash
mysql -u root -p < backend/database/schema.sql
```

Or manually in MySQL:

```sql
CREATE DATABASE IF NOT EXISTS bcc_voip_directory;
USE bcc_voip_directory;
```

Then run the rest of the `schema.sql` file contents.

### Step 2: Configure Environment Variables

Create a `.env` file in the `backend` folder with your database credentials:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=bcc_voip_directory
```

**IMPORTANT**: Replace `your_mysql_password` with your actual MySQL root password.

## Running the Application

### Step 1: Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Step 2: Run Database Migrations (if needed)

```bash
cd backend
node migrate.js
node create-activity-table.js
```

### Step 3: Start the Servers

Open two terminals:

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```
You should see: `Server running on port 5001`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## Troubleshooting CSV Import Issues

### Problem: Table remains blank after import with no error

**Possible Causes & Solutions:**

1. **Backend not running**
   - Check if the backend server is running on port 5001
   - Look for any error messages in the backend terminal
   - Open browser console (F12) to see network errors

2. **Database not set up**
   - Ensure MySQL is running
   - Verify the database `bcc_voip_directory` exists
   - Check that all tables are created (run `schema.sql`)

3. **Missing .env file**
   - Create the `.env` file in the `backend` folder with correct credentials
   - Restart the backend server after creating/modifying `.env`

4. **Wrong database credentials**
   - Verify your MySQL username and password in `.env`
   - Test connection: `mysql -u root -p -e "USE bcc_voip_directory; SHOW TABLES;"`

5. **CSV format issues**
   - Download the template CSV first
   - Ensure column headers match exactly (case-sensitive):
     - Name, Surname, Department, Section, Office Number, Designation, Station, Extension, IP Address, Model, Mac Address

### Checking the Console for Errors

1. Open the browser Developer Tools (press `F12`)
2. Go to the **Console** tab
3. Try importing a CSV file
4. Look for any red error messages

### Testing Backend Connection

Open a browser and navigate to:
```
http://localhost:5001/api/users
```

If you see JSON data or an empty array `[]`, the backend is working.
If you see a connection error, the backend is not running or not accessible.

## Quick Checklist

- [ ] MySQL server is running
- [ ] Database `bcc_voip_directory` exists
- [ ] All tables are created (`users`, `extensions`, `departments`, etc.)
- [ ] `.env` file exists in `backend/` with correct credentials
- [ ] Backend server is running (check terminal for errors)
- [ ] Frontend is running
- [ ] No network/CORS errors in browser console

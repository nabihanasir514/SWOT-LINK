# Database Setup Instructions

## Prerequisites
- MySQL Server 5.7+ or MariaDB 10.3+
- MySQL client or MySQL Workbench

## Setup Steps

### 1. Install MySQL (if not already installed)
Download and install MySQL from: https://dev.mysql.com/downloads/

### 2. Create Database and Tables

**Option A: Using MySQL Command Line**
```bash
mysql -u root -p < schema.sql
```

**Option B: Using MySQL Workbench**
1. Open MySQL Workbench
2. Connect to your MySQL server
3. File → Open SQL Script → Select `schema.sql`
4. Execute the script (Lightning bolt icon or Ctrl+Shift+Enter)

### 3. Configure Backend Connection

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update the database credentials in `.env`:
   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=swot_link_db
   DB_PORT=3306
   ```

### 4. Verify Database Setup

Run this query to verify all tables were created:
```sql
USE swot_link_db;
SHOW TABLES;
```

You should see:
- funding_stages
- industries
- investor_industry_preferences
- investor_profiles
- investor_stage_preferences
- roles
- startup_profiles
- users

## Database Schema Overview

### Users & Authentication
- `users`: Main user table with authentication
- `roles`: User roles (Startup, Investor, Admin)

### Industries & Funding
- `industries`: List of business industries
- `funding_stages`: Funding stages (Pre-Seed, Seed, Series A, etc.)

### Profiles
- `startup_profiles`: Startup company profiles with SWOT analysis
- `investor_profiles`: Investor profiles with investment thesis
- `investor_industry_preferences`: Industries investors are interested in
- `investor_stage_preferences`: Funding stages investors prefer

## Default Data

The schema includes default data for:
- 3 Roles (Startup, Investor, Admin)
- 13 Industries (Technology, Healthcare, Finance, etc.)
- 6 Funding Stages (Pre-Seed through Series C+)

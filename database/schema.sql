-- ============================================================
-- ApprovIQ Database Schema (T-SQL)
-- Run this in SQL Server Management Studio (SSMS)
-- ============================================================

-- Create the database
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'ApprovIQ')
BEGIN
    CREATE DATABASE ApprovIQ;
END
GO

USE ApprovIQ;
GO

-- ============================================================
-- DEPARTMENTS
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[departments]') AND type = 'U')
BEGIN
    CREATE TABLE departments (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        name        NVARCHAR(100) NOT NULL UNIQUE,
        created_at  DATETIME2 DEFAULT GETDATE()
    );
END
GO

-- ============================================================
-- USERS
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND type = 'U')
BEGIN
    CREATE TABLE users (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        name            NVARCHAR(100) NOT NULL,
        email           NVARCHAR(150) NOT NULL UNIQUE,
        password_hash   NVARCHAR(255) NOT NULL,
        role            NVARCHAR(20)  NOT NULL CHECK (role IN ('student','advisor','hod','principal','admin')),
        department_id   INT NULL REFERENCES departments(id),
        class           NVARCHAR(50)  NULL,
        phone           NVARCHAR(20)  NULL,
        roll_number     NVARCHAR(30)  NULL,
        year            NVARCHAR(10)  NULL,
        is_active       BIT DEFAULT 1,
        created_at      DATETIME2 DEFAULT GETDATE()
    );
END
GO

-- ============================================================
-- DEPARTMENTS HOD LINK (added after users table)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[departments]') AND name = 'hod_id')
BEGIN
    ALTER TABLE departments ADD hod_id INT NULL REFERENCES users(id);
END
GO

-- ============================================================
-- LEAVE REQUESTS
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[leave_requests]') AND type = 'U')
BEGIN
    CREATE TABLE leave_requests (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        student_id      INT NOT NULL REFERENCES users(id),
        leave_type      NVARCHAR(50) NOT NULL CHECK (leave_type IN ('medical','personal','family','academic','other')),
        from_date       DATE NOT NULL,
        to_date         DATE NOT NULL,
        total_days      INT NOT NULL,
        reason          NVARCHAR(MAX) NOT NULL,
        document_path   NVARCHAR(500) NULL,
        status          NVARCHAR(30) NOT NULL DEFAULT 'pending_advisor'
                        CHECK (status IN ('pending_advisor','pending_hod','pending_principal','approved','rejected')),
        created_at      DATETIME2 DEFAULT GETDATE(),
        updated_at      DATETIME2 DEFAULT GETDATE()
    );
END
GO

-- ============================================================
-- APPROVALS (audit trail per stage)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[approvals]') AND type = 'U')
BEGIN
    CREATE TABLE approvals (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        leave_id        INT NOT NULL REFERENCES leave_requests(id),
        approver_id     INT NOT NULL REFERENCES users(id),
        role            NVARCHAR(20) NOT NULL CHECK (role IN ('advisor','hod','principal')),
        action          NVARCHAR(20) NOT NULL CHECK (action IN ('approved','rejected')),
        comment         NVARCHAR(MAX) NULL,
        actioned_at     DATETIME2 DEFAULT GETDATE()
    );
END
GO

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[notifications]') AND type = 'U')
BEGIN
    CREATE TABLE notifications (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        user_id     INT NOT NULL REFERENCES users(id),
        message     NVARCHAR(500) NOT NULL,
        link        NVARCHAR(200) NULL,
        is_read     BIT DEFAULT 0,
        created_at  DATETIME2 DEFAULT GETDATE()
    );
END
GO

-- ============================================================
-- AUDIT LOGS
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[audit_logs]') AND type = 'U')
BEGIN
    CREATE TABLE audit_logs (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        actor_id    INT NULL REFERENCES users(id),
        action      NVARCHAR(100) NOT NULL,
        target      NVARCHAR(200) NULL,
        details     NVARCHAR(MAX) NULL,
        ip_address  NVARCHAR(50)  NULL,
        created_at  DATETIME2 DEFAULT GETDATE()
    );
END
GO

PRINT 'ApprovIQ schema created successfully.';
GO

-- ============================================
-- CLIMBS / CESLA Multi-Purpose Cooperative
-- Database Schema
-- ============================================

CREATE DATABASE IF NOT EXISTS climbs_db;
USE climbs_db;

-- ── MEMBERS TABLE ────────────────────────────
CREATE TABLE IF NOT EXISTS members (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    application_no   VARCHAR(20) UNIQUE NOT NULL,
    user_id          VARCHAR(25) UNIQUE NOT NULL,   -- e.g. CESLA-2025-00001 (used for login)

    -- Account credentials
    username         VARCHAR(100) UNIQUE,           -- kept for backward compat (optional)
    password         VARCHAR(255) NOT NULL,
    status           ENUM('pending','approved','rejected') DEFAULT 'pending',
    
    -- Personal details
    title            VARCHAR(10),
    first_name       VARCHAR(100),
    middle_name      VARCHAR(100),
    last_name        VARCHAR(100),
    suffix           VARCHAR(20),
    gender           VARCHAR(10),
    birthdate        DATE,
    place_of_birth   VARCHAR(200),
    nationality      VARCHAR(50),
    religion         VARCHAR(100),
    civil_status     VARCHAR(30),
    dependents       INT DEFAULT 0,
    
    -- IDs
    sss_number       VARCHAR(50),
    tin_number       VARCHAR(50),
    other_ids        VARCHAR(100),
    
    -- Contact
    present_address  VARCHAR(255),
    zip_code1        VARCHAR(10),
    permanent_address VARCHAR(255),
    zip_code2        VARCHAR(10),
    stay_years       INT,
    stay_months      INT,
    
    -- Employment
    employer_name    VARCHAR(200),
    office_address   VARCHAR(255),
    business_nature  VARCHAR(100),
    office_no        VARCHAR(30),
    fax_no           VARCHAR(30),
    employment_type  VARCHAR(50),
    position         VARCHAR(100),
    monthly_income   DECIMAL(12,2) DEFAULT 0,
    prev_employer    VARCHAR(200),
    prev_years       VARCHAR(20),
    prev_position    VARCHAR(100),
    
    -- Self-employed
    business_name    VARCHAR(200),
    business_type    VARCHAR(50),
    self_business_nature VARCHAR(100),
    asset_size       DECIMAL(15,2) DEFAULT 0,
    business_share   DECIMAL(5,2) DEFAULT 0,
    self_monthly_income DECIMAL(12,2) DEFAULT 0,
    
    -- Unemployed
    unemployed_type  VARCHAR(50),
    
    -- Referral
    referred_by      VARCHAR(200),
    referred_contact VARCHAR(30),
    
    -- Profile photo (base64 stored directly)
    profile_photo    LONGTEXT NULL,

    -- Application Form Status
    form_status         ENUM('incomplete','submitted','approved') DEFAULT 'incomplete',
    form_submitted_at   DATETIME NULL,
    form_approved_at    DATETIME NULL,

    -- Timestamps
    submitted_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at      DATETIME NULL,
    rejected_at      DATETIME NULL,
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── FAMILY MEMBERS TABLE ─────────────────────
CREATE TABLE IF NOT EXISTS family_members (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    member_id   INT NOT NULL,
    name        VARCHAR(200),
    relation    VARCHAR(50),
    age         INT,
    occupation  VARCHAR(100),
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- ── SHARES TABLE ─────────────────────────────
CREATE TABLE IF NOT EXISTS shares (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    member_id       INT NOT NULL,
    transaction_date DATE NOT NULL,
    type            ENUM('deposit','withdrawal') NOT NULL,
    description     VARCHAR(200),
    amount          DECIMAL(12,2) NOT NULL,
    balance         DECIMAL(12,2) NOT NULL,
    or_number       VARCHAR(50),
    encoded_by      VARCHAR(100),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- ── SAVINGS TABLE ─────────────────────────────
CREATE TABLE IF NOT EXISTS savings (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    member_id       INT NOT NULL,
    transaction_date DATE NOT NULL,
    type            ENUM('deposit','withdrawal') NOT NULL,
    description     VARCHAR(200),
    amount          DECIMAL(12,2) NOT NULL,
    balance         DECIMAL(12,2) NOT NULL,
    or_number       VARCHAR(50),
    encoded_by      VARCHAR(100),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- ── LOANS TABLE ──────────────────────────────
CREATE TABLE IF NOT EXISTS loans (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    member_id       INT NOT NULL,
    loan_no         VARCHAR(30) UNIQUE NOT NULL,
    loan_type       ENUM('regular','emergency','educational','livelihood','others') NOT NULL,
    amount          DECIMAL(12,2) NOT NULL,
    interest_rate   DECIMAL(5,2) DEFAULT 0,
    term_months     INT NOT NULL,
    monthly_payment DECIMAL(12,2),
    date_released   DATE,
    due_date        DATE,
    outstanding_balance DECIMAL(12,2),
    status          ENUM('active','paid','restructured','delinquent') DEFAULT 'active',
    purpose         VARCHAR(255),
    encoded_by      VARCHAR(100),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- ── LOAN PAYMENTS TABLE ───────────────────────
CREATE TABLE IF NOT EXISTS loan_payments (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    loan_id         INT NOT NULL,
    member_id       INT NOT NULL,
    payment_date    DATE NOT NULL,
    amount_paid     DECIMAL(12,2) NOT NULL,
    principal       DECIMAL(12,2) DEFAULT 0,
    interest        DECIMAL(12,2) DEFAULT 0,
    remaining_balance DECIMAL(12,2),
    or_number       VARCHAR(50),
    encoded_by      VARCHAR(100),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (loan_id)   REFERENCES loans(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- ── ADMIN TABLE ───────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    username    VARCHAR(100) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,   -- bcrypt hashed
    full_name   VARCHAR(200),
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── DEFAULT ADMIN ─────────────────────────────
-- Password: admin123 (bcrypt hashed — change after first login!)
INSERT IGNORE INTO admins (username, password, full_name)
VALUES ('admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'System Administrator');

-- ── USEFUL VIEWS ─────────────────────────────

-- Member summary with totals
CREATE OR REPLACE VIEW member_summary AS
SELECT
    m.id,
    m.application_no,
    m.username,
    m.status,
    CONCAT(m.first_name, ' ', COALESCE(m.middle_name,''), ' ', m.last_name) AS full_name,
    m.submitted_at,
    m.approved_at,
    COALESCE((SELECT SUM(CASE WHEN type='deposit' THEN amount ELSE -amount END) FROM shares WHERE member_id = m.id), 0) AS total_shares,
    COALESCE((SELECT SUM(CASE WHEN type='deposit' THEN amount ELSE -amount END) FROM savings WHERE member_id = m.id), 0) AS total_savings,
    COALESCE((SELECT SUM(outstanding_balance) FROM loans WHERE member_id = m.id AND status='active'), 0) AS total_loan_balance
FROM members m;


-- ══════════════════════════════════════════════
-- RUN THESE IF TABLE ALREADY EXISTS (migration)
-- ══════════════════════════════════════════════
-- ALTER TABLE members ADD COLUMN user_id VARCHAR(25) UNIQUE AFTER application_no;
-- ALTER TABLE members MODIFY COLUMN username VARCHAR(100) NULL;
-- ALTER TABLE members ADD COLUMN form_status ENUM('incomplete','submitted','approved') DEFAULT 'incomplete';
-- ALTER TABLE members ADD COLUMN form_submitted_at DATETIME NULL;
-- ALTER TABLE members ADD COLUMN profile_photo LONGTEXT NULL;
-- ALTER TABLE members ADD COLUMN form_approved_at DATETIME NULL;

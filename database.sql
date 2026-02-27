-- ============================================================
-- CESLA Multi-Purpose Cooperative — Complete Database
-- Version: 2026
-- ============================================================
-- HOW TO USE:
--   1. Open phpMyAdmin → http://localhost/phpmyadmin
--   2. Click "New" database OR select existing one
--   3. Go to SQL tab → paste this entire file → click GO
-- ============================================================

CREATE DATABASE IF NOT EXISTS climbs_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE climbs_db;

-- ════════════════════════════════════════════
--  1. ADMINS
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS admins (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    username    VARCHAR(100) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    full_name   VARCHAR(200),
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Default admin → username: admin / password: admin123
INSERT IGNORE INTO admins (username, password, full_name) VALUES
('admin', '$2b$10$BySK6GR0KFwytTqYwnrbn.Ugz/Bdq3LdGxrYCMr/mdaZrfsMTU9fm', 'System Administrator');

-- ════════════════════════════════════════════
--  2. MEMBERS
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS members (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    application_no       VARCHAR(20) UNIQUE NOT NULL,
    user_id              VARCHAR(25) UNIQUE NOT NULL,
    username             VARCHAR(100) UNIQUE,
    password             VARCHAR(255) NOT NULL,
    status               ENUM('pending','approved','rejected') DEFAULT 'pending',

    -- Personal info
    title                VARCHAR(10),
    first_name           VARCHAR(100),
    middle_name          VARCHAR(100),
    last_name            VARCHAR(100),
    suffix               VARCHAR(20),
    gender               VARCHAR(10),
    birthdate            DATE,
    place_of_birth       VARCHAR(200),
    nationality          VARCHAR(50)  DEFAULT 'Filipino',
    religion             VARCHAR(100),
    civil_status         VARCHAR(30),
    dependents           INT DEFAULT 0,

    -- Government IDs
    sss_number           VARCHAR(50),
    tin_number           VARCHAR(50),
    other_ids            VARCHAR(100),

    -- Address
    present_address      VARCHAR(255),
    zip_code1            VARCHAR(10),
    permanent_address    VARCHAR(255),
    zip_code2            VARCHAR(10),
    stay_years           INT DEFAULT 0,
    stay_months          INT DEFAULT 0,

    -- Employment
    employer_name        VARCHAR(200),
    office_address       VARCHAR(255),
    business_nature      VARCHAR(100),
    office_no            VARCHAR(30),
    fax_no               VARCHAR(30),
    employment_type      VARCHAR(50),
    position             VARCHAR(100),
    monthly_income       DECIMAL(12,2) DEFAULT 0,
    prev_employer        VARCHAR(200),
    prev_years           VARCHAR(20),
    prev_position        VARCHAR(100),

    -- Self-employed
    business_name        VARCHAR(200),
    business_type        VARCHAR(50),
    self_business_nature VARCHAR(100),
    asset_size           DECIMAL(15,2) DEFAULT 0,
    business_share       DECIMAL(5,2)  DEFAULT 0,
    self_monthly_income  DECIMAL(12,2) DEFAULT 0,

    -- Unemployed
    unemployed_type      VARCHAR(50),

    -- Referral
    referred_by          VARCHAR(200),
    referred_contact     VARCHAR(30),

    -- Profile photo (base64)
    profile_photo        LONGTEXT NULL,

    -- Application form status
    form_status          ENUM('incomplete','submitted','approved') DEFAULT 'incomplete',
    form_submitted_at    DATETIME NULL,
    form_approved_at     DATETIME NULL,

    -- Timestamps
    submitted_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at          DATETIME NULL,
    rejected_at          DATETIME NULL,
    updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ════════════════════════════════════════════
--  3. FAMILY MEMBERS
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS family_members (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    member_id   INT NOT NULL,
    name        VARCHAR(200),
    relation    VARCHAR(50),
    age         INT,
    occupation  VARCHAR(100),
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- ════════════════════════════════════════════
--  4. SHARES
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS shares (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    member_id        INT NOT NULL,
    transaction_date DATE NOT NULL,
    type             ENUM('deposit','withdrawal') NOT NULL,
    description      VARCHAR(200),
    amount           DECIMAL(12,2) NOT NULL,
    balance          DECIMAL(12,2) NOT NULL,
    or_number        VARCHAR(50),
    encoded_by       VARCHAR(100),
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- ════════════════════════════════════════════
--  5. SAVINGS
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS savings (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    member_id        INT NOT NULL,
    transaction_date DATE NOT NULL,
    type             ENUM('deposit','withdrawal') NOT NULL,
    description      VARCHAR(200),
    amount           DECIMAL(12,2) NOT NULL,
    balance          DECIMAL(12,2) NOT NULL,
    or_number        VARCHAR(50),
    encoded_by       VARCHAR(100),
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- ════════════════════════════════════════════
--  6. LOANS
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS loans (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    member_id           INT NOT NULL,
    loan_no             VARCHAR(30) UNIQUE NOT NULL,
    loan_type           ENUM('regular','emergency','educational','livelihood','others') NOT NULL,
    amount              DECIMAL(12,2) NOT NULL,
    interest_rate       DECIMAL(5,2)  DEFAULT 0,
    term_months         INT NOT NULL,
    monthly_payment     DECIMAL(12,2),
    date_released       DATE,
    due_date            DATE,
    outstanding_balance DECIMAL(12,2),
    status              ENUM('pending','active','paid','restructured','delinquent','rejected') DEFAULT 'pending',
    purpose             VARCHAR(255),
    encoded_by          VARCHAR(100),
    applied_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at         DATETIME NULL,
    rejected_at         DATETIME NULL,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- ════════════════════════════════════════════
--  7. LOAN PAYMENTS
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS loan_payments (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    loan_id           INT NOT NULL,
    member_id         INT NOT NULL,
    payment_date      DATE NOT NULL,
    amount_paid       DECIMAL(12,2) NOT NULL,
    principal         DECIMAL(12,2) DEFAULT 0,
    interest          DECIMAL(12,2) DEFAULT 0,
    remaining_balance DECIMAL(12,2),
    or_number         VARCHAR(50),
    encoded_by        VARCHAR(100),
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (loan_id)   REFERENCES loans(id)   ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- ════════════════════════════════════════════
--  8. CANTEEN — MENU ITEMS
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS canteen_items (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    category    ENUM('meals','drinks','snacks','junkfoods','others') NOT NULL,
    price       DECIMAL(8,2) NOT NULL,
    stock       INT DEFAULT 0,
    emoji       VARCHAR(10)  DEFAULT '🍽️',
    image_url   VARCHAR(255) NULL,
    is_available TINYINT(1)  DEFAULT 1,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Sample menu items
INSERT INTO canteen_items (name, category, price, stock, emoji) VALUES
('Lugaw with Egg',  'meals',     55.00, 50, '🍚'),
('Sinangag',        'meals',     30.00, 30, '🍛'),
('Pork Adobo',      'meals',     75.00, 20, '🍖'),
('Fried Chicken',   'meals',     80.00, 15, '🍗'),
('Pancit Canton',   'meals',     65.00, 25, '🍜'),
('Softdrinks',      'drinks',    25.00,100, '🥤'),
('Bottled Water',   'drinks',    15.00, 80, '💧'),
('Juice',           'drinks',    20.00, 60, '🧃'),
('Chips',           'snacks',    20.00, 50, '🍟'),
('Biscuit',         'snacks',    15.00, 40, '🍪'),
('Junk Food Pack',  'junkfoods', 18.00, 45, '🍿'),
('Mixed Nuts',      'others',    35.00, 30, '🥜');

-- ════════════════════════════════════════════
--  9. CANTEEN — ORDERS
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS canteen_orders (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    order_no        VARCHAR(30) UNIQUE NOT NULL,
    customer_type   ENUM('member','visitor') NOT NULL DEFAULT 'visitor',
    member_id       INT NULL,
    member_user_id  VARCHAR(25) NULL,
    customer_name   VARCHAR(200) DEFAULT 'Walk-in Visitor',
    total           DECIMAL(10,2) NOT NULL,
    pay_mode        ENUM('cash','credit') DEFAULT 'cash',
    amount_paid     DECIMAL(10,2) DEFAULT 0,
    change_amount   DECIMAL(10,2) DEFAULT 0,
    status          ENUM('preparing','ready','done') DEFAULT 'preparing',
    placed_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    ready_at        DATETIME NULL,
    done_at         DATETIME NULL,
    credit_paid     TINYINT(1) DEFAULT 0,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL
);

-- ════════════════════════════════════════════
--  10. CANTEEN — ORDER ITEMS
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS canteen_order_items (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    order_id    INT NOT NULL,
    item_id     INT NULL,
    item_name   VARCHAR(150) NOT NULL,
    price       DECIMAL(8,2) NOT NULL,
    qty         INT NOT NULL,
    subtotal    DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES canteen_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id)  REFERENCES canteen_items(id)  ON DELETE SET NULL
);

-- ════════════════════════════════════════════
--  VIEWS
-- ════════════════════════════════════════════

-- Member summary with financial totals
CREATE OR REPLACE VIEW member_summary AS
SELECT
    m.id,
    m.application_no,
    m.user_id,
    m.username,
    m.status,
    CONCAT(COALESCE(m.first_name,''), ' ', COALESCE(m.middle_name,''), ' ', COALESCE(m.last_name,'')) AS full_name,
    m.submitted_at,
    m.approved_at,
    m.form_status,
    m.form_submitted_at,
    m.form_approved_at,
    COALESCE((SELECT SUM(CASE WHEN type='deposit' THEN amount ELSE -amount END) FROM shares  WHERE member_id = m.id), 0) AS total_shares,
    COALESCE((SELECT SUM(CASE WHEN type='deposit' THEN amount ELSE -amount END) FROM savings WHERE member_id = m.id), 0) AS total_savings,
    COALESCE((SELECT SUM(outstanding_balance) FROM loans WHERE member_id = m.id AND status='active'), 0)                 AS total_loan_balance
FROM members m;

-- Canteen daily sales summary
CREATE OR REPLACE VIEW canteen_daily_summary AS
SELECT
    DATE(placed_at)               AS order_date,
    COUNT(*)                      AS total_orders,
    SUM(total)                    AS gross_sales,
    SUM(CASE WHEN pay_mode='cash'   THEN total ELSE 0 END) AS cash_sales,
    SUM(CASE WHEN pay_mode='credit' THEN total ELSE 0 END) AS credit_sales,
    COUNT(CASE WHEN customer_type='member'  THEN 1 END) AS member_orders,
    COUNT(CASE WHEN customer_type='visitor' THEN 1 END) AS visitor_orders
FROM canteen_orders
WHERE status = 'done'
GROUP BY DATE(placed_at)
ORDER BY order_date DESC;

-- ════════════════════════════════════════════
--  DONE ✅
-- ════════════════════════════════════════════
-- Default Admin Credentials:
--   Username : admin
--   Password : admin123
--   ⚠️  Change password after first login!
-- ════════════════════════════════════════════
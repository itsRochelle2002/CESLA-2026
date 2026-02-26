# CLIMBS System — MySQL Setup Guide

## 1. INSTALL REQUIRED PACKAGES
```bash
npm install mysql2 bcrypt express-session
```

## 2. INSTALL & START MySQL
- Download: https://dev.mysql.com/downloads/installer/
- Or if using XAMPP → start Apache + MySQL

## 3. CREATE THE DATABASE
Open MySQL / phpMyAdmin and run:
```sql
-- Copy the full contents of database.sql and run it
```
Or via terminal:
```bash
mysql -u root -p < database.sql
```

## 4. UPDATE DB CREDENTIALS in server.js
```javascript
const db = mysql.createPool({
  host:     "localhost",
  user:     "root",       // ← your MySQL username
  password: "",           // ← your MySQL password
  database: "climbs_db",
});
```

## 5. DEFAULT ADMIN LOGIN
```
Username: admin
Password: admin123
```
⚠️ Change this after first login!

## 6. PROJECT FOLDER STRUCTURE
```
climbs-system/
├── views/
│   ├── index.ejs
│   ├── membership.ejs
│   ├── register.ejs
│   ├── member-application-form.ejs
│   ├── membership-login.ejs
│   ├── membership-dashboard.ejs
│   ├── membership-admin.ejs
│   ├── membership-admin-dashboard.ejs
│   └── ordering.ejs
├── public/
│   ├── css/style.css
│   ├── js/script.js
│   └── images/
│       ├── CESLA_logo.png
│       └── CLIMBS_Logo.png
├── database.sql     ← run this first!
├── server.js
└── package.json
```

## 7. HOW SHARES/SAVINGS/LOANS WORK
- **Admin** adds transactions via Admin Dashboard
- Data is stored in MySQL (shares, savings, loans, loan_payments tables)
- **Member** sees their data in the Member Dashboard automatically

## 8. API ENDPOINTS SUMMARY
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /membership/register/submit | Submit application |
| POST | /membership/login | Member login |
| GET  | /membership/dashboard/data | Member profile + totals |
| GET  | /membership/dashboard/shares | Share transactions |
| GET  | /membership/dashboard/savings | Savings transactions |
| GET  | /membership/dashboard/loans | Loan records |
| POST | /membership/admin/login | Admin login |
| GET  | /membership/admin/data | All members list |
| POST | /membership/admin/update-status | Approve/Reject |
| POST | /membership/admin/add-shares | Add share transaction |
| POST | /membership/admin/add-savings | Add savings transaction |
| POST | /membership/admin/add-loan | Add new loan |
| POST | /membership/admin/add-loan-payment | Record loan payment |


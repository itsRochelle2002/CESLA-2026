const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcrypt");
const mysql = require("mysql2/promise");
const path = require("path");

const app = express();
const PORT = 3000;

// ── DATABASE CONNECTION POOL ──────────────────
const db = mysql.createPool({
  host: "localhost",
  user: "root", // change to your MySQL user
  password: "", // change to your MySQL password
  database: "climbs_db",
  waitForConnections: true,
  connectionLimit: 10,
});

// ── MIDDLEWARE ────────────────────────────────
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(
  session({
    secret: "climbs-secret-2024",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 }, // 8 hours
  }),
);

// ── AUTH GUARDS ───────────────────────────────
function requireAdmin(req, res, next) {
  if (req.session?.isAdmin) return next();
  return res.status(401).json({ error: "Unauthorized" });
}
function requireAdminPage(req, res, next) {
  if (req.session?.isAdmin) return next();
  return res.redirect("/membership/admin");
}
function requireMember(req, res, next) {
  if (req.session?.memberId) return next();
  return res.status(401).json({ error: "Unauthorized" });
}
function requireMemberPage(req, res, next) {
  if (req.session?.memberId) return next();
  // Preserve ?from param so login knows where to redirect back
  const from = req.path.startsWith("/canteen") ? "?from=canteen" : "";
  return res.redirect(`/membership/login${from}`);
}

// ════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════
app.get("/", (req, res) => res.render("index"));
app.get("/ordering", (req, res) => res.render("ordering"));

// Canteen order page — requires member login, redirected from /membership/login?from=canteen
app.get("/canteen/order", requireMemberPage, (req, res) =>
  res.render("canteen-order"),
);

// Canteen order page — guest/visitor, no login required
app.get("/canteen/order/guest", (req, res) =>
  res.render("canteen-order-guest"),
);

// ════════════════════════════════════════════
//  MEMBERSHIP PAGES
// ════════════════════════════════════════════
app.get("/membership", (req, res) => res.render("membership"));
app.get("/membership/register", (req, res) => res.render("register"));
app.get("/membership/register/form", (req, res) =>
  res.render("member-application-form"),
);

// ── REGISTER (Step 1 — User ID + Password only) ──
app.post("/membership/register/submit", async (req, res) => {
  try {
    const { userId, password } = req.body;
    if (!userId || !password)
      return res.json({ success: false, message: "Missing required fields." });

    // Check duplicate user_id
    const [existUid] = await db.query(
      "SELECT id FROM members WHERE user_id = ?",
      [userId],
    );
    if (existUid.length > 0) {
      return res.json({
        success: false,
        message: "User ID already exists. Please refresh and try again.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const appNo = "APP-" + Date.now().toString().slice(-6);

    await db.query(
      `INSERT INTO members (application_no, user_id, password, status, form_status)
       VALUES (?, ?, ?, 'pending', 'incomplete')`,
      [appNo, userId, hashedPassword],
    );

    console.log(`✅ New registration: ${userId} (PENDING ADMIN APPROVAL)`);
    res.json({ success: true });
  } catch (err) {
    console.error("Register error:", err);
    res.json({ success: false, message: "Server error. Please try again." });
  }
});

// ── SUBMIT APPLICATION FORM (inside dashboard) ──
app.post(
  "/membership/dashboard/submit-form",
  requireMember,
  async (req, res) => {
    try {
      const d = req.body;
      const mid = req.session.memberId;

      // Check if already approved — cannot resubmit
      const [mem] = await db.query(
        "SELECT form_status FROM members WHERE id = ?",
        [mid],
      );
      if (mem[0]?.form_status === "approved") {
        return res.json({
          success: false,
          message:
            "Your application form is already approved and cannot be edited.",
        });
      }

      await db.query(
        `
      UPDATE members SET
        title=?, first_name=?, middle_name=?, last_name=?, suffix=?,
        gender=?, birthdate=?, place_of_birth=?, nationality=?, religion=?,
        civil_status=?, dependents=?, sss_number=?, tin_number=?,
        present_address=?, zip_code1=?, permanent_address=?, zip_code2=?,
        stay_years=?, stay_months=?,
        employer_name=?, office_address=?, employment_type=?, position=?, monthly_income=?,
        business_name=?, self_business_nature=?, asset_size=?, self_monthly_income=?,
        unemployed_type=?, referred_by=?,
        form_status='submitted', form_submitted_at=NOW()
      WHERE id=?`,
        [
          d.title || null,
          d.firstName || null,
          d.middleName || null,
          d.lastName || null,
          d.suffix || null,
          d.gender || null,
          d.birthdate || null,
          d.placeOfBirth || null,
          d.nationality || null,
          d.religion || null,
          d.civilStatus || null,
          d.dependents || 0,
          d.sssNumber || null,
          d.tinNumber || null,
          d.presentAddress || null,
          d.zipCode1 || null,
          d.permanentAddress || null,
          d.zipCode2 || null,
          d.stayYears || 0,
          d.stayMonths || 0,
          d.employerName || null,
          d.officeAddress || null,
          d.employmentType || null,
          d.position || null,
          d.monthlyIncome || 0,
          d.businessName || null,
          d.selfBusinessNature || null,
          d.assetSize || 0,
          d.selfMonthlyIncome || 0,
          d.unemployedType || null,
          d.referredBy || null,
          mid,
        ],
      );

      // Insert/replace family members
      await db.query("DELETE FROM family_members WHERE member_id=?", [mid]);
      const fam = d.familyMembers || [];
      for (const f of fam) {
        if (f.name)
          await db.query(
            "INSERT INTO family_members (member_id,name,relation,age,occupation) VALUES (?,?,?,?,?)",
            [
              mid,
              f.name,
              f.relation || null,
              f.age || null,
              f.occupation || null,
            ],
          );
      }

      console.log(`📋 Application form submitted by member ID: ${mid}`);
      res.json({ success: true });
    } catch (err) {
      console.error("Form submit error:", err);
      res.json({ success: false, message: "Server error." });
    }
  },
);

// ════════════════════════════════════════════
//  GENERATE UNIQUE USER ID
// ════════════════════════════════════════════
app.get("/membership/generate-userid", async (req, res) => {
  try {
    const yr = new Date().getFullYear();
    const [rows] = await db.query(
      "SELECT COUNT(*) AS cnt FROM members WHERE YEAR(submitted_at) = ?",
      [yr],
    );
    const seq = String((rows[0].cnt || 0) + 1).padStart(5, "0");
    const userId = `CESLA-${yr}-${seq}`;
    const [exists] = await db.query(
      "SELECT id FROM members WHERE user_id = ?",
      [userId],
    );
    if (exists.length > 0) {
      const rand = String(Math.floor(10000 + Math.random() * 89999));
      return res.json({ userId: `CESLA-${yr}-${rand}` });
    }
    res.json({ userId });
  } catch (e) {
    const yr = new Date().getFullYear();
    const rand = String(Math.floor(10000 + Math.random() * 89999));
    res.json({ userId: `CESLA-${yr}-${rand}` });
  }
});

// ════════════════════════════════════════════
//  MEMBER LOGIN & SESSION
// ════════════════════════════════════════════
app.get("/membership/login", (req, res) => {
  if (req.session?.memberId) return res.redirect("/membership/dashboard");
  res.render("membership-login");
});

app.post("/membership/login", async (req, res) => {
  try {
    const { userId, password } = req.body;
    const [rows] = await db.query("SELECT * FROM members WHERE user_id = ?", [
      userId,
    ]);
    if (!rows.length)
      return res.json({
        success: false,
        message: "Invalid User ID or password.",
      });

    const member = rows[0];
    const match = await bcrypt.compare(password, member.password);
    if (!match)
      return res.json({
        success: false,
        message: "Invalid User ID or password.",
      });
    if (member.status === "pending")
      return res.json({ success: false, pending: true });
    if (member.status === "rejected")
      return res.json({
        success: false,
        message: "Your application was rejected. Contact admin.",
      });

    req.session.memberId = member.id;
    req.session.memberUserId = member.user_id;
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Server error." });
  }
});

app.post("/membership/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ════════════════════════════════════════════
//  MEMBER DASHBOARD APIs
// ════════════════════════════════════════════
app.get("/membership/dashboard", requireMemberPage, (req, res) => {
  res.render("membership-dashboard");
});

// Get member profile + financial summary
app.get("/membership/dashboard/data", requireMember, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM member_summary WHERE id = ?", [
      req.session.memberId,
    ]);
    if (!rows.length) return res.status(404).json({ error: "Not found." });

    const [profile] = await db.query("SELECT * FROM members WHERE id = ?", [
      req.session.memberId,
    ]);
    const { password, ...safe } = profile[0];

    // Combine summary + profile
    res.json({ ...safe, ...rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

// Get shares transactions
app.get("/membership/dashboard/shares", requireMember, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM shares WHERE member_id = ? ORDER BY transaction_date DESC",
      [req.session.memberId],
    );
    res.json(rows);
  } catch (err) {
    res.json([]);
  }
});

// Get savings transactions
app.get("/membership/dashboard/savings", requireMember, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM savings WHERE member_id = ? ORDER BY transaction_date DESC",
      [req.session.memberId],
    );
    res.json(rows);
  } catch (err) {
    res.json([]);
  }
});

// Get loans
app.get("/membership/dashboard/loans", requireMember, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM loans WHERE member_id = ? ORDER BY date_released DESC",
      [req.session.memberId],
    );
    res.json(rows);
  } catch (err) {
    res.json([]);
  }
});

// Get loan payments
app.get(
  "/membership/dashboard/loan-payments/:loanId",
  requireMember,
  async (req, res) => {
    try {
      const [rows] = await db.query(
        "SELECT * FROM loan_payments WHERE loan_id = ? AND member_id = ? ORDER BY payment_date DESC",
        [req.params.loanId, req.session.memberId],
      );
      res.json(rows);
    } catch (err) {
      res.json([]);
    }
  },
);

// Update profile
// ── UPLOAD PROFILE PHOTO ──────────────────────
app.post(
  "/membership/dashboard/upload-photo",
  requireMember,
  async (req, res) => {
    try {
      const { photo } = req.body;
      if (!photo || !photo.startsWith("data:image/")) {
        return res.json({ success: false, message: "Invalid image data." });
      }
      // Store base64 directly in DB (or you can save to disk and store path)
      await db.query("UPDATE members SET profile_photo = ? WHERE id = ?", [
        photo,
        req.session.memberId,
      ]);
      res.json({ success: true });
    } catch (err) {
      console.error("Photo upload error:", err);
      res.json({ success: false, message: "Server error." });
    }
  },
);

app.post("/membership/dashboard/update", requireMember, async (req, res) => {
  try {
    const allowed = [
      "first_name",
      "middle_name",
      "last_name",
      "suffix",
      "birthdate",
      "place_of_birth",
      "gender",
      "nationality",
      "religion",
      "civil_status",
      "dependents",
      "sss_number",
      "tin_number",
    ];
    const updates = {};
    // Map camelCase from frontend to snake_case DB
    const map = {
      firstName: "first_name",
      middleName: "middle_name",
      lastName: "last_name",
      suffix: "suffix",
      birthdate: "birthdate",
      placeOfBirth: "place_of_birth",
      gender: "gender",
      nationality: "nationality",
      religion: "religion",
      civilStatus: "civil_status",
      dependents: "dependents",
      sssNumber: "sss_number",
      tinNumber: "tin_number",
    };
    Object.entries(req.body).forEach(([k, v]) => {
      if (map[k]) updates[map[k]] = v;
    });
    if (!Object.keys(updates).length) return res.json({ success: false });
    const fields = Object.keys(updates)
      .map((k) => `${k} = ?`)
      .join(", ");
    const values = [...Object.values(updates), req.session.memberId];
    await db.query(`UPDATE members SET ${fields} WHERE id = ?`, values);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
});

// Change password
app.post(
  "/membership/dashboard/change-password",
  requireMember,
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const [rows] = await db.query(
        "SELECT password FROM members WHERE id = ?",
        [req.session.memberId],
      );
      if (!rows.length) return res.json({ success: false });

      const match = await bcrypt.compare(currentPassword, rows[0].password);
      if (!match)
        return res.json({
          success: false,
          message: "Incorrect current password.",
        });

      const hashed = await bcrypt.hash(newPassword, 10);
      await db.query("UPDATE members SET password = ? WHERE id = ?", [
        hashed,
        req.session.memberId,
      ]);
      res.json({ success: true });
    } catch (err) {
      res.json({ success: false });
    }
  },
);

// ════════════════════════════════════════════
//  ADMIN ROUTES
// ════════════════════════════════════════════
app.get("/membership/admin", (req, res) => {
  if (req.session?.isAdmin) {
    const redirectTo =
      req.query.from === "canteen"
        ? "/canteen/admin"
        : "/membership/admin/dashboard";
    return res.redirect(redirectTo);
  }
  res.render("membership-admin");
});

app.post("/membership/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const [rows] = await db.query("SELECT * FROM admins WHERE username = ?", [
      username,
    ]);
    if (!rows.length) return res.json({ success: false });
    const match = await bcrypt.compare(password, rows[0].password);
    if (!match) return res.json({ success: false });
    req.session.isAdmin = true;
    req.session.adminName = rows[0].full_name;
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false });
  }
});

app.post("/membership/admin/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get("/membership/admin/dashboard", requireAdminPage, (req, res) => {
  res.render("membership-admin-dashboard");
});

// Get all members for admin
app.get("/membership/admin/data", requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT ms.*, m.form_status, m.form_submitted_at, m.form_approved_at, m.user_id
      FROM member_summary ms
      JOIN members m ON ms.id = m.id
      ORDER BY ms.submitted_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.json([]);
  }
});

// Get full member detail for admin (view application form)
app.get("/membership/admin/member/:id", requireAdmin, async (req, res) => {
  try {
    const [member] = await db.query("SELECT * FROM members WHERE id = ?", [
      req.params.id,
    ]);
    const [family] = await db.query(
      "SELECT * FROM family_members WHERE member_id = ?",
      [req.params.id],
    );
    if (!member.length) return res.json({ error: "Not found." });
    const { password, ...safe } = member[0];
    res.json({ ...safe, familyMembers: family });
  } catch (err) {
    res.json({ error: "Server error." });
  }
});

// Update member status
app.post("/membership/admin/update-status", requireAdmin, async (req, res) => {
  try {
    const { id, status } = req.body;
    const col = status === "approved" ? "approved_at" : "rejected_at";
    await db.query(
      `UPDATE members SET status = ?, ${col} = NOW() WHERE id = ?`,
      [status, id],
    );
    console.log(`🔔 Member ID ${id} → ${status.toUpperCase()}`);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false });
  }
});

// ── ADMIN: APPROVE / REJECT APPLICATION FORM ──
app.post("/membership/admin/approve-form", requireAdmin, async (req, res) => {
  try {
    const { id, action } = req.body; // action = 'approve' | 'reject'
    if (action === "approve") {
      await db.query(
        "UPDATE members SET form_status='approved', form_approved_at=NOW() WHERE id=?",
        [id],
      );
    } else {
      await db.query(
        "UPDATE members SET form_status='incomplete', form_submitted_at=NULL WHERE id=?",
        [id],
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false });
  }
});

// ── ADMIN: GET MEMBER FORM DATA ────────────────
app.get("/membership/admin/member-form/:id", requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM members WHERE id=?", [
      req.params.id,
    ]);
    if (!rows.length) return res.json({ error: "Not found" });
    const { password, ...safe } = rows[0];
    const [family] = await db.query(
      "SELECT * FROM family_members WHERE member_id=?",
      [req.params.id],
    );
    res.json({ ...safe, familyMembers: family });
  } catch (err) {
    res.json({ error: "Server error" });
  }
});

// ── ADMIN: ADD SHARES TRANSACTION ─────────────
app.post("/membership/admin/add-shares", requireAdmin, async (req, res) => {
  try {
    const {
      member_id,
      transaction_date,
      type,
      description,
      amount,
      or_number,
    } = req.body;

    // Get current balance
    const [bal] = await db.query(
      "SELECT COALESCE(SUM(CASE WHEN type='deposit' THEN amount ELSE -amount END),0) AS balance FROM shares WHERE member_id=?",
      [member_id],
    );
    const currentBalance = parseFloat(bal[0].balance);
    const newBalance =
      type === "deposit"
        ? currentBalance + parseFloat(amount)
        : currentBalance - parseFloat(amount);

    if (newBalance < 0)
      return res.json({
        success: false,
        message: "Insufficient share balance.",
      });

    await db.query(
      "INSERT INTO shares (member_id,transaction_date,type,description,amount,balance,or_number,encoded_by) VALUES (?,?,?,?,?,?,?,?)",
      [
        member_id,
        transaction_date,
        type,
        description || null,
        amount,
        newBalance,
        or_number || null,
        req.session.adminName || "admin",
      ],
    );
    res.json({ success: true, newBalance });
  } catch (err) {
    res.json({ success: false });
  }
});

// ── ADMIN: ADD SAVINGS TRANSACTION ────────────
app.post("/membership/admin/add-savings", requireAdmin, async (req, res) => {
  try {
    const {
      member_id,
      transaction_date,
      type,
      description,
      amount,
      or_number,
    } = req.body;

    const [bal] = await db.query(
      "SELECT COALESCE(SUM(CASE WHEN type='deposit' THEN amount ELSE -amount END),0) AS balance FROM savings WHERE member_id=?",
      [member_id],
    );
    const currentBalance = parseFloat(bal[0].balance);
    const newBalance =
      type === "deposit"
        ? currentBalance + parseFloat(amount)
        : currentBalance - parseFloat(amount);

    if (newBalance < 0)
      return res.json({
        success: false,
        message: "Insufficient savings balance.",
      });

    await db.query(
      "INSERT INTO savings (member_id,transaction_date,type,description,amount,balance,or_number,encoded_by) VALUES (?,?,?,?,?,?,?,?)",
      [
        member_id,
        transaction_date,
        type,
        description || null,
        amount,
        newBalance,
        or_number || null,
        req.session.adminName || "admin",
      ],
    );
    res.json({ success: true, newBalance });
  } catch (err) {
    res.json({ success: false });
  }
});

// ── ADMIN: ADD LOAN ────────────────────────────
app.post("/membership/admin/add-loan", requireAdmin, async (req, res) => {
  try {
    const {
      member_id,
      loan_type,
      amount,
      interest_rate,
      term_months,
      date_released,
      purpose,
    } = req.body;

    const monthlyPayment =
      (parseFloat(amount) * (1 + parseFloat(interest_rate) / 100)) /
      parseInt(term_months);
    const dueDate = new Date(date_released);
    dueDate.setMonth(dueDate.getMonth() + parseInt(term_months));
    const loanNo = "LN-" + Date.now().toString().slice(-8);

    await db.query(
      `INSERT INTO loans (member_id,loan_no,loan_type,amount,interest_rate,term_months,
       monthly_payment,date_released,due_date,outstanding_balance,purpose,encoded_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        member_id,
        loanNo,
        loan_type,
        amount,
        interest_rate || 0,
        term_months,
        monthlyPayment.toFixed(2),
        date_released,
        dueDate.toISOString().split("T")[0],
        amount,
        purpose || null,
        req.session.adminName || "admin",
      ],
    );
    res.json({ success: true, loanNo });
  } catch (err) {
    res.json({ success: false });
  }
});

// ── ADMIN: GET ALL SHARES ─────────────────────
app.get("/membership/admin/all-shares", requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT s.*, m.username,
        CONCAT(m.first_name,' ',COALESCE(m.middle_name,''),' ',m.last_name) AS full_name
      FROM shares s
      JOIN members m ON s.member_id = m.id
      ORDER BY s.transaction_date DESC
    `);
    res.json(rows);
  } catch (e) {
    res.json([]);
  }
});

// ── ADMIN: GET ALL SAVINGS ────────────────────
app.get("/membership/admin/all-savings", requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT s.*, m.username,
        CONCAT(m.first_name,' ',COALESCE(m.middle_name,''),' ',m.last_name) AS full_name
      FROM savings s
      JOIN members m ON s.member_id = m.id
      ORDER BY s.transaction_date DESC
    `);
    res.json(rows);
  } catch (e) {
    res.json([]);
  }
});

// ── ADMIN: GET ALL LOANS ──────────────────────
app.get("/membership/admin/all-loans", requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT l.*, m.username,
        CONCAT(m.first_name,' ',COALESCE(m.middle_name,''),' ',m.last_name) AS full_name
      FROM loans l
      JOIN members m ON l.member_id = m.id
      ORDER BY l.date_released DESC
    `);
    res.json(rows);
  } catch (e) {
    res.json([]);
  }
});

// ── ADMIN: ADD LOAN PAYMENT ────────────────────
app.post(
  "/membership/admin/add-loan-payment",
  requireAdmin,
  async (req, res) => {
    try {
      const {
        loan_id,
        member_id,
        payment_date,
        amount_paid,
        principal,
        interest,
        or_number,
      } = req.body;

      // Get current outstanding balance
      const [loan] = await db.query(
        "SELECT outstanding_balance FROM loans WHERE id=?",
        [loan_id],
      );
      if (!loan.length)
        return res.json({ success: false, message: "Loan not found." });

      const remaining =
        parseFloat(loan[0].outstanding_balance) -
        parseFloat(principal || amount_paid);

      await db.query(
        `INSERT INTO loan_payments (loan_id,member_id,payment_date,amount_paid,principal,interest,remaining_balance,or_number,encoded_by)
       VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          loan_id,
          member_id,
          payment_date,
          amount_paid,
          principal || 0,
          interest || 0,
          Math.max(remaining, 0),
          or_number || null,
          req.session.adminName || "admin",
        ],
      );

      // Update loan outstanding balance
      const newStatus = remaining <= 0 ? "paid" : "active";
      await db.query(
        "UPDATE loans SET outstanding_balance=?, status=? WHERE id=?",
        [Math.max(remaining, 0), newStatus, loan_id],
      );
      res.json({ success: true });
    } catch (err) {
      res.json({ success: false });
    }
  },
);

// ── START ──────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Server running  → http://localhost:${PORT}`);
  console.log(`🗄️  Database        → climbs_db (MySQL)`);
  console.log(`🔐 Admin Login     → /membership/admin\n`);
});

// ════════════════════════════════════════════
//  CANTEEN ORDERING API  (MySQL DB)
// ════════════════════════════════════════════

function genOrderNo() {
  const ts = Date.now().toString().slice(-6);
  const rand = String(Math.floor(Math.random() * 900) + 100);
  return `ORD-${ts}-${rand}`;
}

// GET /canteen/api/items — fetch menu items from DB
app.get("/canteen/api/items", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM canteen_items WHERE is_available = 1 ORDER BY category, name",
    );
    res.json(rows);
  } catch (err) {
    res.json([]);
  }
});

// POST /canteen/api/order — place a new order
app.post("/canteen/api/order", async (req, res) => {
  try {
    const { items, total, payMode, amountPaid, change, customerType } =
      req.body;
    if (!items || !items.length)
      return res.json({ success: false, message: "Empty order." });

    const orderNo = genOrderNo();
    const memberId = req.session?.memberId || null;
    const memberUserId = req.session?.memberUserId || null;
    const custName =
      customerType === "member" ? memberUserId || "Member" : "Walk-in Visitor";

    const [result] = await db.query(
      `INSERT INTO canteen_orders (order_no, customer_type, member_id, member_user_id, customer_name, total, pay_mode, amount_paid, change_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'preparing')`,
      [
        orderNo,
        customerType || "visitor",
        memberId,
        memberUserId,
        custName,
        total,
        payMode || "cash",
        amountPaid || total,
        change || 0,
      ],
    );
    const orderId = result.insertId;

    // Insert order items
    for (const item of items) {
      await db.query(
        "INSERT INTO canteen_order_items (order_id, item_id, item_name, price, qty, subtotal) VALUES (?, ?, ?, ?, ?, ?)",
        [
          orderId,
          item.id || null,
          item.name,
          item.price,
          item.qty,
          item.price * item.qty,
        ],
      );
      // Deduct stock
      if (item.id)
        await db.query(
          "UPDATE canteen_items SET stock = GREATEST(stock - ?, 0) WHERE id = ?",
          [item.qty, item.id],
        );
    }

    console.log(`🍽️  New order ${orderNo} by ${custName} — ₱${total}`);
    res.json({ success: true, orderId: orderNo });
  } catch (err) {
    console.error("Order error:", err);
    res.json({ success: false, message: "Server error." });
  }
});

// GET /canteen/api/order/:id/status — user polls their order status
app.get("/canteen/api/order/:id/status", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT order_no, status FROM canteen_orders WHERE order_no = ?",
      [req.params.id],
    );
    if (!rows.length) return res.json({ found: false });
    res.json({ found: true, status: rows[0].status, id: rows[0].order_no });
  } catch (err) {
    res.json({ found: false });
  }
});

// GET /canteen/api/orders/pending — admin polls all active orders
app.get("/canteen/api/orders/pending", requireAdmin, async (req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT * FROM canteen_orders WHERE status != 'done' ORDER BY placed_at ASC`,
    );
    for (const order of orders) {
      const [items] = await db.query(
        "SELECT * FROM canteen_order_items WHERE order_id = ?",
        [order.id],
      );
      order.items = items;
      order.placedAt = order.placed_at;
      order.customerName = order.customer_name;
      order.customerType = order.customer_type;
      order.payMode = order.pay_mode;
      order.id = order.order_no;
    }
    res.json(orders);
  } catch (err) {
    res.json([]);
  }
});

// POST /canteen/api/order/:id/ready — admin marks as ready
app.post("/canteen/api/order/:id/ready", requireAdmin, async (req, res) => {
  try {
    await db.query(
      `UPDATE canteen_orders SET status='ready', ready_at=NOW() WHERE order_no=?`,
      [req.params.id],
    );
    console.log(`✅ Order ${req.params.id} → READY FOR PICKUP`);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false });
  }
});

// POST /canteen/api/order/:id/done — admin marks as done/claimed
app.post("/canteen/api/order/:id/done", requireAdmin, async (req, res) => {
  try {
    await db.query(
      `UPDATE canteen_orders SET status='done', done_at=NOW() WHERE order_no=?`,
      [req.params.id],
    );
    console.log(`🏁 Order ${req.params.id} → DONE/CLAIMED`);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false });
  }
});

// Canteen admin monitor page
app.get("/canteen/admin", requireAdminPage, (req, res) =>
  res.render("canteen-admin"),
);

// ── CANTEEN ITEM MANAGEMENT ──────────────────
app.post("/canteen/api/items", requireAdmin, async (req, res) => {
  try {
    const { name, category, price, stock, emoji } = req.body;
    await db.query(
      "INSERT INTO canteen_items (name,category,price,stock,emoji) VALUES (?,?,?,?,?)",
      [name, category, price, stock || 0, emoji || "🍽️"],
    );
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false });
  }
});

app.post("/canteen/api/items/:id/toggle", requireAdmin, async (req, res) => {
  try {
    await db.query("UPDATE canteen_items SET is_available=? WHERE id=?", [
      req.body.is_available,
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false });
  }
});

app.post("/canteen/api/items/:id/restock", requireAdmin, async (req, res) => {
  try {
    await db.query("UPDATE canteen_items SET stock = stock + ? WHERE id=?", [
      req.body.qty,
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false });
  }
});

app.delete("/canteen/api/items/:id", requireAdmin, async (req, res) => {
  try {
    await db.query("UPDATE canteen_items SET is_available=0 WHERE id=?", [
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false });
  }
});

// ── ORDER HISTORY ────────────────────────────
app.get("/canteen/api/orders/history", requireAdmin, async (req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT * FROM canteen_orders ORDER BY placed_at DESC LIMIT 200`,
    );
    for (const o of orders) {
      const [items] = await db.query(
        "SELECT * FROM canteen_order_items WHERE order_id=?",
        [o.id],
      );
      o.items = items;
    }
    res.json(orders);
  } catch (e) {
    res.json([]);
  }
});

// ── CREDIT ORDERS ─────────────────────────────
app.get("/canteen/api/orders/credits", requireAdmin, async (req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT * FROM canteen_orders WHERE pay_mode='credit' ORDER BY placed_at DESC`,
    );
    res.json(orders);
  } catch (e) {
    res.json([]);
  }
});

// ── DAILY REPORTS ─────────────────────────────
app.get("/canteen/api/reports/daily", requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM canteen_daily_summary LIMIT 30`,
    );
    const [today] = await db.query(
      `SELECT * FROM canteen_daily_summary WHERE order_date = CURDATE() LIMIT 1`,
    );
    res.json({ rows, today: today[0] || null });
  } catch (e) {
    res.json({ rows: [], today: null });
  }
});

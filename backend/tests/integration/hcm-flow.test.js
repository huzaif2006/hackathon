const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

process.env.JWT_SECRET = "integration-test-secret-with-sufficient-entropy";
process.env.AI_API_KEY = "integration-test-only";

const app = require("../../src/app");
const aiService = require("../../src/services/ai.service");
const Attendance = require("../../src/models/attendance.model");
const AiLog = require("../../src/models/ai-log.model");
const AiRateLimit = require("../../src/models/ai-rate-limit.model");
const AuditLog = require("../../src/models/audit-log.model");
const Company = require("../../src/models/company.model");
const Employee = require("../../src/models/employee.model");
const Holiday = require("../../src/models/holiday.model");
const LeaveRequest = require("../../src/models/leave-request.model");
const PayrollItem = require("../../src/models/payroll-item.model");
const PayrollRun = require("../../src/models/payroll-run.model");
const { calculateAnnualTax } = require("../../src/services/payroll.service");
const User = require("../../src/models/user.model");

let replicaSet;

before(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGO_URI = replicaSet.getUri();
});

after(async () => {
  aiService.setGeminiClientFactoryForTests((apiKey) => {
    const { GoogleGenAI } = require("@google/genai");
    return new GoogleGenAI({ apiKey });
  });
  await mongoose.disconnect();
  if (replicaSet) await replicaSet.stop();
});

function nextDate(dateKey, days = 1) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekday(dateKey) {
  return new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
}

function nextMonday(dateKey) {
  let cursor = dateKey;
  do {
    cursor = nextDate(cursor);
  } while (weekday(cursor) !== 1);
  return cursor;
}

function localToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

async function login(email, password) {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ email, password })
    .expect(200);
  return response.body;
}

function withToken(token) {
  return { Authorization: `Bearer ${token}` };
}

test("fresh MongoDB replica-set flow covers organization, roles, attendance, leave, payroll, dashboards, CSV, AI and audit", async (t) => {
  const today = localToday();
  const monday = nextMonday(today);
  const tuesday = nextDate(monday);
  const friday = nextDate(monday, 4);
  const holidayDate = tuesday;
  const leaveStart = monday;
  const leaveEnd = friday;
  let aiResponses = [];

  aiService.setGeminiClientFactoryForTests(() => ({
    models: {
      generateContent: async () => {
        const next = aiResponses.shift();
        if (!next) throw new Error("Unexpected Gemini mock call");
        return {
          text: typeof next === "string" ? next : "",
          candidates: [
            {
              content: {
                parts: typeof next === "string" ? [{ text: next }] : [next],
              },
            },
          ],
        };
      },
    },
  }));

  await t.test("setup and organization administration", async () => {
    await request(app)
      .options("/api/setup")
      .set("Origin", "https://hcm-lite-preview.vercel.app")
      .set("Access-Control-Request-Method", "POST")
      .expect(
        "Access-Control-Allow-Origin",
        "https://hcm-lite-preview.vercel.app",
      )
      .expect(204);
    assert.deepEqual(
      (await request(app).get("/api/setup/status").expect(200)).body,
      { setupComplete: false },
    );
    await request(app)
      .post("/api/setup")
      .send({
        companyName: "Integration HCM",
        name: "Admin",
        email: "admin@example.test",
        password: "Admin-password-123",
      })
      .expect(201);
    assert.equal(
      (await request(app).get("/api/setup/status").expect(200)).body
        .setupComplete,
      true,
    );

    const admin = await login("admin@example.test", "Admin-password-123");
    t.context = { adminToken: admin.token };
    const auth = withToken(admin.token);
    await request(app)
      .post("/api/announcements")
      .set(auth)
      .send({
        title: "Integration notice",
        message: "Demo announcement",
      })
      .expect(201);
    const settings = {
      name: "Integration HCM",
      officeStart: "00:00",
      graceMinutes: 0,
      halfDayHours: 5,
      weekend: ["Sat", "Sun"],
      latitude: null,
      longitude: null,
      radiusMeters: 150,
      timezone: "Asia/Karachi",
    };
    await request(app)
      .put("/api/organization/company")
      .set(auth)
      .send(settings)
      .expect(200);

    const department = await request(app)
      .post("/api/organization/departments")
      .set(auth)
      .send({ name: "Engineering" })
      .expect(201);
    await request(app)
      .post("/api/organization/departments")
      .set(auth)
      .send({ name: "Engineering" })
      .expect(409);
    const designation = await request(app)
      .post("/api/organization/designations")
      .set(auth)
      .send({ name: "Engineer" })
      .expect(201);
    const annual = await request(app)
      .post("/api/organization/leave-types")
      .set(auth)
      .send({
        name: "Annual",
        yearlyQuota: 14,
        isUnlimited: false,
        isPaid: true,
      })
      .expect(201);
    const sick = await request(app)
      .post("/api/organization/leave-types")
      .set(auth)
      .send({
        name: "Sick",
        yearlyQuota: 8,
        isUnlimited: false,
        isPaid: true,
      })
      .expect(201);
    const casual = await request(app)
      .post("/api/organization/leave-types")
      .set(auth)
      .send({
        name: "Casual",
        yearlyQuota: 10,
        isUnlimited: false,
        isPaid: true,
      })
      .expect(201);
    await request(app)
      .post("/api/organization/leave-types")
      .set(auth)
      .send({
        name: "Unpaid",
        yearlyQuota: 0,
        isUnlimited: true,
        isPaid: false,
      })
      .expect(201);
    await request(app)
      .post("/api/organization/holidays")
      .set(auth)
      .send({
        date: holidayDate,
        name: "Integration holiday",
      })
      .expect(201);
    const hr = await request(app)
      .post("/api/organization/hr-users")
      .set(auth)
      .send({
        name: "HR User",
        email: "hr@example.test",
      })
      .expect(201);
    assert.ok(hr.body.temporaryPassword);
    assert.equal(hr.body.user.mustChangePassword, true);
    assert.equal(JSON.stringify(hr.body).includes("passwordHash"), false);
    await request(app)
      .get("/api/organization/departments")
      .set(auth)
      .expect(200);
    await request(app).get("/api/organization/hr-users").set(auth).expect(200);
    await request(app).get("/api/audit-logs").set(auth).expect(200);
    assert.ok(department.body.item._id);
    assert.ok(designation.body.item._id);
    assert.ok(
      annual.body.item._id && sick.body.item._id && casual.body.item._id,
    );
    t.context.departmentId = department.body.item._id;
    t.context.designationId = designation.body.item._id;
    t.context.annualId = annual.body.item._id;
    t.context.hrTemporaryPassword = hr.body.temporaryPassword;
    t.context.hrId = hr.body.user.id;
  });

  await t.test(
    "HR and employee first-login password change and transactional registration",
    async () => {
      const hrLogin = await login(
        "hr@example.test",
        t.context.hrTemporaryPassword,
      );
      await request(app)
        .get("/api/organization/departments")
        .set(withToken(hrLogin.token))
        .expect(403);
      const changed = await request(app)
        .post("/api/auth/change-password")
        .set(withToken(hrLogin.token))
        .send({
          currentPassword: t.context.hrTemporaryPassword,
          newPassword: "Hr-new-password-123",
        })
        .expect(200);
      const hr = await login("hr@example.test", "Hr-new-password-123");
      await request(app)
        .get("/api/organization/departments")
        .set(withToken(hrLogin.token))
        .expect(401);
      t.context.hrToken = hr.token;
      assert.equal(changed.body.user.mustChangePassword, false);

      const createEmployee = async (code, name, email) =>
        request(app)
          .post("/api/employees")
          .set(withToken(hr.token))
          .send({
            code,
            name,
            email,
            phone: "",
            address: "",
            gender: "other",
            department: t.context.departmentId,
            designation: t.context.designationId,
            joinDate: "2020-01-01",
            status: "active",
            basicSalary: 100000,
          })
          .expect(201);
      const one = await createEmployee(
        "E001",
        "Employee One",
        "one@example.test",
      );
      const two = await createEmployee(
        "E002",
        "Employee Two",
        "two@example.test",
      );
      assert.ok(one.body.temporaryPassword && two.body.temporaryPassword);
      assert.equal(one.body.user.mustChangePassword, true);
      t.context.employeeOneId = one.body.employee._id;
      t.context.employeeTwoId = two.body.employee._id;
      await request(app)
        .put(`/api/employees/${t.context.employeeOneId}`)
        .set(withToken(hr.token))
        .send({ basicSalary: 120000 })
        .expect(200);

      for (const [email, temporaryPassword, newPassword, key] of [
        [
          "one@example.test",
          one.body.temporaryPassword,
          "Employee-one-new-123",
          "employeeOneToken",
        ],
        [
          "two@example.test",
          two.body.temporaryPassword,
          "Employee-two-new-123",
          "employeeTwoToken",
        ],
      ]) {
        const firstLogin = await login(email, temporaryPassword);
        await request(app)
          .get("/api/dashboard/employee")
          .set(withToken(firstLogin.token))
          .expect(403);
        await request(app)
          .post("/api/auth/change-password")
          .set(withToken(firstLogin.token))
          .send({ currentPassword: temporaryPassword, newPassword })
          .expect(200);
        t.context[key] = (await login(email, newPassword)).token;
        await request(app)
          .get("/api/dashboard/employee")
          .set(withToken(firstLogin.token))
          .expect(401);
      }
      assert.equal(await Employee.countDocuments(), 2);
      assert.equal(await User.countDocuments({ role: "employee" }), 2);
    },
  );

  await t.test(
    "server-stamped attendance, duplicate rejection and correction approval",
    async () => {
      const employeeAuth = withToken(t.context.employeeOneToken);
      const requestStartedAt = Date.now();
      const first = await request(app)
        .post("/api/attendance/check-in")
        .set(employeeAuth)
        .send({ checkIn: "1900-01-01T00:00:00.000Z" })
        .expect(201);
      assert.equal(first.body.attendance.date, today);
      assert.ok(
        Math.abs(
          new Date(first.body.attendance.checkIn).getTime() - requestStartedAt,
        ) < 5000,
      );
      assert.equal(first.body.attendance.status, "late");
      await request(app)
        .post("/api/attendance/check-in")
        .set(employeeAuth)
        .send({})
        .expect(409);
      const checkedOut = await request(app)
        .post("/api/attendance/check-out")
        .set(employeeAuth)
        .send({})
        .expect(200);
      assert.equal(checkedOut.body.attendance.status, "half_day");
      assert.ok(checkedOut.body.attendance.checkIn);
      const correction = await request(app)
        .post("/api/attendance/corrections")
        .set(employeeAuth)
        .send({
          date: today,
          requestedCheckIn: "09:00",
          requestedCheckOut: "10:00",
          reason: "Correct recorded times",
        })
        .expect(201);
      const hrAuth = withToken(t.context.hrToken);
      await request(app)
        .post(
          `/api/attendance/corrections/${correction.body.correction._id}/approve`,
        )
        .set(hrAuth)
        .send({ comment: "Approved" })
        .expect(200);
      const dayRecord = await Attendance.findOne({
        employee: t.context.employeeOneId,
        date: today,
      });
      assert.equal(dayRecord.status, "half_day");
      await request(app)
        .post(
          `/api/attendance/corrections/${correction.body.correction._id}/reject`,
        )
        .set(hrAuth)
        .send({ comment: "Already decided" })
        .expect(409);
      t.context.attendanceId = dayRecord.id;
    },
  );

  await t.test(
    "leave working-day calculation, overlap, quota, approval and notification",
    async () => {
      const employeeAuth = withToken(t.context.employeeTwoToken);
      const applied = await request(app)
        .post("/api/leave")
        .set(employeeAuth)
        .send({
          leaveType: t.context.annualId,
          startDate: leaveStart,
          endDate: leaveEnd,
          reason: "Family matters",
        })
        .expect(201);
      assert.equal(applied.body.leaveRequest.days, 4);
      await request(app)
        .post("/api/leave")
        .set(employeeAuth)
        .send({
          leaveType: t.context.annualId,
          startDate: leaveStart,
          endDate: leaveEnd,
          reason: "Overlapping request",
        })
        .expect(422);

      let longEnd = `${new Date().getUTCFullYear()}-01-01`;
      for (let index = 0; index < 40; index += 1) {
        if (weekday(longEnd) !== 0 && weekday(longEnd) !== 6) {
          const count = Array.from(
            {
              length:
                Math.floor(
                  (new Date(`${longEnd}T00:00:00.000Z`) -
                    new Date(
                      `${new Date().getUTCFullYear()}-01-01T00:00:00.000Z`,
                    )) /
                    86400000,
                ) + 1,
            },
            (_, day) => {
              const key = nextDate(`${new Date().getUTCFullYear()}-01-01`, day);
              return (
                weekday(key) !== 0 && weekday(key) !== 6 && key !== holidayDate
              );
            },
          ).filter(Boolean).length;
          if (count > 14) break;
        }
        longEnd = nextDate(longEnd);
      }
      await request(app)
        .post("/api/leave")
        .set(withToken(t.context.employeeOneToken))
        .send({
          leaveType: t.context.annualId,
          startDate: `${new Date().getUTCFullYear()}-01-01`,
          endDate: longEnd,
          reason: "Over quota test",
        })
        .expect(422);

      await request(app)
        .post(`/api/leave/${applied.body.leaveRequest._id}/approve`)
        .set(withToken(t.context.hrToken))
        .send({ comment: "Approved" })
        .expect(200);
      const balance = await request(app)
        .get("/api/leave/balance")
        .set(employeeAuth)
        .expect(200);
      const annualBalance = balance.body.balances.find(
        (entry) => entry.leaveType.id === t.context.annualId,
      );
      assert.equal(annualBalance.used, 4);
      assert.equal(annualBalance.remaining, 10);
      const board = await request(app)
        .get("/api/attendance/board")
        .set(withToken(t.context.hrToken))
        .query({ date: leaveStart })
        .expect(200);
      assert.equal(
        board.body.items.find(
          (item) => item.employee.id === t.context.employeeTwoId,
        ).status,
        "on_leave",
      );
      assert.equal(
        (
          await request(app)
            .get("/api/attendance/my")
            .set(employeeAuth)
            .query({ month: leaveStart.slice(0, 7) })
            .expect(200)
        ).body.days.find((day) => day.date === leaveStart).status,
        "on_leave",
      );
      assert.equal(
        await LeaveRequest.countDocuments({ status: "approved" }),
        1,
      );
      t.context.leaveId = applied.body.leaveRequest._id;
    },
  );

  await t.test(
    "payroll lock, role restrictions, payslip scope, notifications and dashboards",
    async () => {
      const hrAuth = withToken(t.context.hrToken);
      const adminAuth = withToken(t.context.adminToken);
      const month = today.slice(0, 7);
      const draft = await request(app)
        .post("/api/payroll/runs")
        .set(hrAuth)
        .send({ month })
        .expect(201);
      const draftItems = await PayrollItem.find({
        run: draft.body.run.id,
      }).lean();
      for (const item of draftItems) {
        assert.ok(Math.abs(item.hra - item.basic * 0.4) < 0.01);
        assert.ok(Math.abs(item.medical - item.basic * 0.1) < 0.01);
        assert.ok(Math.abs(item.gross - item.basic * 1.5) < 0.01);
        assert.equal(item.annualTax, calculateAnnualTax(item.gross * 12));
        assert.ok(
          Math.abs(
            item.deduction -
              (item.absentDays + item.unpaidLeaveDays + 0.5 * item.halfDays) *
                (item.gross / item.workingDays),
          ) < 0.01,
        );
        assert.ok(
          Math.abs(
            item.netPay - (item.gross - item.deduction - item.monthlyTax),
          ) < 0.01,
        );
      }
      await request(app)
        .post("/api/payroll/runs")
        .set(hrAuth)
        .send({ month })
        .expect(409);
      await request(app)
        .post(`/api/payroll/runs/${draft.body.run.id}/regenerate`)
        .set(hrAuth)
        .send({})
        .expect(200);
      await request(app)
        .post(`/api/payroll/runs/${draft.body.run.id}/finalize`)
        .set(hrAuth)
        .send({})
        .expect(403);
      await request(app)
        .post(`/api/payroll/runs/${draft.body.run.id}/finalize`)
        .set(adminAuth)
        .send({})
        .expect(200);
      await request(app)
        .post(`/api/payroll/runs/${draft.body.run.id}/regenerate`)
        .set(hrAuth)
        .send({})
        .expect(409);
      const payslips = await request(app)
        .get("/api/payroll/payslips/my")
        .set(withToken(t.context.employeeOneToken))
        .expect(200);
      assert.ok(payslips.body.items.length);
      const ownPayslipId = payslips.body.items[0].id;
      await request(app)
        .get(`/api/payroll/payslips/${ownPayslipId}/pdf`)
        .set(withToken(t.context.employeeOneToken))
        .expect(200)
        .expect("Content-Type", /application\/pdf/);
      const otherItem = await PayrollItem.findOne({
        employee: t.context.employeeTwoId,
        run: draft.body.run.id,
      });
      await request(app)
        .get(`/api/payroll/payslips/${otherItem.id}/pdf`)
        .set(withToken(t.context.employeeOneToken))
        .expect(404);
      const Notification = require("../../src/models/notification.model");
      const notification = await Notification.findOne({
        user: (await User.findOne({ employeeId: t.context.employeeOneId })).id,
        title: "Payslip available",
      });
      const employeeNotifications = await request(app)
        .get("/api/notifications")
        .set(withToken(t.context.employeeOneToken))
        .expect(200);
      assert.equal(employeeNotifications.body.items[0]._id, notification.id);
      await request(app)
        .post(`/api/notifications/${notification.id}/read`)
        .set(withToken(t.context.employeeTwoToken))
        .send({})
        .expect(404);
      await request(app)
        .post(`/api/notifications/${notification.id}/read`)
        .set(withToken(t.context.employeeOneToken))
        .send({})
        .expect(200);
      assert.equal(
        (await PayrollRun.findById(draft.body.run.id)).status,
        "finalized",
      );
      assert.equal(
        await require("../../src/models/notification.model").countDocuments({
          user: (await User.findOne({ employeeId: t.context.employeeOneId }))
            .id,
          title: "Payslip available",
        }),
        1,
      );

      const hrDashboard = await request(app)
        .get("/api/dashboard/hr")
        .set(hrAuth)
        .expect(200);
      const adminDashboard = await request(app)
        .get("/api/dashboard/admin")
        .set(adminAuth)
        .expect(200);
      const employeeDashboard = await request(app)
        .get("/api/dashboard/employee")
        .set(withToken(t.context.employeeOneToken))
        .expect(200);
      assert.equal(hrDashboard.body.headcount, 2);
      assert.equal(adminDashboard.body.headcount, 2);
      const company = await Company.findById("primary");
      const eligibleEmployees = (await Employee.find().lean()).filter(
        (employee) =>
          employee.joinDate.toISOString().slice(0, 10) <= today &&
          (!employee.exitDate ||
            employee.exitDate.toISOString().slice(0, 10) >= today),
      );
      const approvedLeavesToday = await LeaveRequest.find({
        status: "approved",
        startDate: { $lte: today },
        endDate: { $gte: today },
      })
        .select("employee")
        .lean();
      const onLeaveIds = new Set(
        approvedLeavesToday.map((leave) => String(leave.employee)),
      );
      const todayRecords = await Attendance.find({ date: today }).lean();
      const attendedToday = todayRecords.filter(
        (record) => !onLeaveIds.has(String(record.employee)),
      );
      const present = attendedToday.filter(
        (record) => record.checkOut && record.status === "present",
      ).length;
      const late = attendedToday.filter(
        (record) => record.checkOut && record.status === "late",
      ).length;
      const missingCheckout = attendedToday.filter(
        (record) => !record.checkOut,
      ).length;
      const halfDays = attendedToday.filter(
        (record) => record.checkOut && record.status === "half_day",
      ).length;
      assert.equal(hrDashboard.body.presentToday, present);
      assert.equal(hrDashboard.body.lateToday, late);
      const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const todayIsWorkingDay =
        !company.weekend.includes(weekdayNames[weekday(today)]) &&
        !(await Holiday.exists({
          date: new Date(`${today}T00:00:00.000Z`),
        }));
      const expectedOnLeave = todayIsWorkingDay
        ? eligibleEmployees.filter((employee) =>
            onLeaveIds.has(String(employee._id)),
          ).length
        : 0;
      assert.equal(hrDashboard.body.onLeaveToday, expectedOnLeave);
      const expectedCount = todayIsWorkingDay
        ? eligibleEmployees.filter(
            (employee) => !onLeaveIds.has(String(employee._id)),
          ).length
        : 0;
      const expectedRate = expectedCount
        ? ((present + late + missingCheckout + 0.5 * halfDays) /
            expectedCount) *
          100
        : 0;
      const trendToday = hrDashboard.body.attendanceTrend.find(
        (entry) => entry.date === today,
      );
      assert.equal(
        trendToday.attendanceRate,
        Math.round(expectedRate * 100) / 100,
      );
      assert.equal(
        adminDashboard.body.payrollCost.gross,
        (
          await PayrollItem.aggregate([
            {
              $lookup: {
                from: "payrollruns",
                localField: "run",
                foreignField: "_id",
                as: "runDoc",
              },
            },
            { $unwind: "$runDoc" },
            { $match: { "runDoc.status": "finalized" } },
            { $group: { _id: null, total: { $sum: "$gross" } } },
          ])
        )[0].total,
      );
      assert.ok(Array.isArray(adminDashboard.body.recentAuditFeed));
      assert.ok(adminDashboard.body.recentAuditFeed.length > 0);
      assert.equal(
        adminDashboard.body.announcements[0].title,
        "Integration notice",
      );
      assert.equal(
        (
          await request(app)
            .get("/api/announcements")
            .set(withToken(t.context.employeeOneToken))
            .expect(200)
        ).body.items[0].title,
        "Integration notice",
      );
      assert.ok(Array.isArray(employeeDashboard.body.announcements));
    },
  );

  await t.test(
    "CSV dry-run and import/export are real database operations",
    async () => {
      const hrAuth = withToken(t.context.hrToken);
      const csv = [
        "code,name,email,phone,address,gender,department,designation,joinDate,status,exitDate,basicSalary",
        `BAD,Invalid,not-an-email,,,other,Unknown,Engineer,2020-01-01,active,,50000`,
      ].join("\n");
      const invalid = await request(app)
        .post("/api/employees/import?dryRun=true")
        .set(hrAuth)
        .set("Content-Type", "text/csv")
        .send(csv)
        .expect(200);
      assert.ok(invalid.body.errors.some((issue) => issue.field === "email"));
      assert.equal(await Employee.countDocuments(), 2);
      const validCsv = [
        "code,name,email,phone,address,gender,department,designation,joinDate,status,exitDate,basicSalary",
        `E003,Employee Three,three@example.test,,,other,Engineering,Engineer,2020-01-01,active,,70000`,
      ].join("\n");
      const dryRun = await request(app)
        .post("/api/employees/import?dryRun=true")
        .set(hrAuth)
        .set("Content-Type", "text/csv")
        .send(validCsv)
        .expect(200);
      assert.equal(dryRun.body.validRows, 1);
      const imported = await request(app)
        .post("/api/employees/import?dryRun=false")
        .set(hrAuth)
        .set("Content-Type", "text/csv")
        .send(validCsv)
        .expect(201);
      assert.ok(imported.body.created[0].temporaryPassword);
      assert.equal(await Employee.countDocuments(), 3);
      const exportResult = await request(app)
        .get("/api/employees/export")
        .set(hrAuth)
        .expect(200);
      assert.match(exportResult.text, /E003/);
    },
  );

  await t.test(
    "RBAC, data scope, admin read-only restrictions, AI tools and audit records",
    async () => {
      const adminAuth = withToken(t.context.adminToken);
      const hrAuth = withToken(t.context.hrToken);
      const employeeAuth = withToken(t.context.employeeOneToken);
      const own = await request(app)
        .get(`/api/employees/${t.context.employeeOneId}`)
        .set(employeeAuth)
        .expect(200);
      assert.equal(Object.hasOwn(own.body.employee, "basicSalary"), false);
      await request(app)
        .get(`/api/employees/${t.context.employeeTwoId}`)
        .set(employeeAuth)
        .expect(403);
      await request(app).get("/api/payroll/runs").set(employeeAuth).expect(403);
      await request(app)
        .get("/api/attendance/board")
        .set(employeeAuth)
        .expect(403);
      await request(app)
        .get("/api/leave/requests")
        .set(employeeAuth)
        .expect(403);
      await request(app)
        .get("/api/organization/company")
        .set(employeeAuth)
        .expect(403);
      await request(app)
        .put("/api/organization/company")
        .set(hrAuth)
        .send({
          name: "No",
          officeStart: "09:00",
          graceMinutes: 15,
          halfDayHours: 5,
          weekend: ["Sat", "Sun"],
          latitude: null,
          longitude: null,
          radiusMeters: 150,
          timezone: "Asia/Karachi",
        })
        .expect(403);
      await request(app).get("/api/dashboard/admin").set(hrAuth).expect(403);
      await request(app).get("/api/audit-logs").set(hrAuth).expect(403);
      await request(app)
        .get("/api/organization/hr-users")
        .set(hrAuth)
        .expect(403);
      await request(app)
        .post("/api/employees")
        .set(adminAuth)
        .send({})
        .expect(403);
      await request(app)
        .post(`/api/leave/${t.context.leaveId}/approve`)
        .set(adminAuth)
        .send({ comment: "No" })
        .expect(403);
      await request(app)
        .post(`/api/attendance/corrections/${t.context.attendanceId}/approve`)
        .set(adminAuth)
        .send({ comment: "No" })
        .expect(403);

      await request(app)
        .get(`/api/employees/${t.context.employeeTwoId}`)
        .set(hrAuth)
        .expect(200);
      await request(app)
        .delete(`/api/organization/departments/${t.context.departmentId}`)
        .set(adminAuth)
        .expect(409);
      await request(app).get("/api/audit-logs").set(adminAuth).expect(200);

      aiResponses = [
        {
          functionCall: {
            name: "get_headcount",
            args: {},
            id: "headcount-call",
          },
        },
        "The headcount is available.",
      ];
      const hrChat = await request(app)
        .post("/api/ai/chat")
        .set(hrAuth)
        .send({ message: "How many people work here?" })
        .expect(200);
      assert.equal(hrChat.body.aiGenerated, true);
      assert.match(hrChat.body.message, /headcount/i);

      aiResponses = [
        JSON.stringify([
          "Dashboard attendance is recorded.",
          "Payroll and leave data are available.",
          "The selected dashboard filters are applied.",
        ]),
      ];
      const summary = await request(app)
        .post("/api/ai/dashboard-summary")
        .set(hrAuth)
        .send({ kpis: { headcount: 4, attendanceRate: 80 } })
        .expect(200);
      assert.equal(summary.body.bullets.length, 3);

      aiResponses = [
        JSON.stringify({
          type: t.context.annualId,
          start: monday,
          end: monday,
          reason: "Family event",
        }),
      ];
      const smartLeave = await request(app)
        .post("/api/ai/smart-leave")
        .set(employeeAuth)
        .send({ text: "Agle Monday family event ke liye leave chahiye" })
        .expect(200);
      assert.equal(smartLeave.body.suggestion.type, t.context.annualId);

      aiResponses = [
        {
          functionCall: {
            name: "get_headcount",
            args: {},
            id: "forbidden-call",
          },
        },
      ];
      const employeeChat = await request(app)
        .post("/api/ai/chat")
        .set(employeeAuth)
        .send({ message: "Tell me another employee salary" })
        .expect(200);
      assert.equal(employeeChat.body.aiGenerated, true);
      assert.equal(
        JSON.stringify(employeeChat.body).includes("basicSalary"),
        false,
      );
      const employeeUser = await User.findOne({
        employeeId: t.context.employeeOneId,
        role: "employee",
      });
      const logs = await AiLog.find().sort({ createdAt: -1 }).limit(10).lean();
      assert.ok(
        logs.some((entry) => entry.toolsUsed.includes("get_headcount")),
      );
      assert.ok(
        await AiLog.exists({
          user: employeeUser.id,
          role: "employee",
          status: "fallback",
        }),
        JSON.stringify(logs),
      );
      assert.equal(
        JSON.stringify(logs).includes("integration-test-only"),
        false,
      );

      const windowStart = new Date(Math.floor(Date.now() / 3600000) * 3600000);
      await AiRateLimit.updateOne(
        { user: t.context.hrId },
        {
          $set: {
            windowStart,
            count: 20,
            expiresAt: new Date(windowStart.getTime() + 7200000),
          },
        },
        { upsert: true },
      );
      await request(app)
        .post("/api/ai/chat")
        .set(hrAuth)
        .send({ message: "Rate check" })
        .expect(429);
      assert.ok(
        await AiLog.exists({ user: t.context.hrId, status: "rate_limited" }),
      );

      const employeeReset = await request(app)
        .post(`/api/employees/${t.context.employeeTwoId}/reset-password`)
        .set(hrAuth)
        .send({})
        .expect(200);
      assert.ok(employeeReset.body.temporaryPassword);
      assert.equal(
        JSON.stringify(employeeReset.body).includes("passwordHash"),
        false,
      );
      await request(app)
        .get("/api/dashboard/employee")
        .set(withToken(t.context.employeeTwoToken))
        .expect(401);
      const resetLogin = await login(
        "two@example.test",
        employeeReset.body.temporaryPassword,
      );
      await request(app)
        .get("/api/dashboard/employee")
        .set(withToken(resetLogin.token))
        .expect(403);
      await request(app)
        .post("/api/auth/change-password")
        .set(withToken(resetLogin.token))
        .send({
          currentPassword: employeeReset.body.temporaryPassword,
          newPassword: "Employee-two-reset-123",
        })
        .expect(200);
      t.context.employeeTwoToken = (
        await login("two@example.test", "Employee-two-reset-123")
      ).token;

      const auditRows = await AuditLog.find().lean();
      assert.ok(auditRows.length >= 10);
      assert.equal(
        JSON.stringify(auditRows).toLowerCase().includes("passwordhash"),
        false,
      );
      assert.equal(
        JSON.stringify(auditRows).includes("temporaryPassword"),
        false,
      );
      await assert.rejects(
        AuditLog.updateOne(
          { _id: auditRows[0]._id },
          { $set: { action: "audit-tampered" } },
        ),
        /immutable/,
      );
      await assert.rejects(
        AuditLog.deleteOne({ _id: auditRows[0]._id }),
        /immutable/,
      );
      const actions = new Set(auditRows.map((entry) => entry.action));
      for (const action of [
        "company.settings.update",
        "department.create",
        "designation.create",
        "leavetype.create",
        "holiday.create",
        "hr-user.create",
        "employee.register",
        "employee.salary.update",
        "employee-login.reset-password",
        "attendance-correction.approved",
        "leave.approved",
        "payroll-run.create",
        "payroll-run.regenerate",
        "payroll-run.finalize",
      ]) {
        assert.ok(actions.has(action), `Expected audit action ${action}`);
      }
      const { stringifyCsv } = require("../../src/utils/csv");
      assert.equal(
        stringifyCsv(["value"], [{ value: "=1+1" }]),
        "value\r\n'=1+1",
      );
      await request(app)
        .post(`/api/employees/${t.context.employeeOneId}/deactivate`)
        .set(hrAuth)
        .send({})
        .expect(200);
      await request(app)
        .get("/api/dashboard/employee")
        .set(employeeAuth)
        .expect(401);
      const hrReset = await request(app)
        .post(`/api/organization/hr-users/${t.context.hrId}/reset-password`)
        .set(adminAuth)
        .send({})
        .expect(200);
      assert.ok(hrReset.body.temporaryPassword);
      assert.equal(
        JSON.stringify(hrReset.body).includes("passwordHash"),
        false,
      );
      await request(app).get("/api/audit-logs").set(hrAuth).expect(401);
      await request(app)
        .post(`/api/organization/hr-users/${t.context.hrId}/deactivate`)
        .set(adminAuth)
        .send({})
        .expect(200);
      assert.ok(
        await AuditLog.exists({
          action: "hr-user.reset-password",
          entityId: t.context.hrId,
        }),
      );
      assert.ok(
        await AuditLog.exists({
          action: "hr-user.deactivate",
          entityId: t.context.hrId,
        }),
      );
      for (let attempt = 0; attempt < 11; attempt += 1) {
        await request(app)
          .post("/api/auth/login")
          .send({
            email: `bad-${attempt}@example.test`,
            password: "wrong-password",
          })
          .expect(401);
      }
      await request(app)
        .post("/api/auth/login")
        .send({
          email: "last-attempt@example.test",
          password: "wrong-password",
        })
        .expect(429);
      const mongoUri = process.env.MONGO_URI;
      delete process.env.MONGO_URI;
      try {
        const unavailable = await request(app).get("/api/health").expect(503);
        assert.match(
          unavailable.body.message,
          /database is temporarily unavailable/i,
        );
      } finally {
        process.env.MONGO_URI = mongoUri;
      }
    },
  );
});

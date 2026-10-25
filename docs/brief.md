# HCM Lite - Rules from Challenge Brief

## Roles
- Admin: company setup (name, office hours, grace, weekend, office location + radius), departments, designations, leave types + quotas, holidays, create/deactivate/reset HR and employee logins, view everything, FINALIZE payroll (only Admin), company dashboard, audit log, announcements, AI on all data.
- HR: register employees (creates login), edit details, CSV import/export, salary structures, daily attendance board, approve/reject attendance corrections, approve/reject leave with comment, create + review payroll draft, HR dashboard, announcements, AI on HR data. CANNOT change company settings, create Admin, finalize payroll, view audit log.
- Employee: check in/out, own attendance calendar, request correction, apply/cancel leave + balance, smart leave, download own payslips, view profile (edit phone + address only), personal dashboard, announcements/notifications, AI on own data + policy. CANNOT see others' data/salary, approve anything, edit own salary/role/attendance.
- Admin cannot edit payroll after finalize, cannot delete/change audit log entries.
- First run: fresh install asks company name + Admin account (or ADMIN_EMAIL / ADMIN_PASSWORD from env). HR registering employee creates login with temporary password, must change on first sign-in.

## Business rules
- M1 Auth: JWT, bcrypt. Every API checks role AND data scope.
- M2 Setup: office start 09:00, grace 15 min, half day under 5h, weekend Sat-Sun, office location + radius (e.g. 150 m). Stored as settings, applied to new records only.
- M3 Employees: HR registers with job details + salary; creates login. Server-side search, filters, paging. CSV import has dry run returning row + field + reason; checks required fields, unique code/email, valid email, known dept, ISO date, salary > 0.
- M4 Attendance: server stamps time. One record per employee per day (second check-in = 409). Late after 09:15. half_day if under 5h. absent if no record and no approved leave. missing_checkout if no check-out.
- M5 Leave: working days only (skip weekends + holidays). Quotas: annual 14, sick 8, casual 10, unpaid unlimited. Overlap or over-balance = 422.
- M6 Payroll: Gross = 1.5 x basic (HRA 40%, medical 10%). Per day = gross / working days. Deduct absent + unpaid + 0.5 x half days. Prorate joiners/leavers. Tax slab on gross x 12 (annual): 0 to 600k = 0; 600k-1.2M = 5%; 1.2M-2.4M = 30k + 15%; 2.4M-3.6M = 210k + 25%; above 3.6M = 510k + 35%. Admin finalizes; finalized runs locked.
- M7 Dashboards: all numbers computed on server (DB aggregation), filterable by date range + department.
- M9: announcements on all dashboards, in-app notifications, audit log (actor, action, entity, before/after JSON).

## Metrics
- Headcount / attrition: active + probation on end date / exits in period / average headcount x 100
- Attendance rate: (present + late + missing_checkout + 0.5 x half_day) / (working-day records - on_leave)
- Late % = late / (present + late). Absenteeism = absent days / expected working days, per department
- Leave utilization = approved days / quota, per leave type and department
- Payroll cost = sum gross and net by month + department. Avg salary = mean gross by department + designation

## Dashboards
- HR: headcount, present, on leave, late today, pending approvals, attendance trend, absenteeism by dept, leave by type, top 5 late-comers, AI summary
- Admin: headcount, attrition YTD, payroll cost, avg salary, headcount by dept, payroll cost by dept, gender + tenure, audit feed, AI summary
- Employee: check-in widget, hours this week vs 40h, late count, leave balance, last payslip, announcements, ask my assistant

## AI Assistant (M8)
- POST /ai/chat. Model picks a tool, backend runs it with user's scope, model writes the answer.
- Tools: get_headcount, get_attendance_summary, get_late_comers, get_leave_summary, get_my_leave_balance, get_payroll_summary, search_employees.
- Dashboard summary (Admin, HR): send KPI JSON, return 3-5 bullets using ONLY those numbers.
- Smart leave (Employee): "Need next Monday and Tuesday off for a wedding" -> JSON {type,start,end,reason} -> pre-filled form. User confirms. AI never saves.
- Policy Q&A: rules above in system prompt; answer only from them or say "I don't know".
- Guardrails: API key backend only; JSON validated, retry once then show normal form; 15s timeout + friendly fallback; ~20 requests/user/hour; log every call in ai_logs; label answers "AI-generated".
- Employee asking colleague's salary -> politely refuse.

## Bonus (+10)
Camera attendance (face detect + location), attrition risk score, absence anomaly flags, late penalty (3 lates = 0.5 day), AI understands Roman Urdu, dark mode / PWA.

## Submission
Public Git repo with README (stack, how to run, how to create first Admin, how to set AI key, what is done/not done) + hosted live link starting from first-run setup. Commit .env.example only.

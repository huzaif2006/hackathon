# API Contract
Har naya ya badla hua endpoint yahan likho. Frontend isi file se banega.

Format:
## METHOD /path
Role: admin | hr | employee
Body: { ... }
Response 2xx: { ... }
Errors: 4xx (reason)

---
## GET /api/health
Role: public (health check)
Body: none
Response 2xx: { "status": "ok" }
Errors: none

## GET /api/setup/status
Role: public
Body: none
Response 2xx: { "setupComplete": false }
Errors: 500 (database or server error)

## POST /api/setup
Role: public (only before the first user exists)
Body: { "companyName": "Example Ltd", "name": "Admin Name", "email": "admin@example.com", "password": "at-least-8-characters" }
Response 201: { "company": { "name": "Example Ltd" }, "user": { "id": "...", "name": "Admin Name", "email": "admin@example.com", "role": "admin", "employeeId": null, "mustChangePassword": false } }
Errors: 403 (setup already completed), 409 (email already exists), 422 (invalid body)

## POST /api/auth/login
Role: public
Body: { "email": "admin@example.com", "password": "password" }
Response 2xx: { "token": "...", "user": { "id": "...", "name": "Admin Name", "email": "admin@example.com", "role": "admin", "employeeId": null, "mustChangePassword": false } }
Errors: 401 (invalid credentials or inactive account), 422 (invalid body), 429 (more than 20 login attempts from the same IP in 15 minutes)

## POST /api/auth/change-password
Role: authenticated user
Body: { "currentPassword": "old-password", "newPassword": "new-password-at-least-8-chars" }
Response 2xx: { "user": { "id": "...", "name": "...", "email": "...", "role": "admin|hr|employee", "employeeId": null, "mustChangePassword": false } }
Errors: 401 (missing/invalid token or incorrect current password), 422 (invalid body)

## GET /api/auth/me
Role: authenticated user
Body: none
Response 2xx: { "user": { "id": "...", "name": "...", "email": "...", "role": "admin|hr|employee", "employeeId": null, "mustChangePassword": false } }
Errors: 401 (missing/invalid token or inactive account)

Authenticated requests require `Authorization: Bearer <token>`. Users with `mustChangePassword: true` may access only `/api/auth/me` and `/api/auth/change-password`; other `/api` routes return 403 until the password is changed.

## GET /api/organization/company
Role: admin | hr
Body: none
Response 2xx: { "company": { "name": "Example Ltd", "officeStart": "09:00", "graceMinutes": 15, "halfDayHours": 5, "weekend": ["Sat", "Sun"], "latitude": null, "longitude": null, "radiusMeters": 150, "timezone": "Asia/Karachi" } }
Errors: 401 (missing/invalid token), 403 (employee or password change required), 404 (company setup incomplete)

## PUT /api/organization/company
Role: admin
Body: { "name": "Example Ltd", "officeStart": "09:00", "graceMinutes": 15, "halfDayHours": 5, "weekend": ["Sat", "Sun"], "latitude": null, "longitude": null, "radiusMeters": 150, "timezone": "Asia/Karachi" }
Response 2xx: { "company": { ... } }
Errors: 401 (missing/invalid token), 403 (role forbidden), 422 (invalid settings)

## GET /api/organization/departments
Role: admin | hr
Body: none
Response 2xx: { "items": [{ "_id": "...", "name": "Engineering" }] }
Errors: 401 (missing/invalid token), 403 (employee or password change required)

## POST /api/organization/departments
Role: admin
Body: { "name": "Engineering" }
Response 201: { "item": { "_id": "...", "name": "Engineering" } }
Errors: 401 (missing/invalid token), 403 (role forbidden), 409 (duplicate name), 422 (invalid body)

## PUT /api/organization/departments/:id
Role: admin
Body: { "name": "Engineering" }
Response 2xx: { "item": { "_id": "...", "name": "Engineering" } }
Errors: 401 (missing/invalid token), 403 (role forbidden), 404 (not found), 409 (duplicate name), 422 (invalid ID/body)

## DELETE /api/organization/departments/:id
Role: admin
Body: none
Response 204: no content
Errors: 401 (missing/invalid token), 403 (role forbidden), 404 (not found), 409 (record is in use), 422 (invalid ID)

## GET /api/organization/designations
Role: admin | hr
Body: none
Response 2xx: { "items": [{ "_id": "...", "name": "Engineer" }] }
Errors: 401 (missing/invalid token), 403 (employee or password change required)

## POST /api/organization/designations
Role: admin
Body: { "name": "Engineer" }
Response 201: { "item": { "_id": "...", "name": "Engineer" } }
Errors: 401 (missing/invalid token), 403 (role forbidden), 409 (duplicate name), 422 (invalid body)

## PUT /api/organization/designations/:id
Role: admin
Body: { "name": "Engineer" }
Response 2xx: { "item": { "_id": "...", "name": "Engineer" } }
Errors: 401 (missing/invalid token), 403 (role forbidden), 404 (not found), 409 (duplicate name), 422 (invalid ID/body)

## DELETE /api/organization/designations/:id
Role: admin
Body: none
Response 204: no content
Errors: 401 (missing/invalid token), 403 (role forbidden), 404 (not found), 409 (record is in use), 422 (invalid ID)

## GET /api/organization/leave-types
Role: admin | hr
Body: none
Response 2xx: { "items": [{ "_id": "...", "name": "Annual", "yearlyQuota": 14, "isUnlimited": false, "isPaid": true }] }
Errors: 401 (missing/invalid token), 403 (employee or password change required)

## POST /api/organization/leave-types
Role: admin
Body: { "name": "Annual", "yearlyQuota": 14, "isUnlimited": false, "isPaid": true }
Response 201: { "item": { "_id": "...", "name": "Annual", "yearlyQuota": 14, "isUnlimited": false, "isPaid": true } }
Errors: 401 (missing/invalid token), 403 (role forbidden), 409 (duplicate name), 422 (invalid body)

## PUT /api/organization/leave-types/:id
Role: admin
Body: { "name": "Annual", "yearlyQuota": 14, "isUnlimited": false, "isPaid": true }
Response 2xx: { "item": { "_id": "...", "name": "Annual", "yearlyQuota": 14, "isUnlimited": false, "isPaid": true } }
Errors: 401 (missing/invalid token), 403 (role forbidden), 404 (not found), 409 (duplicate name), 422 (invalid ID/body)

## DELETE /api/organization/leave-types/:id
Role: admin
Body: none
Response 204: no content
Errors: 401 (missing/invalid token), 403 (role forbidden), 404 (not found), 409 (record is in use), 422 (invalid ID)

## GET /api/organization/holidays
Role: admin | hr
Body: none
Response 2xx: { "items": [{ "_id": "...", "date": "2026-12-25T00:00:00.000Z", "name": "Holiday" }] }
Errors: 401 (missing/invalid token), 403 (employee or password change required)

## POST /api/organization/holidays
Role: admin
Body: { "date": "2026-12-25", "name": "Holiday" }
Response 201: { "item": { "_id": "...", "date": "2026-12-25T00:00:00.000Z", "name": "Holiday" } }
Errors: 401 (missing/invalid token), 403 (role forbidden), 409 (holiday date already exists), 422 (invalid body)

## PUT /api/organization/holidays/:id
Role: admin
Body: { "date": "2026-12-25", "name": "Holiday" }
Response 2xx: { "item": { "_id": "...", "date": "2026-12-25T00:00:00.000Z", "name": "Holiday" } }
Errors: 401 (missing/invalid token), 403 (role forbidden), 404 (not found), 409 (holiday date already exists), 422 (invalid ID/body)

## DELETE /api/organization/holidays/:id
Role: admin
Body: none
Response 204: no content
Errors: 401 (missing/invalid token), 403 (role forbidden), 404 (not found), 422 (invalid ID)

## GET /api/organization/hr-users
Role: admin
Body: none
Response 2xx: { "users": [{ "id": "...", "name": "HR User", "email": "hr@example.com", "role": "hr", "isActive": true, "mustChangePassword": true }] }
Errors: 401 (missing/invalid token), 403 (role forbidden)

## POST /api/organization/hr-users
Role: admin
Body: { "name": "HR User", "email": "hr@example.com" }
Response 201: { "user": { "id": "...", "name": "HR User", "email": "hr@example.com", "role": "hr", "isActive": true, "mustChangePassword": true }, "temporaryPassword": "shown-once" }
Errors: 401 (missing/invalid token), 403 (role forbidden), 409 (email already exists), 422 (invalid body)

## POST /api/organization/hr-users/:id/deactivate
Role: admin
Body: none
Response 2xx: { "user": { "id": "...", "name": "HR User", "email": "hr@example.com", "role": "hr", "isActive": false, "mustChangePassword": true } }
Errors: 401 (missing/invalid token), 403 (role forbidden), 404 (HR user not found), 422 (invalid ID)

## POST /api/organization/hr-users/:id/reset-password
Role: admin
Body: none
Response 2xx: { "user": { "id": "...", "name": "HR User", "email": "hr@example.com", "role": "hr", "isActive": true, "mustChangePassword": true }, "temporaryPassword": "shown-once" }
Errors: 401 (missing/invalid token), 403 (role forbidden), 404 (HR user not found), 422 (invalid ID)

Organization settings and lists are readable by Admin and HR; Employees receive 403. Writes are Admin-only except HR-user management, which is Admin-only including reads. Company setting changes are stored for use by new records and do not rewrite historical records.

## GET /api/employees/departments
Role: admin | hr
Body: none
Response 2xx: { "items": [{ "_id": "...", "name": "Engineering" }] }
Errors: 401 (missing/invalid token), 403 (employee or password change required)

## GET /api/employees/designations
Role: admin | hr
Body: none
Response 2xx: { "items": [{ "_id": "...", "name": "Engineer" }] }
Errors: 401 (missing/invalid token), 403 (employee or password change required)

## GET /api/employees
Role: admin | hr
Query: search (name/code/email), department (department ID), status (active|probation|exited), page (default 1), limit (default 10, maximum 100)
Response 2xx: { "items": [{ "_id": "...", "code": "EMP-001", "name": "Employee", "email": "employee@example.com", "phone": "", "address": "", "gender": "other", "department": { "_id": "...", "name": "Engineering" }, "designation": { "_id": "...", "name": "Engineer" }, "joinDate": "2026-01-01T00:00:00.000Z", "status": "active", "exitDate": null, "basicSalary": 100000 }], "pagination": { "page": 1, "limit": 10, "total": 1, "pages": 1 } }
Errors: 401 (missing/invalid token), 403 (employee or password change required), 422 (invalid filters)

## POST /api/employees
Role: hr
Body: { "code": "EMP-001", "name": "Employee", "email": "employee@example.com", "phone": "", "address": "", "gender": "other", "department": "department-id", "designation": "designation-id", "joinDate": "2026-01-01", "status": "active", "basicSalary": 100000 }
Response 201: { "employee": { ... }, "user": { "id": "...", "name": "Employee", "email": "employee@example.com", "role": "employee", "isActive": true, "mustChangePassword": true }, "temporaryPassword": "shown-once" }
Errors: 401 (missing/invalid token), 403 (role forbidden), 409 (duplicate employee code or email), 422 (invalid fields or unknown department/designation)

## GET /api/employees/:id
Role: admin | hr | employee (employee may read only their own linked employee ID)
Body: none
Response 2xx: { "employee": { "_id": "...", "code": "EMP-001", "name": "Employee", "email": "employee@example.com", "phone": "", "address": "", "gender": "other", "department": { "_id": "...", "name": "Engineering" }, "designation": { "_id": "...", "name": "Engineer" }, "joinDate": "2026-01-01T00:00:00.000Z", "status": "active", "exitDate": null, "basicSalary": 100000 } }
Employee response omits `basicSalary`.
Errors: 401 (missing/invalid token), 403 (employee requests another employee), 404 (not found), 422 (invalid ID)

## PUT /api/employees/:id
Role: hr (employee may update own phone and address only)
Body (HR): any non-empty subset of employee fields from POST /api/employees. Body (employee): { "phone": "...", "address": "..." } with at least one field.
Response 2xx: { "employee": { ... } }
Employee response omits `basicSalary`.
Errors: 401 (missing/invalid token), 403 (role/scope/field forbidden), 404 (not found), 409 (duplicate code/email), 422 (invalid fields)
HR may update `basicSalary` through this endpoint; Employees cannot read or update salary.

## GET /api/employees/my-profile
Role: employee
Body: none
Response 2xx: { "employee": { ... } } (own employee record; no `basicSalary`)
Errors: 401 (missing/invalid token), 403 (no linked employee record), 404 (not found)

## PUT /api/employees/my-profile
Role: employee
Body: { "phone": "...", "address": "..." } (at least one field)
Response 2xx: { "employee": { ... } } (own employee record; no `basicSalary`)
Errors: 401 (missing/invalid token), 403 (forbidden fields or no linked employee record), 404 (not found), 422 (invalid body)

## POST /api/employees/:id/deactivate
Role: hr
Body: none
Response 2xx: { "user": { "id": "...", "name": "Employee", "email": "employee@example.com", "role": "employee", "isActive": false, "mustChangePassword": true } }
Errors: 401 (missing/invalid token), 403 (role forbidden), 404 (employee/login not found), 422 (invalid ID)

## POST /api/employees/:id/reset-password
Role: hr
Body: none
Response 2xx: { "user": { "id": "...", "name": "Employee", "email": "employee@example.com", "role": "employee", "isActive": true, "mustChangePassword": true }, "temporaryPassword": "shown-once" }
Errors: 401 (missing/invalid token), 403 (role forbidden), 404 (employee/login not found), 422 (invalid ID)

## GET /api/employees/export
Role: hr
Body: none
Response 2xx: CSV attachment (`employees.csv`) with employee directory fields.
Errors: 401 (missing/invalid token), 403 (role forbidden)

## POST /api/employees/import?dryRun=true
Role: hr
Content-Type: text/csv
Body: CSV text with columns `code,name,email,phone,address,gender,department,designation,joinDate,status,exitDate,basicSalary`; department and designation columns use their names.
Response 2xx: { "dryRun": true, "totalRows": 1, "validRows": 1, "errors": [] } where each error is { "row": 2, "field": "email", "reason": "Must be a valid email address" }.
Errors: 401 (missing/invalid token), 403 (role forbidden), 422 (missing/invalid CSV or query)

## POST /api/employees/import?dryRun=false
Role: hr
Content-Type: text/csv
Body: same CSV text and columns as dry-run import. Save occurs only when every row validates.
Response 201: { "dryRun": false, "created": [{ "employee": { ... }, "user": { "id": "...", "role": "employee", "mustChangePassword": true }, "temporaryPassword": "shown-once" }] }
Errors: 401 (missing/invalid token), 403 (role forbidden), 409 (concurrent duplicate code/email), 422 (CSV has invalid rows; response includes `errors`, `totalRows`, and `validRows`)

Employees and their login accounts are created in one database transaction. Employee self-service may change only phone/address, and its API responses never include salary. Admin can view the directory/profiles but cannot create or edit employees. CSV imports are all-or-nothing; dry run makes no database changes.

## POST /api/attendance/check-in
Role: employee
Body: {}
Response 2xx: { "attendance": { "_id": "...", "employee": "...", "date": "YYYY-MM-DD", "checkIn": "ISO datetime", "checkOut": null, "status": "present|late", "workedHours": 0, "source": "web", "note": "" }, "note": "", "timezone": "Asia/Karachi" }
Errors: 401 (unauthenticated), 403 (no linked employee), 409 (already checked in for company-local date)

## POST /api/attendance/check-out
Role: employee
Body: {}
Response 2xx: { "attendance": { "_id": "...", "employee": "...", "date": "YYYY-MM-DD", "checkIn": "ISO datetime", "checkOut": "ISO datetime", "status": "present|late|half_day", "workedHours": 8.25, "source": "web", "note": "" }, "timezone": "Asia/Karachi" }
Errors: 401 (unauthenticated), 403 (no linked employee), 409 (no check-in or already checked out), 422 (invalid time ordering)

## GET /api/attendance/my?month=YYYY-MM
Role: employee
Body: none
Response 2xx: { "days": [{ "date": "YYYY-MM-DD", "status": "present|late|half_day|absent|missing_checkout|on_leave|holiday|weekend|scheduled|null", "checkIn": "ISO datetime|null", "checkOut": "ISO datetime|null", "workedHours": 8.25, "note": "" }], "timezone": "Asia/Karachi" }
`month` may be omitted to load the current month in the company's timezone.
Errors: 401 (unauthenticated), 403 (no linked employee), 422 (invalid month)

## GET /api/attendance/board?date=YYYY-MM-DD&department=:departmentId
Role: admin | hr
Body: none
Response 2xx: { "date": "YYYY-MM-DD", "timezone": "Asia/Karachi", "items": [{ "employee": { "id": "...", "name": "...", "code": "...", "department": { "_id": "...", "name": "..." }, "designation": { "_id": "...", "name": "..." } }, "date": "YYYY-MM-DD", "status": "present|late|half_day|absent|missing_checkout|on_leave|holiday|weekend|scheduled", "checkIn": "ISO datetime|null", "checkOut": "ISO datetime|null", "workedHours": 8.25, "note": "" }] }
`date` may be omitted to select the current date in the company's timezone.
Errors: 401 (unauthenticated), 403 (employee role), 422 (invalid date or department ID)

## POST /api/attendance/corrections
Role: employee
Body: { "date": "YYYY-MM-DD", "requestedCheckIn": "09:10", "requestedCheckOut": "17:00", "reason": "Forgot to check in" }
Response 2xx: { "correction": { "_id": "...", "employee": "...", "date": "YYYY-MM-DD", "requestedCheckIn": "09:10", "requestedCheckOut": "17:00", "reason": "...", "status": "pending" } }
Errors: 401 (unauthenticated), 403 (no linked employee), 409 (pending request already exists for date), 422 (invalid date, time, or request)

## GET /api/attendance/corrections
Role: admin | hr | employee
Body: none
Response 2xx: { "items": [{ "_id": "...", "employee": { "_id": "...", "name": "...", "code": "..." }, "date": "YYYY-MM-DD", "requestedCheckIn": "09:10", "requestedCheckOut": "17:00", "reason": "...", "status": "pending|approved|rejected", "comment": "...", "reviewedBy": null }] }
Errors: 401 (unauthenticated), 403 (employee cannot access another employee's requests)

## POST /api/attendance/corrections/:id/approve
Role: hr
Body: { "comment": "Approved after review" }
Response 2xx: { "correction": { "_id": "...", "status": "approved", "comment": "...", "reviewedBy": "...", "reviewedAt": "ISO datetime" } }
Errors: 401 (unauthenticated), 403 (role forbidden), 404 (request not found), 409 (already reviewed), 422 (invalid comment or attendance times)

## POST /api/attendance/corrections/:id/reject
Role: hr
Body: { "comment": "Insufficient evidence" }
Response 2xx: { "correction": { "_id": "...", "status": "rejected", "comment": "...", "reviewedBy": "...", "reviewedAt": "ISO datetime" } }
Errors: 401 (unauthenticated), 403 (role forbidden), 404 (request not found), 409 (already reviewed), 422 (invalid comment)

Attendance dates and office-hour cutoffs use the Company IANA timezone. Absent/on-leave states are computed for report reads rather than inserted as daily attendance records; approved LeaveRequest dates are shown as on_leave. Weekend and holiday check-ins remain allowed and are annotated.

## POST /api/leave
Role: employee
Body: { "leaveType": "leave-type-id", "startDate": "2026-10-26", "endDate": "2026-10-27", "reason": "Personal leave" }
Response 201: { "leaveRequest": { "_id": "...", "employee": "...", "leaveType": "...", "startDate": "2026-10-26", "endDate": "2026-10-27", "days": 2, "yearlyDays": [{ "year": 2026, "days": 2 }], "reason": "...", "status": "pending" } }
Errors: 401 (unauthenticated), 403 (no linked employee), 422 (invalid range, no working days, overlapping pending/approved request, unknown leave type, or insufficient balance)

## GET /api/leave/balance
Role: employee
Body: none
Response 2xx: { "year": 2026, "balances": [{ "leaveType": { "id": "...", "name": "Annual", "yearlyQuota": 14, "isUnlimited": false, "isPaid": true }, "quota": 14, "used": 2, "remaining": 12 }], "calendar": { "weekend": ["Sat", "Sun"], "holidays": ["2026-12-25"] } }
For unlimited leave types, `quota` and `remaining` are null. `used` counts approved working days in the current year.
Errors: 401 (unauthenticated), 403 (no linked employee)

## GET /api/leave/my
Role: employee
Body: none
Response 2xx: { "items": [{ "_id": "...", "employee": "...", "leaveType": { "_id": "...", "name": "Annual" }, "startDate": "2026-10-26", "endDate": "2026-10-27", "days": 2, "reason": "...", "status": "pending|approved|rejected|cancelled", "reviewedBy": null, "reviewedAt": null, "reviewComment": "" }] }
Errors: 401 (unauthenticated), 403 (no linked employee)

## POST /api/leave/:id/cancel
Role: employee (own request only)
Body: none
Response 2xx: { "leaveRequest": { "_id": "...", "status": "cancelled" } }
Errors: 401 (unauthenticated), 404 (request not found or not owned by employee), 409 (request is not pending), 422 (invalid ID)

## GET /api/leave/requests?status=pending&department=:departmentId&page=1&limit=10
Role: admin | hr
Body: none
Response 2xx: { "items": [{ "_id": "...", "employee": { "_id": "...", "name": "...", "code": "...", "department": { "_id": "...", "name": "..." } }, "leaveType": { "_id": "...", "name": "Annual" }, "startDate": "2026-10-26", "endDate": "2026-10-27", "days": 2, "reason": "...", "status": "pending", "reviewComment": "" }], "pagination": { "page": 1, "limit": 10, "total": 1, "pages": 1 } }
`status`, `department`, `page`, and `limit` are optional; omitted status defaults to `pending`.
Errors: 401 (unauthenticated), 403 (role forbidden), 422 (invalid filter or unknown department)

## POST /api/leave/:id/approve
Role: hr
Body: { "comment": "Approved" }
Response 2xx: { "leaveRequest": { "_id": "...", "status": "approved", "reviewedBy": "...", "reviewedAt": "ISO datetime", "reviewComment": "Approved" } }
Errors: 401 (unauthenticated), 403 (role forbidden), 404 (request not found), 409 (already reviewed), 422 (overlap, no working days, or balance exceeded after recheck)

## POST /api/leave/:id/reject
Role: hr
Body: { "comment": "Insufficient balance" }
Response 2xx: { "leaveRequest": { "_id": "...", "status": "rejected", "reviewedBy": "...", "reviewedAt": "ISO datetime", "reviewComment": "Insufficient balance" } }
Errors: 401 (unauthenticated), 403 (role forbidden), 404 (request not found), 409 (already reviewed), 422 (invalid comment or ID)

## GET /api/notifications
Role: authenticated user
Body: none
Response 2xx: { "items": [{ "_id": "...", "title": "Payslip available", "message": "Your 2026-10 payslip is now available to download.", "isRead": false, "createdAt": "ISO datetime" }], "unreadCount": 1 }
Errors: 401 (missing/invalid token)

## POST /api/notifications/:id/read
Role: authenticated user (own notification only)
Body: none
Response 2xx: { "notification": { "_id": "...", "title": "...", "message": "...", "isRead": true, "createdAt": "ISO datetime" } }
Errors: 401 (missing/invalid token), 404 (notification not found or belongs to another user), 422 (invalid ID)

Approved LeaveRequest dates are integrated into attendance reads and appear as `on_leave`, not `absent`. Only HR may approve/reject leave; Admin can view the paginated inbox but is read-only. Notifications are created for the employee when HR approves or rejects their leave request.

## POST /api/payroll/runs
Role: hr
Body: { "month": "2026-10" }
Response 201: { "run": { "id": "...", "month": "2026-10", "status": "draft", "itemCount": 1, "totals": { "gross": 150000, "deduction": 6818.18, "monthlyTax": 10000, "netPay": 133181.82 }, "items": [{ "employee": "...", "employeeSnapshot": { "name": "...", "code": "...", "department": "...", "designation": "..." }, "basic": 100000, "hra": 40000, "medical": 10000, "gross": 150000, "workingDays": 22, "absentDays": 1, "unpaidLeaveDays": 0, "halfDays": 0, "deduction": 6818.18, "annualTax": 120000, "monthlyTax": 10000, "netPay": 133181.82, "daysPayable": 22 }] } }
Errors: 401 (unauthenticated), 403 (role forbidden), 409 (month already has a run), 422 (invalid month or no working days)

Earnings are prorated by `daysPayable / workingDays` for joiners/leavers. Deduction uses the full-month gross divided by working days, multiplied by absent days + unpaid leave days + 0.5 × half days. Annual tax uses full monthly gross × 12, and monthlyTax = annualTax / 12. The stored `gross`, `monthlyTax`, and `netPay` represent amounts payable for that run month; netPay = gross - deduction - monthlyTax.

## GET /api/payroll/runs
Role: hr | admin
Body: none
Response 2xx: { "items": [{ "id": "...", "month": "2026-10", "status": "draft|finalized", "itemCount": 1, "totals": { "gross": 150000, "deduction": 6818.18, "monthlyTax": 10000, "netPay": 133181.82 }, "finalizedAt": null }] }
Errors: 401 (unauthenticated), 403 (employee role)

## GET /api/payroll/runs/:id
Role: hr | admin
Body: none
Response 2xx: { "run": { "id": "...", "month": "2026-10", "status": "draft|finalized", "items": [{ "employee": { "_id": "...", "name": "...", "code": "..." }, "employeeSnapshot": { "name": "...", "code": "...", "department": "...", "designation": "..." }, "basic": 100000, "hra": 40000, "medical": 10000, "gross": 150000, "workingDays": 22, "absentDays": 1, "unpaidLeaveDays": 0, "halfDays": 0, "deduction": 6818.18, "annualTax": 0, "monthlyTax": 0, "netPay": 143181.82, "daysPayable": 22 }] } }
Errors: 401 (unauthenticated), 403 (employee role), 404 (run not found), 422 (invalid ID)

## POST /api/payroll/runs/:id/regenerate
Role: hr
Body: none
Response 2xx: { "run": { "id": "...", "month": "2026-10", "status": "draft", "items": [] } }
Errors: 401 (unauthenticated), 403 (role forbidden), 404 (run not found), 409 (finalized or no longer draft), 422 (no working days)

## POST /api/payroll/runs/:id/finalize
Role: admin
Body: none
Response 2xx: { "run": { "id": "...", "month": "2026-10", "status": "finalized", "finalizedBy": "...", "finalizedAt": "ISO datetime", "items": [] } }
Errors: 401 (unauthenticated), 403 (role forbidden), 404 (run not found), 409 (already finalized), 422 (invalid ID)

## GET /api/payroll/payslips/my
Role: employee
Body: none
Response 2xx: { "items": [{ "id": "...", "month": "2026-10", "status": "finalized", "basic": 100000, "hra": 40000, "medical": 10000, "gross": 150000, "deduction": 6818.18, "annualTax": 120000, "monthlyTax": 10000, "netPay": 133181.82, "daysPayable": 22, "finalizedAt": "ISO datetime" }] }
Only finalized runs are returned, and only the authenticated employee's own payslips are included.
Errors: 401 (unauthenticated), 403 (no linked employee record)

## GET /api/payroll/payslips/:id/pdf
Role: employee | hr | admin
Body: none
Response 2xx: `application/pdf` attachment. Employees may download only their own payslip and only after its run is finalized; HR/Admin may download any payroll item PDF.
Errors: 401 (unauthenticated), 403 (role forbidden), 404 (payslip not found, employee scope mismatch, or employee requests a draft), 422 (invalid payslip ID)

## GET /api/dashboard/hr
Role: hr | admin
Query: `from` and `to` as `YYYY-MM-DD` (optional; defaults to current month through today), `department` as a department ID (optional)
Body: none
Response 2xx: { "filters": { "from": "2026-10-01", "to": "2026-10-24", "department": null }, "headcount": 12, "presentToday": 8, "onLeaveToday": 1, "lateToday": 2, "latePercentage": 18.18, "pendingApprovals": 3, "attendanceTrend": [{ "date": "2026-10-24", "attendanceRate": 90, "present": 8, "late": 2, "missingCheckout": 0, "halfDay": 0, "absent": 1, "onLeave": 1 }], "absenteeismByDepartment": [{ "department": "Engineering", "expectedWorkingDays": 100, "absentDays": 4, "absenteeismRate": 4 }], "leaveByType": [{ "leaveTypeId": "...", "leaveType": "Annual", "approvedDays": 4, "quota": 14, "utilizationRate": 28.57 }], "topLateComers": [{ "employeeId": "...", "name": "Employee Name", "code": "EMP-001", "department": "Engineering", "lateCount": 3, "lastLateDate": "2026-10-24" }], "announcements": [{ "_id": "...", "title": "Welcome", "message": "Company update", "createdBy": { "name": "Admin", "role": "admin" }, "createdAt": "ISO datetime" }] }
Errors: 401 (unauthenticated), 403 (role forbidden), 404 (company not configured), 422 (invalid filters, reversed dates, or range over 367 days)

## GET /api/dashboard/admin
Role: admin
Query: `from` and `to` as `YYYY-MM-DD` (optional; defaults to current month through today), `department` as a department ID (optional)
Body: none
Response 2xx: { "filters": { "from": "2026-10-01", "to": "2026-10-24", "department": null }, "headcount": 12, "attritionYtd": { "exits": 1, "averageHeadcount": 12, "rate": 8.33 }, "payrollCost": { "gross": 1800000, "net": 1600000, "monthly": [{ "month": "2026-10", "department": "Engineering", "gross": 1500000, "net": 1300000 }], "byDepartment": [{ "department": "Engineering", "gross": 1500000, "net": 1300000 }] }, "averageSalary": { "gross": 150000, "byDepartmentDesignation": [{ "department": "Engineering", "designation": "Engineer", "averageGross": 150000, "employees": 10 }] }, "headcountByDepartment": [{ "department": "Engineering", "headcount": 10 }], "payrollCostByDepartment": [{ "department": "Engineering", "gross": 1500000, "net": 1300000 }], "genderBreakdown": [{ "gender": "unknown", "headcount": 12 }], "tenureBreakdown": [{ "range": "<1 year", "headcount": 4 }], "recentAuditFeed": [{ "_id": "...", "actor": { "name": "Admin", "email": "admin@example.com", "role": "admin" }, "action": "employee.register", "entityType": "Employee", "entityId": "...", "before": null, "after": {}, "createdAt": "ISO datetime" }], "announcements": [{ "_id": "...", "title": "Welcome", "message": "Company update", "createdBy": { "name": "Admin", "role": "admin" }, "createdAt": "ISO datetime" }] }
Errors: 401 (unauthenticated), 403 (HR/employee role), 404 (company not configured), 422 (invalid filters, reversed dates, or range over 367 days)

## GET /api/dashboard/employee
Role: employee
Query: none
Body: none
Response 2xx: { "timezone": "Asia/Karachi", "today": { "date": "2026-10-24", "attendance": { "checkIn": "ISO datetime", "checkOut": null, "status": "late", "workedHours": 0 } }, "hoursThisWeek": { "worked": 24.5, "target": 40 }, "lateCountThisMonth": 2, "leaveBalance": [{ "leaveType": { "id": "...", "name": "Annual", "yearlyQuota": 14, "isUnlimited": false, "isPaid": true }, "quota": 14, "used": 2, "remaining": 12 }], "lastFinalizedPayslip": { "month": "2026-10", "basic": 100000, "hra": 40000, "medical": 10000, "gross": 150000, "deduction": 0, "monthlyTax": 0, "netPay": 150000, "daysPayable": 22 }, "announcements": [{ "_id": "...", "title": "Welcome", "message": "Company update", "createdBy": { "name": "Admin", "role": "admin" }, "createdAt": "ISO datetime" }] }
Errors: 401 (unauthenticated), 403 (non-employee role or no linked employee record), 404 (company not configured)

## POST /api/ai/chat
Role: admin | hr | employee
Body: { "message": "How many employees are present today?", "history": [{ "role": "user|assistant", "content": "Previous message" }] }
Response 2xx: { "message": "There are 12 employees present today.", "aiGenerated": true, "fallback": false }
Errors: 401 (unauthenticated), 403 (role forbidden or password change required), 422 (invalid message/history), 429 (20 requests per user per hour exceeded)
On provider timeout or failure, returns a friendly fallback message with `aiGenerated: true` and `fallback: true`; it does not expose provider errors. Chat is read-only. Role-scoped tools call existing dashboard, attendance, leave, payroll, and employee services; Employee tools only access that employee's attendance, leave balance, and finalized payslips. Employee tool results never include another person's salary or private data. Every request is recorded in MongoDB collection `ai_logs`.

## POST /api/ai/dashboard-summary
Role: admin | hr
Body: { "kpis": { "filters": { "from": "2026-10-01", "to": "2026-10-24", "department": null }, "headcount": 12, "presentToday": 8 } }
Response 2xx: { "bullets": ["Headcount is 12 for the selected filters.", "8 employees are present today.", "The dashboard covers 2026-10-01 through 2026-10-24."], "aiGenerated": true }
Errors: 401 (unauthenticated), 403 (role forbidden), 422 (invalid KPI JSON), 429 (20 requests per user per hour exceeded), 503 (AI provider unavailable or summary failed validation)
The summary contains 3–5 bullets and is constrained to numeric values present in the submitted KPI JSON. The frontend submits its currently displayed dashboard data and filters.

## POST /api/ai/smart-leave
Role: employee
Body: { "text": "Agle Monday Tuesday behen ki shadi ke liye chahiye" }
Response 2xx: { "suggestion": { "type": "leave-type-id", "start": "2026-10-26", "end": "2026-10-27", "reason": "Behen ki shadi ke liye" }, "aiGenerated": true }
Errors: 401 (unauthenticated), 403 (role forbidden or no linked employee record), 422 (invalid request, no configured leave types, or invalid suggestion after one retry), 429 (20 requests per user per hour exceeded), 503 (AI provider unavailable)
The backend supplies today's company-timezone date and configured leave types to Gemini. `type` is a configured leave type ID. This endpoint only prefills a form suggestion: it never creates or saves a LeaveRequest. The user must review the suggestion and submit the leave form.

## GET /api/audit-logs
Role: admin
Query: optional `actor` user ID, `action`, `entityType`, `from` and `to` (`YYYY-MM-DD`), `page` (default 1), and `limit` (default 20, maximum 100).
Body: none
Response 2xx: { "items": [{ "_id": "...", "actor": { "name": "Admin", "email": "admin@example.com", "role": "admin" }, "action": "employee.register", "entityType": "Employee", "entityId": "...", "before": null, "after": {}, "createdAt": "ISO datetime" }], "pagination": { "page": 1, "limit": 20, "total": 1, "pages": 1 } }
Errors: 401 (unauthenticated), 403 (non-Admin), 422 (invalid filter or date range)
Audit records are append-only; their model blocks update and delete operations. Passwords, tokens, and credentials are removed before a record is saved.

## GET /api/announcements
Role: admin | hr | employee
Query: optional `limit` (default 20, maximum 50)
Body: none
Response 2xx: { "items": [{ "_id": "...", "title": "Welcome", "message": "Company update", "createdBy": { "name": "Admin", "role": "admin" }, "createdAt": "ISO datetime" }] }
Errors: 401 (unauthenticated), 422 (invalid limit)

## POST /api/announcements
Role: admin | hr
Body: { "title": "Welcome", "message": "Company update" }
Response 201: { "announcement": { "_id": "...", "title": "Welcome", "message": "Company update", "createdBy": "...", "createdAt": "ISO datetime" } }
Errors: 401 (unauthenticated), 403 (Employee or password change required), 422 (invalid title or message)
HR and Admin can publish announcements. The latest five are included in each role's dashboard response.

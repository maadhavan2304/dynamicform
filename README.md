# Formwork: Dynamic Form Builder & Response Management

Build forms without touching code: drag-and-drop builder, validation, conditional fields, public or signed-in
submission, response editing with history, analytics, Excel/PDF export and an audit log.

| Layer | Stack |
|---|---|
| API | Python, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2, PyJWT, Celery (Redis) |
| UI | React 18 + Vite + TypeScript, Material UI, Axios, React Router, React Hook Form, Chart.js, dnd-kit |
| DB | MySQL 8.0 |

```
formbuilder/
├── backend/            FastAPI app (app/), Alembic migrations, tests
├── frontend/           React app
├── docs/               schema.sql, openapi.json
├── postman/            Postman collection
└── docker-compose.yml  MySQL 8 + Redis for local development
```

## Quick start

### 1. Database and Redis
```bash
docker compose up -d            # MySQL 8.0 (formbuilder / formuser / formpass) + Redis
```
Using your own MySQL instead? Create the database and user, then point `DATABASE_URL` at it.

### 2. Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                    # set SECRET_KEY to a long random value
alembic upgrade head                                    # creates the 8 tables
uvicorn app.main:app --reload                           # http://localhost:8000
```
On first start the API seeds the `Admin`/`User` roles and a default admin
(`ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`, default `admin@example.com` / `Admin@12345`). **Change these.**

Instead of Alembic you can load `docs/schema.sql` in MySQL Workbench.

- Swagger UI: http://localhost:8000/docs (log in via `POST /api/auth/login`, then **Authorize**)
- ReDoc: http://localhost:8000/redoc, static copy in `docs/openapi.json`

**Optional: Celery worker** (background exports for large forms; direct downloads work without it)
```bash
celery -A app.celery_app worker --loglevel=info          # Windows: add --pool=solo
celery -A app.celery_app beat --loglevel=info            # hourly cleanup of old export files
```

### 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:8000/api
npm run dev                 # http://localhost:5173
```

### 4. Postman
Import `postman/FormBuilder.postman_collection.json`. Run **Auth → Login (admin)** (the token is saved
automatically), then **Forms → Create form**, which stores `formId` and each `field_<key>` id for the other requests.

### Tests
```bash
cd backend && pytest -q     # 12 integration tests on a throw-away SQLite DB
```

## Features and where they live

| Requirement | Implementation |
|---|---|
| Registration, login, JWT | `routers/auth.py`, `security.py`. Login is the OAuth2 password flow, so Swagger's Authorize button works. |
| Admin / User roles | `roles` table, `deps.require_admin`, `services/permissions.py` |
| Create / edit / delete forms | `routers/forms.py`; the form editor sends the whole form (fields in display order) in one `PUT` |
| Drag-and-drop builder | `pages/FormBuilder.tsx` (drag from the palette, reorder on the canvas, keyboard accessible, live preview) |
| 9 field types | text, number, email, date, dropdown, checkbox, radio, file upload, rating |
| Required + other validation | Mirrored in `DynamicForm.tsx` (UI) and `services/validation.py` (authoritative): min/max length, regex, number/date ranges, valid options, rating range, file exists |
| Conditional visibility | Per-field `condition` (`field_key`, `operator`, `value`). Operators: is, is not, contains, greater/less than, has/has no answer. A field can only depend on a field above it; hidden fields are neither validated nor stored. |
| Field ordering | `form_fields.position`, set from list order |
| Public / authenticated submission | `forms.is_public`; private forms need a bearer token |
| Response editing by permission | Admins and the form owner always; a submitter only on their own response and only if the form has *allow_response_edit* on and is enabled |
| Search & filter | Free-text over all answers, one-field filter, date range, pagination |
| Response history | Every edit logs old → new values per field (`response.updated`); viewed in the response dialog |
| Dashboard & form analytics | `routers/analytics.py`: totals, 14/30-day series, top forms, per-field distributions, rating averages, number stats |
| Excel & PDF export | `services/export.py` (openpyxl / reportlab). Honours the current search and filters. Direct download or Celery job. |
| Activity logs | `activity_logs` table: registrations, logins, form create/edit/delete/enable/disable, response create/edit/delete, exports |
| Enable / disable forms | `PATCH /api/forms/{id}/status`; disabled forms reject new submissions and show a "closed" page |

### Permission matrix

| Action | Anonymous | User | Form owner | Admin |
|---|:-:|:-:|:-:|:-:|
| Submit a public form | ✔ | ✔ | ✔ | ✔ |
| Submit a signed-in-only form | ✘ | ✔ | ✔ | ✔ |
| View / edit own response | – | ✔ (edit only if the form allows) | ✔ | ✔ |
| Edit, delete or export any response on a form | ✘ | ✘ | ✔ | ✔ |
| Edit / delete / disable a form | ✘ | own forms only | ✔ | all forms |
| Manage users | ✘ | ✘ | ✘ | ✔ |
| Activity log | ✘ | own actions + activity on own forms | – | everything |

### Data model
`roles` → `users` → `forms` → `form_fields` → `field_options`; `forms` → `form_responses` → `response_details`;
plus `activity_logs`. Notes:
- Fields carry a stable `field_key`. Saving a form updates fields by key, so editing a form never detaches
  existing answers. Removing a field deletes its answers.
- `response_details.value` is text; checkbox and file values are JSON.
- Response history is stored in `activity_logs` (`entity_type='response'`) instead of a ninth table.
  Each log row also has `form_id` so owners can see activity on their forms.
- Uploads live on disk in `UPLOAD_DIR`. Only people who can view the response containing a file can download it.

## API overview
All routes are under `/api`. See Swagger for schemas.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Users (admin) | `GET /users`, `PATCH /users/{id}`, `DELETE /users/{id}` |
| Forms | `GET/POST /forms`, `GET/PUT/DELETE /forms/{id}`, `PATCH /forms/{id}/status`, `GET /forms/available` |
| Public | `GET /public/forms/{id}`, `POST /forms/{id}/responses`, `POST /uploads` |
| Responses | `GET /forms/{id}/responses` (`q`, `field_id`+`value`, `date_from`, `date_to`, `page`, `page_size`), `GET /me/responses`, `GET/PUT/DELETE /responses/{id}`, `GET /responses/{id}/history` |
| Analytics | `GET /analytics/dashboard`, `GET /analytics/forms/{id}` |
| Export | `GET /forms/{id}/export?format=xlsx\|pdf`, `POST /forms/{id}/export-jobs`, `GET /export-jobs/{task}`, `GET /export-jobs/{task}/download` |
| Logs / files | `GET /logs`, `GET /files/{id}` |

Submissions are `{"answers": {"<field_id>": value}}`. Validation failures return `422` with
`{"detail": {"message": "...", "errors": {"<field_id>": "message"}}}`, which the UI maps onto the fields.

## Configuration (`backend/.env`)
`DATABASE_URL`, `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `CORS_ORIGINS`, `REDIS_URL`, `UPLOAD_DIR`,
`EXPORT_DIR`, `MAX_UPLOAD_MB`, `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

## Before going to production
- Set a strong `SECRET_KEY`, change the seeded admin password, serve over HTTPS, restrict `CORS_ORIGINS`.
- Anonymous uploads on public forms are limited by type and size only. Add rate limiting (reverse proxy or
  slowapi) and, if needed, virus scanning.
- The JWT lives in `localStorage`; use short expiries or move to httpOnly cookies if XSS is a concern.
- Store uploads and exports on shared storage (S3 etc.) when running more than one API/worker instance.

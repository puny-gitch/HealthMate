# HealthMate Backend (V1)

## Stack

- Python 3.11+
- FastAPI
- SQLAlchemy + MySQL
- JWT + bcrypt

## Quick Start

1. Install deps

```bash
pip install -r requirements.txt
```

2. Create `.env` from `.env.example` and fill your MySQL config.
3. Run server

```bash
uvicorn app.main:app --reload --port 8080
```

4. Open docs: `http://localhost:8080/docs`

## API Prefix

- `/api`

## Implemented Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/profile`
- `PUT /api/profile`
- `POST /api/health/data`
- `GET /api/health/dashboard`
- `GET /api/health/trends`
- `GET /api/health/export`
- `GET /api/advice/history`
- `GET /api/advice/stream` (SSE)
- `POST /api/task/check`
- `GET /api/task/history`

## Notes

- V1 uses mock AI advice provider by default (`AI_MODE=mock`).
- Redis / Celery / real LLM integration are reserved for phase 2.
- Interface mapping comments:
  - Doc `POST /api/user/profile` -> implemented as `POST /api/profile` (matches current frontend).
  - Doc `GET /api/health/trend` -> implemented as `GET /api/health/trends` (matches current frontend).
  - Doc `GET /api/health/daily-report` -> phase-2 alias to `GET /api/advice/stream`.




Implemented the backend V1 scaffold and core features in **backend**, aligned to your frontend API paths, with MySQL + FastAPI + JWT in place.

### What I built

* Full backend app structure (**api/router/service/repository/model/schema/core/db**) under:
  * [app/main.py](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/ZhouWei/.vscode/extensions/openai.chatgpt-26.325.31654-win32-x64/webview/)
  * [app/api/router.py](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/ZhouWei/.vscode/extensions/openai.chatgpt-26.325.31654-win32-x64/webview/)
* Env/config + DB + security:
  * [.env.example](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/ZhouWei/.vscode/extensions/openai.chatgpt-26.325.31654-win32-x64/webview/)
  * [app/core/config.py](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/ZhouWei/.vscode/extensions/openai.chatgpt-26.325.31654-win32-x64/webview/)
  * [app/core/security.py](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/ZhouWei/.vscode/extensions/openai.chatgpt-26.325.31654-win32-x64/webview/)
  * [app/db/session.py](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/ZhouWei/.vscode/extensions/openai.chatgpt-26.325.31654-win32-x64/webview/)
  * [app/db/init_db.py](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/ZhouWei/.vscode/extensions/openai.chatgpt-26.325.31654-win32-x64/webview/)
* ORM models (plus advice history table for **/advice/history**):
  * [app/models/user.py](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/ZhouWei/.vscode/extensions/openai.chatgpt-26.325.31654-win32-x64/webview/)
  * [app/models/health_record.py](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/ZhouWei/.vscode/extensions/openai.chatgpt-26.325.31654-win32-x64/webview/)
  * [app/models/daily_task.py](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/ZhouWei/.vscode/extensions/openai.chatgpt-26.325.31654-win32-x64/webview/)
  * [app/models/health_summary.py](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/ZhouWei/.vscode/extensions/openai.chatgpt-26.325.31654-win32-x64/webview/)
  * [app/models/advice_history.py](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/ZhouWei/.vscode/extensions/openai.chatgpt-26.325.31654-win32-x64/webview/)
* Implemented routes:
  * **POST /api/auth/register**, **POST /api/auth/login**
  * **POST /api/profile**, **PUT /api/profile**
  * **POST /api/health/data**, **POST /api/health/parse**
  * **GET /api/health/dashboard**, **GET /api/health/trends**, **GET /api/health/export** (CSV)
  * **GET /api/advice/history**, **GET /api/advice/stream** (SSE)
  * **POST /api/task/check**, **GET /api/task/history**
* Services + abstractions:
  * risk detector, NLP rule parser, mock advice generator, trend aggregation, task completion service
  * **IAdviceProvider** + **LLMAdviceProvider** placeholder in [app/services/advice.py](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/ZhouWei/.vscode/extensions/openai.chatgpt-26.325.31654-win32-x64/webview/)
* Unified response + exception handling:
  * [app/core/response.py](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/ZhouWei/.vscode/extensions/openai.chatgpt-26.325.31654-win32-x64/webview/)
  * [app/core/exceptions.py](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/ZhouWei/.vscode/extensions/openai.chatgpt-26.325.31654-win32-x64/webview/)
* Basic tests:
  * [tests/test_services.py](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/ZhouWei/.vscode/extensions/openai.chatgpt-26.325.31654-win32-x64/webview/)
* Startup docs:
  * [backend/README.md](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/ZhouWei/.vscode/extensions/openai.chatgpt-26.325.31654-win32-x64/webview/)
  * [backend/requirements.txt](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/ZhouWei/.vscode/extensions/openai.chatgpt-26.325.31654-win32-x64/webview/)

### Validation done

* Ran Python compile check across all backend app files: passed (**OK**).

### Note

* I did **not** run full **pytest** or live server boot here (depends on your local package install + MySQL readiness).

### Next steps

1. **cd backend && pip install -r requirements.txt**
2. Copy **.env.example** to **.env** and fill MySQL connection.
3. Run: **uvicorn app.main:app --reload --port 8080**
4. Open **http://localhost:8080/docs** and start frontend-backend联调.

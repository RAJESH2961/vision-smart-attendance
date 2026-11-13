# Smart Attendance

A face-recognition based college attendance system with role-based access control.

- **Backend**: FastAPI + PostgreSQL + InsightFace (`buffalo_l` model)
- **Frontend**: React + Vite + Tailwind CSS
- **Roles**: Admin, Faculty, Student

## Prerequisites

- Python 3.9+ with a virtual environment (`backend/venv`)
- Node.js 18+ + npm
- PostgreSQL running on `localhost:5433` with a `smart_attendance` database

## Login Credentials

### Admin
- Email: `admin@college.edu`
- Password: `admin123`
- Access: Full system including faculty management

### Faculty
- Email: `faculty@college.edu`
- Password: `faculty123`
- Access: Students, subjects, attendance, reports (read/write)

### Student
- Identifier: Roll number (e.g., `21CSE01`)
- Password: Same as roll number (e.g., `21CSE01`)
- Access: View own attendance status, percentage, and history

> **Note**: If accounts don't exist, run the seed endpoint to create them:
> ```bash
> curl -X POST http://localhost:8000/api/auth/seed
> ```

## Setup

### 1. Backend Setup

```bash
cd backend
python3 -m venv venv          # Create virtual environment (if not exists)
source venv/bin/activate       # Activate virtual environment
pip install -r requirements.txt
```

Configure `backend/.env` with your database settings:

```env
DATABASE_URL=postgresql+psycopg://postgres:your_password@127.0.0.1:5433/smart_attendance
SECRET_KEY=your-secret-key-here
CORS_ORIGINS=http://localhost:5173
HOST=0.0.0.0
PORT=8000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
```

## Running the Project

### Step 1: Start PostgreSQL Database

Ensure PostgreSQL is running and the `smart_attendance` database exists:

```bash
# If using PostgreSQL on port 5433
createdb -h 127.0.0.1 -p 5433 smart_attendance
```

### Step 2: Start Backend (Terminal 1)

```bash
cd backend
source venv/bin/activate
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The backend will:
- Create/update database tables automatically on startup
- Load the InsightFace model on first run
- Start on `http://localhost:8000`
- API documentation available at `http://localhost:8000/docs`

### Step 3: Start Frontend (Terminal 2)

```bash
cd frontend
npm run dev
```

The frontend will start on `http://localhost:5173`

### Step 4: Seed Default Accounts (if needed)

```bash
curl -X POST http://localhost:8000/api/auth/seed
```

This creates the admin, faculty, and ensures students have default passwords.

## Features

### Dashboard
- Summary cards (Total Students, Present Today, Absent Today, Attendance %)
- Today's classes and recent attendance sessions
- Quick actions (Start Attendance, Register Student, View Reports)
- Auto-refresh after attendance sessions

### Student Management
- Organized by Year, Branch, Section
- Search and filter students
- Edit student details and move between sections
- Face registration status (Registered/Pending)
- Profile page with attendance percentage

### Live Attendance
- Year → Branch → Section selection before starting
- Live camera preview with real-time recognition
- Attendance counter (e.g., 8/10 Present)
- Session timer
- Unknown face notifications
- Automatic marking of absent students

### Attendance History
- Filters by Date, Subject, Year, Branch, Section
- Search and pagination
- Export filtered data to CSV

### Reports
- Student-wise attendance
- Section-wise attendance
- Branch-wise attendance
- Subject-wise attendance
- Charts (daily, monthly, by section, by branch)
- CSV downloads

### Subjects Management
- Add/edit/delete subjects
- Subjects include code, name, course, branch, year, semester
- Used in attendance sessions and subject-wise reports

### Role-Based Access
- **Admin**: Full access + faculty management
- **Faculty**: Students, subjects, attendance, reports (read/write)
- **Student**: View own attendance only

## Notes

- The InsightFace `buffalo_l` model downloads on first backend start (~200MB)
- `CAMERA_SOURCE` in `.env` controls the video input — set an RTSP URL for IP cameras
- Face matching threshold is tunable via `FACE_SIMILARITY_THRESHOLD` in `.env`
- Database tables are automatically created/updated on backend startup
- Students without passwords get their roll number as the default password on startup

# app/backend/main.py
from fastapi import Body, FastAPI, HTTPException, Depends, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, Date, Boolean, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from datetime import datetime, timedelta
import os
from typing import List, Optional
import uvicorn
from models import HabitActivity, Project, User, UserCreate, TaskCreate, Task, HabitCreate, Habit, GoalCreate, Goal, UserResponse, NoteCreate, Note, TodoItemCreate, TodoItem, CalendarEventCreate, CalendarEvent, ProjectCreate, ProjectResponse, HabitResponse, TaskResponse, GoalResponse, NoteResponse, TodoItemResponse, CalendarEventResponse
from pydantic import BaseModel

app = FastAPI()

# Create the database directory if it doesn't exist
os.makedirs("app/database", exist_ok=True)

# Database setup
DATABASE_URL = "sqlite:///./app/database/localdb.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Create tables
Base.metadata.create_all(bind=engine)

# CORS middleware to allow frontend to access the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper function to check if user exists
def get_user_or_404(db: Session, user_id: int):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# Authentication endpoints
@app.post("/api/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    new_user = User(username=user.username, password=user.password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/api/login", response_model=UserResponse)
def login_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username, User.password == user.password).first()
    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return db_user

# Task endpoints
@app.post("/api/users/{user_id}/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(user_id: int, task: TaskCreate, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    db_task = Task(
        user_id=user_id,
        title=task.title,
        description=task.description,
        due_date=task.due_date,
        completed=task.completed
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@app.get("/api/users/{user_id}/tasks", response_model=List[TaskResponse])
def get_tasks(user_id: int, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    tasks = db.query(Task).filter(Task.user_id == user_id).all()
    return tasks

@app.get("/api/users/{user_id}/tasks/{task_id}", response_model=TaskResponse)
def get_task(user_id: int, task_id: int, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == user_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@app.put("/api/users/{user_id}/tasks/{task_id}", response_model=TaskResponse)
def update_task(user_id: int, task_id: int, task: TaskCreate, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    db_task = db.query(Task).filter(Task.id == task_id, Task.user_id == user_id).first()
    if db_task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Update task fields
    for key, value in task.dict().items():
        setattr(db_task, key, value)
    
    db.commit()
    db.refresh(db_task)
    return db_task

@app.delete("/api/users/{user_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(user_id: int, task_id: int, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    db_task = db.query(Task).filter(Task.id == task_id, Task.user_id == user_id).first()
    if db_task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db.delete(db_task)
    db.commit()
    return None

# Habit endpoints
@app.post("/api/users/{user_id}/habits", response_model=HabitResponse, status_code=status.HTTP_201_CREATED)
def create_habit(user_id: int, habit: HabitCreate, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    db_habit = Habit(
        user_id=user_id,
        title=habit.title,
        frequency=habit.frequency
    )
    db.add(db_habit)
    db.commit()
    db.refresh(db_habit)
    return db_habit

@app.get("/api/users/{user_id}/habits", response_model=List[HabitResponse])
def get_habits(user_id: int, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    habits = db.query(Habit).filter(Habit.user_id == user_id).all()
    return habits

@app.post("/api/users/{user_id}/habits/{habit_id}/track", status_code=status.HTTP_201_CREATED)
def track_habit(user_id: int, habit_id: int, date: str = None, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == user_id).first()
    if habit is None:
        raise HTTPException(status_code=404, detail="Habit not found")
    
    # Use provided date or today
    activity_date = datetime.strptime(date, "%Y-%m-%d").date() if date else datetime.now().date()
    
    # Check if already tracked for this date
    existing = db.query(HabitActivity).filter(
        HabitActivity.habit_id == habit_id,
        HabitActivity.user_id == user_id,
        HabitActivity.date == activity_date
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Habit already tracked for this date")
    
    # Create new activity
    activity = HabitActivity(
        user_id=user_id,
        habit_id=habit_id,
        date=activity_date
    )
    db.add(activity)
    db.commit()
    
    return {"message": "Habit tracked successfully"}

@app.get("/api/users/{user_id}/habit-activity")
def get_habit_activity(user_id: int, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    # Get the date range (past year)
    today = datetime.now().date()
    one_year_ago = today - timedelta(days=365)
    
    # Get all habit activities for the user in the date range
    activities = db.query(HabitActivity).filter(
        HabitActivity.user_id == user_id,
        HabitActivity.date >= one_year_ago,
        HabitActivity.date <= today
    ).all()
    
    # Create a dictionary to count activities per day
    activity_counts = {}
    for activity in activities:
        date_str = activity.date.isoformat()
        if date_str in activity_counts:
            activity_counts[date_str] += 1
        else:
            activity_counts[date_str] = 1
    
    # Generate the full date range with counts
    result = []
    current_date = one_year_ago
    while current_date <= today:
        date_str = current_date.isoformat()
        count = activity_counts.get(date_str, 0)
        # Cap the count at 4 for the GitHub-style 5-level heatmap (0-4)
        count = min(count, 4)
        result.append({
            "date": date_str,
            "count": count
        })
        current_date += timedelta(days=1)
    
    return result

# Goal endpoints
@app.post("/api/users/{user_id}/goals", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
def create_goal(user_id: int, goal: GoalCreate, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    db_goal = Goal(
        user_id=user_id,
        title=goal.title,
        description=goal.description,
        progress=goal.progress
    )
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)
    return db_goal

@app.get("/api/users/{user_id}/goals", response_model=List[GoalResponse])
def get_goals(user_id: int, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    goals = db.query(Goal).filter(Goal.user_id == user_id).all()
    return goals

@app.put("/api/users/{user_id}/goals/{goal_id}/progress", response_model=GoalResponse)
def update_goal_progress(user_id: int, goal_id: int, progress: int, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    if progress < 0 or progress > 100:
        raise HTTPException(status_code=400, detail="Progress must be between 0 and 100")
    
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user_id).first()
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    goal.progress = progress
    db.commit()
    db.refresh(goal)
    return goal

# Note endpoints
@app.post("/api/users/{user_id}/notes", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
def create_note(user_id: int, note: NoteCreate, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    db_note = Note(
        user_id=user_id,
        title=note.title if note.title else "Untitled",
        content=note.content
    )
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return db_note

@app.get("/api/users/{user_id}/notes", response_model=List[NoteResponse])
def get_notes(user_id: int, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    notes = db.query(Note).filter(Note.user_id == user_id).all()
    return notes

# Todo item endpoints
@app.post("/api/users/{user_id}/todo_items", response_model=TodoItemResponse, status_code=status.HTTP_201_CREATED)
def create_todo_item(user_id: int, todo_item: TodoItemCreate, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    db_todo_item = TodoItem(
        user_id=user_id,
        title=todo_item.title,
        completed=todo_item.completed
    )
    db.add(db_todo_item)
    db.commit()
    db.refresh(db_todo_item)
    return db_todo_item

@app.get("/api/users/{user_id}/todo_items", response_model=List[TodoItemResponse])
def get_todo_items(user_id: int, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    todo_items = db.query(TodoItem).filter(TodoItem.user_id == user_id).all()
    return todo_items

# Calendar event endpoints
@app.post("/api/users/{user_id}/calendar_events", response_model=CalendarEventResponse, status_code=status.HTTP_201_CREATED)
def create_calendar_event(user_id: int, event: CalendarEventCreate, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    db_event = CalendarEvent(
        user_id=user_id,
        title=event.title,
        start_date=event.start_date,
        end_date=event.end_date
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event

@app.get("/api/users/{user_id}/calendar_events", response_model=List[CalendarEventResponse])
def get_calendar_events(user_id: int, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    events = db.query(CalendarEvent).filter(CalendarEvent.user_id == user_id).all()
    return events

# Project endpoints
@app.post("/api/users/{user_id}/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(user_id: int, project: ProjectCreate, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    db_project = Project(
        user_id=user_id,
        name=project.name,
        description=project.description
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

@app.get("/api/users/{user_id}/projects", response_model=List[ProjectResponse])
def get_projects(user_id: int, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    projects = db.query(Project).filter(Project.user_id == user_id).all()
    return projects

# Add this to your imports
import random
from datetime import date, datetime, timedelta

# Add this list of motivational quotes
MOTIVATIONAL_QUOTES = [
    {"text": "The secret of getting ahead is getting started.", "author": "Mark Twain"},
    {"text": "It's hard to beat a person who never gives up.", "author": "Babe Ruth"},
    {"text": "Quality is not an act, it is a habit.", "author": "Aristotle"},
    {"text": "The only way to do great work is to love what you do.", "author": "Steve Jobs"},
    {"text": "You don't have to be great to start, but you have to start to be great.", "author": "Zig Ziglar"},
    {"text": "The best time to plant a tree was 20 years ago. The second best time is now.", "author": "Chinese Proverb"},
    {"text": "Don't watch the clock; do what it does. Keep going.", "author": "Sam Levenson"},
    {"text": "Success is not final, failure is not fatal: It is the courage to continue that counts.", "author": "Winston Churchill"},
    {"text": "Believe you can and you're halfway there.", "author": "Theodore Roosevelt"},
    {"text": "Your time is limited, don't waste it living someone else's life.", "author": "Steve Jobs"}
]

# Add this endpoint to your FastAPI app
@app.get("/api/users/{user_id}/dashboard-summary")
def get_dashboard_summary(user_id: int, db: Session = Depends(get_db)):
    # Check if user exists
    get_user_or_404(db, user_id)
    
    # Get current date
    today = date.today()
    tomorrow = today + timedelta(days=1)
    
    # Count tasks due today or overdue
    tasks_due = db.query(Task).filter(
        Task.user_id == user_id,
        Task.completed == False,
        (Task.due_date <= today) | (Task.due_date == None)
    ).count()
    
    # Count habits that should be done today
    # For simplicity, we'll count all habits
    habits_today = db.query(Habit).filter(
        Habit.user_id == user_id
    ).count()
    
    # Count upcoming events (today and tomorrow)
    upcoming_events = db.query(CalendarEvent).filter(
        CalendarEvent.user_id == user_id,
        CalendarEvent.start_date >= today,
        CalendarEvent.start_date < tomorrow + timedelta(days=1)
    ).count()
    
    # Count tasks and habits completed today
    completed_today = db.query(Task).filter(
        Task.user_id == user_id,
        Task.completed == True,
        # Assuming there's an updated_at field that gets set when a task is completed
        # If not, you might need to add a completed_at field
        Task.updated_at >= datetime.combine(today, datetime.min.time())
    ).count()
    
    # Add habit activities completed today
    completed_today += db.query(HabitActivity).filter(
        HabitActivity.user_id == user_id,
        HabitActivity.date == today
    ).count()
    
    # Get a random motivational quote
    quote = random.choice(MOTIVATIONAL_QUOTES)
    
    return {
        "tasksDue": tasks_due,
        "habitsToday": habits_today,
        "upcomingEvents": upcoming_events,
        "completedToday": completed_today,
        "quote": quote
    }

@app.put("/api/users/{user_id}/tasks/{task_id}", response_model=TaskResponse)
def update_task(user_id: int, task_id: int, task: TaskCreate, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    db_task = db.query(Task).filter(Task.id == task_id, Task.user_id == user_id).first()
    if db_task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check if task is being marked as completed
    was_completed = db_task.completed
    will_be_completed = task.completed
    
    # Update task fields
    for key, value in task.dict().items():
        setattr(db_task, key, value)
    
    # If task is being marked as completed, update the updated_at timestamp
    if not was_completed and will_be_completed:
        db_task.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_task)
    return db_task

# Update this endpoint in your main.py file
@app.put("/api/users/{user_id}/goals/{goal_id}/progress", response_model=GoalResponse)
def update_goal_progress(
    user_id: int, 
    goal_id: int, 
    progress_data: dict = Body(..., example={"progress": 50}), 
    db: Session = Depends(get_db)
):
    # Check if user exists
    get_user_or_404(db, user_id)
    
    # Validate progress value
    progress = progress_data.get("progress")
    if progress is None or not isinstance(progress, int) or progress < 0 or progress > 100:
        raise HTTPException(
            status_code=400, 
            detail="Progress must be an integer between 0 and 100"
        )
    
    # Get the goal
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user_id).first()
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    # Update progress
    goal.progress = progress
    db.commit()
    db.refresh(goal)
    
    return goal


# Add this endpoint to your FastAPI app
@app.get("/api/users/{user_id}/upcoming-events")
def get_upcoming_events(
    user_id: int, 
    days: int = Query(7, description="Number of days to look ahead"),
    db: Session = Depends(get_db)
):
    # Check if user exists
    get_user_or_404(db, user_id)
    
    # Calculate date range
    today = date.today()
    end_date = today + timedelta(days=days)
    
    # Get upcoming events
    events = db.query(CalendarEvent).filter(
        CalendarEvent.user_id == user_id,
        CalendarEvent.start_date >= today,
        CalendarEvent.start_date <= end_date
    ).order_by(CalendarEvent.start_date).all()
    
    # Convert to response format
    result = []
    for event in events:
        result.append({
            "id": event.id,
            "title": event.title,
            "start_date": event.start_date.isoformat(),
            "end_date": event.end_date.isoformat() if event.end_date else None,
            "start_time": event.start_time,
            "end_time": event.end_time,
            "location": event.location
        })
    
    return result

@app.post("/api/users/{user_id}/calendar_events", response_model=CalendarEventResponse, status_code=status.HTTP_201_CREATED)
def create_calendar_event(user_id: int, event: CalendarEventCreate, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    db_event = CalendarEvent(
        user_id=user_id,
        title=event.title,
        start_date=event.start_date,
        end_date=event.end_date,
        start_time=event.start_time,
        end_time=event.end_time,
        location=event.location
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event

# Add this to your imports if not already present
from datetime import date, datetime, timedelta
from typing import List, Optional
from fastapi import Query

# Add this endpoint to your FastAPI app
@app.get("/api/users/{user_id}/recent-tasks")
def get_recent_tasks(
    user_id: int, 
    limit: int = Query(5, description="Number of tasks to return"),
    db: Session = Depends(get_db)
):
    # Check if user exists
    get_user_or_404(db, user_id)
    
    # Get current date
    today = date.today()
    
    # First, get incomplete tasks due today or in the past (overdue)
    overdue_tasks = db.query(Task).filter(
        Task.user_id == user_id,
        Task.completed == False,
        Task.due_date <= today
    ).order_by(Task.due_date).all()
    
    # Then, get upcoming incomplete tasks
    upcoming_tasks = db.query(Task).filter(
        Task.user_id == user_id,
        Task.completed == False,
        Task.due_date > today
    ).order_by(Task.due_date).limit(limit - len(overdue_tasks) if len(overdue_tasks) < limit else 0).all()
    
    # If we still have room, get recently completed tasks
    recently_completed = []
    if len(overdue_tasks) + len(upcoming_tasks) < limit:
        recently_completed = db.query(Task).filter(
            Task.user_id == user_id,
            Task.completed == True
        ).order_by(Task.updated_at.desc()).limit(limit - len(overdue_tasks) - len(upcoming_tasks)).all()
    
    # Combine and sort the tasks
    all_tasks = overdue_tasks + upcoming_tasks + recently_completed
    
    # Convert to response format
    result = []
    for task in all_tasks:
        result.append({
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "due_date": task.due_date.isoformat() if task.due_date else None,
            "completed": task.completed,
            "updated_at": task.updated_at.isoformat() if task.updated_at else None
        })
    
    return result

# Add this endpoint to your FastAPI app
@app.get("/api/users/{user_id}/profile")
def get_user_profile(user_id: int, db: Session = Depends(get_db)):
    # Check if user exists
    user = get_user_or_404(db, user_id)
    
    # Get current date
    today = date.today()
    
    # Count tasks due today or overdue
    tasks_due = db.query(Task).filter(
        Task.user_id == user_id,
        Task.completed == False,
        (Task.due_date <= today) | (Task.due_date == None)
    ).count()
    
    # Count habits
    habits_count = db.query(Habit).filter(
        Habit.user_id == user_id
    ).count()
    
    # Count upcoming events (today and next 7 days)
    upcoming_events = db.query(CalendarEvent).filter(
        CalendarEvent.user_id == user_id,
        CalendarEvent.start_date >= today,
        CalendarEvent.start_date <= today + timedelta(days=7)
    ).count()
    
    # Calculate goal progress
    goals = db.query(Goal).filter(Goal.user_id == user_id).all()
    goal_progress = 0
    if goals:
        goal_progress = sum(goal.progress for goal in goals) / len(goals)
    
    return {
        "id": user.id,
        "name": user.username,
        "tasksDue": tasks_due,
        "habitsToday": habits_count,
        "upcomingEvents": upcoming_events,
        "goalProgress": goal_progress
    }

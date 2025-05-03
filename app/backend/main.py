# app/backend/main.py
from fastapi import Body, FastAPI, HTTPException, Depends, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, Date, Boolean, Text, DateTime, func, or_
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from datetime import datetime, timedelta
import os
from typing import List, Optional
import uvicorn
from models import GoalProgressUpdate, GoalUpdate, HabitActivity, Project, TaskCategory, TaskCategoryCreate, TaskCategoryResponse, TaskReorderRequest, TaskUpdate, User, UserCreate, TaskCreate, Task, HabitCreate, Habit, GoalCreate, Goal, UserResponse, NoteCreate, Note, TodoItemCreate, TodoItem, CalendarEventCreate, CalendarEvent, ProjectCreate, ProjectResponse, HabitResponse, TaskResponse, GoalResponse, NoteResponse, TodoItemResponse, CalendarEventResponse
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


# Task category endpoints
@app.post("/api/users/{user_id}/task-categories", response_model=TaskCategoryResponse, status_code=status.HTTP_201_CREATED)
def create_task_category(user_id: int, category: TaskCategoryCreate, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    db_category = TaskCategory(
        user_id=user_id,
        name=category.name,
        color=category.color
    )
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

@app.get("/api/users/{user_id}/task-categories", response_model=List[TaskCategoryResponse])
def get_task_categories(user_id: int, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    categories = db.query(TaskCategory).filter(TaskCategory.user_id == user_id).all()
    return categories

@app.put("/api/users/{user_id}/task-categories/{category_id}", response_model=TaskCategoryResponse)
def update_task_category(user_id: int, category_id: int, category: TaskCategoryCreate, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    db_category = db.query(TaskCategory).filter(
        TaskCategory.id == category_id, 
        TaskCategory.user_id == user_id
    ).first()
    
    if db_category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    
    db_category.name = category.name
    db_category.color = category.color
    
    db.commit()
    db.refresh(db_category)
    return db_category

@app.delete("/api/users/{user_id}/task-categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task_category(user_id: int, category_id: int, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    db_category = db.query(TaskCategory).filter(
        TaskCategory.id == category_id, 
        TaskCategory.user_id == user_id
    ).first()
    
    if db_category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Update tasks that use this category to have no category
    db.query(Task).filter(
        Task.category_id == category_id,
        Task.user_id == user_id
    ).update({"category_id": None})
    
    db.delete(db_category)
    db.commit()
    return None

# Enhanced task endpoints
@app.post("/api/users/{user_id}/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(user_id: int, task: TaskCreate, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    # Get the highest order value to place new task at the end
    highest_order = db.query(func.max(Task.order)).filter(Task.user_id == user_id).scalar() or -1
    
    db_task = Task(
        user_id=user_id,
        title=task.title,
        description=task.description,
        due_date=task.due_date,
        completed=task.completed,
        priority=task.priority,
        category_id=task.category_id,
        order=highest_order + 1
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@app.get("/api/users/{user_id}/tasks", response_model=List[TaskResponse])
def get_tasks(
    user_id: int, 
    completed: Optional[bool] = None,
    category_id: Optional[int] = None,
    due_date_from: Optional[date] = None,
    due_date_to: Optional[date] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    get_user_or_404(db, user_id)
    
    query = db.query(Task).filter(Task.user_id == user_id)
    
    # Apply filters
    if completed is not None:
        query = query.filter(Task.completed == completed)
    
    if category_id is not None:
        if category_id == 0:  # Special case for uncategorized tasks
            query = query.filter(Task.category_id == None)
        else:
            query = query.filter(Task.category_id == category_id)
    
    if due_date_from is not None:
        query = query.filter(Task.due_date >= due_date_from)
    
    if due_date_to is not None:
        query = query.filter(Task.due_date <= due_date_to)
    
    if search is not None and search.strip():
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Task.title.ilike(search_term),
                Task.description.ilike(search_term)
            )
        )
    
    # Order by order field, then by due date, then by creation date
    tasks = query.order_by(Task.order, Task.due_date, Task.created_at).all()
    return tasks

@app.get("/api/users/{user_id}/tasks/{task_id}", response_model=TaskResponse)
def get_task(user_id: int, task_id: int, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    task = db.query(Task).filter(
        Task.id == task_id, 
        Task.user_id == user_id
    ).first()
    
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return task

@app.put("/api/users/{user_id}/tasks/{task_id}", response_model=TaskResponse)
def update_task(user_id: int, task_id: int, task_update: TaskUpdate, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    task = db.query(Task).filter(
        Task.id == task_id, 
        Task.user_id == user_id
    ).first()
    
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Update only the fields that are provided
    update_data = task_update.dict(exclude_unset=True)
    
    # Check if task is being marked as completed
    was_completed = task.completed
    will_be_completed = update_data.get('completed', was_completed)
    
    for key, value in update_data.items():
        setattr(task, key, value)
    
    # If task is being marked as completed, update the updated_at timestamp
    if not was_completed and will_be_completed:
        task.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(task)
    return task

@app.delete("/api/users/{user_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(user_id: int, task_id: int, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    task = db.query(Task).filter(
        Task.id == task_id, 
        Task.user_id == user_id
    ).first()
    
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db.delete(task)
    db.commit()
    return None

@app.put("/api/users/{user_id}/tasks/reorder", status_code=status.HTTP_200_OK)
def reorder_tasks(user_id: int, reorder_data: TaskReorderRequest, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    # Update each task's order
    for item in reorder_data.taskIds:
        task = db.query(Task).filter(
            Task.id == item.id, 
            Task.user_id == user_id
        ).first()
        
        if task:
            task.order = item.order
    
    db.commit()
    return {"message": "Tasks reordered successfully"}

# Habit models
class Habit(Base):
    __tablename__ = "habits"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    title = Column(String, index=True)
    description = Column(Text, nullable=True)
    frequency = Column(String)  # daily, weekly, monthly
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", backref="habits")

class HabitActivity(Base):
    __tablename__ = "habit_activities"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    habit_id = Column(Integer, ForeignKey('habits.id'))
    date = Column(Date, index=True)
    status = Column(String)  # done, skipped, none
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", backref="habit_activities")
    habit = relationship("Habit", backref="activities")

# Pydantic models for habits
class HabitBase(BaseModel):
    title: str
    description: Optional[str] = None
    frequency: str  # daily, weekly, monthly

class HabitCreate(HabitBase):
    pass

class HabitUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    frequency: Optional[str] = None

class HabitResponse(HabitBase):
    id: int
    user_id: int
    created_at: datetime
    
    class Config:
        orm_mode = True

# Pydantic models for habit activities
class HabitActivityCreate(BaseModel):
    date: date
    status: str  # done, skipped, none

class HabitActivityResponse(BaseModel):
    id: int
    habit_id: int
    date: date
    status: str
    
    class Config:
        orm_mode = True

# Habit endpoints
@app.post("/api/users/{user_id}/habits", response_model=HabitResponse, status_code=status.HTTP_201_CREATED)
def create_habit(user_id: int, habit: HabitCreate, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    db_habit = Habit(
        user_id=user_id,
        title=habit.title,
        description=habit.description,
        frequency=habit.frequency
    )
    db.add(db_habit)
    db.commit()
    db.refresh(db_habit)
    return db_habit

@app.get("/api/users/{user_id}/habits", response_model=List[HabitResponse])
def get_habits(
    user_id: int, 
    frequency: Optional[str] = None,
    db: Session = Depends(get_db)
):
    get_user_or_404(db, user_id)
    
    query = db.query(Habit).filter(Habit.user_id == user_id)
    
    if frequency:
        query = query.filter(Habit.frequency == frequency)
    
    habits = query.order_by(Habit.created_at).all()
    return habits

@app.get("/api/users/{user_id}/habits/{habit_id}", response_model=HabitResponse)
def get_habit(user_id: int, habit_id: int, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    habit = db.query(Habit).filter(
        Habit.id == habit_id, 
        Habit.user_id == user_id
    ).first()
    
    if habit is None:
        raise HTTPException(status_code=404, detail="Habit not found")
    
    return habit

@app.put("/api/users/{user_id}/habits/{habit_id}", response_model=HabitResponse)
def update_habit(user_id: int, habit_id: int, habit_update: HabitUpdate, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    habit = db.query(Habit).filter(
        Habit.id == habit_id, 
        Habit.user_id == user_id
    ).first()
    
    if habit is None:
        raise HTTPException(status_code=404, detail="Habit not found")
    
    # Update only the fields that are provided
    update_data = habit_update.dict(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(habit, key, value)
    
    db.commit()
    db.refresh(habit)
    return habit

@app.delete("/api/users/{user_id}/habits/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_habit(user_id: int, habit_id: int, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    habit = db.query(Habit).filter(
        Habit.id == habit_id, 
        Habit.user_id == user_id
    ).first()
    
    if habit is None:
        raise HTTPException(status_code=404, detail="Habit not found")
    
    # Delete associated activities
    db.query(HabitActivity).filter(HabitActivity.habit_id == habit_id).delete()
    
    db.delete(habit)
    db.commit()
    return None

@app.post("/api/users/{user_id}/habits/{habit_id}/track", response_model=HabitActivityResponse)
def track_habit(
    user_id: int, 
    habit_id: int, 
    activity: HabitActivityCreate, 
    db: Session = Depends(get_db)
):
    get_user_or_404(db, user_id)
    
    habit = db.query(Habit).filter(
        Habit.id == habit_id, 
        Habit.user_id == user_id
    ).first()
    
    if habit is None:
        raise HTTPException(status_code=404, detail="Habit not found")
    
    # Check if activity already exists for this date
    existing_activity = db.query(HabitActivity).filter(
        HabitActivity.habit_id == habit_id,
        HabitActivity.date == activity.date
    ).first()
    
    if existing_activity:
        # Update existing activity
        if activity.status == 'none':
            # Delete the activity if status is none
            db.delete(existing_activity)
            db.commit()
            return HabitActivityResponse(
                id=0,
                habit_id=habit_id,
                date=activity.date,
                status='none'
            )
        else:
            existing_activity.status = activity.status
            existing_activity.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(existing_activity)
            return existing_activity
    elif activity.status != 'none':
        # Create new activity only if status is not none
        new_activity = HabitActivity(
            user_id=user_id,
            habit_id=habit_id,
            date=activity.date,
            status=activity.status
        )
        db.add(new_activity)
        db.commit()
        db.refresh(new_activity)
        return new_activity
    else:
        # Return a dummy response for 'none' status when no activity exists
        return HabitActivityResponse(
            id=0,
            habit_id=habit_id,
            date=activity.date,
            status='none'
        )

@app.get("/api/users/{user_id}/habit-activities")
def get_habit_activities(
    user_id: int, 
    habit_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    get_user_or_404(db, user_id)
    
    query = db.query(HabitActivity).filter(HabitActivity.user_id == user_id)
    
    if habit_id:
        query = query.filter(HabitActivity.habit_id == habit_id)
    
    if start_date:
        query = query.filter(HabitActivity.date >= start_date)
    
    if end_date:
        query = query.filter(HabitActivity.date <= end_date)
    
    activities = query.all()
    
    # Convert to response format
    result = []
    for activity in activities:
        result.append({
            "id": activity.id,
            "habit_id": activity.habit_id,
            "date": activity.date.isoformat(),
            "status": activity.status
        })
    
    return result

@app.get("/api/users/{user_id}/habit-stats")
def get_habit_stats(
    user_id: int, 
    habit_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    get_user_or_404(db, user_id)
    
    # Get all habits for the user
    habits_query = db.query(Habit).filter(Habit.user_id == user_id)
    
    if habit_id:
        habits_query = habits_query.filter(Habit.id == habit_id)
    
    habits = habits_query.all()
    
    # Calculate stats for each habit
    result = []
    for habit in habits:
        # Get all activities for this habit
        activities = db.query(HabitActivity).filter(
            HabitActivity.habit_id == habit.id,
            HabitActivity.status == 'done'
        ).all()
        
        # Calculate current streak
        today = date.today()
        current_streak = 0
        
        # Check backwards from yesterday
        check_date = today - timedelta(days=1)
        
        while True:
            activity = db.query(HabitActivity).filter(
                HabitActivity.habit_id == habit.id,
                HabitActivity.date == check_date
            ).first()
            
            if activity and activity.status == 'done':
                current_streak += 1
                check_date -= timedelta(days=1)
            else:
                # Check if there's a skipped activity
                skipped = db.query(HabitActivity).filter(
                    HabitActivity.habit_id == habit.id,
                    HabitActivity.date == check_date,
                    HabitActivity.status == 'skipped'
                ).first()
                
                if skipped:
                    # Skipped days don't break the streak
                    check_date -= timedelta(days=1)
                else:
                    break
        
        # Calculate completion rate
        total_days = (today - habit.created_at.date()).days + 1
        completion_rate = len(activities) / total_days if total_days > 0 else 0
        
        result.append({
            "habit_id": habit.id,
            "title": habit.title,
            "frequency": habit.frequency,
            "total_completions": len(activities),
            "current_streak": current_streak,
            "completion_rate": round(completion_rate * 100, 2)
        })
    
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

# Goal endpoints
@app.post("/api/users/{user_id}/goals", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
def create_goal(user_id: int, goal: GoalCreate, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    # If goal is marked as completed, set progress to 100%
    if goal.completed and goal.progress < 100:
        goal.progress = 100
    
    db_goal = Goal(
        user_id=user_id,
        title=goal.title,
        description=goal.description,
        progress=goal.progress,
        completed=goal.completed
    )
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)
    return db_goal

@app.get("/api/users/{user_id}/goals", response_model=List[GoalResponse])
def get_goals(
    user_id: int, 
    completed: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    get_user_or_404(db, user_id)
    
    query = db.query(Goal).filter(Goal.user_id == user_id)
    
    if completed is not None:
        query = query.filter(Goal.completed == completed)
    
    goals = query.order_by(Goal.created_at.desc()).all()
    return goals

@app.get("/api/users/{user_id}/goals/{goal_id}", response_model=GoalResponse)
def get_goal(user_id: int, goal_id: int, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    goal = db.query(Goal).filter(
        Goal.id == goal_id, 
        Goal.user_id == user_id
    ).first()
    
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    return goal

@app.put("/api/users/{user_id}/goals/{goal_id}", response_model=GoalResponse)
def update_goal(user_id: int, goal_id: int, goal_update: GoalUpdate, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    goal = db.query(Goal).filter(
        Goal.id == goal_id, 
        Goal.user_id == user_id
    ).first()
    
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    # Update only the fields that are provided
    update_data = goal_update.dict(exclude_unset=True)
    
    # If goal is being marked as completed, set progress to 100%
    if update_data.get('completed') and not goal.completed:
        update_data['progress'] = 100
    
    # If progress is being set to 100%, mark as completed
    if update_data.get('progress') == 100 and not goal.completed:
        update_data['completed'] = True
    
    # If goal is being marked as not completed, and progress was 100%, reset progress
    if 'completed' in update_data and not update_data['completed'] and goal.progress == 100:
        update_data['progress'] = 0
    
    for key, value in update_data.items():
        setattr(goal, key, value)
    
    goal.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(goal)
    return goal

@app.put("/api/users/{user_id}/goals/{goal_id}/progress", response_model=GoalResponse)
def update_goal_progress(
    user_id: int, 
    goal_id: int, 
    progress_update: GoalProgressUpdate, 
    db: Session = Depends(get_db)
):
    get_user_or_404(db, user_id)
    
    goal = db.query(Goal).filter(
        Goal.id == goal_id, 
        Goal.user_id == user_id
    ).first()
    
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    # Update progress
    goal.progress = progress_update.progress
    
    # If progress is 100%, mark as completed
    if goal.progress == 100:
        goal.completed = True
    # If progress is less than 100% but goal was completed, mark as not completed
    elif goal.progress < 100 and goal.completed:
        goal.completed = False
    
    goal.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(goal)
    return goal

@app.delete("/api/users/{user_id}/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(user_id: int, goal_id: int, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    goal = db.query(Goal).filter(
        Goal.id == goal_id, 
        Goal.user_id == user_id
    ).first()
    
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    db.delete(goal)
    db.commit()
    return None

# Todo endpoints
@app.post("/api/users/{user_id}/todos", response_model=TodoItemResponse, status_code=status.HTTP_201_CREATED)
def create_todo(user_id: int, todo: TodoItemCreate, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    db_todo = TodoItem(
        user_id=user_id,
        title=todo.title
    )
    db.add(db_todo)
    db.commit()
    db.refresh(db_todo)
    return db_todo

@app.get("/api/users/{user_id}/todos", response_model=List[TodoItemResponse])
def get_todos(
    user_id: int, 
    completed: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    get_user_or_404(db, user_id)
    
    query = db.query(TodoItem).filter(TodoItem.user_id == user_id)
    
    if completed is not None:
        query = query.filter(TodoItem.completed == completed)
    
    todos = query.order_by(TodoItem.created_at).all()
    return todos

@app.get("/api/users/{user_id}/todos/{todo_id}", response_model=TodoItemResponse)
def get_todo(user_id: int, todo_id: int, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    todo = db.query(TodoItem).filter(
        TodoItem.id == todo_id, 
        TodoItem.user_id == user_id
    ).first()
    
    if todo is None:
        raise HTTPException(status_code=404, detail="Todo not found")
    
    return todo

@app.put("/api/users/{user_id}/todos/{todo_id}", response_model=TodoItemResponse)
def update_todo(user_id: int, todo_id: int, todo_update: TodoItemUpdate, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    todo = db.query(TodoItem).filter(
        TodoItem.id == todo_id, 
        TodoItem.user_id == user_id
    ).first()
    
    if todo is None:
        raise HTTPException(status_code=404, detail="Todo not found")
    
    # Update only the fields that are provided
    update_data = todo_update.dict(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(todo, key, value)
    
    todo.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(todo)
    return todo

@app.delete("/api/users/{user_id}/todos/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo(user_id: int, todo_id: int, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    todo = db.query(TodoItem).filter(
        TodoItem.id == todo_id, 
        TodoItem.user_id == user_id
    ).first()
    
    if todo is None:
        raise HTTPException(status_code=404, detail="Todo not found")
    
    db.delete(todo)
    db.commit()
    return None

@app.delete("/api/users/{user_id}/todos/clear-completed", status_code=status.HTTP_204_NO_CONTENT)
def clear_completed_todos(user_id: int, db: Session = Depends(get_db)):
    get_user_or_404(db, user_id)
    
    db.query(TodoItem).filter(
        TodoItem.user_id == user_id,
        TodoItem.completed == True
    ).delete(synchronize_session=False)
    
    db.commit()
    return None
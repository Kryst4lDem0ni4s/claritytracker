# app/backend/main.py
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, Date, Boolean, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from datetime import date, datetime, timedelta
import os
from typing import List, Optional
from pydantic import BaseModel, Field

Base = declarative_base()

# Database models
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)  # In a real app, this should be hashed
    created_at = Column(DateTime, default=datetime.utcnow)

class Note(Base):
    __tablename__ = "notes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    title = Column(String, index=True, default="Untitled")
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", backref="notes")
    
class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    name = Column(String, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", backref="projects")
    
# Pydantic models for API
class UserCreate(BaseModel):
    username: str
    password: str

class NoteCreate(BaseModel):
    content: str


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

class AnalyticsDataCreate(BaseModel):
    data_type: str
    data_json: str
    
        
# Task category model
class TaskCategory(Base):
    __tablename__ = "task_categories"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    name = Column(String, index=True)
    color = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", backref="task_categories")

# Update Task model to include additional fields
class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    title = Column(String, index=True)
    description = Column(Text, nullable=True)
    due_date = Column(Date, nullable=True)
    completed = Column(Boolean, default=False)
    priority = Column(String, nullable=True)  # high, medium, low
    category_id = Column(Integer, ForeignKey('task_categories.id'), nullable=True)
    order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", backref="tasks")
    category = relationship("TaskCategory", backref="tasks")

# Pydantic models for task categories
class TaskCategoryBase(BaseModel):
    name: str
    color: Optional[str] = None

class TaskCategoryCreate(TaskCategoryBase):
    pass

class TaskCategoryResponse(TaskCategoryBase):
    id: int
    user_id: int
    created_at: datetime
    
    class Config:
        orm_mode = True

# Update Task Pydantic models
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[date] = None
    completed: bool = False
    priority: Optional[str] = None
    category_id: Optional[int] = None
    order: Optional[int] = None

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[date] = None
    completed: Optional[bool] = None
    priority: Optional[str] = None
    category_id: Optional[int] = None
    order: Optional[int] = None

class TaskResponse(TaskBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True

# Task reordering model
class TaskReorderItem(BaseModel):
    id: int
    order: int

class TaskReorderRequest(BaseModel):
    taskIds: List[TaskReorderItem]  

class Habit(Base):
    __tablename__ = "habits"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    title = Column(String, index=True)
    frequency = Column(String)  # daily, weekly, etc.
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", backref="habits")

class HabitBase(BaseModel):
    title: str
    frequency: str = "daily"  # daily, weekly, monthly

class HabitCreate(HabitBase):
    pass

class HabitResponse(HabitBase):
    id: int
    user_id: int
    created_at: datetime
    
    class Config:
        orm_mode = True

class HabitActivity(Base):
    __tablename__ = "habit_activities"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    habit_id = Column(Integer, ForeignKey('habits.id'))
    date = Column(Date, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", backref="habit_activities")
    habit = relationship("Habit", backref="activities")
    
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

# Add relationships to User model
User.tasks = relationship("Task", back_populates="user", cascade="all, delete-orphan")
User.goals = relationship("Goal", back_populates="user", cascade="all, delete-orphan")
User.habits = relationship("Habit", back_populates="user", cascade="all, delete-orphan")
User.notes = relationship("Note", back_populates="user", cascade="all, delete-orphan")
User.todo_items = relationship("TodoItem", back_populates="user", cascade="all, delete-orphan")
User.calendar_events = relationship("CalendarEvent", back_populates="user", cascade="all, delete-orphan")
User.projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")
User.analytics_data = relationship("AnalyticsData", back_populates="user", cascade="all, delete-orphan")
# Add relationship to User and Habit models
User.habit_activities = relationship("HabitActivity", back_populates="user", cascade="all, delete-orphan")
Habit.activities = relationship("HabitActivity", back_populates="habit", cascade="all, delete-orphan")

# Pydantic models for API
class UserCreate(BaseModel):
    username: str
    password: str


class NoteCreate(BaseModel):
    content: str

class TodoItem(Base):
    __tablename__ = "todo_items"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    title = Column(String, index=True)
    completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", backref="todo_items")

# Pydantic models for todos
class TodoItemBase(BaseModel):
    title: str
    completed: bool = False

class TodoItemCreate(BaseModel):
    title: str

class TodoItemUpdate(BaseModel):
    title: Optional[str] = None
    completed: Optional[bool] = None

class TodoItemResponse(TodoItemBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

class AnalyticsDataCreate(BaseModel):
    data_type: str
    data_json: str

# User models
class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime
    
    class Config:
        orm_mode = True

# Note models
class NoteBase(BaseModel):
    title: Optional[str] = "Untitled"
    content: str

class NoteCreate(NoteBase):
    pass

class NoteResponse(NoteBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True

# Project models
class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectResponse(ProjectBase):
    id: int
    user_id: int
    created_at: datetime
    
    class Config:
        orm_mode = True

class Goal(Base):
    __tablename__ = "goals"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    title = Column(String, index=True)
    description = Column(Text, nullable=True)
    progress = Column(Integer, default=0)  # 0-100 percent
    completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", backref="goals")

# Pydantic models for goals
class GoalBase(BaseModel):
    title: str
    description: Optional[str] = None
    progress: int = Field(0, ge=0, le=100)
    completed: bool = False

class GoalCreate(GoalBase):
    pass

class GoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    progress: Optional[int] = Field(None, ge=0, le=100)
    completed: Optional[bool] = None

class GoalResponse(GoalBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True

class GoalProgressUpdate(BaseModel):
    progress: int = Field(..., ge=0, le=100)

# Update the CalendarEvent model to include time and location
class CalendarEvent(Base):
    __tablename__ = "calendar_events"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    title = Column(String, index=True)
    start_date = Column(Date)
    end_date = Column(Date, nullable=True)
    start_time = Column(String, nullable=True)  # Store as HH:MM format
    end_time = Column(String, nullable=True)    # Store as HH:MM format
    location = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(datetime.timezone.utc))
    
    user = relationship("User", backref="calendar_events")

class CalendarEventBase(BaseModel):
    title: str
    start_date: datetime
    end_date: Optional[datetime] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    location: Optional[str] = None

class CalendarEventCreate(CalendarEventBase):
    pass

class CalendarEventResponse(CalendarEventBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        orm_mode = True
    
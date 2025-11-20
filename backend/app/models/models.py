# backend/app/models/models.py
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
import datetime

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    firebase_uid = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, index=True, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    doc_type = Column(String, nullable=False)  # "DOCX" or "PPTX"
    main_prompt = Column(Text, nullable=True)
    config = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.datetime.utcnow,
        onupdate=datetime.datetime.utcnow,
    )

    user = relationship("User")
    items = relationship(
        "Item", back_populates="project", cascade="all, delete-orphan"
    )


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    title = Column(String, nullable=False)
    order = Column(Integer, nullable=False)
    type = Column(String, nullable=False)  # "SECTION" or "SLIDE"
    content = Column(Text, nullable=True)

    project = relationship("Project", back_populates="items")

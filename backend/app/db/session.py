# # backend/app/db/session.py
# import os
# from dotenv import load_dotenv
# from sqlalchemy import create_engine
# from sqlalchemy.orm import sessionmaker

# load_dotenv()

# DATABASE_URL = os.getenv("DATABASE_URL")

# if not DATABASE_URL:
#     raise RuntimeError("DATABASE_URL is not set in .env")

# engine = create_engine(DATABASE_URL, future=True)
# SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)



# backend/app/db/session.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import QueuePool

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable not set")

Base = declarative_base()

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,   # required for server environments
    pool_size=2,           # small client pool (Render)
    max_overflow=3,        # allow little burst
    pool_timeout=30,
    pool_pre_ping=True,    # avoid stale connections
    future=True,
    connect_args={"sslmode": "require"}  # REQUIRED for Neon
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

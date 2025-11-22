import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL") or "postgresql://neondb_owner:npg_I2ivDUY5jVbQ@ep-falling-smoke-aewnh57h-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
print("Testing DB:", DATABASE_URL[:80], "...")

engine = create_engine(DATABASE_URL, future=True, pool_pre_ping=True)

with engine.connect() as conn:
    r = conn.execute(text("SELECT current_database(), version();"))
    print("OK:", r.all())

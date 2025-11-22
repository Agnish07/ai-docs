# backend/alembic/env.py
from logging.config import fileConfig
import os
import sys
from sqlalchemy import engine_from_config, pool
from alembic import context

# Alembic Config object
config = context.config

# Logging config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Allow importing the `app` package: make sure Python can find backend/ so `import app...` works.
# env.py is at backend/alembic/env.py -> parent dir is backend/
here = os.path.abspath(os.path.dirname(__file__))
project_root = os.path.abspath(os.path.join(here, ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Use DATABASE_URL env var if present (so we don't hardcode credentials in alembic.ini).
db_url = os.getenv("DATABASE_URL")
if db_url:
    config.set_main_option("sqlalchemy.url", db_url)

# Import your models' metadata for autogenerate support.
try:
    # Adjust path if your models are elsewhere; this matches your repo structure.
    from app.models.models import Base  # noqa: E402
    target_metadata = Base.metadata
except Exception as exc:
    # If import fails, autogeneration will be disabled but migrations still work.
    target_metadata = None
    # Print helpful message to logs so you can debug import issues.
    print("WARNING: Could not import app.models.models.Base (autogenerate disabled):", exc)

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    if not url:
        raise RuntimeError(
            "No sqlalchemy.url set in alembic config and DATABASE_URL env var not provided."
        )
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

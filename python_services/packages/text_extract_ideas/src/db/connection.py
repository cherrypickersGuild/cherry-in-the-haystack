import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from dotenv import load_dotenv

from src.db.models import Base

# Load environment variables
load_dotenv()


def get_database_url() -> str:
    db_url = os.getenv("DATABASE_URL")

    if db_url:
        return db_url

    # Default to SQLite for local development
    sqlite_path = os.path.join(os.getcwd(), "local_dev.db")
    return f"sqlite:///{sqlite_path}"


def create_db_engine(echo: bool = False):
    url = get_database_url()

    # PostgreSQL-specific settings
    if url.startswith("postgresql"):
        return create_engine(
            url,
            echo=echo,
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True,  # Verify connections before using
        )

    # SQLite settings
    return create_engine(
        url,
        echo=echo,
        connect_args={"check_same_thread": False},  # SQLite only
    )


def get_session_maker(engine=None) -> sessionmaker:
    if engine is None:
        engine = create_db_engine()

    return sessionmaker(bind=engine, autocommit=False, autoflush=False)


def init_db(engine=None) -> None:
    if engine is None:
        engine = create_db_engine()

    Base.metadata.create_all(bind=engine)


def get_session() -> Session:
    SessionLocal = get_session_maker()
    return SessionLocal()

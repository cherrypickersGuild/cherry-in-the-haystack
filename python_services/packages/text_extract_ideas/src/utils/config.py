from dataclasses import dataclass
from typing import List


@dataclass
class ParagraphChunkingConfig:

    # Paragraph length constraints
    MIN_PARAGRAPH_LENGTH: int = 50  # Minimum characters for a paragraph
    MAX_PARAGRAPH_LENGTH: int = 3000  # Maximum characters before splitting

    # Header/footer detection
    HEADER_MAX_LENGTH: int = 50  # Maximum length for header detection

    # Code block detection
    MIN_CODE_INDENT: int = 4  # Minimum spaces for code block detection

    # Sentence splitting patterns
    SENTENCE_ENDINGS: List[str] = None

    def __post_init__(self):
        if self.SENTENCE_ENDINGS is None:
            self.SENTENCE_ENDINGS = [". ", "! ", "? ", ".\n", "!\n", "?\n"]


@dataclass
class RetryConfig:

    # Retry attempts
    MAX_RETRY_ATTEMPTS: int = 3  # Maximum number of retry attempts

    # Exponential backoff delays (seconds)
    RETRY_DELAYS: List[int] = None

    # Exceptions to retry
    RETRYABLE_EXCEPTIONS: tuple = (Exception,)

    def __post_init__(self):
        """Initialize default values for mutable fields."""
        if self.RETRY_DELAYS is None:
            self.RETRY_DELAYS = [1, 2, 4]  # 1s, 2s, 4s exponential backoff


@dataclass
class ProcessingConfig:

    # Batch processing
    DEFAULT_BATCH_SIZE: int = 10  # Number of pages per batch checkpoint

    # Parallel processing
    MAX_WORKERS: int = 4  # Maximum concurrent workers for parallel processing

    # Model configuration
    DEFAULT_MODEL_VERSION: str = "gemini-2.5-flash"

    # Progress tracking
    STUCK_PAGE_TIMEOUT_MINUTES: int = 30  # Consider page stuck after this time

    # Logging
    LOG_LEVEL: str = "INFO"
    JSON_LOGGING: bool = False  # Use JSON format for production


@dataclass
class ApplicationConfig:

    chunking: ParagraphChunkingConfig = None
    retry: RetryConfig = None
    processing: ProcessingConfig = None

    def __post_init__(self):
        """Initialize default configurations."""
        if self.chunking is None:
            self.chunking = ParagraphChunkingConfig()
        if self.retry is None:
            self.retry = RetryConfig()
        if self.processing is None:
            self.processing = ProcessingConfig()


# Global configuration instance
config = ApplicationConfig()


def get_config() -> ApplicationConfig:
    
    return config


def update_config(**kwargs) -> None:
    global config

    for key, value in kwargs.items():
        # Check which config section contains the key
        if hasattr(config.chunking, key):
            setattr(config.chunking, key, value)
        elif hasattr(config.retry, key):
            setattr(config.retry, key, value)
        elif hasattr(config.processing, key):
            setattr(config.processing, key, value)
        else:
            raise ValueError(f"Unknown configuration key: {key}")

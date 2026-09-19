import datetime
from pathlib import Path

LOG_FILE = Path(__file__).resolve().parent.parent / "app.log"


def log_run_start():
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write("\n\n")
        f.write(f"=== RUN START: {timestamp} ===\n\n")


def log_message(message: str):
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(f"[{timestamp}] {message}\n")

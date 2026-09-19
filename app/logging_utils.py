import datetime
from pathlib import Path

LOG_FILE = Path(__file__).resolve().parent.parent / "app.log"


def log_run_start(run_title: str = "RUN START"):
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write("\n\n")
        f.write("=" * 65 + "\n")
        f.write(f"=== {run_title.upper()}: {timestamp} ===\n")
        f.write("=" * 65 + "\n\n")


def log_message(message: str):
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(f"[{timestamp}] {message}\n")


def log_run_end(summary_message: str = ""):
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with LOG_FILE.open("a", encoding="utf-8") as f:
        if summary_message:
            f.write(f"[{timestamp}] {summary_message}\n")
        f.write("\n" + "-" * 65 + "\n")
        f.write(f"=== RUN END: {timestamp} ===\n")
        f.write("=" * 65 + "\n\n")

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REFRESH_MARTS = ROOT / 'scripts' / 'refresh_marts.py'


def trigger_marts_refresh_background() -> None:
    subprocess.Popen(
        [sys.executable, str(REFRESH_MARTS)],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )


def trigger_marts_refresh_sync() -> None:
    result = subprocess.run(
        [sys.executable, str(REFRESH_MARTS)],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    if result.returncode == 0:
        return

    stderr = (result.stderr or '').strip()
    stdout = (result.stdout or '').strip()
    details = stderr or stdout or 'refresh_marts.py failed'
    raise RuntimeError(details[-4000:])

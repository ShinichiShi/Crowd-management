#!/usr/bin/env python
"""Install trained weights (from a Kaggle run) into backend/models/ and verify they load.

Examples
  python scripts/install_models.py ~/Downloads/backend_models            # folder from the notebook output
  python scripts/install_models.py ~/Downloads/output.zip                # zip downloaded from Kaggle > Output
  python scripts/install_models.py --kaggle <user>/<notebook-slug>       # needs the Kaggle CLI + ~/.kaggle/kaggle.json

Existing weights are backed up to models/_backup_<timestamp>/ and restored if the new ones fail to load.
Result CSVs found next to the weights are copied to <repo>/results/, figures to <repo>/docs/images/ (with --figures).
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
import time
import zipfile
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
REPO = BACKEND.parent
WEIGHTS = ["csrnet_model.pth", "lstm_model.pth", "lstm_scaler.json"]
RESULTS = [
    "final_test_predictions.csv", "final_forecast_predictions.csv", "final_accuracy_summary.csv",
    "crowd_counts.csv", "usecase_comparison.csv", "lstm_variants.csv", "csrnet_results.json", "results_summary.json",
    "csrnet_history_optimised.csv", "csrnet_history_baseline.csv", "lstm_history.csv",
]


def find(root: Path, name: str) -> Path | None:
    hits = sorted(root.rglob(name), key=lambda p: len(p.parts))
    return hits[0] if hits else None


def verify(dest: Path) -> None:
    sys.path.insert(0, str(BACKEND))
    from utils.model_registry import ModelRegistry

    reg = ModelRegistry()
    reg.csrnet = reg._load_csrnet(dest / "csrnet_model.pth")
    scaler = dest / "lstm_scaler.json"
    reg.lstm, seq, norm = reg._load_lstm(dest / "lstm_model.pth", scaler)
    n_c = sum(p.numel() for p in reg.csrnet.parameters())
    n_l = sum(p.numel() for p in reg.lstm.parameters())
    print(f"  CSRNet OK ({n_c:,} params) | LSTM OK ({n_l:,} params, seq_len={seq}, residual={getattr(reg.lstm, 'residual', False)}, "
          f"time_features={reg.lstm_time_features}, scaler={norm.method} [{norm.min_value}, {norm.max_value}])")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("source", nargs="?", help="folder or .zip containing csrnet_model.pth / lstm_model.pth / lstm_scaler.json")
    ap.add_argument("--kaggle", metavar="OWNER/SLUG", help="download the notebook output with the Kaggle CLI first")
    ap.add_argument("--models-dir", type=Path, default=BACKEND / "models")
    ap.add_argument("--figures", action="store_true", help="also copy figures/*.png to docs/images/")
    args = ap.parse_args()

    tmp = Path(tempfile.mkdtemp(prefix="crowd_models_"))
    if args.kaggle:
        print(f"Downloading output of {args.kaggle} ...")
        subprocess.run(["kaggle", "kernels", "output", args.kaggle, "-p", str(tmp)], check=True)
        src = tmp
    elif args.source:
        src = Path(args.source).expanduser()
        if src.suffix == ".zip":
            with zipfile.ZipFile(src) as z:
                z.extractall(tmp)
            src = tmp
    else:
        ap.error("give a folder/zip or --kaggle OWNER/SLUG")

    found = {n: find(src, n) for n in WEIGHTS}
    missing = [n for n in ("csrnet_model.pth", "lstm_model.pth") if not found[n]]
    if missing:
        print("Missing in source:", missing)
        return 1

    dest = args.models_dir
    dest.mkdir(parents=True, exist_ok=True)
    backup = dest / f"_backup_{time.strftime('%Y%m%d_%H%M%S')}"
    backup.mkdir()
    for n in WEIGHTS:
        if (dest / n).exists():
            shutil.copy2(dest / n, backup / n)
    if not found["lstm_scaler.json"] and (dest / "lstm_scaler.json").exists():
        (dest / "lstm_scaler.json").unlink()  # an old scaler must not be mixed with a new model
    for n, p in found.items():
        if p:
            shutil.copy2(p, dest / n)
            print(f"installed {n}  ({p.stat().st_size / 1e6:.1f} MB)")

    print("Verifying load ...")
    try:
        verify(dest)
    except Exception as exc:
        print("VERIFY FAILED:", exc, "\nRestoring previous weights.")
        for f in backup.iterdir():
            shutil.copy2(f, dest / f.name)
        return 2

    (REPO / "results").mkdir(exist_ok=True)
    for n in RESULTS:
        p = find(src, n)
        if p:
            shutil.copy2(p, REPO / "results" / n)
            print(f"results/{n}")
    if args.figures:
        (REPO / "docs" / "images").mkdir(parents=True, exist_ok=True)
        for p in (find(src, "figures") or Path("/nonexistent")).glob("*.png") if find(src, "figures") else []:
            shutil.copy2(p, REPO / "docs" / "images" / p.name)
    print(f"Done. Previous weights kept in {backup}. Restart the API: GET /health should say mode=live.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

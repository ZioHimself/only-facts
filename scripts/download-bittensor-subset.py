"""
Download the last week of the Bittensor Subnet 13 X dataset james-1111/x_dataset_0304209 (https://huggingface.co/datasets/james-1111/x_dataset_0304209) using DuckDB.
Processes one remote parquet file at a time to stay under rate limits
and keep memory usage low.
"""

import duckdb
import json
import os
import sys
import time

CUTOFF_DATE = "2025-07-14"
OUTPUT_FILE = "data/bittensor_last_week.jsonl"
PARQUET_BASE = (
    "https://huggingface.co/api/datasets/"
    "james-1111/x_dataset_0304209/parquet/default/train"
)
NUM_FILES = 236
# Files 0-139 had 0 matches; start from 140 to save time
START_FILE = 140


def main():
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute("SET http_keep_alive = true;")

    print(f"Downloading rows with datetime >= '{CUTOFF_DATE}'")
    print(f"Processing files {START_FILE}-{NUM_FILES - 1} one at a time")
    print(f"Output: {OUTPUT_FILE}", flush=True)
    print()

    start = time.time()
    total_matched = 0

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for file_idx in range(START_FILE, NUM_FILES):
            url = f"{PARQUET_BASE}/{file_idx}.parquet"

            rows = None
            columns = None
            for attempt in range(5):
                try:
                    result = con.execute(
                        f"SELECT * FROM read_parquet('{url}') "
                        f"WHERE datetime >= '{CUTOFF_DATE}'"
                    )
                    columns = [desc[0] for desc in result.description]
                    rows = result.fetchall()
                    break
                except Exception as e:
                    if "429" in str(e) and attempt < 4:
                        wait = 30 * (attempt + 1)
                        print(f"  file {file_idx}: rate-limited, retry in {wait}s", flush=True)
                        time.sleep(wait)
                    else:
                        print(f"  file {file_idx}: FAILED after retries: {e}", flush=True)
                        rows = []
                        break

            if rows is None:
                rows = []

            matched = len(rows)
            total_matched += matched

            for row in rows:
                record = dict(zip(columns, row))
                json.dump(record, f, ensure_ascii=False, default=str)
                f.write("\n")

            elapsed = time.time() - start
            remaining = NUM_FILES - file_idx - 1
            rate = (file_idx - START_FILE + 1) / elapsed if elapsed > 0 else 0
            eta = remaining / rate if rate > 0 else 0

            print(
                f"  file {file_idx:3d}/{NUM_FILES - 1}: "
                f"{matched:>7,} matched | "
                f"total: {total_matched:>10,} | "
                f"ETA ~{eta / 60:.1f} min",
                flush=True,
            )

            # Small delay to be polite to HuggingFace servers
            if matched > 0:
                time.sleep(1)

    elapsed = time.time() - start
    size_mb = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)

    print()
    print(f"Done in {elapsed / 60:.1f} minutes.")
    print(f"  Total matched: {total_matched:,}")
    print(f"  File size: {size_mb:.1f} MB")

    con.close()


if __name__ == "__main__":
    main()

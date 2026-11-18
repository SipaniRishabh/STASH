"""Google Sheet tracker. Agent appends rows only; user owns Status / Next action / Notes.

Setup: credentials/service_account.json + config.json {"sheet_id": "..."}; share the sheet with the service account email.
Usage:
  .venv/bin/python scripts/tracker.py init                 # header, Status dropdown, freeze row
  .venv/bin/python scripts/tracker.py add '<json row>'     # keys = COLUMNS (missing ok); dedupes by URL
  .venv/bin/python scripts/tracker.py list                 # print rows as JSON
  .venv/bin/python scripts/tracker.py has <url>            # exit 0 if already tracked
"""
import json
import sys
from datetime import date
from pathlib import Path

import gspread
from gspread.utils import ValidationConditionType

ROOT = Path(__file__).resolve().parent.parent
COLUMNS = ["Date", "Company", "Role", "Location", "Eligibility", "Posted", "Match", "Confidence",
           "Resume file", "URL", "Source", "Status", "Next action", "Notes"]
STATUSES = ["Applied", "Intro Call Done", "Interview Scheduled", "Passed", "Rejected", "Ghosted"]


def sheet():
    cfg = json.loads((ROOT / "config.json").read_text())
    gc = gspread.service_account(filename=ROOT / cfg.get("service_account_file", "credentials/service_account.json"))
    return gc.open_by_key(cfg["sheet_id"]).sheet1


def col(name):
    return chr(ord("A") + COLUMNS.index(name))


def main():
    cmd, *args = sys.argv[1:] or ["list"]
    ws = sheet()
    if cmd == "init":
        ws.update([COLUMNS], "A1")
        ws.format("A1:N1", {"textFormat": {"bold": True}})
        ws.freeze(rows=1)
        s = col("Status")
        ws.add_validation(f"{s}2:{s}1000", ValidationConditionType.one_of_list, STATUSES, showCustomUi=True)
        print("sheet ready:", ws.spreadsheet.url)
    elif cmd == "add":
        row = json.loads(args[0])
        if row.get("URL") and row["URL"] in ws.col_values(COLUMNS.index("URL") + 1):
            print("already tracked:", row["URL"])
            return
        row.setdefault("Date", date.today().isoformat())
        row.setdefault("Status", "Applied")
        ws.append_row([str(row.get(c, "")) for c in COLUMNS], value_input_option="USER_ENTERED")
        print("added:", row.get("Company"), "|", row.get("Role"))
    elif cmd == "list":
        print(json.dumps(ws.get_all_records(), indent=1, ensure_ascii=False))
    elif cmd == "has":
        sys.exit(0 if args[0] in ws.col_values(COLUMNS.index("URL") + 1) else 1)


if __name__ == "__main__":
    main()

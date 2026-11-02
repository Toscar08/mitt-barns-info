"""Run the exact immutable SQL rules from the applied migration in a temporary schema."""
from pathlib import Path
import re
import subprocess

source = Path("drizzle/migrations/0000_launch_campaign_access.sql").read_text()
functions = []
for name in ("trial_window_eligible", "campaign_access_status"):
    match = re.search(r"CREATE FUNCTION public\." + name + r"\(.*?\$\$;", source, re.S)
    if match is None:
        raise RuntimeError("Missing rule " + name)
    functions.append(match.group().replace("public." + name, "pg_temp." + name))
cases = [
    ("pg_temp.trial_window_eligible('2026-11-30 23:59:59.999Z','2026-11-01Z')", "just before window ends"),
    ("NOT pg_temp.trial_window_eligible('2026-12-01Z','2026-11-01Z')", "exact window boundary"),
    ("NOT pg_temp.trial_window_eligible('2026-12-01 00:00:00.001Z','2026-11-01Z')", "after window ends"),
    ("NOT pg_temp.trial_window_eligible('2026-10-31Z','2026-11-01Z')", "prelaunch excluded"),
    ("NOT pg_temp.trial_window_eligible('2026-11-02Z',NULL)", "no launch excluded"),
    ("pg_temp.campaign_access_status('2026-11-01Z','2026-12-01Z',false,'2026-11-30 23:59:59.999Z')='trial'", "just before expiry"),
    ("pg_temp.campaign_access_status('2026-11-01Z','2026-12-01Z',false,'2026-12-01Z')='paused'", "exact expiry pauses"),
    ("pg_temp.campaign_access_status('2026-11-01Z','2026-12-01Z',true,'2026-12-02Z')='paid'", "verified paid restores"),
    ("pg_temp.campaign_access_status('2026-11-01Z',NULL,false,'2026-12-02Z')='paused'", "late account requires payment"),
    ("'2026-11-30Z'::timestamptz+interval '720 hours'='2026-12-30Z'::timestamptz", "720 hours from registration"),
]
sql = "BEGIN;\n" + "\n".join(functions)
for expression, label in cases:
    sql += f"\nDO $$ BEGIN IF NOT ({expression}) THEN RAISE EXCEPTION '{label}'; END IF; END; $$;"
sql += "\nROLLBACK;"
subprocess.run(["psql", "-X", "-v", "ON_ERROR_STOP=1"], input=sql, text=True, check=True, stdout=subprocess.DEVNULL)
print(f"Passed {len(cases)} exact campaign boundary rules; temporary objects rolled back.")
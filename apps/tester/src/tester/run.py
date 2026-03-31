from __future__ import annotations

import argparse
import os
import sys

from tester.agents import run_uat
from tester.runtime import HarnessError, SCENARIOS, UATRuntime


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the SentientOps OpenAI tester-agent UAT harness.")
    parser.add_argument("--scenario", choices=SCENARIOS, default="full_uat")
    parser.add_argument("--headed", action="store_true", help="Run Playwright in headed mode for manual observation.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        runtime = UATRuntime.from_env(args.scenario)
    except HarnessError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    if args.headed:
        runtime.browser.headless = False

    os.environ["OPENAI_API_KEY"] = runtime.settings.openai_api_key

    assessment = None
    orchestration_error: str | None = None
    report_paths = None
    try:
        assessment = run_uat(runtime)
    except Exception as exc:
        orchestration_error = str(exc)
    finally:
        report = runtime.build_report(assessment, orchestration_error=orchestration_error)
        report_paths = runtime.write_report(report)
        runtime.close()

    print(f"UAT JSON report: {report_paths[0]}")
    print(f"UAT Markdown report: {report_paths[1]}")

    if orchestration_error:
        print(f"UAT harness failed: {orchestration_error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

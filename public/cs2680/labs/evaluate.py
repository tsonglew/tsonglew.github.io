#!/usr/bin/env python3
"""Compare two scripted policies on eight fixed fixtures; all costs are simulated."""

import argparse
import json
import math

from agent_loop import TASKS, run_agent, nonnegative_int


def summarize(results, units_per_1000_tokens=1.0):
    if not math.isfinite(units_per_1000_tokens) or units_per_1000_tokens < 0:
        raise ValueError("units_per_1000_tokens must be finite and non-negative")
    count = len(results)
    successes = sum(result["success"] for result in results)
    tokens = sum(result["simulated_tokens"] for result in results)
    total_cost = tokens * units_per_1000_tokens / 1000
    return {"tasks": count, "successes": successes,
            "success_rate": successes / count if count else None,
            "simulated_tokens": tokens, "simulated_cost_units": total_cost,
            "simulated_cost_per_success": total_cost / successes if successes else None}


def compare(max_steps=6, max_tokens=1024, max_tool_calls=3):
    return [{"strategy": strategy,
             **summarize([run_agent(task, strategy, max_steps, max_tokens, max_tool_calls)
                          for task in TASKS])}
            for strategy in ("direct", "tool")]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-steps", type=nonnegative_int, default=6)
    parser.add_argument("--max-tokens", type=nonnegative_int, default=1024)
    parser.add_argument("--max-tool-calls", type=nonnegative_int, default=3)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    rows = compare(args.max_steps, args.max_tokens, args.max_tool_calls)
    if args.json:
        print(json.dumps({"cost_model": "1 fictional unit per 1000 synthetic tokens",
                          "rows": rows}, indent=2))
        return
    print("OFFLINE FIXTURE EVALUATION | synthetic tokens and fictional cost units")
    print("Success rule: exact answer equality. All 8 fixtures receive equal weight.")
    print("Cost model: 1 fictional unit per 1000 synthetic tokens; not API billing.")
    print("strategy  success     tokens  total units  units/success")
    for row in rows:
        per_success = row["simulated_cost_per_success"]
        per_success_text = "N/A" if per_success is None else f"{per_success:.3f}"
        print(f"{row['strategy']:<9} {row['successes']}/{row['tasks']} ({row['success_rate']:.0%})"
              f"  {row['simulated_tokens']:>5}  {row['simulated_cost_units']:>11.3f}"
              f"  {per_success_text:>13}")


if __name__ == "__main__":
    main()

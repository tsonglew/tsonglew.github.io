#!/usr/bin/env python3
"""Meaningful controller, accounting, and scheduling invariants; no network needed."""

import json
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import agent_loop
import evaluate
import scheduler


class AgentTests(unittest.TestCase):
    def setUp(self):
        self.task = next(task for task in agent_loop.TASKS if task.task_id == "quality")

    def test_schema_error_is_observed_and_repaired(self):
        result = agent_loop.run_agent(self.task)
        observations = [event for event in result["trace"] if event["event"] == "tool_result"]
        self.assertEqual([event["ok"] for event in observations], [False, True])
        self.assertTrue(result["success"])
        self.assertEqual(result["tool_attempts"], 2)
        self.assertEqual(result["model_steps"], 3)

    def test_bad_schema_and_unknown_tools_are_rejected(self):
        for arguments in ({}, {"key": "decode", "shell": "echo bad"}, {"key": []},
                          {"key": 1}, {"key": "missing"}, None):
            with self.subTest(arguments=arguments), self.assertRaises(agent_loop.ToolValidationError):
                agent_loop.lookup(arguments)
        with self.assertRaises(agent_loop.ToolValidationError):
            agent_loop.invoke_tool("shell", {"key": "decode"})

    def test_tool_is_read_only(self):
        before = dict(agent_loop.KNOWLEDGE)
        agent_loop.lookup({"key": "decode"})
        self.assertEqual(before, agent_loop.KNOWLEDGE)

    def test_invalid_attempt_consumes_budget(self):
        result = agent_loop.run_agent(self.task, max_tool_calls=1)
        self.assertFalse(result["success"])
        self.assertEqual(result["tool_attempts"], 1)
        self.assertEqual(result["stop_reason"], "tool_budget")

    def test_zero_step_budget_does_no_work(self):
        result = agent_loop.run_agent(self.task, max_steps=0)
        self.assertEqual(result["stop_reason"], "step_budget")
        self.assertEqual(result["trace"], [])
        self.assertEqual(result["simulated_tokens"], 0)

    def test_zero_token_budget_does_not_charge_or_call_tool(self):
        result = agent_loop.run_agent(self.task, max_tokens=0)
        self.assertEqual(result["stop_reason"], "token_budget")
        self.assertEqual(result["simulated_tokens"], 0)
        self.assertEqual(result["tool_attempts"], 0)

    def test_token_budget_is_never_exceeded(self):
        full = agent_loop.run_agent(self.task)
        for budget in (1, 25, full["simulated_tokens"] - 1, full["simulated_tokens"]):
            with self.subTest(budget=budget):
                result = agent_loop.run_agent(self.task, max_tokens=budget)
                self.assertLessEqual(result["simulated_tokens"], budget)
                self.assertEqual(result["success"], budget == full["simulated_tokens"])

    def test_unexpected_programming_error_is_not_swallowed(self):
        with patch("agent_loop.invoke_tool", side_effect=RuntimeError("broken implementation")):
            with self.assertRaisesRegex(RuntimeError, "broken implementation"):
                agent_loop.run_agent(self.task)

    def test_invalid_configuration_fails_explicitly(self):
        for arguments in ({"max_steps": -1}, {"max_tokens": 1.5},
                          {"max_tool_calls": True}, {"strategy": "unknown"}):
            with self.subTest(arguments=arguments), self.assertRaises(ValueError):
                agent_loop.run_agent(self.task, **arguments)

    def test_character_estimator_rounds_up(self):
        self.assertEqual([agent_loop.estimate_tokens("x" * size) for size in range(6)],
                         [0, 1, 1, 1, 1, 2])


class EvaluationTests(unittest.TestCase):
    def test_default_fixture_successes(self):
        direct, tool = evaluate.compare()
        self.assertEqual((direct["tasks"], direct["successes"]), (8, 4))
        self.assertEqual((tool["tasks"], tool["successes"]), (8, 8))
        self.assertGreater(tool["simulated_tokens"], direct["simulated_tokens"])

    def test_cost_per_success_includes_failed_attempt_spend(self):
        row = evaluate.summarize([{"success": True, "simulated_tokens": 100},
                                  {"success": False, "simulated_tokens": 300}])
        self.assertEqual(row["success_rate"], 0.5)
        self.assertAlmostEqual(row["simulated_cost_per_success"], 0.4)

    def test_zero_success_is_undefined_not_free(self):
        row = evaluate.summarize([{"success": False, "simulated_tokens": 20}])
        self.assertEqual(row["success_rate"], 0)
        self.assertIsNone(row["simulated_cost_per_success"])

    def test_empty_dataset_and_invalid_unit_price(self):
        row = evaluate.summarize([])
        self.assertIsNone(row["success_rate"])
        self.assertIsNone(row["simulated_cost_per_success"])
        for rate in (-1, float("nan"), float("inf")):
            with self.subTest(rate=rate), self.assertRaises(ValueError):
                evaluate.summarize([], rate)


class SchedulerTests(unittest.TestCase):
    def test_single_token_completes_at_next_tick(self):
        result = scheduler.simulate([scheduler.Request("one", 7, 1)])
        self.assertEqual(result["elapsed_ticks"], 1)
        self.assertEqual(result["completions"][0]["finish_tick"], 8)
        self.assertEqual(result["mean_completion_latency_ticks"], 1)
        self.assertEqual(result["tokens_per_tick"], 1)

    def test_default_static_and_continuous_finish_times(self):
        static = scheduler.simulate(mode="static")
        continuous = scheduler.simulate(mode="continuous")
        self.assertEqual(static["elapsed_ticks"], 24)
        self.assertEqual(continuous["elapsed_ticks"], 17)
        self.assertAlmostEqual(static["mean_completion_latency_ticks"], 12.5)
        self.assertAlmostEqual(continuous["mean_completion_latency_ticks"], 47 / 6)
        self.assertEqual(static["output_tokens"], continuous["output_tokens"])

    def test_each_request_generates_exactly_its_token_count(self):
        for mode in ("static", "continuous"):
            result = scheduler.simulate(mode=mode)
            for request in scheduler.DEFAULT_REQUESTS:
                ticks = sum(request.request_id in row["active"] for row in result["timeline"])
                self.assertEqual(ticks, request.output_tokens)
            self.assertTrue(all(len(row["active"]) <= 2 for row in result["timeline"]))

    def test_static_short_request_is_not_marked_finished_at_batch_end(self):
        result = scheduler.simulate(mode="static")
        first = next(item for item in result["completions"] if item["request_id"] == "r1")
        self.assertEqual(first["finish_tick"], 1)

    def test_late_arrival_and_idle_gap_remain_in_elapsed_time(self):
        result = scheduler.simulate([scheduler.Request("a", 4, 1), scheduler.Request("b", 10, 1)])
        self.assertEqual(result["elapsed_ticks"], 7)
        self.assertEqual(result["mean_completion_latency_ticks"], 1)
        self.assertAlmostEqual(result["tokens_per_tick"], 2 / 7)
        self.assertEqual(len(result["timeline"]), 2)

    def test_capacity_one_has_identical_policy_behavior(self):
        static = scheduler.simulate(capacity=1, mode="static")
        continuous = scheduler.simulate(capacity=1, mode="continuous")
        self.assertEqual(static["completions"], continuous["completions"])

    def test_equal_lengths_have_no_continuous_batching_gain(self):
        requests = [scheduler.Request(str(index), 0, 4) for index in range(6)]
        self.assertEqual(scheduler.simulate(requests, mode="static")["elapsed_ticks"],
                         scheduler.simulate(requests, mode="continuous")["elapsed_ticks"])

    def test_invalid_input_rejected(self):
        for requests in ([scheduler.Request("a", -1, 2)], [scheduler.Request("a", 0, 0)],
                         [scheduler.Request("a", 1.5, 2)], [scheduler.Request("a", 0, True)],
                         [scheduler.Request("a", 0, 1), scheduler.Request("a", 1, 2)]):
            with self.subTest(requests=requests), self.assertRaises(ValueError):
                scheduler.simulate(requests)
        for capacity in (0, -1, 1.5, True):
            with self.subTest(capacity=capacity), self.assertRaises(ValueError):
                scheduler.simulate(capacity=capacity)
        with self.assertRaises(ValueError):
            scheduler.simulate(mode="typo")

    def test_empty_workload_is_zero(self):
        result = scheduler.simulate([])
        self.assertEqual(result["elapsed_ticks"], 0)
        self.assertEqual(result["tokens_per_tick"], 0)
        self.assertEqual(result["completions"], [])


class CommandLineTests(unittest.TestCase):
    def run_script(self, filename, *arguments):
        return subprocess.run([sys.executable, "-B", str(Path(__file__).parent / filename), *arguments],
                              capture_output=True, text=True, check=False)

    def test_all_json_interfaces_are_parseable(self):
        for filename in ("agent_loop.py", "evaluate.py", "scheduler.py"):
            result = self.run_script(filename, "--json")
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIsInstance(json.loads(result.stdout), dict)

    def test_invalid_cli_input_exits_nonzero(self):
        for filename, arguments in (("scheduler.py", ("--lengths", "1,0")),
                                    ("scheduler.py", ("--arrivals", "1,2")),
                                    ("agent_loop.py", ("--max-steps", "-1"))):
            result = self.run_script(filename, *arguments)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("error", result.stderr)


if __name__ == "__main__":
    unittest.main(verbosity=2)

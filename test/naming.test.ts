import { expect, test } from "bun:test";
import {
  derivedName,
  isValidToolName,
  sanitizeToolName,
  toolName,
} from "../src/naming.js";

test("sanitize keeps allowed chars", () => {
  expect(sanitizeToolName("listCbJobs")).toBe("listCbJobs");
  expect(sanitizeToolName("list-cb-jobs_v1")).toBe("list-cb-jobs_v1");
});

test("sanitize replaces illegal chars with underscore and collapses runs", () => {
  expect(sanitizeToolName("users.list")).toBe("users_list");
  expect(sanitizeToolName("foo/bar/baz")).toBe("foo_bar_baz");
  expect(sanitizeToolName("a   b---c")).toBe("a_b---c");
});

test("sanitize trims leading and trailing separators", () => {
  expect(sanitizeToolName("__listCbJobs__")).toBe("listCbJobs");
  expect(sanitizeToolName("-foo-")).toBe("foo");
});

test("derivedName renders method and path segments with by_ for params", () => {
  expect(derivedName("get", "/ds-state-api/cb-job/")).toBe("get_ds-state-api_cb-job");
  expect(derivedName("get", "/users/{id}")).toBe("get_users_by_id");
  expect(derivedName("put", "/teams/{team}/members/{userId}")).toBe(
    "put_teams_by_team_members_by_userId",
  );
});

test("toolName prefers sanitized operationId", () => {
  const taken = new Set<string>();
  expect(toolName("listCbJobs", "get", "/ds-state-api/cb-job/", taken)).toBe("listCbJobs");
});

test("toolName falls back to derived when operationId is missing or empty after sanitize", () => {
  const taken = new Set<string>();
  expect(toolName(undefined, "get", "/users/{id}", taken)).toBe("get_users_by_id");
  expect(toolName("...", "get", "/users/{id}", new Set())).toBe("get_users_by_id");
});

test("toolName disambiguates collisions with numeric suffix", () => {
  const taken = new Set<string>();
  expect(toolName("listCbJobs", "get", "/a", taken)).toBe("listCbJobs");
  expect(toolName("listCbJobs", "post", "/a", taken)).toBe("listCbJobs_2");
  expect(toolName("listCbJobs", "delete", "/a", taken)).toBe("listCbJobs_3");
});

test("toolName truncates to 64 chars and reserves room for collision suffix", () => {
  const long = "a".repeat(80);
  const taken = new Set<string>();
  const first = toolName(long, "get", "/x", taken);
  expect(first.length).toBe(64);
  const second = toolName(long, "post", "/x", taken);
  expect(second.length).toBe(64);
  expect(second.endsWith("_2")).toBe(true);
  expect(first).not.toBe(second);
});

test("isValidToolName matches MCP naming rules", () => {
  expect(isValidToolName("listCbJobs")).toBe(true);
  expect(isValidToolName("list_cb_jobs")).toBe(true);
  expect(isValidToolName("a-b_c")).toBe(true);
  expect(isValidToolName("")).toBe(false);
  expect(isValidToolName("a/b")).toBe(false);
  expect(isValidToolName("a".repeat(65))).toBe(false);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { MemoryAppRegistry } from "../app-registry.js";
import { PwaNavError } from "../errors.js";
import {
  CANONICAL_ALIASES,
  isValidDomainFormat,
  resolveNavigationTarget,
} from "../target-resolution.js";

test("isValidDomainFormat: validates domain patterns correctly", () => {
  // Valid domains
  assert.equal(isValidDomainFormat("linkedin.com"), true);
  assert.equal(isValidDomainFormat("www.mercadona.es"), true);
  assert.equal(isValidDomainFormat("sub.domain.co.uk"), true);
  assert.equal(isValidDomainFormat("localhost"), true);
  assert.equal(isValidDomainFormat("localhost:8080"), true);
  assert.equal(isValidDomainFormat("example.org/path?query=1"), true);

  // Invalid formats / bare words / typos
  assert.equal(isValidDomainFormat("linkeding"), false);
  assert.equal(isValidDomainFormat("notebook"), false);
  assert.equal(isValidDomainFormat("search term with spaces"), false);
  assert.equal(isValidDomainFormat(""), false);
  assert.equal(isValidDomainFormat("   "), false);
  assert.equal(isValidDomainFormat(".com"), false);
  assert.equal(isValidDomainFormat("domain."), false);
});

test("resolveNavigationTarget: given full http/https URL, preserves it and resolves slug via registry", async () => {
  // Arrange
  const registry = new MemoryAppRegistry({
    apps: {
      "custom-app": { origins: ["https://app.custom.com"] },
    },
  });

  // Act
  const res = await resolveNavigationTarget("https://app.custom.com/dashboard", registry);

  // Assert
  assert.equal(res.url, "https://app.custom.com/dashboard");
  assert.equal(res.appSlug, "custom-app");
});

test("resolveNavigationTarget: given registered app slug in registry, resolves to declared origin", async () => {
  // Arrange
  const registry = new MemoryAppRegistry({
    apps: {
      mynote: { origins: ["https://notes.corp.internal"] },
    },
  });

  // Act
  const res = await resolveNavigationTarget("mynote", registry);

  // Assert
  assert.equal(res.url, "https://notes.corp.internal");
  assert.equal(res.appSlug, "mynote");
});

test("resolveNavigationTarget: given canonical aliases, resolves correctly", async () => {
  // Act & Assert for common aliases
  for (const [alias, expected] of Object.entries(CANONICAL_ALIASES)) {
    const res = await resolveNavigationTarget(alias);
    assert.equal(res.url, expected.url);
    assert.equal(res.appSlug, expected.slug);
  }
});

test("resolveNavigationTarget: given valid domain without protocol, auto-completes with https://", async () => {
  // Arrange
  const registry = new MemoryAppRegistry();

  // Act
  const res = await resolveNavigationTarget("linkedin.com", registry);

  // Assert
  assert.equal(res.url, "https://linkedin.com");
  assert.equal(res.appSlug, "linkedin-com");
});

test("resolveNavigationTarget: given invalid string or bare typo, fails fast with invalid_args", async () => {
  // Arrange
  const invalidInputs = ["linkeding", "randomsearch", "not a url", ""];

  for (const input of invalidInputs) {
    // Act & Assert
    await assert.rejects(
      async () => resolveNavigationTarget(input),
      (err: unknown) => {
        assert.ok(err instanceof PwaNavError);
        assert.equal(err.code, "invalid_args");
        return true;
      },
    );
  }
});

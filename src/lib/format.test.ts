import { test, expect } from "bun:test";
import { parseTonelada } from "./format";

test("parseTonelada - number", () => {
  expect(parseTonelada(2.7)).toBe(2.7);
  expect(parseTonelada(2700)).toBe(2700);
});

test("parseTonelada - string decimal pt-BR", () => {
  expect(parseTonelada("2,7")).toBe(2.7);
  expect(parseTonelada("0,5")).toBe(0.5);
  expect(parseTonelada("2,7 t")).toBe(2.7);
  expect(parseTonelada("2,7 toneladas")).toBe(2.7);
});

test("parseTonelada - string decimal EN", () => {
  expect(parseTonelada("1234.56")).toBe(1234.56);
  expect(parseTonelada("2.7")).toBe(2.7);
});

test("parseTonelada - string with thousand separator pt-BR", () => {
  expect(parseTonelada("1.234,56")).toBe(1234.56);
});

test("parseTonelada - integers", () => {
  expect(parseTonelada("2700")).toBe(2700);
});

test("parseTonelada - empty or invalid", () => {
  expect(parseTonelada("")).toBe(0);
  expect(parseTonelada(null)).toBe(0);
  expect(parseTonelada(undefined)).toBe(0);
});

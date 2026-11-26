import { describe, expect, it } from "vitest";
import { pageCount, pageNumbers, pageRange, searchFilter } from "./pagination";

describe("pagination", () => {
  it("calcule les bornes de chaque page", () => {
    expect(pageRange(1, 25)).toEqual([0, 24]);
    expect(pageRange(3, 10)).toEqual([20, 29]);
    expect(pageRange(0, 10)).toEqual([0, 9]);
  });

  it("compte au moins une page", () => {
    expect(pageCount(0, 25)).toBe(1);
    expect(pageCount(25, 25)).toBe(1);
    expect(pageCount(26, 25)).toBe(2);
  });

  it("abrège les numéros de page", () => {
    expect(pageNumbers(1, 1)).toEqual([1]);
    expect(pageNumbers(1, 3)).toEqual([1, 2, 3]);
    expect(pageNumbers(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(pageNumbers(4, 10)).toEqual([1, 2, 3, 4, 5, null, 10]);
  });

  it("protège la recherche contre la syntaxe PostgREST et les jokers", () => {
    expect(searchFilter(["email"], "  ")).toBeNull();
    expect(searchFilter(["a", "b"], "x,y)")).toBe('a.ilike."%x,y)%",b.ilike."%x,y)%"');
    expect(searchFilter(["a"], "50%")).toBe('a.ilike."%50\\\\%%"');
    expect(searchFilter(["a"], 'di"t')).toBe('a.ilike."%di\\"t%"');
  });
});

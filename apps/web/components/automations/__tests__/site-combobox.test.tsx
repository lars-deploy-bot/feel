// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { getInitialSiteSelection, SiteCombobox, type SiteOption } from "../SiteCombobox"

// ── getInitialSiteSelection ──

describe("getInitialSiteSelection", () => {
  const sites: SiteOption[] = [
    { id: "s1", hostname: "alpha.alive.best" },
    { id: "s2", hostname: "beta.alive.best" },
  ]

  it("returns matching site when defaultSiteId is valid", () => {
    expect(getInitialSiteSelection(sites, "s2")).toEqual({
      siteId: "s2",
      siteSearch: "beta.alive.best",
    })
  })

  it("auto-selects the only site when there is exactly one", () => {
    const single = [sites[0]!]
    expect(getInitialSiteSelection(single)).toEqual({
      siteId: "s1",
      siteSearch: "alpha.alive.best",
    })
  })

  it("returns empty when defaultSiteId does not match any site", () => {
    expect(getInitialSiteSelection(sites, "nonexistent")).toEqual({
      siteId: "",
      siteSearch: "",
    })
  })

  it("returns empty when multiple sites and no default", () => {
    expect(getInitialSiteSelection(sites)).toEqual({
      siteId: "",
      siteSearch: "",
    })
  })

  it("returns empty for an empty sites array", () => {
    expect(getInitialSiteSelection([])).toEqual({
      siteId: "",
      siteSearch: "",
    })
  })

  it("ignores defaultSiteId when it does not match, even with single site", () => {
    const single = [sites[0]!]
    expect(getInitialSiteSelection(single, "wrong-id")).toEqual({
      siteId: "s1",
      siteSearch: "alpha.alive.best",
    })
  })
})

// ── SiteCombobox ──

describe("SiteCombobox", () => {
  const sites: SiteOption[] = [
    { id: "s1", hostname: "alpha.alive.best" },
    { id: "s2", hostname: "beta.alive.best" },
    { id: "s3", hostname: "gamma.alive.best" },
  ]

  function renderCombobox(overrides: Partial<Parameters<typeof SiteCombobox>[0]> = {}) {
    const onSelect = vi.fn()
    const onSearchChange = vi.fn()
    const result = render(
      <SiteCombobox
        sites={sites}
        selectedId=""
        searchValue=""
        onSelect={onSelect}
        onSearchChange={onSearchChange}
        {...overrides}
      />,
    )
    return { onSelect, onSearchChange, ...result }
  }

  it("renders a combobox input", () => {
    renderCombobox()
    expect(screen.getByRole("combobox")).toBeDefined()
  })

  it("shows dropdown options on focus", () => {
    renderCombobox()
    fireEvent.focus(screen.getByRole("combobox"))
    expect(screen.getByRole("listbox")).toBeDefined()
    expect(screen.getAllByRole("option")).toHaveLength(3)
  })

  it("calls onSelect when an option is clicked", () => {
    const { onSelect } = renderCombobox()
    fireEvent.focus(screen.getByRole("combobox"))
    fireEvent.mouseDown(screen.getByRole("option", { name: "beta.alive.best" }))
    expect(onSelect).toHaveBeenCalledWith("s2", "beta.alive.best")
  })

  it("calls onSearchChange when typing", () => {
    const { onSearchChange } = renderCombobox()
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "gamma" } })
    expect(onSearchChange).toHaveBeenCalledWith("gamma")
  })

  it("clears selection when search is emptied", () => {
    const { onSelect } = renderCombobox({ searchValue: "alpha" })
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } })
    expect(onSelect).toHaveBeenCalledWith("", "")
  })

  it("filters sites by search value", () => {
    renderCombobox({ searchValue: "beta" })
    fireEvent.focus(screen.getByRole("combobox"))
    expect(screen.getAllByRole("option")).toHaveLength(1)
    expect(screen.getByRole("option", { name: "beta.alive.best" })).toBeDefined()
  })

  it("shows max 8 results", () => {
    const manySites = Array.from({ length: 12 }, (_, i) => ({
      id: `s${i}`,
      hostname: `site${i}.alive.best`,
    }))
    renderCombobox({ sites: manySites })
    fireEvent.focus(screen.getByRole("combobox"))
    expect(screen.getAllByRole("option")).toHaveLength(8)
  })

  it("uses renderLabel for custom display", () => {
    renderCombobox({ renderLabel: s => `Custom: ${s.hostname}` })
    fireEvent.focus(screen.getByRole("combobox"))
    expect(screen.getByRole("option", { name: "Custom: alpha.alive.best" })).toBeDefined()
  })

  it("marks the selected option with aria-selected", () => {
    renderCombobox({ selectedId: "s2" })
    fireEvent.focus(screen.getByRole("combobox"))
    const selected = screen.getByRole("option", { name: "beta.alive.best" })
    expect(selected.getAttribute("aria-selected")).toBe("true")
  })
})

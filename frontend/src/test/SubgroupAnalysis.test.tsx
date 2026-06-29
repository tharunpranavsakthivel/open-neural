import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  SubgroupAnalysis,
  type SubgroupData,
} from "../components/SubgroupAnalysis";

describe("SubgroupAnalysis Component Tests", () => {
  const mockSubgroups: SubgroupData[] = [
    {
      slice_name: "gender = female",
      n: 1200,
      metrics: {
        f1: 0.81,
        recall: 0.83,
        precision: 0.79,
      },
      fairness_warning: false,
    },
    {
      slice_name: "age < 25",
      n: 450,
      metrics: {
        f1: 0.62,
        recall: 0.58,
        precision: 0.66,
      },
      fairness_warning: true,
      diagnostic_note:
        "Performance in this subgroup is significantly lower. Underrepresented in dataset.",
    },
  ];

  it("should render subgroups correctly, show warning badge for flagged subgroup, and expand detail panel on click", async () => {
    render(<SubgroupAnalysis subgroups={mockSubgroups} overallF1={0.82} />);

    // Check that both slice names are displayed
    expect(screen.getByText("gender = female")).toBeInTheDocument();
    expect(screen.getByText("age < 25")).toBeInTheDocument();

    // The flagged subgroup should display the "Warning" flag (one in header, one in cell)
    expect(screen.getAllByText("Warning").length).toBeGreaterThanOrEqual(2);

    // Detail panel / Metric Breakdown should NOT be in the document initially
    expect(screen.queryByText("Metric Breakdown")).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Performance in this subgroup is significantly lower. Underrepresented in dataset.",
      ),
    ).not.toBeInTheDocument();

    // Click the row for "age < 25" to expand it
    const ageRow = screen.getByText("age < 25");
    await userEvent.click(ageRow);

    // Expanded detail panel should now be visible
    expect(screen.getByText("Metric Breakdown")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Performance in this subgroup is significantly lower. Underrepresented in dataset.",
      ),
    ).toBeInTheDocument();

    // Check that precision of 0.66 is shown inside the breakdown
    expect(screen.getByText("0.660")).toBeInTheDocument();

    // Click again to collapse
    await userEvent.click(ageRow);

    // Should disappear
    expect(screen.queryByText("Metric Breakdown")).not.toBeInTheDocument();
  });
});

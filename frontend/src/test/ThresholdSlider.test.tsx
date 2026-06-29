import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useState } from "react";
import { ThresholdSlider } from "../components/ThresholdSlider";

// Mock API
vi.mock("../utils/api", () => {
  return {
    updateEvaluationThreshold: vi.fn(),
  };
});

import { updateEvaluationThreshold } from "../utils/api";

describe("ThresholdSlider Component Tests", () => {
  const experimentId = "exp-999";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render with initial threshold of 0.50 and label", () => {
    render(
      <ThresholdSlider experimentId={experimentId} initialThreshold={0.5} />,
    );

    // Value display shows formatted threshold (multiple "0.50" elements exist, check that at least one is present)
    expect(screen.getAllByText("0.50").length).toBeGreaterThanOrEqual(1);

    const slider = screen.getByLabelText(
      "Decision threshold",
    ) as HTMLInputElement;
    expect(slider.value).toBe("0.5");
  });

  it("should debounce slider change to 0.40, make API call, and update metric values", async () => {
    const mockUpdatedMetrics = {
      f1: 0.85,
      precision: 0.88,
      recall: 0.82,
    };

    vi.mocked(updateEvaluationThreshold).mockResolvedValue(mockUpdatedMetrics);

    // Create a simple wrapper to hold parent state for metrics update verification
    const TestComponent = () => {
      const [metrics, setMetrics] = useState({
        precision: 0.5,
        recall: 0.5,
        f1: 0.5,
      });
      return (
        <div>
          <ThresholdSlider
            experimentId={experimentId}
            initialThreshold={0.5}
            onMetricsUpdate={setMetrics}
          />
          <div data-testid="precision-card">{metrics.precision}</div>
          <div data-testid="recall-card">{metrics.recall}</div>
          <div data-testid="f1-card">{metrics.f1}</div>
        </div>
      );
    };

    render(<TestComponent />);

    const slider = screen.getByLabelText("Decision threshold");

    // Change value to 0.4
    fireEvent.change(slider, { target: { value: "0.4" } });

    // State should update immediately in the UI text
    expect(screen.getAllByText("0.40").length).toBeGreaterThanOrEqual(1);

    // Now wait for the debounced API call and metric card updates to resolve
    await waitFor(
      () => {
        expect(updateEvaluationThreshold).toHaveBeenCalledWith(
          experimentId,
          0.4,
        );
      },
      { timeout: 1500 },
    );

    // Check if the mock parent cards updated after the promise resolved
    await waitFor(() => {
      expect(screen.getByTestId("precision-card")).toHaveTextContent("0.88");
      expect(screen.getByTestId("recall-card")).toHaveTextContent("0.82");
      expect(screen.getByTestId("f1-card")).toHaveTextContent("0.85");
    });
  });
});

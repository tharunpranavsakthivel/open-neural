import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PipelineBlock, type BlockType } from "../components/PipelineBlock";

describe("PipelineBlock Component Tests", () => {
  const blockTypes: BlockType[] = [
    "drop_nulls",
    "fill_missing_mean",
    "fill_missing_median",
    "encode_categoricals_onehot",
    "encode_categoricals_ordinal",
    "scale_numerics_standard",
    "scale_numerics_minmax",
    "log_transform",
    "remove_outliers",
    "feature_selection",
    "split",
  ];

  const defaultProps = {
    id: "block-1",
    label: "",
    description: "This is a block description",
    params: {},
    status: "configured" as const,
    onConfigure: vi.fn(),
    onRemove: vi.fn(),
    onSelect: vi.fn(),
  };

  it("should render each of the 11 block types and display the correct label and icon", () => {
    blockTypes.forEach((type, index) => {
      const { unmount } = render(
        <PipelineBlock
          {...defaultProps}
          id={`block-${index}`}
          blockType={type}
        />,
      );

      // Map of expected labels if custom label is empty (BLOCK_TYPE_LABELS in PipelineBlock.tsx)
      const expectedLabels: Record<BlockType, string> = {
        drop_nulls: "Drop Nulls",
        fill_missing_mean: "Fill Missing",
        fill_missing_median: "Fill Missing",
        encode_categoricals_onehot: "One-Hot Encode",
        encode_categoricals_ordinal: "Ordinal Encode",
        scale_numerics_standard: "Standard Scale",
        scale_numerics_minmax: "Min-Max Scale",
        log_transform: "Log Transform",
        remove_outliers: "Remove Outliers",
        feature_selection: "Feature Selection",
        split: "Train/Val/Test Split",
      };

      const expectedIcons: Record<BlockType, string> = {
        drop_nulls: "🗑️",
        fill_missing_mean: "📊",
        fill_missing_median: "📈",
        encode_categoricals_onehot: "🔥",
        encode_categoricals_ordinal: "🔢",
        scale_numerics_standard: "⚖️",
        scale_numerics_minmax: "📏",
        log_transform: "📉",
        remove_outliers: "✂️",
        feature_selection: "🎯",
        split: "✂️",
      };

      const labelText = expectedLabels[type];
      const iconText = expectedIcons[type];

      // Assert label is displayed
      expect(screen.getByText(labelText)).toBeInTheDocument();
      // Assert icon is displayed
      expect(screen.getByText(iconText)).toBeInTheDocument();

      unmount();
    });
  });

  it("should expand/trigger select callback on block click (opening the config panel)", async () => {
    const onSelectSpy = vi.fn();
    render(
      <PipelineBlock
        {...defaultProps}
        blockType="drop_nulls"
        onSelect={onSelectSpy}
      />,
    );

    // The whole block area can be clicked by clicking on its title text
    const blockButton = screen.getByText("Drop Nulls");
    await userEvent.click(blockButton);

    expect(onSelectSpy).toHaveBeenCalledWith("block-1");
  });

  it("should trigger onConfigure callback on click of the cog icon", async () => {
    const onConfigureSpy = vi.fn();
    render(
      <PipelineBlock
        {...defaultProps}
        blockType="drop_nulls"
        onConfigure={onConfigureSpy}
      />,
    );

    const configureBtn = screen.getByRole("button", {
      name: "Configure Drop Nulls",
    });
    await userEvent.click(configureBtn);

    expect(onConfigureSpy).toHaveBeenCalledWith("block-1");
  });

  it("should trigger onRemove callback on click of the remove button", async () => {
    const onRemoveSpy = vi.fn();
    render(
      <PipelineBlock
        {...defaultProps}
        blockType="drop_nulls"
        onRemove={onRemoveSpy}
      />,
    );

    const removeBtn = screen.getByRole("button", { name: "Remove Drop Nulls" });
    await userEvent.click(removeBtn);

    expect(onRemoveSpy).toHaveBeenCalledWith("block-1");
  });
});

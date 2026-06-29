import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatasetImport } from "../screens/DatasetImport";

// Mock API
vi.mock("../utils/api", () => {
  return {
    uploadDatasetSnapshot: vi.fn(),
    fetchProjectSnapshots: vi.fn(),
  };
});

import { uploadDatasetSnapshot, fetchProjectSnapshots } from "../utils/api";

describe("DatasetImport Component Tests", () => {
  const mockOnComplete = vi.fn();
  const projectId = "test-project-123";

  const mockSnapshot = {
    id: "snap-123",
    file_name: "customer_churn.csv",
    version_label: "v1",
    row_count: 5000,
    col_count: 3,
    checksum_sha256: "7a8b9c10d11e12f13a14b15c16d17e18f19a20b21c22d23e24f25a26b27c28d2",
    file_size_bytes: 450000, // < 500MB, no large file warning
    schema: [
      { name: "customer_id", inferred_type: "integer", null_pct: 0, unique_count: 5000 },
      { name: "churn_status", inferred_type: "string", null_pct: 0.2, unique_count: 2 },
      { name: "monthly_charges", inferred_type: "float", null_pct: 1.5, unique_count: 420 },
    ],
    created_at: new Date().toISOString(),
    memory_warning: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchProjectSnapshots).mockResolvedValue([]);
  });

  it("should render drop zone and initial warning when no file is imported", async () => {
    render(<DatasetImport projectId={projectId} onComplete={mockOnComplete} />);

    expect(screen.getByLabelText("File drop zone")).toBeInTheDocument();
    expect(screen.getByText("No dataset imported yet. Please upload a file to proceed.")).toBeInTheDocument();
    expect(screen.getByText("Drag and drop a CSV or Parquet file here")).toBeInTheDocument();
  });

  it("should handle valid file drop, show progress bar, and display schema table with 3 columns", async () => {
    let progressFn: ((p: number) => void) | undefined;

    vi.mocked(uploadDatasetSnapshot).mockImplementation((_projId, _file, onProgress) => {
      progressFn = onProgress;
      return new Promise((resolve) => {
        // We will manually trigger progress updates and resolve in the test
        setTimeout(() => {
          if (progressFn) progressFn(50);
        }, 10);
        setTimeout(() => {
          if (progressFn) progressFn(100);
          resolve(mockSnapshot);
        }, 20);
      });
    });

    render(<DatasetImport projectId={projectId} onComplete={mockOnComplete} />);

    const dropZone = screen.getByLabelText("File drop zone");
    const file = new File(["col1,col2,col3\n1,2,3"], "customer_churn.csv", { type: "text/csv" });

    // Trigger file drop
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file],
      },
    });

    // Fast-forward or wait to see the progress bar
    await waitFor(() => {
      expect(screen.getByText(/Uploading... 50%/i)).toBeInTheDocument();
    });

    // Wait for upload and analysis to finish, schema table to appear
    await waitFor(() => {
      expect(screen.getByText("Inferred Schema")).toBeInTheDocument();
      expect(screen.getByText("customer_id")).toBeInTheDocument();
      expect(screen.getByText("churn_status")).toBeInTheDocument();
      expect(screen.getByText("monthly_charges")).toBeInTheDocument();
    });

    // Check column count in table. There should be exactly 3 column names listed in the cells
    const columnCells = screen.getAllByText(/customer_id|churn_status|monthly_charges/);
    expect(columnCells).toHaveLength(3);

    expect(mockOnComplete).toHaveBeenCalled();
  });

  it("should display an error when an invalid file type is dropped", async () => {
    render(<DatasetImport projectId={projectId} onComplete={mockOnComplete} />);

    const dropZone = screen.getByLabelText("File drop zone");
    const invalidFile = new File(["some image data"], "avatar.png", { type: "image/png" });

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [invalidFile],
      },
    });

    await waitFor(() => {
      expect(screen.getByText("Invalid file type. Please upload a CSV or Parquet file.")).toBeInTheDocument();
    });

    expect(uploadDatasetSnapshot).not.toHaveBeenCalled();
    expect(mockOnComplete).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PasswordSetup } from "../screens/PasswordSetup";
import { useAppStore } from "../stores/appStore";

describe("PasswordSetup Screen", () => {
  const onCompleteMock = vi.fn();
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    onCompleteMock.mockClear();
    fetchMock.mockClear();

    // Set initial state for store
    useAppStore.setState({
      backendPort: 8000,
      showSuccessToast: vi.fn(),
      showErrorToast: vi.fn(),
    });
  });

  it("should render PasswordSetup component correctly", () => {
    render(<PasswordSetup onComplete={onCompleteMock} />);
    expect(screen.getByText("Welcome to OpenNeural")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm Password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create Password" }),
    ).toBeInTheDocument();
  });

  it("should simulate entering matching passwords and call POST /api/v1/auth/setup", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(<PasswordSetup onComplete={onCompleteMock} />);

    const passwordInput = screen.getByLabelText("Password");
    const confirmPasswordInput = screen.getByLabelText("Confirm Password");
    const submitButton = screen.getByRole("button", {
      name: "Create Password",
    });

    await userEvent.type(passwordInput, "securepassword123");
    await userEvent.type(confirmPasswordInput, "securepassword123");

    expect(submitButton).toBeEnabled();
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://127.0.0.1:8000/api/v1/auth/setup",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: "securepassword123" }),
        }),
      );
      expect(onCompleteMock).toHaveBeenCalled();
    });
  });

  it("should display inline error and not call API if passwords do not match", async () => {
    render(<PasswordSetup onComplete={onCompleteMock} />);

    const passwordInput = screen.getByLabelText("Password");
    const confirmPasswordInput = screen.getByLabelText("Confirm Password");
    const submitButton = screen.getByRole("button", {
      name: "Create Password",
    });

    await userEvent.type(passwordInput, "securepassword123");
    await userEvent.type(confirmPasswordInput, "differentpassword123");

    expect(submitButton).toBeEnabled();
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Passwords do not match",
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("should display inline error and not call API if password is too short", async () => {
    render(<PasswordSetup onComplete={onCompleteMock} />);

    const passwordInput = screen.getByLabelText("Password");
    const confirmPasswordInput = screen.getByLabelText("Confirm Password");
    const submitButton = screen.getByRole("button", {
      name: "Create Password",
    });

    await userEvent.type(passwordInput, "short");
    await userEvent.type(confirmPasswordInput, "short");

    expect(submitButton).toBeEnabled();
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Password must be at least 8 characters long",
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});

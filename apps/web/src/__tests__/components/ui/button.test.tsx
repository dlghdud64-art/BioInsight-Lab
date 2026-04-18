// @ts-nocheck — Phase 3 tsc residual, Phase 4 deferred
// jest-dom matchers (toBeInTheDocument, toHaveClass, toBeDisabled) not available in type checking
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button Component", () => {
  it("should render button with text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("should apply variant styles", () => {
    const { container } = render(<Button variant="outline">Outline</Button>);
    const button = container.querySelector("button");
    // outline variant 는 테두리를 가짐 (정확한 색상 클래스는 디자인 토큰 변경 시 달라질 수 있어 'border' 만 검증)
    expect(button).toHaveClass("border");
  });

  it("should be disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByText("Disabled");
    expect(button).toBeDisabled();
  });
});

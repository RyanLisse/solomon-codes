import { render, screen } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";

// Mock successful image loading for test environment
const createMockImage = () => {
	const img = {
		addEventListener: vi.fn((event, callback) => {
			if (event === "load") {
				img.onload = callback;
			} else if (event === "error") {
				img.onerror = callback;
			}
		}),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
		_src: "",
		alt: "",
		onload: null as (() => void) | null,
		onerror: null as (() => void) | null,
		complete: false,
		naturalWidth: 0,
		naturalHeight: 0,
	};

	// Override the src setter to trigger onload immediately
	Object.defineProperty(img, "src", {
		set(value: string) {
			img._src = value;
			// Simulate successful image loading immediately
			img.complete = true;
			img.naturalWidth = 100;
			img.naturalHeight = 100;
			// Trigger load event synchronously for Radix UI
			if (img.onload) {
				img.onload();
			}
		},
		get() {
			return img._src;
		},
	});

	return img;
};

const originalImage = global.Image;

beforeEach(() => {
	global.Image = vi.fn(() =>
		createMockImage(),
	) as unknown as new () => HTMLImageElement;
});

afterAll(() => {
	global.Image = originalImage;
});

describe("Avatar Components", () => {
	const BasicAvatar = ({
		src = "https://github.com/shadcn.png",
		alt = "User avatar",
		fallback = "CN",
	}: {
		src?: string;
		alt?: string;
		fallback?: string;
	}) => (
		<Avatar data-testid="avatar">
			<AvatarImage src={src} alt={alt} data-testid="avatar-image" />
			<AvatarFallback data-testid="avatar-fallback">{fallback}</AvatarFallback>
		</Avatar>
	);

	describe("Avatar Root", () => {
		it("should render avatar with correct attributes", () => {
			render(<BasicAvatar />);

			const avatar = screen.getByTestId("avatar");
			expect(avatar).toBeInTheDocument();
			expect(avatar).toHaveAttribute("data-slot", "avatar");
		});

		it("should apply default styling classes", () => {
			render(<BasicAvatar />);

			const avatar = screen.getByTestId("avatar");
			expect(avatar).toHaveClass(
				"relative",
				"flex",
				"size-8",
				"shrink-0",
				"overflow-hidden",
				"rounded-full",
			);
		});

		it("should allow custom className", () => {
			render(
				<Avatar className="custom-avatar" data-testid="avatar">
					<AvatarImage src="test.jpg" alt="Test" data-testid="avatar-image" />
					<AvatarFallback data-testid="avatar-fallback">T</AvatarFallback>
				</Avatar>,
			);

			const avatar = screen.getByTestId("avatar");
			expect(avatar).toHaveClass("custom-avatar");
		});
	});

	describe("AvatarImage", () => {
		it("should render image with proper attributes when loaded", () => {
			render(
				<BasicAvatar src="https://example.com/avatar.jpg" alt="John Doe" />,
			);

			// Image should be rendered immediately with successful loading
			const image = screen.getByTestId("avatar-image");
			expect(image).toHaveAttribute("data-slot", "avatar-image");
			expect(image).toHaveAttribute("src", "https://example.com/avatar.jpg");
			expect(image).toHaveAttribute("alt", "John Doe");

			// When image loads successfully, fallback is NOT rendered in Radix UI
			expect(screen.queryByTestId("avatar-fallback")).not.toBeInTheDocument();
		});

		it("should have proper styling classes when rendered", () => {
			render(<BasicAvatar />);

			const image = screen.getByTestId("avatar-image");
			expect(image).toHaveClass("aspect-square", "size-full");

			// When image loads successfully, fallback is NOT rendered
			expect(screen.queryByTestId("avatar-fallback")).not.toBeInTheDocument();
		});

		it("should be accessible with proper alt text when image loads", () => {
			render(<BasicAvatar alt="Profile picture of Jane Smith" />);

			// Image should be accessible by alt text
			const imageByAlt = screen.getByAltText("Profile picture of Jane Smith");
			expect(imageByAlt).toBeInTheDocument();

			// When image loads successfully, fallback is NOT rendered
			expect(screen.queryByTestId("avatar-fallback")).not.toBeInTheDocument();
		});

		it("should handle missing alt text gracefully", async () => {
			render(
				<Avatar data-testid="avatar">
					<AvatarImage
						src="https://example.com/avatar.jpg"
						data-testid="avatar-image"
					/>
					<AvatarFallback data-testid="avatar-fallback">JS</AvatarFallback>
				</Avatar>,
			);

			// When image loads successfully (even without alt), fallback is NOT rendered
			const image = screen.getByTestId("avatar-image");
			expect(image).toBeInTheDocument();
			expect(screen.queryByTestId("avatar-fallback")).not.toBeInTheDocument();
		});
	});

	describe("AvatarFallback", () => {
		it("should render fallback with correct attributes when no src provided", () => {
			render(
				<Avatar data-testid="avatar">
					<AvatarImage data-testid="avatar-image" />
					<AvatarFallback data-testid="avatar-fallback">AB</AvatarFallback>
				</Avatar>,
			);

			// When no src is provided, fallback should be shown
			const fallback = screen.getByTestId("avatar-fallback");
			expect(fallback).toBeInTheDocument();
			expect(fallback).toHaveAttribute("data-slot", "avatar-fallback");
			expect(fallback).toHaveTextContent("AB");
		});

		it("should have proper styling classes", () => {
			render(
				<Avatar data-testid="avatar">
					<AvatarImage data-testid="avatar-image" />
					<AvatarFallback data-testid="avatar-fallback">FB</AvatarFallback>
				</Avatar>,
			);

			const fallback = screen.getByTestId("avatar-fallback");
			expect(fallback).toHaveClass(
				"flex",
				"size-full",
				"items-center",
				"justify-center",
				"rounded-full",
				"bg-muted",
			);
		});

		it("should display when image fails to load", async () => {
			// Create a mock that fails to load
			const failingImage = {
				addEventListener: vi.fn((event, callback) => {
					if (event === "error") {
						failingImage.onerror = callback;
						// Trigger error immediately
						setTimeout(() => callback(), 0);
					}
				}),
				removeEventListener: vi.fn(),
				_src: "",
				onerror: null as (() => void) | null,
				onload: null as (() => void) | null,
				complete: false,
			};

			Object.defineProperty(failingImage, "src", {
				set(value: string) {
					failingImage._src = value;
					// Trigger error for invalid URLs
					if (failingImage.onerror) {
						failingImage.onerror();
					}
				},
				get() {
					return failingImage._src;
				},
			});

			// Temporarily override the global Image mock for this test
			const originalGlobalImage = global.Image;
			global.Image = vi.fn(
				() => failingImage,
			) as unknown as new () => HTMLImageElement;

			render(
				<Avatar data-testid="avatar">
					<AvatarImage src="invalid-url.jpg" data-testid="avatar-image" />
					<AvatarFallback data-testid="avatar-fallback">NA</AvatarFallback>
				</Avatar>,
			);

			// When image fails to load, fallback should be shown
			const fallback = screen.getByTestId("avatar-fallback");
			expect(fallback).toBeInTheDocument();
			expect(fallback).toHaveTextContent("NA");

			// Restore original mock
			global.Image = originalGlobalImage;
		});
	});

	describe("Accessibility", () => {
		it("should have proper ARIA attributes for images", () => {
			render(<BasicAvatar alt="User profile picture" />);

			const image = screen.getByRole("img");
			expect(image).toHaveAttribute("alt", "User profile picture");
		});

		it("should handle decorative images", () => {
			render(
				<Avatar data-testid="avatar">
					<AvatarImage src="decorative.jpg" alt="" data-testid="avatar-image" />
					<AvatarFallback data-testid="avatar-fallback">DI</AvatarFallback>
				</Avatar>,
			);

			const image = screen.getByTestId("avatar-image");
			expect(image).toHaveAttribute("alt", "");
		});

		it("should provide fallback text as accessible content when image is missing", () => {
			render(
				<Avatar data-testid="avatar">
					<AvatarImage data-testid="avatar-image" />
					<AvatarFallback data-testid="avatar-fallback">
						John Smith
					</AvatarFallback>
				</Avatar>,
			);

			// When no src provided, fallback should be visible
			const fallback = screen.getByText("John Smith");
			expect(fallback).toBeInTheDocument();
		});

		it("should work with screen readers when image loads", () => {
			render(<BasicAvatar alt="CEO profile photo" fallback="CEO" />);

			// Image should be accessible by role and alt text when it loads successfully
			const image = screen.getByRole("img", { name: "CEO profile photo" });
			expect(image).toBeInTheDocument();

			// When image loads successfully, fallback text is NOT present
			expect(screen.queryByText("CEO")).not.toBeInTheDocument();
		});
	});

	describe("States and Behavior", () => {
		it("should handle different image loading states", async () => {
			const { rerender } = render(
				<BasicAvatar src="https://example.com/loading.jpg" />,
			);

			// Image element should be present when it loads successfully
			expect(screen.getByTestId("avatar-image")).toBeInTheDocument();

			// Change to a different image
			rerender(
				<BasicAvatar src="https://example.com/different.jpg" alt="New image" />,
			);

			const image = screen.getByTestId("avatar-image");
			expect(image).toHaveAttribute("src", "https://example.com/different.jpg");
			expect(image).toHaveAttribute("alt", "New image");
		});

		it("should support custom fallback content when no image src", () => {
			render(
				<Avatar data-testid="avatar">
					<AvatarImage data-testid="avatar-image" />
					<AvatarFallback data-testid="avatar-fallback">
						<span>Custom Fallback</span>
					</AvatarFallback>
				</Avatar>,
			);

			// When no src provided, fallback should be rendered
			const fallback = screen.getByTestId("avatar-fallback");
			expect(fallback).toContainHTML("<span>Custom Fallback</span>");
		});

		it("should handle missing src gracefully", () => {
			render(
				<Avatar data-testid="avatar">
					<AvatarImage alt="No source" data-testid="avatar-image" />
					<AvatarFallback data-testid="avatar-fallback">NS</AvatarFallback>
				</Avatar>,
			);

			// Without a valid src, fallback should be displayed
			const fallback = screen.getByTestId("avatar-fallback");
			expect(fallback).toBeInTheDocument();
			expect(fallback).toHaveTextContent("NS");

			// Image element might not be rendered in DOM when src is missing
			const avatar = screen.getByTestId("avatar");
			expect(avatar).toBeInTheDocument();
		});
	});

	describe("Integration", () => {
		it("should work with various image formats", () => {
			const formats = [
				"https://example.com/avatar.jpg",
				"https://example.com/avatar.png",
				"https://example.com/avatar.gif",
				"https://example.com/avatar.webp",
			];

			formats.forEach((src, index) => {
				const { unmount } = render(
					<BasicAvatar src={src} alt={`Format test ${index}`} />,
				);

				// With our image mock, the image should load successfully
				const image = screen.getByTestId("avatar-image");
				expect(image).toHaveAttribute("src", src);
				expect(image).toHaveAttribute("alt", `Format test ${index}`);

				// Clean up between iterations
				unmount();
			});
		});

		it("should maintain aspect ratio", () => {
			render(<BasicAvatar />);

			// The image should be rendered with mocked successful loading
			const image = screen.getByTestId("avatar-image");
			expect(image).toHaveClass("aspect-square");
		});
	});
});

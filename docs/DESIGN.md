# Design System Strategy: Precision Velocity

## 1. Overview & Creative North Star

The Creative North Star for this design system is **"The Technical Monolith."**

Unlike standard project management tools that rely on heavy borders and "friendly" rounded corners, this system treats the interface as a high-performance instrument. It is inspired by the precision of code editors and the refined layout of architectural journals. We break the "template" look through **intentional density** and **tonal depth**, creating an environment where information is prioritized and visual noise is ruthlessly eliminated. The goal is to move the user from "managing tasks" to "orchestrating output."

## 2. Colors & Surface Architecture

The palette is a sophisticated range of deep grays and "electric" purples, designed to maintain high contrast while reducing eye strain during long periods of deep work.

### The "No-Line" Rule

To achieve a premium, custom feel, **1px solid borders are prohibited for sectioning.** Boundaries must be defined solely through background color shifts.

- Use `surface-container-low` for secondary navigation areas.
- Use `surface` for the main canvas.
- Use `surface-container-high` for contextual sidebars.
This creates a seamless, "molded" look rather than a boxy, grid-like appearance.

### Surface Hierarchy & Nesting

Treat the UI as a series of physical layers.

- **Layer 0 (Background):** `surface` (#121314).
- **Layer 1 (Containers):** `surface-container-low` for large structural blocks.
- **Layer 2 (Floating/Active):** `surface-container-highest` for active task details or hovered items.
- **Nesting:** When placing a card inside a section, use a darker `surface-container-lowest` to create a "recessed" effect, or a lighter `surface-container-high` for a "lifted" effect.

### The "Glass & Gradient" Rule

To prevent the grayscale palette from feeling flat, utilize the **"Luminous CTA"** strategy. Main action buttons and progress indicators should use a subtle linear gradient from `primary` (#bdc2ff) to `primary_container` (#5e6ad2). For floating command palettes or dropdowns, apply a `backdrop-blur` (8px-16px) to semi-transparent versions of `surface-container-highest`.

## 3. Typography: Editorial Utility

We use **Inter** not just as a font, but as a structural element.

- **Display & Headlines:** Use `display-sm` and `headline-lg` sparingly for empty states or project overviews. Set these with tight letter-spacing (-0.02em) to give an authoritative, editorial feel.
- **Body & Action:** `body-md` is the workhorse. Ensure `on-surface` (#e3e2e3) is used for primary text to maintain high readability.
- **Utility Layers:** `label-sm` should be used for status indicators and metadata. To achieve a "high-performance" look, labels can be uppercase with a +0.05em letter spacing to distinguish them from prose.

## 4. Elevation & Depth

In this design system, depth is a function of light and tone, not shadows and lines.

### The Layering Principle

Achieve hierarchy by "stacking" tones. A `surface-container-lowest` task card placed on a `surface-container-low` list view creates a natural, soft-edge definition that feels significantly more modern than a stroke.

### Ambient Shadows

For floating elements (modals, popovers), shadows must be extra-diffused.

- **Token:** Blur: 24px-40px | Opacity: 4% - 8% | Color: `surface_container_lowest` (tinted toward the background).
- Shadows should feel like "ambient occlusion" in a 3D space, not a drop shadow on a page.

### The "Ghost Border" Fallback

If a border is required for extreme accessibility needs or to separate identical colors, use a **Ghost Border**:

- **Token:** `outline-variant` at 15% opacity.
- Never use a 100% opaque border; it breaks the "Monolith" aesthetic.

## 5. Components

### Buttons

- **Primary:** Gradient from `primary` to `primary_container`. High-contrast `on_primary` text. No border.
- **Secondary:** `surface-container-highest` background. Subtle `outline-variant` ghost border.
- **Tertiary/Ghost:** No background. `on_surface_variant` text. Highlights to `surface_bright` on hover.

### Chips & Status Indicators

- Use `secondary_container` for background with `on_secondary_container` for text.
- Status indicators (e.g., "In Progress") should use a small, glowing 6px circle with a subtle `box-shadow` of its own color to signify "active" energy.

### Lists & Activity Feeds

- **Forbid Dividers:** Do not use lines between list items. Use 4px of vertical space or a 1-step tonal shift (`surface-container-low` to `surface-container`) on hover to define rows.
- **Density:** Keep padding tight (e.g., 8px vertical for list items) to allow for high data density, essential for project management.

### Input Fields

- **Idle State:** `surface-container-lowest` background. No border.
- **Focus State:** Subtle `primary` ghost border (20% opacity) and a 1px `primary` glow at the bottom of the field only.

### The "Command Palette" (Custom Component)

A center-aligned, floating search bar using high glassmorphism (blur) and `surface-container-highest`. This is the "brain" of the system—it should feel heavier and more "physical" than other components.

## 6. Do’s and Don’ts

### Do

- **Do** use `surface-container` tiers to create hierarchy.
- **Do** lean into the "density" of the `label-sm` typography for metadata.
- **Do** use `primary_fixed` for high-importance highlights.
- **Do** utilize `xl` (0.75rem) roundedness for large containers and `sm` (0.125rem) for small chips to create a "nested" visual language.

### Don’t

- **Don’t** use standard #000000 shadows; they muddy the deep gray palette.
- **Don’t** add dividers or 1px strokes to separate navigation from content.
- **Don’t** use "vibrant" colors outside of the `primary`, `secondary`, and `error` tokens. The system’s power comes from its restrained, grayscale foundation.
- **Don’t** use large corner radii (like `full`) for buttons; stick to `md` (0.375rem) to maintain the technical, architectural feel.

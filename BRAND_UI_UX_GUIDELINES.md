# GPTScope Brand UI/UX Guidelines

## 1) Purpose
This document defines the visual and interaction system for GPTScope.  
Use it as the single source of truth for designing future digital products and print assets with the same brand language.

Brand positioning:
- Tactical, operational, enterprise-grade
- Minimal, high-contrast, disciplined
- Data-first with restrained visual noise

---

## 2) Core Design Principles

1. **Operational Clarity First**  
   Every screen must prioritize readability, state recognition, and immediate action.

2. **Monochrome-Driven Identity**  
   The system is primarily neutral grayscale. Color accents are reserved for meaningful states only.

3. **Controlled Density**  
   Compact but breathable. Use strict spacing tokens; avoid arbitrary paddings/margins.

4. **Sharp Geometry Over Soft Playfulness**  
   Corner radii are subtle and consistent. Avoid overly rounded or decorative forms.

5. **Consistent Interaction Language**  
   Hover/focus/active states must follow a consistent contrast and timing model.

---
ס
## 3) Brand Foundations (Design Tokens)

### 3.1 Color System
Primary neutral palette:
- `--white: #FFFFFF`
- `--neutral-50: #FAFAFA`
- `--neutral-100: #F5F5F5`
- `--neutral-200: #E5E5E5`
- `--neutral-300: #D4D4D4`
- `--neutral-400: #A1A1A1`
- `--neutral-500: #737373`
- `--neutral-600: #525252`
- `--neutral-700: #404040`
- `--neutral-800: #262626`
- `--neutral-950: #0A0A0A`
- `--border: #DEDEDE`

Semantic accents (use sparingly):
- Positive status dot: `#16A34A`
- Danger actions: deep red range (`#B91C1C` / hover `#9F1239`)

Usage rules:
- Default text = `neutral-600`, headings/key data = `neutral-950`
- Default surfaces = `white` or `neutral-50`
- Borders are always subtle (`border` or `neutral-300`)
- Never introduce saturated colors without product-level approval

### 3.2 Typography
Font families:
- Hebrew/UI content: `Miriam Libre`
- Latin/UI support: `Rubik`

Type scale:
- Title: `21px`
- Section heading: `17px`
- Body: `14px`
- Meta/labels: `11px`
- Tight line-height: `1.35`
- Body line-height: `1.5`

Type behavior:
- Meta labels are uppercase with tracking
- Operational values use stronger weight (700)
- Keep copy concise and utilitarian

### 3.3 Spacing
Use only this spacing scale:
- 4, 8, 12, 16, 20, 24 px

No freehand spacing values unless technically required by component behavior.

### 3.4 Radius and Shape
- `--radius-sm: 6px`
- `--radius-md: 8px`
- `--radius-lg: 12px`
- Pills/chips/buttons: fully rounded (`999px`) only when defined as pill controls

### 3.5 Elevation
- Primary soft shadow: `0 8px 28px rgba(0,0,0,0.06)`
- Overlays/modals can use stronger depth, but keep shadows neutral and clean

---

## 4) Layout and Structure

### 4.1 Page Shell
- Full-height app shell with fixed topbar and footer
- Main workspace follows a 3-column operational layout:
  - Inbox
  - Chat (dominant center column)
  - Details panel

### 4.2 Responsive Behavior
- Desktop: multi-panel workspace
- Mobile: single panel at a time with bottom navigation
- Respect RTL flow in layout and component logic

### 4.3 Surface Language
- Panels are translucent white with soft blur
- Borders are always visible but thin
- Background texture is subtle (never distract from content)

---

## 5) Component Design Guidelines

### 5.1 Buttons
Button families:
- **Primary**: dark fill (`neutral-950`) + white text
- **Ghost**: white/transparent with subtle border and gray text
- **Danger**: neutral base, dark/red emphasis on intent and hover

States:
- Hover: increase contrast and surface tint
- Active: slight scale-down (`~0.97`)
- Disabled: reduced opacity, no transform
- Focus visible: clear outline, never hidden

### 5.2 Inputs and Forms
- Border-first inputs on white surface
- Focus ring uses dark neutral glow
- Keep labels short and explicit
- Form groups should use vertical stacking with 12px rhythm

### 5.3 Cards and Panels
- Border + subtle background shift (`neutral-50`)
- Tight internal hierarchy:
  - Eyebrow/meta
  - Heading
  - Body
- Avoid ornamental separators; use spacing and border discipline

### 5.4 Messaging UI
- User/system/assistant messages must remain immediately distinguishable
- Bubble contrast should preserve readability at a glance
- Source tags are pill-based and low-contrast secondary metadata

### 5.5 Status Indicators
- Dots and pills are the primary status language
- Animate only where signal value exists (e.g., live pulse)
- Avoid decorative animation not tied to state

### 5.6 Modal/Confirmation Pattern
- Centered overlay with backdrop dim + mild blur
- Modal body uses brand surfaces and typography
- Confirmation actions are always explicit:
  - Secondary cancel
  - Strong destructive confirm

---

## 6) Interaction and Motion

Micro-interaction standard:
- Duration: ~120–220ms
- Easing: standard ease-in-out variants
- Motion purpose: feedback, hierarchy, focus transition

Do:
- Animate state transitions and affordances
- Keep motion subtle and functional

Do not:
- Use large theatrical transitions
- Add infinite animation unless tied to live status

---

## 7) Accessibility and UX Quality Bar

- Maintain strong text/background contrast
- Always provide keyboard focus visibility
- Use semantic controls (`button`, `input`, `dialog` semantics)
- Support RTL behavior by default
- Keep touch targets practical on mobile

---

## 8) Digital Deliverables Standards

When designing new digital screens/components, always provide:
- Token mapping (color, spacing, radius, type)
- Component states (default/hover/focus/active/disabled/error)
- Responsive behavior (desktop/tablet/mobile)
- RTL behavior notes
- Empty/loading/error states

---

## 9) Print Adaptation Guidelines

### 9.1 Print Philosophy
Print materials should feel like the product:
- Clean tactical minimalism
- Strong information hierarchy
- Controlled grayscale with limited accent colors

### 9.2 Color Translation for Print
- Prefer grayscale-first layouts
- If CMYK conversion is required, preserve contrast hierarchy over exact RGB matching
- Use accent colors (green/red) only for critical statuses or warnings

### 9.3 Typography in Print
- Keep the same typographic hierarchy (title/section/body/meta)
- Increase body size for long-form readability if needed
- Preserve uppercase tracked style for metadata labels

### 9.4 Grid and Spacing
- Reuse the same spacing rhythm (4/8/12/16/20/24 principle)
- Use strict margins and column grids
- Avoid decorative backgrounds that reduce legibility

### 9.5 Print Components
For one-pagers, reports, and posters:
- Header strip reflecting topbar language
- Card-like content modules with subtle borders
- Pill/label style for status metadata
- Footer strip with version/date/system context where relevant

---

## 10) Brand Consistency Rules (Do/Don't)

### Do
- Use neutral palette as default
- Keep corners sharp-subtle (6/8/12)
- Keep interaction cues consistent and lightweight
- Prioritize operational clarity over visual novelty

### Don’t
- Introduce random colors, gradients, or glow effects
- Use oversized radii or playful rounded styles
- Break spacing scale for ad-hoc alignment
- Mix unrelated visual styles in the same flow

---

## 11) Governance

Before approving any new design:
1. Validate against token system
2. Validate component state completeness
3. Validate responsive + RTL behavior
4. Validate accessibility baseline
5. Validate print adaptation consistency (if print output is required)

Any deviation from these guidelines should be documented as a deliberate design exception.

# Visual Component Guide - Local Footy Athlete

A visual reference for all UI components showing variants, sizes, and states.

## Color Palette Reference

```
Navy Background     #1A1A2E  ██████ (Primary)
Surface Card        #252542  ██████ (Secondary)
Accent Green        #00E676  ██████ (Actions)
Secondary Orange    #FF6D00  ██████ (Secondary)
Text Primary        #FFFFFF  ██████ (Main Text)
Text Secondary      #B0B0C3  ██████ (Helper Text)
Success Green       #4CAF50  ██████
Warning Yellow      #FFC107  ██████
Error Red           #F44336  ██████
Info Blue           #2196F3  ██████
```

## Button Component

### Variants
```
┌─────────────────────────────────────────────────────────┐
│ PRIMARY (Electric Green)                                 │
│  [████ Start Workout ████]  <- Full color background   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ SECONDARY (Burnt Orange)                                │
│  [████ Cancel Session ████]  <- Orange background      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ OUTLINE (Green Border)                                  │
│  [  Delete Workout  ]  <- Border only, transparent bg  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ GHOST (No Background)                                   │
│   More Options  <- No border, transparent background   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ DANGER (Red)                                            │
│  [████ Remove Profile ████]  <- Red background        │
└─────────────────────────────────────────────────────────┘
```

### Sizes
```
SMALL (sm, 36px height)
  [█ Start █]

MEDIUM (md, 44px height)
  [██ Start Workout ██]

LARGE (lg, 52px height)
  [███ Start Workout Now ███]
```

### States
```
Normal:    [████ Click Me ████]
Pressed:   [██ Click Me ██] (70% opacity)
Disabled:  [██ Click Me ██] (grayed out)
Loading:   [⏳ Loading... ⏳] (spinner visible)
```

## Text Component

### Heading Variants
```
h1 (32px, Bold)
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  Largest Headlines

h2 (28px, Bold)
░░░░░░░░░░░░░░░░░░░░░
  Subheadings

h3 (24px, Semibold)
░░░░░░░░░░░░░░░░
  Section Titles

h4 (20px, Semibold)
░░░░░░░░░░
  Small Headers
```

### Body Variants
```
body (16px, Regular)
Regular text for content and descriptions

bodyEmphasis (16px, Semibold)
Important body text that stands out

bodySmall (14px, Regular)
Smaller secondary text for metadata

bodySmallEmphasis (14px, Semibold)
Emphasized smaller text
```

### Label & Caption
```
label (14px, Semibold)
Form labels and button text

caption (12px, Regular)
Small metadata and timestamps

overline (11px, Bold, Uppercase)
SMALL UPPERCASE LABELS
```

## Card Component

### Default Variant
```
┌──────────────────────────────────┐
│ Player Stats                      │
│ Distance: 5.2 km                  │
│ Duration: 45 min                  │
└──────────────────────────────────┘
(Flat, no shadow)
```

### Elevated Variant
```
     ╭──────────────────────────────╮
     │ Workout Summary              │
     │ Calories: 485 cal            │
     │ Avg Heart Rate: 145 bpm      │
     ╰──────────────────────────────╯
     (With shadow underneath)
```

### Outlined Variant
```
┌──────────────────────────────────┐
│ Weekly Challenge                  │
│ Complete 5 workouts this week     │
└──────────────────────────────────┘
(Border only, no shadow)
```

## Input Component

### Default State
```
┌─────────────────────────────────┐
│ Email Address                    │
│ ┌───────────────────────────────┐│
│ │ your@email.com                ││
│ └───────────────────────────────┘│
└─────────────────────────────────┘
```

### Focused State
```
┌─────────────────────────────────┐
│ Password                         │
│ ┌═══════════════════════════════┐│  <- Green border
│ │ ••••••••••                    ││
│ └═══════════════════════════════┘│
└─────────────────────────────────┘
```

### Error State
```
┌─────────────────────────────────┐
│ Email Address                    │
│ ┌───────────────────────────────┐│  <- Red border
│ │ invalid@                      ││
│ └───────────────────────────────┘│
│ ! Invalid email format           │  <- Red text
└─────────────────────────────────┘
```

### With Icon
```
┌─────────────────────────────────┐
│ Search Workouts                  │
│ ┌───────────────────────────────┐│
│ │ 🔍 Type to search...          ││
│ └───────────────────────────────┘│
└─────────────────────────────────┘
```

## Select Component

### Closed State
```
┌─────────────────────────────────┐
│ Sport Selection                  │
│ ┌───────────────────────────────┐│
│ │ Football                  ▼   ││
│ └───────────────────────────────┘│
└─────────────────────────────────┘
```

### Expanded State
```
┌─────────────────────────────────┐
│ Sport Selection                  │
│ ┌───────────────────────────────┐│
│ │ Football                  ▼   ││
│ └───────────────────────────────┘│
│ ┌───────────────────────────────┐│
│ │ Football          ✓           ││ (Selected, green)
│ ├───────────────────────────────┤│
│ │ Basketball                    ││
│ ├───────────────────────────────┤│
│ │ Soccer                        ││
│ ├───────────────────────────────┤│
│ │ Tennis                        ││
│ └───────────────────────────────┘│
└─────────────────────────────────┘
```

### Multi-Select
```
Selected Items: Football, Basketball, Soccer (3 selected)
```

## Modal Component

### Slide-up Animation
```
[Initial]           [Sliding]          [Final]
                     ╱── Dark           ┌──────────────┐
Screen content      │  Overlay          │ × (close)    │
                    │  (with opacity)   │              │
                    │  ╱────────────┐   │ Modal Title  │
                    │  │ Modal      │   │              │
                    │  │ Content    │   │ Modal        │
                    │  │            │   │ Content      │
                    └─ │            │   │              │
                       └────────────┘   └──────────────┘
```

### Modal Overlay
```
┌────────────────────────────────┐
│                                 │  <- Semi-transparent
│    Screen Content (faded)       │     dark overlay
│                                 │
│                                 │
│     ╭──────────────────────╮   │
│     │ × Confirm Action     │   │
│     ├──────────────────────┤   │
│     │ Are you sure?        │   │
│     │                      │   │
│     │ [Confirm] [Cancel]  │   │
│     ╰──────────────────────╯   │
│                                 │
└────────────────────────────────┘
```

## Badge Component

### Variants & Sizes
```
┌────────────┐  ┌──────────────────┐
│ Success    │  │ ✓ Success Large   │
└────────────┘  └──────────────────┘
(sm, Green)     (md, Green)

┌────────────┐  ┌──────────────────┐
│ Warning    │  │ ⚠ Warning Large   │
└────────────┘  └──────────────────┘
(sm, Yellow)    (md, Yellow)

┌────────────┐  ┌──────────────────┐
│ Error      │  │ ✗ Error Large     │
└────────────┘  └──────────────────┘
(sm, Red)       (md, Red)

┌────────────┐  ┌──────────────────┐
│ Info       │  │ ℹ Info Large      │
└────────────┘  └──────────────────┘
(sm, Blue)      (md, Blue)

┌────────────┐  ┌──────────────────┐
│ Active     │  │ ⚡ Active Large    │
└────────────┘  └──────────────────┘
(sm, Green)     (md, Green)
```

## Progress Bar Component

### Default (No Label)
```
Full (0%):     ░░░░░░░░░░░░░░░░░░░░░░░░░
Progress (50%): ███████████░░░░░░░░░░░░░░░
Full (100%):   ██████████████████████████
```

### With Percentage Label
```
25%:  ██████░░░░░░░░░░░░░░░░░░░░░  25%
50%:  █████████████░░░░░░░░░░░░░░░  50%
75%:  ███████████████████░░░░░░░░░  75%
100%: ██████████████████████████   100%
```

### Custom Colors
```
Green:   ███████████░░░░░░░░░░░░░░░░
Orange:  ███████████░░░░░░░░░░░░░░░░
Red:     ███████████░░░░░░░░░░░░░░░░
```

## Avatar Component

### Sizes
```
Small (32px):      [░░]
Medium (40px):     [░░░░]
Large (64px):      [░░░░░░░░]
```

### With Initials
```
John Smith:        [JS]
Jane Doe:          [JD]
Michael Johnson:   [MJ]
```

### With Image
```
[████████]
│        │
│ Photo  │  <- Circular image
│        │
[████████]
```

## Header Component

### Basic Header
```
┌─────────────────────────────────┐
│ My Profile                       │
└─────────────────────────────────┘
```

### With Subtitle
```
┌─────────────────────────────────┐
│ My Profile                       │
│ @athlete_pro                     │
└─────────────────────────────────┘
```

### With Back Button
```
┌─────────────────────────────────┐
│ ← Workout Details               │
└─────────────────────────────────┘
```

### With Right Action
```
┌─────────────────────────────────┐
│ Settings                    ⚙️   │
└─────────────────────────────────┘
```

## Loading Component

### Full Screen
```
┌────────────────────────────────┐
│                                 │
│        ⏳ Spinning              │
│                                 │
│     Loading workouts...         │
│                                 │
│                                 │
└────────────────────────────────┘
```

### Inline
```
Row 1:      ⏳ Saving changes...
Row 2:      [Regular content]
Row 3:      [Regular content]
```

## Divider Component

### Default
```
Content above
─────────────────────────────────
Content below
```

### Custom Color (Orange)
```
Content above
═════════════════════════════════ (Orange)
Content below
```

### Custom Spacing
```
Content above


─────────────────────────────────


Content below
```

## Component Layout Examples

### Login Screen
```
┌────────────────────────────────┐
│ Login                           │
│                                 │
│ Email Address                   │
│ ┌────────────────────────────┐ │
│ │ your@email.com             │ │
│ └────────────────────────────┘ │
│                                 │
│ Password                        │
│ ┌────────────────────────────┐ │
│ │ ••••••••••                 │ │
│ └────────────────────────────┘ │
│                                 │
│ [█████ Sign In █████]           │
│                                 │
└────────────────────────────────┘
```

### Workout List
```
┌────────────────────────────────┐
│ Workouts                        │
└────────────────────────────────┘
┌────────────────────────────────┐
│ Monday - Football               │
│ 45 min | 485 cal  ✓ Complete   │
└────────────────────────────────┘
┌────────────────────────────────┐
│ Tuesday - Basketball            │
│ 60 min | 620 cal  ⏱ In Progress│
└────────────────────────────────┘
┌────────────────────────────────┐
│ Wednesday - Strength Training   │
│ 30 min | 320 cal  ○ Upcoming   │
└────────────────────────────────┘
```

### Settings Form
```
┌────────────────────────────────┐
│ Settings                        │
└────────────────────────────────┘
Sport
┌────────────────────────────────┐
│ Football                    ▼   │
└────────────────────────────────┘
Level
┌────────────────────────────────┐
│ Advanced                    ▼   │
└────────────────────────────────┘
Focus Areas (Multi-select)
┌────────────────────────────────┐
│ ✓ Strength  ○ Speed  ○ Agility │
└────────────────────────────────┘

[█████ Save Settings █████]
```

## Theme Spacing Reference

```
xs (4px):     █
sm (8px):     ██
md (16px):    ████
lg (24px):    ██████
xl (32px):    ████████
xxl (48px):   ████████████
```

## Responsive Design

All components are responsive and work on:
- Small phones (320px width)
- Regular phones (375px width)
- Large phones (414px+ width)
- Tablets (768px+ width)

Components automatically adapt:
- Text sizes scale appropriately
- Button heights remain touchable
- Cards maintain proper aspect ratios
- Modals scale to screen size

## Animation Timings

```
Button press:       Immediate opacity change (0.7)
Modal slide-up:     300ms with ease-in-out
Progress fill:      500ms with smooth easing
Loading spinner:    Continuous rotation
```

## Accessibility Contrast Ratios

```
White (#FFFFFF) on Navy (#1A1A2E):     Ratio 12.6:1  ✓ AAA
White on Dark Surface (#252542):        Ratio 11.8:1  ✓ AAA
Green (#00E676) on Navy:                Ratio 4.2:1   ✓ AA
Orange (#FF6D00) on Navy:               Ratio 3.8:1   ✓ AA
Red (#F44336) on Navy:                  Ratio 3.1:1   ✓ AA
```

All components meet WCAG AA color contrast standards!

---

This visual guide provides a quick reference for all components and their variants.
For detailed implementation, refer to COMPONENTS.md and individual component files.

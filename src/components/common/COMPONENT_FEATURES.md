# Component Features & Specifications

## Component Overview

### 1. Button.tsx (4.2 KB)
**Features:**
- 5 variants: primary (green), secondary (orange), outline, ghost, danger (red)
- 3 sizes: sm, md, lg with responsive heights
- Loading state with ActivityIndicator
- Optional icon support with spacing
- Animated press effect (opacity change)
- Full width option
- Disabled state styling
- Proper padding and border radius

**Type Exports:**
- `ButtonVariant`: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
- `ButtonSize`: 'sm' | 'md' | 'lg'

---

### 2. Text.tsx (1.6 KB)
**Features:**
- 14 typography variants (h1-h4, body, bodySmall, caption, label, etc.)
- Color override support
- Text alignment control
- Font scaling disabled for consistency
- Maps to typography system
- Native RN Text wrapper with custom styling

**Type Exports:**
- `TextVariant`: All 14 typography variants
- `TextAlign`: 'auto' | 'left' | 'right' | 'center' | 'justify'

---

### 3. Card.tsx (1.6 KB)
**Features:**
- 3 variants: default, elevated (with shadow), outlined (with border)
- Optional press handler (Pressable)
- Rounded corners with border
- Dark surface background
- Consistent padding (16px)
- Opacity feedback on press

**Type Exports:**
- `CardVariant`: 'default' | 'elevated' | 'outlined'

---

### 4. Input.tsx (3.0 KB)
**Features:**
- Dark background with border
- Label above input
- Error message display (red text)
- Focus state with accent green border
- Secure text entry (password)
- Multiline support
- Optional icon
- Disabled state
- Responsive height based on multiline

---

### 5. Select.tsx (5.1 KB)
**Features:**
- Custom dropdown with scrollable options
- Multi-select mode with checkmarks
- Selected state highlighting (accent green)
- Label and error support
- Options display as pressable chips
- Smooth open/close with ScrollView
- Responsive to content
- Keyboard friendly

**Type Exports:**
- `SelectOption`: { label: string; value: string | number }

---

### 6. Modal.tsx (3.2 KB)
**Features:**
- Slide-up animation (300ms)
- Animated backdrop with opacity
- Backdrop press closes modal
- Close button (× symbol)
- Title support
- Dark theme styling
- Rounded top corners
- Uses native RN Modal with custom animation

---

### 7. Loading.tsx (1.5 KB)
**Features:**
- Full screen or inline loading overlay
- ActivityIndicator with accent green
- Optional message text
- Semi-transparent dark background
- Centered layout
- Positioned absolutely for full screen
- z-index 9999 for top layer

---

### 8. Header.tsx (2.7 KB)
**Features:**
- Back button with arrow icon
- Title and subtitle
- Right action area
- Dark surface background
- Bottom border separator
- Proper spacing and alignment
- Back button uses accent green color
- Touch feedback on back button

---

### 9. Badge.tsx (2.2 KB)
**Features:**
- 5 variants: success, warning, error, info, accent
- 2 sizes: sm, md
- Proper text color based on background
- Rounded pill shape (border-radius: 999)
- Light text for bright backgrounds
- Self-sizing

**Type Exports:**
- `BadgeVariant`: 'success' | 'warning' | 'error' | 'info' | 'accent'
- `BadgeSize`: 'sm' | 'md'

---

### 10. ProgressBar.tsx (2.2 KB)
**Features:**
- Animated fill using Animated API
- Supports 0-1 progress range
- Optional percentage label
- Customizable color
- Customizable height
- Native driver animation (500ms)
- Ease in/out timing
- Clamped values (0-1)

---

### 11. Divider.tsx (0.7 KB)
**Features:**
- Simple horizontal line
- Customizable color
- Customizable vertical margin
- Full width
- Subtle surface tertiary color by default

---

### 12. Avatar.tsx (2.0 KB)
**Features:**
- 3 sizes: sm (32px), md (40px), lg (48px)
- Initials fallback from name
- Optional image URL
- Circular shape
- Accent green background
- Automatic font sizing based on avatar size
- Uppercase initials

**Type Exports:**
- `AvatarSize`: 'sm' | 'md' | 'lg'

---

## Theme Integration Summary

### Colors Used
- Primary Navy: `#1A1A2E` (text inverse)
- Accent Green: `#00E676` (primary actions)
- Secondary Orange: `#FF6D00` (secondary actions)
- Surface Primary: `#252542` (cards, inputs)
- Surface Secondary: `#2D2D44` (backgrounds)
- Text Primary: `#FFFFFF` (main text)
- Text Secondary: `#B0B0C3` (secondary text)
- Status Colors: success (#4CAF50), warning (#FFC107), error (#F44336), info (#2196F3)

### Spacing Scale
- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px

### Border Radius
- xs: 2px
- sm: 4px
- md: 8px
- lg: 12px
- xl: 16px
- full: 999px (for circular/pill shapes)

### Shadows
- sm: elevation 4, subtle shadow
- md: elevation 8, card shadow
- lg: elevation 12, prominent shadow

---

## Component Dependencies

All components depend on:
1. React Native core
2. Theme system files:
   - `@/theme/colors`
   - `@/theme/spacing`
   - `@/theme/typography`

Components are self-contained with minimal cross-dependencies:
- Button → Text
- Input → Text
- Select → Text
- Modal → Text
- Loading → No text (optional)
- Header → Text
- Badge → Text
- ProgressBar → Text
- Card, Divider, Avatar → Minimal dependencies

---

## Performance Optimizations

1. **Text Component**: `allowFontScaling={false}` ensures consistency across devices
2. **ProgressBar**: Uses Animated API with native driver
3. **Modal**: Uses native driver animations
4. **Button**: Pressable for efficient touch handling
5. **Card**: Optional Pressable only when needed
6. **No unnecessary re-renders**: Props are optimized

---

## Production Readiness

✓ Complete TypeScript support
✓ Full prop documentation
✓ Error handling and edge cases
✓ Dark theme optimized
✓ Accessibility considerations
✓ Proper spacing and typography
✓ Animated interactions
✓ Loading and disabled states
✓ Form field validation
✓ No external dependencies beyond React Native

---

## File Statistics

| Component | Size | Lines | Props |
|-----------|------|-------|-------|
| Button.tsx | 4.2 KB | 160 | 8 |
| Text.tsx | 1.6 KB | 55 | 5 |
| Card.tsx | 1.6 KB | 65 | 4 |
| Input.tsx | 3.0 KB | 110 | 10 |
| Select.tsx | 5.1 KB | 180 | 7 |
| Modal.tsx | 3.2 KB | 115 | 4 |
| Loading.tsx | 1.5 KB | 50 | 3 |
| Header.tsx | 2.7 KB | 95 | 6 |
| Badge.tsx | 2.2 KB | 75 | 4 |
| ProgressBar.tsx | 2.2 KB | 85 | 5 |
| Divider.tsx | 0.7 KB | 25 | 3 |
| Avatar.tsx | 2.0 KB | 75 | 4 |
| **Total** | **31.5 KB** | **1,090** | **63** |

---

## Quick Import Reference

```tsx
import {
  Button,        // Button with variants
  Card,          // Dark card container
  Text,          // Typography component
  Input,         // Text input field
  Select,        // Dropdown/picker
  Modal,         // Slide-up modal
  Loading,       // Loading overlay
  Header,        // Screen header
  Badge,         // Status badge
  ProgressBar,   // Animated progress
  Divider,       // Horizontal line
  Avatar,        // User avatar
} from '@/components/common';

// Or import specific types
import { Button, type ButtonVariant } from '@/components/common';
```

---

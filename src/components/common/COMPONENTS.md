# Local Footy Athlete - Core UI Components

A comprehensive set of production-quality React Native components for the Local Footy Athlete app, designed with a dark sports theme featuring electric green accents, burnt orange secondary actions, and navy backgrounds.

## Color Palette

- **Primary Navy**: `#1A1A2E` - Primary background
- **Accent Green**: `#00E676` - Primary action color
- **Secondary Orange**: `#FF6D00` - Secondary actions
- **Surface**: `#252542` - Card backgrounds
- **Text Primary**: `#FFFFFF` - Main text color
- **Text Secondary**: `#B0B0C3` - Secondary text

## Components

### 1. Button

Versatile button component with multiple variants and sizes.

**Props:**
- `title` (string, required) - Button label
- `onPress` (function, required) - Press handler
- `variant` ('primary' | 'secondary' | 'outline' | 'ghost' | 'danger', default: 'primary')
- `size` ('sm' | 'md' | 'lg', default: 'md')
- `disabled` (boolean, default: false)
- `loading` (boolean, default: false) - Shows spinner
- `icon` (ReactNode) - Optional icon
- `fullWidth` (boolean, default: false)
- `style` (ViewStyle) - Additional styles

**Examples:**
```tsx
import { Button } from '@/components/common';

// Primary button
<Button title="Start Workout" onPress={() => {}} />

// Secondary action
<Button title="Cancel" onPress={() => {}} variant="secondary" />

// Outline button
<Button title="Delete" onPress={() => {}} variant="outline" />

// Large loading button
<Button
  title="Save"
  onPress={() => {}}
  size="lg"
  loading={isLoading}
  fullWidth
/>

// Danger button with icon
<Button
  title="Remove"
  onPress={() => {}}
  variant="danger"
  icon={<DeleteIcon />}
/>
```

---

### 2. Card

Dark-themed card container with optional elevation and borders.

**Props:**
- `children` (ReactNode, required)
- `variant` ('default' | 'elevated' | 'outlined', default: 'default')
- `onPress` (function) - Makes card pressable
- `style` (ViewStyle)

**Examples:**
```tsx
import { Card, Text } from '@/components/common';

// Basic card
<Card>
  <Text variant="h3">Player Stats</Text>
  <Text variant="body">Distance: 5.2 km</Text>
</Card>

// Elevated card (with shadow)
<Card variant="elevated">
  <Text variant="h3">Weekly Summary</Text>
</Card>

// Pressable card
<Card
  variant="outlined"
  onPress={() => navigation.push('Detail')}
>
  <Text variant="body">Tap to view more</Text>
</Card>
```

---

### 3. Text

Custom text component that maps typography variants to styles.

**Props:**
- `variant` ('h1' | 'h2' | 'h3' | 'h4' | 'body' | 'bodySmall' | 'caption' | 'label', default: 'body')
- `color` (string) - Text color override
- `align` ('left' | 'center' | 'right' | 'justify', default: 'auto')
- `style` (TextStyle)
- Standard React Native Text props

**Examples:**
```tsx
import { Text } from '@/components/common';

<Text variant="h1">Heading 1</Text>
<Text variant="h2">Heading 2</Text>
<Text variant="body">Body text</Text>
<Text variant="caption" color="#B0B0C3">Secondary text</Text>
<Text variant="label" align="center">Label centered</Text>
```

---

### 4. Input

Dark-themed text input with label, error handling, and focus states.

**Props:**
- `value` (string, required)
- `onChangeText` (function, required)
- `label` (string) - Input label
- `placeholder` (string)
- `error` (string) - Shows error message below input
- `secureTextEntry` (boolean) - Password field
- `multiline` (boolean)
- `icon` (ReactNode) - Icon inside input
- `disabled` (boolean)
- `style` (ViewStyle)
- Standard React Native TextInput props

**Examples:**
```tsx
import { Input } from '@/components/common';
import { useState } from 'react';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');

  return (
    <>
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="your@email.com"
        error={emailError}
      />

      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="••••••••"
      />

      <Input
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder="Add training notes..."
      />
    </>
  );
}
```

---

### 5. Select

Custom dropdown component with multi-select support.

**Props:**
- `value` (string | number | array, required)
- `options` (SelectOption[], required) - `{ label, value }`
- `onSelect` (function, required)
- `label` (string)
- `error` (string)
- `multiSelect` (boolean, default: false)
- `disabled` (boolean)
- `style` (ViewStyle)

**Examples:**
```tsx
import { Select } from '@/components/common';
import { useState } from 'react';

export function TrainingForm() {
  const [sport, setSport] = useState('');
  const [skills, setSkills] = useState([]);

  const sports = [
    { label: 'Football', value: 'football' },
    { label: 'Basketball', value: 'basketball' },
    { label: 'Soccer', value: 'soccer' },
  ];

  const skillOptions = [
    { label: 'Strength', value: 'strength' },
    { label: 'Speed', value: 'speed' },
    { label: 'Agility', value: 'agility' },
  ];

  return (
    <>
      <Select
        label="Sport"
        value={sport}
        options={sports}
        onSelect={setSport}
      />

      <Select
        label="Focus Areas"
        value={skills}
        options={skillOptions}
        onSelect={setSkills}
        multiSelect
      />
    </>
  );
}
```

---

### 6. Modal

Slide-up modal with animated backdrop and close button.

**Props:**
- `visible` (boolean, required)
- `onClose` (function, required)
- `title` (string) - Modal title
- `children` (ReactNode, required)
- `style` (ViewStyle)

**Examples:**
```tsx
import { Modal, Button, Text } from '@/components/common';
import { useState } from 'react';

export function ModalExample() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Button title="Open Modal" onPress={() => setShowModal(true)} />

      <Modal
        visible={showModal}
        onClose={() => setShowModal(false)}
        title="Workout Details"
      >
        <Text variant="body">Duration: 45 minutes</Text>
        <Text variant="body">Intensity: High</Text>
        <Button
          title="Close"
          onPress={() => setShowModal(false)}
          fullWidth
        />
      </Modal>
    </>
  );
}
```

---

### 7. Loading

Full-screen or partial loading overlay with optional message.

**Props:**
- `message` (string) - Optional loading message
- `fullScreen` (boolean, default: true) - Absolute fill or flex
- `style` (ViewStyle)

**Examples:**
```tsx
import { Loading } from '@/components/common';

// Full screen loading
<Loading message="Loading workouts..." />

// Inline loading
<Loading fullScreen={false} message="Saving..." />
```

---

### 8. Header

Screen header with optional back button and right action.

**Props:**
- `title` (string, required)
- `subtitle` (string) - Secondary text
- `showBack` (boolean) - Show back button
- `onBack` (function) - Back press handler
- `rightAction` (ReactNode) - Right side element
- `style` (ViewStyle)

**Examples:**
```tsx
import { Header, Button } from '@/components/common';
import { useNavigation } from '@react-navigation/native';

export function ProfileScreen() {
  const navigation = useNavigation();

  return (
    <>
      <Header
        title="My Profile"
        subtitle="@athlete_name"
        showBack
        onBack={() => navigation.goBack()}
        rightAction={<EditIcon />}
      />
      {/* Screen content */}
    </>
  );
}
```

---

### 9. Badge

Small tag/badge component for status indicators.

**Props:**
- `text` (string, required)
- `variant` ('success' | 'warning' | 'error' | 'info' | 'accent', default: 'accent')
- `size` ('sm' | 'md', default: 'md')
- `style` (ViewStyle)

**Examples:**
```tsx
import { Badge } from '@/components/common';

<Badge text="Active" variant="success" />
<Badge text="Pending" variant="warning" />
<Badge text="Rest Day" variant="info" size="sm" />
<Badge text="New PR" variant="accent" />
```

---

### 10. ProgressBar

Animated progress bar with optional percentage label.

**Props:**
- `progress` (number, required) - 0 to 1
- `color` (string, default: accent green)
- `height` (number, default: 8)
- `showLabel` (boolean, default: false) - Shows percentage
- `animated` (boolean, default: true)
- `style` (ViewStyle)

**Examples:**
```tsx
import { ProgressBar } from '@/components/common';

// Basic progress
<ProgressBar progress={0.65} />

// With label and custom color
<ProgressBar
  progress={0.85}
  showLabel
  color="#FF6D00"
/>

// Week progress with height
<ProgressBar
  progress={5/7}
  height={12}
  showLabel
/>
```

---

### 11. Divider

Simple horizontal line divider with customizable styling.

**Props:**
- `color` (string) - Line color
- `spacing` (number) - Vertical margin
- `style` (ViewStyle)

**Examples:**
```tsx
import { Divider, Text } from '@/components/common';

<Text variant="h3">Section 1</Text>
<Divider />
<Text variant="h3">Section 2</Text>

<Divider color="#FF6D00" spacing={24} />
```

---

### 12. Avatar

User avatar with initials fallback.

**Props:**
- `name` (string, required) - For generating initials
- `size` ('sm' | 'md' | 'lg', default: 'md')
- `imageUrl` (string) - Profile image URL
- `style` (ViewStyle)

**Examples:**
```tsx
import { Avatar } from '@/components/common';

// With initials
<Avatar name="John Smith" size="md" />

// With image
<Avatar
  name="Jane Doe"
  size="lg"
  imageUrl="https://..."
/>

// Small avatar
<Avatar name="John" size="sm" />
```

---

## Theme Integration

All components use the theme system located in `/src/theme/`:

- **colors.ts** - Complete color palette
- **spacing.ts** - Spacing scale, shadows, and dimensions
- **typography.ts** - Font sizes and weights

### Custom Theme Usage

```tsx
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';

// Colors
colors.accent.electric    // #00E676
colors.secondary.main     // #FF6D00
colors.text.primary       // #FFFFFF

// Spacing
spacing.xs    // 4
spacing.sm    // 8
spacing.md    // 16
spacing.lg    // 24

// Typography
typography.h1.fontSize    // 32
typography.body.fontWeight // '400'
```

---

## Import Pattern

```tsx
// Individual imports
import { Button, Card, Text } from '@/components/common';

// Or from index
import { Button, Modal, Badge } from '@/components/common';
```

---

## Accessibility Notes

- All interactive components support disabled states
- Text components use `allowFontScaling={false}` for consistency
- Buttons provide visual feedback on press
- Proper color contrast maintained for readability on dark theme
- Form components include labels and error messaging

---

## Best Practices

1. **Always use the theme colors** - Don't hardcode color values
2. **Use spacing constants** - Maintain visual hierarchy
3. **Leverage typography variants** - Ensure consistency
4. **Handle loading states** - Use `loading` prop on buttons
5. **Show error states** - Input and Select have error props
6. **Provide feedback** - Use badges, toasts, or messages for actions
7. **Keep modals focused** - One primary action per modal

---

## Performance Considerations

- Components use React.memo where appropriate
- Text component has `allowFontScaling={false}` for consistency
- Modal animations use native driver
- ProgressBar uses Animated API for smooth transitions
- Card with onPress uses Pressable for efficiency

---

## Dark Theme Support

All components are built for dark theme:
- Dark backgrounds reduce eye strain
- Electric green provides high contrast
- Status colors (red, orange, green) are accessible
- Text colors meet WCAG AA standards

---

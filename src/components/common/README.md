# Local Footy Athlete - Core UI Components

A complete, production-ready component library for the Local Footy Athlete React Native app featuring a dark sports theme with electric green accents.

## Quick Start

```tsx
import {
  Button,
  Card,
  Text,
  Input,
  Select,
  Modal,
  Header,
  Badge,
  Avatar,
} from '@/components/common';

export function ExampleScreen() {
  return (
    <>
      <Header title="Home" />
      <Button title="Start Workout" onPress={() => {}} />
      <Card>
        <Text variant="h3">Recent Activity</Text>
      </Card>
    </>
  );
}
```

## Components (12 Total)

### Interactive Components
1. **Button** - Primary action component with 5 variants
2. **Input** - Text input with validation and focus states
3. **Select** - Dropdown with multi-select support
4. **Card** - Pressable container with 3 variants
5. **Header** - Screen header with back button

### Display Components
6. **Text** - Typography with 14 variants
7. **Badge** - Status indicator tags
8. **Avatar** - User profile avatars with initials
9. **ProgressBar** - Animated progress indicator
10. **Divider** - Horizontal line separator

### Modal & Overlay
11. **Modal** - Slide-up modal with animations
12. **Loading** - Full-screen or inline loading overlay

## Theme Colors

| Element | Color | Hex |
|---------|-------|-----|
| Primary Navy | Deep background | #1A1A2E |
| Accent Green | Primary action | #00E676 |
| Orange | Secondary action | #FF6D00 |
| Card Surface | Container | #252542 |
| Text | Primary text | #FFFFFF |
| Success | Positive state | #4CAF50 |
| Warning | Warning state | #FFC107 |
| Error | Error state | #F44336 |

## Common Patterns

### Form Handling
```tsx
const [formData, setFormData] = useState({
  email: '',
  password: '',
  sport: '',
});

<Input
  label="Email"
  value={formData.email}
  onChangeText={(text) => setFormData({...formData, email: text})}
  placeholder="your@email.com"
/>

<Select
  label="Sport"
  value={formData.sport}
  options={[{label: 'Football', value: 'football'}]}
  onSelect={(value) => setFormData({...formData, sport: value})}
/>
```

### Loading & Async
```tsx
const [isLoading, setIsLoading] = useState(false);

const handlePress = async () => {
  setIsLoading(true);
  await someAsyncTask();
  setIsLoading(false);
};

<Button
  title="Submit"
  onPress={handlePress}
  loading={isLoading}
/>
```

### Modal Patterns
```tsx
const [showModal, setShowModal] = useState(false);

<Modal
  visible={showModal}
  onClose={() => setShowModal(false)}
  title="Confirm Action"
>
  <Text>Are you sure?</Text>
  <Button title="Confirm" onPress={handleConfirm} />
</Modal>
```

### List with Cards
```tsx
<ScrollView>
  {workouts.map((workout) => (
    <Card
      key={workout.id}
      onPress={() => navigation.push('Detail', {id: workout.id})}
    >
      <Text variant="h4">{workout.name}</Text>
      <Badge text={workout.status} variant="success" />
    </Card>
  ))}
</ScrollView>
```

## Styling

All components accept a `style` prop for additional customization:

```tsx
<Button
  title="Custom Style"
  onPress={() => {}}
  style={{ marginTop: 20 }}
/>

<Card style={{ marginBottom: 16 }}>
  {/* content */}
</Card>
```

## Accessibility

- **Color Contrast**: All text meets WCAG AA standards
- **Touch Targets**: Minimum 44pt for interactive elements
- **Labels**: Form inputs have accessible labels
- **Disabled States**: Clear visual feedback for disabled elements
- **Focus States**: Clear indication of focused interactive elements

## TypeScript Support

Full TypeScript support with exported types:

```tsx
import {
  Button,
  type ButtonVariant,
  type ButtonSize,
  Select,
  type SelectOption,
} from '@/components/common';

const variant: ButtonVariant = 'primary';
const option: SelectOption = { label: 'Text', value: 'value' };
```

## Dark Theme

All components are optimized for dark theme:
- Dark backgrounds reduce eye strain
- Electric green (#00E676) provides high contrast
- Text colors are white (#FFFFFF) for clarity
- Status colors remain easily distinguishable

## Performance

- Native driver animations for smooth performance
- Minimal re-renders with optimized props
- Efficient ScrollView usage in Select
- Proper Animated API implementation in ProgressBar

## Browser-like Components

React Native doesn't have true browser elements, so these components provide modern UI patterns:

- **Input** replaces `<input>` with form validation
- **Select** replaces `<select>` with custom dropdown
- **Modal** replaces alert dialogs with animated overlays
- **Button** replaces `<button>` with multiple styles

## File Structure

```
components/common/
├── Button.tsx          (4.2 KB)
├── Text.tsx            (1.6 KB)
├── Card.tsx            (1.6 KB)
├── Input.tsx           (3.0 KB)
├── Select.tsx          (5.1 KB)
├── Modal.tsx           (3.2 KB)
├── Loading.tsx         (1.5 KB)
├── Header.tsx          (2.7 KB)
├── Badge.tsx           (2.2 KB)
├── ProgressBar.tsx     (2.2 KB)
├── Divider.tsx         (0.7 KB)
├── Avatar.tsx          (2.0 KB)
├── index.ts            (exports)
├── README.md           (this file)
├── COMPONENTS.md       (detailed docs)
└── COMPONENT_FEATURES.md (specifications)
```

## Usage Examples by Screen Type

### Authentication Screen
```tsx
export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <>
      <Header title="Login" />
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
      />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button
        title="Sign In"
        loading={loading}
        fullWidth
        onPress={handleLogin}
      />
    </>
  );
}
```

### List Screen
```tsx
export function WorkoutsScreen() {
  const [workouts] = useState([...]);

  return (
    <>
      <Header title="Workouts" />
      <ScrollView>
        {workouts.map((w) => (
          <Card key={w.id} onPress={() => {}}>
            <Text variant="h4">{w.name}</Text>
            <Badge text={w.type} variant="accent" />
          </Card>
        ))}
      </ScrollView>
    </>
  );
}
```

### Settings Screen
```tsx
export function SettingsScreen() {
  const [sport, setSport] = useState('');
  const [level, setLevel] = useState('');

  return (
    <>
      <Header title="Settings" showBack />
      <Select
        label="Sport"
        value={sport}
        options={sportOptions}
        onSelect={setSport}
      />
      <Select
        label="Level"
        value={level}
        options={levelOptions}
        onSelect={setLevel}
      />
      <Button title="Save" onPress={() => {}} fullWidth />
    </>
  );
}
```

## Best Practices

1. **Use the theme system** - Import colors, spacing, typography from theme
2. **Handle loading states** - Show feedback for async operations
3. **Validate forms** - Use Input error prop for validation messages
4. **Provide feedback** - Use Badge for status, Toast for notifications
5. **Keep modals simple** - One primary action per modal
6. **Responsive design** - Test on various screen sizes
7. **Keyboard aware** - Consider keyboard when using Input
8. **Touch feedback** - All interactive elements should provide visual feedback

## Common Issues & Solutions

### Input doesn't have focus state styling
- The component includes focus state with accent green border - ensure theme is properly imported

### Select dropdown appears behind other elements
- The dropdown uses zIndex implicitly - if needed, wrap in a View with higher zIndex

### Button text seems cut off
- Use appropriate button size (sm, md, lg) and check fullWidth prop

### Avatar initials look wrong
- The component takes the first letter of each word - ensure name format is "FirstName LastName"

## Migration from Web

If migrating from web components:

- Use `Button` instead of `<button>`
- Use `Input` instead of `<input>`
- Use `Select` instead of `<select>`
- Use `Modal` instead of modal dialogs
- Use `Card` instead of `<div>` containers
- Use `Text` for all text content (not RN Text directly)

## Future Enhancements

Possible additions for future versions:
- Checkbox component
- Radio button component
- Toast/Snackbar notification
- Tooltip component
- Autocomplete input
- Date picker
- Time picker
- Searchable select
- Slider component
- Switch/Toggle component

## License

Part of the Local Footy Athlete application.

## Support

For issues or questions about components:
1. Check COMPONENTS.md for detailed documentation
2. Review COMPONENT_FEATURES.md for specifications
3. Check theme/colors.ts for available colors
4. Verify proper imports from @/components/common

---

**Last Updated**: March 1, 2026
**Component Count**: 12
**Total Size**: ~31.5 KB
**TypeScript**: ✓ Full Support
**Dark Theme**: ✓ Optimized

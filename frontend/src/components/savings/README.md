# Balance Sparkline Component

A small balance trend chart component that displays balance over time from indexed history with accessible summary text and graceful handling of sparse data.

## Features

- ✅ Shows balance trend over time
- ✅ Accessible with ARIA labels and screen reader support
- ✅ Handles sparse data gracefully
- ✅ Responsive SVG-based visualization
- ✅ Customizable dimensions and styling
- ✅ Currency formatting for tooltips
- ✅ Empty state handling

## Usage

```tsx
import { BalanceSparkline } from '@/components/savings';

const balanceData = [
  { timestamp: 1640995200000, balance: 1000 },
  { timestamp: 1643673600000, balance: 1250 },
  { timestamp: 1646092800000, balance: 1100 },
  { timestamp: 1648771200000, balance: 1400 },
  { timestamp: 1651363200000, balance: 1600 },
];

function Dashboard() {
  return (
    <div>
      <h2>Balance Trend</h2>
      <BalanceSparkline 
        data={balanceData}
        width={120}
        height={40}
        ariaLabel="Balance trend showing increase from $1,000 to $1,600"
      />
    </div>
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `BalanceDataPoint[]` | required | Array of balance data points with timestamp and balance |
| `width` | `number` | `120` | Width of the sparkline in pixels |
| `height` | `number` | `40` | Height of the sparkline in pixels |
| `className` | `string` | `""` | Additional CSS classes |
| `ariaLabel` | `string` | auto-generated | Custom ARIA label for accessibility |

## Data Format

```typescript
interface BalanceDataPoint {
  timestamp: number; // Unix timestamp in milliseconds
  balance: number;   // Balance amount in base currency units
}
```

## Accessibility

The component automatically generates accessible summaries that include:
- Total number of data points
- Start and end balance values
- Trend direction (up/down/flat)
- Percentage change when applicable

Example generated summary: "Balance trend over 5 data points: from $1,000 to $1,600, increased by $600 (60%)"

## Styling

The component uses Tailwind CSS classes for styling:
- `stroke-brand`: Green color for upward trends
- `stroke-red-400`: Red color for downward trends  
- `stroke-muted`: Gray color for flat trends

## Testing

The component includes comprehensive tests covering:
- Rendering with sample data series
- Empty series handling
- Sparse data handling
- Accessibility features
- Currency formatting
- Trend detection
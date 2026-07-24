import { theme } from '@/src/theme';

describe('theme', () => {
  it('exposes the color tokens screens rely on', () => {
    for (const key of ['brand', 'brandPrimary', 'success', 'warning', 'error', 'info', 'muted', 'border']) {
      expect(theme.colors).toHaveProperty(key);
      expect(typeof (theme.colors as Record<string, unknown>)[key]).toBe('string');
    }
  });

  it('exposes spacing and radius scales', () => {
    expect(theme.spacing.md).toBeGreaterThan(0);
    expect(theme.radius.pill).toBeGreaterThan(theme.radius.lg);
  });
});

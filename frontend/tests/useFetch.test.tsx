import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useFetch } from '@/src/hooks/useFetch';

jest.mock('@/src/api', () => ({
  api: jest.fn(),
}));

const { api } = jest.requireMock('@/src/api');

describe('useFetch', () => {
  beforeEach(() => {
    api.mockReset();
  });

  it('resolves data and clears the loading flag', async () => {
    api.mockResolvedValueOnce({ ok: true });
    const { result } = renderHook(() => useFetch('/some/path'));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual({ ok: true });
    expect(result.current.error).toBeNull();
  });

  it('surfaces a failed request as an error string, not a thrown exception', async () => {
    api.mockRejectedValueOnce(new Error('Network down'));
    const { result } = renderHook(() => useFetch('/some/path'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Network down');
    expect(result.current.data).toBeUndefined();
  });

  it('refresh() re-triggers the request', async () => {
    api.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 2 });
    const { result } = renderHook(() => useFetch('/some/path'));

    await waitFor(() => expect(result.current.data).toEqual({ count: 1 }));

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => expect(result.current.data).toEqual({ count: 2 }));
    expect(api).toHaveBeenCalledTimes(2);
  });
});

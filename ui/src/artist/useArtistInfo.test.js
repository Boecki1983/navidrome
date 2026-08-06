import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react-hooks'
import { waitFor } from '@testing-library/react'
import { useArtistInfo } from './useArtistInfo'
import subsonic from '../subsonic'

vi.mock('../subsonic', () => ({
  default: { getArtistInfo: vi.fn() },
}))

describe('useArtistInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns undefined when no artistId is given', () => {
    const { result } = renderHook(() => useArtistInfo(undefined))
    expect(result.current).toBeUndefined()
  })

  it('fetches and returns artistInfo on success', async () => {
    subsonic.getArtistInfo.mockResolvedValue({
      json: {
        'subsonic-response': {
          status: 'ok',
          artistInfo: { biography: 'A great band.' },
        },
      },
    })

    const { result } = renderHook(() => useArtistInfo('artist-1'))

    await waitFor(() =>
      expect(result.current).toEqual({ biography: 'A great band.' }),
    )
    expect(subsonic.getArtistInfo).toHaveBeenCalledWith('artist-1')
  })

  it('leaves artistInfo undefined when the response status is not ok', async () => {
    subsonic.getArtistInfo.mockResolvedValue({
      json: { 'subsonic-response': { status: 'failed' } },
    })

    const { result } = renderHook(() => useArtistInfo('artist-1'))

    await waitFor(() => expect(subsonic.getArtistInfo).toHaveBeenCalled())
    expect(result.current).toBeUndefined()
  })
})

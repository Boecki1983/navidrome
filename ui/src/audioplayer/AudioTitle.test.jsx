import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import AudioTitle from './AudioTitle'

vi.mock('@material-ui/core', async () => {
  const actual = await import('@material-ui/core')
  return {
    ...actual,
    useMediaQuery: vi.fn(),
  }
})

const mockDispatch = vi.fn()
vi.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
}))

vi.mock('react-dnd', () => ({
  useDrag: vi.fn(() => [null, () => {}]),
}))

describe('<AudioTitle />', () => {
  const baseSong = {
    id: 'song-1',
    albumId: 'album-1',
    playlistId: 'playlist-1',
    title: 'Test Song',
    artist: 'Artist',
    album: 'Album',
    year: '2020',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockDispatch.mockClear()
  })

  it('renders the track title and opens the overlay on click', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const audioInfo = { trackId: 'track-1', song: baseSong }
    render(<AudioTitle audioInfo={audioInfo} gainInfo={{}} isMobile={false} />)
    expect(screen.getByText('Test Song')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByText('Test Song'))
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PLAYER_SET_OVERLAY_OPEN' }),
    )
  })

  it('dispatches openNowPlayingOverlay instead of navigating when clicked', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const audioInfo = { trackId: 'track-1', song: baseSong }
    render(<AudioTitle audioInfo={audioInfo} gainInfo={{}} isMobile={false} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Test Song'))

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PLAYER_SET_OVERLAY_OPEN' }),
    )
  })
})

import React from 'react'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { describe, it, expect, vi } from 'vitest'
import NowPlayingOverlay from './NowPlayingOverlay'

vi.mock('../subsonic', () => ({
  default: { getCoverArtUrl: vi.fn(() => 'https://example.com/cover.jpg') },
}))

vi.mock('../artist/useArtistInfo', () => ({
  useArtistInfo: vi.fn(() => ({ biography: 'A great band.' })),
}))

// The component's `useTranslate()` needs a real i18nProvider to resolve
// keys to English text. Without an <Admin>/<TestContext> wrapper the default
// react-admin context falls back to an identity function (key => key), so
// tests asserting on the human-readable strings need this lookup mocked.
vi.mock('react-admin', async (importOriginal) => {
  const actual = await importOriginal()
  const messages = {
    'nowPlayingOverlay.close': 'Close',
    'nowPlayingOverlay.lyrics': 'Lyrics',
    'nowPlayingOverlay.noLyrics': 'No lyrics',
    'nowPlayingOverlay.aboutArtist': 'About the artist',
    'nowPlayingOverlay.upNext': 'Up next',
  }
  return {
    ...actual,
    useTranslate: () => (key) => messages[key] || key,
  }
})

const queueItem = (overrides = {}) => ({
  trackId: 't1',
  uuid: 'u1',
  name: 'Song One',
  singer: 'Artist One',
  cover: 'https://example.com/cover.jpg',
  song: {
    id: 't1',
    title: 'Song One',
    artist: 'Artist One',
    artistId: 'artist-1',
    album: 'Album One',
    year: 2020,
    genre: 'Rock',
  },
  ...overrides,
})

const renderWithStore = (playerState) => {
  const store = createStore(() => ({ player: playerState }))
  return render(
    <Provider store={store}>
      <NowPlayingOverlay />
    </Provider>,
  )
}

describe('<NowPlayingOverlay />', () => {
  it('renders nothing when overlayOpen is false', () => {
    renderWithStore({
      overlayOpen: false,
      queue: [queueItem()],
      current: { uuid: 'u1', song: queueItem().song },
    })
    expect(screen.queryByTestId('now-playing-overlay')).not.toBeInTheDocument()
  })

  it('renders track metadata when overlayOpen is true', () => {
    const item = queueItem()
    renderWithStore({
      overlayOpen: true,
      queue: [item],
      current: { uuid: 'u1', song: item.song },
    })
    expect(screen.getByTestId('now-playing-overlay')).toBeInTheDocument()
    expect(screen.getByText('Song One')).toBeInTheDocument()
    expect(screen.getByText('Artist One')).toBeInTheDocument()
    expect(screen.getByText(/Album One/)).toBeInTheDocument()
  })

  it('shows the no-lyrics message when the current track has no lyric text', () => {
    const item = queueItem({ lyric: '' })
    renderWithStore({
      overlayOpen: true,
      queue: [item],
      current: { uuid: 'u1', song: item.song },
    })
    expect(screen.getByText('No lyrics')).toBeInTheDocument()
  })

  it('renders remaining queue items as up next', () => {
    const first = queueItem({ uuid: 'u1', name: 'Song One' })
    const second = queueItem({
      uuid: 'u2',
      name: 'Song Two',
      song: { ...first.song, id: 't2', title: 'Song Two' },
    })
    renderWithStore({
      overlayOpen: true,
      queue: [first, second],
      current: { uuid: 'u1', song: first.song },
    })
    expect(screen.getByText('Song Two')).toBeInTheDocument()
  })

  it('dispatches close on close button click', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const item = queueItem()
    const store = createStore(
      (
        state = {
          player: {
            overlayOpen: true,
            queue: [item],
            current: { uuid: 'u1', song: item.song },
          },
        },
        action,
      ) =>
        action.type === 'PLAYER_SET_OVERLAY_OPEN'
          ? {
              ...state,
              player: { ...state.player, overlayOpen: action.data.open },
            }
          : state,
    )
    render(
      <Provider store={store}>
        <NowPlayingOverlay />
      </Provider>,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByTestId('now-playing-overlay')).not.toBeInTheDocument()
  })
})

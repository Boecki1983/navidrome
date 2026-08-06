# Now-Playing-Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-screen "Now Playing" overlay (cover, metadata, lyrics, artist bio, queue) that opens when the user clicks the cover or title in the existing mini player bar.

**Architecture:** Redux gets one new boolean flag (`player.overlayOpen`) toggled by two existing click targets (`Player.jsx`'s `onCoverClick`, `AudioTitle.jsx`'s title link). A new `NowPlayingOverlay` component, mounted as a sibling of `<Player/>` in `App.jsx`, renders on top of everything when the flag is true and reads all its data from the existing `state.player` slice — no new data fetching except artist bio, which reuses a hook extracted from the existing Artist page.

**Tech Stack:** React 17, react-admin v3, @material-ui/core v4, Redux (plain reducers, no Redux Toolkit), Vitest + React Testing Library.

## Global Constraints

- No backend/Go changes. Everything needed is already exposed via existing endpoints/state.
- No new route/URL — the overlay is a client-side show/hide, not a page.
- The library-driven mini player (`navidrome-music-player` / `ReactJkMusicPlayer` in `ui/src/audioplayer/Player.jsx`) must keep running unchanged underneath — no remount, no interference with playback.
- Follow the existing Spotify-theme dark-gradient look already used by `NDAlbumDetails`/`NDPlaylistDetails` in `ui/src/themes/spotify.js`.
- Build/deploy uses the existing pipeline: `docker build -t navidrome-custom:local .` then `docker compose -f /home/dockerfiles/navidrome/navidrome.yml up -d`, run directly, no new script.

---

### Task 1: Extract `useArtistInfo` hook from the Artist page

The artist bio (Last.fm) is currently fetched inline inside `ArtistShow.jsx`'s
`ArtistDetails` component. The overlay needs the same data for the current
track's artist, so extract it into a reusable hook first (behavior-preserving
refactor of existing code, no new behavior yet).

**Files:**
- Create: `ui/src/artist/useArtistInfo.js`
- Modify: `ui/src/artist/ArtistShow.jsx:1-84`
- Test: `ui/src/artist/useArtistInfo.test.js`

**Interfaces:**
- Produces: `useArtistInfo(artistId: string | undefined) => artistInfo: object | undefined` — `artistInfo.biography` is the Last.fm bio HTML string when available. Consumed by Task 4.

- [ ] **Step 1: Write the failing test**

```javascript
// ui/src/artist/useArtistInfo.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ui && npx vitest run src/artist/useArtistInfo.test.js`
Expected: FAIL — `Cannot find module './useArtistInfo'`

- [ ] **Step 3: Write the hook**

```javascript
// ui/src/artist/useArtistInfo.js
import { useState, useEffect } from 'react'
import subsonic from '../subsonic'

export const useArtistInfo = (artistId) => {
  const [artistInfo, setArtistInfo] = useState()

  useEffect(() => {
    if (!artistId) {
      setArtistInfo(undefined)
      return
    }

    let cancelled = false

    subsonic
      .getArtistInfo(artistId)
      .then((resp) => resp.json['subsonic-response'])
      .then((data) => {
        if (!cancelled && data.status === 'ok') {
          setArtistInfo(data.artistInfo)
        }
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error('error fetching artist info', e)
      })

    return () => {
      cancelled = true
    }
  }, [artistId])

  return artistInfo
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ui && npx vitest run src/artist/useArtistInfo.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Refactor `ArtistShow.jsx` to use the hook**

Replace the top of `ui/src/artist/ArtistShow.jsx` (imports + `ArtistDetails`):

```javascript
// Remove these two lines from the top-level import block:
//   import { useState, useEffect } from 'react'
//   import subsonic from '../subsonic'
// Add instead:
import { useArtistInfo } from './useArtistInfo'
```

```javascript
const ArtistDetails = (props) => {
  const record = useRecordContext(props)
  const isDesktop = useMediaQuery((theme) => theme.breakpoints.up('sm'), {
    noSsr: true,
  })
  const artistInfo = useArtistInfo(record.id)
  const biography = artistInfo?.biography || record.biography

  const Component = isDesktop ? DesktopArtistDetails : MobileArtistDetails
  return (
    <Component artistInfo={artistInfo} record={record} biography={biography} />
  )
}
```

Confirm `useState`/`useEffect`/`subsonic` are not used anywhere else in
`ArtistShow.jsx` before removing the imports (`grep -n "useState\|useEffect\|subsonic\." ui/src/artist/ArtistShow.jsx` should only show the `ArtistDetails` usage being replaced).

- [ ] **Step 6: Run the full artist test suite to confirm no regression**

Run: `cd ui && npx vitest run src/artist`
Expected: PASS, no existing artist tests broken

- [ ] **Step 7: Commit**

```bash
cd /home/dockerfiles/navidrome/src
git add ui/src/artist/useArtistInfo.js ui/src/artist/useArtistInfo.test.js ui/src/artist/ArtistShow.jsx
git commit -m "refactor: extract useArtistInfo hook from ArtistShow"
```

---

### Task 2: Add Redux state for the overlay open/close flag

**Files:**
- Modify: `ui/src/actions/player.js` (append action type + creators)
- Modify: `ui/src/reducers/playerReducer.js:18-24` (initial state), `:211-251` (switch)
- Test: `ui/src/reducers/playerReducer.test.js` (append cases)

**Interfaces:**
- Produces: `PLAYER_SET_OVERLAY_OPEN` action type, `openNowPlayingOverlay()` / `closeNowPlayingOverlay()` action creators, `state.player.overlayOpen: boolean`. Consumed by Task 3 (dispatch) and Task 4/5 (read + close).

- [ ] **Step 1: Write the failing reducer test**

Append to `ui/src/reducers/playerReducer.test.js`:

```javascript
import { playerReducer } from './playerReducer'
import { PLAYER_SET_OVERLAY_OPEN } from '../actions'

describe('overlayOpen flag', () => {
  it('defaults to false', () => {
    const result = playerReducer(undefined, { type: '@@INIT' })
    expect(result.overlayOpen).toBe(false)
  })

  it('opens the overlay', () => {
    const result = playerReducer(
      { queue: [], current: {}, clear: false, volume: 1, overlayOpen: false },
      { type: PLAYER_SET_OVERLAY_OPEN, data: { open: true } },
    )
    expect(result.overlayOpen).toBe(true)
  })

  it('closes the overlay', () => {
    const result = playerReducer(
      { queue: [], current: {}, clear: false, volume: 1, overlayOpen: true },
      { type: PLAYER_SET_OVERLAY_OPEN, data: { open: false } },
    )
    expect(result.overlayOpen).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ui && npx vitest run src/reducers/playerReducer.test.js`
Expected: FAIL — `PLAYER_SET_OVERLAY_OPEN` is not exported / `overlayOpen` undefined

- [ ] **Step 3: Add the action type and creators**

Append to `ui/src/actions/player.js` (after the existing `export const PLAYER_REFRESH_QUEUE = ...` line):

```javascript
export const PLAYER_SET_OVERLAY_OPEN = 'PLAYER_SET_OVERLAY_OPEN'
```

Append to the bottom of the same file:

```javascript
export const openNowPlayingOverlay = () => ({
  type: PLAYER_SET_OVERLAY_OPEN,
  data: { open: true },
})

export const closeNowPlayingOverlay = () => ({
  type: PLAYER_SET_OVERLAY_OPEN,
  data: { open: false },
})
```

- [ ] **Step 4: Update the reducer**

In `ui/src/reducers/playerReducer.js`, add `overlayOpen: false` to `initialState`:

```javascript
const initialState = {
  queue: [],
  current: {},
  clear: false,
  volume: config.defaultUIVolume / 100,
  savedPlayIndex: 0,
  overlayOpen: false,
}
```

Add the import at the top (extend the existing destructured import from `'../actions'`):

```javascript
import {
  PLAYER_ADD_TRACKS,
  PLAYER_CLEAR_QUEUE,
  PLAYER_CURRENT,
  PLAYER_PLAY_NEXT,
  PLAYER_PLAY_TRACKS,
  PLAYER_SET_TRACK,
  PLAYER_SET_VOLUME,
  PLAYER_SYNC_QUEUE,
  PLAYER_SET_MODE,
  PLAYER_REFRESH_QUEUE,
  PLAYER_SET_OVERLAY_OPEN,
} from '../actions'
```

Add the reduce function next to the other `reduce*` helpers:

```javascript
const reduceSetOverlayOpen = (state, { data: { open } }) => ({
  ...state,
  overlayOpen: open,
})
```

Add the case in the `switch` inside `playerReducer`:

```javascript
    case PLAYER_SET_OVERLAY_OPEN:
      return reduceSetOverlayOpen(previousState, payload)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd ui && npx vitest run src/reducers/playerReducer.test.js`
Expected: PASS (all cases including the 3 new ones)

- [ ] **Step 6: Commit**

```bash
cd /home/dockerfiles/navidrome/src
git add ui/src/actions/player.js ui/src/reducers/playerReducer.js ui/src/reducers/playerReducer.test.js
git commit -m "feat: add overlayOpen flag to player redux state"
```

---

### Task 3: Wire cover/title clicks to open the overlay

Today, clicking the cover in the mini player (`onCoverClick` in `Player.jsx`)
navigates to the album page, and clicking the title (`AudioTitle.jsx`'s
`<Link>`) also navigates to the album/playlist page. Both should instead open
the overlay.

**Files:**
- Modify: `ui/src/audioplayer/Player.jsx:368-372` (`onCoverClick`)
- Modify: `ui/src/audioplayer/AudioTitle.jsx` (click handler)
- Test: `ui/src/audioplayer/AudioTitle.test.jsx` (extend existing tests)

**Interfaces:**
- Consumes: `openNowPlayingOverlay()` from Task 2.
- Produces: no new exports — internal behavior change of two existing components.

- [ ] **Step 1: Write the failing test for `AudioTitle`**

Add to `ui/src/audioplayer/AudioTitle.test.jsx` (needs a redux mock — the
existing file has no store, so add a minimal `useDispatch` mock):

```javascript
// Add near the top, alongside the other vi.mock calls:
const mockDispatch = vi.fn()
vi.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
}))

// Add inside beforeEach (alongside vi.clearAllMocks()):
// mockDispatch.mockClear()

// Add a new test:
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ui && npx vitest run src/audioplayer/AudioTitle.test.jsx`
Expected: FAIL — dispatch never called (click still navigates)

- [ ] **Step 3: Update `AudioTitle.jsx`**

```javascript
import React from 'react'
import { useMediaQuery } from '@material-ui/core'
import { useDispatch } from 'react-redux'
import clsx from 'clsx'
import { QualityInfo } from '../common'
import { decisionService } from '../transcode'
import { openNowPlayingOverlay } from '../actions'
import useStyle from './styles'
import { useDrag } from 'react-dnd'
import { DraggableTypes } from '../consts'

const AudioTitle = React.memo(({ audioInfo, gainInfo, isMobile }) => {
  const classes = useStyle()
  const className = classes.audioTitle
  const isDesktop = useMediaQuery('(min-width:810px)')
  const dispatch = useDispatch()

  const song = audioInfo.song
  const [, dragSongRef] = useDrag(
    () => ({
      type: DraggableTypes.SONG,
      item: { ids: [song?.id] },
      options: { dropEffect: 'copy' },
    }),
    [song],
  )

  if (!song) {
    return ''
  }

  const qi = {
    suffix: song.suffix,
    bitRate: song.bitRate,
    rgAlbumGain: song.rgAlbumGain,
    rgAlbumPeak: song.rgAlbumPeak,
    rgTrackGain: song.rgTrackGain,
    rgTrackPeak: song.rgTrackPeak,
  }

  const decision = decisionService.getCachedDecision(audioInfo.trackId)
  const transcodeProps = decision
    ? {
        transcodeStream: decision.transcodeStream || null,
        isDirectPlay: decision.canDirectPlay,
      }
    : {}

  const subtitle = song.tags?.['subtitle']
  const title = song.title + (subtitle ? ` (${subtitle})` : '')

  const handleClick = (e) => {
    e.preventDefault()
    dispatch(openNowPlayingOverlay())
  }

  return (
    <a
      href="#"
      onClick={handleClick}
      className={className}
      ref={dragSongRef}
    >
      <span>
        <span className={clsx(classes.songTitle, 'songTitle')}>{title}</span>
        {isDesktop && (
          <QualityInfo
            record={qi}
            className={classes.qualityInfo}
            {...gainInfo}
            {...transcodeProps}
          />
        )}
      </span>
      {isMobile ? (
        <>
          <span className={classes.songInfo}>
            <span className={'songArtist'}>{song.artist}</span>
          </span>
          <span className={clsx(classes.songInfo, classes.songAlbum)}>
            <span className={'songAlbum'}>{song.album}</span>
            {song.year ? ` - ${song.year}` : ''}
          </span>
        </>
      ) : (
        <span className={classes.songInfo}>
          <span className={'songArtist'}>{song.artist}</span> -{' '}
          <span className={'songAlbum'}>{song.album}</span>
          {song.year ? ` - ${song.year}` : ''}
        </span>
      )}
    </a>
  )
})

AudioTitle.displayName = 'AudioTitle'

export default AudioTitle
```

Note: `linkTo`/`isRadio`/`react-router-dom`'s `Link` import are removed since
the title no longer navigates — it opens the overlay. `DraggableTypes` drag
behavior (dragging the title into a playlist) is preserved unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ui && npx vitest run src/audioplayer/AudioTitle.test.jsx`
Expected: PASS — update the two existing "links to..." tests, since they no
longer apply (title is not a router Link anymore). Replace them with:

```javascript
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
```

Remove the now-obsolete `react-router-dom` mock at the top of the test file
(no longer imported by the component) and the two old
`'links to playlist...'` / `'falls back to album link...'` tests.

- [ ] **Step 5: Update `Player.jsx`'s `onCoverClick`**

In `ui/src/audioplayer/Player.jsx`, add `openNowPlayingOverlay` to the
existing action import (line 20-28):

```javascript
import {
  clearQueue,
  currentPlaying,
  refreshQueue,
  setPlayMode,
  setTranscodingProfile,
  setVolume,
  syncQueue,
  openNowPlayingOverlay,
} from '../actions'
```

Replace the `onCoverClick` callback (lines 368-372):

```javascript
  const onCoverClick = useCallback(
    (mode) => {
      if (mode === 'full') {
        dispatch(openNowPlayingOverlay())
      }
    },
    [dispatch],
  )
```

- [ ] **Step 6: Manual verification note**

This step has no automated test — the library's cover-click callback is only
exercised through its own internal DOM, which the existing test suite
does not mount. Manual verification happens in Task 6 after deployment: click
the mini-player cover and confirm the overlay opens instead of navigating to
the album page.

- [ ] **Step 7: Commit**

```bash
cd /home/dockerfiles/navidrome/src
git add ui/src/audioplayer/Player.jsx ui/src/audioplayer/AudioTitle.jsx ui/src/audioplayer/AudioTitle.test.jsx
git commit -m "feat: open now-playing overlay on cover/title click instead of navigating"
```

---

### Task 4: Build the `NowPlayingOverlay` component

**Files:**
- Create: `ui/src/layout/NowPlayingOverlay.jsx`
- Modify: `ui/src/i18n/en.json` (add `nowPlayingOverlay` strings)
- Test: `ui/src/layout/NowPlayingOverlay.test.jsx`

**Interfaces:**
- Consumes: `closeNowPlayingOverlay()` (Task 2), `useArtistInfo(artistId)` (Task 1), `subsonic.getCoverArtUrl(record, size)`.
- Produces: default export `NowPlayingOverlay` (no props — reads everything from `state.player` via `useSelector`). Consumed by Task 5 (mounted in `App.jsx`).

- [ ] **Step 1: Add i18n strings**

In `ui/src/i18n/en.json`, add a new top-level section right after the
existing `"player": { ... }` block (around line 667):

```json
  "nowPlayingOverlay": {
    "close": "Close",
    "lyrics": "Lyrics",
    "noLyrics": "No lyrics",
    "aboutArtist": "About the artist",
    "upNext": "Up next"
  },
```

- [ ] **Step 2: Write the failing test**

```javascript
// ui/src/layout/NowPlayingOverlay.test.jsx
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
      (state = { overlayOpen: true, queue: [item], current: { uuid: 'u1', song: item.song } }, action) =>
        action.type === 'PLAYER_SET_OVERLAY_OPEN'
          ? { ...state, overlayOpen: action.data.open }
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd ui && npx vitest run src/layout/NowPlayingOverlay.test.jsx`
Expected: FAIL — `Cannot find module './NowPlayingOverlay'`

- [ ] **Step 4: Write the component**

```javascript
// ui/src/layout/NowPlayingOverlay.jsx
import React, { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useTranslate } from 'react-admin'
import { makeStyles } from '@material-ui/core/styles'
import { IconButton, Typography } from '@material-ui/core'
import KeyboardArrowDownIcon from '@material-ui/icons/KeyboardArrowDown'
import subsonic from '../subsonic'
import { closeNowPlayingOverlay } from '../actions'
import { useArtistInfo } from '../artist/useArtistInfo'
import SafeHTML from '../common/SafeHTML'

const useStyles = makeStyles((theme) => ({
  root: {
    position: 'fixed',
    inset: 0,
    zIndex: theme.zIndex.modal + 1,
    overflowY: 'auto',
    background: 'linear-gradient(#1d1d1d, #121212)',
    color: '#fff',
    padding: theme.spacing(3),
  },
  closeButton: {
    color: '#fff',
  },
  body: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(4),
    marginTop: theme.spacing(2),
  },
  coverColumn: {
    flex: '0 0 320px',
  },
  cover: {
    width: '100%',
    borderRadius: theme.spacing(1),
  },
  infoColumn: {
    flex: '1 1 400px',
    minWidth: 0,
  },
  title: {
    fontWeight: 700,
    fontSize: 'calc(1.5rem + 1.5vw)',
  },
  meta: {
    color: '#b3b3b3',
    marginBottom: theme.spacing(2),
  },
  section: {
    marginTop: theme.spacing(3),
  },
  sectionHeading: {
    fontWeight: 700,
    marginBottom: theme.spacing(1),
  },
  lyrics: {
    whiteSpace: 'pre-line',
    color: '#e0e0e0',
  },
  queueItem: {
    padding: theme.spacing(1, 0),
    color: '#b3b3b3',
  },
}))

const stripLyricTimestamps = (lyric) =>
  lyric ? lyric.replace(/^\[\d{2}:\d{2}\.\d{2}\]\s*/gm, '') : ''

const NowPlayingOverlay = () => {
  const classes = useStyles()
  const dispatch = useDispatch()
  const translate = useTranslate()
  const overlayOpen = useSelector((state) => state.player.overlayOpen)
  const queue = useSelector((state) => state.player.queue)
  const current = useSelector((state) => state.player.current)

  const currentItem = queue.find((item) => item.uuid === current?.uuid)
  const song = current?.song || currentItem?.song
  const artistId = song?.artistId || song?.albumArtistId
  const artistInfo = useArtistInfo(overlayOpen ? artistId : undefined)

  const handleClose = () => dispatch(closeNowPlayingOverlay())

  useEffect(() => {
    if (!overlayOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayOpen])

  if (!overlayOpen || !song) {
    return null
  }

  const lyricText = stripLyricTimestamps(currentItem?.lyric)
  const upNext = current?.uuid
    ? queue.slice(queue.findIndex((item) => item.uuid === current.uuid) + 1)
    : []

  return (
    <div data-testid="now-playing-overlay" className={classes.root}>
      <IconButton
        className={classes.closeButton}
        onClick={handleClose}
        aria-label={translate('nowPlayingOverlay.close')}
      >
        <KeyboardArrowDownIcon />
      </IconButton>

      <div className={classes.body}>
        <div className={classes.coverColumn}>
          <img
            className={classes.cover}
            src={subsonic.getCoverArtUrl(
              { id: song.id, updatedAt: song.updatedAt, album: song.album },
              600,
            )}
            alt={`${song.album} cover art`}
          />
        </div>

        <div className={classes.infoColumn}>
          <Typography className={classes.title}>{song.title}</Typography>
          <Typography className={classes.meta}>
            {song.artist} — {song.album}
            {song.year ? ` (${song.year})` : ''}
            {song.genre ? ` · ${song.genre}` : ''}
          </Typography>

          <div className={classes.section}>
            <Typography className={classes.sectionHeading}>
              {translate('nowPlayingOverlay.lyrics')}
            </Typography>
            <Typography className={classes.lyrics}>
              {lyricText || translate('nowPlayingOverlay.noLyrics')}
            </Typography>
          </div>

          {artistInfo?.biography && (
            <div className={classes.section}>
              <Typography className={classes.sectionHeading}>
                {translate('nowPlayingOverlay.aboutArtist')}
              </Typography>
              <SafeHTML>{artistInfo.biography}</SafeHTML>
            </div>
          )}

          {upNext.length > 0 && (
            <div className={classes.section}>
              <Typography className={classes.sectionHeading}>
                {translate('nowPlayingOverlay.upNext')}
              </Typography>
              {upNext.map((item) => (
                <Typography key={item.uuid} className={classes.queueItem}>
                  {item.song?.title} — {item.song?.artist}
                </Typography>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default NowPlayingOverlay
```

`SafeHTML` is the existing sanitizing wrapper already used by
`DesktopArtistDetails.jsx`/`MobileArtistDetails.jsx` for the same biography
field — reused here, not reimplemented, so the same XSS-safe handling applies.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd ui && npx vitest run src/layout/NowPlayingOverlay.test.jsx`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
cd /home/dockerfiles/navidrome/src
git add ui/src/layout/NowPlayingOverlay.jsx ui/src/layout/NowPlayingOverlay.test.jsx ui/src/i18n/en.json
git commit -m "feat: add NowPlayingOverlay component"
```

---

### Task 5: Mount the overlay and style it for the Spotify theme

**Files:**
- Modify: `ui/src/App.jsx:184` (mount point)
- Modify: `ui/src/themes/spotify.js` (overlay override, optional refinement)

**Interfaces:**
- Consumes: `NowPlayingOverlay` default export (Task 4).

- [ ] **Step 1: Mount the overlay next to the Player**

In `ui/src/App.jsx`, import the component near the existing `Player` import
(line 25):

```javascript
import { Player } from './audioplayer'
import NowPlayingOverlay from './layout/NowPlayingOverlay'
```

Render it as a sibling right after `<Player />` (line 184):

```javascript
        <Player />,
        <NowPlayingOverlay key="now-playing-overlay" />,
```

Match whatever array/fragment syntax surrounds the existing `<Player />`
entry at that line — confirm by reading the surrounding 10 lines before
editing, since `App.jsx` builds this as a list passed to a layout prop.

- [ ] **Step 2: Confirm the component already looks right in the Spotify theme**

The component's own `makeStyles` in Task 4 already hard-codes the
Spotify-dark gradient (`linear-gradient(#1d1d1d, #121212)`) and matches the
palette used by `NDAlbumDetails`/`NDPlaylistDetails` in `ui/src/themes/spotify.js`
(`background: 'linear-gradient(#1d1d1d, transparent)'`). No theme file change
is required for the overlay to look correct under the Spotify theme — skip
adding a `NDNowPlayingOverlay` theme override unless visual testing in Task 6
shows a mismatch.

- [ ] **Step 3: Commit**

```bash
cd /home/dockerfiles/navidrome/src
git add ui/src/App.jsx
git commit -m "feat: mount NowPlayingOverlay in App"
```

---

### Task 6: Build, deploy, and manually verify

No automated test replaces this — it's the real Docker build/deploy/manual
click-through against the running instance, same pipeline used for every
previous change in this project.

- [ ] **Step 1: Run the full frontend test suite**

Run: `cd /home/dockerfiles/navidrome/src/ui && npx vitest run`
Expected: PASS, no regressions anywhere in the suite

- [ ] **Step 2: Build the image**

Run (from `/home/dockerfiles/navidrome/src`):
```bash
docker build -t navidrome-custom:local .
```
Expected: exit code 0, image `navidrome-custom:local` updated

- [ ] **Step 3: Redeploy**

Run (from `/home/dockerfiles/navidrome`):
```bash
docker compose -f navidrome.yml up -d
```
Expected: container `navidrome` recreated and started

- [ ] **Step 4: Verify container health**

Run:
```bash
docker ps --filter "name=navidrome" --format "table {{.Names}}\t{{.Status}}"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4533/
docker logs navidrome --tail 15
```
Expected: container `Up`, HTTP 302, log shows `Navidrome server is ready!`
with no new errors

- [ ] **Step 5: Manual click-through**

In a browser against `http://<server>:4533`:
1. Play any track.
2. Click the track title in the mini player bar → overlay opens, shows
   correct title/artist/album/year/genre.
3. Click the cover in the mini player bar → overlay opens (not a navigation
   to the album page).
4. Confirm lyrics show if the track has synced lyrics, or the "No lyrics"
   message otherwise.
5. Confirm the artist bio section appears when Last.fm has data for that
   artist, and is absent otherwise.
6. Confirm "Up next" lists the remaining queue in order.
7. Close via the down-arrow button, then reopen and close via Escape.
8. Confirm playback continues uninterrupted throughout (no pause/restart
   when opening/closing).

- [ ] **Step 6: Commit any fixups found during manual verification**

If step 5 surfaces issues, fix them, re-run steps 1–5, then:
```bash
cd /home/dockerfiles/navidrome/src
git add -A
git commit -m "fix: address issues found during now-playing overlay verification"
```
(Skip this step entirely if no fixups were needed.)

---

## Self-Review Notes

- **Spec coverage:** Entry point (Task 3), cover/metadata/lyrics/bio/queue
  content (Task 4), overlay-not-route + no backend change (architecture
  section + Task 2), Spotify-theme look (Task 5), build/deploy verification
  (Task 6) — all five spec sections have a task.
- **Known limitation carried over, not fixed here:** `mapToAudioLists` in
  `playerReducer.js` only concatenates **synced** lyric lines into
  `item.lyric` (see `if (structuredLyric.synced)` guard). A track with only
  unsynced/plain lyrics will show "No lyrics" in the overlay even though
  Navidrome parsed lyrics for it. Fixing that is a `playerReducer.js`/backend
  concern outside this spec's scope (spec only asked to *display* existing
  data) — flagged here so it isn't mistaken for a bug introduced by this
  plan.
- **Type/name consistency check:** `openNowPlayingOverlay`/
  `closeNowPlayingOverlay` (Task 2) are the exact names used in Task 3's
  imports and Task 4's import — confirmed matching.

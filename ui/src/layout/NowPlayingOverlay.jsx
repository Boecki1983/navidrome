import React, { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useTranslate } from 'react-admin'
import { makeStyles } from '@material-ui/core/styles'
import { IconButton, Typography } from '@material-ui/core'
import KeyboardArrowDownIcon from '@material-ui/icons/KeyboardArrowDown'
import subsonic from '../subsonic'
import { closeNowPlayingOverlay } from '../actions'
import { useArtistInfo } from '../artist/useArtistInfo'
import { SafeHTML } from '../common/SafeHTML'

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
            <span>{song.artist}</span> — <span>{song.album}</span>
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
                  <span>{item.song?.title}</span> — {item.song?.artist}
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

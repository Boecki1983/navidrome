import React from 'react'
import { useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import { useGetList, useTranslate } from 'react-admin'
import { Typography } from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import { Title, useImageUrl } from '../common'
import { setTrack } from '../actions'
import subsonic from '../subsonic'
import config from '../config'

const FAVORITES_PAGINATION = { page: 1, perPage: 30 }
const FAVORITES_SORT = { field: 'starred_at', order: 'DESC' }
const FAVORITES_FILTER = { starred: true }

const useStyles = makeStyles((theme) => ({
  root: { margin: '20px' },
  section: { marginBottom: theme.spacing(4) },
  sectionTitle: { marginBottom: theme.spacing(1.5) },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: theme.spacing(2.5),
  },
  item: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    textDecoration: 'none',
    color: 'inherit',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
    font: 'inherit',
    borderRadius: 4,
    transition: 'transform 150ms ease-out',
    '&:hover, &:focus-visible': {
      transform: 'translateY(-2px)',
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
  },
  coverContainer: {
    width: '100%',
    aspectRatio: '1',
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: theme.palette.type === 'dark' ? '#333' : '#e0e0e0',
    boxShadow: theme.shadows[1],
  },
  cover: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  itemName: {
    marginTop: theme.spacing(1),
    fontSize: '14px',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },
  itemSubtitle: {
    fontSize: '12px',
    color: theme.palette.type === 'dark' ? '#c5c5c5' : '#696969',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },
}))

const Cover = ({ record, className }) => {
  const classes = useStyles()
  const url = subsonic.getCoverArtUrl(record, config.uiCoverArtSize, true)
  const { imgUrl } = useImageUrl(url)
  return (
    <div className={classes.coverContainer}>
      <img
        src={imgUrl || undefined}
        alt={record.name || record.title}
        className={className || classes.cover}
      />
    </div>
  )
}

const FavoritesSection = ({ resource, children }) => {
  const classes = useStyles()
  const translate = useTranslate()
  const { ids, data, loaded } = useGetList(
    resource,
    FAVORITES_PAGINATION,
    FAVORITES_SORT,
    FAVORITES_FILTER,
  )

  if (!loaded || !ids || ids.length === 0) {
    return null
  }

  return (
    <div className={classes.section}>
      <Typography variant="h6" className={classes.sectionTitle}>
        {translate(`resources.${resource}.name`, { smart_count: 2 })}
      </Typography>
      <div className={classes.grid}>{ids.map((id) => children(data[id]))}</div>
    </div>
  )
}

const LinkedItem = ({ record, to, subtitle }) => {
  const classes = useStyles()
  return (
    <Link to={to} className={classes.item}>
      <Cover record={record} />
      <Typography className={classes.itemName}>{record.name}</Typography>
      {subtitle && (
        <Typography className={classes.itemSubtitle}>{subtitle}</Typography>
      )}
    </Link>
  )
}

const SongItem = ({ record }) => {
  const classes = useStyles()
  const dispatch = useDispatch()
  return (
    <button
      type="button"
      className={classes.item}
      onClick={() => dispatch(setTrack(record))}
    >
      <Cover record={record} />
      <Typography className={classes.itemName}>{record.title}</Typography>
      <Typography className={classes.itemSubtitle}>{record.artist}</Typography>
    </button>
  )
}

const Favorites = () => {
  const classes = useStyles()
  return (
    <div className={classes.root}>
      <Title subTitle="menu.favourites" args={{ smart_count: 2 }} />
      <FavoritesSection resource="album">
        {(record) => (
          <LinkedItem
            key={record.id}
            record={record}
            to={`/album/${record.id}/show`}
            subtitle={record.albumArtist}
          />
        )}
      </FavoritesSection>
      <FavoritesSection resource="artist">
        {(record) => (
          <LinkedItem
            key={record.id}
            record={record}
            to={`/artist/${record.id}/show`}
          />
        )}
      </FavoritesSection>
      <FavoritesSection resource="song">
        {(record) => <SongItem key={record.id} record={record} />}
      </FavoritesSection>
      <FavoritesSection resource="playlist">
        {(record) => (
          <LinkedItem
            key={record.id}
            record={record}
            to={`/playlist/${record.id}/show`}
          />
        )}
      </FavoritesSection>
    </div>
  )
}

export default Favorites

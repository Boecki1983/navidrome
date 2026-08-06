import { useMediaQuery, withWidth } from '@material-ui/core'
import {
  useShowController,
  ShowContextProvider,
  useRecordContext,
  useShowContext,
  ReferenceManyField,
  Pagination,
  Title as RaTitle,
} from 'react-admin'
import { useArtistInfo } from './useArtistInfo'
import AlbumGridView from '../album/AlbumGridView'
import MobileArtistDetails from './MobileArtistDetails'
import DesktopArtistDetails from './DesktopArtistDetails'
import {
  useAlbumsPerPage,
  useResourceRefresh,
  useScrollRestoration,
  Title,
} from '../common/index.js'
import ArtistActions from './ArtistActions'
import { makeStyles } from '@material-ui/core'

const useStyles = makeStyles(
  (theme) => ({
    actions: {
      width: '100%',
      justifyContent: 'flex-start',
      display: 'flex',
      paddingTop: '0.25em',
      paddingBottom: '0.25em',
      paddingLeft: '1em',
      paddingRight: '1em',
      flexWrap: 'wrap',
      overflowX: 'auto',
      [theme.breakpoints.down('xs')]: {
        paddingLeft: '0.5em',
        paddingRight: '0.5em',
        gap: '0.5em',
        justifyContent: 'space-around',
      },
    },
    actionsContainer: {
      paddingLeft: '.75rem',
      [theme.breakpoints.down('xs')]: {
        padding: '.5rem',
      },
    },
  }),
  {
    name: 'NDArtistShow',
  },
)

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

const ArtistShowLayout = (props) => {
  const showContext = useShowContext(props)
  const record = useRecordContext()
  const { width } = props
  const [, perPageOptions] = useAlbumsPerPage(width)
  const classes = useStyles()
  useResourceRefresh('artist', 'album')
  useScrollRestoration(!!record?.id)

  const maxPerPage = 90
  let perPage = 0
  let pagination = null

  // Use the main credit count instead of total count, as this is a precise measure
  // of the number of albums where the artist is credited as an album artist OR
  // artist
  const count = record?.stats?.['maincredit']?.albumCount || 0

  if (count > maxPerPage) {
    perPage = Math.trunc(maxPerPage / perPageOptions[0]) * perPageOptions[0]
    const rowsPerPageOptions = [1, 2, 3].map((option) =>
      Math.trunc(option * (perPage / 3)),
    )
    // react-admin's Pagination on purpose: the common one would persist 30/60/90 under the album grid's key
    pagination = <Pagination rowsPerPageOptions={rowsPerPageOptions} />
  }

  return (
    <>
      {record && <RaTitle title={<Title subTitle={record.name} />} />}
      {record && <ArtistDetails />}
      {record && (
        <div className={classes.actionsContainer}>
          <ArtistActions record={record} className={classes.actions} />
        </div>
      )}
      {record && (
        <ReferenceManyField
          {...showContext}
          addLabel={false}
          reference="album"
          target="artist_id"
          sort={{ field: 'max_year', order: 'ASC' }}
          filter={{ artist_id: record?.id }}
          perPage={perPage}
          pagination={pagination}
        >
          <AlbumGridView {...props} />
        </ReferenceManyField>
      )}
    </>
  )
}

const ArtistShow = withWidth()((props) => {
  const controllerProps = useShowController(props)
  return (
    <ShowContextProvider value={controllerProps}>
      <ArtistShowLayout {...controllerProps} />
    </ShowContextProvider>
  )
})

export default ArtistShow

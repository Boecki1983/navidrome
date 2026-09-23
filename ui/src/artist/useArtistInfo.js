import { useState, useEffect } from 'react'
import subsonic from '../subsonic'

export const useArtistInfo = (record) => {
  const [artistInfo, setArtistInfo] = useState()

  useEffect(() => {
    const artistId = record?.id
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
    // Keyed on the record, not its id: a refreshed record must re-fetch, or the stale
    // artistInfo state keeps winning the `||` in callers.
  }, [record])

  return artistInfo
}

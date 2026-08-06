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

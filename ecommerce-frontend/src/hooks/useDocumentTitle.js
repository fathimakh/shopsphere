import { useEffect } from 'react'
import { APP_NAME } from '../utils/constants'

/** Sets the browser tab title for the current page: "Cart · ShopSphere". */
export default function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : `${APP_NAME} — Shop smarter`
  }, [title])
}

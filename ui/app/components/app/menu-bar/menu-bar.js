import React, { useState } from 'react'
import SelectedAccount from '../selected-account'
import ConnectedStatusIndicator from '../connected-status-indicator'
import AccountOptionsMenu from './account-options-menu'
import { getEnvironmentType } from '../../../../../app/scripts/lib/util'
import { ENVIRONMENT_TYPE_POPUP } from '../../../../../app/scripts/lib/enums'
import { CONNECTED_ACCOUNTS_ROUTE } from '../../../helpers/constants/routes'
import { useI18nContext } from '../../../hooks/useI18nContext'
import { useMetricEvent } from '../../../hooks/useMetricEvent'
import { useHistory } from 'react-router-dom'

export default function MenuBar () {
  const t = useI18nContext()
  const openAccountOptionsEvent = useMetricEvent({
    eventOpts: {
      category: 'Navigation',
      action: 'Home',
      name: 'Opened Account Options',
    },
  })
  const history = useHistory()
  const [accountOptionsButtonElement, setAccountOptionsButtonElement] = useState(null)
  const [accountOptionsMenuOpen, setAccountOptionsMenuOpen] = useState(false)

  return (
    <div className="menu-bar">
      {
        getEnvironmentType() === ENVIRONMENT_TYPE_POPUP
          ? <ConnectedStatusIndicator onClick={() => history.push(CONNECTED_ACCOUNTS_ROUTE)} />
          : null
      }

      <SelectedAccount />

      <button
        className="fas fa-ellipsis-v menu-bar__account-options"
        data-testid="account-options-menu-button"
        ref={setAccountOptionsButtonElement}
        title={t('accountOptions')}
        onClick={() => {
          openAccountOptionsEvent()
          setAccountOptionsMenuOpen(true)
        }}
      />

      {
        accountOptionsMenuOpen && (
          <AccountOptionsMenu
            anchorElement={accountOptionsButtonElement}
            onClose={() => setAccountOptionsMenuOpen(false)}
          />
        )
      }
    </div>
  )
}

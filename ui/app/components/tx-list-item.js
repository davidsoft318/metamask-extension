const Component = require('react').Component
const h = require('react-hyperscript')
const connect = require('react-redux').connect
const inherits = require('util').inherits
const classnames = require('classnames')
const abi = require('human-standard-token-abi')
const abiDecoder = require('abi-decoder')
abiDecoder.addABI(abi)
const Identicon = require('./identicon')
const contractMap = require('eth-contract-metadata')

const actions = require('../actions')
const { conversionUtil, multiplyCurrencies } = require('../conversion-util')
const { calcTokenAmount } = require('../token-util')

const { getCurrentCurrency } = require('../selectors')

module.exports = connect(mapStateToProps, mapDispatchToProps)(TxListItem)

function mapStateToProps (state) {
  return {
    tokens: state.metamask.tokens,
    currentCurrency: getCurrentCurrency(state),
    tokenExchangeRates: state.metamask.tokenExchangeRates,
    selectedAddressTxList: state.metamask.selectedAddressTxList,
  }
}

function mapDispatchToProps (dispatch) {
  return {
    retryTransaction: transactionId => dispatch(actions.retryTransaction(transactionId)),
  }
}

inherits(TxListItem, Component)
function TxListItem () {
  Component.call(this)

  this.state = {
    total: null,
    fiatTotal: null,
  }
}

TxListItem.prototype.componentDidMount = async function () {
  const { txParams = {} } = this.props

  const decodedData = txParams.data && abiDecoder.decodeMethod(txParams.data)
  const { name: txDataName } = decodedData || {}

  const { total, fiatTotal } = txDataName === 'transfer'
    ? await this.getSendTokenTotal()
    : this.getSendEtherTotal()

  this.setState({ total, fiatTotal })
}

TxListItem.prototype.getAddressText = function () {
  const {
    address,
    txParams = {},
  } = this.props

  const decodedData = txParams.data && abiDecoder.decodeMethod(txParams.data)
  const { name: txDataName, params = [] } = decodedData || {}
  const { value } = params[0] || {}

  switch (txDataName) {
    case 'transfer':
      return `${value.slice(0, 10)}...${value.slice(-4)}`
    default:
      return address
        ? `${address.slice(0, 10)}...${address.slice(-4)}`
        : 'Contract Deployment'
  }
}

TxListItem.prototype.getSendEtherTotal = function () {
  const {
    transactionAmount,
    conversionRate,
    address,
    currentCurrency,
  } = this.props

  if (!address) {
    return {}
  }

  const totalInFiat = conversionUtil(transactionAmount, {
    fromNumericBase: 'hex',
    toNumericBase: 'dec',
    fromCurrency: 'ETH',
    toCurrency: currentCurrency,
    fromDenomination: 'WEI',
    numberOfDecimals: 2,
    conversionRate,
  })
  const totalInETH = conversionUtil(transactionAmount, {
    fromNumericBase: 'hex',
    toNumericBase: 'dec',
    fromCurrency: 'ETH',
    toCurrency: 'ETH',
    fromDenomination: 'WEI',
    conversionRate,
    numberOfDecimals: 6,
  })

  return {
    total: `${totalInETH} ETH`,
    fiatTotal: `${totalInFiat} ${currentCurrency.toUpperCase()}`,
  }
}

TxListItem.prototype.getTokenInfo = async function () {
  const { txParams = {}, tokenInfoGetter, tokens } = this.props
  const toAddress = txParams.to

  let decimals
  let symbol

  ({ decimals, symbol } = tokens.filter(({ address }) => address === toAddress)[0] || {})

  if (!decimals && !symbol) {
    ({ decimals, symbol } = contractMap[toAddress] || {})
  }

  if (!decimals && !symbol) {
    ({ decimals, symbol } = await tokenInfoGetter(toAddress))
  }

  return { decimals, symbol }
}

TxListItem.prototype.getSendTokenTotal = async function () {
  const {
    txParams = {},
    conversionRate,
    tokenExchangeRates,
    currentCurrency,
  } = this.props

  const decodedData = txParams.data && abiDecoder.decodeMethod(txParams.data)
  const { params = [] } = decodedData || {}
  const { value } = params[1] || {}
  const { decimals, symbol } = await this.getTokenInfo()
  const total = calcTokenAmount(value, decimals)

  const pair = symbol && `${symbol.toLowerCase()}_eth`

  let tokenToFiatRate
  let totalInFiat

  if (tokenExchangeRates[pair]) {
    tokenToFiatRate = multiplyCurrencies(
      tokenExchangeRates[pair].rate,
      conversionRate
    )

    totalInFiat = conversionUtil(total, {
      fromNumericBase: 'dec',
      toNumericBase: 'dec',
      fromCurrency: symbol,
      toCurrency: currentCurrency,
      numberOfDecimals: 2,
      conversionRate: tokenToFiatRate,
    })
  }

  const showFiat = Boolean(totalInFiat) && currentCurrency.toUpperCase() !== symbol

  return {
    total: `${total} ${symbol}`,
    fiatTotal: showFiat && `${totalInFiat} ${currentCurrency.toUpperCase()}`,
  }
}

TxListItem.prototype.showRetryButton = function () {
  const {
    transactionStatus,
    transactionSubmittedTime,
    selectedAddressTxList,
    transactionId,
    txParams,
  } = this.props
  const currentNonce = txParams.nonce
  const currentNonceTxs = selectedAddressTxList.filter(tx => tx.txParams.nonce === currentNonce)
  const currentNonceSubmittedTxs = currentNonceTxs.filter(tx => transactionStatus === 'submitted')
  const isLastSubmittedTxWithCurrentNonce =
    currentNonceSubmittedTxs[currentNonceSubmittedTxs.length - 1].id === transactionId

  return isLastSubmittedTxWithCurrentNonce && Date.now() - transactionSubmittedTime > 30000
}

TxListItem.prototype.resubmit = function () {
  const { transactionId } = this.props
  this.props.retryTransaction(transactionId)
}

TxListItem.prototype.render = function () {
  const {
    transactionStatus,
    transactionAmount,
    onClick,
    transactionId,
    dateString,
    address,
    className,
  } = this.props
  const { total, fiatTotal } = this.state
  const showFiatTotal = transactionAmount !== '0x0' && fiatTotal

  return h(`div${className || ''}`, {
    key: transactionId,
    onClick: () => onClick && onClick(transactionId),
  }, [
    h(`div.flex-column.tx-list-item-wrapper`, {}, [

      h('div.tx-list-date-wrapper', {
        style: {},
      }, [
        h('span.tx-list-date', {}, [
          dateString,
        ]),
      ]),

      h('div.flex-row.tx-list-content-wrapper', {
        style: {},
      }, [

        h('div.tx-list-identicon-wrapper', {
          style: {},
        }, [
          h(Identicon, {
            address,
            diameter: 28,
          }),
        ]),

        h('div.tx-list-account-and-status-wrapper', {}, [
          h('div.tx-list-account-wrapper', {
            style: {},
          }, [
            h('span.tx-list-account', {}, [
              this.getAddressText(address),
            ]),
          ]),

          h('div.tx-list-status-wrapper', {
            style: {},
          }, [
            h('span', {
              className: classnames('tx-list-status', {
                'tx-list-status--rejected': transactionStatus === 'rejected',
                'tx-list-status--failed': transactionStatus === 'failed',
              }),
            },
              transactionStatus,
            ),
          ]),
        ]),

        h('div.flex-column.tx-list-details-wrapper', {
          style: {},
        }, [

          h('span.tx-list-value', total),

          showFiatTotal && h('span.tx-list-fiat-value', fiatTotal),

        ]),
      ]),

      this.showRetryButton() && h('div.tx-list-item-retry-container', [

        h('span.tx-list-item-retry-copy', 'Taking too long?'),

        h('span.tx-list-item-retry-link', {
          onClick: (event) => {
            event.stopPropagation()
            this.resubmit()
          },
        }, 'Increase the gas price on your transaction'),

      ]),

    ]), // holding on icon from design
  ])
}

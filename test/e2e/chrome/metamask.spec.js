const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const assert = require('assert')
const pify = require('pify')
const webdriver = require('selenium-webdriver')
const until = require('selenium-webdriver/lib/until')
const By = webdriver.By
const { delay, buildChromeWebDriver } = require('../func')

describe('Metamask popup page', function () {
  let driver, accountAddress, tokenAddress, extensionId

  this.timeout(0)

  before(async function () {
    const extPath = path.resolve('dist/chrome')
    driver = buildChromeWebDriver(extPath)
    await driver.get('chrome://extensions')
    await delay(500)
  })

  afterEach(async function () {
    if (this.currentTest.state === 'failed') {
      await verboseReportOnFailure(this.currentTest)
    }
  })

  after(async function () {
    await driver.quit()
  })

  describe('Setup', function () {

    it('switches to Chrome extensions list', async function () {
      const tabs = await driver.getAllWindowHandles()
      await driver.switchTo().window(tabs[0])
      await delay(300)
    })

    it(`selects MetaMask's extension id and opens it in the current tab`, async function () {
      extensionId = await getExtensionId()
      await driver.get(`chrome-extension://${extensionId}/popup.html`)
      await delay(500)
    })

    it('sets provider type to localhost', async function () {
      await driver.wait(until.elementLocated(By.css('#app-content')), 300)
      await setProviderType('localhost')
    })
  })

  describe('Account Creation', () => {

    it('matches MetaMask title', async () => {
      const title = await driver.getTitle()
      assert.equal(title, 'MetaMask', 'title matches MetaMask')
    })

    it('shows privacy notice', async () => {
      await driver.wait(async () => {
        const privacyHeader = await driver.findElement(By.css('#app-content > div > div.app-primary.from-right > div > div.flex-column.flex-center.flex-grow > h3')).getText()
        assert.equal(privacyHeader, 'PRIVACY NOTICE', 'shows privacy notice')  
        return privacyHeader === 'PRIVACY NOTICE'
      }, 300)
      await driver.findElement(By.css('button')).click()
    })

    it('show terms of use', async () => {
      await driver.wait(async () => {
        const terms = await driver.findElement(By.css('#app-content > div > div.app-primary.from-right > div > div.flex-column.flex-center.flex-grow > h3')).getText()
        assert.equal(terms, 'TERMS OF USE', 'shows terms of use')
        return terms === 'TERMS OF USE'
      })
    })

    it('checks if the TOU button is disabled', async () => {
      const button = await driver.findElement(By.css('button')).isEnabled()
      assert.equal(button, false, 'disabled continue button')
      const element = await driver.findElement(By.linkText('Attributions'))
      await driver.executeScript('arguments[0].scrollIntoView(true)', element)
      await delay(300)
    })

    it('allows the button to be clicked when scrolled to the bottom of TOU', async () => {
      const button = await driver.findElement(By.css('#app-content > div > div.app-primary.from-right > div > div.flex-column.flex-center.flex-grow > button'))
      const buttonEnabled = await button.isEnabled()
      assert.equal(buttonEnabled, true, 'enabled continue button')
      await button.click()
    })

    it('accepts password with length of eight', async () => {
      const passwordBox = await driver.findElement(By.id('password-box'))
      const passwordBoxConfirm = await driver.findElement(By.id('password-box-confirm'))
      const button = await driver.findElements(By.css('button'))

      await passwordBox.sendKeys('123456789')
      await passwordBoxConfirm.sendKeys('123456789')
      await button[0].click()
      await delay(500)
    })

    it('shows value was created and seed phrase', async () => {
      await delay(300)
      const seedPhrase = await driver.findElement(By.css('.twelve-word-phrase')).getText()
      assert.equal(seedPhrase.split(' ').length, 12)
      const continueAfterSeedPhrase = await driver.findElement(By.css('#app-content > div > div.app-primary.from-right > div > button:nth-child(4)'))
      assert.equal(await continueAfterSeedPhrase.getText(), `I'VE COPIED IT SOMEWHERE SAFE`)
      await continueAfterSeedPhrase.click()
      await delay(300)
    })

    it('shows account address', async function () {
      accountAddress = await driver.findElement(By.css('#app-content > div > div.app-primary.from-left > div > div > div:nth-child(1) > flex-column > div.flex-row > div')).getText()
    })

    it('logs out of the vault', async () => {
      await driver.findElement(By.css('.sandwich-expando')).click()
      await delay(500)
      const logoutButton = await driver.findElement(By.css('#app-content > div > div:nth-child(3) > span > div > li:nth-child(3)'))
      assert.equal(await logoutButton.getText(), 'Log Out')
      await logoutButton.click()
    })

    it('accepts account password after lock', async () => {
      await delay(500)
      await driver.findElement(By.id('password-box')).sendKeys('123456789')
      await driver.findElement(By.css('button')).click()
      await delay(500)
    })

    it('shows QR code option', async () => {
      await delay(300)
      await driver.findElement(By.css('.fa-ellipsis-h')).click()
      await driver.findElement(By.css('#app-content > div > div.app-primary.from-right > div > div > div:nth-child(1) > flex-column > div.name-label > div > span > i > div > div > li:nth-child(3)')).click()
      await delay(300)
    })

    it('checks QR code address is the same as account details address', async () => {
      const QRaccountAddress = await driver.findElement(By.css('.ellip-address')).getText()
      assert.equal(accountAddress.toLowerCase(), QRaccountAddress)
      await driver.findElement(By.css('.fa-arrow-left')).click()
      await delay(500)
    })
  })

  describe('Import Ganache seed phrase', function () {
    it('logs out', async function () {
      await driver.findElement(By.css('.sandwich-expando')).click()
      await delay(200)
      const logOut = await driver.findElement(By.css('#app-content > div > div:nth-child(3) > span > div > li:nth-child(3)'))
      assert.equal(await logOut.getText(), 'Log Out')
      await logOut.click()
      await delay(300)
    })

    it('restores from seed phrase', async function () {
      const restoreSeedLink = await driver.findElement(By.css('#app-content > div > div.app-primary.from-left > div > div.flex-row.flex-center.flex-grow > p'))
      assert.equal(await restoreSeedLink.getText(), 'Restore from seed phrase')
      await restoreSeedLink.click()
      await delay(100)
    })

    it('adds seed phrase', async function () {
      const testSeedPhrase = 'phrase upgrade clock rough situate wedding elder clever doctor stamp excess tent'
      const seedTextArea = await driver.findElement(By.css('#app-content > div > div.app-primary.from-left > div > textarea'))
      await seedTextArea.sendKeys(testSeedPhrase)

      await driver.findElement(By.id('password-box')).sendKeys('123456789')
      await driver.findElement(By.id('password-box-confirm')).sendKeys('123456789')
      await driver.findElement(By.css('#app-content > div > div.app-primary.from-left > div > div > button:nth-child(2)')).click()
      await delay(500)
    })

    it('balance renders', async function () {
      await delay(200)
      const balance = await driver.findElement(By.css('#app-content > div > div.app-primary.from-right > div > div > div.flex-row > div.ether-balance.ether-balance-amount > div > div > div:nth-child(1) > div:nth-child(1)'))
      assert.equal(await balance.getText(), '100.000')
      await delay(200)
    })

    it('sends transaction', async function () {
     const sendButton = await driver.findElement(By.css('#app-content > div > div.app-primary.from-right > div > div > div.flex-row > button:nth-child(4)'))
     assert.equal(await sendButton.getText(), 'SEND')
     await sendButton.click()
     await delay(200)
    })

    it('adds recipient address and amount', async function () {
      const sendTranscationScreen = await driver.findElement(By.css('#app-content > div > div.app-primary.from-right > div > h3:nth-child(2)')).getText()
      assert.equal(sendTranscationScreen, 'SEND TRANSACTION')
      const inputAddress = await driver.findElement(By.css('#app-content > div > div.app-primary.from-right > div > section:nth-child(3) > div > input'))
      const inputAmmount = await driver.findElement(By.css('#app-content > div > div.app-primary.from-right > div > section:nth-child(4) > input'))
      await inputAddress.sendKeys('0x2f318C334780961FB129D2a6c30D0763d9a5C970')
      await inputAmmount.sendKeys('10')
      await driver.findElement(By.css('#app-content > div > div.app-primary.from-right > div > section:nth-child(4) > button')).click()
      await delay(300)
    })

    it('confirms transaction', async function () {
      await delay(300)
      await driver.findElement(By.css('#pending-tx-form > div.flex-row.flex-space-around.conf-buttons > input')).click()
      await delay(500)
    })

    it('finds the transaction in the transactions list', async function () {
      const tranasactionAmount = await driver.findElement(By.css('#app-content > div > div.app-primary.from-left > div > section > section > div > div > div > div.ether-balance.ether-balance-amount > div > div > div > div:nth-child(1)'))
      assert.equal(await tranasactionAmount.getText(), '10.0')
    })
  })

  describe('Token Factory', function () {

    it('navigates to token factory', async function () {
      await driver.get('http://tokenfactory.surge.sh/')
    })

    it('navigates to create token contract link', async function () {
      const createToken = await driver.findElement(By.css('#bs-example-navbar-collapse-1 > ul > li:nth-child(3) > a'))
      await createToken.click()
    })

    it('adds input for token', async function () {
      const totalSupply = await driver.findElement(By.css('#main > div > div > div > div:nth-child(2) > div > div:nth-child(5) > input'))
      const tokenName = await driver.findElement(By.css('#main > div > div > div > div:nth-child(2) > div > div:nth-child(6) > input'))
      const tokenDecimal = await driver.findElement(By.css('#main > div > div > div > div:nth-child(2) > div > div:nth-child(7) > input'))
      const tokenSymbol = await driver.findElement(By.css('#main > div > div > div > div:nth-child(2) > div > div:nth-child(8) > input'))
      const createToken = await driver.findElement(By.css('#main > div > div > div > div:nth-child(2) > div > button'))

      await totalSupply.sendKeys('100')
      await tokenName.sendKeys('Test')
      await tokenDecimal.sendKeys('0')
      await tokenSymbol.sendKeys('TST')
      await createToken.click()
      await delay(1000)
    })

    it('confirms transaction in MetaMask popup', async function () {
      const windowHandles = await driver.getAllWindowHandles()
      await driver.switchTo().window(windowHandles[windowHandles.length - 1])
      const metamaskSubmit = await driver.findElement(By.css('#pending-tx-form > div.flex-row.flex-space-around.conf-buttons > input'))
      await metamaskSubmit.click()
      await delay(1000)
    })

    it('switches back to Token Factory to grab the token contract address', async function () {
      const windowHandles = await driver.getAllWindowHandles()
      await driver.switchTo().window(windowHandles[0])
      const tokenContactAddress = await driver.findElement(By.css('#main > div > div > div > div:nth-child(2) > span:nth-child(3)'))
      tokenAddress = await tokenContactAddress.getText()
      await delay(500)
    })

    it('navigates back to MetaMask popup in the tab', async function () {
      await driver.get(`chrome-extension://${extensionId}/popup.html`)
      await delay(700)
    })
  })

  describe('Add Token', function () {
    it('switches to the add token screen', async function () {
      const tokensTab = await driver.findElement(By.css('#app-content > div > div.app-primary.from-right > div > section > div > div.inactiveForm.pointer'))
      assert.equal(await tokensTab.getText(), 'TOKENS')
      await tokensTab.click()
      await delay(300)
    })

    it('navigates to the add token screen', async function () {
      const addTokenButton = await driver.findElement(By.css('#app-content > div > div.app-primary.from-right > div > section > div.full-flex-height > div > button'))
      assert.equal(await addTokenButton.getText(), 'ADD TOKEN')
      await addTokenButton.click()
    })

    it('checks add token screen rendered', async function () {
      const addTokenScreen = await driver.findElement(By.css('#app-content > div > div.app-primary.from-right > div > div.section-title.flex-row.flex-center > h2'))
      assert.equal(await addTokenScreen.getText(), 'ADD TOKEN')
    })

    it('adds token parameters', async function () {
      const tokenContractAddress = await driver.findElement(By.css('#token-address'))
      await tokenContractAddress.sendKeys(tokenAddress)
      await delay(300)
      await driver.findElement(By.css('#app-content > div > div.app-primary.from-right > div > div.flex-column.flex-justify-center.flex-grow.select-none > div > button')).click()
      await delay(100)
    })

    it('checks the token balance', async function () {
      const tokenBalance = await driver.findElement(By.css('#app-content > div > div.app-primary.from-left > div > section > div.full-flex-height > ol > li:nth-child(2) > h3'))
      assert.equal(await tokenBalance.getText(), '100 TST')
    })
  })

  async function getExtensionId () {
    const extension = await driver.executeScript('return document.querySelector("extensions-manager").shadowRoot.querySelector("extensions-view-manager extensions-item-list").shadowRoot.querySelector("extensions-item:nth-child(2)").getAttribute("id")')
    return extension
  }

  async function setProviderType (type) {
    await driver.executeScript('window.metamask.setProviderType(arguments[0])', type)
  }

  async function verboseReportOnFailure (test) {
    const artifactDir = `./test-artifacts/chrome/${test.title}`
    const filepathBase = `${artifactDir}/test-failure`
    await pify(mkdirp)(artifactDir)
    // capture screenshot
    const screenshot = await driver.takeScreenshot()
    await pify(fs.writeFile)(`${filepathBase}-screenshot.png`, screenshot, { encoding: 'base64' })
    // capture dom source
    const htmlSource = await driver.getPageSource()
    await pify(fs.writeFile)(`${filepathBase}-dom.html`, htmlSource)
  }

})

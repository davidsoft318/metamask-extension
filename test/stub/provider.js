const JsonRpcEngine = require('json-rpc-engine')
const scaffoldMiddleware = require('eth-json-rpc-middleware/scaffold')

module.exports = {
  createEngineForTestData,
  providerFromEngine,
  scaffoldMiddleware,
  createStubbedProvider,
}


function createEngineForTestData () {
  return new JsonRpcEngine()
}

function providerFromEngine (engine) {
  const provider = { sendAsync: engine.handle.bind(engine) }
  return provider
}

function createStubbedProvider (resultStub) {
  const engine = createEngineForTestData()
  engine.push(scaffoldMiddleware(resultStub))
  return providerFromEngine(engine)
}

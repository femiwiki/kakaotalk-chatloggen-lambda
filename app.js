const ApiBuilder = require('claudia-api-builder')
const core = require('./core')

const api = new ApiBuilder()
api.get(
  'kakaotalk',
  request => core(request.queryString.url),
  { success: { contentType: 'text/html' } },
)
module.exports = api

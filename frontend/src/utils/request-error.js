export function getRequestErrorMessage(error) {
  return error.response?.data?.message || error.message || 'Unable to connect to the server.'
}

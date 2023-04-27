/**
 * Draw picture
 * @param {} input
 * @returns
 */
function Draw(payload) {
  payload = payload || {};
  payload.width = parseInt(payload.width);
  payload.height = parseInt(payload.height);
  return payload;
}

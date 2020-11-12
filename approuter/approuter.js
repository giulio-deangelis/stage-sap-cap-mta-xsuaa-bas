const approuter = require("@sap/approuter");
const jwtDecode = require("jwt-decode");
const ar = approuter();

ar.beforeRequestHandler.use(async (req, res, next) => {
  const jwt = jwtDecode(req.user.token.accessToken);
  console.log(jwt);
  next();
});

ar.start();
export function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) { // Assuming you are using some authentication strategy
      return next();
    }
    res.redirect('/login');
  }
  